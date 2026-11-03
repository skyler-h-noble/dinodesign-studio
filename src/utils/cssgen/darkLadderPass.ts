/**
 * Puts the dark-mode surface ladder into the exported JSON.
 *
 * See utils/darkLadder.ts for the decision and the index maps. This pass is
 * where they land: it runs once, at the end of exportColorSystemToJSON, so the
 * JSON — and therefore the CSS export and the Figma payload, which both read
 * it — carries the ladder. Light mode's values are untouched; the few Theme
 * references that change (below) resolve to exactly what they resolved to
 * before in light mode.
 *
 * What it does, in order:
 *
 * 1. Theme references that named a palette tone directly — a theme's
 *    Surface-Dimmest / Surface-Brightest ({Colors.<P>.Color-3} / -11, or the
 *    #000000 / #ffffff anchors) and the Default theme's Surface-Dimmest — now
 *    name a Backgrounds row (or Default-Background) instead. A palette tone is
 *    the same index in both modes; a row is a Modes value, so dark mode can
 *    paint it on its own ladder. In light mode the row holds that same tone.
 *
 * 2. Dark-mode tables are re-keyed: the entry at a light-mode index holds the
 *    answer for the dark tone that index is painted at (darkLadderMaps). The
 *    answers are not re-solved — each is the table's own curated answer for
 *    that tone, copied — so the tables keep their tuning and only the lookup
 *    changes.
 *
 * 3. Anything outside the Themes that read one of those entries as a TONE (a
 *    state button's label on its tone-6 fill, a tag's text) is pinned to the
 *    value it read before, so re-keying the table cannot move it.
 *
 * 4. --Icons-On-<pal> (content ON an icon) is keyed by the icon's tone, not the
 *    surface's, and the relationship flips in dark mode: icons on the new dark
 *    surfaces are light, so the text on them is dark. Those references move to
 *    a small Icon-On group whose light value is the old reference and whose
 *    dark value is the dark text for the icon actually drawn there.
 *
 * 5. Backgrounds rows paint the ladder (black, tones 1-4), and every row's
 *    five cards become tone 5 of its palette at 45 / 60 / 75 / 88 / 100%
 *    opacity. The CSS and Figma both read these values, so a card composites
 *    over whatever surface it sits on in both.
 *
 * 6. Card roles that fail on the lightest card a level can produce (solid
 *    tone 5) move up their own palette until they pass.
 */
import chroma from 'chroma-js';
import {
  darkLadderMaps, themeWindows, labL, darkCardHex, DARK_LADDER_TONE, DARK_CARD_LEVELS, DARK_CARD_TONE,
  type DarkLadderLevel,
} from '../darkLadder';

type Json = any;

const GLOBAL_FAMILIES = ['Text', 'Header', 'Quiet', 'Border', 'Icon', 'Icon-Variant', 'Eyebrows', 'Default-Button-Border'];
const PALETTE_FAMILIES = ['Hover', 'Pressed'];

function getAt(root: Json, path: string): Json {
  let node = root;
  for (const k of path.split('.')) { node = node?.[k]; if (node === undefined) return undefined; }
  return node;
}

/** Every {value} leaf under a node, as [relative path, leaf]. */
function leaves(node: Json, prefix = ''): Array<[string, Json]> {
  if (!node || typeof node !== 'object') return [];
  if ('value' in node) return [[prefix, node]];
  const out: Array<[string, Json]> = [];
  for (const [k, v] of Object.entries(node)) out.push(...leaves(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

/**
 * Write one leaf's value, copying every object on the way down.
 *
 * The generator reuses token objects: one {value} can sit in several tables,
 * and in both modes. Mutating it in place would move every table that shares
 * it — including light mode's — so each write gets its own path.
 */
function writeLeaf(root: Json, path: string, value: unknown): void {
  const parts = path.split('.');
  let node = root;
  for (const k of parts.slice(0, -1)) {
    const child = node[k];
    node[k] = child && typeof child === 'object' ? { ...child } : {};
    node = node[k];
  }
  const key = parts[parts.length - 1];
  node[key] = { ...(node[key] && typeof node[key] === 'object' ? node[key] : { type: 'color' }), value };
}

const refOf = (v: unknown): string | null =>
  typeof v === 'string' && /^\{[^{}]+\}$/.test(v) ? v.slice(1, -1) : null;

/**
 * Switch for tests only: darkLadder.test.ts builds a system with the pass off
 * to prove light mode is byte-for-byte what it was without it. Nothing in the
 * app turns it off.
 */
export const DARK_LADDER = { enabled: true };

export function applyDarkLadder(colorSystem: Json) {
  const light = colorSystem?.Modes?.['Light-Mode'];
  const dark = colorSystem?.Modes?.['Dark-Mode'];
  if (!light?.Themes || !dark?.Themes) return null;
  const stats = { repointed: 0, remapped: 0, pinned: 0, iconOn: 0, rows: 0, cardRoles: 0 };

  /* ── 1. Theme references that named a tone now name a row ───────────── */
  const lightValue = (path: string) => {
    let v: unknown = getAt(light, path)?.value;
    for (let hop = 0; hop < 6; hop++) {
      const r = refOf(v);
      if (!r || r.startsWith('Colors.')) break;
      v = getAt(light, r)?.value;
    }
    return v;
  };
  const rowFor = (bg: string): string | null => {
    const tone = bg.match(/^\{Colors\.([\w-]+)\.Color-(\d+)\}$/);
    if (tone) {
      const path = `Backgrounds.${tone[1]}.Background-${tone[2]}.Surfaces.Surface`;
      return lightValue(path) === bg ? `{${path}}` : null;
    }
    return null;
  };
  for (const [themeName, theme] of Object.entries<Json>(light.Themes)) {
    for (const section of ['Surfaces-Dimmest', 'Surfaces-Brightest']) {
      const node = theme?.[section]?.Background;
      if (!node || typeof node.value !== 'string') continue;
      const bg: string = node.value;
      let next: string | null = null;
      if (themeName === 'Default') {
        if (section === 'Surfaces-Dimmest' && /^\{Colors\.[\w-]+\.Color-\d+\}$/.test(bg)) next = '{Default-Background.Surface-Dimmest}';
      } else if (bg === '#000000' || bg === '#ffffff') {
        const pal = themeWindows(light).find((w) => w.theme === themeName)?.palette;
        const path = bg === '#000000'
          ? `Backgrounds.${pal}.Background-1.Surfaces.Surface-Dimmest`
          : `Backgrounds.${pal}.Background-12.Surfaces.Surface-Brightest`;
        if (pal && lightValue(path) === bg) next = `{${path}}`;
      } else {
        next = rowFor(bg);
      }
      if (!next) continue;
      for (const mode of [light, dark]) {
        const target = mode.Themes?.[themeName]?.[section]?.Background;
        if (target && target.value === bg) { writeLeaf(mode, `Themes.${themeName}.${section}.Background`, next); stats.repointed++; }
      }
    }
  }

  /* ── 2. Which dark entries move, and from where ──────────────────────── */
  const windows = themeWindows(dark);
  const maps = darkLadderMaps(dark);
  const moves = new Map<string, string>();   // target leaf path -> source leaf path
  const addMove = (base: string, from: string, to: string) => {
    const src = getAt(dark, `${base}.${from}`);
    if (!src || from === to) return;
    for (const [rel] of leaves(src)) moves.set(rel ? `${base}.${to}.${rel}` : `${base}.${to}`, rel ? `${base}.${from}.${rel}` : `${base}.${from}`);
  };
  for (const [nStr, tone] of Object.entries(maps.global)) {
    const n = Number(nStr);
    for (const fam of GLOBAL_FAMILIES) {
      for (const pal of Object.keys(dark[fam]?.Surfaces ?? {})) addMove(`${fam}.Surfaces.${pal}`, `Color-${tone}`, `Color-${n}`);
    }
    for (const state of Object.keys(dark['Tonal-Button']?.Surfaces ?? {})) addMove(`Tonal-Button.Surfaces.${state}`, `Color-${tone}`, `Color-${n}`);
    addMove('Buttons.BlackWhite', `Color-${tone}`, `Color-${n}`);
    addMove('Focus-Visible.Surfaces', `Background-${tone}`, `Background-${n}`);
  }
  for (const [pal, map] of Object.entries(maps.byPalette)) {
    for (const [nStr, tone] of Object.entries(map)) {
      for (const fam of PALETTE_FAMILIES) addMove(`${fam}.${pal}`, `Color-${tone}`, `Color-${Number(nStr)}`);
    }
  }

  /* The rows. Every index a window names paints that level's tone on its
     Surface; the core row (the theme's own Surface index) carries the whole
     ladder, because the Theme's Dim and Bright read it there. Surface-Dimmest
     is pure black for every theme (the owner's choice, not a tinted tone 1),
     so its rows hold the literal. */
  const rowWrites = new Map<string, string>();   // leaf path -> literal value
  for (const w of windows) {
    const paint = (level: DarkLadderLevel) => (DARK_LADDER_TONE[level] === 0 ? '#000000' : `{Colors.${w.palette}.Color-${DARK_LADDER_TONE[level]}}`);
    for (const [level, n] of Object.entries(w.index) as [DarkLadderLevel, number][]) {
      rowWrites.set(`Backgrounds.${w.palette}.Background-${n}.Surfaces.Surface`, paint(level));
    }
    const core = w.index.Surface;
    if (core) {
      const row = `Backgrounds.${w.palette}.Background-${core}.Surfaces`;
      rowWrites.set(`${row}.Surface-Dimmest`, paint('Surface-Dimmest'));
      rowWrites.set(`${row}.Surface-Dim`, paint('Surface-Dim'));
      rowWrites.set(`${row}.Surface-Bright`, paint('Surface-Bright'));
      rowWrites.set(`${row}.Surface-Brightest`, paint('Surface-Brightest'));
    }
    // The black anchor's row end (Neutral's Surface-Dimmest reads it).
    if (w.index['Surface-Dimmest'] === 1) rowWrites.set(`Backgrounds.${w.palette}.Background-1.Surfaces.Surface-Dimmest`, paint('Surface-Dimmest'));
  }

  /* ── 3. Pin every reader that took one of the moved entries as a tone ── */
  const changed = new Set<string>([...moves.keys(), ...rowWrites.keys()]);
  const snapshot = JSON.parse(JSON.stringify({ ...dark, Themes: undefined }));
  const settle = (value: unknown): unknown => {
    let v = value;
    for (let hop = 0; hop < 12; hop++) {
      const r = refOf(v);
      if (!r || !changed.has(r)) break;
      v = getAt(snapshot, r)?.value;
    }
    return v;
  };
  for (const [section, node] of Object.entries<Json>(dark)) {
    if (section === 'Themes' || !node || typeof node !== 'object') continue;
    for (const [rel, leaf] of leaves(node)) {
      const path = `${section}.${rel}`;
      if (changed.has(path)) continue;
      const r = refOf(leaf.value);
      if (r && changed.has(r)) { writeLeaf(dark, path, settle(leaf.value)); stats.pinned++; }
    }
  }
  for (const [to, from] of moves) {
    const source = getAt(snapshot, from);
    if (!getAt(dark, to) || !source) continue;
    writeLeaf(dark, to, settle(source.value));
    stats.remapped++;
  }
  for (const [path, value] of rowWrites) {
    writeLeaf(dark, path, value);
    stats.rows++;
  }

  /* ── 4. Icons-On: keyed by the ICON's tone ───────────────────────────── */
  const hexOf = (raw: unknown): string | null => {
    let v = raw;
    for (let hop = 0; hop < 12; hop++) {
      const r = refOf(v);
      if (!r) break;
      v = getAt(dark, r)?.value;
    }
    return typeof v === 'string' && /^#[0-9a-f]{6}/i.test(v) ? v.slice(0, 7) : null;
  };
  const toneOfRef = (raw: unknown): { pal: string; n: number } | null => {
    let v = raw;
    for (let hop = 0; hop < 12; hop++) {
      const r = refOf(v);
      if (!r) return null;
      const m = r.match(/^Colors\.([\w-]+)\.Color-(\d+)$/);
      if (m) return { pal: m[1], n: Number(m[2]) };
      v = getAt(dark, r)?.value;
    }
    return null;
  };
  const lum = (h: string) => chroma(h).luminance();
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // (pal, k) -> the dark icons it must sit on
  const onUses = new Map<string, { pal: string; k: number; icons: Array<{ hex: string; tone: number | null }> }>();
  const onRefs: Array<{ themeName: string; section: string; key: string; pal: string; k: number }> = [];
  // The Default theme takes part too: its Surface-Dimmest and its cards name
  // Text entries directly (its other levels go through Default-Background,
  // whose On-* the CSS and Figma generators expand per mode).
  for (const [themeName, theme] of Object.entries<Json>(light.Themes)) {
    for (const [section, node] of Object.entries<Json>(theme ?? {})) {
      const icons = node?.Icons;
      if (!icons) continue;
      for (const [key, leaf] of Object.entries<Json>(icons)) {
        if (!key.startsWith('On-')) continue;
        const m = String(leaf?.value ?? '').match(/^\{Text\.Surfaces\.([\w-]+)\.Color-(\d+)\}$/);
        if (!m) continue;
        const pal = m[1], k = Number(m[2]);
        // Unaffected: a light icon tone whose entry did not move keeps
        // meaning the same thing in dark mode.
        if (k >= 6 && !changed.has(`Text.Surfaces.${pal}.Color-${k}`)) continue;
        const iconKey = key.slice(3);
        const darkIconRef = dark.Themes?.[themeName]?.[section]?.Icons?.[iconKey === 'Default' ? 'Default' : iconKey]?.value;
        const hex = hexOf(darkIconRef);
        const use = onUses.get(`${pal}|${k}`) ?? { pal, k, icons: [] };
        if (hex) use.icons.push({ hex, tone: toneOfRef(darkIconRef)?.n ?? null });
        onUses.set(`${pal}|${k}`, use);
        onRefs.push({ themeName, section, key, pal, k });
      }
    }
  }
  if (onUses.size) {
    light['Icon-On'] ??= {};
    dark['Icon-On'] ??= {};
    /* One entry per distinct (light color, dark color) pair in a palette, not
       per icon tone: several tones read the same text in both modes, and every
       entry is a Figma variable Modes has little room for. The light value is
       the color the old reference resolved to, so light mode paints the same. */
    const lightFinal = (ref: string): string => {
      let v: unknown = ref;
      for (let hop = 0; hop < 8; hop++) {
        const r = refOf(v);
        if (!r || r.startsWith('Colors.')) break;
        v = getAt(light, r)?.value;
      }
      return String(v);
    };
    const entryFor = new Map<string, string>();   // `${pal}|${k}` -> entry key
    const entryByPair = new Map<string, string>(); // `${pal}|${light}|${dark}` -> entry key
    for (const { pal, k, icons } of onUses.values()) {
      const lightRef = lightFinal(`{Text.Surfaces.${pal}.Color-${k}}`);
      // Dark: the table's own answer for the icon's tone (snapshot = before
      // re-keying, so it is still tone-keyed), checked on every icon it sits
      // on; the palette's darkest tone if no single answer clears them all.
      const candidates = icons
        .map((i) => (i.tone ? settle(getAt(snapshot, `Text.Surfaces.${pal}.Color-${i.tone}`)?.value) : null))
        .filter((v): v is string => typeof v === 'string');
      const passes = (v: string) => { const h = hexOf(v); return !!h && icons.every((i) => ratio(h, i.hex) >= 4.5); };
      const darkValue = k >= 6
        ? settle(getAt(snapshot, `Text.Surfaces.${pal}.Color-${k}`)?.value)
        : (candidates.find(passes) ?? `{Colors.${pal}.Color-1}`);
      /* Cheaper still: an existing Text entry the pass did not re-key, holding
         the same color in light mode and a color that clears every icon it
         sits on in dark mode, answers without a new variable. */
      const reuse = Array.from({ length: 12 }, (_, i) => i + 1).find((j) => {
        const path = `Text.Surfaces.${pal}.Color-${j}`;
        if (changed.has(path) || lightFinal(`{${path}}`) !== lightRef) return false;
        const h = hexOf(getAt(dark, path)?.value);
        return !!h && icons.length > 0 && icons.every((i) => ratio(h, i.hex) >= 4.5);
      });
      if (reuse) { entryFor.set(`${pal}|${k}`, `reuse:${reuse}`); continue; }
      /* Keyed by the light color alone. Every dark-mode icon here is light, so
         where two tones share a light color the DARKER of their dark answers
         serves both — it can only add contrast on a light icon. */
      const pair = `${pal}|${lightRef}`;
      let entry = entryByPair.get(pair);
      if (!entry) {
        entry = `Color-${k}`;
        entryByPair.set(pair, entry);
        (light['Icon-On'][pal] ??= {})[entry] = { value: lightRef, type: 'color' };
        dark['Icon-On'][pal] ??= {};
        stats.iconOn++;
      }
      const held = dark['Icon-On'][pal][entry]?.value;
      const darker = (a: unknown, b: unknown) => {
        const [ha, hb] = [hexOf(a), hexOf(b)];
        return ha && hb && lum(hb) < lum(ha) ? b : a;
      };
      dark['Icon-On'][pal][entry] = { value: held === undefined ? darkValue : darker(held, darkValue), type: 'color' };
      entryFor.set(`${pal}|${k}`, entry);
    }
    for (const { themeName, section, key, pal, k } of onRefs) {
      for (const mode of [light, dark]) {
        if (mode.Themes?.[themeName]?.[section]?.Icons?.[key]) {
          const entry = entryFor.get(`${pal}|${k}`)!;
          const target = entry.startsWith('reuse:')
            ? `{Text.Surfaces.${pal}.Color-${entry.slice(6)}}`
            : `{Icon-On.${pal}.${entry}}`;
          writeLeaf(mode, `Themes.${themeName}.${section}.Icons.${key}`, target);
        }
      }
    }
  }

  /* ── 5. Every row's cards: tone 5 at five opacities ──────────────────────
   *
   * The same five values in every row of a palette, because a card no longer
   * depends on the surface: it is laid over it (utils/darkLadder.ts, Cards).
   * Highest is solid tone 5 and stays a reference, so it follows the palette.
   * The other four are tone 5 with an alpha. A color variable cannot hold "this
   * alias at 45%" (its value is one RGBA or one alias), and the Figma plugin
   * API can only bind a paint's COLOR to a variable, not its opacity — so the
   * resolved RGBA is written, here, once, for the CSS and Figma to share. */
  for (const pal of Object.keys(dark.Backgrounds ?? {})) {
    const tone5 = String(dark.Colors?.[pal]?.[`Color-${DARK_CARD_TONE}`]?.value ?? '').slice(0, 7);
    if (!/^#[0-9a-f]{6}$/i.test(tone5)) continue;
    for (const [rowName, row] of Object.entries<Json>(dark.Backgrounds[pal] ?? {})) {
      if (!row?.Containers) continue;
      for (const level of DARK_CARD_LEVELS) {
        writeLeaf(dark, `Backgrounds.${pal}.${rowName}.Containers.${level}`,
          level === 'Container-Highest' ? `{Colors.${pal}.Color-${DARK_CARD_TONE}}` : darkCardHex(tone5, level));
      }
    }
  }

  /* ── 6. Card roles carry the lightest card ───────────────────────────────
   *
   * A card is tone 5 laid over a surface, so the lightest thing any card can
   * paint is solid tone 5 (Highest, or any level over a surface as light as
   * tone 5 — none is). Every dark-mode card role is lighter than the card, so
   * that lightest card is where each one is hardest to read; passing there
   * means passing on every level over every surface. The card tables were
   * tuned for the old dark cards, Color-2..4, so a few cells that passed there
   * fail on tone 5 — an eyebrow at a mid tone, for one. Palettes share one
   * lightness per tone by construction, so one neutral ground at the lightest
   * tone 5 stands for all of them. A cell that passes is the design and is
   * left exactly as it is; a failing one moves the fewest steps up its own
   * palette (lighter, away from the dark card) that clear it — the same move
   * the Card Quiet block makes. */
  const tone5L = Math.max(...windows.map((w) => labL(String(dark.Colors?.[w.palette]?.[`Color-${DARK_CARD_TONE}`]?.value ?? '').slice(0, 7)))
    .filter((l) => Number.isFinite(l)));
  if (Number.isFinite(tone5L)) {
    const ground = chroma.lab(tone5L, 0, 0).hex();
    const contrastOn = (hex: string) => {
      const c = chroma(hex);
      const fg = c.alpha() < 1 ? chroma.mix(ground, c.alpha(1), c.alpha(), 'rgb') : c;
      return ratio(fg.hex('rgb'), ground);
    };
    /* Color-Vibrant is two colors: Figma paints the Vibrant variable, the CSS
       export reads it as Color-8 (exportToCSS pre-resolves it). A cell holding
       it has to clear on both. */
    const vibrant = (v: unknown) => String(v ?? '').match(/^\{Colors\.([\w-]+)\.Color-Vibrant\}$/)?.[1];
    const passesOn = (v: unknown, threshold: number): boolean => {
      const s = String(v ?? '');
      const vib = vibrant(s);
      const hexes = vib
        ? [hexOf(s), hexOf(`{Colors.${vib}.Color-8}`)]
        : [s.startsWith('#') ? s : hexOf(s)];
      return hexes.every((h) => !h || contrastOn(h) >= threshold);
    };
    const fix = (path: string, threshold: number) => {
      const leaf = getAt(dark, path);
      if (!hexOf(leaf?.value) || passesOn(leaf.value, threshold)) return;
      const vib = vibrant(leaf.value);
      const tone = vib ? { pal: vib, n: 8 } : toneOfRef(leaf.value);
      if (!tone) return;
      for (let n = tone.n + 1; n <= 12; n++) {
        const step = hexOf(`{Colors.${tone.pal}.Color-${n}}`);
        if (step && contrastOn(step) >= threshold) {
          writeLeaf(dark, path, `{Colors.${tone.pal}.Color-${n}}`);
          stats.cardRoles++;
          return;
        }
      }
    };
    const CARD_FAMILIES: Array<[string, number]> = [
      ['Text', 4.5], ['Quiet', 4.5], ['Eyebrows', 4.5],
      ['Header', 3], ['Border', 3], ['Icon', 3],
    ];
    for (const [fam, threshold] of CARD_FAMILIES) {
      for (const [pal, cells] of Object.entries<Json>(dark[fam]?.Containers ?? {})) {
        for (const key of Object.keys(cells ?? {})) fix(`${fam}.Containers.${pal}.${key}`, threshold);
      }
    }
    for (const key of Object.keys(dark['Focus-Visible']?.Containers ?? {})) fix(`Focus-Visible.Containers.${key}`, 3);
    for (const [pal, cells] of Object.entries<Json>(dark['Default-Button-Border']?.Containers ?? {})) {
      // BlackWhite is the card's Text-BW (4.5); the rest are button edges (3).
      for (const key of Object.keys(cells ?? {})) fix(`Default-Button-Border.Containers.${pal}.${key}`, pal.startsWith('BlackWhite') ? 4.5 : 3);
    }

    /* A card role the Theme layer names as a palette COLOR rather than a
       table cell — a dark card's link is {Colors.Info.Color-Vibrant} — is the
       same color in both modes and cannot follow the tone-5 cards. When it
       fails on the lightest card it goes through a one-entry Card-Accent group
       (light: the color it always was; dark: the nearest lighter tone that
       clears), so the Theme reference stays one name in both modes.
       The entry is named Accent, not Color-Vibrant: the CSS export rewrites
       any ".Color-Vibrant" path to ".Color-8" before looking it up, which sent
       the light sheet to an undefined var(--Card-Accent-Info-Color-8). */
    const CARD_TEXT_ROLES = new Set(['Hotlink', 'Hotlink-Visited', 'Eyebrow', 'Quiet', 'Text', 'Text-BW']);
    const accents = new Map<string, string>();
    for (const [themeName, theme] of Object.entries<Json>(dark.Themes)) {
      const cont = theme?.Containers;
      if (!cont) continue;
      for (const [role, leaf] of Object.entries<Json>(cont)) {
        const v = leaf?.value;
        const vib = vibrant(v);
        if (!vib || !CARD_TEXT_ROLES.has(role) || passesOn(v, 4.5)) continue;
        if (!accents.has(vib)) {
          let pick: string | null = null;
          for (let n = 9; n <= 12 && !pick; n++) if (passesOn(`{Colors.${vib}.Color-${n}}`, 4.5)) pick = `{Colors.${vib}.Color-${n}}`;
          if (!pick) continue;
          (light['Card-Accent'] ??= {})[vib] = { Accent: { value: v, type: 'color' } };
          (dark['Card-Accent'] ??= {})[vib] = { Accent: { value: pick, type: 'color' } };
          accents.set(vib, `{Card-Accent.${vib}.Accent}`);
          stats.cardRoles++;
        }
        for (const mode of [light, dark]) {
          if (mode.Themes?.[themeName]?.Containers?.[role]?.value === v) writeLeaf(mode, `Themes.${themeName}.Containers.${role}`, accents.get(vib));
        }
      }
    }
  }

  return { ...stats, maps, windows };
}

