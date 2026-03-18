# Mood → Component Style Mapping

This document shows how DynoDesign maps detected color moods to component styles.

The primary color is compared against the color mood database using chroma.deltaE distance. The closest mood is then mapped to one of the four component styles.

---

## Component Styles

| Style | Aesthetic | Border Radius |
|-------|-----------|---------------|
| **Professional** | Corporate, clean, trustworthy | 4px |
| **Modern** | Contemporary, minimalist | 12px |
| **Bold** | Strong, sharp, high-contrast | 2px |
| **Playful** | Rounded, friendly, dynamic | 24px |

---

## Mood → Style Mapping

### Professional
| Mood | Why |
|------|-----|
| Professional | Direct match |
| Serious | Corporate tone |
| Elegant | Refined, classic |
| Sophisticated | Polished feel |
| Determined | Strong, focused |
| Formal | Structured |
| Security | Trust, stability |
| Timeless | Enduring, classic |

### Modern
| Mood | Why |
|------|-----|
| Modern | Direct match |
| Minimal | Clean, simple |
| Tech | Digital, forward |
| Calm | Balanced, serene |
| Warm | Approachable but refined |
| Romantic | Soft, contemporary |
| Vintage | Retro-modern aesthetic |
| Feminine | Graceful curves |
| Delicate | Gentle, refined |
| Charming | Attractive, balanced |

### Bold
| Mood | Why |
|------|-----|
| Bold | Direct match |
| Energetic | High energy, sharp |
| Rebellious | Breaking conventions |
| Passionate | Intense, strong |
| Sassy | Confident, striking |

### Playful
| Mood | Why |
|------|-----|
| Playful | Direct match |
| Fun | Light-hearted |
| Creative | Experimental |
| Cute | Soft, rounded |
| Happy | Cheerful, bouncy |
| Giddy | Excited, bubbly |
| Spirited | Lively, animated |

---

## Unmapped Moods

Any mood not listed above defaults to **Modern**.

The color mood database (`colorMoodMapping.ts`) contains 80+ moods including: Healthy, Balanced, Friendly, Goofy, Sickly, Naive, Bright, Wealth, Immature, Flamboyant, Perseverance, Selfish, Passive, Attractive, Grace, Loyalty, Reflective, Tired, Hopeful, Cold, Fresh, Purity, Innocence, Indecisive, Blase, Dense, Unknown, Mystery, Childish, Bitter, Permissive, Envy, Entitled, Juvenile, Perky, Weak, Mellow, Mysterious, Victorious, Ambitious, Intense, Proud, Mystic, Fearful, Indifferent, Pensive, Nostalgic, Sad, Neutrality, Warmth, Comforting, Resilience, Dependable, Wholesome, Sustainable, Unemotional, Detached, Genuine, Practical, Loneliness, Isolation, Depression.

---

## Source Code

**File:** `src/utils/autoSuggestStyle.ts`

**How it works:**
1. Takes the primary color hex
2. Compares against all mood colors using `chroma.deltaE()` distance
3. Finds the closest mood
4. Strips any `-N` suffix (e.g., "Calm-2" → "Calm")
5. Looks up the mood in `MOOD_TO_STYLE`
6. Returns the component style (defaults to `'modern'`)

---

*Generated for DynoDesign v3*
