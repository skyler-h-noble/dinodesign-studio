/**
 * Generate figma.json — a clean, Figma-optimized token structure
 *
 * Structure:
 * - Modes: Colors (hex), Dropshadow-Color (RGB), Containers (hex backgrounds), Border-Variant (8-digit hex)
 * - Themes: 17 themes × 5 surface groups, all values → {Colors.Palette.Color-N}
 * - SurfacesContainers: links to Themes, containers get Background from Modes
 */

interface ColorToken {
  value: string;
  type: 'color';
}

const THEMES = [
  'Default', 'Primary', 'Primary-Light', 'Secondary', 'Secondary-Light',
  'Tertiary', 'Tertiary-Light', 'White', 'Light-Grey', 'Black',
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

export function generateFigmaJSON(designSystemJSON: any): any {
  const figma: any = { Modes: {}, Themes: {}, SurfacesContainers: {} };

  const modes = ['Light-Mode', 'Dark-Mode'];

  for (const modeName of modes) {
    const modeData = designSystemJSON.Modes?.[modeName];
    if (!modeData) continue;

    const colors = modeData.Colors;
    const themes = modeData.Themes;
    const lookup = buildTokenLookup(modeData);

    // ── Modes section ──
    const modeSection: any = {
      Colors: {},
      Containers: {},
    };

    // Colors: copy all palette colors as hex
    if (colors) {
      for (const palette of Object.keys(colors)) {
        modeSection.Colors[palette] = {};
        for (const [key, val] of Object.entries(colors[palette])) {
          if ((val as any)?.value && key.startsWith('Color-')) {
            modeSection.Colors[palette][key] = { value: (val as any).value, type: 'color' };
          }
        }
      }
    }

    // Image-Overlay: transparent in light mode, 50% black in dark mode
    modeSection.Colors['Image-Overlay'] = {
      'Color-1': {
        value: modeName === 'Dark-Mode' ? '#00000080' : '#00000000',
        type: 'color',
      },
    };

    // Transparent
    modeSection.Colors['Transparent'] = {
      'Color-1': { value: '#00000000', type: 'color' },
    };

    // Backgrounds per theme (Container backgrounds)
    if (themes) {
      const containerKeys = ['Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest'];
      for (const themeName of THEMES) {
        const theme = themes[themeName];
        if (!theme?.Containers) continue;

        modeSection.Containers[themeName] = {};
        for (const key of containerKeys) {
          const token = theme.Containers[key]?.value;
          const hex = token ? resolveToHex(token, lookup, colors) : null;
          if (hex) {
            modeSection.Containers[themeName][key] = { value: hex, type: 'color' };
          }
        }
      }
    }

    figma.Modes[modeName] = modeSection;

    // ── Themes section (only build once from Light-Mode) ──
    if (modeName === 'Light-Mode' && themes) {
      for (const themeName of THEMES) {
        // Light-Grey isn't in the source themes — skip if not found
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
          function processGroup(source: any, target: any) {
            for (const [key, val] of Object.entries(source)) {
              // Dropshadow-Color → generate 5 levels with different opacities
              if (key === 'Dropshadow-Color') {
                const bgToken = source['Background']?.value || source['Surface']?.value;
                const opacities = [0.28, 0.22, 0.17, 0.13, 0.10];
                if (bgToken) {
                  const bgHex = resolveToHex(bgToken, lookup, colors);
                  if (bgHex) {
                    const baseHex = deriveColorHex(bgHex, -25, 1.5);
                    for (let i = 0; i < 5; i++) {
                      const alphaHex = Math.round(opacities[i] * 255).toString(16).padStart(2, '0');
                      target[`Dropshadow-Color-${i + 1}`] = { value: `${baseHex}${alphaHex}`, type: 'color' };
                    }
                    continue;
                  }
                }
                // Fallback
                for (let i = 0; i < 5; i++) {
                  const alphaHex = Math.round(opacities[i] * 255).toString(16).padStart(2, '0');
                  target[`Dropshadow-Color-${i + 1}`] = { value: `#00000047${alphaHex}`, type: 'color' };
                }
                continue;
              }

              // Container background keys → reference Modes/Containers
              const containerBgKeys = ['Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest'];
              if (containerBgKeys.includes(key) && groupKey === 'Containers') {
                target[key] = {
                  value: `{Modes.Light-Mode.Containers.${sourceThemeName}.${key}}`,
                  type: 'color',
                };
                continue;
              }

              // Quiet — when BW text, resolve to hex (Neutral gray, not BW black/white)
              if (key === 'Quiet') {
                if (val && typeof val === 'object' && 'value' in val) {
                  const tokenVal = (val as any).value as string;
                  // If it references BW, resolve to the Neutral quiet color instead
                  if (tokenVal.includes('BW')) {
                    // Get the Color-N from the token and look up the Neutral quiet value
                    const nMatch = tokenVal.match(/Color-(\d+)/);
                    if (nMatch) {
                      const quietToken = `{Quiet.Surfaces.Neutral.Color-${nMatch[1]}}`;
                      const hex = resolveToHex(quietToken, lookup, colors);
                      if (hex) {
                        target[key] = { value: hex, type: 'color' };
                        continue;
                      }
                    }
                  }
                  // Non-BW or fallback — try normal resolution
                  const resolved = resolveToColorRef(tokenVal, lookup, colors);
                  // If it resolved to a Color ref, keep it; if not, resolve to hex
                  if (resolved.includes('{Colors.')) {
                    target[key] = { value: resolved, type: 'color' };
                  } else {
                    const hex = resolveToHex(tokenVal, lookup, colors);
                    target[key] = { value: hex || resolved, type: 'color' };
                  }
                }
                continue;
              }

              // Icon Variants — resolve to hex with 40% opacity
              if (key.endsWith('-Variant') && key !== 'Border-Variant') {
                if (val && typeof val === 'object' && 'value' in val) {
                  const hex = resolveToHex((val as any).value, lookup, colors);
                  if (hex) {
                    target[key] = { value: `${hex}66`, type: 'color' };
                    continue;
                  }
                }
                // Fallback — resolve normally
                if (val && typeof val === 'object' && 'value' in val) {
                  const resolved = resolveToColorRef((val as any).value, lookup, colors);
                  target[key] = { value: resolved, type: 'color' };
                }
                continue;
              }

              // Focus-Visible — resolve to hex (not a Color reference)
              if (key === 'Focus-Visible') {
                if (val && typeof val === 'object' && 'value' in val) {
                  const fvHex = resolveToHex((val as any).value, lookup, colors);
                  target[key] = { value: fvHex || '#3b82f6', type: 'color' };
                }
                continue;
              }

              // Border-Variant — border color at 40% opacity
              if (key === 'Border-Variant') {
                const borderToken = source['Border']?.value;
                if (borderToken) {
                  const borderHex = resolveToHex(borderToken, lookup, colors);
                  if (borderHex) {
                    target[key] = { value: `${borderHex}40`, type: 'color' };
                    continue;
                  }
                }
                if (val && typeof val === 'object' && 'value' in val) {
                  target[key] = { value: (val as any).value, type: 'color' };
                }
                continue;
              }

              // Highlight/Lowlight — compute from the sibling Button color
              if (key === 'Highlight' || key === 'Lowlight') {
                const btnToken = source['Button'];
                if (btnToken?.value) {
                  // Try direct hex resolution
                  let btnHex = resolveToHex(btnToken.value, lookup, colors);
                  // If that fails, try resolving the Color ref and looking up its hex
                  if (!btnHex) {
                    const colorRef = resolveToColorRef(btnToken.value, lookup, colors);
                    const colorMatch = colorRef.match(/\{Colors\.([\w-]+)\.([\w-]+)\}/);
                    if (colorMatch) {
                      btnHex = colors?.[colorMatch[1]]?.[colorMatch[2]]?.value;
                    }
                  }
                  if (btnHex) {
                    if (key === 'Highlight') {
                      target[key] = { value: deriveColorHex(btnHex, 15, 0.8), type: 'color' };
                    } else {
                      target[key] = { value: deriveColorHex(btnHex, -15, 1.2), type: 'color' };
                    }
                    continue;
                  }
                }
                // Fallback
                if (val && typeof val === 'object' && 'value' in val) {
                  target[key] = { value: (val as any).value, type: 'color' };
                }
                continue;
              }

              if (val && typeof val === 'object' && 'value' in val && 'type' in val) {
                const resolved = resolveToColorRef((val as any).value, lookup, colors);
                // If still unresolved (contains {), fall back to hex
                if (resolved.includes('{') && !resolved.includes('{Colors.')) {
                  const hex = resolveToHex((val as any).value, lookup, colors);
                  target[key] = { value: hex || resolved, type: 'color' };
                } else {
                  target[key] = { value: resolved, type: 'color' };
                }
              } else if (val && typeof val === 'object' && !('value' in val)) {
                target[key] = {};
                processGroup(val, target[key]);
                // If this is a button group with a Button key but no Highlight/Lowlight, compute them
                if ((val as any)['Button'] && !target[key]['Highlight']) {
                  const btnToken = (val as any)['Button'];
                  if (btnToken?.value) {
                    let btnHex = resolveToHex(btnToken.value, lookup, colors);
                    if (!btnHex) {
                      const colorRef = resolveToColorRef(btnToken.value, lookup, colors);
                      const colorMatch = colorRef.match(/\{Colors\.([\w-]+)\.([\w-]+)\}/);
                      if (colorMatch) btnHex = colors?.[colorMatch[1]]?.[colorMatch[2]]?.value;
                    }
                    if (btnHex) {
                      target[key]['Highlight'] = { value: deriveColorHex(btnHex, 15, 0.8), type: 'color' };
                      target[key]['Lowlight'] = { value: deriveColorHex(btnHex, -15, 1.2), type: 'color' };
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

  // Container variants — link to Tone.Standard.Containers (which links to Theme)
  // Background comes from Modes.Containers, rest from Tone
  const containerKeys2 = ['Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest'];
  for (const containerName of containerKeys2) {
    const sc: any = {};
    // Background from Modes
    sc.Background = { value: `{Modes.Light-Mode.Containers.Default.${containerName}}`, type: 'color' };

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
  const defaultSettings = designSystemJSON.Metadata?.['Default-Settings'];
  if (defaultSettings) {
    function mapNavToModes(selection: string, n: number): { theme: string; tone: string; surface: string } {
      // Parse selection like "primary-light-bright", "primary-dim", "black", "white"
      let theme = 'Default';
      let tone = 'Standard';
      let surface = 'Surface';

      if (selection === 'black') {
        theme = 'Black'; tone = 'Standard'; surface = 'Surface';
      } else if (selection === 'white') {
        theme = 'White'; tone = 'Standard'; surface = 'Surface';
      } else if (selection.includes('-light')) {
        // primary-light, primary-light-bright, primary-light-dim
        const palette = selection.split('-')[0];
        theme = palette.charAt(0).toUpperCase() + palette.slice(1);
        tone = 'Light';
        if (selection.endsWith('-bright')) surface = 'Surface-Bright';
        else if (selection.endsWith('-dim')) surface = 'Surface-Dim';
        else surface = 'Surface';
      } else if (selection.includes('-bright')) {
        const palette = selection.split('-')[0];
        theme = palette.charAt(0).toUpperCase() + palette.slice(1);
        tone = 'Standard';
        surface = 'Surface-Bright';
      } else if (selection.includes('-dim')) {
        const palette = selection.split('-')[0];
        theme = palette.charAt(0).toUpperCase() + palette.slice(1);
        tone = 'Standard';
        surface = 'Surface-Dim';
      } else {
        // "primary", "secondary", etc.
        theme = selection.charAt(0).toUpperCase() + selection.slice(1);
        tone = 'Standard';
        surface = 'Surface';
      }

      return { theme, tone, surface };
    }

    const navBarSelection = defaultSettings['Nav-Bar']?.Selection?.value || 'primary-light-dim';
    const appBarSelection = defaultSettings['App-Bar']?.Selection?.value || 'primary-light-bright';
    const statusSelection = defaultSettings['Status']?.Selection?.value || 'primary-light-bright';

    figma.Navigation = {
      'Nav-Bar': mapNavToModes(navBarSelection, defaultSettings['Nav-Bar']?.N?.value || 10),
      'App-Bar': mapNavToModes(appBarSelection, defaultSettings['App-Bar']?.N?.value || 12),
      'Status': mapNavToModes(statusSelection, defaultSettings['Status']?.N?.value || 12),
    };
  }

  return figma;
}
