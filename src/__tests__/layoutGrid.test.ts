/** The layout grid: the Figma numbers and the CSS formula give the same widths. */
import { describe, it, expect } from 'vitest';
import {
  spanWidth, gridFor, gridCSS, devicesTypeGridVariables, deviceSizesGridAliases, pageLayoutVariables,
  colName, layoutParts, PAGE_LAYOUTS, NAV_WIDTH,
  DEVICE_COLUMNS, CLASS_WIDTH, SIZE_CLASSES, MAX_COLUMNS, type PageLayout,
} from '../utils/layoutGrid';
import type { DeviceMode } from '../utils/deviceChrome';

/** Evaluate the emitted CSS (the actual text) for one device by putting its
 *  numbers in for the custom properties — calc() / min() as arithmetic. The
 *  container is what the layout leaves: the device less its nav, with that
 *  layout's margin and gutter (a NoGutter page sets both to 0). */
function evalCSS(mode: DeviceMode, cls: (typeof SIZE_CLASSES)[number], layout: PageLayout = 'Standard'): Record<string, number> {
  const g = gridFor(cls, mode, layout);
  const env: Record<string, number> = { '--Margin': g.margin, '--Columns': g.columns, '--Gutter': g.gutter };
  const cq = g.width / 100;
  for (const line of gridCSS('')) {
    const [, name, expr] = /^(--[\w-]+):\s*(.+);$/.exec(line)!;
    const js = expr
      .replace(/var\((--[\w-]+)(?:,\s*[^)]+)?\)/g, (_, v) => String(env[v]))
      .replace(/(\d+(?:\.\d+)?)cqw/g, (_, n) => String(Number(n) * cq))
      .replace(/(\d+(?:\.\d+)?)px/g, '$1')
      .replace(/calc\(/g, '(').replace(/min\(/g, 'Math.min(');
    env[name] = Function(`return ${js}`)() as number;
  }
  return env;
}

describe('layout grid', () => {
  it('computes the spans from width, margin and gutter', () => {
    // Desktop Default: 1920 wide, 64 margins, 32 gutter → 1792 content, 120 columns.
    const d = gridFor('Default', 'Desktop');
    expect(spanWidth(1, d)).toBe(120);
    expect(spanWidth(4, d)).toBe(4 * 120 + 3 * 32);
    expect(spanWidth(12, d)).toBe(1792);
    // A phone has four columns, so a span of four or more is the whole row.
    const m = gridFor('Default', 'IOS-Mobile');
    expect(spanWidth(4, m)).toBe(393 - 32);
    expect(spanWidth(8, m)).toBe(393 - 32);
    expect(spanWidth(2, m)).toBe(172.5);
  });

  it('the CSS formula gives the Figma numbers on every device, size class and layout', () => {
    const payload = devicesTypeGridVariables();
    for (const mode of Object.keys(DEVICE_COLUMNS) as DeviceMode[]) {
      for (const cls of SIZE_CLASSES) {
        for (const layout of PAGE_LAYOUTS) {
          const css = evalCSS(mode, cls, layout);
          for (let n = 1; n <= MAX_COLUMNS; n++) {
            expect(css[`--Col-${n}`], `${mode} ${cls} ${layout} Col-${n}`).toBeCloseTo(payload[mode][colName(cls, layout, n)].value as number, 1);
          }
        }
      }
    }
  });

  it('a rail takes its width off the grid, and NoGutter has no gutter or margin', () => {
    // Desktop Default beside a rail: 1920 − 80 − 128 = 1712 of content.
    expect(spanWidth(12, gridFor('Default', 'Desktop', 'Standard-Rail'))).toBe(1712);
    expect(spanWidth(12, gridFor('Default', 'Desktop', 'Standard-Rail-Expanded'))).toBe(1920 - 280 - 128);
    // Flush: twelve equal columns of the whole width, a span is just n of them.
    expect(spanWidth(12, gridFor('Default', 'Desktop', 'NoGutter'))).toBe(1920);
    expect(spanWidth(3, gridFor('Default', 'Desktop', 'NoGutter'))).toBe(480);
    expect(spanWidth(6, gridFor('Default', 'Desktop', 'NoGutter-Rail'))).toBe((1920 - 80) / 2);
    expect(layoutParts('NoGutter-Rail-Expanded')).toEqual({ gutters: false, nav: 'Rail-Expanded' });
    expect(NAV_WIDTH.Rail).toBe(80);
  });

  it('Standard keeps the plain Col-N names, so nothing bound to them moves', () => {
    expect(colName('Wide', 'Standard', 4)).toBe('Wide/Col-4');
    expect(colName('Wide', 'NoGutter-Rail', 4)).toBe('Wide/NoGutter-Rail/Col-4');
  });

  it('Page-Layout aliases each layout\'s numbers, and zeroes NoGutter outright', () => {
    const pl = pageLayoutVariables();
    expect(Object.keys(pl)).toEqual([...PAGE_LAYOUTS]);
    expect(pl.Standard['Default/Col-4']).toBe('{Default.Col-4}');
    expect(pl['Standard-Rail']['Narrow/Col-4']).toBe('{Narrow.Standard-Rail.Col-4}');
    expect(pl.Standard['Default/Gutter']).toBe('{Default.Gutter}');
    expect(pl.NoGutter['Default/Gutter']).toBe(0);
    expect(pl['NoGutter-Rail']['Default/Margin']).toBe(0);
    expect(pl.Standard['Rare/Grid-Width']).toBe('{Rare.Device-Width}');
    expect(pl['NoGutter-Rail-Expanded']['Rare/Grid-Width']).toBe('{Rare.Rail-Expanded.Grid-Width}');
    // Every alias names a Devices-Type variable that exists — or a hand-authored one.
    const dt = new Set(Object.keys(devicesTypeGridVariables().Desktop));
    const authored = /^\{\w+\.(Gutter|Margin|Device-Width)\}$/;
    for (const bag of Object.values(pl)) {
      for (const v of Object.values(bag)) {
        if (typeof v !== 'string' || authored.test(v)) continue;
        expect(dt.has(v.slice(1, -1).split('.').join('/')), v).toBe(true);
      }
    }
  });

  it('ships Columns and every class\'s Col-N to Devices-Type, and Device-Sizes aliases them', () => {
    const payload = devicesTypeGridVariables();
    expect(payload.Desktop.Columns.value).toBe(12);
    expect(payload['IOS-Tablet-Vertical'].Columns.value).toBe(8);
    expect(payload['Android-Mobile'].Columns.value).toBe(4);
    // Columns, three flags, every layout's Col-N per class, and two Grid-Widths per class.
    expect(Object.keys(payload.Desktop)).toHaveLength(1 + 3 + SIZE_CLASSES.length * (PAGE_LAYOUTS.length * MAX_COLUMNS + 2));
    expect(payload.Desktop['Default/Rail/Grid-Width'].value).toBe(1840);
    // Exactly one grid flag is on per device, and it is that device's column count.
    for (const [mode, bag] of Object.entries(payload)) {
      const on = [12, 8, 4].filter((n) => bag[`Grid/${n}`].value === true);
      expect(on, mode).toEqual([bag.Columns.value]);
    }
    const aliases = deviceSizesGridAliases();
    expect(aliases.Wide['Col-4']).toBe('{Page-Layout:Wide.Col-4}');
    expect(aliases.Wide['Grid-Gutter']).toBe('{Page-Layout:Wide.Gutter}');
    expect(aliases.Narrow.Columns).toBe('{Columns}');
    expect(Object.keys(aliases)).toEqual([...SIZE_CLASSES]);
  });

  it('a span never shrinks as it grows, and never passes the content width', () => {
    for (const mode of Object.keys(DEVICE_COLUMNS) as DeviceMode[]) {
      for (const layout of PAGE_LAYOUTS) {
      const g = gridFor('Default', mode, layout);
      let last = 0;
      for (let n = 1; n <= MAX_COLUMNS; n++) {
        const w = spanWidth(n, g);
        expect(w).toBeGreaterThanOrEqual(last);
        expect(w).toBeLessThanOrEqual(g.width - 2 * g.margin);
        last = w;
      }
      }
    }
  });
});
