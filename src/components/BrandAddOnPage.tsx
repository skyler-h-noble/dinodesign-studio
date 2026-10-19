/**
 * Brand — upload a logo (with words) and a mark (without), saved to the
 * design system and drawn everywhere in one color that adapts to its surface.
 *
 * Each upload becomes an "ink" SVG (brandInk.ts): one shape in currentColor.
 * The preview draws it the way the code does — a CSS mask over the surface's
 * own brand color — on every theme and surface level, and in an AppBar, so
 * what is saved is what the Nav Designer, Share Images and the Figma plugin
 * will show. Favicons and app icons are the mark on a tile in the brand's
 * button colors.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router';
import {
  AppBar, Body, BodySmall, Button, Card, Caption, CodeBlock, DropZone, H3, HStack, Label, Alert,
  OmniDesignProvider, Section, Tab, TabList, TabPanel, Tabs, TextField, ToggleButtonGroup, VStack,
} from '@omni-design/components';
import AddOnTopNav from './addOns/AddOnTopNav';
import { systemExists } from '../utils/docs/systemCss';
import { liveSystemCss, type LiveSystemCss } from '../utils/addOns/charts/liveSystemCss';
import { useAuth } from '../contexts/AuthContext';
import { makeInk, type InkResult } from '../utils/addOns/brand/brandInk';
import {
  BRAND_CSS, BRAND_SPEC_VERSION, BRAND_SLOTS, BRAND_COLOR_TOKEN, ICON_SIZES, SOCIAL_SIZES, brandHTML, normalizeBrandMeta, svgDataUrl,
  type BrandColor, type BrandMeta, type BrandSlot,
} from '../utils/addOns/brand/brandSpec';
import { loadBrand, saveBrand } from '../utils/addOns/brand/brandStore';
import { buildBrandKit, buildIconSet, saveBlob, zipIconSet, type IconSet } from '../utils/addOns/brand/brandIcons';

const THEMES = ['Primary', 'Secondary', 'Tertiary', 'Neutral'] as const;
const LEVELS = ['Surface-Dimmest', 'Surface', 'Surface-Brightest'] as const;
const levelName = (l: string) => l.replace('Surface-', '').replace('Surface', 'Base');

type Slot = { ink: InkResult; original: string | null };

/** The ink drawn as the code draws it: a mask over the surface's brand color. */
function BrandInk({ svg, aspect, height, color, label }: { svg: string; aspect: number; height: number; color: BrandColor; label: string }) {
  return (
    // A span on purpose: this is the brand mark itself (role="img"), the same element the exported code uses.
    <span className="omni-brand" role="img" aria-label={label} style={{
      '--omni-brand-src': `url("${svgDataUrl(svg)}")`, '--omni-brand-aspect': String(aspect), '--omni-brand-height': `${height}px`,
      ...(color !== 'brand' ? { '--omni-brand-color': BRAND_COLOR_TOKEN[color] } : {}),
    } as CSSProperties} />
  );
}

export default function BrandAddOnPage() {
  const { uuid } = useParams<{ uuid?: string }>();
  const { user } = useAuth();
  const [exists, setExists] = useState<boolean | null>(null);
  const [systemCss, setSystemCss] = useState<LiveSystemCss | null>(null);
  useEffect(() => {
    let live = true;
    if (!uuid) { setExists(false); setSystemCss(null); return; }
    systemExists(uuid).then((ok) => { if (live) setExists(ok); });
    liveSystemCss(uuid).then((c) => { if (live) setSystemCss(c); });
    return () => { live = false; };
  }, [uuid]);

  const [tab, setTab] = useState<'build' | 'code' | 'icons'>('build');
  const [name, setName] = useState('');
  const [color, setColor] = useState<BrandColor>('brand');
  const [slots, setSlots] = useState<Record<BrandSlot, Slot | null>>({ logo: null, stacked: null, mark: null });
  const [busy, setBusy] = useState<BrandSlot | null>(null);
  const [errors, setErrors] = useState<Record<BrandSlot, string | null>>({ logo: null, stacked: null, mark: null });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  // The saved brand, when the system has one.
  useEffect(() => {
    let live = true;
    if (!uuid || !exists) return;
    loadBrand(uuid).then((b) => {
      if (!live || !b) return;
      setName(b.meta.name); setColor(b.meta.color);
      const saved = (slot: BrandSlot): Slot | null => {
        const svg = b[slot]; const m = b.meta[slot];
        return svg && m ? { ink: { svg, aspect: m.aspect, source: 'vector', note: 'Saved.' }, original: null } : null;
      };
      setSlots({ logo: saved('logo'), stacked: saved('stacked'), mark: saved('mark') });
      setDirty(false);
    });
    return () => { live = false; };
  }, [uuid, exists]);

  const upload = async (slot: BrandSlot, file: File | undefined) => {
    if (!file) return;
    setBusy(slot); setErrors((e) => ({ ...e, [slot]: null }));
    try {
      const ink = await makeInk(file);
      setSlots((s) => { if (s[slot]?.original) URL.revokeObjectURL(s[slot]!.original!); return { ...s, [slot]: { ink, original: URL.createObjectURL(file) } }; });
      setDirty(true); setStatus(null);
    } catch (e) { setErrors((er) => ({ ...er, [slot]: (e as Error).message })); }
    finally { setBusy(null); }
  };
  const remove = (slot: BrandSlot) => { setSlots((s) => ({ ...s, [slot]: null })); setDirty(true); setStatus(null); };

  const meta: BrandMeta = useMemo(() => normalizeBrandMeta({
    version: BRAND_SPEC_VERSION, name, color,
    logo: slots.logo ? { aspect: slots.logo.ink.aspect } : null,
    stacked: slots.stacked ? { aspect: slots.stacked.ink.aspect } : null,
    mark: slots.mark ? { aspect: slots.mark.ink.aspect } : null,
  }), [name, color, slots]);

  const save = async () => {
    if (!uuid) return;
    setStatus({ ok: true, text: 'Saving…' });
    try {
      await saveBrand(uuid, { meta, logo: slots.logo?.ink.svg || null, stacked: slots.stacked?.ink.svg || null, mark: slots.mark?.ink.svg || null });
      setDirty(false);
      setStatus({ ok: true, text: 'Saved to your design system. The Nav Designer, Share Images and the Figma plugin use it from here.' });
    } catch (e) {
      setStatus({ ok: false, text: `Not saved: ${(e as Error).message}` });
    }
  };

  /* ── Favicons: the mark (or the logo, if there is no mark) on the brand's button colors. */
  const probe = useRef<HTMLDivElement>(null);
  const [icons, setIcons] = useState<{ set: IconSet; urls: Record<string, string> } | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  // Square spaces want the squarest shape: the mark, else the stacked logo, else the logo.
  const iconInk = slots.mark?.ink.svg || slots.stacked?.ink.svg || slots.logo?.ink.svg || null;
  /* The kit's brand color: Header-Primary as it reads on the lightest surface,
     the background the kit's README tells people to use it on. */
  const brandProbe = useRef<HTMLDivElement>(null);
  const [kitBusy, setKitBusy] = useState(false);
  const downloadKit = async () => {
    const hex = (brandProbe.current && getComputedStyle(brandProbe.current).getPropertyValue('--Header-Primary').trim()) || '#333333';
    setKitBusy(true);
    try {
      const zip = await buildBrandKit(meta, { logo: slots.logo?.ink.svg, stacked: slots.stacked?.ink.svg, mark: slots.mark?.ink.svg }, hex);
      saveBlob(zip, `${(name || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand'}-kit.zip`);
    } finally { setKitBusy(false); }
  };
  useEffect(() => {
    if (tab !== 'icons' || !iconInk || !probe.current) return;
    let live = true;
    const cs = getComputedStyle(probe.current);
    const tile = cs.getPropertyValue('--Buttons-Primary-Button').trim() || '#333333';
    const ink = cs.getPropertyValue('--Buttons-Primary-Text').trim() || '#ffffff';
    const bg = cs.getPropertyValue('--Background').trim() || '#ffffff';
    buildIconSet(meta, iconInk, tile, ink, bg).then((set) => {
      if (!live) return;
      setIcons((prev) => {
        if (prev) Object.values(prev.urls).forEach((u) => URL.revokeObjectURL(u));
        return { set, urls: Object.fromEntries(Object.entries(set.previews).map(([k, b]) => [k, URL.createObjectURL(b)])) };
      });
      setIconError(null);
    }).catch((e) => live && setIconError((e as Error).message));
    return () => { live = false; };
  }, [tab, iconInk, meta, systemCss]);

  const codeHtml = useMemo(() => brandHTML(meta, { logo: '/brand/logo.svg', stacked: '/brand/stacked.svg', mark: '/brand/mark.svg' },
    { show: meta.logo && meta.mark ? 'responsive' : meta.logo ? 'logo' : meta.stacked ? 'stacked' : 'mark' }), [meta]);
  const footerHtml = useMemo(() => (meta.stacked ? brandHTML(meta, { stacked: '/brand/stacked.svg' }, { show: 'stacked', height: 64 }) : null), [meta]);
  const label = name || 'Your brand';

  const uploadCard = (slot: BrandSlot, title: string, help: string) => {
    const s = slots[slot];
    return (
      <Card padding="medium">
        <VStack spacing={1.5}>
          <H3>{title}</H3>
          <BodySmall color="quiet">{help}</BodySmall>
          <DropZone accept="image/svg+xml,image/png,image/jpeg,image/webp" size="small"
            label={busy === slot ? 'Reading…' : s ? 'Drop a new file to replace it' : 'Drop an SVG (best) or a PNG'}
            sublabel="SVG adapts best — it stays sharp, and keeps your shapes exactly"
            onFiles={(files: File[]) => upload(slot, files[0])} />
          {errors[slot] && <Alert color="warning"><BodySmall>{errors[slot]}</BodySmall></Alert>}
          {s && (
            <VStack spacing={1}>
              {/* Layout primitive: the file as uploaded beside the ink it became. */}
              <div style={{ display: 'grid', gridTemplateColumns: s.original ? '1fr 1fr' : '1fr', gap: 12, alignItems: 'center' }}>
                {s.original && (
                  <VStack spacing={0.5}>
                    <Caption color="quiet">Uploaded</Caption>
                    {/* An <img>, never inlined: an uploaded file is drawn as a picture only (brandAsset.ts). */}
                    <img src={s.original} alt="" style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain' }} />
                  </VStack>
                )}
                <VStack spacing={0.5}>
                  <Caption color="quiet">One color, adaptive</Caption>
                  <BrandInk svg={s.ink.svg} aspect={s.ink.aspect} height={slot === 'logo' ? 40 : 56} color={color} label={label} />
                </VStack>
              </div>
              <Caption color={s.ink.source === 'traced' ? 'warning' : 'quiet'}>{s.ink.note}</Caption>
              <div><Button variant="default-outline" size="small" onClick={() => remove(slot)}>Remove</Button></div>
            </VStack>
          )}
        </VStack>
      </Card>
    );
  };

  const controls = (
    <VStack spacing={3}>
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Brand</H3>
          <TextField label="Name" size="small" fullWidth value={name} helperText="Your site or company name — what a screen reader says for the logo, and your app's name on a phone."
            onChange={(e: { target: { value: string } }) => { setName(e.target.value); setDirty(true); }} />
          <VStack spacing={0.5}>
            <Label>Color</Label>
            <ToggleButtonGroup value={color} onChange={(v: string) => { if (v) { setColor(v as BrandColor); setDirty(true); } }} size="small" aria-label="Brand color">
              <Button value="brand" size="small">Brand color</Button>
              <Button value="neutral" size="small">Neutral</Button>
              <Button value="bw" size="small">Black &amp; white</Button>
            </ToggleButtonGroup>
            <Caption color="quiet">
              {color === 'brand'
                ? 'Each surface’s Header-Primary — your brand color, tuned on every surface to 3:1, the contrast a graphic needs.'
                : color === 'neutral'
                  ? 'Each surface’s Header color — the strongest neutral on that surface.'
                  : 'Black on light surfaces, white on dark ones — the most contrast there is.'}
            </Caption>
          </VStack>
          {!uuid ? (
            <Alert color="warning"><BodySmall>Use the settings cog at the top right to choose the design system to save this brand to.</BodySmall></Alert>
          ) : (
            <HStack spacing={1} alignItems="center">
              <Button variant="default" size="small" onClick={save} disabled={!exists || !BRAND_SLOTS.some((k) => slots[k]) || !dirty}>Save to my design system</Button>
              {!user && <Caption color="quiet">Saved with this browser&rsquo;s session.</Caption>}
            </HStack>
          )}
          {status && <Alert color={status.ok ? 'success' : 'warning'}><BodySmall>{status.text}</BodySmall></Alert>}
        </VStack>
      </Card>
      {uploadCard('logo', 'Logo — with words', 'Your full logo: the mark and the name together. Used in nav bars and footers where there is room.')}
      {uploadCard('stacked', 'Logo — stacked (optional)', 'A compact version, the mark above the name, for square-ish spaces: footers, business cards, invoices — and profile pictures when there is no mark.')}
      {uploadCard('mark', 'Mark — without words', 'The symbol on its own. Used on a phone, in a condensed nav, and for your favicon, app icons and profile pictures.')}
    </VStack>
  );

  const preview = (
    <VStack spacing={2}>
      {BRAND_SLOTS.some((k) => slots[k]) ? <>
        <Label>In a nav bar</Label>
        <AppBar>
          {/* Layout primitive: the brand where the bar's own brand slot sits. */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            {(() => { const s = slots.logo || slots.mark || slots.stacked!; return <BrandInk svg={s.ink.svg} aspect={s.ink.aspect} height={32} color={color} label={label} />; })()}
          </div>
        </AppBar>
        <Label>On every surface</Label>
        {/* Layout primitive: themes down, surface levels across. */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${LEVELS.length}, minmax(0, 1fr))`, gap: 8 }}>
          {THEMES.flatMap((t) => LEVELS.map((l) => (
            <Section key={t + l} theme={t} surface={l} padding="16px" style={{ borderRadius: 8, minWidth: 0 }}>
              <VStack spacing={1}>
                <Caption>{`${t} · ${levelName(l)}`}</Caption>
                <HStack spacing={2} alignItems="center" style={{ minWidth: 0 }}>
                  {slots.logo && <BrandInk svg={slots.logo.ink.svg} aspect={slots.logo.ink.aspect} height={24} color={color} label={label} />}
                  {slots.stacked && <BrandInk svg={slots.stacked.ink.svg} aspect={slots.stacked.ink.aspect} height={36} color={color} label={label} />}
                  {slots.mark && <BrandInk svg={slots.mark.ink.svg} aspect={slots.mark.ink.aspect} height={28} color={color} label={label} />}
                </HStack>
              </VStack>
            </Section>
          )))}
        </div>
        <BodySmall color="quiet">The same file on every surface: its color comes from the surface, so it keeps its contrast in light and dark mode too.</BodySmall>
      </> : (
        <Card padding="medium"><Body color="quiet">Upload your logo or mark to see it on your surfaces.</Body></Card>
      )}
    </VStack>
  );

  const codePanel = (
    <VStack spacing={2}>
      <BodySmall color="quiet">
        Download the SVGs to /brand/ on your site, add the CSS once, and put the HTML in your nav. With a logo and a mark, the logo shows where there is room and the mark on a phone.
      </BodySmall>
      <HStack spacing={1}>
        {BRAND_SLOTS.filter((k) => slots[k]).map((k) => (
          <Button key={k} variant="default-outline" size="small" onClick={() => saveBlob(new Blob([slots[k]!.ink.svg], { type: 'image/svg+xml' }), `${k}.svg`)}>{`Download ${k}.svg`}</Button>
        ))}
      </HStack>
      <Label>Nav bar</Label>
      <CodeBlock code={codeHtml} language="HTML" wrap />
      {footerHtml && <><Label>Footer</Label><CodeBlock code={footerHtml} language="HTML" wrap /></>}
      <CodeBlock code={BRAND_CSS} language="CSS" maxHeight={360} />
      <Card padding="medium">
        <VStack spacing={1.5}>
          <H3>Brand kit</H3>
          <BodySmall color="quiet">
            For places your design system cannot reach — print, decks, email signatures, partner pages, someone else&rsquo;s background:
            every shape in black, white and your brand color, as SVG and PNG, with a note on which to use where.
          </BodySmall>
          <div><Button variant="default" size="small" disabled={kitBusy || !BRAND_SLOTS.some((k) => slots[k])} onClick={downloadKit}>{kitBusy ? 'Making…' : 'Download brand kit (zip)'}</Button></div>
        </VStack>
      </Card>
    </VStack>
  );

  const iconsPanel = (
    <VStack spacing={2}>
      {!iconInk ? <Card padding="medium"><Body color="quiet">Upload your mark (or your logo) on the Build tab to make favicons and app icons.</Body></Card> : <>
        <BodySmall color="quiet">
          {slots.mark ? 'Your mark' : slots.stacked ? 'Your stacked logo (upload a mark for a cleaner small icon)' : 'Your logo (upload a mark for a cleaner small icon)'} on a tile in your primary button color, in its label color — a pair your system already makes readable.
        </BodySmall>
        {iconError && <Alert color="warning"><BodySmall>{iconError}</BodySmall></Alert>}
        {icons && <>
          {/* Layout primitive: each icon at its own size, with what it is for. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
            {ICON_SIZES.map((ic) => {
              const src = icons.urls[ic.file];
              return (
                <VStack key={ic.file} spacing={0.5} style={{ width: Math.max(64, Math.min(ic.size, 180)) }}>
                  {src && <img src={src} alt="" width={Math.min(ic.size, 180)} height={Math.min(ic.size, 180)} />}
                  <Caption>{ic.size <= 48 ? `${ic.size}px · in favicon.ico` : ic.file}</Caption>
                  <Caption color="quiet">{ic.purpose}</Caption>
                </VStack>
              );
            })}
          </div>
          <Label>Social profile pictures</Label>
          <BodySmall color="quiet">Square, cropped to a circle by every platform — the mark stays inside it.</BodySmall>
          {/* Layout primitive: each picture, shown in the circle it will be cropped to. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end' }}>
            {SOCIAL_SIZES.map((ic) => (
              <VStack key={ic.file} spacing={0.5} style={{ width: 120 }}>
                {icons.urls[ic.file] && <img src={icons.urls[ic.file]} alt="" width={120} height={120} style={{ borderRadius: '50%' }} />}
                <Caption>{`${ic.size} × ${ic.size}`}</Caption>
                <Caption color="quiet">{ic.purpose}</Caption>
              </VStack>
            ))}
          </div>
          <div><Button variant="default" size="small" onClick={async () => saveBlob(await zipIconSet(icons.set), 'favicons.zip')}>Download all (zip)</Button></div>
          <BodySmall color="quiet">Put the files at your site&rsquo;s root and these tags in the &lt;head&gt;:</BodySmall>
          <CodeBlock code={icons.set.headTags} language="HTML" />
          <CodeBlock code={icons.set.manifest} language="JSON" maxHeight={240} />
        </>}
      </>}
    </VStack>
  );

  const body = (
    <>
      <AddOnTopNav title="Brand" uuid={uuid} exists={exists} basePath="/add-ons/brand" />
      <VStack spacing={3} style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px 32px' }}>
        <Body color="quiet">Your logo and mark, in one color that adapts to every surface — for nav bars, footers, share images, favicons and app icons.</Body>
        {exists === false && uuid && <Alert color="warning"><BodySmall>No design system has that ID, so the brand cannot be saved or shown in your colors.</BodySmall></Alert>}
        <style>{BRAND_CSS}</style>
        {/* Reads the brand's button colors for the icons, from the system's own CSS. */}
        <div ref={probe} data-theme="Default" data-surface="Surface" hidden />
        <div ref={brandProbe} data-theme="Primary" data-surface="Surface-Brightest" hidden />
        <Tabs value={tab} onChange={(v: typeof tab) => setTab(v)}>
          <TabList aria-label="Brand">
            <Tab value="build">Build</Tab>
            <Tab value="code">Code</Tab>
            <Tab value="icons">Favicons &amp; app icons</Tab>
          </TabList>
          <TabPanel value="build">
            {/* Layout primitive: controls beside the preview. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
              {controls}
              {preview}
            </div>
          </TabPanel>
          <TabPanel value="code">{codePanel}</TabPanel>
          <TabPanel value="icons">{iconsPanel}</TabPanel>
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
