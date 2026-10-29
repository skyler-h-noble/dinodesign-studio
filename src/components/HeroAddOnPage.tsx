/**
 * Hero Generator — a hero in your design system, over a photo or a gradient.
 *
 * Two tabs, one per experiment it grew from:
 *   Over image     the photo is scanned under the text, and the overlay is the
 *                  lightest that still clears the contrast the type needs.
 *   Over gradient  stops are your own tones, and only ones that keep a single
 *                  text color readable across the whole fill can be picked.
 *
 * Like Charts, the preview is the exported code itself, rendered on the
 * system loaded by its ID (/add-ons/hero/<id>), so what you see is what you copy.
 *
 * The same page is the Share Images add-on (variant="share", /add-ons/share):
 * the hero at the fixed sizes a shared link's preview card is read at, with a
 * site name and no buttons, exported as PNGs, meta tags and a Figma spec. The
 * contrast solve is the hero's — it reads every rendered card, so one
 * background passes at every size.
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { toPng } from 'html-to-image';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  H3, Body, BodySmall, Button, Card, VStack, HStack, Alert, Label, Checkbox,
  Tabs, TabList, Tab, TabPanel, TextField, TextArea, NumberField, Select, CodeBlock, ButtonGroup,
  DropZone, OmniDesignProvider, Chip, ToggleButtonGroup, Caption, Link,
} from '@omni-design/components';
import AddOnTopNav, { ADD_ON_NAV_HEIGHT } from './addOns/AddOnTopNav';
import DeleteOutlineIcon from '@omni-design/icons/DeleteOutline';
import { systemExists } from '../utils/docs/systemCss';
import { liveSystemCss, type LiveSystemCss } from '../utils/addOns/charts/liveSystemCss';
import {
  normalizeHeroSpec, allowedTones, headlineWords, HERO_FAMILIES, HERO_HEADLINE_STYLES, HERO_BODY_STYLES, HERO_EYEBROW_STYLES, MESH_SPOTS, HERO_BUTTON_PALETTES, HERO_SPEC_VERSION, HERO_RATIOS, HERO_SURFACES,
  type HeroStop, type HeroFamily, type HeroRole, type HeroButtonPalette,
} from '../utils/addOns/hero/heroSpec';
import { heroHTML, heroCSS, meshBackground } from '../utils/addOns/hero/heroCode';
import {
  samplePhoto, solveOverlay, worstOverGradient, worstOverMesh, requiredRatio, cssToRgb, type RGB,
} from '../utils/addOns/hero/heroContrast';
import { makeSampleImage } from '../utils/addOns/hero/heroSampleImage';
import { extractHeroSpec, encodeHeroSpec } from '../utils/addOns/hero/heroShare';
import { toneToken } from '../utils/addOns/hero/heroCode';
import { AngleDial, GradientStopBar, AlignmentGrid, MeshPad, GRADIENT_CONTROLS_CSS } from './hero/GradientControls';
import {
  DeviceFrame, heroBreakpoints, DEVICE_PREVIEW_CSS, type HeroPlatform,
} from './hero/DevicePreview';
import {
  normalizeShareSpec, shareSafeSquare, SHARE_SIZES, SHARE_SPEC_VERSION, type ShareSizeKey,
} from '../utils/addOns/share/shareSpec';
import { shareCardHTML, shareMetaTags, SHARE_CSS } from '../utils/addOns/share/shareCode';
import { extractShareSpec, encodeShareSpec } from '../utils/addOns/share/shareShare';
import { loadBrand, type Brand } from '../utils/addOns/brand/brandStore';

const opts = (list: readonly string[]) => list.map((v) => ({ label: v.replace('-', ' '), value: v }));
/** "Bottom left", "Center", "Top right"… */
const posName = (v: string, h: string) => (v === 'center' && h === 'center' ? 'Center'
  : `${{ top: 'Top', center: 'Middle', bottom: 'Bottom' }[v]} ${h}`);
const TONE_OPTIONS = (allowed: number[]) => allowed.map((t) => ({ label: `Tone ${t}`, value: String(t) }));

/** A compact percent box — "100%" — for a stop's place or size. Digits are
 *  read from whatever is typed; the arrow keys nudge it (Shift for 10). */
function PercentField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const clampN = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <TextField aria-label={label} size="small" fullWidth value={`${value}%`} inputMode="numeric"
      onChange={(e: { target: { value: string } }) => {
        const n = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
        if (Number.isFinite(n)) onChange(clampN(n));
      }}
      onKeyDown={(e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clampN(value + step)); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clampN(value - step)); }
      }} />
  );
}

export default function HeroAddOnPage({ variant = 'hero' }: { variant?: 'hero' | 'share' } = {}) {
  const isShare = variant === 'share';
  const basePath = isShare ? '/add-ons/share' : '/add-ons/hero';
  const { uuid } = useParams<{ uuid?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [exists, setExists] = useState<boolean | null>(null);
  const [systemCss, setSystemCss] = useState<LiveSystemCss | null>(null);
  useEffect(() => {
    const ds = searchParams.get('ds');
    if (!uuid && ds && /^[0-9a-f-]{36}$/i.test(ds)) navigate(`${basePath}/${ds.toLowerCase()}`, { replace: true });
  }, [uuid, searchParams, navigate, basePath]);
  useEffect(() => {
    let live = true;
    if (!uuid) { setExists(false); setSystemCss(null); return; }
    systemExists(uuid).then((ok) => { if (live) setExists(ok); });
    liveSystemCss(uuid).then((c) => { if (live) setSystemCss(c); });
    return () => { live = false; };
  }, [uuid]);

  /* ── Settings ─────────────────────────────────────────────────────────── */
  const [mode, setMode] = useState<'image' | 'gradient'>('image');
  const [tab, setTab] = useState<'build' | 'code' | 'export' | 'import'>('build');
  // A share image has no buttons: a picture cannot be pressed.
  const [text, setText] = useState(isShare ? normalizeShareSpec({}).hero.text : normalizeHeroSpec({}).text);
  /* ── Share Images only ── */
  const [siteName, setSiteName] = useState(normalizeShareSpec({}).siteName);
  const [shareSizes, setShareSizes] = useState<ShareSizeKey[]>(SHARE_SIZES.map((z) => z.key));
  const [sharePage, setSharePage] = useState(normalizeShareSpec({}).page);
  const [shareKey, setShareKey] = useState<ShareSizeKey>('og');
  const [showSafe, setShowSafe] = useState(false);
  const [overflow, setOverflow] = useState<string[]>([]);
  /* The system's saved brand (the Brand add-on), for the share image's logo. */
  const [shareBrandChoice, setShareBrandChoice] = useState<'none' | 'logo' | 'stacked' | 'mark'>('none');
  const [savedBrand, setSavedBrand] = useState<Brand | null>(null);
  useEffect(() => {
    if (!isShare || !uuid) { setSavedBrand(null); return; }
    let live = true;
    loadBrand(uuid).then((b) => {
      if (!live) return;
      setSavedBrand(b);
      // A system with a brand shows it unless told otherwise.
      if (b) setShareBrandChoice((c) => (c !== 'none' ? c : b.logo ? 'logo' : b.mark ? 'mark' : 'none'));
    });
    return () => { live = false; };
  }, [isShare, uuid]);
  const brandInk = useMemo(() => (savedBrand ? {
    name: savedBrand.meta.name,
    logo: savedBrand.logo && savedBrand.meta.logo ? { svg: savedBrand.logo, aspect: savedBrand.meta.logo.aspect } : null,
    stacked: savedBrand.stacked && savedBrand.meta.stacked ? { svg: savedBrand.stacked, aspect: savedBrand.meta.stacked.aspect } : null,
    mark: savedBrand.mark && savedBrand.meta.mark ? { svg: savedBrand.mark, aspect: savedBrand.meta.mark.aspect } : null,
  } : null), [savedBrand]);
  const exportCardsRef = useRef<HTMLDivElement>(null);
  const [pngBusy, setPngBusy] = useState<string | null>(null);
  const [pngError, setPngError] = useState<string | null>(null);
  const [box, setBox] = useState({ heightMode: 'ratio' as 'screen' | 'ratio' | 'fixed', ratio: '21:9', height: 560 });
  const [platform, setPlatform] = useState<HeroPlatform>('ios');
  const choosePlatform = (p: HeroPlatform) => setPlatform(p);
  const devices = useMemo(() => heroBreakpoints(platform), [platform]);
  const [breakpoint, setBreakpoint] = useState('desktop');
  // The preview's width, for each tab's scale.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(800);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth || 800));
    ro.observe(el);
    return () => ro.disconnect();
    // The Build tab unmounts its preview on the other tabs; re-attach on return.
  }, [tab]);
  /* What the contrast solve re-runs on when the frames change: the devices
     for a hero, the sizes (and the site name, a line of text) for a share image. */
  const devicesKey = isShare ? `${shareSizes.join('/')}|${siteName ? 1 : 0}|${shareBrandChoice}` : devices.map((d) => `${d.width}x${d.height}m${d.margin}`).join('/');
  const [image, setImage] = useState(normalizeHeroSpec({}).image);
  const [gradient, setGradient] = useState(normalizeHeroSpec({}).gradient);
  const [imageSrc, setImageSrc] = useState<string>('');
  useEffect(() => { setImageSrc(makeSampleImage()); }, []);

  const spec = useMemo(() => normalizeHeroSpec({
    version: HERO_SPEC_VERSION, name: 'Hero', designSystem: { id: uuid || null },
    mode, ...box, text, image, gradient,
  }), [uuid, mode, box, text, image, gradient]);
  const share = useMemo(() => normalizeShareSpec({
    version: SHARE_SPEC_VERSION, name: 'Share image', designSystem: { id: uuid || null },
    hero: spec, siteName, sizes: shareSizes, page: sharePage, brand: shareBrandChoice,
  }), [uuid, spec, siteName, shareSizes, sharePage, shareBrandChoice]);
  const shareSizesShown = useMemo(() => SHARE_SIZES.filter((z) => share.sizes.includes(z.key)), [share.sizes]);
  const shareCards = useMemo(() => shareSizesShown.map((z) => ({ size: z, html: shareCardHTML(share, z, imageSrc || 'your-image.jpg', brandInk) })),
    [share, shareSizesShown, imageSrc, brandInk]);
  // A size that is switched off cannot stay the one on show.
  useEffect(() => { if (isShare && !share.sizes.includes(shareKey)) setShareKey(share.sizes[0]); }, [isShare, share.sizes, shareKey]);
  const html = useMemo(() => heroHTML(spec, imageSrc || 'your-image.jpg'), [spec, imageSrc]);
  const codeHtml = useMemo(() => heroHTML(spec), [spec]);
  const css = useMemo(() => heroCSS(), []);

  /* ── Contrast ─────────────────────────────────────────────────────────── */
  const previewRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{ ok: boolean; ratio: number; target: number; note: string } | null>(null);

  /** One rendered hero's tokens and text sizes, read off the preview. */
  const readHero = (hero: HTMLElement | null) => {
    if (!hero) return null;
    const cs = getComputedStyle(hero);
    const light = cssToRgb(cs.getPropertyValue('--BW-Color-1')) || { r: 255, g: 255, b: 255 };
    const dark = cssToRgb(cs.getPropertyValue('--BW-Color-6')) || { r: 4, g: 4, b: 4 };
    // The strictest element sets the bar: small text needs 4.5:1, large 3:1.
    const target = Math.max(...[...hero.querySelectorAll('.omni-hero__content > *')].map((el) => {
      const s = getComputedStyle(el);
      return requiredRatio(parseFloat(s.fontSize), Number(s.fontWeight) >= 700);
    }), 3);
    const hr = hero.getBoundingClientRect();
    // The area the lines actually cover — the content box is full width now,
    // and solving over empty space beside short lines would over-darken.
    const kids = [...hero.querySelectorAll('.omni-hero__content > *')].map((el) => el.getBoundingClientRect());
    const cr = kids.length
      ? { left: Math.min(...kids.map((k) => k.left)), top: Math.min(...kids.map((k) => k.top)), right: Math.max(...kids.map((k) => k.right)), bottom: Math.max(...kids.map((k) => k.bottom)) }
      : (hero.querySelector('.omni-hero__content') as HTMLElement).getBoundingClientRect();
    const textBox = { x: (cr.left - hr.left) / hr.width, y: (cr.top - hr.top) / hr.height, w: (cr.right - cr.left) / hr.width, h: (cr.bottom - cr.top) / hr.height };
    const device = isShare
      ? SHARE_SIZES.find((z) => z.key === hero.closest('[data-share]')?.getAttribute('data-share'))
      : devices.find((d) => d.key === hero.closest('[data-hero-device]')?.getAttribute('data-hero-device'));
    return { hero, cs, light, dark, target, textBox, frame: { w: hr.width, h: hr.height }, device: device ? device.label : '' };
  };
  /** Every device's hero: one spec has to pass on all of them. */
  const readHeroes = () => [...(previewRef.current?.querySelectorAll('.omni-hero') || [])]
    .map((h) => readHero(h as HTMLElement)).filter((r): r is NonNullable<ReturnType<typeof readHero>> => !!r);

  /* The loaded system, measured once (see the gradient section below). */
  type Level = { level: typeof HERO_SURFACES[number]; tone: number; header: RGB | null; text: RGB | null; eyebrow: RGB | null; alt: RGB | null;
    /** Each button palette's fill, outline and outline label on this level. */
    btns: Record<HeroButtonPalette, { btn: RGB | null; border: RGB | null; outlineText: RGB | null }> };
  type Pal = {
    tones: Record<string, (RGB | null)[]>;
    levels: Record<string, Level[]>;
    targets: { header: number | null; text: number | null; eyebrow: number | null; button: number | null };
    /** Black and white, the fallback for any role whose surface color fails. */
    bw: { light: RGB; dark: RGB };
  };
  const [pal, setPal] = useState<Pal | null>(null);

  // Over image: scan the photo under the text and solve the overlay.
  useEffect(() => {
    if (mode !== 'image' || !imageSrc) return;
    const img = new Image();
    let live = true;
    img.onload = () => {
      if (!live) return;
      const rs = readHeroes();
      if (!rs.length) return;
      /* Solved on every device and the strongest kept: each crops the photo
         differently and sets the text at its own size, and one overlay must
         clear all of them. More overlay only ever adds contrast, so the
         largest of the per-device answers passes everywhere. */
      const per = rs.map((r) => ({ r, samples: samplePhoto(img, { frameW: r.frame.w, frameH: r.frame.h, alignX: image.alignX, alignY: image.alignY, box: r.textBox }) }));
      /** The overlay a color needs at every breakpoint: the strongest of them. */
      const solveColor = (color: RGB, target: number, kind: 'solid' | 'gradient', overlayRgb: RGB) => {
        const each = per.map(({ r, samples }) => ({ r, ...solveOverlay(samples, overlayRgb, color, target, kind, text.v, text.h) }));
        const binding = each.reduce((a, b) => (b.alpha > a.alpha ? b : a));
        return { alpha: binding.alpha, ok: each.every((x) => x.ok), ratio: binding.ratio, target, device: binding.r.device };
      };
      const choices: ('light' | 'dark')[] = image.textColor === 'auto' ? ['light', 'dark'] : [image.textColor];
      const famRgb = (tone: number) => cssToRgb(rs[0].cs.getPropertyValue(`--${image.overlayFamily}-Color-${tone}`));
      const strictest = Math.max(...rs.map((r) => r.target));
      /* One candidate: a text side and an overlay tone (0 = black/white).
         The text wears a surface — the overlay family's theme, Neutral for
         black and white, at the level nearest the overlay's tone — and every
         role is solved in that surface's own color: Header, Text, Eyebrow and
         the buttons (fill and outline 3:1, outline label as text). A role
         whose color cannot clear the photo at any strength is black or white
         instead. The overlay is the strongest any role needs. */
      const candidate = (t: 'light' | 'dark', tone: number, kind: 'solid' | 'gradient') => {
        const overlayRgb = tone ? famRgb(tone)! : (t === 'light' ? rs[0].dark : rs[0].light);
        const bwText = t === 'light' ? rs[0].light : rs[0].dark;
        const theme = (image.overlayFamily === 'BW' || !tone ? 'Neutral' : image.overlayFamily) as HeroFamily;
        const levels = pal ? pal.levels[theme] : null;
        const level = !levels ? null : tone
          ? [...levels].sort((a, b) => Math.abs(a.tone - tone) - Math.abs(b.tone - tone))[0]
          : [...levels].sort((a, b) => (t === 'light' ? a.tone - b.tone : b.tone - a.tone))[0];
        const T = pal ? pal.targets : null;
        type ICheck = [RGB | null, number];
        const roles: { role: HeroRole; alts: { palette?: HeroButtonPalette; checks: ICheck[] }[] }[] = [];
        if (text.headline) roles.push({ role: 'headline', alts: [{ checks: [[level?.header ?? null, T?.header ?? strictest]] }] });
        if (text.body) roles.push({ role: 'body', alts: [{ checks: [[level?.text ?? null, T?.text ?? strictest]] }] });
        if (text.eyebrow) roles.push({ role: 'eyebrow', alts: [{ checks: [[level?.eyebrow ?? null, T?.eyebrow ?? strictest]] }] });
        if (text.primaryAction || text.secondaryAction) {
          // Each button palette in turn; the first that works over the photo is used.
          roles.push({ role: 'buttons', alts: HERO_BUTTON_PALETTES.map((P) => ({ palette: P, checks: [
            ...(text.primaryAction ? [[level?.btns[P].btn ?? null, 3] as ICheck] : []),
            ...(text.secondaryAction ? [[level?.btns[P].border ?? null, 3] as ICheck, [level?.btns[P].outlineText ?? null, T?.button ?? 4.5] as ICheck] : []),
          ] })) });
        }
        const bwRoles: HeroRole[] = [];
        let buttonPalette: HeroButtonPalette = 'Default';
        /* A surface color is kept only while it costs the photo little: at
           most 70% overlay, or no more than black/white would need anyway.
           Past that it would bury the photo for the sake of a tint. */
        const cost = (rs2: { alpha: number }[]) => Math.max(...rs2.map((x) => x.alpha));
        const results = roles.flatMap(({ role, alts }) => {
          const bwRes = alts[0].checks.map(([, tgt]) => solveColor(bwText, tgt, kind, overlayRgb));
          for (const alt of alts) {
            const themedRes = alt.checks.every(([c]) => c) ? alt.checks.map(([c, tgt]) => solveColor(c as RGB, tgt, kind, overlayRgb)) : null;
            if (themedRes && themedRes.every((x) => x.ok) && cost(themedRes) <= Math.max(0.7, cost(bwRes))) {
              if (alt.palette) buttonPalette = alt.palette;
              return themedRes;
            }
          }
          bwRoles.push(role);
          return bwRes;
        });
        const binding = results.length ? results.reduce((a, b) => (b.alpha > a.alpha ? b : a)) : { alpha: 0, ok: true, ratio: 21, target: 3, device: '' };
        return { t, kind, tone, theme, surface: level ? level.level : null, bwRoles, buttonPalette, alpha: binding.alpha, ok: results.every((x) => x.ok), ratio: binding.ratio, target: binding.target, device: binding.device };
      };
      type Cand = ReturnType<typeof candidate>;
      /* For one text side: black/white, or the chosen family's tones on the
         far side of the 5/6 line, most colorful first; the first that passes
         at 70% or less with the fewest roles dropped to BW wins, else the one
         needing the least overlay. */
      const forText = (t: 'light' | 'dark', kind: 'solid' | 'gradient'): Cand => {
        const bw = candidate(t, 0, kind);
        if (image.overlayFamily === 'BW') return bw;
        const tones = t === 'light' ? [5, 4, 3, 2, 1] : [6, 7, 8, 9, 10, 11, 12];
        const ok = tones.filter((tone) => famRgb(tone)).map((tone) => candidate(t, tone, kind)).filter((c) => c.ok);
        if (!ok.length) return bw;
        const fewest = Math.min(...ok.map((c) => c.bwRoles.length));
        const pool = ok.filter((c) => c.bwRoles.length === fewest);
        return pool.find((c) => c.alpha <= 0.7) || [...pool].sort((a, b) => a.alpha - b.alpha)[0];
      };
      const best = (kind: 'solid' | 'gradient') => choices.map((t) => forText(t, kind))
        .sort((a, b) => Number(b.ok) - Number(a.ok) || a.bwRoles.length - b.bwRoles.length || Number(b.tone > 0) - Number(a.tone > 0) || a.alpha - b.alpha)[0];
      let solved = best(image.overlay);
      /* A fading overlay is weakest at the top of the text; when the text
         reaches into something bright there, no strength of it passes. A
         solid one can, so it takes over rather than leaving a hero that fails
         — the note says what changed. */
      if (!solved.ok && image.overlay === 'gradient') {
        const flat = best('solid');
        if (flat.ok) solved = flat;
      }
      // Said every time it is true, not only on the run that switched.
      const switched = solved.kind === 'solid' && !best('gradient').ok;
      const next = { alpha: solved.alpha, solvedText: solved.t, overlay: solved.kind, overlayTone: solved.tone, theme: solved.theme, surface: solved.surface, bwRoles: solved.bwRoles, buttonPalette: solved.buttonPalette };
      if (JSON.stringify(next) !== JSON.stringify({ alpha: image.alpha, solvedText: image.solvedText, overlay: image.overlay, overlayTone: image.overlayTone, theme: image.theme, surface: image.surface, bwRoles: image.bwRoles, buttonPalette: image.buttonPalette })) {
        setImage((im) => ({ ...im, ...next }));
      }
      const surfaceNote = solved.surface
        ? `Text and buttons in ${solved.theme} on ${solved.surface.replace('-', ' ')}${solved.bwRoles.length ? ` — ${solved.bwRoles.join(', ')} in ${solved.t === 'light' ? 'white' : 'black'}, as ${solved.bwRoles.length > 1 ? 'their' : 'its'} surface color would need more overlay than this photo can spare` : ''}. `
        : '';
      const colorNote = image.overlayFamily === 'BW' ? ''
        : solved.tone ? `${image.overlayFamily} tone ${solved.tone}. `
        : `No ${image.overlayFamily} tone can clear this photo, so the overlay is ${solved.t === 'light' ? 'black' : 'white'}. `;
      setResult({
        ok: solved.ok, ratio: solved.ratio, target: solved.target,
        note: solved.ok
          ? `${colorNote}${surfaceNote}${switched ? 'Solid overlay — a fading one could not clear the bright part behind the top of the text. ' : ''}Overlay ${Math.round(solved.alpha * 100)}% — the lightest that passes at every ${isShare ? 'size' : 'breakpoint'}. ${solved.device} needs the most: ${solved.ratio.toFixed(2)}:1 at the worst pixel under the text (needs ${solved.target}:1).`
          : `Even a full overlay reaches only ${solved.ratio.toFixed(2)}:1 on ${solved.device} (needs ${solved.target}:1). Move the text, or choose the other text color.`,
      });
    };
    img.src = imageSrc;
    return () => { live = false; };
    // alpha / solvedText are outputs; leaving them out stops a solve loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, imageSrc, html, image.alignX, image.alignY, image.overlay, image.overlayFamily, image.textColor, systemCss, devicesKey, pal]);

  /* ── Over gradient: only colors that work ──────────────────────────────
     The rule from the gradient experiment, applied to the whole check: an
     unreadable gradient cannot be built, so nothing is ever reported as
     failing. The studio measures the loaded system once — each family's
     twelve tones, and each surface level's tone, Header, Text and Eyebrow —
     and from that every menu offers only the tones (and families) with which
     some surface level's Header, Text and Eyebrow all clear the whole fill. */
  useEffect(() => {
    // Both modes: over a photo the text wears a surface too.
    const t = window.setTimeout(() => {
      const rs = readHeroes();
      const r = rs[0];
      if (!r) return;
      const dist = (a: RGB, b: RGB) => (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
      const tones: Pal['tones'] = {}; const levels: Pal['levels'] = {};
      for (const fam of HERO_FAMILIES) {
        tones[fam] = Array.from({ length: 12 }, (_, i) => cssToRgb(r.cs.getPropertyValue(`--${fam}-Color-${i + 1}`)));
        levels[fam] = HERO_SURFACES.map((level) => {
          const d = document.createElement('div');
          d.setAttribute('data-theme', fam); d.setAttribute('data-surface', level);
          r.hero.appendChild(d);
          const cs = getComputedStyle(d);
          const read = (v: string) => cssToRgb(cs.getPropertyValue(v));
          const bg = read('--Background');
          const out = { level, tone: 0, header: read('--Header'), text: read('--Text'), eyebrow: read('--Eyebrow'), alt: read('--Alt-Display-Color'),
            btns: Object.fromEntries(HERO_BUTTON_PALETTES.map((P) => [P, {
              btn: read(`--Buttons-${P}-Button`),
              border: read(`--Buttons-${P}-Border`) || read(`--Buttons-${P}-Button`),
              outlineText: read(`--Buttons-${P}-Outline-Text`),
            }])) as Level['btns'] };
          d.remove();
          let best = Infinity;
          tones[fam].forEach((c, i) => { if (c && bg) { const dd = dist(c, bg); if (dd < best) { best = dd; out.tone = i + 1; } } });
          return out;
        });
      }
      // The strictest device sets each role's bar: a phone's smaller type can need 4.5:1 where desktop needs 3:1.
      const roleTarget = (sel: string) => {
        const ts = rs.map(({ hero }) => hero.querySelector(sel) as HTMLElement | null).filter((el): el is HTMLElement => !!el)
          .map((el) => { const cs = getComputedStyle(el); return requiredRatio(parseFloat(cs.fontSize), Number(cs.fontWeight) >= 700); });
        return ts.length ? Math.max(...ts) : null;
      };
      const next: Pal = { tones, levels, bw: { light: r.light, dark: r.dark }, targets: { header: roleTarget('.omni-hero__headline'), text: roleTarget('.omni-hero__body'), eyebrow: roleTarget('.omni-hero__eyebrow'), button: roleTarget('.omni-hero__button--outline') } };
      setPal((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    }, 80);
    return () => window.clearTimeout(t);
  }, [mode, systemCss, text.headlineStyle, text.bodyStyle, text.eyebrowStyle, !!text.eyebrow, !!text.body, !!text.headline, !!text.secondaryAction, devicesKey]);

  /** A gradient's best surface: the level closest to the first stop's tone
   *  whose Header, Text and Eyebrow all clear the whole fill — or null. */
  const fillRgbs = (stops: HeroStop[]) => stops.map((st) => ({ rgb: (pal && pal.tones[st.family][st.tone - 1]) || { r: 128, g: 128, b: 128 }, pos: st.pos, x: st.x, y: st.y, spread: st.spread }));
  /* Results remembered for as long as the system, the fill's kind and the
     hero's content stay the same. The menus test every family and tone, each
     test checks every level and button palette, and a mesh check samples the
     whole fill — recomputed each render, a few stops froze the page. */
  const memo = useMemo(() => ({ worst: new Map<string, number>(), surface: new Map<string, unknown>(), working: new Map<string, number[]>() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pal, gradient.variant, !!text.headline, !!text.body, !!text.eyebrow, !!text.primaryAction, !!text.secondaryAction]);
  const stopsKey = (stops: HeroStop[]) => stops.map((st) => `${st.family}${st.tone}@${st.pos},${st.x},${st.y},${st.spread}`).join('|');
  /** The worst contrast of a color against the whole fill, however it is painted. */
  const worstOver = (stops: HeroStop[], rgb: RGB) => {
    const key = `${stopsKey(stops)}#${rgb.r},${rgb.g},${rgb.b}`;
    let w = memo.worst.get(key);
    if (w === undefined) {
      w = gradient.variant === 'mesh' ? worstOverMesh(fillRgbs(stops), rgb) : worstOverGradient(fillRgbs(stops), rgb);
      memo.worst.set(key, w);
    }
    return w;
  };
  /** A gradient's best surface: the level closest to the first stop's tone
   *  whose Header, Text and Eyebrow — and its buttons, when the hero has
   *  them — all clear the whole fill. Or null. */
  const surfaceFor = (stops: HeroStop[]) => {
    const key = stopsKey(stops);
    if (memo.surface.has(key)) return memo.surface.get(key) as ReturnType<typeof surfaceForRaw>;
    const out = surfaceForRaw(stops);
    memo.surface.set(key, out);
    return out;
  };
  function surfaceForRaw(stops: HeroStop[]) {
    if (!pal) return null;
    const want = stops[0].tone;
    const T = pal.targets;
    // The fill's text side: white over tones 1-5, near-black over 6-12.
    const bw = stops[0].tone <= 5 ? pal.bw.light : pal.bw.dark;
    const options = pal.levels[stops[0].family].map((l) => {
      type Check = [string, RGB | null, number];
      const roles: { role: HeroRole; alts: { palette?: HeroButtonPalette; checks: Check[] }[] }[] = [];
      if (text.headline && T.header) roles.push({ role: 'headline', alts: [{ checks: [['Headline', l.header, T.header]] }] });
      if (text.body && T.text) roles.push({ role: 'body', alts: [{ checks: [['Body', l.text, T.text]] }] });
      if (text.eyebrow && T.eyebrow) roles.push({ role: 'eyebrow', alts: [{ checks: [['Eyebrow', l.eyebrow, T.eyebrow]] }] });
      if (text.primaryAction || text.secondaryAction) {
        // A button has to stand out from what it sits on: 3:1 for its fill or
        // its outline (WCAG non-text contrast); an outline button's label sits
        // on the fill itself, so it needs the text ratio too. Each palette is
        // tried in turn, and the first that works is the hero's.
        roles.push({ role: 'buttons', alts: HERO_BUTTON_PALETTES.map((P) => ({ palette: P, checks: [
          ...(text.primaryAction ? [[`${P} button`, l.btns[P].btn, 3] as Check] : []),
          ...(text.secondaryAction ? [[`${P} outline`, l.btns[P].border, 3] as Check, [`${P} outline label`, l.btns[P].outlineText, T.button || 4.5] as Check] : []),
        ] })) });
      }
      /* Each role in the surface's own color where that clears the whole
         fill, else in black or white. A level fails only if even black or
         white cannot — so the tone menus hide a tone only when nothing could
         make it readable, not because one color of the surface falls short. */
      const bwRoles: HeroRole[] = [];
      let buttonPalette: HeroButtonPalette = 'Default';
      let ok = true;
      const results = roles.flatMap(({ role, alts }) => {
        for (const alt of alts) {
          const themed = alt.checks.every(([, c]) => c) ? alt.checks.map(([name, c, target]) => ({ name, worst: worstOver(stops, c as RGB), target })) : null;
          if (themed && themed.every((x) => x.worst >= x.target)) { if (alt.palette) buttonPalette = alt.palette; return themed; }
        }
        const checks = alts[0].checks.map(([name, c, target]) => [name.replace(/^Default /, ''), c, target] as Check);
        bwRoles.push(role);
        const flat = checks.map(([name, , target]) => ({ name: `${name} (${stops[0].tone <= 5 ? 'white' : 'black'})`, worst: worstOver(stops, bw), target }));
        if (!flat.every((x) => x.worst >= x.target)) ok = false;
        return flat;
      });
      return { l, results, bwRoles, buttonPalette, ok, gap: Math.abs(l.tone - want) };
    }).filter((o) => o.ok).sort((x, y) => x.bwRoles.length - y.bwRoles.length || x.gap - y.gap);
    return options[0] || null;
  }
  const sideTones = (first: number) => allowedTones(first);
  /** Tones stop i may take, as things stand: on the first stop's side, and
   *  passing. For the first stop, any tone with which the gradient can pass. */
  const workingTones = (stops: HeroStop[], i: number, family = stops[i].family) => {
    const key = `${stopsKey(stops)}~${i}~${family}`;
    const hit = memo.working.get(key);
    if (hit) return hit;
    const cands = i === 0 ? Array.from({ length: 12 }, (_, k) => k + 1) : sideTones(stops[0].tone);
    const out = cands.filter((t) => {
      const trial = stops.map((st, j) => (j === i ? { ...st, family, tone: t } : st));
      if (i === 0) {
        /* A first tone works if the others can be placed beside it — and they
           always can when they match it, so the test is the fill in that one
           color. Exact, and one check per tone instead of re-placing every
           stop for each candidate (which took seconds per change). */
        return !!surfaceFor(stops.map((st) => ({ ...st, family, tone: t })));
      }
      return !!surfaceFor(trial);
    });
    memo.working.set(key, out);
    return out;
  };
  /** The stops with every later stop moved to its nearest working tone (and
   *  family, if none of its family's tones work). null if nothing can work. */
  function snapStops(stops: HeroStop[], tryFirst = true): HeroStop[] | null {
    if (!pal) return stops;
    let out = stops.map((st) => ({ ...st }));
    if (surfaceFor(out)) return out;
    for (let i = 1; i < out.length; i++) {
      const fams = [out[i].family, ...HERO_FAMILIES.filter((f) => f !== out[i].family)];
      let placed = false;
      for (const fam of fams) {
        const cands = sideTones(out[0].tone).filter((t) => !!surfaceFor(out.map((st, j) => (j === i ? { ...st, family: fam, tone: t } : st))));
        if (cands.length) {
          const t = cands.reduce((b, x) => (Math.abs(x - out[i].tone) < Math.abs(b - out[i].tone) ? x : b), cands[0]);
          out[i] = { ...out[i], family: fam, tone: t };
          placed = true;
          break;
        }
      }
      if (!placed) {
        // No color for this stop works beside the others: it takes the first stop's own.
        out[i] = { ...out[i], family: out[0].family, tone: out[0].tone };
      }
    }
    if (surfaceFor(out)) return out;
    if (!tryFirst) return null;
    // Last resort: the first stop moves to its nearest tone that can work.
    const firsts = Array.from({ length: 12 }, (_, k) => k + 1)
      .sort((x, y) => Math.abs(x - out[0].tone) - Math.abs(y - out[0].tone));
    for (const t of firsts) {
      const fixed = snapStops(out.map((st, j) => (j === 0 ? { ...st, tone: t } : st)), false);
      if (fixed && surfaceFor(fixed)) return fixed;
    }
    return null;
  }

  // Keep the stops on colors that work, and show the surface they take.
  useEffect(() => {
    if (mode !== 'gradient' || !pal) return;
    const fixed = snapStops(gradient.stops);
    if (fixed && JSON.stringify(fixed) !== JSON.stringify(gradient.stops)) {
      setGradient((g) => ({ ...g, stops: fixed }));
      return;
    }
    const best = surfaceFor(gradient.stops);
    if (!best) return;
    if (best.l.level !== gradient.surface || JSON.stringify(best.bwRoles) !== JSON.stringify(gradient.bwRoles) || best.buttonPalette !== gradient.buttonPalette) {
      setGradient((g) => ({ ...g, surface: best.l.level, bwRoles: best.bwRoles, buttonPalette: best.buttonPalette }));
    }
    /* Alt words take the surface's Alt color only where it clears the
       headline's bar over the whole fill; otherwise they keep the Header
       color and change face alone. Never offered, never warned. */
    const altOk = !best.bwRoles.includes('headline') && !!best.l.alt && !!pal.targets.header && worstOver(gradient.stops, best.l.alt) >= pal.targets.header;
    const altColor = altOk ? 'alt' : 'header';
    if (altColor !== text.altColor) setText((t) => ({ ...t, altColor }));
    setResult({
      ok: true, ratio: 0, target: 0,
      note: `${gradient.stops[0].family} theme on ${best.l.level.replace('-', ' ')} (tone ${best.l.tone}). `
        + best.results.map((x) => `${x.name} ${x.worst.toFixed(2)}:1`).join(' · ')
        + ' across the whole fill.'
        + (best.buttonPalette !== 'Default' && !best.bwRoles.includes('buttons') ? ` Buttons use the ${best.buttonPalette} palette, the first that works on this fill.` : '')
        + (best.bwRoles.length ? ` The surface's own ${best.bwRoles.join(', ')} color${best.bwRoles.length > 1 ? 's' : ''} would not clear this fill, so ${best.bwRoles.length > 1 ? 'they are' : 'it is'} ${gradient.stops[0].tone <= 5 ? 'white' : 'black'}.` : ''),
    });
    // gradient.surface is an output; leaving it out stops a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pal, gradient.stops, gradient.variant, text.altColor, !!text.primaryAction, !!text.secondaryAction]);

  /* ── Gradient stops ───────────────────────────────────────────────────── */
  const setStop = (i: number, patch: Partial<HeroStop>) => setGradient((g) => {
    const stops = g.stops.map((s, j) => (j === i ? { ...s, ...patch } : s));
    /* A new first tone leaves the later stops alone while it stays on the
       same side of the 5/6 line — they were chosen, and still sit on the
       right side. Only when it crosses (dark 1–5 ↔ light 6–12) does each
       later stop move, to its nearest tone on the new side. */
    const allowed = allowedTones(stops[0].tone);
    return { ...g, stops: stops.map((s, j) => (j === 0 || allowed.includes(s.tone) ? s
      : { ...s, tone: allowed.reduce((b, x) => (Math.abs(x - s.tone) < Math.abs(b - s.tone) ? x : b), allowed[0]) })) };
  });
  const addStop = () => setGradient((g) => (g.stops.length >= 5 ? g : {
    ...g, stops: [...g.stops.map((s, i) => ({ ...s, pos: i / g.stops.length })),
      { family: HERO_FAMILIES[g.stops.length % 4] as HeroFamily, tone: g.stops[0].tone, pos: 1, x: MESH_SPOTS[g.stops.length % 5][0], y: MESH_SPOTS[g.stops.length % 5][1], spread: 0.6 }],
  }));
  const [selectedStop, setSelectedStop] = useState(0);
  // A stop added on the bar lands where it was clicked, in the first stop's tone.
  const addStopAt = (pos: number) => setGradient((g) => (g.stops.length >= 5 ? g : {
    ...g, stops: [...g.stops, { family: HERO_FAMILIES[g.stops.length % 4] as HeroFamily, tone: g.stops[0].tone, pos, x: MESH_SPOTS[g.stops.length % 5][0], y: MESH_SPOTS[g.stops.length % 5][1], spread: 0.6 }],
  }));
  const removeStop = (i: number) => setGradient((g) => (g.stops.length <= 2 ? g : { ...g, stops: g.stops.filter((_, j) => j !== i) }));

  const exportSpec = useMemo(() => JSON.stringify(spec, null, 2), [spec]);

  /* The stop menus test every family and tone, which is too much to redo on
     every pointer move of a drag. They read the stops as they were 200ms
     after the last change — the fill, preview and contrast check stay live.
     A stop added or removed is read at once, so the rows always line up. */
  const [menuStops, setMenuStops] = useState(gradient.stops);
  useEffect(() => {
    const t = window.setTimeout(() => setMenuStops(gradient.stops), 200);
    return () => window.clearTimeout(t);
  }, [gradient.stops]);
  const stopsForMenus = menuStops.length === gradient.stops.length ? menuStops : gradient.stops;
  const heroLink = useMemo(() => `${window.location.origin}/add-ons/hero/${uuid || ''}#spec=${encodeHeroSpec(spec)}`, [spec, uuid]);

  /* ── Import: a hero back from its code, its spec, or a link ──────────── */
  const [loadText, setLoadText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const applySpec = (raw: unknown) => {
    if (isShare) {
      // A share spec, or a hero to start from: either way the hero part is the background and text.
      const sh = normalizeShareSpec(raw);
      setSiteName(sh.siteName); setShareSizes(sh.sizes); setSharePage(sh.page); setShareBrandChoice(sh.brand);
      raw = sh.hero;
    }
    const h = isShare ? normalizeShareSpec({ hero: raw }).hero : normalizeHeroSpec(raw);
    setMode(h.mode);
    setText(h.text);
    setBox({ heightMode: h.heightMode, ratio: h.ratio, height: h.height });
    // The photo is the user's own file and does not travel with the spec.
    setImage(h.image);
    setGradient(h.gradient);
  };
  const loadHero = (t: string) => {
    try { applySpec(isShare ? extractShareSpec(t) : extractHeroSpec(t)); setLoadError(null); setLoadText(''); setTab('build'); }
    catch (e) { setLoadError((e as Error).message); }
  };
  // Opened from Figma or a saved link: the spec rides in the fragment.
  useEffect(() => {
    if (/[#&]spec=/.test(window.location.hash)) {
      try { applySpec(isShare ? extractShareSpec(window.location.hash) : extractHeroSpec(window.location.hash)); } catch { /* a broken link leaves the defaults */ }
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── UI ───────────────────────────────────────────────────────────────── */
  const contentCard = (
    <Card padding="medium">
      <VStack spacing={2}>
        <H3>Text</H3>
        <TextField label="Eyebrow" size="small" value={text.eyebrow} onChange={(e: { target: { value: string } }) => setText({ ...text, eyebrow: e.target.value })} />
        <TextField label="Headline" size="small" value={text.headline} onChange={(e: { target: { value: string } }) => setText({ ...text, headline: e.target.value })} />
        {/* Gradient only: over a photo the text is one solved BW color, and a second face has no place in it. */}
        {mode === 'gradient' && headlineWords(text.headline).length > 0 && (
          <VStack spacing={0.5}>
            <Label>Words in Display-Alt</Label>
            {/* Layout primitive: the headline's words, wrapping. */}
            <div role="group" aria-label="Headline words set in Display-Alt" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {headlineWords(text.headline).map((w, i) => (
                <Chip key={i} label={w} size="small" selectionMode="checkbox" selected={text.altWords.includes(i)}
                  onClick={() => setText((t) => ({ ...t, altWords: t.altWords.includes(i) ? t.altWords.filter((x) => x !== i) : [...t.altWords, i].sort((a, b) => a - b) }))} />
              ))}
            </div>
            <BodySmall color="quiet">Chosen words take your Alt Display face at the headline&rsquo;s size.</BodySmall>
          </VStack>
        )}
        <TextArea label="Body" rows={3} fullWidth value={text.body} onChange={(e: { target: { value: string } }) => setText({ ...text, body: e.target.value })} />
        <Select label="Headline style" size="small" fullWidth value={text.headlineStyle} options={opts(HERO_HEADLINE_STYLES)}
          onChange={(v: string) => setText({ ...text, headlineStyle: v as typeof text.headlineStyle })} />
        <Select label="Body style" size="small" fullWidth value={text.bodyStyle} options={opts(HERO_BODY_STYLES)}
          onChange={(v: string) => setText({ ...text, bodyStyle: v as typeof text.bodyStyle })} />
        <Select label="Eyebrow style" size="small" fullWidth value={text.eyebrowStyle} options={opts(HERO_EYEBROW_STYLES)}
          onChange={(v: string) => setText({ ...text, eyebrowStyle: v as typeof text.eyebrowStyle })} />
        {isShare ? <>
          <TextField label="Site name" size="small" value={siteName} helperText="The last line of the text — your site or brand. Leave empty for none."
            onChange={(e: { target: { value: string } }) => setSiteName(e.target.value)} />
          <VStack spacing={0.5}>
            <Label>Logo</Label>
            <ToggleButtonGroup value={shareBrandChoice} onChange={(v: string) => v && setShareBrandChoice(v as typeof shareBrandChoice)} size="small" aria-label="Logo">
              <Button value="none" size="small">None</Button>
              <Button value="logo" size="small" disabled={!brandInk?.logo}>Logo</Button>
              <Button value="stacked" size="small" disabled={!brandInk?.stacked}>Stacked</Button>
              <Button value="mark" size="small" disabled={!brandInk?.mark}>Mark</Button>
            </ToggleButtonGroup>
            <BodySmall color="quiet">
              {brandInk && (brandInk.logo || brandInk.stacked || brandInk.mark)
                ? 'Your saved brand, above the text, in the headline’s color — the contrast solved for the text covers it.'
                : <>Save your logo in the <Link href={`/add-ons/brand${uuid ? `/${uuid}` : ''}`}>Brand add-on</Link> to show it here.</>}
            </BodySmall>
          </VStack>
        </> : <>
          <TextField label="Button" size="small" value={text.primaryAction} helperText="Leave empty for no button."
            onChange={(e: { target: { value: string } }) => setText({ ...text, primaryAction: e.target.value })} />
          <TextField label="Second button (outline)" size="small" value={text.secondaryAction} helperText="Leave empty for no second button."
            onChange={(e: { target: { value: string } }) => setText({ ...text, secondaryAction: e.target.value })} />
        </>}
      </VStack>
    </Card>
  );

  const layoutCard = (
    <Card padding="medium">
      <VStack spacing={2}>
        <H3>Layout</H3>
        <VStack spacing={0.5}>
          <Label>Text position</Label>
          <HStack spacing={1.5} alignItems="center">
            <AlignmentGrid label="Text position" v={text.v} h={text.h} onChange={(v, h) => setText({ ...text, v, h })} />
            <BodySmall color="quiet">{posName(text.v, text.h)}</BodySmall>
          </HStack>
        </VStack>
        <VStack spacing={0.5}>
          <Label>Height</Label>
          <ButtonGroup value={box.heightMode} onChange={(v: string) => setBox({ ...box, heightMode: v as typeof box.heightMode })} size="small">
            <Button value="screen" size="small">Full screen</Button>
            <Button value="ratio" size="small">Ratio</Button>
            <Button value="fixed" size="small">Fixed</Button>
          </ButtonGroup>
        </VStack>
        {box.heightMode === 'ratio' && (
          <Select label="Shape" size="small" fullWidth value={box.ratio} onChange={(v: string) => setBox({ ...box, ratio: v })}
            options={HERO_RATIOS.map((r) => ({ label: r, value: r }))} />
        )}
        {box.heightMode === 'fixed' && (
          <NumberField label="Height (px)" min={160} max={2000} step={10} value={box.height} onChange={(v: number) => setBox({ ...box, height: v || 560 })} />
        )}
        <BodySmall color="quiet">
          Always the full width of its container. {box.heightMode === 'screen' ? 'At least the height of the screen.' : box.heightMode === 'ratio' ? 'Keeps its shape as it scales, and grows if the text needs more room.' : 'At least this tall; taller if the text needs it.'}
        </BodySmall>
        <BodySmall color="quiet">The space around the text is each device&rsquo;s margin from your design system — 64 on desktop, 24 on tablets, 16 on phones by default.</BodySmall>
      </VStack>
    </Card>
  );

  const sizesCard = (
    <Card padding="medium">
      <VStack spacing={2}>
        <H3>Sizes</H3>
        <VStack spacing={0.5}>
          <Label>Text position</Label>
          <HStack spacing={1.5} alignItems="center">
            <AlignmentGrid label="Text position" v={text.v} h={text.h} onChange={(v, h) => setText({ ...text, v, h })} />
            <BodySmall color="quiet">{posName(text.v, text.h)}</BodySmall>
          </HStack>
        </VStack>
        {SHARE_SIZES.map((z) => (
          <VStack key={z.key} spacing={0.25}>
            <Checkbox variant="default" size="small" label={`${z.label} · ${z.w} × ${z.h}`} checked={shareSizes.includes(z.key)}
              disabled={shareSizes.length === 1 && shareSizes.includes(z.key)}
              onChange={(e: { target: { checked: boolean } }) => setShareSizes((ks) => SHARE_SIZES.map((x) => x.key)
                .filter((k) => (k === z.key ? e.target.checked : ks.includes(k))))} />
            <Caption color="quiet">{z.readBy}</Caption>
          </VStack>
        ))}
        <BodySmall color="quiet">
          Most apps read one image, the link preview: Facebook, LinkedIn, X, Slack, Discord, iMessage, WhatsApp and Teams all show it.
          Some crop it to a square thumbnail, so keep the words inside the middle square — turn on its guide above the preview.
          Drawn at desktop size, with your desktop margin and type.
        </BodySmall>
      </VStack>
    </Card>
  );

  const imageCard = (
    <Card padding="medium">
      <VStack spacing={2}>
        <H3>Photo</H3>
        <DropZone accept="image/*" size="small" label="Drop a photo" sublabel="or click to choose one"
          onFiles={(files: File[]) => { const f = files[0]; if (f) setImageSrc(URL.createObjectURL(f)); }} />
        <VStack spacing={0.5}>
          <Label>Photo crop</Label>
          <HStack spacing={1.5} alignItems="center">
            <AlignmentGrid label="Photo crop" v={image.alignY} h={image.alignX} onChange={(v, h) => setImage({ ...image, alignY: v, alignX: h })} />
            <BodySmall color="quiet">Keeps the {posName(image.alignY, image.alignX).toLowerCase()} of the photo in view when it is cropped to the hero.</BodySmall>
          </HStack>
        </VStack>
        <Select label="Overlay" size="small" fullWidth value={image.overlay}
          options={[{ label: 'Gradient — strongest at the text', value: 'gradient' }, { label: 'Solid', value: 'solid' }]}
          onChange={(v: string) => setImage({ ...image, overlay: v as typeof image.overlay })} />
        <Select label="Overlay color" size="small" fullWidth value={image.overlayFamily}
          options={[{ label: 'Black & white', value: 'BW' }, ...HERO_FAMILIES.map((f) => ({ label: f, value: f }))]}
          onChange={(v: string) => setImage({ ...image, overlayFamily: v as typeof image.overlayFamily })} />
        <BodySmall color="quiet">Pick a color and the tone is chosen for you — the most colorful one that keeps the text readable with the photo still showing.</BodySmall>
        <VStack spacing={0.5}>
          <Label>Text color</Label>
          <ButtonGroup value={image.textColor} onChange={(v: string) => setImage({ ...image, textColor: v as typeof image.textColor })} size="small">
            <Button value="auto" size="small">Auto</Button>
            <Button value="light" size="small">Light</Button>
            <Button value="dark" size="small">Dark</Button>
          </ButtonGroup>
        </VStack>
      </VStack>
    </Card>
  );

  const gradientCard = (
    <Card padding="medium">
      <VStack spacing={2}>
        <H3>Gradient</H3>
        <VStack spacing={1.5} alignItems="flex-start">
          <ToggleButtonGroup aria-label="Gradient shape" value={gradient.variant} onChange={(v: string) => setGradient({ ...gradient, variant: v as typeof gradient.variant })} size="small">
            <Button value="linear" size="small">Linear</Button>
            <Button value="radial" size="small">Radial</Button>
            <Button value="mesh" size="small">Mesh</Button>
          </ToggleButtonGroup>
          {gradient.variant === 'linear' && (
            // Layout primitive: the angle block, with room above and below.
            <div style={{ padding: '8px 0 12px' }}>
              <VStack spacing={0.75} alignItems="flex-start">
                <Label>Angle</Label>
                <HStack spacing={1.5} alignItems="center">
                  <div style={{ width: 96 }}>
                    <NumberField aria-label="Angle in degrees" size="small" min={0} max={359} step={1} value={Math.round(gradient.angle)}
                      onChange={(v: number) => setGradient({ ...gradient, angle: ((v ?? 0) % 360 + 360) % 360 })} />
                  </div>
                  <AngleDial value={gradient.angle} onChange={(deg) => setGradient((g) => ({ ...g, angle: deg }))} label="Gradient angle" />
                </HStack>
              </VStack>
            </div>
          )}
        </VStack>

        {gradient.variant === 'mesh' ? (
          <MeshPad
            background={meshBackground(spec)}
            // Stop 1 is the ground and has no place; the pad moves the blobs.
            blobs={gradient.stops.slice(1).map((st, i) => ({ x: st.x, y: st.y, spread: st.spread, color: toneToken(st.family, st.tone), label: `Stop ${i + 2}` }))}
            selected={selectedStop - 1}
            onSelect={(i) => setSelectedStop(i + 1)}
            onMove={(i, x, y) => setStop(i + 1, { x, y })}
          />
        ) : (
          <GradientStopBar
            stops={gradient.stops.map((st, i) => ({ pos: st.pos, color: toneToken(st.family, st.tone), label: `Stop ${i + 1}` }))}
            selected={selectedStop}
            onSelect={setSelectedStop}
            onMove={(i, pos) => setStop(i, { pos: Math.round(pos * 100) / 100 })}
            onAdd={addStopAt}
            canAdd={gradient.stops.length < 5}
          />
        )}

        <Label>Stops</Label>
        {gradient.stops.map((st, i) => (
          // Layout primitive: one stop on one line — swatch, family, tone,
          // place (or size, in a mesh), remove.
          <div key={i} className="hero-stop" onFocusCapture={() => setSelectedStop(i)}
            style={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1.35fr) minmax(0, 1fr) 58px 24px', gap: 6, alignItems: 'center' }}>
            <span className={'hero-swatch' + (i === selectedStop ? ' is-selected' : '')} style={{ background: toneToken(st.family, st.tone) }} aria-hidden="true" />
            <Select aria-label={`Stop ${i + 1} color family`} size="medium" fullWidth minWidth={0} value={st.family}
              options={opts(HERO_FAMILIES.filter((f) => f === st.family || !pal || workingTones(stopsForMenus, i, f).length > 0))}
              onChange={(v: string) => setStop(i, { family: v as HeroFamily })} />
            <Select aria-label={`Stop ${i + 1} tone`} size="medium" fullWidth minWidth={0} value={String(st.tone)}
              options={TONE_OPTIONS(pal ? workingTones(stopsForMenus, i) : (i === 0 ? Array.from({ length: 12 }, (_, k) => k + 1) : allowedTones(gradient.stops[0].tone)))}
              onChange={(v: string) => setStop(i, { tone: Number(v) })} />
            {gradient.variant === 'mesh' && i === 0 ? (
              <Caption color="quiet">Ground</Caption>
            ) : (
              <PercentField
                label={gradient.variant === 'mesh' ? `Stop ${i + 1} size, percent of the hero` : `Stop ${i + 1} position, percent`}
                value={Math.round((gradient.variant === 'mesh' ? st.spread : st.pos) * 100)}
                min={gradient.variant === 'mesh' ? 15 : 0} max={gradient.variant === 'mesh' ? 150 : 100}
                onChange={(n) => setStop(i, gradient.variant === 'mesh' ? { spread: n / 100 } : { pos: n / 100 })} />
            )}
            <Button iconOnly variant="ghost" size="small" aria-label={`Remove stop ${i + 1}`} disabled={gradient.stops.length <= 2} onClick={() => removeStop(i)}>
              <DeleteOutlineIcon />
            </Button>
          </div>
        ))}
        <Button variant="default-outline" size="small" onClick={addStop} disabled={gradient.stops.length >= 5}>Add a stop</Button>
        <BodySmall color="quiet">
          {gradient.variant === 'mesh' ? 'The first stop is the ground; drag the others on the pad and set each one\u2019s size.' : 'Drag the handles, or click the bar to add a stop.'} The hero takes your design system&rsquo;s own surface
          for the first stop&rsquo;s tone, and the menus offer only colors that keep its Header, Text, Eyebrow and buttons
          readable across the whole fill — so every gradient you can make passes.
        </BodySmall>
      </VStack>
    </Card>
  );

  const shareStageW = Math.max(240, stageW);
  const sharePreview = (
    <VStack spacing={2}>
      <style>{css + DEVICE_PREVIEW_CSS + SHARE_CSS}</style>
      {/* Layout primitive only: each card is the share image's HTML, drawn at
          its real size and scaled to fit, so the PNG is exactly what shows. */}
      <div ref={previewRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Layout primitive: the size tabs, and the square guide beside them. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs value={shareKey} onChange={(v: ShareSizeKey) => setShareKey(v)}>
            <TabList aria-label="Size">
              {shareSizesShown.map((z) => (
                <Tab key={z.key} value={z.key}>{`${z.label} · ${z.w} × ${z.h}`}</Tab>
              ))}
            </TabList>
          </Tabs>
          {shareKey === 'og' && (
            <Checkbox variant="default" size="small" label="Show square crop" checked={showSafe}
              onChange={(e: { target: { checked: boolean } }) => setShowSafe(e.target.checked)} />
          )}
        </div>
        <div ref={stageRef} style={{ position: 'relative' }}>
          {shareCards.map(({ size: z, html: cardHtml }) => {
            // Tall cards are capped at the stage's height budget rather than its width.
            const scale = Math.min(1, shareStageW / z.w, 640 / z.h);
            const shown = z.key === shareKey;
            const safe = shareSafeSquare(z);
            return (
              <div key={z.key} aria-hidden={!shown || undefined}
                style={shown ? { width: z.w * scale, height: z.h * scale, position: 'relative', margin: '0 auto' }
                  : { position: 'absolute', top: 0, left: 0, width: z.w * scale, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
                <div style={{ width: z.w, height: z.h, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
                  dangerouslySetInnerHTML={{ __html: cardHtml }} />
                {shown && showSafe && z.key === 'og' && (
                  // Layout primitive: the square-crop guide over the card.
                  <div aria-hidden="true" style={{ position: 'absolute', top: safe.y * scale, left: safe.x * scale, width: safe.w * scale, height: safe.h * scale,
                    outline: '2px dashed var(--Focus-Visible)', boxShadow: '0 0 0 9999px color-mix(in srgb, var(--Background) 45%, transparent)', pointerEvents: 'none' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {overflow.length > 0 && (
        <Alert color="warning"><BodySmall>
          The text is taller than the {overflow.join(' and ')} card, so the image would cut it off. Shorten it, or use a smaller headline style.
        </BodySmall></Alert>
      )}
      {result && <Alert color={result.ok ? 'success' : 'warning'}><BodySmall>{result.note}</BodySmall></Alert>}
    </VStack>
  );

  /* A card whose text does not fit grows past its size; the PNG is cut at
     the size, so say which. Measured unscaled (offsetHeight ignores the
     preview's transform). */
  useEffect(() => {
    if (!isShare) return;
    const t = window.setTimeout(() => {
      const over = [...(previewRef.current?.querySelectorAll('.omni-share') || [])].flatMap((card) => {
        const z = SHARE_SIZES.find((x) => x.key === card.getAttribute('data-share'));
        const hero = card.querySelector('.omni-hero') as HTMLElement | null;
        return z && hero && hero.offsetHeight > z.h + 1 ? [z.label.toLowerCase()] : [];
      });
      setOverflow((prev) => (prev.join() === over.join() ? prev : over));
    }, 120);
    return () => window.clearTimeout(t);
  }, [isShare, shareCards, systemCss]);

  const preview = isShare ? sharePreview : (
    <VStack spacing={2}>
      <style>{css + DEVICE_PREVIEW_CSS}</style>
      {/* Layout primitive only: the generated hero is injected verbatim into
          each breakpoint, so the preview is the code a user copies. */}
      <div ref={previewRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* One breakpoint at a time. The others stay rendered off to the side
            (visibility only), because the overlay is solved on all four. */}
        {/* Layout primitive: the breakpoint tabs, and the platform beside them when it applies. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs value={breakpoint} onChange={(v: string) => setBreakpoint(v)}>
            <TabList aria-label="Breakpoint">
              {devices.map((d) => (
                <Tab key={d.key} value={d.key}>{`${d.key[0].toUpperCase()}${d.key.slice(1)} · ${d.width} × ${d.height} (${Math.round(Math.min(1, stageW / d.width) * 100)}%)`}</Tab>
              ))}
            </TabList>
          </Tabs>
          {(breakpoint === 'tablet' || breakpoint === 'mobile') && (
            <ToggleButtonGroup value={platform} onChange={(v: string) => choosePlatform(v as HeroPlatform)} size="small" aria-label="Platform">
              <Button value="ios" size="small">iOS</Button>
              <Button value="android" size="small">Android</Button>
            </ToggleButtonGroup>
          )}
        </div>
        <div ref={stageRef} style={{ position: 'relative' }}>
          {devices.map((d) => (
            <div key={d.key} aria-hidden={d.key !== breakpoint || undefined}
              style={d.key === breakpoint ? undefined : { position: 'absolute', top: 0, left: 0, right: 0, height: 0, overflow: 'hidden', visibility: 'hidden' }}>
              {/* A phone drawn across the whole preview would be several times
                  life size, so the narrow ones are capped at real size. */}
              <div style={{ maxWidth: d.width, margin: d.width < stageW ? '0 auto' : undefined }}>
                <DeviceFrame device={d} html={html} screen={box.heightMode === 'screen'} showLabel={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {result && <Alert color={result.ok ? 'success' : 'warning'}><BodySmall>{result.note}</BodySmall></Alert>}
    </VStack>
  );

  const codePanel = (
    <VStack spacing={2}>
      <BodySmall color="quiet">Load your design system&rsquo;s CSS on the page, then add this CSS once and the HTML where the hero goes.{mode === 'image' ? ' Replace your-image.jpg with your photo — the overlay was solved for the one shown on the Build tab.' : ''}</BodySmall>
      <CodeBlock code={codeHtml} language="HTML" maxHeight={420} wrap />
      <CodeBlock code={css} language="CSS" maxHeight={420} />
      <BodySmall color="quiet">A link that reopens this hero here for editing:</BodySmall>
      <CodeBlock code={heroLink} language="URL" wrap maxHeight={120} />
    </VStack>
  );

  const importPanel = (
    <div style={{ maxWidth: 560 }}>
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>{isShare ? 'Import a share image' : 'Import a hero'}</H3>
          {isShare ? (
            <BodySmall color="quiet">
              Edit a share image: paste its spec or its link. Or start from a hero — paste a Hero Generator hero&rsquo;s HTML,
              spec or link and its background, colors and text become the share image&rsquo;s (its buttons are left out).
              The photo does not travel with a spec; drop it in again.
            </BodySmall>
          ) : (
            <BodySmall color="quiet">
              Edit a hero made with the Hero Generator: paste its HTML from your code, its spec, or its link.
              Everything comes back — background, colors, text, buttons and layout — except the photo, which you
              drop in again. From Figma, select a hero the Omni Design plugin built and use Open hero in studio.
              Only Omni heroes can be opened: they carry their own spec, and other hero code does not.
            </BodySmall>
          )}
          <TextArea label={isShare ? 'Share image or hero — spec, link or HTML' : 'Hero HTML, spec or link'} rows={4} fullWidth value={loadText}
            onChange={(e: { target: { value: string } }) => setLoadText(e.target.value)} />
          {loadError && <Alert color="warning"><BodySmall>{loadError}</BodySmall></Alert>}
          <Button variant="default-outline" size="small" onClick={() => loadHero(loadText)} disabled={!loadText.trim()}>Load</Button>
        </VStack>
      </Card>
    </div>
  );

  /* PNG: the card's own HTML, rasterized at its real size (pixelRatio 1, so a
     1200 × 630 card is a 1200 × 630 file — what the platforms ask for). */
  const downloadPng = async (key: ShareSizeKey) => {
    const z = SHARE_SIZES.find((x) => x.key === key)!;
    const card = exportCardsRef.current?.querySelector(`.omni-share[data-share="${key}"]`) as HTMLElement | null;
    if (!card) return;
    setPngBusy(key); setPngError(null);
    try {
      const url = await toPng(card, { width: z.w, height: z.h, pixelRatio: 1, cacheBust: true });
      const a = document.createElement('a');
      a.href = url; a.download = z.file;
      a.click();
    } catch (e) {
      setPngError(`The ${z.label.toLowerCase()} image could not be drawn (${(e as Error).message || 'unknown error'}). Try again, or build it in Figma and export it there.`);
    } finally { setPngBusy(null); }
  };
  const downloadAll = async () => { for (const z of shareSizesShown) await downloadPng(z.key); };
  const shareExportSpec = useMemo(() => JSON.stringify(share, null, 2), [share]);
  const shareMeta = useMemo(() => shareMetaTags(share), [share]);
  const shareLink = useMemo(() => `${window.location.origin}/add-ons/share/${uuid || ''}#spec=${encodeShareSpec(share)}`, [share, uuid]);

  const shareExportPanel = (
    <VStack spacing={3}>
      <style>{css + SHARE_CSS}</style>
      {/* Off screen, real size: what the PNGs are drawn from. */}
      <div ref={exportCardsRef} aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, pointerEvents: 'none' }}
        dangerouslySetInnerHTML={{ __html: shareCards.map((c) => c.html).join('') }} />
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Images</H3>
          {shareSizesShown.map((z) => (
            // Layout primitive: a size, who reads it, and its download.
            <div key={z.key} style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <VStack spacing={0.25}>
                <Label>{`${z.label} · ${z.w} × ${z.h}`}</Label>
                <Caption color="quiet">{`${z.file} — ${z.readBy}`}</Caption>
              </VStack>
              <Button variant="default-outline" size="small" disabled={!!pngBusy} onClick={() => downloadPng(z.key)}>
                {pngBusy === z.key ? 'Drawing…' : 'Download PNG'}
              </Button>
            </div>
          ))}
          <div><Button variant="default" size="small" disabled={!!pngBusy} onClick={downloadAll}>Download all</Button></div>
          {pngError && <Alert color="warning"><BodySmall>{pngError}</BodySmall></Alert>}
          {mode === 'image' && <BodySmall color="quiet">Drawn with the photo on the Build tab — the overlay was solved for it.</BodySmall>}
        </VStack>
      </Card>
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Meta tags</H3>
          <BodySmall color="quiet">Upload the images, then paste these in the page&rsquo;s &lt;head&gt;. The title and description are the headline and body.</BodySmall>
          <TextField label="Page URL" size="small" fullWidth value={sharePage.url}
            onChange={(e: { target: { value: string } }) => setSharePage({ ...sharePage, url: e.target.value })} />
          <TextField label="Where the images are uploaded" size="small" fullWidth value={sharePage.imageBase} helperText="The folder URL; the file names are added."
            onChange={(e: { target: { value: string } }) => setSharePage({ ...sharePage, imageBase: e.target.value })} />
          <TextField label="Image description" size="small" fullWidth value={sharePage.alt} helperText="For screen readers. Leave empty to use the image's own words."
            onChange={(e: { target: { value: string } }) => setSharePage({ ...sharePage, alt: e.target.value })} />
          <CodeBlock code={shareMeta} language="HTML" maxHeight={360} wrap />
        </VStack>
      </Card>
      <Card padding="medium">
        <VStack spacing={2}>
          <H3>Figma</H3>
          <Body>
            In the <strong>Omni Design</strong> plugin, open <strong>Add-ons</strong> › <strong>Share Images</strong> and paste this spec. It builds one frame per size, on your variables and text styles.
            {mode === 'image' ? ' Select a frame with your photo as its fill first — each size is built over it.' : ''}
          </Body>
          <CodeBlock code={shareExportSpec} language="JSON" maxHeight={320} />
          <BodySmall color="quiet">A link that reopens this share image here for editing:</BodySmall>
          <CodeBlock code={shareLink} language="URL" wrap maxHeight={120} />
        </VStack>
      </Card>
    </VStack>
  );

  const exportPanel = isShare ? shareExportPanel : (
    <VStack spacing={2}>
      <Body>
        In Figma, open the <strong>Omni Design</strong> plugin, open the <strong>Add-ons</strong> tab, choose <strong>Hero Generator</strong>, and paste this spec.
        {mode === 'image' ? ' Select a frame with your photo as its fill first — the photo stays yours, and the overlay and text are built over it.' : ''}
      </Body>
      <CodeBlock code={exportSpec} language="JSON" maxHeight={420} />
    </VStack>
  );

  const panel = (controls: ReactElement) => (
    /* Layout primitive: controls beside a sticky preview. */
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
      <VStack spacing={3}>{controls}</VStack>
      {/* Sticks as its breakpoint tabs reach the nav, so the tabs stay
          just under the bar while the controls scroll. */}
      <div style={{ position: 'sticky', top: ADD_ON_NAV_HEIGHT + 8 }}>{preview}</div>
    </div>
  );

  const body = (
    <>
    <AddOnTopNav title={isShare ? 'Share Images' : 'Hero Generator'} uuid={uuid} exists={exists} basePath={basePath} />
    <VStack spacing={3} style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px 32px' }}>
      <VStack spacing={1}>
        <Body color="quiet">{isShare
          ? 'The picture a link shows when it is shared — in your design system, at the sizes the platforms read, with the contrast solved.'
          : 'A hero in your design system, over a photo or a gradient — with the contrast solved, not just checked.'}</Body>
      </VStack>
      {exists === false && (
        <Alert color="warning"><BodySmall>
          {uuid ? `No design system has that ID, so the ${isShare ? 'image' : 'hero'} is drawn without a brand.` : `Use the settings cog at the top right to enter your design system ID and draw the ${isShare ? 'image' : 'hero'} in your brand — it is the Omni Design ID in the plugin’s Settings.`}
        </BodySmall></Alert>
      )}
      <style>{GRADIENT_CONTROLS_CSS}</style>
      {/* Build, Code, Export — the same three every add-on has. */}
      <Tabs value={tab} onChange={(v: 'build' | 'code' | 'export' | 'import') => setTab(v)} sx={{ overflow: 'clip' }}>
        <TabList aria-label={isShare ? 'Share Images' : 'Hero Generator'}>
          <Tab value="build">Build</Tab>
          {/* A share image is a picture, not code to copy: its code is the meta tags, on Export. */}
          {!isShare && <Tab value="code">Code</Tab>}
          <Tab value="export">Export</Tab>
          <Tab value="import">Import</Tab>
        </TabList>
        <TabPanel value="build">
          {/* One preview for both modes: rendered once, so its refs (and the
              contrast solve that reads them) always point at the visible copy. */}
          {panel(<>
            {/* Layout primitive: the background choice, centered over the controls. */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ToggleButtonGroup value={mode} onChange={(v: string) => setMode(v as 'image' | 'gradient')} size="small" aria-label={isShare ? 'Image background' : 'Hero background'}>
                <Button value="image" size="small">Over image</Button>
                <Button value="gradient" size="small">Over gradient</Button>
              </ToggleButtonGroup>
            </div>
            {mode === 'image' ? <>{imageCard}{contentCard}{isShare ? sizesCard : layoutCard}</> : <>{gradientCard}{contentCard}{isShare ? sizesCard : layoutCard}</>}
          </>)}
        </TabPanel>
        <TabPanel value="code">{codePanel}</TabPanel>
        <TabPanel value="export">{exportPanel}</TabPanel>
        <TabPanel value="import">{importPanel}</TabPanel>
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
