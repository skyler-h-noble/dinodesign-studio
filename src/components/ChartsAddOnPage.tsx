/**
 * Charts add-on — spin up a one-off chart in a design system, then take it
 * away as code AND as a Figma build that look the same.
 *
 * One spec (chart1) drives both. layoutChart() turns it into numbers;
 * chartCode.ts turns the numbers into HTML + CSS; the Omni Design plugin turns
 * the same numbers into instances of the file's own Bar / 3dBar / Wide-3dBar
 * components. Nothing here draws a chart a second way.
 *
 * The PREVIEW IS THE EXPORTED CODE, injected as-is. That is the one place this
 * page renders markup that is not a lib component, and it is deliberate: a
 * preview drawn with components would be a third rendering, and the
 * comparison that matters is between the code a user ships and the Figma
 * build. (Same exception as PhonePreview — the shell shows an artifact.)
 *
 * The design system is the one in the URL — typed by the user, or passed by a
 * link from their design system's code or the Figma plugin (/add-ons/charts/:id
 * or ?ds=:id). The page never LISTS systems: an id is the user's to give. Its CSS is generated LIVE from its tokens.json (liveSystemCss)
 * rather than taken as last published — a system published before the chart
 * palette reached the CSS export would otherwise paint the old --Chart-N, and
 * the chart would show colors that exist nowhere in its Figma file.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  H1, H3, Body, BodySmall, Caption, Button, Card, VStack, HStack, Divider, Alert,
  Tabs, TabList, Tab, TabPanel, Link, Modal, Section, Checkbox, TextField, TextArea, DropZone, NumberField, Select, SwitchInput, CodeBlock, ButtonGroup, Label,
  OmniDesignProvider,
} from '@omni-design/components';
import AddOnTopNav, { ADD_ON_NAV_HEIGHT } from './addOns/AddOnTopNav';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { systemExists } from '../utils/docs/systemCss';
import { liveSystemCss, type LiveSystemCss } from '../utils/addOns/charts/liveSystemCss';
import { CHART_COLOR_VISION, type ColorVision } from '../utils/chartColorVision';
import {
  normalizeChartSpec, worstChartLevel, CHART_COLORS, CHART_STATE_COLORS, CHART_ALL_COLORS, CHART_SPEC_VERSION,
  type ChartFinding,
} from '../utils/addOns/charts/chartSpec';
import { layoutChart, metricsForSize, type ChartMetrics } from '../utils/addOns/charts/chartLayout';
import { chartHTML, chartCSS, chartScript, CSS_GAPS } from '../utils/addOns/charts/chartCode';
import { encodeChartSpec, extractChartSpec } from '../utils/addOns/charts/chartShare';
import { parseGrid, tableFromGrid, niceAxis } from '../utils/addOns/charts/chartData';

/** One category. `values` holds one entry per line; bars and slices read
 *  the first. */
type Row = { label: string; values: string[]; color: string };
type Series = { name: string; color: string; marker: string; fill: string };

const TYPE_OPTIONS = [
  { label: 'Bar', value: 'bar' },
  { label: '3D bar', value: 'bar3d' },
  { label: 'Wide 3D bar', value: 'bar3dWide' },
  { label: 'Fancy bar', value: 'fancy' },
  { label: 'Stacked bar', value: 'stacked' },
  { label: 'Line', value: 'line' },
  { label: 'Pie', value: 'pie' },
  { label: 'Donut', value: 'donut' },
];
const SIZE_OPTIONS = [
  { label: 'Large', value: 'large' },
  { label: 'Medium', value: 'medium' },
  { label: 'Small', value: 'small' },
];
/* --Chart-N is defined per chart ground (data-surface Surface-Brightest /
   Surface-Dimmest), not on the page, so a swatch reading var(--Chart-N) out
   here gets the lib's old base values. The swatches take the colors the
   rendered chart actually resolves; var() is only the first-paint stand-in. */
const colorOptions = (resolved: { [k: string]: string }) =>
  CHART_ALL_COLORS.map((c) => ({ label: c, value: c, color: resolved[c] || `var(--${chartColorToken(c)})` }));
/** The custom property a color reads: --Chart-N, or --Chart-{State}. */
const chartColorToken = (c: string) => (CHART_STATE_COLORS.indexOf(c) !== -1 ? `Chart-${c}` : c);
const MARKER_OPTIONS = [
  { label: 'Circle', value: 'dot' }, { label: 'Disc (ring)', value: 'disc' }, { label: 'Square', value: 'square' },
  { label: 'Triangle', value: 'triangle' }, { label: 'None', value: 'none' },
];
/* The order new lines take markers in, so each line starts with its own shape. */
const MARKER_ORDER = ['dot', 'square', 'triangle', 'disc'];
const EFFECT_OPTIONS = [
  { label: 'Flat', value: 'flat' }, { label: 'Shadow', value: 'shadow' }, { label: 'Ribbon (3D)', value: 'ribbon' },
];
const SLICE_LABEL_OPTIONS = [
  { label: 'Percent', value: 'percent' }, { label: 'Legend', value: 'legend' },
  { label: 'Percent and legend', value: 'both' }, { label: 'None', value: 'none' },
];
const LINE_FILL_OPTIONS = [
  { label: 'Gradient', value: 'gradient' }, { label: 'Solid', value: 'solid' }, { label: 'None', value: 'none' },
];

const START_ROWS: Row[] = [
  { label: 'Jan', values: ['40', '20'], color: 'Chart-1' },
  { label: 'Feb', values: ['65', '35'], color: 'Chart-2' },
  { label: 'Mar', values: ['30', '50'], color: 'Chart-3' },
  { label: 'Apr', values: ['85', '45'], color: 'Chart-4' },
  { label: 'May', values: ['55', '70'], color: 'Chart-5' },
];

/** A custom property as px, or undefined when the system does not define it. */
function readPx(style: CSSStyleDeclaration, name: string): number | undefined {
  const v = parseFloat(style.getPropertyValue(name));
  return Number.isFinite(v) ? v : undefined;
}

/** The sizes the layout needs, from the loaded system where it defines them.
 *  Bar-Width and Label Width are not in the CSS export, so they stay on the
 *  Component-Size fallbacks (which are the Figma values). */
function readMetrics(el: Element | null, size: string): Partial<ChartMetrics> {
  if (!el) return {};
  const s = getComputedStyle(el);
  const m: Partial<ChartMetrics> = {};
  const set = (k: keyof ChartMetrics, name: string) => { const v = readPx(s, name); if (v !== undefined) m[k] = v; };
  set('padding', '--Sizing-2');
  set('gap', '--Sizing-3');
  set('labelGap', '--Sizing-1');
  set('axisGap', '--Sizing-1');
  set('faceWidth', '--Sizing-1-and-Half');
  set('wideSide', '--Sizing-Half');
  return { ...metricsForSize(size), ...m };
}

function FindingList({ findings }: { findings: ChartFinding[] }) {
  if (!findings.length) return null;
  const order = { refuse: 0, warn: 1, note: 2 } as const;
  return (
    <VStack spacing={1}>
      {[...findings].sort((a, b) => order[a.level] - order[b.level]).map((f, i) => (
        <Alert key={i} color={f.level === 'refuse' ? 'error' : f.level === 'warn' ? 'warning' : 'info'}>
          <BodySmall><strong>{f.title}.</strong> {f.detail}{f.fix ? ` ${f.fix}` : ''}</BodySmall>
        </Alert>
      ))}
    </VStack>
  );
}

export default function ChartsAddOnPage() {
  const { uuid } = useParams<{ uuid?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exists, setExists] = useState<boolean | null>(null);
  const [systemCss, setSystemCss] = useState<LiveSystemCss | null>(null);

  /* A link may pass the id as ?ds= (what the portfolio apps use); move it
     into the path so there is one place it lives. */
  useEffect(() => {
    const ds = searchParams.get('ds');
    if (!uuid && ds && /^[0-9a-f-]{36}$/i.test(ds)) navigate(`/add-ons/charts/${ds.toLowerCase()}`, { replace: true });
  }, [uuid, searchParams, navigate]);

  useEffect(() => {
    if (!uuid) { setSystemCss(null); return; }
    let live = true;
    setSystemCss(null);
    liveSystemCss(uuid).then((c) => { if (live) setSystemCss(c); });
    return () => { live = false; };
  }, [uuid]);

  const [name, setName] = useState('Monthly totals');
  const [type, setType] = useState('bar3d');
  const [ground, setGround] = useState('light');
  /* Preview a color-vision set: data-color-vision on the preview swaps every
     --Chart-N and --Chart-{State} for that set (chartColorVision.ts). */
  const [vision, setVision] = useState<'none' | ColorVision>('none');
  const [mode, setMode] = useState('light');
  const [size, setSize] = useState('large');
  const [plotHeight, setPlotHeight] = useState(160);
  const [axis, setAxis] = useState({ min: 0, max: 100, step: 25, prefix: '', suffix: '' });
  const [showAxis, setShowAxis] = useState(true);
  const [gridY, setGridY] = useState(true);
  const [gridX, setGridX] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [tableLink, setTableLink] = useState(false);
  const [dataModal, setDataModal] = useState(false);
  const [animate, setAnimate] = useState<'none' | 'load' | 'scroll'>('none');
  // Bumped by Replay: remounting the chart restarts its animation.
  const [replay, setReplay] = useState(0);
  const [card, setCard] = useState(false);
  /* fit = as wide as the data needs; fixed = a set px width; responsive = fills its container. */
  const [widthMode, setWidthMode] = useState('fit');
  const [widthPx, setWidthPx] = useState(600);
  const [showLabels, setShowLabels] = useState(true);
  const [barFill, setBarFill] = useState('solid');
  const [barOutline, setBarOutline] = useState(true);
  // The 3dBar and Wide-3dBar components' Shadow boolean, on by default as there.
  const [barShadow, setBarShadow] = useState(true);
  // The Bar's BarDecoration: a ring cap on each bar's end.
  const [barTopper, setBarTopper] = useState(false);
  // The Bar's Opaque Background, and a line through the bars' ends.
  const [barTrack, setBarTrack] = useState(false);
  const [barConnect, setBarConnect] = useState('none');
  const [legendPos, setLegendPos] = useState('top');
  const [orientation, setOrientation] = useState('vertical');
  const [line, setLine] = useState({ thickness: 2, curve: 'straight', effect: 'flat' });
  const [series, setSeries] = useState<Series[]>([{ name: 'Sales', color: 'Chart-1', marker: 'dot', fill: 'gradient' }]);
  /* One marker for every line, or a shape per line. Per line is the more
     accessible choice — the shape tells lines apart without color — but a
     single marker is a common, deliberate look. */
  const [sameMarker, setSameMarker] = useState(true);
  const [sharedMarker, setSharedMarker] = useState('dot');
  const [pie, setPie] = useState({ labels: 'percent', hole: 0.6, shadow: false });
  const [rows, setRows] = useState<Row[]>(START_ROWS);
  const [tab, setTab] = useState<'build' | 'code' | 'figma' | 'import'>('build');

  const previewRef = useRef<HTMLDivElement>(null);
  const [resolvedColors, setResolvedColors] = useState<{ [k: string]: string }>({});
  const COLOR_OPTIONS = useMemo(() => colorOptions(resolvedColors), [resolvedColors]);
  const [metrics, setMetrics] = useState<Partial<ChartMetrics>>(metricsForSize('large'));

  useEffect(() => {
    let live = true;
    if (!uuid) { setExists(false); return; }
    systemExists(uuid).then((ok) => { if (live) setExists(ok); });
    return () => { live = false; };
  }, [uuid]);

  /* Re-read the sizes once the system's sheets have loaded, and whenever the
     size mode changes. A first read before the CSS arrives gets fallbacks. */
  useEffect(() => {
    const read = () => setMetrics(readMetrics(previewRef.current, size));
    read();
    const t = window.setTimeout(read, 1200);
    return () => window.clearTimeout(t);
  }, [size, exists]);

  /* Load a chart back from where it lives — a Figma build (via the plugin's
     link), exported HTML, or a spec — and fill every control from it. The
     studio stores nothing; the chart is its own record. */
  const [loadText, setLoadText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const applySpec = (input: Record<string, unknown>) => {
    const { spec: sp } = normalizeChartSpec(input);
    setName(sp.name); setType(sp.type); setGround(sp.ground); setMode(sp.mode); setSize(sp.size);
    setPlotHeight(sp.plotHeight); setAxis({ ...sp.axis, prefix: sp.axis.prefix || '', suffix: sp.axis.suffix || '' });
    setShowAxis(sp.showAxis); setGridY(sp.grid.y); setGridX(sp.grid.x); setShowLabels(sp.showLabels);
    setShowTitle(sp.showTitle); setTableLink(sp.tableLink); setAnimate(sp.animate); setCard(sp.card);
    setWidthMode(sp.width.mode === 'responsive' ? 'responsive' : sp.width.px !== null ? 'fixed' : 'fit');
    if (sp.width.px !== null) setWidthPx(sp.width.px);
    setBarFill(sp.bar.fill); setBarOutline(sp.bar.outline); setBarShadow(sp.bar.shadow);
    setBarTopper(sp.bar.topper); setOrientation(sp.bar.orientation);
    setBarTrack(sp.bar.track); setBarConnect(sp.bar.connect); setLegendPos(sp.legend);
    setLine({ thickness: sp.line.thickness, curve: sp.line.curve, effect: sp.line.effect });
    setSeries(sp.series.map((sr) => ({ name: sr.name, color: sr.color, marker: sr.marker, fill: sr.fill })));
    const marks = new Set(sp.series.map((sr) => sr.marker));
    setSameMarker(marks.size <= 1);
    if (marks.size === 1) setSharedMarker(sp.series[0].marker);
    setPie({ labels: sp.pie.labels, hole: sp.pie.hole, shadow: sp.pie.shadow });
    const multi = sp.type === 'line' || sp.type === 'stacked';
    setRows(sp.data.map((d) => ({
      label: d.label,
      values: (multi ? d.values : [d.value]).map((v) => (v === undefined || v === null ? '' : String(v))),
      color: d.color,
    })));
  };
  // Loaded charts open on Generate, ready to edit.
  const loadChart = (text: string) => {
    try { applySpec(extractChartSpec(text)); setLoadError(null); setLoadText(''); setTab('build'); }
    catch (e) { setLoadError((e as Error).message); }
  };
  /* Import data: a spreadsheet's rows replace the chart's data and nothing
     else — style the chart first, then pour the numbers in. */
  const [dataText, setDataText] = useState('');
  const [dataMsg, setDataMsg] = useState<{ level: 'warning' | 'success'; text: string } | null>(null);
  const importData = (text: string) => {
    try {
      const t = tableFromGrid(parseGrid(text));
      const notes = [...t.notes];
      const multi = type === 'line' || type === 'stacked';
      const pieType = type === 'pie' || type === 'donut';
      const maxRows = pieType ? CHART_COLORS.length : 40;
      let labels = t.labels; let values = t.values;
      if (labels.length > maxRows) {
        notes.push(`Only the first ${maxRows} rows are used${pieType ? ' — a pie has one slice per chart color' : ''}.`);
        labels = labels.slice(0, maxRows); values = values.slice(0, maxRows);
      }
      const names = t.series.slice(0, multi ? 10 : 1);
      if (multi && t.series.length > 10) notes.push('Only the first 10 columns are used — there are ten series colors.');
      if (!multi && t.series.length > 1) notes.push(`${t.series.length} number columns: this chart shows the first. Choose Line or Stacked bar to show them all.`);
      const cell = (v: number | null) => (v === null ? '' : String(v));
      if (multi) {
        setSeries(names.map((nm, k) => ({
          name: nm,
          color: series[k] ? series[k].color : CHART_COLORS[k % CHART_COLORS.length],
          marker: series[k] ? series[k].marker : MARKER_ORDER[k % MARKER_ORDER.length],
          fill: series[k] ? series[k].fill : (k === 0 ? 'gradient' : 'none'),
        })));
      }
      setRows(labels.map((lb, i) => ({
        label: lb,
        values: multi ? names.map((_, k) => cell(values[i][k])) : [cell(values[i][0])],
        color: rows[i] ? rows[i].color : CHART_COLORS[i % CHART_COLORS.length],
      })));
      // An axis that fits the numbers, when the current one does not.
      const nums = values.flatMap((r) => (multi ? r.slice(0, names.length) : r.slice(0, 1))).filter((v): v is number => v !== null);
      const top = type === 'stacked'
        ? Math.max(0, ...values.map((r) => r.slice(0, names.length).reduce<number>((s, v) => s + (v || 0), 0)))
        : Math.max(0, ...nums);
      const low = Math.min(0, ...nums);
      let next = { ...axis };
      if (top > axis.max || low < axis.min) {
        const nice = niceAxis(top);
        next = { ...next, min: low < 0 ? -niceAxis(-low).max : 0, max: nice.max, step: nice.step };
        notes.push(`The axis now runs ${next.min}–${next.max} to fit the data.`);
      }
      if (t.prefix || t.suffix) next = { ...next, prefix: t.prefix, suffix: t.suffix };
      setAxis(next);
      setDataMsg({ level: notes.length ? 'warning' : 'success', text: `Imported ${labels.length} rows${multi ? ` × ${names.length} ${type === 'line' ? 'lines' : 'segments'}` : ''}.` + (notes.length ? ' ' + notes.join(' ') : '') });
      // Stays on Import: the chart is beside it, and so is this message.
      setDataText('');
    } catch (e) {
      setDataMsg({ level: 'warning', text: (e as Error).message });
    }
  };
  const importFile = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) {
      setDataMsg({ level: 'warning', text: 'Excel files are not read directly yet. In Excel, select the cells and copy them, then paste here — or save as CSV.' });
      return;
    }
    f.text().then(importData);
  };

  // A link from the Figma plugin carries the chart in its #spec fragment.
  useEffect(() => {
    if (/[#&]spec=/.test(window.location.hash)) loadChart(window.location.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const raw = useMemo(() => ({
    version: CHART_SPEC_VERSION,
    name,
    designSystem: { id: uuid || null, name: null },
    type, ground, mode, size, plotHeight, axis, showAxis, showLabels, showTitle, tableLink, animate, card,
    grid: { y: gridY, x: gridX },
    width: { mode: widthMode === 'responsive' ? 'responsive' : 'fixed', px: widthMode === 'fixed' ? widthPx : null },
    series: series.map((sr) => (sameMarker ? { ...sr, marker: sharedMarker } : sr)),
    data: rows.map((r) => {
      const num = (v: string | undefined) => (v === undefined || v === '' ? '' : Number(v));
      return { label: r.label, value: num(r.values[0]), values: series.map((_, k) => num(r.values[k])), color: r.color };
    }),
    line,
    bar: { fill: barFill, outline: barOutline, shadow: barShadow, orientation, topper: barTopper, track: barTrack, connect: barConnect },
    legend: legendPos,
    pie,
  }), [name, uuid, type, ground, mode, size, plotHeight, axis, showAxis, gridY, gridX, showTitle, tableLink, animate, widthMode, widthPx, card,
    showLabels, rows, series, sameMarker, sharedMarker, line, barFill, barOutline, barShadow, orientation, barTopper, barTrack, barConnect, legendPos, pie]);

  const { spec, findings } = useMemo(() => normalizeChartSpec(raw), [raw]);
  const refused = worstChartLevel(findings) === 'refuse';
  const layout = useMemo(() => (refused ? null : layoutChart(spec, metrics)), [spec, metrics, refused]);
  const html = useMemo(() => (layout ? chartHTML(spec, layout, metrics) : ''), [spec, layout, metrics]);
  const css = useMemo(() => chartCSS(), []);
  const js = useMemo(() => (spec.animate === 'scroll' ? chartScript() : ''), [spec.animate]);
  /* The preview runs what the exported script does, so a "scroll" chart
     plays here when it comes into view rather than staying on its first frame. */
  const chartHostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fig = chartHostRef.current?.querySelector('.omni-chart[data-animate="scroll"]');
    if (!fig) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { fig.setAttribute('data-in-view', ''); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(fig);
    return () => io.disconnect();
  }, [html, replay]);

  // Read the series colors off the chart itself, on its ground.
  useEffect(() => {
    const read = () => {
      const fig = previewRef.current?.querySelector('.omni-chart');
      if (!fig) return;
      const cs = getComputedStyle(fig);
      const next: { [k: string]: string } = {};
      for (const c of CHART_ALL_COLORS) {
        // A state color falls back to the ground's Icons-{State}, as the chart does.
        next[c] = cs.getPropertyValue(`--${chartColorToken(c)}`).trim()
          || (CHART_STATE_COLORS.indexOf(c) !== -1 ? cs.getPropertyValue(`--Icons-${c}`).trim() : '');
      }
      setResolvedColors((prev) => (CHART_ALL_COLORS.every((c) => prev[c] === next[c]) ? prev : next));
    };
    read();
    /* The system's sheets arrive after the first render and on no fixed
       schedule — a single delayed read caught the studio's own colors. Read
       again whenever a stylesheet is added, changed or finishes loading. */
    const mo = new MutationObserver(read);
    mo.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true });
    const onLoad = (e: Event) => { if ((e.target as Element)?.tagName === 'LINK') read(); };
    document.addEventListener('load', onLoad, true);
    return () => { mo.disconnect(); document.removeEventListener('load', onLoad, true); };
  }, [html, ground, exists, systemCss]);
  const allFindings = useMemo(() => findings.concat(
    (layout?.warnings || []).map((w) => ({ level: 'warn' as const, title: 'Value clamped', detail: w })),
  ), [findings, layout]);

  /* The spec carries the sizes it was laid out with, so the plugin can say so
     when the Figma file resolves different ones — the first place a parity
     drift would show. */
  const exportSpec = useMemo(() => JSON.stringify({ ...raw, metrics }, null, 2), [raw, metrics]);
  // A link that reopens exactly this chart — bookmark it, or share it.
  const chartLink = useMemo(() => `${window.location.origin}${window.location.pathname}#spec=${encodeChartSpec(raw)}`, [raw]);

  const editRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const editValue = (i: number, k: number, v: string) => setRows((rs) => rs.map((r, j) => {
    if (j !== i) return r;
    const values = r.values.slice();
    values[k] = v;
    return { ...r, values };
  }));
  /* A starting value for row i of line k: spread across the middle of the
     axis and different for every row and line, so new rows and lines show
     up as their own marks. Deterministic — the same slot starts the same. */
  const sampleValue = (i: number, k: number) => {
    const lo = axis.min + (axis.max - axis.min) * 0.15;
    const span = (axis.max - axis.min) * 0.7;
    const step = axis.step > 0 ? axis.step / 5 : 1;
    const frac = ((i * 37 + k * 53 + 11) % 100) / 100;
    return Number((Math.round((lo + span * frac) / step) * step).toFixed(4));
  };
  const addRow = () => setRows((rs) => rs.concat({
    label: `Item ${rs.length + 1}`, values: series.map((_, k) => String(sampleValue(rs.length, k))), color: CHART_COLORS[rs.length % CHART_COLORS.length],
  }));
  const editSeries = (k: number, patch: Partial<Series>) => setSeries((ss) => ss.map((x, j) => (j === k ? { ...x, ...patch } : x)));
  /* A new line takes the next unused color and starts as a copy of the
     first line's values, so it appears on the plot rather than at zero. */
  const addSeries = () => {
    const used = new Set(series.map((x) => x.color));
    const color = CHART_COLORS.find((c) => !used.has(c)) || CHART_COLORS[series.length % CHART_COLORS.length];
    const usedMarks = new Set(series.map((x) => x.marker));
    const marker = MARKER_ORDER.find((mk) => !usedMarks.has(mk)) || 'dot';
    // Only the first line is filled by default: fills stack and tint each other.
    setSeries((ss) => ss.concat({ name: `Line ${ss.length + 1}`, color, marker, fill: 'none' }));
    /* The new line gets its own values, spread across the axis, so it is
       visible at once — a copy of the first line would sit exactly on top of
       it. Deterministic, so the same line always starts the same way. */
    const k = series.length;
    const nudge = axis.step > 0 ? (axis.step / 5) * 2 : 2;
    setRows((rs) => rs.map((r, i) => {
      if (r.values.length > series.length) return r;
      let v = sampleValue(i, k);
      if (r.values.some((x) => Number(x) === v)) v = Math.min(axis.max, v + nudge);
      return { ...r, values: r.values.concat(String(v)) };
    }));
  };
  const removeSeries = (k: number) => {
    setSeries((ss) => ss.filter((_, j) => j !== k));
    setRows((rs) => rs.map((r) => ({ ...r, values: r.values.filter((_, j) => j !== k) })));
  };
  const isLine = type === 'line';
  const isStacked = type === 'stacked';
  // Lines and stacks take one value per series in each row.
  const isMulti = isLine || isStacked;
  const isBars = !isLine && type !== 'pie' && type !== 'donut';
  const horizontal = isBars && orientation === 'horizontal';
  const isPie = type === 'pie' || type === 'donut';
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const controls = (
    <VStack spacing={3}>
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Chart</H3>
          <TextField label="Name" size="small" value={name} onChange={(e: { target: { value: string } }) => setName(e.target.value)} />
          <Checkbox variant="default" size="small" checked={showTitle}
            onChange={(e: { target: { checked: boolean } }) => setShowTitle(e.target.checked)}
            label="Show the name as a title" />
          {/* A link under the chart that opens the data table in place. */}
          <Checkbox variant="default" size="small" checked={tableLink}
            onChange={(e: { target: { checked: boolean } }) => setTableLink(e.target.checked)}
            label='Add a "Show as table" link' />
          <Checkbox variant="default" size="small" checked={card}
            onChange={(e: { target: { checked: boolean } }) => setCard(e.target.checked)}
            label="Show in a card" />
          {/* Motion is code only — Figma charts are static. */}
          <Select label="Animation (code)" size="small" fullWidth value={animate}
            options={[{ label: 'None', value: 'none' }, { label: 'On load', value: 'load' }, { label: 'When scrolled into view', value: 'scroll' }]}
            onChange={(v: string) => { setAnimate(v as typeof animate); setReplay((n) => n + 1); }} />
          {animate !== 'none' && (
            <Button variant="default-outline" size="small" onClick={() => setReplay((n) => n + 1)}>Replay animation</Button>
          )}
          <Select label="Type" size="small" fullWidth value={type} onChange={(v: string) => setType(v)} options={TYPE_OPTIONS} />
          {/* The two chart grounds (docs/chart-colors.md): Surface-Brightest or
              Surface-Dimmest. Each has its own tuned series colors. */}
          <VStack spacing={0.5}>
            <Label>Chart background</Label>
            <ButtonGroup value={ground} onChange={(v: string) => setGround(v)} size="small">
              <Button value="light" size="small">Light</Button>
              <Button value="dark" size="small">Dark</Button>
            </ButtonGroup>
          </VStack>
          <Select label="Color vision" size="small" fullWidth value={vision}
            onChange={(v: string) => setVision(v as typeof vision)}
            options={[{ label: 'Default (brand colors)', value: 'none' },
              ...Object.entries(CHART_COLOR_VISION).map(([value, set]) => ({ label: set.label, value }))]} />
          {/* The palette has a light-mode and a dark-mode version. This sets
              the preview and the Figma frame; code follows its page. */}
          <VStack spacing={0.5}>
            <Label>Mode</Label>
            <ButtonGroup value={mode} onChange={(v: string) => setMode(v)} size="small">
              <Button value="light" size="small">Light mode</Button>
              <Button value="dark" size="small">Dark mode</Button>
            </ButtonGroup>
          </VStack>
          {(isMulti && series.length > 1) || (isPie && (pie.labels === 'legend' || pie.labels === 'both')) ? (
            <VStack spacing={0.5}>
              <Label>Legend</Label>
              <ButtonGroup value={legendPos} onChange={(v: string) => setLegendPos(v)} size="small">
                <Button value="top" size="small">Top</Button>
                <Button value="bottom" size="small">Bottom</Button>
              </ButtonGroup>
            </VStack>
          ) : null}
          {/* Size moves the bar widths; a line chart has none, so it is off there. */}
          <Select label="Size (Component-Size mode)" size="small" fullWidth value={size} onChange={(v: string) => setSize(v)} options={SIZE_OPTIONS}
            disabled={isLine} helperText={isLine ? 'Size sets bar widths, so it does not apply to line charts.' : undefined} />
          {isBars && (
            <VStack spacing={0.5}>
              <Label>Orientation</Label>
              <ButtonGroup value={orientation} onChange={(v: string) => setOrientation(v)} size="small">
                <Button value="vertical" size="small">Vertical</Button>
                <Button value="horizontal" size="small">Horizontal</Button>
              </ButtonGroup>
            </VStack>
          )}
          <NumberField label={isPie ? 'Diameter (px)' : horizontal ? 'Plot length (px)' : 'Plot height (px)'} min={40} max={1200} value={plotHeight} onChange={(v: number) => setPlotHeight(v || 160)} />
          <VStack spacing={0.5}>
            <Label>Width</Label>
            <ButtonGroup value={widthMode} onChange={(v: string) => setWidthMode(v)} size="small">
              <Button value="fit" size="small">Fit</Button>
              <Button value="fixed" size="small">Fixed</Button>
              <Button value="responsive" size="small">Responsive</Button>
            </ButtonGroup>
          </VStack>
          {widthMode === 'fixed' && (
            <NumberField label="Width (px)" min={120} max={4000} step={10} value={widthPx}
              onChange={(v: number) => setWidthPx(v || 600)} />
          )}
        </VStack>
      </Card>

      {!isPie && (
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Value axis</H3>
          {/* Layout primitive: three equal columns that can shrink — an HStack
              lets NumberField keep its intrinsic width and overflow the card. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <NumberField label="Min" value={axis.min} onChange={(v: number) => setAxis({ ...axis, min: v ?? 0 })} />
            <NumberField label="Max" value={axis.max} onChange={(v: number) => setAxis({ ...axis, max: v ?? 100 })} />
            <NumberField label="Step" min={0} value={axis.step} onChange={(v: number) => setAxis({ ...axis, step: v ?? 25 })} />
          </div>
          <HStack spacing={1}>
            <TextField label="Prefix" size="small" value={axis.prefix} onChange={(e: { target: { value: string } }) => setAxis({ ...axis, prefix: e.target.value })} />
            <TextField label="Suffix" size="small" value={axis.suffix} onChange={(e: { target: { value: string } }) => setAxis({ ...axis, suffix: e.target.value })} />
          </HStack>
          <SwitchInput checked={showAxis} onChange={(e: { target: { checked: boolean } }) => setShowAxis(e.target.checked)} label="Axis labels" />
          <SwitchInput checked={gridY} onChange={(e: { target: { checked: boolean } }) => setGridY(e.target.checked)} label={horizontal ? "Value gridlines (vertical)" : "Value gridlines (horizontal)"} />
          <SwitchInput checked={gridX} onChange={(e: { target: { checked: boolean } }) => setGridX(e.target.checked)} label={horizontal ? "Category gridlines (horizontal)" : "Category gridlines (vertical)"} />
          <SwitchInput checked={showLabels} onChange={(e: { target: { checked: boolean } }) => setShowLabels(e.target.checked)} label="Category labels" />
        </VStack>
      </Card>
      )}

      {isPie && (
        <Card padding="medium">
          <VStack spacing={2}>
            <H3>{type === 'donut' ? 'Donut' : 'Pie'}</H3>
            <Select label="Slice labels" size="small" fullWidth value={pie.labels} onChange={(v: string) => setPie({ ...pie, labels: v })} options={SLICE_LABEL_OPTIONS} />
            <SwitchInput checked={pie.shadow} onChange={(e: { target: { checked: boolean } }) => setPie({ ...pie, shadow: e.target.checked })}
              label={type === 'donut' ? '3D shadow (outside and in the hole)' : '3D shadow'} />
            {type === 'donut' && (
              <>
                <NumberField label="Hole (% of the diameter)" min={30} max={85} value={Math.round(pie.hole * 100)}
                  onChange={(v: number) => setPie({ ...pie, hole: (v || 60) / 100 })} />
              </>
            )}
          </VStack>
        </Card>
      )}

      {(type === 'bar3d' || type === 'bar3dWide') && (
        <Card padding="medium">
          <VStack spacing={2}>
            <H3>Bars</H3>
            <SwitchInput checked={barShadow} onChange={(e: { target: { checked: boolean } }) => setBarShadow(e.target.checked)} label="Shadow" />
          </VStack>
        </Card>
      )}

      {(type === 'bar' || type === 'stacked') && (
        <Card padding="medium">
          <VStack spacing={2}>
            <H3>Bars</H3>
            {type === 'bar' && (
              <Select label="Fill" size="small" fullWidth value={barFill} onChange={(v: string) => setBarFill(v)}
                options={[{ label: 'Solid', value: 'solid' }, { label: 'Gradient', value: 'gradient' }]} />
            )}
            {/* No Outline switch: only grouped bars are outlined in the design,
                and a stack never wears a topper — the Figma components' own rules. */}
            {type === 'bar' && (
              <SwitchInput checked={barTopper} onChange={(e: { target: { checked: boolean } }) => setBarTopper(e.target.checked)} label="Topper (a ring on each bar's end)" />
            )}
            {type === 'bar' && (
              <SwitchInput checked={barTrack} onChange={(e: { target: { checked: boolean } }) => setBarTrack(e.target.checked)} label="Background track behind each bar" />
            )}
            <Select label="Connect the bar ends" size="small" fullWidth value={barConnect} onChange={(v: string) => setBarConnect(v)}
              options={[{ label: 'No line', value: 'none' }, { label: 'Straight line', value: 'straight' }, { label: 'Curved line', value: 'smooth' }]} />
          </VStack>
        </Card>
      )}

      {type === 'line' && (
        <Card padding="medium">
          <VStack spacing={2}>
            <H3>Line</H3>
            <VStack spacing={0.5}>
              <Label>Shape</Label>
              <ButtonGroup value={line.curve} onChange={(v: string) => setLine({ ...line, curve: v })} size="small">
                <Button value="straight" size="small">Straight</Button>
                <Button value="smooth" size="small">Curved</Button>
              </ButtonGroup>
            </VStack>
            <SwitchInput checked={sameMarker} onChange={(e: { target: { checked: boolean } }) => setSameMarker(e.target.checked)} label="Same marker on every line" />
            {sameMarker && (
              <Select label="Marker" size="small" fullWidth value={sharedMarker} onChange={(v: string) => setSharedMarker(v)} options={MARKER_OPTIONS} />
            )}
            <Select label="3D effect" size="small" fullWidth value={line.effect} onChange={(v: string) => setLine({ ...line, effect: v })} options={EFFECT_OPTIONS} />
            <NumberField label="Thickness (px)" min={1} max={8} value={line.thickness} onChange={(v: number) => setLine({ ...line, thickness: v || 2 })} />
          </VStack>
        </Card>
      )}

      {isMulti && (
        <Card padding="medium">
          <VStack spacing={2}>
            <H3>{isLine ? 'Lines' : 'Segments'}</H3>
            {series.map((sr, k) => (
              <VStack key={k} spacing={1}>
                <HStack spacing={1} alignItems="flex-end">
                  <TextField label={`${isLine ? 'Line' : 'Segment'} ${k + 1}`} size="small" value={sr.name} onChange={(e: { target: { value: string } }) => editSeries(k, { name: e.target.value })} />
                  <Select label="Color" mode="color" size="small" value={sr.color} onChange={(v: string) => editSeries(k, { color: v })} options={COLOR_OPTIONS} />
                  <Button iconOnly variant="ghost" size="small" aria-label={`Remove ${sr.name || `line ${k + 1}`}`} disabled={series.length === 1} onClick={() => removeSeries(k)}>
                    <DeleteOutlineIcon />
                  </Button>
                </HStack>
                {isLine && (
                <HStack spacing={1}>
                  {!sameMarker && (
                    <Select label="Marker" size="small" fullWidth value={sr.marker} onChange={(v: string) => editSeries(k, { marker: v })} options={MARKER_OPTIONS} />
                  )}
                  <Select label="Fill below" size="small" fullWidth value={sr.fill} onChange={(v: string) => editSeries(k, { fill: v })} options={LINE_FILL_OPTIONS} />
                </HStack>
                )}
                {k < series.length - 1 && <Divider />}
              </VStack>
            ))}
            <Button variant="default-outline" size="small" onClick={addSeries} disabled={series.length >= 10}>{isLine ? 'Add a line' : 'Add a segment'}</Button>
          </VStack>
        </Card>
      )}

      <Card padding="medium">
        <VStack spacing={2}>
          {/* Layout primitive: the title, and the import link to its right. */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <H3 width="hug">Data</H3>
            <Link onClick={() => { setDataMsg(null); setDataModal(true); }} style={{ whiteSpace: 'nowrap' }}>Import data</Link>
          </div>
          {rows.map((r, i) => (
            <HStack key={i} spacing={1} alignItems="flex-end">
              <TextField label={`Label ${i + 1}`} size="small" value={r.label} onChange={(e: { target: { value: string } }) => editRow(i, { label: e.target.value })} />
              {(isMulti ? series : series.slice(0, 1)).map((sr, k) => (
                <TextField key={k} label={isMulti && series.length > 1 ? sr.name || `Line ${k + 1}` : 'Value'} size="small" type="number"
                  value={r.values[k] ?? ''} onChange={(e: { target: { value: string } }) => editValue(i, k, e.target.value)} />
              ))}
              {!isMulti && (
                <Select label="Color" mode="color" size="small" value={r.color} onChange={(v: string) => editRow(i, { color: v })} options={COLOR_OPTIONS} />
              )}
              <Button iconOnly variant="ghost" size="small" aria-label={`Remove ${r.label || `row ${i + 1}`}`} onClick={() => removeRow(i)}>
                <DeleteOutlineIcon />
              </Button>
            </HStack>
          ))}
          <Button variant="default-outline" size="small" onClick={addRow}
            disabled={isPie && rows.length >= CHART_COLORS.length}>Add a row</Button>
        </VStack>
      </Card>
    </VStack>
  );

  // No card round the preview: the chart is the thing on show, and it can be
  // a card itself — a card inside a card reads as a mistake.
  const preview = (
    <VStack spacing={2}>
      {/* Layout primitive only: the generated chart is injected here
          verbatim, so the preview is the code a user copies. The padding
          leaves room for a card's shadow. */}
      {/* The preview sits on the system's own page background, so Light and
          Dark mode read as they would on a real page — on the studio's light
          page a dark-mode chart barely looked different. */}
      <Section surface="Surface" padding="16px" style={{ borderRadius: 12 }}>
      <div ref={previewRef} style={{ padding: 8 }} data-color-vision={vision === 'none' ? undefined : vision}>
        <style>{css}</style>
        {html
          ? <div key={replay} ref={chartHostRef} dangerouslySetInnerHTML={{ __html: html }} />
          : <Body color="quiet">Fix the refusals below to see the chart.</Body>}
      </div>
      </Section>
      <FindingList findings={allFindings} />
    </VStack>
  );

  const body = (
    <>
    <AddOnTopNav title="Charts" uuid={uuid} exists={exists} basePath="/add-ons/charts" />
    <VStack spacing={3} style={{ maxWidth: 1180, margin: '0 auto', padding: '24px 16px 32px' }}>
      <VStack spacing={1}>
        <Body color="quiet">
          A one-off chart in your design system — as code, or built in Figma from your own chart components.
        </Body>
      </VStack>

      {/* Layout primitive: picker and id field side by side, wrapping on narrow screens. */}
      {systemCss && !systemCss.live && (
        <Alert color="warning"><BodySmall>{systemCss.reason}</BodySmall></Alert>
      )}

      {exists === false && (
        <Alert color="warning">
          <BodySmall>
            {uuid
              ? 'No design system has that ID, so the chart is drawn without a brand. Check the ID and load it again.'
              : 'Use the settings cog at the top right to enter your design system ID and draw the chart in your brand — it is the Omni Design ID in the plugin’s Settings.'}
          </BodySmall>
        </Alert>
      )}

      {/* overflow: clip, not the lib's hidden: hidden makes Tabs a scroll
          container, so nothing inside a panel can be sticky. clip still clips. */}
      <Tabs value={tab} onChange={(v: 'build' | 'code' | 'figma' | 'import') => setTab(v)} sx={{ overflow: 'clip' }}>
        <TabList aria-label="Charts add-on">
          <Tab value="build">Build</Tab>
          <Tab value="code">Code</Tab>
          <Tab value="figma">Export</Tab>
          <Tab value="import">Import</Tab>
        </TabList>

        <TabPanel value="build">
          {/* Layout primitive: controls and preview side by side. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 24, alignItems: 'start' }}>
            {controls}
            {/* Layout primitive: the preview stays in view while the controls
                scroll, so a change below the fold is visible as it is made.
                Never a scroll box of its own: the chart shows whole. */}
            <div style={{ position: 'sticky', top: ADD_ON_NAV_HEIGHT + 16 }}>
              {preview}
            </div>
          </div>
        </TabPanel>

        <TabPanel value="code">
          <VStack spacing={2}>
            {preview}
            <BodySmall color="quiet">
              Load your design system's CSS on the page, then add the CSS below once and the HTML wherever the chart goes.
            </BodySmall>
            <CodeBlock code={html} language="HTML" maxHeight={360} />
            <CodeBlock code={css} language="CSS" maxHeight={360} />
            {js && <BodySmall color="quiet">This chart animates when it scrolls into view — add this script once, after your charts:</BodySmall>}
            {js && <CodeBlock code={js} language="JS" maxHeight={240} />}
            <BodySmall color="quiet">A link that reopens this chart here for editing:</BodySmall>
            <CodeBlock code={chartLink} language="URL" wrap maxHeight={120} />
            <Divider />
            <Caption color="quiet">These tokens are in the CSS of design systems published after they were added. An older system paints the Figma values as fallbacks until it is republished:</Caption>
            {CSS_GAPS.map((g) => <Caption key={g} color="quiet">• {g}</Caption>)}
          </VStack>
        </TabPanel>

        <TabPanel value="figma">
          <VStack spacing={2}>
            <Body>
              In Figma, open the <strong>Omni Design</strong> plugin, open the <strong>Add-ons</strong> tab, choose <strong>Charts</strong>, and paste this spec.
              It builds the chart from the file's own chart components, sets each bar's Chart-Colors mode, and checks the spec the same way this page does.
              To size it, select a frame and use <strong>Render in selected frame</strong>.
            </Body>
            {refused
              ? <Alert color="error"><BodySmall>This spec would be refused — fix the items on the Build tab first.</BodySmall></Alert>
              : <CodeBlock code={exportSpec} language="JSON" maxHeight={420} />}
          </VStack>
        </TabPanel>
        <TabPanel value="import">
          {/* Layout primitive: the loader beside the chart it fills. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 24, alignItems: 'start' }}>
      {/* Layout primitive: the import, alone now that data imports from the Data card. */}
      <div style={{ display: 'grid', gap: 24 }}>
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Import Omni chart</H3>
          <BodySmall color="quiet">
            Edit a chart you already have: paste its HTML from your code, its spec, or a chart link.
            Everything comes back — type, colors, options and data. From Figma, select the chart and use
            Open chart in studio in the plugin.
          </BodySmall>
          <TextArea label="Chart HTML, spec or link" rows={3} fullWidth value={loadText}
            onChange={(e: { target: { value: string } }) => setLoadText(e.target.value)} />
          {loadError && <Alert color="warning"><BodySmall>{loadError}</BodySmall></Alert>}
          <Button variant="default-outline" size="small" onClick={() => { loadChart(loadText); }} disabled={!loadText.trim()}>Load</Button>
        </VStack>
      </Card>


      </div>

            {preview}
          </div>
        </TabPanel>
      </Tabs>
      {/* Import data: paste cells or drop a CSV, from the Data card's link. */}
      <Modal open={dataModal} onClose={() => setDataModal(false)} title="Import data" size="medium">
        <VStack spacing={2}>
          <BodySmall color="quiet">
            Copy cells from Excel, Google Sheets or Numbers and paste them here, or drop a CSV file. The first
            column is the categories; a header row names the {type === 'line' ? 'lines' : type === 'stacked' ? 'segments' : 'columns'}.
            Only the data changes — your chart&rsquo;s type, colors and options stay.
          </BodySmall>
          <TextArea label="Paste cells" rows={4} fullWidth value={dataText}
            placeholder={'Month\tSales\tCosts\nJan\t40\t20\nFeb\t65\t35'}
            onChange={(e: { target: { value: string } }) => setDataText(e.target.value)} />
          <Button variant="default-outline" size="small" onClick={() => importData(dataText)} disabled={!dataText.trim()}>Import data</Button>
          <DropZone accept=".csv,.tsv,.txt,.xlsx,.xls" size="small" label="Drop a CSV file" sublabel="or click to choose one" onFiles={importFile} />
          {dataMsg && <Alert color={dataMsg.level}><BodySmall>{dataMsg.text}</BodySmall></Alert>}
          {dataMsg && dataMsg.level !== 'warning' && <Button variant="default" size="small" onClick={() => setDataModal(false)}>Done</Button>}
        </VStack>
      </Modal>
    </VStack>
    </>
  );

  if (exists !== true || !uuid || !systemCss) return body;

  return (
    <OmniDesignProvider {...systemCss.urls} defaultTheme="Default" defaultStyle="Modern" defaultSurface="Surface" darkMode={mode === 'dark'}>
      {body}
    </OmniDesignProvider>
  );
}
