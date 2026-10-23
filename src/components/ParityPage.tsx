/**
 * Parity: a lib component drawn in code next to its Figma component set.
 *
 * The Figma side is fetched, not exported by hand — the set's rendered PNG and
 * its node tree come from the REST API, so every variant's position, size and
 * resolved look are known. The code side draws the lib component once per
 * variant, at the same offset, with the variant's properties. The two then
 * line up pixel for pixel and can be compared two ways:
 *
 *   side by side   — a read
 *   overlay        — the code over the Figma image at a chosen opacity
 *
 * Under the pictures, a table puts Figma's numbers next to the computed style
 * of the same part, so a difference that is visible gets a cause.
 *
 * The page wears the chosen design system's PUBLISHED CSS — the same files the
 * Figma import is generated from — so a color that differs is a real
 * difference, not a preview-vs-export one.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Body, Button, ToggleButtonGroup, Caption, Card, CodeBlock, H2, H3, HStack, Section, Select, Slider, Table, TextInput, VStack, Alert,
} from '@omni-design/components';
import SettingsIcon from '@mui/icons-material/Settings';
import { fetchFigmaComponentSets, fetchFigmaImage, fetchFigmaNode } from '../utils/figmaApi';
import { applyStudioDesignSystem, STUDIO_THEMES } from '../utils/studioDesignSystem';
import { parseFigmaSet, type FigmaPart, type FigmaSet } from '../utils/parity/figmaSet';
import { PARITY_COMPONENTS } from '../utils/parity/components';
import { forcedStateClass, refreshPseudoStates } from '../utils/parity/pseudoStates';

const FILE_KEY = 'Qv2dqF7mYoAGY77EkdrwTv';
/** Shared with the Figma-to-Code workbench, so a token pasted there works here. */
const LS_FIGMA_TOKEN = 'aaid-workbench:figma-token';
/** The design system the code side wears, by its Omni Design ID. Remembered, so
 *  the page reopens on the system the Figma file is drawn in rather than on a
 *  default that has to be switched away from before every run. */
const LS_DESIGN_ID = 'parity:omni-design-id';
/** First run only: Surf's Up, the system the library file is drawn in. */
const DEFAULT_DESIGN_ID = STUDIO_THEMES.find((t) => t.name === "Surf's Up")!.id;

type Mode = 'side' | 'overlay';
type Layout = 'set' | 'variants';
/** Space around a variant in Each-variant layout, so shadows and focus rings are not cropped. */
const PAD = 8;

/* ── measuring ─────────────────────────────────────────────────────────── */

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, '0');
/** rgb()/rgba() → #rrggbb[aa]; null when fully transparent. */
function cssColor(v: string): string | null {
  // color-mix() computes to color(srgb r g b / a), channels 0–1.
  const c = v.match(/color\(srgb ([^)]+)\)/);
  if (c) {
    const parts = c[1].split('/');
    const [rr, gg, bb] = parts[0].trim().split(/\s+/).map(Number);
    const alpha = parts[1] ? parseFloat(parts[1]) : 1;
    if (alpha < 0.002) return null;
    return `#${hex2(rr * 255)}${hex2(gg * 255)}${hex2(bb * 255)}${alpha < 0.999 ? hex2(alpha * 255) : ''}`;
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) return v || null;
  const [r, g, b, a = '1'] = m[1].split(/[ ,/]+/).filter(Boolean);
  const alpha = parseFloat(a);
  if (alpha < 0.002) return null;
  return `#${hex2(+r)}${hex2(+g)}${hex2(+b)}${alpha < 0.999 ? hex2(alpha * 255) : ''}`;
}

function rgbaOf(h: string | null): number[] | null {
  if (!h) return null;
  const s = h.replace('#', '');
  return [0, 2, 4, 6].map((i) => (i < s.length ? parseInt(s.slice(i, i + 2), 16) : 255));
}
const colorsMatch = (a: string | null, b: string | null) => {
  const x = rgbaOf(a), y = rgbaOf(b);
  if (!x || !y) return x === y;
  return x.every((v, i) => Math.abs(v - y[i]) <= 3);
};

/** A translucent Figma color laid over the opaque ground it sits on, as a
 *  solid — what the eye sees, and what CSS ships as a baked Quiet. */
function compositeOn(fg: string | null, ground: string | null): string | null {
  const f = rgbaOf(fg), g = rgbaOf(ground);
  if (!f || !g || f[3] >= 255 || g[3] < 255) return null;
  const a = f[3] / 255;
  return '#' + [0, 1, 2].map((i) => hex2(f[i] * a + g[i] * (1 - a))).join('');
}

const effectiveRadius = (r: number | null, w: number, h: number) => (r == null ? 0 : Math.min(r, w / 2, h / 2));

interface Measured extends FigmaPart {
  opacity: number;
  /** Text labels laid side by side inside the box — see textRunsAcross. */
  textRuns?: number;
}

/**
 * The most text labels that share one line inside `el`.
 *
 * Figma rounds every hugging text box UP to a whole pixel ("Button" measures
 * 50.8px and is drawn 51); the browser keeps the fraction. So a box that hugs
 * N labels in a row is up to N px wider in Figma for no reason but that
 * rounding — every Button 0.2px narrower in code, adding up across a group.
 */
function textRunsAcross(el: Element): number {
  const tops = new Map<number, number>();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const seen = new Set<Element>();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const host = n.parentElement;
    if (!host || seen.has(host) || !n.textContent?.trim()) continue;
    seen.add(host);
    const r = host.getBoundingClientRect();
    if (!r.width) continue;
    const top = Math.round(r.top / 4);
    tops.set(top, (tops.get(top) ?? 0) + 1);
  }
  return Math.max(0, ...tops.values());
}

/** True when at least one shadow layer has a color that is not fully transparent. */
function shadowVisible(boxShadow: string): boolean {
  /* Every color the browser may serialize a shadow in, not just rgb(): a
     color-mix() bevel comes back as color(srgb …) or oklab(…), and reading
     only rgb() reported a fully drawn bevel as "none". Alpha is the 4th rgba
     argument, or whatever follows "/" in the newer syntaxes. */
  return Array.from(boxShadow.matchAll(/(rgba?|color|oklab|oklch|lab|lch|hsla?)\(([^)]+)\)/g)).some((m) => {
    const body = m[2];
    if (m[1].startsWith('rgb') && !body.includes('/')) {
      const parts = body.split(/[ ,]+/).filter(Boolean);
      return parts.length < 4 || parseFloat(parts[3]) > 0.002;
    }
    const alpha = body.split('/')[1];
    return alpha === undefined || parseFloat(alpha) > 0.002;
  });
}

/** A pseudo-element's outer box and border, or null when it draws nothing.
 *  It has no rect of its own, so the size comes from computed style. */
function measurePseudo(el: Element, pseudo: string): Measured | null {
  const cs = getComputedStyle(el, pseudo);
  if (!cs.content || cs.content === 'none' || cs.display === 'none') return null;
  const bw = parseFloat(cs.borderTopWidth) || 0;
  const extra = cs.boxSizing === 'border-box' ? 0 : bw * 2;
  const w = parseFloat(cs.width) + extra, h = parseFloat(cs.height) + extra;
  const bc = cs.borderTopStyle === 'none' || bw === 0 ? null : cssColor(cs.borderTopColor);
  return {
    w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100,
    radius: parseFloat(cs.borderTopLeftRadius) || 0,
    strokeWeight: bc ? bw : null, stroke: bc,
    fill: cssColor(cs.backgroundColor),
    effects: cs.boxShadow === 'none' || !shadowVisible(cs.boxShadow) ? [] : [cs.boxShadow],
    opacity: 1,
  };
}

/** Split a computed box-shadow into layers (commas inside color() stay put). */
function shadowLayers(v: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of v) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** A spread box-shadow halo: the widest layer is the band, the narrowest the
 *  gap before it. Reported like a Figma OUTSIDE stroke on a frame `gap` out. */
function measureHalo(el: Element, scale: number): Measured | null {
  const cs = getComputedStyle(el);
  if (cs.boxShadow === 'none') return null;
  const layers = shadowLayers(cs.boxShadow).map((l) => {
    const nums = l.match(/(-?[\d.]+)px/g)?.map(parseFloat) ?? [];
    return { color: cssColor(l), spread: nums[3] ?? 0 };
  }).filter((l) => l.color && l.spread > 0);
  if (!layers.length) return null;
  const band = layers.reduce((a, b) => (b.spread > a.spread ? b : a));
  const gap = layers.length > 1 ? Math.min(...layers.map((l) => l.spread)) : 0;
  const rect = el.getBoundingClientRect();
  const w = rect.width / scale + band.spread * 2, h = rect.height / scale + band.spread * 2;
  return {
    w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100,
    radius: Math.min(w, h) / 2,
    strokeWeight: Math.round((band.spread - gap) * 100) / 100, stroke: band.color,
    fill: null, effects: [], opacity: 1,
  };
}

/** A CSS outline as a ring: its outer box, width and color; null when none. */
function measureOutline(el: Element, scale: number): Measured | null {
  const cs = getComputedStyle(el);
  const ow = parseFloat(cs.outlineWidth) || 0;
  if (cs.outlineStyle === 'none' || ow === 0) return null;
  const grow = (parseFloat(cs.outlineOffset) || 0) + ow;
  const rect = el.getBoundingClientRect();
  const w = rect.width / scale + grow * 2, h = rect.height / scale + grow * 2;
  return {
    w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100,
    // A corner cannot be smaller than square: an inset outline on a square
    // segment would otherwise report a negative radius.
    radius: Math.max(0, (cs.borderTopLeftRadius.endsWith('%') ? (parseFloat(cs.borderTopLeftRadius) / 100) * (rect.width / scale) : parseFloat(cs.borderTopLeftRadius)) + grow),
    strokeWeight: ow, stroke: cssColor(cs.outlineColor),
    fill: null, effects: [], opacity: 1,
  };
}

/** Figma's stroke moved to the outside of its frame, so a ring compares by
 *  its outer edge: OUTSIDE adds the full weight a side, CENTER half. */
function figmaOuter(f: FigmaPart): FigmaPart {
  const sw = f.strokeWeight ?? 0;
  const grow = f.strokeAlign === 'OUTSIDE' ? sw : f.strokeAlign === 'CENTER' ? sw / 2 : 0;
  return { ...f, w: f.w + grow * 2, h: f.h + grow * 2, radius: f.radius == null ? null : f.radius + grow };
}

/* An SVG paints with its shapes' `fill`, not a background — Figma reports a
   vector's fill, so read the first painted shape's (currentColor resolves in
   computed style). Null for anything that is not an SVG. */
function svgFill(el: Element): string | null {
  if (!(el instanceof SVGElement)) return null;
  const shape = el.matches('path, circle, rect, ellipse, polygon') ? el : el.querySelector('path, circle, rect, ellipse, polygon');
  if (!shape) return null;
  const f = getComputedStyle(shape).fill;
  return f && f !== 'none' ? cssColor(f) : null;
}

/* Keep the box-shadow layers a part owns (see ParityPart.shadow). A ring,
   `inset 0 0 0 Npx`, is folded into the border it visually thickens. */
function ownShadows(m: Measured, kind: 'outer' | 'inset'): Measured {
  const layers = (m.effects ?? []).flatMap(shadowLayers);
  const ring = /(^|\s)0(px)? 0(px)? 0(px)? (\d+(\.\d+)?)px( inset|$)|inset\s+0(px)? 0(px)? 0(px)? (\d+(\.\d+)?)px/;
  let ringPx = 0;
  const kept = layers.filter((l) => {
    const inset = /\binset\b/.test(l);
    const r = inset ? l.match(ring) : null;
    if (r) { ringPx += parseFloat(r[5] ?? r[11] ?? '0'); return false; }
    return kind === 'inset' ? inset : !inset;
  });
  const effects = kept.length ? [kept.join(', ')] : [];
  return {
    ...m,
    effects,
    strokeWeight: kind === 'inset' && ringPx && m.strokeWeight != null ? m.strokeWeight + ringPx : m.strokeWeight,
  };
}

/** `scale` undoes the stage's zoom transform, which getBoundingClientRect includes. */
function measure(el: Element, stopAt: Element, scale: number): Measured {
  const cs = getComputedStyle(el);
  /* An INLINE element's box is its font's content area (16px Public Sans:
     18.5px tall), not the line it sits on — Figma's text box IS the line (24px).
     So the same text measured 2.75px low. Its line box is the nearest
     non-inline ancestor's, which is what Figma's frame corresponds to. */
  /* Only the VERTICAL extent comes from the line box; left edge and width stay
     the text's own (a padded holder around a button label is wider). */
  let boxEl: Element = el;
  while (getComputedStyle(boxEl).display === 'inline' && boxEl.parentElement && boxEl.parentElement !== stopAt) boxEl = boxEl.parentElement;
  const own = el.getBoundingClientRect();
  const line = boxEl.getBoundingClientRect();
  const rect = boxEl === el ? own : { left: own.left, width: own.width, top: line.top, height: line.height };
  const origin = stopAt.getBoundingClientRect();
  const w = Math.round((rect.width / scale) * 100) / 100, h = Math.round((rect.height / scale) * 100) / 100;
  const x = Math.round(((rect.left - origin.left) / scale) * 100) / 100, y = Math.round(((rect.top - origin.top) / scale) * 100) / 100;
  const r = cs.borderTopLeftRadius.endsWith('%') ? (parseFloat(cs.borderTopLeftRadius) / 100) * w : parseFloat(cs.borderTopLeftRadius);
  const bw = parseFloat(cs.borderTopWidth) || 0;
  const bc = cs.borderTopStyle === 'none' || bw === 0 ? null : cssColor(cs.borderTopColor);
  let opacity = 1;
  for (let n: Element | null = el; n && n !== stopAt; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity) || 1;
  return {
    x, y, w, h,
    radius: Number.isFinite(r) ? r : 0,
    strokeWeight: bc ? bw : null,
    stroke: bc,
    fill: svgFill(el) ?? cssColor(cs.backgroundColor),
    // A shadow whose every layer is fully transparent draws nothing — the lib
    // keeps a transparent shadow at rest so hover can transition to it.
    effects: cs.boxShadow === 'none' || !shadowVisible(cs.boxShadow) ? [] : [cs.boxShadow],
    font: { size: parseFloat(cs.fontSize), family: cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim(), weight: parseFloat(cs.fontWeight), color: cssColor(cs.color) },
    opacity: Math.round(opacity * 100) / 100,
    textRuns: textRunsAcross(el),
  };
}

interface Row { variant: string; part: string; prop: string; figma: string; code: string; ok: boolean }

function compare(variant: string, part: string, f: FigmaPart, c: Measured | null, figmaOpacity: number, isText: boolean, ground: string | null = null): Row[] {
  const rows: Row[] = [];
  const add = (prop: string, fv: unknown, cv: unknown, ok: boolean) =>
    rows.push({ variant, part, prop, figma: fv == null || fv === '' ? '—' : String(fv), code: cv == null || cv === '' ? '—' : String(cv), ok });
  if (!c) { add('drawn', 'yes', 'no', false); return rows; }
  if (isText && f.font && c.font) {
    // Where the text sits matters as much as its face: an indent is a
    // difference a font check cannot see. Compared by the edge the text is
    // aligned to — a centred label in a wider Figma box and the same label in
    // a code box that hugs the word draw the word in the same place, and only
    // their centres agree.
    if (f.x !== undefined && c.x !== undefined) {
      const align = f.font.align ?? 'LEFT';
      const at = (x: number, w: number) => (align === 'CENTER' ? x + w / 2 : align === 'RIGHT' ? x + w : x);
      const fx = Math.round(at(f.x, f.w) * 100) / 100, cx = Math.round(at(c.x, c.w) * 100) / 100;
      const edge = align === 'CENTER' ? 'centre' : align === 'RIGHT' ? 'right' : 'left';
      add(`position (${edge}, top)`, `${fx}, ${f.y}`, `${cx}, ${c.y}`, Math.abs(fx - cx) < 0.6 && Math.abs((f.y ?? 0) - (c.y ?? 0)) < 0.6);
    }
    add('font size', f.font.size, c.font.size, Math.abs(f.font.size - c.font.size) < 0.5);
    add('font family', f.font.family, c.font.family, f.font.family.toLowerCase() === c.font.family.toLowerCase());
    add('font weight', f.font.weight, c.font.weight, f.font.weight === c.font.weight);
    /* Figma binds Quiet as Text plus an opacity, so it reports #rrggbbaa;
       CSS ships the solid that opacity makes on the surface. Compare what is
       seen: Figma's color laid over the cell's Background, when code's is
       opaque. */
    const seen = rgbaOf(c.font.color)?.[3] === 255 ? compositeOn(f.font.color, ground) : null;
    add('text color', seen ? `${f.font.color} (= ${seen} on Background)` : f.font.color, c.font.color,
      colorsMatch(seen ?? f.font.color, c.font.color));
    return rows;
  }
  // Position inside the variant: a part the right size in the wrong place is
  // the misalignment an overlay shows and a size check cannot.
  if (f.x !== undefined && c.x !== undefined) {
    add('position', `${f.x}, ${f.y}`, `${c.x}, ${c.y}`, Math.abs(f.x - c.x) < 0.6 && Math.abs((f.y ?? 0) - (c.y ?? 0)) < 0.6);
  }
  // Figma may be wider by up to 1px per label on a line (its text rounding,
  // see textRunsAcross) — never narrower.
  const textSlack = c.textRuns ?? 0;
  add('width', f.w, c.w, Math.abs(f.w - c.w) < 0.6 || (f.w > c.w && f.w - c.w <= textSlack));
  add('height', f.h, c.h, Math.abs(f.h - c.h) < 0.6);
  const fr = effectiveRadius(f.radius, f.w, f.h), cr = effectiveRadius(c.radius, c.w, c.h);
  add('radius (as drawn)', +fr.toFixed(2), +cr.toFixed(2), Math.abs(fr - cr) < 0.6);
  // A translucent Figma stroke (Quiet is Text at an opacity) is compared as
  // what it draws over the cell's Background, when code's border is opaque.
  const seenStroke = c.stroke && rgbaOf(c.stroke)?.[3] === 255 ? compositeOn(f.stroke ?? null, ground) : null;
  add('border', f.stroke ? `${f.strokeWeight}px ${f.stroke}${seenStroke ? ` (= ${seenStroke} on Background)` : ''}` : 'none', c.stroke ? `${c.strokeWeight}px ${c.stroke}` : 'none',
    // Width within half a pixel: the browser snaps a 1px border to whole DEVICE
    // pixels, so at a fractional zoom it reports 0.56px for the same line.
    (!f.stroke && !c.stroke) || (!!f.stroke && !!c.stroke && Math.abs((f.strokeWeight ?? 0) - (c.strokeWeight ?? 0)) <= 0.5 && colorsMatch(seenStroke ?? f.stroke, c.stroke)));
  add('fill', f.fill, c.fill, colorsMatch(f.fill, c.fill));
  add('shadow', f.effects.join(', ') || 'none', c.effects.join(', ') || 'none', (f.effects.length === 0) === (c.effects.length === 0));
  add('opacity', +figmaOpacity.toFixed(2), c.opacity, Math.abs(figmaOpacity - c.opacity) < 0.02);
  return rows;
}

/* ── page ──────────────────────────────────────────────────────────────── */

/* The code side never takes the real pointer. A cell under the mouse is in
   :hover, and the report measured it as the Default variant — a range-end day
   came back with the hover fill and lift. Interaction states are forced by
   class (pseudoStates), so nothing on this side needs a real pointer. */
const NO_POINTER: React.CSSProperties = { pointerEvents: 'none' };

export default function ParityPage() {
  const params = new URLSearchParams(window.location.search);
  /* The selected component set, by Figma node id. A set with a ParityComponent
     entry draws code beside Figma; one without shows Figma alone until its
     mapping is written. */
  const [nodeId, setNodeId] = useState(
    () => PARITY_COMPONENTS.find((c) => c.key === params.get('component'))?.nodeId ?? params.get('node') ?? PARITY_COMPONENTS[0].nodeId,
  );
  const [allSets, setAllSets] = useState<Array<{ nodeId: string; name: string; page: string }>>([]);
  const [layout, setLayout] = useState<Layout>('set');
  const [dsId, setDsId] = useState(() => params.get('ds') || localStorage.getItem(LS_DESIGN_ID) || DEFAULT_DESIGN_ID);
  const [draftDsId, setDraftDsId] = useState('');
  /* 'ready' only once the sheets are IN — measuring on the id change alone ran
     before they landed, and a run reported the previous system's colors. */
  const [dsStatus, setDsStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [showSettings, setShowSettings] = useState(() => !localStorage.getItem(LS_FIGMA_TOKEN));
  const [token, setToken] = useState(() => localStorage.getItem(LS_FIGMA_TOKEN) ?? '');
  /* The field edits a DRAFT and the token changes only on Use token. Bound
     straight to `token`, the first keystroke made it non-empty, which hid the
     field and fired a fetch with one character — so a pasted token was never
     what got saved. */
  const [draftToken, setDraftToken] = useState('');
  const [editingToken, setEditingToken] = useState(false);
  const [set, setSet] = useState<FigmaSet | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('side');
  const [opacity, setOpacity] = useState(0.5);
  const [zoom, setZoom] = useState('2');
  const [rows, setRows] = useState<Row[]>([]);
  const [showAll, setShowAll] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  const component = PARITY_COMPONENTS.find((c) => c.nodeId === nodeId) ?? null;
  const setName = component?.name ?? allSets.find((x) => x.nodeId === nodeId)?.name ?? 'Component';

  useEffect(() => {
    let live = true;
    setDsStatus('loading');
    applyStudioDesignSystem(dsId).then((ok) => { if (live) setDsStatus(ok ? 'ready' : 'missing'); });
    return () => { live = false; };
  }, [dsId]);
  useEffect(() => { if (dsStatus === 'ready') localStorage.setItem(LS_DESIGN_ID, dsId); }, [dsId, dsStatus]);
  useEffect(() => { localStorage.setItem(LS_FIGMA_TOKEN, token.trim()); }, [token]);
  /* The key is shared with the workbench and with every other open tab, and
     each one writes its own copy back when its token changes — so a tab opened
     before you pasted a new token could put the old one back. Follow the other
     tabs instead of holding a stale copy. */
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_FIGMA_TOKEN && e.newValue != null && e.newValue !== token) setToken(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [token]);
  /* Whether the saved token works — shown in Settings next to the masked
     token, so "saved" and "valid" are visible separately. Checked by reading
     the library file's root, which is exactly what the page needs. Not
     /v1/me: that needs the current_user:read scope, which a token made with
     only File / Library content access does not have, so a working token
     reported 403. */
  const [tokenCheck, setTokenCheck] = useState<{ state: 'checking' | 'ok' | 'bad'; detail: string } | null>(null);
  useEffect(() => {
    const t = token.trim();
    if (!t) { setTokenCheck(null); return; }
    let live = true;
    setTokenCheck({ state: 'checking', detail: '' });
    fetch(`https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=0:1&depth=1`, { headers: { 'X-Figma-Token': t } })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!live) return;
        if (r.ok) setTokenCheck({ state: 'ok', detail: body.name ? `reads "${body.name}"` : 'reads the library file' });
        else {
          setTokenCheck({ state: 'bad', detail: body.err || `HTTP ${r.status}` });
          setShowSettings(true);
        }
      })
      .catch(() => live && setTokenCheck({ state: 'bad', detail: 'could not reach Figma' }));
    return () => { live = false; };
  }, [token]);
  const maskedToken = token.trim() ? `${token.trim().slice(0, 5)}…${token.trim().slice(-4)}` : '';
  useEffect(() => {
    if (!token.trim()) return;
    fetchFigmaComponentSets(FILE_KEY, token.trim())
      // Building blocks named with a leading "." or "_" are Figma's private
      // components — parts of another component, not ones to compare alone.
      .then((list) => setAllSets(list.filter((x) => !/^[._]/.test(x.name)).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => setAllSets([]));
  }, [token]);

  /* The latest request wins. Switching component while a slow fetch is in
     flight let the OLD response land last and fill the page — a Day Cell
     report carrying Count Step's variants under Day Cell's node id. */
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    if (!token.trim()) return;
    const seq = ++loadSeq.current;
    setLoading(true); setError(null);
    try {
      const [doc, img] = await Promise.all([
        fetchFigmaNode(FILE_KEY, nodeId, token.trim()),
        fetchFigmaImage(FILE_KEY, nodeId, token.trim(), 2),
      ]);
      if (seq !== loadSeq.current) return;
      const parsed = parseFigmaSet(doc);
      setSet(parsed);
      setImage(img);
      // Actual width for anything sizable; 2× only for small controls (a 28px
      // radio is unreadable at 1×, a 700px alert is unmanageable at 2×).
      setZoom(parsed.box.w > 200 ? '1' : '2');
    } catch (e) {
      if (seq === loadSeq.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [nodeId, token]);

  useEffect(() => { load(); }, [load]);

  /* Forced states and measurements both need the code side on screen, with
     emotion's rules inserted and the design system's CSS applied. */
  const remeasure = useCallback(() => {
    if (!set || !component || !codeRef.current) { setRows([]); return; }
    refreshPseudoStates();
    requestAnimationFrame(() => {
      const root = codeRef.current;
      if (!root) return;
      const out: Row[] = [];
      for (const v of set.variants) {
        const cell = root.querySelector(`[data-variant="${v.id}"]`);
        const label = Object.values(v.props).join(' · ');
        // A part marked `all` is checked once per copy: Figma's `name`, `name#2`…
        // against the selector's 1st, 2nd… match, labelled "Segment 2" and so on.
        const pairs = component.parts.flatMap((p) => {
          if (!p.all) return [{ p, key: p.figma, label: p.label, nth: 0 }];
          const every = p.figmaEvery ?? 1;
          const count = Math.max(
            Math.ceil(Object.keys(v.parts).filter((k) => k === p.figma || k.startsWith(p.figma + '#')).length / every),
            cell?.querySelectorAll(p.css).length ?? 0,
          );
          return Array.from({ length: count }, (_, i) => {
            const f = i * every; // Figma copy index: 0, every, 2*every…
            return { p, key: f === 0 ? p.figma : `${p.figma}#${f + 1}`, label: `${p.label} ${i + 1}`, nth: i };
          });
        });
        for (const { p, key, label: partLabel, nth } of pairs) {
          if (p.when && !p.when(v)) continue;
          const f = v.parts[key];
          const el = (p.all ? cell?.querySelectorAll(p.css)[nth] : cell?.querySelector(p.css)) ?? null;
          // A part drawn on one side only is a difference before any number is.
          // Except a halo: code draws every state's halo as ONE shadow on the
          // same node, so "a shadow is there" cannot say which state's it is —
          // a halo is checked where Figma draws it and nowhere else.
          if (!f && p.halo) continue;
          if (!f) {
            const drawn = el && (p.halo ? measureHalo(el, Number(zoom)) : p.outline ? measureOutline(el, Number(zoom)) : !p.pseudo || measurePseudo(el, p.pseudo));
            if (drawn) out.push({ variant: label, part: partLabel, prop: 'drawn', figma: 'no', code: 'yes', ok: false });
            continue;
          }
          const m = el && cell
            ? (p.halo ? measureHalo(el, Number(zoom)) : p.outline ? measureOutline(el, Number(zoom)) : p.pseudo ? measurePseudo(el, p.pseudo) : measure(el, cell, Number(zoom)))
            : null;
          const ground = cell ? cssColor(getComputedStyle(cell).getPropertyValue('--Background').trim()) : null;
          let measured = m && p.shadow ? ownShadows(m, p.shadow) : m;
          if (measured && el && p.ringOn && measured.strokeWeight != null) {
            const child = el.querySelector(p.ringOn);
            const ring = child ? getComputedStyle(child).boxShadow.match(/inset\s+0(?:px)? 0(?:px)? 0(?:px)? (\d+(?:\.\d+)?)px|0(?:px)? 0(?:px)? 0(?:px)? (\d+(?:\.\d+)?)px inset/) : null;
            if (ring) measured = { ...measured, strokeWeight: measured.strokeWeight + parseFloat(ring[1] ?? ring[2]) };
          }
          let rows = compare(label, partLabel, p.outer ? figmaOuter(f) : f, measured, p.pseudo ? 1 : v.opacity, !!f.font, ground);
          // The node a halo hangs on carries the halo AS its box-shadow, which
          // the halo part measures — so its own shadow row would count it twice.
          if (!p.halo && component.parts.some((q) => q.halo && q.css === p.css)) rows = rows.filter((r) => r.prop !== 'shadow');
          if (p.skip) rows = rows.filter((r) => !p.skip!.includes(r.prop));
          if (component.intended) rows = rows.filter((r) => !component.intended!(v, r.prop));
          out.push(...rows);
        }
      }
      setRows(out);
    });
  }, [set, component, zoom]);

  useEffect(() => {
    // Twice: emotion inserts some rules after first paint, and the forced
    // states copy whatever rules exist when they are built.
    const t = setTimeout(remeasure, 600);
    const t2 = setTimeout(remeasure, 2000);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [remeasure, dsId, dsStatus, mode, layout]);

  /* A plain-text summary to paste back to Claude: what was compared, against
     what, and each difference ONCE with the variants it covers — the same
     54-vs-56 in six variants is one finding, not six. */
  const report = useMemo(() => {
    if (!set || !component || !rows.length) return '';
    const ds = STUDIO_THEMES.find((t) => t.id === dsId)?.name ?? dsId;
    const groups = new Map<string, { part: string; prop: string; figma: string; code: string; variants: string[] }>();
    for (const r of rows.filter((x) => !x.ok)) {
      const k = [r.part, r.prop, r.figma, r.code].join('\u0000');
      const g = groups.get(k) ?? { part: r.part, prop: r.prop, figma: r.figma, code: r.code, variants: [] };
      g.variants.push(r.variant);
      groups.set(k, g);
    }
    const total = set.variants.length;
    const lines = [
      `PARITY REPORT — ${component.name}`,
      `Figma: file ${FILE_KEY}, component set ${component.nodeId} (${total} variants)`,
      `Lib: ${component.libFile ?? '(file not named)'} — design system: ${ds} (published CSS)`,
      `Rendered in (from Figma's resolved modes): ${component.context ? Object.entries(component.context).map(([k, v]) => `${k}=${v}`).join(', ') : 'page default'}`,
      `Axes: ${Object.keys(set.variants[0]?.props ?? {}).join(', ')}; booleans at their defaults: ${Object.entries(set.booleanDefaults).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`,
      `Parts compared (Figma layer -> lib selector): ${component.parts.map((p) => `${p.figma} -> ${p.css}`).join('; ')}`,
      '',
      `${groups.size} distinct difference(s), ${rows.filter((x) => !x.ok).length} of ${rows.length} measurements:`,
      ...Array.from(groups.values()).map((g, i) =>
        `${i + 1}. ${g.part} ${g.prop}: Figma ${g.figma} vs code ${g.code} — ${g.variants.length === total ? 'all variants' : g.variants.join('; ')}`),
    ];
    if (component.notes?.length) lines.push('', 'Notes:', ...component.notes.map((n) => `- ${n}`));
    return lines.join('\n');
  }, [set, component, rows, dsId]);

  const scale = Number(zoom);
  /* Every stage paints the theme and surface Figma resolves the set in, so the
     Figma image and the code sit on the same ground they sit on in the file. */
  const zone = component?.context?.theme
    ? { theme: component.context.theme, surface: component.context.surface ?? 'Surface' }
    : {};
  const mismatches = rows.filter((r) => !r.ok);
  const shown = showAll ? rows : mismatches;

  const figmaLayer = set && image ? (
    <img
      src={image}
      alt={`${setName} in Figma`}
      style={{
        position: 'absolute',
        left: set.imageOffset.x, top: set.imageOffset.y,
        width: set.imageOffset.w, height: set.imageOffset.h,
      }}
    />
  ) : null;

  /* One variant in code, in its box. `measured` marks the copy the table
     reads; the Overlay copy of the same variant is left unmarked so the
     measurement never lands on the faded one. */
  const variantCell = (v: FigmaSet['variants'][number], at: { x: number; y: number }, measured: boolean) => {
    if (!set || !component) return null;
    const forced = component.forcedState?.(v);
    return (
      // Layout primitive: the variant's box, at its offset.
      <div
        key={v.id}
        data-variant={measured ? v.id : undefined}
        className={forced ? forcedStateClass(forced) : undefined}
        style={{ position: 'absolute', left: at.x, top: at.y, width: v.box.w, height: v.box.h, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', ...component.cellStyle?.(v) }}
      >
        {component.render(v, set.booleanDefaults, component.context ?? {})}
      </div>
    );
  };

  const codeLayer = useMemo(
    () => (set && component ? set.variants.map((v) => variantCell(v, v.box, true)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [set, component],
  );

  /** A window onto one variant: the set image shifted so the variant sits at (PAD, PAD). */
  const figmaCrop = (v: FigmaSet['variants'][number]) => set && image ? (
    <img
      src={image}
      alt=""
      style={{
        position: 'absolute',
        left: set.imageOffset.x - v.box.x + PAD, top: set.imageOffset.y - v.box.y + PAD,
        width: set.imageOffset.w, height: set.imageOffset.h,
      }}
    />
  ) : null;

  const windowBox = (v: FigmaSet['variants'][number], children: React.ReactNode, title: string) => (
    <VStack spacing={0} key={title}>
      <Caption color="quiet">{title}</Caption>
      {/* Layout primitive: reserves the zoomed footprint. */}
      <div style={{ width: (v.box.w + PAD * 2) * scale, height: (v.box.h + PAD * 2) * scale }}>
        <Section {...zone} style={{ position: 'relative', overflow: 'hidden', width: v.box.w + PAD * 2, height: v.box.h + PAD * 2, transform: `scale(${scale})`, transformOrigin: '0 0', isolation: 'isolate', border: '1px dashed var(--Border-Variant)' }}>
          {children}
        </Section>
      </div>
    </VStack>
  );

  const stage = (children: React.ReactNode, title: string) => set && (
    <VStack spacing={1}>
      <Caption color="quiet">{title}</Caption>
      {/* Layout primitive: reserves the zoomed footprint. */}
      <div style={{ width: set.box.w * scale, height: set.box.h * scale }}>
        <Section {...zone} style={{ position: 'relative', width: set.box.w, height: set.box.h, transform: `scale(${scale})`, transformOrigin: '0 0', isolation: 'isolate' }}>
          {children}
        </Section>
      </div>
    </VStack>
  );

  return (
    <Section padding="32px 24px" style={{ minHeight: '100vh' }}>
      <VStack spacing={3} style={{ maxWidth: 1200, margin: '0 auto' }}>
        <VStack spacing={1}>
          <H2>Component parity</H2>
          <Body color="quiet">
            The lib component drawn in code, at the exact layout of its Figma component set, in the
            design system's published CSS. Use Overlay to fade between the two.
          </Body>
        </VStack>

        {/* Layout primitive: the controls, wrapping on narrow screens. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          <Select label="Component" size="small" value={nodeId} minWidth={200}
            options={(allSets.length ? allSets : PARITY_COMPONENTS.map((c) => ({ nodeId: c.nodeId, name: c.name, page: '' })))
              .map((x) => ({ label: `${x.name}${PARITY_COMPONENTS.some((c) => c.nodeId === x.nodeId) ? ' · code' : ''}`, value: x.nodeId }))}
            onChange={(v: string) => { setSet(null); setImage(null); setRows([]); setNodeId(v); }} />
          <ToggleButtonGroup value={layout} onChange={(v: Layout) => v && setLayout(v)} size="small">
            <Button value="set" size="small">Whole set</Button>
            <Button value="variants" size="small">Each variant</Button>
          </ToggleButtonGroup>
          <ToggleButtonGroup value={mode} onChange={(v: Mode) => v && setMode(v)} size="small">
            <Button value="side" size="small">Side by side</Button>
            <Button value="overlay" size="small">Overlay</Button>
          </ToggleButtonGroup>
          <ToggleButtonGroup value={zoom} onChange={(v: string) => v && setZoom(v)} size="small">
            <Button value="1" size="small">1×</Button>
            <Button value="2" size="small">2×</Button>
            <Button value="4" size="small">4×</Button>
          </ToggleButtonGroup>
          {(mode === 'overlay' || layout === 'variants') && (
            <VStack spacing={0} style={{ width: 180 }}>
              <Caption color="quiet">Code opacity {Math.round(opacity * 100)}%</Caption>
              <Slider value={opacity} min={0} max={1} step={0.05} aria-label="Code opacity"
                onChange={(_e: unknown, v: number) => setOpacity(v)} />
            </VStack>
          )}
          <Button variant="default-outline" size="small" onClick={() => { load(); remeasure(); }} disabled={loading}>
            {loading ? 'Loading…' : 'Reload Figma'}
          </Button>
          <Button variant="ghost" size="small" selected={showSettings} startDecorator={<SettingsIcon />}
            onClick={() => setShowSettings((x) => !x)} aria-expanded={showSettings}>
            Settings
          </Button>
        </div>

        {(showSettings || !token.trim() || editingToken || (error && /40[13]/.test(error))) && (
          <Card>
            <VStack spacing={3}>
              <H3>Settings</H3>
              <VStack spacing={1}>
                <HStack spacing={2} style={{ alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <TextInput
                      label="Omni Design ID"
                      helperText={`The design system the code side wears, by its ID — its published CSS is loaded from it. Saved in this browser. Surf's Up, which the library file is drawn in, is ${DEFAULT_DESIGN_ID}.`}
                      placeholder={dsId}
                      value={draftDsId}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftDsId(e.target.value)}
                      fullWidth
                    />
                  </div>
                  <Button variant="default" size="small" disabled={!draftDsId.trim() || draftDsId.trim() === dsId}
                    onClick={() => { setDsId(draftDsId.trim()); setDraftDsId(''); }}>
                    Use ID
                  </Button>
                </HStack>
                {dsStatus === 'missing' ? (
                  <Alert color="error">{`Nothing is published under ${dsId}. Check the ID — the code side is still wearing the previous system.`}</Alert>
                ) : (
                  <Caption color="quiet">
                    {dsStatus === 'loading' ? 'Loading…' : `Wearing ${STUDIO_THEMES.find((t) => t.id === dsId)?.name ?? 'design system'} (${dsId}).`}
                  </Caption>
                )}
              </VStack>
              <HStack spacing={2} style={{ alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <TextInput
                    label="Figma personal access token"
                    helperText={`Starts with figd_. Saved in this browser only, and shared with the Figma-to-Code workbench. Needs File content and Library content read access.${token.trim() ? ' A token is saved — paste a new one to replace it.' : ''}`}
                    value={draftToken}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftToken(e.target.value)}
                    type="password"
                    fullWidth
                  />
                </div>
                <Button variant="default" size="small" disabled={!draftToken.trim()}
                  onClick={() => { setToken(draftToken.trim()); setDraftToken(''); setEditingToken(false); setError(null); }}>
                  Use token
                </Button>
              </HStack>
              {maskedToken && (
                tokenCheck?.state === 'bad'
                  ? <Alert color="error">{`Saved token ${maskedToken} — ${tokenCheck.detail}. Create a new one in Figma (Settings › Security › Personal access tokens) and paste it above.`}</Alert>
                  : <Caption color="quiet">{`Saved token ${maskedToken}${tokenCheck?.state === 'ok' ? ` — valid, ${tokenCheck.detail}` : tokenCheck?.state === 'checking' ? ' — checking…' : ''}.`}</Caption>
              )}
            </VStack>
          </Card>
        )}
        {error && <Alert color="error">{error}</Alert>}
        {/* A fractional device-pixel ratio means the browser is zoomed. The
            browser then snaps each 1px border DOWN to whole device pixels, so
            code borders draw thinner than Figma's (0.56px at 90% on a Retina
            screen) while the Figma image scales smoothly. */}
        {Math.abs(window.devicePixelRatio - Math.round(window.devicePixelRatio)) > 0.01 && (
          <Alert color="warning">
            Your browser zoom isn't 100%, so code borders draw thinner than they are. Press ⌘0 to
            reset the zoom before comparing borders.
          </Alert>
        )}
        {set && !component && (
          /* One string, not text + expressions: Alert wraps only a STRING child
             in its Typography, so a mixed child array rendered as bare text in
             the browser's default serif. */
          <Alert color="warning">
            {`No code mapping for ${setName} yet, so only the Figma side is shown. Its variant axes: ${
              Object.keys(set.variants[0]?.props ?? {}).join(', ') || 'none'}.`}
          </Alert>
        )}
        {component?.notes?.length ? (
          <Alert color="info">
            <VStack spacing={0}>{component.notes.map((n) => <Body key={n}>{n}</Body>)}</VStack>
          </Alert>
        ) : null}

        {set && layout === 'variants' && (
          // Plain div for the ref: the measurement root, whatever VStack forwards.
          <div ref={codeRef} style={NO_POINTER}><VStack spacing={3}>
            {set.variants.map((v) => {
              const label = Object.values(v.props).join(' · ');
              const own = rows.filter((r) => r.variant === label && !r.ok);
              return (
                <VStack spacing={1} key={v.id}>
                  <Body>{label}{component ? ` — ${own.length ? `${own.length} differ` : 'matches'}` : ''}</Body>
                  {/* Layout primitive: Figma, code and difference in a row. */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                    {windowBox(v, figmaCrop(v), 'Figma')}
                    {component && windowBox(v, variantCell(v, { x: PAD, y: PAD }, true), 'Code')}
                    {component && windowBox(v, (
                      <>
                        {figmaCrop(v)}
                        <Section {...zone} style={{ position: 'absolute', inset: 0, opacity }}>
                          {variantCell(v, { x: PAD, y: PAD }, false)}
                        </Section>
                      </>
                    ), 'Overlay')}
                  </div>
                  {own.length > 0 && (
                    <Table
                      size="small"
                      columns={[
                        { label: 'Part', field: 'part' },
                        { label: 'Property', field: 'prop' },
                        { label: 'Figma', field: 'figma' },
                        { label: 'Code', field: 'code' },
                      ]}
                      rows={own}
                    />
                  )}
                </VStack>
              );
            })}
          </VStack></div>
        )}

        {set && layout === 'set' && (
          // Layout primitive: the stages side by side, wrapping when narrow.
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
            {mode === 'side' && stage(figmaLayer, 'Figma')}
            {mode === 'side' && stage(<div ref={codeRef} style={NO_POINTER}>{codeLayer}</div>, 'Code')}
            {mode !== 'side' && stage(
              <>
                {figmaLayer}
                {/* The code layer paints its own surface, so at full opacity
                    it hides the Figma image completely and the slider fades
                    between the two. */}
                <Section {...zone} style={{ position: 'absolute', inset: 0, opacity }}>
                  <div ref={codeRef} style={NO_POINTER}>{codeLayer}</div>
                </Section>
              </>,
              'Code over Figma',
            )}

            <VStack spacing={2} style={{ flex: 1, minWidth: 360 }}>
              <HStack spacing={2} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Body>
                  {rows.length === 0 ? 'Measuring…' : `${mismatches.length} of ${rows.length} measurements differ`}
                </Body>
                <ToggleButtonGroup value={showAll ? 'all' : 'diff'} onChange={(v: string) => v && setShowAll(v === 'all')} size="small">
                  <Button value="diff" size="small">Differences</Button>
                  <Button value="all" size="small">All</Button>
                </ToggleButtonGroup>
              </HStack>
              <Table
                size="small"
                columns={[
                  { label: 'Variant', field: 'variant' },
                  { label: 'Part', field: 'part' },
                  { label: 'Property', field: 'prop' },
                  { label: 'Figma', field: 'figma' },
                  { label: 'Code', field: 'code' },
                  { label: 'Match', field: 'mark', align: 'center' },
                ]}
                rows={shown.map((r) => ({ ...r, mark: r.ok ? '✓' : '✗' }))}
                empty={<Body color="quiet">{rows.length ? 'No differences.' : 'Measuring…'}</Body>}
              />
              {report && (
                <VStack spacing={1}>
                  <Body>Report for Claude — copy it and paste it into the chat.</Body>
                  <CodeBlock code={report} language="Report" wrap maxHeight={320} />
                </VStack>
              )}
            </VStack>
          </div>
        )}
      </VStack>
    </Section>
  );
}
