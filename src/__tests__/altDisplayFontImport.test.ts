/** The Alt Display weight is fetched, not just declared. */
import { describe, it, expect, vi } from 'vitest';
import { generateBaseCSS } from '../utils/cssgen/exportToCSS';
import { altDisplayWeight } from '../utils/altDisplay';
import { weightsFor } from '../utils/googleFontWeights';

describe('Google Fonts import — Alt Display', () => {
  it('requests the Alt weight alongside the Display weight', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const alt = altDisplayWeight(700, weightsFor('Fredoka'));
    expect(alt).toBeDefined();
    const css = generateBaseCSS({ Typography: {
      'Set-Font-Family-Display': { value: "'Fredoka', sans-serif" },
      'Set-Display-Font-Weight': { value: 700 },
    } });
    const m = css.match(/family=Fredoka:wght@([\d;]+)/);
    expect(m).not.toBeNull();
    expect(m![1].split(';').map(Number)).toEqual(expect.arrayContaining([700, alt!]));
  });
});
