/**
 * The accessibility report grades the CSS a page loads (cssCascade +
 * renderedAccessibilityReport), not tokens.json.
 *
 * The resolver was checked value for value against Chrome on a published
 * system's sheets (2026-11-03: 4,320 role values across 90 theme x surface
 * cells, both modes, zero differences). These tests pin the cascade rules
 * that comparison depended on, so a change to the resolver cannot quietly
 * start grading a different page.
 */
import { describe, it, expect } from 'vitest';
import { Cascade, parseColor, contrast, type CascadeElement } from '../utils/cssCascade';
import { buildRenderedAccessibilityReport, REPORT_THEMES, REPORT_SURFACES } from '../utils/renderedAccessibilityReport';

const root: CascadeElement = { attrs: {}, root: true };
const themed = (theme: string): CascadeElement => ({ attrs: { 'data-theme': theme }, parent: root });
const surface = (s: string, parent: CascadeElement): CascadeElement => ({ attrs: { 'data-surface': s }, parent });

describe('cssCascade', () => {
  it('a more specific selector wins over a later, less specific one', () => {
    const c = new Cascade([`
      [data-theme="A"] [data-surface="Container"] { --X: #111111; }
      [data-surface="Container"] { --X: #222222; }
    `]);
    expect(c.computed(surface('Container', themed('A')))['--X']).toBe('#111111');
    expect(c.computed(surface('Container', themed('B')))['--X']).toBe('#222222');
  });

  it('equal specificity: the later rule wins, across sheets too', () => {
    const c = new Cascade([`[data-theme] { --X: #111111; }`, `[data-theme] { --X: #222222; }`]);
    expect(c.computed(themed('A'))['--X']).toBe('#222222');
  });

  it('prefix attribute selectors match', () => {
    const c = new Cascade([`[data-theme="A"] [data-surface^="Container"] { --X: #333333; }`]);
    expect(c.computed(surface('Container-High', themed('A')))['--X']).toBe('#333333');
    expect(c.computed(surface('Surface', themed('A')))['--X']).toBeUndefined();
  });

  it('var() resolves on the element that DECLARES the property', () => {
    // --Text is declared on the theme as var(--Tone); the child redefines
    // --Tone but inherits --Text already computed — the browser's rule.
    const c = new Cascade([`
      [data-theme="A"] { --Tone: #000000; --Text: var(--Tone); }
      [data-surface="Container"] { --Tone: #ffffff; }
    `]);
    const card = surface('Container', themed('A'));
    expect(c.computed(card)['--Text']).toBe('#000000');
    expect(c.computed(card)['--Tone']).toBe('#ffffff');
  });

  it('falls back when a var is undefined, and drops a cycle', () => {
    const c = new Cascade([`:root { --A: var(--Missing, #123456); --B: var(--C); --C: var(--B); }`]);
    const v = c.computed(root);
    expect(v['--A']).toBe('#123456');
    expect(v['--B']).toBeUndefined();
  });

  it('skips at-rule blocks and selectors it cannot match exactly', () => {
    const c = new Cascade([`
      @media (min-width: 1px) { :root { --X: #ff0000; } }
      .card { --Y: #ff0000; }
      :root { --X: #00ff00; }
    `]);
    expect(c.computed(root)['--X']).toBe('#00ff00');
    expect(c.computed(root)['--Y']).toBeUndefined();
  });

  it('contrast math matches WCAG', () => {
    expect(contrast(parseColor('#000000')!, parseColor('#ffffff')!)).toBeCloseTo(21, 5);
    expect(contrast(parseColor('#767676')!, parseColor('#ffffff')!)).toBeCloseTo(4.54, 2);
  });
});

describe('rendered accessibility report', () => {
  // A dark card whose eyebrow was chosen for the surface behind it — the
  // shape of the bug the token-based report missed.
  const light = [`
    :root { --Background: #ffffff; --Text: #111111; --Eyebrow: #6b2b2b; }
    [data-theme="Primary"] { --Background: #f5f5f5; --Text: #111111; --Eyebrow: #6b2b2b; }
    [data-theme="Primary"] [data-surface^="Container"] { --Background: #1c1c1c; --Text: #eeeeee; --Eyebrow: #542e2f; }
  `];

  it('grades every theme x surface, plus pages with no data-theme', () => {
    const sections = buildRenderedAccessibilityReport({ light, dark: [] });
    // Only contexts that paint a background are reported; here every context
    // inherits one, so all of them are.
    expect(sections.length).toBe((REPORT_THEMES.length + 1) * REPORT_SURFACES.length);
  });

  it('flags an eyebrow that fails on the card it actually sits on', () => {
    const sections = buildRenderedAccessibilityReport({ light, dark: [] });
    const card = sections.find((s) => s.background === 'Primary theme' && s.surfaceLevel === 'Container')!;
    const eyebrow = card.checks.find((c) => c.token === '--Eyebrow')!;
    expect(eyebrow.passes).toBe(false);
    expect(eyebrow.bgColor).toBe('#1c1c1c');
    const surfaceEyebrow = sections
      .find((s) => s.background === 'Primary theme' && s.surfaceLevel === 'Surface')!
      .checks.find((c) => c.token === '--Eyebrow')!;
    expect(surfaceEyebrow.passes).toBe(true);
  });

  it('a button passes on its fill OR its border (WCAG 1.4.11)', () => {
    const css = [`:root { --Background: #000000; --Buttons-Primary-Button: #ffffff; --Buttons-Primary-Border: #000000; --Buttons-Primary-Text: #000000; }`];
    const s = buildRenderedAccessibilityReport({ light: css, dark: [] })[0];
    const edge = s.checks.find((c) => c.label === 'Primary Button edge → surface')!;
    expect(edge.passes).toBe(true);
    expect(edge.token).toBe('--Buttons-Primary-Button');
  });

  it('composites translucent text over the background it sits on', () => {
    const css = [`:root { --Background: #000000; --Text: #ffffffb3; }`];
    const s = buildRenderedAccessibilityReport({ light: css, dark: [] })[0];
    const text = s.checks.find((c) => c.token === '--Text')!;
    expect(text.fgColor).toBe('#b3b3b3');
  });
});
