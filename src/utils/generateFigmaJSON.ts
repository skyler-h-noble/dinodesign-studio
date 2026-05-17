/**
 * Generate figma.json — a clean, Figma-optimized token structure
 *
 * Structure:
 * - Modes: Colors (hex), Dropshadow-Color (RGB), Containers (hex backgrounds), Border-Variant (8-digit hex)
 * - Themes: 17 themes × 5 surface groups, all values → {Colors.Palette.Color-N}
 * - SurfacesContainers: links to Themes, containers get Background from Modes
 */

import { computeRadii, migrateLegacyRadii } from './componentRadii';

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
 * Derive shadow RGB from hex (same algorithm as computeDropshadow in exportColorSystem)
 */
function deriveShadowRGB(hex: string, lightOffset = -25, satMultiplier = 1.5): string {
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
    const newL = clamp(l * 100 + lightOffset, 8, 92) / 100;
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
  const rgb = deriveShadowRGB(hex, lightOffset, satMultiplier);
  const parts = rgb.split(',').map(s => parseInt(s.trim()));
  return '#' + parts.map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Get the "one step" Active Color-N for a given Color-N.
 * Dark (1-6): step darker. Light (7-12): step lighter.
 * Color-1 → 1 (black end), Color-12 → 12 (white end).
 */
// Dark tones (1-5, tone ≤ 37): active goes darker
// Light tones (6-12, tone ≥ 58): active goes lighter
const ACTIVE_MAP: Record<string, number> = {
  '1': 1, '2': 1, '3': 2, '4': 3, '5': 4,
  '6': 7, '7': 8, '8': 9, '9': 10, '10': 11, '11': 12, '12': 12,
};
function getActiveColorN(colorN: string): string {
  const n = colorN.replace('Color-', '');
  if (n === 'Vibrant') return 'Color-10';
  return `Color-${ACTIVE_MAP[n] || n}`;
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
      'Hover', 'Active', 'Focus-Visible',
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

    // Add computed Button-Hover, Button-Active, Button-Highlight, Button-Lowlight
    if (colors) {
      const btnSections = ['Button-Hover', 'Button-Active', 'Button-Highlight', 'Button-Lowlight'];
      for (const s of btnSections) modeSection[s] = {};
      const palettes = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'];
      for (const palette of palettes) {
        if (!colors[palette]) continue;
        for (const s of btnSections) modeSection[s][palette] = {};
        for (const [colorKey, colorVal] of Object.entries(colors[palette])) {
          if (!colorKey.startsWith('Color-')) continue;
          const btnHex = (colorVal as any).value;
          const activeColorN = getActiveColorN(colorKey);
          const activeHex = colors[palette]?.[activeColorN]?.value || btnHex;
          modeSection['Button-Active'][palette][colorKey] = { value: activeHex, type: 'color' };
          modeSection['Button-Hover'][palette][colorKey] = { value: mixHex(btnHex, activeHex), type: 'color' };
          const hlHex = deriveColorHex(btnHex, 25, 0.6);
          const llHex = deriveColorHex(btnHex, -25, 1.4);
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

      // Border-Variant: border color at 15% opacity (hex + '26')
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
              modeSection['Border-Variant'][section][palette][colorKey] = {
                value: `${borderHex.substring(0, 7)}26`, type: 'color'
              };
            }
          }
        }
      }

      // Dropshadow-Color: 5 levels with different opacities, derived from background
      const opacities = [0.28, 0.22, 0.17, 0.13, 0.10];
      for (let level = 1; level <= 5; level++) {
        const sectionName = `Dropshadow-Color-${level}`;
        modeSection[sectionName] = {};
        for (const palette of palettes) {
          modeSection[sectionName][palette] = {};
          for (const [colorKey, colorVal] of Object.entries(colors[palette])) {
            if (!colorKey.startsWith('Color-')) continue;
            const bgHex = (colorVal as any).value;
            if (bgHex && bgHex.startsWith('#')) {
              const baseHex = deriveColorHex(bgHex, -25, 1.5);
              const alphaHex = Math.round(opacities[level - 1] * 255).toString(16).padStart(2, '0');
              modeSection[sectionName][palette][colorKey] = {
                value: `${baseHex}${alphaHex}`, type: 'color'
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
                // Fallback: compute hex inline
                const opacities = [0.28, 0.22, 0.17, 0.13, 0.10];
                for (let i = 0; i < 5; i++) {
                  const alphaHex = Math.round(opacities[i] * 255).toString(16).padStart(2, '0');
                  target[`Dropshadow-Color-${i + 1}`] = { value: `#00000047${alphaHex}`, type: 'color' };
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
                // 2. {Hover/Active.Palette.Color-N} → alias to Modes/Hover or Modes/Active
                // 3. {Text/Header/etc.Section.Palette.Color-N} → keep as token ref for plugin
                // 4. Fall back to hex if nothing resolves

                if (tokenVal.includes('{')) {
                  const modesRef = tokenVal.replace(/[{}]/g, '');
                  const topLevel = modesRef.split('.')[0];
                  const MODES_GROUPS = ['Text', 'Header', 'Quiet', 'Border', 'Border-Variant',
                    'Hover', 'Active', 'Focus-Visible', 'Icon', 'Icon-Variant', 'Tag',
                    'Buttons', 'Default-Button', 'Default-Button-Border', 'Backgrounds',
                    'Button-Hover', 'Button-Active', 'Button-Highlight', 'Button-Lowlight',
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
                // If this is a button group with a Button key, compute Highlight/Lowlight and swap Hover/Active
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
                      target[key]['Active'] = { value: `{Button-Active.${palette}.${colorN}}`, type: 'color' };
                      target[key]['Highlight'] = { value: `{Button-Highlight.${palette}.${colorN}}`, type: 'color' };
                      target[key]['Lowlight'] = { value: `{Button-Lowlight.${palette}.${colorN}}`, type: 'color' };
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
      const textSections = ['Text', 'Header', 'Quiet', 'Border', 'Border-Variant', 'Focus-Visible'];
      for (const section of textSections) {
        const sectionData = modeData[section];
        if (!sectionData?.Surfaces?.[bgPalette]?.[surfaceColorN]) continue;
        const token = sectionData.Surfaces[bgPalette][surfaceColorN];
        let hex = token?.value;
        if (hex?.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
        if (hex) defBg[section] = { value: hex, type: 'color' };
      }

      // Hover and Active for the default bg
      const hoverData = modeData.Hover?.[bgPalette]?.[surfaceColorN];
      const activeData = modeData.Active?.[bgPalette]?.[surfaceColorN];
      if (hoverData?.value) {
        let hex = hoverData.value;
        if (hex.includes('{')) hex = resolveToHex(hex, modeLookup, modeColors) || hex;
        // Post-process: Active = old hover, Hover = mix(bg, old hover)
        const bgHex = modeColors?.[bgPalette]?.[surfaceColorN]?.value || '#000000';
        defBg['Active'] = { value: hex, type: 'color' };
        defBg['Hover'] = { value: mixHex(bgHex, hex), type: 'color' };
      }

      // Dropshadow for the default bg
      const bgHex = modeColors?.[bgPalette]?.[surfaceColorN]?.value;
      if (bgHex) {
        const baseHex = deriveColorHex(bgHex, -25, 1.5);
        const opacities = [0.28, 0.22, 0.17, 0.13, 0.10];
        for (let i = 0; i < 5; i++) {
          const alphaHex = Math.round(opacities[i] * 255).toString(16).padStart(2, '0');
          defBg[`Dropshadow-Color-${i + 1}`] = { value: `${baseHex}${alphaHex}`, type: 'color' };
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
    const bevelMed = Math.round(cs.buttonHeight * (csRaw.bevel ?? 0) / 100);
    const bevelSm = Math.round(cs.smallButtonHeight * (csRaw.bevel ?? 0) / 100);
    const bevelLg = Math.round(cs.largeButtonHeight * (csRaw.bevel ?? 0) / 100);
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
        'Input-Swatch-Radius': r.inputSwatchRadius,
        'Sm-Input-Swatch-Radius': r.smInputSwatchRadius,
        'Lg-Input-Swatch-Radius': r.lgInputSwatchRadius,
        'Input-Padding': csRaw.inputPadding ?? (r.buttonRadius >= 8 ? 4 : 2),
      },
    };
  }

  return figma;
}
