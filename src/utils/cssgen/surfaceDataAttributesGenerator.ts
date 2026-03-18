/**
 * Convert a token reference to CSS var() syntax
 * Example: \"{Tones.Base.Surfaces.Surface-Dim}\" -> \"var(--Surfaces-Surface-Dim)\"
 * Example: \"{Themes.Base.Surfaces.Surface}\" -> \"var(--Base-Surfaces-Surface)\"
 * Example: \"#ffffff\" -> \"#ffffff\"
 */
function tokenToVar(tokenValue: string): string {
  if (!tokenValue) return '';
  
  // If it's a direct hex color, return as-is
  if (tokenValue.startsWith('#')) {
    return tokenValue;
  }
  
  // If it's a token reference (contains curly braces)
  if (tokenValue.includes('{') && tokenValue.includes('}')) {
    // Extract the token path: \"{Tones.Base.Surfaces.Surface-Dim}\" -> \"Tones.Base.Surfaces.Surface-Dim\"
    let tokenPath = tokenValue.replace(/[{}]/g, '');
    
    // Remove \"Themes.\" prefix if it exists
    // \"{Themes.Base.Surfaces.Surface}\" -> \"Base.Surfaces.Surface\"
    if (tokenPath.startsWith('Themes.')) {
      tokenPath = tokenPath.substring(7); // Remove \"Themes.\" (7 characters)
    }
    
    // Remove \"Tones.Base.\" prefix if it exists
    // \"{Tones.Base.Surfaces.Surface-Dim}\" -> \"Surfaces.Surface-Dim\"
    if (tokenPath.startsWith('Tones.Base.')) {
      tokenPath = tokenPath.substring(11); // Remove \"Tones.Base.\" (11 characters)
    }
    
    // Remove \"Tones.\" prefix if it exists  
    if (tokenPath.startsWith('Tones.')) {
      tokenPath = tokenPath.substring(6); // Remove \"Tones.\" (6 characters)
    }
    
    // Remove \"Colors.\" prefix if it exists
    if (tokenPath.startsWith('Colors.')) {
      tokenPath = tokenPath.substring(7); // Remove \"Colors.\" (7 characters)
    }
    
    // Convert to CSS variable format: \"Surfaces.Surface-Dim\" -> \"--Surfaces-Surface-Dim\"
    const cssVarName = '--' + tokenPath.replace(/\./g, '-');
    
    return `var(${cssVarName})`;
  }
  
  // If it's already a plain value, return as-is
  return tokenValue;
}

/**
 * Recursively process a surface object and generate CSS variable mappings
 * Reads from the JSON structure and converts references
 */
function processObjectToCSSVars(obj: any, indent: string = '  '): string[] {
  const lines: string[] = [];
  
  if (!obj || typeof obj !== 'object') return lines;
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    
    // Skip Effects object - it has different structure
    if (key === 'Effects') return;
    
    // If it has a "value" property, it's a token
    if (value && typeof value === 'object' && value.value !== undefined) {
      const cssVarName = key;
      const cssValue = tokenToVar(value.value);
      lines.push(`${indent}--${cssVarName}: ${cssValue};`);
    }
    // If it's a nested object (like Buttons, Icons, Tags), recurse
    else if (value && typeof value === 'object') {
      // Process nested properties
      const nestedLines = processNestedObject(value, key, indent);
      lines.push(...nestedLines);
    }
  });
  
  return lines;
}

/**
 * Process nested objects like Buttons.Primary.Button
 */
function processNestedObject(obj: any, parentKey: string, indent: string = '  '): string[] {
  const lines: string[] = [];
  
  if (!obj || typeof obj !== 'object') return lines;
  
  Object.keys(obj).forEach(childKey => {
    const childValue = obj[childKey];
    
    // If it has a "value" property, it's a token
    if (childValue && typeof childValue === 'object' && childValue.value !== undefined) {
      const cssVarName = `${parentKey}-${childKey}`;
      const cssValue = tokenToVar(childValue.value);
      lines.push(`${indent}--${cssVarName}: ${cssValue};`);
    }
    // If it's nested further (like Buttons.Primary.Button)
    else if (childValue && typeof childValue === 'object') {
      const deeperLines = processNestedObject(childValue, `${parentKey}-${childKey}`, indent);
      lines.push(...deeperLines);
    }
  });
  
  return lines;
}

/**
 * Generate data-surface attribute CSS selectors
 * This is the NEW implementation that reads from JSON instead of hardcoding
 */
export function generateSurfaceDataAttributesFromJSON(jsonData: any): string {
  if (!jsonData || !jsonData['SurfacesContainers']) {
    console.log('❌ No SurfacesContainers found in JSON');
    return '';
  }
  
  const lines: string[] = [];
  const surfacesContainers = jsonData['SurfacesContainers'];
  console.log('✅ Found SurfacesContainers, generating CSS from JSON references...');
  
  // Surface types with their selectors and effects levels
  const surfaceTypes = [
    { key: 'Surface', selector: '', effects: 'Effect-Level-1' },
    { key: 'Surface-Dim', selector: 'Surface-Dim', effects: 'Effect-Level-1' },
    { key: 'Surface-Bright', selector: 'Surface-Bright', effects: 'Effect-Level-1' },
    { key: 'Container', selector: 'Container', effects: 'Effect-Level-2' },
    { key: 'Container-Low', selector: 'Container-Low', effects: 'Effect-Level-2' },
    { key: 'Container-Lowest', selector: 'Container-Lowest', effects: 'Effect-Level-2' },
    { key: 'Container-High', selector: 'Container-High', effects: 'Effect-Level-2' },
    { key: 'Container-Highest', selector: 'Container-Highest', effects: 'Effect-Level-2' }
  ];
  
  // Generate CSS for each surface type
  surfaceTypes.forEach(({ key, selector, effects }) => {
    if (!surfacesContainers[key]) {
      console.log(`⚠️ Surface type ${key} not found in SurfacesContainers`);
      return;
    }
    
    const surfaceData = surfacesContainers[key];
    
    // Build selector - use [data-surface] [data-surface="..."] descendant pattern
    const fullSelector = selector ? `[data-surface] [data-surface=\"${selector}\"]` : '[data-surface] [data-surface=\"Surface\"]';
    
    lines.push('');
    lines.push(`${fullSelector} {`);
    
    // Process all properties dynamically from the JSON
    const cssVars = processObjectToCSSVars(surfaceData, '  ');
    lines.push(...cssVars);
    
    // Add Effects level
    lines.push(`  --Effects: var(--${effects});`);
    
    lines.push('}');
  });
  
  return lines.join('\n');
}

