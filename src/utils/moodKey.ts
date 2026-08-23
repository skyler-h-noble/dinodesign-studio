/**
 * Mood key routing: the classifier's vocabulary → a pool moodFontMapping has.
 *
 * Lives in its own module so the routing can be tested without importing the
 * typography page (and with it, the whole component tree).
 */
import { moodFontMapping, type MoodName } from '../data/moodFontMapping';

/**
 * matchMood() in functions/analyzeMoodboard.js returns snake_case keys from
 * its own fourteen-mood vocabulary. NOT ONE of them matched the pool names —
 * not by exact match, not through the loose alias table below. Every board of
 * every palette fell through to Calm, so "suggest from the palette mood"
 * reached 1 of 18 pools and the mood was computed, scored, then discarded.
 *
 * The bug was invisible because the fallback is a real pool that renders real
 * fonts: nothing errored, nothing was empty, the suggestions were simply
 * unrelated to the board.
 *
 * Keep this exhaustive over matchMood()'s keys. moodKey.test.ts reads that
 * file and fails if it grows a mood this table does not cover.
 */
export const SERVER_MOOD_ALIAS: Record<string, MoodName> = {
  whimsical_playful: 'Playful',
  neon_cyberpunk: 'Futuristic',
  warm_retro_vintage: 'Vintage',
  boho_festival: 'Artistic',
  industrial_urban: 'Rugged',
  dark_romance_gothic: 'Scary',
  soft_romantic: 'Elegant',
  luxury_editorial_black: 'Sophisticated',
  modern_luxury_fashion: 'Sophisticated',
  old_money: 'Sophisticated',
  clean_tech: 'Business',
  editorial_modern: 'Business',
  minimal_scandinavian: 'Stiff',
  natural_organic: 'Calm',

  // The bright register. These moods exist because Happy, Cute, Childlike,
  // Excited, Loud and Active were unreachable — whimsical_playful -> Playful
  // was the only route into the entire bright half of the mapping, so a
  // rainbow board had one destination and six pools were dead weight.
  bright_cheerful: 'Happy',
  candy_pastel: 'Cute',
  kids_primary: 'Childlike',
  high_energy: 'Excited',
  bold_graphic: 'Loud',
  sport_dynamic: 'Active',
};

/** Looser aliases for label-shaped moods ("Modern", "Warm") that reach here
 *  when a preset carries a human label rather than a key. */
const LABEL_ALIAS: Record<string, MoodName> = {
  modern: 'Business', professional: 'Business', tech: 'Futuristic',
  warm: 'Happy', bold: 'Loud', minimal: 'Stiff', formal: 'Sophisticated',
  romantic: 'Elegant', friendly: 'Happy', energetic: 'Excited',
  nostalgic: 'Vintage', creative: 'Artistic', quiet: 'Calm',
};

const DEFAULT_POOL: MoodName = 'Calm';

export function moodKeyFor(mood?: string | null): MoodName {
  const raw = String(mood ?? '').replace(/-\d+$/, '').trim();
  const keys = Object.keys(moodFontMapping) as MoodName[];
  const exact = keys.find((k) => k.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  // Human labels arrive spaced or punctuated ("Warm Retro / Vintage").
  const slug = raw.toLowerCase().replace(/[\s/&·-]+/g, '_').replace(/_+/g, '_');
  const hit = SERVER_MOOD_ALIAS[raw.toLowerCase()]
    ?? SERVER_MOOD_ALIAS[slug]
    ?? LABEL_ALIAS[raw.toLowerCase()];
  if (hit) return hit;
  // Say so. This default swallowed all fourteen server moods for months and
  // nothing reported it, because the fallback is a real pool that renders real
  // fonts — the suggestions were simply unrelated to the board. A silent
  // catch-all cannot be distinguished from a working lookup.
  if (raw && process.env.NODE_ENV !== 'production') {
    console.warn(
      `[mood] no font pool for "${raw}" — falling back to ${DEFAULT_POOL}. ` +
      'Add it to SERVER_MOOD_ALIAS in utils/moodKey.ts.',
    );
  }
  return DEFAULT_POOL;
}
