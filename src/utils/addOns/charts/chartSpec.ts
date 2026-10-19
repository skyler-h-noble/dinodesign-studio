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
/** The state colors, for data that MEANS a state (on track, at risk, over).
 *  Figma: Chart/Colors/Info … /Error, the ground's Icons-{State}. Never
 *  assigned automatically — the ten above are the categorical set. */
export const CHART_STATE_COLORS = ['Info', 'Success', 'Warning', 'Error'];
/** Every color a mark may take. */
export const CHART_ALL_COLORS = CHART_COLORS.concat(CHART_STATE_COLORS);

/** A chart is drawn on one of two grounds only (docs/chart-colors.md):
 *  light = Surface-Brightest (Figma Chart mode Chart-Light-BG),
 *  dark  = Surface-Dimmest   (Chart-DarkBG). */
export const CHART_GROUNDS = ['light', 'dark'];
/** fancy = FancyBar (track, grooved fill, value bubble); stacked = StackedBar,
 *  one segment per series. Both, and every bar, come vertical or horizontal. */
export const CHART_TYPES = ['bar', 'bar3d', 'bar3dWide', 'fancy', 'stacked', 'line', 'pie', 'donut'];
/** Figma `Component-Size` modes. The data-viz sizes (Bar-Width, Label Width)
 *  differ per mode, so the chart carries which one it was laid out in. */
export const CHART_SIZES = ['small', 'medium', 'large'];
/** dot = a solid circle; disc = a ring round a Chart-Background center. */
export const CHART_MARKERS = ['dot', 'disc', 'square', 'triangle', 'none'];
/** 3D treatment of a line: flat, a soft drop shadow, or a ribbon with depth. */
export const CHART_LINE_EFFECTS = ['flat', 'shadow', 'ribbon'];
export const CHART_LINE_FILLS = ['none', 'solid', 'gradient'];
export const CHART_BAR_FILLS = ['solid', 'gradient'];
/** Bars stand up or lie along the value axis. Horizontal waits on the Figma
 *  variants so its geometry is read from them, not guessed; until then it is
 *  accepted, noted, and drawn vertical. */
export const CHART_ORIENTATIONS = ['vertical', 'horizontal'];
/** smooth = monotone cubic: it never overshoots the data, so a curve cannot
 *  dip below zero or peak above a value the data does not have. */
export const CHART_CURVES = ['straight', 'smooth'];
export const CHART_SLICE_LABELS = ['none', 'percent', 'legend', 'both'];
/** fixed = the chart's own width (or `width.px`); responsive = categories are
 *  equal slots that stretch with the container, in code and in Figma. */
export const CHART_WIDTHS = ['fixed', 'responsive'];

export type ChartLevel = 'refuse' | 'warn' | 'note';
export interface ChartFinding { level: ChartLevel; title: string; detail: string; fix?: string }

/** One category. Bars and slices read `value`; lines read `values`, one per
 *  series, in series order. */
export interface ChartDatum { label: string; value: number; color: string; values: number[] }
/** One line. Marker and fill are per line, so lines can be told apart by
 *  shape as well as color; `line.marker` / `line.fill` are only the defaults. */
export interface ChartSeries { name: string; color: string; marker: 'dot' | 'disc' | 'square' | 'triangle' | 'none'; fill: 'none' | 'solid' | 'gradient' }

export interface ChartSpec {
  version: string;
  name: string;
  designSystem: { id: string | null; name: string | null };
  type: 'bar' | 'bar3d' | 'bar3dWide' | 'fancy' | 'stacked' | 'line' | 'pie' | 'donut';
  ground: 'light' | 'dark';
  /** Light or dark MODE — which version of the palette. Sets the studio
   *  preview and the Figma frame's .Modes; exported code follows the page it
   *  is placed in. Distinct from ground, the chart's own background. */
  mode: 'light' | 'dark';
  size: 'small' | 'medium' | 'large';
  plotHeight: number;
  width: { mode: 'fixed' | 'responsive'; px: number | null };
  axis: { min: number; max: number; step: number; prefix: string; suffix: string };
  showAxis: boolean;
  /** Horizontal rules at each value tick (y) and vertical ones at each category (x). */
  grid: { y: boolean; x: boolean };
  /** Kept as an alias of grid.y so specs written before the split still read. */
  showGrid: boolean;
  showLabels: boolean;
  /** The exported chart carries a "Show as table" checkbox under its title. */
  /** Where the legend (key) sits: above the plot or below it. */
  legend: 'top' | 'bottom';
  /** The chart's name as a title above it. */
  showTitle: boolean;
  /** A "Show as table" link under the chart that opens the data table in
   *  place (a disclosure). Without it the table is still there, hidden, for
   *  screen readers. */
  tableLink: boolean;
  /** Motion in code (Figma is static): bars grow from their baseline, lines
   *  draw, a pie opens — on load, or when the chart scrolls into view. Off for
   *  anyone who asks their system for reduced motion. */
  animate: 'none' | 'load' | 'scroll';
  /** Drawn as a Card: the chart's ground with the card radius, a
   *  Border-Variant edge and the Card's resting shadow (Effect-Level-1). */
  card: boolean;
  data: ChartDatum[];
  series: ChartSeries[];
  line: { color: string; marker: 'dot' | 'disc' | 'square' | 'triangle' | 'none'; effect: 'flat' | 'shadow' | 'ribbon'; fill: 'none' | 'solid' | 'gradient'; thickness: number; curve: 'straight' | 'smooth' };
  /** topper: the Bar's BarDecoration — a ring cap on the bar's end.
   *  track: the Bar's Opaque Background — a 20-Fill pill the full length of the plot.
   *  connect: a line through the toppers' centers, straight or curved. */
  bar: { fill: 'solid' | 'gradient'; outline: boolean; orientation: 'vertical' | 'horizontal'; shadow: boolean; topper: boolean; track: boolean; connect: 'none' | 'straight' | 'smooth' };
  /** shadow: the 3D look — a drop shadow under the whole pie, and on a donut
   *  an inner shadow in the hole too. */
  pie: { labels: 'none' | 'percent' | 'legend' | 'both'; hole: number; shadow: boolean };
}

const CHART_MAX_ITEMS = 40;
const CHART_MAX_TICKS = 40;
const CHART_MAX_SERIES = 10;

function chartNum(v: any, d: number): number {
  return v === '' || v === null || v === undefined || !isFinite(Number(v)) ? d : Number(v);
}
function chartPick(v: any, list: string[], d: string): any {
  return list.indexOf(v) !== -1 ? v : d;
}
function chartBool(v: any, d: boolean): boolean {
  return typeof v === 'boolean' ? v : d;
}
function chartIsNumber(v: any): boolean {
  return v !== null && v !== undefined && v !== '' && isFinite(Number(v));
}

/** A spec with every field present. Pure; never throws. */
export function chartSpecWithDefaults(raw: any): ChartSpec {
  const r = raw && typeof raw === 'object' ? raw : {};
  const axis = r.axis && typeof r.axis === 'object' ? r.axis : {};
  const line = r.line && typeof r.line === 'object' ? r.line : {};
  const bar = r.bar && typeof r.bar === 'object' ? r.bar : {};
  const pie = r.pie && typeof r.pie === 'object' ? r.pie : {};
  const grid = r.grid && typeof r.grid === 'object' ? r.grid : {};
  const width = r.width && typeof r.width === 'object' ? r.width : {};
  const ds = r.designSystem && typeof r.designSystem === 'object' ? r.designSystem : {};
  const data: any[] = Array.isArray(r.data) ? r.data : [];
  const lineColor = typeof line.color === 'string' ? line.color : 'Chart-1';
  /* Series: given, or the one implied by a spec written before lines could
     have several — named after the chart, in the line color. */
  const seriesRaw: any[] = Array.isArray(r.series) && r.series.length ? r.series : [{ name: r.name || 'Series 1', color: lineColor }];
  const series: ChartSeries[] = seriesRaw.map((x, i) => ({
    name: x && typeof x.name === 'string' && x.name.trim() ? x.name.trim().slice(0, 24) : 'Series ' + (i + 1),
    color: x && typeof x.color === 'string' ? x.color : CHART_COLORS[i % CHART_COLORS.length],
    marker: chartPick(x && x.marker, CHART_MARKERS, chartPick(line.marker, CHART_MARKERS, 'dot')),
    fill: chartPick(x && x.fill, CHART_LINE_FILLS, chartPick(line.fill, CHART_LINE_FILLS, 'gradient')),
  }));
  const gridY = typeof grid.y === 'boolean' ? grid.y : chartBool(r.showGrid, true);
  return {
    version: r.version,
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : 'Chart',
    designSystem: {
      id: typeof ds.id === 'string' ? ds.id : null,
      name: typeof ds.name === 'string' && ds.name.trim() ? ds.name.trim() : null,
    },
    type: r.type,
    ground: chartPick(r.ground, CHART_GROUNDS, 'light'),
    mode: chartPick(r.mode, CHART_GROUNDS, 'light'),
    size: chartPick(r.size, CHART_SIZES, 'large'),
    plotHeight: chartNum(r.plotHeight, 160),
    width: {
      mode: chartPick(width.mode, CHART_WIDTHS, 'fixed'),
      px: chartIsNumber(width.px) ? Number(width.px) : null,
    },
    axis: {
      min: chartNum(axis.min, 0),
      max: chartNum(axis.max, 100),
      step: chartNum(axis.step, 25),
      prefix: typeof axis.prefix === 'string' ? axis.prefix.slice(0, 4) : '',
      suffix: typeof axis.suffix === 'string' ? axis.suffix.slice(0, 4) : '',
    },
    showAxis: chartBool(r.showAxis, true),
    grid: { y: gridY, x: chartBool(grid.x, false) },
    showGrid: gridY,
    showLabels: chartBool(r.showLabels, true),
    legend: chartPick(r.legend, ['top', 'bottom'], 'top') as 'top' | 'bottom',
    showTitle: chartBool(r.showTitle, false),
    tableLink: chartBool(r.tableLink, false),
    animate: chartPick(r.animate, ['none', 'load', 'scroll'], 'none') as 'none' | 'load' | 'scroll',
    card: chartBool(r.card, false),
    data: data.map((d, i) => {
      const value = d ? d.value : undefined;
      const vals: any[] = d && Array.isArray(d.values) ? d.values : [value];
      return {
        label: d && d.label !== undefined && d.label !== null ? String(d.label).slice(0, 24) : String(i + 1),
        value,
        color: d && typeof d.color === 'string' ? d.color : CHART_COLORS[i % CHART_COLORS.length],
        values: series.map((_, k) => vals[k]),
      };
    }),
    series,
    line: {
      color: series[0] ? series[0].color : lineColor,
      marker: chartPick(line.marker, CHART_MARKERS, 'dot'),
      effect: chartPick(line.effect, CHART_LINE_EFFECTS, 'flat'),
      fill: chartPick(line.fill, CHART_LINE_FILLS, 'gradient'),
      thickness: chartNum(line.thickness, 2),
      curve: chartPick(line.curve, CHART_CURVES, 'straight'),
    },
    bar: {
      fill: chartPick(bar.fill, CHART_BAR_FILLS, 'solid'),
      /* Only a GroupedBar outlines its bars (its bar-base segments have Border
         on); a single Bar and a StackedBar never do. There is no grouped type
         yet, so no chart here draws one — a spec that asks is read as off. */
      outline: false,
      orientation: chartPick(bar.orientation, CHART_ORIENTATIONS, 'vertical'),
      // On by default, as the 3dBar and Wide-3dBar components' Shadow boolean is.
      shadow: chartBool(bar.shadow, true),
      // A StackedBar never wears a BarChartTopper; only a single Bar does.
      topper: r.type === 'bar' && chartBool(bar.topper, false),
      track: chartBool(bar.track, false),
      connect: chartPick(bar.connect, ['none', 'straight', 'smooth'], 'none') as 'none' | 'straight' | 'smooth',
    },
    pie: {
      labels: chartPick(pie.labels, CHART_SLICE_LABELS, 'percent'),
      hole: Math.max(0.3, Math.min(0.85, chartNum(pie.hole, 0.6))),
      // holeShadow is the option's earlier name; specs that carry it keep it.
      shadow: chartBool(pie.shadow, chartBool(pie.holeShadow, false)),
    },
  };
}

/** Normalize and check a spec. */
export function normalizeChartSpec(raw: any): { spec: ChartSpec; findings: ChartFinding[] } {
  const spec = chartSpecWithDefaults(raw);
  const f: ChartFinding[] = [];
  const a = spec.axis;
  const isPie = spec.type === 'pie' || spec.type === 'donut';
  const isLine = spec.type === 'line';
  const isStacked = spec.type === 'stacked';
  // Lines and stacks both carry one value per series per row.
  const isMulti = isLine || isStacked;
  const seriesWord = isLine ? 'line' : 'segment';

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
      detail: 'Past this the labels collide and the marks stop being readable at any width.',
      fix: 'Group the data, or split it across charts.',
    });
  }
  /* The value axis only exists for bars and lines. */
  if (!isPie) {
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
  }
  if (spec.plotHeight < 40 || spec.plotHeight > 1200) {
    f.push({
      level: 'refuse', title: 'Plot height out of range',
      detail: spec.plotHeight + 'px; charts are drawn between 40 and 1200.',
      fix: 'Set a height in that range.',
    });
  }
  if (spec.width.px !== null && (spec.width.px < 120 || spec.width.px > 4000)) {
    f.push({
      level: 'refuse', title: 'Width out of range',
      detail: spec.width.px + 'px; a fixed width is between 120 and 4000.',
      fix: 'Set a width in that range, or leave it empty for the chart\'s natural width.',
    });
  }

  spec.data.forEach((d, i) => {
    if (isMulti) {
      d.values.forEach((v, k) => {
        if (!chartIsNumber(v)) {
          f.push({
            level: 'refuse', title: 'Row ' + (i + 1) + ' has no number for ' + spec.series[k].name,
            detail: '"' + d.label + '" has ' + JSON.stringify(v) + ' for that ' + seriesWord + '.',
            fix: 'Enter a number, or remove the row.',
          });
        } else if (isStacked && Number(v) < 0) {
          f.push({
            level: 'refuse', title: 'Row ' + (i + 1) + ' is negative for ' + spec.series[k].name,
            detail: 'A stack adds its segments up; a negative one has nowhere to go.',
            fix: 'Use grouped bars or a line for values that can be negative.',
          });
        }
      });
      if (isStacked) {
        const total = d.values.reduce((t, v) => t + (chartIsNumber(v) ? Number(v) : 0), 0);
        if (total > spec.axis.max) {
          f.push({
            level: 'warn', title: '"' + d.label + '" adds up past the axis',
            detail: 'Its segments total ' + total + '; the axis stops at ' + spec.axis.max + ', so the stack is cut off there.',
            fix: 'Raise the axis maximum to at least ' + total + '.',
          });
        }
      }
    } else {
      if (!chartIsNumber(d.value)) {
        f.push({
          level: 'refuse', title: 'Row ' + (i + 1) + ' has no number',
          detail: '"' + d.label + '" has value ' + JSON.stringify(d.value) + '.',
          fix: 'Enter a number, or remove the row.',
        });
      } else if (isPie && Number(d.value) < 0) {
        f.push({
          level: 'refuse', title: 'Row ' + (i + 1) + ' is negative',
          detail: 'A slice is a share of a whole; "' + d.label + '" is ' + d.value + '.',
          fix: 'Use a bar chart for values that can be negative.',
        });
      }
      if (CHART_ALL_COLORS.indexOf(d.color) === -1) {
        f.push({
          level: 'refuse', title: 'Row ' + (i + 1) + ' has an unknown color',
          detail: '"' + d.color + '" is not a Chart-Colors mode.',
          fix: 'Use one of ' + CHART_COLORS[0] + '–' + CHART_COLORS[CHART_COLORS.length - 1] + ', or ' + CHART_STATE_COLORS.join(', ') + '.',
        });
      }
    }
  });

  if (isMulti) {
    if (spec.series.length > CHART_MAX_SERIES) {
      f.push({ level: 'refuse', title: 'More than ' + CHART_MAX_SERIES + ' ' + seriesWord + 's', detail: 'There are ten series colors.', fix: 'Split them across charts.' });
    }
    spec.series.forEach((s, k) => {
      if (CHART_ALL_COLORS.indexOf(s.color) === -1) {
        f.push({ level: 'refuse', title: (isLine ? 'Line ' : 'Segment ') + (k + 1) + ' has an unknown color', detail: '"' + s.color + '" is not a Chart-Colors mode.' });
      }
    });
  }

  if (isLine) {
    if (spec.data.length === 1) {
      f.push({ level: 'warn', title: 'One point is not a line', detail: 'The chart will show a single marker per series.' });
    }
    if (spec.line.thickness < 2 && spec.series.some((sr) => sr.marker === 'none' && sr.fill === 'none')) {
      f.push({
        level: 'warn', title: 'A thin line with no markers',
        detail: 'A 1px line is the only mark carrying the data, and it is hard to see at 3:1.',
        fix: 'Use 2px or more, or show markers.',
      });
    }
    if (spec.series.filter((sr) => sr.fill !== 'none').length > 1) {
      f.push({
        level: 'note', title: 'Fills overlap',
        detail: 'With several lines, each fill sits over the ones before it; later lines tint earlier ones.',
        fix: 'Fill one line, or none.',
      });
    }
    const marks = spec.series.map((sr) => sr.marker).filter((mk) => mk !== 'none');
    if (new Set(marks).size < marks.length) {
      f.push({
        level: 'note', title: 'Lines share a marker',
        detail: 'A different marker on each line lets people who cannot tell the colors apart follow them.',
        fix: 'Give each line its own marker: circle, disc, square or triangle.',
      });
    }
  }

  if (isPie) {
    const total = spec.data.reduce((t, d) => t + (chartIsNumber(d.value) && Number(d.value) > 0 ? Number(d.value) : 0), 0);
    if (spec.data.length && !(total > 0)) {
      f.push({ level: 'refuse', title: 'Nothing to divide', detail: 'Every slice is zero, so there is no whole.', fix: 'Enter at least one positive value.' });
    }
    /* One slice per series color. Past ten a color would have to repeat, and
       two slices in one color read as one. */
    if (spec.data.length > CHART_COLORS.length) {
      f.push({
        level: 'refuse', title: 'More than ' + CHART_COLORS.length + ' slices',
        detail: 'A pie has one slice per chart color, and there are ' + CHART_COLORS.length + '.',
        fix: 'Group the smallest slices into "Other", or use a bar chart.',
      });
    } else if (spec.data.length > 8) {
      f.push({
        level: 'note', title: spec.data.length + ' slices',
        detail: 'Past about eight, thin slices are hard to compare; a bar chart reads more precisely.',
      });
    }
    const used: { [k: string]: boolean } = {};
    if (spec.data.some((d) => { const dup = used[d.color]; used[d.color] = true; return dup; })) {
      f.push({
        level: 'warn', title: 'Slices share a color',
        detail: 'Two slices in one color read as one slice.',
        fix: 'Give each slice its own color.',
      });
    }
  }

  if (!isMulti && !isPie && spec.data.length > CHART_COLORS.length) {
    const seen: { [k: string]: number } = {};
    spec.data.forEach((d) => { seen[d.color] = (seen[d.color] || 0) + 1; });
    if (Object.keys(seen).some((k) => seen[k] > 1)) {
      f.push({
        level: 'note', title: 'Colors repeat',
        detail: 'There are more items than series colors, so some share a color. The labels carry the identity.',
      });
    }
  }

  /* The state four are tuned against the brand palette, not against the
     categorical ten; mixed in one chart, most of the near-collisions are
     between the two sets. */
  const colorsUsed = isMulti ? spec.series.map((sr) => sr.color) : spec.data.map((d) => d.color);
  if (colorsUsed.some((c) => CHART_STATE_COLORS.indexOf(c) !== -1) && colorsUsed.some((c) => CHART_COLORS.indexOf(c) !== -1)) {
    f.push({
      level: 'note', title: 'State and series colors mixed',
      detail: 'Info, Success, Warning and Error say what a value means. Next to the series colors some are close, and the state reads as just another category.',
      fix: 'Use state colors for every mark, or none.',
    });
  }

  if (spec.type === 'fancy') {
    // The bubble's inner disc is 32px; the number is 16px bold.
    const longest = spec.data.reduce((w, d) => Math.max(w, String(d.value).length), 0);
    if (longest > 3) {
      f.push({
        level: 'warn', title: 'Values too long for the bubble',
        detail: 'A FancyBar shows its value in a 32px circle, which fits about three characters.',
        fix: 'Round the values, or show them in a different unit (k, %).',
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
