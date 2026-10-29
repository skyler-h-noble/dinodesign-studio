/**
 * The button border width is a style choice, 1px or 2px, read by one helper
 * for the CSS export, the Figma payload and the live preview.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buttonBorderWidthPx, buttonSelectedBorderWidthPx } from '../utils/componentRadii';
import { componentStyleVars } from '../utils/componentStyleVars';

describe('button border width', () => {
  it('is 1 unless 2 is chosen', () => {
    expect([buttonBorderWidthPx(undefined), buttonBorderWidthPx(1), buttonBorderWidthPx(2), buttonBorderWidthPx(3)]).toEqual([1, 1, 2, 1]);
  });
  it('selected is rest + 1: 2px on a 1px brand, 3px on a 2px one', () => {
    expect([buttonSelectedBorderWidthPx(undefined), buttonSelectedBorderWidthPx(1), buttonSelectedBorderWidthPx(2)]).toEqual([2, 2, 3]);
  });
  it('reaches the preview variables', () => {
    expect(componentStyleVars('modern', { buttonBorderWidth: 2 } as never)['--Button-Border-Width']).toBe('2px');
    expect(componentStyleVars('modern', {} as never)['--Button-Border-Width']).toBe('1px');
  });
  it('no exporter hard-codes the width any more', () => {
    for (const f of ['src/utils/cssgen/exportToCSS.ts', 'src/utils/generateFigmaJSON.ts', 'src/components/stages/ComponentStyleStage.tsx']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/--Button-Border-Width[^\n]*['`:]\s*[12]px['`;]/);
      expect(src, f).not.toMatch(/'Button-Border-Width':\s*\d/);
    }
  });
});
