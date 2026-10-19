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
import type { ChartSpec, ChartDatum } from './chartSpec';

// <chart-layout>
export type ChartType = 'bar' | 'bar3d' | 'bar3dWide' | 'fancy' | 'stacked' | 'line' | 'pie' | 'donut';

export interface ChartMetrics {
  /** Component-Size / Data-Visualizations/Bar-Width */
  barWidth: number;
  /** Sizing-1-and-Half — one face of the 3dBar */
  faceWidth: number;
  /** The 3dBar's face outline; the two faces overlap by it */
  outline: number;
  /** Wide-3dBar front face — Component-Size Data-Visualizations/WideBar */
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
  /** One legend entry's column: swatch, gap and label. Fixed, so the legend
   *  lays out the same in code and in Figma without measuring text. */
  legendItemWidth: number;
  /** The legend swatch */
  legendSwatch: number;
  /** Legend to plot */
  legendGap: number;
  /** Room either side of a pie for the percent labels */
  pieLabelRoom: number;
  /** The Chart-Background border round each slice */
  sliceBorder: number;
  /** Depth of the ribbon line effect — the same 4px as the Wide-3dBar's side */
  ribbonDepth: number;
  /** Marker sizes: dot and square are solid, disc is a ring round a
   *  Chart-Background center, so it reads at a larger size */
  dotSize: number;
  discSize: number;
  /** FancyBar: the value bubble's halo — Component-Size
   *  Data-Visualizations/Fancy-LargeBar-Ring; also its column / row thickness */
  fancyBubble: number;
  /** FancyBar: the track, fill and ring — Data-Visualizations/Fancy-LargeBar */
  fancyTrack: number;
  /** Flat bar corners — Data-Visualizations/Bar-Radius */
  barRadius: number;
  /** 3dBar: the vertical bar's whole width and the horizontal bar's
   *  thickness — Data-Visualizations/3dBar (it follows Component-Size). */
  bar3dThick: number;
  /** Horizontal Wide-3dBar: the bar's thickness — Data-Visualizations/WideBar */
  wideThick: number;
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
  legendItemWidth: 120,
  legendSwatch: 12,
  legendGap: 16,
  pieLabelRoom: 48,
  sliceBorder: 2,
  ribbonDepth: 4,
  dotSize: 8,
  discSize: 12,
  fancyBubble: 56,
  fancyTrack: 40,
  barRadius: 8,
  bar3dThick: 32,
  wideThick: 32,
};

/** What changes with the Component-Size mode: the Data-Visualizations sizes,
 *  read from the Figma file (large is what Basic Bar Chart uses). */
export const SIZE_METRICS: { [k: string]: Partial<ChartMetrics> } = {
  // bar3dThick is Data-Visualizations/3dBar: the vertical bar's whole width
  // and the horizontal bar's thickness (12 / 24 / 32, read 2026-10-14).
  small: { barWidth: 4, labelWidth: 60, fancyTrack: 32, fancyBubble: 48, barRadius: 4, bar3dThick: 12, wideFront: 32, wideThick: 32 },
  medium: { barWidth: 8, labelWidth: 80, fancyTrack: 40, fancyBubble: 56, barRadius: 8, bar3dThick: 24, wideFront: 48, wideThick: 48 },
  large: { barWidth: 16, labelWidth: 100, fancyTrack: 64, fancyBubble: 80, barRadius: 4, bar3dThick: 32, wideFront: 56, wideThick: 56 },
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
  // The value bubble is centered on the fill's end, so half of it rises
  // above; the layout takes half of fancyBubble for the size mode.
  fancy: { top: 0, bottom: 0 },
  stacked: { top: 0, bottom: 0, labelGap: 8 },
  line: { top: 0, bottom: 0 },
};

/**
 * Horizontal variants, read off each component's Orientation=Horizontal.
 *   thick   the bar's height across the row
 *   end     fixed length past the value: the 3D end face (4px), half the
 *           FancyBar bubble (28px)
 *   labelW / labelGap / align   the component's Label-Area and its gap
 * A label width of 0 means the size mode's Label Width.
 */
export const HBAR_FIXED: { [k: string]: { thick: string | number; end: number; labelW: number; labelGap: number; align: 'left' | 'center' | 'right' } } = {
  bar: { thick: 'barWidth', end: 0, labelW: 0, labelGap: 8, align: 'right' },
  stacked: { thick: 'barWidth', end: 0, labelW: 0, labelGap: 8, align: 'right' },
  bar3d: { thick: 'bar3dThick', end: 4, labelW: 0, labelGap: 8, align: 'right' },
  // Right, like every flat and 3D bar: the labels share the edge they sit against.
  bar3dWide: { thick: 'wideThick', end: 4, labelW: 52, labelGap: 8, align: 'right' },
  // end is half the bubble; the layout reads it from fancyBubble.
  fancy: { thick: 'fancyBubble', end: 0, labelW: 0, labelGap: 8, align: 'left' },
};

/** A stack's piece. Every segment but the last runs 1px into the next, as the
 *  StackedBar slot's -1 gap does, so the stack's total stays the value. */
export interface LayoutSegment {
  series: number;
  name: string;
  color: string;
  value: number;
  /** px from the base along the value axis, and that as a fraction of the plot */
  start: number;
  len: number;
  startFrac: number;
  lenFrac: number;
}

export interface LayoutItem {
  index: number;
  label: string;
  value: number;
  color: string;
  x: number;
  width: number;
  centerX: number;
  /** centerX as a fraction of the plot width — responsive code positions by it. */
  centerFrac: number;
  valueHeight: number;
  frameY: number;
  frameHeight: number;
  labelY: number;
  clamped: boolean;
  /** The value's length as a fraction of the plot — responsive code sizes by it. */
  valueFrac: number;
  /** Horizontal charts: the label box beside the bar. */
  labelX?: number;
  labelW?: number;
  labelAlign?: 'left' | 'center' | 'right';
  /** Stacked charts: the pieces, base first. */
  segments?: LayoutSegment[];
}

export interface LayoutLine {
  series: number;
  name: string;
  color: string;
  marker: string;
  fill: string;
  points: { x: number; y: number; frac: number }[];
  /** SVG path data; Figma's vectorPaths take the same string. */
  path: string;
  /** The path closed down to the baseline, for the fill under the line. */
  area: string;
  /** For the ribbon effect: the band between the line and a copy of it
   *  pushed down-right by the depth, closed. Empty when the effect is off. */
  ribbon: string;
}

export interface LayoutSlice {
  index: number;
  label: string;
  value: number;
  color: string;
  /** Radians, clockwise from 12 o'clock. */
  start: number;
  end: number;
  /** Whole-number percent; the set always sums to 100. */
  percent: number;
  labelX: number;
  labelY: number;
  labelAlign: 'left' | 'right';
}

/** `marker` is set for a line: the key draws that line's shape ('none' = a
 *  short stroke). Unset for slices, which key with a square. */
export interface LayoutLegendItem { label: string; color: string; x: number; y: number; marker?: string }

export interface ChartLayout {
  width: number;
  height: number;
  /** True when categories are equal slots that stretch with the container. */
  responsive: boolean;
  /** Bars lie along x: categories are rows, the value axis runs left to right.
   *  plot.baseline is then the x the bars start from. */
  horizontal: boolean;
  plot: { x: number; y: number; width: number; height: number; baseline: number };
  /** Vertical charts: y is the gridline. Horizontal: x is the gridline and
   *  frac its place along the plot; y is the label row under the bars. */
  ticks: { value: number; label: string; y: number; x?: number; frac?: number }[];
  /** Horizontal charts: category gridlines, one per row center. */
  rowLines: { y: number }[];
  /** Vertical gridlines, one per category center. */
  xLines: { x: number; frac: number }[];
  items: LayoutItem[];
  /** First series only, kept for callers written before lines had several. */
  line: { points: { x: number; y: number }[] } | null;
  lines: LayoutLine[];
  pie: { cx: number; cy: number; r: number; innerR: number; slices: LayoutSlice[] } | null;
  /** The value-axis label column: wide enough for the longest label ("$1500")
   *  at the Mobile-Nav-Label size, never narrower than the metric. */
  tickWidth: number;
  /** The line through the bars' ends (bar.connect), as SVG / vectorPaths data. */
  connector: { points: { x: number; y: number; frac: number }[]; path: string } | null;
  legend: LayoutLegendItem[];
  warnings: string[];
}

/** The BarChartTopper's rings, outside its disc: the 4px series ring, and the
 *  Outline layer's Charts/Topper-Border (5 at every size) — a 1px edge in the
 *  Chart Outline color beyond it. */
export const CHART_TOPPER_RING = 4;
export const CHART_TOPPER_EDGE = 5;

/** How far the Bar's topper reaches past the bar's end: half its disc (the
 *  bar's width) plus its outer edge. Zero when there is no topper — and a
 *  StackedBar never has one. */
export function chartTopperReach(spec: ChartSpec, m: ChartMetrics): number {
  return spec.bar.topper && spec.type === 'bar' ? m.barWidth / 2 + CHART_TOPPER_EDGE : 0;
}

/** The line through the bars' ends, for flat and stacked bars. Horizontal
 *  charts run it top to bottom: the curve is solved with the axes swapped,
 *  so it is monotone along the rows as a vertical chart's is along x. */
function chartConnector(spec: ChartSpec, items: LayoutItem[], horizontal: boolean) {
  if (spec.bar.connect === 'none' || !(spec.type === 'bar' || spec.type === 'stacked') || items.length < 2) return null;
  const points = items.map((it) => horizontal
    ? { x: it.x + it.valueHeight, y: it.frameY + it.frameHeight / 2, frac: it.valueFrac }
    // Flat and stacked bars have no cap, so the frame's top IS the bar's end.
    : { x: it.centerX, y: it.frameY, frac: it.centerFrac });
  if (!horizontal) return { points, path: chartLinePath(points, spec.bar.connect) };
  const swapped = chartLinePath(points.map((p) => ({ x: p.y, y: p.x })), spec.bar.connect);
  // Swap each coordinate pair back: the path's numbers come in (x y) pairs.
  const nums = swapped.match(/-?\d+(\.\d+)?/g) || [];
  let k = 0;
  const path = swapped.replace(/-?\d+(\.\d+)?\s+-?\d+(\.\d+)?/g, () => { const a = nums[k++]; const b = nums[k++]; return b + ' ' + a; });
  return { points, path };
}

/** The axis-label column for these ticks: ~7px a character at the label
 *  size (11px semibold), so "$1500" fits where 32px cut it off. */
function chartTickWidth(spec: ChartSpec, m: ChartMetrics): number {
  const longest = chartTicks(spec.axis).reduce((n, v) => Math.max(n, formatChartValue(v, spec.axis).length), 0);
  return Math.max(m.tickLabelWidth, Math.ceil(longest * 7 + 2));
}

/** Width of one item's column for a chart type. */
export function chartItemWidth(type: string, m: ChartMetrics): number {
  // The whole bar is Data-Visualizations/3dBar wide, in two halves; it used to
  // be a fixed 12px face doubled (23px) before the component took the size.
  if (type === 'bar3d') return m.bar3dThick;
  if (type === 'bar3dWide') return m.wideFront + m.wideSide;
  if (type === 'fancy') return m.fancyBubble;
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

const chartR2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A line through the points as SVG path data, straight or smooth.
 *
 * Smooth is a monotone cubic (Fritsch–Carlson): tangents are clamped so the
 * curve never overshoots a point, which is the difference between a smooth
 * line that still reads true and one that invents a dip below zero between
 * two small values. Written with C commands, which Figma's vectorPaths accept,
 * so both sides draw the identical curve from one string.
 */
export function chartLinePath(points: { x: number; y: number }[], curve: string): string {
  if (!points.length) return '';
  const P = points.map((p) => ({ x: chartR2(p.x), y: chartR2(p.y) }));
  if (P.length === 1 || curve !== 'smooth') {
    return 'M ' + P.map((p) => p.x + ' ' + p.y).join(' L ');
  }
  const n = P.length;
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) d.push((P[k + 1].y - P[k].y) / ((P[k + 1].x - P[k].x) || 1));
  const m: number[] = [d[0]];
  for (let k = 1; k < n - 1; k++) m.push(d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2);
  m.push(d[n - 2]);
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) { m[k] = 0; m[k + 1] = 0; continue; }
    const a = m[k] / d[k];
    const b = m[k + 1] / d[k];
    const h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[k] = t * a * d[k]; m[k + 1] = t * b * d[k]; }
  }
  let out = 'M ' + P[0].x + ' ' + P[0].y;
  for (let k = 0; k < n - 1; k++) {
    const h = (P[k + 1].x - P[k].x) / 3;
    out += ' C ' + chartR2(P[k].x + h) + ' ' + chartR2(P[k].y + m[k] * h)
      + ' ' + chartR2(P[k + 1].x - h) + ' ' + chartR2(P[k + 1].y - m[k + 1] * h)
      + ' ' + P[k + 1].x + ' ' + P[k + 1].y;
  }
  return out;
}

/** Whole-number percents that sum to exactly 100 (largest remainder). */
function chartPercents(values: number[]): number[] {
  const total = values.reduce((t, v) => t + v, 0) || 1;
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map((v) => Math.floor(v));
  let left = 100 - out.reduce((t, v) => t + v, 0);
  const order = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (let k = 0; k < order.length && left > 0; k++, left--) out[order[k].i]++;
  return out;
}

/** The legend's left edge lines up with the axis labels — the chart's
 *  padding — or with the plot when there are none, which is the same place. */

/** A pie's legend entries before its percents are known — enough to size it. */
function slicesLegendEntries(spec: ChartSpec) {
  return spec.data.map((d) => ({ label: d.label + ' 100%', color: d.color }));
}

/** Legend entries in fixed-width columns, wrapping inside `width`. */
function chartLegend(entries: { label: string; color: string; marker?: string }[], x0: number, y0: number, width: number, m: ChartMetrics) {
  const perRow = Math.max(1, Math.floor(width / m.legendItemWidth));
  const items: LayoutLegendItem[] = entries.map((e, i) => ({
    label: e.label, color: e.color, marker: e.marker,
    x: x0 + (i % perRow) * m.legendItemWidth,
    y: y0 + Math.floor(i / perRow) * m.labelHeight,
  }));
  const rows = entries.length ? Math.ceil(entries.length / perRow) : 0;
  return { items, height: rows * m.labelHeight };
}

/**
 * Lay a chart out. Coordinates are px from the chart frame's top-left. Values
 * map linearly from [axis.min, axis.max] onto [0, plotHeight]; anything
 * outside is clamped and reported, never drawn past the plot.
 */
export function layoutChart(spec: ChartSpec, metrics?: Partial<ChartMetrics>): ChartLayout {
  const m: ChartMetrics = Object.assign(metricsForSize(spec.size), metrics || {});
  const warnings: string[] = [];
  const responsive = spec.width.mode === 'responsive';

  /* ── Pie and donut ─────────────────────────────────────────────────── */
  if (spec.type === 'pie' || spec.type === 'donut') {
    const showPercent = spec.pie.labels === 'percent' || spec.pie.labels === 'both';
    const showLegend = spec.pie.labels === 'legend' || spec.pie.labels === 'both';
    const r = spec.plotHeight / 2;
    /* Room round the pie for its percent labels, which sit labelGap + 4 px
       outside the edge: a label's full width beside it, a label's height
       above and below. Without labels, the padding alone. */
    const reach = m.labelGap + 4;
    const roomX = showPercent ? reach + m.pieLabelRoom : 0;
    const roomY = showPercent ? reach + m.labelHeight : 0;
    const natural = m.padding * 2 + roomX * 2 + r * 2;
    const width = spec.width.px !== null ? Math.max(spec.width.px, natural) : natural;
    const cx = width / 2;
    // A legend on top pushes the pie down by its own height.
    const legendEntries = slicesLegendEntries(spec);
    const topLg = showLegend && spec.legend === 'top' ? chartLegend(legendEntries, m.padding, m.padding, width - m.padding * 2, m) : null;
    const cy = m.padding + (topLg ? topLg.height + m.legendGap : 0) + roomY + r;
    const vals = spec.data.map((d) => Math.max(0, Number(d.value) || 0));
    const total = vals.reduce((t, v) => t + v, 0) || 1;
    const pct = chartPercents(vals);
    let a = 0;
    const slices: LayoutSlice[] = spec.data.map((d, i) => {
      const start = a;
      const end = a + (vals[i] / total) * Math.PI * 2;
      a = end;
      const mid = (start + end) / 2;
      const lr = r + m.labelGap + 4;
      return {
        index: i, label: d.label, value: vals[i], color: d.color, start, end, percent: pct[i],
        labelX: cx + Math.sin(mid) * lr,
        labelY: cy - Math.cos(mid) * lr,
        labelAlign: Math.sin(mid) >= 0 ? 'left' : 'right',
      };
    });
    const legendTop = cy + r + roomY + m.legendGap;
    const entries = slices.map((sl) => ({ label: sl.label + ' ' + sl.percent + '%', color: sl.color }));
    const lg = !showLegend ? { items: [], height: 0 }
      : chartLegend(entries, m.padding, topLg ? m.padding : legendTop, width - m.padding * 2, m);
    return {
      width,
      height: cy + r + roomY + (showLegend && !topLg ? m.legendGap + lg.height : 0) + m.padding,
      responsive,
      plot: { x: cx - r, y: cy - r, width: r * 2, height: r * 2, baseline: cy + r },
      horizontal: false, rowLines: [], connector: null, tickWidth: 0,
      ticks: [], xLines: [], items: [], line: null, lines: [],
      pie: { cx, cy, r, innerR: spec.type === 'donut' ? r * spec.pie.hole : 0, slices },
      legend: lg.items,
      warnings,
    };
  }

  const isStacked = spec.type === 'stacked';
  const range0 = (spec.axis.max - spec.axis.min) || 1;
  /** A row's stack, base first: each series' value scaled, all but the last
   *  piece 1px longer so it tucks under the next. */
  const stackOf = (d: ChartDatum, len: number): LayoutSegment[] => {
    let at = 0;
    const segs: LayoutSegment[] = [];
    const n = spec.series.length;
    spec.series.forEach((sr, k) => {
      const v = Math.max(0, Number(d.values[k]) || 0);
      const want = (v / range0) * len;
      const room = Math.max(0, len - at);
      const l = Math.min(want, room);
      const extra = k < n - 1 && l > 0 ? 1 : 0;
      segs.push({ series: k, name: sr.name, color: sr.color, value: v, start: at, len: l + extra, startFrac: len ? at / len : 0, lenFrac: len ? (l + extra) / len : 0 });
      at += l;
    });
    return segs;
  };
  const stackLegend = isStacked && spec.series.length > 1
    ? spec.series.map((sr) => ({ label: sr.name, color: sr.color })) : [];

  /* ── Horizontal bars ───────────────────────────────────────────────── */
  if (spec.bar.orientation === 'horizontal' && HBAR_FIXED[spec.type]) {
    const H0 = HBAR_FIXED[spec.type];
    const H = spec.type === 'fancy' ? Object.assign({}, H0, { end: m.fancyBubble / 2 }) : H0;
    const thick = typeof H.thick === 'number' ? H.thick : (m as any)[H.thick] as number;
    const labelW = spec.showLabels ? (H.labelW || m.labelWidth) : 0;
    const labelGap = spec.showLabels ? H.labelGap : 0;
    const plotX = m.padding + labelW + labelGap;
    // Room past the longest bar: its end face or bubble, and the horizontal
    // 3dBar's shadow, which reaches ~30px beyond the bar.
    const endRoom = Math.max(H.end, spec.type === 'bar3d' && spec.bar.shadow ? 30 : 0, chartTopperReach(spec, m));
    const naturalW = plotX + spec.plotHeight + endRoom + m.padding;
    const width = spec.width.px !== null ? spec.width.px : naturalW;
    const plotLen = spec.width.px !== null ? Math.max(40, width - plotX - endRoom - m.padding) : spec.plotHeight;
    const legendTop = spec.legend === 'top';
    const lgH0 = chartLegend(stackLegend, m.padding, m.padding, width - m.padding * 2, m);
    const rowsTop = m.padding + (stackLegend.length && legendTop ? lgH0.height + m.legendGap : 0);
    const n = spec.data.length;
    const rowsH = n * thick + Math.max(0, n - 1) * m.gap;
    const axis = spec.axis;
    const scaleX = (v: number) => Math.max(0, Math.min(1, (v - axis.min) / range0)) * plotLen;

    const items: LayoutItem[] = spec.data.map((d, i) => {
      const raw = isStacked ? d.values.reduce((t, v) => t + (Number(v) || 0), 0) : Number(d.value);
      const clamped = raw < axis.min || raw > axis.max;
      if (clamped && !isStacked) warnings.push('"' + d.label + '" is ' + raw + ', outside the axis (' + axis.min + '–' + axis.max + '); drawn at the edge.');
      const len = scaleX(raw);
      const top = rowsTop + i * (thick + m.gap);
      return {
        index: i, label: d.label, value: raw, color: d.color,
        x: plotX, width: len + H.end, centerX: plotX + len, centerFrac: plotLen ? len / plotLen : 0,
        valueHeight: len, valueFrac: plotLen ? len / plotLen : 0,
        frameY: top, frameHeight: thick,
        labelY: top + (thick - m.labelHeight) / 2, labelX: m.padding, labelW, labelAlign: H.align,
        clamped,
        segments: isStacked ? stackOf(d, plotLen) : undefined,
      };
    });
    const axisTop = rowsTop + rowsH + m.axisGap;
    const belowAxis = rowsTop + rowsH + (spec.showAxis ? m.axisGap + m.labelHeight : 0);
    const lgH = legendTop || !stackLegend.length ? lgH0
      : chartLegend(stackLegend, m.padding, belowAxis + m.legendGap, width - m.padding * 2, m);
    const legendBelow = !legendTop && stackLegend.length ? m.legendGap + lgH.height : 0;
    const ticks = chartTicks(axis).map((value) => {
      const x = plotX + scaleX(value);
      return { value, label: formatChartValue(value, axis), y: axisTop, x, frac: plotLen ? (x - plotX) / plotLen : 0 };
    });
    return {
      width,
      height: belowAxis + legendBelow + m.padding,
      responsive, horizontal: true,
      plot: { x: plotX, y: rowsTop, width: plotLen, height: rowsH, baseline: plotX },
      ticks,
      xLines: [],
      rowLines: spec.grid.x ? items.map((it) => ({ y: it.frameY + thick / 2 })) : [],
      connector: chartConnector(spec, items, true),
      tickWidth: chartTickWidth(spec, m),
      items, line: null, lines: [], pie: null,
      legend: lgH.items,
      warnings,
    };
  }

  /* ── Bars and lines ────────────────────────────────────────────────── */
  const axis = spec.axis;
  const n = spec.data.length;
  const isLine = spec.type === 'line';
  const w = chartItemWidth(spec.type, m);
  const fixed0 = BAR_FIXED[spec.type] || BAR_FIXED.bar;
  const fixed = spec.type === 'fancy' ? Object.assign({}, fixed0, { top: m.fancyBubble / 2 }) : fixed0;
  const extra = fixed.top + fixed.bottom;
  const labelGap = fixed.labelGap !== undefined ? fixed.labelGap : m.labelGap;

  const tickWidth = chartTickWidth(spec, m);
  const axisW = spec.showAxis ? tickWidth + m.axisGap : 0;
  const plotX = m.padding + axisW;
  const naturalPlotW = n * w + Math.max(0, n - 1) * m.gap;
  /* The right side mirrors the left — padding plus the value-axis column —
     so the last category's label and a 3D bar's shadow stay inside, and the
     plot sits centered in the frame. */
  const rightPad = plotX;
  const naturalW = plotX + naturalPlotW + rightPad;
  const width = spec.width.px !== null ? spec.width.px : naturalW;
  /* Slots when the width is set or responsive: each category gets an equal
     share and its mark sits centered in it. The natural width keeps the
     component spacing (Sizing-3 between bars). */
  const slotted = responsive || spec.width.px !== null;
  const plotW = slotted ? Math.max(w * n, width - plotX - rightPad) : naturalPlotW;
  const slotW = n ? plotW / n : plotW;

  /* A legend above the plot when there is more than one line. */
  const legendEntries = isLine && spec.series.length > 1
    ? spec.series.map((sr) => ({ label: sr.name, color: sr.color, marker: sr.marker } as { label: string; color: string; marker?: string }))
    : stackLegend;
  const chartW = slotted ? width : naturalW;
  const onTop = spec.legend === 'top';
  const lg0 = chartLegend(legendEntries, m.padding, m.padding, chartW - m.padding * 2, m);
  const legendBlock = legendEntries.length && onTop ? lg0.height + m.legendGap : 0;

  // Headroom so a full-height 3dBar's cap, or a topper, stays inside the padding.
  /* Room above the plot for the top tick label, which is centred on the top
     gridline and so rises half a label above it — and for a 3dBar cap or a
     topper, whichever reaches higher. A full label height, not half, so the
     chart does not start hard against its top edge. */
  const plotTop = m.padding + legendBlock + Math.max(extra, chartTopperReach(spec, m), spec.showAxis ? m.labelHeight : 0);
  const plotH = spec.plotHeight;
  const baseline = plotTop + plotH;

  const range = (axis.max - axis.min) || 1;
  const scale = (v: number) => Math.max(0, Math.min(1, (v - axis.min) / range)) * plotH;
  const centerOf = (i: number) => (slotted ? plotX + slotW * (i + 0.5) : plotX + i * (w + m.gap) + w / 2);

  const items: LayoutItem[] = spec.data.map((d, i) => {
    const raw = isStacked ? d.values.reduce((t, v) => t + (Number(v) || 0), 0) : Number(isLine ? d.values[0] : d.value);
    const clamped = raw < axis.min || raw > axis.max;
    if (clamped && !isLine && !isStacked) warnings.push('"' + d.label + '" is ' + raw + ', outside the axis (' + axis.min + '–' + axis.max + '); drawn at the edge.');
    const valueHeight = scale(raw);
    const frameHeight = valueHeight + extra;
    const cxi = centerOf(i);
    return {
      index: i, label: d.label, value: raw, color: d.color,
      x: cxi - w / 2, width: w, centerX: cxi, centerFrac: plotW ? (cxi - plotX) / plotW : 0,
      valueHeight, valueFrac: plotH ? valueHeight / plotH : 0, frameY: baseline - frameHeight, frameHeight,
      labelY: baseline + labelGap, clamped,
      segments: isStacked ? stackOf(d, plotH) : undefined,
    };
  });

  const lines: LayoutLine[] = isLine ? spec.series.map((sr, k) => {
    const points = spec.data.map((d, i) => {
      const v = Number(d.values[k]);
      if (v < axis.min || v > axis.max) warnings.push('"' + d.label + '" is ' + v + ' for ' + sr.name + ', outside the axis; drawn at the edge.');
      const cxi = centerOf(i);
      return { x: cxi, y: baseline - scale(v), frac: plotW ? (cxi - plotX) / plotW : 0 };
    });
    const path = chartLinePath(points, spec.line.curve);
    const area = points.length > 1
      ? path + ' L ' + chartR2(points[points.length - 1].x) + ' ' + chartR2(baseline) + ' L ' + chartR2(points[0].x) + ' ' + chartR2(baseline) + ' Z'
      : '';
    /* The back edge is the same curve, offset and walked backwards; the
       monotone tangents are symmetric, so reversed points trace it exactly. */
    const depth = m.ribbonDepth;
    const back = points.slice().reverse().map((p) => ({ x: p.x + depth, y: p.y + depth }));
    const ribbon = spec.line.effect === 'ribbon' && points.length > 1
      ? path + ' L ' + chartLinePath(back, spec.line.curve).slice(2) + ' Z'
      : '';
    return { series: k, name: sr.name, color: sr.color, marker: sr.marker, fill: sr.fill, points, path, area, ribbon };
  }) : [];

  const ticks = chartTicks(axis).map((value) => ({
    value, label: formatChartValue(value, axis), y: baseline - scale(value),
  }));
  const xLines = spec.grid.x ? items.map((it) => ({ x: it.centerX, frac: it.centerFrac })) : [];

  const labelsH = spec.showLabels ? labelGap + m.labelHeight : 0;
  // A legend at the bottom sits under the category labels.
  const lg = onTop || !legendEntries.length ? lg0
    : chartLegend(legendEntries, m.padding, baseline + labelsH + m.legendGap, chartW - m.padding * 2, m);
  const legendBelow = !onTop && legendEntries.length ? m.legendGap + lg.height : 0;
  return {
    width: slotted ? width : naturalW,
    height: baseline + labelsH + legendBelow + m.padding,
    responsive, horizontal: false, rowLines: [],
    connector: chartConnector(spec, items, false),
    tickWidth,
    plot: { x: plotX, y: plotTop, width: plotW, height: plotH, baseline },
    ticks, xLines, items,
    line: lines.length ? { points: lines[0].points.map((p) => ({ x: p.x, y: p.y })) } : null,
    lines,
    pie: null,
    legend: lg.items,
    warnings,
  };
}
// </chart-layout>
