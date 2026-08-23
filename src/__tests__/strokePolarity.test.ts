/**
 * Stroke measurement must not depend on which way the contrast runs.
 *
 * analyzeStrokes binarizes the crop before measuring stem widths, and it used
 * to treat DARK pixels as ink outright. On light-on-dark lettering — a bright
 * display face over a dark ground, which is most album art, most hero images
 * and most posters — the letters fail the dark test and the BACKGROUND passes
 * it. Every measurement downstream then describes the gaps BETWEEN letters:
 * stems come out hairline, weightRatio lands near 0.01, and the heaviest face
 * in the sample is reported as `thin, extended`.
 *
 * It never threw and never returned undefined. It returned a confident wrong
 * answer, and the high-side sanity gate (weightRatio > 0.5) could not catch it
 * because an inverted scan produces a LOW ratio, not a high one.
 *
 * Both fixtures below are the SAME lettering — 5 bars, 16px wide, 80px tall,
 * so a true stroke ratio of 0.20 and a `heavy` verdict. Only the polarity
 * differs. Any future binarizer change has to keep them agreeing.
 */
import { describe, it, expect, vi } from 'vitest';
import { analyzeStrokes } from '../utils/textDetection';

/** 100x80 crop: 5 bright bars (16px wide) on a dark ground — heavy light-on-dark. */
function makePixels(w: number, h: number, lightOnDark: boolean) {
  const d = new Uint8ClampedArray(w * h * 4);
  const ink = lightOnDark ? [245, 220, 40] : [20, 20, 30];
  const bg = lightOnDark ? [18, 22, 60] : [250, 250, 250];
  // A ground margin all round, then 5 bars whose width is 20% of the INK height
  // — a true stroke ratio of 0.20, i.e. `heavy`.
  const pad = Math.round(h * 0.12);
  const inkH = h - pad * 2;
  const barW = Math.round(inkH * 0.2);
  const pitch = Math.round(barW * 2.2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inBand = y >= pad && y < h - pad && x >= pad;
      const idx = Math.floor((x - pad) / pitch);
      const inBar = inBand && idx >= 0 && idx < 5 && (x - pad) % pitch < barW;
      const c = inBar ? ink : bg;
      const p = (y * w + x) * 4;
      d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
    }
  }
  return d;
}

function run(lightOnDark: boolean) {
  // analyzeStrokes pads the bbox with a margin of ground before rasterising, so
  // the canvas it asks for is LARGER than the box. The stub therefore generates
  // its pixels from the canvas size the code actually sets, rather than from a
  // fixed array — otherwise the data and the width it is indexed by disagree
  // and every measurement below is nonsense.
  const box = 80;
  const canvas: any = { width: 0, height: 0 };
  canvas.getContext = () => ({
    imageSmoothingQuality: '',
    drawImage: () => {},
    getImageData: () => ({ data: makePixels(canvas.width, canvas.height, lightOnDark) }),
  });
  vi.stubGlobal('document', { createElement: () => canvas });
  const r = analyzeStrokes({ naturalWidth: 400, naturalHeight: 400 } as any,
    { x0: 100, y0: 100, x1: 100 + 120, y1: 100 + box });
  return { weight: r.weight, ratio: r.weightRatio, stems: r.strokeCount };
}

describe('stroke polarity', () => {
  it('measures the same lettering identically at both polarities', () => {
    const light = run(true);   // bright ink on a dark ground
    const dark = run(false);   // dark ink on a bright ground
    expect({ weight: light.weight, ratio: +light.ratio.toFixed(2), stems: light.stems })
      .toEqual({ weight: dark.weight, ratio: +dark.ratio.toFixed(2), stems: dark.stems });
  });

  it('reads heavy bars as heavy, not thin, whichever way the contrast runs', () => {
    for (const lightOnDark of [true, false]) {
      const r = run(lightOnDark);
      expect(r.weight, `lightOnDark=${lightOnDark}`).toBe('heavy');
      expect(r.ratio, `lightOnDark=${lightOnDark}`).toBeGreaterThan(0.15);
      expect(r.stems, `lightOnDark=${lightOnDark}`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('Otsu threshold, not a fixed RGB cut', () => {
  // The Busyhead case. Dark teal ink rgb(26,95,122) on yellow rgb(245,213,71).
  // Under the old fixed `< 120 on every channel` test, red and green clear the
  // cut and BLUE misses it by two — so the ink is not ink, the scan measures
  // noise, and a thin marker hand was reported `heavy, normal` where omni
  // measured `thin, condensed`. Otsu puts the threshold where the split
  // actually falls, whatever the hue.
  const tealOnYellow = (w: number, h: number) => {
    const d = new Uint8ClampedArray(w * h * 4);
    const pad = Math.round(h * 0.12);
    const inkH = h - pad * 2;
    const barW = Math.max(2, Math.round(inkH * 0.08));   // a THIN stroke
    const pitch = Math.round(barW * 6);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inBand = y >= pad && y < h - pad && x >= pad;
        const idx = Math.floor((x - pad) / pitch);
        const inBar = inBand && idx >= 0 && idx < 5 && (x - pad) % pitch < barW;
        const c = inBar ? [26, 95, 122] : [245, 213, 71];
        const p = (y * w + x) * 4;
        d[p] = c[0]; d[p + 1] = c[1]; d[p + 2] = c[2]; d[p + 3] = 255;
      }
    }
    return d;
  };

  it('finds thin teal strokes on yellow that a fixed threshold misses', () => {
    const canvas: any = { width: 0, height: 0 };
    canvas.getContext = () => ({
      imageSmoothingQuality: '',
      drawImage: () => {},
      getImageData: () => ({ data: tealOnYellow(canvas.width, canvas.height) }),
    });
    vi.stubGlobal('document', { createElement: () => canvas });
    const r = analyzeStrokes({ naturalWidth: 400, naturalHeight: 400 } as any,
      { x0: 100, y0: 100, x1: 340, y1: 180 });

    expect(r.strokeCount, 'the ink must be found at all').toBeGreaterThanOrEqual(3);
    expect(r.weight, 'a thin marker hand must not read heavy').toBe('thin');
  });
});
