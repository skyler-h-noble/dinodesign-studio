/**
 * Accessibility report generator.
 *
 * Reads a design system's tokens.json (the structure emitted by
 * src/utils/generateDesignSystem.ts) and computes WCAG 2.2 AA contrast checks
 * across both modes (light/dark), four studio background choices (white, black,
 * primary-light, primary-vibrant), and the eight surface/container levels
 * exposed per background. Output is consumed by the /accessibility-report page.
 *
 * Scope choices that are not explicit in the raw token structure:
 * - "All backgrounds" is interpreted as the four user-selectable backgrounds
 *   in the studio UI, not the full Background-1..12 × 8-palette enumeration.
 * - Button border is treated as equal to the button fill, because the token
 *   system does not emit a separate per-variant border token; for solid and
 *   outlined variants alike, the border's effective contrast against the
 *   surface equals the fill's contrast against the surface.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

type Mode = 'Light' | 'Dark';

export interface ReportCheck {
  category: 'Text' | 'Header' | 'Focus' | 'Input' | 'Button';
  label: string;
  /** Dot-path of the foreground token under test, e.g. Text.Surfaces.Primary.Color-9 */
  token: string;
  fgColor: string;
  bgColor: string;
  ratio: number;
  required: number;
  passes: boolean;
}

export interface ReportSection {
  mode: Mode;
  background: string;      // human label, e.g. "White (Neutral-12)"
  surfaceLevel: string;    // e.g. "Surface", "Container-High"
  surfaceBg: string;       // resolved hex
  checks: ReportCheck[];
}

// ─── Token resolution ──────────────────────────────────────────────────────

/**
 * Resolve a token reference like "{Colors.Primary.Color-6}" (or a raw hex)
 * against a mode tree. Follows chains up to a small depth cap.
 */
function resolveRef(value: unknown, modeTree: any, depth = 0): string {
  if (depth > 8) return '';
  if (typeof value !== 'string') return '';
  if (!value.startsWith('{') || !value.endsWith('}')) return value;
  const path = value.slice(1, -1).split('.');
  // Exact path first, then common short-form fallback: a single-segment
  // token like `{White}` actually lives under `Colors.White`.
  const candidates: string[][] = [path];
  if (path.length === 1) candidates.push(['Colors', path[0]]);
  for (const p of candidates) {
    let node: any = modeTree;
    for (const part of p) {
      if (node == null) { node = null; break; }
      node = node[part];
    }
    if (node == null) continue;
    if (typeof node === 'string') {
      if (node.startsWith('{')) return resolveRef(node, modeTree, depth + 1);
      return node;
    }
    if (typeof node === 'object' && 'value' in node) {
      const v = node.value;
      if (typeof v !== 'string') return String(v ?? '');
      if (v.startsWith('{')) return resolveRef(v, modeTree, depth + 1);
      return v;
    }
  }
  return '';
}

/** Fetch a token's resolved hex by dot path. Returns '' if missing. */
function getHex(modeTree: any, path: string): string {
  return resolveRef(`{${path}}`, modeTree);
}

// ─── Contrast math (WCAG 2.2) ──────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  // Accept 8-digit hex by ignoring alpha; callers that need alpha use parseHexRgba.
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6 || !/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Parse a 3/6/8-digit hex into [r, g, b, a] where a is 0..1. Opaque hexes return a=1. */
function parseHexRgba(hex: string): [number, number, number, number] | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

/**
 * Composite a translucent color over an opaque background to get the effective
 * opaque color the user actually perceives. If the overlay is already opaque
 * (a=1), it's returned unchanged. Used for button hover/active tokens emitted
 * as 8-digit hexes (e.g. rgba(255,255,255,0.73) overlaid on the button fill).
 */
function compositeOver(overlayHex: string, baseHex: string): string {
  const overlay = parseHexRgba(overlayHex);
  if (!overlay) return overlayHex;
  const [r, g, b, a] = overlay;
  if (a >= 1) return `#${[r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')}`;
  const base = parseHexRgba(baseHex);
  if (!base) return overlayHex;
  const [br, bg, bb] = base;
  const mix = (o: number, bc: number) => Math.round(o * a + bc * (1 - a));
  return `#${[mix(r, br), mix(g, bg), mix(b, bb)].map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function contrastRatio(fg: string, bg: string): number {
  const rgbA = hexToRgb(fg);
  const rgbB = hexToRgb(bg);
  if (!rgbA || !rgbB) return 0;
  const la = relativeLuminance(rgbA);
  const lb = relativeLuminance(rgbB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return relativeLuminance(rgb) > 0.5;
}

/**
 * Given a surface hex, find the Color-N key of the reference palette whose
 * tone is closest in luminance. Used to look up border / text tones for
 * derived surface levels (Containers, Surface-Dim, Surface-Bright) whose hex
 * doesn't equal the background choice's own Color-N.
 */
function closestColorNKey(modeTree: any, palette: string, surfaceHex: string): string {
  const rgb = hexToRgb(surfaceHex);
  if (!rgb) return 'Color-12';
  const targetL = relativeLuminance(rgb);
  let bestKey = 'Color-12';
  let bestDiff = Infinity;
  const paletteNode = modeTree?.Colors?.[palette];
  if (!paletteNode) return bestKey;
  for (const key of Object.keys(paletteNode)) {
    if (!key.startsWith('Color-')) continue;
    const hex = resolveRef(`{Colors.${palette}.${key}}`, modeTree);
    const candidateRgb = hexToRgb(hex);
    if (!candidateRgb) continue;
    const diff = Math.abs(relativeLuminance(candidateRgb) - targetL);
    if (diff < bestDiff) { bestDiff = diff; bestKey = key; }
  }
  return bestKey;
}

function check(
  category: ReportCheck['category'],
  label: string,
  token: string,
  fg: string,
  bg: string,
  required: number,
): ReportCheck | null {
  if (!fg || !bg) return null;
  const ratio = contrastRatio(fg, bg);
  return {
    category, label, token, fgColor: fg, bgColor: bg, ratio, required,
    passes: ratio >= required,
  };
}

// ─── Background + surface enumeration ──────────────────────────────────────

/**
 * Which Background-N entries to treat as the user-selectable backgrounds.
 * These four match the ColorAssignmentStage background options.
 */
const BACKGROUND_CHOICES: Array<{
  label: string;                 // human-readable row header
  palette: 'Neutral' | 'Primary';
  bgKey: string;                 // key under Backgrounds.{palette}.{bgKey}
  colorN: number | 'Vibrant';    // matching Color-N index for foreground token lookups
}> = [
  { label: 'White',           palette: 'Neutral', bgKey: 'Background-12',      colorN: 12 },
  { label: 'Black',           palette: 'Neutral', bgKey: 'Background-1',       colorN: 1 },
  { label: 'Primary Light',   palette: 'Primary', bgKey: 'Background-11',      colorN: 11 },
  { label: 'Primary Vibrant', palette: 'Primary', bgKey: 'Background-Vibrant', colorN: 'Vibrant' },
];

/** Eight surface levels the token system emits per background. */
const SURFACE_LEVELS: Array<{ label: string; group: 'Surfaces' | 'Containers'; key: string }> = [
  { label: 'Surface',           group: 'Surfaces',   key: 'Surface' },
  { label: 'Surface-Dim',       group: 'Surfaces',   key: 'Surface-Dim' },
  { label: 'Surface-Bright',    group: 'Surfaces',   key: 'Surface-Bright' },
  { label: 'Container',         group: 'Containers', key: 'Container' },
  { label: 'Container-Low',     group: 'Containers', key: 'Container-Low' },
  { label: 'Container-Lowest',  group: 'Containers', key: 'Container-Lowest' },
  { label: 'Container-High',    group: 'Containers', key: 'Container-High' },
  { label: 'Container-Highest', group: 'Containers', key: 'Container-Highest' },
];

/**
 * Read the resolved surface hex for a given background/surface combo.
 * Backgrounds values are sometimes direct hex, sometimes `{Colors.X.Color-N}`
 * refs — resolveRef handles both.
 */
function resolveSurface(modeTree: any, bg: typeof BACKGROUND_CHOICES[number], surface: typeof SURFACE_LEVELS[number]): string {
  const node = modeTree?.Backgrounds?.[bg.palette]?.[bg.bgKey]?.[surface.group]?.[surface.key];
  if (node) {
    const value = typeof node === 'object' ? node.value : node;
    const resolved = resolveRef(value, modeTree);
    if (resolved) return resolved;
  }
  // Fallback: some token exports emit broken refs for the base Surface entry
  // (e.g. `{Colors.Primary.Color-13}` when only Color-1..12 + Vibrant exist).
  // For the main Surface level, fall back to the palette's Color-N directly.
  if (surface.key === 'Surface') {
    return getHex(modeTree, `Colors.${bg.palette}.${colorNKey(bg.colorN)}`);
  }
  return '';
}

// ─── Per-surface check assembly ────────────────────────────────────────────

const TEXT_PALETTES  = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Info', 'Success', 'Warning', 'Error'] as const;
const HEADER_PALETTES = ['Neutral', 'Primary', 'Secondary', 'Tertiary', 'Success', 'Warning', 'Error'] as const;
const BUTTON_PALETTES = ['Primary', 'Secondary', 'Tertiary', 'Neutral', 'Info', 'Success', 'Warning', 'Error'] as const;

function colorNKey(n: number | 'Vibrant'): string {
  return n === 'Vibrant' ? 'Color-Vibrant' : `Color-${n}`;
}

function collectChecks(
  modeTree: any,
  bg: typeof BACKGROUND_CHOICES[number],
  surfaceBg: string,
): ReportCheck[] {
  const checks: ReportCheck[] = [];
  // The background choice's nominal Color-N is only correct for the base
  // Surface. Derived surfaces (Surface-Dim/Bright and all Containers) render
  // at different tones. Map the actual surface hex back to the palette's
  // closest Color-N so Text / Header / Quiet / Border / button-border
  // lookups use the accessible tone for this surface's real lightness.
  const bgColorKey = closestColorNKey(modeTree, bg.palette, surfaceBg);

  // ── Text (4.5:1) ──
  // Text.Surfaces.{palette}.Color-{N} is keyed by the surface's tone index,
  // not the surface's palette — it returns the accessible tone of {palette}
  // to use AS TEXT on any surface at that lightness. So "Primary Text on a
  // white surface" is Text.Surfaces.Primary.Color-12 (resolves to a dark
  // primary tone). This is the right lookup for the per-palette text rows.
  // An interactive surface changes background under the text on hover/pressed,
  // so text + quiet must clear 4.5 against ALL three states, not just resting.
  // The surface's hover/pressed scrims are Hover/Pressed.{palette}.Color-N.
  const surfaceHover = getHex(modeTree, `Hover.${bg.palette}.${bgColorKey}`);
  const surfacePressed = getHex(modeTree, `Pressed.${bg.palette}.${bgColorKey}`);
  const textStates: Array<{ bg: string; suffix: string }> = [{ bg: surfaceBg, suffix: '' }];
  if (surfaceHover) textStates.push({ bg: surfaceHover, suffix: ' → Hover' });
  if (surfacePressed) textStates.push({ bg: surfacePressed, suffix: ' → Pressed' });

  for (const st of textStates) {
    const defaultTextTok = `Text.Surfaces.${bg.palette}.${bgColorKey}`;
    const defaultText = getHex(modeTree, defaultTextTok);
    const cdt = check('Text', `Default Text${st.suffix}`, defaultTextTok, defaultText, st.bg, 4.5);
    if (cdt) checks.push(cdt);

    for (const pal of TEXT_PALETTES) {
      const tok = `Text.Surfaces.${pal}.${bgColorKey}`;
      const fg = getHex(modeTree, tok);
      const c = check('Text', `${pal} Text${st.suffix}`, tok, fg, st.bg, 4.5);
      if (c) checks.push(c);
    }

    // Quiet (secondary text — still subject to 4.5:1 for readability per AA)
    const quietTok = `Quiet.Surfaces.${bg.palette}.${bgColorKey}`;
    const quiet = getHex(modeTree, quietTok);
    const cq = check('Text', `Quiet Text${st.suffix}`, quietTok, quiet, st.bg, 4.5);
    if (cq) checks.push(cq);

    // Hotlink — conventional link color from Info palette, using its accessible
    // text tone for this surface lightness.
    const hotlinkTok = `Text.Surfaces.Info.${bgColorKey}`;
    const hotlink = getHex(modeTree, hotlinkTok);
    const chl = check('Text', `Hotlink${st.suffix}`, hotlinkTok, hotlink, st.bg, 4.5);
    if (chl) checks.push(chl);

    // Eyebrow — a small label above a heading, so it is body-sized text and
    // carries the full 4.5, not the 3:1 large-text allowance a Header gets.
    // Each background borrows a different brand colour (Primary → Secondary,
    // Secondary → Tertiary, Tertiary/Neutral → Primary, states → BW), so it is
    // resolved from the Eyebrows table rather than assumed to match Text.
    const eyebrowTok = `Eyebrows.Surfaces.${bg.palette}.${bgColorKey}`;
    const eyebrow = getHex(modeTree, eyebrowTok);
    const ceb = check('Text', `Eyebrow${st.suffix}`, eyebrowTok, eyebrow, st.bg, 4.5);
    if (ceb) checks.push(ceb);
  }

  // ── Headers (3:1, large text) ──
  // Checked against hover and pressed as well as resting: an interactive
  // surface changes the background under a heading exactly as it does under
  // body text, and previously only the resting state was verified — so a
  // header could pass at rest and fail the moment the surface was hovered.
  for (const st of textStates) {
    const defaultHeaderTok = `Header.Surfaces.${bg.palette}.${bgColorKey}`;
    const defaultHeader = getHex(modeTree, defaultHeaderTok);
    const cdh = check('Header', `Default Header${st.suffix}`, defaultHeaderTok, defaultHeader, st.bg, 3);
    if (cdh) checks.push(cdh);
    for (const pal of HEADER_PALETTES) {
      const tok = `Header.Surfaces.${pal}.${bgColorKey}`;
      const fg = getHex(modeTree, tok);
      const c = check('Header', `${pal} Header${st.suffix}`, tok, fg, st.bg, 3);
      if (c) checks.push(c);
    }
  }

  // ── Focus-Visible (3:1 UI component) ──
  // Focus-Visible.Surfaces is keyed by Background-N. Use the actual surface's
  // closest Color-N (already computed as bgColorKey) and convert to the
  // matching Background-N so derived surfaces (Containers, Surface-Dim)
  // resolve to an appropriate focus color for their real lightness.
  const bgSuffix = bgColorKey.replace('Color-', 'Background-');
  const focusTok = `Focus-Visible.Surfaces.${bgSuffix}`;
  const focus =
    getHex(modeTree, focusTok) ||
    getHex(modeTree, `Focus-Visible.Surfaces.${bg.bgKey}`) ||
    getHex(modeTree, `Colors.Info.Color-Vibrant`);
  const cf = check('Focus', 'Focus-Visible Ring', focusTok, focus, surfaceBg, 3);
  if (cf) checks.push(cf);

  // ── Input border (3:1) ──
  const borderTok = `Border.Surfaces.${bg.palette}.${bgColorKey}`;
  const border = getHex(modeTree, borderTok);
  const cb = check('Input', 'Input Border', borderTok, border, surfaceBg, 3);
  if (cb) checks.push(cb);
  const cab = check('Input', 'Input Active Border', focusTok, focus, surfaceBg, 3);
  if (cab) checks.push(cab);

  // ── Buttons ──
  // Pick Light or Medium bucket based on surface lightness (per token design).
  const bucket = isLight(surfaceBg) ? 'Light' : 'Medium';
  for (const pal of BUTTON_PALETTES) {
    const fillTok = `Buttons.${pal}.${bucket}.Button`;
    const textTok = `Buttons.${pal}.${bucket}.Text`;
    const fill = getHex(modeTree, fillTok);
    const text = getHex(modeTree, textTok);
    // Button borders have their own dedicated token in Border.Surfaces —
    // the design system picks an accessible tone of the button's palette
    // against the current surface (distinct from the fill).
    const borderTok = `Border.Surfaces.${pal}.${bgColorKey}`;
    const border = getHex(modeTree, borderTok) || fill;
    if (!fill || !text) continue; // skip if the variant isn't defined

    // Button border vs surface (3:1)
    if (border) checks.push(check('Button', `${pal} Button border → surface`, borderTok, border, surfaceBg, 3)!);
    // Button text vs button fill (4.5:1)
    checks.push(check('Button', `${pal} Button text → fill`, textTok, text, fill, 4.5)!);

    // Hover / Pressed — READ the baked button-state tokens rather than
    // recomputing. This is what makes the report match CSS + Figma exactly:
    // all three resolve the same emitted token. The values are solid tones
    // (the tone±1 hover/pressed rule); if a token is ever emitted as an
    // 8-digit alpha overlay, compositeOver blends it onto the fill to get the
    // perceived background. Button text is checked against each at 4.5.
    const hoverTok = `Buttons.${pal}.${bucket}.Hover`;
    const pressedTok = `Buttons.${pal}.${bucket}.Pressed`;
    const hoverRaw = getHex(modeTree, hoverTok);
    const pressedRaw = getHex(modeTree, pressedTok);
    if (hoverRaw) {
      const hoverBg = compositeOver(hoverRaw, fill);
      checks.push(check('Button', `${pal} Button hover → text`, hoverTok, text, hoverBg, 4.5)!);
    }
    if (pressedRaw) {
      const pressedBg = compositeOver(pressedRaw, fill);
      checks.push(check('Button', `${pal} Button pressed → text`, pressedTok, text, pressedBg, 4.5)!);
    }
  }

  // ── BlackWhite button ──
  // Not part of BUTTON_PALETTES: it has no palette and no Light/Medium bucket.
  // It is a resolved table keyed by the BACKGROUND's tone — white face on
  // tones 1-5, black from 6 up — so the lookup is by this surface's own tone,
  // and its border is the fill rather than a Border.Surfaces entry.
  {
    const bwPath = `Buttons.BlackWhite.${bgColorKey}`;
    const bwFill = getHex(modeTree, `${bwPath}.Button`);
    const bwText = getHex(modeTree, `${bwPath}.Text`);
    if (bwFill && bwText) {
      checks.push(check('Button', 'BlackWhite Button text → fill', `${bwPath}.Text`, bwText, bwFill, 4.5)!);
      // A black-or-white fill is its own border, so this is the separation the
      // button gets from the surface it sits on — non-text, hence 3:1.
      checks.push(check('Button', 'BlackWhite Button → surface', `${bwPath}.Button`, bwFill, surfaceBg, 3)!);
      const bwHover = getHex(modeTree, `${bwPath}.Hover`);
      const bwPressed = getHex(modeTree, `${bwPath}.Pressed`);
      if (bwHover) {
        checks.push(check('Button', 'BlackWhite Button hover → text',
          `${bwPath}.Hover`, bwText, compositeOver(bwHover, bwFill), 4.5)!);
      }
      if (bwPressed) {
        checks.push(check('Button', 'BlackWhite Button pressed → text',
          `${bwPath}.Pressed`, bwText, compositeOver(bwPressed, bwFill), 4.5)!);
      }
    }
  }

  return checks.filter(Boolean);
}

// ─── Public entry point ────────────────────────────────────────────────────

export function buildAccessibilityReport(tokens: any): ReportSection[] {
  const modes: Array<{ mode: Mode; tree: any }> = [];
  if (tokens?.Modes?.['Light-Mode']) modes.push({ mode: 'Light', tree: tokens.Modes['Light-Mode'] });
  if (tokens?.Modes?.['Dark-Mode'])  modes.push({ mode: 'Dark',  tree: tokens.Modes['Dark-Mode'] });

  const sections: ReportSection[] = [];
  for (const { mode, tree } of modes) {
    for (const bg of BACKGROUND_CHOICES) {
      for (const surface of SURFACE_LEVELS) {
        const surfaceBg = resolveSurface(tree, bg, surface);
        if (!surfaceBg) continue; // skip if the token system doesn't define this combo
        const checks = collectChecks(tree, bg, surfaceBg);
        sections.push({
          mode,
          background: `${bg.label} (${bg.palette}-${bg.colorN})`,
          surfaceLevel: surface.label,
          surfaceBg,
          checks,
        });
      }
    }
  }
  return sections;
}
