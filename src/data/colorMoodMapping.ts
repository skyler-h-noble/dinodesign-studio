// Color to mood mapping from provided JSON
export interface MoodMapping {
  mood: string;
  colors: string[];
  fontStyles: string[];
  customFonts?: Array<{ "Font Name": string; "Type": string }> | string[];
  fontWeight: string;
  buttonStyle: string;
}

export const colorMoodMapping: MoodMapping[] = [
  {
    mood: "Calm",
    colors: ["#76CEE3"],
    fontStyles: ["Calm"],
    fontWeight: "Regular",
    buttonStyle: "Square"
  },
  {
    mood: "Calm-2",
    colors: ["#ABA8A4"],
    fontStyles: ["Calm"],
    fontWeight: "Regular",
    buttonStyle: "Square"
  },
  {
    mood: "Calm-3",
    colors: ["#ABA8A4"],
    fontStyles: ["Calm"],
    fontWeight: "Regular",
    buttonStyle: "Square"
  },
  {
    mood: "Healthy",
    colors: ["#79C7A4"],
    fontStyles: ["Business"],
    fontWeight: "Medium",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Healthy-2",
    colors: ["#159B48"],
    fontStyles: ["Business"],
    fontWeight: "Medium",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Balanced",
    colors: ["#82C26E"],
    fontStyles: ["Calm"],
    fontWeight: "Regular",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Friendly",
    colors: ["#BDD96D"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Poppins", "Type": "Sans-Serif" },
      { "Font Name": "Fraunces", "Type": "Serif" },
      { "Font Name": "Montserrat", "Type": "Sans-Serif" },
      { "Font Name": "Outfit", "Type": "Sans-Serif" },
      { "Font Name": "Open Sans", "Type": "Sans-Serif" },
      { "Font Name": "Radley", "Type": "Serif" },
      { "Font Name": "Josefin Sans", "Type": "Sans-Serif" },
      { "Font Name": "Merriweather", "Type": "Serif" },
      { "Font Name": "Lato", "Type": "Sans-Serif" },
      { "Font Name": "Tangerine", "Type": "Handwritten" },
      { "Font Name": "Lobster", "Type": "Display" },
      { "Font Name": "Pacifico", "Type": "Handwritten" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Dancing Script", "Type": "Handwritten" },
      { "Font Name": "Unbounded", "Type": "Display" },
      { "Font Name": "Baloo", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" },
      { "Font Name": "Hind", "Type": "Sans-Serif" },
      { "Font Name": "Sacramento", "Type": "Handwritten" },
      { "Font Name": "Tinos", "Type": "Serif" },
      { "Font Name": "Besley", "Type": "Serif" },
      { "Font Name": "Oxygen", "Type": "Sans-Serif" },
      { "Font Name": "Cambay", "Type": "Sans-Serif" }
    ],
    fontWeight: "Regular",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Goofy",
    colors: ["#DBE278"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Shrikhand", "Type": "Display" },
      { "Font Name": "Fredoka One", "Type": "Display" },
      { "Font Name": "Oi", "Type": "Display" },
      { "Font Name": "Rakkas", "Type": "Display" },
      { "Font Name": "Ultra", "Type": "Display" },
      { "Font Name": "Yatra One", "Type": "Display" },
      { "Font Name": "Erica One", "Type": "Display" },
      { "Font Name": "Corben", "Type": "Display" },
      { "Font Name": "Happy Monkey", "Type": "Display" }
    ],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Sickly",
    colors: ["#FCF083"],
    fontStyles: ["Stiff", "Loud"],
    fontWeight: "Heavy",
    buttonStyle: "Square"
  },
  {
    mood: "Naive",
    colors: ["#F8F483"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Fuzzy Bubbles", "Type": "Handwritten" },
      { "Font Name": "Varela", "Type": "Sans-Serif" },
      { "Font Name": "Swanky and Moo Moo", "Type": "Handwritten" },
      { "Font Name": "Give You Glory", "Type": "Handwritten" }
    ],
    fontWeight: "Light",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Bright",
    colors: ["#FFF786"],
    fontStyles: ["Calm", "Business"],
    fontWeight: "Regular",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Bright-2",
    colors: ["#FAE47F"],
    fontStyles: ["Calm", "Business"],
    fontWeight: "Regular",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Wealth",
    colors: ["#FDD881"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Crimson Pro", "Type": "Serif" },
      { "Font Name": "Tirong", "Type": "Serif" },
      { "Font Name": "Libre Baskerville", "Type": "Serif" },
      { "Font Name": "Cormorant", "Type": "Serif" },
      { "Font Name": "Dancing Script", "Type": "Handwritten" },
      { "Font Name": "Great Vibes", "Type": "Handwritten" },
      { "Font Name": "Parisienne", "Type": "Handwritten" },
      { "Font Name": "Tangerine", "Type": "Handwritten" },
      { "Font Name": "Allura", "Type": "Handwritten" },
      { "Font Name": "Alex Brush", "Type": "Handwritten" }
    ],
    fontWeight: "Elegant",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Immature",
    colors: ["#F7BC83"],
    fontStyles: ["Childlike"],
    fontWeight: "Light",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Immature-2",
    colors: ["#DEECC5"],
    fontStyles: ["Childlike"],
    fontWeight: "Light",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Flamboyant",
    colors: ["#F7AD7E"],
    fontStyles: ["Custom"],
    customFonts: ["Fascinate", "Oxanium", "Yesteryear", "Sedgwick Ave"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Perseverance",
    colors: ["#FA9386"],
    fontStyles: ["Business", "Calm"],
    fontWeight: "Regular",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Selfish",
    colors: ["#F47E83"],
    fontStyles: ["Happy", "Childlike"],
    fontWeight: "Light",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Selfish-2",
    colors: ["#F7AE15"],
    fontStyles: ["Happy", "Childlike"],
    fontWeight: "Light",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Giddy",
    colors: ["#D978AE"],
    fontStyles: ["Happy"],
    fontWeight: "Medium to Heavy",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Passive",
    colors: ["#F07A9F"],
    fontStyles: ["Calm"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Passive-2",
    colors: ["#91C0EA"],
    fontStyles: ["Calm"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Attractive",
    colors: ["#B06EAF"],
    fontStyles: ["Calm", "Elegant", "Business"],
    fontWeight: "Regular",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Grace",
    colors: ["#9A6CAE"],
    fontStyles: ["Calm", "Elegant", "Business"],
    fontWeight: "Regular",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Loyalty",
    colors: ["#7768A5"],
    fontStyles: ["Calm", "Business"],
    fontWeight: "Medium",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Reflective",
    colors: ["#6873B3"],
    fontStyles: ["Calm"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Tired",
    colors: ["#728BCC"],
    fontStyles: ["Calm"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Tired-2",
    colors: ["#FBD8A5"],
    fontStyles: ["Calm"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Hopeful",
    colors: ["#69A7D8", "#C0D437"],
    fontStyles: ["Active"],
    fontWeight: "Medium",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Hopeful-2",
    colors: ["#C0D437"],
    fontStyles: ["Active"],
    fontWeight: "Medium",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Cold",
    colors: ["#6DB9DD"],
    fontStyles: ["Active", "Custom"],
    customFonts: [
      { "Font Name": "Dosis", "Type": "Sans-Serif" },
      { "Font Name": "Oxygen", "Type": "Sans-Serif" },
      { "Font Name": "Space Grotesk", "Type": "Sans-Serif" },
      { "Font Name": "Ropa Sans", "Type": "Sans-Serif" },
      { "Font Name": "Abel", "Type": "Sans-Serif" },
      { "Font Name": "Squada On", "Type": "Display" },
      { "Font Name": "Tauri", "Type": "Sans-Serif" },
      { "Font Name": "Josefin Sans", "Type": "Sans-Serif" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" },
      { "Font Name": "Arvo", "Type": "Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Cabin", "Type": "Sans-Serif" },
      { "Font Name": "Kanit", "Type": "Sans-Serif" },
      { "Font Name": "Comfortaa", "Type": "Display" },
      { "Font Name": "Jura", "Type": "Sans-Serif" }
    ],
    fontWeight: "Regular",
    buttonStyle: "Square"
  },
  {
    mood: "Fresh",
    colors: ["#D2DD54"],
    fontStyles: ["Active", "Loud"],
    fontWeight: "Bold",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Fresh-2",
    colors: ["#D0DF55"],
    fontStyles: ["Active", "Loud"],
    fontWeight: "Bold",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Purity",
    colors: ["#FFFFFF"],
    fontStyles: ["Calm", "Stiff"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Innocence",
    colors: ["#FFFFFF"],
    fontStyles: ["Calm", "Stiff"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Indecisive",
    colors: ["#DDDDDD"],
    fontStyles: ["Artistic"],
    fontWeight: "Medium",
    buttonStyle: "Square"
  },
  {
    mood: "Blase",
    colors: ["#DDDDDD"],
    fontStyles: ["Calm"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Dense",
    colors: ["#000000"],
    fontStyles: ["Loud"],
    fontWeight: "Heavy",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Unknown",
    colors: ["#000000"],
    fontStyles: ["Loud"],
    fontWeight: "Heavy",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Mystery",
    colors: ["#000000"],
    fontStyles: ["Distressed"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Mystery-2",
    colors: ["#4B0082"],
    fontStyles: ["Distressed"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Mystery-3",
    colors: ["#8A2BE2"],
    fontStyles: ["Distressed"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Mystery-4",
    colors: ["#9400D3"],
    fontStyles: ["Distressed"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Childish",
    colors: ["#DAE7A3"],
    fontStyles: ["Childlike"],
    fontWeight: "Light",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Bitter",
    colors: ["#E4EAA0"],
    fontStyles: ["Permanent Marker"],
    fontWeight: "Heavy",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Permissive",
    colors: ["#F8F5A7"],
    fontStyles: ["Happy"],
    fontWeight: "Medium",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Fun",
    colors: ["#FEF8AD"],
    fontStyles: ["Playful", "Happy"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Envy",
    colors: ["#FAEEA2"],
    fontStyles: ["Calm"],
    fontWeight: "Medium to Bold",
    buttonStyle: "Square"
  },
  {
    mood: "Entitled",
    colors: ["#FAE1A6"],
    fontStyles: ["Business"],
    fontWeight: "Medium to Bold",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Juvenile",
    colors: ["#FCD1A5"],
    fontStyles: ["Childlike"],
    fontWeight: "Light",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Feminine",
    colors: ["#FDCCAA"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Pinyon Script", "Type": "Handwritten" },
      { "Font Name": "Elisie", "Type": "Serif" },
      { "Font Name": "Parisienne", "Type": "Handwritten" },
      { "Font Name": "Petit Formal Script", "Type": "Handwritten" },
      { "Font Name": "Mr De Haviland", "Type": "Handwritten" },
      { "Font Name": "Kurale", "Type": "Serif" },
      { "Font Name": "Mrs Saint Delafield", "Type": "Handwritten" },
      { "Font Name": "Cormorant Upright", "Type": "Serif" },
      { "Font Name": "Satisfy", "Type": "Handwritten" },
      { "Font Name": "Great Vibes", "Type": "Handwritten" },
      { "Font Name": "Cookie", "Type": "Handwritten" },
      { "Font Name": "Alex Brush", "Type": "Handwritten" },
      { "Font Name": "Allura", "Type": "Handwritten" },
      { "Font Name": "Sacramento", "Type": "Handwritten" }
    ],
    fontWeight: "Elegant",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Perky",
    colors: ["#F7B5A7"],
    fontStyles: ["Happy"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Weak",
    colors: ["#F7A4AA"],
    fontStyles: ["Calm"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Cute",
    colors: ["#F9A3C8"],
    fontStyles: ["Playful", "Happy"],
    fontWeight: "Light",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Romantic",
    colors: ["#F9A5A5"],
    fontStyles: ["Elegant"],
    fontWeight: "Regular",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Mellow",
    colors: ["#FACD97"],
    fontStyles: ["Calm"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Delicate",
    colors: ["#F7D2D9"],
    fontStyles: ["Elegant"],
    fontWeight: "Light",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Energetic",
    colors: ["#F28E1C"],
    fontStyles: ["Active"],
    fontWeight: "Bold",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Sassy",
    colors: ["#F28F88"],
    fontStyles: ["Loud", "Happy"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Mysterious",
    colors: ["#4B0082", "#6A0DAD", "#8A2BE2"],
    fontStyles: ["Distressed", "Active"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Rebellious",
    colors: ["#B22222"],
    fontStyles: ["Loud", "Custom"],
    customFonts: [
      { "Font Name": "Bangers", "Type": "Display" },
      { "Font Name": "Rock Salt", "Type": "Handwritten" },
      { "Font Name": "Righteous", "Type": "Display" },
      { "Font Name": "Ruge Boogie", "Type": "Handwritten" },
      { "Font Name": "Impact", "Type": "Display" }
    ],
    fontWeight: "Heavy",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Rebellious-2",
    colors: ["#8B0000"],
    fontStyles: ["Loud", "Custom"],
    customFonts: [
      { "Font Name": "Bangers", "Type": "Display" },
      { "Font Name": "Rock Salt", "Type": "Handwritten" },
      { "Font Name": "Righteous", "Type": "Display" },
      { "Font Name": "Ruge Boogie", "Type": "Handwritten" },
      { "Font Name": "Impact", "Type": "Display" }
    ],
    fontWeight: "Heavy",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Victorious",
    colors: ["#FFD700"],
    fontStyles: ["Business", "Custom"],
    fontWeight: "Bold",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Ambitious",
    colors: ["#1E90FF", "#4682B4"],
    fontStyles: ["Active", "Business"],
    fontWeight: "Medium",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Intense",
    colors: ["#DC143C"],
    fontStyles: ["Loud", "Custom"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Proud",
    colors: ["#8B008B"],
    fontStyles: ["Elegant", "Business"],
    fontWeight: "Medium",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Mystic",
    colors: ["#6A5ACD"],
    fontStyles: ["Distressed", "Calm"],
    fontWeight: "Bold",
    buttonStyle: "Square"
  },
  {
    mood: "Mystic-2",
    colors: ["#8A2BE2"],
    fontStyles: ["Distressed", "Calm"],
    fontWeight: "Bold",
    buttonStyle: "Square"
  },
  {
    mood: "Passionate",
    colors: ["#FF6347"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Bungee", "Type": "Display" },
      { "Font Name": "Bebas Neue", "Type": "Display" },
      { "Font Name": "Impact", "Type": "Display" },
      { "Font Name": "Anton", "Type": "Display" },
      { "Font Name": "Russo One", "Type": "Display" }
    ],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Passionate-2",
    colors: ["#FF4500"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Bungee", "Type": "Display" },
      { "Font Name": "Bebas Neue", "Type": "Display" },
      { "Font Name": "Impact", "Type": "Display" },
      { "Font Name": "Anton", "Type": "Display" },
      { "Font Name": "Russo One", "Type": "Display" }
    ],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Fearful",
    colors: ["#A9A9A9"],
    fontStyles: ["Stiff", "Distressed"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Fearful-2",
    colors: ["#808080"],
    fontStyles: ["Stiff", "Distressed"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Indifferent",
    colors: ["#FDC27D"],
    fontStyles: ["Calm", "Business"],
    fontWeight: "Regular",
    buttonStyle: "Square"
  },
  {
    mood: "Indifferent-2",
    colors: ["#FDC27D"],
    fontStyles: ["Calm", "Business"],
    fontWeight: "Regular",
    buttonStyle: "Square"
  },
  {
    mood: "Charming",
    colors: ["#F5A9A9", "#F5B5B5"],
    fontStyles: ["Elegant", "Custom"],
    customFonts: [
      { "Font Name": "Alex Brush", "Type": "Handwritten" },
      { "Font Name": "Dancing Script", "Type": "Handwritten" },
      { "Font Name": "Satisfy", "Type": "Handwritten" },
      { "Font Name": "Great Vibes", "Type": "Handwritten" }
    ],
    fontWeight: "Regular",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Spirited",
    colors: ["#FF8C00"],
    fontStyles: ["Happy", "Playful"],
    fontWeight: "Bold",
    buttonStyle: "Boldly Rounded"
  },
  {
    mood: "Determined",
    colors: ["#2E8B57"],
    fontStyles: ["Active", "Business"],
    fontWeight: "Medium",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Pensive",
    colors: ["#708090"],
    fontStyles: ["Calm", "Business"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Pensive-2",
    colors: ["#2F4F4F"],
    fontStyles: ["Calm", "Business"],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Nostalgic",
    colors: ["#B0E0E6"],
    fontStyles: ["Stiff", "Custom"],
    fontWeight: "Regular",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Sad",
    colors: ["#DCDCDB"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Goudy Bookletter 1911", "Type": "Serif" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Smooch Sans", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Giga", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Zetta", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Peta", "Type": "Sans-Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" }
    ],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Sad-2",
    colors: ["#B0B2B4"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Goudy Bookletter 1911", "Type": "Serif" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Smooch Sans", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Giga", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Zetta", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Peta", "Type": "Sans-Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" }
    ],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Security",
    colors: ["#545556"],
    fontStyles: ["Business"],
    fontWeight: "Medium to Heavy",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Security-2",
    colors: ["#3C3127"],
    fontStyles: ["Business"],
    fontWeight: "Medium to Heavy",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Neutrality",
    colors: ["#C7C9CA"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Goudy Bookletter 1911", "Type": "Serif" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Smooch Sans", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Giga", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Zetta", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Peta", "Type": "Sans-Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" }
    ],
    fontWeight: "Regular",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Warmth",
    colors: ["#AF9C89"],
    fontStyles: ["Calm"],
    fontWeight: "Medium",
    buttonStyle: "Square"
  },
  {
    mood: "Comforting",
    colors: ["#D3C9C0"],
    fontStyles: ["Calm"],
    fontWeight: "Medium",
    buttonStyle: "Square"
  },
  {
    mood: "Resilience",
    colors: ["#3C3127"],
    fontStyles: ["Business"],
    fontWeight: "Medium to Heavy",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Dependable",
    colors: ["#3C3127"],
    fontStyles: ["Business"],
    fontWeight: "Medium to Heavy",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Wholesome",
    colors: ["#3C3127"],
    fontStyles: ["Business"],
    fontWeight: "Regular",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Sustainable",
    colors: ["#3C3127"],
    fontStyles: ["Business"],
    fontWeight: "Regular",
    buttonStyle: "Amply Rounded"
  },
  {
    mood: "Timeless",
    colors: ["#808080"],
    fontStyles: ["Business", "Calm"],
    fontWeight: "Medium",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Sophisticated",
    colors: ["#D0CFCE"],
    fontStyles: ["Calm", "Sophisticated"],
    fontWeight: "Regular",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Unemotional",
    colors: ["#B1B0AF"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Goudy Bookletter 1911", "Type": "Serif" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Smooch Sans", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Giga", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Zetta", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Peta", "Type": "Sans-Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" }
    ],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Detached",
    colors: ["#858584"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Goudy Bookletter 1911", "Type": "Serif" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Smooch Sans", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Giga", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Zetta", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Peta", "Type": "Sans-Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" }
    ],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Formal",
    colors: ["#DCDCDB"],
    fontStyles: ["Business", "Calm", "Sophisticated"],
    fontWeight: "Medium",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Genuine",
    colors: ["#3C3127"],
    fontStyles: ["Business"],
    fontWeight: "Medium",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Practical",
    colors: ["#3C3127"],
    fontStyles: ["Business"],
    fontWeight: "Medium",
    buttonStyle: "Gently Rounded"
  },
  {
    mood: "Loneliness",
    colors: ["#3C3127"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Goudy Bookletter 1911", "Type": "Serif" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Smooch Sans", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Giga", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Zetta", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Peta", "Type": "Sans-Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" }
    ],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Isolation",
    colors: ["#3C3127"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Goudy Bookletter 1911", "Type": "Serif" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Smooch Sans", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Giga", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Zetta", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Peta", "Type": "Sans-Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" }
    ],
    fontWeight: "Light",
    buttonStyle: "Square"
  },
  {
    mood: "Depression",
    colors: ["#3C3127"],
    fontStyles: ["Custom"],
    customFonts: [
      { "Font Name": "Goudy Bookletter 1911", "Type": "Serif" },
      { "Font Name": "Raleway", "Type": "Sans-Serif" },
      { "Font Name": "Smooch Sans", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Giga", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Zetta", "Type": "Sans-Serif" },
      { "Font Name": "Lexend Peta", "Type": "Sans-Serif" },
      { "Font Name": "Poiret One", "Type": "Display" },
      { "Font Name": "Quicksand", "Type": "Sans-Serif" }
    ],
    fontWeight: "Light",
    buttonStyle: "Square"
  }
];
