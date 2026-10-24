import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import { CHART_COLOR_VISION, chartColorVisionCSS } from '../utils/chartColorVision';

/* Every color must clear 3:1 against the chart ground it is drawn on —
   checked against plain white / near-black AND Surf's Up's own grounds, since
   these literals are shared by every brand. */
const GROUNDS = { light: ['#ffffff', '#fffcf7'], dark: ['#121212', '#322e25'] };

describe('color-vision chart sets', () => {
  it('has seven sets of ten series and four states', () => {
    expect(Object.keys(CHART_COLOR_VISION)).toHaveLength(7);
    for (const set of Object.values(CHART_COLOR_VISION)) {
      expect(set.series).toHaveLength(10);
      expect(Object.keys(set.states)).toEqual(['Error', 'Warning', 'Success', 'Info']);
    }
  });

  it('the state four clear 3:1 on both grounds', () => {
    const fails: string[] = [];
    for (const [attr, set] of Object.entries(CHART_COLOR_VISION)) {
      for (const [st, [light, dark]] of Object.entries(set.states)) {
        for (const g of GROUNDS.light) if (chroma.contrast(light, g) < 3) fails.push(`${attr} ${st} light ${light} on ${g}`);
        for (const g of GROUNDS.dark) if (chroma.contrast(dark, g) < 3) fails.push(`${attr} ${st} dark ${dark} on ${g}`);
      }
    }
    expect(fails).toEqual([]);
  });

  it('the ten series clear 3:1 on both grounds', () => {
    const fails: string[] = [];
    for (const [attr, set] of Object.entries(CHART_COLOR_VISION)) {
      set.series.forEach(([light, dark], i) => {
        for (const g of GROUNDS.light) if (chroma.contrast(light, g) < 3) fails.push(`${attr} Chart-${i + 1} light ${light} on ${g}: ${chroma.contrast(light, g).toFixed(2)}`);
        for (const g of GROUNDS.dark) if (chroma.contrast(dark, g) < 3) fails.push(`${attr} Chart-${i + 1} dark ${dark} on ${g}: ${chroma.contrast(dark, g).toFixed(2)}`);
      });
    }
    expect(fails).toEqual([]);
  });

  it('writes the light half to Surface-Brightest and the dark half to Surface-Dimmest', () => {
    const css = chartColorVisionCSS(['Surface-Brightest', 'Surface-Dimmest']);
    const block = (attr: string, level: string) => {
      const start = css.indexOf(`[data-color-vision="${attr}"] [data-surface="${level}"]`);
      return css.slice(start, css.indexOf('}', start));
    };
    expect(block('red-blind', 'Surface-Brightest')).toContain('--Chart-1: #060b24;');
    expect(block('red-blind', 'Surface-Dimmest')).toContain('--Chart-1: #ffdbc6;');
    expect(block('blue-cone', 'Surface-Dimmest')).toContain('--Chart-Error: #cb7366;');
  });

  it('a mode sheet with only the dark ground gets only the dark blocks', () => {
    const css = chartColorVisionCSS(['Surface-Dimmest']);
    expect(css).not.toContain('Surface-Brightest');
    expect(css).toContain('[data-color-vision="green-weak"][data-surface="Surface-Dimmest"]');
  });
});
