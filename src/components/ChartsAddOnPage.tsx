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
  Tabs, TabList, Tab, TabPanel, TextField, NumberField, Select, SwitchInput, CodeBlock, ButtonGroup, Label,
  OmniDesignProvider,
} from '@omni-design/components';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { systemExists } from '../utils/docs/systemCss';
import { liveSystemCss, type LiveSystemCss } from '../utils/addOns/charts/liveSystemCss';
import {
  normalizeChartSpec, worstChartLevel, CHART_COLORS, CHART_SPEC_VERSION,
  type ChartFinding,
} from '../utils/addOns/charts/chartSpec';
import { layoutChart, metricsForSize, type ChartMetrics } from '../utils/addOns/charts/chartLayout';
import { chartHTML, chartCSS, CSS_GAPS } from '../utils/addOns/charts/chartCode';

type Row = { label: string; value: string; color: string };

const TYPE_OPTIONS = [
  { label: 'Bar', value: 'bar' },
  { label: '3D bar', value: 'bar3d' },
  { label: 'Wide 3D bar', value: 'bar3dWide' },
  { label: 'Line', value: 'line' },
];
const SIZE_OPTIONS = [
  { label: 'Large', value: 'large' },
  { label: 'Medium', value: 'medium' },
  { label: 'Small', value: 'small' },
];
const COLOR_OPTIONS = CHART_COLORS.map((c) => ({ label: c, value: c, color: `var(--${c})` }));
const MARKER_OPTIONS = [
  { label: 'Dot', value: 'dot' }, { label: 'Square', value: 'square' }, { label: 'None', value: 'none' },
];
const LINE_FILL_OPTIONS = [
  { label: 'Gradient', value: 'gradient' }, { label: 'Solid', value: 'solid' }, { label: 'None', value: 'none' },
];

const START_ROWS: Row[] = [
  { label: 'Jan', value: '40', color: 'Chart-1' },
  { label: 'Feb', value: '65', color: 'Chart-2' },
  { label: 'Mar', value: '30', color: 'Chart-3' },
  { label: 'Apr', value: '85', color: 'Chart-4' },
  { label: 'May', value: '55', color: 'Chart-5' },
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
  set('wideFront', '--Sizing-6');
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
  /* Any system by id — the picker only lists the signed-in user's own, and a
     system someone shared (or one from Figma's Dino ID) is not in that list. */
  const [idInput, setIdInput] = useState(uuid || '');
  useEffect(() => { setIdInput(uuid || ''); }, [uuid]);
  const idClean = idInput.trim();
  const idValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idClean);
  const loadId = () => { if (idValid && idClean !== uuid) navigate(`/add-ons/charts/${idClean.toLowerCase()}`); };

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
  const [size, setSize] = useState('large');
  const [plotHeight, setPlotHeight] = useState(160);
  const [axis, setAxis] = useState({ min: 0, max: 100, step: 25, prefix: '', suffix: '' });
  const [showAxis, setShowAxis] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [barFill, setBarFill] = useState('solid');
  const [barOutline, setBarOutline] = useState(true);
  const [line, setLine] = useState({ color: 'Chart-1', marker: 'dot', fill: 'gradient', thickness: 2 });
  const [rows, setRows] = useState<Row[]>(START_ROWS);
  const [tab, setTab] = useState<'generate' | 'code' | 'figma'>('generate');

  const previewRef = useRef<HTMLDivElement>(null);
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

  const raw = useMemo(() => ({
    version: CHART_SPEC_VERSION,
    name,
    designSystem: { id: uuid || null, name: null },
    type, ground, size, plotHeight, axis, showAxis, showGrid, showLabels,
    data: rows.map((r) => ({ label: r.label, value: r.value === '' ? '' : Number(r.value), color: r.color })),
    line,
    bar: { fill: barFill, outline: barOutline },
  }), [name, uuid, type, ground, size, plotHeight, axis, showAxis, showGrid, showLabels, rows, line, barFill, barOutline]);

  const { spec, findings } = useMemo(() => normalizeChartSpec(raw), [raw]);
  const refused = worstChartLevel(findings) === 'refuse';
  const layout = useMemo(() => (refused ? null : layoutChart(spec, metrics)), [spec, metrics, refused]);
  const html = useMemo(() => (layout ? chartHTML(spec, layout, metrics) : ''), [spec, layout, metrics]);
  const css = useMemo(() => chartCSS(), []);
  const allFindings = useMemo(() => findings.concat(
    (layout?.warnings || []).map((w) => ({ level: 'warn' as const, title: 'Value clamped', detail: w })),
  ), [findings, layout]);

  /* The spec carries the sizes it was laid out with, so the plugin can say so
     when the Figma file resolves different ones — the first place a parity
     drift would show. */
  const exportSpec = useMemo(() => JSON.stringify({ ...raw, metrics }, null, 2), [raw, metrics]);

  const editRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => rs.concat({
    label: `Item ${rs.length + 1}`, value: '50', color: CHART_COLORS[rs.length % CHART_COLORS.length],
  }));
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const controls = (
    <VStack spacing={3}>
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Chart</H3>
          <TextField label="Name" size="small" value={name} onChange={(e: { target: { value: string } }) => setName(e.target.value)} />
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
          <Select label="Size (Component-Size mode)" size="small" fullWidth value={size} onChange={(v: string) => setSize(v)} options={SIZE_OPTIONS} />
          <NumberField label="Plot height (px)" min={40} max={1200} value={plotHeight} onChange={(v: number) => setPlotHeight(v || 160)} />
        </VStack>
      </Card>

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
          <SwitchInput checked={showGrid} onChange={(e: { target: { checked: boolean } }) => setShowGrid(e.target.checked)} label="Gridlines" />
          <SwitchInput checked={showLabels} onChange={(e: { target: { checked: boolean } }) => setShowLabels(e.target.checked)} label="Category labels" />
        </VStack>
      </Card>

      {type === 'bar' && (
        <Card padding="medium">
          <VStack spacing={2}>
            <H3>Bars</H3>
            <Select label="Fill" size="small" fullWidth value={barFill} onChange={(v: string) => setBarFill(v)}
              options={[{ label: 'Solid', value: 'solid' }, { label: 'Gradient', value: 'gradient' }]} />
            <SwitchInput checked={barOutline} onChange={(e: { target: { checked: boolean } }) => setBarOutline(e.target.checked)} label="Outline (separates touching bars)" />
          </VStack>
        </Card>
      )}

      {type === 'line' && (
        <Card padding="medium">
          <VStack spacing={2}>
            <H3>Line</H3>
            <Select label="Color" mode="color" size="small" fullWidth value={line.color} onChange={(v: string) => setLine({ ...line, color: v })} options={COLOR_OPTIONS} />
            <Select label="Markers" size="small" fullWidth value={line.marker} onChange={(v: string) => setLine({ ...line, marker: v })} options={MARKER_OPTIONS} />
            <Select label="Fill below" size="small" fullWidth value={line.fill} onChange={(v: string) => setLine({ ...line, fill: v })} options={LINE_FILL_OPTIONS} />
            <NumberField label="Thickness (px)" min={1} max={8} value={line.thickness} onChange={(v: number) => setLine({ ...line, thickness: v || 2 })} />
          </VStack>
        </Card>
      )}

      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Data</H3>
          {rows.map((r, i) => (
            <HStack key={i} spacing={1} alignItems="flex-end">
              <TextField label={`Label ${i + 1}`} size="small" value={r.label} onChange={(e: { target: { value: string } }) => editRow(i, { label: e.target.value })} />
              <TextField label="Value" size="small" type="number" value={r.value} onChange={(e: { target: { value: string } }) => editRow(i, { value: e.target.value })} />
              {type !== 'line' && (
                <Select label="Color" mode="color" size="small" value={r.color} onChange={(v: string) => editRow(i, { color: v })} options={COLOR_OPTIONS} />
              )}
              <Button iconOnly variant="ghost" size="small" aria-label={`Remove ${r.label || `row ${i + 1}`}`} onClick={() => removeRow(i)}>
                <DeleteOutlineIcon />
              </Button>
            </HStack>
          ))}
          <Button variant="default-outline" size="small" onClick={addRow}>Add a row</Button>
        </VStack>
      </Card>
    </VStack>
  );

  const preview = (
    <Card padding="medium">
      <VStack spacing={2}>
        {/* Layout primitive only: the generated chart is injected here
            verbatim, so the preview is the code a user copies. */}
        <div ref={previewRef} style={{ overflowX: 'auto' }}>
          <style>{css}</style>
          {html
            ? <div dangerouslySetInnerHTML={{ __html: html }} />
            : <Body color="quiet">Fix the refusals below to see the chart.</Body>}
        </div>
        <FindingList findings={allFindings} />
      </VStack>
    </Card>
  );

  const body = (
    <VStack spacing={3} style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 16px' }}>
      <VStack spacing={1}>
        <H1>Charts</H1>
        <Body color="quiet">
          A one-off chart in your design system — as code, and as a Figma build from your own chart components.
        </Body>
      </VStack>

      {/* Layout primitive: picker and id field side by side, wrapping on narrow screens. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 340px', maxWidth: 460 }}>
          <TextField label="Design system ID" size="small" fullWidth value={idInput}
            placeholder="e.g. a2d6e6cf-d16a-4a6b-b4f6-8d4c282fb4f2"
            helperText={idClean && !idValid ? 'A design system ID looks like 8-4-4-4-12 hex characters — the Dino ID in the Omni Design plugin\'s Settings.' : undefined}
            onChange={(e: { target: { value: string } }) => setIdInput(e.target.value)}
            onKeyDown={(e: { key: string }) => { if (e.key === 'Enter') loadId(); }} />
        </div>
        <Button variant="default" size="small" onClick={loadId} disabled={!idValid || idClean.toLowerCase() === uuid}>
          Load
        </Button>
      </div>
      {systemCss && !systemCss.live && (
        <Alert color="warning"><BodySmall>{systemCss.reason}</BodySmall></Alert>
      )}

      {exists === false && (
        <Alert color="warning">
          <BodySmall>
            {uuid
              ? 'No design system has that ID, so the chart is drawn without a brand. Check the ID and load it again.'
              : 'Enter your design system ID to draw the chart in your brand — it is the Dino ID in the Omni Design plugin\'s Settings.'}
          </BodySmall>
        </Alert>
      )}

      <Tabs value={tab} onChange={(v: 'generate' | 'code' | 'figma') => setTab(v)}>
        <TabList aria-label="Charts add-on">
          <Tab value="generate">Generate</Tab>
          <Tab value="code">Code</Tab>
          <Tab value="figma">Export to Figma</Tab>
        </TabList>

        <TabPanel value="generate">
          {/* Layout primitive: controls and preview side by side. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', gap: 24, alignItems: 'start' }}>
            {controls}
            {preview}
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
            <Divider />
            <Caption color="quiet">These tokens are in the CSS of design systems published after they were added. An older system paints the Figma values as fallbacks until it is republished:</Caption>
            {CSS_GAPS.map((g) => <Caption key={g} color="quiet">• {g}</Caption>)}
          </VStack>
        </TabPanel>

        <TabPanel value="figma">
          <VStack spacing={2}>
            <Body>
              In Figma, open the <strong>Omni Design</strong> plugin, choose <strong>Charts</strong>, and paste this spec. It builds the chart from the file's
              own Bar, 3dBar and Wide-3dBar components, sets each bar's Chart-Colors mode, and checks the spec the same way this page does.
            </Body>
            {refused
              ? <Alert color="error"><BodySmall>This spec would be refused — fix the items on the Generate tab first.</BodySmall></Alert>
              : <CodeBlock code={exportSpec} language="JSON" maxHeight={420} />}
          </VStack>
        </TabPanel>
      </Tabs>
    </VStack>
  );

  if (exists !== true || !uuid || !systemCss) return body;

  return (
    <OmniDesignProvider {...systemCss.urls} defaultTheme="Default" defaultStyle="Modern" defaultSurface="Surface">
      {body}
    </OmniDesignProvider>
  );
}
