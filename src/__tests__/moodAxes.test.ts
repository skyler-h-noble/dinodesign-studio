import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeMood, moodToAxes, SERVER_AXIS_MOOD } from '../utils/moodAxes';

/** The mood keys matchMood() can return, read from the function itself so a
 *  mood added server-side fails here rather than silently taking the default. */
function serverMoodKeys(): string[] {
  const src = readFileSync(resolve(__dirname, '../../functions/analyzeMoodboard.js'), 'utf8');
  const start = src.indexOf('const scores = {');
  expect(start).toBeGreaterThan(-1);
  return [...src.slice(start, src.indexOf('};', start)).matchAll(/^\s{4}([a-z_]+):/gm)].map((m) => m[1]);
}

describe('mood → Google Sans Flex axes', () => {
  it('every server mood reaches the axis vocabulary', () => {
    // Tested against the explicit table, not against the default value:
    // 'Modern' is a legitimate destination, so "differs from the default"
    // cannot tell a mapped mood from an unmapped one.
    const unmapped = serverMoodKeys().filter((k) => !(k in SERVER_AXIS_MOOD));
    expect(unmapped, `server moods with no axis mapping: ${unmapped.join(', ')}`).toEqual([]);
  });

  it('does not collapse every board to one setting', () => {
    // The regression: all 14 produced byte-identical axes, so the header face
    // was the same for every design system ever generated.
    const distinct = new Set(serverMoodKeys().map((k) => JSON.stringify(moodToAxes(k))));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('gives opposite moods different axes', () => {
    expect(moodToAxes('whimsical_playful')).not.toEqual(moodToAxes('luxury_editorial_black'));
    expect(moodToAxes('neon_cyberpunk')).not.toEqual(moodToAxes('natural_organic'));
  });

  it('still sets the header AGAINST a heavy display', () => {
    // The opposition rule must survive the mapping — a heavy Display pins the
    // header thin regardless of which mood it came from.
    const heavy = moodToAxes('whimsical_playful', { displayWeight: 'heavy' } as any);
    expect(heavy.wght).toBeLessThanOrEqual(280);
  });

  it('unknown moods still resolve rather than throw', () => {
    expect(normalizeMood('nobody-defined-this')).toBe('Modern');
    expect(normalizeMood(null)).toBe('Modern');
  });
});
