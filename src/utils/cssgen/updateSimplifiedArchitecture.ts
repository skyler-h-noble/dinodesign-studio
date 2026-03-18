/**
 * Utility to update design-system.json with the new simplified architecture
 * Updates Mode/Colors, Mode/Border-Variant, and Theme structures based on background selection
 */

import type { DesignSystem } from '../../types/designSystem';

/**
 * Helper function to convert tone value to Color-N number
 * NEW 14-TONE SYSTEM: [1, 10, 19, 28, 37, 46.6, 53, 62, 71, 81, 90, 95, 98, 99]
 *                      1   2   3   4   5    6    7   8   9  10  11  12  13  14
 */
function toneToColorNumber(tone: number): number {
  const toneScale = [1, 10, 19, 28, 37, 46.6, 53, 62, 71, 81, 90, 95, 98, 99];
  
  // Find exact match
  const exactIndex = toneScale.findIndex(t => Math.abs(t - tone) < 0.1);
  if (exactIndex !== -1) {
    return exactIndex + 1; // Color-1 through Color-14
  }
  
  // Find closest tone
  let closestIndex = 0;
  let minDiff = Math.abs(toneScale[0] - tone);
  for (let i = 1; i < toneScale.length; i++) {
    const diff = Math.abs(toneScale[i] - tone);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = i;
    }
  }
  
  return closestIndex + 1; // Color-N (1-14)
}

// Map background style to Theme and N values
export function getThemeAndNFromBackgroundStyle(
  backgroundStyle: 'light-tonal' | 'light-professional' | 'colorful' | 'dark',
  primaryColorN?: number
): { theme: string; n: number; colorName: string } {
  switch (backgroundStyle) {
    case 'light-tonal':
      return { theme: 'Primary', n: 13, colorName: 'Default' };
    
    case 'light-professional':
      return { theme: 'Neutral', n: 14, colorName: 'Default' };
    
    case 'colorful':
      return { 
        theme: 'Primary', 
        n: primaryColorN || 9, // Default to 9 if not provided
        colorName: 'Default' 
      };
    
    case 'dark':
      return { theme: 'Neutral', n: 1, colorName: 'Default' };
    
    default:
      return { theme: 'Primary', n: 13, colorName: 'Default' };
  }
}

/**
 * Add 40% opacity to a hex color (appends "66" to create an 8-digit hex)
 */
export function addOpacityToHex(hexColor: string, opacity: number = 0.4): string {
  // Remove # if present
  const cleanHex = hexColor.replace('#', '');
  
  // Calculate opacity hex (0-255 range)
  const opacityHex = Math.round(opacity * 255).toString(16).padStart(2, '0');
  
  // Return 8-digit hex color with opacity
  return `#${cleanHex}${opacityHex}`;
}

/**
 * Update Border-Variant values in Modes to use Border color with 40% opacity
 */
export function updateBorderVariantOpacity(designSystem: DesignSystem): DesignSystem {
  console.log('🎨 [Border-Variant] Updating opacity to 40%...');
  
  const updated = JSON.parse(JSON.stringify(designSystem));
  
  if (!updated.Modes) {
    console.warn('⚠️ [Border-Variant] No Modes found');
    return updated;
  }
  
  // Iterate through each mode
  Object.keys(updated.Modes).forEach(modeName => {
    const mode = updated.Modes[modeName];
    
    if (!mode['Border-Variant']) {
      console.warn(`⚠️ [Border-Variant] No Border-Variant found in ${modeName}`);
      return;
    }
    
    // Update Surfaces
    if (mode['Border-Variant'].Surfaces) {
      Object.keys(mode['Border-Variant'].Surfaces).forEach(colorKey => {
        const surfaceColors = mode['Border-Variant'].Surfaces[colorKey];
        
        Object.keys(surfaceColors).forEach(colorN => {
          const reference = surfaceColors[colorN].value;
          
          // Parse the reference to get the base Border color
          // Example: "{Border.Neutral.Surfaces.Color-1}"
          const match = reference.match(/\{Border\.([^.]+)\.Surfaces\.Color-(\d+)\}/);
          
          if (match) {
            const [, colorName, n] = match;
            
            // Update to reference the same Border color but extract the value and add opacity
            // For now, we'll update the reference to point to Colors with opacity notation
            // In the actual JSON, this should resolve to the Border color + 66 for opacity
            surfaceColors[colorN] = {
              ...surfaceColors[colorN],
              value: `{Border.${colorName}.Surfaces.Color-${n}}66` // Append 66 for 40% opacity
            };
          }
        });
      });
      
      console.log(`  ✓ [Border-Variant] Updated ${modeName}/Border-Variant/Surfaces`);
    }
    
    // Update Containers
    if (mode['Border-Variant'].Containers) {
      Object.keys(mode['Border-Variant'].Containers).forEach(colorKey => {
        const containerColors = mode['Border-Variant'].Containers[colorKey];
        
        Object.keys(containerColors).forEach(colorN => {
          const reference = containerColors[colorN].value;
          
          // Parse the reference to get the base Border color
          const match = reference.match(/\{Border\.Containers\.([^.]+)\.(?:Variant\.)?Color-(\d+)\}/);
          
          if (match) {
            const [, colorName, n] = match;
            
            containerColors[colorN] = {
              ...containerColors[colorN],
              value: `{Border.Containers.${colorName}.Color-${n}}66` // Append 66 for 40% opacity
            };
          }
        });
      });
      
      console.log(`  ✓ [Border-Variant] Updated ${modeName}/Border-Variant/Containers`);
    }
  });
  
  console.log('✅ [Border-Variant] Opacity update complete');
  return updated;
}

/**
 * Generate a complete theme structure with proper Theme and N substitution
 */
export function generateThemeStructure(
  theme: string,
  n: number,
  colorName: string
): any {
  return {
    "Surfaces": {
      "Surface": {
        "value": `{Backgrounds.${theme}.Background-${n}.Surfaces.Surface}`,
        "type": "color"
      },
      "Surface-Dim": {
        "value": `{Backgrounds.${theme}.Background-${n}.Surfaces.Surface-Dim}`,
        "type": "color"
      },
      "Surface-Bright": {
        "value": `{Backgrounds.${theme}.Background-${n}.Surfaces.Surface-Bright}`,
        "type": "color"
      },
      "Header": {
        "value": `{Header.Surfaces.${theme}.Color-${n}}`,
        "type": "color"
      },
      "Text": {
        "value": `{Text.Surfaces.${theme}.Color-${n}}`,
        "type": "color"
      },
      "Text-Quiet": {
        "value": `{Quiet.Surfaces.${theme}.Color-${n}}`,
        "type": "color"
      },
      "Border": {
        "value": `{Border.${theme}.Surfaces.Color-${n}}`,
        "type": "color"
      },
      "Border-Variant": {
        "value": `{Border-Variant.${theme}.Surfaces.Color-${n}}`,
        "type": "color"
      },
      "Hotlink": {
        "value": `{Text.Info.Surfaces.Color-${n}}`,
        "type": "color"
      },
      "Hotlink-Visited": {
        "value": `{Text.Hotlink-Visited.Surfaces.Color-${n}}`,
        "type": "color"
      },
      "Hover": {
        "value": `{Hover.${theme}.Surfaces.Color-${n}}`,
        "type": "color"
      },
      "Active": {
        "value": `{Active.${theme}.Surfaces.Color-${n}}`,
        "type": "color"
      },
      "Focus-Visible": {
        "value": `{Focus-Visible.Surfaces.Color-${n}}`,
        "type": "color"
      },
      "Buttons": {
        "Primary": {
          "Button": {
            "value": `{Primary-Buttons.Surfaces.Background-${n}.Button}`,
            "type": "color"
          },
          "Text": {
            "value": `{Primary-Buttons.Surfaces.Background-${n}.Text}`,
            "type": "color"
          },
          "Border": {
            "value": `{Primary-Buttons.Surfaces.Background-${n}.Border}`,
            "type": "color"
          },
          "Hover": {
            "value": `{Primary-Buttons.Surfaces.Background-${n}.Hover}`,
            "type": "color"
          },
          "Active": {
            "value": `{Primary-Buttons.Surfaces.Background-${n}.Active}`,
            "type": "color"
          }
        },
        "Primary-Light": {
          "Button": {
            "value": "{Colors.Primary.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Primary.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Primary.Surfaces.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Primary.Surfaces.Background-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Primary.Surfaces.Background-12}",
            "type": "color"
          }
        },
        "Primary-Outline": {
          "Button": {
            "value": "#00000000",
            "type": "color"
          },
          "Border": {
            "value": `{Border.Primary.Surfaces.Background-${n}}`,
            "type": "color"
          },
          "Text": {
            "value": `{Text.Surfaces.${theme}.Color-${n}}`,
            "type": "color"
          },
          "Hover": {
            "value": `{Hover.${theme}.Surfaces.Color-${n}}`,
            "type": "color"
          },
          "Active": {
            "value": `{Active.${theme}.Surfaces.Color-${n}}`,
            "type": "color"
          }
        },
        "Secondary": {
          "Button": {
            "value": "{Colors.Secondary.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Secondary.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Secondary.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Secondary.Surfaces.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Secondary.Surfaces.Color-12}",
            "type": "color"
          }
        },
        "Tertiary": {
          "Button": {
            "value": "{Colors.Tertiary.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Tertiary.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Tertiary.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Tertiary.Surfaces.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Tertiary.Surfaces.Color-12}",
            "type": "color"
          }
        },
        "Neutral": {
          "Button": {
            "value": "{Colors.Neutral.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Neutral.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Neutral.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Neutral.Surfaces.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Neutral.Surfaces.Color-12}",
            "type": "color"
          }
        },
        "Info": {
          "Button": {
            "value": "{Colors.Info.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Info.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Info.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Info.Surfaces.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Info.Surfaces.Color-12}",
            "type": "color"
          }
        },
        "Success": {
          "Button": {
            "value": "{Colors.Success.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Success.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Success.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Success.Surfaces.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Success.Surfaces.Color-12}",
            "type": "color"
          }
        },
        "Warning": {
          "Button": {
            "value": "{Colors.Warning.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Warning.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Warning.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Warning.Surfaces.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Warning.Surfaces.Color-12}",
            "type": "color"
          }
        },
        "Error": {
          "Button": {
            "value": "{Colors.Error.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Error.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Error.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Error.Surfaces.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Error.Surfaces.Color-12}",
            "type": "color"
          }
        }
      },
      "Icons": {
        "Default": {
          "value": `{Icon.Surfaces.Neutral.Color-${n}}`,
          "type": "color"
        },
        "Default-Variant": {
          "value": `{Icon-Variant.Surfaces.Neutral.Color-${n}}`,
          "type": "color"
        },
        "Primary": {
          "value": `{Icon.Surfaces.Primary.Color-${n}}`,
          "type": "color"
        },
        "Primary-Variant": {
          "value": `{Icon-Variant.Surfaces.Primary.Color-${n}}`,
          "type": "color"
        },
        "Secondary": {
          "value": `{Icon.Surfaces.Secondary.Color-${n}}`,
          "type": "color"
        },
        "Secondary-Variant": {
          "value": `{Icon-Variant.Surfaces.Secondary.Color-${n}}`,
          "type": "color"
        },
        "Tertiary": {
          "value": `{Icon.Surfaces.Tertiary.Color-${n}}`,
          "type": "color"
        },
        "Tertiary-Variant": {
          "value": `{Icon-Variant.Surfaces.Tertiary.Color-${n}}`,
          "type": "color"
        },
        "Neutral": {
          "value": `{Icon.Surfaces.Neutral.Color-${n}}`,
          "type": "color"
        },
        "Neutral-Variant": {
          "value": `{Icon-Variant.Surfaces.Neutral.Color-${n}}`,
          "type": "color"
        },
        "Info": {
          "value": `{Icon.Surfaces.Info.Color-${n}}`,
          "type": "color"
        },
        "Info-Variant": {
          "value": `{Icon-Variant.Surfaces.Info.Color-${n}}`,
          "type": "color"
        },
        "Success": {
          "value": `{Icon.Surfaces.Success.Color-${n}}`,
          "type": "color"
        },
        "Success-Variant": {
          "value": `{Icon-Variant.Surfaces.Success.Color-${n}}`,
          "type": "color"
        },
        "Warning": {
          "value": `{Icon.Surfaces.Warning.Color-${n}}`,
          "type": "color"
        },
        "Warning-Variant": {
          "value": `{Icon-Variant.Surfaces.Warning.Color-${n}}`,
          "type": "color"
        },
        "Error": {
          "value": `{Icon.Surfaces.Error.Color-${n}}`,
          "type": "color"
        },
        "Error-Variant": {
          "value": `{Icon-Variant.Surfaces.Error.Color-${n}}`,
          "type": "color"
        }
      },
      "Tags": {
        "Primary": {
          "BG": {
            "value": "{Tags.Primary.BG}",
            "type": "color"
          },
          "Text": {
            "value": "{Tags.Primary.Text}",
            "type": "color"
          }
        },
        "Secondary": {
          "BG": {
            "value": "{Tags.Secondary.BG}",
            "type": "color"
          },
          "Text": {
            "value": "{Tags.Secondary.Text}",
            "type": "color"
          }
        },
        "Tertiary": {
          "BG": {
            "value": "{Tags.Tertiary.BG}",
            "type": "color"
          },
          "Text": {
            "value": "{Tags.Tertiary.Text}",
            "type": "color"
          }
        },
        "Neutral": {
          "BG": {
            "value": "{Tags.Neutral.BG}",
            "type": "color"
          },
          "Text": {
            "value": "{Tags.Neutral.Text}",
            "type": "color"
          }
        },
        "Info": {
          "BG": {
            "value": "{Tags.Info.BG}",
            "type": "color"
          },
          "Text": {
            "value": "{Tags.Info.Text}",
            "type": "color"
          }
        },
        "Success": {
          "BG": {
            "value": "{Tags.Success.BG}",
            "type": "color"
          },
          "Text": {
            "value": "{Tags.Success.Text}",
            "type": "color"
          }
        },
        "Warning": {
          "BG": {
            "value": "{Tags.Warning.BG}",
            "type": "color"
          },
          "Text": {
            "value": "{Tags.Warning.Text}",
            "type": "color"
          }
        },
        "Error": {
          "BG": {
            "value": "{Tags.Error.BG}",
            "type": "color"
          },
          "Text": {
            "value": "{Tags.Error.Text}",
            "type": "color"
          }
        }
      }
    },
    "Containers": {
      "Container": {
        "value": `{Backgrounds.${theme}.Background-${n}.Containers.Container}`,
        "type": "color"
      },
      "Container-Lowest": {
        "value": `{Backgrounds.${theme}.Background-${n}.Containers.Container-Lowest}`,
        "type": "color"
      },
      "Container-Low": {
        "value": `{Backgrounds.${theme}.Background-${n}.Containers.Container-Low}`,
        "type": "color"
      },
      "Container-High": {
        "value": `{Backgrounds.${theme}.Background-${n}.Containers.Container-High}`,
        "type": "color"
      },
      "Container-Highest": {
        "value": `{Backgrounds.${theme}.Background-${n}.Containers.Container-Highest}`,
        "type": "color"
      },
      "Header": {
        "value": `{Header.Containers.${theme}.Color-${n}}`,
        "type": "color"
      },
      "Text": {
        "value": `{Text.Containers.${theme}.Color-${n}}`,
        "type": "color"
      },
      "Text-Quiet": {
        "value": `{Quiet.Containers.${theme}.Quiet.Color-${n}}`,
        "type": "color"
      },
      "Border": {
        "value": `{Border.Containers.${theme}.Color-${n}}`,
        "type": "color"
      },
      "Border-Variant": {
        "value": `{Border-Variant.Containers.${theme}.Variant.Color-${n}}`,
        "type": "color"
      },
      "Hotlink": {
        "value": `{Text.Info.Containers.Color-${n}}`,
        "type": "color"
      },
      "Hotlink-Visited": {
        "value": `{Text.Hotlink-Visited.Containers.Color-${n}}`,
        "type": "color"
      },
      "Hover": {
        "value": `{Hover.${theme}.Containers.Color-${n}}`,
        "type": "color"
      },
      "Active": {
        "value": `{Active.${theme}.Containers.Color-${n}}`,
        "type": "color"
      },
      "Focus-Visible": {
        "value": `{Focus-Visible.Containers.Color-${n}}`,
        "type": "color"
      },
      "Buttons": {
        "Primary": {
          "Button": {
            "value": `{Primary-Buttons.Containers.Background-${n}.Button}`,
            "type": "color"
          },
          "Text": {
            "value": `{Primary-Buttons.Containers.Background-${n}.Text}`,
            "type": "color"
          },
          "Border": {
            "value": `{Primary-Buttons.Containers.Background-${n}.Border}`,
            "type": "color"
          },
          "Hover": {
            "value": `{Primary-Buttons.Containers.Background-${n}.Hover}`,
            "type": "color"
          },
          "Active": {
            "value": `{Primary-Buttons.Containers.Background-${n}.Active}`,
            "type": "color"
          }
        },
        "Primary-Light": {
          "Button": {
            "value": "{Colors.Primary.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Primary.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Primary.Containers.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Primary.Containers.Background-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Primary.Containers.Background-12}",
            "type": "color"
          }
        },
        "Primary-Outline": {
          "Button": {
            "value": "#00000000",
            "type": "color"
          },
          "Border": {
            "value": `{Border.Primary.Containers.Background-${n}}`,
            "type": "color"
          },
          "Text": {
            "value": `{Text.Containers.${theme}.Color-${n}}`,
            "type": "color"
          },
          "Hover": {
            "value": `{Hover.${theme}.Containers.Color-${n}}`,
            "type": "color"
          },
          "Active": {
            "value": `{Active.${theme}.Containers.Color-${n}}`,
            "type": "color"
          }
        },
        "Secondary": {
          "Button": {
            "value": "{Colors.Secondary.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Secondary.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Secondary.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Secondary.Containers.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Secondary.Containers.Color-12}",
            "type": "color"
          }
        },
        "Tertiary": {
          "Button": {
            "value": "{Colors.Tertiary.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Tertiary.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Tertiary.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Tertiary.Containers.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Tertiary.Containers.Color-12}",
            "type": "color"
          }
        },
        "Neutral": {
          "Button": {
            "value": "{Colors.Neutral.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Neutral.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Neutral.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Neutral.Surfaces.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Neutral.Containers.Color-12}",
            "type": "color"
          }
        },
        "Info": {
          "Button": {
            "value": "{Colors.Info.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Info.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Info.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Info.Containers.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Info.Containers.Color-12}",
            "type": "color"
          }
        },
        "Success": {
          "Button": {
            "value": "{Colors.Success.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Success.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Success.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Success.Containers.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Success.Containers.Color-12}",
            "type": "color"
          }
        },
        "Warning": {
          "Button": {
            "value": "{Colors.Warning.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Warning.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Warning.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Warning.Containers.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Warning.Containers.Color-12}",
            "type": "color"
          }
        },
        "Error": {
          "Button": {
            "value": "{Colors.Error.Color-12}",
            "type": "color"
          },
          "Text": {
            "value": "{Text.Error.Color-12}",
            "type": "color"
          },
          "Border": {
            "value": "{Border.Error.Background-12}",
            "type": "color"
          },
          "Hover": {
            "value": "{Hover.Error.Containers.Color-12}",
            "type": "color"
          },
          "Active": {
            "value": "{Active.Error.Containers.Color-12}",
            "type": "color"
          }
        }
      },
      "Icons": {
        "Default": {
          "value": `{Icon.Containers.Neutral.Color-${n}}`,
          "type": "color"
        },
        "Default-Variant": {
          "value": `{Icon-Variant.Containers.Neutral.Color-${n}}`,
          "type": "color"
        },
        "Primary": {
          "value": `{Icon.Containers.Primary.Color-${n}}`,
          "type": "color"
        },
        "Primary-Variant": {
          "value": `{Icon-Variant.Containers.Primary.Color-${n}}`,
          "type": "color"
        },
        "Secondary": {
          "value": `{Icon.Containers.Secondary.Color-${n}}`,
          "type": "color"
        },
        "Secondary-Variant": {
          "value": `{Icon-Variant.Containers.Secondary.Color-${n}}`,
          "type": "color"
        },
        "Tertiary": {
          "value": `{Icon.Containers.Tertiary.Color-${n}}`,
          "type": "color"
        },
        "Tertiary-Variant": {
          "value": `{Icon-Variant.Containers.Tertiary.Color-${n}}`,
          "type": "color"
        },
        "Neutral": {
          "value": `{Icon.Containers.Neutral.Color-${n}}`,
          "type": "color"
        },
        "Neutral-Variant": {
          "value": `{Icon-Variant.Containers.Neutral.Color-${n}}`,
          "type": "color"
        },
        "Info": {
          "value": `{Icon.Containers.Info.Color-${n}}`,
          "type": "color"
        },
        "Info-Variant": {
          "value": `{Icon-Variant.Containers.Info.Color-${n}}`,
          "type": "color"
        },
        "Success": {
          "value": `{Icon.Containers.Success.Color-${n}}`,
          "type": "color"
        },
        "Success-Variant": {
          "value": `{Icon-Variant.Containers.Success.Color-${n}}`,
          "type": "color"
        },
        "Warning": {
          "value": `{Icon.Containers.Warning.Color-${n}}`,
          "type": "color"
        },
        "Warning-Variant": {
          "value": `{Icon-Variant.Containers.Warning.Color-${n}}`,
          "type": "color"
        },
        "Error": {
          "value": `{Icon.Containers.Error.Color-${n}}`,
          "type": "color"
        },
        "Error-Variant": {
          "value": `{Icon-Variant.Containers.Error.Color-${n}}`,
          "type": "color"
        }
      }
    }
  };
}

/**
 * Update all themes in the design system based on background style selection
 */
export function updateThemesWithBackgroundStyle(
  designSystem: DesignSystem,
  backgroundStyle: 'light-tonal' | 'light-professional' | 'colorful' | 'dark',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): DesignSystem {
  console.log('🎨 [Theme Update] Updating themes based on background style:', backgroundStyle);
  
  const updated = JSON.parse(JSON.stringify(designSystem));
  
  if (!updated.Modes) {
    console.warn('⚠️ [Theme Update] No Modes found');
    return updated;
  }
  
  // Get the primary color N value from extracted tones if available
  const primaryColorN = extractedTones?.primary;
  
  // Get Theme and N for Default theme
  const defaultThemeConfig = getThemeAndNFromBackgroundStyle(backgroundStyle, primaryColorN);
  
  // Iterate through each mode and update themes
  Object.keys(updated.Modes).forEach(modeName => {
    const mode = updated.Modes[modeName];
    
    if (!mode.Themes) {
      console.warn(`⚠️ [Theme Update] No Themes found in ${modeName}`);
      return;
    }
    
    // Update Default theme
    mode.Themes.Default = generateThemeStructure(
      defaultThemeConfig.theme,
      defaultThemeConfig.n,
      defaultThemeConfig.colorName
    );
    console.log(`  ✓ [Theme Update] Updated ${modeName}/Themes/Default → ${defaultThemeConfig.theme}, N=${defaultThemeConfig.n}`);
    
    // Update Primary-Base theme - uses Primary color with the extracted tone
    // Convert tone (e.g., 90) to Color-N (e.g., 11)
    const primaryTone = extractedTones?.primary || 71; // Default tone
    const primaryN = toneToColorNumber(primaryTone); // Convert tone to Color-N
    mode.Themes['Primary-Base'] = generateThemeStructure('Primary', primaryN, 'Primary-Base');
    console.log(`  ✓ [Theme Update] Updated ${modeName}/Themes/Primary-Base → Primary, tone ${primaryTone} → N=${primaryN}`);
    
    // Update Secondary-Base theme - uses Secondary color with the extracted tone
    const secondaryTone = extractedTones?.secondary || 71; // Default tone
    const secondaryN = toneToColorNumber(secondaryTone); // Convert tone to Color-N
    mode.Themes['Secondary-Base'] = generateThemeStructure('Secondary', secondaryN, 'Secondary-Base');
    console.log(`  ✓ [Theme Update] Updated ${modeName}/Themes/Secondary-Base → Secondary, tone ${secondaryTone} → N=${secondaryN}`);
    
    // Update Tertiary-Base theme - uses Tertiary color with the extracted tone
    const tertiaryTone = extractedTones?.tertiary || 71; // Default tone
    const tertiaryN = toneToColorNumber(tertiaryTone); // Convert tone to Color-N
    mode.Themes['Tertiary-Base'] = generateThemeStructure('Tertiary', tertiaryN, 'Tertiary-Base');
    console.log(`  ✓ [Theme Update] Updated ${modeName}/Themes/Tertiary-Base → Tertiary, tone ${tertiaryTone} → N=${tertiaryN}`);
  });
  
  console.log('✅ [Theme Update] All themes updated successfully');
  return updated;
}

/**
 * Main function to apply the simplified architecture updates
 */
export function applySimplifiedArchitecture(
  designSystem: DesignSystem,
  backgroundStyle: 'light-tonal' | 'light-professional' | 'colorful' | 'dark',
  extractedTones?: { primary: number; secondary: number; tertiary: number }
): DesignSystem {
  console.log('🏗️ [Simplified Architecture] Starting updates...');
  console.log('📋 [Simplified Architecture] Background Style:', backgroundStyle);
  console.log('📋 [Simplified Architecture] Extracted Tones:', extractedTones);
  
  let updated = JSON.parse(JSON.stringify(designSystem));
  
  // Step 1: Update Border-Variant with opacity
  updated = updateBorderVariantOpacity(updated);
  
  // Step 2: Update all themes based on background style
  updated = updateThemesWithBackgroundStyle(updated, backgroundStyle, extractedTones);
  
  console.log('✅ [Simplified Architecture] All updates complete!');
  return updated;
}
