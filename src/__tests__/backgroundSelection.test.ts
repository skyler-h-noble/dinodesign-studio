/**
 * The theme + surface grid, and the legacy strings it has to keep honouring.
 *
 * 17 published systems store 'white' / 'black' / 'primary-base' /
 * 'primary-light'. A background that shifts by a tone on reload is a brand
 * change nobody asked for, so the four legacy names are pinned to the exact
 * tones they resolve to today.
 */
import { describe, it, expect } from 'vitest';
import {
  parseBackground, formatBackground, legacyName, toneFor,
  BACKGROUND_THEMES, SURFACE_LEVELS,
} from '../utils/backgroundSelection';

describe('background selection', () => {
  // The tones the four legacy options resolve to in buildPreviewCSS today:
  //   white → Neutral 12, black → Neutral 1,
  //   primary-light → Primary 11, primary-base → Primary PC (core tone)
  const CORE = 6;
  it.each([
    { legacy: 'white',         theme: 'Neutral', surface: 'Surface-Brightest', tone: 12 },
    { legacy: 'black',         theme: 'Neutral', surface: 'Surface-Dimmest',   tone: 1 },
    { legacy: 'primary-light', theme: 'Primary', surface: 'Surface-Brightest', tone: 11 },
    { legacy: 'primary-base',  theme: 'Primary', surface: 'Surface',           tone: CORE },
  ])('$legacy resolves to $theme / $surface at Color-$tone', ({ legacy, theme, surface, tone }) => {
    const sel = parseBackground(legacy);
    expect(sel).toEqual({ theme, surface });
    expect(toneFor(sel.theme, sel.surface, CORE)).toBe(tone);
    expect(legacyName(sel)).toBe(legacy);
  });

  it('round-trips the serialised form', () => {
    for (const theme of BACKGROUND_THEMES) {
      for (const surface of SURFACE_LEVELS) {
        expect(parseBackground(formatBackground({ theme, surface }))).toEqual({ theme, surface });
      }
    }
  });

  it('offers 20 combinations', () => {
    expect(BACKGROUND_THEMES.length * SURFACE_LEVELS.length).toBe(20);
  });

  // Surface-Brightest differs by theme ON PURPOSE — Color-12 on a chromatic
  // ramp reads as white and throws away the tint that makes it branded.
  it('keeps Surface-Brightest branded on chromatic themes', () => {
    expect(toneFor('Neutral', 'Surface-Brightest', CORE)).toBe(12);
    for (const theme of ['Primary', 'Secondary', 'Tertiary'] as const) {
      expect(toneFor(theme, 'Surface-Brightest', CORE)).toBe(11);
    }
  });

  // Surface follows the brand's own core tone on a chromatic theme, so
  // primary-base stays whatever that brand extracted rather than a fixed 6.
  it('uses the core tone for Surface on chromatic themes only', () => {
    expect(toneFor('Primary', 'Surface', 4)).toBe(4);
    expect(toneFor('Primary', 'Surface', 8)).toBe(8);
    expect(toneFor('Neutral', 'Surface', 4)).toBe(6);
  });

  // Fixed tones around a moving core do not survive a light or dark brand —
  // at core 10 Surface-Bright landed BELOW Surface. Every core must stay ordered.
  it('stays ordered for every possible core tone', () => {
    for (let core = 1; core <= 12; core++) {
      const tones = SURFACE_LEVELS.map((s) => toneFor('Primary', s, core));
      for (let i = 1; i < tones.length; i++) {
        expect(`core${core}/step${i}:${tones[i] > tones[i - 1]} [${tones.join(',')}]`)
          .toBe(`core${core}/step${i}:true [${tones.join(',')}]`);
      }
    }
  });

  it('every combination lands on a real tone, and the ramp never runs backwards', () => {
    for (const theme of BACKGROUND_THEMES) {
      const tones = SURFACE_LEVELS.map((s) => toneFor(theme, s, CORE));
      for (const t of tones) expect(t).toBeGreaterThanOrEqual(1);
      for (const t of tones) expect(t).toBeLessThanOrEqual(12);
      for (let i = 1; i < tones.length; i++) {
        expect(`${theme}/step${i}:${tones[i] > tones[i - 1]}`).toBe(`${theme}/step${i}:true`);
      }
    }
  });

  it('falls back to white on anything unrecognised', () => {
    for (const bad of [null, undefined, '', 'nonsense', 'Primary/Nope']) {
      expect(parseBackground(bad as never)).toEqual({ theme: 'Neutral', surface: 'Surface-Brightest' });
    }
  });
});
