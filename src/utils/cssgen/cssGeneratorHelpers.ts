/**
 * Helper functions for generating CSS variables from mode-specific sections
 */

/**
 * Convert token reference to CSS var() reference
 */
function tokenToVar(tokenRef: string): string {
  if (!tokenRef) return '';
  
  // If it's already a color value (hex, rgb, etc.), return as-is
  if (!tokenRef.startsWith('{')) return tokenRef;
  
  // Extract the token path from {Token.Path.Here}
  let path = tokenRef.replace(/[{}]/g, '');
  
  // Remove "Colors." prefix from color references
  // "{Colors.Neutral.Color-11}" -> "Neutral.Color-11"
  // "{Colors.Primary.Color-5}" -> "Primary.Color-5"
  if (path.startsWith('Colors.')) {
    path = path.substring(7); // Remove "Colors." (7 characters)
  }
  
  // Convert to CSS variable format: Token.Path.Here → --Token-Path-Here
  const cssVar = '--' + path.replace(/\./g, '-');
  
  return `var(${cssVar})`;
}

/**
 * Generate CSS variables for Header section
 * Handles nested structure like Header.Surfaces.Neutral.Color-1
 */
export function generateHeaderVariables(modeData: any): string {
  if (!modeData || !modeData.Header) return '';
  
  const lines: string[] = [];
  const header = modeData.Header;
  
  // Helper function to recursively process header objects
  const processHeaderObject = (obj: any, prefix: string) => {
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
        processHeaderObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process Surfaces
  if (header.Surfaces) {
    lines.push('  /* Header Surfaces */');
    Object.keys(header.Surfaces).forEach(palette => {
      // CRITICAL SAFETY CHECK: Skip "Default" palette name only
      // BW is VALID for Header variables
      if (palette === 'Default') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${palette}" in Header.Surfaces`);
        return;
      }
      processHeaderObject(header.Surfaces[palette], `--Header-Surfaces-${palette}`);
    });
  }
  
  // Add spacing between Surfaces and Containers
  if (header.Surfaces && header.Containers) {
    lines.push('');
  }
  
  // Process Containers
  if (header.Containers) {
    lines.push('  /* Header Containers */');
    Object.keys(header.Containers).forEach(palette => {
      // CRITICAL SAFETY CHECK: Skip "Default" palette name only
      // BW is VALID for Header variables
      if (palette === 'Default') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${palette}" in Header.Containers`);
        return;
      }
      processHeaderObject(header.Containers[palette], `--Header-Containers-${palette}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Quiet section
 * Handles nested structure like Quiet.Surfaces.Neutral.Color-1
 */
export function generateQuietVariables(modeData: any): string {
  if (!modeData || !modeData.Quiet) return '';
  
  const lines: string[] = [];
  const quiet = modeData.Quiet;
  
  // Helper function to recursively process quiet objects
  const processQuietObject = (obj: any, prefix: string) => {
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
        processQuietObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process Surfaces
  if (quiet.Surfaces) {
    lines.push('  /* Quiet Surfaces */');
    Object.keys(quiet.Surfaces).forEach(palette => {
      // CRITICAL SAFETY CHECK: Skip "Default" palette name only
      // BW is VALID for Quiet variables
      if (palette === 'Default') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${palette}" in Quiet.Surfaces`);
        return;
      }
      processQuietObject(quiet.Surfaces[palette], `--Quiet-Surfaces-${palette}`);
    });
  }
  
  // Add spacing between Surfaces and Containers
  if (quiet.Surfaces && quiet.Containers) {
    lines.push('');
  }
  
  // Process Containers
  if (quiet.Containers) {
    lines.push('  /* Quiet Containers */');
    Object.keys(quiet.Containers).forEach(palette => {
      // CRITICAL SAFETY CHECK: Skip "Default" palette name only
      // BW is VALID for Quiet variables
      if (palette === 'Default') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${palette}" in Quiet.Containers`);
        return;
      }
      processQuietObject(quiet.Containers[palette], `--Quiet-Containers-${palette}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Border section
 * Handles nested structure like Border.Surfaces.Neutral.Color-1
 */
export function generateBorderVariables(modeData: any): string {
  if (!modeData || !modeData.Border) return '';
  
  const lines: string[] = [];
  const border = modeData.Border;
  
  // Helper function to recursively process border objects
  const processBorderObject = (obj: any, prefix: string) => {
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
        processBorderObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process Surfaces
  if (border.Surfaces) {
    lines.push('  /* Border Surfaces */');
    Object.keys(border.Surfaces).forEach(palette => {
      // CRITICAL SAFETY CHECK: Skip "Default" palette name only
      // BW is VALID for Border variables
      if (palette === 'Default') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${palette}" in Border.Surfaces`);
        return;
      }
      processBorderObject(border.Surfaces[palette], `--Border-Surfaces-${palette}`);
    });
  }
  
  // Add spacing between Surfaces and Containers
  if (border.Surfaces && border.Containers) {
    lines.push('');
  }
  
  // Process Containers
  if (border.Containers) {
    lines.push('  /* Border Containers */');
    Object.keys(border.Containers).forEach(palette => {
      // CRITICAL SAFETY CHECK: Skip "Default" palette name only
      // BW is VALID for Border variables
      if (palette === 'Default') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${palette}" in Border.Containers`);
        return;
      }
      processBorderObject(border.Containers[palette], `--Border-Containers-${palette}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Border-Variant section
 * Handles nested structure like Border-Variant.Surfaces.Neutral.Color-1
 */
export function generateBorderVariantVariables(modeData: any): string {
  if (!modeData || !modeData['Border-Variant']) return '';
  
  const lines: string[] = [];
  const borderVariant = modeData['Border-Variant'];
  
  // Helper function to recursively process border variant objects
  const processBorderVariantObject = (obj: any, prefix: string) => {
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
        processBorderVariantObject(value, `${prefix}-${key}`);
      }
    });
  };
  
  // Process Surfaces
  if (borderVariant.Surfaces) {
    lines.push('  /* Border-Variant Surfaces */');
    Object.keys(borderVariant.Surfaces).forEach(palette => {
      // CRITICAL SAFETY CHECK: Skip "Default" palette name only
      // BW is VALID for Border-Variant variables
      if (palette === 'Default') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${palette}" in Border-Variant.Surfaces`);
        return;
      }
      processBorderVariantObject(borderVariant.Surfaces[palette], `--Border-Variant-Surfaces-${palette}`);
    });
  }
  
  // Add spacing between Surfaces and Containers
  if (borderVariant.Surfaces && borderVariant.Containers) {
    lines.push('');
  }
  
  // Process Containers
  if (borderVariant.Containers) {
    lines.push('  /* Border-Variant Containers */');
    Object.keys(borderVariant.Containers).forEach(palette => {
      // CRITICAL SAFETY CHECK: Skip "Default" palette name only
      // BW is VALID for Border-Variant variables
      if (palette === 'Default') {
        console.warn(`⚠️ [CSS Export] Skipping invalid palette name "${palette}" in Border-Variant.Containers`);
        return;
      }
      processBorderVariantObject(borderVariant.Containers[palette], `--Border-Variant-Containers-${palette}`);
    });
  }
  
  return lines.join('\n');
}

/**
 * Generate CSS variables for Charts section
 * Handles flat structure like Charts.Chart-BG, Charts.Chart-1, etc.
 */
export function generateChartsVariables(modeData: any): string {
  if (!modeData || !modeData.Charts) return '';
  
  const lines: string[] = [];
  const charts = modeData.Charts;
  
  lines.push('  /* Charts */');
  
  Object.keys(charts).forEach(chartKey => {
    const chartValue = charts[chartKey];
    if (chartValue && typeof chartValue === 'object' && chartValue.value !== undefined) {
      const cssValue = tokenToVar(chartValue.value);
      lines.push(`  --Charts-${chartKey}: ${cssValue};`);
    }
  });
  
  return lines.join('\n');
}