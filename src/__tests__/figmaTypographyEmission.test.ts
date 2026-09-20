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
  /* Needed or the whole Component-Size branch is skipped — which is how the
     Desktop button write went unverified the first time this was written. */
  _componentStyle: {
    buttonRadius: 32, iconButtonRadius: 32, inputRadius: 4, cardPadding: 16,
    bevelOpacity: 50, shadowResolution: 3,
    buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56,
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

  /* The six Devices-Type variables Component-Size/Button aliases into. The
     studio owns the DESKTOP column only — the platform columns are
     hand-authored from Apple's and Google's specs. */
  const DESKTOP_BUTTONS = [
    'Small Button', 'Medium Button', 'Large Button',
    'Small Button Icon', 'Medium Button Icon', 'Large Button Icon',
  ];

  it('touches nothing outside Typography/ and the Desktop button column', () => {
    for (const d of DEVICE_TYPES) {
      const stray = Object.keys(out[DEVICES_COLLECTION][d])
        .filter((n) => !n.startsWith('Typography/') && !DESKTOP_BUTTONS.includes(n));
      expect(`${d}: ${stray.join(',') || 'none'}`).toBe(`${d}: none`);
    }
  });

  it('writes the Desktop button heights from the user spec', () => {
    const d = out[DEVICES_COLLECTION].Desktop;
    expect([d['Small Button']?.value, d['Medium Button']?.value, d['Large Button']?.value])
      .toEqual([24, 32, 56]);
  });

  it('writes ONLY the Desktop column of those', () => {
    /* Writing all seven would overwrite iOS's 44/32/50 and Android's 48/32/56
       with the brand's numbers on every import — the platform heights would
       silently collapse to Desktop's. */
    for (const d of DEVICE_TYPES) {
      if (d === 'Desktop') continue;
      for (const n of DESKTOP_BUTTONS) {
        expect(`${d}/${n}: ${out[DEVICES_COLLECTION][d][n] === undefined}`)
          .toBe(`${d}/${n}: true`);
      }
    }
  });

  it('no longer writes the aliased names into Component-Size', () => {
    /* Component-Size/Button/Button-Height and -Icon are ALIASES into
       Devices-Type now. populateComponentSize writes by name and cannot tell
       an alias from a number: left in the payload it replaces both with
       literals and the links are gone — no error, and the platform heights
       collapse back to Desktop's. */
    for (const mode of ['medium', 'small', 'large'] as const) {
      for (const n of ['Button/Button-Height', 'Button/Button-Icon']) {
        expect(`${mode}/${n}: ${out['Component-Size'][mode][n]}`)
          .toBe(`${mode}/${n}: undefined`);
      }
    }
  });

  it('still writes the Button metrics that are NOT aliased', () => {
    /* The exclusion has to be exactly two names, not the whole group. */
    expect(out['Component-Size'].medium['Button/Button-Radius']).toBeDefined();
    expect(out['Component-Size'].medium['Button/Button-Icon-Only']).toBeDefined();
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
