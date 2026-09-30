/**
 * The input's derived geometry — four things Figma cannot compute for itself.
 *
 * A browser draws an `outline` concentric with the border-radius it surrounds,
 * and auto-layout would stretch an in-field button to whatever height it is
 * given. Figma can do neither, so the values have to be stated — the same
 * reason Accordion-Focus-Radius exists, which says so outright.
 *
 * These vary by DEVICE as well as by size, unlike most component metrics. The
 * input's height IS the button's height (Input.js binds
 * var(--Small-Button-Height) and its siblings directly) and those differ per
 * platform; the radius is a percent of that height, so everything derived from
 * it inherits the platform split. Desktop 32/40/48, iOS 32/44/50 and Android
 * 32/48/56 give three ladders from one brand percentage.
 */
import { describe, it, expect } from 'vitest';
import {
  inputMetrics, inputMetricNames, floatingLabelLeading, FLOATING_LABEL_SIZES,
  INPUT_BUTTON_RING, INPUT_BORDER, INPUT_FOCUS_OFFSET,
} from '../utils/inputMetrics';
import { systemLineHeight } from '../utils/systemTypography';
import { pctRadius } from '../utils/componentRadii';

const DESKTOP = { small: 32, medium: 40, large: 48 };
const IOS = { small: 32, medium: 44, large: 50 };
const ANDROID = { small: 32, medium: 48, large: 56 };

const leadingFor = (fam: 'apple' | 'material' | 'desktop') => ({
  small: floatingLabelLeading(fam, FLOATING_LABEL_SIZES.small, systemLineHeight),
  medium: floatingLabelLeading(fam, FLOATING_LABEL_SIZES.medium, systemLineHeight),
  large: floatingLabelLeading(fam, FLOATING_LABEL_SIZES.large, systemLineHeight),
});

const build = (heights: typeof DESKTOP, fam: 'apple' | 'material' | 'desktop') =>
  inputMetrics({ heights, inputRadiusPct: 27, labelLeading: leadingFor(fam) });

describe('the in-field button', () => {
  it('sits concentric inside the field, border and ring accounted for', () => {
    /* The button is `border + ring` inside the field, so its corner is that
       much tighter. Asserted as the RELATIONSHIP against the field's own
       radius, not against a table — the numbers belong to the brand's percent
       and the platform's height, and only the two insets are this module's. */
    const m = build(DESKTOP, 'desktop');
    for (const [size, S] of [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] as const) {
      const field = DESKTOP[size];
      const inputR = pctRadius(27, field);
      expect(`${S}: ${m[`Input-Button-Radius-${S}`]}`)
        .toBe(`${S}: ${Math.max(0, inputR - INPUT_BORDER - INPUT_BUTTON_RING)}`);
    }
  });

  it('puts the focus ring one offset out from the button corner', () => {
    const m = build(DESKTOP, 'desktop');
    for (const S of ['Small', 'Medium', 'Large']) {
      expect(m[`Input-Button-Focus-Radius-${S}`])
        .toBe(m[`Input-Button-Radius-${S}`] + INPUT_FOCUS_OFFSET);
    }
  });

  it('floors at 0 rather than going negative on a square-ish field', () => {
    /* A field flatter than its own inset cannot give the button a negative
       corner. Square buttons are the right degenerate case; a negative radius
       is not a radius. */
    const m = inputMetrics({ heights: DESKTOP, inputRadiusPct: 2, labelLeading: leadingFor('desktop') });
    expect(m['Input-Button-Radius-Small']).toBe(0);
    expect(m['Input-Button-Focus-Radius-Small']).toBe(INPUT_FOCUS_OFFSET);
  });
});

describe('the floating field', () => {
  it('is the standard field plus exactly one label line', () => {
    /* Padding, borders and the input text's own leading are already inside the
       standard height, so the label line is the whole difference. */
    for (const [heights, fam] of [[DESKTOP, 'desktop'], [IOS, 'apple'], [ANDROID, 'material']] as const) {
      const m = build(heights, fam);
      const lead = leadingFor(fam);
      for (const [size, S] of [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] as const) {
        expect(`${fam} ${S}: ${m[`Floating-Input-${S}`]}`)
          .toBe(`${fam} ${S}: ${heights[size] + lead[size]}`);
      }
    }
  });

  it('takes its own radius, not the standard field s', () => {
    /* The lib currently binds --Input-Radius on both variants, so a 56px
       floating field wears a radius computed for a 40px one — 20% of its
       height instead of 27%, visibly flatter. */
    const m = build(DESKTOP, 'desktop');
    expect(m['Floating-Input-Radius-Medium']).toBe(pctRadius(27, m['Floating-Input-Medium']));
    expect(m['Floating-Input-Radius-Medium']).not.toBe(pctRadius(27, DESKTOP.medium));
  });

  it('is 48 at small on every platform', () => {
    /* All three share a 32px small field and a 12px label, whose leading is 16
       on Desktop and on both platform tables. The one size that agrees. */
    for (const [heights, fam] of [[DESKTOP, 'desktop'], [IOS, 'apple'], [ANDROID, 'material']] as const) {
      expect(`${fam}: ${build(heights, fam)['Floating-Input-Small']}`).toBe(`${fam}: 48`);
    }
  });
});

describe('the shrunk label sizes', () => {
  it('avoids the sizes where both platform tables are coarsest', () => {
    /* 11 and 12 are the trap: Material anchors BOTH at a 16px line, so the two
       steps collapse vertically on Android, while Apple jumps 13 -> 16 across
       the same 1px. 12 / 14 / 16 is monotonic on both. */
    for (const fam of ['apple', 'material'] as const) {
      const l = leadingFor(fam);
      expect(`${fam}: ${l.small} < ${l.medium} <= ${l.large}`)
        .toBe(`${fam}: ${l.small} < ${l.medium} <= ${l.large}`);
      expect(l.medium).toBeGreaterThan(l.small);
      expect(l.large).toBeGreaterThanOrEqual(l.medium);
    }
  });
});

describe('the payload shape', () => {
  it('carries the same fifteen names for every device', () => {
    /* A name present on one device and absent on another resolves to nothing
       there, silently — the failure the typography payload already guards. */
    const names = inputMetricNames();
    expect(names.length).toBe(15);
    for (const [heights, fam] of [[DESKTOP, 'desktop'], [IOS, 'apple'], [ANDROID, 'material']] as const) {
      expect(Object.keys(build(heights, fam)).sort()).toEqual(names);
    }
  });

  it('derives every platform column rather than hand-authoring it', () => {
    /* Unlike Button-Height, whose platform columns are Apple's and Google's
       specs, these are the brand's percent applied to a known height — so all
       seven devices are computed and none is typed. The check is that the
       platforms actually DIFFER, which is what proves they were computed. */
    const d = build(DESKTOP, 'desktop');
    const a = build(ANDROID, 'material');
    expect(d['Input-Button-Radius-Medium']).not.toBe(a['Input-Button-Radius-Medium']);
    expect(d['Floating-Input-Large']).not.toBe(a['Floating-Input-Large']);
  });
});
