// Google Fonts API integration for fetching and managing fonts dynamically
import { moodFontMapping, type MoodName } from '../data/moodFontMapping';

export interface GoogleFont {
  family: string;
  category: string;
  variants: string[];
  subsets: string[];
}

// Google Fonts API key - using a public demo key (replace with your own for production)
// Get your API key at: https://developers.google.com/fonts/docs/developer_api
const GOOGLE_FONTS_API_KEY = 'AIzaSyDemoKeyForFigmaPluginUsage'; // Replace with actual key

// Fonts to exclude from selection (decorative/hard to read fonts)
const FONTS_TO_EXCLUDE = [
  'Almendra SC',
  'MedievalSharp',
  'UnifrakturMaguntia',
  'Unifraktur Maguntia',
  // EXCLUDE DynoDesign UI fonts from suggestions
  'Plus Jakarta Sans',
  'Inter'
];

// Curated list of 30 fonts for each style category (used when text is detected)
const CURATED_FONTS_BY_STYLE: Record<string, string[]> = {
  'Calligraphy, Formal': [
    'Tangerine', 'Great Vibes', 'Allura', 'Parisienne', 'Pinyon Script',
    'Alex Brush', 'Mr Dafoe', 'Rouge Script', 'Playlist', 'Marck Script',
    'Italianno', 'Berkshire Swash', 'Yesteryear', 'Sacramento', 'Aguafina Script',
    'Clicker Script', 'Meie Script', 'Qwigley', 'Mrs Saint Delafield', 'Mr De Haviland',
    'Herr Von Muellerhoff', 'Monsieur La Doulaise', 'Stalemate', 'Bilbo', 'Engagement',
    'La Belle Aurore', 'Dawning of a New Day', 'Petit Formal Script', 'Rochester', 'Sofia'
  ],
  'Calligraphy, Informal': [
    'Pacifico', 'Dancing Script', 'Satisfy', 'Cookie', 'Courgette',
    'Kaushan Script', 'Damion', 'Yellowtail', 'Norican', 'Ruthie',
    'Arizonia', 'Redressed', 'Niconne', 'Salsa', 'Zeyada',
    'Vibur', 'Euphoria Script', 'Bad Script', 'Leckerli One', 'Sriracha',
    'Covered By Your Grace', 'Crafty Girls', 'Loved by the King', 'Give You Glory', 'Short Stack',
    'Just Me Again Down Here', 'Over the Rainbow', 'Sunshiney', 'Butterfly Kids', 'Condiment'
  ],
  'Calligraphy, Upright': [
    'Caveat', 'Patrick Hand', 'Kalam', 'Indie Flower', 'Shadows Into Light',
    'Architects Daughter', 'Permanent Marker', 'Amatic SC', 'Gloria Hallelujah', 'Gochi Hand',
    'Reenie Beanie', 'Just Another Hand', 'Schoolbell', 'Coming Soon', 'Handlee',
    'Annie Use Your Telescope', 'Homemade Apple', 'Sue Ellen Francisco', 'Waiting for the Sunrise', 'Neucha',
    'Delius', 'Delius Swash Caps', 'Delius Unicase', 'Cabin Sketch', 'Special Elite',
    'Rock Salt', 'Short Stack', 'Sedgwick Ave', 'Sedgwick Ave Display', 'Sriracha'
  ],
  'Calligraphy, Handwritten': [
    'Caveat', 'Patrick Hand', 'Kalam', 'Indie Flower', 'Shadows Into Light',
    'Architects Daughter', 'Permanent Marker', 'Amatic SC', 'Gloria Hallelujah', 'Gochi Hand',
    'Reenie Beanie', 'Just Another Hand', 'Schoolbell', 'Coming Soon', 'Handlee',
    'Annie Use Your Telescope', 'Homemade Apple', 'Sue Ellen Francisco', 'Waiting for the Sunrise', 'Neucha',
    'Delius', 'Delius Swash Caps', 'Delius Unicase', 'Cabin Sketch', 'Special Elite',
    'Rock Salt', 'Short Stack', 'Sedgwick Ave', 'Sedgwick Ave Display', 'Sriracha'
  ],
  'Serif, Transitional': [
    'Lora', 'Crimson Text', 'Libre Baskerville', 'Merriweather', 'Spectral',
    'Vollkorn', 'Cardo', 'Gentium Book Basic', 'Neuton', 'Gelasio',
    'Crimson Pro', 'EB Garamond', 'Bitter', 'Alike', 'Linden Hill',
    'Kurale', 'Judson', 'Fanwood Text', 'Coustard', 'Andada Pro',
    'Brygada 1918', 'Vesper Libre', 'Rufina', 'Arapey', 'Alice',
    'Amethysta', 'Esteban', 'Lusitana', 'Mate', 'Poly'
  ],
  'Serif, Old Style': [
    'EB Garamond', 'Libre Baskerville', 'Cormorant', 'Crimson Text', 'Cardo',
    'Gentium Book Basic', 'Sorts Mill Goudy', 'Linden Hill', 'Fanwood Text', 'GFS Didot',
    'Goudy Bookletter 1911', 'IM Fell DW Pica', 'IM Fell English', 'Almendra', 'Coustard',
    'Belgrano', 'Inknut Antiqua', 'Unna', 'Habibi', 'Besley',
    'Eczar', 'Amiri', 'Abhaya Libre', 'Tinos', 'Bentham',
    'Buenard', 'Lustria', 'Alike', 'Old Standard TT', 'Philosopher'
  ],
  'Serif, Slab': [
    'Roboto Slab', 'Arvo', 'Zilla Slab', 'Bitter', 'Courier Prime',
    'Josefin Slab', 'Bree Serif', 'Crete Round', 'Nixie One', 'Sanchez',
    'Aleo', 'Neuton', 'Rockwell', 'Clarendon', 'Museo Slab',
    'Adelle', 'Sentinel', 'Archer', 'Egyptian Slate', 'Courier New',
    'Lubalin Graph', 'Serifa', 'PMN Caecilia', 'Officina Serif', 'FF Tisa',
    'Rooney', 'Egyptienne', 'Memphis', 'Rockwell Nova', 'Volta'
  ],
  'Serif, Modern': [
    'Playfair Display', 'Bodoni Moda', 'DM Serif Display', 'Yeseva One', 'Oranienbaum',
    'Libre Bodoni', 'Cinzel', 'Cormorant', 'Spectral', 'Fraunces',
    'Abhaya Libre', 'Trirong', 'Prata', 'Rozha One', 'Cantata One',
    'Frank Ruhl Libre', 'Taviraj', 'Unna', 'Bellefair', 'Bentham',
    'Mate SC', 'Nixie One', 'Petrona', 'Playfair Display SC', 'Poly',
    'Radley', 'Rufina', 'Suranna', 'Tienne', 'Yrsa'
  ],
  'Serif, Scotch': [
    'Libre Baskerville', 'Playfair Display', 'Cormorant', 'Crimson Pro', 'Spectral',
    'Lora', 'Petrona', 'Frank Ruhl Libre', 'Cardo', 'Judson',
    'Neuton', 'Alike', 'Pridi', 'Fjalla One', 'Yrsa',
    'EB Garamond', 'Merriweather', 'Vollkorn', 'Gentium Book Basic', 'Bitter',
    'Gelasio', 'Andada Pro', 'Brygada 1918', 'Rufina', 'Arapey',
    'Alice', 'Amethysta', 'Esteban', 'Lusitana', 'Mate'
  ],
  'Serif, Didone': [
    'Bodoni Moda', 'Libre Bodoni', 'Playfair Display', 'Cormorant', 'Oranienbaum',
    'Prata', 'Cinzel', 'DM Serif Display', 'Yeseva One', 'Abhaya Libre',
    'Trirong', 'Rozha One', 'Cantata One', 'Frank Ruhl Libre', 'Bellefair',
    'Bentham', 'Gilda Display', 'Nixie One', 'Suranna', 'Tienne',
    'Unna', 'Yrsa', 'Kurale', 'Mate SC', 'Playfair Display SC',
    'Poly', 'Radley', 'Rufina', 'Taviraj', 'Alike'
  ],
  'Serif, Humanist': [
    'Source Serif Pro', 'Spectral', 'PT Serif', 'Neuton', 'Gentium Basic',
    'Alegreya', 'Merriweather', 'Vollkorn', 'Noto Serif', 'Crimson Pro',
    'EB Garamond', 'Lora', 'Libre Baskerville', 'Cardo', 'Alegreya Sans',
    'Crimson Text', 'Bitter', 'Amiri', 'Judson', 'Quattrocento',
    'Coustard', 'Alike', 'Gelasio', 'Mate', 'Poly',
    'Andada Pro', 'Brygada 1918', 'Neuton', 'Fanwood Text', 'Kurale'
  ],
  'Serif, Fatface': [
    'Abril Fatface', 'Ultra', 'Fascinate', 'Righteous', 'Bevan',
    'Alfa Slab One', 'Black Ops One', 'Passion One', 'Supermercado One', 'Unlock',
    'Bowlby One SC', 'Bungee Shade', 'Fredericka the Great', 'Metamorphous', 'Vast Shadow',
    'Creepster', 'Eater', 'Emblema One', 'Faster One', 'Fugaz One',
    'Henny Penny', 'Irish Grover', 'Monofett', 'Plaster', 'Racing Sans One',
    'Rammetto One', 'Rye', 'Shrikhand', 'Smokum', 'Titan One'
  ],
  'Sans Serif, Humanist': [
    'Open Sans', 'Lato', 'Source Sans Pro', 'Noto Sans', 'Nunito',
    'PT Sans', 'Fira Sans', 'Cabin', 'Muli', 'Overpass',
    'Rubik', 'Hind', 'Catamaran', 'Karla', 'Barlow',
    'Asap', 'Quicksand', 'Oxygen', 'Varela Round', 'Saira',
    'Ubuntu', 'Comfortaa', 'Almarai', 'Tajawal', 'Outfit',
    'Mukta', 'Kumbh Sans', 'DM Sans', 'Manrope', 'Plus Jakarta Sans'
  ],
  'Sans Serif, Geometric': [
    'Montserrat', 'Raleway', 'Poppins', 'Quicksand', 'Josefin Sans',
    'Varela Round', 'Comfortaa', 'Nunito', 'Jost', 'Red Hat Display',
    'Lexend', 'Outfit', 'Manrope', 'Space Grotesk', 'DM Sans',
    'Plus Jakarta Sans', 'Sora', 'Urbanist', 'Be Vietnam Pro', 'Commissioner',
    'League Spartan', 'Spartan', 'Exo 2', 'Orbitron', 'Alata',
    'Mulish', 'Inter', 'Work Sans', 'Rubik', 'Cabin'
  ],
  'Sans Serif, Neo Grotesque': [
    'Inter', 'Roboto', 'Work Sans', 'IBM Plex Sans', 'Public Sans',
    'Noto Sans', 'Source Sans Pro', 'Fira Sans', 'Overpass', 'Libre Franklin',
    'Archivo', 'Titillium Web', 'Barlow', 'Encode Sans', 'Heebo',
    'Karla', 'Rubik', 'Manrope', 'DM Sans', 'Plus Jakarta Sans',
    'Sora', 'Space Grotesk', 'Red Hat Display', 'Be Vietnam Pro', 'Commissioner',
    'Epilogue', 'Figtree', 'Schibsted Grotesk', 'Bricolage Grotesque', 'Instrument Sans'
  ],
  'Sans Serif, Grotesque': [
    'Roboto', 'Oswald', 'Arimo', 'Fjalla One', 'Anton',
    'Archivo Narrow', 'Bebas Neue', 'Saira Condensed', 'Francois One', 'Passion One',
    'Staatliches', 'Barlow Condensed', 'Archivo Black', 'Squada One', 'Ropa Sans',
    'Kosugi Maru', 'Kosugi', 'M PLUS 1p', 'M PLUS Rounded 1c', 'Noto Sans JP',
    'Sawarabi Gothic', 'Stick', 'Train One', 'Hachi Maru Pop', 'Yomogi',
    'DotGothic16', 'Mochiy Pop One', 'Potta One', 'Rampart One', 'RocknRoll One'
  ],
  'Sans Serif, Rounded': [
    'Nunito', 'Quicksand', 'Varela Round', 'Comfortaa', 'M PLUS Rounded 1c',
    'Rounded Mplus 1c', 'Fredoka', 'Righteous', 'Alata', 'Balsamiq Sans',
    'Kodchasan', 'Livvic', 'Mali', 'Mitr', 'Monda',
    'Niramit', 'Prompt', 'Proza Libre', 'Questrial', 'Sen',
    'Signika', 'Sintony', 'Sulphur Point', 'Telex', 'Varela',
    'Voltaire', 'Work Sans', 'Yantramanav', 'Baloo 2', 'Sniglet'
  ],
  'Sans Serif, Superellipse': [
    'Lexend', 'Inter', 'Space Grotesk', 'Red Hat Display', 'Sora',
    'Plus Jakarta Sans', 'Outfit', 'Manrope', 'DM Sans', 'Commissioner',
    'Be Vietnam Pro', 'Urbanist', 'Epilogue', 'Figtree', 'Schibsted Grotesk',
    'Bricolage Grotesque', 'Instrument Sans', 'Onest', 'Albert Sans', 'Anybody',
    'Azeret Mono', 'Bellota', 'Bellota Text', 'Cabinet Grotesk', 'Chakra Petch',
    'Chivo', 'Darker Grotesque', 'Familjen Grotesk', 'Golos Text', 'Hanken Grotesk'
  ],
  'Sans Serif, Glyphic': [
    'Cinzel', 'Forum', 'Marcellus', 'Marcellus SC', 'Mate SC',
    'Philosopher', 'Poiret One', 'Julius Sans One', 'Belleza', 'Metamorphous',
    'MedievalSharp', 'UnifrakturMaguntia', 'Uncial Antiqua', 'Almendra SC', 'IM Fell English SC',
    'IM Fell French Canon SC', 'IM Fell Great Primer SC', 'IM Fell DW Pica SC', 'IM Fell Double Pica SC', 'Caudex',
    'Della Respira', 'Eagle Lake', 'GFS Didot', 'Gentium Book Basic', 'Goudy Bookletter 1911',
    'IM Fell DW Pica', 'IM Fell English', 'IM Fell French Canon', 'IM Fell Great Primer', 'Sorts Mill Goudy'
  ],
  'Appearance, Techno': [
    'Orbitron', 'Audiowide', 'Electrolize', 'Exo 2', 'Iceberg',
    'Jura', 'Michroma', 'Aldrich', 'Strait', 'Share Tech',
    'Share Tech Mono', 'Saira', 'Space Mono', 'VT323', 'Press Start 2P',
    'Oxanium', 'Quantico', 'Rationale', 'Rajdhani', 'Geo',
    'Turret Road', 'Syne', 'Syne Mono', 'Syncopate', 'Teko',
    'Sector', 'Mina', 'Major Mono Display', 'Iceland', 'Black Ops One'
  ]
};

// Map our style categories to Google Fonts API categories and filters (for mood-based random selection)
const STYLE_TO_GOOGLE_CATEGORY: Record<string, { category?: string; filter?: (font: any) => boolean }> = {
  'Calligraphy, Formal': {
    category: 'handwriting',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return (
        name.includes('script') ||
        name.includes('brush') ||
        name.includes('vibes') ||
        ['tangerine', 'allura', 'parisienne', 'pinyon', 'italianno', 'sacramento'].some(kw => name.includes(kw))
      );
    }
  },
  'Calligraphy, Informal': {
    category: 'handwriting',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return (
        ['dancing', 'pacifico', 'satisfy', 'cookie', 'courgette', 'kaushan', 'damion'].some(kw => name.includes(kw))
      );
    }
  },
  'Calligraphy, Upright': {
    category: 'handwriting',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return (
        ['caveat', 'patrick', 'kalam', 'indie', 'shadow', 'architect', 'permanent', 'amatic'].some(kw => name.includes(kw))
      );
    }
  },
  'Calligraphy, Handwritten': {
    category: 'handwriting',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return (
        ['caveat', 'patrick', 'kalam', 'indie', 'shadow', 'architect', 'permanent', 'amatic'].some(kw => name.includes(kw))
      );
    }
  },
  'Serif, Transitional': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['lora', 'crimson', 'libre', 'merriweather', 'spectral', 'vollkorn'].some(kw => name.includes(kw));
    }
  },
  'Serif, Old Style': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['garamond', 'baskerville', 'cormorant', 'goudy', 'fell'].some(kw => name.includes(kw));
    }
  },
  'Serif, Slab': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['roboto slab', 'arvo', 'zilla slab', 'bitter', 'courier prime'].some(kw => name.includes(kw));
    }
  },
  'Serif, Modern': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['playfair', 'bodoni', 'dm serif', 'yeseva', 'cinzel'].some(kw => name.includes(kw));
    }
  },
  'Serif, Scotch': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['libre baskerville', 'playfair', 'cormorant', 'crimson pro', 'spectral'].some(kw => name.includes(kw));
    }
  },
  'Serif, Didone': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['bodoni', 'didot', 'libre bodoni', 'playfair'].some(kw => name.includes(kw));
    }
  },
  'Serif, Humanist': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['source serif', 'spectral', 'pt serif', 'neuton', 'gentium'].some(kw => name.includes(kw));
    }
  },
  'Serif, Fatface': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['abril fatface', 'ultra', 'fascinate', 'righteous', 'bevan'].some(kw => name.includes(kw));
    }
  },
  'Sans Serif, Humanist': {
    category: 'sans-serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['open sans', 'lato', 'source sans', 'noto sans', 'nunito', 'fira'].some(kw => name.includes(kw));
    }
  },
  'Sans Serif, Geometric': {
    category: 'sans-serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['montserrat', 'raleway', 'poppins', 'quicksand', 'josefin', 'jost'].some(kw => name.includes(kw));
    }
  },
  'Sans Serif, Neo Grotesque': {
    category: 'sans-serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['inter', 'roboto', 'work sans', 'ibm plex', 'public sans', 'archivo'].some(kw => name.includes(kw));
    }
  },
  'Sans Serif, Grotesque': {
    category: 'sans-serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['oswald', 'arimo', 'fjalla', 'anton', 'bebas', 'saira'].some(kw => name.includes(kw));
    }
  },
  'Sans Serif, Rounded': {
    category: 'sans-serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return name.includes('rounded') || ['nunito', 'quicksand', 'varela', 'comfortaa', 'fredoka'].some(kw => name.includes(kw));
    }
  },
  'Sans Serif, Superellipse': {
    category: 'sans-serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['lexend', 'inter', 'space grotesk', 'red hat', 'sora', 'outfit'].some(kw => name.includes(kw));
    }
  },
  'Sans Serif, Glyphic': {
    category: 'serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['cinzel', 'forum', 'marcellus', 'philosopher', 'poiret'].some(kw => name.includes(kw));
    }
  },
  'Appearance, Techno': {
    category: 'sans-serif',
    filter: (font) => {
      const name = font.family.toLowerCase();
      return ['orbitron', 'audiowide', 'electrolize', 'exo', 'jura', 'michroma', 'oxanium'].some(kw => name.includes(kw));
    }
  }
};

// Cache for Google Fonts API response
let googleFontsCache: GoogleFont[] | null = null;

// Fetch all fonts from Google Fonts API
async function fetchGoogleFonts(): Promise<GoogleFont[]> {
  // Return cached data if available
  if (googleFontsCache) {
    return googleFontsCache;
  }

  try {
    // Try to fetch from Google Fonts API
    const response = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`
    );

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    googleFontsCache = data.items.map((font: any) => ({
      family: font.family,
      category: font.category,
      variants: font.variants || ['400', '700'],
      subsets: font.subsets || ['latin']
    }));

    console.log(`✅ Fetched ${googleFontsCache.length} fonts from Google Fonts API`);
    return googleFontsCache;
  } catch (error) {
    console.warn('⚠️ Google Fonts API unavailable, using curated lists');
    // Return empty array - will fall back to curated lists
    return [];
  }
}

// Get fonts for a specific style category
export async function getFontsForStyleCategory(
  category: string, 
  limit: number = 30,
  useMoodBased: boolean = false // NEW: flag to indicate if using mood-based (color) detection
): Promise<GoogleFont[]> {
  console.log(`📦 Fetching fonts for category: ${category} (mood-based: ${useMoodBased})`);
  
  // ===== PATH 2: NO TEXT DETECTED (MOOD-BASED) - Pull from moodFontMapping JSON =====
  if (useMoodBased) {
    // Check if category is a mood name (Active, Artistic, Business, etc.)
    const moodFonts = moodFontMapping[category as MoodName];
    
    if (!moodFonts) {
      console.warn(`⚠️ Unknown mood: ${category}, using Business`);
      return getFontsForStyleCategory('Business', limit, useMoodBased);
    }
    
    // Filter out excluded fonts (including UI fonts)
    const filteredMoodFonts = moodFonts.filter(font => !FONTS_TO_EXCLUDE.includes(font.name));
    
    // Shuffle the mood font list for variety
    const shuffled = [...filteredMoodFonts].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(limit, shuffled.length));
    
    console.log(`  ✅ Returning ${selected.length} fonts from mood "${category}"`);
    console.log(`  Sample fonts: ${selected.slice(0, 5).map(f => f.name).join(', ')}`);
    
    // Convert to GoogleFont format
    return selected.map(font => ({
      family: font.name,
      category: font.type.toLowerCase().includes('serif') && !font.type.includes('Sans') ? 'serif' 
              : font.type.toLowerCase().includes('sans') ? 'sans-serif' 
              : font.type.toLowerCase().includes('mono') ? 'monospace'
              : 'display',
      variants: ['400', '500', '600', '700'],
      subsets: ['latin']
    }));
  }
  
  // ===== PATH 1: TEXT DETECTED - Use curated list =====
  const curatedFonts = CURATED_FONTS_BY_STYLE[category];
  
  if (!curatedFonts) {
    console.warn(`⚠️ Unknown category: ${category}, using Sans Serif, Neo Grotesque`);
    return getFontsForStyleCategory('Sans Serif, Neo Grotesque', limit, useMoodBased);
  }
  
  // Filter out excluded fonts
  const filteredFonts = curatedFonts.filter(family => !FONTS_TO_EXCLUDE.includes(family));
  
  // Shuffle the curated list for variety
  const shuffled = [...filteredFonts].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(limit, shuffled.length));
  
  console.log(`  ✅ Returning ${selected.length} curated fonts`);
  console.log(`  Sample fonts: ${selected.slice(0, 5).join(', ')}`);
  
  return selected.map(family => ({
    family,
    category: category.includes('Serif') ? 'serif' : category.includes('Sans') ? 'sans-serif' : 'handwriting',
    variants: ['400', '500', '600', '700'],
    subsets: ['latin']
  }));
}

// Load fonts into the document using WebFontLoader approach
export async function loadGoogleFonts(fontFamilies: string[]): Promise<void> {
  if (fontFamilies.length === 0) return;

  console.log(`📦 Loading ${fontFamilies.length} Google Fonts...`);

  // Remove existing Google Fonts link elements
  const existingLinks = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
  existingLinks.forEach(link => link.remove());

  // Create URL-safe font family string
  const fontString = fontFamilies
    .map(family => {
      // Replace spaces with +
      const urlFamily = family.replace(/\s+/g, '+');
      // Add weight variants
      return `${urlFamily}:wght@100;200;300;400;500;600;700;800;900`;
    })
    .join('&family=');

  // Create and append link element
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontString}&display=swap`;
  link.setAttribute('data-typography-fonts', 'true');
  
  document.head.appendChild(link);

  // Wait for fonts to load with Font Loading API
  if ('fonts' in document) {
    try {
      const fontPromises = fontFamilies.map(family => 
        (document as any).fonts.load(`400 16px "${family}"`)
      );
      await Promise.all(fontPromises);
      console.log('✅ Fonts loaded via Font Loading API');
    } catch (error) {
      console.warn('⚠️ Font loading warning:', error);
      // Continue anyway - fonts will load eventually
    }
  }

  // Additional safety timeout
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('✅ Google Fonts ready');
}

// Generate font pairs based on header and body style categories
export async function generateFontPairs(
  headerCategory: string,
  bodyCategory: string = 'Sans Serif, Neo Grotesque',
  count: number = 30,
  useMoodBased: boolean = false
): Promise<Array<{ headerFont: GoogleFont; bodyFont: GoogleFont }>> {
  const headerFonts = await getFontsForStyleCategory(headerCategory, count, useMoodBased);
  const bodyFonts = await getFontsForStyleCategory(bodyCategory, count, useMoodBased);
  
  const pairs: Array<{ headerFont: GoogleFont; bodyFont: GoogleFont }> = [];
  
  for (let i = 0; i < Math.min(count, headerFonts.length); i++) {
    const bodyFont = bodyFonts[i % bodyFonts.length];
    pairs.push({
      headerFont: headerFonts[i],
      bodyFont: bodyFont
    });
  }
  
  return pairs;
}