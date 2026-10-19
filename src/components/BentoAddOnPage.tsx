/**
 * Bento Grid — tiles on the layout grid, in the user's design system.
 *
 * Designed once at 12 columns; tablet (8) and phone (4) spans are derived and
 * can be overridden per tile. Every tile wears a theme + surface level, so its
 * text is that surface's own paired colors — accessible by construction. The
 * preview is the exported code, rendered on the system loaded by its ID, at
 * each breakpoint's real data-device, so what reflows here reflows on a page.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Body, BodySmall, Button, Card, VStack, HStack, Alert, Label, Caption, H3,
  Tabs, TabList, Tab, TabPanel, TextField, TextArea, Select, CodeBlock, ToggleButtonGroup, Checkbox, Link,
  OmniDesignProvider,
} from '@omni-design/components';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddOnTopNav, { ADD_ON_NAV_HEIGHT } from './addOns/AddOnTopNav';
import { DeviceSelector, BreakpointStage, bentoBreakpoints, useStageWidth, DEVICE_PREVIEW_CSS, type HeroPlatform } from './hero/DevicePreview';
import { systemExists } from '../utils/docs/systemCss';
import { libraryPageUrl } from '../utils/docs/docsLink';
import { liveSystemCss, type LiveSystemCss } from '../utils/addOns/charts/liveSystemCss';
import {
  normalizeBentoSpec, bentoSpan, bentoSuggest, bentoTouchingSame, bentoDistinctSurface, BENTO_COLUMNS, BENTO_SPEC_VERSION, BENTO_THEMES, BENTO_SURFACES, BENTO_DESKTOP_SPANS, BENTO_STARTER,
  type BentoTile, type BentoStyle,
} from '../utils/addOns/bento/bentoSpec';
import { bentoHTML, bentoCSS } from '../utils/addOns/bento/bentoCode';
import { extractBentoSpec, encodeBentoSpec } from '../utils/addOns/bento/bentoShare';
import { makeSampleImage } from '../utils/addOns/hero/heroSampleImage';

const SPAN_LABEL: Record<number, string> = { 3: '3 of 12 — a quarter', 4: '4 of 12 — a third', 6: '6 of 12 — half', 8: '8 of 12 — two thirds', 12: '12 of 12 — the full row' };
const surfaceName = (s: string) => s.replace('Surface-', '').replace('Surface', 'Base');
/** A folded tile's one line: its number, kind, words and desktop width. */
const tileSummary = (t: BentoTile, i: number, device: 'desktop' | 'tablet' | 'mobile') => {
  const words = t.kind === 'stat' ? t.stat : t.kind === 'image' ? (t.alt || 'decorative') : (t.title || t.eyebrow || 'untitled');
  return `Tile ${i + 1} · ${t.kind[0].toUpperCase()}${t.kind.slice(1)} · ${words} · ${bentoSpan(t, device)} of ${BENTO_COLUMNS[device]}`;
};

/* Studio-only: a tile's number on hover, in the inverse of its own surface
   pair (its Text as the fill, its Background as the label) so it always reads;
   and a brief flash on the settings a click jumps to. Never in the export. */
const BENTO_PREVIEW_CSS = `
[data-tile] { position: relative; cursor: pointer; }
[data-tile]:hover { outline: 2px solid var(--Text); outline-offset: -2px; }
[data-tile]:hover::after {
  content: 'Tile ' attr(data-tile); position: absolute; top: 12px; right: 12px; z-index: 2;
  padding: 4px 10px; border-radius: 999px; font: 600 14px/1.2 var(--Body-Font-Family, sans-serif);
  background: var(--Text); color: var(--Background); pointer-events: none;
}
/* Column guides: the device's own --Columns between its --Margin, with
   --Gutter between them — the grid every tile snaps to. Above the tiles,
   translucent, and never in the way of a click. */
.bento-show-columns .omni-bento { position: relative; }
.bento-show-columns .omni-bento::after {
  --c: var(--Columns, 12); --g: var(--Gutter, 32px);
  content: ''; position: absolute; top: 0; bottom: 0; z-index: 3; pointer-events: none;
  left: var(--Margin, 64px); right: var(--Margin, 64px);
  background: repeating-linear-gradient(to right,
    color-mix(in srgb, var(--Focus-Visible, #2563eb) 22%, transparent) 0,
    color-mix(in srgb, var(--Focus-Visible, #2563eb) 22%, transparent) calc((100% - (var(--c) - 1) * var(--g)) / var(--c)),
    transparent calc((100% - (var(--c) - 1) * var(--g)) / var(--c)),
    transparent calc((100% + var(--g)) / var(--c)));
}
/* Boxes have no margin or gutter, so the guides are the column edges. */
.bento-show-columns .omni-bento--boxes::after {
  left: 0; right: 0;
  background: repeating-linear-gradient(to right,
    color-mix(in srgb, var(--Focus-Visible, #2563eb) 60%, transparent) 0 1px,
    transparent 1px calc(100% / var(--c)));
}
.bento-tile-card { border-radius: 16px; transition: box-shadow 200ms ease; }
.bento-tile-card.is-flash { box-shadow: 0 0 0 3px var(--Focus-Visible); }
`;

export default function BentoAddOnPage() {
  const { uuid } = useParams<{ uuid?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exists, setExists] = useState<boolean | null>(null);
  const [systemCss, setSystemCss] = useState<LiveSystemCss | null>(null);
  useEffect(() => {
    const ds = searchParams.get('ds');
    if (!uuid && ds && /^[0-9a-f-]{36}$/i.test(ds)) navigate(`/add-ons/bento/${ds.toLowerCase()}`, { replace: true });
  }, [uuid, searchParams, navigate]);
  useEffect(() => {
    let live = true;
    if (!uuid) { setExists(false); setSystemCss(null); return; }
    systemExists(uuid).then((ok) => { if (live) setExists(ok); });
    liveSystemCss(uuid).then((c) => { if (live) setSystemCss(c); });
    return () => { live = false; };
  }, [uuid]);

  /* ── Settings ─────────────────────────────────────────────────────────── */
  const [tab, setTab] = useState<'build' | 'code' | 'export' | 'import'>('build');
  const [name, setName] = useState('Bento grid');
  const [rowHeight, setRowHeight] = useState(200);
  const [style, setStyle] = useState<BentoStyle>('cards');
  const [tiles, setTiles] = useState<BentoTile[]>(BENTO_STARTER);
  const [imageSrc, setImageSrc] = useState('');
  useEffect(() => { setImageSrc(makeSampleImage(800, 600)); }, []);

  const spec = useMemo(() => normalizeBentoSpec({ version: BENTO_SPEC_VERSION, name, designSystem: { id: uuid || null }, style, rowHeight, tiles }), [name, uuid, style, rowHeight, tiles]);
  const html = useMemo(() => bentoHTML(spec, imageSrc || 'your-image.jpg', { preview: true }), [spec, imageSrc]);
  const codeHtml = useMemo(() => bentoHTML(spec), [spec]);
  const css = useMemo(() => bentoCSS(), []);
  const exportSpec = useMemo(() => JSON.stringify(spec, null, 2), [spec]);
  const link = useMemo(() => `${window.location.origin}/add-ons/bento/${uuid || ''}#spec=${encodeBentoSpec(spec)}`, [spec, uuid]);

  /* Which tile cards are folded, by position — kept in step when tiles move. */
  const [collapsed, setCollapsed] = useState<boolean[]>([]);
  const toggleTile = (i: number) => setCollapsed((c) => { const out = [...c]; out[i] = !out[i]; return out; });
  const setTile = (i: number, patch: Partial<BentoTile>) => setTiles((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const moveTile = (i: number, d: number) => setTiles((ts) => {
    const j = i + d;
    if (j < 0 || j >= ts.length) return ts;
    const out = [...ts];
    [out[i], out[j]] = [out[j], out[i]];
    setCollapsed((c) => { const o = [...c]; [o[i], o[j]] = [o[j], o[i]]; return o; });
    return out;
  });
  const addTile = () => setTiles((ts) => (ts.length >= 16 ? ts : [...ts, normalizeBentoSpec({ tiles: [{ kind: 'text', title: 'A new tile', body: 'Say what it is about.', span: 4 }] }).tiles[0]]));
  const removeTile = (i: number) => {
    setTiles((ts) => ts.filter((_, j) => j !== i));
    setCollapsed((c) => c.filter((_, j) => j !== i));
  };
  /* Fill every row on tablet and phone: the widened spans become each tile's
     own tablet / phone setting, so they show in its menus and can be changed. */
  const [fitNote, setFitNote] = useState<string | null>(null);
  /* Suggest tablet and phone widths from each tile's content — half where it
     still reads well, the full row where it would not — then fill any gap. */
  const autoFit = () => {
    const t = bentoSuggest(tiles, 'tablet', rowHeight, style);
    const m = bentoSuggest(tiles, 'mobile', rowHeight, style);
    const halves = (spans: number[], cols: number) => spans.filter((n) => n < cols).length;
    setTiles(tiles.map((tile, i) => ({ ...tile, tabletSpan: t[i], mobileSpan: m[i] })));
    setFitNote(`Suggested from the content: ${halves(t, 8)} of ${tiles.length} tiles share a row on tablet, ${halves(m, 4)} on a phone; the rest need the full width to read well. Change any of them on their tabs.`);
  };
  const resetFit = () => { setTiles((ts) => ts.map((tile) => ({ ...tile, tabletSpan: null, mobileSpan: null }))); setFitNote('Tablet and phone follow the rule again.'); };

  /* ── Import ───────────────────────────────────────────────────────────── */
  const [loadText, setLoadText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const applySpec = (raw: unknown) => {
    const b = normalizeBentoSpec(raw);
    setName(b.name); setStyle(b.style); setRowHeight(b.rowHeight); setTiles(b.tiles); setCollapsed([]);
  };
  const loadBento = (t: string) => {
    try { applySpec(extractBentoSpec(t)); setLoadError(null); setLoadText(''); setTab('build'); }
    catch (e) { setLoadError((e as Error).message); }
  };
  useEffect(() => {
    if (/[#&]spec=/.test(window.location.hash)) {
      try { applySpec(extractBentoSpec(window.location.hash)); } catch { /* a broken link leaves the starter */ }
    }
  }, []);

  /* ── UI ───────────────────────────────────────────────────────────────── */
  /* Clicking a tile in the preview jumps to its settings and flashes them. */
  /* The device chosen in the tabs drives both columns: the preview draws it,
     and each tile's width control is that device's — 12, 8 or 4 columns. */
  /* No iOS / Android choice: the grid is the same on both, and the iOS type
     ramp stands in for both. */
  const [platform] = useState<HeroPlatform>('ios');
  const devices = useMemo(() => bentoBreakpoints(platform), [platform]);
  const [activeKey, setActiveKey] = useState('desktop');
  const activeDevice = devices.find((d) => d.key === activeKey) || devices[0];
  /* Which of the tile's three spans the device uses. A landscape tablet is a
     12-column grid, so it takes the desktop span, as in Figma. */
  const bentoDevice: 'desktop' | 'tablet' | 'mobile' = activeKey === 'tablet' ? 'tablet' : activeKey === 'mobile' ? 'mobile' : 'desktop';
  const cols = BENTO_COLUMNS[bentoDevice];
  const [stageRef, stageW] = useStageWidth();
  const [flash, setFlash] = useState<number | null>(null);
  const [showCols, setShowCols] = useState(false);
  /* Boxes have no gutter, so two touching tiles on the same theme and surface
     read as one block. Checked on the device being edited — tiles that touch
     on desktop may not on a phone, and the other way round. */
  const touching = useMemo(() => (style === 'boxes' ? bentoTouchingSame(tiles, bentoDevice) : []), [style, tiles, bentoDevice]);
  const separateTouching = () => setTiles((ts) => {
    let out = ts;
    for (const [, j] of bentoTouchingSame(ts, bentoDevice)) {
      if (bentoTouchingSame(out, bentoDevice).some(([, b]) => b === j)) {
        const surface = bentoDistinctSurface(out, j, bentoDevice);
        out = out.map((t, k) => (k === j ? { ...t, surface } : t));
      }
    }
    return out;
  });
  const goToTile = (target: EventTarget) => {
    const n = Number((target as HTMLElement).closest?.('[data-tile]')?.getAttribute('data-tile'));
    if (!n) return;
    setCollapsed((c) => { const o = [...c]; o[n - 1] = false; return o; });
    document.getElementById(`bento-tile-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFlash(n);
    window.setTimeout(() => setFlash((f) => (f === n ? null : f)), 1200);
  };
  const tileCard = (t: BentoTile, i: number) => (
    // Layout primitive: the anchor a preview click scrolls to.
    <div key={i} id={`bento-tile-${i + 1}`} className={'bento-tile-card' + (flash === i + 1 ? ' is-flash' : '')} style={{ scrollMarginTop: 8 }}>
    <Card padding="medium">
      <VStack spacing={1.5}>
        {/* Layout primitive: the tile's name and its order and remove controls. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Button iconOnly variant="ghost" size="small" aria-expanded={!collapsed[i]} aria-controls={`bento-tile-body-${i + 1}`}
            aria-label={collapsed[i] ? `Expand tile ${i + 1}` : `Collapse tile ${i + 1}`} onClick={() => toggleTile(i)}>
            {collapsed[i] ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          </Button>
          <Label style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {collapsed[i] ? tileSummary(t, i, bentoDevice) : `Tile ${i + 1}`}
          </Label>
          <Button iconOnly variant="ghost" size="small" aria-label={`Move tile ${i + 1} earlier`} disabled={i === 0} onClick={() => moveTile(i, -1)}><ArrowUpwardIcon /></Button>
          <Button iconOnly variant="ghost" size="small" aria-label={`Move tile ${i + 1} later`} disabled={i === tiles.length - 1} onClick={() => moveTile(i, 1)}><ArrowDownwardIcon /></Button>
          <Button iconOnly variant="ghost" size="small" aria-label={`Remove tile ${i + 1}`} disabled={tiles.length <= 1} onClick={() => removeTile(i)}><DeleteOutlineIcon /></Button>
        </div>
        {!collapsed[i] && <div id={`bento-tile-body-${i + 1}`} style={{ display: 'contents' }}>
        <ToggleButtonGroup value={t.kind} onChange={(v: string) => setTile(i, { kind: v as BentoTile['kind'] })} size="small" aria-label={`Tile ${i + 1} kind`}>
          <Button value="text" size="small">Text</Button>
          <Button value="stat" size="small">Stat</Button>
          <Button value="image" size="small">Image</Button>
        </ToggleButtonGroup>
        {t.kind === 'text' && <>
          <TextField label="Eyebrow" size="small" value={t.eyebrow} onChange={(e: { target: { value: string } }) => setTile(i, { eyebrow: e.target.value })} />
          <TextField label="Title" size="small" value={t.title} onChange={(e: { target: { value: string } }) => setTile(i, { title: e.target.value })} />
          <TextArea label="Body" rows={2} fullWidth value={t.body} onChange={(e: { target: { value: string } }) => setTile(i, { body: e.target.value })} />
          <TextField label="Link" size="small" value={t.action} helperText="Leave empty for no link." onChange={(e: { target: { value: string } }) => setTile(i, { action: e.target.value })} />
        </>}
        {t.kind === 'stat' && <>
          <TextField label="Figure" size="small" value={t.stat} onChange={(e: { target: { value: string } }) => setTile(i, { stat: e.target.value })} />
          <TextField label="What it measures" size="small" value={t.statLabel} onChange={(e: { target: { value: string } }) => setTile(i, { statLabel: e.target.value })} />
        </>}
        {t.kind === 'image' && (
          <TextField label="Describe the image" size="small" value={t.alt} helperText="Leave empty if it is decorative." onChange={(e: { target: { value: string } }) => setTile(i, { alt: e.target.value })} />
        )}
        {t.kind !== 'image' && (
          // Layout primitive: the tile's theme and surface, side by side.
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
            <Select label="Theme" size="small" fullWidth minWidth={0} value={t.theme}
              options={BENTO_THEMES.map((v) => ({ label: v, value: v }))} onChange={(v: string) => setTile(i, { theme: v as BentoTile['theme'] })} />
            <Select label="Surface" size="small" fullWidth minWidth={0} value={t.surface}
              options={BENTO_SURFACES.map((v) => ({ label: surfaceName(v), value: v }))} onChange={(v: string) => setTile(i, { surface: v as BentoTile['surface'] })} />
          </div>
        )}
        {/* One width control: the chosen device's, in its own columns. */}
        {bentoDevice === 'desktop' && (
          <Select label="Width (of 12 columns)" size="small" fullWidth value={String(t.span)}
            options={BENTO_DESKTOP_SPANS.map((n) => ({ label: SPAN_LABEL[n], value: String(n) }))} onChange={(v: string) => setTile(i, { span: Number(v) })} />
        )}
        {bentoDevice === 'tablet' && (
          <Select label="Width (of 8 columns)" size="small" fullWidth value={t.tabletSpan === null ? 'auto' : String(t.tabletSpan)}
            options={[{ label: `Auto — ${bentoSpan({ ...t, tabletSpan: null }, 'tablet')} of 8, from its desktop width`, value: 'auto' }, { label: '4 of 8 — half', value: '4' }, { label: '8 of 8 — the full row', value: '8' }]}
            onChange={(v: string) => setTile(i, { tabletSpan: v === 'auto' ? null : Number(v) })} />
        )}
        {bentoDevice === 'mobile' && (
          <Select label="Width (of 4 columns)" size="small" fullWidth value={t.mobileSpan === null ? 'auto' : String(t.mobileSpan)}
            options={[{ label: `Auto — ${bentoSpan({ ...t, mobileSpan: null }, 'mobile')} of 4, from its desktop width`, value: 'auto' }, { label: '2 of 4 — half', value: '2' }, { label: '4 of 4 — the full row', value: '4' }]}
            onChange={(v: string) => setTile(i, { mobileSpan: v === 'auto' ? null : Number(v) })} />
        )}
        {/* Layout primitive: rows. A phone keeps two rows only for images. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Caption color="quiet">Rows</Caption>
          <ToggleButtonGroup value={String(t.rows)} onChange={(v: string) => setTile(i, { rows: Number(v) })} size="small" aria-label={`Tile ${i + 1} rows`}>
            <Button value="1" size="small">1</Button>
            <Button value="2" size="small">2</Button>
          </ToggleButtonGroup>
          {bentoDevice === 'mobile' && t.kind !== 'image' && t.rows === 2 && <Caption color="quiet">One row on a phone</Caption>}
        </div>
        </div>}
      </VStack>
    </Card>
    </div>
  );

  const controls = (
    <VStack spacing={3}>
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Grid</H3>
          <TextField label="Name" size="small" value={name} onChange={(e: { target: { value: string } }) => setName(e.target.value)} />
          <VStack spacing={0.5}>
            <Caption color="quiet">Style</Caption>
            <ToggleButtonGroup value={style} onChange={(v: string) => v && setStyle(v as BentoStyle)} size="small" aria-label="Bento style">
              <Button value="cards" size="small">Cards</Button>
              <Button value="boxes" size="small">Boxes</Button>
            </ToggleButtonGroup>
            <Caption color="quiet">
              {style === 'cards'
                ? 'Cards with your gutter between them and your margin around them.'
                : 'Flush boxes, no gutter or margin — the surfaces tell one tile from the next.'}
            </Caption>
          </VStack>
          <Select label="Shortest row" size="small" fullWidth value={String(rowHeight)}
            options={[160, 200, 240, 280].map((n) => ({ label: `${n}px — rows grow to fit`, value: String(n) }))} onChange={(v: string) => setRowHeight(Number(v))} />
          <BodySmall color="quiet">
            {bentoDevice === 'desktop'
              ? (activeKey === 'desktop'
                ? <>Desktop has <strong>12 columns</strong>. Set each tile&rsquo;s width here; tablet (8) and phone (4) follow by rule until you set them on their tabs.</>
                : <>{activeDevice.label} has <strong>12 columns</strong>, like desktop, so it shows the desktop widths — set them here or on Desktop.</>)
              : <>{bentoDevice === 'tablet' ? 'Tablet' : 'A phone'} has <strong>{cols} columns</strong>. Each tile starts from its desktop width; set any of them here, or let Suggest lay them out from what each tile holds.</>}
          </BodySmall>
          {/* Layout primitive: the two fit actions side by side. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button variant="default" size="small" onClick={autoFit}>Suggest tablet &amp; phone layout</Button>
            <Button variant="default-outline" size="small" onClick={resetFit}>Reset to rule</Button>
          </div>
          {fitNote && <Caption color="quiet">{fitNote}</Caption>}
        </VStack>
      </Card>
      {touching.length > 0 && (
        <Alert color="warning">
          <VStack spacing={1}>
            <BodySmall>
              With no gutter, touching tiles on the same theme and surface read as one block:{' '}
              {touching.map(([a, b]) => `tiles ${a + 1} and ${b + 1}`).join(', ')}.
            </BodySmall>
            {/* Layout primitive: the fix, left-aligned under the message. */}
            <div><Button variant="default-outline" size="small" onClick={separateTouching}>Change their surfaces</Button></div>
          </VStack>
        </Alert>
      )}
      {/* Layout primitive: fold or open every tile card at once, above the tiles. */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginBottom: -8 }}>
        <Link onClick={() => setCollapsed(tiles.map(() => true))}>Collapse all</Link>
        <Link onClick={() => setCollapsed([])}>Expand all</Link>
      </div>
      {tiles.map(tileCard)}
      <Button variant="default-outline" size="small" onClick={addTile} disabled={tiles.length >= 16}>Add a tile</Button>
    </VStack>
  );

  const body = (
    <>
    <AddOnTopNav title="Bento Grid" uuid={uuid} exists={exists} basePath="/add-ons/bento" />
    <VStack spacing={3} style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px 32px' }}>
      <Body color="quiet">
        Feature tiles on your layout grid, in your design system — reflowing from 12 columns to 8 to 4, as code and as a Figma build.{' '}
        <Link href={libraryPageUrl('bento-grid', uuid)} target="_blank" rel="noopener">About the Bento Grid in the component library</Link>
      </Body>
      {exists === false && (
        <Alert color="warning"><BodySmall>
          {uuid ? 'No design system has that ID, so the grid is drawn without a brand.' : 'Use the settings cog at the top right to enter your design system ID and draw the grid in your brand — it is the Omni Design ID in the plugin’s Settings.'}
        </BodySmall></Alert>
      )}
      <style>{css + DEVICE_PREVIEW_CSS + BENTO_PREVIEW_CSS}</style>
      <Tabs value={tab} onChange={(v: typeof tab) => setTab(v)} sx={{ overflow: 'clip' }}>
        <TabList aria-label="Bento Grid">
          <Tab value="build">Build</Tab>
          <Tab value="code">Code</Tab>
          <Tab value="export">Export</Tab>
          <Tab value="import">Import</Tab>
        </TabList>
        <TabPanel value="build">
          <VStack spacing={1.5}>
            {/* The device first: both columns below are for it. */}
            {/* Layout primitive: the device, with Show columns at the end of the row.
                A segmented control, not tabs, so it does not read as a second
                tab bar under Build / Code / Export / Import. */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
              <DeviceSelector devices={devices} active={activeKey} onActive={setActiveKey} />
              <Checkbox variant="default" size="small" checked={showCols} label="Show columns"
                onChange={(e: { target: { checked: boolean } }) => setShowCols(e.target.checked)} />
            </div>
            {/* Layout primitive: two columns that scroll on their own, in an area
                the height of the window under the nav and the tabs — the
                settings and the preview can each be long, and neither should
                drag the other. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) minmax(0, 1fr)', gap: 24, height: `calc(100vh - ${ADD_ON_NAV_HEIGHT + 16 + 32 + 64}px)` }}>
              {/* A little room round the controls, so the ring on a tile a preview
                  click jumps to is not clipped by the scroll edge. */}
              <div style={{ overflowY: 'auto', minHeight: 0, padding: 6 }}>{controls}</div>
              {/* A click on a tile opens its settings; the badge says which it is. */}
              <div ref={stageRef} style={{ overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
                <div className={showCols ? 'bento-show-columns' : undefined} onClick={(e) => goToTile(e.target)}>
                  <BreakpointStage device={activeDevice} html={html} stageW={stageW} header />
                </div>
              </div>
            </div>
          </VStack>
        </TabPanel>
        <TabPanel value="code">
          <VStack spacing={2}>
            <BodySmall color="quiet">Load your design system&rsquo;s CSS on the page, then add this CSS once and the HTML where the grid goes. Replace your-image.jpg with your images.</BodySmall>
            <CodeBlock code={codeHtml} language="HTML" maxHeight={420} wrap />
            <CodeBlock code={css} language="CSS" maxHeight={420} />
            <BodySmall color="quiet">A link that reopens this grid here for editing:</BodySmall>
            <CodeBlock code={link} language="URL" wrap maxHeight={120} />
          </VStack>
        </TabPanel>
        <TabPanel value="export">
          <VStack spacing={2}>
            <Body>
              In Figma, open the <strong>Omni Design</strong> plugin, open the <strong>Add-ons</strong> tab, choose <strong>Bento Grid</strong>, and paste this spec.
              It builds one frame on your layout grid &mdash; {style === 'cards' ? 'each tile a Card, with your gutter and margin' : 'flush Boxes, no gutter or margin'} &mdash; each tile on its own surface.
              Change the frame&rsquo;s device type, size or page layout (beside a rail, say) and the tiles reflow on their own, so one frame covers every device.
            </Body>
            <CodeBlock code={exportSpec} language="JSON" maxHeight={420} />
          </VStack>
        </TabPanel>
        <TabPanel value="import">
          <div style={{ maxWidth: 560 }}>
            <Card padding="medium">
              <VStack spacing={2}>
                <H3>Import a bento</H3>
                <BodySmall color="quiet">
                  Edit a grid made with this add-on: paste its HTML, its spec, or its link. From Figma, select the bento and use <strong>Copy spec for the studio</strong> in the plugin — it reads the frame as it is now, so text, surfaces and widths changed in Figma come back with it. Only Omni bentos can be opened — they carry their own spec.
                </BodySmall>
                <TextArea label="Bento HTML, spec or link" rows={4} fullWidth value={loadText}
                  onChange={(e: { target: { value: string } }) => setLoadText(e.target.value)} />
                {loadError && <Alert color="warning"><BodySmall>{loadError}</BodySmall></Alert>}
                <HStack spacing={1}><Button variant="default-outline" size="small" onClick={() => loadBento(loadText)} disabled={!loadText.trim()}>Load</Button></HStack>
              </VStack>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
    </VStack>
    </>
  );

  if (exists !== true || !uuid || !systemCss) return body;
  return (
    <OmniDesignProvider {...systemCss.urls} defaultTheme="Default" defaultStyle="Modern" defaultSurface="Surface">
      {body}
    </OmniDesignProvider>
  );
}
