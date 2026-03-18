// Font style category mappings - these map the fontStyles to actual Google Font families
// For moods without customFonts, we use these default font style categories

export const fontStyleToFontsMapping: Record<string, string[]> = {
  "Calm": [
    "Lora",
    "Merriweather",
    "Open Sans",
    "Roboto",
    "Nunito",
    "Source Sans Pro",
    "PT Sans",
    "Crimson Text",
    "Libre Baskerville",
    "Karla"
  ],
  "Business": [
    "Roboto",
    "Montserrat",
    "Lato",
    "Open Sans",
    "Source Sans Pro",
    "Work Sans",
    "Inter",
    "IBM Plex Sans",
    "Public Sans",
    "Helvetica"
  ],
  "Happy": [
    "Poppins",
    "Quicksand",
    "Baloo 2",
    "Fredoka",
    "Nunito",
    "Varela Round",
    "Comfortaa",
    "Pacifico",
    "Lobster",
    "Righteous"
  ],
  "Childlike": [
    "Comic Neue",
    "Bubblegum Sans",
    "Short Stack",
    "Patrick Hand",
    "Indie Flower",
    "Fredoka One",
    "Chewy",
    "Sniglet",
    "Mali",
    "Baloo 2"
  ],
  "Stiff": [
    "Courier New",
    "Courier Prime",
    "Roboto Mono",
    "IBM Plex Mono",
    "Source Code Pro",
    "Space Mono",
    "Anonymous Pro",
    "Inconsolata",
    "PT Mono",
    "Nanum Gothic Coding"
  ],
  "Loud": [
    "Impact",
    "Anton",
    "Bebas Neue",
    "Alfa Slab One",
    "Black Ops One",
    "Bungee",
    "Righteous",
    "Oswald",
    "Passion One",
    "Archivo Black"
  ],
  "Active": [
    "Roboto",
    "Montserrat",
    "Raleway",
    "Oswald",
    "Ubuntu",
    "Exo 2",
    "Saira",
    "Barlow",
    "Titillium Web",
    "Hind"
  ],
  "Elegant": [
    "Playfair Display",
    "Cormorant",
    "Cinzel",
    "Great Vibes",
    "Tangerine",
    "Dancing Script",
    "Allura",
    "Parisienne",
    "Bodoni Moda",
    "Libre Baskerville"
  ],
  "Playful": [
    "Fredoka",
    "Baloo 2",
    "Quicksand",
    "Varela Round",
    "Comfortaa",
    "Signika",
    "Nunito",
    "Jost",
    "Poppins",
    "Josefin Sans"
  ],
  "Artistic": [
    "Libre Baskerville",
    "Abril Fatface",
    "Philosopher",
    "Belleza",
    "Yeseva One",
    "Amiri",
    "Cormorant",
    "Spectral",
    "Alegreya",
    "Cardo"
  ],
  "Distressed": [
    "Special Elite",
    "Creepster",
    "Nosifer",
    "Metal Mania",
    "Eater",
    "Butcherman",
    "Rye",
    "Fontdiner Swanky",
    "Stalinist One",
    "Mountains of Christmas"
  ],
  "Permanent Marker": [
    "Permanent Marker",
    "Rock Salt",
    "Covered By Your Grace",
    "Amatic SC",
    "Shadows Into Light",
    "Indie Flower",
    "Patrick Hand",
    "Kalam",
    "Handlee",
    "Caveat"
  ],
  "Sophisticated": [
    "Playfair Display",
    "Cormorant",
    "Libre Baskerville",
    "Crimson Pro",
    "Lora",
    "EB Garamond",
    "Quattrocento",
    "Cardo",
    "Spectral",
    "Neuton"
  ]
};

// Helper function to get a random font from a style category or custom fonts
export function getRandomFontFromMood(
  fontStyles: string[],
  customFonts?: Array<{ "Font Name": string; "Type": string }> | string[]
): string {
  // If customFonts exist, use them
  if (customFonts && customFonts.length > 0) {
    const randomIndex = Math.floor(Math.random() * customFonts.length);
    const font = customFonts[randomIndex];
    
    // Handle both object format and string format
    if (typeof font === 'string') {
      return font;
    } else {
      return font["Font Name"];
    }
  }
  
  // Otherwise, use fontStyles to pick from mapped fonts
  if (fontStyles && fontStyles.length > 0) {
    // Filter out "Custom" from fontStyles
    const validStyles = fontStyles.filter(style => style !== "Custom");
    
    if (validStyles.length > 0) {
      // Pick a random style category
      const randomStyle = validStyles[Math.floor(Math.random() * validStyles.length)];
      const fontsForStyle = fontStyleToFontsMapping[randomStyle];
      
      if (fontsForStyle && fontsForStyle.length > 0) {
        return fontsForStyle[Math.floor(Math.random() * fontsForStyle.length)];
      }
    }
  }
  
  // Fallback to Inter
  return "Inter";
}

// Helper to get multiple unique fonts from a mood
export function getMultipleFontsFromMood(
  fontStyles: string[],
  customFonts?: Array<{ "Font Name": string; "Type": string }> | string[],
  count: number = 3
): string[] {
  const fonts: string[] = [];
  const usedFonts = new Set<string>();
  
  // Build pool of available fonts
  let fontPool: string[] = [];
  
  if (customFonts && customFonts.length > 0) {
    fontPool = customFonts.map(font => 
      typeof font === 'string' ? font : font["Font Name"]
    );
  } else if (fontStyles && fontStyles.length > 0) {
    const validStyles = fontStyles.filter(style => style !== "Custom");
    validStyles.forEach(style => {
      const fontsForStyle = fontStyleToFontsMapping[style];
      if (fontsForStyle) {
        fontPool.push(...fontsForStyle);
      }
    });
  }
  
  // If no fonts found, use fallbacks
  if (fontPool.length === 0) {
    fontPool = ["Inter", "Roboto", "Open Sans", "Lato", "Montserrat"];
  }
  
  // Shuffle and pick unique fonts
  const shuffled = [...fontPool].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    if (!usedFonts.has(shuffled[i])) {
      fonts.push(shuffled[i]);
      usedFonts.add(shuffled[i]);
    }
  }
  
  // Fill remaining if needed
  while (fonts.length < count && fonts.length < fontPool.length) {
    const randomFont = fontPool[Math.floor(Math.random() * fontPool.length)];
    if (!usedFonts.has(randomFont)) {
      fonts.push(randomFont);
      usedFonts.add(randomFont);
    }
  }
  
  return fonts;
}
