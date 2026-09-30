/**
 * Device chrome reaches both export surfaces, saying the same thing.
 *
 * The bug this exists for is not a wrong number — it is a missing one. The
 * overlay offsets were computed, tested, and emitted to the Figma payload,
 * and reached the CSS and the design-token JSON nowhere at all. Every test
 * passed, because every test asked the payload.
 *
 * That is invariant 5 in the shape it actually takes: "the preview is a
 * separate implementation from the export... an unresolved var() paints
 * nothing and reports nothing". A never-emitted --SnackBar-Top is the same
 * silence one step earlier.
 *
 * So these assertions deliberately cross the surfaces rather than checking
 * each one against a literal. A literal in a test is a fourth copy of the
 * number, and a fourth copy drifts like the other three.
 */
import { describe, it, expect } from 'vitest';
import {
  DEVICE_MODES, APP_AND_STATUS, BOTTOM_INDICATOR, FLOAT_CLEARANCE,
  overlayOffsets, overlayOffsetNames, overlayOffsetCSS,
  platformOverlayOffsets, devicesFor,
} from '../utils/deviceChrome';
import { CSS_PLATFORMS, type CSSPlatform } from '../utils/platformMetrics';
import { SEEDS_FROM } from '../utils/typographyPlatform';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Pull `--Name: 98px;` back out of the generated declarations. */
function parseCSS(platform: CSSPlatform): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of overlayOffsetCSS(platform)) {
    const m = line.match(/--([\w-]+):\s*(-?\d+)px;/);
    if (m) out[m[1]] = Number(m[2]);
  }
  return out;
}

describe('the seven devices collapse onto four platform blocks', () => {
  it('assigns every device to exactly one block', () => {
    const seen = DEVICE_MODES.map((d) => CSS_PLATFORMS.filter((p) => devicesFor(p).includes(d)));
    expect(Object.fromEntries(DEVICE_MODES.map((d, i) => [d, seen[i].length])))
      .toEqual(Object.fromEntries(DEVICE_MODES.map((d) => [d, 1])));
  });

  it('leaves no platform block empty', () => {
    for (const p of CSS_PLATFORMS) expect(`${p}: ${devicesFor(p).length > 0}`).toBe(`${p}: true`);
  });

  it('refuses a platform nothing feeds, rather than returning a default', () => {
    expect(() => platformOverlayOffsets('Watch' as CSSPlatform)).toThrow(/No device feeds/);
  });

  /* The collapse is lossless TODAY and the code says so; this is the assertion
     that notices the day it stops being true. It is written against the raw
     device tables rather than against platformOverlayOffsets, because that
     function THROWS on a disagreement — so asking it would turn a clear
     "Android's two devices now differ" into an unexplained crash. */
  it('has nothing to lose: devices sharing a block reserve the same chrome', () => {
    const disagreements: string[] = [];
    for (const p of CSS_PLATFORMS) {
      const ds = devicesFor(p);
      for (const table of [APP_AND_STATUS, BOTTOM_INDICATOR, FLOAT_CLEARANCE]) {
        const vals = new Set(ds.map((d) => table[d]));
        if (vals.size > 1) disagreements.push(`${p}: ${ds.join('/')} -> ${[...vals].join(' vs ')}`);
      }
    }
    expect(disagreements).toEqual([]);
  });
});

describe('the CSS and the Figma payload agree', () => {
  it('emits the same names on all three surfaces', () => {
    const names = overlayOffsetNames().sort();
    for (const p of CSS_PLATFORMS) {
      expect(`${p} css`).toBe(`${p} css`);
      expect(Object.keys(parseCSS(p)).sort()).toEqual(names);
    }
  });

  /* The one that matters. Figma is keyed by DEVICE and the stylesheet by
     PLATFORM, so this walks every device to the block it actually lands in —
     a per-platform comparison would never notice a device mapped to the wrong
     block, which is the failure the collapse introduces. */
  it('gives every device the same number Figma gives it', () => {
    const wrong: string[] = [];
    for (const device of DEVICE_MODES) {
      const platform = SEEDS_FROM[device] as CSSPlatform;
      const fromFigma = overlayOffsets(device);
      const fromCSS = parseCSS(platform);
      for (const name of overlayOffsetNames()) {
        if (fromCSS[name] !== fromFigma[name]) {
          wrong.push(`${device} ${name}: css(${platform})=${fromCSS[name]} figma=${fromFigma[name]}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('the offsets are sums, and the sum is the point', () => {
  /* Chrome legitimately goes to zero on Desktop; clearance never does. The
     formula is what guarantees that floor, so assert the floor rather than
     Desktop's literal 24 — a literal here would pass just as happily if the
     clearance were dropped from the sum and Desktop's chrome happened to be 24. */
  it('never lets a floating element touch the edge, on any device', () => {
    for (const d of DEVICE_MODES) {
      const o = overlayOffsets(d);
      expect(`${d}: ${o['SnackBar-Top'] >= FLOAT_CLEARANCE[d] && o['SnackBar-Bottom'] >= FLOAT_CLEARANCE[d]}`)
        .toBe(`${d}: true`);
    }
  });

  it('clears the app bar at the top and only the indicator at the bottom', () => {
    for (const d of DEVICE_MODES) {
      const o = overlayOffsets(d);
      expect(`${d} top`).toBe(`${d} top`);
      expect(o['SnackBar-Top']).toBe(APP_AND_STATUS[d] + FLOAT_CLEARANCE[d]);
      expect(o['SnackBar-Bottom']).toBe(BOTTOM_INDICATOR[d] + FLOAT_CLEARANCE[d]);
    }
  });

  /* Desktop has no chrome, so both ends are clearance alone — and the two
     therefore MATCH, which they do on no other device. Stated because it is
     the case a reader is most likely to mistake for a missing value. */
  it('gives Desktop a symmetric offset, from having no chrome rather than no value', () => {
    const o = overlayOffsets('Desktop');
    expect(o['SnackBar-Top']).toBe(o['SnackBar-Bottom']);
    expect(o['SnackBar-Top']).toBe(FLOAT_CLEARANCE.Desktop);
    expect(o['Overlay-Clearance']).toBe(FLOAT_CLEARANCE.Desktop);
  });
});

/* ── The offsets actually reach an output file ───────────────────────────────
 *
 * Asserted against the generator's SOURCE, which is unusual and deliberate.
 * `foundationCSS` is built inside `generateAndUploadDesignSystem`, which
 * uploads to Firebase, so there is no way to read the emitted stylesheet
 * without standing up the whole upload path.
 *
 * Every assertion above would have passed on the day this was written, when
 * `overlayOffsets` was correct, tested, and emitted to precisely one of the
 * three surfaces. Checking the call sites is the only thing here that fails if
 * someone deletes an emission — and "computed but emitted nowhere" is the bug
 * that happened, not a hypothetical. themeModes, moodKey and shadowExport read
 * source for the same class of reason.
 */
describe('the values are emitted, not merely computed', () => {
  const gen = readFileSync(resolve(__dirname, '../utils/generateDesignSystem.ts'), 'utf8');

  it('writes a CSS block for each of the four platforms', () => {
    const missing = CSS_PLATFORMS.filter((p) => !gen.includes(`overlayOffsetCSS('${p}')`));
    expect(missing).toEqual([]);
  });

  it('no longer writes a design-token entry — that surface is gone', () => {
    /* There were three surfaces; there are two. The design-token form fed
       `designSystemJSON.Platform`, and Platform was retired in favour of
       Devices-Type, which holds these three directly. Asserted as an absence
       so the dead form cannot be reinstated without the question being asked. */
    expect(gen).not.toMatch(/overlayOffsetTokens/);
  });

  /* The Figma side, for symmetry — it is the surface that already worked, and
     leaving it unasserted would make this suite quietly one-sided. */
  it('writes them into the Figma payload', () => {
    const figma = readFileSync(resolve(__dirname, '../utils/generateFigmaJSON.ts'), 'utf8');
    expect(figma).toMatch(/overlayOffsets\(/);
  });
});
