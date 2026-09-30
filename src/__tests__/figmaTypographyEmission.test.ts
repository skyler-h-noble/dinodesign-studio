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

import { SEEDS_FROM } from '../utils/typographyPlatform';
import { inputMetricNames } from '../utils/inputMetrics';
import { bevelSize, PLATFORM_SPACER } from '../utils/bevelGeometry';
import { overlayOffsetNames, overlayOffsets, type DeviceMode } from '../utils/deviceChrome';
import { readFileSync } from 'node:fs';

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

  it('touches nothing outside Typography/, the button columns and the bevel', () => {
    /* The bevel joined this collection when the Platform collection was
       retired: seven device modes are now where anything varying by hardware
       lives, and the bevel varies by hardware because it is a fraction of a
       button height that does.

       TWO names per size now, not eight. The eight-name form's own comment
       said "only TWO distinct numbers: four slots take +B and four take -B",
       and the file now stores exactly those two — Component-Size's sixteen
       Highlight/Lowlight variables alias into them, choosing the sign by which
       slot they are. 24 variables per device became 6, plus 6 for the FAB.

       The FAB pairs are the same on every device: FAB sizing is not per
       platform, and Devices-Type carries no FAB width or height. They are
       still written to all seven columns, because an alias has to resolve in
       every mode. */
    const BEVEL = /^(?:(?:Sm-|Lg-)?Button|FAB(?:-Sm|-Lg)?)-Bevel(?:-Negative)?$/;
    /* The input's derived geometry joined for the same reason the bevel did:
       it varies by hardware, because the input's height IS the button's and
       those differ per platform. Five names per size — the in-field button's
       two radii, and the floating field's height and two radii.

       Unlike the button columns above, EVERY device is written rather than
       Desktop alone: these are the brand's own percent applied to a height the
       platform supplies, so no column has to be hand-authored. */
    const INPUT = new Set(inputMetricNames());
    /* Overlay offsets join the list for the same reason the input metrics did:
       `system chrome + float clearance` is an addition Figma cannot perform, so
       the sum is computed per device and shipped as one number. Every device is
       written, not Desktop alone — the chrome is the platform's and differs on
       all seven. */
    const OVERLAY = new Set(overlayOffsetNames());
    /* Platform Spacer — the gap a small button's enlarged tap target needs
       around it. Written for Figma's benefit, not the library's: Button.js
       reads --Target and names the spacer only in a comment. A Figma frame
       packing small buttons together has to be told the gap explicitly. */
    const SPACER = 'Platform Spacer';
    for (const d of DEVICE_TYPES) {
      const stray = Object.keys(out[DEVICES_COLLECTION][d])
        .filter((n) => !n.startsWith('Typography/')
          && !DESKTOP_BUTTONS.includes(n)
          && !BEVEL.test(n)
          && !INPUT.has(n)
          && !OVERLAY.has(n)
          && n !== SPACER);
      expect(`${d}: ${stray.join(',') || 'none'}`).toBe(`${d}: none`);
    }
  });

  it('writes the overlay offsets on every device, never at zero', () => {
    /* The floor is the whole point. Chrome legitimately goes to 0 on Desktop,
       which has none; an offset of 0 would put a floating element flush to the
       window edge with its shadow clipped. Because the value is COMPUTED as
       chrome + clearance rather than hand-maintained, the clearance guarantees
       the floor and no device can be left at zero by an edit. */
    for (const d of DEVICE_TYPES) {
      const bag = out[DEVICES_COLLECTION][d];
      for (const name of overlayOffsetNames()) {
        expect(`${d}/${name}: ${typeof bag[name]?.value}`).toBe(`${d}/${name}: number`);
        expect(`${d}/${name} > 0: ${bag[name].value > 0}`).toBe(`${d}/${name} > 0: true`);
      }
      /* Top clears the app bar as well as the status bar, so on any device with
         one it must sit below the bottom offset, which clears only the home
         indicator. Desktop has neither and they are equal. */
      const o = overlayOffsets(d as DeviceMode);
      if (d !== 'Desktop') {
        expect(`${d}: top > bottom`).toBe(`${d}: ${o['SnackBar-Top'] > o['SnackBar-Bottom']}`
          .replace('true', 'top > bottom').replace('false', 'NOT top > bottom'));
      }
    }
  });

  it('gives every device both bevel numbers per size, sized to its own platform', () => {
    /* Was 24 values per device — eight slots per size, of which its own comment
       admitted "only TWO distinct numbers: four take +B and four take -B".
       Figma now stores the two, and Component-Size's sixteen Highlight/Lowlight
       variables alias in, picking the sign by which slot they are.

       The bug the per-size part guards is older and still worth pinning: only
       the MEDIUM set used to be re-emitted per platform, so a small or large
       button wore Desktop's bevel everywhere — an iOS large (50px) carrying a
       Desktop large's (56px) geometry. */
    for (const d of DEVICE_TYPES) {
      const bag = out[DEVICES_COLLECTION][d];
      for (const prefix of ['Button-', 'Sm-Button-', 'Lg-Button-', 'FAB-', 'FAB-Sm-', 'FAB-Lg-']) {
        const pos = bag[`${prefix}Bevel`]?.value;
        const neg = bag[`${prefix}Bevel-Negative`]?.value;
        expect(`${d}/${prefix}: ${typeof pos}/${typeof neg}`).toBe(`${d}/${prefix}: number/number`);
        expect(`${d}/${prefix}`).toBe(neg === -pos ? `${d}/${prefix}` : `MISMATCH ${neg} vs ${-pos}`);
      }
    }
  });

  it('follows the DEVICE\'s button height, not the brand\'s', () => {
    /* The assertion above passes on a table of zeroes, which is what a brand
       with no bevel produces. This one checks the derivation itself: Desktop's
       large is the user's 56, iOS's is 50, Android's 56 — so at any non-zero
       bevel percentage the three cannot all be equal. */
    const pct = 20;
    const b = (h: number) => bevelSize(h, pct);
    expect(b(56)).toBeGreaterThan(0);
    expect(b(50)).not.toBe(b(56));
    /* And the FAB's, which is NOT per platform — Devices-Type carries no FAB
       width or height, so every device column holds the same number. Written to
       all seven anyway, because an alias has to resolve in every mode. */
    const fab = DEVICE_TYPES.map((d) => out[DEVICES_COLLECTION][d]['FAB-Bevel']?.value);
    expect(new Set(fab).size, `FAB bevel differs across devices: ${fab.join(',')}`).toBe(1);
  });

  it('writes Platform Spacer on every device, from the studio\'s table', () => {
    /* It has been hand-authored in Devices-Type until now, because the retired
       Platform collection wrote `Platform-Spacer` — a hyphen — into a different
       collection, so the two never met. The file drifted to 8 on Desktop where
       the studio says 4.

       Desktop's 4 is deliberate: its target already equals the button height,
       so the gap is breathing room rather than space a larger target demands.
       Asserted against PLATFORM_SPACER rather than a literal, so the two move
       together. */
    for (const d of DEVICE_TYPES) {
      const got = out[DEVICES_COLLECTION][d]['Platform Spacer']?.value;
      const want = PLATFORM_SPACER[SEEDS_FROM[d] as keyof typeof PLATFORM_SPACER];
      expect(`${d}: ${got}`).toBe(`${d}: ${want}`);
    }
    expect(out[DEVICES_COLLECTION].Desktop['Platform Spacer'].value).toBe(4);
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

/* Display is the face's name; Decorative is only the picker's.
 *
 * The studio stores the user's pick under the `decorative` role — an INPUT key
 * — while the face it feeds is called Display. Both names were written to
 * Figma so an older template kept resolving, which left two bindable variables
 * where only one is canonical and nothing keeping them in step.
 *
 * Dropped on 2026-09-25, following the rule Overline already set and states
 * outright: the lib's CSS keeps emitting the old name forever because a
 * published stylesheet is frozen and cannot be regenerated — a Figma file is
 * not. So CSS keeps --Set-Font-Family-Decorative and Figma does not.
 */
describe('the Fonts payload names the FACE, not the picker', () => {
  it('writes Display and not Decorative', () => {
    expect(out.Fonts.Display).toBeTruthy();
    expect('Decorative' in out.Fonts).toBe(false);
  });

  it('keeps the Display case flag, which is load-bearing', () => {
    /* Not a duplicate: without a Display flag, Display styles inherited the
       HEADER's case. Only the old SPELLING went. */
    expect('Display-Caps' in out.Fonts).toBe(true);
    expect('Decorative-Caps' in out.Fonts).toBe(false);
    expect('Header-Caps' in out.Fonts).toBe(true);
  });

  it('still READS the decorative key, because that is where the pick lives', () => {
    /* The input key and the published name are deliberately different. If this
       ever reads Set-Font-Family-Display alone, a design saved before the
       rename resolves to an empty family — silently, since Figma stores the
       text verbatim and an empty string is a valid value. */
    const src = readFileSync(
      new URL('../utils/generateFigmaJSON.ts', import.meta.url), 'utf-8');
    expect(src).toContain("typo['Set-Font-Family-Decorative']?.value");
  });
});
