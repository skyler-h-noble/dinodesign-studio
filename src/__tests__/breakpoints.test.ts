import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BREAKPOINTS, sortBreakpoints, displayBreakpoints, primaryBreakpoint,
  validateBreakpoints, breakpointAt,
  breakpointRange, completeMatrix, conditionsAt, type Breakpoint,
} from '../utils/addOns/breakpoints';

const BPS: Breakpoint[] = DEFAULT_BREAKPOINTS;

describe('a gap below the smallest breakpoint is an error', () => {
  it('is caught, because nothing reports it at runtime', () => {
    /* A width no breakpoint covers has no condition values at all. In CSS
       every part falls back to the base rule; in Figma there is simply no mode
       for it. Neither fails loudly, so it is blocked here. */
    const problems = validateBreakpoints([
      { id: 'a', label: 'Tablet', minWidth: 768 },
      { id: 'b', label: 'Desktop', minWidth: 1280 },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('below 768px');
  });

  it('the defaults start at 0', () => {
    expect(validateBreakpoints(BPS)).toEqual([]);
  });

  it('two breakpoints at the same width means one can never apply', () => {
    const problems = validateBreakpoints([
      { id: 'a', label: 'Mobile', minWidth: 0 },
      { id: 'b', label: 'Small', minWidth: 768 },
      { id: 'c', label: 'Tablet', minWidth: 768 },
    ]);
    expect(problems.some((p) => p.message.includes('can never apply'))).toBe(true);
  });
});

describe('which breakpoint governs a width', () => {
  it('takes the last one at or below it', () => {
    expect(breakpointAt(BPS, 375)?.id).toBe('xs');
    expect(breakpointAt(BPS, 600)?.id).toBe('sm');    // inclusive lower bound
    expect(breakpointAt(BPS, 899)?.id).toBe('sm');
    expect(breakpointAt(BPS, 1280)?.id).toBe('lg');
    expect(breakpointAt(BPS, 2560)?.id).toBe('xl');
  });

  it('works on an unsorted list', () => {
    // Order is meaning, not presentation — so the lookup sorts rather than
    // trusting the caller.
    const shuffled = [BPS[3], BPS[0], BPS[2], BPS[4], BPS[1]];
    expect(breakpointAt(shuffled, 950)?.id).toBe('md');
    expect(sortBreakpoints(shuffled).map((b) => b.id)).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
  });

  it('display order is widest first, and does NOT disturb lookup', () => {
    /* Design runs desktop-down, so the widest is shown first. Reversing the
       shared sort to achieve that would break breakpointAt and
       breakpointRange, which both depend on ascending order and would return
       plausible wrong answers rather than failing. */
    expect(displayBreakpoints(BPS).map((b) => b.id)).toEqual(['xl', 'lg', 'md', 'sm', 'xs']);
    expect(primaryBreakpoint(BPS)?.id).toBe('xl');
    expect(breakpointAt(BPS, 1280)?.id).toBe('lg');
  });

  it('reports the range each one covers', () => {
    expect(breakpointRange(BPS, 'xs')).toEqual({ from: 0, to: 599 });
    expect(breakpointRange(BPS, 'lg')).toEqual({ from: 1280, to: 1919 });
    // The widest has no ceiling, which is different from a ceiling of Infinity
    // — it is what makes "and up" displayable.
    expect(breakpointRange(BPS, 'xl')).toEqual({ from: 1920, to: null });
  });

  it('a content ceiling is separate from the range it applies in', () => {
    /* The range says which widths a breakpoint governs; maxWidth says where
       content stops growing inside it. Above the desktop cluster the second is
       the real constraint — a nav that stretches to 2560 puts its brand and
       actions absurdly far apart — and describing it as leftover margin
       reports the symptom instead of the rule. */
    const xl = BPS.find((b) => b.id === 'xl')!;
    expect(xl.maxWidth).toBe(1440);
    expect(xl.align).toBe('center');
    expect(BPS.find((b) => b.id === 'xs')!.maxWidth).toBeUndefined();
  });
});

describe('every condition has a value at every breakpoint', () => {
  const names = ['Show-Tabs', 'Show-Condensed'];
  const fallback = (c: string) => c !== 'Show-Condensed';

  it('fills holes rather than leaving them false by accident', () => {
    /* An absent value reads as false downstream, so a hole would silently hide
       a part at whichever widths were never visited. */
    const filled = completeMatrix({ 'Show-Tabs': { xs: false } }, names, BPS, fallback);
    expect(filled['Show-Tabs']).toEqual({ xs: false, sm: true, md: true, lg: true, xl: true });
    expect(Object.values(filled['Show-Condensed']).every((v) => v === false)).toBe(true);
  });

  it('keeps a deliberate false, distinguishing it from a missing one', () => {
    // The whole reason completion takes a fallback rather than defaulting to
    // true: an explicit false must survive it.
    const filled = completeMatrix({ 'Show-Tabs': { xl: false } }, names, BPS, fallback);
    expect(filled['Show-Tabs'].xl).toBe(false);
  });

  it('drops conditions that no longer exist', () => {
    // A renamed or removed condition should not linger and quietly gate
    // nothing.
    const filled = completeMatrix({ 'Old-Name': { xs: true } }, names, BPS, fallback);
    expect(Object.keys(filled).sort()).toEqual(['Show-Condensed', 'Show-Tabs']);
  });

  it('adds a column when a breakpoint is added', () => {
    const withXxl = [...BPS, { id: 'xxl', label: 'xxl', minWidth: 2560 }];
    const filled = completeMatrix({ 'Show-Tabs': { xs: false } }, names, withXxl, fallback);
    expect(filled['Show-Tabs'].xxl).toBe(true);
  });
});

describe('reading one breakpoint back out', () => {
  it('flattens to what the renderer wants', () => {
    const m = completeMatrix({ 'Show-Tabs': { xs: false } }, ['Show-Tabs'], BPS, () => true);
    expect(conditionsAt(m, 'xs')).toEqual({ 'Show-Tabs': false });
    expect(conditionsAt(m, 'xl')).toEqual({ 'Show-Tabs': true });
  });

  it('an unknown breakpoint yields all false, not all true', () => {
    // Safer default: a part behind a condition stays hidden rather than
    // appearing at a width nobody designed.
    const m = completeMatrix({}, ['Show-Tabs'], BPS, () => true);
    expect(conditionsAt(m, 'nonexistent')).toEqual({ 'Show-Tabs': false });
  });
});

// ─── The nav's own starting table ────────────────────────────────────────────
import { defaultNavMatrix, NAV_CONDITIONS } from '../utils/addOns/navDefinition';

describe('the default matrix encodes design intent, not blanket true', () => {
  const names = Object.keys(NAV_CONDITIONS);
  const m = defaultNavMatrix(names, DEFAULT_BREAKPOINTS);

  it('tabs and the menu button are never both on, or both off', () => {
    /* Both true shows two navigations; both false shows none. Neither is a
       state anyone would design, so the starting table cannot produce one. */
    for (const bp of DEFAULT_BREAKPOINTS) {
      const tabs = m['Adaptive-Nav/Show-Tabs'][bp.id];
      const menu = m['Adaptive-Nav/Show-Menu-Button'][bp.id];
      expect([bp.id, tabs === menu]).toEqual([bp.id, false]);
    }
  });

  it('the menu button appears only at the narrowest width', () => {
    expect(m['Adaptive-Nav/Show-Menu-Button'].xs).toBe(true);
    for (const id of ['sm', 'md', 'lg', 'xl']) expect([id, m['Adaptive-Nav/Show-Menu-Button'][id]]).toEqual([id, false]);
  });

  it('scroll conditions start false at every width', () => {
    /* They are not width-driven at all. Seeding one true would show a
       condensed state that only exists after scrolling. */
    for (const [name, def] of Object.entries(NAV_CONDITIONS)) {
      if (def.trigger !== 'scroll') continue;
      for (const bp of DEFAULT_BREAKPOINTS) expect([name, bp.id, m[name][bp.id]]).toEqual([name, bp.id, false]);
    }
  });

  it('the rail only appears where there is width for it', () => {
    expect(m['Adaptive-Nav/Show-Rail'].xs).toBe(false);
    expect(m['Adaptive-Nav/Show-Rail'].xl).toBe(true);
  });

  it('covers every condition and every breakpoint', () => {
    // A hole reads as false downstream and hides a part with nothing to say why.
    for (const name of names) {
      for (const bp of DEFAULT_BREAKPOINTS) expect(typeof m[name][bp.id]).toBe('boolean');
    }
  });
});
