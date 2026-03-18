/**
 * Restructure Modes to match the expected order and generate Border-Variant from Border
 * 
 * Expected order:
 * 1. Colors
 * 2. Header
 * 3. Text  
 * 4. Quiet
 * 5. Border
 * 6. Border-Variant (generated from Border with 33 opacity)
 * 7. Hover
 * 8. Active
 * 9. Focus-Visible
 * 10. Icon
 * 11. Icon-Variant
 * 12. Tag
 * 13. Backgrounds
 * 14. Charts
 * 15. Primary-Buttons
 * 16. Buttons (must come before Themes)
 * 17. Default-Button (must come before Themes)
 * 18. Default-Button-Border (must come before Themes)
 * 19. Themes (must come after Buttons, Default-Button, Default-Button-Border)
 */

/**
 * Resolve a color reference to its actual hex value
 * Example: {Colors.Neutral.Color-6} → #242682
 */
function resolveColorReference(reference: string, colorSystem: any): string {
  // If it's already a hex color, return it
  if (reference.startsWith('#')) {
    return reference;
  }

  // If it's a reference like {Colors.Neutral.Color-6}
  if (reference.startsWith('{') && reference.endsWith('}')) {
    const path = reference.slice(1, -1); // Remove { }
    const parts = path.split('.');
    
    let value: any = colorSystem;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        console.warn(`⚠️ Could not resolve reference: ${reference}`);
        return '#00000033'; // Fallback with opacity
      }
    }

    // If we found a color token with .value
    if (value && typeof value === 'object' && value.value) {
      return value.value;
    }

    // If it's a direct string value
    if (typeof value === 'string') {
      return value;
    }
  }

  console.warn(`⚠️ Unknown color reference format: ${reference}`);
  return '#00000033'; // Fallback with opacity
}

/**
 * Add 33 to hex color for 20% opacity
 */
function addOpacity33(hexColor: string): string {
  // Remove # if present
  const cleanHex = hexColor.replace('#', '');
  
  // If already 8 digits, replace last 2 with 33
  if (cleanHex.length === 8) {
    return `#${cleanHex.slice(0, 6)}33`;
  }
  
  // Add 33 for opacity
  return `#${cleanHex}33`;
}

/**
 * Generate Border-Variant from Border by resolving references and adding 33 opacity
 */
function generateBorderVariant(border: any, colorSystem: any): any {
  const borderVariant: any = {
    Surfaces: {},
    Containers: {}
  };

  // Process Surfaces
  if (border.Surfaces) {
    Object.keys(border.Surfaces).forEach(colorKey => {
      borderVariant.Surfaces[colorKey] = {};
      
      Object.keys(border.Surfaces[colorKey]).forEach(bgKey => {
        const borderValue = border.Surfaces[colorKey][bgKey].value;
        const resolvedColor = resolveColorReference(borderValue, colorSystem);
        const withOpacity = addOpacity33(resolvedColor);
        
        borderVariant.Surfaces[colorKey][bgKey] = {
          value: withOpacity,
          type: 'color'
        };
      });
    });
  }

  // Process Containers
  if (border.Containers) {
    Object.keys(border.Containers).forEach(colorKey => {
      borderVariant.Containers[colorKey] = {};
      
      Object.keys(border.Containers[colorKey]).forEach(bgKey => {
        const borderValue = border.Containers[colorKey][bgKey].value;
        const resolvedColor = resolveColorReference(borderValue, colorSystem);
        const withOpacity = addOpacity33(resolvedColor);
        
        borderVariant.Containers[colorKey][bgKey] = {
          value: withOpacity,
          type: 'color'
        };
      });
    });
  }

  return borderVariant;
}

/**
 * Restructure a single mode to match expected order
 */
function restructureSingleMode(mode: any, colorSystem: any): any {
  const restructured: any = {};

  // 1. Colors
  if (mode.Colors) {
    restructured.Colors = mode.Colors;
  }

  // 2. Header
  if (mode.Header) {
    restructured.Header = mode.Header;
  }

  // 3. Text
  if (mode.Text) {
    restructured.Text = mode.Text;
  }

  // 4. Quiet
  if (mode.Quiet) {
    restructured.Quiet = mode.Quiet;
  }

  // 5. Border
  if (mode.Border) {
    restructured.Border = mode.Border;
  }

  // 6. Border-Variant (generate from Border)
  if (mode.Border) {
    restructured['Border-Variant'] = generateBorderVariant(mode.Border, mode); // Pass mode instead of colorSystem to resolve references within the mode
    console.log(`✅ Generated Border-Variant for mode`);
  }

  // 7. Hover
  if (mode.Hover) {
    restructured.Hover = mode.Hover;
  }

  // 8. Active
  if (mode.Active) {
    restructured.Active = mode.Active;
  }

  // 9. Focus-Visible
  if (mode['Focus-Visible']) {
    restructured['Focus-Visible'] = mode['Focus-Visible'];
  }

  // 10. Icon (singular)
  if (mode.Icon) {
    restructured.Icon = mode.Icon;
  }

  // 11. Icon-Variant (must come right after Icon)
  if (mode['Icon-Variant']) {
    restructured['Icon-Variant'] = mode['Icon-Variant'];
  }

  // 12. Tag (singular)
  if (mode.Tag) {
    restructured.Tag = mode.Tag;
  }

  // 13. Backgrounds
  if (mode.Backgrounds) {
    restructured.Backgrounds = mode.Backgrounds;
  }

  // 14. Charts
  if (mode.Charts) {
    restructured.Charts = mode.Charts;
  }

  // 15. Primary-Buttons
  if (mode['Primary-Buttons']) {
    restructured['Primary-Buttons'] = mode['Primary-Buttons'];
  }

  // 16. Buttons (must come before Themes)
  if (mode.Buttons) {
    restructured.Buttons = mode.Buttons;
  }

  // 17. Default-Button (must come before Themes)
  if (mode['Default-Button']) {
    restructured['Default-Button'] = mode['Default-Button'];
  }

  // 18. Default-Button-Border (must come before Themes)
  if (mode['Default-Button-Border']) {
    restructured['Default-Button-Border'] = mode['Default-Button-Border'];
  }

  // 19. Themes (must come after Buttons, Default-Button, Default-Button-Border)
  if (mode.Themes) {
    restructured.Themes = mode.Themes;
  }

  // Keep any remaining properties that weren't explicitly ordered
  Object.keys(mode).forEach(key => {
    if (!restructured[key]) {
      restructured[key] = mode[key];
    }
  });

  return restructured;
}

/**
 * Restructure all Modes in the design system
 */
export function restructureModes(designSystem: any): any {
  console.log('🔄 Restructuring Modes to correct order...');

  const restructuredSystem = { ...designSystem };

  if (restructuredSystem.Modes) {
    // Restructure each mode
    if (restructuredSystem.Modes['Light-Mode']) {
      console.log('  🔧 Restructuring Light-Mode...');
      restructuredSystem.Modes['Light-Mode'] = restructureSingleMode(
        restructuredSystem.Modes['Light-Mode'],
        restructuredSystem
      );
    }

    if (restructuredSystem.Modes['Dark-Mode']) {
      console.log('  🔧 Restructuring Dark-Mode...');
      restructuredSystem.Modes['Dark-Mode'] = restructureSingleMode(
        restructuredSystem.Modes['Dark-Mode'],
        restructuredSystem
      );
    }
  }

  console.log('✅ Modes restructured successfully');
  return restructuredSystem;
}