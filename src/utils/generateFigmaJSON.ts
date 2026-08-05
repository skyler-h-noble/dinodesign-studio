/**
 * Generate figma.json — a clean, Figma-optimized token structure
 *
 * Structure:
 * - Modes: Colors (hex), Dropshadow-Color (RGB), Containers (hex backgrounds), Border-Variant (8-digit hex)
 * - Themes: 17 themes × 5 surface groups, all values → {Colors.Palette.Color-N}
 * - SurfacesContainers: links to Themes, containers get Background from Modes
 */

import { computeRadii, migrateLegacyRadii } from './componentRadii';
import { dropshadowHex8, SHADOW_LEVELS, type ShadowLevel } from './dropshadow';
import { variantHex8, BORDER_VARIANT_ALPHA, ICON_VARIANT_ALPHA } from './variantAlpha';

interface ColorToken {
  value: string;
  type: 'color';
}

const THEMES = [
  'Default', 'Primary', 'Primary-Light', 'Secondary', 'Secondary-Light',
  'Tertiary', 'Tertiary-Light', 'White', 'Light-Gray', 'Black',
  'Info', 'Info-Light', 'Success', 'Success-Light',
  'Warning', 'Warning-Light', 'Error', 'Error-Light',
];

const SURFACE_GROUPS_INTERNAL = ['Surfaces', 'Surfaces-Dim', 'Surfaces-Dimmest', 'Surfaces-Bright', 'Containers'];
const SURFACE_GROUP_NAMES: Record<string, string> = {
  'Surfaces': 'Surface',
  'Surfaces-Dim': 'Surface-Dim',
  'Surfaces-Dimmest': 'Surface-Dimmest',
  'Surfaces-Bright': 'Surface-Bright',
  'Containers': 'Containers',
};

const SURFACE_NAMES = [
  'Surface', 'Surface-Dim', 'Surface-Dimmest', 'Surface-Bright',
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
    const newL = clamp(l * 100 + lightOffset, minL, 92) / 100;
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
          if ((val as any)?.value === tokenValue && key.startsWith('Color-')) {
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
              if ((val as any)?.value === resolved && key.startsWith('Color-')) {
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

    // Already a Colors reference
    const colorMatch = path.match(/^(?:Colors\.)?([\w-]+)\.(Color-[\w-]+)$/);
    if (colorMatch) return `{Colors.${colorMatch[1]}.${colorMatch[2]}}`;

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
function _figmaIsLight(hex: string): boolean {
  const c = hex.replace('#', '');
  const f = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const nn = parseInt(f, 16);
  const r = (nn >> 16) & 255, g = (nn >> 8) & 255, b = nn & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}
function pressedHexFor(colorKey: string, btnHex: string, palette: string, colors: any): string {
  if (colorKey === 'Color-Vibrant') return colors[palette]?.['Color-10']?.value || btnHex;
  const n = parseInt(colorKey.replace('Color-', ''), 10);
  if (!Number.isFinite(n)) return btnHex;
  const darkBtn = !_figmaIsLight(btnHex);          // dark button → step darker, light → lighter
  const an = darkBtn ? n - 1 : n + 1;
  if (an < 1) return '#000000';                    // darkest button (tone 1) → black
  if (an > 12) return '#FFFFFF';                   // lightest button (tone 12) → white
  return colors[palette]?.[`Color-${an}`]?.value || btnHex;
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

export function generateFigmaJSON(designSystemJSON: any): any {
  const figma: any = { Modes: {}, Themes: {}, SurfacesContainers: {} };

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
      'Colors', 'Text', 'Header', 'Quiet', 'Border', 'Border-Variant',
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

    // Add computed Button-Hover, Button-Pressed, Button-Highlight, Button-Lowlight
    if (colors) {
      const btnSections = ['Button-Hover', 'Button-Pressed', 'Button-Highlight', 'Button-Lowlight'];
      for (const s of btnSections) modeSection[s] = {};
      const palettes = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'];
      for (const palette of palettes) {
        if (!colors[palette]) continue;
        for (const s of btnSections) modeSection[s][palette] = {};
        for (const [colorKey, colorVal] of Object.entries(colors[palette])) {
          if (!colorKey.startsWith('Color-')) continue;
          const btnHex = (colorVal as any).value;
          const activeHex = pressedHexFor(colorKey, btnHex, palette, colors);
          modeSection['Button-Pressed'][palette][colorKey] = { value: activeHex, type: 'color' };
          modeSection['Button-Hover'][palette][colorKey] = { value: mixHex(btnHex, activeHex), type: 'color' };
          // Match the CSS/lib bevel math (exportColorSystem computeHighlight/
          // computeLowlight): highlight L+25 sat×0.7, lowlight L-30 sat×0.85.
          // Lowlight REDUCES saturation so it reads as a neutral recessed
          // shadow, not a vibrant sibling of the body (the old ×1.4 boost read
          // as a bottom-edge glow on Info/Success/Warning/Error).
          const hlHex = deriveColorHex(btnHex, 25, 0.7);
          const llHex = deriveColorHex(btnHex, -30, 0.85);
          // Apply bevel opacity as alpha channel
          const bevelOpacity = designSystemJSON._componentStyle?.bevelOpacity ?? 50;
          const alphaHex = Math.round(bevelOpacity * 255 / 100).toString(16).padStart(2, '0');
          modeSection['Button-Highlight'][palette][colorKey] = { value: `${hlHex}${alphaHex}`, type: 'color' };
          modeSection['Button-Lowlight'][palette][colorKey] = { value: `${llHex}${alphaHex}`, type: 'color' };
        }
      }
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
            if (!colorKey.startsWith('Color-')) continue;
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
            if (!colorKey.startsWith('Color-')) continue;
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
            if (!colorKey.startsWith('Color-')) continue;
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
      for (const themeName of THEMES) {
        // Light-Gray isn't in the source themes — skip if not found
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
                  const MODES_GROUPS = ['Text', 'Header', 'Quiet', 'Border', 'Border-Variant',
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
                      // Link to Modes entries for button interactions
                      target[key]['Hover'] = { value: `{Button-Hover.${palette}.${colorN}}`, type: 'color' };
                      target[key]['Pressed'] = { value: `{Button-Pressed.${palette}.${colorN}}`, type: 'color' };
                      target[key]['Highlight'] = { value: `{Button-Highlight.${palette}.${colorN}}`, type: 'color' };
                      target[key]['Lowlight'] = { value: `{Button-Lowlight.${palette}.${colorN}}`, type: 'color' };
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
                          const scope = borderMatch[1];
                          const surfaceColorN = borderMatch[2];
                          target[key]['Border'] = {
                            value: `{Border.${scope}.${palette}.${surfaceColorN}}`,
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
        const sectionData = modeData[section];
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
      ];

      /** Resolve one role at a given background tone, or null. */
      const resolveRoleAt = (role: typeof ROLE_SOURCES[number], tone: number): string | null => {
        const sectionData = modeData[role.section];
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
      const writeExtras = (prefix: string, tone: number) => {
        for (const [section, suffix] of [['Icon', ''], ['Icon-Variant', '-Variant']]) {
          const sec = modeData[section];
          if (!sec?.Surfaces) continue;
          for (const pal of ACCENT_PALETTES) {
            let hex = sec.Surfaces?.[pal]?.[`Color-${tone}`]?.value;
            if (!hex) continue;
            if (hex.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
            if (hex?.startsWith('#')) defBg[`${prefix}Icons-${pal}${suffix}`] = { value: hex, type: 'color' };
          }
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
        const sectionData = modeData[section];
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
    figma.Fonts = {
      Body: typo['Set-Font-Family-Body']?.value || '',
      Header: typo['Set-Font-Family-Header']?.value || '',
      Decorative: typo['Set-Font-Family-Decorative']?.value || '',
      'Body-Font-Weight': parseInt(typo['Set-Body-Font-Weight']?.value || '400'),
      'Body-Semibold-Font-Weight': parseInt(typo['Set-Body-Semibold-Font-Weight']?.value || '600'),
      'Body-Bold-Font-Weight': parseInt(typo['Set-Body-Bold-Font-Weight']?.value || '700'),
      'Header-Font-Weight': parseInt(typo['Set-Header-Font-Weight']?.value || '600'),
      'Header-Character-Spacing': 0,
      'Decorative-Font-Weight': parseInt(typo['Set-Decorative-Font-Weight']?.value || '400'),
      'Decorative-Character-Spacing': 0,
      'Header-Caps': typo['Set-Header-Caps']?.value === 'uppercase',
      'Decorative-Caps': typo['Set-Decorative-Caps']?.value === 'uppercase',
    };
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
    const bevelMed = Math.round(Math.min(cs.buttonHeight * bevelPct / 100, cs.buttonHeight / 5));
    const bevelSm = Math.round(Math.min(cs.smallButtonHeight * bevelPct / 100, cs.smallButtonHeight / 5));
    const bevelLg = Math.round(Math.min(cs.largeButtonHeight * bevelPct / 100, cs.largeButtonHeight / 5));
    // Padding tokens derived from the computed medium button radius.
    const buttonPadding = r.buttonRadius > 8 ? Math.round(r.buttonRadius / 2) : 4;
    const smButtonPadding = r.buttonRadius >= 8 ? 8 : r.buttonRadius;
    const largeButtonPadding = r.buttonRadius > 32 ? Math.round((r.buttonRadius * 2) / 3) : 16;
    // Single source of truth for border width — referenced by both the
    // emitted Button-Border-Width token and the height calculations
    // (inner height = outer - border × 2).
    const BUTTON_BORDER_WIDTH = 2;
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
        // Figma height tokens are the INNER button height (the colored
        // fill rect inside the border box). DinoDesign's button has a
        // border on top AND bottom, so we subtract Button-Border-Width
        // twice from the user's selected outer height. Was previously
        // `-2` (single border width), which made every button 2px taller
        // than intended once the border doubled up in Figma.
        'Button-Height': cs.buttonHeight - (BUTTON_BORDER_WIDTH * 2),
        'Sm-Button-Height': cs.smallButtonHeight - (BUTTON_BORDER_WIDTH * 2),
        'Lg-Button-Height': cs.largeButtonHeight - (BUTTON_BORDER_WIDTH * 2),
        // Swatch tokens — square swatches inside each button size, 6px
        // smaller than the inner button height so they leave a 3px gap
        // on every side of the swatch (a touch tighter than the icon
        // tokens, matching the Select swatch spec).
        'Button-Swatch': cs.buttonHeight - (BUTTON_BORDER_WIDTH * 2) - 6,
        'Sm-Button-Swatch': cs.smallButtonHeight - (BUTTON_BORDER_WIDTH * 2) - 6,
        'Lg-Button-Swatch': cs.largeButtonHeight - (BUTTON_BORDER_WIDTH * 2) - 6,
        'Button-Min-Width': csRaw.minButtonWidth ?? 60,
        'Button-Border-Width': BUTTON_BORDER_WIDTH,
        'Button-Padding': buttonPadding,
        'Sm-Button-Padding': smButtonPadding,
        'Lg-Button-Padding': largeButtonPadding,
        // Medium (default) — top-left highlight, bottom-right lowlight
        'Button-Highlight-Offset-x': -bevelMed,
        'Button-Highlight-Offset-y': -bevelMed,
        'Button-Highlight-Blur-Radius': bevelMed,
        'Button-Highlight-Spread-Radius': 0,
        'Button-Lowlight-Offset-x': bevelMed,
        'Button-Lowlight-Offset-y': bevelMed,
        'Button-Lowlight-Blur-Radius': bevelMed,
        'Button-Lowlight-Spread-Radius': 0,
        // Small
        'Sm-Button-Highlight-Offset-x': -bevelSm,
        'Sm-Button-Highlight-Offset-y': -bevelSm,
        'Sm-Button-Highlight-Blur-Radius': bevelSm,
        'Sm-Button-Lowlight-Offset-x': bevelSm,
        'Sm-Button-Lowlight-Offset-y': bevelSm,
        'Sm-Button-Lowlight-Blur-Radius': bevelSm,
        // Large
        'Lg-Button-Highlight-Offset-x': -bevelLg,
        'Lg-Button-Highlight-Offset-y': -bevelLg,
        'Lg-Button-Highlight-Blur-Radius': bevelLg,
        'Lg-Button-Lowlight-Offset-x': bevelLg,
        'Lg-Button-Lowlight-Offset-y': bevelLg,
        'Lg-Button-Lowlight-Blur-Radius': bevelLg,
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
    };
  }

  // Page canvas background — precomputed hex so the Figma plugin sets it from
  // one field instead of walking the Modes tree. It's the Primary palette's
  // Color-12 in Light-Mode (the lightest Primary tone).
  const pageBgHex = figma.Modes?.['Light-Mode']?.Colors?.Primary?.['Color-12']?.value;
  if (typeof pageBgHex === 'string') {
    figma.pageBackground = pageBgHex;
  }

  return figma;
}
