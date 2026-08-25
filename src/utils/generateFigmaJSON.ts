/**
 * Generate figma.json — a clean, Figma-optimized token structure
 *
 * Structure:
 * - Modes: Colors (hex), Dropshadow-Color (RGB), Containers (hex backgrounds), Border-Variant (8-digit hex)
 * - Themes: 17 themes × 5 surface groups, all values → {Colors.Palette.Color-N}
 * - SurfacesContainers: links to Themes, containers get Background from Modes
 */

import { computeRadii, migrateLegacyRadii } from './componentRadii';
import {
  bevelJSON, PLATFORMS, PLATFORM_TARGET, PLATFORM_SPACER, platformButtonHeight,
} from './bevelGeometry';
import { dropshadowHex8, SHADOW_LEVELS, type ShadowLevel } from './dropshadow';
import { variantHex8, BORDER_VARIANT_ALPHA, ICON_VARIANT_ALPHA } from './variantAlpha';
import {
  buildTypeScale, resolveRoles, HEADER_CLAMPED_WEIGHT_FLOOR,
  type TypeStyle, type FamilyRole,
} from './typeScale';
import { nearestAvailableWeight } from './googleFontWeights';
import type { TypographyStyle } from '../types';

interface ColorToken {
  value: string;
  type: 'color';
}

/**
 * The themes exported to Figma, in the order they become MODES of the Theme
 * collection. Nine, against Figma's cap of ten.
 *
 * This list is written out rather than derived so the mode ORDER is stable —
 * Figma keys a mode by position as well as name, and a reordering churns the
 * file. But a hand-written list is exactly how this drifted: it still held the
 * pre-consolidation eighteen (the six -Light variants, White, Light-Gray,
 * Black) long after those were retired, and it never gained Neutral. Ten dead
 * names looked up nothing and skipped in silence, while Neutral — a theme the
 * CSS emits in full — was never looked up at all, so it could not reach Figma.
 *
 * assertThemesMatch below now fails that loudly instead.
 */
const THEMES = [
  'Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral',
  'Info', 'Success', 'Warning', 'Error',
];

const SURFACE_GROUPS_INTERNAL = ['Surfaces', 'Surfaces-Dim', 'Surfaces-Dimmest', 'Surfaces-Bright', 'Surfaces-Brightest', 'Containers'];
const SURFACE_GROUP_NAMES: Record<string, string> = {
  'Surfaces': 'Surface',
  'Surfaces-Dim': 'Surface-Dim',
  'Surfaces-Dimmest': 'Surface-Dimmest',
  'Surfaces-Bright': 'Surface-Bright',
  'Surfaces-Brightest': 'Surface-Brightest',
  'Containers': 'Containers',
};

const SURFACE_NAMES = [
  'Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright', 'Surface-Brightest',
  'Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest',
];

/**
 * Derive a tinted RGB triple from a hex by shifting lightness/saturation.
 * Used ONLY for highlight/lowlight bevel colors (via deriveColorHex) — NOT
 * for dropshadows, which use the shared Comeau math in ./dropshadow.
 */
function deriveBevelRGB(hex: string, lightOffset = -35, satMultiplier = 1.5): string {
  try {
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
      else if (max === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h /= 6;
    }
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const newS = clamp(s * 100 * satMultiplier, 0, 100) / 100;
    // Floor at 40% of the original lightness (min 8) so dark buttons don't
    // collapse to near-black — matches computeDropshadow in exportColorSystem.
    const minL = Math.max(8, l * 100 * 0.4);
    let newLPct = clamp(l * 100 + lightOffset, minL, 92);
    // Never let a lowlight come out lighter than its fill, or a highlight
    // darker. At the ends of the scale the floor and ceiling overshoot past the
    // fill and invert the bevel — a black button got a lowlight at the floor of
    // L 8 against a fill of L 1.6, a shadow lighter than the thing casting it.
    // Same clamp as computeDropshadow in exportColorSystem; the two must agree
    // or Figma and CSS render different bevels.
    if (lightOffset < 0) newLPct = Math.min(newLPct, l * 100);
    else if (lightOffset > 0) newLPct = Math.max(newLPct, l * 100);
    const newL = newLPct / 100;
    const h2 = h;
    let sr: number, sg: number, sb: number;
    if (newS === 0) {
      sr = sg = sb = Math.round(newL * 255);
    } else {
      const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
      const p = 2 * newL - q;
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      sr = Math.round(hue2rgb(p, q, h2 + 1 / 3) * 255);
      sg = Math.round(hue2rgb(p, q, h2) * 255);
      sb = Math.round(hue2rgb(p, q, h2 - 1 / 3) * 255);
    }
    return `${sr}, ${sg}, ${sb}`;
  } catch {
    return '0, 0, 0';
  }
}

/**
 * Build a flat lookup from the existing JSON to resolve tokens to Color references
 */
function buildTokenLookup(modeData: any): Record<string, string> {
  const lookup: Record<string, string> = {};

  function index(obj: any, prefix: string) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === 'object' && 'value' in val && 'type' in val) {
        lookup[prefix ? `${prefix}.${key}` : key] = val.value;
      } else if (val && typeof val === 'object' && !('value' in val)) {
        index(val, prefix ? `${prefix}.${key}` : key);
      }
    }
  }

  // Index everything except Themes
  for (const section of Object.keys(modeData)) {
    if (section !== 'Themes' && modeData[section] && typeof modeData[section] === 'object') {
      index(modeData[section], section);
    }
  }

  return lookup;
}

/**
 * Resolve a token to its final {Colors.Palette.Color-N} reference
 */
function resolveToColorRef(tokenValue: string, lookup: Record<string, string>, colors: any): string {
  if (!tokenValue) return tokenValue;
  if (tokenValue.startsWith('#')) {
    // Try to find which Color-N matches this hex
    if (colors) {
      for (const pal of Object.keys(colors)) {
        for (const [key, val] of Object.entries(colors[pal])) {
          if ((val as any)?.value === tokenValue && key.startsWith('Color-') && !key.endsWith('-Vibrant')) {
            return `{Colors.${pal}.${key}}`;
          }
        }
      }
    }
    return tokenValue;
  }
  if (!tokenValue.includes('{')) return tokenValue;

  let current = tokenValue;
  for (let depth = 0; depth < 5; depth++) {
    if (!current.includes('{')) break;
    const path = current.replace(/[{}]/g, '');

    // Already a Colors reference
    const colorMatch = path.match(/^(?:Colors\.)?(\w[\w-]*)\.(Color-\d+)$/);
    if (colorMatch) {
      return `{Colors.${colorMatch[1]}.${colorMatch[2]}}`;
    }

    const resolved = lookup[path];
    if (resolved) {
      if (resolved.startsWith('#')) {
        // Reverse-lookup hex to Color reference
        if (colors) {
          for (const pal of Object.keys(colors)) {
            for (const [key, val] of Object.entries(colors[pal])) {
              if ((val as any)?.value === resolved && key.startsWith('Color-') && !key.endsWith('-Vibrant')) {
                return `{Colors.${pal}.${key}}`;
              }
            }
          }
        }
        return resolved;
      }
      current = resolved;
      continue;
    }
    break;
  }

  return current;
}

/**
 * Follow a token chain to find its {Colors.Palette.Color-N} reference
 * WITHOUT reverse hex lookup. Returns the Color ref if found, or the
 * raw value if it can't resolve to a Color ref.
 */
function resolveToColorAlias(tokenValue: string, lookup: Record<string, string>): string {
  if (!tokenValue || !tokenValue.includes('{')) return tokenValue;

  let current = tokenValue;
  for (let depth = 0; depth < 10; depth++) {
    if (!current.includes('{')) break;
    const path = current.replace(/[{}]/g, '');

    // Already a Colors reference.
    //
    // Color-Vibrant is excluded: it is no longer exported (see extractTokens),
    // so returning a ref to it would leave a variable pointing at nothing —
    // and an unresolved alias fails silently rather than erroring. Fall through
    // to the lookup below so the chain resolves to a hex instead.
    const colorMatch = path.match(/^(?:Colors\.)?([\w-]+)\.(Color-[\w-]+)$/);
    if (colorMatch && !colorMatch[2].endsWith('-Vibrant')) {
      return `{Colors.${colorMatch[1]}.${colorMatch[2]}}`;
    }

    const resolved = lookup[path];
    if (resolved) {
      if (resolved.startsWith('#')) return resolved; // Hit hex, no further
      if (resolved.includes('{')) { current = resolved; continue; }
      break;
    }

    // Try Colors. prefix for {White}, {Black}
    if (!path.includes('.')) {
      const withPrefix = lookup[`Colors.${path}`];
      if (withPrefix) {
        if (withPrefix.startsWith('#')) return withPrefix;
        if (withPrefix.includes('{')) { current = withPrefix; continue; }
      }
    }
    break;
  }
  return current;
}

/**
 * Resolve a token to its final hex value
 */
function resolveToHex(tokenValue: string, lookup: Record<string, string>, colors: any): string | null {
  if (!tokenValue) return null;
  if (tokenValue.startsWith('#')) return tokenValue;
  if (!tokenValue.includes('{')) return null;

  let current = tokenValue;
  for (let depth = 0; depth < 10; depth++) {
    if (!current.includes('{')) break;
    const path = current.replace(/[{}]/g, '');

    // Colors reference — look up hex
    const colorMatch = path.match(/^(?:Colors\.)?([\w-]+)\.(Color-[\w-]+)$/);
    if (colorMatch && colors?.[colorMatch[1]]?.[colorMatch[2]]?.value) {
      return colors[colorMatch[1]][colorMatch[2]].value;
    }

    // Try exact lookup
    const resolved = lookup[path];
    if (resolved) {
      if (resolved.startsWith('#')) return resolved;
      if (resolved.includes('{')) { current = resolved; continue; }
      // Non-hex, non-token — might be RGB or other format
      break;
    }

    // Try without "Colors." prefix
    if (path.startsWith('Colors.')) {
      const stripped = lookup[path.substring(7)];
      if (stripped) {
        if (stripped.startsWith('#')) return stripped;
        if (stripped.includes('{')) { current = stripped; continue; }
      }
    }

    // Try adding "Colors." prefix for simple color names like {White}, {Black}
    if (!path.includes('.')) {
      const withPrefix = lookup[`Colors.${path}`];
      if (withPrefix) {
        if (withPrefix.startsWith('#')) return withPrefix;
        if (withPrefix.includes('{')) { current = withPrefix; continue; }
      }
    }

    break;
  }
  return null;
}

/**
 * Derive highlight/lowlight as hex color
 */
function deriveColorHex(hex: string, lightOffset: number, satMultiplier: number): string {
  const rgb = deriveBevelRGB(hex, lightOffset, satMultiplier);
  const parts = rgb.split(',').map(s => parseInt(s.trim()));
  return '#' + parts.map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Pressed hex for a button tone — one step in the button's OWN lightness
 * direction (dark button → darker, light button → lighter), going to pure black
 * at tone 1 and pure white at tone 12 so there's always a visible delta (Pressed
 * never equals the button's own tone). Hover is a 50% blend of the button bg and
 * this Pressed value. Matches the export + preview + engine. See
 * docs/hover-active-calculation.md.
 */
/** Relative luminance (WCAG) — used only to compare a label against its fill. */
function _figmaLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c.slice(0, 6);
  const n = parseInt(full, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const sr = v / 255;
    return sr <= 0.03928 ? sr / 12.92 : Math.pow((sr + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function pressedHexFor(colorKey: string, btnHex: string, palette: string, colors: any, textTable?: any): string {
  if (colorKey.endsWith('-Vibrant')) return colors[palette]?.['Color-10']?.value || btnHex;
  const n = parseInt(colorKey.replace('Color-', ''), 10);
  if (!Number.isFinite(n)) return btnHex;
  // Direction keys on the TONE INDEX, matching buildHoverForPalette() — the
  // implementation that bakes the real tokens. Keying on the fill's luminance
  // instead (as this did) disagrees on saturated mid-tones that measure "light"
  // while carrying light text, stepping the state toward its own label.
  //
  // Both ends invert, because neither has headroom: tone 1 stepping darker
  // meant #000000, which from a #040404 fill is 1.02:1 against itself.
  // Direction is decided by the LABEL — light text steps darker, dark text
  // steps lighter — so the state always moves AWAY from the text on it. The
  // tone index is only a proxy for that, and it is wrong wherever a palette's
  // text table flips somewhere other than tone 6.
  let labelIsLight = n <= 5; // proxy, used only if the table is unavailable
  const labelRaw = textTable?.Surfaces?.[palette]?.[colorKey]?.value;
  if (typeof labelRaw === 'string') {
    let labelHex = labelRaw;
    for (let hop = 0; hop < 8 && labelHex.startsWith('{'); hop++) {
      const path = labelHex.slice(1, -1).split('.');
      let node: any = { Colors: colors };
      for (const key of path) node = node?.[key];
      const next = typeof node === 'string' ? node : node?.value;
      if (typeof next !== 'string') break;
      labelHex = next;
    }
    if (labelHex.startsWith('#') && btnHex.startsWith('#')) {
      try { labelIsLight = _figmaLuminance(labelHex) > _figmaLuminance(btnHex); } catch { /* keep proxy */ }
    }
  }
  const an = Math.min(Math.max(labelIsLight ? n - 1 : n + 1, 1), 12);
  const stepHex = colors[palette]?.[`Color-${an}`]?.value || btnHex;
  // Color-1 moves a HALF step — its gap to Color-2 is a tenfold luminance
  // change, so a full step reads as a colour change. Matches the export.
  return n === 1 ? mixHex(btnHex, stepHex) : stepHex;
}

/**
 * Mix two hex colors at 50%
 */
function mixHex(hex1: string, hex2: string): string {
  const parse = (h: string) => {
    const c = h.replace('#', '');
    const f = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
    const n = parseInt(f.substring(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const mix = (a: number, b: number) => Math.round((a + b) / 2);
  return '#' + [mix(r1, r2), mix(g1, g2), mix(b1, b2)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** The tokens.json Typography section back into the role shape the scale is
 *  built from. tokens.json is what generateFigmaJSON is handed, so this is the
 *  one place the two exports could drift — they read the same fields. */
function rolesFromTokensJSON(typo: any): TypographyStyle[] {
  return [
    {
      type: 'header',
      family: typo['Set-Font-Family-Header']?.value || '',
      weight: typo['Set-Header-Font-Weight']?.value || '600',
      letterSpacing: typo['Set-Header-Letter-Spacing']?.value || '0em',
      allCaps: typo['Set-Header-Caps']?.value === 'uppercase',
    },
    {
      type: 'decorative',
      family: typo['Set-Font-Family-Display']?.value || typo['Set-Font-Family-Decorative']?.value || '',
      weight: typo['Set-Decorative-Font-Weight']?.value || '600',
      letterSpacing: typo['Set-Decorative-Letter-Spacing']?.value || '0em',
      allCaps: typo['Set-Decorative-Caps']?.value === 'uppercase',
      // Size and leading drive the Display ramp, so the Figma text styles land
      // on the same numbers the CSS does. Absent values fall through to the
      // scale's defaults.
      displaySize: numOrUndef(typo['Set-Display-Size']?.value),
      displayLeading: numOrUndef(typo['Set-Display-Leading']?.value),
      // Carried for a plugin to read; Figma text styles can't apply either.
      noise: numOrUndef(typo['Set-Display-Noise']?.value) ?? 0,
      bounce: numOrUndef(typo['Set-Display-Bounce']?.value) ?? 0,
    },
    {
      type: 'body',
      family: typo['Set-Font-Family-Body']?.value || '',
      weight: typo['Set-Body-Font-Weight']?.value || '400',
      letterSpacing: '0em',
      allCaps: false,
    },
  ];
}

/** A numeric token value, or undefined when it was never written. */
const numOrUndef = (v: unknown): number | undefined => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

/** em → Figma's letter-spacing percent. */
const emToPercent = (em: string): number => +((parseFloat(em) || 0) * 100).toFixed(2);

/**
 * The type scale in Figma's units. Line height ships in PIXELS, not percent:
 * the Display and Header steps are chosen so every computed line height lands
 * on a 4px multiple, and a percent round-trip loses that (48px × 117% = 56.16).
 */
function buildFigmaTypeScale(typo: any): any {
  const roles = rolesFromTokensJSON(typo);
  const resolved = resolveRoles(roles);
  const familyFor = (role: FamilyRole) => resolved[role].family;

  const entry = (s: TypeStyle, over?: { name: string; token: string; weight: number }) => ({
    name: over?.name ?? s.name,
    token: over?.token ?? s.token,
    // Where the plugin writes this style's primitives in the Platform
    // collection. Sizes and spacing are shared with the base step, so an extra
    // weight points back at the step it hangs off.
    variablePath: `Typography/${s.group}/${s.step}`,
    group: s.group,
    step: s.step,
    familyRole: s.familyRole,
    fontFamily: familyFor(s.familyRole),
    // The eyebrow renders in the OS UI font on the web, which has no Figma
    // equivalent — the family above is the stand-in, flagged so the plugin can
    // say so rather than pretending it matched.
    systemStackSubstitute: s.familyRole === 'eyebrow',
    fontWeight: over?.weight ?? s.weight,
    fontSize: s.size,
    lineHeightUnit: 'PIXELS',
    lineHeight: s.lineHeight,
    letterSpacingUnit: 'PERCENT',
    letterSpacingPercent: emToPercent(s.letterSpacing),
    textCase: s.textTransform === 'uppercase' ? 'UPPER' : 'ORIGINAL',
    paragraphSpacing: s.paragraphSpacing,
    variationAxes: s.axes ?? null,
    description: s.description || '',
  });

  const styles: any[] = [];
  for (const s of buildTypeScale(roles)) {
    styles.push(entry(s));
    for (const w of s.extraWeights || []) {
      // Caption/Legal carry their extra weight at the group level
      // (--Caption-Bold-…), Body carries it per size (--Body-Small-Semibold-…).
      const name = s.step === 'Standard' ? `${s.group}/${w.suffix}` : `${s.name}/${w.suffix}`;
      styles.push(entry(s, { name, token: `${s.token}-${w.suffix}`, weight: w.weight }));
    }
  }

  return {
    // Only the Desktop ramp is generated; the other platforms keep the values
    // the Figma template already holds.
    platform: 'Desktop',
    version: 1,
    meta: {
      displayFace: familyFor('display'),
      headerFace: familyFor('header'),
      eyebrowFace: familyFor('eyebrow'),
      bodyFace: familyFor('body'),
      // Figma has no equivalent for either, so they are recorded for reference
      // and rendered only by the CSS export.
      displayNoise: resolved.display.noise || 0,
      displayBounce: resolved.display.bounce || 0,
    },
    styles,
  };
}

export function generateFigmaJSON(designSystemJSON: any): any {
  const figma: any = { Modes: {}, Themes: {}, SurfacesContainers: {} };

  // Carry the brand's tone positions through to Figma. Same three values the
  // CSS emits as --DPT / --DST / --DTT, read from the same place so the two
  // cannot drift.
  if (designSystemJSON?.Brand) {
    figma.Brand = {
      DPT: designSystemJSON.Brand.DPT?.value,
      DST: designSystemJSON.Brand.DST?.value,
      DTT: designSystemJSON.Brand.DTT?.value,
    };
  }

  const modes = ['Light-Mode', 'Dark-Mode'];

  for (const modeName of modes) {
    const modeData = designSystemJSON.Modes?.[modeName];
    if (!modeData) continue;

    const colors = modeData.Colors;
    const themes = modeData.Themes;
    const lookup = buildTokenLookup(modeData);

    // ── Modes section — export ALL computed groups ──
    const modeSection: any = {};

    // Recursively extract all leaf tokens (with value+type) to hex
    function extractTokens(source: any, target: any) {
      for (const [key, val] of Object.entries(source)) {
        // Color-Vibrant is not exported to Figma.
        //
        // It was emitted into every palette-shaped table (Colors, Text, Header,
        // Border, Icon, Hover, Pressed, Dropshadow-*, ...) because those tables
        // iterate the palette and Color-Vibrant rode along — 527 definitions
        // across 40 groups, referenced by exactly zero tokens. The importer
        // only upserts and never deletes, so leaving them here would recreate
        // the variables in Figma after they were removed by hand.
        //
        // This drops the exported TOKENS only. 'Vibrant' remains live as an
        // internal tone selector (exportColorSystem: `isDark ? 'Vibrant' : PC`),
        // which exportToCSS rewrites to Color-8 — removing that would change
        // which tone dark-mode buttons pick.
        // Matches every keying convention, not just Color-Vibrant: the
        // Focus-Visible and Backgrounds tables are keyed by Background-N and so
        // carry Background-Vibrant (15 more entries, likewise unreferenced).
        if (key.endsWith('-Vibrant')) continue;
        if (val && typeof val === 'object' && 'value' in (val as any) && 'type' in (val as any)) {
          let hex = (val as any).value;
          // Resolve token references to hex
          if (hex && typeof hex === 'string' && hex.includes('{')) {
            const resolved = resolveToHex(hex, lookup, colors);
            hex = resolved || hex;
          }
          if (hex && typeof hex === 'string') {
            target[key] = { value: hex, type: 'color' };
          }
        } else if (val && typeof val === 'object' && !('value' in (val as any))) {
          target[key] = {};
          extractTokens(val, target[key]);
        }
      }
    }

    // Export all sections from the design system (except Themes which go in their own collection)
    const MODES_SECTIONS = [
      'Colors', 'Text', 'Eyebrows', 'Header', 'Quiet', 'Border', 'Border-Variant',
      'Hover', 'Pressed', 'Focus-Visible',
      'Icon', 'Icon-Variant', 'Tag',
      'Buttons', 'Default-Button', 'Default-Button-Border',
      'Backgrounds',
    ];

    for (const section of MODES_SECTIONS) {
      if (modeData[section]) {
        modeSection[section] = {};
        extractTokens(modeData[section], modeSection[section]);
      }
    }

    // Add utility colors
    if (!modeSection.Colors) modeSection.Colors = {};
    modeSection.Colors['Image-Overlay'] = {
      'Color-1': { value: modeName === 'Dark-Mode' ? '#0000004D' : '#00000000', type: 'color' },
    };
    modeSection.Colors['Transparent'] = {
      'Color-1': { value: '#00000000', type: 'color' },
    };

    // Add computed Button-Hover, Button-Pressed, Button-Highlight, Button-Lowlight,
    // Button-Border.
    if (colors) {
      const btnSections = ['Button-Hover', 'Button-Pressed', 'Button-Highlight',
        'Button-Lowlight'];
      for (const s of btnSections) modeSection[s] = {};
      const palettes = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'];
      for (const palette of palettes) {
        if (!colors[palette]) continue;
        for (const s of btnSections) modeSection[s][palette] = {};

        // The tone the theme bakes into its button refs is the LIGHT-mode
        // button tone, and the Theme layer is mode-independent so it cannot
        // flip. In dark mode the actual fill comes from the mode-aware
        // Buttons.<pal>.<shade> table instead (light Primary #70947b ->
        // dark #d4e3d9), so every value derived from Colors.<pal>.Color-N
        // describes the wrong button: the bevel highlight computed from
        // #70947b is DARKER than a #d4e3d9 face, inverting it.
        //
        // In dark mode every tone's BEVEL derives from the real button fill,
        // not from that tone's own colour. This looks like the table lying —
        // all twelve keys carry one value — and it is deliberate.
        //
        // The Theme collection is MODE-INDEPENDENT: a Theme variable aliases to
        // a Modes variable, and the light/dark pair lives on the Modes variable.
        // So a theme referencing {Button-Lowlight.Primary.Color-8} cannot point
        // somewhere else in dark mode — whatever dark value sits in Color-8 is
        // what the dark button gets. The dark button's fill is Light-Mode
        // Color-8, so Color-8's dark slot must hold THAT colour's bevel.
        //
        // Deriving each tone from the dark ramp instead was tried and reverted:
        // it made the table honest and every dark bevel wrong (Primary resolved
        // to #ac11ce against a real fill of #e9b7ff, where the CSS paints
        // #b42fee). Color-Vibrant is still emitted and carries the same value,
        // for anyone binding the vibrant fill by name.
        const darkFill = modeName === 'Dark-Mode'
          ? (modeSection.Buttons?.[palette]?.Medium?.Button?.value
            || modeSection.Buttons?.[palette]?.Light?.Button?.value
            || null)
          : null;
        for (const [colorKey, colorVal] of Object.entries(colors[palette])) {
          if (!colorKey.startsWith('Color-')) continue;
          const isVibrant = colorKey.endsWith('-Vibrant');
          const btnHex = (colorVal as any).value;
          const bevelBase = darkFill || btnHex;
          // Vibrant's states are already computed against the vibrant fill in
          // the export (Hover/Pressed.<pal>.Color-Vibrant, copied from
          // Light-Mode Color-8). pressedHexFor can't be used here: it steps by
          // the tone INDEX in colorKey, and 'Color-Vibrant' has no index.
          const activeHex = isVibrant
            ? (modeSection.Pressed?.[palette]?.['Color-Vibrant']?.value || btnHex)
            : pressedHexFor(colorKey, btnHex, palette, colors, modeSection.Text);
          const hoverHex = isVibrant
            ? (modeSection.Hover?.[palette]?.['Color-Vibrant']?.value || mixHex(btnHex, activeHex))
            : mixHex(btnHex, activeHex);
          modeSection['Button-Pressed'][palette][colorKey] = { value: activeHex, type: 'color' };
          modeSection['Button-Hover'][palette][colorKey] = { value: hoverHex, type: 'color' };
          // Match the CSS/lib bevel math (exportColorSystem computeHighlight/
          // computeLowlight): highlight L+25 sat×0.7, lowlight L-30 sat×0.85.
          // Lowlight REDUCES saturation so it reads as a neutral recessed
          // shadow, not a vibrant sibling of the body (the old ×1.4 boost read
          // as a bottom-edge glow on Info/Success/Warning/Error).
          const hlHex = deriveColorHex(bevelBase, 25, 0.7);
          const llHex = deriveColorHex(bevelBase, -30, 0.85);
          // Apply bevel opacity as alpha channel
          const bevelOpacity = designSystemJSON._componentStyle?.bevelOpacity ?? 50;
          const alphaHex = Math.round(bevelOpacity * 255 / 100).toString(16).padStart(2, '0');
          modeSection['Button-Highlight'][palette][colorKey] = { value: `${hlHex}${alphaHex}`, type: 'color' };
          modeSection['Button-Lowlight'][palette][colorKey] = { value: `${llHex}${alphaHex}`, type: 'color' };

          // Button borders are written into Default-Button-Border below, not
          // here — see the block after this loop.
        }
      }

      // Buttons/BlackWhite is built in exportColorSystem, not here, so the CSS
      // gets the same table — the Theme and State collections link into it at
      // their own tone. It arrives via the MODES_SECTIONS copy above.

      // ── BlackWhite in the flat button sections ────────────────────────
      //
      // BlackWhite cannot ride the palettes loop above: that loop derives every
      // value from Colors.<pal>.Color-N, and BlackWhite has no tonal ramp —
      // it is two fixed faces chosen by the surface's tone. So it was absent
      // from Button-Hover, Button-Pressed, Button-Highlight and Button-Lowlight
      // in BOTH modes, while sitting present in Buttons. A theme referencing
      // {Button-Lowlight.BlackWhite.Color-N} found nothing and resolved to no
      // colour, which reads as "no bevel" rather than as an error.
      //
      // Mirrored from the Buttons table rather than recomputed, so the two
      // cannot disagree about a black button's shadow.
      //
      // The formats differ and must be reconciled: Buttons stores Highlight and
      // Lowlight as "r, g, b" triples (they feed rgba() in CSS), while these
      // sections store 8-digit hex carrying the bevel opacity as alpha. A
      // triple written here would not parse as a colour.
      const bwButtons: any = (modeSection as any).Buttons?.BlackWhite;
      if (bwButtons) {
        const SLOT_FOR: Record<string, string> = {
          'Button-Hover': 'Hover', 'Button-Pressed': 'Pressed',
          'Button-Highlight': 'Highlight', 'Button-Lowlight': 'Lowlight',
        };
        const bevelOpacityBW = designSystemJSON._componentStyle?.bevelOpacity ?? 50;
        const alphaBW = Math.round(bevelOpacityBW * 255 / 100).toString(16).padStart(2, '0');
        const asHex = (v: string, withAlpha: boolean): string | null => {
          if (typeof v !== 'string') return null;
          if (v.startsWith('#')) return withAlpha && v.length === 7 ? `${v}${alphaBW}` : v;
          const parts = v.split(',').map((x) => parseInt(x.trim(), 10));
          if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
          const hex = '#' + parts.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('');
          return withAlpha ? `${hex}${alphaBW}` : hex;
        };
        for (const sec of btnSections) (modeSection as any)[sec].BlackWhite = {};
        for (const [colorKey, entry] of Object.entries<any>(bwButtons)) {
          if (!colorKey.startsWith('Color-')) continue;
          for (const sec of btnSections) {
            const raw = entry?.[SLOT_FOR[sec]]?.value;
            const isBevel = sec === 'Button-Highlight' || sec === 'Button-Lowlight';
            const hex = asHex(raw, isBevel);
            if (hex) (modeSection as any)[sec].BlackWhite[colorKey] = { value: hex, type: 'color' };
          }
        }
      }


      // ── Default-Button-Border ─────────────────────────────────────────
      //
      // Repurposed rather than adding a new group. It already has exactly the
      // right shape (Surfaces/Containers x 9 palettes x 12 tones, mode-aware)
      // and already exists in the Figma file — but nothing referenced it:
      // 234 variables per mode, consumed by zero tokens.
      //
      // The theme's button Border used to bake a literal tone into the
      // mode-independent Theme layer ({Border.Surfaces.Primary.Color-12}). For
      // every theme but Default that tone is the same in both modes, so it
      // stayed correct; Default's surface moves per mode, so its border kept
      // describing a tone-12 surface while sitting on tone 2 — dark green on
      // near-black (#2d3d32 on #111111, 1.64:1) ringing a near-white button.
      //
      //   Light: the existing Border.<scope>.<pal>.Color-N, verbatim.
      //   Dark:  the button's own fill, so the border sits flush and the fill
      //          alone delineates the control (~13:1 against the surface).
      //
      // Keeping the Surfaces/Containers split matters in light mode, where a
      // button on a surface and one inside a container take different borders.
      // The selection arrives as a combined string ('black-white',
      // 'secondary-adaptive', 'tonal-fixed', ...), so match on the prefix
      // rather than equality — see the parser in exportColorSystem.
      const isBlackWhiteButtons =
        String(designSystemJSON._userSelections?.button || '').startsWith('black-white');


      // Which palette the Default button draws from. Mirrors the mapping in
      // generateCompleteThemes so the border matches the fill beside it.
      const defaultButtonPalette: string = (() => {
        const mode = String(designSystemJSON?._userSelections?.button || 'primary')
          .replace(/-fixed|-adaptive/g, '');
        if (mode === 'black-white') return modeName === 'Dark-Mode' ? 'Primary' : 'Neutral';
        if (mode === 'secondary' || mode === 'laddered') return 'Secondary';
        return 'Primary';
      })();

      const dbb: any = modeSection['Default-Button-Border'] || {};
      for (const scope of ['Surfaces', 'Containers']) {
        if (!dbb[scope]) continue;
        for (const palette of Object.keys(dbb[scope])) {
          // Default-Button-Border carries a "Default" palette but Buttons does
          // not (it has the Black and White faces instead), so the Default
          // button's fill has
          // to come from Default-Button. Without this fallback the dark lookup
          // returns null for that palette and quietly falls through to the
          // LIGHT border — reintroducing exactly the bug this block fixes, on
          // the one palette most likely to be seen.
          const readFill = () =>
            modeSection.Buttons?.[palette]?.Medium?.Button?.value
            || modeSection.Buttons?.[palette]?.Light?.Button?.value
            || modeSection['Default-Button']?.[palette]?.Medium?.Button?.value
            || modeSection['Default-Button']?.[palette]?.Light?.Button?.value
            || null;

          // A black-and-white button has no tonal ramp, so there is no "one
          // step darker" edge to draw — the light-mode border would come from
          // the tonal Border table and render a maroon ring around a black or
          // white face. When that style is selected the border matches the fill
          // in BOTH modes, not just dark.
          //
          // Scoped to the Default palette because that is the one the button
          // style governs; the semantic palettes keep their own tonal borders.
          // Dark mode uses the per-tone Border table, exactly as light does.
          //
          // It used to force the button's own fill into EVERY tone, which made
          // the whole dark table one repeated value — 1 distinct of 12 against
          // light's 6 — and that is what it looks like in Figma: every tone of
          // every colour showing the same swatch.
          //
          // That blanket was compensating for a Theme-layer problem. The Theme
          // collection is mode-independent, so the Default theme bakes the
          // LIGHT surface's tone into its reference; in dark its surface moves
          // to a different tone, and the border then described a surface the
          // button was not on. Flattening every tone hid that, at the cost of
          // the table meaning anything.
          //
          // Fixed where it belongs: each tone keeps its own border, and the
          // fill is used only for the tone whose surface actually moves
          // between modes — which is the one case the original note described.
          // The Default palette is the Default THEME's own slot. Its surface
          // moves between modes, so it takes the tonal border in light and the
          // button's fill in dark — which is what the CSS emits for that theme.
          // Every other palette keeps its per-tone border in both modes.
          //
          // Every tone keeps its own border, in both modes.
          //
          // An exception for "the tone the Default theme sits on" was tried and
          // removed: this table is keyed by palette and tone, not by theme, so
          // it cannot tell the Default theme from the White theme — they sit on
          // the same tone. Forcing the fill there gave White an invisible
          // border (1.24:1 against its own surface). A theme-level distinction
          // has to be made in the Theme layer, not compensated for here.
          const fill = readFill();
          // The `Default` slot has no Border table of its own — Border is keyed
          // by real palettes. In light mode it therefore reads the border of
          // whichever palette the Default button actually uses, which is what
          // the theme referenced before it got its own slot, and what the CSS
          // emits. In dark it takes the fill, because its surface has moved.
          const borderSourcePalette = palette === 'Default' ? defaultButtonPalette : palette;
          for (const colorKey of Object.keys(dbb[scope][palette])) {
            const tonal = modeSection.Border?.[scope]?.[borderSourcePalette]?.[colorKey]?.value;
            const mustUseFill =
              // Black/white buttons: the border IS the fill, for every palette.
              // There is no tonal ramp to draw an edge from, and a brand-tonal
              // ring around a black button is the wrong reading.
              isBlackWhiteButtons
              || (modeName === 'Dark-Mode' && palette === 'Default');
            const next = (mustUseFill ? fill : tonal) || tonal || fill;
            if (next) dbb[scope][palette][colorKey] = { value: next, type: 'color' };
          }
        }
      }
      modeSection['Default-Button-Border'] = dbb;
    }

    // Computed groups: Border-Variant, Dropshadow-Color per palette per Color-N
    if (colors) {
      const palettes = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'];

      // Border-Variant: border color at 20% opacity (hex + '33')
      // Uses the Border section values if available, otherwise derives from palette
      modeSection['Border-Variant'] = {};
      const borderData = modeSection.Border || {};
      for (const section of ['Surfaces', 'Containers']) {
        modeSection['Border-Variant'][section] = {};
        const borderSection = borderData[section] || {};
        for (const palette of palettes) {
          modeSection['Border-Variant'][section][palette] = {};
          const borderPalette = borderSection[palette] || {};
          for (const [colorKey, colorVal] of Object.entries(colors[palette])) {
            if (!colorKey.startsWith('Color-') || colorKey.endsWith('-Vibrant')) continue;
            // Get border hex from Border section or derive from palette
            const borderToken = borderPalette[colorKey] as any;
            const borderHex = borderToken?.value || (colorVal as any).value;
            if (borderHex && borderHex.startsWith('#')) {
              // colorKey indexes the BACKGROUND tone, so the palette entry at
              // that key is the surface this border sits on — which is what the
              // adaptive alpha needs to keep the perceived weight even.
              modeSection['Border-Variant'][section][palette][colorKey] = {
                value: variantHex8(borderHex, BORDER_VARIANT_ALPHA, (colorVal as any).value),
                type: 'color',
              };
            }
          }
        }
      }

      // Icon-Variant: the icon colour at reduced opacity (adaptive, base 50%).
      //
      // Icon-Variant previously duplicated Icon exactly — 208 variables with
      // identical values and no differentiation, in Figma and in CSS alike. It
      // is the de-emphasised form of an icon, so it relates to Icon the way
      // Border-Variant relates to Border.
      //
      // Computed here rather than aliased because a token reference cannot
      // carry an alpha channel — it has to be baked as an 8-digit hex.
      const iconData = modeSection.Icon || {};
      modeSection['Icon-Variant'] = {};
      for (const section of ['Surfaces', 'Containers']) {
        modeSection['Icon-Variant'][section] = {};
        const iconSection = iconData[section] || {};
        for (const palette of palettes) {
          modeSection['Icon-Variant'][section][palette] = {};
          const iconPalette = iconSection[palette] || {};
          for (const [colorKey, colorVal] of Object.entries(colors[palette])) {
            if (!colorKey.startsWith('Color-') || colorKey.endsWith('-Vibrant')) continue;
            const iconToken = iconPalette[colorKey] as any;
            const iconHex = iconToken?.value || (colorVal as any).value;
            if (iconHex && iconHex.startsWith('#')) {
              modeSection['Icon-Variant'][section][palette][colorKey] = {
                value: variantHex8(iconHex, ICON_VARIANT_ALPHA, (colorVal as any).value),
                type: 'color',
              };
            }
          }
        }
      }

      // Dropshadow-Color-1..5: per-elevation tinted shadow tokens. Both
      // hue/saturation/lightness AND alpha vary per level (Comeau approach)
      // so higher elevations read as more dramatic, not weaker. Math lives
      // in src/utils/dropshadow.ts and is shared with the CSS exporter so
      // the values are 1:1 across Figma and code.
      for (const level of SHADOW_LEVELS) {
        const sectionName = `Dropshadow-Color-${level}`;
        modeSection[sectionName] = {};
        for (const palette of palettes) {
          modeSection[sectionName][palette] = {};
          for (const [colorKey, colorVal] of Object.entries(colors[palette])) {
            if (!colorKey.startsWith('Color-') || colorKey.endsWith('-Vibrant')) continue;
            const bgHex = (colorVal as any).value;
            if (bgHex && bgHex.startsWith('#')) {
              modeSection[sectionName][palette][colorKey] = {
                value: dropshadowHex8(bgHex, level as ShadowLevel),
                type: 'color',
              };
            }
          }
        }
      }
    }

    figma.Modes[modeName] = modeSection;

    // ── Themes section (only build once from Light-Mode) ──
    if (modeName === 'Light-Mode' && themes) {
      // A theme the generator produces but this list omits cannot reach Figma,
      // and a name here that the generator no longer produces is dead. Neither
      // shows up as an error at import — the collection is simply short a mode.
      const generated = Object.keys(themes);
      const missingFromExport = generated.filter((t) => !THEMES.includes(t));
      const deadNames = THEMES.filter((t) => !generated.includes(t));
      if (missingFromExport.length) {
        console.warn(
          `\u26A0\uFE0F [Figma] ${missingFromExport.length} generated theme(s) are NOT in the export list ` +
          `and will be absent from the Theme collection: ${missingFromExport.join(', ')}`,
        );
      }
      if (deadNames.length) {
        console.warn(
          `\u26A0\uFE0F [Figma] ${deadNames.length} name(s) in the export list are no longer generated: ` +
          `${deadNames.join(', ')}`,
        );
      }
      if (THEMES.length > 10) {
        console.warn(
          `\u26A0\uFE0F [Figma] ${THEMES.length} themes exceeds Figma's 10-mode cap; the tail will not import.`,
        );
      }

      for (const themeName of THEMES) {
        const theme = themes[themeName];
        if (!theme) continue;

        const figmaTheme: any = {};

        for (const internalKey of SURFACE_GROUPS_INTERNAL) {
          const groupData = theme[internalKey];
          if (!groupData) continue;
          const groupKey = SURFACE_GROUP_NAMES[internalKey] || internalKey;

          const figmaGroup: any = {};

          // Recursively resolve all tokens to Color references
          // Compute Dropshadow-Color, Border-Variant, Highlight, Lowlight as hex
          // Capture internalKey for this iteration
          const currentInternalKey = internalKey;
          const processGroup = (source: any, target: any) => {
            for (const [key, val] of Object.entries(source)) {
              // Dropshadow-Color → link to Modes/Dropshadow-Color-{1-5} entries
              if (key === 'Dropshadow-Color') {
                const bgToken = source['Background']?.value || source['Surface']?.value;
                if (bgToken) {
                  // Check if it's a Default-Background reference
                  if (bgToken.includes('Default-Background')) {
                    for (let i = 1; i <= 5; i++) {
                      target[`Dropshadow-Color-${i}`] = {
                        value: `{Default-Background.Dropshadow-Color-${i}}`,
                        type: 'color'
                      };
                    }
                    continue;
                  }
                  // Extract palette and Color-N from the background ref
                  const bgAlias = resolveToColorAlias(bgToken, lookup);
                  const bgMatch = bgAlias.match(/\{Colors\.([\w-]+)\.(Color-[\w-]+)\}/);
                  if (bgMatch) {
                    for (let i = 1; i <= 5; i++) {
                      target[`Dropshadow-Color-${i}`] = {
                        value: `{Dropshadow-Color-${i}.${bgMatch[1]}.${bgMatch[2]}}`,
                        type: 'color'
                      };
                    }
                    continue;
                  }
                }
                // Fallback: the background didn't resolve to a known
                // Default-Background / {Colors.Palette.Color-N} reference. Compute
                // the tinted shadow DIRECTLY from the resolved surface hex using
                // the shared Comeau-style math (identical to the
                // Modes/Dropshadow-Color-N section and the CSS exporter) so the
                // shadow stays brand-tinted instead of the flat black this path
                // used to emit (`#00000047…`, which was also malformed 10-digit hex).
                const fallbackBgHex = bgToken ? resolveToHex(bgToken, lookup, colors) : null;
                const shadowSurfaceHex = fallbackBgHex && fallbackBgHex.startsWith('#')
                  ? fallbackBgHex
                  : '#ffffff';
                for (let i = 0; i < 5; i++) {
                  target[`Dropshadow-Color-${i + 1}`] = {
                    value: dropshadowHex8(shadowSurfaceHex, (i + 1) as ShadowLevel),
                    type: 'color',
                  };
                }
                continue;
              }

              // Container background keys → keep as Modes ref (Backgrounds/Containers)
              const containerBgKeys = ['Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest'];
              if (containerBgKeys.includes(key) && currentInternalKey === 'Containers') {
                if (val && typeof val === 'object' && 'value' in val) {
                  const tokenVal = (val as any).value;
                  // Check if it's already a Backgrounds ref
                  const bgRef = tokenVal.replace(/[{}]/g, '');
                  if (bgRef.startsWith('Backgrounds.') || bgRef.startsWith('Containers.')) {
                    target[key] = { value: tokenVal, type: 'color' };
                  } else {
                    // Resolve to hex as fallback
                    const hex = resolveToHex(tokenVal, lookup, colors);
                    target[key] = { value: hex || tokenVal, type: 'color' };
                  }
                }
                continue;
              }

              // All special handlers removed — everything goes through generic resolution below.
              // Quiet, Icon-Variant, Focus-Visible, Border-Variant, Highlight, Lowlight
              // are all now in Modes and get kept as token refs via MODES_GROUPS check.

              if (val && typeof val === 'object' && 'value' in val && 'type' in val) {
                const tokenVal = (val as any).value;

                // Try to resolve to a Modes-aliasable reference:
                // 1. {Colors.Palette.Color-N} → direct alias
                // 2. {Hover/Pressed.Palette.Color-N} → alias to Modes/Hover or Modes/Pressed
                // 3. {Text/Header/etc.Section.Palette.Color-N} → keep as token ref for plugin
                // 4. Fall back to hex if nothing resolves

                if (tokenVal.includes('{')) {
                  const modesRef = tokenVal.replace(/[{}]/g, '');
                  const topLevel = modesRef.split('.')[0];
                  const MODES_GROUPS = ['Text', 'Eyebrows', 'Header', 'Quiet', 'Border', 'Border-Variant',
                    'Hover', 'Pressed', 'Focus-Visible', 'Icon', 'Icon-Variant', 'Tag',
                    'Buttons', 'Default-Button', 'Default-Button-Border', 'Backgrounds',
                    'Button-Hover', 'Button-Pressed', 'Button-Highlight', 'Button-Lowlight',
                    'Dropshadow-Color-1', 'Dropshadow-Color-2', 'Dropshadow-Color-3',
                    'Dropshadow-Color-4', 'Dropshadow-Color-5',
                    'Default-Background'];

                  // If the token already references a Modes group, keep it as-is
                  // (don't resolve further — the plugin will alias to the Modes variable)
                  if (MODES_GROUPS.includes(topLevel)) {
                    target[key] = { value: tokenVal, type: 'color' };
                  } else {
                    // Try to resolve to a Colors ref
                    const alias = resolveToColorAlias(tokenVal, lookup);
                    if (alias.includes('{Colors.')) {
                      target[key] = { value: alias, type: 'color' };
                    } else {
                      // Resolve to hex as fallback
                      const hex = resolveToHex(tokenVal, lookup, colors);
                      target[key] = { value: hex || tokenVal, type: 'color' };
                    }
                  }
                } else if (tokenVal.startsWith('#')) {
                  target[key] = { value: tokenVal, type: 'color' };
                } else {
                  target[key] = { value: tokenVal, type: 'color' };
                }
              } else if (val && typeof val === 'object' && !('value' in val)) {
                target[key] = {};
                processGroup(val, target[key]);
                // If this is a button group with a Button key, compute Highlight/Lowlight and swap Hover/Pressed
                if ((val as any)['Button']) {
                  const btnToken = (val as any)['Button'];
                  if (btnToken?.value) {
                    // Extract palette and Color-N from the button's Color ref
                    const btnRef = resolveToColorAlias(btnToken.value, lookup);
                    const btnMatch = btnRef.match(/\{Colors\.([\w-]+)\.(Color-[\w-]+)\}/);
                    if (btnMatch) {
                      const palette = btnMatch[1];
                      const colorN = btnMatch[2];
                      // Hover/Pressed point at the mode-aware Buttons.<pal>.<shade>
                      // table, NOT at Button-Hover/Button-Pressed keyed by tone.
                      //
                      // colorN is the button's LIGHT-mode tone, and the Theme
                      // layer is mode-independent so it cannot flip. The dark
                      // fill comes from the shade table (Primary: light #70947b
                      // -> dark #d4e3d9), so a tone-keyed hover resolved to
                      // #799c84 in dark — a mid-sage hover on a near-white
                      // button, and a straight divergence from the CSS, which
                      // derives from the real fill (#cdded3).
                      //
                      // The shade table already carries correct per-mode Hover
                      // and Pressed, and its light values are identical to the
                      // tone-keyed ones, so light output is unchanged.
                      const shadeMatch = String(btnToken.value).match(
                        /\{((?:Buttons|Default-Button)\.[\w-]+\.[\w-]+)\.Button\}/
                      );
                      if (shadeMatch) {
                        target[key]['Hover'] = { value: `{${shadeMatch[1]}.Hover}`, type: 'color' };
                        target[key]['Pressed'] = { value: `{${shadeMatch[1]}.Pressed}`, type: 'color' };
                        // Bevel follows the same rule as Hover/Pressed. The
                        // shade table carries per-mode Highlight/Lowlight
                        // derived from the real fill; the tone-keyed
                        // Button-Highlight/Button-Lowlight groups are keyed by
                        // the button's LIGHT-mode tone, and the Theme layer is
                        // mode-independent so it cannot flip. Pointing at the
                        // tone table gave a bevel computed from the light fill
                        // sitting on the dark button — the same divergence the
                        // Hover/Pressed fix above corrects.
                        target[key]['Highlight'] = { value: `{${shadeMatch[1]}.Highlight}`, type: 'color' };
                        target[key]['Lowlight'] = { value: `{${shadeMatch[1]}.Lowlight}`, type: 'color' };
                      } else {
                        target[key]['Hover'] = { value: `{Button-Hover.${palette}.${colorN}}`, type: 'color' };
                        target[key]['Pressed'] = { value: `{Button-Pressed.${palette}.${colorN}}`, type: 'color' };
                        target[key]['Highlight'] = { value: `{Button-Highlight.${palette}.${colorN}}`, type: 'color' };
                        target[key]['Lowlight'] = { value: `{Button-Lowlight.${palette}.${colorN}}`, type: 'color' };
                      }
                      // Border palette should match the button's palette too —
                      // the upstream JSON hardcodes Border to Primary for the
                      // Default button (and similar) regardless of the user's
                      // chosen button style. Rewrite the palette portion of
                      // the existing Border ref while preserving the surface
                      // scope (Surfaces vs Containers) and the surface
                      // background's Color-N.
                      const existingBorder = target[key]['Border']?.value;
                      if (typeof existingBorder === 'string') {
                        // Match any surface scope: Surfaces, Surface-Dim,
                        // Surface-Dimmest, Surface-Bright, Containers,
                        // Container-Low(est), Container-High(est). Preserves
                        // the scope and surface Color-N; rewrites the palette.
                        const borderMatch = existingBorder.match(
                          /\{Border\.([\w-]+)\.[\w-]+\.(Color-[\w-]+)\}/
                        );
                        if (borderMatch) {
                          const surfaceColorN = borderMatch[2];
                          // Default-Button-Border, not Border.<scope>. Same
                          // index, but the Modes layer supplies the light value
                          // verbatim and the button's own fill in dark mode, so
                          // the border goes flush instead of drawing a ring
                          // keyed to a surface tone dark mode never uses.
                          //
                          // Border has per-variant scopes (Surface-Dim,
                          // Container-High, ...) while Default-Button-Border
                          // has only Surfaces and Containers, so the scope is
                          // collapsed to whichever family it belongs to.
                          const scope = /^Container/.test(borderMatch[1])
                            ? 'Containers' : 'Surfaces';
                          // The Default theme gets its OWN slot rather than
                          // sharing the button palette's.
                          //
                          // Default and White both sit on tone 12 in light
                          // mode, so they aliased the identical Modes variable
                          // — and a variable holds one value per mode. In dark
                          // their surfaces diverge (Default goes near-black,
                          // White stays light), so no single value serves both.
                          // Trying to resolve it inside the table failed for
                          // exactly this reason: keyed by palette and tone, it
                          // cannot tell the two themes apart.
                          //
                          // Default-Button-Border already carries a `Default`
                          // palette, unused until now. Pointing the Default
                          // theme at it gives each theme its own light/dark
                          // pair, which is where the difference actually lives.
                          // The Default-theme override applies to the DEFAULT
                          // BUTTON ONLY, not to every button role that happens
                          // to sit in the Default theme. Keying it on the theme
                          // alone sent the Info button's border to
                          // Default-Button-Border.Surfaces.Default.Color-N while
                          // its fill, text, hover, pressed and both bevels all
                          // came from Buttons/Info — one variable in the group
                          // pointing at a different palette than the other six.
                          const borderPalette =
                            (themeName === 'Default' && key === 'Default') ? 'Default' : palette;
                          target[key]['Border'] = {
                            value: `{Default-Button-Border.${scope}.${borderPalette}.${surfaceColorN}}`,
                            type: 'color',
                          };
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          processGroup(groupData, figmaGroup);
          figmaTheme[groupKey] = figmaGroup;
        }

        figma.Themes[themeName] = figmaTheme;
      }
    }
  }

  // ── SurfacesContainers section ──
  // Links to Themes.Default for surface variables, Modes for container backgrounds
  const surfaceToGroup: Record<string, string> = {
    'Surface': 'Surface',
    'Surface-Dim': 'Surface-Dim',
    'Surface-Dimmest': 'Surface-Dimmest',
    'Surface-Bright': 'Surface-Bright',
  };

  const containerToGroup = 'Containers';

  // Surface variants — link directly to Theme
  for (const [surfaceName, groupKey] of Object.entries(surfaceToGroup)) {
    const sc: any = {};
    const themeGroup = figma.Themes?.Default?.[groupKey];
    if (themeGroup) {
      function buildSurfaceRefs(obj: any, pathPrefix: string): any {
        const result: any = {};
        for (const [key, val] of Object.entries(obj)) {
          if (val && typeof val === 'object' && 'value' in val) {
            result[key] = { value: `{Theme.${pathPrefix}/${key}}`, type: 'color' };
          } else if (val && typeof val === 'object') {
            result[key] = buildSurfaceRefs(val, `${pathPrefix}/${key}`);
          }
        }
        return result;
      }
      Object.assign(sc, buildSurfaceRefs(themeGroup, groupKey));
    }
    figma.SurfacesContainers[surfaceName] = sc;
  }

  // Container variants — all from Theme.Containers
  const containerKeys2 = ['Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest'];
  for (const containerName of containerKeys2) {
    const sc: any = {};
    // Background from Theme.Containers (hex value, resolved per theme)
    sc.Background = { value: `{Theme.Containers/${containerName}}`, type: 'color' };

    // Rest from Theme.Containers
    const themeContainers = figma.Themes?.Default?.Containers;
    if (themeContainers) {
      function buildContainerRefs(obj: any, pathPrefix: string): any {
        const result: any = {};
        for (const [key, val] of Object.entries(obj)) {
          if (key === 'Background' || key.startsWith('Container')) continue;
          if (val && typeof val === 'object' && 'value' in val) {
            result[key] = { value: `{Theme.${pathPrefix}/${key}}`, type: 'color' };
          } else if (val && typeof val === 'object') {
            result[key] = buildContainerRefs(val, `${pathPrefix}/${key}`);
          }
        }
        return result;
      }
      Object.assign(sc, buildContainerRefs(themeContainers, 'Containers'));
    }

    figma.SurfacesContainers[containerName] = sc;
  }

  // ── Navigation settings ──
  // Maps user's nav selections to Theme/Tone/Surface modes for the Figma plugin
  // ── Default Background — add to both Light and Dark mode sections ──
  const defaultSettings = designSystemJSON.Metadata?.['Default-Settings'];
  if (defaultSettings) {
    const defTheme = defaultSettings['Default-Theme']?.Theme?.value || 'Neutral';
    const defN = defaultSettings['Default-Theme']?.N?.value || 12;
    const userBg = designSystemJSON._userSelections?.background || 'white';

    // Determine Dark Mode palette and N based on user's Light Mode selection:
    // Primary/Primary-Light → Primary Color-2
    // White/Black → Neutral Color-2
    const darkUsePrimary = (userBg === 'primary-light' || userBg === 'primary-base' || userBg === 'primary');
    const darkPalette = darkUsePrimary ? 'Primary' : 'Neutral';
    const darkN = 2;
    // Dark mode containers are always tonal: Primary Color-3 or Neutral Color-3
    const darkContainerN = 3;

    // Add Default-Background to Modes
    for (const modeName of ['Light-Mode', 'Dark-Mode']) {
      const modeData = designSystemJSON.Modes?.[modeName];
      if (!modeData) continue;

      const isDark = modeName === 'Dark-Mode';
      const bgPalette = isDark ? darkPalette : defTheme;
      const bgN = isDark ? darkN : defN;
      const contPalette = isDark ? darkPalette : defTheme;
      const contN = isDark ? darkContainerN : (defaultSettings['Card-Coloring']?.ContN?.value || 12);

      const modeColors = modeData.Colors;
      const modeLookup = buildTokenLookup(modeData);
      const bgKey = `Background-${bgN}`;
      const bgData = modeData.Backgrounds?.[bgPalette]?.[bgKey];

      const defBg: any = {
        'Surface': { value: modeColors?.[bgPalette]?.[`Color-${bgN}`]?.value || '#ffffff', type: 'color' },
      };

      // Surface variants from Backgrounds
      if (bgData?.Surfaces) {
        for (const [sk, sv] of Object.entries(bgData.Surfaces)) {
          let hex = (sv as any)?.value;
          if (hex?.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
          if (hex) defBg[sk] = { value: hex, type: 'color' };
        }
      }

      // Surface-Brightest's own background value.
      //
      // The loop above copies whatever the Backgrounds ROW carries — Surface,
      // Surface-Dim, Surface-Bright — and Brightest is not one of them: it is a
      // different Background-N entirely (11, or 12 once Bright has taken 11).
      // So the key was never written while the Theme collection referenced it,
      // leaving {Default-Background.Surface-Brightest} pointing at nothing. The
      // CSS had the same gap from the same cause; this is the Figma half.
      //
      // Same rule as generateCompleteThemes and the tokenLookup in exportToCSS.
      // If the three disagree, Default's brightest surface pairs foregrounds
      // solved for one tone with a background painted at another.
      {
        const brightN = Math.min(bgN + 1, 12);
        const brightestN = brightN >= 11 ? 12 : 11;
        const hex = modeColors?.[bgPalette]?.[`Color-${brightestN}`]?.value;
        if (hex) defBg['Surface-Brightest'] = { value: hex, type: 'color' };
      }

      // Container variants — use the appropriate container N
      const contBgKey = `Background-${contN}`;
      const contBgData = modeData.Backgrounds?.[contPalette]?.[contBgKey];
      if (contBgData?.Containers) {
        for (const [ck, cv] of Object.entries(contBgData.Containers)) {
          let hex = (cv as any)?.value;
          if (hex?.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
          if (hex) defBg[ck] = { value: hex, type: 'color' };
        }
      }

      // Helper: resolve a token path to hex for this mode
      const resolveHex = (path: string): string | null => {
        const val = modeLookup[path];
        if (!val) return null;
        if (val.startsWith('#')) return val;
        if (val.includes('{')) return resolveToHex(val, modeLookup, modeColors);
        return val;
      };

      // Surface properties — Text, Header, Quiet, Border, etc. for the default bg
      const surfaceColorN = `Color-${bgN}`;
      // Focus-Visible is deliberately absent here: unlike these sections it is NOT
      // palette-nested (Focus-Visible.Surfaces is keyed directly by Background-N),
      // so the [palette][Color-N] lookup below always missed and the key was never
      // written. It is handled separately after this loop.
      const textSections = ['Text', 'Header', 'Quiet', 'Border', 'Border-Variant'];
      for (const section of textSections) {
        // Border-Variant is COMPUTED in this file (border at 20% opacity) and
        // is absent from the source colorSystem, so the source alone yields
        // nothing for it and the role is skipped.
        const sectionData = modeData[section] ?? figma.Modes[modeName]?.[section];
        if (!sectionData?.Surfaces?.[bgPalette]?.[surfaceColorN]) continue;
        const token = sectionData.Surfaces[bgPalette][surfaceColorN];
        let hex = token?.value;
        if (hex?.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
        if (hex) defBg[section] = { value: hex, type: 'color' };
      }

      // Per-surface foregrounds for the Default theme.
      //
      // Every other theme references {Backgrounds.<pal>.Background-N...} plus
      // {Text.Surfaces.<pal>.Color-N} with a single consistent N, so its tokens
      // stay paired. Default cannot: its background depends on the user's
      // selection AND differs per mode (light Neutral-12, dark Neutral-2), and
      // the Theme layer is mode-independent. Hence the Default-Background
      // indirection — which therefore has to cover EVERY role, not just the base
      // ones. Any role left behind keeps a hardcoded light-mode tone and pairs a
      // tone-12 foreground with a Color-2 background in dark mode.
      //
      // ROLE_SOURCES maps each role to the family and palette it resolves from.
      // `pal` null means the theme's own background palette.
      const ACCENT_PALETTES = ['Primary', 'Secondary', 'Tertiary', 'Neutral',
        'Info', 'Success', 'Warning', 'Error'];
      const ROLE_SOURCES: Array<{ role: string; section: string; pal: string | null; byBackground?: boolean }> = [
        { role: 'Text', section: 'Text', pal: null },
        { role: 'Quiet', section: 'Quiet', pal: null },
        { role: 'Header', section: 'Header', pal: null },
        { role: 'Border', section: 'Border', pal: null },
        { role: 'Border-Variant', section: 'Border-Variant', pal: null },
        { role: 'Hotlink', section: 'Text', pal: 'Info' },
        { role: 'Hotlink-Visited', section: 'Text', pal: 'Hotlink-Visited' },
        { role: 'Focus-Visible', section: 'Focus-Visible', pal: null, byBackground: true },
        // Icons-Default tracks --Text in every other theme (verified across all
        // 20); Default must not be the exception. Its -Variant is the alpha
        // form, matching generateSingleTheme's non-BW branch.
        { role: 'Icons-Default', section: 'Text', pal: null },
        { role: 'Icons-Default-Variant', section: 'Icon-Variant', pal: null },
        ...ACCENT_PALETTES.map(pal => ({ role: `Text-${pal}`, section: 'Text', pal })),
        ...ACCENT_PALETTES.map(pal => ({ role: `Header-${pal}`, section: 'Header', pal })),
        // Text-BW resolves from the BlackWhite map rather than a palette family
        // — white below tone 6, black from 6 up — but it is otherwise an
        // ordinary role and must appear here like the rest.
        //
        // Left out, Default's Surface / Surface-Dim / Surface-Bright referenced
        // {Default-Background.*Text-BW} against a section that had no such key,
        // so those aliases resolved to nothing while Containers (which points
        // straight at the map, needing no indirection) linked correctly. That
        // asymmetry is the visible symptom of a role missing from this list.
        { role: 'Text-BW', section: 'Default-Button-Border', pal: 'BlackWhite' },
      ];

      /** Resolve one role at a given background tone, or null. */
      const resolveRoleAt = (role: typeof ROLE_SOURCES[number], tone: number): string | null => {
        // Falls back to modeSection, the payload being BUILT, because some
        // sections exist only there. Border-Variant is computed in this file —
        // the border colour at 20% opacity — and never appears in the source
        // colorSystem, so reading modeData alone returned null for it, the role
        // was skipped, and every {Default-Background.*Border-Variant} reference
        // the Theme collection emits pointed at a variable that was never
        // written. Five of them, in both modes.
        const sectionData = modeData[role.section] ?? figma.Modes[modeName]?.[role.section];
        if (!sectionData) return null;
        const token = role.byBackground
          ? sectionData.Surfaces?.[`Background-${tone}`]
          : sectionData.Surfaces?.[role.pal ?? bgPalette]?.[`Color-${tone}`];
        let hex = token?.value;
        if (!hex) return null;
        if (hex.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
        return hex?.startsWith('#') ? hex : null;
      };

      /** Icons.<name> and the states, which don't fit the ROLE_SOURCES shape. */
      /** Which (palette, tone) a hex belongs to, searching every palette. */
      const findTone = (hexValue: string): { palette: string; n: number } | null => {
        if (!hexValue?.startsWith('#')) return null;
        const target = hexValue.toLowerCase();
        for (const pal of Object.keys(modeColors || {})) {
          for (let n = 1; n <= 12; n++) {
            if (modeColors[pal]?.[`Color-${n}`]?.value?.toLowerCase() === target) {
              return { palette: pal, n };
            }
          }
        }
        return null;
      };

      const writeExtras = (prefix: string, tone: number) => {
        for (const [section, suffix] of [['Icon', ''], ['Icon-Variant', '-Variant']]) {
          const sec = modeData[section];
          if (!sec?.Surfaces) continue;
          for (const pal of ACCENT_PALETTES) {
            let hex = sec.Surfaces?.[pal]?.[`Color-${tone}`]?.value;
            if (!hex) continue;
            if (hex.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
            if (hex?.startsWith('#')) defBg[`${prefix}Icons-${pal}${suffix}`] = { value: hex, type: 'color' };

            // On-<pal>: the foreground for content sitting ON the icon colour.
            //
            // Only the non-variant icon gets one — the -Variant roles are
            // decorative alphas and carry no content. Icons-<pal> is picked to
            // contrast with the SURFACE, so it can land on any tone; resolve
            // which one and reuse Text.Surfaces.<pal>.Color-<tone>, the same
            // fixed mapping every other foreground uses, so 4.5:1 holds by
            // construction rather than by a separate calculation.
            if (suffix !== '' || !hex?.startsWith('#')) continue;
            const iconTone = findTone(hex);
            if (!iconTone) continue;
            let onHex = modeData.Text?.Surfaces?.[iconTone.palette]?.[`Color-${iconTone.n}`]?.value;
            if (!onHex) continue;
            if (onHex.includes('{')) onHex = resolveToHex(onHex, modeLookup, modeColors) || onHex;
            if (onHex?.startsWith('#')) defBg[`${prefix}On-${pal}`] = { value: onHex, type: 'color' };
          }
        }
        // On-Default. Icons-Default is written by the ROLE_SOURCES loop, which
        // runs before this, so its resolved hex is already on defBg. It follows
        // the theme's own palette rather than an accent one, which is why it
        // sits outside the loop above.
        const defIconHex = defBg[`${prefix}Icons-Default`]?.value;
        const defTone = findTone(defIconHex || '');
        if (defTone) {
          let onHex = modeData.Text?.Surfaces?.[defTone.palette]?.[`Color-${defTone.n}`]?.value;
          if (onHex?.includes('{')) onHex = resolveToHex(onHex, modeLookup, modeColors) || onHex;
          if (onHex?.startsWith('#')) defBg[`${prefix}On-Default`] = { value: onHex, type: 'color' };
        }

        for (const state of ['Hover', 'Pressed']) {
          let hex = modeData[state]?.[bgPalette]?.[`Color-${tone}`]?.value;
          if (!hex) continue;
          if (hex.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
          if (hex?.startsWith('#')) defBg[`${prefix}${state}`] = { value: hex, type: 'color' };
        }
      };

      /** Which palette tone a resolved surface hex corresponds to. */
      const toneForHex = (hexValue: string): number | null => {
        if (!hexValue?.startsWith('#')) return null;
        const palette = modeColors?.[bgPalette];
        if (!palette) return null;
        for (let n = 1; n <= 12; n++) {
          if (palette[`Color-${n}`]?.value?.toLowerCase() === hexValue.toLowerCase()) return n;
        }
        return null;
      };

      // Base Surface uses the unprefixed keys; variants get "<variant>-".
      //
      // Surface-Dimmest is absent by design. Backgrounds.<pal>.Background-N
      // .Surfaces defines only Surface, Surface-Dim and Surface-Bright, and the
      // Default theme does not route its Dimmest surface through
      // Default-Background — that surface is pinned to Color-4 in every theme
      // and mode, so it is already mode-correct. See the note beside
      // overrideSurface in generateCompleteThemes.ts.
      const surfaceTargets: Array<{ prefix: string; tone: number | null }> = [
        { prefix: '', tone: bgN },
      ];
      for (const variant of ['Surface-Dim', 'Surface-Bright']) {
        if (defBg[variant]?.value === undefined) continue;
        surfaceTargets.push({ prefix: `${variant}-`, tone: toneForHex(defBg[variant].value) });
      }
      // Surface-Brightest is not a variant of Background-N like Dim and Bright
      // are — it is a different Background-N (11, or 12 once Bright has taken
      // 11), so there is no defBg entry to read a tone from and it has to be
      // computed the same way generateCompleteThemes computes brightestN. If
      // the two ever disagree, Default's brightest surface pairs foregrounds
      // solved for one tone with a background painted at another.
      const defBrightTone = Math.min(bgN + 1, 12);
      surfaceTargets.push({
        prefix: 'Surface-Brightest-',
        tone: defBrightTone >= 11 ? 12 : 11,
      });
      for (const { prefix, tone } of surfaceTargets) {
        if (tone === null) continue;
        for (const role of ROLE_SOURCES) {
          const hex = resolveRoleAt(role, tone);
          if (hex) defBg[`${prefix}${role.role}`] = { value: hex, type: 'color' };
        }
        writeExtras(prefix, tone);
      }


      // Focus-Visible — keyed by Background-N with no palette level, so it needs
      // its own lookup shape. Themes reference {Default-Background.Focus-Visible}
      // and {Default-Background.Container-Focus-Visible}; without these two keys
      // every focus ring in every theme resolves to nothing (WCAG 2.4.7, 1.4.11).
      const readFocusVisible = (group: 'Surfaces' | 'Containers', n: number): string | null => {
        const token = modeData['Focus-Visible']?.[group]?.[`Background-${n}`];
        let hex = token?.value;
        if (!hex) return null;
        if (hex.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
        return hex || null;
      };
      const fvSurface = readFocusVisible('Surfaces', bgN);
      if (fvSurface) defBg['Focus-Visible'] = { value: fvSurface, type: 'color' };
      const fvContainer = readFocusVisible('Containers', contN);
      if (fvContainer) defBg['Container-Focus-Visible'] = { value: fvContainer, type: 'color' };

      // Hover and Pressed for the base Surface are written by writeExtras above,
      // which reads Modes.Hover / Modes.Pressed directly.
      //
      // A block here used to overwrite them by re-applying the post-process
      // swap (Pressed = old Hover, Hover = mix(bg, old Hover)). That swap has
      // already been applied to Modes.Hover / Modes.Pressed upstream in
      // exportColorSystem, so doing it again shifted both states one step:
      // Modes.Hover.Neutral.Color-12 is #fbfbfb, and re-swapping produced
      // Pressed #fbfbfb / Hover #fcfcfc where the CSS emits #f9f9f9 / #fbfbfb.
      // The variant scopes never had the bug because writeExtras is the only
      // thing that writes them — which is why only Default/Surface diverged.

      // Dropshadow for the default bg — uses the shared Comeau-style math
      // so this exact-hex fallback path matches the Modes/Dropshadow-Color-N
      // values designers see when the link resolves normally.
      const bgHex = modeColors?.[bgPalette]?.[surfaceColorN]?.value;
      if (bgHex) {
        for (const level of SHADOW_LEVELS) {
          defBg[`Dropshadow-Color-${level}`] = {
            value: dropshadowHex8(bgHex, level as ShadowLevel),
            type: 'color',
          };
        }
      }

      // Container properties — Text, Header, Quiet, Border for containers
      const contColorN = `Color-${contN}`;
      for (const section of textSections) {
        // Same fallback as the surface loop above — Container-Border-Variant
        // was the last {Default-Background.*} reference with nothing behind it.
        const sectionData = modeData[section] ?? figma.Modes[modeName]?.[section];
        if (!sectionData?.Containers?.[contPalette]?.[contColorN]) continue;
        const token = sectionData.Containers[contPalette][contColorN];
        let hex = token?.value;
        if (hex?.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
        if (hex) defBg[`Container-${section}`] = { value: hex, type: 'color' };
      }

      figma.Modes[modeName]['Default-Background'] = defBg;
    }
  }

  if (defaultSettings) {
    // Derive Figma theme name from stored Theme + N values
    function deriveThemeName(navSettings: any): string {
      const theme = navSettings?.Theme?.value;
      const n = navSettings?.N?.value;
      if (!theme) return 'Primary-Light';
      if (theme === 'Neutral' && n <= 2) return 'Black';
      if (theme === 'Neutral' && n >= 11) return 'White';
      // Primary with N=11 is Primary-Light, otherwise Primary
      if (n >= 11) return `${theme}-Light`;
      return theme;
    }

    figma.Navigation = {
      'Nav-Bar': { theme: deriveThemeName(defaultSettings['Nav-Bar']) },
      'App-Bar': { theme: deriveThemeName(defaultSettings['App-Bar']) },
      'Status': { theme: deriveThemeName(defaultSettings['Status']) },
    };
  }

  // ── Font Families from user selections ──
  const typo = designSystemJSON.Typography;
  if (typo) {
    // Keys are the Figma variable names under Platform-Font-Families, verbatim,
    // so the plugin can write each one without a translation table.
    const axes = (() => {
      try { return JSON.parse(typo['Set-Header-Axes']?.value || '{}') as Record<string, number>; }
      catch { return {} as Record<string, number>; }
    })();
    const emToPx = (v: string | undefined, basis = 16) => Math.round((parseFloat(v || '0') || 0) * basis);

    figma.Fonts = {
      // ── The four faces ──
      Body: typo['Set-Font-Family-Body']?.value || '',
      Header: typo['Set-Font-Family-Header']?.value || '',
      Display: typo['Set-Font-Family-Display']?.value || typo['Set-Font-Family-Decorative']?.value || '',
      Eyebrow: typo['Set-Font-Family-Eyebrow']?.value || '',
      // Kept so an older template that still has a Decorative variable resolves.
      Decorative: typo['Set-Font-Family-Decorative']?.value || '',

      // ── Body / Subtitle ──
      'Body-Font-Weight': parseInt(typo['Set-Body-Font-Weight']?.value || '400'),
      'Body-Semibold-Font-Weight': parseInt(typo['Set-Body-Semibold-Font-Weight']?.value || '600'),
      // Subtitle is Body at bold; one weight drives all three steps.
      'Subtitle-Font-Weight': 700,

      // ── Header ──
      'Header-Font-Weight': parseInt(typo['Set-Header-Font-Weight']?.value || '600'),
      // The floor H4-H6 read instead of the header face's own weight — a 250
      // that reads elegant at 48px reads washed out at 18px.
      //
      // RAISES or does nothing: at or above the floor the brand's weight passes
      // through untouched, and it is snapped to a weight the face actually
      // ships, because asking a static 400/700 face for 500 lands differently
      // by platform. Same rule as the CSS side, and the name matches the Figma
      // variable — if the two ever disagree, the CSS and the type styles stop
      // describing the same thing while both still parse.
      'Header-Clamped-Weight': (() => {
        const picked = parseInt(typo['Set-Header-Font-Weight']?.value || '600', 10);
        if (picked >= HEADER_CLAMPED_WEIGHT_FLOOR) return picked;
        const family = typo['Set-Font-Family-Header']?.value || '';
        return nearestAvailableWeight(family, HEADER_CLAMPED_WEIGHT_FLOOR)
          ?? HEADER_CLAMPED_WEIGHT_FLOOR;
      })(),
      'Header-Character-Spacing': emToPx(typo['Set-Header-Letter-Spacing']?.value),
      // The six Google Sans Flex axes. wght is the font weight above; the rest
      // are their own variables, plus the composed settings string.
      'Header-Font-Width': axes.wdth ?? 100,
      'Header-Optical-Size': axes.opsz ?? 18,
      'Header-Slant': axes.slnt ?? 0,
      'Header-Grade': axes.GRAD ?? 0,
      'Header-Roundness': axes.ROND ?? 0,
      'Header-Variation': Object.entries(axes)
        .filter(([tag]) => tag !== 'wght')
        .map(([tag, v]) => `"${tag}" ${v}`)
        .join(', '),

      // ── Eyebrow ──
      'Eyebrow-Font-Weight': parseInt(typo['Set-Eyebrow-Font-Weight']?.value || '600'),
      'Eyebrow-Character-Spacing': emToPx(typo['Set-Eyebrow-Letter-Spacing']?.value, 12),

      // ── Display effects. Recorded for a plugin to render; a text style
      //    can apply neither. ──
      'Display-Noise': parseInt(typo['Set-Display-Noise']?.value || '0'),
      'Display-Bounce': parseInt(typo['Set-Display-Bounce']?.value || '0'),

      // ── Case ──
      //
      // Text case cannot be bound to a Figma variable, so the plugin writes it
      // onto the text style itself. These flags are the only way it knows what
      // to write.
      //
      // Display-Caps and Decorative-Caps are the same value under two names:
      // the studio stores the picked DISPLAY font under the `decorative` role.
      // Emitting both means the plugin can read the honest name while older
      // payloads still resolve — and it stops Display styles inheriting the
      // HEADER's case, which is what they did when no Display flag existed.
      'Header-Caps': typo['Set-Header-Caps']?.value === 'uppercase',
      'Decorative-Caps': typo['Set-Decorative-Caps']?.value === 'uppercase',
      'Display-Caps': typo['Set-Decorative-Caps']?.value === 'uppercase',
    };

    // ── The full type scale ──
    // Fonts (above) only carries families, weights and case, so the plugin had
    // nothing to write the Typography/* variables from — the ramp lived only in
    // the Figma template and could drift from the CSS export without anything
    // noticing. This section is the same scale the CSS is generated from, in
    // Figma's units.
    figma.Typography = buildFigmaTypeScale(typo);
  }

  // ── Component Style (Button, Card) ──
  const csRaw = designSystemJSON._componentStyle;
  if (csRaw) {
    // Normalize: existing designs may still carry the legacy pixel-shaped
    // radii fields. migrateLegacyRadii() promotes them to percent. After
    // this, computeRadii() returns the canonical pixel tokens.
    const cs = migrateLegacyRadii({
      ...csRaw,
      buttonHeight: csRaw.buttonHeight ?? 32,
      smallButtonHeight: csRaw.smallButtonHeight ?? 24,
      largeButtonHeight: csRaw.largeButtonHeight ?? 56,
    });
    const r = computeRadii(cs);
    // Bevel is a % of button height — compute px values per size
    // Bevel pixel values per size, capped at 20% of the button's own height
    // so the inset highlight/lowlight never bleeds into the text band — same
    // safety cap applied in Button.js's --_bevel calc. Slider max is 20% so
    // this only kicks in defensively for restored designs or hand-edited input.
    const bevelPct = csRaw.bevel ?? 0;
    // Padding tokens derived from the computed medium button radius.
    // Single source of truth for border width — referenced by both the
    // emitted Button-Border-Width token and the height calculations
    // (inner height = outer - border × 2).
    //
    // 1px. It was 2px, which also made every Figma inner height and swatch 2px
    // shorter than it should be, since they subtract this twice.
    //
    // The token keeps being emitted even though the value is now a constant
    // nobody varies: it already ships to Figma, and a deleted Figma variable
    // cannot be recovered by re-importing — a recreated variable gets a new id,
    // so every layer bound to the old one stays unbound (invariant 8).
    /** Button padding. Small and standard share one value; large has its own.
 *  Mirrors BUTTON_PADDING / LG_BUTTON_PADDING in exportToCSS.ts. */
const FIGMA_BUTTON_PADDING = 8;
const FIGMA_LG_BUTTON_PADDING = 16;

const BUTTON_BORDER_WIDTH = 1;
    figma.Components = {
      Button: {
        'Button-Radius': r.buttonRadius,
        'Sm-Button-Radius': r.smButtonRadius,
        'Lg-Button-Radius': r.lgButtonRadius,
        'Button-Inner-Radius': r.buttonInnerRadius,
        'Sm-Button-Inner-Radius': r.smButtonInnerRadius,
        'Lg-Button-Inner-Radius': r.lgButtonInnerRadius,
        'Button-Focus-Radius': r.buttonFocusRadius,
        'Sm-Button-Focus-Radius': r.smButtonFocusRadius,
        'Lg-Button-Focus-Radius': r.lgButtonFocusRadius,
        'Button-Icon-Radius': r.iconButtonRadius,
        'Sm-Button-Icon-Radius': r.smIconButtonRadius,
        'Lg-Button-Icon-Radius': r.lgIconButtonRadius,
        'Button-Icon-Inner-Radius': r.iconButtonInnerRadius,
        'Sm-Button-Icon-Inner-Radius': r.smIconButtonInnerRadius,
        'Lg-Button-Icon-Inner-Radius': r.lgIconButtonInnerRadius,
        'Button-Icon-Focus-Radius': r.iconButtonFocusRadius,
        'Sm-Button-Icon-Focus-Radius': r.smIconButtonFocusRadius,
        'Lg-Button-Icon-Focus-Radius': r.lgIconButtonFocusRadius,
        // The OUTER height — the user's selected value, unmodified.
        //
        // These used to subtract Button-Border-Width twice, because the Figma
        // component's height token drove the inner fill rect and the border sat
        // outside it. That is no longer how the component is built, so the
        // subtraction now makes every button 2px SHORT of the chosen height.
        //
        // It also fixes a name collision: Platform/Button-Height has always been
        // the outer height (platformButtonHeight returns cs.buttonHeight
        // unmodified), so the two variables shared a name and meant different
        // things — 32 in one collection and 30 in the other. Binding a frame to
        // the wrong one produced a 2px error with nothing to explain it.
        'Button-Height': cs.buttonHeight,
        'Sm-Button-Height': cs.smallButtonHeight,
        'Lg-Button-Height': cs.largeButtonHeight,
        // Swatch tokens — square swatches inside each button size, 6px smaller
        // than the button height so they leave a 3px gap on every side (a touch
        // tighter than the icon tokens, matching the Select swatch spec).
        //
        // Measured from the same height as the tokens above, so the 3px gap is
        // preserved. Left subtracting the border, these would be sized against
        // an inner box that no longer exists.
        'Button-Swatch': cs.buttonHeight - 6,
        'Sm-Button-Swatch': cs.smallButtonHeight - 6,
        'Lg-Button-Swatch': cs.largeButtonHeight - 6,
        'Button-Min-Width': csRaw.minButtonWidth ?? 60,
        // Large's text floor — the standard floor plus 40px. Derived, not a
        // second number to keep in sync.
        'Lg-Button-Min-Width': (csRaw.minButtonWidth ?? 60) + 40,
        'Button-Border-Width': BUTTON_BORDER_WIDTH,
        // TWO paddings: small and standard share one, large has its own.
        // Sm- is still not emitted — it equals Button-Padding, so it would be a
        // duplicate with nothing selecting between the copies. Lg- IS emitted,
        // because 16 is a different number and something does select it.
        'Button-Padding': FIGMA_BUTTON_PADDING,
        'Lg-Button-Padding': FIGMA_LG_BUTTON_PADDING,
        // Bevel geometry, small and large. These heights don't vary by
        // platform, so they live here; MEDIUM's live in the Platform
        // collection because its height does.
        //
        // Built from bevelGeometry.ts, the same module the CSS export uses —
        // identical numbers, px there and bare numbers here.
        ...bevelJSON('Sm-', cs.smallButtonHeight, bevelPct),
        ...bevelJSON('Lg-', cs.largeButtonHeight, bevelPct),
      },
      Card: {
        'Card-Radius': r.cardRadius,
        'Card-Inner-Border-Radius': r.cardInnerRadius,
        'Card-Focus-Border-Radius': r.cardFocusRadius,
        'Card-Padding': r.cardPadding,
      },
      Modal: {
        'Modal-Padding': r.modalPadding,
        'Modal-Radius': r.modalRadius,
        'Modal-Inner-Radius': r.modalInnerRadius,
        'Modal-Focus-Radius': r.modalFocusRadius,
      },
      Input: {
        'Input-Radius': r.inputRadius,
        'Sm-Input-Radius': r.smInputRadius,
        'Lg-Input-Radius': r.lgInputRadius,
        'Input-Inner-Radius': r.inputInnerRadius,
        'Input-Focus-Radius': r.inputFocusRadius,
        // Inset focus-ring corner radius — Input-Radius minus 1px so the
        // inset 3px focus indicator's corners visually match the chrome's
        // outer corners. Used by ListItem, TextField, Select, etc.
        'Input-Inner-Focus-Visible': Math.max(0, r.inputRadius - 1),
        'Input-Swatch-Radius': r.inputSwatchRadius,
        'Sm-Input-Swatch-Radius': r.smInputSwatchRadius,
        'Lg-Input-Swatch-Radius': r.lgInputSwatchRadius,
        'Input-Padding': csRaw.inputPadding ?? (r.buttonRadius >= 8 ? 4 : 2),
      },
      // Components/Other — the floating frame of a dropdown or menu panel.
      // Not under Input: it follows Input-Radius but is bounded separately
      // (by Card-Radius and a 16px ceiling), so filing it with the input
      // radii would imply it tracks them all the way up. It does not.
      Other: {
        'Dropdown-Frame-Radius': r.dropdownFrameRadius,
      },
    };

    // ── Platform collection ──────────────────────────────────────────────
    // The default (medium) button is the one that resizes per platform, so
    // its height AND its bevel geometry both live here rather than in
    // Components/Button. Binding a component's height to
    // Platform/Button-Height in Figma makes it follow the platform mode, the
    // same way [data-platform] does in CSS.
    //
    // Target is the platform's minimum hit area. The SMALL button keeps its
    // visual size everywhere; a wrapper grows to Target using Platform-Spacer,
    // so the button looks identical while staying tappable.
    figma.Platform = Object.fromEntries(
      PLATFORMS.map((platform) => {
        const height = platformButtonHeight(platform, cs.buttonHeight);
        return [platform, {
          'Button-Height': height,
          'Target': PLATFORM_TARGET[platform],
          'Platform-Spacer': PLATFORM_SPACER[platform],
          ...bevelJSON('', height, bevelPct),
        }];
      })
    );
  }

  // Flatten Buttons and Default-Button, and rewrite what points at them.
  //
  // Buttons/<Palette>/{Light,Medium}/<Slot> becomes Buttons/<Palette>/<Slot>,
  // and Highlight, Lowlight and Border join the entry so a button is described
  // in one place.
  //
  // The shade level carried no information: measured across all 9 types in
  // both modes, Light and Medium held identical values in every slot. It used
  // to matter for BlackWhite, whose two shades were the two faces — that is
  // now Buttons/Black, Buttons/White and the resolved Buttons/BlackWhite table.
  //
  // A previous attempt flattened WITHOUT this rewrite and broke 6,084 of the
  // 13,701 references in the Theme, State and Surface collections, because
  // those alias into these exact names. The rewrite below is not optional, and
  // the before/after unresolved counts are logged so a regression is visible
  // rather than silent.
  const flattenGroups = ['Buttons', 'Default-Button'];

  const countUnresolved = (): number => {
    const names = new Set<string>();
    const collect = (n: any, path: string, d: number) => {
      if (!n || typeof n !== 'object' || d > 10) return;
      if (typeof n.value === 'string') { names.add(path); return; }
      for (const [k, v] of Object.entries(n)) if (k !== 'type') collect(v, path ? `${path}.${k}` : k, d + 1);
    };
    collect(figma.Modes?.['Light-Mode'], '', 0);
    let missing = 0;
    const walk = (n: any, d: number) => {
      if (!n || typeof n !== 'object' || d > 10) return;
      if (typeof n.value === 'string') {
        const v = n.value;
        if (v.startsWith('{')) {
          const ref = v.slice(1, -1);
          // Only judge refs into the groups this pass touches; the rest point
          // at other collections and are resolved elsewhere.
          if (flattenGroups.some(g => ref.startsWith(g + '.')) && !names.has(ref)) missing++;
        }
        return;
      }
      for (const [k, v] of Object.entries(n)) if (k !== 'type') walk(v, d + 1);
    };
    walk(figma.Themes, 0);
    walk(figma.SurfacesContainers, 0);
    return missing;
  };

  const unresolvedBefore = countUnresolved();

  for (const modeName of Object.keys(figma.Modes ?? {})) {
    const modeSection: any = figma.Modes[modeName];
    const bevelPct = designSystemJSON._componentStyle?.bevelOpacity ?? 50;
    const bevelAlphaHex = Math.round((bevelPct * 255) / 100).toString(16).padStart(2, '0');

    for (const groupName of flattenGroups) {
      const group: any = modeSection?.[groupName];
      if (!group) continue;
      for (const [entryName, node] of Object.entries<any>(group)) {
        // BlackWhite is the resolved Scope/Palette/Tone table, not a shade
        // pair — leave it alone.
        if (entryName === 'BlackWhite') continue;
        const shade = node?.Medium ?? node?.Light;
        if (!shade || typeof shade !== 'object' || !shade.Button) continue;

        const flat: any = {};
        for (const [slot, token] of Object.entries<any>(shade)) flat[slot] = token;

        const fill = typeof flat.Button?.value === 'string' ? flat.Button.value : '';
        if (fill.startsWith('#')) {
          const base = fill.slice(0, 7);
          // A solid button's edge is its own fill — the same rule the CSS uses
          // for --Buttons-<X>-Border. Surface-dependent borders stay in
          // Default-Button-Border, which is scoped by surface and tone.
          if (!flat.Border) flat.Border = { value: fill, type: 'color' };
          flat.Highlight = { value: `${deriveColorHex(base, 25, 0.7)}${bevelAlphaHex}`, type: 'color' };
          flat.Lowlight = { value: `${deriveColorHex(base, -30, 0.85)}${bevelAlphaHex}`, type: 'color' };
        }
        group[entryName] = flat;
      }
    }
  }

  // Rewrite every reference that still names a shade.
  const SHADE_REF = new RegExp(`^\\{(${flattenGroups.join('|')})\\.([\\w-]+)\\.(Light|Medium)\\.([\\w-]+)\\}$`);
  let refsRewritten = 0;
  const rewrite = (n: any, d: number) => {
    if (!n || typeof n !== 'object' || d > 10) return;
    if (typeof n.value === 'string') {
      const m = n.value.match(SHADE_REF);
      if (m) { n.value = `{${m[1]}.${m[2]}.${m[4]}}`; refsRewritten++; }
      return;
    }
    for (const [k, v] of Object.entries(n)) if (k !== 'type') rewrite(v, d + 1);
  };
  rewrite(figma.Themes, 0);
  rewrite(figma.SurfacesContainers, 0);
  rewrite(figma.Modes, 0);

  const unresolvedAfter = countUnresolved();
  console.log(`🔘 [Figma] Buttons/Default-Button flattened; ${refsRewritten} references rewritten (unresolved into these groups: ${unresolvedBefore} before, ${unresolvedAfter} after)`);
  if (unresolvedAfter > unresolvedBefore) {
    console.warn(`⚠️ [Figma] Flattening LEFT ${unresolvedAfter - unresolvedBefore} reference(s) dangling — the rewrite missed a form.`);
  }

  // Drop Buttons/Black and Buttons/White; BlackWhite supersedes them.
  //
  // They are the two source faces, and the export JSON still needs them —
  // Default-Button is built from them (72 references in black-white mode).
  // But those references resolve to hex before the payload is written, so in
  // Figma nothing points at them by name, and the resolved
  // Buttons/BlackWhite/<Scope>/<Palette>/<Color-N> table now answers the
  // question they were there to answer.
  //
  // Guarded, not assumed: if anything in the payload still names them, they
  // stay and the reason is logged. That check is the one missing step that
  // made an earlier prune orphan thousands of aliases.
  let bwSourcesPruned = 0;
  {
    const stillReferenced: string[] = [];
    const scan = (n: any, path: string, d: number) => {
      if (!n || typeof n !== 'object' || d > 11) return;
      if (typeof n.value === 'string') {
        if (/\{Buttons\.(Black|White)\b/.test(n.value)) stillReferenced.push(path);
        return;
      }
      for (const [k, v] of Object.entries(n)) if (k !== 'type') scan(v, `${path}.${k}`, d + 1);
    };
    scan(figma, 'figma', 0);

    if (stillReferenced.length > 0) {
      console.warn(`⚠️ [Figma] Keeping Buttons/Black + Buttons/White — ${stillReferenced.length} reference(s) still name them, e.g. ${stillReferenced[0]}`);
    } else {
      for (const modeName of Object.keys(figma.Modes ?? {})) {
        const group: any = figma.Modes[modeName]?.Buttons;
        if (!group) continue;
        for (const face of ['Black', 'White']) {
          if (group[face]) { delete group[face]; bwSourcesPruned++; }
        }
      }
      console.log(`🔘 [Figma] Buttons/Black + Buttons/White pruned (${bwSourcesPruned} groups); BlackWhite table retained`);
    }
  }

  // NOTE — do not "optimise" the Modes collection by flattening or pruning it.
  //
  // A previous pass removed the Buttons/Default-Button Light|Medium level,
  // deleted Buttons/Black + Buttons/White, and dropped the tone-keyed
  // Button-Hover / Button-Pressed / Button-Highlight / Button-Lowlight groups,
  // on the reasoning that the values were duplicated or unreachable. They are
  // neither: the Theme, State and Surface collections alias INTO these names,
  // and every removal orphaned the aliases pointing at it. It broke 6,084 of
  // the 13,701 references in those collections — 44% — while the variable
  // count "saved" was simply the wiring those collections run on.
  //
  // The duplication is real but load-bearing. If it is ever worth collapsing,
  // the references in Themes/SurfacesContainers have to be rewritten in the
  // same pass, and the count of unresolvable refs checked before and after.

  // ── BlackWhite button Lowlight — resolved here, not aliased ──────────────
  //
  // Themes asks for the black/white button's bevel at its own surface tone:
  //
  //   {Buttons.BlackWhite.Color-<n>.Lowlight}
  //
  // That target is a Modes variable, and Modes is at its ceiling — the payload
  // carries ~4,700 variables per mode, so BlackWhite's twelve cannot be added
  // to the file. An alias whose target does not exist in Figma does not fail
  // loudly; the binding is simply absent and the button renders with no bevel,
  // which is the "black button has no lowlight" report.
  //
  // So this level is answered without a BlackWhite variable at all:
  //
  //   black face (Color-6..12)  ->  #000000, a literal
  //   white face (Color-1..5)   ->  {Button-Lowlight.Neutral.Color-12}
  //
  // Black can be a literal because the Themes collection's modes are the nine
  // THEMES, not light/dark — a literal here cannot vary by mode. Pure black is
  // the one value that is safe in both: it sits at or below the fill in each
  // (#040404 light, #0b0b0b dark), so the shadow can never come out LIGHTER
  // than the button, which is the failure that reads as a glowing black button.
  //
  // White borrows Neutral's top tone, which is an existing variable, so that
  // face keeps a real light/dark value instead of being frozen too.
  //
  // The tone comes out of the reference itself, so this needs no knowledge of
  // which surface a theme sits on — the alias already states it.
  //
  // NOTE: this is the only reference into Button-Lowlight in the whole payload;
  // nothing else aliases the four flat Button-* sections. If those are ever
  // dropped to reclaim variables, this line has to move with them.
  // The black face carries the SAME bevel alpha as the white one, which arrives
  // through {Button-Lowlight.Neutral.Color-12} with the opacity already baked in.
  // Derived from bevelOpacity rather than written as a literal 80: a hardcoded
  // alpha matches at the default 50% and silently splits the moment that slider
  // moves, leaving black's shadow a different strength from white's.
  const bwBevelOpacity = designSystemJSON._componentStyle?.bevelOpacity ?? 50;
  const bwBevelAlphaHex = Math.round(bwBevelOpacity * 255 / 100).toString(16).padStart(2, '0');

  const BW_LOWLIGHT_REF = /^\{Buttons\.BlackWhite\.Color-(\d+)\.Lowlight\}$/;
  const BW_BLACK_FROM_TONE = 6;   // Color-1..5 paint white, 6..12 paint black
  let bwLowlightResolved = 0, bwLowlightBlack = 0;
  const resolveBlackWhiteLowlight = (n: any, d: number) => {
    if (!n || typeof n !== 'object' || d > 12) return;
    if (typeof n.value === 'string') {
      const m = n.value.match(BW_LOWLIGHT_REF);
      if (m) {
        const tone = Number(m[1]);
        if (tone >= BW_BLACK_FROM_TONE) { n.value = `#000000${bwBevelAlphaHex}`; bwLowlightBlack++; }
        else n.value = '{Button-Lowlight.Neutral.Color-12}';
        bwLowlightResolved++;
      }
      return;
    }
    for (const [k, v] of Object.entries(n)) if (k !== 'type') resolveBlackWhiteLowlight(v, d + 1);
  };
  resolveBlackWhiteLowlight(figma.Themes, 0);
  resolveBlackWhiteLowlight(figma.SurfacesContainers, 0);
  console.log(
    `\u26AB [Figma] BlackWhite Lowlight resolved without a Modes variable: ` +
    `${bwLowlightResolved} (${bwLowlightBlack} black -> #000000, ` +
    `${bwLowlightResolved - bwLowlightBlack} white -> Neutral Color-12)`,
  );

  // ── Outline-Text is NOT a per-theme token in Figma ──────────────────────
  //
  // The colour an outline button's label takes is the surface's own
  // Text-<Palette>. In CSS that resolves through the cascade, so the export
  // writes one value per theme x surface x palette and lets the surface it
  // lands on decide — which is why the CSS side still carries it.
  //
  // Figma expresses the same thing far more cheaply. The Buttons collection has
  // a mode PER PALETTE, so Outline-Text is ONE variable there whose Primary
  // mode aliases Surface/Text-Primary, Secondary mode aliases
  // Surface/Text-Secondary, and so on. The palette that a per-theme token
  // encodes in its NAME is already the mode you are in.
  //
  // Emitting the per-theme copies as well is not merely redundant, it actively
  // fights the file: the importer only ever upserts, so every regenerate would
  // recreate the variables that were deliberately removed, in a Modes
  // collection already at its ceiling.
  //
  // This is a deliberate CSS/Figma divergence — the two describe one rule in
  // the shape each medium can express — so it is stated here rather than left
  // to be discovered as a parity failure.
  let outlineTextStripped = 0;
  const stripOutlineText = (n: any, d: number) => {
    if (!n || typeof n !== 'object' || d > 12) return;
    if (typeof n.value === 'string') return;
    for (const k of Object.keys(n)) {
      const child = n[k];
      if (k === 'Outline-Text' && child && typeof child === 'object' && 'value' in child) {
        delete n[k];
        outlineTextStripped++;
        continue;
      }
      stripOutlineText(child, d + 1);
    }
  };
  stripOutlineText(figma.Themes, 0);
  stripOutlineText(figma.SurfacesContainers, 0);
  console.log(
    `\u25AD [Figma] Outline-Text removed from the Theme collection (${outlineTextStripped} tokens) — ` +
    `it lives in Buttons, one variable with a mode per palette.`,
  );

  // Page canvas background — precomputed hex so the Figma plugin sets it from
  // one field instead of walking the Modes tree. It's the Primary palette's
  // Color-12 in Light-Mode (the lightest Primary tone).
  const pageBgHex = figma.Modes?.['Light-Mode']?.Colors?.Primary?.['Color-12']?.value;
  if (typeof pageBgHex === 'string') {
    figma.pageBackground = pageBgHex;
  }

  return figma;
}
