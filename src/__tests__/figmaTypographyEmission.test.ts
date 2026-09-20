/**
 * End-to-end: the two typography collections must be in the JSON the studio
 * actually downloads, not merely produced by the helper.
 *
 * This exists because of abc56a9, where a unit test on lineMetricsVars()
 * passed while the stylesheet contained none of them — the emission had been
 * added to dead code. The only thing that catches that is asserting the
 * OUTPUT.
 *
 * It matters more here than usual: generateDesignSystem wraps this call in a
 * try/catch that returns the string '{}' and logs to console.error. A throw
 * anywhere in the payload therefore ships an EMPTY figma.json — a download
 * that succeeds, a file that imports cleanly, and nothing in Figma changing.
 */
import { describe, it, expect } from 'vitest';
import { generateFigmaJSON } from '../utils/generateFigmaJSON';
import { typographyTokensCSS } from '../utils/typographyTokens';
import { DEVICE_TYPES, FACE_MODES, DEVICES_COLLECTION } from '../utils/typographyPlatform';

/* The smallest input that reaches the typography branch: it is gated on
   `if (typo)`, i.e. the Typography section of the design system JSON. */
const DS = {
  Typography: {
    'Set-Font-Family-Header': { value: 'Fraunces' },
    'Set-Font-Family-Body': { value: 'IBM Plex Sans' },
    'Set-Font-Family-Decorative': { value: 'Fraunces' },
  },
};

const out = generateFigmaJSON(DS, typographyTokensCSS);

describe('the downloaded figma.json', () => {
  it('carries the Devices-Type typography group, all seven modes', () => {
    const c = out[DEVICES_COLLECTION];
    expect(c).toBeDefined();
    expect(Object.keys(c).sort()).toEqual([...DEVICE_TYPES].sort());
  });

  it('carries the Typography collection with both face modes', () => {
    expect(Object.keys(out['Typography-Variables']).sort()).toEqual([...FACE_MODES].sort());
  });

  it('every Devices-Type name is under Typography/, so nothing else is touched', () => {
    for (const d of DEVICE_TYPES) {
      const stray = Object.keys(out[DEVICES_COLLECTION][d])
        .filter((n) => !n.startsWith('Typography/'));
      expect(`${d}: ${stray.join(',') || 'none'}`).toBe(`${d}: none`);
    }
  });

  it('every alias resolves to a name that is actually in the payload', () => {
    /* A dangling alias is not an import error. It is an unbound variable, and
       a text style bound to one renders whatever it was last set to. */
    const have = new Set(Object.keys(out[DEVICES_COLLECTION].Desktop));
    for (const face of FACE_MODES) {
      for (const [token, v] of Object.entries<{ value: string }>(out['Typography-Variables'][face])) {
        const path = String(v.value).slice(1, -1).replace(/\./g, '/');
        expect(`${face}/${token} -> ${have.has(path)}`).toBe(`${face}/${token} -> true`);
      }
    }
  });

  it('does not clobber the text-style descriptors', () => {
    /* figma.Typography is NOT the variable collection — it carries the style
       descriptors, and the new collection ships under its own key precisely
       so these survive. */
    expect(out.Typography?.styles?.length).toBeGreaterThan(0);
    expect(out.Typography.platform).toBe('Desktop');
  });

  it('is real JSON, and not the empty object the catch would produce', () => {
    const s = JSON.stringify(out);
    expect(s.length).toBeGreaterThan(1000);
    expect(s).toContain('Typography/Omni/H1-Font-Weight');
  });
});
