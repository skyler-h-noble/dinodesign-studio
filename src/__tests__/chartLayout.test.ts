/**
 * The chart layout is the parity contract: the generated code and the Figma
 * build both draw these numbers. So the tests pin the numbers against the
 * Figma components' measured geometry, not just that something came out.
 */
import { describe, it, expect } from 'vitest';
import {
  layoutChart, chartItemWidth, chartTicks, formatChartValue, metricsForSize, DEFAULT_METRICS,
} from '../utils/addOns/charts/chartLayout';
import { normalizeChartSpec, worstChartLevel, parseChartSpecText, CHART_COLORS } from '../utils/addOns/charts/chartSpec';

const spec = (over: Record<string, unknown> = {}) => normalizeChartSpec({
  version: 'chart1',
  type: 'bar',
  size: 'large',
  plotHeight: 100,
  axis: { min: 0, max: 100, step: 25 },
  data: [{ label: 'A', value: 50 }, { label: 'B', value: 100 }, { label: 'C', value: 0 }],
  ...over,
}).spec;

describe('chart layout', () => {
  it('item widths match the Figma components', () => {
    const m = metricsForSize('large');
    expect(chartItemWidth('bar', m)).toBe(16);        // Bar-Width, large
    expect(chartItemWidth('bar3d', m)).toBe(23);      // two 12px faces sharing a 1px seam
    expect(chartItemWidth('bar3dWide', m)).toBe(52);  // 48 front + 4 side
  });

  it('Bar-Width follows the Component-Size mode', () => {
    expect(metricsForSize('small').barWidth).toBe(4);
    expect(metricsForSize('medium').barWidth).toBe(8);
    expect(metricsForSize('large').barWidth).toBe(16);
    expect(metricsForSize('medium').labelWidth).toBe(80);
    expect(layoutChart(spec({ size: 'medium', showAxis: false })).items[0].width).toBe(8);
  });

  it('bars sit on the baseline and scale linearly', () => {
    const L = layoutChart(spec({ showAxis: false }));
    expect(L.plot.baseline).toBe(16 + 100);
    expect(L.items.map((i) => i.valueHeight)).toEqual([50, 100, 0]);
    for (const it of L.items) expect(it.frameY + it.frameHeight).toBe(L.plot.baseline);
  });

  it('bars are spaced by the gap from the padding', () => {
    const L = layoutChart(spec({ showAxis: false }));
    expect(L.items.map((i) => i.x)).toEqual([16, 16 + 16 + 24, 16 + 2 * (16 + 24)]);
    expect(L.width).toBe(16 + 3 * 16 + 2 * 24 + 16);
  });

  it('the axis column shifts the plot right', () => {
    expect(layoutChart(spec({ showAxis: true })).plot.x).toBe(16 + 32 + 8);
  });

  it('3dBar adds its fixed top and bottom around the value', () => {
    const L = layoutChart(spec({ type: 'bar3d', showAxis: false }));
    expect(L.items[1].valueHeight).toBe(100);
    expect(L.items[1].frameHeight).toBe(116);         // Top 10 + middle + Bottom 6
    expect(L.plot.y).toBe(16 + 16);
    expect(L.items[1].frameY).toBeGreaterThanOrEqual(16);
  });

  it('ticks run min to max on the scale', () => {
    const L = layoutChart(spec());
    expect(L.ticks.map((t) => t.value)).toEqual([0, 25, 50, 75, 100]);
    expect(L.ticks[0].y).toBe(L.plot.baseline);
    expect(L.ticks[4].y).toBe(L.plot.baseline - 100);
  });

  it('decimal steps do not creep', () => {
    expect(chartTicks({ min: 0, max: 1, step: 0.1 })).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    expect(formatChartValue(0.25, { step: 0.25, suffix: '%' })).toBe('0.25%');
    expect(formatChartValue(50, { step: 25, prefix: '$' })).toBe('$50');
  });

  it('out-of-range values are clamped and reported', () => {
    const L = layoutChart(spec({ data: [{ label: 'Hi', value: 140 }, { label: 'Lo', value: -5 }] }));
    expect(L.items.map((i) => i.valueHeight)).toEqual([100, 0]);
    expect(L.warnings).toHaveLength(2);
  });

  it('line points sit on item centers at the value', () => {
    const L = layoutChart(spec({ type: 'line', showAxis: false }));
    expect(L.line!.points[0]).toEqual({ x: 16 + 8, y: L.plot.baseline - 50 });
  });

  it('design-system metrics override the fallbacks', () => {
    const L = layoutChart(spec({ showAxis: false }), { gap: 40, padding: 24, barWidth: 20 });
    expect(L.items[1].x).toBe(24 + 20 + 40);
  });

  it('labels add a row below the baseline, at each component\'s own gap', () => {
    const on = layoutChart(spec({ showLabels: true }));
    const off = layoutChart(spec({ showLabels: false }));
    expect(on.height - off.height).toBe(10 + DEFAULT_METRICS.labelHeight);   // Bar: literal 10
    expect(on.items[0].labelY).toBe(on.plot.baseline + 10);
    const b3 = layoutChart(spec({ type: 'bar3d', showLabels: true }));
    expect(b3.items[0].labelY).toBe(b3.plot.baseline + DEFAULT_METRICS.labelGap);  // Sizing-1
  });
});

describe('chart spec', () => {
  const ok = { version: 'chart1', type: 'bar', axis: { min: 0, max: 100, step: 25 }, data: [{ label: 'A', value: 10 }] };

  it('a minimal spec passes with defaults filled in', () => {
    const r = normalizeChartSpec(ok);
    expect(worstChartLevel(r.findings)).toBeNull();
    expect(r.spec).toMatchObject({ ground: 'light', size: 'large', plotHeight: 160 });
    expect(r.spec.data[0].color).toBe('Chart-1');
  });

  it('colors default round-robin and a repeat is noted', () => {
    const data = Array.from({ length: 12 }, (_, i) => ({ label: String(i), value: i }));
    const r = normalizeChartSpec({ ...ok, data });
    expect(r.spec.data[10].color).toBe(CHART_COLORS[0]);
    expect(r.findings.some((x) => x.title === 'Colors repeat')).toBe(true);
  });

  it('refuses what cannot be drawn honestly', () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ ...ok, version: 'gradient1' }, 'This is a "gradient1" spec'],
      [{ ...ok, type: 'pie' }, 'Unknown chart type'],
      [{ ...ok, data: [] }, 'No data'],
      [{ ...ok, axis: { min: 10, max: 10, step: 1 } }, 'The axis has no range'],
      [{ ...ok, axis: { min: 0, max: 100, step: 0 } }, 'The axis step is not positive'],
      [{ ...ok, axis: { min: 0, max: 1000, step: 1 } }, 'Too many gridlines'],
      [{ ...ok, data: [{ label: 'A', value: 'x' }] }, 'Row 1 has no number'],
      [{ ...ok, data: [{ label: 'A', value: 1, color: '#ff0000' }] }, 'Row 1 has an unknown color'],
      [{ ...ok, plotHeight: 5 }, 'Plot height out of range'],
    ];
    for (const [s, title] of cases) {
      const r = normalizeChartSpec(s);
      expect(worstChartLevel(r.findings), title).toBe('refuse');
      expect(r.findings.map((x) => x.title), title).toContain(title);
    }
  });

  it('a ragged axis warns', () => {
    expect(worstChartLevel(normalizeChartSpec({ ...ok, axis: { min: 0, max: 100, step: 30 } }).findings)).toBe('warn');
  });

  it('pasted text is parsed or explained', () => {
    expect(parseChartSpecText(JSON.stringify(ok))).toEqual(ok);
    expect(() => parseChartSpecText('')).toThrow(/Paste a spec first/);
    expect(() => parseChartSpecText('omni1:abc')).toThrow(/not a chart spec/);
    expect(() => parseChartSpecText('{"version":')).toThrow(/not valid JSON/);
  });
});
