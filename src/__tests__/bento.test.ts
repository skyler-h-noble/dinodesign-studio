/** Bento Grid: the span rules, the markup, and the round trip. */
import { describe, it, expect } from 'vitest';
import { normalizeBentoSpec, normalizeBentoTile, bentoSpan, bentoRows, bentoPlace, bentoFlow, bentoAutoFit, bentoSuggest, bentoTouchingSame, bentoDistinctSurface, bentoMinHeight, BENTO_STARTER } from '../utils/addOns/bento/bentoSpec';
import { bentoHTML, bentoCSS } from '../utils/addOns/bento/bentoCode';
import { extractBentoSpec, encodeBentoSpec } from '../utils/addOns/bento/bentoShare';

describe('bento spans', () => {
  it('derives tablet and phone spans by rule, and overrides win', () => {
    const t = (span: number, extra = {}) => normalizeBentoTile({ span, ...extra });
    expect([3, 4, 6, 8, 12].map((s) => bentoSpan(t(s), 'tablet'))).toEqual([4, 4, 8, 8, 8]);
    expect([3, 4, 6, 8, 12].map((s) => bentoSpan(t(s), 'mobile'))).toEqual([2, 4, 4, 4, 4]);
    expect(bentoSpan(t(8, { tabletSpan: 4 }), 'tablet')).toBe(4);
    expect(bentoSpan(t(3, { mobileSpan: 4 }), 'mobile')).toBe(4);
  });

  it('keeps two rows on a phone only for images', () => {
    expect(bentoRows(normalizeBentoTile({ kind: 'text', rows: 2 }), 'mobile')).toBe(1);
    expect(bentoRows(normalizeBentoTile({ kind: 'image', rows: 2 }), 'mobile')).toBe(2);
    expect(bentoRows(normalizeBentoTile({ kind: 'text', rows: 2 }), 'desktop')).toBe(2);
  });

  it('places tiles the way CSS grid does, so Figma lands them in the same cells', () => {
    const tiles = BENTO_STARTER.map(normalizeBentoTile);
    // 8x2 feature, then the stat beside it, the image under the stat, then two halves.
    expect(bentoPlace(tiles, 'desktop').map((p) => [p.row, p.col])).toEqual([[0, 0], [0, 8], [1, 8], [2, 0], [2, 6]]);
    // Tablet: the feature takes the row (two rows tall), stat and image share the next.
    expect(bentoPlace(tiles, 'tablet').map((p) => [p.row, p.col])).toEqual([[0, 0], [2, 0], [2, 4], [3, 0], [4, 0]]);
    expect(bentoPlace(tiles, 'mobile').every((p) => p.col === 0)).toBe(true);
  });

  it('auto-fit leaves no gap at the end of a row', () => {
    // Three thirds on desktop: on a tablet two pair up and the third sits alone
    // at half width — auto-fit widens it to the full row.
    const tiles = [4, 4, 4].map((span) => normalizeBentoTile({ span }));
    expect(tiles.map((t) => bentoSpan(t, 'tablet'))).toEqual([4, 4, 4]);
    expect(bentoAutoFit(tiles, 'tablet')).toEqual([4, 4, 8]);
    // Phone: two quarter tiles pair up; a lone third quarter fills its row.
    const q = [3, 3, 3].map((span) => normalizeBentoTile({ span }));
    expect(bentoAutoFit(q, 'mobile')).toEqual([2, 2, 4]);
    // Already full rows stay as they are.
    expect(bentoAutoFit([6, 6].map((span) => normalizeBentoTile({ span })), 'tablet')).toEqual([8, 8]);
  });

  it('suggests tablet and phone widths from the content', () => {
    const stat = normalizeBentoTile({ kind: 'stat', stat: '98%', statLabel: 'uptime', span: 4 });
    const shortText = normalizeBentoTile({ kind: 'text', title: 'Fast', body: 'Loads in a blink.', span: 4 });
    const longText = normalizeBentoTile({ kind: 'text', title: 'Everything you need to ship', body: 'A long paragraph that keeps going well past what a half-width tile can hold at a readable size, with more words after that, and then a few more sentences again so it overflows a single row comfortably on a tablet and certainly on a phone.', span: 4 });
    const image = normalizeBentoTile({ kind: 'image', span: 4 });
    // Tablet: the stat and short text pair up; the long text takes the row; the image fills the gap left beside it.
    expect(bentoSuggest([stat, shortText, longText, image], 'tablet', 200)).toEqual([4, 4, 8, 8]);
    // Phone: a half is 136px — too narrow for a readable paragraph, fine for a stat or an image.
    const phone = bentoSuggest([stat, image, shortText], 'mobile', 200);
    expect(phone.slice(0, 2)).toEqual([2, 2]);
    expect(phone[2]).toBe(4);
  });

  it('groups the tiles beside a two-row tile into a stack for Figma', () => {
    const flow = bentoFlow(BENTO_STARTER.map(normalizeBentoTile));
    // Feature, then the stat + image stack beside it, then the two halves.
    expect(flow.map((f) => (f.kind === 'tile' ? f.index : f.indices))).toEqual([0, [1, 2], 3, 4]);
    const stack = flow[1];
    // 4 wide on desktop (they stack), the full 8 on tablet (side by side), 4 on a phone.
    expect(stack.kind === 'stack' && stack.widths).toEqual({ desktop: 4, tablet: 8, mobile: 4 });
  });

  it('refuses spans that do not divide the row', () => {
    expect(normalizeBentoTile({ span: 5 }).span).toBe(4);
    expect(normalizeBentoTile({ tabletSpan: 6 }).tabletSpan).toBeNull();
  });
});

describe('bento code', () => {
  const spec = normalizeBentoSpec({ tiles: BENTO_STARTER });

  it('puts each tile on its surface with its three spans', () => {
    const html = bentoHTML(spec);
    expect(html).toContain('data-theme="Primary" data-surface="Surface-Dimmest" style="--span: 8; --span-t: 8; --span-m: 4; --rows: 2; --rows-m: 1"');
    expect(html.match(/omni-bento__tile /g)).toHaveLength(BENTO_STARTER.length);
  });

  it('lays the grid on the system tokens, with screen-width fallbacks', () => {
    const css = bentoCSS();
    expect(css).toContain('repeat(var(--Columns, var(--omni-bento-columns)), minmax(0, 1fr))');
    expect(css).toContain('gap: var(--Gutter, var(--omni-bento-gutter))');
    expect(css).toContain('padding: var(--Margin, var(--omni-bento-margin))');
    expect(css).toMatch(/\[data-device="IOS-Tablet"\][^{]*\.omni-bento__tile \{ grid-column: span var\(--span-t\)/);
  });

  it('reads a bento back from its HTML, link and spec', () => {
    expect(normalizeBentoSpec(extractBentoSpec(bentoHTML(spec)))).toEqual(spec);
    expect(normalizeBentoSpec(extractBentoSpec(`x/add-ons/bento/id#spec=${encodeBentoSpec(spec)}`))).toEqual(spec);
    expect(() => extractBentoSpec('{"version":"hero1"}')).toThrow(/Bento Grid spec/);
  });
});

describe('bento styles', () => {
  const tile = (o: object) => normalizeBentoTile({ kind: 'text', title: 'T', theme: 'Primary', surface: 'Surface', ...o });

  it('a spec from before styles is a bento of cards', () => {
    expect(normalizeBentoSpec({ tiles: [] }).style).toBe('cards');
    expect(normalizeBentoSpec({ style: 'boxes', tiles: [] }).style).toBe('boxes');
    expect(normalizeBentoSpec({ style: 'mosaic', tiles: [] }).style).toBe('cards');
  });

  it('boxes are flush in the code', () => {
    const html = bentoHTML(normalizeBentoSpec({ style: 'boxes', tiles: BENTO_STARTER }));
    expect(html).toContain('class="omni-bento omni-bento--boxes"');
    expect(bentoCSS()).toMatch(/\.omni-bento--boxes \{ gap: 0; padding: 0; \}/);
  });

  it('finds touching tiles on the same surface, beside and below, but not images', () => {
    // Row 1: A(6) B(6) — row 2: C(6) image(6). A·B side by side, A·C stacked.
    const tiles = [tile({ span: 6 }), tile({ span: 6 }), tile({ span: 6 }), tile({ kind: 'image', span: 6 })];
    expect(bentoTouchingSame(tiles, 'desktop')).toEqual([[0, 1], [0, 2]]);
    // A different surface on B breaks one pair; theme counts too.
    const fixed = tiles.map((t, i) => (i === 1 ? { ...t, surface: 'Surface-Bright' as const } : t));
    expect(bentoTouchingSame(fixed, 'desktop')).toEqual([[0, 2]]);
    expect(bentoTouchingSame(tiles.map((t, i) => (i === 2 ? { ...t, theme: 'Secondary' as const } : t)), 'desktop')).toEqual([[0, 1]]);
  });

  it('suggests the nearest surface none of its neighbors wear', () => {
    const tiles = [tile({ span: 6 }), tile({ span: 6, surface: 'Surface' })];
    const s = bentoDistinctSurface(tiles, 1, 'desktop');
    expect(s).not.toBe('Surface');
    expect(['Surface-Dim', 'Surface-Bright']).toContain(s);
  });

  it('a half-width box is wider than a half-width card, so more fits at half', () => {
    /* On a tablet a half card is 300px inside (34 characters a line) and a
       half box 336 (38). Twenty-four five-letter words take five lines in
       the card — too tall for a 200px row — and four in the box. */
    const t = tile({ title: 'Short', body: Array(24).fill('abcde').join(' '), span: 6 });
    expect(bentoSuggest([t, t], 'tablet', 200, 'cards')).toEqual([8, 8]);
    expect(bentoSuggest([t, t], 'tablet', 200, 'boxes')).toEqual([4, 4]);
  });
});

describe('a two-row tile is as tall as the stack beside it', () => {
  it('on every device and in both styles', () => {
    // [gutter] desktop cards, tablet, phone, boxes
    for (const g of [32, 24, 16, 0]) {
      const stack = bentoMinHeight(1, 200, g) + g + bentoMinHeight(1, 200, g);
      expect(bentoMinHeight(2, 200, g), `gutter ${g}`).toBe(stack);
    }
    // The old fixed 32px gap was 8px too tall on a tablet.
    expect(bentoMinHeight(2, 200, 24)).toBe(424);
    expect(bentoMinHeight(1, 200, 24)).toBe(200);
  });

  it('a text tile drops to one row on a phone; an image keeps two', () => {
    const text = normalizeBentoTile({ kind: 'text', title: 'T', span: 8, rows: 2 });
    const image = normalizeBentoTile({ kind: 'image', span: 8, rows: 2 });
    expect([bentoRows(text, 'desktop'), bentoRows(text, 'tablet'), bentoRows(text, 'mobile')]).toEqual([2, 2, 1]);
    expect(bentoRows(image, 'mobile')).toBe(2);
  });
});

describe('a tablet on its side is a 12-column grid', () => {
  it('portrait takes the tablet spans; landscape the 12 columns and desktop spans', () => {
    const css = bentoCSS();
    expect(css).toContain('[data-orientation="portrait"] .omni-bento__tile { grid-column: span var(--span-t); }');
    expect(css).toContain('[data-orientation="landscape"] .omni-bento { --Columns: 12; }');
    // No attribute: the screen decides, and portrait is never assumed in landscape.
    expect(css).toMatch(/@media \(orientation: landscape\) \{ [^}]*:not\(\[data-orientation\]\) \.omni-bento \{ --Columns: 12; \} \}/);
  });
});
