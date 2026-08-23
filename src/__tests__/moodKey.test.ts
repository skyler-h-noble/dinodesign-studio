import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moodKeyFor, SERVER_MOOD_ALIAS } from '../utils/moodKey';
import { moodFontMapping } from '../data/moodFontMapping';

/** The mood keys matchMood() can actually return, read from the function
 *  itself so a mood added server-side fails here instead of silently
 *  collapsing to the default pool. */
function serverMoodKeys(): string[] {
  const src = readFileSync(
    resolve(__dirname, '../../functions/analyzeMoodboard.js'),
    'utf8',
  );
  const start = src.indexOf('const scores = {');
  expect(start, 'matchMood scores block not found — did the function move?').toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf('};', start));
  return [...block.matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1]);
}

describe('mood key routing', () => {
  it('covers every mood the server can emit', () => {
    const keys = serverMoodKeys();
    expect(keys.length).toBeGreaterThanOrEqual(14);
    const uncovered = keys.filter((k) => !(k in SERVER_MOOD_ALIAS));
    expect(uncovered, `server moods with no pool mapping: ${uncovered.join(', ')}`).toEqual([]);
  });

  it('routes to real pools, not one collapsed default', () => {
    const keys = serverMoodKeys();
    const reached = new Set(keys.map((k) => moodKeyFor(k)));
    // The regression: all 14 resolved to Calm, so this was 1.
    expect(reached.size).toBeGreaterThan(1);
    for (const pool of reached) expect(moodFontMapping).toHaveProperty(pool);
  });

  it('routes the specific moods that were collapsing', () => {
    expect(moodKeyFor('whimsical_playful')).toBe('Playful');
    expect(moodKeyFor('neon_cyberpunk')).toBe('Futuristic');
    expect(moodKeyFor('warm_retro_vintage')).toBe('Vintage');
    expect(moodKeyFor('industrial_urban')).toBe('Rugged');
  });

  it('still resolves label-shaped and unknown moods', () => {
    expect(moodKeyFor('Modern')).toBe('Business');
    expect(moodKeyFor('Warm Retro / Vintage')).toBe('Vintage');
    expect(moodKeyFor(null)).toBe('Calm');
    expect(moodKeyFor('something-nobody-defined')).toBe('Calm');
  });

  it('every mapped pool is non-empty', () => {
    for (const pool of Object.values(SERVER_MOOD_ALIAS)) {
      expect(moodFontMapping[pool].length, `${pool} pool is empty`).toBeGreaterThan(0);
    }
  });
});
