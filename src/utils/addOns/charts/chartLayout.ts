/**
 * Chart layout — the parity contract between the code a chart add-on emits and
 * the Figma build the Omni Design plugin makes from the same spec.
 *
 * "Looks the same" is a set of numbers: where each bar sits, how tall it is,
 * where each gridline falls. Two implementations of those numbers drift
 * silently (invariant 5), so neither side computes geometry. The code
 * generator (chartCode.ts) and the plugin's chart builder both call
 * layoutChart() and draw what it returns.
 *
 * It is a pure function of (spec, metrics). `metrics` are design-system sizes
 * already resolved to px — the studio reads them from the system's CSS, the
 * plugin from the file's variables — so a different system's spacing moves
 * both sides together.
 *
 * THE BLOCK BETWEEN THE MARKERS IS COPIED VERBATIM into the plugin's code.ts
 * (which has no module system, so the copy drops the `export` keywords).
 * src/__tests__/chartLayoutSync.test.ts fails when the two differ — edit here,
 * then paste the block across.
 */
import type { ChartSpec } from './chartSpec';

// <chart-layout>
export type ChartType = 'bar' | 'bar3d' | 'bar3dWide' | 'line';

export interface ChartMetrics {
  /** Component-Size / Data-Visualizations/Bar-Width */
  barWidth: number;
  /** Sizing-1-and-Half — one face of the 3dBar */
  faceWidth: number;
  /** The 3dBar's face outline; the two faces overlap by it */
  outline: number;
  /** Sizing-6 — Wide-3dBar front face */
  wideFront: number;
  /** Sizing-Half — Wide-3dBar side face */
  wideSide: number;
  /** Sizing-3 — between bars */
  gap: number;
  /** Sizing-2 — chart padding */
  padding: number;
  /** Sizing-1 — bar to its label */
  labelGap: number;
  /** Labels/Mobile-Nav-Label-Line-Height */
  labelHeight: number;
  /** Data-Visualizations/Label Width */
  labelWidth: number;
  /** The value-axis label column */
  tickLabelWidth: number;
  /** Sizing-1 — axis labels to the plot */
  axisGap: number;
}

/** The Figma components' values. FALLBACKS only: each side passes what its
 *  system resolves to, and the names are the Figma variables so a mismatch
 *  can be traced. */
export const DEFAULT_METRICS: ChartMetrics = {
  barWidth: 16,
  faceWidth: 12,
  outline: 1,
  wideFront: 48,
  wideSide: 4,
  gap: 24,
  padding: 16,
  labelGap: 8,
  labelHeight: 17,
  labelWidth: 80,
  tickLabelWidth: 32,
  axisGap: 8,
};

/** What changes with the Component-Size mode: the Data-Visualizations sizes,
 *  read from the Figma file (large is what Basic Bar Chart uses). */
export const SIZE_METRICS: { [k: string]: Partial<ChartMetrics> } = {
  small: { barWidth: 4, labelWidth: 60 },
  medium: { barWidth: 8, labelWidth: 80 },
  large: { barWidth: 16, labelWidth: 100 },
};

/** Fallbacks for a size mode, before the design system's own values. */
export function metricsForSize(size: string): ChartMetrics {
  return Object.assign({}, DEFAULT_METRICS, SIZE_METRICS[size] || SIZE_METRICS.large);
}

/** Fixed geometry each bar component adds AROUND its value-driven body. Only
 *  the body grows. The 3dBar's Top (cap) is 10px and its Bottom (the V) 6px;
 *  the Wide-3dBar's 5px side slope sits inside its front face's height.
 *  `labelGap` is set where the component does not use Sizing-1: the flat Bar
 *  spaces its label 10px below, as a literal in the component. */
export const BAR_FIXED: { [k: string]: { top: number; bottom: number; labelGap?: number } } = {
  bar: { top: 0, bottom: 0, labelGap: 10 },
  bar3d: { top: 10, bottom: 6 },
  bar3dWide: { top: 0, bottom: 0 },
  line: { top: 0, bottom: 0 },
};

export interface LayoutItem {
  index: number;
  label: string;
  value: number;
  color: string;
  x: number;
  width: number;
  centerX: number;
  valueHeight: number;
  frameY: number;
  frameHeight: number;
  labelY: number;
  clamped: boolean;
}

export interface ChartLayout {
  width: number;
  height: number;
  plot: { x: number; y: number; width: number; height: number; baseline: number };
  ticks: { value: number; label: string; y: number }[];
  items: LayoutItem[];
  line: { points: { x: number; y: number }[] } | null;
  warnings: string[];
}

/** Width of one item's column for a chart type. */
export function chartItemWidth(type: string, m: ChartMetrics): number {
  if (type === 'bar3d') return m.faceWidth * 2 - m.outline;
  if (type === 'bar3dWide') return m.wideFront + m.wideSide;
  return m.barWidth;
}

/** Decimal places a step needs, so 0.25 steps print as 0.25, not 0.3. */
function chartDecimals(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i === -1 ? 0 : Math.min(4, s.length - i - 1);
}

/** A value the way the axis and labels print it. */
export function formatChartValue(v: number, axis: { step: number; prefix?: string; suffix?: string }): string {
  const d = isFinite(axis.step) ? chartDecimals(axis.step) : 0;
  return (axis.prefix || '') + Number(v).toFixed(d) + (axis.suffix || '');
}

/** Tick values from min to max by step, inclusive, without float creep. */
export function chartTicks(axis: { min: number; max: number; step: number }): number[] {
  const out: number[] = [];
  const step = Math.abs(axis.step) || 1;
  const d = chartDecimals(step);
  const count = Math.floor((axis.max - axis.min) / step + 1e-9);
  for (let i = 0; i <= count && i <= 200; i++) out.push(Number((axis.min + i * step).toFixed(d)));
  return out;
}

/**
 * Lay a chart out. Coordinates are px from the chart frame's top-left. Values
 * map linearly from [axis.min, axis.max] onto [0, plotHeight]; anything
 * outside is clamped and reported, never drawn past the plot.
 */
export function layoutChart(spec: ChartSpec, metrics?: Partial<ChartMetrics>): ChartLayout {
  const m: ChartMetrics = Object.assign(metricsForSize(spec.size), metrics || {});
  const axis = spec.axis;
  const n = spec.data.length;
  const warnings: string[] = [];

  const w = chartItemWidth(spec.type, m);
  const fixed = BAR_FIXED[spec.type] || BAR_FIXED.bar;
  const extra = fixed.top + fixed.bottom;
  const labelGap = fixed.labelGap !== undefined ? fixed.labelGap : m.labelGap;

  const axisW = spec.showAxis ? m.tickLabelWidth + m.axisGap : 0;
  const plotX = m.padding + axisW;
  const plotW = n * w + Math.max(0, n - 1) * m.gap;

  // Headroom so a full-height 3dBar's cap stays inside the padding.
  const plotTop = m.padding + extra;
  const plotH = spec.plotHeight;
  const baseline = plotTop + plotH;

  const range = (axis.max - axis.min) || 1;
  const scale = (v: number) => Math.max(0, Math.min(1, (v - axis.min) / range)) * plotH;

  const items: LayoutItem[] = spec.data.map((d, i) => {
    const raw = Number(d.value);
    const clamped = raw < axis.min || raw > axis.max;
    if (clamped) warnings.push('"' + d.label + '" is ' + raw + ', outside the axis (' + axis.min + '–' + axis.max + '); drawn at the edge.');
    const valueHeight = scale(raw);
    const frameHeight = valueHeight + extra;
    const x = plotX + i * (w + m.gap);
    return {
      index: i, label: d.label, value: raw, color: d.color,
      x, width: w, centerX: x + w / 2,
      valueHeight, frameY: baseline - frameHeight, frameHeight,
      labelY: baseline + labelGap, clamped,
    };
  });

  const ticks = chartTicks(axis).map((value) => ({
    value, label: formatChartValue(value, axis), y: baseline - scale(value),
  }));

  const line = spec.type === 'line'
    ? { points: items.map((it) => ({ x: it.centerX, y: baseline - it.valueHeight })) }
    : null;

  const labelsH = spec.showLabels ? labelGap + m.labelHeight : 0;
  return {
    width: plotX + plotW + m.padding,
    height: baseline + labelsH + m.padding,
    plot: { x: plotX, y: plotTop, width: plotW, height: plotH, baseline },
    ticks, items, line, warnings,
  };
}
// </chart-layout>
