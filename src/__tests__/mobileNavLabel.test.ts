/**
 * Mobile-Nav-Label — the label under a bottom-nav or rail icon.
 *
 * It holds the same numbers Label-ExtraSmall does, and these tests exist to
 * pin WHY that is not a duplicate waiting to be collapsed.
 *
 * Invariant 2 says a duplicated value is only redundant when nothing selects
 * between the copies. Here two different consumers do: the lib reads
 * --Label-ExtraSmall-* as the Label group's off-ramp step
 * (Typography.js:361), and nav components read --Mobile-Nav-Label-*. The
 * split exists so the two can DIVERGE — Label is a ramp a brand can move,
 * while the label under a nav icon is sized by the target it sits in.
 *
 * So the test below deliberately does NOT assert that the two match. Asserting
 * equality would freeze exactly the independence the split was made to buy,
 * and the first time someone moved the Label ramp the failure would point at
 * this file instead of at the decision.
 */
import { describe, it, expect } from 'vitest';
import { buildTypeScale, GROUP_ORDER } from '../utils/typeScale';
import { FAMILY_ROOT_OF, FAMILY_FOLDER } from '../utils/typographyPlatform';

const scale = buildTypeScale(null);
const byToken = (t: string) => scale.find((s) => s.token === t);

describe('Mobile-Nav-Label', () => {
  it('exists as a single-size style', () => {
    const s = byToken('Mobile-Nav-Label');
    expect(s).toBeDefined();
    expect(s!.step).toBe('Standard');
  });

  it('carries the values the nav labels were reaching for', () => {
    /* Asserted on the BUILT style, not the raw definition: buildTypeScale
       converts `lh` to a px number and `cs` to an em string, so a test written
       against the definition's field names passes vacuously on undefined. */
    const s = byToken('Mobile-Nav-Label')!;
    expect(s.size).toBe(11);
    expect(s.weight).toBe(600);
    expect(s.lineHeight).toBe(16.5);
    expect(s.textTransform).toBe('none');
    /* Tracking has to survive the px -> em conversion. 0.5px of tracking on an
       11px style is small enough that a conversion dropping it would read as
       "no tracking was asked for" rather than as a bug, so it is pinned as
       non-zero rather than left to the size/weight assertions above. */
    expect(s.letterSpacing).toMatch(/em$/);
    expect(s.letterSpacing).not.toBe('0em');
  });

  it('is `Standard`, which in this file means the group has ONE size', () => {
    /* Legal and Badge use the same word for the same reason. Naming this
       Medium would advertise a Small and a Large that do not exist, which is
       the shape Caption was in before it became a real ramp. */
    const siblings = scale.filter((s) => s.group === 'Mobile-Nav-Label');
    expect(siblings.map((s) => s.step)).toEqual(['Standard']);
  });

  it('is registered everywhere a group has to be registered', () => {
    /* A group added to the scale alone emits CSS and then goes missing from
       the Figma payload, because the family tables are keyed by group and are
       held against the stylesheet's sections by hasARootForEverySection.
       Badge is the cautionary case: it is absent from both tables to this day
       and nothing but a backlog note records it. */
    expect(GROUP_ORDER).toContain('Mobile-Nav-Label');
    expect(FAMILY_ROOT_OF['Mobile-Nav-Label']).toBe('Body');
    expect(FAMILY_FOLDER['Mobile-Nav-Label']).toBe('Mobile-Nav-Label');
  });

  it('sits on the Body face, like every non-Display non-Header group', () => {
    expect(FAMILY_ROOT_OF['Mobile-Nav-Label']).toBe(FAMILY_ROOT_OF.Label);
  });

  it('does not disturb the Label ramp it was split out of', () => {
    /* Label stays three steps x two cases plus the ExtraSmall off-ramp. If
       this style had been added AS a Label step instead of its own group, the
       group would read as four sizes again — the exact distortion
       typeScaleRamps.test.ts was written to prevent. */
    const labelSteps = scale
      .filter((s) => s.group === 'Label' && !/All Caps/.test(String(s.step)))
      .map((s) => s.step);
    expect(labelSteps).toEqual(['Extra Small', 'Small', 'Medium', 'Large']);
  });
});
