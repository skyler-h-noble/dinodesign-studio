/**
 * Utility to convert JSON design system to CSS variable files
 * Generates separate CSS files for each mode (Light-Mode-Tonal, Light-Mode-Professional, Dark-Mode)
 * 
 * Handles three JSON structures:
 * 1. Single mode: { Colors: {...}, Text: {...}, Icons: {...}, ... }
 * 2. Multiple modes: { "Light-Mode-Tonal": {...}, "Light-Mode-Professional": {...}, "Dark-Mode": {...} }
 * 3. Nested modes: { Backgrounds: {...}, Modes: { "Light-Mode-Tonal": {...}, ... }, Theme: {...} }
 */

import chroma from 'chroma-js';
import { variantHex8, BORDER_VARIANT_ALPHA } from '../variantAlpha';
import type { DesignSystem } from '../../types/designSystem';
import { fontFamiliesByStyle } from '../../data/fontFamilies';
import { generateSurfaceDataAttributesFromJSON } from './surfaceDataAttributesGenerator';
import { computeRadii, migrateLegacyRadii } from '../componentRadii';
import { solveThemeScrims, generateTextOverImageCSS } from './generateTextOverImage';
import { dropshadowHex8, dropshadowBaseHex, SHADOW_LEVELS, effectLevelRecipe } from '../dropshadow';
import { HEADER_FAMILY, headerFontQueryParam } from '../moodAxes';
import { 
  generateHeaderVariables,
  generateQuietVariables,
  generateBorderVariables,
  generateBorderVariantVariables,
  generateChartsVariables
} from './cssGeneratorHelpers';
import { generateAllThemesCSS } from './generateThemeCSS';

/**
 * Determine the correct CSS font fallback category for a given font name
 * Returns: 'sans-serif', 'serif', 'cursive', or 'fantasy'
 */
function getFontFallback(fontName: string): string {
  // Check each category in fontFamiliesByStyle
  for (const [category, fonts] of Object.entries(fontFamiliesByStyle)) {
    if (fonts.includes(fontName)) {
      // Determine fallback based on category name
      if (category.toLowerCase().includes('serif') && !category.toLowerCase().includes('sans')) {
        return 'serif';
      } else if (category.toLowerCase().includes('sans')) {
        return 'sans-serif';
      } else if (category.toLowerCase().includes('calligraphy') || category.toLowerCase().includes('script')) {
        return 'cursive';
      } else if (category.toLowerCase().includes('appearance') || category.toLowerCase().includes('techno') || category.toLowerCase().includes('glyphic')) {
        return 'fantasy';
      }
    }
  }
  
  // Default fallback based on common font knowledge
  const lowerFont = fontName.toLowerCase();
  if (lowerFont.includes('sans') || ['inter', 'roboto', 'arial', 'helvetica', 'montserrat', 'poppins', 'lato', 'open sans'].includes(lowerFont)) {
    return 'sans-serif';
  } else if (['georgia', 'times', 'garamond', 'merriweather', 'playfair'].includes(lowerFont)) {
    return 'serif';
  } else if (lowerFont.includes('script') || lowerFont.includes('cursive')) {
    return 'cursive';
  }
  
  // Default to sans-serif
  return 'sans-serif';
}

/**
 * Format a font family value with proper quotes and fallback
 * Example: "Julius Sans One" -> '"Julius Sans One", sans-serif'
 * Example: "Inter" -> '"Inter", sans-serif'
 */
function formatFontFamily(fontName: string): string {
  if (!fontName) return '\'"Open Sans", sans-serif\'';
  
  const fallback = getFontFallback(fontName);
  return `"${fontName}", ${fallback}`;
}

/**
 * Validate a CSS declaration line to ensure it's properly formatted
 * Returns the line if valid, or a commented-out version if invalid
 */
function validateCSSLine(line: string): string {
  // Skip empty lines and comments
  if (!line.trim() || line.trim().startsWith('/*') || line.trim().startsWith('//')) {
    return line;
  }
  
  // Check for bare "Default" or "BW" appearing as standalone words (not in variable names)
  // This would catch cases like "  Default" or "  Default:" or "  Default: something"
  const trimmed = line.trim();
  if (trimmed === 'Default' || trimmed === 'BW' || trimmed.startsWith('Default:') || trimmed.startsWith('BW:')) {
    console.error(`❌ [CSS Export] BLOCKED invalid CSS line: "${line}"`);
    return `  /* INVALID LINE BLOCKED: ${trimmed} */`;
  }
  
  // Check for CSS declarations with bare "Default" or "BW" as values (not in var())
  // Pattern: --Something: Default; or --Something: BW;
  const invalidValuePattern = /:\s*(Default|BW)\s*;/;
  if (invalidValuePattern.test(line)) {
    console.error(`❌ [CSS Export] BLOCKED invalid CSS value in line: "${line}"`);
    return line.replace(invalidValuePattern, ': transparent; /* INVALID: $1 */');
  }
  
  return line;
}

/**
 * Convert a token reference to CSS var() syntax
 * Example: "{Neutral.Color-11}" -> "var(--Neutral-Color-11)"
 * Example: "{Colors.Neutral.Color-11}" -> "var(--Neutral-Color-11)"
 * Example: "#ffffff" -> "#ffffff"
 */
function tokenToVar(tokenValue: string): string {
  if (!tokenValue) return '';
  
  // If it's a direct hex color, return as-is
  if (tokenValue.startsWith('#')) {
    return tokenValue;
  }
  
  // If it's a token reference (contains curly braces)
  if (tokenValue.includes('{') && tokenValue.includes('}')) {
    // Extract the token path: "{Colors.Neutral.Color-11}" -> "Colors.Neutral.Color-11"
    let tokenPath = tokenValue.replace(/[{}]/g, '');

    // Resolve Color-Vibrant → Color-8 (Vibrant is always Color-8)
    tokenPath = tokenPath.replace(/\.Color-Vibrant\b/g, '.Color-8');

    // Resolve BW-Button text references to Black or White
    const bwButtonMatch = tokenPath.match(/^(?:Text\.(?:Surfaces|Containers)\.)?BW-Button\.Color-(\d+)$/);
    if (bwButtonMatch) {
      return parseInt(bwButtonMatch[1], 10) <= 5 ? '#000000' : '#FFFFFF';
    }

    // Resolve {White}/{Black} to the per-mode custom property rather than a
    // literal. White is NOT a constant — #ffffff in Light-Mode, #ffffffb3
    // (white at 70%) in Dark-Mode — and :root already defines --White with the
    // right value for the mode being emitted. Returning var(--White) keeps that
    // per-mode difference; the previous hardcoded #FFFFFF flattened dark mode
    // to fully opaque. (This function has no modeData in scope, so deferring to
    // the variable is also the only correct option here.)
    if (tokenPath === 'Colors.White' || tokenPath === 'White') return 'var(--White)';
    if (tokenPath === 'Colors.Black' || tokenPath === 'Black') return 'var(--Black, #000000)';
    
    // Remove "Modes.Light-Mode-Tonal.", "Modes.Light-Mode-Professional.", "Modes.Dark-Mode." prefixes
    // "{Modes.Light-Mode-Tonal.Buttons.Surfaces.Background-11.Primary.Button}" -> "Buttons.Surfaces.Background-11.Primary.Button"
    if (tokenPath.startsWith('Modes.Light-Mode-Tonal.')) {
      tokenPath = tokenPath.substring(23); // Remove "Modes.Light-Mode-Tonal." (23 characters)
    } else if (tokenPath.startsWith('Modes.Light-Mode-Professional.')) {
      tokenPath = tokenPath.substring(30); // Remove "Modes.Light-Mode-Professional." (30 characters)
    } else if (tokenPath.startsWith('Modes.Dark-Mode.')) {
      tokenPath = tokenPath.substring(16); // Remove "Modes.Dark-Mode." (16 characters)
    }
    
    // Remove "Themes." prefix if it exists
    // "{Themes.Default.Surfaces.Surface}" -> "Default.Surfaces.Surface"
    if (tokenPath.startsWith('Themes.')) {
      tokenPath = tokenPath.substring(7); // Remove "Themes." (7 characters)
    }
    
    // Remove "Colors." prefix if it exists
    // "{Colors.Neutral.Color-11}" -> "Neutral.Color-11"
    // "{Colors.Primary.Color-5}" -> "Primary.Color-5"
    if (tokenPath.startsWith('Colors.')) {
      tokenPath = tokenPath.substring(7); // Remove "Colors." (7 characters)
    }
    
    // Remove "Backgrounds." prefix if it exists
    // "{Backgrounds.Primary.Background-9.Surfaces.Surface}" -> "Primary.Background-9.Surfaces.Surface"
    if (tokenPath.startsWith('Backgrounds.')) {
      tokenPath = tokenPath.substring(12); // Remove "Backgrounds." (12 characters)
    }
    
    // Remove intermediate "Surfaces" and "Containers" levels ONLY before specific properties
    // Remove ONLY for: Surface, Surface-Dim, Surface-Bright, Container, Container-Low, Container-Lowest, Container-High, Container-Highest
    // KEEP for: Header, Icons, Text, Border, Button, etc.
    // 
    // Examples:
    //   "Primary.Background-13.Surfaces.Surface" -> "Primary.Background-13.Surface" (remove)
    //   "Header.Surfaces.Primary.Color-9" -> "Header.Surfaces.Primary.Color-9" (keep)
    //   "Primary.Background-9.Containers.Container" -> "Primary.Background-9.Container" (remove)
    //   "Icons.Containers.Default" -> "Icons.Containers.Default" (keep)
    
    tokenPath = tokenPath
      .replace(/\.Surfaces\.(Surface-Dim|Surface-Bright|Surface)(?![A-Za-z])/g, '.$1')
      .replace(/\.Containers\.(Container-Lowest|Container-Highest|Container-Low|Container-High|Container)(?![A-Za-z])/g, '.$1');
    
    // Handle Primary-Buttons references (plural)
    // "{Primary-Buttons.Default.Surfaces.Background-1.Button}" -> "--Primary-Buttons-Default-Surfaces-Background-1-Button"
    if (tokenPath.startsWith('Primary-Buttons.')) {
      // Keep "Default" in Primary-Buttons paths - it's a style variant, not a palette
      // Replace dots with dashes
      const cssVarName = '--' + tokenPath.replace(/\./g, '-');
      return `var(${cssVarName})`;
    }
    
    // Handle Primary-Button references (singular - legacy)
    // "{Primary-Button.Default.Surfaces.Background-1.Button}" -> "--Primary-Button-Default-Surfaces-Background-1-Button"
    if (tokenPath.startsWith('Primary-Button.')) {
      // Keep "Default" in Primary-Button paths - it's a style variant, not a palette
      // Replace dots with dashes
      const cssVarName = '--' + tokenPath.replace(/\./g, '-');
      return `var(${cssVarName})`;
    }
    
    // Handle Text.Info and Text.{Palette} patterns
    // "{Text.Info.Surfaces.Color-9}" -> "--Text-Surfaces-Info-Color-9"
    // "{Text.Info.Containers.Color-9}" -> "--Text-Containers-Info-Color-9"
    // "{Text.Success.Surfaces.Color-9}" -> "--Text-Surfaces-Success-Color-9"
    tokenPath = tokenPath.replace(/^Text\.([A-Za-z-]+)\.(Surfaces|Containers)\./, 'Text.$2.$1.');
    
    // Handle Hotlink-Visited patterns (add Text prefix and reorder)
    // "{Hotlink-Visited.Surfaces.Color-9}" -> "--Text-Surfaces-Hotlink-Visited-Color-9"
    // "{Hotlink-Visited.Containers.Color-9}" -> "--Text-Containers-Hotlink-Visited-Color-9"
    tokenPath = tokenPath.replace(/^Hotlink-Visited\.(Surfaces|Containers)\./, 'Text.$1.Hotlink-Visited.');
    
    // CRITICAL SAFETY: Check if tokenPath contains invalid palette names ONLY in palette position
    // Valid: "Primary-Button.Default.Surfaces" (Default is a style, not palette)
    // Invalid: "Default.Color-1" (Default is being used as a palette)
    // Pattern: {PaletteName}.Color-{N} where PaletteName can't be "Default"
    const pathParts = tokenPath.split('.');
    
    // Check for invalid palette patterns:
    // 1. "Default.Color-X" or "BW.Color-X" (where Default/BW is used as color palette)
    // 2. First segment is Default/BW followed by Color-X pattern
    if (pathParts.length >= 2) {
      const firstPart = pathParts[0];
      const secondPart = pathParts[1];
      
      // Check if this looks like a color palette reference: {Palette}.Color-{N}
      if ((firstPart === 'Default') && secondPart?.startsWith('Color-')) {
        console.error(`❌ [CSS Export] BLOCKED: Invalid palette "Default" used in color reference: "${tokenPath}"`);
        console.error(`   Original token value: "${tokenValue}"`);
        console.error(`   Stack trace:`, new Error().stack);
        return 'transparent';
      }
    }
    
    // Convert to CSS variable format: "Neutral.Color-11" -> "--Neutral-Color-11"
    const cssVarName = '--' + tokenPath.replace(/\./g, '-');
    
    return `var(${cssVarName})`;
  }
  
  // If it's a plain value that's not a hex color and not a token reference,
  // it might be an invalid palette name like "Default" or "BW"
  // CRITICAL SAFETY CHECK: Catch invalid bare palette names and return a safe fallback
  if (tokenValue === 'Default' || tokenValue === 'BW') {
    console.error(`❌ [CSS Export] CRITICAL: Invalid token value "${tokenValue}" found - replacing with transparent to prevent CSS parse error`);
    console.error(`   Stack trace:`, new Error().stack);
    return 'transparent'; // Return a valid CSS value instead of breaking the CSS
  }
  
  // Additional safety: Check for any other suspicious bare palette names
  const suspiciousValues = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
  if (suspiciousValues.includes(tokenValue)) {
    console.warn(`⚠️ [CSS Export] Suspicious bare token value "${tokenValue}" - this might be missing curly braces. Returning as-is but check JSON.`);
  }
  
  // If it's already a plain value, return as-is
  return tokenValue;
}

// Pressed/Hover model:
//   Pressed = one step in the button's OWN lightness direction — a LIGHT button
//             (tone 6-12) goes one tone lighter (→ white when the button bg is
//             tone 12); a DARK button (tone 1-5) goes one tone darker (→ black
//             when the button bg is tone 1). Pressed never equals the button's
//             own tone — there's always a visible delta.
//   Hover   = a 50% blend of the button background and its Pressed value.
function _haRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// (_haIsLight removed — pressedToneHex keyed direction on a YIQ brightness
// threshold, which disagreed with the tone-index rule the baked tokens use.
// Nothing else needed it.)
function _haMix50(h1: string, h2: string): string {
  const [r1, g1, b1] = _haRgb(h1);
  const [r2, g2, b2] = _haRgb(h2);
  const m = (a: number, b: number) => Math.round((a + b) / 2);
  return '#' + [m(r1, r2), m(g1, g2), m(b1, b2)].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Pressed tone hex for a palette at Color-N (one step toward contrast; endpoints stay). */
function pressedToneHex(palette: string, colorN: number, colorsData: any): string | null {
  const base = colorsData?.[palette]?.[`Color-${colorN}`]?.value;
  if (!base) return null;
  // Direction keys on the TONE INDEX, matching buildHoverForPalette() in
  // staticTokenStructures.ts — the implementation that produces the baked
  // Hover/Pressed tokens — and docs/hover-active-calculation.md.
  //
  // This previously used a YIQ brightness threshold on the base colour, which
  // disagrees with the tone split on colours sitting near the boundary. Success
  // Color-6 (#2f9e5a) measures 0.459 by YIQ ("dark" → step darker → #006531)
  // while the tone rule says 6 → lighter → #6abf84. The CSS and figma.json
  // therefore described the same token differently, and the CSS direction moved
  // TOWARD the dark text on that surface: 2.84:1 instead of 9.18:1.
  //
  // The tone split is the correct rule because it matches where every
  // Text.Surfaces table flips from light to dark text (Color-1..5 light,
  // Color-6..12 dark), so the state always moves away from the text.
  // Tone 12 steps DARKER, not lighter. It sits at the top of the ramp and is
  // already near-white in light mode (#fcfcfc), so a step toward #FFFFFF moves
  // almost nowhere and a white surface shows no state feedback at all. Matches
  // buildHoverForPalette(), which produces the baked tokens — if these two
  // disagree, figma.json and the CSS describe the same token differently.
  // Tone 1 steps LIGHTER, the mirror of tone 12. It sits at the bottom of the
  // ramp; stepping darker meant #000000, and from a fill already at #040404
  // that is a contrast ratio of 1.02 against itself — no visible feedback.
  // Both ends invert because neither has headroom.
  const darkBtn = (colorN >= 2 && colorN <= 5) || colorN >= 12;
  const an = darkBtn ? colorN - 1 : colorN + 1;
  const stepHex = colorsData[palette]?.[`Color-${an}`]?.value || null;
  // Color-1 moves a HALF step: the Color-1 → Color-2 gap is a tenfold change
  // in luminance, so a full step reads as a colour change rather than a state.
  // Matches the softening in exportColorSystem's Hover/Pressed pass.
  if (colorN === 1 && stepHex && base) return _haMix50(base, stepHex);
  return stepHex;
}

/** Hover hex = 50% blend of the button bg (Color-N) and its Pressed tone. */
function hoverBlendHex(palette: string, colorN: number, colorsData: any): string | null {
  const base = colorsData?.[palette]?.[`Color-${colorN}`]?.value;
  const pressed = pressedToneHex(palette, colorN, colorsData);
  if (!base || !pressed) return null;
  return _haMix50(base, pressed);
}

/** Parse a {Hover.Palette.Color-N} or {Pressed.Palette.Color-N} token → hex. */
function resolveHoverActiveToken(tokenValue: string, colorsData: any): string | null {
  if (!tokenValue?.includes('{')) return null;
  const path = tokenValue.replace(/[{}]/g, '');
  const match = path.match(/^(Hover|Pressed)\.([\w-]+)\.Color-(\d+)$/);
  if (!match) return null;
  const n = parseInt(match[3], 10);
  return match[1] === 'Hover'
    ? hoverBlendHex(match[2], n, colorsData)
    : pressedToneHex(match[2], n, colorsData);
}

/** Emit `  --Dropshadow-Color-N: #RRGGBBAA;` lines for a given surface bg.
 *  Used alongside the legacy `--Dropshadow-Color` so Effect-Level recipes
 *  inside the scope can pull a per-elevation color tuned to the surface. */
function dropshadowLevelLines(bgHex: string): string[] {
  return SHADOW_LEVELS.map(
    level => `  --Dropshadow-Color-${level}: ${dropshadowHex8(bgHex, level)};`,
  );
}

/** Derive the aggregate `--Dropshadow-Color` RGB triple from a surface hex.
 *  Uses the SAME Comeau math as the per-level `--Dropshadow-Color-N` tokens
 *  (shared `dropshadowBaseHex` in ../dropshadow) so every shadow color in the
 *  system comes from one model. Level 2 = the standard card elevation; the
 *  per-`.level` opacity is applied by the consumer via rgba(). Returns "r, g, b". */
function deriveShadowRGB(hex: string): string | null {
  try {
    const baseHex = dropshadowBaseHex(hex, 2);
    const n = parseInt(baseHex.replace('#', '').slice(0, 6), 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  } catch { return null; }
}

/**
 * Convert Colors section to CSS variables
 * Example: { "Color-1": { "value": "#040404", "type": "color" } } -> --Neutral-Color-1: #040404;
 */
function generateColorVariables(colors: any, paletteName: string): string {
  if (!colors) return '';

  const lines: string[] = [];

  // Process each color in the palette (Color-1 through Color-12, Color-Vibrant)
  Object.keys(colors).forEach(colorKey => {
    const colorToken = colors[colorKey];

    // Skip if not a color token object
    if (!colorToken || typeof colorToken !== 'object' || !colorToken.value) {
      return;
    }

    // Generate CSS variable name: --Primary-Color-1, --Neutral-Color-2, etc.
    const cssVarName = `--${paletteName}-${colorKey}`;
    const cssValue = colorToken.value;

    lines.push(`  ${cssVarName}: ${cssValue};`);
  });

  return lines.join('\n');
}

/**
 * Generate CSS variables for Hover states from JSON
 */
function generateHoverVariablesFromJSON(modeData: any): string {
  if (!modeData || !modeData.Hover) return '';
  
  const sections: string[] = [];
  
  // Process each palette (Neutral, Primary, Secondary, Tertiary, BW)
  Object.keys(modeData.Hover).forEach(paletteName => {
    // CRITICAL SAFETY CHECK: Skip "Default" palette name only
    // BW is VALID for Hover variables
    if (paletteName === 'Default') {
      console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${paletteName}" in Hover section`);
      return;
    }
    
    const hoverColors = modeData.Hover[paletteName];
    
    if (hoverColors && typeof hoverColors === 'object') {
      sections.push(`  /* Hover ${paletteName} */`);
      
      Object.keys(hoverColors).forEach(colorKey => {
        const colorToken = hoverColors[colorKey];
        
        if (colorToken && typeof colorToken === 'object' && colorToken.value) {
          const cssVarName = `--Hover-${paletteName}-${colorKey}`;
          const cssValue = tokenToVar(colorToken.value);
          sections.push(`  ${cssVarName}: ${cssValue};`);
        }
      });
    }
  });
  
  return sections.join('\n');
}

/**
 * Generate CSS variables for Pressed states from JSON
 */
function generateActiveVariablesFromJSON(modeData: any): string {
  if (!modeData || !modeData.Pressed) return '';
  
  const sections: string[] = [];
  
  // Process each palette (Neutral, Primary, Secondary, Tertiary, BW)
  Object.keys(modeData.Pressed).forEach(paletteName => {
    // CRITICAL SAFETY CHECK: Skip "Default" palette name only
    // BW is VALID for Pressed variables
    if (paletteName === 'Default') {
      console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${paletteName}" in Pressed section`);
      return;
    }
    
    const activeColors = modeData.Pressed[paletteName];
    
    if (activeColors && typeof activeColors === 'object') {
      sections.push(`  /* Pressed ${paletteName} */`);
      
      Object.keys(activeColors).forEach(colorKey => {
        const colorToken = activeColors[colorKey];
        
        if (colorToken && typeof colorToken === 'object' && colorToken.value) {
          const cssVarName = `--Pressed-${paletteName}-${colorKey}`;
          const cssValue = tokenToVar(colorToken.value);
          sections.push(`  ${cssVarName}: ${cssValue};`);
        }
      });
    }
  });
  
  return sections.join('\n');
}

/**
 * Generate CSS variables for all color palettes in a mode
 */
function generateAllColorVariables(modeData: any): string {
  if (!modeData || !modeData.Colors) return '';
  
  const sections: string[] = [];
  
  // Process each palette (Neutral, Primary, Secondary, Tertiary, etc.)
  Object.keys(modeData.Colors).forEach(paletteName => {
    // CRITICAL SAFETY CHECK: Skip "Default" and "BW" palette names
    // These are not valid color palettes and should not generate --Default-Color-X or --BW-Color-X variables
    // Default is not a valid palette name (skip it)
    if (paletteName === 'Default') {
      console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${paletteName}" in Colors section`);
      return;
    }
    
    const paletteColors = modeData.Colors[paletteName];
    
    // Check if this is a utility color (White, Image-Overlay, Transparent) - single color value
    if (paletteColors && typeof paletteColors === 'object' && paletteColors.value && paletteColors.type === 'color') {
      // Single utility color
      sections.push(`  /* ${paletteName} */`);
      sections.push(`  --${paletteName}: ${paletteColors.value};`);
    } else {
      // Color palette (Neutral, Primary, etc.) with multiple colors
      const cssVars = generateColorVariables(paletteColors, paletteName);
      
      if (cssVars) {
        sections.push(`  /* ${paletteName} Colors */`);
        sections.push(cssVars);
      }
    }
  });
  
  return sections.join('\n');
}

/**
 * Convert Text section to CSS variables
 * Example: Text.Neutral["Color-1"] = "{Neutral.Color-11}" -> --Text-Neutral-Color-1: var(--Neutral-Color-11);
 */
function generateTextVariables(textPalette: any, paletteName: string): string {
  if (!textPalette) return '';
  
  const lines: string[] = [];
  
  // Process each text color in the palette
  Object.keys(textPalette).forEach(colorKey => {
    const colorToken = textPalette[colorKey];
    
    // Skip if not a color token object
    if (!colorToken || typeof colorToken !== 'object' || !colorToken.value) {
      return;
    }
    
    // Generate CSS variable name: --Text-Neutral-Color-1, --Text-Primary-Color-2, etc.
    const cssVarName = `--Text-${paletteName}-${colorKey}`;
    
    // Convert token reference to var() syntax
    const cssValue = tokenToVar(colorToken.value);
    
    lines.push(`  ${cssVarName}: ${cssValue};`);
  });
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for all text palettes in a mode
 * Handles nested structure: Text.Surfaces.Neutral.Color-1, Text.Containers.Primary.Color-1, etc.
 */
/**
 * Eyebrow color variables — --Eyebrows-<Scope>-<Background>-<Color-N>.
 *
 * Mirrors the Text emitter's naming so the two read as siblings. The values
 * arrive as {Text.<Scope>.<Role>.<Color-N>} references, and tokenToVar turns
 * each into a var() pointing at the Text variable, so an eyebrow is literally
 * the same value as its text role rather than a second copy that can drift.
 */
function generateEyebrowsVariables(modeData: any): string {
  const eyebrows = modeData?.Eyebrows;
  if (!eyebrows) return '';

  const lines: string[] = [];
  for (const scope of ['Surfaces', 'Containers']) {
    const scopeData = eyebrows[scope];
    if (!scopeData) continue;
    for (const background of Object.keys(scopeData)) {
      for (const [colorKey, token] of Object.entries<any>(scopeData[background])) {
        const value = token?.value;
        if (!value) continue;
        lines.push(`  --Eyebrows-${scope}-${background}-${colorKey}: ${tokenToVar(value)};`);
      }
    }
  }
  if (lines.length === 0) return '';
  console.log(`👁️  [CSS] Generating Eyebrow variables... ${lines.length} tokens`);
  return lines.join('\n');
}

function generateAllTextVariables(modeData: any): string {
  if (!modeData || !modeData.Text) return '';
  
  const sections: string[] = [];
  
  // Log Text structure for debugging
  console.log('📝 [CSS] Generating Text variables...');
  console.log(`  ├─ Text has ${Object.keys(modeData.Text).length} sections`);
  
  // Check the actual structure: Text.Surfaces.{Palette} or Text.{Palette}.Surfaces
  // The CORRECT structure is Text.Surfaces.Neutral.Color-1 (Surfaces/Containers FIRST)
  
  const hasSurfacesContainersFirst = modeData.Text.Surfaces || modeData.Text.Containers;
  
  if (hasSurfacesContainersFirst) {
    console.log('  ├─ Text has Surfaces/Containers > Palette structure (e.g., Text.Surfaces.Neutral)');
    
    // Process Surfaces section
    if (modeData.Text.Surfaces) {
      Object.keys(modeData.Text.Surfaces).forEach(paletteName => {
        // CRITICAL SAFETY CHECK: Skip "Default" palette name
        // BW is handled separately in the dedicated BW section (lines 2027-2106)
        if (paletteName === 'Default') {
          console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${paletteName}" in Text.Surfaces`);
          return;
        }
        // Skip BW here as it's explicitly generated in the dedicated BW section
        if (paletteName === 'BW') {
          console.log(`  ├─ Skipping Text.Surfaces.BW (will be generated in dedicated BW section)`);
          return;
        }
        
        const paletteData = modeData.Text.Surfaces[paletteName];
        
        if (!paletteData || typeof paletteData !== 'object') return;
        
        sections.push(`  /* Text Surfaces ${paletteName} */`);
        
        Object.keys(paletteData).forEach(colorKey => {
          const colorToken = paletteData[colorKey];
          
          if (colorToken && typeof colorToken === 'object' && colorToken.value) {
            const cssVarName = `--Text-Surfaces-${paletteName}-${colorKey}`;
            const cssValue = tokenToVar(colorToken.value);
            sections.push(`  ${cssVarName}: ${cssValue};`);
          }
        });
      });
    }
    
    // Process Containers section
    if (modeData.Text.Containers) {
      Object.keys(modeData.Text.Containers).forEach(paletteName => {
        // CRITICAL SAFETY CHECK: Skip "Default" palette name
        // BW is handled separately in the dedicated BW section (lines 2027-2106)
        if (paletteName === 'Default') {
          console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${paletteName}" in Text.Containers`);
          return;
        }
        // Skip BW here as it's explicitly generated in the dedicated BW section
        if (paletteName === 'BW') {
          console.log(`  ├─ Skipping Text.Containers.BW (will be generated in dedicated BW section)`);
          return;
        }
        
        const paletteData = modeData.Text.Containers[paletteName];
        
        if (!paletteData || typeof paletteData !== 'object') return;
        
        sections.push(`  /* Text Containers ${paletteName} */`);
        
        Object.keys(paletteData).forEach(colorKey => {
          const colorToken = paletteData[colorKey];
          
          if (colorToken && typeof colorToken === 'object' && colorToken.value) {
            const cssVarName = `--Text-Containers-${paletteName}-${colorKey}`;
            const cssValue = tokenToVar(colorToken.value);
            sections.push(`  ${cssVarName}: ${cssValue};`);
          }
        });
      });
    }
    
    if (modeData.Text.Surfaces && modeData.Text.Surfaces.Neutral && modeData.Text.Surfaces.Neutral['Color-1']) {
      console.log(`  └─ Sample: Text.Surfaces.Neutral.Color-1 = ${modeData.Text.Surfaces.Neutral['Color-1'].value}`);
    }
  } else {
    // Old flat structure: Process each palette (Neutral, Primary, Secondary, Tertiary, etc.)
    console.log('  ├─ Text has flat palette structure (legacy)');
    if (modeData.Text.Neutral && modeData.Text.Neutral['Color-1']) {
      console.log(`  └─ Sample: Text.Neutral.Color-1 = ${modeData.Text.Neutral['Color-1'].value}`);
    }
    
    Object.keys(modeData.Text).forEach(paletteName => {
      const textPalette = modeData.Text[paletteName];
      const cssVars = generateTextVariables(textPalette, paletteName);
      
      if (cssVars) {
        sections.push(`  /* Text ${paletteName} */`);
        sections.push(cssVars);
      }
    });
  }
  
  return sections.join('\n');
}

/**
 * Generate CSS variables for Hotlink and Hotlink-Visited with background mapping
 * Format: --Hotlink-Color-{num}: var(--Info-Color-{num})
 *         --Hotlink-Background-{num}: var(--Hotlink-Color-{num})
 */
function generateHotlinkVariables(modeData: any): string {
  if (!modeData || !modeData.Text) return '';
  
  const lines: string[] = [];
  
  // Color number mapping (what Info color to use for each Hotlink color)
  const colorToInfoMapping: { [key: string]: string } = {
    'Color-1': 'Info-Color-11',
    'Color-2': 'Info-Color-11',
    'Color-3': 'Info-Color-11',
    'Color-4': 'Info-Color-11',
    'Color-5': 'Info-Color-11',
    'Color-6': 'Info-Color-12',
    'Color-7': 'Info-Color-1',
    'Color-8': 'Info-Color-3',
    'Color-9': 'Info-Color-3',
    'Color-10': 'Info-Color-4',
    'Color-11': 'Info-Color-5',
    'Color-12': 'Info-Color-6',
    // Color-13 and Color-14 removed — 12-tone scale max is Color-12
    'Color-Vibrant': 'Info-Color-5'
  };
  
  // Background to color mapping (same for both Hotlink and Hotlink-Visited)
  const backgroundToColorMapping: { [key: string]: string } = {
    'Background-1': 'Color-11',
    'Background-2': 'Color-11',
    'Background-3': 'Color-11',
    'Background-4': 'Color-11',
    'Background-5': 'Color-11',
    'Background-6': 'Color-12',
    'Background-7': 'Color-1',
    'Background-8': 'Color-3',
    'Background-9': 'Color-3',
    'Background-10': 'Color-4',
    'Background-11': 'Color-5',
    'Background-12': 'Color-6',
    'Background-13': 'Color-6',
    'Background-14': 'Color-6',
    'Background-Vibrant': 'Color-5'
  };
  
  // Generate Hotlink Color variables (pointing to Info colors)
  lines.push('  /* Text Hotlink */');
  lines.push('');
  Object.keys(colorToInfoMapping).forEach(colorKey => {
    const infoColor = colorToInfoMapping[colorKey];
    lines.push(`  --Hotlink-${colorKey}: var(--${infoColor});`);
  });
  lines.push('');
  
  // Generate Hotlink Background variables (pointing to Hotlink colors)
  Object.keys(backgroundToColorMapping).forEach(bgKey => {
    const colorKey = backgroundToColorMapping[bgKey];
    lines.push(`  --Hotlink-${bgKey}: var(--Hotlink-${colorKey});`);
  });
  lines.push('');
  
  // Check if we have Hotlink-Visited palette in Text
  if (modeData.Text['Hotlink-Visited']) {
    lines.push('  /* Text Hotlink-Visited */');
    lines.push('');
    Object.keys(backgroundToColorMapping).forEach(bgKey => {
      const colorKey = backgroundToColorMapping[bgKey];
      lines.push(`  --Hotlink-Visited-${bgKey}: var(--Hotlink-Visited-${colorKey});`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Icons section (fully dynamic)
 * Handles Icon.Surfaces.{Palette}.Color-N structure (e.g., Icon.Surfaces.Neutral.Color-1)
 */
function generateIconsVariables(modeData: any): string {
  if (!modeData || !modeData.Icon) return '';
  
  const lines: string[] = [];
  const icons = modeData.Icon;
  
  // Log Icons structure for debugging
  console.log('🎨 [CSS] Generating Icon variables...');
  if (icons.Surfaces) {
    console.log(`  ├─ Icon.Surfaces has ${Object.keys(icons.Surfaces).length} palettes`);
    if (icons.Surfaces.Neutral && icons.Surfaces.Neutral['Color-1']) {
      console.log(`  └─ Sample: Icon.Surfaces.Neutral.Color-1 = ${icons.Surfaces.Neutral['Color-1'].value}`);
    }
  }
  
  // Helper function to recursively process icon objects
  const processIconObject = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a 'value' property, it's a token - generate CSS variable
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `${prefix}-${key}`;
        const cssValue = tokenToVar(value.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        processIconObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process Surfaces
  if (icons.Surfaces) {
    lines.push('  /* Icon Surfaces */');
    Object.keys(icons.Surfaces).forEach(bgName => {
      // CRITICAL SAFETY CHECK: Skip "Default" and "BW" palette names
      // Icons-Default should map to Neutral palette, not a separate Default palette
      if (bgName === 'Default' || bgName === 'BW') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${bgName}" in Icon.Surfaces`);
        return;
      }
      processIconObject(icons.Surfaces[bgName], `--Icon-Surfaces-${bgName}`);
    });
  }
  
  // Add spacing between Surfaces and Containers
  if (icons.Surfaces && icons.Containers) {
    lines.push('');
  }
  
  // Process Containers
  if (icons.Containers) {
    lines.push('  /* Icon Containers */');
    Object.keys(icons.Containers).forEach(bgName => {
      // CRITICAL SAFETY CHECK: Skip "Default" and "BW" palette names
      // Icons-Default should map to Neutral palette, not a separate Default palette
      if (bgName === 'Default' || bgName === 'BW') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${bgName}" in Icon.Containers`);
        return;
      }
      processIconObject(icons.Containers[bgName], `--Icon-Containers-${bgName}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Icon-Variant section (fully dynamic)
 * Handles the same structure as Icons but for Icon-Variant
 */
function generateIconVariantVariables(modeData: any): string {
  if (!modeData || !modeData['Icon-Variant']) return '';
  
  const lines: string[] = [];
  const iconVariant = modeData['Icon-Variant'];
  
  // Helper function to recursively process icon variant objects
  const processIconVariantObject = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a 'value' property, it's a token - generate CSS variable
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `${prefix}-${key}`;
        const cssValue = tokenToVar(value.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        processIconVariantObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process Surfaces
  if (iconVariant.Surfaces) {
    lines.push('  /* Icon-Variant Surfaces */');
    Object.keys(iconVariant.Surfaces).forEach(bgName => {
      // CRITICAL SAFETY CHECK: Skip "Default" and "BW" palette names
      // Icons-Default should map to Neutral palette, not a separate Default palette
      if (bgName === 'Default' || bgName === 'BW') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${bgName}" in Icon-Variant.Surfaces`);
        return;
      }
      processIconVariantObject(iconVariant.Surfaces[bgName], `--Icon-Variant-Surfaces-${bgName}`);
    });
  }
  
  // Add spacing between Surfaces and Containers
  if (iconVariant.Surfaces && iconVariant.Containers) {
    lines.push('');
  }
  
  // Process Containers
  if (iconVariant.Containers) {
    lines.push('  /* Icon-Variant Containers */');
    Object.keys(iconVariant.Containers).forEach(bgName => {
      // CRITICAL SAFETY CHECK: Skip "Default" and "BW" palette names
      // Icons-Default should map to Neutral palette, not a separate Default palette
      if (bgName === 'Default' || bgName === 'BW') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${bgName}" in Icon-Variant.Containers`);
        return;
      }
      processIconVariantObject(iconVariant.Containers[bgName], `--Icon-Variant-Containers-${bgName}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Tag section
 * Tag structure is flat: Tag.{TagType}.BG and Tag.{TagType}.Text
 * CSS variables: --Tag-{TagType}-BG and --Tag-{TagType}-Text
 * Uses Color-Vibrant and Text.Surfaces.{Palette}.Color-Vibrant
 */
function generateTagsVariables(modeData: any): string {
  console.log('🏷️  [CSS] generateTagsVariables called');
  console.log('  ├─ Has modeData:', !!modeData);
  console.log('  ├─ Has Tag:', !!modeData?.Tag);
  
  if (!modeData || !modeData.Tag) {
    console.log('🏷️  [CSS] No Tag data found - returning empty string');
    return '';
  }
  
  const tags = modeData.Tag;
  console.log('  └─ Tag keys:', Object.keys(tags));
  
  const lines: string[] = [];
  lines.push('  /* Tag */');
  
  // Tag structure: Tag.{Shade}.{TagType}.{Property}
  // Shades: Light, Medium
  // Tag types: Primary, Secondary, Tertiary, Info, Success, Warning, Error, Neutral
  // Properties: BG (flat), Text.{TagType} (nested), Text.BW (nested)
  const tagShades = ['Light', 'Medium'];
  const tagTypes = ['Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error', 'Neutral'];
  
  tagShades.forEach(shade => {
    if (!tags[shade]) {
      console.log(`  ⚠️ No ${shade} shade found in Tag`);
      return;
    }
    
    lines.push(`  /* Tag ${shade} */`);
    
    tagTypes.forEach(tagType => {
      if (tags[shade][tagType]) {
        const tagData = tags[shade][tagType];
        
        // Generate BG variable
        if (tagData.BG && tagData.BG.value !== undefined) {
          const cssValue = tokenToVar(tagData.BG.value);
          lines.push(`  --Tag-${shade}-${tagType}-BG: ${cssValue};`);
        }
        
        // Generate Text variables (nested structure: Text.{TagType} and Text.BW)
        if (tagData.Text) {
          // Text.{TagType} (e.g., Text.Primary)
          if (tagData.Text[tagType] && tagData.Text[tagType].value !== undefined) {
            const cssValue = tokenToVar(tagData.Text[tagType].value);
            lines.push(`  --Tag-${shade}-${tagType}-Text-${tagType}: ${cssValue};`);
          }
          
          // Text.BW
          if (tagData.Text.BW && tagData.Text.BW.value !== undefined) {
            const cssValue = tokenToVar(tagData.Text.BW.value);
            lines.push(`  --Tag-${shade}-${tagType}-Text-BW: ${cssValue};`);
          }
        }
      }
    });
    
    lines.push('');
  });
  
  const result = lines.join('\n');
  console.log(`🏷️  [CSS] Generated ${lines.length} Tag CSS lines`);
  if (lines.length > 0) {
    console.log(`🏷️  [CSS] First few Tag vars:`, lines.slice(0, 5).join('\n'));
  }
  return result;
}

/**
 * Generate CSS variables for Button-Border section
 * Handles nested objects like Button-Border.Surfaces.Neutral.Background-1
 */
function generateButtonBorderVariables(modeData: any): string {
  if (!modeData || !modeData['Button-Border']) return '';
  
  const lines: string[] = [];
  const buttonBorder = modeData['Button-Border'];
  
  // Log Button-Border structure for debugging
  console.log('🔲 [CSS] Generating Button-Border variables...');
  if (buttonBorder.Surfaces) {
    console.log(`  ├─ Button-Border.Surfaces has ${Object.keys(buttonBorder.Surfaces).length} palettes`);
    if (buttonBorder.Surfaces.Neutral && buttonBorder.Surfaces.Neutral['Background-1']) {
      console.log(`  └─ Sample: Button-Border.Surfaces.Neutral.Background-1 = ${buttonBorder.Surfaces.Neutral['Background-1'].value}`);
    }
  }
  
  // Helper function to recursively process button border objects
  const processButtonBorderObject = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a 'value' property, it's a token - generate CSS variable
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `${prefix}-${key}`;
        const cssValue = tokenToVar(value.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        processButtonBorderObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process Surfaces
  if (buttonBorder.Surfaces) {
    lines.push('  /* Button-Border Surfaces */');
    Object.keys(buttonBorder.Surfaces).forEach(paletteName => {
      // CRITICAL SAFETY CHECK: Skip "Default" and "BW" palette names
      if (paletteName === 'Default' || paletteName === 'BW') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${paletteName}" in Button-Border.Surfaces`);
        return;
      }
      processButtonBorderObject(buttonBorder.Surfaces[paletteName], `--Button-Border-Surfaces-${paletteName}`);
    });
  }
  
  // Add spacing between Surfaces and Containers
  if (buttonBorder.Surfaces && buttonBorder.Containers) {
    lines.push('');
  }
  
  // Process Containers
  if (buttonBorder.Containers) {
    lines.push('  /* Button-Border Containers */');
    Object.keys(buttonBorder.Containers).forEach(paletteName => {
      // CRITICAL SAFETY CHECK: Skip "Default" and "BW" palette names
      if (paletteName === 'Default' || paletteName === 'BW') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${paletteName}" in Button-Border.Containers`);
        return;
      }
      processButtonBorderObject(buttonBorder.Containers[paletteName], `--Button-Border-Containers-${paletteName}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Theme-Colors section
 * Creates variables for Primary, Secondary, and Tertiary colors with their Text and Background variants
 */
function generateThemeColorsVariables(modeData: any): string {
  if (!modeData || !modeData['Theme-Colors']) return '';
  
  const lines: string[] = [];
  const themeColors = modeData['Theme-Colors'];
  
  // Primary
  if (themeColors.Primary) {
    if (themeColors.Primary.Color) {
      lines.push(`  --Theme-Primary-Color: ${tokenToVar(themeColors.Primary.Color.value)};`);
    }
    if (themeColors.Primary.Text) {
      lines.push(`  --Theme-Primary-Text: ${tokenToVar(themeColors.Primary.Text.value)};`);
    }
    if (themeColors.Primary.Background) {
      lines.push(`  --Theme-Primary-Background: ${tokenToVar(themeColors.Primary.Background.value)};`);
    }
  }
  
  // Secondary
  if (themeColors.Secondary) {
    if (themeColors.Secondary.Color) {
      lines.push(`  --Theme-Secondary-Color: ${tokenToVar(themeColors.Secondary.Color.value)};`);
    }
    if (themeColors.Secondary.Text) {
      lines.push(`  --Theme-Secondary-Text: ${tokenToVar(themeColors.Secondary.Text.value)};`);
    }
    if (themeColors.Secondary.Background) {
      lines.push(`  --Theme-Secondary-Background: ${tokenToVar(themeColors.Secondary.Background.value)};`);
    }
  }
  
  // Tertiary
  if (themeColors.Tertiary) {
    if (themeColors.Tertiary.Color) {
      lines.push(`  --Theme-Tertiary-Color: ${tokenToVar(themeColors.Tertiary.Color.value)};`);
    }
    if (themeColors.Tertiary.Text) {
      lines.push(`  --Theme-Tertiary-Text: ${tokenToVar(themeColors.Tertiary.Text.value)};`);
    }
    if (themeColors.Tertiary.Background) {
      lines.push(`  --Theme-Tertiary-Background: ${tokenToVar(themeColors.Tertiary.Background.value)};`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS data-attribute selectors from Themes section (all 30 themes)
 * Creates selectors like [data-theme="Primary-Light"] with scoped variables
 * Returns the CSS outside of :root block (to be appended after :root closes)
 */
function generateThemesVariables(modeData: any, fullJsonData?: any, modeName?: string): string {
  console.log('🎨 [generateThemesVariables] Called');
  console.log('  ├─ Has modeData?', !!modeData);
  console.log('  ├─ Has modeData.Themes?', !!modeData?.Themes);
  if (modeData?.Themes) {
    console.log('  └─ Theme count:', Object.keys(modeData.Themes).length);
    console.log('      Theme names:', Object.keys(modeData.Themes));
  }
  
  if (!modeData || !modeData.Themes) return '';

  /**
   * Resolve a token reference through the JSON to its final Color variable.
   * E.g. "{Border.Surfaces.Primary.Color-11}" → look up modeData.Border.Surfaces.Primary['Color-11'].value
   *   → "{Primary.Color-5}" → "var(--Primary-Color-5)"
   * For Dropshadow-Color and Border-Variant, returns resolved hex instead.
   */
  // White and Black are per-mode palette entries, not constants: White is
  // #ffffff in Light-Mode and #ffffffb3 (white at 70%) in Dark-Mode. Always
  // read them from the mode being generated rather than hardcoding.
  const whiteHex = (): string => modeData?.Colors?.White?.value || '#FFFFFF';
  const blackHex = (): string => modeData?.Colors?.Black?.value || '#000000';

  // Build a flat lookup: token path → final resolved value
  // This traverses ALL JSON sections and follows references until we reach a Color-N or hex
  const tokenLookup: Record<string, string> = {};

  function buildLookup(obj: any, prefix: string) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === 'object' && 'value' in val && 'type' in val) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        tokenLookup[fullKey] = val.value;
      } else if (val && typeof val === 'object' && !('value' in val)) {
        buildLookup(val, prefix ? `${prefix}.${key}` : key);
      }
    }
  }

  // Index ALL sections that tokens might reference
  // This ensures every token path can be resolved to its final value
  for (const section of Object.keys(modeData)) {
    if (modeData[section] && typeof modeData[section] === 'object' && section !== 'Themes') {
      buildLookup(modeData[section], section);
    }
  }

  // BW (Black/White) text mappings — FALLBACK ONLY.
  //
  // These are now emitted in the JSON by the *TextFixedStructure files, so this
  // block must not overwrite them. It previously assigned unconditionally and
  // ran after buildLookup, so it clobbered the real per-mode values: dark-mode
  // Text.Containers.BW is #ffffffb3 (white at 70%) for every index, but this
  // wrote {Neutral.Color-1} (#040404) for index >= 6, putting near-black text on
  // near-black dark containers at 1.08-1.48:1. Fixing the JSON had no effect
  // until this stopped overriding it.
  //
  // Kept as a fallback for design systems generated before the BW palette
  // existed. Colors 1-5 = white text on dark backgrounds, 6-14 = near-black on
  // light backgrounds — the flip sits between 5 and 6, matching the
  // Text.Surfaces tables in every palette.
  const setFallback = (key: string, value: string) => {
    if (tokenLookup[key] === undefined) tokenLookup[key] = value;
  };
  for (let i = 1; i <= 14; i++) {
    const textVal = i <= 5 ? '#ffffff' : '{Neutral.Color-1}';
    const headerVal = i <= 5 ? '#ffffff' : '{Neutral.Color-1}';
    setFallback(`Text.Surfaces.BW.Color-${i}`, textVal);
    setFallback(`Text.Containers.BW.Color-${i}`, textVal);
    setFallback(`Header.Surfaces.BW.Color-${i}`, headerVal);
    setFallback(`Header.Containers.BW.Color-${i}`, headerVal);
    setFallback(`Quiet.Surfaces.BW.Color-${i}`, textVal);
    setFallback(`Quiet.Containers.BW.Color-${i}`, textVal);
    // BW Button text
    tokenLookup[`Text.Surfaces.BW.Button.Color-${i}`] = textVal;
  }
  // Vibrant variants — fallback only, same reasoning as the loop above. The
  // JSON supplies these (#040404) and must win.
  setFallback('Text.Surfaces.BW.Color-Vibrant', '{Neutral.Color-1}');
  setFallback('Text.Containers.BW.Color-Vibrant', '{Neutral.Color-1}');
  setFallback('Header.Surfaces.BW.Color-Vibrant', '{Neutral.Color-11}');
  setFallback('Header.Containers.BW.Color-Vibrant', '{Neutral.Color-11}');

  // Add Border-Variant entries — theme references {Border-Variant.Surfaces.Palette.Color-N}
  // Border-Variant = border color at 20% opacity (8-digit hex suffix '33')
  // The Border section has the border color, so we resolve it and append '26'
  const palettesForBV = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error', 'Hotlink-Visited'];
  for (const pal of palettesForBV) {
    for (let i = 1; i <= 12; i++) {
      const colorN = `Color-${i}`;
      for (const ctx of ['Surfaces', 'Containers']) {
        const borderKey = `Border.${ctx}.${pal}.${colorN}`;
        const borderVal = tokenLookup[borderKey];
        if (borderVal) {
          // Follow the chain to get hex
          let hex = borderVal;
          if (hex.includes('{')) {
            const innerPath = hex.replace(/[{}]/g, '');
            const innerMatch = innerPath.match(/^(?:Colors\.)?([\w-]+)\.(Color-\d+)$/);
            if (innerMatch) {
              hex = modeData?.Colors?.[innerMatch[1]]?.[innerMatch[2]]?.value || hex;
            }
          }
          if (hex.startsWith('#') && !hex.includes('{')) {
            // Adaptive alpha, floored at BORDER_VARIANT_ALPHA. colorN indexes
            // the BACKGROUND tone, so the palette entry at that key is the
            // surface this border sits on. A flat alpha measured a 27x spread
            // in perceived weight across themes; see variantAlpha.ts.
            const surfaceHex = modeData?.Colors?.[pal]?.[colorN]?.value;
            tokenLookup[`Border-Variant.${ctx}.${pal}.${colorN}`] =
              variantHex8(hex, BORDER_VARIANT_ALPHA, surfaceHex);
          }
        }
      }
    }
  }

  // Add Focus-Visible fallbacks if not in JSON.
  // Keyed by Background-N to match the primitive's actual shape
  // (Focus-Visible.Surfaces/Containers are keyed by background, not palette tone).
  // This fallback previously used Color-N, which never matched — so it silently
  // substituted this generic blue for every focus ring while the real tokens went
  // unresolved. If it starts firing again, the refs have drifted; fix those rather
  // than widening this.
  if (!tokenLookup['Focus-Visible.Surfaces.Background-1']) {
    console.warn('[exportToCSS] Focus-Visible tokens missing — falling back to #3b82f6');
    for (let i = 1; i <= 14; i++) {
      tokenLookup[`Focus-Visible.Surfaces.Background-${i}`] = '#3b82f6';
      tokenLookup[`Focus-Visible.Containers.Background-${i}`] = '#3b82f6';
    }
  }

  // Add Default-Background entries — the Default theme references {Default-Background.Surface}, etc.
  // These map to the user's selected background palette at their extracted tone.
  // Use token references (not resolved values) so resolveTokenForCSS can follow the chain.
  {
    const metadata = fullJsonData?.Metadata || modeData?.Metadata;
    const bgSelection = metadata?.['Background']?.value;
    const primaryToneVal = metadata?.['Extracted-Tones']?.Primary?.value;
    const primaryN = primaryToneVal ? toneToColorNumber(primaryToneVal) : 9;

    // Map user's background selection to palette + Color-N (same as getBgThemeAndN in exportColorSystem)
    let defPal = 'Primary';
    let defN = 11; // default: primary-light
    switch (bgSelection) {
      case 'white': defPal = 'Neutral'; defN = 12; break;
      case 'black': defPal = 'Neutral'; defN = 1; break;
      case 'primary-base': case 'primary': defPal = 'Primary'; defN = primaryN; break;
      case 'primary-light': defPal = 'Primary'; defN = 11; break;
      default: defPal = metadata?.['Background-Theme']?.value || 'Primary'; defN = 11; break;
    }
    // Dark mode does NOT reuse the light-mode palette/tone. The selection above
    // describes the LIGHT background; in dark mode the Default theme sits on the
    // dark end of the ramp instead. Mirrors generateFigmaJSON.ts, which already
    // did this — without it the CSS resolved Default-Background.Surface to
    // Backgrounds.Neutral.Background-12, a LIGHT colour in the dark palette, so
    // the Default theme rendered light-on-dark in Figma and dark-on-light on the
    // web. Both files were internally consistent, so contrast checks passed on
    // each; only a cross-artifact comparison caught it.
    const isDarkMode = modeName === 'Dark-Mode';
    const darkUsePrimary = bgSelection === 'primary-light' || bgSelection === 'primary-base' || bgSelection === 'primary';
    if (isDarkMode) {
      defPal = darkUsePrimary ? 'Primary' : 'Neutral';
      defN = 2;                       // dark surfaces sit at Color-2
    }
    const colorN = `Color-${defN}`;
    // Dark containers are always tonal at Color-3 (see generateFigmaJSON).
    const contN = isDarkMode ? 3 : defN;
    const contColorN = `Color-${contN}`;

    // Background surfaces/containers — reference Backgrounds.{Palette}.Background-{N}
    const bgKey = `Backgrounds.${defPal}.Background-${defN}`;
    const contBgKey = `Backgrounds.${defPal}.Background-${contN}`;
    tokenLookup['Default-Background.Surface'] = `{${bgKey}.Surfaces.Surface}`;
    tokenLookup['Default-Background.Surface-Dim'] = `{${bgKey}.Surfaces.Surface-Dim}`;
    tokenLookup['Default-Background.Surface-Bright'] = `{${bgKey}.Surfaces.Surface-Bright}`;
    // Surface-Brightest. overrideSurface in generateCompleteThemes routes the
    // Default theme's brightest surface through Default-Background alongside
    // the other three, but this lookup was never given the matching entry — so
    // the reference survived into the CSS as var(--Default-Background-Surface-
    // Brightest), a name nothing defines. An undefined custom property is not
    // an error: the declaration is dropped and the element keeps whatever it
    // inherited, so [data-theme="Default"][data-surface="Surface-Brightest"]
    // simply painted its parent's background. The only unresolved reference in
    // the whole bundle, out of ~6,000.
    // A Backgrounds row carries only Surface, Surface-Dim and Surface-Bright.
    // Brightest is not a member of it — every other theme reaches its brightest
    // surface by pointing at a DIFFERENT row's Surface, and Default has to do
    // the same. Same rule as generateSingleTheme: Bright is one tone up, and
    // Brightest takes 11 unless Bright has already claimed it, in which case 12.

    const defBrightN = Math.min(defN + 1, 12);
    const defBrightestN = defBrightN >= 11 ? 12 : 11;
    tokenLookup['Default-Background.Surface-Brightest'] =
      `{Backgrounds.${defPal}.Background-${defBrightestN}.Surfaces.Surface}`;
    // No Default-Background.Surface-Dimmest: the Default theme keeps
    // generateSingleTheme's own {Backgrounds.<pal>.Background-4...} reference
    // for that surface. Surface-Dimmest is pinned to Color-4 in every theme and
    // mode, so it is already mode-correct without the indirection — see the
    // note beside overrideSurface in generateCompleteThemes.ts.
    tokenLookup['Default-Background.Container'] = `{${contBgKey}.Containers.Container}`;
    tokenLookup['Default-Background.Container-Low'] = `{${contBgKey}.Containers.Container-Low}`;
    tokenLookup['Default-Background.Container-Lowest'] = `{${contBgKey}.Containers.Container-Lowest}`;
    tokenLookup['Default-Background.Container-High'] = `{${contBgKey}.Containers.Container-High}`;
    tokenLookup['Default-Background.Container-Highest'] = `{${contBgKey}.Containers.Container-Highest}`;

    // Text, Header, Quiet, Border, etc. — reference {Section.Surfaces.Palette.Color-N}
    const props = ['Text', 'Header', 'Quiet', 'Border', 'Border-Variant'];
    for (const prop of props) {
      tokenLookup[`Default-Background.${prop}`] = `{${prop}.Surfaces.${defPal}.${colorN}}`;
      tokenLookup[`Default-Background.Container-${prop}`] = `{${prop}.Containers.${defPal}.${contColorN}}`;
    }
    tokenLookup['Default-Background.Container-Text-BW'] =
      `{Default-Button-Border.Containers.BlackWhite.${contColorN}}`;
    // Focus-Visible uses a flat path (no palette nesting) AND is keyed by
    // Background-N, not Color-N. Using colorN here produced
    // {Focus-Visible.Surfaces.Color-12}, which never resolves — leaving the
    // Default theme's focus ring unbound in both modes.
    const backgroundN = `Background-${defN}`;
    const containerBackgroundN = `Background-${contN}`;
    tokenLookup['Default-Background.Focus-Visible'] = `{Focus-Visible.Surfaces.${backgroundN}}`;
    tokenLookup['Default-Background.Container-Focus-Visible'] = `{Focus-Visible.Containers.${containerBackgroundN}}`;

    // Hover/Pressed — reference {Hover/Pressed.Palette.Color-N}
    tokenLookup['Default-Background.Hover'] = `{Hover.${defPal}.${colorN}}`;
    tokenLookup['Default-Background.Pressed'] = `{Pressed.${defPal}.${colorN}}`;
    // Container states come from the Containers group, which is computed from
    // the container colour. The flat family is indexed by background tone and
    // would send a dark container to a light hover.
    tokenLookup['Default-Background.Container-Hover'] = `{Hover.Containers.${defPal}.${contColorN}}`;
    tokenLookup['Default-Background.Container-Pressed'] = `{Pressed.Containers.${defPal}.${contColorN}}`;

    // Per-surface foregrounds for the Default theme.
    //
    // Default cannot use the plain {Backgrounds.<pal>.Background-N} +
    // {Text.Surfaces.<pal>.Color-N} pairing every other theme uses: its
    // background depends on the user's selection AND differs per mode, while the
    // Theme layer is mode-independent. Hence the Default-Background indirection
    // — which must cover EVERY role. Any role left out keeps a hardcoded
    // light-mode tone and pairs a tone-12 foreground with a Color-2 background
    // in dark mode (#232f27 on #111111 = 1.36:1).
    //
    // Must stay in step with ROLE_SOURCES in generateFigmaJSON.ts; if the two
    // emit different key sets, figma.json and the CSS drift apart.
    const accentPalettes = ['Primary', 'Secondary', 'Tertiary', 'Neutral',
      'Info', 'Success', 'Warning', 'Error'];

    /**
     * Which (palette, tone) an Icon table entry renders at.
     *
     * Accepts either a resolved hex or a {Colors.<pal>.Color-N} ref — the Icon
     * tables carry both shapes depending on how far generation has progressed.
     * A hex is matched back across every palette rather than assumed to belong
     * to the one being iterated, because Icons-Default follows the theme's own
     * palette (or BW) and its tone does not live under "Default".
     */
    const iconToneFor = (raw: any): { palette: string; n: number } | null => {
      if (typeof raw !== 'string' || !raw) return null;
      const ref = raw.match(/^\{Colors\.([\w-]+)\.Color-(\d+)\}$/);
      if (ref) return { palette: ref[1], n: Number(ref[2]) };
      if (!raw.startsWith('#')) return null;
      const target = raw.toLowerCase();
      const palettes = modeData?.Colors || {};
      for (const p of Object.keys(palettes)) {
        for (let n = 1; n <= 12; n++) {
          if (palettes[p]?.[`Color-${n}`]?.value?.toLowerCase() === target) {
            return { palette: p, n };
          }
        }
      }
      return null;
    };
    const surfaceScopes: Array<{ prefix: string; tone: number }> = [
      { prefix: '', tone: defN },
      { prefix: 'Surface-Dim-', tone: Math.max(defN - 1, 1) },
      { prefix: 'Surface-Bright-', tone: Math.min(defN + 1, 12) },
      // Surface-Brightest: 11, or 12 once Bright has taken 11. Must match
      // generateCompleteThemes' brightestN or Default's brightest surface
      // pairs its foregrounds with a different tone than it paints.
      { prefix: 'Surface-Brightest-', tone: Math.min(defN + 1, 12) >= 11 ? 12 : 11 },
    ];

    for (const { prefix, tone } of surfaceScopes) {
      const vColorN = `Color-${tone}`;
      // Base roles resolve from their own family at the surface's own palette.
      for (const prop of props) {
        tokenLookup[`Default-Background.${prefix}${prop}`] = `{${prop}.Surfaces.${defPal}.${vColorN}}`;
      }
      // Text-BW is black or white for this surface's tone. It resolves through
      // the BlackWhite map rather than a palette family, so it cannot ride the
      // props loop above — but it is still a role, and this indirection has to
      // cover EVERY role or Default keeps a hardcoded light-mode value.
      tokenLookup[`Default-Background.${prefix}Text-BW`] =
        `{Default-Button-Border.Surfaces.BlackWhite.${vColorN}}`;
      // Accents resolve from their OWN palette at the surface's tone.
      for (const pal of accentPalettes) {
        tokenLookup[`Default-Background.${prefix}Text-${pal}`] = `{Text.Surfaces.${pal}.${vColorN}}`;
        tokenLookup[`Default-Background.${prefix}Header-${pal}`] = `{Header.Surfaces.${pal}.${vColorN}}`;
        tokenLookup[`Default-Background.${prefix}Icons-${pal}`] = `{Icon.Surfaces.${pal}.${vColorN}}`;
        tokenLookup[`Default-Background.${prefix}Icons-${pal}-Variant`] = `{Icon-Variant.Surfaces.${pal}.${vColorN}}`;

        // On-<pal>: foreground for content sitting ON the icon colour.
        //
        // Unlike the roles above this cannot be expressed as a static token
        // path. Icons-<pal> is chosen to contrast with the SURFACE, so the tone
        // it renders at is not the surface tone — it has to be resolved, then
        // matched back to a palette tone so the Text table can be indexed at
        // the icon's OWN tone. Must stay in step with writeExtras in
        // generateFigmaJSON.ts.
        const iconTone = iconToneFor(modeData?.Icon?.Surfaces?.[pal]?.[vColorN]?.value);
        if (iconTone) {
          tokenLookup[`Default-Background.${prefix}On-${pal}`] =
            `{Text.Surfaces.${iconTone.palette}.Color-${iconTone.n}}`;
        }
      }
      // On-Default follows the theme's own palette rather than an accent one,
      // so it is derived from the same source as Icons-Default below.
      const defOnTone = iconToneFor(modeData?.Text?.Surfaces?.[defPal]?.[vColorN]?.value);
      if (defOnTone) {
        tokenLookup[`Default-Background.${prefix}On-Default`] =
          `{Text.Surfaces.${defOnTone.palette}.Color-${defOnTone.n}}`;
      }
      // Icons-Default tracks --Text in every other theme (verified across all
      // 20); Default must not be the exception. Its -Variant is the alpha form,
      // matching generateSingleTheme's non-BW branch.
      tokenLookup[`Default-Background.${prefix}Icons-Default`] = `{Text.Surfaces.${defPal}.${vColorN}}`;
      tokenLookup[`Default-Background.${prefix}Icons-Default-Variant`] = `{Icon-Variant.Surfaces.${defPal}.${vColorN}}`;
      tokenLookup[`Default-Background.${prefix}Hotlink`] = `{Text.Surfaces.Info.${vColorN}}`;
      tokenLookup[`Default-Background.${prefix}Hotlink-Visited`] = `{Text.Surfaces.Hotlink-Visited.${vColorN}}`;
      tokenLookup[`Default-Background.${prefix}Focus-Visible`] = `{Focus-Visible.Surfaces.Background-${tone}}`;
      tokenLookup[`Default-Background.${prefix}Hover`] = `{Hover.${defPal}.${vColorN}}`;
      tokenLookup[`Default-Background.${prefix}Pressed`] = `{Pressed.${defPal}.${vColorN}}`;
    }


    // Hotlink
    tokenLookup['Default-Background.Hotlink'] = `{Text.Surfaces.Info.${colorN}}`;
    tokenLookup['Default-Background.Hotlink-Visited'] = `{Text.Surfaces.Hotlink-Visited.${colorN}}`;

    console.log(`  📊 Added Default-Background entries for ${defPal} ${colorN} (${Object.keys(tokenLookup).filter(k => k.startsWith('Default-Background.')).length} entries)`);
  }

  // Log unresolved tokens for debugging
  console.log(`  📊 Token lookup built with ${Object.keys(tokenLookup).length} entries`);

  // Debug: check for key patterns we expect
  const sampleKeys = Object.keys(tokenLookup).filter(k =>
    k.includes('Default-Button') || k.includes('Hotlink-Visited') || k.includes('BW')
  );
  console.log(`  📊 Sample lookup keys: ${sampleKeys.slice(0, 10).join(', ')}`);

  /**
   * Resolve a token to its final Color variable or hex value.
   * Follows the reference chain: token → lookup → inner token → ... → Color-N or hex
   */
  function resolveTokenForCSS(tokenValue: string, cssVarName: string): string {
    try {
      if (!tokenValue || typeof tokenValue !== 'string') return tokenToVar(tokenValue);
      if (tokenValue.startsWith('#')) return tokenValue;
      if (!tokenValue.includes('{')) return tokenValue;

      // Already computed RGB (dropshadow, highlight, lowlight)
      if (!tokenValue.includes('{') && tokenValue.includes(',')) return tokenValue;

      let current = tokenValue;

      // Pre-resolve Color-Vibrant → Color-8
      current = current.replace(/Color-Vibrant/g, 'Color-8');

      // Pre-resolve BW-Button text to Black/White
      const bwMatch = current.replace(/[{}]/g, '').match(/^(?:Text\.(?:Surfaces|Containers)\.)?BW-Button\.Color-(\d+)$/);
      if (bwMatch) return parseInt(bwMatch[1], 10) <= 5 ? '#000000' : '#FFFFFF';

      // Resolve {White}/{Black} from the mode's own palette — White is NOT a
      // constant: it is #ffffff in Light-Mode and #ffffffb3 (white at 70%) in
      // Dark-Mode. Hardcoding #FFFFFF here made every {White} reference fully
      // opaque in dark mode.
      const stripped = current.replace(/[{}]/g, '');
      if (stripped === 'White' || stripped === 'Colors.White') return whiteHex();
      if (stripped === 'Black' || stripped === 'Colors.Black') return blackHex();

      // Resolve Hover/Pressed tokens directly to hex when possible
      if (modeData?.Colors) {
        const haHex = resolveHoverActiveToken(current, modeData.Colors);
        if (haHex) return haHex;
      }

      // Resolve {Buttons.Palette.Shade.Hover/Pressed} → follow chain to hex
      const btnHAMatch = current.replace(/[{}]/g, '').match(/^Buttons\.([\w-]+)\.(Light|Medium)\.(Hover|Pressed)$/);
      if (btnHAMatch && modeData?.Buttons && modeData?.Colors) {
        const innerToken = modeData.Buttons?.[btnHAMatch[1]]?.[btnHAMatch[2]]?.[btnHAMatch[3]]?.value;
        if (innerToken) {
          const hex = resolveHoverActiveToken(innerToken, modeData.Colors);
          if (hex) return hex;
        }
      }

      // Follow the chain up to 5 levels
      for (let depth = 0; depth < 5; depth++) {
        if (!current.includes('{')) break;

        const path = current.replace(/[{}]/g, '').replace(/Color-Vibrant/g, 'Color-8');

        // {White} / {Black} can appear part-way down a chain, not just as the
        // starting value — e.g. Default-Background.Container →
        // Backgrounds.Neutral.Background-12.Containers.Container → {White}.
        // Without this the chain broke here and the caller fell back to
        // mangling the ORIGINAL token into var(--Default-Background-Container),
        // a custom property nothing ever defines. That left every Default-theme
        // container unset in the browser.
        if (path === 'White' || path === 'Colors.White') return whiteHex();
        if (path === 'Black' || path === 'Colors.Black') return blackHex();

        // Check if it's already a final Colors reference
        const colorMatch = path.match(/^(?:Colors\.)?([\w-]+)\.(Color-\d+)$/);
        if (colorMatch) {
          return `var(--${colorMatch[1]}-${colorMatch[2]})`;
        }

        // Look up in our flat index
        const resolved = tokenLookup[path];
        if (resolved) {
          // Special cases: return resolved value directly (no Color-N mapping needed)
          if (cssVarName === '--Dropshadow-Color' && !resolved.includes('{')) return resolved;
          if (cssVarName === '--Border-Variant' && resolved.startsWith('#')) return resolved;
          if (!resolved.includes('{') && resolved.includes(',')) return resolved; // RGB triplet
          // Surface/Container backgrounds are computed values — keep as hex, don't map to Color-N
          const isBackgroundVar = /^--(Background|Surface|Surface-Dim|Surface-Bright|Container|Container-Low|Container-Lowest|Container-High|Container-Highest)$/.test(cssVarName);
          if (isBackgroundVar && resolved.startsWith('#')) return resolved;

          // If resolved is a hex, try to find which Color-N it matches
          if (resolved.startsWith('#')) {
            // Search all palettes for this exact hex
            const palettes = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error', 'Hotlink-Visited', 'BW'];
            for (const pal of palettes) {
              if (modeData?.Colors?.[pal]) {
                for (const [key, val] of Object.entries(modeData.Colors[pal])) {
                  if ((val as any)?.value === resolved && key.startsWith('Color-')) {
                    return `var(--${pal}-${key})`;
                  }
                }
              }
            }
            // No Color-N match found — return hex directly
            return resolved;
          }

          // Check if resolved is a hover/active token → resolve to hex
          if (modeData?.Colors) {
            const haResolved = resolveHoverActiveToken(resolved, modeData.Colors);
            if (haResolved) return haResolved;
          }

          current = resolved;
          continue;
        }

        // Not found in lookup — try stripping "Colors." prefix
        const withoutColors = path.startsWith('Colors.') ? path.substring(7) : null;
        if (withoutColors) {
          const stripped = tokenLookup[withoutColors];
          if (stripped) { current = stripped; continue; }
        }

        // Not resolvable further
        break;
      }

      // Final check on the resolved value
      if (!current.includes('{')) {
        if (current.includes(',')) return current; // RGB
        if (current.startsWith('#')) {
          // Surface/Container backgrounds — keep as hex, don't map to Color-N
          const isBackgroundVar2 = /^--(Background|Surface|Surface-Dim|Surface-Bright|Container|Container-Low|Container-Lowest|Container-High|Container-Highest)$/.test(cssVarName);
          if (isBackgroundVar2) return current;
          // Try to find which Color-N this hex matches
          const palettes = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error', 'Hotlink-Visited', 'BW'];
          for (const pal of palettes) {
            if (modeData?.Colors?.[pal]) {
              for (const [key, val] of Object.entries(modeData.Colors[pal])) {
                if ((val as any)?.value === current && key.startsWith('Color-')) {
                  return `var(--${pal}-${key})`;
                }
              }
            }
          }
          return current; // No match, return hex
        }
      }
      // Check one more time for Color reference
      const finalPath = current.replace(/[{}]/g, '');
      const finalMatch = finalPath.match(/^(?:Colors\.)?(\w+)\.(Color-\d+)$/);
      if (finalMatch) {
        return `var(--${finalMatch[1]}-${finalMatch[2]})`;
      }
    } catch {
      // Silent fallback
    }

    return tokenToVar(tokenValue);
  }

  /**
   * Recursively process nested token structures
   * Resolves intermediate references to final Color variables for smaller CSS
   */
  function processTokens(obj: any, prefix: string = ''): string[] {
    const lines: string[] = [];

    Object.keys(obj).forEach(key => {
      const value = obj[key];

      // SPECIAL FILTER: Skip non-Default button types in Surfaces/Containers Buttons
      if (prefix.includes('Surfaces-Buttons') || prefix.includes('Containers-Buttons')) {
        if (key !== 'Default' && ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'].includes(key)) {
          return;
        }
      }

      // Check if this is a token with a .value property
      if (value && typeof value === 'object' && 'value' in value && 'type' in value) {
        const cssVarName = prefix ? `--${prefix}-${key}` : `--${key}`;
        const cssValue = resolveTokenForCSS(value.value, cssVarName);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
      // Check if this is a nested object (like Buttons, Icons, etc.)
      else if (value && typeof value === 'object' && !('value' in value)) {
        const newPrefix = prefix ? `${prefix}-${key}` : key;
        lines.push(...processTokens(value, newPrefix));
      }
    });

    return lines;
  }
  
  /**
   * Paint the region from the tokens it just declared.
   *
   * Setting data-theme + data-surface now paints the element directly, so a
   * section no longer needs a component wrapper to apply its own background —
   * the attributes are the whole contract. Both properties resolve through the
   * cascade, so they re-resolve automatically when the theme or surface flips.
   *
   * `background-color`, not `background`, so a designer's gradient or image on
   * the same element isn't wiped out by the shorthand.
   *
   * The opt-out matters: some elements need the token scope WITHOUT the paint —
   * an AppBar whose own root paints itself, or a wrapper that only exists to
   * re-scope tokens for its children (what ThemedZone is for). Painting those
   * would double-paint or overwrite the component's own background, so
   * [data-paint="none"] suppresses it.
   */
  const paintLines = (): string[] => [
    '  /* Paint the region from its own tokens. Opt out with data-paint="none". */',
    '  background-color: var(--Background);',
    '  color: var(--Text);',
  ];

  const sections: string[] = [];
  const themes = modeData.Themes;
  
  // Process each theme (Primary-Light, Primary, Secondary, etc.)
  Object.keys(themes).forEach(themeName => {
    const theme = themes[themeName];
    console.log(`  ├─ Processing theme: ${themeName}`);
    console.log(`      Has Surfaces: ${!!theme.Surfaces}, Has Containers: ${!!theme.Containers}`);
    
    // Surfaces selectors: default (Surface) on theme element, variants on descendants
    const surfaceVariants: { key: string; selector: string }[] = [
      {
        key: 'Surfaces',
        selector: `[data-theme="${themeName}"],\n[data-theme="${themeName}"][data-surface="Surface"]`
      },
      {
        key: 'Surfaces-Dim',
        selector: `[data-theme="${themeName}"] [data-surface="Surface-Dim"],\n[data-theme="${themeName}"][data-surface="Surface-Dim"]`
      },
      {
        key: 'Surfaces-Dimmest',
        selector: `[data-theme="${themeName}"] [data-surface="Surface-Dimmest"],\n[data-theme="${themeName}"][data-surface="Surface-Dimmest"]`
      },
      {
        key: 'Surfaces-Bright',
        selector: `[data-theme="${themeName}"] [data-surface="Surface-Bright"],\n[data-theme="${themeName}"][data-surface="Surface-Bright"]`
      },
      {
        key: 'Surfaces-Brightest',
        selector: `[data-theme="${themeName}"] [data-surface="Surface-Brightest"],\n[data-theme="${themeName}"][data-surface="Surface-Brightest"]`
      }
    ];

    for (const variant of surfaceVariants) {
      const variantData = theme[variant.key];
      if (variantData && typeof variantData === 'object') {
        const surfaceLines: string[] = [];
        surfaceLines.push(`/* Theme: ${themeName} - ${variant.key} */`);
        surfaceLines.push(`${variant.selector} {`);

        // DEBUG: Check if Buttons and Tag exist
        if (variantData.Buttons) {
          console.log(`      ✓ Found ${variant.key}.Buttons with keys:`, Object.keys(variantData.Buttons));
        } else {
          console.log(`      ✗ ${variant.key}.Buttons NOT FOUND`);
        }
        if (variantData.Tag) {
          console.log(`      ✓ Found ${variant.key}.Tag with keys:`, Object.keys(variantData.Tag));
        } else {
          console.log(`      ✗ ${variant.key}.Tag NOT FOUND`);
        }

        // Recursively process all tokens
        const tokenLines = processTokens(variantData);
        surfaceLines.push(...tokenLines);

        // Ensure Dropshadow-Color exists — compute from background if missing
        if (!tokenLines.some(l => l.includes('--Dropshadow-Color'))) {
          // Find the background hex from the Surface/Background token
          const bgToken = variantData.Surface?.value || variantData.Background?.value;
          if (bgToken) {
            const bgResolved = resolveTokenForCSS(bgToken, '--Background');
            let bgHex: string | null = bgResolved.startsWith('#') ? bgResolved : null;
            // If resolution returned a var(--Palette-Color-N) reference (the
            // default-Surface case), look up the underlying hex from
            // modeData.Colors so we can still derive a Dropshadow-Color.
            if (!bgHex && modeData?.Colors) {
              const varMatch = bgResolved.match(/^var\(--([\w-]+)-(Color-\d+)\)$/);
              if (varMatch) {
                const paletteHex = modeData.Colors?.[varMatch[1]]?.[varMatch[2]]?.value;
                if (paletteHex && typeof paletteHex === 'string' && paletteHex.startsWith('#')) {
                  bgHex = paletteHex;
                }
              }
            }
            if (bgHex) {
              const rgb = deriveShadowRGB(bgHex);
              if (rgb) surfaceLines.push(`  --Dropshadow-Color: ${rgb};`);
              // Per-level 8-digit hex shadow tokens — matches Figma's
              // model and lets Effect-Level recipes stack distinct colors
              // per elevation instead of one tinted color at varying alpha.
              surfaceLines.push(...dropshadowLevelLines(bgHex));
            }
          }
        }

        console.log(`      └─ ${variant.key} tokens generated: ${tokenLines.length}`);
        surfaceLines.push(...paintLines());
        surfaceLines.push('}');
        surfaceLines.push('');
        sections.push(surfaceLines.join('\n'));
      }
    }
    
    // Containers selector: [data-theme="Primary-Light"] [data-surface^="Container"]
    if (theme.Containers && typeof theme.Containers === 'object') {
      const containerLines: string[] = [];
      containerLines.push(`/* Theme: ${themeName} - Containers */`);
      containerLines.push(`[data-theme="${themeName}"] [data-surface^="Container"],`);
      containerLines.push(`[data-theme="${themeName}"][data-surface^="Container"] {`);
      
      // DEBUG: Check if Buttons and Tag exist in Containers
      if (theme.Containers.Buttons) {
        console.log(`      ✓ Found Containers.Buttons with keys:`, Object.keys(theme.Containers.Buttons));
      } else {
        console.log(`      ✗ Containers.Buttons NOT FOUND`);
      }
      if (theme.Containers.Tag) {
        console.log(`      ✓ Found Containers.Tag with keys:`, Object.keys(theme.Containers.Tag));
      } else {
        console.log(`      ✗ Containers.Tag NOT FOUND`);
      }
      
      // Recursively process all tokens in Containers
      const tokenLines = processTokens(theme.Containers);
      containerLines.push(...tokenLines);

      // Ensure Dropshadow-Color exists — compute from Container background if missing
      if (!tokenLines.some(l => l.includes('--Dropshadow-Color'))) {
        const contToken = theme.Containers.Container?.value;
        if (contToken) {
          const contResolved = resolveTokenForCSS(contToken, '--Container');
          let contHex: string | null = contResolved.startsWith('#') ? contResolved : null;
          // Same var(--Palette-Color-N) fallback as the Surfaces case above.
          if (!contHex && modeData?.Colors) {
            const varMatch = contResolved.match(/^var\(--([\w-]+)-(Color-\d+)\)$/);
            if (varMatch) {
              const paletteHex = modeData.Colors?.[varMatch[1]]?.[varMatch[2]]?.value;
              if (paletteHex && typeof paletteHex === 'string' && paletteHex.startsWith('#')) {
                contHex = paletteHex;
              }
            }
          }
          if (contHex) {
            const rgb = deriveShadowRGB(contHex);
            if (rgb) containerLines.push(`  --Dropshadow-Color: ${rgb};`);
            containerLines.push(...dropshadowLevelLines(contHex));
          }
        }
      }

      console.log(`      └─ Container tokens generated: ${tokenLines.length}`);
      containerLines.push(...paintLines());
      containerLines.push('}');
      containerLines.push('');
      sections.push(containerLines.join('\n'));
    }
  });
  
  // Opt-out, emitted last so it wins on specificity ties against the theme
  // blocks above. Tokens still resolve — only the paint is suppressed.
  sections.push([
    '/* Token scope without the paint — for elements that paint themselves',
    '   (an AppBar root) or exist only to re-scope tokens for children. */',
    '[data-paint="none"] {',
    '  background-color: revert;',
    '  color: revert;',
    '}',
    '',
  ].join('\n'));

  console.log(`  └─ Total theme sections generated: ${sections.length}`);
  const result = sections.join('\n');
  console.log(`      Result length: ${result.length} characters`);
  
  return result;
}

/**
 * Generate CSS variables for Backgrounds section in :root
 * Creates simple --{Theme}-Background-N-Property variables (without Backgrounds prefix)
 * Used in :root block for base.css
 */
function generateBackgroundsCSS(fullJsonData: any): string {
  // Extract Backgrounds from Modes.Light-Mode-Tonal (as source of truth for all backgrounds)
  const backgrounds = fullJsonData?.Modes?.['Light-Mode-Tonal']?.Backgrounds;
  if (!backgrounds) return '';
  
  const lines: string[] = [];
  
  // Helper function to recursively process background objects
  // Skip 'Surfaces' and 'Containers' intermediate levels
  const processBackgroundObject = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a 'value' property, it's a token - generate CSS variable
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `${prefix}-${key}`;
        const cssValue = tokenToVar(value.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
      // If the key is 'Surfaces' or 'Containers', skip it and process children directly
      else if (key === 'Surfaces' || key === 'Containers') {
        processBackgroundObject(value, prefix);
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        processBackgroundObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process all Background-N keys
  const backgroundKeys = Object.keys(backgrounds).sort((a, b) => {
    // Sort numerically: Background-1, Background-2, ... Background-14, Background-Vibrant
    const aNum = parseInt(a.replace('Background-', ''));
    const bNum = parseInt(b.replace('Background-', ''));
    if (isNaN(aNum)) return 1;
    if (isNaN(bNum)) return -1;
    return aNum - bNum;
  });
  
  backgroundKeys.forEach((backgroundKey, index) => {
    if (index > 0) lines.push(''); // Add spacing between backgrounds
    lines.push(`  /* ${backgroundKey} */`);
    processBackgroundObject(backgrounds[backgroundKey], `--Backgrounds-${backgroundKey}`);
  });
  
  return lines.join('\n');
}

/**
 * Generate background variables for each theme (Primary, Secondary, Tertiary, Neutral)
 * Creates --{Theme}-Background-N-{Property} variables (without Backgrounds prefix)
 * 
 * Handles TWO structures:
 * 1. Flat: Backgrounds.Background-1.Surface (no theme grouping)
 * 2. Theme-based: Backgrounds.Primary.Background-1.Surfaces.Surface
 */
function generateBackgroundsVariables(modeData: any): string {
  if (!modeData || !modeData.Backgrounds) return '';
  
  console.log('🎨 [CSS] generateBackgroundsVariables called');
  console.log('  Has Backgrounds?', !!modeData.Backgrounds);
  
  const lines: string[] = [];
  const backgrounds = modeData.Backgrounds;
  
  // DEBUGGING: Log actual values from first background
  const firstTheme = Object.keys(backgrounds)[0];
  if (firstTheme && backgrounds[firstTheme]) {
    const bgKeys = Object.keys(backgrounds[firstTheme]);
    const bg13 = bgKeys.find(k => k.includes('13'));
    if (bg13 && backgrounds[firstTheme][bg13]) {
      console.log(`🔍 [CSS] ${firstTheme}.${bg13} actual JSON values:`);
      console.log('     Surface:', backgrounds[firstTheme][bg13]?.Surfaces?.Surface?.value);
      console.log('     Surface-Dim:', backgrounds[firstTheme][bg13]?.Surfaces?.['Surface-Dim']?.value);
      console.log('     Surface-Bright:', backgrounds[firstTheme][bg13]?.Surfaces?.['Surface-Bright']?.value);
    }
  }
  
  // Helper function to recursively process background objects
  // Skip 'Surfaces' and 'Containers' intermediate levels
  const processBackgroundObject = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a 'value' property, it's a token - generate CSS variable
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `${prefix}-${key}`;
        const cssValue = tokenToVar(value.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
      // If the key is 'Surfaces' or 'Containers', skip it and process children directly
      else if (key === 'Surfaces' || key === 'Containers') {
        processBackgroundObject(value, prefix);
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        processBackgroundObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Check structure: Do we have theme-based (Backgrounds.Primary) or flat (Backgrounds.Background-1)?
  const firstKey = Object.keys(backgrounds)[0];
  const hasThemeStructure = firstKey && ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'].includes(firstKey);
  
  console.log('  First key:', firstKey);
  console.log('  Has theme structure?', hasThemeStructure);
  
  if (hasThemeStructure) {
    console.log('  ✅ Generating THEME-BASED background variables');
    // THEME-BASED STRUCTURE: Backgrounds.Primary.Background-1.Surfaces.Surface
    const themes = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
    
    themes.forEach((theme, themeIndex) => {
      // CRITICAL SAFETY CHECK: Never process "Default" or "BW" as themes
      if (theme === 'Default' || theme === 'BW') {
        console.warn(`⚠️ [CSS Export] Skipping invalid theme name "${theme}" in Backgrounds`);
        return;
      }
      
      // Check if this theme exists in Backgrounds
      if (!backgrounds[theme]) return;
      
      console.log(`    Processing theme: ${theme}`);
      
      if (themeIndex > 0) lines.push('');
      lines.push(`  /* ${theme} */`);
      
      // Get all background keys for this theme (Background-1 through Background-14, Background-Vibrant)
      const backgroundKeys = Object.keys(backgrounds[theme]).sort((a, b) => {
        // Sort numerically: Background-1, Background-2, ... Background-14, Background-Vibrant
        const aNum = parseInt(a.replace('Background-', ''));
        const bNum = parseInt(b.replace('Background-', ''));
        if (isNaN(aNum)) return 1;
        if (isNaN(bNum)) return -1;
        return aNum - bNum;
      });
      
      console.log(`      Found ${backgroundKeys.length} backgrounds for ${theme}`);
      
      // Process each background for this theme
      backgroundKeys.forEach(backgroundKey => {
        const backgroundData = backgrounds[theme][backgroundKey];
        if (backgroundData && typeof backgroundData === 'object') {
          lines.push(`  /* ${backgroundKey} */`);
          
          // DEBUG: Log Tertiary backgrounds specifically
          if (theme === 'Tertiary') {
            console.log(`      [TERTIARY DEBUG] ${backgroundKey}:`, {
              hasSurfaces: !!backgroundData.Surfaces,
              Surface: backgroundData.Surfaces?.Surface?.value,
              'Surface-Dim': backgroundData.Surfaces?.['Surface-Dim']?.value,
              'Surface-Bright': backgroundData.Surfaces?.['Surface-Bright']?.value
            });
          }
          
          // DEBUG: Log Container values for Primary specifically
          if (theme === 'Primary' && backgroundKey === 'Background-11') {
            console.log(`      [PRIMARY DEBUG] ${backgroundKey} Containers:`, {
              hasContainers: !!backgroundData.Containers,
              Container: backgroundData.Containers?.Container?.value,
              'Container-Low': backgroundData.Containers?.['Container-Low']?.value,
              'Container-Lowest': backgroundData.Containers?.['Container-Lowest']?.value,
              'Container-High': backgroundData.Containers?.['Container-High']?.value,
              'Container-Highest': backgroundData.Containers?.['Container-Highest']?.value
            });
          }
          
          // Process the background data - Generate --Primary-Background-9-Surface (skips Surfaces/Containers levels)
          processBackgroundObject(backgroundData, `--${theme}-${backgroundKey}`);
        }
      });
    });
    
    console.log(`  ✅ Generated ${lines.length} lines of CSS for theme-based backgrounds`);
  } else {
    console.log('  ⚠️  Generating FLAT background variables (legacy structure)');
    // FLAT STRUCTURE: Backgrounds.Background-1.Surface
    // Get all background keys (Background-1 through Background-14, Background-Vibrant)
    const backgroundKeys = Object.keys(backgrounds).filter(key => {
      // CRITICAL SAFETY CHECK: Skip "Default" and "BW" keys
      if (key === 'Default' || key === 'BW') {
        console.warn(`⚠️ [CSS Export] Skipping invalid background name "${key}" in Backgrounds (flat structure)`);
        return false;
      }
      return true;
    }).sort((a, b) => {
      // Sort numerically: Background-1, Background-2, ... Background-14, Background-Vibrant
      const aNum = parseInt(a.replace('Background-', ''));
      const bNum = parseInt(b.replace('Background-', ''));
      if (isNaN(aNum)) return 1;
      if (isNaN(bNum)) return -1;
      return aNum - bNum;
    });
    
    // Process each background
    backgroundKeys.forEach(backgroundKey => {
      const backgroundData = backgrounds[backgroundKey];
      if (backgroundData && typeof backgroundData === 'object') {
        lines.push(`  /* ${backgroundKey} */`);
        // Process the background data - generate variables like --Background-1-Surface (no Backgrounds prefix)
        processBackgroundObject(backgroundData, `--${backgroundKey}`);
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Buttons section
 * Structure: Buttons.{ButtonType}.{Shade}.{Property}
 * Example: Buttons.Primary.Light.Button → --Buttons-Primary-Light-Button
 */
function generateButtonsVariables(modeData: any): string {
  if (!modeData || !modeData.Buttons) return '';
  
  const lines: string[] = [];
  const buttons = modeData.Buttons;
  
  console.log('🔘 [generateButtonsVariables] Processing Buttons');
  console.log('  Button types:', Object.keys(buttons));
  
  // Helper: resolve Hover/Pressed to hex, everything else via tokenToVar
  const colorsData = modeData.Colors;
  const processButtonObject = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `${prefix}-${key}`;
        if ((key === 'Hover' || key === 'Pressed') && colorsData) {
          const hex = resolveHoverActiveToken(value.value, colorsData);
          if (hex) { lines.push(`  ${cssVarName}: ${hex};`); return; }
        }
        lines.push(`  ${cssVarName}: ${tokenToVar(value.value)};`);
      } else if (value && typeof value === 'object') {
        processButtonObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process each button type (Default, Primary, Secondary, etc.)
  const buttonTypes = Object.keys(buttons);
  
  buttonTypes.forEach((buttonType, index) => {
    const buttonData = buttons[buttonType];
    
    // Add spacing between button types
    if (index > 0) lines.push('');
    lines.push(`  /* Buttons ${buttonType} */`);
    
    // Process Light and Medium shades directly (no Surfaces/Containers nesting)
    // Structure: Buttons.{ButtonType}.{Shade}.{Property}
    // Example: Buttons.Primary.Light.Button → --Buttons-Primary-Light-Button
    processButtonObject(buttonData, `--Buttons-${buttonType}`);
  });
  
  console.log(`  Generated ${lines.length} CSS variable lines`);
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Default-Button section
 * Converts Default-Button tokens which reference the Buttons section
 * Structure: Default-Button.{ButtonType}.{Shade}.{Property}
 * Example: Default-Button.Primary.Light.Button → --Default-Button-Primary-Light-Button
 */
function generateDefaultButtonVariables(modeData: any): string {
  if (!modeData || !modeData['Default-Button']) return '';
  
  const lines: string[] = [];
  const defaultButton = modeData['Default-Button'];
  
  console.log('🔘 [generateDefaultButtonVariables] Processing Default-Button');
  console.log('  Button types:', Object.keys(defaultButton));
  
  // Helper function to process button objects recursively
  // Resolve Hover/Pressed through the Buttons reference chain to hex
  const defColorsData = modeData.Colors;
  const defButtonsData = modeData.Buttons;
  const processDefaultButtonObject = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `${prefix}-${key}`;
        if ((key === 'Hover' || key === 'Pressed') && defColorsData && defButtonsData) {
          const refPath = value.value.replace(/[{}]/g, '').split('.');
          if (refPath[0] === 'Buttons' && refPath.length === 4) {
            const innerToken = defButtonsData?.[refPath[1]]?.[refPath[2]]?.[refPath[3]]?.value;
            if (innerToken) {
              const hex = resolveHoverActiveToken(innerToken, defColorsData);
              if (hex) { lines.push(`  ${cssVarName}: ${hex};`); return; }
            }
          }
        }
        lines.push(`  ${cssVarName}: ${tokenToVar(value.value)};`);
      } else if (value && typeof value === 'object') {
        processDefaultButtonObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process each button type (Default, Primary, Secondary, Tertiary, Neutral, Info, Success, Warning, Error)
  const buttonTypes = Object.keys(defaultButton);
  
  buttonTypes.forEach((buttonType, index) => {
    const buttonData = defaultButton[buttonType];
    
    // Add spacing between button types
    if (index > 0) lines.push('');
    lines.push(`  /* Default-Button ${buttonType} */`);
    
    // Process Light and Medium shades
    processDefaultButtonObject(buttonData, `--Default-Button-${buttonType}`);
  });
  
  console.log(`  Generated ${lines.length} CSS variable lines for Default-Button`);
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Default-Button-Border section
 * Structure: Default-Button-Border.{Surfaces|Containers}.{ThemeType}.{ColorN}
 * Example: Default-Button-Border.Surfaces.Primary.Color-7 → --Default-Button-Border-Surfaces-Primary-Color-7
 */
function generateDefaultButtonBorderVariables(modeData: any): string {
  if (!modeData || !modeData['Default-Button-Border']) return '';
  
  const lines: string[] = [];
  const borders = modeData['Default-Button-Border'];
  
  console.log('🔘 [generateDefaultButtonBorderVariables] Processing Default-Button-Border');
  console.log('  Sections:', Object.keys(borders));
  
  // Helper function to process border objects recursively
  const processBordersObject = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a 'value' property, it's a token - generate CSS variable
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `${prefix}-${key}`;
        const cssValue = tokenToVar(value.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        processBordersObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process Surfaces and Containers
  ['Surfaces', 'Containers'].forEach(section => {
    if (borders[section]) {
      lines.push(`  /* Default-Button-Border ${section} */`);
      processBordersObject(borders[section], `--Default-Button-Border-${section}`);
      lines.push('');
    }
  });
  
  console.log(`  Generated ${lines.length} CSS variable lines for Default-Button-Border`);
  
  return lines.join('\n');
}

/**
 * DEPRECATED (2026-02-27): Theme variants are now in base.css only
 * This function is no longer used - themes are generated by generateThemeDataAttributesCSS()
 * 
 * Old purpose: Generate CSS variables for Theme section from top-level Themes structure
 * Created --Theme-{Palette}-{Tone}-* variables for all palette/tone combinations
 */
function generateThemeFromTopLevel(fullJsonData: any): string {
  // DISABLED: Theme variants now only appear in base.css, not in mode CSS files
  return '';
}

/**
 * Helper function to convert tone value (e.g., 71) to color number (e.g., 11)
 */
function toneToColorNumber(tone: number): number {
  // 12-TONE SYSTEM (must mirror TONE_SCALE in src/utils/colorScale.ts):
  //   [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99]
  //    1   2   3   4   5   6   7   8   9  10  11  12
  const toneScale = [1, 10, 19, 28, 37, 58, 71, 81, 90, 95, 98, 99];

  const exactIndex = toneScale.findIndex(t => Math.abs(t - tone) < 0.1);
  if (exactIndex !== -1) return exactIndex + 1;

  let closestIndex = 0;
  let minDiff = Math.abs(toneScale[0] - tone);
  for (let i = 1; i < toneScale.length; i++) {
    const diff = Math.abs(toneScale[i] - tone);
    if (diff < minDiff) { minDiff = diff; closestIndex = i; }
  }
  return closestIndex + 1;
}

/**
 * Generate CSS variables for Theme section (inside :root)
 * Creates theme variant variables with palette and tone combinations
 * Maps to Background variables based on palette and tone
 */
function generateThemeCSS(modeData: any, fullJsonData?: any): string {
  // ALWAYS use dynamic generation to ensure correct Background references
  // DO NOT use fullJsonData.Themes directly as it may have outdated references
  
  const lines: string[] = [];
  
  // Extract tones from Metadata section if available
  const extractedTones = fullJsonData?.Metadata?.['Extracted-Tones'];
  const primaryColorNum = extractedTones?.Primary?.value 
    ? toneToColorNumber(extractedTones.Primary.value) 
    : 11;
  const secondaryColorNum = extractedTones?.Secondary?.value 
    ? toneToColorNumber(extractedTones.Secondary.value) 
    : 11;
  const tertiaryColorNum = extractedTones?.Tertiary?.value 
    ? toneToColorNumber(extractedTones.Tertiary.value) 
    : 11;
  
  console.log('🔍 [generateThemeCSS] Extracted tones:', extractedTones);
  console.log('  ├─ Primary: tone', extractedTones?.Primary?.value, '→ Color-' + primaryColorNum);
  console.log('  ├─ Secondary: tone', extractedTones?.Secondary?.value, '→ Color-' + secondaryColorNum);
  console.log('  └─ Tertiary: tone', extractedTones?.Tertiary?.value, '→ Color-' + tertiaryColorNum);
  
  // Define the mapping of palette+tone → background number
  const toneMapping: { [key: string]: { [tone: string]: string } } = {
    'Default': { 'Base': '11', 'Light': '12', 'Medium': '6', 'Dark': '1' },
    'Neutral': { 'Base': '11', 'Light': '12', 'Medium': '6', 'Dark': '3' },
    'Primary': { 'Base': String(primaryColorNum), 'Light': '12', 'Medium': '6', 'Dark': '3' },
    'Secondary': { 'Base': String(secondaryColorNum), 'Light': '12', 'Medium': '6', 'Dark': '3' },
    'Tertiary': { 'Base': String(tertiaryColorNum), 'Light': '12', 'Medium': '6', 'Dark': '3' }
  };
  
  // Properties to generate for Surfaces and Containers
  const surfaceProps = [
    'Surface', 'Surface-Dim', 'Surface-Bright', 'Header', 'Text', 'Quiet',
    'Border', 'Border-Variant', 'Hotlink', 'Hotlink-Visited', 'Hover', 'Pressed', 'Focus-Visible'
  ];
  
  const containerProps = [
    'Container', 'Container-Lowest', 'Container-Low', 'Container-High', 'Container-Highest',
    'Header', 'Text', 'Quiet', 'Border', 'Border-Variant', 
    'Hotlink', 'Hotlink-Visited', 'Hover', 'Pressed', 'Focus-Visible'
  ];
  
  // Button types
  const buttonTypes = ['Primary', 'Primary-Light', 'Secondary', 'Secondary-Light', 'Tertiary', 'Tertiary-Light', 'Neutral', 'Neutral-Light', 'Info', 'Info-Light', 'Success', 'Success-Light', 'Warning', 'Warning-Light', 'Error', 'Error-Light'];
  const buttonProps = ['Button', 'Text', 'Border', 'Hover', 'Pressed', 'Highlight', 'Lowlight'];
  
  // Icon types
  const iconTypes = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
  const iconVariants = ['', '-Variant']; // Creates "Default" and "Default-Variant"
  
  // Tag types
  const tagTypes = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'];
  const tagProps = ['BG', 'Text'];
  
  // Generate Theme variables for each palette and tone combination
  const palettes = ['Default', 'Neutral', 'Primary', 'Secondary', 'Tertiary'];
  const tones = ['Base', 'Light', 'Medium', 'Dark'];
  
  palettes.forEach((palette) => {
    tones.forEach((tone) => {
      const bgNum = toneMapping[palette]?.[tone];
      if (!bgNum) return;
      
      const paletteForBg = palette === 'Default' ? 'Primary' : palette;
      
      // Add spacing
      if (lines.length > 0) lines.push('');
      lines.push(`  /* Theme ${palette} ${tone} */`);
      
      // Generate Surfaces properties
      // Secondary uses Buttons-Surfaces pattern for base properties, others use Background pattern
      surfaceProps.forEach(prop => {
        const varName = `--Theme-${palette}-${tone}-Surfaces-${prop}`;
        let bgRef;
        if (palette === 'Secondary') {
          bgRef = `var(--Buttons-Surfaces-Background-${bgNum}-${prop})`;
        } else {
          bgRef = `var(--${paletteForBg}-Background-${bgNum}-${prop})`;
        }
        lines.push(`  ${varName}: ${bgRef};`);
      });
      
      // Generate Surfaces Buttons
      // All palettes use Primary-Buttons-Surfaces-Background-{N} pattern
      buttonTypes.forEach(btnType => {
        buttonProps.forEach(btnProp => {
          const varName = `--Theme-${palette}-${tone}-Surfaces-Buttons-${btnType}-${btnProp}`;
          let bgRef;
          // Special handling for Primary Border - use Border section instead
          if (btnType === 'Primary' && btnProp === 'Border') {
            bgRef = `var(--Border-Surfaces-Primary-Color-${bgNum})`;
          } else {
            bgRef = `var(--Primary-Buttons-Surfaces-Background-${bgNum}-${btnType}-${btnProp})`;
          }
          lines.push(`  ${varName}: ${bgRef};`);
        });
      });
      
      // Generate Surfaces Icons
      iconTypes.forEach(iconType => {
        iconVariants.forEach(variant => {
          const varName = `--Theme-${palette}-${tone}-Surfaces-Icons-${iconType}${variant}`;
          // Icons always use Color-9, not Background-{N}
          const iconPrefix = variant === '-Variant' ? 'Icon-Variant' : 'Icon';
          // Map "Default" icon type to "Neutral" since Default icons use Neutral palette
          const iconTypeForRef = iconType === 'Default' ? 'Neutral' : iconType;
          const bgRef = `var(--${iconPrefix}-Surfaces-${iconTypeForRef}-Color-9)`;
          lines.push(`  ${varName}: ${bgRef};`);
        });
      });
      
      // Generate Surfaces Tags
      tagTypes.forEach(tagType => {
        tagProps.forEach(tagProp => {
          const varName = `--Theme-${palette}-${tone}-Surfaces-Tags-${tagType}-${tagProp}`;
          const bgRef = `var(--Surfaces-Tags-${tagType}-${tagProp})`;
          lines.push(`  ${varName}: ${bgRef};`);
        });
      });
      
      // Generate Containers properties
      containerProps.forEach(prop => {
        const varName = `--Theme-${palette}-${tone}-Containers-${prop}`;
        const bgRef = `var(--${paletteForBg}-Background-${bgNum}-${prop})`;
        lines.push(`  ${varName}: ${bgRef};`);
      });
      
      // Generate Containers Buttons
      buttonTypes.forEach(btnType => {
        buttonProps.forEach(btnProp => {
          const varName = `--Theme-${palette}-${tone}-Containers-Buttons-${btnType}-${btnProp}`;
          let bgRef;
          // Special handling for Primary Border - use Border section instead
          if (btnType === 'Primary' && btnProp === 'Border') {
            bgRef = `var(--Border-Containers-Primary-Color-${bgNum})`;
          } else {
            bgRef = `var(--Primary-Buttons-Containers-Background-${bgNum}-${btnType}-${btnProp})`;
          }
          lines.push(`  ${varName}: ${bgRef};`);
        });
      });
      
      // Generate Containers Icons
      iconTypes.forEach(iconType => {
        iconVariants.forEach(variant => {
          const varName = `--Theme-${palette}-${tone}-Containers-Icons-${iconType}${variant}`;
          // Icons always use Color-9, not Background-{N}
          const iconPrefix = variant === '-Variant' ? 'Icon-Variant' : 'Icon';
          // Map "Default" icon type to "Neutral" since Default icons use Neutral palette
          const iconTypeForRef = iconType === 'Default' ? 'Neutral' : iconType;
          const bgRef = `var(--${iconPrefix}-Containers-${iconTypeForRef}-Color-9)`;
          lines.push(`  ${varName}: ${bgRef};`);
        });
      });
      
      // Generate Containers Tags
      tagTypes.forEach(tagType => {
        tagProps.forEach(tagProp => {
          const varName = `--Theme-${palette}-${tone}-Containers-Tags-${tagType}-${tagProp}`;
          const bgRef = `var(--Containers-Tags-${tagType}-${tagProp})`;
          lines.push(`  ${varName}: ${bgRef};`);
        });
      });
    });
  });
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for top-level Themes structure (inside :root)
 * Creates --Base-*, --Light-*, etc. variables from Themes.Default
 */
function generateThemesCSS(fullJsonData: any): string {
  if (!fullJsonData || !fullJsonData.Themes || !fullJsonData.Themes.Default) return '';
  
  const lines: string[] = [];
  const defaultThemes = fullJsonData.Themes.Default;
  
  // Helper function to recursively process theme data and generate CSS variables
  // Skip 'Colors' intermediate level
  const processThemeData = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a 'value' property, it's a token - generate CSS variable
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `--${prefix}-${key}`;
        // Convert token references to CSS var() references
        const cssValue = tokenToVar(value.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
      // If the key is 'Colors', skip it and process children directly
      else if (key === 'Colors') {
        processThemeData(value, prefix);
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        processThemeData(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process each theme variant: Base, Light, Medium, Dark
  const themeVariants = ['Base', 'Light', 'Medium', 'Dark'];
  
  themeVariants.forEach((themeName, index) => {
    if (defaultThemes[themeName]) {
      if (index > 0) lines.push(''); // Add spacing between variants
      lines.push(`  /* ${themeName} */`);
      processThemeData(defaultThemes[themeName], themeName);
    }
  });
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Tones section (inside :root)
 * Creates tone variant variables that reference Themes.Default.{tone} from top-level JSON
 */
function generateTonesCSS(fullJsonData: any): string {
  if (!fullJsonData || !fullJsonData.Themes || !fullJsonData.Themes.Default) return '';
  
  const lines: string[] = [];
  const defaultThemes = fullJsonData.Themes.Default;
  
  // Helper function to recursively process tone data and generate CSS variables
  const processToneData = (obj: any, prefix: string) => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a 'value' property, it's a token - generate CSS variable
      if (value && typeof value === 'object' && value.value !== undefined) {
        const cssVarName = `--${prefix}-${key}`;
        // The value in Tones references Themes paths, so we convert those to CSS variables
        const ref = value.value;
        if (ref && typeof ref === 'string' && ref.startsWith('{Themes.')) {
          // Convert {Themes.Base.Surfaces.Surface} to --Base-Surfaces-Surface
          const cssRef = ref.replace(/\{Themes\./g, '--').replace(/\./g, '-').replace(/\}/g, '');
          lines.push(`  ${cssVarName}: var(${cssRef});`);
        } else {
          lines.push(`  ${cssVarName}: ${value.value};`);
        }
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        processToneData(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process each tone variant: Base, Light, Medium, Dark
  const toneVariants = ['Base', 'Light', 'Medium', 'Dark'];
  
  toneVariants.forEach((toneName, index) => {
    if (defaultThemes[toneName]) {
      if (index > 0) lines.push(''); // Add spacing between variants
      lines.push(`  /* Tones ${toneName} */`);
      processToneData(defaultThemes[toneName], `Tones-${toneName}`);
    }
  });
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for a single Primary-Buttons style variant
 * Processes both Surfaces and Containers for all backgrounds
 */
function generatePrimaryButtonStyleVariables(styleData: any, indent: string = '  '): string {
  if (!styleData) return '';
  
  const lines: string[] = [];
  
  // Process Surfaces
  if (styleData.Surfaces) {
    lines.push(`${indent}/* Surfaces */`);
    
    Object.keys(styleData.Surfaces).forEach(bgName => {
      const bgButtons = styleData.Surfaces[bgName];
      
      // Check if this background has button properties directly (no Primary wrapper)
      if (bgButtons) {
        // Button
        if (bgButtons.Button && bgButtons.Button.value) {
          const cssVarName = `--Primary-Buttons-Surfaces-${bgName}-Button`;
          const cssValue = tokenToVar(bgButtons.Button.value);
          lines.push(`${indent}${cssVarName}: ${cssValue};`);
        }
        
        // Text
        if (bgButtons['Text'] && bgButtons['Text'].value) {
          const cssVarName = `--Primary-Buttons-Surfaces-${bgName}-Text`;
          const cssValue = tokenToVar(bgButtons['Text'].value);
          lines.push(`${indent}${cssVarName}: ${cssValue};`);
        }
        
        // Hover
        if (bgButtons['Hover'] && bgButtons['Hover'].value) {
          const cssVarName = `--Primary-Buttons-Surfaces-${bgName}-Hover`;
          const cssValue = tokenToVar(bgButtons['Hover'].value);
          lines.push(`${indent}${cssVarName}: ${cssValue};`);
        }
        
        // Pressed
        if (bgButtons['Pressed'] && bgButtons['Pressed'].value) {
          const cssVarName = `--Primary-Buttons-Surfaces-${bgName}-Pressed`;
          const cssValue = tokenToVar(bgButtons['Pressed'].value);
          lines.push(`${indent}${cssVarName}: ${cssValue};`);
        }
      }
    });
  }
  
  // Add spacing between Surfaces and Containers
  if (styleData.Surfaces && styleData.Containers) {
    lines.push('');
  }
  
  // Process Containers
  if (styleData.Containers) {
    lines.push(`${indent}/* Containers */`);
    
    Object.keys(styleData.Containers).forEach(bgName => {
      const bgButtons = styleData.Containers[bgName];
      
      // Check if this background has button properties directly (no Primary wrapper)
      if (bgButtons) {
        // Button
        if (bgButtons.Button && bgButtons.Button.value) {
          const cssVarName = `--Primary-Buttons-Containers-${bgName}-Button`;
          const cssValue = tokenToVar(bgButtons.Button.value);
          lines.push(`${indent}${cssVarName}: ${cssValue};`);
        }
        
        // Text
        if (bgButtons['Text'] && bgButtons['Text'].value) {
          const cssVarName = `--Primary-Buttons-Containers-${bgName}-Text`;
          const cssValue = tokenToVar(bgButtons['Text'].value);
          lines.push(`${indent}${cssVarName}: ${cssValue};`);
        }
        
        // Hover
        if (bgButtons['Hover'] && bgButtons['Hover'].value) {
          const cssVarName = `--Primary-Buttons-Containers-${bgName}-Hover`;
          const cssValue = tokenToVar(bgButtons['Hover'].value);
          lines.push(`${indent}${cssVarName}: ${cssValue};`);
        }
        
        // Pressed
        if (bgButtons['Pressed'] && bgButtons['Pressed'].value) {
          const cssVarName = `--Primary-Buttons-Containers-${bgName}-Pressed`;
          const cssValue = tokenToVar(bgButtons['Pressed'].value);
          lines.push(`${indent}${cssVarName}: ${cssValue};`);
        }
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate Primary-Buttons CSS variables for mode files (inside :root)
 * Generates all three styles: Primary-Fixed, Primary-Adaptive, Black-White
 */
function generateModePrimaryButtonsVariables(modeData: any): string {
  console.log('🔵 generateModePrimaryButtonsVariables called');
  console.log('  ├─ Has modeData:', !!modeData);
  console.log('  ├─ Has Primary-Buttons:', !!modeData?.['Primary-Buttons']);
  if (modeData?.['Primary-Buttons']) {
    console.log('  └─ Primary-Buttons keys:', Object.keys(modeData['Primary-Buttons']));
  }
  
  if (!modeData || !modeData['Primary-Buttons']) return '';
  
  const lines: string[] = [];
  const primaryButtons = modeData['Primary-Buttons'];
  const indent = '  ';
  
  // Helper function to generate variables for a specific style
  const generateStyleVars = (styleName: string, styleData: any) => {
    const varLines: string[] = [];
    
    // Special formatting for Black-White style
    const isBlackWhite = styleName === 'Black-White';
    
    // Generate Surfaces variables
    if (styleData.Surfaces) {
      Object.keys(styleData.Surfaces).forEach(bgName => {
        const bgData = styleData.Surfaces[bgName];
        // Properties are directly on bgData (Button, Text, Hover, Pressed)
        if (isBlackWhite) {
          // Black-White uses shorter format: --Black-White-Surfaces-...
          if (bgData.Button?.value) varLines.push(`${indent}--Black-White-Surfaces-${bgName}-Button: ${tokenToVar(bgData.Button.value)};`);
          if (bgData.Text?.value) varLines.push(`${indent}--Black-White-Surfaces-${bgName}-Text: ${tokenToVar(bgData.Text.value)};`);
          if (bgData.Hover?.value) varLines.push(`${indent}--Black-White-Surfaces-${bgName}-Hover: ${tokenToVar(bgData.Hover.value)};`);
          if (bgData.Pressed?.value) varLines.push(`${indent}--Black-White-Surfaces-${bgName}-Pressed: ${tokenToVar(bgData.Pressed.value)};`);
        } else {
          // Other styles use full format: --Primary-Buttons-{styleName}-Surfaces-...
          if (bgData.Button?.value) varLines.push(`${indent}--Primary-Buttons-${styleName}-Surfaces-${bgName}-Button: ${tokenToVar(bgData.Button.value)};`);
          if (bgData.Text?.value) varLines.push(`${indent}--Primary-Buttons-${styleName}-Surfaces-${bgName}-Text: ${tokenToVar(bgData.Text.value)};`);
          if (bgData.Hover?.value) varLines.push(`${indent}--Primary-Buttons-${styleName}-Surfaces-${bgName}-Hover: ${tokenToVar(bgData.Hover.value)};`);
          if (bgData.Pressed?.value) varLines.push(`${indent}--Primary-Buttons-${styleName}-Surfaces-${bgName}-Pressed: ${tokenToVar(bgData.Pressed.value)};`);
        }
      });
    }
    
    // Generate Containers variables
    if (styleData.Containers) {
      Object.keys(styleData.Containers).forEach(bgName => {
        const bgData = styleData.Containers[bgName];
        // Properties are directly on bgData (Button, Text, Hover, Pressed)
        if (isBlackWhite) {
          // Black-White uses even shorter format for Containers: --BW-Button-Containers-...
          if (bgData.Button?.value) varLines.push(`${indent}--BW-Button-Containers-${bgName}-Button: ${tokenToVar(bgData.Button.value)};`);
          if (bgData.Text?.value) varLines.push(`${indent}--BW-Button-Containers-${bgName}-Text: ${tokenToVar(bgData.Text.value)};`);
          if (bgData.Hover?.value) varLines.push(`${indent}--BW-Button-Containers-${bgName}-Hover: ${tokenToVar(bgData.Hover.value)};`);
          if (bgData.Pressed?.value) varLines.push(`${indent}--BW-Button-Containers-${bgName}-Pressed: ${tokenToVar(bgData.Pressed.value)};`);
        } else {
          // Other styles use full format: --Primary-Buttons-{styleName}-Containers-...
          if (bgData.Button?.value) varLines.push(`${indent}--Primary-Buttons-${styleName}-Containers-${bgName}-Button: ${tokenToVar(bgData.Button.value)};`);
          if (bgData.Text?.value) varLines.push(`${indent}--Primary-Buttons-${styleName}-Containers-${bgName}-Text: ${tokenToVar(bgData.Text.value)};`);
          if (bgData.Hover?.value) varLines.push(`${indent}--Primary-Buttons-${styleName}-Containers-${bgName}-Hover: ${tokenToVar(bgData.Hover.value)};`);
          if (bgData.Pressed?.value) varLines.push(`${indent}--Primary-Buttons-${styleName}-Containers-${bgName}-Pressed: ${tokenToVar(bgData.Pressed.value)};`);
        }
      });
    }
    
    return varLines;
  };
  
  // Generate Primary-Fixed style
  if (primaryButtons['Primary-Fixed']) {
    lines.push('');
    lines.push(`${indent}/* ── Primary-Fixed ── */`);
    const fixedVars = generateStyleVars('Primary-Fixed', primaryButtons['Primary-Fixed']);
    lines.push(...fixedVars);
  }
  
  // Generate Primary-Adaptive style
  if (primaryButtons['Primary-Adaptive']) {
    lines.push('');
    lines.push(`${indent}/* ── Primary-Adaptive ── */`);
    const adaptiveVars = generateStyleVars('Primary-Adaptive', primaryButtons['Primary-Adaptive']);
    lines.push(...adaptiveVars);
  }
  
  // Generate Laddered-Fixed style
  if (primaryButtons['Laddered-Fixed']) {
    lines.push('');
    lines.push(`${indent}/* ── Laddered-Fixed ── */`);
    const ladderedFixedVars = generateStyleVars('Laddered-Fixed', primaryButtons['Laddered-Fixed']);
    lines.push(...ladderedFixedVars);
  }
  
  // Generate Laddered-Adaptive style
  if (primaryButtons['Laddered-Adaptive']) {
    lines.push('');
    lines.push(`${indent}/* ── Laddered-Adaptive ── */`);
    const ladderedAdaptiveVars = generateStyleVars('Laddered-Adaptive', primaryButtons['Laddered-Adaptive']);
    lines.push(...ladderedAdaptiveVars);
  }
  
  // Generate Black-White style
  if (primaryButtons['Black-White']) {
    lines.push('');
    lines.push(`${indent}/* ── Black-White ── */`);
    const bwVars = generateStyleVars('Black-White', primaryButtons['Black-White']);
    lines.push(...bwVars);
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS for Primary-Buttons section with data attributes
 */
function generatePrimaryButtonsCSS(modeData: any): string {
  if (!modeData || !modeData['Primary-Buttons']) return '';
  
  const sections: string[] = [];
  const primaryButtons = modeData['Primary-Buttons'];
  
  // Generate Primary-Adaptive style
  if (primaryButtons['Primary-Adaptive']) {
    sections.push('[data-primary-buttons="Primary-Adaptive"] {');
    const adaptiveVars = generatePrimaryButtonStyleVariables(primaryButtons['Primary-Adaptive']);
    if (adaptiveVars) {
      sections.push(adaptiveVars);
    }
    sections.push('}');
    sections.push('');
  }
  
  // Generate Primary-Fixed style
  if (primaryButtons['Primary-Fixed']) {
    sections.push('[data-primary-buttons="Primary-Fixed"] {');
    const fixedVars = generatePrimaryButtonStyleVariables(primaryButtons['Primary-Fixed']);
    if (fixedVars) {
      sections.push(fixedVars);
    }
    sections.push('}');
    sections.push('');
  }
  
  // Generate Laddered-Fixed style
  if (primaryButtons['Laddered-Fixed']) {
    sections.push('[data-primary-buttons="Laddered-Fixed"] {');
    const ladderedFixedVars = generatePrimaryButtonStyleVariables(primaryButtons['Laddered-Fixed']);
    if (ladderedFixedVars) {
      sections.push(ladderedFixedVars);
    }
    sections.push('}');
    sections.push('');
  }
  
  // Generate Laddered-Adaptive style
  if (primaryButtons['Laddered-Adaptive']) {
    sections.push('[data-primary-buttons="Laddered-Adaptive"] {');
    const ladderedAdaptiveVars = generatePrimaryButtonStyleVariables(primaryButtons['Laddered-Adaptive']);
    if (ladderedAdaptiveVars) {
      sections.push(ladderedAdaptiveVars);
    }
    sections.push('}');
    sections.push('');
  }
  
  // Generate Black-White style
  if (primaryButtons['Black-White']) {
    sections.push('[data-primary-buttons="Black-White"] {');
    const bwVars = generatePrimaryButtonStyleVariables(primaryButtons['Black-White']);
    if (bwVars) {
      sections.push(bwVars);
    }
    sections.push('}');
    sections.push('');
  }
  
  return sections.join('\n');
}

/**
 * Generate complete CSS file content for a single mode
 */
/* NOTE: superseded by generateModeCSSFromSingleMode, which is what
   generateCSSFiles actually calls. This and its only caller,
   generateModeCSSFile, have no callers anywhere in the app — which is how the
   fullJsonData reference below rotted without anyone noticing. Kept and
   corrected rather than deleted, since generateModeCSSFile is exported; delete
   both if nothing outside this repo imports it. */
function generateModeCSS(modeName: string, modeData: any, fullJsonData?: any): string {
  const lines: string[] = [];
  const funcMarker = 'generateModeCSS_v1';
  const CHARTS_IN_MODE_CSS_V1 = true; // Marker for this function
  
  // Header comment
  lines.push(`/**`);
  lines.push(` * ${modeName} Design System Variables`);
  lines.push(` * Auto-generated from OmniDesign JSON`);
  lines.push(` * Do not edit this file directly`);
  lines.push(` */`);
  lines.push('');
  
  // Root CSS variables for this mode
  lines.push(':root {');
  
  // Colors section
  lines.push('  /* ========================================');
  lines.push('   * Color Palette Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const colorVars = generateAllColorVariables(modeData);
  if (colorVars) {
    lines.push(colorVars);
  }
  
  // Header section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Header Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const headerVarsV1 = generateHeaderVariables(modeData);
  if (headerVarsV1) {
    lines.push(headerVarsV1);
  }
  
  // Hover States section (from JSON)
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Hover States');
  lines.push('   * ======================================== */');
  lines.push('');
  const hoverVars = generateHoverVariablesFromJSON(modeData);
  if (hoverVars) {
    lines.push(hoverVars);
  }
  
  // Pressed States section (from JSON)
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Pressed States');
  lines.push('   * ======================================== */');
  lines.push('');
  const activeVars = generateActiveVariablesFromJSON(modeData);
  if (activeVars) {
    lines.push(activeVars);
  }
  
  // Focus-Visible section (from JSON)
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Focus-Visible (Surfaces & Containers)');
  lines.push('   * ======================================== */');
  lines.push('');
  const focusVisibleVars = generateFocusVisibleVariables(modeData);
  if (focusVisibleVars) {
    lines.push(focusVisibleVars);
  }
  
  // Text section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Text Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const textVars = generateAllTextVariables(modeData);
  const eyebrowVars = generateEyebrowsVariables(modeData);
  if (textVars) {
    lines.push(textVars);
  }

  // Eyebrow section — sits with Text because every value is a reference into it.
  if (eyebrowVars) {
    lines.push('');
    lines.push('  /* ========================================');
    lines.push('   * Eyebrow Color Variables');
    lines.push('   * ======================================== */');
    lines.push('');
    lines.push(eyebrowVars);
  }
  
  // Quiet section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Quiet Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const quietVarsV1 = generateQuietVariables(modeData);
  if (quietVarsV1) {
    lines.push(quietVarsV1);
  }
  
  // Border section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Border Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const borderVarsV1 = generateBorderVariables(modeData);
  if (borderVarsV1) {
    lines.push(borderVarsV1);
  }
  
  // Border-Variant section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Border-Variant Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const borderVariantVarsV1 = generateBorderVariantVariables(modeData);
  if (borderVariantVarsV1) {
    lines.push(borderVariantVarsV1);
  }
  
  // Button-Border section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Button Border Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const buttonBorderVars_v1 = generateButtonBorderVariables(modeData);
  if (buttonBorderVars_v1) {
    lines.push(buttonBorderVars_v1);
  }
  
  // Theme Colors section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Theme Colors (Primary, Secondary, Tertiary)');
  lines.push('   * ======================================== */');
  lines.push('');
  const themeColorsVars = generateThemeColorsVariables(modeData);
  if (themeColorsVars) {
    lines.push(themeColorsVars);
  }
  
  // Icons section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Icon Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const iconsVars = generateIconsVariables(modeData);
  if (iconsVars) {
    lines.push(iconsVars);
  }
  
  // Icon-Variant section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Icon-Variant Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const iconVariantVars = generateIconVariantVariables(modeData);
  if (iconVariantVars) {
    lines.push(iconVariantVars);
  }
  
  // Tags section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Tag Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const tagsVars = generateTagsVariables(modeData);
  if (tagsVars) {
    lines.push(tagsVars);
  }
  
  // Default-Button section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Default-Button Variables');
  lines.push('   * References to Buttons based on user selections');
  lines.push('   * ======================================== */');
  lines.push('');
  const defaultButtonVars = generateDefaultButtonVariables(modeData);
  if (defaultButtonVars) {
    lines.push(defaultButtonVars);
  }
  
  // Default-Button-Border section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Default-Button-Border Variables');
  lines.push('   * Border colors for default buttons on surfaces and containers');
  lines.push('   * ======================================== */');
  lines.push('');
  const defaultButtonBorderVars = generateDefaultButtonBorderVariables(modeData);
  if (defaultButtonBorderVars) {
    lines.push(defaultButtonBorderVars);
  }
  
  // Backgrounds section
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Background Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const backgroundsVars = generateBackgroundsVariables(modeData);
  if (backgroundsVars) {
    lines.push(backgroundsVars);
  }
  
  // Charts section (for generateModeCSS_v1)
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Chart Color Variables');
  lines.push('   * ======================================== */');
  lines.push('');
  const chartsVarsV1 = generateChartsVariables(modeData);
  if (chartsVarsV1) {
    lines.push(chartsVarsV1);
  }
  
  // Primary-Buttons section (MUST come before Buttons section because Buttons reference these)
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Primary Button Styles');
  lines.push('   * All three styles: Primary-Fixed, Primary-Adaptive, Black-White');
  lines.push('   * ======================================== */');
  const primaryButtonsVars = generateModePrimaryButtonsVariables(modeData);
  if (primaryButtonsVars) {
    lines.push(primaryButtonsVars);
  }
  
  // Buttons section (NEW: Now needed for mode-level button definitions)
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Buttons Section');
  lines.push('   * Base button definitions with Surfaces and Containers');
  lines.push('   * ======================================== */');
  lines.push('');
  const buttonsVars = generateButtonsVariables(modeData);
  if (buttonsVars) {
    lines.push(buttonsVars);
  }
  
  // Close root selector
  lines.push('}');
  lines.push('');
  
  // Themes section (all 30 theme variations) - OUTSIDE :root
  lines.push('/* ========================================');
  lines.push(' * Theme Data-Attribute Selectors (30 Themes)');
  lines.push(' * ======================================== */');
  lines.push('');
  const themesVars = generateThemesVariables(modeData, fullJsonData, modeName);
  if (themesVars) {
    lines.push(themesVars);
  }
  
  // NOTE: Primary-Buttons data-attribute selectors are now in base.css only
  // Removed from mode CSS to avoid duplication (2026-02-27)
  
  return lines.join('\n');
}

/**
 * Generate CSS header with design system metadata
 * Extracts name and dates from the Basics section if available
 */
function generateCSSHeader(jsonData: any): string {
  if (!jsonData || !jsonData.Basics) {
    return '/* OmniDesign - Evolve Your Prehistoric Design System Approach */\n\n';
  }
  
  const name = jsonData.Basics.Name?.value || 'My Design System';
  const dateCreated = jsonData.Basics['Date Created']?.value || '';
  const dateUpdated = jsonData.Basics['Date Updated']?.value || '';
  
  const lines = [
    '/*',
    ' * OmniDesign - Evolve Your Prehistoric Design System Approach',
    ' *',
    ` * Design System: ${name}`,
    dateCreated ? ` * Date Created: ${dateCreated}` : null,
    dateUpdated ? ` * Date Updated: ${dateUpdated}` : null,
    ' */',
    ''
  ];
  
  return lines.filter(line => line !== null).join('\n');
}

/**
 * Generate all CSS files from JSON design system
 * Returns an object with filename as key and CSS content as value
 * 
 * Handles three JSON structures:
 * 1. Single mode: { Colors: {...}, Text: {...}, Icons: {...}, ... }
 * 2. Multiple modes: { "Light-Mode-Tonal": {...}, "Light-Mode-Professional": {...}, "Dark-Mode": {...} }
 * 3. Nested modes: { Backgrounds: {...}, Modes: { "Light-Mode-Tonal": {...}, ... }, Theme: {...} }
 */
/**
 * Resolve every theme's Background/Text pair and solve its scrim.
 *
 * Reads the SAME two tokens the theme publishes, so a scrim can never protect
 * a colour the theme is not actually using. Light-Mode only: a scrim is a
 * property of the theme's own pair, and the dark pair gets its own entry from
 * the Dark-Mode tree when a consumer switches.
 */
function buildTextOverImageCSS(jsonData: any): string {
  const mode = jsonData?.Modes?.['Light-Mode'];
  const themes = mode?.Themes;
  if (!themes) return '';

  const deref = (value: any): string => {
    let v = typeof value === 'string' ? value : value?.value;
    for (let hop = 0; hop < 8 && typeof v === 'string' && v.startsWith('{'); hop++) {
      const path = v.slice(1, -1).split('.');
      let node: any = mode;
      for (const key of path) node = node?.[key];
      if (node === undefined) {
        node = jsonData;
        for (const key of path) node = node?.[key];
      }
      v = typeof node === 'string' ? node : node?.value;
    }
    return typeof v === 'string' ? v : '';
  };

  // Every foreground a themed poster can put on the scrim, with the ratio it
  // owes. Header takes 3:1 (large text); the rest are body-sized and take 4.5.
  // Solving only Text was the original defect — a poster whose title is
  // --Header and whose eyebrow is --Eyebrow got a scrim tuned for neither.
  const ROLES: { role: string; key: string; target: number }[] = [
    // --Text is in because H4-H6 use it: a poster title is --Header on H1-H3
    // and --Text below that, so the scrim has to hold whichever the consumer
    // reaches for. Header owes 3:1 (large text), Text and Eyebrow owe 4.5.
    { role: '--Text', key: 'Text', target: 4.5 },
    { role: '--Eyebrow', key: 'Eyebrow', target: 4.5 },
    { role: '--Header', key: 'Header', target: 3 },
    // --Quiet is deliberately OUT. It is the lowest-contrast text the system
    // ships and it drove the scrim to 0.87 average — near-opaque, hiding the
    // photograph — while being the one role a poster never puts on an image.
    // Body copy or a quiet caption over an image is the exceptional case and
    // should carry its own heavier scrim rather than every hero paying for it.
  ];

  const pairs: Record<string, { background: string; foregrounds: any[] }> = {};
  for (const [name, theme] of Object.entries<any>(themes)) {
    const surfaces = theme?.Surfaces;
    if (!surfaces) continue;
    const background = deref(surfaces.Background);
    if (!/^#[0-9a-f]{6}$/i.test(background)) continue;

    const foregrounds = ROLES
      .map(r => ({ role: r.role, hex: deref(surfaces[r.key]), target: r.target }))
      // An 8-digit hex carries alpha; the solver needs opaque values, and
      // translucent text over a photo is a different problem than this one.
      .filter(f => /^#[0-9a-f]{6}$/i.test(f.hex));

    if (!foregrounds.length) continue;
    pairs[name] = { background, foregrounds };
  }
  if (!Object.keys(pairs).length) return '';
  return generateTextOverImageCSS(solveThemeScrims(pairs));
}

/** How much wider a large button's minimum width is than the standard one.
 *  Mirrored in generateFigmaJSON.ts, which emits the same pair to Figma. */
const LG_BUTTON_MIN_WIDTH_OFFSET = 40;

/**
 * Button padding is TWO numbers, not three and not one.
 *
 * It used to be three, all derived from the button radius (standard radius/2,
 * small 8, large radius*2/3). Nothing selected between them by intent — they
 * drifted apart as a side effect of the radius, so a playful preset at radius
 * 100 handed a large button 67px of padding.
 *
 * Now: small and standard share one value, and LARGE has its own. A large
 * button is the one size where 8px reads cramped against the taller box.
 *
 * --Sm-Button-Padding is emitted as an alias of --Button-Padding, and
 * --Large-Button-Padding as an alias of --Lg-Button-Padding. Neither can simply
 * be dropped: the lib's Button reads them by name with NO fallback
 * (`padding: 0 var(--Sm-Button-Padding)`), a design system's CSS is frozen per
 * system in Storage, and consumers upgrade the lib on their own schedule — so
 * newly generated brand CSS meets an older Button routinely. An undefined var
 * there collapses the padding to nothing, silently.
 *
 * --Lg-Button-Padding is the canonical large name, matching Sm-/Lg- as used by
 * --Lg-Button-Min-Width, --Lg-Input-Radius and --Lg-Button-Swatch.
 * --Large-Button-Padding was the CSS's own spelling while Figma always emitted
 * Lg-; the two now agree, with the old spelling kept as the alias.
 */
const BUTTON_PADDING = 8;
const LG_BUTTON_PADDING = 16;

/**
 * `--Text-Quiet` as an alias of `--Quiet`.
 *
 * The lib reads --Text-Quiet 364 times — it is what `<Body color="quiet">` and
 * every Caption resolve — and the export emitted it ZERO times. Nine sibling
 * roles ship (--Text-Primary, --Text-Error, …); quiet was simply missing, so
 * the colour declaration was invalid at computed-value time and the text
 * silently inherited whatever was around it. Intermittent-looking, because
 * whether it read correctly depended on the ancestor it happened to sit under.
 *
 * --Quiet is the CANONICAL name and holds the literal; --Text-Quiet reads it.
 * The direction is load-bearing, exactly as with Eyebrow/Overline: pointing it
 * the other way also "cannot drift" and looks identical in a diff, but it makes
 * the back-compat name the source of truth and quietly undoes the rename.
 *
 * Emitted beside every --Quiet declaration, so the alias inherits the same
 * surface scoping and can never resolve to a different surface's value.
 */
function aliasTextQuiet(css: string): string {
  return css.replace(
    /^(\s*)--Quiet:\s*([^;]+);/gm,
    (line, indent, value) => `${line}\n${indent}--Text-Quiet: var(--Quiet, ${value.trim()});`,
  );
}

export function generateCSSFiles(jsonData: any): { [filename: string]: string } {
  const cssFiles: { [filename: string]: string } = {}; 
  
  console.log('\n\n🚨🚨🚨 ============================================');
  console.log('🚨 [generateCSSFiles] === FUNCTION CALLED ===');
  console.log('🚨🚨🚨 ============================================\n');
  
  if (!jsonData) {
    console.error('Invalid JSON data: No data provided');
    throw new Error('Invalid JSON data: No data provided');
  }
  
  // Check if this has a Modes section (structure 3)
  if (jsonData.Modes && typeof jsonData.Modes === 'object') {
    console.log('📦 Processing JSON with Modes section...');
    console.log('📊 Available modes:', Object.keys(jsonData.Modes).join(', '));
    
    const modes = ['Light-Mode', 'Dark-Mode'] as const;
    
    modes.forEach(mode => {
      if (jsonData.Modes[mode]) {
        console.log(`🔨 Generating CSS for ${mode}...`);
        console.log(`  ├─ Mode has: ${Object.keys(jsonData.Modes[mode]).join(', ')}`);
        
        // Merge top-level sections with mode-specific data
        // Mode-specific data takes precedence
        const mergedData = {
          ...jsonData,  // Include top-level Backgrounds, Charts, etc.
          ...jsonData.Modes[mode]  // Override with mode-specific Colors, Text, Icons, Tags
        };
        
        const css = generateModeCSSFromSingleMode(mergedData, mode, jsonData);
        // Validate and clean CSS before adding to output
        let validatedCSS = css.split('\n').map(line => validateCSSLine(line)).join('\n');
        // Dark mode: apply a 30% black overlay to every <img>. brightness(0.7)
        // is mathematically equivalent to compositing a #0000004D layer on top
        // of fully-opaque pixels (each channel multiplied by 0.7), and unlike
        // a literal ::after overlay it works on replaced elements directly.
        // The token --Image-Overlay-Color-1 still ships #0000004D for consumers
        // who'd rather use a literal overlay layer themselves.
        if (mode === 'Dark-Mode') {
          validatedCSS += `

/* Dark-mode image treatment — 30% black overlay applied via filter so it
   works on plain <img> tags without requiring a wrapper element. */
img {
  filter: brightness(0.7);
}
`;
        }
        cssFiles[`${mode}.css`] = validatedCSS;
        console.log(`✅ Generated ${mode}.css (${css.split('\n').length} lines)`);
      } else {
        console.warn(`⚠️ Mode "${mode}" not found in Modes section`);
      }
    });
    
    // Generate base.css with Charts, Effect, Surfaces, Containers
    console.log('🔨 Generating base.css...');
    const baseCSS = generateBaseCSS(jsonData);
    // Validate and clean CSS before adding to output
    const validatedBaseCSS = baseCSS.split('\n').map(line => validateCSSLine(line)).join('\n');
    cssFiles['base.css'] = validatedBaseCSS;
    console.log(`✅ Generated base.css (${baseCSS.split('\n').length} lines)`);

    // Text-over-image scrims — one per theme, solved for the worst possible
    // image. See generateTextOverImage.ts for why this needs no image.
    const scrimCSS = buildTextOverImageCSS(jsonData);
    if (scrimCSS) {
      cssFiles['text-over-image.css'] = scrimCSS;
      console.log('✅ Generated text-over-image.css');
    }

    // Every sheet gets the alias, so a consumer that loads only one still resolves.
  for (const name of Object.keys(cssFiles)) {
    if (name.endsWith('.css')) cssFiles[name] = aliasTextQuiet(cssFiles[name]);
  }

  return cssFiles;
  }
  
  // Check if this is a multi-mode structure (has mode names as keys) (structure 2)
  const hasMultipleModes = 
    jsonData['Light-Mode'] || 
    jsonData['Dark-Mode'] ||
    jsonData.Modes?.['Light-Mode'] ||
    jsonData.Modes?.['Dark-Mode'];
  
  if (hasMultipleModes) {
    // Multiple modes structure
    console.log('📦 Processing multi-mode JSON structure...');
    const modes = ['Light-Mode', 'Dark-Mode'] as const;
    
    // Check if modes are nested under Modes key or at top level
    const modesData = jsonData.Modes || jsonData;
    
    console.log('🔍 [generateCSSFiles] modesData keys:', Object.keys(modesData));
    console.log('🔍 [generateCSSFiles] modesData is jsonData.Modes?', modesData === jsonData.Modes);
    
    modes.forEach(mode => {
      if (modesData[mode]) {
        console.log(`\n🎨 [generateCSSFiles] === Generating ${mode}.css ===`);
        console.log(`  ├─ modeData has Colors:`, !!modesData[mode].Colors);
        console.log(`  ├─ modeData has Themes:`, !!modesData[mode].Themes);
        if (modesData[mode].Colors?.Primary) {
          console.log(`  ├─ Primary Color-1:`, modesData[mode].Colors.Primary['Color-1']?.value);
          console.log(`  ├─ Primary Color-8:`, modesData[mode].Colors.Primary['Color-8']?.value);
          console.log(`  └─ Primary Color-14:`, modesData[mode].Colors.Primary['Color-14']?.value);
        }
        
        const css = generateModeCSSFromSingleMode(modesData[mode], mode, jsonData);
        // Validate and clean CSS before adding to output
        const validatedCSS = css.split('\n').map(line => validateCSSLine(line)).join('\n');
        cssFiles[`${mode}.css`] = validatedCSS;
        console.log(`✅ Generated ${mode}.css (${css.split('\n').length} lines)`);
      }
    });
  } else {
    // Single mode structure - generate one CSS file (structure 1)
    console.log('📦 Processing single-mode JSON structure...');
    console.log('📊 Top-level keys found:', Object.keys(jsonData).join(', '));
    
    // Generate CSS using the single mode data
    // Generate Light-Mode.css
    const css = generateModeCSSFromSingleMode(jsonData, 'Light-Mode', jsonData);
    // Validate and clean CSS before adding to output
    const validatedCSS = css.split('\n').map(line => validateCSSLine(line)).join('\n');
    cssFiles['Light-Mode.css'] = validatedCSS;
    
    // Also create Dark-Mode.css (same content for single-mode structure)
    cssFiles['Dark-Mode.css'] = validatedCSS;
    
    console.log(`✅ Generated CSS files from single-mode structure (${css.split('\n').length} lines each)`);
  }
  
  return cssFiles;
}

/**
 * Generate CSS variables for Focus-Visible section from JSON
 * Converts Focus-Visible.Surfaces and Focus-Visible.Containers to CSS variables
 */
function generateFocusVisibleVariables(modeData: any): string {
  if (!modeData || !modeData['Focus-Visible']) return '';
  
  const lines: string[] = [];
  const focusVisible = modeData['Focus-Visible'];
  
  // Process Surfaces
  if (focusVisible.Surfaces) {
    lines.push('  /* Focus-Visible Surfaces */');
    Object.keys(focusVisible.Surfaces).forEach(bgName => {
      const token = focusVisible.Surfaces[bgName];
      if (token && token.value) {
        // Convert Background-X to Color-X (e.g., Background-1 → Color-1)
        const colorName = bgName.replace('Background-', 'Color-');
        const cssVarName = `--Focus-Visible-Surfaces-${colorName}`;
        const cssValue = tokenToVar(token.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
    });
    lines.push('');
  }
  
  // Process Containers
  if (focusVisible.Containers) {
    lines.push('  /* Focus-Visible Containers */');
    Object.keys(focusVisible.Containers).forEach(bgName => {
      const token = focusVisible.Containers[bgName];
      if (token && token.value) {
        // Convert Background-X to Color-X (e.g., Background-1 → Color-1)
        const colorName = bgName.replace('Background-', 'Color-');
        const cssVarName = `--Focus-Visible-Containers-${colorName}`;
        const cssValue = tokenToVar(token.value);
        lines.push(`  ${cssVarName}: ${cssValue};`);
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Helper function to generate CSS from a single mode's data
 * Optimized: Only outputs Color palettes + Theme selectors with resolved Color vars
 */
function generateModeCSSFromSingleMode(modeData: any, modeName: string, fullJsonData?: any): string {
  const lines: string[] = [];

  console.log(`🔍 [generateModeCSSFromSingleMode] Called for mode: ${modeName}`);

  // Google Fonts imports (at the very top of the file)
  if (fullJsonData) {
    const googleFontsImports = generateGoogleFontsImports(fullJsonData);
    if (googleFontsImports) {
      lines.push(googleFontsImports);
      lines.push('');
    }
  }

  // File header with metadata if available
  if (fullJsonData && fullJsonData.Basics) {
    lines.push(generateCSSHeader(fullJsonData).trim());
    lines.push('');
  }

  // Reset body margin
  lines.push('body { margin: 0; }');
  lines.push('');

  lines.push(`/* ========================================`);
  lines.push(` * ${modeName} CSS Variables`);
  lines.push(` * Generated from OmniDesign JSON`);
  lines.push(` * Auto-generated - do not edit manually`);
  lines.push(` * ======================================== */`);
  lines.push('');

  // Root CSS variables — only Color palettes
  lines.push(':root {');
  lines.push('');

  // Colors section (the only :root variables needed)
  lines.push('  /* ========================================');
  lines.push('   * Color Palettes');
  lines.push('   * ======================================== */');
  lines.push('');
  const colorVars = generateAllColorVariables(modeData);
  if (colorVars) {
    lines.push(colorVars);
  }
  
  // Close root selector
  lines.push('}');
  lines.push('');
  
  // Themes section (all 30 theme variations) - OUTSIDE :root
  lines.push('/* ========================================');
  lines.push(' * Theme Data-Attribute Selectors (30 Themes)');
  lines.push(' * ======================================== */');
  lines.push('');
  const themesVarsV2 = generateThemesVariables(modeData, fullJsonData, modeName);
  if (themesVarsV2) {
    lines.push(themesVarsV2);
  }
  
  // NOTE: Primary-Buttons data-attribute selectors are now in base.css only
  // Removed from mode CSS to avoid duplication (2026-02-27)
  
  return lines.join('\n');
}

/**
 * Generate a single CSS file for a specific mode
 */
export function generateModeCSSFile(jsonData: DesignSystem, modeName: string): string | null {
  if (!jsonData || !jsonData.Modes || !jsonData.Modes[modeName]) {
    console.error(`Mode "${modeName}" not found in JSON data`);
    return null;
  }
  
  // Third argument was referenced inside generateModeCSS but never passed or
  // declared — a plain ReferenceError had anything called this. It picks the
  // Metadata block, falling back to the mode's own, so passing the whole
  // document is what was meant.
  return generateModeCSS(modeName, jsonData.Modes[modeName], jsonData);
}

/**
 * Download CSS file to user's computer
 */
export function downloadCSSFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/css' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download all CSS files as a zip (requires JSZip library)
 * For now, this downloads them individually
 */
export function downloadAllCSSFiles(jsonData: DesignSystem): void {
  const cssFiles = generateCSSFiles(jsonData);

  Object.entries(cssFiles).forEach(([filename, content]) => {
    // Small delay between downloads to avoid browser blocking
    setTimeout(() => {
      downloadCSSFile(filename, content);
    }, 100);
  });

  console.log(`�� Downloaded ${Object.keys(cssFiles).length} CSS files`);
}

/**
 * CSS files that contain per-design-system values (brand colors, fonts).
 * Regenerated on every export. Everything else in the lib's public/styles/
 * (core.css, foundation.css, styles.css, typography-tokens.css)
 * is lib-owned STATIC content that must not be overwritten.
 * See `DinoDesign/public/styles/README.md` for details.
 */
export const LIB_DYNAMIC_CSS_FILES = ['base.css', 'Light-Mode.css', 'Dark-Mode.css'] as const;

/**
 * Generate ONLY the dynamic CSS files — for syncing into the lib repo.
 * Use this when updating @dynodesign/components/public/styles/ to avoid
 * clobbering the static lib-owned files.
 */
export function generateLibSyncCSSFiles(jsonData: DesignSystem): { [filename: string]: string } {
  const all = generateCSSFiles(jsonData);
  const sync: { [filename: string]: string } = {};
  for (const name of LIB_DYNAMIC_CSS_FILES) {
    if (all[name]) sync[name] = all[name];
  }
  return sync;
}

/**
 * Download only the dynamic CSS files (base.css, Light-Mode.css, Dark-Mode.css).
 * Use this when you want to drop fresh CSS into the lib without overwriting
 * the static lib-owned files (core, foundation, foundations, styles,
 * typography-tokens).
 */
export function downloadLibSyncCSSFiles(jsonData: DesignSystem): void {
  const sync = generateLibSyncCSSFiles(jsonData);
  Object.entries(sync).forEach(([filename, content], i) => {
    setTimeout(() => downloadCSSFile(filename, content), i * 100);
  });
  console.log(`📦 Downloaded ${Object.keys(sync).length} lib-sync CSS files (dynamic only)`);
}

/**
 * Save CSS files to the styles/ directory
 * Returns the filenames that were saved
 */
export function saveCSSFilesToStyles(jsonData: DesignSystem): string[] {
  const cssFiles = generateCSSFiles(jsonData);
  const savedFiles: string[] = [];
  
  Object.entries(cssFiles).forEach(([filename, content]) => {
    try {
      // In a browser environment, we can't directly write to the filesystem
      // This would need to be done server-side or through a Figma plugin API
      // For now, we'll create a downloadable blob for each file
      const blob = new Blob([content], { type: 'text/css' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link for styles directory
      const link = document.createElement('a');
      link.href = url;
      link.download = `styles/${filename}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      savedFiles.push(filename);
    } catch (error) {
      console.error(`Failed to save ${filename}:`, error);
    }
  });
  
  console.log(`✅ Saved ${savedFiles.length} CSS files to styles/`);
  return savedFiles;
}

/**
 * Get CSS file contents as a map (for display/preview purposes)
 */
export function getCSSFilesMap(jsonData: DesignSystem): Map<string, string> {
  const cssFiles = generateCSSFiles(jsonData);
  return new Map(Object.entries(cssFiles));
}

/**
 * Convert bevel shadow details to CSS box-shadow value
 */
function bevelToBoxShadow(bevel: any): string {
  if (!bevel || !bevel['Shadow-1']) return '0px 0px 0px 0px rgba(0, 0, 0, 0.0)';
  
  const shadow1 = bevel['Shadow-1'];
  const offsetX = shadow1['offset-x']?.value || 0;
  const offsetY = shadow1['offset-y']?.value || 0;
  const blurRadius = shadow1['blur-radius']?.value || 0;
  const spreadRadius = shadow1['spread-radius']?.value || 0;
  const color = shadow1.color?.value || 'rgba(0, 0, 0, 0.0)';
  
  return `${offsetX}px ${offsetY}px ${blurRadius}px ${spreadRadius}px ${color}`;
}

/**
 * Generate CSS for Style section with data-style attribute selectors
 * Default uses [data-style], others use [data-style="StyleName"]
 */
function generateStyleCSS(jsonData: any): string {
  if (!jsonData || !jsonData.Style) return '';
  
  const lines: string[] = [];
  const style = jsonData.Style;
  
  // Helper function to generate style properties for a variant
  const generateStyleProperties = (styleData: any, indent: string = '  ') => {
    const props: string[] = [];
    
    // Bevel shadows
    if (styleData.Bevel && styleData.Bevel['Bevel-1']) {
      const bevel1Shadow1 = bevelToBoxShadow(styleData.Bevel['Bevel-1']);
      props.push(`${indent}--Shadow-1: ${bevel1Shadow1};`);
      
      // Shadow-2 if exists
      if (styleData.Bevel['Bevel-1']['Shadow-2']) {
        const shadow2 = styleData.Bevel['Bevel-1']['Shadow-2'];
        const offsetX = shadow2['offset-x']?.value || 0;
        const offsetY = shadow2['offset-y']?.value || 0;
        const blurRadius = shadow2['blur-radius']?.value || 0;
        const spreadRadius = shadow2['spread-radius']?.value || 0;
        const color = shadow2.color?.value || 'rgba(0, 0, 0, 0.0)';
        props.push(`${indent}--Shadow-2: ${offsetX}px ${offsetY}px ${blurRadius}px ${spreadRadius}px ${color};`);
      } else {
        props.push(`${indent}--Shadow-2: 0px 0px 0px 0px rgba(0, 0, 0, 0.0);`);
      }
    }
    
    // Border-Radius
    if (styleData['Border-Radius']) {
      const borderRadius = styleData['Border-Radius']['offset-x']?.value || 4;
      // Cap card-shaped radii at a 32px reference button height to keep
      // surfaces (cards, modal, thumbnails) from going stadium-shaped
      // under playful presets. Buttons themselves stay at the raw value —
      // they saturate to pill at height/2 regardless.
      const REFERENCE_BUTTON_HEIGHT = 32;
      const cappedStyle = Math.min(borderRadius, REFERENCE_BUTTON_HEIGHT);
      const cappedCard = Math.min(Math.round(borderRadius * 1.33), REFERENCE_BUTTON_HEIGHT);
      props.push(`${indent}--Button-Radius: ${borderRadius}px;`);
      props.push(`${indent}--Style-Border-Radius: ${cappedStyle}px;`);
      props.push(`${indent}--Card-Radius: ${cappedCard}px;`);
      props.push(`${indent}--Card-Padding: ${borderRadius >= 16 ? 20 : 16}px;`);
      // Button & Input tokens derived from --Button-Radius.
      props.push(`${indent}--Button-Border-Width: 1px;`);
      props.push(`${indent}--Button-Padding: ${BUTTON_PADDING}px;`);
      props.push(`${indent}--Sm-Button-Padding: var(--Button-Padding);`);
      props.push(`${indent}--Lg-Button-Padding: ${LG_BUTTON_PADDING}px;`);
      props.push(`${indent}--Large-Button-Padding: var(--Lg-Button-Padding);`);
      props.push(`${indent}--Input-Radius: ${Math.min(borderRadius, 8)}px;`);
      props.push(`${indent}--Input-Padding: ${borderRadius >= 8 ? 4 : 2}px;`);
    }
    
    // Gradient
    if (styleData.Gradient) {
      const color1Raw = styleData.Gradient['Color-1']?.value || '{Buttons.Primary.Button}';
      const color2Raw = styleData.Gradient['Color-2']?.value || '{Buttons.Primary.Button}';
      const color1 = tokenToVar(color1Raw);
      const color2 = tokenToVar(color2Raw);
      const angle = styleData.Gradient.Angle?.value || 0;
      
      props.push(`${indent}--Style-Gradient-Color-1: ${color1};`);
      props.push(`${indent}--Style-Gradient-Color-2: ${color2};`);
      props.push(`${indent}--Style-Gradient-Angle: ${angle};`);
    }
    
    return props;
  };
  
  // Generate Default style (using data-style without value)
  if (style.Default) {
    lines.push('[data-style] {');
    const defaultProps = generateStyleProperties(style.Default);
    lines.push(...defaultProps);
    lines.push('}');
    lines.push('');
  }
  
  // Generate Professional style
  if (style.Professional) {
    lines.push('[data-style="Professional"] {');
    const professionalProps = generateStyleProperties(style.Professional);
    lines.push(...professionalProps);
    lines.push('}');
    lines.push('');
  }
  
  // Generate Modern style
  if (style.Modern) {
    lines.push('[data-style="Modern"] {');
    const modernProps = generateStyleProperties(style.Modern);
    lines.push(...modernProps);
    lines.push('}');
    lines.push('');
  }
  
  // Generate Bold style
  if (style.Bold) {
    lines.push('[data-style="Bold"] {');
    const boldProps = generateStyleProperties(style.Bold);
    lines.push(...boldProps);
    lines.push('}');
    lines.push('');
  }
  
  // Generate Playful style
  if (style.Playful) {
    lines.push('[data-style="Playful"] {');
    const playfulProps = generateStyleProperties(style.Playful);
    lines.push(...playfulProps);
    lines.push('}');
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS for Spacing section
 * Includes base spacing values and data-spacing variants
 */
function generateSpacingCSS(jsonData: any): string {
  if (!jsonData || !jsonData.Spacing) return '';
  
  const lines: string[] = [];
  const spacing = jsonData.Spacing;
  
  // Base :root spacing
  lines.push(':root {');
  lines.push(`  --Multiplier: ${spacing.Multiplier?.value || '1'};`);
  lines.push(`  --Spacing-1: ${spacing['Spacing-1']?.value || '8px'};`);
  lines.push(`  --Spacing-2: ${spacing['Spacing-2']?.value || '16px'};`);
  lines.push(`  --Spacing-3: ${spacing['Spacing-3']?.value || '24px'};`);
  lines.push(`  --Spacing-4: ${spacing['Spacing-4']?.value || '32px'};`);
  lines.push(`  --Spacing-5: ${spacing['Spacing-5']?.value || '40px'};`);
  lines.push(`  --Spacing-6: ${spacing['Spacing-6']?.value || '48px'};`);
  lines.push(`  --Spacing-7: ${spacing['Spacing-7']?.value || '56px'};`);
  lines.push(`  --Spacing-8: ${spacing['Spacing-8']?.value || '64px'};`);
  lines.push(`  --Spacing-9: ${spacing['Spacing-9']?.value || '72px'};`);
  lines.push(`  --Spacing-10: ${spacing['Spacing-10']?.value || '80px'};`);
  lines.push(`  --Spacing-11: ${spacing['Spacing-11']?.value || '88px'};`);
  lines.push(`  --Spacing-12: ${spacing['Spacing-12']?.value || '96px'};`);
  lines.push(`  --Spacing-Half: ${spacing['Spacing-Half']?.value || '4px'};`);
  lines.push(`  --Spacing-Quater: ${spacing['Spacing-Quater']?.value || '2px'};`);
  lines.push('}');
  lines.push('');
  
  // Default data-spacing
  lines.push('[data-spacing] {');
  lines.push('  --Spacing-1: 8px;');
  lines.push('  --Spacing-2: 16px;');
  lines.push('  --Spacing-3: 24px;');
  lines.push('  --Spacing-4: 32px;');
  lines.push('  --Spacing-5: 40px;');
  lines.push('  --Spacing-6: 48px;');
  lines.push('  --Spacing-7: 56px;');
  lines.push('  --Spacing-8: 64px;');
  lines.push('  --Spacing-9: 72px;');
  lines.push('  --Spacing-10: 80px;');
  lines.push('  --Spacing-11: 88px;');
  lines.push('  --Spacing-12: 96px;');
  lines.push('  --Spacing-Half: 4px;');
  lines.push('  --Spacing-Quater: 2px;');
  lines.push('}');
  lines.push('');
  
  // Expanded spacing
  lines.push('[data-spacing="expanded"] {');
  lines.push('  --Spacing-1: 12px;');
  lines.push('  --Spacing-2: 24px;');
  lines.push('  --Spacing-3: 36px;');
  lines.push('  --Spacing-4: 48px;');
  lines.push('  --Spacing-5: 60px;');
  lines.push('  --Spacing-6: 72px;');
  lines.push('  --Spacing-7: 84px;');
  lines.push('  --Spacing-8: 96px;');
  lines.push('  --Spacing-9: 108px;');
  lines.push('  --Spacing-10: 120px;');
  lines.push('  --Spacing-11: 132px;');
  lines.push('  --Spacing-12: 144px;');
  lines.push('  --Spacing-Half: 6px;');
  lines.push('  --Spacing-Quater: 3px;');
  lines.push('}');
  lines.push('');
  
  // Reduced spacing
  lines.push('[data-spacing="reduced"] {');
  lines.push('  --Spacing-1: 4px;');
  lines.push('  --Spacing-2: 8px;');
  lines.push('  --Spacing-3: 12px;');
  lines.push('  --Spacing-4: 16px;');
  lines.push('  --Spacing-5: 20px;');
  lines.push('  --Spacing-6: 24px;');
  lines.push('  --Spacing-7: 28px;');
  lines.push('  --Spacing-8: 32px;');
  lines.push('  --Spacing-9: 36px;');
  lines.push('  --Spacing-10: 40px;');
  lines.push('  --Spacing-11: 44px;');
  lines.push('  --Spacing-12: 48px;');
  lines.push('  --Spacing-Half: 2px;');
  lines.push('  --Spacing-Quater: 1px;');
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate CSS for Typography section
 * Typography includes font families and weights for Header, Decorative, and Body
 * Font families are formatted with quotes and appropriate fallbacks (serif, sans-serif, cursive, fantasy)
 */
function generateTypographyCSS(jsonData: any): string {
  if (!jsonData || !jsonData.Typography) return '';
  
  const lines: string[] = [];
  const typography = jsonData.Typography;
  
  // Format font families with quotes and appropriate fallbacks
  const headerFontName = typography['Set-Font-Family-Header']?.value || 'SF Pro';
  const bodyFontName = typography['Set-Font-Family-Body']?.value || 'SF Pro';
  const decorativeFontName = typography['Set-Font-Family-Decorative']?.value || 'SF Pro';
  const congativeFontName = typography['Congative-Family-Body']?.value || 'SF Pro';
  
  const headerFont = `"${headerFontName}", sans-serif`;
  const bodyFont = `"${bodyFontName}", sans-serif`;
  const decorativeFont = `"${decorativeFontName}", serif`;
  const congativeFont = `"${congativeFontName}", sans-serif`;
  
  lines.push(':root {');
  lines.push(`  --Set-Font-Family-Body: ${bodyFont};`);
  lines.push(`  --Set-Font-Family-Header: ${headerFont};`);
  lines.push(`  --Set-Font-Family-Decorative: ${decorativeFont};`);
  lines.push(`  --Set-Header-Font-Weight: ${typography['Set-Header-Font-Weight']?.value || '600'};`);
  lines.push(`  --Set-Decorative-Font-Weight: ${typography['Set-Decorative-Font-Weight']?.value || '600'};`);
  lines.push(`  --Set-Body-Font-Weight: ${typography['Set-Body-Font-Weight']?.value || '400'};`);
  lines.push(`  --Set-Body-Semibold-Font-Weight: ${typography['Set-Body-Semibold-Font-Weight']?.value || '600'};`);
  lines.push(`  --Set-Body-Bold-Font-Weight: ${typography['Set-Body-Bold-Font-Weight']?.value || '700'};`);
  lines.push(`  --Set-Header-Caps: ${typography['Set-Header-Caps']?.value || 'none'};`);
  lines.push(`  --Set-Decorative-Caps: ${typography['Set-Decorative-Caps']?.value || 'uppercase'};`);
  lines.push(`  --Congative-Family-Body: ${congativeFont};`);
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Charts section
 * Charts use direct hex values, no var() references
 */
function generateChartsCSS(jsonData: any): string {
  if (!jsonData || !jsonData.Charts) return '';
  
  const lines: string[] = [];
  const charts = jsonData.Charts;
  
  lines.push(':root {');
  lines.push('  /* ========================================');
  lines.push('   * Chart Colors');
  lines.push('   * Direct hex values for data visualization');
  lines.push('   * ======================================== */');
  lines.push('');
  
  // Chart-BG
  if (charts['Chart-BG'] && charts['Chart-BG'].value) {
    lines.push(`  --Chart-BG: ${charts['Chart-BG'].value};`);
  }
  
  // Chart-Lines
  if (charts['Chart-Lines'] && charts['Chart-Lines'].value) {
    lines.push(`  --Chart-Lines: ${charts['Chart-Lines'].value};`);
  }
  
  lines.push('');
  lines.push('  /* Solid Chart Colors */');
  
  // Generate Solids: Chart-1 through Chart-10
  if (charts.Solids) {
    Object.keys(charts.Solids).forEach(chartKey => {
      const chartColor = charts.Solids[chartKey];
      if (chartColor && chartColor.value) {
        lines.push(`  --${chartKey}: ${chartColor.value};`);
      }
    });
  }
  
  lines.push('');
  lines.push('  /* Opaque Chart Colors (50% opacity) */');
  
  // Generate Opaque: Chart-1 through Chart-10
  if (charts.Opaque) {
    Object.keys(charts.Opaque).forEach(chartKey => {
      const chartColor = charts.Opaque[chartKey];
      if (chartColor && chartColor.value) {
        lines.push(`  --${chartKey}-Opaque: ${chartColor.value};`);
      }
    });
  }
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Effect section (inside :root)
 * Creates --Effects-Level-X variables with box-shadow values
 */
function generateEffectCSS(jsonData: any): string {
  const effect = jsonData?.Effects || jsonData?.Effect;
  if (!effect) return '';

  const lines: string[] = [];
  
  // Level-0 through Level-5
  const levels = ['Level-0', 'Level-1', 'Level-2', 'Level-3', 'Level-4', 'Level-5'];
  levels.forEach((level) => {
    if (effect[level]) {
      const shadowValue = effect[level].value || 'none';
      lines.push(`  --Effect-${level}: ${shadowValue};`);
    }
  });
  
  return lines.join('\n');
}

/**
 * Generate CSS for Surface Background Mapping
 * Maps --Background to surface types using data-surface attribute selectors
 */
function generateSurfacesContainersCSS(jsonData: any): string {
  if (!jsonData || !jsonData['SurfacesContainers']) {
    console.log('⚠️ generateSurfacesContainersCSS: No SurfacesContainers found');
    return '';
  }
  
  const lines: string[] = [];
  const surfacesContainers = jsonData['SurfacesContainers'];
  console.log('✅ generateSurfacesContainersCSS: Processing SurfacesContainers with keys:', Object.keys(surfacesContainers));
  
  lines.push('/* ========================================');
  lines.push(' * Surface Background Mapping');
  lines.push(' * Maps --Background to surface types');
  lines.push(' * ======================================== */');
  lines.push('');
  
  // Container types — map --Background to container var. Dropshadow-Color comes from theme selectors.
  const containerKeys = ['Container', 'Container-Low', 'Container-Lowest', 'Container-High', 'Container-Highest'];

  containerKeys.forEach(key => {
    lines.push(`[data-surface="${key}"] {`);
    lines.push(`  --Background: var(--${key});`);
    lines.push('}');
    lines.push('');
  });
  
  console.log(`✅ generateSurfacesContainersCSS: Generated ${lines.length} lines of CSS`);
  return lines.join('\n');
}

/**
 * Generate chart variables only (without :root wrapper)
 * For use inside a shared :root block
 */
function generateChartVariablesOnly(jsonData: any): string {
  if (!jsonData || !jsonData.Charts) return '';
  
  const lines: string[] = [];
  const charts = jsonData.Charts;
  
  // Chart-BG
  if (charts['Chart-BG'] && charts['Chart-BG'].value) {
    lines.push(`  --Chart-BG: ${charts['Chart-BG'].value};`);
  }
  
  // Chart-Lines
  if (charts['Chart-Lines'] && charts['Chart-Lines'].value) {
    lines.push(`  --Chart-Lines: ${charts['Chart-Lines'].value};`);
  }
  
  lines.push('');
  lines.push('  /* Solid Chart Colors */');
  
  // Generate Solids: Chart-1 through Chart-10
  if (charts.Solids) {
    Object.keys(charts.Solids).forEach(chartKey => {
      const chartColor = charts.Solids[chartKey];
      if (chartColor && chartColor.value) {
        lines.push(`  --${chartKey}: ${chartColor.value};`);
      }
    });
  }
  
  lines.push('');
  lines.push('  /* Opaque Chart Colors (50% opacity) */');
  
  // Generate Opaque: Chart-1 through Chart-10
  if (charts.Opaque) {
    Object.keys(charts.Opaque).forEach(chartKey => {
      const chartColor = charts.Opaque[chartKey];
      if (chartColor && chartColor.value) {
        lines.push(`  --${chartKey}-Opaque: ${chartColor.value};`);
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate typography variables only (without :root wrapper)
 * For use inside a shared :root block
 */
function generateTypographyVariablesOnly(jsonData: any): string {
  if (!jsonData || !jsonData.Typography) return '';
  
  const lines: string[] = [];
  const typography = jsonData.Typography;
  
  // Format font families with quotes and appropriate fallbacks
  const headerFont = formatFontFamily(typography['Set-Font-Family-Header']?.value || 'Open Sans');
  const bodyFont = formatFontFamily(typography['Set-Font-Family-Body']?.value || 'Open Sans');
  const decorativeFont = formatFontFamily(typography['Set-Font-Family-Decorative']?.value || 'Open Sans');
  
  lines.push(' --Set-Font-Family-Header: ' + headerFont + ';');
  lines.push(' --Set-Font-Family-Header-Weight: ' + (typography['Set-Header-Font-Weight']?.value || '400') + ';');
  lines.push(' --Set-Font-Family-Body: ' + bodyFont + ';');
  lines.push(' --Set-Font-Family-Body-Weight: ' + (typography['Set-Body-Font-Weight']?.value || '400') + ';');
  lines.push(' --Set-Font-Family-Body-Semibold-Weight: ' + (typography['Set-Body-Semibold-Font-Weight']?.value || '400') + ';');
  lines.push(' --Set-Font-Family-Body-Bold-Weight: ' + (typography['Set-Body-Bold-Font-Weight']?.value || '400') + ';');
  lines.push(' --Set-Font-Family-Decorative: ' + decorativeFont + ';');
  lines.push(' --Set-Font-Family-Decorative-Weight: ' + (typography['Set-Decorative-Font-Weight']?.value || '400') + ';');
  
  return lines.join('\n');
}

/**
 * Generate Google Fonts @import statements for all fonts in the Typography section
 * Returns @import statements for unique font families
 */
function generateGoogleFontsImports(jsonData: any): string {
  if (!jsonData || !jsonData.Typography) return '';
  
  console.log('🔤 [CSS] Generating Google Fonts imports...');
  
  const typography = jsonData.Typography;
  const fontFamilies = new Set<string>();

  /* EVERY face the design publishes, found by shape rather than by name.
   *
   * This used to read exactly three keys — Header, Body, Decorative — and
   * `Set-Font-Family-Display` was not one of them. Display happens to hold the
   * same family as Decorative today, so the missing import was invisible: the
   * face arrived under the other role's request. The moment a design gives
   * Display its own family, that family ships in the CSS with nothing fetching
   * it, and the consumer silently renders a fallback.
   *
   * Reading the keys by pattern means a face added later is imported without
   * anyone remembering to extend a list here. */
  const familyOf = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string') return undefined;
    // Values may be a bare name or a whole stack ("'Caveat', sans-serif").
    const first = raw.split(',')[0].replace(/["']/g, '').trim();
    return first || undefined;
  };
  const roleFamilies = new Map<string, string>();
  for (const key of Object.keys(typography)) {
    const m = key.match(/^Set-Font-Family-(.+)$/);
    if (!m) continue;
    const fam = familyOf(typography[key]?.value);
    if (fam) roleFamilies.set(m[1], fam);
  }

  const headerFamily = roleFamilies.get('Header');
  const bodyFamily = roleFamilies.get('Body');
  const decorativeFamily = roleFamilies.get('Decorative');

  for (const [role, fam] of roleFamilies) console.log(`  ├─ ${role} font:`, fam);

  // Collect every weight each family is actually declared at, so the Google
  // Fonts request downloads the real weight files. A family-only import ships
  // just 400, so the browser FAUX-styles Decorative 300 / Body-Semibold 600 /
  // Body-Bold 700 — they look approximately right, so nothing reports it, but
  // the weight files never arrive. Accumulate per family (a family shared across
  // roles gets all its weights).
  const familyWeights = new Map<string, Set<number>>();
  const addWeight = (family: string | undefined, weightRaw: unknown) => {
    if (!family) return;
    const w = parseInt(String(weightRaw ?? ''), 10);
    if (!Number.isFinite(w)) return;
    if (!familyWeights.has(family)) familyWeights.set(family, new Set());
    familyWeights.get(family)!.add(w);
  };
  // Every weight declared for a role lands on that role's family. Matched by
  // shape for the same reason as the families above — Body alone publishes
  // three (regular, semibold, bold) and a fourth would otherwise be missed.
  for (const [role, fam] of roleFamilies) {
    for (const key of Object.keys(typography)) {
      if (!key.endsWith('Font-Weight')) continue;
      if (key === `Set-${role}-Font-Weight` || key.startsWith(`Set-${role}-`)) {
        addWeight(fam, typography[key]?.value);
      }
    }
  }

  // Add every family; the Set dedupes roles that share one.
  for (const fam of roleFamilies.values()) fontFamilies.add(fam);
  
  // List of system fonts that shouldn't be imported from Google Fonts
  const systemFonts = [
    'Arial', 'Helvetica', 'Times New Roman', 'Times', 'Courier New', 
    'Courier', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 
    'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Impact',
    'SF Pro', 'SF Pro Display', 'SF Pro Text', '-apple-system', 'BlinkMacSystemFont',
    'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans',
    'Helvetica Neue', 'sans-serif', 'serif', 'monospace'
  ];
  
  // Generate @import statements
  const imports: string[] = [];
  fontFamilies.forEach(fontName => {
    // Skip system fonts
    if (systemFonts.includes(fontName)) {
      return;
    }
    
    // Convert font name to URL format (e.g., "Open Sans" -> "Open+Sans")
    const urlFontName = fontName.replace(/\s+/g, '+');
    // Append the declared weights so the real files load (no faux styling).
    const weights = familyWeights.get(fontName);
    const spec = weights && weights.size
      ? `${urlFontName}:wght@${[...weights].sort((a, b) => a - b).join(';')}`
      : urlFontName;
    imports.push(`@import url('https://fonts.googleapis.com/css2?family=${spec}&display=swap');`);
    console.log(`  ✓ Adding Google Fonts import for: ${fontName}${weights && weights.size ? ` @ ${[...weights].sort((a, b) => a - b).join(',')}` : ''}`);
  });
  
  if (imports.length === 0) {
    console.log('  ℹ️  No Google Fonts imports needed (all system fonts)');
  }

  // The Header face is always Google Sans Flex, and a plain family= request
  // ships only the default instance — the axes would silently do nothing. This
  // asks for the full range of every axis the design can drive.
  imports.unshift(`@import url('https://fonts.googleapis.com/css2?${headerFontQueryParam()}&display=swap');`);
  console.log(`  ✓ Adding Google Fonts import for: ${HEADER_FAMILY} (variable, all axes)`);

  return imports.join('\n');
}

/**
 * Generate Theme Mapping Variables
 * Maps Background-{Style}-Background-{Tone}-* variables to --Theme-Light-* variables
 * Detects the background style from the Theme section
 */
function generateThemeMappingVariables(jsonData: any): string {
  const lines: string[] = [];
  
  // Determine the background style from Theme.Colors section
  let backgroundStyle = 'Neutral'; // default
  let backgroundTone = '12'; // default
  
  if (jsonData.Theme && jsonData.Theme.Colors) {
    const colors = jsonData.Theme.Colors;
    // Check which background is used by examining the Surfaces.Surface token
    if (colors.Surfaces && colors.Surfaces.Surface && colors.Surfaces.Surface.value) {
      const surfaceValue = colors.Surfaces.Surface.value;
      // Extract from token like "{Backgrounds.Background-Neutral.Background-12.Surfaces.Surface}"
      const match = surfaceValue.match(/Background-([\w-]+)\.Background-(\d+)/);
      if (match) {
        backgroundStyle = match[1]; // "Neutral", "Primary", etc.
        backgroundTone = match[2]; // "12", etc.
      }
    }
  }
  
  // Generate the full prefix
  const prefix = `Background-${backgroundStyle}-Background-${backgroundTone}`;
  
  lines.push(':root {');
  lines.push('  /* Surfaces */');
  lines.push(`  --Theme-Light-Surfaces-Surface: var(--${prefix}-Surfaces-Surface);`);
  lines.push(`  --Theme-Light-Surfaces-Surface-Dim: var(--${prefix}-Surfaces-Surface-Dim);`);
  lines.push(`  --Theme-Light-Surfaces-Surface-Bright: var(--${prefix}-Surfaces-Surface-Bright);`);
  lines.push(`  --Theme-Light-Surfaces-Header: var(--${prefix}-Surfaces-Header);`);
  lines.push(`  --Theme-Light-Surfaces-Text: var(--${prefix}-Surfaces-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Quiet: var(--${prefix}-Surfaces-Quiet);`);
  lines.push(`  --Theme-Light-Surfaces-Border: var(--${prefix}-Surfaces-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Border-Variant: var(--${prefix}-Surfaces-Border-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Hotlink: var(--${prefix}-Surfaces-Hotlink);`);
  lines.push(`  --Theme-Light-Surfaces-Hotlink-Visited: var(--${prefix}-Surfaces-Hotlink-Visited);`);
  lines.push(`  --Theme-Light-Surfaces-Hover: var(--${prefix}-Surfaces-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Pressed: var(--${prefix}-Surfaces-Pressed);`);
  lines.push(`  --Theme-Light-Surfaces-Focus-Visible: var(--${prefix}-Surfaces-Focus-Visible);`);
  
  lines.push('');
  lines.push('  /* Surface Buttons */');
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Button: var(--${prefix}-Buttons-Surfaces-Primary-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Text: var(--${prefix}-Buttons-Surfaces-Primary-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Border: var(--${prefix}-Buttons-Surfaces-Primary-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Hover: var(--${prefix}-Buttons-Surfaces-Primary-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Pressed: var(--${prefix}-Buttons-Surfaces-Primary-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Light-Button: var(--${prefix}-Buttons-Surfaces-Primary-Light-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Light-Text: var(--${prefix}-Buttons-Surfaces-Primary-Light-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Light-Border: var(--${prefix}-Buttons-Surfaces-Primary-Light-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Light-Hover: var(--${prefix}-Buttons-Surfaces-Primary-Light-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Primary-Light-Pressed: var(--${prefix}-Buttons-Surfaces-Primary-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Button: var(--${prefix}-Buttons-Surfaces-Secondary-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Text: var(--${prefix}-Buttons-Surfaces-Secondary-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Border: var(--${prefix}-Buttons-Surfaces-Secondary-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Hover: var(--${prefix}-Buttons-Surfaces-Secondary-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Pressed: var(--${prefix}-Buttons-Surfaces-Secondary-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Light-Button: var(--${prefix}-Buttons-Surfaces-Secondary-Light-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Light-Text: var(--${prefix}-Buttons-Surfaces-Secondary-Light-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Light-Border: var(--${prefix}-Buttons-Surfaces-Secondary-Light-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Light-Hover: var(--${prefix}-Buttons-Surfaces-Secondary-Light-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Secondary-Light-Pressed: var(--${prefix}-Buttons-Surfaces-Secondary-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Button: var(--${prefix}-Buttons-Surfaces-Tertiary-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Text: var(--${prefix}-Buttons-Surfaces-Tertiary-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Border: var(--${prefix}-Buttons-Surfaces-Tertiary-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Hover: var(--${prefix}-Buttons-Surfaces-Tertiary-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Pressed: var(--${prefix}-Buttons-Surfaces-Tertiary-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Light-Button: var(--${prefix}-Buttons-Surfaces-Tertiary-Light-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Light-Text: var(--${prefix}-Buttons-Surfaces-Tertiary-Light-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Light-Border: var(--${prefix}-Buttons-Surfaces-Tertiary-Light-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Light-Hover: var(--${prefix}-Buttons-Surfaces-Tertiary-Light-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Tertiary-Light-Pressed: var(--${prefix}-Buttons-Surfaces-Tertiary-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Button: var(--${prefix}-Buttons-Surfaces-Neutral-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Text: var(--${prefix}-Buttons-Surfaces-Neutral-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Border: var(--${prefix}-Buttons-Surfaces-Neutral-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Hover: var(--${prefix}-Buttons-Surfaces-Neutral-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Pressed: var(--${prefix}-Buttons-Surfaces-Neutral-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Light-Button: var(--${prefix}-Buttons-Surfaces-Neutral-Light-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Light-Text: var(--${prefix}-Buttons-Surfaces-Neutral-Light-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Light-Border: var(--${prefix}-Buttons-Surfaces-Neutral-Light-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Light-Hover: var(--${prefix}-Buttons-Surfaces-Neutral-Light-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Neutral-Light-Pressed: var(--${prefix}-Buttons-Surfaces-Neutral-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Button: var(--${prefix}-Buttons-Surfaces-Info-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Text: var(--${prefix}-Buttons-Surfaces-Info-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Border: var(--${prefix}-Buttons-Surfaces-Info-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Hover: var(--${prefix}-Buttons-Surfaces-Info-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Pressed: var(--${prefix}-Buttons-Surfaces-Info-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Light-Button: var(--${prefix}-Buttons-Surfaces-Info-Light-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Light-Text: var(--${prefix}-Buttons-Surfaces-Info-Light-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Light-Border: var(--${prefix}-Buttons-Surfaces-Info-Light-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Light-Hover: var(--${prefix}-Buttons-Surfaces-Info-Light-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Info-Light-Pressed: var(--${prefix}-Buttons-Surfaces-Info-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Button: var(--${prefix}-Buttons-Surfaces-Success-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Text: var(--${prefix}-Buttons-Surfaces-Success-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Border: var(--${prefix}-Buttons-Surfaces-Success-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Hover: var(--${prefix}-Buttons-Surfaces-Success-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Pressed: var(--${prefix}-Buttons-Surfaces-Success-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Light-Button: var(--${prefix}-Buttons-Surfaces-Success-Light-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Light-Text: var(--${prefix}-Buttons-Surfaces-Success-Light-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Light-Border: var(--${prefix}-Buttons-Surfaces-Success-Light-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Light-Hover: var(--${prefix}-Buttons-Surfaces-Success-Light-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Success-Light-Pressed: var(--${prefix}-Buttons-Surfaces-Success-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Button: var(--${prefix}-Buttons-Surfaces-Warning-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Text: var(--${prefix}-Buttons-Surfaces-Warning-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Border: var(--${prefix}-Buttons-Surfaces-Warning-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Hover: var(--${prefix}-Buttons-Surfaces-Warning-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Pressed: var(--${prefix}-Buttons-Surfaces-Warning-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Light-Button: var(--${prefix}-Buttons-Surfaces-Warning-Light-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Light-Text: var(--${prefix}-Buttons-Surfaces-Warning-Light-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Light-Border: var(--${prefix}-Buttons-Surfaces-Warning-Light-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Light-Hover: var(--${prefix}-Buttons-Surfaces-Warning-Light-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Warning-Light-Pressed: var(--${prefix}-Buttons-Surfaces-Warning-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Button: var(--${prefix}-Buttons-Surfaces-Error-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Text: var(--${prefix}-Buttons-Surfaces-Error-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Border: var(--${prefix}-Buttons-Surfaces-Error-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Hover: var(--${prefix}-Buttons-Surfaces-Error-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Pressed: var(--${prefix}-Buttons-Surfaces-Error-Pressed);`);
  
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Light-Button: var(--${prefix}-Buttons-Surfaces-Error-Light-Button);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Light-Text: var(--${prefix}-Buttons-Surfaces-Error-Light-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Light-Border: var(--${prefix}-Buttons-Surfaces-Error-Light-Border);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Light-Hover: var(--${prefix}-Buttons-Surfaces-Error-Light-Hover);`);
  lines.push(`  --Theme-Light-Surfaces-Buttons-Error-Light-Pressed: var(--${prefix}-Buttons-Surfaces-Error-Light-Pressed);`);
  
  lines.push('');
  lines.push('  /* Surface Icons */');
  lines.push(`  --Theme-Light-Surfaces-Icons-Default: var(--${prefix}-Icons-Surfaces-Neutral);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Default-Variant: var(--${prefix}-Icons-Surfaces-Neutral-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Primary: var(--${prefix}-Icons-Surfaces-Primary);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Primary-Variant: var(--${prefix}-Icons-Surfaces-Primary-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Secondary: var(--${prefix}-Icons-Surfaces-Secondary);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Secondary-Variant: var(--${prefix}-Icons-Surfaces-Secondary-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Tertiary: var(--${prefix}-Icons-Surfaces-Tertiary);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Tertiary-Variant: var(--${prefix}-Icons-Surfaces-Tertiary-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Neutral: var(--${prefix}-Icons-Surfaces-Neutral);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Neutral-Variant: var(--${prefix}-Icons-Surfaces-Neutral-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Info: var(--${prefix}-Icons-Surfaces-Info);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Info-Variant: var(--${prefix}-Icons-Surfaces-Info-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Success: var(--${prefix}-Icons-Surfaces-Success);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Success-Variant: var(--${prefix}-Icons-Surfaces-Success-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Warning: var(--${prefix}-Icons-Surfaces-Warning);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Warning-Variant: var(--${prefix}-Icons-Surfaces-Warning-Variant);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Error: var(--${prefix}-Icons-Surfaces-Error);`);
  lines.push(`  --Theme-Light-Surfaces-Icons-Error-Variant: var(--${prefix}-Icons-Surfaces-Error-Variant);`);
  
  lines.push('');
  lines.push('  /* Surface Tags */');
  lines.push(`  --Theme-Light-Surfaces-Tags-Primary-BG: var(--Surfaces-Tags-Primary-BG);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Primary-Text: var(--Surfaces-Tags-Primary-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Secondary-BG: var(--Surfaces-Tags-Secondary-BG);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Secondary-Text: var(--Surfaces-Tags-Secondary-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Tertiary-BG: var(--Surfaces-Tags-Tertiary-BG);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Tertiary-Text: var(--Surfaces-Tags-Tertiary-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Neutral-BG: var(--Surfaces-Tags-Neutral-BG);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Neutral-Text: var(--Surfaces-Tags-Neutral-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Info-BG: var(--Surfaces-Tags-Info-BG);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Info-Text: var(--Surfaces-Tags-Info-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Success-BG: var(--Surfaces-Tags-Success-BG);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Success-Text: var(--Surfaces-Tags-Success-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Warning-BG: var(--Surfaces-Tags-Warning-BG);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Warning-Text: var(--Surfaces-Tags-Warning-Text);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Error-BG: var(--Surfaces-Tags-Error-BG);`);
  lines.push(`  --Theme-Light-Surfaces-Tags-Error-Text: var(--Surfaces-Tags-Error-Text);`);
  
  lines.push('');
  lines.push('  /* Containers */');
  lines.push(`  --Theme-Light-Containers-Container: var(--${prefix}-Containers-Container);`);
  lines.push(`  --Theme-Light-Containers-Container-Lowest: var(--${prefix}-Containers-Container-Lowest);`);
  lines.push(`  --Theme-Light-Containers-Container-Low: var(--${prefix}-Containers-Container-Low);`);
  lines.push(`  --Theme-Light-Containers-Container-High: var(--${prefix}-Containers-Container-High);`);
  lines.push(`  --Theme-Light-Containers-Container-Highest: var(--${prefix}-Containers-Container-Highest);`);
  lines.push(`  --Theme-Light-Containers-Header: var(--${prefix}-Containers-Header);`);
  lines.push(`  --Theme-Light-Containers-Text: var(--${prefix}-Containers-Text);`);
  lines.push(`  --Theme-Light-Containers-Quiet: var(--${prefix}-Containers-Quiet);`);
  lines.push(`  --Theme-Light-Containers-Border: var(--${prefix}-Containers-Border);`);
  lines.push(`  --Theme-Light-Containers-Border-Variant: var(--${prefix}-Containers-Border-Variant);`);
  lines.push(`  --Theme-Light-Containers-Hotlink: var(--${prefix}-Containers-Hotlink);`);
  lines.push(`  --Theme-Light-Containers-Hotlink-Visited: var(--${prefix}-Containers-Hotlink-Visited);`);
  lines.push(`  --Theme-Light-Containers-Hover: var(--${prefix}-Containers-Hover);`);
  lines.push(`  --Theme-Light-Containers-Pressed: var(--${prefix}-Containers-Pressed);`);
  lines.push(`  --Theme-Light-Containers-Focus-Visible: var(--${prefix}-Containers-Focus-Visible);`);
  
  lines.push('');
  lines.push('  /* Container Buttons */');
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Button: var(--${prefix}-Buttons-Containers-Primary-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Text: var(--${prefix}-Buttons-Containers-Primary-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Border: var(--${prefix}-Buttons-Containers-Primary-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Hover: var(--${prefix}-Buttons-Containers-Primary-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Pressed: var(--${prefix}-Buttons-Containers-Primary-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Light-Button: var(--${prefix}-Buttons-Containers-Primary-Light-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Light-Text: var(--${prefix}-Buttons-Containers-Primary-Light-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Light-Border: var(--${prefix}-Buttons-Containers-Primary-Light-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Light-Hover: var(--${prefix}-Buttons-Containers-Primary-Light-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Primary-Light-Pressed: var(--${prefix}-Buttons-Containers-Primary-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Button: var(--${prefix}-Buttons-Containers-Secondary-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Text: var(--${prefix}-Buttons-Containers-Secondary-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Border: var(--${prefix}-Buttons-Containers-Secondary-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Hover: var(--${prefix}-Buttons-Containers-Secondary-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Pressed: var(--${prefix}-Buttons-Containers-Secondary-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Light-Button: var(--${prefix}-Buttons-Containers-Secondary-Light-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Light-Text: var(--${prefix}-Buttons-Containers-Secondary-Light-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Light-Border: var(--${prefix}-Buttons-Containers-Secondary-Light-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Light-Hover: var(--${prefix}-Buttons-Containers-Secondary-Light-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Secondary-Light-Pressed: var(--${prefix}-Buttons-Containers-Secondary-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Button: var(--${prefix}-Buttons-Containers-Tertiary-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Text: var(--${prefix}-Buttons-Containers-Tertiary-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Border: var(--${prefix}-Buttons-Containers-Tertiary-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Hover: var(--${prefix}-Buttons-Containers-Tertiary-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Pressed: var(--${prefix}-Buttons-Containers-Tertiary-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Light-Button: var(--${prefix}-Buttons-Containers-Tertiary-Light-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Light-Text: var(--${prefix}-Buttons-Containers-Tertiary-Light-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Light-Border: var(--${prefix}-Buttons-Containers-Tertiary-Light-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Light-Hover: var(--${prefix}-Buttons-Containers-Tertiary-Light-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Tertiary-Light-Pressed: var(--${prefix}-Buttons-Containers-Tertiary-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Button: var(--${prefix}-Buttons-Containers-Neutral-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Text: var(--${prefix}-Buttons-Containers-Neutral-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Border: var(--${prefix}-Buttons-Containers-Neutral-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Hover: var(--${prefix}-Buttons-Containers-Neutral-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Pressed: var(--${prefix}-Buttons-Containers-Neutral-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Light-Button: var(--${prefix}-Buttons-Containers-Neutral-Light-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Light-Text: var(--${prefix}-Buttons-Containers-Neutral-Light-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Light-Border: var(--${prefix}-Buttons-Containers-Neutral-Light-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Light-Hover: var(--${prefix}-Buttons-Containers-Neutral-Light-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Neutral-Light-Pressed: var(--${prefix}-Buttons-Containers-Neutral-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Button: var(--${prefix}-Buttons-Containers-Info-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Text: var(--${prefix}-Buttons-Containers-Info-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Border: var(--${prefix}-Buttons-Containers-Info-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Hover: var(--${prefix}-Buttons-Containers-Info-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Pressed: var(--${prefix}-Buttons-Containers-Info-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Light-Button: var(--${prefix}-Buttons-Containers-Info-Light-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Light-Text: var(--${prefix}-Buttons-Containers-Info-Light-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Light-Border: var(--${prefix}-Buttons-Containers-Info-Light-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Light-Hover: var(--${prefix}-Buttons-Containers-Info-Light-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Info-Light-Pressed: var(--${prefix}-Buttons-Containers-Info-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Button: var(--${prefix}-Buttons-Containers-Success-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Text: var(--${prefix}-Buttons-Containers-Success-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Border: var(--${prefix}-Buttons-Containers-Success-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Hover: var(--${prefix}-Buttons-Containers-Success-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Pressed: var(--${prefix}-Buttons-Containers-Success-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Light-Button: var(--${prefix}-Buttons-Containers-Success-Light-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Light-Text: var(--${prefix}-Buttons-Containers-Success-Light-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Light-Border: var(--${prefix}-Buttons-Containers-Success-Light-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Light-Hover: var(--${prefix}-Buttons-Containers-Success-Light-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Success-Light-Pressed: var(--${prefix}-Buttons-Containers-Success-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Button: var(--${prefix}-Buttons-Containers-Warning-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Text: var(--${prefix}-Buttons-Containers-Warning-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Border: var(--${prefix}-Buttons-Containers-Warning-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Hover: var(--${prefix}-Buttons-Containers-Warning-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Pressed: var(--${prefix}-Buttons-Containers-Warning-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Light-Button: var(--${prefix}-Buttons-Containers-Warning-Light-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Light-Text: var(--${prefix}-Buttons-Containers-Warning-Light-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Light-Border: var(--${prefix}-Buttons-Containers-Warning-Light-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Light-Hover: var(--${prefix}-Buttons-Containers-Warning-Light-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Warning-Light-Pressed: var(--${prefix}-Buttons-Containers-Warning-Light-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Button: var(--${prefix}-Buttons-Containers-Error-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Text: var(--${prefix}-Buttons-Containers-Error-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Border: var(--${prefix}-Buttons-Containers-Error-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Hover: var(--${prefix}-Buttons-Containers-Error-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Pressed: var(--${prefix}-Buttons-Containers-Error-Pressed);`);
  
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Light-Button: var(--${prefix}-Buttons-Containers-Error-Light-Button);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Light-Text: var(--${prefix}-Buttons-Containers-Error-Light-Text);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Light-Border: var(--${prefix}-Buttons-Containers-Error-Light-Border);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Light-Hover: var(--${prefix}-Buttons-Containers-Error-Light-Hover);`);
  lines.push(`  --Theme-Light-Containers-Buttons-Error-Light-Pressed: var(--${prefix}-Buttons-Containers-Error-Light-Pressed);`);
  
  lines.push('');
  lines.push('  /* Container Icons */');
  lines.push(`  --Theme-Light-Containers-Icons-Default: var(--${prefix}-Icons-Containers-Neutral);`);
  lines.push(`  --Theme-Light-Containers-Icons-Default-Variant: var(--${prefix}-Icons-Containers-Neutral-Variant);`);
  lines.push(`  --Theme-Light-Containers-Icons-Primary: var(--${prefix}-Icons-Containers-Primary);`);
  lines.push(`  --Theme-Light-Containers-Icons-Primary-Variant: var(--${prefix}-Icons-Containers-Primary-Variant);`);
  lines.push(`  --Theme-Light-Containers-Icons-Secondary: var(--${prefix}-Icons-Containers-Secondary);`);
  lines.push(`  --Theme-Light-Containers-Icons-Secondary-Variant: var(--${prefix}-Icons-Containers-Secondary-Variant);`);
  lines.push(`  --Theme-Light-Containers-Icons-Tertiary: var(--${prefix}-Icons-Containers-Tertiary);`);
  lines.push(`  --Theme-Light-Containers-Icons-Tertiary-Variant: var(--${prefix}-Icons-Containers-Tertiary-Variant);`);
  lines.push(`  --Theme-Light-Containers-Icons-Neutral: var(--${prefix}-Icons-Containers-Neutral);`);
  lines.push(`  --Theme-Light-Containers-Icons-Neutral-Variant: var(--${prefix}-Icons-Containers-Neutral-Variant);`);
  lines.push(`  --Theme-Light-Containers-Icons-Info: var(--${prefix}-Icons-Containers-Info);`);
  lines.push(`  --Theme-Light-Containers-Icons-Info-Variant: var(--${prefix}-Icons-Containers-Info-Variant);`);
  lines.push(`  --Theme-Light-Containers-Icons-Success: var(--${prefix}-Icons-Containers-Success);`);
  lines.push(`  --Theme-Light-Containers-Icons-Success-Variant: var(--${prefix}-Icons-Containers-Success-Variant);`);
  lines.push(`  --Theme-Light-Containers-Icons-Warning: var(--${prefix}-Icons-Containers-Warning);`);
  lines.push(`  --Theme-Light-Containers-Icons-Warning-Variant: var(--${prefix}-Icons-Containers-Warning-Variant);`);
  lines.push(`  --Theme-Light-Containers-Icons-Error: var(--${prefix}-Icons-Containers-Error);`);
  lines.push(`  --Theme-Light-Containers-Icons-Error-Variant: var(--${prefix}-Icons-Containers-Error-Variant);`);
  
  lines.push('');
  lines.push('  /* Container Tags */');
  lines.push(`  --Theme-Light-Containers-Tags-Primary-BG: var(--Containers-Tags-Primary-BG);`);
  lines.push(`  --Theme-Light-Containers-Tags-Primary-Text: var(--Containers-Tags-Primary-Text);`);
  lines.push(`  --Theme-Light-Containers-Tags-Secondary-BG: var(--Containers-Tags-Secondary-BG);`);
  lines.push(`  --Theme-Light-Containers-Tags-Secondary-Text: var(--Containers-Tags-Secondary-Text);`);
  lines.push(`  --Theme-Light-Containers-Tags-Tertiary-BG: var(--Containers-Tags-Tertiary-BG);`);
  lines.push(`  --Theme-Light-Containers-Tags-Tertiary-Text: var(--Containers-Tags-Tertiary-Text);`);
  lines.push(`  --Theme-Light-Containers-Tags-Neutral-BG: var(--Containers-Tags-Neutral-BG);`);
  lines.push(`  --Theme-Light-Containers-Tags-Neutral-Text: var(--Containers-Tags-Neutral-Text);`);
  lines.push(`  --Theme-Light-Containers-Tags-Info-BG: var(--Containers-Tags-Info-BG);`);
  lines.push(`  --Theme-Light-Containers-Tags-Info-Text: var(--Containers-Tags-Info-Text);`);
  lines.push(`  --Theme-Light-Containers-Tags-Success-BG: var(--Containers-Tags-Success-BG);`);
  lines.push(`  --Theme-Light-Containers-Tags-Success-Text: var(--Containers-Tags-Success-Text);`);
  lines.push(`  --Theme-Light-Containers-Tags-Warning-BG: var(--Containers-Tags-Warning-BG);`);
  lines.push(`  --Theme-Light-Containers-Tags-Warning-Text: var(--Containers-Tags-Warning-Text);`);
  lines.push(`  --Theme-Light-Containers-Tags-Error-BG: var(--Containers-Tags-Error-BG);`);
  lines.push(`  --Theme-Light-Containers-Tags-Error-Text: var(--Containers-Tags-Error-Text);`);
  
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate CSS for top-level Primary-Button switcher variables with data attributes
 * Creates --Primary-Button-* variables that switch between Primary-Buttons-{Style}-* using data attributes
 */
function generateTopLevelPrimaryButtonsCSS(jsonData: any): string {
  const lines: string[] = [];
  
  lines.push('/* ========================================');
  lines.push(' * Primary Button Switcher Variables');
  lines.push(' * Default to Primary-Fixed, use data-primary-buttons attribute to switch');
  lines.push(' * ======================================== */');
  lines.push('');
  
  // Helper function to generate switcher variables for a given style
  const generateSwitcherVars = (stylePrefix: string, indent: string = '  '): string[] => {
    const varLines: string[] = [];
    
    // Surfaces section
    varLines.push(`${indent}/* Surfaces */`);
    for (let i = 1; i <= 14; i++) {
      varLines.push(`${indent}--Primary-Button-Surfaces-Background-${i}-Button: var(--Primary-Buttons-${stylePrefix}-Surfaces-Background-${i}-Button);`);
      varLines.push(`${indent}--Primary-Button-Surfaces-Background-${i}-Text: var(--Primary-Buttons-${stylePrefix}-Surfaces-Background-${i}-Text);`);
      varLines.push(`${indent}--Primary-Button-Surfaces-Background-${i}-Hover: var(--Primary-Buttons-${stylePrefix}-Surfaces-Background-${i}-Hover);`);
      varLines.push(`${indent}--Primary-Button-Surfaces-Background-${i}-Pressed: var(--Primary-Buttons-${stylePrefix}-Surfaces-Background-${i}-Pressed);`);
    }
    varLines.push(`${indent}--Primary-Button-Surfaces-Background-Vibrant-Button: var(--Primary-Buttons-${stylePrefix}-Surfaces-Background-Vibrant-Button);`);
    varLines.push(`${indent}--Primary-Button-Surfaces-Background-Vibrant-Text: var(--Primary-Buttons-${stylePrefix}-Surfaces-Background-Vibrant-Text);`);
    varLines.push(`${indent}--Primary-Button-Surfaces-Background-Vibrant-Hover: var(--Primary-Buttons-${stylePrefix}-Surfaces-Background-Vibrant-Hover);`);
    varLines.push(`${indent}--Primary-Button-Surfaces-Background-Vibrant-Pressed: var(--Primary-Buttons-${stylePrefix}-Surfaces-Background-Vibrant-Pressed);`);
    varLines.push('');
    
    // Containers section
    varLines.push(`${indent}/* Containers */`);
    for (let i = 1; i <= 14; i++) {
      varLines.push(`${indent}--Primary-Button-Containers-Background-${i}-Button: var(--Primary-Buttons-${stylePrefix}-Containers-Background-${i}-Button);`);
      varLines.push(`${indent}--Primary-Button-Containers-Background-${i}-Text: var(--Primary-Buttons-${stylePrefix}-Containers-Background-${i}-Text);`);
      varLines.push(`${indent}--Primary-Button-Containers-Background-${i}-Hover: var(--Primary-Buttons-${stylePrefix}-Containers-Background-${i}-Hover);`);
      varLines.push(`${indent}--Primary-Button-Containers-Background-${i}-Pressed: var(--Primary-Buttons-${stylePrefix}-Containers-Background-${i}-Pressed);`);
    }
    varLines.push(`${indent}--Primary-Button-Containers-Background-Vibrant-Button: var(--Primary-Buttons-${stylePrefix}-Containers-Background-Vibrant-Button);`);
    varLines.push(`${indent}--Primary-Button-Containers-Background-Vibrant-Text: var(--Primary-Buttons-${stylePrefix}-Containers-Background-Vibrant-Text);`);
    varLines.push(`${indent}--Primary-Button-Containers-Background-Vibrant-Hover: var(--Primary-Buttons-${stylePrefix}-Containers-Background-Vibrant-Hover);`);
    varLines.push(`${indent}--Primary-Button-Containers-Background-Vibrant-Pressed: var(--Primary-Buttons-${stylePrefix}-Containers-Background-Vibrant-Pressed);`);
    
    return varLines;
  };
  
  // Default: Primary-Fixed in :root
  lines.push(':root {');
  const defaultVars = generateSwitcherVars('Primary-Fixed');
  lines.push(...defaultVars);
  lines.push('}');
  lines.push('');
  
  // Primary-Adaptive override
  lines.push('[data-primary-buttons="primary-adaptive"] {');
  const adaptiveVars = generateSwitcherVars('Primary-Adaptive');
  lines.push(...adaptiveVars);
  lines.push('}');
  lines.push('');
  
  // Primary-Fixed override
  lines.push('[data-primary-buttons="primary-fixed"] {');
  const fixedVars = generateSwitcherVars('Primary-Fixed');
  lines.push(...fixedVars);
  lines.push('}');
  lines.push('');
  
  // Black-White override
  lines.push('[data-primary-buttons="black-white"] {');
  const blackWhiteVars = generateSwitcherVars('Black-White');
  lines.push(...blackWhiteVars);
  lines.push('}');
  
  return lines.join('\n');
}

/**
 * Generate base.css file with Charts, Effect, Surfaces, and Containers
 */
export function generateBaseCSS(jsonData: any): string {
  const lines: string[] = [];
  
  console.log('🔍 generateBaseCSS called');
  console.log('🔍 Top-level keys in jsonData:', Object.keys(jsonData));
  console.log('🔍 Has SurfacesContainers?', 'SurfacesContainers' in jsonData);
  
  // Google Fonts imports (at the very top of the file)
  const googleFontsImports = generateGoogleFontsImports(jsonData);
  if (googleFontsImports) {
    lines.push(googleFontsImports);
    lines.push('');
  }
  
  // Metadata header
  if (jsonData && jsonData.Basics) {
    lines.push(generateCSSHeader(jsonData).trim());
    lines.push('');
  }
  
  // File header
  lines.push('/* ========================================');
  lines.push(' * Base CSS Variables');
  lines.push(' * Generated from OmniDesign JSON');
  lines.push(' * Auto-generated - do not edit manually');
  lines.push(' * ======================================== */');
  lines.push('');
  
  // Calculate button Color-N values based on extracted tones - MOVED TO TOP
  const extractedTones = jsonData?.extractedTones || { primary: 90, secondary: 90, tertiary: 90 };
  const primaryToneValue = extractedTones.primary || 90;
  const secondaryToneValue = extractedTones.secondary || 90;
  const tertiaryToneValue = extractedTones.tertiary || 90;
  
  // Convert tone values to Color-N numbers
  const primaryTone = toneToColorNumber(primaryToneValue);
  const secondaryTone = toneToColorNumber(secondaryToneValue);
  const tertiaryTone = toneToColorNumber(tertiaryToneValue);
  
  // SC (Secondary Color): If extracted ≠ 11, use that. If = 11 and Primary ≥ 9, use 9. If = 11 and Primary ≤ 8, use 8.
  let SC = secondaryTone;
  if (secondaryTone === 11) {
    SC = primaryTone >= 9 ? 9 : 8;
  }
  
  // TC (Tertiary Color): Same logic as Secondary
  let TC = tertiaryTone;
  if (tertiaryTone === 11) {
    TC = primaryTone >= 9 ? 9 : 8;
  }
  
  // OB (Other Buttons): If Primary ≥ 9, use 6. Else use 5.
  const OB = primaryTone >= 9 ? 6 : 5;
  
  console.log(`📊 Root Button Colors - SC: ${SC}, TC: ${TC}, OB: ${OB} (Primary: ${primaryTone})`);
  console.log(`📊 Root Backgrounds - Primary: tone ${primaryToneValue} → Color-${primaryTone}, Secondary: tone ${secondaryToneValue} → Color-${secondaryTone}, Tertiary: tone ${tertiaryToneValue} → Color-${tertiaryTone}`);

  // Color data for resolving hover/active to hex
  const baseColors = jsonData?.Modes?.['Light-Mode']?.Colors || jsonData?.Colors;
  const hoverHex = (palette: string, colorN: number): string => {
    return hoverBlendHex(palette, colorN, baseColors) || `var(--Hover-${palette}-Color-${colorN})`;
  };
  const pressedHex = (palette: string, colorN: number): string => {
    return pressedToneHex(palette, colorN, baseColors) || `var(--Pressed-${palette}-Color-${colorN})`;
  };
  
  // Add :root button color variables at the very start
  lines.push('/* ========================================');
  lines.push(' * Root Button Colors');
  lines.push(' * Global button color variables');
  lines.push(' * ======================================== */');
  lines.push('');
  lines.push(':root {');
  // Surface and Container variables based on Primary extracted tone
  lines.push(`  --Surface: var(--Primary-Background-${primaryTone}-Surface);`);
  lines.push(`  --Surface-Dim: var(--Primary-Background-${primaryTone}-Surface-Dim);`);
  lines.push(`  --Surface-Bright: var(--Primary-Background-${primaryTone}-Surface-Bright);`);
  lines.push(`  --Container: var(--Primary-Background-${primaryTone}-Container);`);
  lines.push(`  --Container-Lowest: var(--Primary-Background-${primaryTone}-Container-Lowest);`);
  lines.push(`  --Container-Low: var(--Primary-Background-${primaryTone}-Container-Low);`);
  lines.push(`  --Container-High: var(--Primary-Background-${primaryTone}-Container-High);`);
  lines.push(`  --Container-Highest: var(--Primary-Background-${primaryTone}-Container-Highest);`);
  lines.push('  /* Default Theme */');
  lines.push(`  --Background: var(--Primary-Background-${primaryTone}-Surface);`);
  lines.push(`  --Surface-Dim: var(--Primary-Background-${primaryTone}-Surface-Dim);`);
  lines.push(`  --Surface-Bright: var(--Primary-Background-${primaryTone}-Surface-Bright);`);
  lines.push(`  --Header: var(--Header-Surfaces-Primary-Color-${primaryTone});`);
  lines.push(`  --Text: var(--Text-Surfaces-Primary-Color-${primaryTone});`);
  lines.push(`  --Quiet: var(--Quiet-Surfaces-Primary-Color-${primaryTone});`);
  lines.push(`  --Border: var(--Border-Surfaces-Primary-Color-${primaryTone});`);
  lines.push(`  --Border-Variant: var(--Border-Variant-Surfaces-Primary-Color-${primaryTone});`);
  lines.push(`  --Hotlink: var(--Text-Surfaces-Info-Color-${primaryTone});`);
  lines.push(`  --Hotlink-Visited: var(--Text-Surfaces-Hotlink-Visited-Color-${primaryTone});`);
  lines.push(`  --Hover: var(--Hover-Primary-Color-${primaryTone});`);
  lines.push(`  --Pressed: var(--Pressed-Primary-Color-${primaryTone});`);
  lines.push(`  --Focus-Visible: var(--Focus-Visible-Surfaces-Color-${primaryTone});`);
  // REMOVED: lines.push(`  --Buttons-Primary-Button: var(--Primary-Button-Surfaces-Background-${primaryTone}-Button);`);
  // REMOVED: lines.push(`  --Buttons-Primary-Text: var(--Primary-Button-Surfaces-Background-${primaryTone}-Text);`);
  // REMOVED: lines.push(`  --Buttons-Primary-Border: var(--Border-Surfaces-Neutral-Color-${primaryTone});`);
  lines.push(`  --Buttons-Primary-Hover: ${hoverHex('Primary', primaryTone)};`);
  lines.push(`  --Buttons-Primary-Pressed: ${pressedHex('Primary', primaryTone)};`);
  lines.push('  --Buttons-Primary-Light-Button: var(--Primary-Color-12);');
  lines.push('  --Buttons-Primary-Light-Text: var(--Text-Surfaces-Primary-Color-12);');
  lines.push(`  --Buttons-Primary-Light-Border: var(--Border-Surfaces-Primary-Color-12);`);
  lines.push(`  --Buttons-Primary-Light-Hover: ${hoverHex('Primary', 12)};`);
  lines.push(`  --Buttons-Primary-Light-Pressed: ${pressedHex('Primary', 12)};`);
  lines.push(`  --Buttons-Secondary-Button: var(--Secondary-Color-${SC});`);
  lines.push(`  --Buttons-Secondary-Text: var(--Text-Surfaces-Secondary-Color-${SC});`);
  lines.push(`  --Buttons-Secondary-Border: var(--Border-Surfaces-Secondary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Secondary-Hover: ${hoverHex('Secondary', SC)};`);
  lines.push(`  --Buttons-Secondary-Pressed: ${pressedHex('Secondary', SC)};`);
  lines.push('  --Buttons-Secondary-Light-Button: var(--Secondary-Color-12);');
  lines.push('  --Buttons-Secondary-Light-Text: var(--Text-Surfaces-Secondary-Color-12);');
  lines.push(`  --Buttons-Secondary-Light-Border: var(--Border-Surfaces-Secondary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Secondary-Light-Hover: ${hoverHex('Secondary', 12)};`);
  lines.push(`  --Buttons-Secondary-Light-Pressed: ${pressedHex('Secondary', 12)};`);
  lines.push(`  --Buttons-Tertiary-Button: var(--Tertiary-Color-${TC});`);
  lines.push(`  --Buttons-Tertiary-Text: var(--Text-Surfaces-Tertiary-Color-${TC});`);
  lines.push(`  --Buttons-Tertiary-Border: var(--Border-Surfaces-Tertiary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Tertiary-Hover: ${hoverHex('Tertiary', TC)};`);
  lines.push(`  --Buttons-Tertiary-Pressed: ${pressedHex('Tertiary', TC)};`);
  lines.push('  --Buttons-Tertiary-Light-Button: var(--Tertiary-Color-12);');
  lines.push('  --Buttons-Tertiary-Light-Text: var(--Text-Surfaces-Tertiary-Color-12);');
  lines.push(`  --Buttons-Tertiary-Light-Border: var(--Border-Surfaces-Tertiary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Tertiary-Light-Hover: ${hoverHex('Tertiary', 12)};`);
  lines.push(`  --Buttons-Tertiary-Light-Pressed: ${pressedHex('Tertiary', 12)};`);
  // Container section for Primary buttons
  lines.push(`  --Buttons-Primary-Button: var(--Primary-Button-Containers-Background-${primaryTone}-Button);`);
  lines.push(`  --Buttons-Primary-Text: var(--Primary-Button-Containers-Background-${primaryTone}-Text);`);
  lines.push(`  --Buttons-Primary-Border: var(--Border-Containers-Primary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Primary-Hover: ${hoverHex('Primary', primaryTone)};`);
  lines.push(`  --Buttons-Primary-Pressed: ${pressedHex('Primary', primaryTone)};`);
  lines.push('  --Buttons-Primary-Light-Border: var(--Border-Containers-Primary-Color-12);');
  lines.push(`  --Buttons-Secondary-Border: var(--Border-Containers-Secondary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Secondary-Light-Border: var(--Border-Containers-Secondary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Tertiary-Border: var(--Border-Containers-Tertiary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Tertiary-Light-Border: var(--Border-Containers-Tertiary-Color-${primaryTone});`);
  lines.push(`  --Buttons-Neutral-Button: var(--Neutral-Color-${OB});`);
  lines.push(`  --Buttons-Neutral-Text: var(--Text-Surfaces-Neutral-Color-${OB});`);
  lines.push(`  --Buttons-Neutral-Border: var(--Border-Containers-Neutral-Color-${primaryTone});`);
  lines.push(`  --Buttons-Neutral-Hover: ${hoverHex('Neutral', OB)};`);
  lines.push(`  --Buttons-Neutral-Pressed: ${pressedHex('Neutral', OB)};`);
  lines.push('  --Buttons-Neutral-Light-Button: var(--Neutral-Color-12);');
  lines.push('  --Buttons-Neutral-Light-Text: var(--Text-Surfaces-Neutral-Color-12);');
  lines.push(`  --Buttons-Neutral-Light-Border: var(--Border-Containers-Neutral-Color-${primaryTone});`);
  lines.push(`  --Buttons-Neutral-Light-Hover: ${hoverHex('Neutral', 12)};`);
  lines.push(`  --Buttons-Neutral-Light-Pressed: ${pressedHex('Neutral', 12)};`);
  lines.push(`  --Buttons-Info-Button: var(--Info-Color-${OB});`);
  lines.push(`  --Buttons-Info-Text: var(--Text-Surfaces-Info-Color-${OB});`);
  lines.push(`  --Buttons-Info-Border: var(--Border-Containers-Info-Color-${primaryTone});`);
  lines.push(`  --Buttons-Info-Hover: ${hoverHex('Info', OB)};`);
  lines.push(`  --Buttons-Info-Pressed: ${pressedHex('Info', OB)};`);
  lines.push('  --Buttons-Info-Light-Button: var(--Info-Color-12);');
  lines.push('  --Buttons-Info-Light-Text: var(--Text-Surfaces-Info-Color-12);');
  lines.push(`  --Buttons-Info-Light-Border: var(--Border-Containers-Info-Color-${primaryTone});`);
  lines.push(`  --Buttons-Info-Light-Hover: ${hoverHex('Info', 12)};`);
  lines.push(`  --Buttons-Info-Light-Pressed: ${pressedHex('Info', 12)};`);
  lines.push(`  --Buttons-Success-Button: var(--Success-Color-${OB});`);
  lines.push(`  --Buttons-Success-Text: var(--Text-Surfaces-Success-Color-${OB});`);
  lines.push(`  --Buttons-Success-Border: var(--Border-Containers-Success-Color-${primaryTone});`);
  lines.push(`  --Buttons-Success-Hover: ${hoverHex('Success', OB)};`);
  lines.push(`  --Buttons-Success-Pressed: ${pressedHex('Success', OB)};`);
  lines.push('  --Buttons-Success-Light-Button: var(--Success-Color-12);');
  lines.push('  --Buttons-Success-Light-Text: var(--Text-Surfaces-Success-Color-12);');
  lines.push(`  --Buttons-Success-Light-Border: var(--Border-Containers-Success-Color-${primaryTone});`);
  lines.push(`  --Buttons-Success-Light-Hover: ${hoverHex('Success', 12)};`);
  lines.push(`  --Buttons-Success-Light-Pressed: ${pressedHex('Success', 12)};`);
  lines.push(`  --Buttons-Warning-Button: var(--Warning-Color-${OB});`);
  lines.push(`  --Buttons-Warning-Text: var(--Text-Surfaces-Warning-Color-${OB});`);
  lines.push(`  --Buttons-Warning-Border: var(--Border-Containers-Warning-Color-${primaryTone});`);
  lines.push(`  --Buttons-Warning-Hover: ${hoverHex('Warning', OB)};`);
  lines.push(`  --Buttons-Warning-Pressed: ${pressedHex('Warning', OB)};`);
  lines.push('  --Buttons-Warning-Light-Button: var(--Warning-Color-12);');
  lines.push('  --Buttons-Warning-Light-Text: var(--Text-Surfaces-Warning-Color-12);');
  lines.push(`  --Buttons-Warning-Light-Border: var(--Border-Containers-Warning-Color-${primaryTone});`);
  lines.push(`  --Buttons-Warning-Light-Hover: ${hoverHex('Warning', 12)};`);
  lines.push(`  --Buttons-Warning-Light-Pressed: ${pressedHex('Warning', 12)};`);
  lines.push(`  --Buttons-Error-Button: var(--Error-Color-${OB});`);
  lines.push(`  --Buttons-Error-Text: var(--Text-Surfaces-Error-Color-${OB});`);
  lines.push(`  --Buttons-Error-Border: var(--Border-Containers-Error-Color-${primaryTone});`);
  lines.push(`  --Buttons-Error-Hover: ${hoverHex('Error', OB)};`);
  lines.push(`  --Buttons-Error-Pressed: ${pressedHex('Error', OB)};`);
  lines.push('  --Buttons-Error-Light-Button: var(--Error-Color-12);');
  lines.push('  --Buttons-Error-Light-Text: var(--Text-Surfaces-Error-Color-12);');
  lines.push(`  --Buttons-Error-Light-Border: var(--Border-Containers-Error-Color-${primaryTone});`);
  lines.push(`  --Buttons-Error-Light-Hover: ${hoverHex('Error', 12)};`);
  lines.push(`  --Buttons-Error-Light-Pressed: ${pressedHex('Error', 12)};`);
  // Black and White buttons (were BlackWhite.Light / .Medium)
  lines.push('  --Buttons-White-Button: var(--White);');
  lines.push('  --Buttons-White-Text: var(--Text-Surfaces-BW-Button-Color-1);');
  lines.push(`  --Buttons-White-Hover: ${hoverHex('Neutral', 12)};`);
  lines.push(`  --Buttons-White-Pressed: ${pressedHex('Neutral', 12)};`);
  lines.push('  --Buttons-Black-Button: var(--Neutral-Color-1);');
  lines.push('  --Buttons-Black-Text: var(--Text-Surfaces-BW-Button-Color-12);');
  lines.push(`  --Buttons-Black-Hover: ${hoverHex('Neutral', 1)};`);
  lines.push(`  --Buttons-Black-Pressed: ${pressedHex('Neutral', 1)};`);
  // Default button — border matches the palette that the Default button's
  // OWN palette/color resolves to for the active theme. Mirrors
  // getButtonModeBorderMappings(buttonMode).Default in
  // completeSimplifiedSystem.ts so the CSS matches the Figma JSON cascade.
  const buttonMode = jsonData?.Metadata?.['Button-Config']?.DefaultButtonType?.value;
  const defaultBorderPalette =
    buttonMode === 'primary' ? 'Primary' :
    buttonMode === 'secondary' ? 'Secondary' :
    buttonMode === 'tonal' ? 'Primary' :    // Default theme's tonal button maps to Primary
    buttonMode === 'laddered' ? 'Secondary' : // Default theme's laddered button maps to Secondary
    buttonMode === 'black-white' ? 'Neutral' :
    'Primary'; // safest fallback — was previously null, which let stale Light-Mode.css refs win
  lines.push('  --Buttons-Default-Button: var(--Default-Button-Default-Medium-Button);');
  lines.push('  --Buttons-Default-Text: var(--Default-Button-Default-Medium-Text);');
  lines.push(`  --Buttons-Default-Border: var(--Buttons-${defaultBorderPalette}-Border);`);
  // Bevel inset highlight/lowlight follow the same palette as the border
  // so the Default button's 3D effect matches its body color.
  lines.push(`  --Buttons-Default-Highlight: var(--Buttons-${defaultBorderPalette}-Highlight);`);
  lines.push(`  --Buttons-Default-Lowlight: var(--Buttons-${defaultBorderPalette}-Lowlight);`);
  // Resolve Default hover/active through the Buttons chain
  const defaultBtnData = jsonData?.Modes?.['Light-Mode']?.['Default-Button'] || jsonData?.['Default-Button'];
  const buttonsJsonData = jsonData?.Modes?.['Light-Mode']?.Buttons || jsonData?.Buttons;
  const resolveDefHA = (shade: string): string | null => {
    const ref = defaultBtnData?.Default?.[shade]?.Hover?.value;
    if (!ref) return null;
    const parts = ref.replace(/[{}]/g, '').split('.');
    if (parts[0] === 'Buttons' && parts.length === 4) {
      const inner = buttonsJsonData?.[parts[1]]?.[parts[2]]?.[parts[3]]?.value;
      if (inner) return resolveHoverActiveToken(inner, baseColors);
    }
    return null;
  };
  lines.push(`  --Buttons-Default-Hover: ${resolveDefHA('Medium') || 'var(--Default-Button-Default-Medium-Hover)'};`);
  lines.push(`  --Buttons-Default-Pressed: ${resolveDefHA('Medium') || 'var(--Default-Button-Default-Medium-Pressed)'};`);
  lines.push(`  --Icons-Default: var(--Icon-Surfaces-Neutral-Color-${primaryTone});`);
  lines.push(`  --Icons-Default-Variant: var(--Icon-Variant-Surfaces-Neutral-Color-${primaryTone});`);
  lines.push(`  --Icons-Primary: var(--Icon-Surfaces-Primary-Color-${primaryTone});`);
  lines.push(`  --Icons-Primary-Variant: var(--Icon-Variant-Surfaces-Primary-Color-${primaryTone});`);
  lines.push(`  --Icons-Secondary: var(--Icon-Surfaces-Secondary-Color-${primaryTone});`);
  lines.push(`  --Icons-Secondary-Variant: var(--Icon-Variant-Surfaces-Secondary-Color-${primaryTone});`);
  lines.push(`  --Icons-Tertiary: var(--Icon-Surfaces-Tertiary-Color-${primaryTone});`);
  lines.push(`  --Icons-Tertiary-Variant: var(--Icon-Variant-Surfaces-Tertiary-Color-${primaryTone});`);
  lines.push(`  --Icons-Neutral: var(--Icon-Surfaces-Neutral-Color-${primaryTone});`);
  lines.push(`  --Icons-Neutral-Variant: var(--Icon-Variant-Surfaces-Neutral-Color-${primaryTone});`);
  lines.push(`  --Icons-Info: var(--Icon-Surfaces-Info-Color-${primaryTone});`);
  lines.push(`  --Icons-Info-Variant: var(--Icon-Variant-Surfaces-Info-Color-${primaryTone});`);
  lines.push(`  --Icons-Success: var(--Icon-Surfaces-Success-Color-${primaryTone});`);
  lines.push(`  --Icons-Success-Variant: var(--Icon-Variant-Surfaces-Success-Color-${primaryTone});`);
  lines.push(`  --Icons-Warning: var(--Icon-Surfaces-Warning-Color-${primaryTone});`);
  lines.push(`  --Icons-Warning-Variant: var(--Icon-Variant-Surfaces-Warning-Color-${primaryTone});`);
  lines.push(`  --Icons-Error: var(--Icon-Surfaces-Error-Color-${primaryTone});`);
  lines.push(`  --Icons-Error-Variant: var(--Icon-Variant-Surfaces-Error-Color-${primaryTone});`);
  lines.push('}');
  lines.push('');
  
  // Start with :root selector for Default theme variables
  // LOCKED: This MUST be :root — NOT [data-theme] or [data-theme="Default"]
  // Charts, Effects, Typography go in :root for global availability
  lines.push(':root {');

  // System Metadata variables (at the very top of :root)
  if (jsonData && jsonData.Basics) {
    lines.push('  /* ========================================');
    lines.push('   * Design System Metadata');
    lines.push('   * ======================================== */');
    lines.push('');
    
    const systemName = jsonData.Basics.Name?.value || 'My Design System';
    const systemCreated = jsonData.Basics['Date Created']?.value || '';
    const systemUpdated = jsonData.Basics['Date Updated']?.value || '';
    
    lines.push(`  --System-Name: "${systemName}";`);
    lines.push(`  --System-Created: "${systemCreated}";`);
    lines.push(`  --System-Updated: "${systemUpdated}";`);
    lines.push('');
  }
  
  // Charts section (inside :root)
  lines.push('  /* ========================================');
  lines.push('   * Chart Colors');
  lines.push('   * Direct hex values for data visualization');
  lines.push('   * ======================================== */');
  lines.push('');
  const chartVars = generateChartVariablesOnly(jsonData);
  if (chartVars) {
    lines.push(chartVars);
  }
  
  // Effect variables (inside same :root)
  lines.push('');
  lines.push('  /* ========================================');
  lines.push('   * Effect Levels (Box Shadows)');
  lines.push('   * ======================================== */');
  lines.push('');
  const effectCSS = generateEffectCSS(jsonData);
  if (effectCSS) {
    lines.push(effectCSS);
  }

  // Typography/Font variables (inside same :root)
  lines.push('');
  const typographyVars = generateTypographyVariablesOnly(jsonData);
  if (typographyVars) {
    lines.push(typographyVars);
  }
  
  // Close :root
  lines.push('}');
  lines.push('');
  
  // DEPRECATED (2026-03-03): Old Theme-Colors section - REMOVED
  // NOTE: a theme-colours block guarded by `if (false && …)` sat here. Its
  // own comment said it generated duplicate/incorrect theme CSS and that
  // generateThemeDataAttributesCSS replaced it. Deleted rather than left
  // disabled: `if (false)` is dead code that still reads as a live branch.
  lines.push('');
  // END of dead code block - never executes due to if (false...)
  
  // DEPRECATED (2026-02-26): Theme Mapping Variables
  // The old mapping system is deprecated in favor of the new Themes structure
  // New structure uses data-theme attributes with --Themes-* variables
  // Keeping this commented out for backwards compatibility reference
  /*
  lines.push('/* ========================================');
  lines.push(' * Theme Mapping Variables (DEPRECATED)');
  lines.push(' * Maps background-specific variables to theme-agnostic names');
  lines.push(' * ======================================== *\/');
  lines.push('');
  const themeMappingCSS = generateThemeMappingVariables(jsonData);
  if (themeMappingCSS) {
    lines.push(themeMappingCSS);
  }
  lines.push('');
  */
  
  // Radii section — emit the canonical pixel tokens from the customized
  // _componentStyle (percent fields → px via computeRadii). This replaces an
  // older Style.Border-Radius path that no longer gets written.
  if (jsonData?._componentStyle) {
    const csRaw = jsonData._componentStyle;
    const cs = migrateLegacyRadii({
      ...csRaw,
      buttonHeight: csRaw.buttonHeight ?? 32,
      smallButtonHeight: csRaw.smallButtonHeight ?? 24,
      largeButtonHeight: csRaw.largeButtonHeight ?? 56,
    });
    const r = computeRadii(cs);
    const btnR = r.buttonRadius;
    // Cap card-shaped radii at the standard button height so large
    // surfaces (cards, image thumbnails, modals) don't go stadium-shaped
    // under playful brand presets where buttonRadius is 100. Mirrors the
    // cap applied in buildPreviewCSS so exported designs render the same
    // way as the studio preview. Pill buttons unaffected — they saturate
    // at height/2 anyway.
    const buttonHeight = cs.buttonHeight ?? 32;
    // Button radius caps at the LARGE button height — beyond that it does
    // nothing (CSS clamps a pill at height/2) and produces absurd token values
    // (e.g. 100px) that bleed into downstream radii (swatches, Figma export).
    const largeButtonHeight = cs.largeButtonHeight ?? 56;
    const cappedButtonRadius = Math.min(r.buttonRadius, largeButtonHeight);
    const cappedSmButtonRadius = Math.min(r.smButtonRadius, largeButtonHeight);
    const cappedLgButtonRadius = Math.min(r.lgButtonRadius, largeButtonHeight);
    const cappedStyleRadius = Math.min(r.buttonRadius, buttonHeight);
    const cappedCardRadius = Math.min(r.cardRadius, buttonHeight);
    const cappedModalRadius = Math.min(r.modalRadius, buttonHeight);
    lines.push(':root {');
    // Where the brand sits on the 12-tone scale. Read from the payload rather
    // than recomputed, so the CSS cannot disagree with Figma.
    const brand = (jsonData as any)?.Brand;
    if (brand?.DPT?.value) {
      lines.push(`  /* Default Primary / Secondary / Tertiary Tone — the Color-N each brand colour sits at. */`);
      lines.push(`  --DPT: ${brand.DPT.value};`);
      lines.push(`  --DST: ${brand.DST?.value ?? brand.DPT.value};`);
      lines.push(`  --DTT: ${brand.DTT?.value ?? brand.DPT.value};`);
    }
    // --Style-Border-Radius is what the lib's Card component consumes by
    // default. Emitting it explicitly here (the legacy export path stopped
    // writing it) ensures exported designs match the preview cap.
    lines.push(`  --Style-Border-Radius: ${cappedStyleRadius}px;`);
    lines.push(`  --Button-Radius: ${cappedButtonRadius}px;`);
    lines.push(`  --Sm-Button-Radius: ${cappedSmButtonRadius}px;`);
    lines.push(`  --Lg-Button-Radius: ${cappedLgButtonRadius}px;`);
    lines.push(`  --Button-Inner-Radius: ${r.buttonInnerRadius}px;`);
    lines.push(`  --Sm-Button-Inner-Radius: ${r.smButtonInnerRadius}px;`);
    lines.push(`  --Lg-Button-Inner-Radius: ${r.lgButtonInnerRadius}px;`);
    lines.push(`  --Button-Focus-Radius: ${r.buttonFocusRadius}px;`);
    lines.push(`  --Sm-Button-Focus-Radius: ${r.smButtonFocusRadius}px;`);
    lines.push(`  --Lg-Button-Focus-Radius: ${r.lgButtonFocusRadius}px;`);
    lines.push(`  --Button-Icon-Radius: ${r.iconButtonRadius}px;`);
    lines.push(`  --Sm-Button-Icon-Radius: ${r.smIconButtonRadius}px;`);
    lines.push(`  --Lg-Button-Icon-Radius: ${r.lgIconButtonRadius}px;`);
    lines.push(`  --Button-Icon-Inner-Radius: ${r.iconButtonInnerRadius}px;`);
    lines.push(`  --Sm-Button-Icon-Inner-Radius: ${r.smIconButtonInnerRadius}px;`);
    lines.push(`  --Lg-Button-Icon-Inner-Radius: ${r.lgIconButtonInnerRadius}px;`);
    lines.push(`  --Button-Icon-Focus-Radius: ${r.iconButtonFocusRadius}px;`);
    lines.push(`  --Sm-Button-Icon-Focus-Radius: ${r.smIconButtonFocusRadius}px;`);
    lines.push(`  --Lg-Button-Icon-Focus-Radius: ${r.lgIconButtonFocusRadius}px;`);
    lines.push(`  --Card-Radius: ${cappedCardRadius}px;`);
    lines.push(`  --Card-Inner-Radius: ${r.cardInnerRadius}px;`);
    lines.push(`  --Card-Focus-Radius: ${r.cardFocusRadius}px;`);
    lines.push(`  --Card-Padding: ${r.cardPadding}px;`);
    lines.push(`  --Modal-Padding: ${r.modalPadding}px;`);
    lines.push(`  --Modal-Radius: ${cappedModalRadius}px;`);
    lines.push(`  --Modal-Inner-Radius: ${r.modalInnerRadius}px;`);
    lines.push(`  --Modal-Focus-Radius: ${r.modalFocusRadius}px;`);
    // Dropdown / menu frame: min(Input-Radius, Card-Radius, 16).
    lines.push(`  --Dropdown-Frame-Radius: ${r.dropdownFrameRadius}px;`);
    lines.push(`  --Input-Radius: ${r.inputRadius}px;`);
    lines.push(`  --Sm-Input-Radius: ${r.smInputRadius}px;`);
    lines.push(`  --Lg-Input-Radius: ${r.lgInputRadius}px;`);
    lines.push(`  --Input-Inner-Radius: ${r.inputInnerRadius}px;`);
    lines.push(`  --Input-Focus-Radius: ${r.inputFocusRadius}px;`);
    // Inset focus-ring corner radius — Input-Radius minus 1px so the inset
    // 3px focus indicator's corners visually match the chrome's outer
    // corners. Used by ListItem, TextField, Select, etc.
    lines.push(`  --Input-Inner-Focus-Visible: ${Math.max(0, r.inputRadius - 1)}px;`);
    lines.push(`  --Input-Swatch-Radius: ${r.inputSwatchRadius}px;`);
    lines.push(`  --Sm-Input-Swatch-Radius: ${r.smInputSwatchRadius}px;`);
    lines.push(`  --Lg-Input-Swatch-Radius: ${r.lgInputSwatchRadius}px;`);
    lines.push(`  --Input-Padding: ${csRaw.inputPadding ?? (btnR >= 8 ? 4 : 2)}px;`);
    lines.push(`  --Button-Border-Width: 1px;`);
    // Minimum button width — the floor the label box cannot shrink below, so a
    // one-word button ("OK") still reads as a button rather than a chip.
    //
    // Large's floor is the standard floor plus 40px, DERIVED rather than stored
    // as a second number: two literals for one relationship is how they drift.
    // The same pair ships to Figma from generateFigmaJSON (Components/Button),
    // and the +40 is stated in both places — tokenParity covers the agreement.
    const minButtonWidth = csRaw.minButtonWidth ?? 60;
    lines.push(`  --Button-Min-Width: ${minButtonWidth}px;`);
    lines.push(`  --Lg-Button-Min-Width: ${minButtonWidth + LG_BUTTON_MIN_WIDTH_OFFSET}px;`);
    lines.push(`  --Button-Padding: ${BUTTON_PADDING}px;`);
    lines.push(`  --Sm-Button-Padding: var(--Button-Padding);`);
    lines.push(`  --Lg-Button-Padding: ${LG_BUTTON_PADDING}px;`);
    lines.push(`  --Large-Button-Padding: var(--Lg-Button-Padding);`);
    // Bevel tokens — used by the lib Button to render its 3D inset shadow.
    // Live here (not in foundation.css) so they push to the lib's base.css
    // via LIB_DYNAMIC_CSS_FILES. --_bevel = Button-Bevel% × height / 100.
    const bevelPercent = csRaw.bevel ?? 0;
    const bevelOpacity = csRaw.bevelOpacity ?? 50;
    const bevelHeight = csRaw.buttonHeight ?? 32;
    const bevelPx = Math.round(bevelHeight * bevelPercent / 100);
    lines.push(`  --Button-Bevel: ${bevelPercent};`);
    lines.push(`  --Button-Bevel-Px: ${bevelPx}px;`);
    lines.push(`  --Button-Bevel-Opacity: ${bevelOpacity / 100};`);
    // Effect levels — box-shadow recipes. --Dropshadow-Color is overridden
    // per-theme in Light-Mode.css / Dark-Mode.css; the nested var() resolves
    // at the consuming element so themed values still apply even though
    // these are defined statically here.
    lines.push(`  --Effect-Level-0: none;`);
    // Each level stacks its own atmospheric shadow on the previous level's
    // contact shadow (Comeau's layered-shadow pattern). Per-level colors
    // are 8-digit hex tokens emitted per surface scope — the recipes here
    // just reference them so the alpha + tint come from the surface.
    lines.push(`  --Effect-Level-1: ${effectLevelRecipe(1)};`);
    lines.push(`  --Effect-Level-2: ${effectLevelRecipe(2)};`);
    lines.push(`  --Effect-Level-3: ${effectLevelRecipe(3)};`);
    lines.push(`  --Effect-Level-4: ${effectLevelRecipe(4)};`);
    lines.push(`  --Effect-Level-5: ${effectLevelRecipe(5)};`);
    lines.push('}');
    lines.push('');
  }
  
  // NOTE (2026-03-06): Primary-Buttons and Themes sections REMOVED from base.css
  // These are now ONLY in Light-Mode.css and Dark-Mode.css
  // They reference mode-specific variables, so they must be in the mode files
  
  // SurfacesContainers data-attribute selectors
  // Container data-surface selectors generated by generateSurfacesContainersCSS below
  
  // NOTE: :root button colors section moved to the top of base.css (after Google Fonts)
  
  /* REMOVED (2026-03-13): Hardcoded Surface Background Mapping
   * This was duplicating the output from generateSurfacesContainersCSS()
   * Now using dynamic generation which reads from JSON
  // Add simple data-surface selectors for --Background mapping
  lines.push('');
  lines.push('/* ========================================');
  lines.push(' * Surface Background Mapping');
  lines.push(' * Maps --Background to surface types');
  lines.push(' * ======================================== *\/');
  lines.push('');
  lines.push('[data-surface="Surface"] {');
  lines.push('  --Surface: var(--Surface);');
  lines.push('}');
  lines.push('');
  lines.push('[data-surface="Surface-Dim"] {');
  lines.push('  --Surface: var(--Surface-Dim);');
  lines.push('}');
  lines.push('');
  lines.push('[data-surface="Surface-Dimmest"] {');
  lines.push('  --Surface: var(--Surface-Dimmest);');
  lines.push('}');
  lines.push('');
  lines.push('[data-surface="Surface-Bright"] {');
  lines.push('  --Surface: var(--Surface-Bright);');
  lines.push('}');
  lines.push('');
  // Container data-surface selectors are generated by generateSurfacesContainersCSS (with --Effects)
  lines.push('}');
  */
  
  // NOTE: Hardcoded Surface Background Mapping removed (2026-03-13)
  // Now using generateSurfacesContainersCSS() which reads from JSON
  const surfaceMappingCSS = generateSurfacesContainersCSS(jsonData);
  if (surfaceMappingCSS) {
    lines.push('');
    lines.push(surfaceMappingCSS);
  }
  
  return lines.join('\n');
}

/**
 * Generate data-surface attribute CSS selectors
 * Allows switching between Surface and Container contexts
 * Maps comprehensive shorthand variables to Surface/Container variables
 */
function generateSurfaceDataAttributesCSS(jsonData: any): string {
  // Direct implementation - no require needed
  if (!jsonData || !jsonData['SurfacesContainers']) {
    console.log('❌ No SurfacesContainers found in JSON');
    return '';
  }
  
  const lines: string[] = [];
  const surfacesContainers = jsonData['SurfacesContainers'];
  console.log('✅ Found SurfacesContainers, generating CSS...');
  
  // SIMPLIFIED: Generate CSS directly without helper function
  const generateSurfaceTypeCSS = (surfaceData: any, selectorName: string, prefix: string, effectsLevel: string) => {
    const cssLines: string[] = [];
    
    cssLines.push(`[data-surface${selectorName ? `="${selectorName}"` : ''}] {`);
    
    // Basic properties
    cssLines.push(`  --Background: var(--Surfaces-Surface);`);
    cssLines.push(`  --Hover: var(--Surfaces-Hover);`);
    cssLines.push(`  --Pressed: var(--Surfaces-Pressed);`);
    cssLines.push(`  --Header: var(--Surfaces-Header);`);
    cssLines.push(`  --Text: var(--Surfaces-Text);`);
    cssLines.push(`  --Quiet: var(--Surfaces-Quiet);`);
    cssLines.push(`  --Border: var(--Surfaces-Border);`);
    cssLines.push(`  --Border-Variant: var(--Surfaces-Border-Variant);`);
    cssLines.push(`  --Hotlink: var(--Surfaces-Hotlink);`);
    cssLines.push(`  --Hotlink-Visited: var(--Surfaces-Hotlink-Visited);`);
    cssLines.push(`  --Effects: var(--${effectsLevel});`);
    
    // Buttons - all button styles with Hover, Pressed, Highlight, Lowlight
    cssLines.push(`  --Buttons-Primary-Button: var(--${prefix}-Buttons-Primary-Button);`);
    cssLines.push(`  --Buttons-Primary-Text: var(--${prefix}-Buttons-Primary-Text);`);
    cssLines.push(`  --Buttons-Primary-Border: var(--${prefix}-Buttons-Primary-Border);`);
    cssLines.push(`  --Buttons-Primary-Hover: var(--${prefix}-Buttons-Primary-Hover);`);
    cssLines.push(`  --Buttons-Primary-Pressed: var(--${prefix}-Buttons-Primary-Pressed);`);
    cssLines.push(`  --Buttons-Primary-Highlight: var(--${prefix}-Buttons-Primary-Highlight);`);
    cssLines.push(`  --Buttons-Primary-Lowlight: var(--${prefix}-Buttons-Primary-Lowlight);`);
    cssLines.push(`  --Buttons-Primary-Outline-Button: var(--${prefix}-Buttons-Primary-Outline-Button);`);
    cssLines.push(`  --Buttons-Primary-Outline-Text: var(--${prefix}-Buttons-Primary-Outline-Text);`);
    cssLines.push(`  --Buttons-Primary-Outline-Border: var(--${prefix}-Buttons-Primary-Outline-Border);`);
    cssLines.push(`  --Buttons-Primary-Outline-Hover: var(--${prefix}-Buttons-Primary-Outline-Hover);`);
    cssLines.push(`  --Buttons-Primary-Outline-Pressed: var(--${prefix}-Buttons-Primary-Outline-Pressed);`);
    cssLines.push(`  --Buttons-Primary-Light-Button: var(--${prefix}-Buttons-Primary-Light-Button);`);
    cssLines.push(`  --Buttons-Primary-Light-Text: var(--${prefix}-Buttons-Primary-Light-Text);`);
    cssLines.push(`  --Buttons-Primary-Light-Border: var(--${prefix}-Buttons-Primary-Light-Border);`);
    cssLines.push(`  --Buttons-Primary-Light-Hover: var(--${prefix}-Buttons-Primary-Light-Hover);`);
    cssLines.push(`  --Buttons-Primary-Light-Pressed: var(--${prefix}-Buttons-Primary-Light-Pressed);`);
    cssLines.push(`  --Buttons-Secondary-Button: var(--${prefix}-Buttons-Secondary-Button);`);
    cssLines.push(`  --Buttons-Secondary-Text: var(--${prefix}-Buttons-Secondary-Text);`);
    cssLines.push(`  --Buttons-Secondary-Border: var(--${prefix}-Buttons-Secondary-Border);`);
    cssLines.push(`  --Buttons-Secondary-Hover: var(--${prefix}-Buttons-Secondary-Hover);`);
    cssLines.push(`  --Buttons-Secondary-Pressed: var(--${prefix}-Buttons-Secondary-Pressed);`);
    cssLines.push(`  --Buttons-Secondary-Highlight: var(--${prefix}-Buttons-Secondary-Highlight);`);
    cssLines.push(`  --Buttons-Secondary-Lowlight: var(--${prefix}-Buttons-Secondary-Lowlight);`);
    cssLines.push(`  --Buttons-Tertiary-Button: var(--${prefix}-Buttons-Tertiary-Button);`);
    cssLines.push(`  --Buttons-Tertiary-Text: var(--${prefix}-Buttons-Tertiary-Text);`);
    cssLines.push(`  --Buttons-Tertiary-Border: var(--${prefix}-Buttons-Tertiary-Border);`);
    cssLines.push(`  --Buttons-Tertiary-Hover: var(--${prefix}-Buttons-Tertiary-Hover);`);
    cssLines.push(`  --Buttons-Tertiary-Pressed: var(--${prefix}-Buttons-Tertiary-Pressed);`);
    cssLines.push(`  --Buttons-Tertiary-Highlight: var(--${prefix}-Buttons-Tertiary-Highlight);`);
    cssLines.push(`  --Buttons-Tertiary-Lowlight: var(--${prefix}-Buttons-Tertiary-Lowlight);`);
    cssLines.push(`  --Buttons-Neutral-Button: var(--${prefix}-Buttons-Neutral-Button);`);
    cssLines.push(`  --Buttons-Neutral-Text: var(--${prefix}-Buttons-Neutral-Text);`);
    cssLines.push(`  --Buttons-Neutral-Border: var(--${prefix}-Buttons-Neutral-Border);`);
    cssLines.push(`  --Buttons-Neutral-Hover: var(--${prefix}-Buttons-Neutral-Hover);`);
    cssLines.push(`  --Buttons-Neutral-Pressed: var(--${prefix}-Buttons-Neutral-Pressed);`);
    cssLines.push(`  --Buttons-Neutral-Highlight: var(--${prefix}-Buttons-Neutral-Highlight);`);
    cssLines.push(`  --Buttons-Neutral-Lowlight: var(--${prefix}-Buttons-Neutral-Lowlight);`);
    cssLines.push(`  --Buttons-Info-Button: var(--${prefix}-Buttons-Info-Button);`);
    cssLines.push(`  --Buttons-Info-Text: var(--${prefix}-Buttons-Info-Text);`);
    cssLines.push(`  --Buttons-Info-Border: var(--${prefix}-Buttons-Info-Border);`);
    cssLines.push(`  --Buttons-Info-Hover: var(--${prefix}-Buttons-Info-Hover);`);
    cssLines.push(`  --Buttons-Info-Pressed: var(--${prefix}-Buttons-Info-Pressed);`);
    cssLines.push(`  --Buttons-Info-Highlight: var(--${prefix}-Buttons-Info-Highlight);`);
    cssLines.push(`  --Buttons-Info-Lowlight: var(--${prefix}-Buttons-Info-Lowlight);`);

    // Success button - use "Containers" prefix for button property when type is Surfaces
    const successPrefix = prefix === 'Surfaces' ? 'Containers' : prefix;
    cssLines.push(`  --Buttons-Success-Button: var(--${successPrefix}-Buttons-Success-Button);`);
    cssLines.push(`  --Buttons-Success-Text: var(--${prefix}-Buttons-Success-Text);`);
    cssLines.push(`  --Buttons-Success-Border: var(--${prefix}-Buttons-Success-Border);`);
    cssLines.push(`  --Buttons-Success-Hover: var(--${prefix}-Buttons-Success-Hover);`);
    cssLines.push(`  --Buttons-Success-Pressed: var(--${prefix}-Buttons-Success-Pressed);`);
    cssLines.push(`  --Buttons-Success-Highlight: var(--${prefix}-Buttons-Success-Highlight);`);
    cssLines.push(`  --Buttons-Success-Lowlight: var(--${prefix}-Buttons-Success-Lowlight);`);

    cssLines.push(`  --Buttons-Warning-Button: var(--${prefix}-Buttons-Warning-Button);`);
    cssLines.push(`  --Buttons-Warning-Text: var(--${prefix}-Buttons-Warning-Text);`);
    cssLines.push(`  --Buttons-Warning-Border: var(--${prefix}-Buttons-Warning-Border);`);
    cssLines.push(`  --Buttons-Warning-Hover: var(--${prefix}-Buttons-Warning-Hover);`);
    cssLines.push(`  --Buttons-Warning-Pressed: var(--${prefix}-Buttons-Warning-Pressed);`);
    cssLines.push(`  --Buttons-Warning-Highlight: var(--${prefix}-Buttons-Warning-Highlight);`);
    cssLines.push(`  --Buttons-Warning-Lowlight: var(--${prefix}-Buttons-Warning-Lowlight);`);
    cssLines.push(`  --Buttons-Error-Button: var(--${prefix}-Buttons-Error-Button);`);
    cssLines.push(`  --Buttons-Error-Text: var(--${prefix}-Buttons-Error-Text);`);
    cssLines.push(`  --Buttons-Error-Border: var(--${prefix}-Buttons-Error-Border);`);
    cssLines.push(`  --Buttons-Error-Hover: var(--${prefix}-Buttons-Error-Hover);`);
    cssLines.push(`  --Buttons-Error-Pressed: var(--${prefix}-Buttons-Error-Pressed);`);
    cssLines.push(`  --Buttons-Error-Highlight: var(--${prefix}-Buttons-Error-Highlight);`);
    cssLines.push(`  --Buttons-Error-Lowlight: var(--${prefix}-Buttons-Error-Lowlight);`);
    
    // Icons
    if (surfaceData.Icons) {
      const icons = surfaceData.Icons;
      // Map Default icons to Neutral since Default palette is not generated
      if (icons.Default) cssLines.push(`  --Icons-Default: var(--${prefix}-Icons-Neutral);`);
      if (icons['Default-Variant']) cssLines.push(`  --Icons-Default-Variant: var(--${prefix}-Icons-Neutral-Variant);`);
      if (icons.Primary) cssLines.push(`  --Icons-Primary: var(--${prefix}-Icons-Primary);`);
      if (icons['Primary-Variant']) cssLines.push(`  --Icons-Primary-Variant: var(--${prefix}-Icons-Primary-Variant);`);
      if (icons.Secondary) cssLines.push(`  --Icons-Secondary: var(--${prefix}-Icons-Secondary);`);
      if (icons['Secondary-Variant']) cssLines.push(`  --Icons-Secondary-Variant: var(--${prefix}-Icons-Secondary-Variant);`);
      if (icons.Tertiary) cssLines.push(`  --Icons-Tertiary: var(--${prefix}-Icons-Tertiary);`);
      if (icons['Tertiary-Variant']) cssLines.push(`  --Icons-Tertiary-Variant: var(--${prefix}-Icons-Tertiary-Variant);`);
      if (icons.Neutral) cssLines.push(`  --Icons-Neutral: var(--${prefix}-Icons-Neutral);`);
      if (icons['Neutral-Variant']) cssLines.push(`  --Icons-Neutral-Variant: var(--${prefix}-Icons-Neutral-Variant);`);
      if (icons.Info) cssLines.push(`  --Icons-Info: var(--${prefix}-Icons-Info);`);
      if (icons['Info-Variant']) cssLines.push(`  --Icons-Info-Variant: var(--${prefix}-Icons-Info-Variant);`);
      if (icons.Success) cssLines.push(`  --Icons-Success: var(--${prefix}-Icons-Success);`);
      if (icons['Success-Variant']) cssLines.push(`  --Icons-Success-Variant: var(--${prefix}-Icons-Success-Variant);`);
      if (icons.Warning) cssLines.push(`  --Icons-Warning: var(--${prefix}-Icons-Warning);`);
      if (icons['Warning-Variant']) cssLines.push(`  --Icons-Warning-Variant: var(--${prefix}-Icons-Warning-Variant);`);
      if (icons.Error) cssLines.push(`  --Icons-Error: var(--${prefix}-Icons-Error);`);
      if (icons['Error-Variant']) cssLines.push(`  --Icons-Error-Variant: var(--${prefix}-Icons-Error-Variant);`);
    }
    
    // Tags
    cssLines.push(`  --Tags-Primary-BG: var(--${prefix}-Tags-Primary-BG);`);
    cssLines.push(`  --Tags-Primary-Text: var(--${prefix}-Tags-Primary-Text);`);
    cssLines.push(`  --Tags-Secondary-BG: var(--${prefix}-Tags-Secondary-BG);`);
    cssLines.push(`  --Tags-Secondary-Text: var(--${prefix}-Tags-Secondary-Text);`);
    cssLines.push(`  --Tags-Tertiary-BG: var(--${prefix}-Tags-Tertiary-BG);`);
    cssLines.push(`  --Tags-Tertiary-Text: var(--${prefix}-Tags-Tertiary-Text);`);
    cssLines.push(`  --Tags-Neutral-BG: var(--${prefix}-Tags-Neutral-BG);`);
    cssLines.push(`  --Tags-Neutral-Text: var(--${prefix}-Tags-Neutral-Text);`);
    cssLines.push(`  --Tags-Info-BG: var(--${prefix}-Tags-Info-BG);`);
    cssLines.push(`  --Tags-Info-Text: var(--${prefix}-Tags-Info-Text);`);
    cssLines.push(`  --Tags-Success-BG: var(--${prefix}-Tags-Success-BG);`);
    cssLines.push(`  --Tags-Success-Text: var(--${prefix}-Tags-Success-Text);`);
    cssLines.push(`  --Tags-Warning-BG: var(--${prefix}-Tags-Warning-BG);`);
    cssLines.push(`  --Tags-Warning-Text: var(--${prefix}-Tags-Warning-Text);`);
    cssLines.push(`  --Tags-Error-BG: var(--${prefix}-Tags-Error-BG);`);
    cssLines.push(`  --Tags-Error-Text: var(--${prefix}-Tags-Error-Text);`);
    
    cssLines.push('}');
    return cssLines.join('\n');
  };
  
  // Surface types with their selectors and prefixes
  // NOTE: All Surface variations reference base "Surfaces", all Container variations reference base "Containers"
  const surfaceTypes = [
    { key: 'Surface', selector: '', prefix: 'Surfaces', effects: 'Effect-Level-1' },
    { key: 'Surface-Dim', selector: 'Surface-Dim', prefix: 'Surfaces', effects: 'Effect-Level-1' },
    { key: 'Surface-Bright', selector: 'Surface-Bright', prefix: 'Surfaces', effects: 'Effect-Level-1' },
    { key: 'Container', selector: 'Container', prefix: 'Containers', effects: 'Effect-Level-2' },
    { key: 'Container-Low', selector: 'Container-Low', prefix: 'Containers', effects: 'Effect-Level-2' },
    { key: 'Container-Lowest', selector: 'Container-Lowest', prefix: 'Containers', effects: 'Effect-Level-2' },
    { key: 'Container-High', selector: 'Container-High', prefix: 'Containers', effects: 'Effect-Level-2' },
    { key: 'Container-Highest', selector: 'Container-Highest', prefix: 'Containers', effects: 'Effect-Level-2' }
  ];
  
  // Generate CSS for each surface type - UPDATED LOGIC
  surfaceTypes.forEach(({ key, selector, prefix, effects }) => {
    if (!surfacesContainers[key]) {
      console.log(`⚠️ Surface type ${key} not found`);
      return;
    }
    
    // Build selector - if selector is empty, use [data-surface], else [data-surface="value"]
    const fullSelector = selector ? `[data-surface="${selector}"]` : '[data-surface]';
    
    lines.push(`${fullSelector} {`);
    lines.push(`  --Background: var(--Surfaces-Surface);`);
    lines.push(`  --Header: var(--Surfaces-Header);`);
    lines.push(`  --Text: var(--Surfaces-Text);`);
    lines.push(`  --Quiet: var(--Surfaces-Quiet);`);
    lines.push(`  --Border: var(--Surfaces-Border);`);
    lines.push(`  --Border-Variant: var(--Surfaces-Border-Variant);`);
    lines.push(`  --Hotlink: var(--Surfaces-Hotlink);`);
    lines.push(`  --Hotlink-Visited: var(--Surfaces-Hotlink-Visited);`);
    lines.push(`  --Hover: var(--Surfaces-Hover);`);
    lines.push(`  --Pressed: var(--Surfaces-Pressed);`);
    lines.push(`  --Focus-Visible: var(--${prefix}-Focus-Visible);`);
    lines.push(`  --Effects: var(--${effects});`);
    lines.push(`  --Buttons-Primary-Button: var(--${prefix}-Buttons-Primary-Button);`);
    lines.push(`  --Buttons-Primary-Text: var(--${prefix}-Buttons-Primary-Text);`);
    lines.push(`  --Buttons-Primary-Border: var(--${prefix}-Buttons-Primary-Border);`);
    lines.push(`  --Buttons-Primary-Hover: var(--${prefix}-Buttons-Primary-Hover);`);
    lines.push(`  --Buttons-Primary-Pressed: var(--${prefix}-Buttons-Primary-Pressed);`);
    lines.push(`  --Buttons-Primary-Highlight: var(--${prefix}-Buttons-Primary-Highlight);`);
    lines.push(`  --Buttons-Primary-Lowlight: var(--${prefix}-Buttons-Primary-Lowlight);`);
    lines.push(`  --Buttons-Primary-Outline-Button: var(--${prefix}-Buttons-Primary-Outline-Button);`);
    lines.push(`  --Buttons-Primary-Outline-Text: var(--${prefix}-Buttons-Primary-Outline-Text);`);
    lines.push(`  --Buttons-Primary-Outline-Border: var(--${prefix}-Buttons-Primary-Outline-Border);`);
    lines.push(`  --Buttons-Primary-Outline-Hover: var(--${prefix}-Buttons-Primary-Outline-Hover);`);
    lines.push(`  --Buttons-Primary-Outline-Pressed: var(--${prefix}-Buttons-Primary-Outline-Pressed);`);
    lines.push(`  --Buttons-Primary-Light-Button: var(--${prefix}-Buttons-Primary-Light-Button);`);
    lines.push(`  --Buttons-Primary-Light-Text: var(--${prefix}-Buttons-Primary-Light-Text);`);
    lines.push(`  --Buttons-Primary-Light-Border: var(--${prefix}-Buttons-Primary-Light-Border);`);
    lines.push(`  --Buttons-Primary-Light-Hover: var(--${prefix}-Buttons-Primary-Light-Hover);`);
    lines.push(`  --Buttons-Primary-Light-Pressed: var(--${prefix}-Buttons-Primary-Light-Pressed);`);
    lines.push(`  --Buttons-Secondary-Button: var(--${prefix}-Buttons-Secondary-Button);`);
    lines.push(`  --Buttons-Secondary-Text: var(--${prefix}-Buttons-Secondary-Text);`);
    lines.push(`  --Buttons-Secondary-Border: var(--${prefix}-Buttons-Secondary-Border);`);
    lines.push(`  --Buttons-Secondary-Hover: var(--${prefix}-Buttons-Secondary-Hover);`);
    lines.push(`  --Buttons-Secondary-Pressed: var(--${prefix}-Buttons-Secondary-Pressed);`);
    lines.push(`  --Buttons-Secondary-Highlight: var(--${prefix}-Buttons-Secondary-Highlight);`);
    lines.push(`  --Buttons-Secondary-Lowlight: var(--${prefix}-Buttons-Secondary-Lowlight);`);
    lines.push(`  --Buttons-Tertiary-Button: var(--${prefix}-Buttons-Tertiary-Button);`);
    lines.push(`  --Buttons-Tertiary-Text: var(--${prefix}-Buttons-Tertiary-Text);`);
    lines.push(`  --Buttons-Tertiary-Border: var(--${prefix}-Buttons-Tertiary-Border);`);
    lines.push(`  --Buttons-Tertiary-Hover: var(--${prefix}-Buttons-Tertiary-Hover);`);
    lines.push(`  --Buttons-Tertiary-Pressed: var(--${prefix}-Buttons-Tertiary-Pressed);`);
    lines.push(`  --Buttons-Tertiary-Highlight: var(--${prefix}-Buttons-Tertiary-Highlight);`);
    lines.push(`  --Buttons-Tertiary-Lowlight: var(--${prefix}-Buttons-Tertiary-Lowlight);`);
    lines.push(`  --Buttons-Neutral-Button: var(--${prefix}-Buttons-Neutral-Button);`);
    lines.push(`  --Buttons-Neutral-Text: var(--${prefix}-Buttons-Neutral-Text);`);
    lines.push(`  --Buttons-Neutral-Border: var(--${prefix}-Buttons-Neutral-Border);`);
    lines.push(`  --Buttons-Neutral-Hover: var(--${prefix}-Buttons-Neutral-Hover);`);
    lines.push(`  --Buttons-Neutral-Pressed: var(--${prefix}-Buttons-Neutral-Pressed);`);
    lines.push(`  --Buttons-Neutral-Highlight: var(--${prefix}-Buttons-Neutral-Highlight);`);
    lines.push(`  --Buttons-Neutral-Lowlight: var(--${prefix}-Buttons-Neutral-Lowlight);`);
    lines.push(`  --Buttons-Info-Button: var(--${prefix}-Buttons-Info-Button);`);
    lines.push(`  --Buttons-Info-Text: var(--${prefix}-Buttons-Info-Text);`);
    lines.push(`  --Buttons-Info-Border: var(--${prefix}-Buttons-Info-Border);`);
    lines.push(`  --Buttons-Info-Hover: var(--${prefix}-Buttons-Info-Hover);`);
    lines.push(`  --Buttons-Info-Pressed: var(--${prefix}-Buttons-Info-Pressed);`);
    lines.push(`  --Buttons-Info-Highlight: var(--${prefix}-Buttons-Info-Highlight);`);
    lines.push(`  --Buttons-Info-Lowlight: var(--${prefix}-Buttons-Info-Lowlight);`);
    const successPrefix = prefix.startsWith('Surface') ? 'Containers' : prefix;
    lines.push(`  --Buttons-Success-Button: var(--${successPrefix}-Buttons-Success-Button);`);
    lines.push(`  --Buttons-Success-Text: var(--${prefix}-Buttons-Success-Text);`);
    lines.push(`  --Buttons-Success-Border: var(--${prefix}-Buttons-Success-Border);`);
    lines.push(`  --Buttons-Success-Hover: var(--${prefix}-Buttons-Success-Hover);`);
    lines.push(`  --Buttons-Success-Pressed: var(--${prefix}-Buttons-Success-Pressed);`);
    lines.push(`  --Buttons-Success-Highlight: var(--${prefix}-Buttons-Success-Highlight);`);
    lines.push(`  --Buttons-Success-Lowlight: var(--${prefix}-Buttons-Success-Lowlight);`);
    lines.push(`  --Buttons-Warning-Button: var(--${prefix}-Buttons-Warning-Button);`);
    lines.push(`  --Buttons-Warning-Text: var(--${prefix}-Buttons-Warning-Text);`);
    lines.push(`  --Buttons-Warning-Border: var(--${prefix}-Buttons-Warning-Border);`);
    lines.push(`  --Buttons-Warning-Hover: var(--${prefix}-Buttons-Warning-Hover);`);
    lines.push(`  --Buttons-Warning-Pressed: var(--${prefix}-Buttons-Warning-Pressed);`);
    lines.push(`  --Buttons-Warning-Highlight: var(--${prefix}-Buttons-Warning-Highlight);`);
    lines.push(`  --Buttons-Warning-Lowlight: var(--${prefix}-Buttons-Warning-Lowlight);`);
    lines.push(`  --Buttons-Error-Button: var(--${prefix}-Buttons-Error-Button);`);
    lines.push(`  --Buttons-Error-Text: var(--${prefix}-Buttons-Error-Text);`);
    lines.push(`  --Buttons-Error-Border: var(--${prefix}-Buttons-Error-Border);`);
    lines.push(`  --Buttons-Error-Hover: var(--${prefix}-Buttons-Error-Hover);`);
    lines.push(`  --Buttons-Error-Pressed: var(--${prefix}-Buttons-Error-Pressed);`);
    lines.push(`  --Buttons-Error-Highlight: var(--${prefix}-Buttons-Error-Highlight);`);
    lines.push(`  --Buttons-Error-Lowlight: var(--${prefix}-Buttons-Error-Lowlight);`);
    // Map Default icons to Neutral since Default palette is not generated
    lines.push(`  --Icons-Default: var(--${prefix}-Icons-Neutral);`);
    lines.push(`  --Icons-Default-Variant: var(--${prefix}-Icons-Neutral-Variant);`);
    lines.push(`  --Icons-Primary: var(--${prefix}-Icons-Primary);`);
    lines.push(`  --Icons-Primary-Variant: var(--${prefix}-Icons-Primary-Variant);`);
    lines.push(`  --Icons-Secondary: var(--${prefix}-Icons-Secondary);`);
    lines.push(`  --Icons-Secondary-Variant: var(--${prefix}-Icons-Secondary-Variant);`);
    lines.push(`  --Icons-Tertiary: var(--${prefix}-Icons-Tertiary);`);
    lines.push(`  --Icons-Tertiary-Variant: var(--${prefix}-Icons-Tertiary-Variant);`);
    lines.push(`  --Icons-Neutral: var(--${prefix}-Icons-Neutral);`);
    lines.push(`  --Icons-Neutral-Variant: var(--${prefix}-Icons-Neutral-Variant);`);
    lines.push(`  --Icons-Info: var(--${prefix}-Icons-Info);`);
    lines.push(`  --Icons-Info-Variant: var(--${prefix}-Icons-Info-Variant);`);
    lines.push(`  --Icons-Success: var(--${prefix}-Icons-Success);`);
    lines.push(`  --Icons-Success-Variant: var(--${prefix}-Icons-Success-Variant);`);
    lines.push(`  --Icons-Warning: var(--${prefix}-Icons-Warning);`);
    lines.push(`  --Icons-Warning-Variant: var(--${prefix}-Icons-Warning-Variant);`);
    lines.push(`  --Icons-Error: var(--${prefix}-Icons-Error);`);
    lines.push(`  --Icons-Error-Variant: var(--${prefix}-Icons-Error-Variant);`);
    lines.push(`  --Tags-Primary-BG: var(--${prefix}-Tags-Primary-BG);`);
    lines.push(`  --Tags-Primary-Text: var(--${prefix}-Tags-Primary-Text);`);
    lines.push(`  --Tags-Secondary-BG: var(--${prefix}-Tags-Secondary-BG);`);
    lines.push(`  --Tags-Secondary-Text: var(--${prefix}-Tags-Secondary-Text);`);
    lines.push(`  --Tags-Tertiary-BG: var(--${prefix}-Tags-Tertiary-BG);`);
    lines.push(`  --Tags-Tertiary-Text: var(--${prefix}-Tags-Tertiary-Text);`);
    lines.push(`  --Tags-Neutral-BG: var(--${prefix}-Tags-Neutral-BG);`);
    lines.push(`  --Tags-Neutral-Text: var(--${prefix}-Tags-Neutral-Text);`);
    lines.push(`  --Tags-Info-BG: var(--${prefix}-Tags-Info-BG);`);
    lines.push(`  --Tags-Info-Text: var(--${prefix}-Tags-Info-Text);`);
    lines.push(`  --Tags-Success-BG: var(--${prefix}-Tags-Success-BG);`);
    lines.push(`  --Tags-Success-Text: var(--${prefix}-Tags-Success-Text);`);
    lines.push(`  --Tags-Warning-BG: var(--${prefix}-Tags-Warning-BG);`);
    lines.push(`  --Tags-Warning-Text: var(--${prefix}-Tags-Warning-Text);`);
    lines.push(`  --Tags-Error-BG: var(--${prefix}-Tags-Error-BG);`);
    lines.push(`  --Tags-Error-Text: var(--${prefix}-Tags-Error-Text);`);
    lines.push('}');
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Generate Theme data-attribute CSS selectors
 * Maps Surfaces/Containers/Buttons to Theme variables
 * 
 * UPDATES (2026-02-27):
 * - Fixed variable naming: removed Themes-, Backgrounds-, Surfaces-, Containers- prefixes
 * - Changed Default theme selector to [data-theme][data-theme="Default"]
 * - Skip "Themes" and "Colors" intermediate levels in paths
 * - Support both "Themes" (plural) and "Theme" (singular) in JSON
 * 
 * STRUCTURE:
 * - Uses top-level Themes section (not Modes.{mode}.Theme)
 * - Themes contains: Default, Primary, Primary-Light, Primary-Medium, Primary-Dark,
 *   Secondary, Secondary-Light, Secondary-Medium, Secondary-Dark, Tertiary, Neutral,
 *   Info, Success, Warning, Error variants, App-Bar, Nav-Bar, Status
 * - Each theme has Surfaces and Containers with various color properties
 */
function generateThemeDataAttributesCSS(jsonData: any): string {
  // Use new template-based theme generation (imported at top of file)
  
  // Extract tone values from Metadata['Extracted-Tones'] section (from color assignment stage)
  const extractedTonesData = jsonData?.Metadata?.['Extracted-Tones'];
  const extractedTones = extractedTonesData ? {
    primary: extractedTonesData.Primary.value,
    secondary: extractedTonesData.Secondary.value,
    tertiary: extractedTonesData.Tertiary.value
  } : undefined;
  
  console.log('🎨 [generateThemeDataAttributesCSS] Reading extracted tones from Metadata:');
  console.log('  ├─ Has Metadata?', !!jsonData?.Metadata);
  console.log('  ├─ Has Extracted-Tones?', !!extractedTonesData);
  console.log('  ├─ Primary tone:', extractedTones?.primary);
  console.log('  ├─ Secondary tone:', extractedTones?.secondary);
  console.log('  └─ Tertiary tone:', extractedTones?.tertiary);
  
  // Extract button config from Metadata['Button-Config'] if available
  const buttonConfigData = jsonData?.Metadata?.['Button-Config'];
  const buttonConfig = buttonConfigData ? {
    defaultButtonType: buttonConfigData.DefaultButtonType?.value || 'primary',
    buttonBehavior: buttonConfigData.ButtonBehavior?.value || 'fixed'
  } : undefined;
  
  console.log('🔘 [generateThemeDataAttributesCSS] Reading button config from Metadata:');
  console.log('  ├─ Has Button-Config?', !!buttonConfigData);
  console.log('  ├─ Default button type:', buttonConfig?.defaultButtonType);
  console.log('  └─ Button behavior:', buttonConfig?.buttonBehavior);
  
  // Extract theme mode and container style from Metadata
  const themeMode = (jsonData?.Metadata?.['Theme-Mode']?.value as 'light' | 'dark') || 'light';
  const containerStyle = (jsonData?.Metadata?.['Container-Style']?.value as 'tonal' | 'professional') || 'tonal';
  
  console.log('🎭 [generateThemeDataAttributesCSS] Reading theme settings from Metadata:');
  console.log('  ├─ Theme mode:', themeMode);
  console.log('  └─ Container style:', containerStyle);
  
  // ===================================================================
  // CRITICAL FIX: Generate CSS from JSON Themes, NOT from templates!
  // The JSON is the source of truth - CSS must reflect JSON values
  // ===================================================================
  
  // Try to find themes in the JSON structure
  // Could be at jsonData.Modes.Light-Mode.Themes or jsonData.Modes.Dark-Mode.Themes
  let themes: any = null;
  if (jsonData.Modes) {
    if (jsonData.Modes['Light-Mode']?.Themes) {
      themes = jsonData.Modes['Light-Mode'].Themes;
      console.log('📦 [generateThemeDataAttributesCSS] Using Light-Mode Themes from JSON');
    } else if (jsonData.Modes['Dark-Mode']?.Themes) {
      themes = jsonData.Modes['Dark-Mode'].Themes;
      console.log('📦 [generateThemeDataAttributesCSS] Using Dark-Mode Themes from JSON');
    }
  }
  
  // Fallback to template generation if no JSON themes found
  if (!themes) {
    console.warn('⚠️ [generateThemeDataAttributesCSS] No Themes found in JSON - using template fallback');
    return generateAllThemesCSS(extractedTones, buttonConfig, themeMode, containerStyle);
  }
  
  console.log('✅ [generateThemeDataAttributesCSS] Found themes in JSON:', Object.keys(themes).length, 'themes');
  
  const lines: string[] = [];
  
  // Header
  lines.push('/* ========================================');
  lines.push(' * Theme Data Attributes');
  lines.push(' * Use data-theme attribute to apply themed colors');
  lines.push(' * Generated from JSON Themes section');
  lines.push(' * ======================================== */');
  lines.push('');
  
  // Helper function to recursively process theme data and output CSS variables
  // Skip 'Colors' and 'Themes' intermediate levels (2026-02-27 update)
  const processThemeData = (obj: any, prefix: string, lines: string[], indent: string = '  ') => {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      
      // If it has a "value" property, it's a leaf node
      if (value && typeof value === 'object' && value.value !== undefined) {
        const fullPath = prefix ? `${prefix}-${key}` : key;
        // Generate variable name (clean, without Themes- prefix)
        const cssVar = `${indent}--${fullPath}: ${tokenToVar(value.value)};`;
        lines.push(cssVar);
        
        // Log Buttons and Tag variables for debugging
        if (fullPath.includes('Buttons-') || fullPath.includes('Tag-')) {
          console.log(`      🎨 Generated CSS: ${cssVar.trim()}`);
        }
      }
      // Skip Charts — they belong in :root, not in theme selectors
      else if (key === 'Charts' || key === 'Chart-BG' || key === 'Chart-Lines') {
        // Charts are global and already output in :root
      }
      // Dropshadow-Color — pass through from JSON (already computed as RGB values)
      // Skip surface variants — they get their own selectors below
      else if (key === 'Surfaces-Dim' || key === 'Surfaces-Dimmest' || key === 'Surfaces-Bright') {
        // Handled as separate descendant selectors after the main theme block
      }
      // Containers get their own descendant selector — skip here
      else if (key === 'Containers') {
        // Handled as separate [data-surface^="Container"] selector after the main theme block
      }
      // If the key is 'Colors', 'Themes', or 'Surfaces', skip it and process children directly
      else if (key === 'Colors' || key === 'Themes' || key === 'Surfaces') {
        if (key === 'Surfaces') {
          console.log(`    🔍 Processing ${key} section (skipping level, processing children)...`);
        }
        processThemeData(value, prefix, lines, indent);
      }
      // Otherwise, recurse deeper
      else if (value && typeof value === 'object') {
        const newPrefix = prefix ? `${prefix}-${key}` : key;
        if (key === 'Buttons' || key === 'Tag') {
          console.log(`    ➡️  Found ${key} section, processing with prefix: "${newPrefix}"`);
        }
        processThemeData(value, newPrefix, lines, indent);
      }
    });
  };
  
  // All theme variants to generate
  const themeVariants = [
    { name: 'Default', selector: ':root' },
    { name: 'Primary', selector: '[data-theme="Primary"],\n[data-theme="Primary"][data-surface="Surface"]' },
    { name: 'Primary-Light', selector: '[data-theme="Primary-Light"],\n[data-theme="Primary-Light"][data-surface="Surface"]' },
    { name: 'Primary-Medium', selector: '[data-theme="Primary-Medium"],\n[data-theme="Primary-Medium"][data-surface="Surface"]' },
    { name: 'Primary-Dark', selector: '[data-theme="Primary-Dark"],\n[data-theme="Primary-Dark"][data-surface="Surface"]' },
    { name: 'Secondary', selector: '[data-theme="Secondary"],\n[data-theme="Secondary"][data-surface="Surface"]' },
    { name: 'Secondary-Light', selector: '[data-theme="Secondary-Light"],\n[data-theme="Secondary-Light"][data-surface="Surface"]' },
    { name: 'Secondary-Medium', selector: '[data-theme="Secondary-Medium"],\n[data-theme="Secondary-Medium"][data-surface="Surface"]' },
    { name: 'Secondary-Dark', selector: '[data-theme="Secondary-Dark"],\n[data-theme="Secondary-Dark"][data-surface="Surface"]' },
    { name: 'Tertiary', selector: '[data-theme="Tertiary"],\n[data-theme="Tertiary"][data-surface="Surface"]' },
    { name: 'Tertiary-Light', selector: '[data-theme="Tertiary-Light"],\n[data-theme="Tertiary-Light"][data-surface="Surface"]' },
    { name: 'Tertiary-Medium', selector: '[data-theme="Tertiary-Medium"],\n[data-theme="Tertiary-Medium"][data-surface="Surface"]' },
    { name: 'Tertiary-Dark', selector: '[data-theme="Tertiary-Dark"],\n[data-theme="Tertiary-Dark"][data-surface="Surface"]' },
    { name: 'Neutral', selector: '[data-theme="Neutral"],\n[data-theme="Neutral"][data-surface="Surface"]' },
    { name: 'Neutral-Light', selector: '[data-theme="Neutral-Light"],\n[data-theme="Neutral-Light"][data-surface="Surface"]' },
    { name: 'Neutral-Medium', selector: '[data-theme="Neutral-Medium"],\n[data-theme="Neutral-Medium"][data-surface="Surface"]' },
    { name: 'Neutral-Dark', selector: '[data-theme="Neutral-Dark"],\n[data-theme="Neutral-Dark"][data-surface="Surface"]' },
    { name: 'Info-Light', selector: '[data-theme="Info-Light"],\n[data-theme="Info-Light"][data-surface="Surface"]' },
    { name: 'Info-Medium', selector: '[data-theme="Info-Medium"],\n[data-theme="Info-Medium"][data-surface="Surface"]' },
    { name: 'Info-Dark', selector: '[data-theme="Info-Dark"],\n[data-theme="Info-Dark"][data-surface="Surface"]' },
    { name: 'Success-Light', selector: '[data-theme="Success-Light"],\n[data-theme="Success-Light"][data-surface="Surface"]' },
    { name: 'Success-Medium', selector: '[data-theme="Success-Medium"],\n[data-theme="Success-Medium"][data-surface="Surface"]' },
    { name: 'Success-Dark', selector: '[data-theme="Success-Dark"],\n[data-theme="Success-Dark"][data-surface="Surface"]' },
    { name: 'Warning-Light', selector: '[data-theme="Warning-Light"],\n[data-theme="Warning-Light"][data-surface="Surface"]' },
    { name: 'Warning-Medium', selector: '[data-theme="Warning-Medium"],\n[data-theme="Warning-Medium"][data-surface="Surface"]' },
    { name: 'Warning-Dark', selector: '[data-theme="Warning-Dark"],\n[data-theme="Warning-Dark"][data-surface="Surface"]' },
    { name: 'Error-Light', selector: '[data-theme="Error-Light"],\n[data-theme="Error-Light"][data-surface="Surface"]' },
    { name: 'Error-Medium', selector: '[data-theme="Error-Medium"],\n[data-theme="Error-Medium"][data-surface="Surface"]' },
    { name: 'Error-Dark', selector: '[data-theme="Error-Dark"],\n[data-theme="Error-Dark"][data-surface="Surface"]' },
    { name: 'App-Bar', selector: '[data-theme="App-Bar"],\n[data-theme="App-Bar"][data-surface="Surface"]' },
    { name: 'Nav-Bar', selector: '[data-theme="Nav-Bar"],\n[data-theme="Nav-Bar"][data-surface="Surface"]' },
    { name: 'Status', selector: '[data-theme="Status"],\n[data-theme="Status"][data-surface="Surface"]' }
  ];
  
  themeVariants.forEach(({ name, selector }) => {
    if (themes[name]) {
      lines.push(`${selector} {`);
      lines.push(`  /* ${name} Theme */`);
      
      // Log theme structure for debugging
      const themeKeys = Object.keys(themes[name]);
      console.log(`  📋 [${name}] Theme has sections:`, themeKeys);
      if (themes[name].Surfaces) {
        const surfaceKeys = Object.keys(themes[name].Surfaces);
        console.log(`    └─ Surfaces contains:`, surfaceKeys.slice(0, 10), surfaceKeys.length > 10 ? `... (${surfaceKeys.length} total)` : '');
        if (themes[name].Surfaces.Buttons) {
          console.log(`      ✓ Surfaces.Buttons found with keys:`, Object.keys(themes[name].Surfaces.Buttons));
        }
        if (themes[name].Surfaces.Tag) {
          console.log(`      ✓ Surfaces.Tag found with keys:`, Object.keys(themes[name].Surfaces.Tag));
        }
      }
      if (themes[name].Containers) {
        const containerKeys = Object.keys(themes[name].Containers);
        console.log(`    └─ Containers contains:`, containerKeys.slice(0, 10), containerKeys.length > 10 ? `... (${containerKeys.length} total)` : '');
        if (themes[name].Containers.Buttons) {
          console.log(`      ✓ Containers.Buttons found with keys:`, Object.keys(themes[name].Containers.Buttons));
        }
        if (themes[name].Containers.Tag) {
          console.log(`      ✓ Containers.Tag found with keys:`, Object.keys(themes[name].Containers.Tag));
        }
      }
      
      processThemeData(themes[name], '', lines);
      // Dropshadow-Color comes from JSON via processThemeData above

      lines.push('}');
      lines.push('');

      // Containers as descendant selector
      const contData = themes[name]?.Containers;
      if (contData && typeof contData === 'object') {
        lines.push(`[data-theme="${name}"] [data-surface^="Container"],`);
        lines.push(`[data-theme="${name}"][data-surface^="Container"] {`);
        const contLines: string[] = [];
        processThemeData(contData, '', contLines);
        lines.push(...contLines);
        // Dropshadow-Color comes from JSON via processThemeData above
        lines.push('}');
        lines.push('');
      }
    }
  });
  
  return lines.join('\n');
}