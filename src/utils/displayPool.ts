/**
 * Which pool of families the Display picker offers, and why.
 *
 * Extracted from the useMemo it lived in so it can be TESTED. Three sources
 * feed this — an explicit user choice, the palette mood, and the detected
 * lettering — and every bug in this area so far has been one source silently
 * shadowing another: the mood key that resolved to one pool for all fourteen
 * moods, the override that a var() fallback could never reach, the default
 * option whose empty value made it unselectable. None of those were visible
 * from the outside, because every wrong answer is still a list of real fonts.
 */
import { moodFontMapping, type MoodName } from '../data/moodFontMapping';
import { moodKeyFor } from './moodKey';

export const AUTO = 'auto';

export interface PoolChoice { family: string; category: string; label: string }

/** Where the offered families came from. Surfaced so the UI can say so, and
 *  so a test can assert the SOURCE rather than just the resulting list. */
export type PoolSource = 'override-category' | 'override-mood' | 'mood' | 'detected';

export interface PoolResult { source: PoolSource; key: string; choices: PoolChoice[] }

const LIMIT = 20;

function fromMood(moodKey: MoodName, source: PoolSource): PoolResult {
  const pool = moodFontMapping[moodKey] ?? [];
  return {
    source,
    key: moodKey,
    choices: pool.slice(0, LIMIT).map((f: any) => ({
      family: f.name, category: `${moodKey} · ${f.type}`, label: f.name,
    })),
  };
}

/**
 * @param override    'auto' | `cat:<Category>` | `mood:<Mood>`
 * @param ignoreText  the "disregard the lettering" switch
 * @param mood        the mood the analysis reported (key or label)
 * @param categoryPools  CATEGORY_FAMILY_POOLS, injected so this module does not
 *                       depend on the page's constant table
 * @param detected    the detection-derived choices, computed by the caller
 */
/**
 * Put the family the system is ALREADY using into the list, if the pool left
 * it out.
 *
 * Every branch below builds its choices from a pool, and none of them know
 * what the design is currently set to. So a saved family that is not in the
 * pool the picker happens to resolve — a different mood, a different detected
 * category, or a system saved before detections were kept — is simply absent,
 * and a picker that cannot show its own value shows nothing selected.
 *
 * That reads as "the font was lost". It was not: the value is still in the
 * design and still in the published CSS. What is broken is only the control's
 * ability to represent it. The quiet half is worse than the confusing half —
 * the next click sets a family the user never chose, and overwrites the real
 * one with no warning, because from the control's point of view nothing was
 * selected to begin with.
 *
 * Grouped under its real category when it has one, so it sits where someone
 * would look for it rather than in a special box. It may push the list one
 * over LIMIT; trimming a pool entry to make room would be trading a visible
 * item for a visible item, and this one has to be there.
 */
function withCurrent(result: PoolResult, current: string | null | undefined,
                     categoryPools: Record<string, string[]>): PoolResult {
  if (!current) return result;
  if (result.choices.some((c) => c.family === current)) return result;
  const home = Object.keys(categoryPools).find((k) => categoryPools[k].includes(current));
  return {
    ...result,
    choices: [{ family: current, category: home ?? 'In this design', label: current },
              ...result.choices],
  };
}

export function resolveDisplayPool(args: {
  override: string;
  ignoreText: boolean;
  mood: string | null | undefined;
  categoryPools: Record<string, string[]>;
  detected: () => PoolChoice[];
  /** The family the design is set to right now, so the picker can show it as
   *  selected even when it falls outside the resolved pool. */
  current?: string | null;
}): PoolResult {
  const { override, ignoreText, mood, categoryPools, detected, current } = args;
  const pin = (r: PoolResult) => withCurrent(r, current, categoryPools);

  // An explicit choice wins over BOTH other sources, including the mood.
  // Checked first so turning "disregard the lettering" on or off never discards
  // a choice the user already made.
  if (override && override !== AUTO) {
    const idx = override.indexOf(':');
    const kind = idx === -1 ? override : override.slice(0, idx);
    const value = idx === -1 ? '' : override.slice(idx + 1);
    if (kind === 'mood') return pin(fromMood(value as MoodName, 'override-mood'));
    const pool = categoryPools[value] ?? [];
    return pin({
      source: 'override-category',
      key: value,
      choices: pool.slice(0, LIMIT).map((family) => ({ family, category: value, label: family })),
    });
  }

  // Disregarding the lettering does not mean "no suggestion" — it means the
  // suggestion comes from the mood instead. This is the branch that makes the
  // mood visible in the dropdown as the active style.
  if (ignoreText) return pin(fromMood(moodKeyFor(mood), 'mood'));

  return pin({ source: 'detected', key: '', choices: detected() });
}

/** What the dropdown's auto option should be labelled, so the user can read
 *  which style is actually in effect instead of the word "auto". */
export function autoLabel(ignoreText: boolean, mood: string | null | undefined): string {
  if (!ignoreText) return 'Follow what was detected';
  const key = moodKeyFor(mood);
  return `${key} — from the ${mood || 'detected'} mood`;
}

/**
 * The families a DETECTED classification should offer, in order.
 *
 * Lives here, not in the component, for the same reason the source-order logic
 * does: every bug in this area returns a list of real fonts, so a wrong answer
 * looks exactly like a right one and only a test can tell them apart.
 *
 * Takes the EFFECTIVE branch and style — the pixel-corrected verdict that the
 * Detection details panel renders — plus the raw CLIP category and the flag
 * saying whether the pixel scan overruled CLIP. Reading CLIP's category when it
 * had already been overruled is what made the panel say "Expressive · Formal
 * Script" while the list underneath offered Oswald, Lato and Inter.
 */
export function detectedPoolChoices(args: {
  clipCategory: string | null | undefined;
  branch: string;
  style: string;
  pixelOverride: boolean;
  categoryPools: Record<string, string[]>;
}): PoolChoice[] {
  const { clipCategory, branch, style, pixelOverride, categoryPools } = args;

  // When the scan overruled CLIP, CLIP's category is the label already judged
  // wrong — so the corrected style is the one to match on.
  const detectedCategory = (pixelOverride ? style : (clipCategory ?? style)) ?? '';
  // Branch vocabularies differ between the classifier ('Sans serif') and the
  // pool keys ('Sans / …'), so match on the first word rather than the label.
  // On an override the category is a bare style name with no branch prefix to
  // split off, so take the effective branch directly.
  const rawBranch = (pixelOverride
    ? branch
    : (detectedCategory.split('/')[0] || branch || '')).trim();
  const branchKey = /serif/i.test(rawBranch) && !/sans/i.test(rawBranch) ? 'Serif'
    : /sans/i.test(rawBranch) ? 'Sans'
      : /express|script|hand|display/i.test(rawBranch) ? 'Expressive'
        : '';

  const allCategories = Object.keys(categoryPools);
  const inBranch = branchKey ? allCategories.filter((c) => c.startsWith(branchKey)) : allCategories;
  // The detected category leads; its siblings follow. Anything unrecognised
  // falls back to the whole set rather than showing nothing.
  // Match on "<Branch> / <Style>" as well as on the bare style. The classifier
  // returns a style alone ('Hand'), while the pools are keyed by the full
  // "Expressive / Hand" — so a bare style never matched EXACTLY and fell to the
  // fuzzy `near` test below, which takes the first key merely CONTAINING the
  // first word. 'Hand' therefore landed on 'Expressive / Handwritten Script'
  // rather than 'Expressive / Hand', because that key contains "hand" and comes
  // first. Both are hand pools, so the result looked reasonable and was wrong.
  const qualified = branchKey ? `${branchKey} / ${detectedCategory}` : detectedCategory;
  const exact = allCategories.find(
    (c) => c.toLowerCase() === detectedCategory.toLowerCase()
      || c.toLowerCase() === qualified.toLowerCase(),
  );
  const near = exact ?? inBranch.find((c) => {
    const tail = detectedCategory.split('/').pop()?.trim().toLowerCase() ?? '';
    return tail && c.toLowerCase().includes(tail.split(' ')[0]);
  });
  const ordered = [
    ...(near ? [near] : []),
    ...(inBranch.length ? inBranch : allCategories).filter((c) => c !== near),
  ];

  // Capped at 20, the detected category taken whole before its siblings are
  // drawn on. A branch's full pool ran to 30+, which turns a decision into a
  // scroll.
  const out: PoolChoice[] = [];
  const seen = new Set<string>();
  for (const category of ordered) {
    if (out.length >= LIMIT) break;
    for (const family of categoryPools[category] ?? []) {
      if (out.length >= LIMIT) break;
      if (seen.has(family)) continue;
      seen.add(family);
      out.push({ family, category, label: family });
    }
  }
  return out;
}
