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
import { typographyTokensCSS, buildTypographyTokensCSS } from '../utils/typographyTokens';
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
     studio owns the Desktop column (the user's heights, icons derived from
     them); the other six modes come from platformMetrics.ts, which states
     Apple's and Google's published sizes. Name kept for the diff. */
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

  it('writes every column, the platforms from their own table', () => {
    /* This used to write Desktop alone and leave the platform columns to
       whatever the Figma file held. The danger it guarded against was real —
       writing the BRAND's numbers into all seven would collapse iOS and
       Android to Desktop's heights — but the fix was to state the platform
       numbers, not to skip them: one table now feeds the CSS and the payload,
       so the web and Figma cannot disagree about how tall a button is.

       Per-platform, not per-device: all three iOS modes carry one column and
       all three Android modes another, transcribed from the Figma file. */
    const expected: Record<string, number[]> = {
      // [Small, Medium, Large, Small Icon, Medium Icon, Large Icon]
      'Desktop': [24, 32, 56, 16, 20, 32],
      'IOS-Mobile': [32, 44, 50, 16, 20, 24],
      'IOS-Tablet-Vertical': [32, 44, 50, 16, 20, 24],
      'IOS-Tablet-Horizontal': [32, 44, 50, 16, 20, 24],
      'Android-Mobile': [32, 48, 56, 18, 18, 24],
      'Android-Tablet-Vertical': [32, 48, 56, 18, 18, 24],
      'Android-Tablet-Horizontal': [32, 48, 56, 18, 18, 24],
    };
    for (const d of DEVICE_TYPES) {
      const bag = out[DEVICES_COLLECTION][d];
      expect(`${d}: ${DESKTOP_BUTTONS.map((n) => bag[n]?.value).join(',')}`)
        .toBe(`${d}: ${expected[d].join(',')}`);
    }
  });

  it('does not give a touch platform the brand\'s desktop heights', () => {
    /* The specific collapse the old policy feared. Desktop's medium is the
       user's slider pick; if a platform column ever equals the whole desktop
       row, the platform table has stopped being read. */
    const desktop = DESKTOP_BUTTONS.map((n) => out[DEVICES_COLLECTION].Desktop[n]?.value).join(',');
    for (const d of DEVICE_TYPES) {
      if (d === 'Desktop') continue;
      expect(`${d}: ${DESKTOP_BUTTONS.map((n) => out[DEVICES_COLLECTION][d][n]?.value).join(',')}`)
        .not.toBe(`${d}: ${desktop}`);
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

  it('gives Display a real three-step ramp on every device', () => {
    /* Built from the GENERATED stylesheet, not the static import the rest of
       this file uses. generateDesignSystem passes buildTypographyTokensCSS()
       (see its line 1428), and the difference is the whole point here: the
       Desktop block is spliced per design, the device blocks pass through. A
       test reading the static asset would assert a Desktop ramp the download
       never contains — the failure this suite exists to catch.

       Display-Medium is the case that motivated it. No device block declared
       it, and absent did not read as absent: the device-floor merge filled it
       from Desktop, so Medium reported Desktop's size on every phone and
       tablet and did not move when the device did. Asserting the three steps
       DIFFER per device is what catches a step silently inheriting again. */
    const live = generateFigmaJSON(DS, buildTypographyTokensCSS([
      { type: 'decorative', family: 'Playfair Display', weight: '800', displaySize: '72' },
      { type: 'header', family: 'Poppins', weight: '600' },
      { type: 'body', family: 'Inter', weight: '400' },
    ] as never));
    const ramp = (device: string) =>
      (['Small', 'Medium', 'Large'] as const).map((step) =>
        live[DEVICES_COLLECTION][device][`Typography/Displays/Display-${step}-Font-Size`]?.value);

    expect(ramp('Desktop')).toEqual([48, 60, 72]);
    expect(ramp('IOS-Mobile')).toEqual([34, 40, 48]);
    expect(ramp('Android-Mobile')).toEqual([36, 45, 57]);

    for (const device of DEVICE_TYPES) {
      const steps = ramp(device);
      /* Every step present, and strictly increasing. Equal steps is the bug
         that shipped for months: Small and Large both sat at 28px, which is
         also H1's size, so the display styles were indistinguishable from a
         heading and from each other. */
      expect(`${device}: ${steps.join(',')}`)
        .toBe(`${device}: ${[...steps].sort((a, b) => Number(a) - Number(b)).join(',')}`);
      expect(new Set(steps).size).toBe(3);
    }
  });

  it('gives every Display step a line height that matches the platform table', () => {
    /* The payload recomputes non-Body line heights through systemLineHeight().
       The CSS declares its own. Two implementations, so assert they land on
       the same number rather than trusting that they do (invariant 5). */
    const live = generateFigmaJSON(DS, buildTypographyTokensCSS([
      { type: 'decorative', family: 'Playfair Display', weight: '800', displaySize: '72' },
      { type: 'header', family: 'Poppins', weight: '600' },
      { type: 'body', family: 'Inter', weight: '400' },
    ] as never));
    const lh = (device: string, step: string) =>
      live[DEVICES_COLLECTION][device][`Typography/Displays/Display-${step}-Line-Height`]?.value;

    expect(['Small', 'Medium', 'Large'].map((s) => lh('IOS-Mobile', s))).toEqual([41, 48, 58]);
    expect(['Small', 'Medium', 'Large'].map((s) => lh('Android-Mobile', s))).toEqual([44, 52, 64]);
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
    expect(s).toContain('Typography/Omni/Headers/H1-Font-Weight');
  });
});
