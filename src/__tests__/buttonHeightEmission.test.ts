/* --Button-Height has to reach the STYLESHEET, not just the preview.
 *
 * It was the one input that never came back out. componentStyleVars emitted it
 * and the CSS export did not, while the library reads `var(--Button-Height)`
 * 94 times WITH NO FALLBACK. A var() that is undefined and unfallbacked makes
 * the whole declaration invalid, so those 94 rules were dropped outright in a
 * consumer's app — and it looked correct in the studio, because the preview is
 * a separate implementation. Invariant 5 in its most expensive form.
 *
 * Also pins the two back-compat spellings. The library reads BOTH
 * --Small-/--Large-Button-Height (ToggleButtonGroup, Autocomplete, Input) and
 * --Sm-/--Lg- (Tabs); Figma uses the Sm-/Lg- form, so that is canonical and
 * the others alias onto it rather than carrying a second copy of the number.
 */
import { describe, it, expect } from 'vitest';
import { buttonModeMetricCSS, buttonHeightAliasCSS } from '../utils/buttonSizing';

const decls = (h: { buttonHeight: number; smallButtonHeight: number; largeButtonHeight: number }) =>
  [...buttonModeMetricCSS(h, ''), ...buttonHeightAliasCSS('')].map((l) => l.trim());

const find = (out: string[], name: string) => out.find((l) => l.startsWith(name + ':'));

describe('the button height is emitted, not just consumed', () => {
  it('carries all three modes under the names Figma uses', () => {
    const out = decls({ smallButtonHeight: 24, buttonHeight: 32, largeButtonHeight: 56 });
    expect(find(out, '--Sm-Button-Height')).toBe('--Sm-Button-Height: 24px;');
    expect(find(out, '--Button-Height')).toBe('--Button-Height: 32px;');
    expect(find(out, '--Lg-Button-Height')).toBe('--Lg-Button-Height: 56px;');
  });

  it('tracks a height the user picks', () => {
    const out = decls({ smallButtonHeight: 28, buttonHeight: 40, largeButtonHeight: 64 });
    expect(find(out, '--Button-Height')).toBe('--Button-Height: 40px;');
    expect(find(out, '--Sm-Button-Height')).toBe('--Sm-Button-Height: 28px;');
  });

  it('aliases the older spellings rather than restating the number', () => {
    /* A second copy of the value is a second thing to keep in step. These
       point at the canonical token so they cannot disagree with it. */
    const out = decls({ smallButtonHeight: 24, buttonHeight: 32, largeButtonHeight: 56 });
    expect(find(out, '--Small-Button-Height')).toBe('--Small-Button-Height: var(--Sm-Button-Height);');
    expect(find(out, '--Large-Button-Height')).toBe('--Large-Button-Height: var(--Lg-Button-Height);');
  });

  it('and the derived metrics still move with it', () => {
    /* The height is the input the whole ramp hangs off: the icon ratios snap
       against it and the type slope is 3h/16 + offset. If the height is
       emitted but the derivations stop tracking, the stylesheet is internally
       inconsistent in a way nothing else would catch. */
    const small = decls({ smallButtonHeight: 24, buttonHeight: 32, largeButtonHeight: 56 });
    const large = decls({ smallButtonHeight: 32, buttonHeight: 40, largeButtonHeight: 64 });
    expect(find(small, '--Button-Icon')).not.toBe(find(large, '--Button-Icon'));
    expect(find(small, '--Button-Numbers')).not.toBe(find(large, '--Button-Numbers'));
  });
});
