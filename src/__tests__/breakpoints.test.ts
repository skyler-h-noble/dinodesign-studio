import { describe, it, expect } from 'vitest';
import {
  DEFAULT_BREAKPOINTS, sortBreakpoints, validateBreakpoints, breakpointAt,
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
    expect(breakpointAt(BPS, 375)?.id).toBe('mobile');
    expect(breakpointAt(BPS, 768)?.id).toBe('tablet');   // inclusive lower bound
    expect(breakpointAt(BPS, 1279)?.id).toBe('tablet');
    expect(breakpointAt(BPS, 1280)?.id).toBe('desktop');
  });

  it('works on an unsorted list', () => {
    // Order is meaning, not presentation — so the lookup sorts rather than
    // trusting the caller.
    const shuffled = [BPS[2], BPS[0], BPS[1]];
    expect(breakpointAt(shuffled, 900)?.id).toBe('tablet');
    expect(sortBreakpoints(shuffled).map((b) => b.id)).toEqual(['mobile', 'tablet', 'desktop']);
  });

  it('reports the range each one covers', () => {
    expect(breakpointRange(BPS, 'mobile')).toEqual({ from: 0, to: 767 });
    expect(breakpointRange(BPS, 'tablet')).toEqual({ from: 768, to: 1279 });
    // The widest has no ceiling, which is different from a ceiling of Infinity
    // — it is what makes "and up" displayable.
    expect(breakpointRange(BPS, 'desktop')).toEqual({ from: 1280, to: null });
  });
});

describe('every condition has a value at every breakpoint', () => {
  const names = ['Show-Tabs', 'Show-Condensed'];
  const fallback = (c: string) => c !== 'Show-Condensed';

  it('fills holes rather than leaving them false by accident', () => {
    /* An absent value reads as false downstream, so a hole would silently hide
       a part at whichever widths were never visited. */
    const filled = completeMatrix({ 'Show-Tabs': { mobile: false } }, names, BPS, fallback);
    expect(filled['Show-Tabs']).toEqual({ mobile: false, tablet: true, desktop: true });
    expect(filled['Show-Condensed']).toEqual({ mobile: false, tablet: false, desktop: false });
  });

  it('keeps a deliberate false, distinguishing it from a missing one', () => {
    // The whole reason completion takes a fallback rather than defaulting to
    // true: an explicit false must survive it.
    const filled = completeMatrix({ 'Show-Tabs': { desktop: false } }, names, BPS, fallback);
    expect(filled['Show-Tabs'].desktop).toBe(false);
  });

  it('drops conditions that no longer exist', () => {
    // A renamed or removed condition should not linger and quietly gate
    // nothing.
    const filled = completeMatrix({ 'Old-Name': { mobile: true } }, names, BPS, fallback);
    expect(Object.keys(filled).sort()).toEqual(['Show-Condensed', 'Show-Tabs']);
  });

  it('adds a column when a breakpoint is added', () => {
    const withXl = [...BPS, { id: 'xl', label: 'Wide', minWidth: 1920 }];
    const filled = completeMatrix({ 'Show-Tabs': { mobile: false } }, names, withXl, fallback);
    expect(filled['Show-Tabs'].xl).toBe(true);
  });
});

describe('reading one breakpoint back out', () => {
  it('flattens to what the renderer wants', () => {
    const m = completeMatrix({ 'Show-Tabs': { mobile: false } }, ['Show-Tabs'], BPS, () => true);
    expect(conditionsAt(m, 'mobile')).toEqual({ 'Show-Tabs': false });
    expect(conditionsAt(m, 'desktop')).toEqual({ 'Show-Tabs': true });
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
    expect(m['Adaptive-Nav/Show-Menu-Button']).toEqual({ mobile: true, tablet: false, desktop: false });
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
    expect(m['Adaptive-Nav/Show-Rail'].mobile).toBe(false);
    expect(m['Adaptive-Nav/Show-Rail'].desktop).toBe(true);
  });

  it('covers every condition and every breakpoint', () => {
    // A hole reads as false downstream and hides a part with nothing to say why.
    for (const name of names) {
      for (const bp of DEFAULT_BREAKPOINTS) expect(typeof m[name][bp.id]).toBe('boolean');
    }
  });
});
