import { describe, it, expect } from 'vitest';
import {
  NAV_METRICS, navMetricsFlat, navMetricsCSS,
  componentSizeGroup, componentSizeNames,
} from '../utils/componentSize';

/* The rail's width and the app bar's height are the first metrics here that
   are NOT derived from the user's choices — a rail is 80 wide in every brand.
   That makes them the easiest kind of number to end up with three copies of,
   one per target, each self-consistent and none agreeing (invariant 5). These
   assert that there is one table and every target reads it. */

describe('one table, three targets', () => {
  it('the Figma payload carries every size of every metric', () => {
    const payload = componentSizeGroup('Other', navMetricsFlat());
    /* One variable per metric, three MODE values — not three variables. That
       is the whole point of Component-Size: a component has one variant and
       switching the mode switches the size. */
    expect(componentSizeNames(payload)).toEqual([
      'Other/App-Bar Height', 'Other/Rail-Width',
    ]);
    expect(payload.medium['Other/Rail-Width']).toBe(80);
    expect(payload.small['Other/Rail-Width']).toBe(72);
    expect(payload.large['Other/Rail-Width']).toBe(96);
  });

  it('keeps the file’s own name, space and all', () => {
    /* Component-Size holds `App-Bar Height`. A tidier `App-Bar-Height` would
       match no variable in the file, leave the value at whatever was last
       typed by hand, and report success the whole time. */
    expect(Object.keys(NAV_METRICS)).toContain('App-Bar Height');
    const payload = componentSizeGroup('Other', navMetricsFlat());
    expect(payload.medium['Other/App-Bar Height']).toBe(64);
  });

  it('emits the CSS triple a SIZE_MAP picks between', () => {
    const css = navMetricsCSS('').join('\n');
    expect(css).toContain('--Rail-Width: 80px;');
    expect(css).toContain('--Sm-Rail-Width: 72px;');
    expect(css).toContain('--Lg-Rail-Width: 96px;');
  });

  it('hyphenates the space for CSS, because a property cannot hold one', () => {
    const css = navMetricsCSS('').join('\n');
    expect(css).toContain('--App-Bar-Height: 64px;');
    expect(css).not.toContain('--App-Bar Height');
  });

  it('the CSS and the Figma payload carry the same numbers', () => {
    /* The assertion that actually matters. Both sides can be present and
       still disagree — that is what "parity is not correctness" means, and
       the only defence is deriving both from one table. */
    const payload = componentSizeGroup('Other', navMetricsFlat());
    const css = navMetricsCSS('').join('\n');
    for (const [name, byMode] of Object.entries(NAV_METRICS)) {
      const prop = name.replace(/ /g, '-');
      expect(payload.medium[`Other/${name}`], name).toBe(byMode.medium);
      expect(payload.small[`Other/${name}`], name).toBe(byMode.small);
      expect(payload.large[`Other/${name}`], name).toBe(byMode.large);
      expect(css).toContain(`--${prop}: ${byMode.medium}px;`);
      expect(css).toContain(`--Sm-${prop}: ${byMode.small}px;`);
      expect(css).toContain(`--Lg-${prop}: ${byMode.large}px;`);
    }
  });
});

describe('the sizes are a real ladder', () => {
  it('small is narrower and large is wider', () => {
    /* A density ladder that is not monotonic is a typo, and a typo here reads
       as a design decision: nothing renders wrong, the large rail is just
       inexplicably the narrow one. */
    for (const [name, byMode] of Object.entries(NAV_METRICS)) {
      expect(byMode.small, name).toBeLessThan(byMode.medium);
      expect(byMode.large, name).toBeGreaterThan(byMode.medium);
    }
  });
});
