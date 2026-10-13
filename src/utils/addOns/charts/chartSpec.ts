/**
 * `chart1` — the spec a chart add-on exports and the Omni Design plugin builds
 * from. It also drives the code the add-on emits, so the Figma build and the
 * code are two renderings of one object rather than two descriptions of a
 * chart that have to be kept in step.
 *
 * What travels is NAMES, never resolved values — `Chart-3`, not a hex — for
 * the same reason as every add-on (see toAddonSpec.ts): the plugin rebinds the
 * name to the importing file's own variable, so one spec lands in each brand.
 *
 * normalizeChartSpec() fills every field and returns findings in the plugins'
 * shape:
 *   refuse  cannot be drawn honestly; the plugin will not build it
 *   warn    drawn, but not as asked (a clamped value, a ragged axis)
 *   note    worth knowing, nothing wrong
 * The studio shows the same findings before export, so a spec the plugin would
 * refuse is never offered for copying.
 *
 * THE BLOCK BETWEEN THE MARKERS IS COPIED VERBATIM into the plugin's code.ts
 * (without `export`). src/__tests__/chartLayoutSync.test.ts guards it.
 */

// <chart-spec>
export const CHART_SPEC_VERSION = 'chart1';

/** The ten series colors: Figma `Chart-Colors` modes, CSS --Chart-N. */
export const CHART_COLORS = [
  'Chart-1', 'Chart-2', 'Chart-3', 'Chart-4', 'Chart-5',
  'Chart-6', 'Chart-7', 'Chart-8', 'Chart-9', 'Chart-10',
];

/** A chart is drawn on one of two grounds only (docs/chart-colors.md):
 *  light = Surface-Brightest (Figma Chart mode Chart-Light-BG),
 *  dark  = Surface-Dimmest   (Chart-DarkBG). */
export const CHART_GROUNDS = ['light', 'dark'];
export const CHART_TYPES = ['bar', 'bar3d', 'bar3dWide', 'line'];
/** Figma `Component-Size` modes. The data-viz sizes (Bar-Width, Label Width)
 *  differ per mode, so the chart carries which one it was laid out in. */
export const CHART_SIZES = ['small', 'medium', 'large'];
export const CHART_MARKERS = ['dot', 'square', 'none'];
export const CHART_LINE_FILLS = ['none', 'solid', 'gradient'];
export const CHART_BAR_FILLS = ['solid', 'gradient'];

export type ChartLevel = 'refuse' | 'warn' | 'note';
export interface ChartFinding { level: ChartLevel; title: string; detail: string; fix?: string }

export interface ChartDatum { label: string; value: number; color: string }

export interface ChartSpec {
  version: string;
  name: string;
  designSystem: { id: string | null; name: string | null };
  type: 'bar' | 'bar3d' | 'bar3dWide' | 'line';
  ground: 'light' | 'dark';
  size: 'small' | 'medium' | 'large';
  plotHeight: number;
  axis: { min: number; max: number; step: number; prefix: string; suffix: string };
  showAxis: boolean;
  showGrid: boolean;
  showLabels: boolean;
  data: ChartDatum[];
  line: { color: string; marker: 'dot' | 'square' | 'none'; fill: 'none' | 'solid' | 'gradient'; thickness: number };
  bar: { fill: 'solid' | 'gradient'; outline: boolean };
}

const CHART_MAX_ITEMS = 40;
const CHART_MAX_TICKS = 40;

function chartNum(v: any, d: number): number {
  return v === '' || v === null || v === undefined || !isFinite(Number(v)) ? d : Number(v);
}
function chartPick(v: any, list: string[], d: string): any {
  return list.indexOf(v) !== -1 ? v : d;
}
function chartBool(v: any, d: boolean): boolean {
  return typeof v === 'boolean' ? v : d;
}

/** A spec with every field present. Pure; never throws. */
export function chartSpecWithDefaults(raw: any): ChartSpec {
  const r = raw && typeof raw === 'object' ? raw : {};
  const axis = r.axis && typeof r.axis === 'object' ? r.axis : {};
  const line = r.line && typeof r.line === 'object' ? r.line : {};
  const bar = r.bar && typeof r.bar === 'object' ? r.bar : {};
  const ds = r.designSystem && typeof r.designSystem === 'object' ? r.designSystem : {};
  const data: any[] = Array.isArray(r.data) ? r.data : [];
  return {
    version: r.version,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : 'Chart',
    designSystem: {
      id: typeof ds.id === 'string' ? ds.id : null,
      name: typeof ds.name === 'string' && ds.name.trim() ? ds.name.trim() : null,
    },
    type: r.type,
    ground: chartPick(r.ground, CHART_GROUNDS, 'light'),
    size: chartPick(r.size, CHART_SIZES, 'large'),
    plotHeight: chartNum(r.plotHeight, 160),
    axis: {
      min: chartNum(axis.min, 0),
      max: chartNum(axis.max, 100),
      step: chartNum(axis.step, 25),
      prefix: typeof axis.prefix === 'string' ? axis.prefix.slice(0, 4) : '',
      suffix: typeof axis.suffix === 'string' ? axis.suffix.slice(0, 4) : '',
    },
    showAxis: chartBool(r.showAxis, true),
    showGrid: chartBool(r.showGrid, true),
    showLabels: chartBool(r.showLabels, true),
    data: data.map((d, i) => ({
      label: d && d.label !== undefined && d.label !== null ? String(d.label).slice(0, 24) : String(i + 1),
      value: d ? d.value : undefined,
      color: d && typeof d.color === 'string' ? d.color : CHART_COLORS[i % CHART_COLORS.length],
    })),
    line: {
      color: typeof line.color === 'string' ? line.color : 'Chart-1',
      marker: chartPick(line.marker, CHART_MARKERS, 'dot'),
      fill: chartPick(line.fill, CHART_LINE_FILLS, 'gradient'),
      thickness: chartNum(line.thickness, 2),
    },
    bar: {
      fill: chartPick(bar.fill, CHART_BAR_FILLS, 'solid'),
      outline: chartBool(bar.outline, true),
    },
  };
}

/** Normalize and check a spec. */
export function normalizeChartSpec(raw: any): { spec: ChartSpec; findings: ChartFinding[] } {
  const spec = chartSpecWithDefaults(raw);
  const f: ChartFinding[] = [];
  const a = spec.axis;

  if (spec.version !== CHART_SPEC_VERSION) {
    f.push({
      level: 'refuse',
      title: spec.version ? 'This is a "' + spec.version + '" spec' : 'No spec version',
      detail: 'The chart builder reads "' + CHART_SPEC_VERSION + '" specs.',
      fix: 'Copy the spec again from the Charts add-on in the studio.',
    });
  }
  if (CHART_TYPES.indexOf(spec.type) === -1) {
    f.push({
      level: 'refuse', title: 'Unknown chart type',
      detail: '"' + spec.type + '" is not one of ' + CHART_TYPES.join(', ') + '.',
      fix: 'Pick a chart type and export again.',
    });
  }
  if (!spec.data.length) {
    f.push({ level: 'refuse', title: 'No data', detail: 'A chart needs at least one value.', fix: 'Add a row.' });
  }
  if (spec.data.length > CHART_MAX_ITEMS) {
    f.push({
      level: 'refuse', title: spec.data.length + ' items is more than ' + CHART_MAX_ITEMS,
      detail: 'Past this the labels collide and the bars stop being readable at any width.',
      fix: 'Group the data, or split it across charts.',
    });
  }
  if (!(a.max > a.min)) {
    f.push({
      level: 'refuse', title: 'The axis has no range',
      detail: 'Max (' + a.max + ') has to be greater than min (' + a.min + ').',
      fix: 'Set the axis min and max.',
    });
  }
  if (!(a.step > 0)) {
    f.push({ level: 'refuse', title: 'The axis step is not positive', detail: 'Step is ' + a.step + '.', fix: 'Use a step greater than 0.' });
  } else if (a.max > a.min && (a.max - a.min) / a.step > CHART_MAX_TICKS) {
    f.push({
      level: 'refuse', title: 'Too many gridlines',
      detail: (Math.floor((a.max - a.min) / a.step) + 1) + ' ticks at a step of ' + a.step + '.',
      fix: 'Use a larger step.',
    });
  } else if (a.max > a.min) {
    const span = (a.max - a.min) / a.step;
    if (Math.abs(span - Math.round(span)) > 1e-6) {
      f.push({
        level: 'warn', title: 'The step does not land on the max',
        detail: 'From ' + a.min + ' by ' + a.step + ' never reaches ' + a.max + ', so the top of the plot has no gridline.',
        fix: 'Pick a step that divides the range evenly.',
      });
    }
  }
  if (spec.plotHeight < 40 || spec.plotHeight > 1200) {
    f.push({
      level: 'refuse', title: 'Plot height out of range',
      detail: spec.plotHeight + 'px; charts are drawn between 40 and 1200.',
      fix: 'Set a height in that range.',
    });
  }

  spec.data.forEach((d, i) => {
    if (d.value === null || (d.value as any) === '' || !isFinite(Number(d.value))) {
      f.push({
        level: 'refuse', title: 'Row ' + (i + 1) + ' has no number',
        detail: '"' + d.label + '" has value ' + JSON.stringify(d.value) + '.',
        fix: 'Enter a number, or remove the row.',
      });
    }
    if (CHART_COLORS.indexOf(d.color) === -1) {
      f.push({
        level: 'refuse', title: 'Row ' + (i + 1) + ' has an unknown color',
        detail: '"' + d.color + '" is not a Chart-Colors mode.',
        fix: 'Use one of ' + CHART_COLORS[0] + '–' + CHART_COLORS[CHART_COLORS.length - 1] + '.',
      });
    }
  });

  if (spec.type === 'line') {
    if (spec.data.length === 1) {
      f.push({ level: 'warn', title: 'One point is not a line', detail: 'The chart will show a single marker.' });
    }
    if (CHART_COLORS.indexOf(spec.line.color) === -1) {
      f.push({ level: 'refuse', title: 'Unknown line color', detail: '"' + spec.line.color + '" is not a Chart-Colors mode.' });
    }
    if (spec.line.marker === 'none' && spec.line.fill === 'none' && spec.line.thickness < 2) {
      f.push({
        level: 'warn', title: 'A thin line with no markers',
        detail: 'A 1px line is the only mark carrying the data, and it is hard to see at 3:1.',
        fix: 'Use 2px or more, or show markers.',
      });
    }
  }

  if (spec.type !== 'line' && spec.data.length > CHART_COLORS.length) {
    const seen: { [k: string]: number } = {};
    spec.data.forEach((d) => { seen[d.color] = (seen[d.color] || 0) + 1; });
    if (Object.keys(seen).some((k) => seen[k] > 1)) {
      f.push({
        level: 'note', title: 'Colors repeat',
        detail: 'There are more bars than series colors, so some share a color. The labels carry the identity.',
      });
    }
  }

  return { spec, findings: f };
}

/** The worst level among findings, or null. */
export function worstChartLevel(findings: ChartFinding[]): ChartLevel | null {
  if (findings.some((x) => x.level === 'refuse')) return 'refuse';
  if (findings.some((x) => x.level === 'warn')) return 'warn';
  if (findings.some((x) => x.level === 'note')) return 'note';
  return null;
}
// </chart-spec>

/** Parse pasted text. Studio-only: the plugin receives an object. */
export function parseChartSpecText(text: string): unknown {
  const t = String(text || '').trim();
  if (!t) throw new Error('Paste a spec first.');
  if (t[0] !== '{') throw new Error('This is not a chart spec. Copy it from the Charts add-on.');
  try {
    return JSON.parse(t);
  } catch {
    throw new Error('The spec is not valid JSON — it may have been cut off when copying.');
  }
}
