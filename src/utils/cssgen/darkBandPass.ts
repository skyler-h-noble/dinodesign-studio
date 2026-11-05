/**
 * Dark-mode bands: the Primary, Secondary and Tertiary themes keep some color.
 *
 * The rule (utils/darkLadder.ts, Bands): such a theme's dark Surface is
 * S = min(L, 8), L being the tone its Surface paints in light mode; its levels
 * are S-2 .. S+2 and its cards tone S+1 mixed over S. Everything else keeps
 * the tones 1-5 ladder. This is step 7 of darkLadderPass and runs after it, so
 * the shared tables, rows and maps are exactly what the ladder made them —
 * nothing another theme reads moves. Only these three themes' own Theme
 * references change.
 *
 * ── Why the references, and why both modes ─────────────────────────────────
 * The Theme layer is mode-independent (Figma builds it once, from Light-Mode),
 * and the tables it points into are shared: Primary's Surface reads
 * {Text.Surfaces.Neutral.Color-6}, which Info's Surface-Bright reads too, and
 * the ladder answers that entry for a DARK tone-4 surface. A band surface is
 * often light (Surf's Primary: tone 8), so it needs a different answer from
 * the same light-mode reference. So the band's references are repointed — in
 * both modes, always to something that resolves to exactly what the old
 * reference resolved to in light mode — at, in order of preference:
 *
 *   1. what they already name, when that already clears the role's threshold
 *      on the band (a pass is a pass);
 *   2. another index of the SAME table whose light-mode answer is this one's
 *      and whose dark-mode answer clears the band — the Theme layer keeps
 *      pointing into the role's own table, at no cost;
 *   3. the palette tone the light-mode answer IS ({Colors.<P>.Color-k}), when
 *      that tone, from the dark ramp, clears the band: the light table's own
 *      curated choice of tone in both modes ("stays true"). No cost either;
 *   4. a Band entry: a Modes variable whose light value is the old reference
 *      and whose dark value is the dark table's own answer for the tone the
 *      level paints (read from the TONE-keyed tables, before the ladder
 *      re-keyed them). Shared wherever two references need the same pair.
 *
 * Roles the Figma payload does not carry as colors (Quiet, the outline labels,
 * icon variants — Figma draws them as Text / an icon at an opacity) take the
 * same steps but their entries go to a CSS-only group.
 *
 * Backgrounds and cards: a level that paints the same index in both modes
 * names the palette tone; the rest are Band entries. The Default button of
 * every section is solved later by Cell-Button against the band's background,
 * as it is for every theme. State and black/white buttons move as a unit
 * (fill, label, states and — for a state button — the border, which IS the
 * fill), so a button never mixes two tones.
 */
import chroma from 'chroma-js';
import {
  BAND_THEMES, bandSurfaceTone, bandTones, bandCardTone, bandCardHexesForRamp, blackCardHexesForPage, DARK_CARD_LEVELS, SECTION_LEVEL,
  LADDER_BANDS_KEY, type BandInfo, type DarkLadderLevel,
} from '../darkLadder';
import { variantHex8, BORDER_VARIANT_ALPHA, ICON_VARIANT_ALPHA } from '../variantAlpha';
import { getAt, leaves, writeLeaf, refOf } from './darkLadderPass';

type Json = any;

/** Switch for tests only (the before/after proofs). Nothing in the app turns it off. */
export const BANDS = { enabled: true };

/** The Modes group Band entries live in. Exported to Figma. */
export const BAND_GROUP = 'Band';
/** Band button units: Band-Button.<id>.<field>, read whole by the Figma
 *  payload the way it reads a Cell-Button entry. Exported to Figma. */
export const BAND_BUTTON_GROUP = 'Band-Button';
/** Entries for roles the Figma payload strips from the Theme collection
 *  (Quiet, Outline-Text / -Quiet, icon variants). The CSS's only. */
export const BAND_CSS_GROUP = 'Band-CSS';
/** The page's On-* references as they were before the band step, per palette
 *  and section: the Default theme takes its On-* from the theme of its own
 *  palette, level for level, and that has to stay the ladder's. */
export const LADDER_PAGE_ICONS_KEY = 'Ladder-Page-Icons';
/** A band button border's reference before the band step, by
 *  'Theme.Section.Buttons.<Name>.Border' (the Figma payload reads it). */
export const BAND_ORIGINALS_KEY = 'Ladder-Band-Originals';

/** Groups the Figma payload exports with every entry, so a Band entry's light
 *  value can alias them. Anything else is written as its light-mode value. */
const FIGMA_ALIASABLE = new Set([
  'Text', 'Header', 'Border', 'Border-Variant', 'Icon', 'Eyebrows', 'Default-Button-Border',
  'Focus-Visible', 'Hover', 'Pressed', 'Tonal-Button', 'Colors', 'Backgrounds', 'Icon-On',
]);

const lum = (h: string) => chroma(h).luminance();
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** `fg` (alpha allowed) laid over the opaque `bg`. */
const over = (fg: string, bg: string) => {
  const c = chroma(fg);
  return c.alpha() >= 1 ? c.hex('rgb') : chroma.mix(bg, c.alpha(1).hex('rgb'), c.alpha(), 'rgb').hex('rgb');
};
const contrastOn = (fg: string, bg: string) => ratio(over(fg, bg), bg);
const same = (a: string[], b: string[]) => a.length > 0 && a.length === b.length && a.every((h, i) => h === b[i]);

/** A button whose fill, label and states come from one tone-keyed entry. */
const UNIT_FILL = /^\{(Tonal-Button\.(?:Surfaces|Containers)\.[\w-]+\.|Buttons\.BlackWhite\.(?:Container-)?)Color-(\d+)\.\w+\}$/;

/** What a role must reach against the band, by its path inside a section. */
function thresholdOf(rel: string): number {
  if (/^(Text|Text-[\w-]+|Hotlink|Hotlink-Visited|Eyebrow)$/.test(rel)) return 4.5;
  if (/^(Quiet|Quiet-[\w-]+|Outline-Quiet)$/.test(rel)) return 4.5;
  if (/^Buttons\.[\w-]+\.(Outline-Text|Outline-Quiet)$/.test(rel)) return 4.5;
  if (/^(Header|Header-[\w-]+|Alt-Display-Color|Alt-Color-Gradient-Stop-\d+|Border|Focus-Visible)$/.test(rel)) return 3;
  if (/^Buttons\.[\w-]+\.Border$/.test(rel)) return 3;
  if (/^Icons\.(?!On-)[\w-]+$/.test(rel) && !rel.endsWith('-Variant')) return 3;
  return 0;
}

/** Roles the Figma payload strips from the Theme collection (they are an alias
 *  plus an opacity there, or live in the Buttons collection). */
function cssOnly(rel: string): boolean {
  return /^(Quiet|Quiet-[\w-]+|Outline-Quiet)$/.test(rel) || /^Buttons\.[\w-]+\.(Outline-Text|Outline-Quiet)$/.test(rel);
}

/** Roles left alone: Quiet-Opacity (a section whose shared alpha falls short
 *  gets its own, sectionQuietOverrides), the shadow tint (decorative, derived
 *  from the background elsewhere), tags (a fill and its own label), a
 *  button's muted label on its fill, and a surface's Default button
 *  (Cell-Button's). A card's Default button is a role set of its own. */
function skipped(rel: string, card: boolean): boolean {
  if (/^(Quiet-Opacity|Dropshadow-Color|Background)$/.test(rel)) return true;
  if (/^(Container|Container-Low|Container-Lowest|Container-High|Container-Highest)$/.test(rel)) return true;
  if (/^Tag\./.test(rel) || /^Buttons\.[\w-]+\.Quiet$/.test(rel)) return true;
  if (card) return /^Buttons\.Default\.(?!Border$|Outline-Text$|Outline-Quiet$)/.test(rel);
  return /^Buttons\.Default\./.test(rel);
}

interface PendingUnit {
  theme: string;
  section: string;
  base: string;
  b: string;
  prefix: string;
  n: number;
  tonal: boolean;
  fields: string[];
  T: number;
  grounds: string[];
  highlight: unknown;
  lowlight: unknown;
}

export interface BandStats {
  bands: BandInfo[];
  kept: number;
  sameTable: number;
  toColors: number;
  entries: number;
  cssEntries: number;
  buttonsKept: number;
  buttonsReused: number;
  buttonUnits: number;
  /** roles whose tone answer still failed on the band and moved along their palette */
  fallbacks: string[];
}

export interface BandOptions {
  /** Card Coloring = black: a band's cards are near-black (utils/darkLadder.ts,
   *  Card Coloring) — Neutral Color-1 over the band's Surface at 90 / 92 / 94 /
   *  96 / 100% — and its card roles are solved against those. */
  blackCards?: boolean;
}

export function applyDarkBands(light: Json, dark: Json, toneKeyed: Json, opts: BandOptions = {}): BandStats {
  const stats: BandStats = {
    bands: [], kept: 0, sameTable: 0, toColors: 0, entries: 0, cssEntries: 0,
    buttonsKept: 0, buttonsReused: 0, buttonUnits: 0, fallbacks: [],
  };

  /* ── resolution ─────────────────────────────────────────────────────── */
  const deref = (root: Json, raw: unknown, stopAtColors: boolean): unknown => {
    let v = raw;
    for (let hop = 0; hop < 16; hop++) {
      const r = refOf(v);
      if (!r) return v;
      if (stopAtColors && /^Colors\./.test(r)) return v;
      const node = getAt(root, r) ?? getAt(root, r.replace('Color-Vibrant', 'Color-8'));
      if (node === undefined) return v;
      v = typeof node === 'object' ? node.value : node;
    }
    return v;
  };
  const hexIn = (root: Json, raw: unknown): string | null => {
    const v = deref(root, raw, false);
    return typeof v === 'string' && /^#[0-9a-f]{6}/i.test(v) ? v.toLowerCase() : null;
  };
  /** Every hex a reference paints: Color-Vibrant is drawn as itself by Figma
   *  and as Color-8 by the CSS (exportToCSS pre-resolves it). */
  const paintsOf = (root: Json, raw: unknown): string[] => {
    const s = String(raw ?? '');
    const out = [hexIn(root, s)];
    const vib = String(deref(root, s, true)).match(/^\{Colors\.([\w-]+)\.Color-Vibrant\}$/);
    if (vib) out.push(hexIn(root, `{Colors.${vib[1]}.Color-8}`));
    return out.filter((h): h is string => !!h);
  };
  /** The light-mode answer as a palette tone, when its reference chain names
   *  one. (A literal that happens to equal a tone is not taken: the CSS writes
   *  a literal as a hex and a tone as var(--<P>-Color-N), so swapping one for
   *  the other would change the light sheet's text.) */
  const lightTone = (raw: string): string | null => {
    const v = deref(light, raw, true);
    return typeof v === 'string' && /^\{Colors\.[\w-]+\.Color-(\d+|Vibrant)\}$/.test(v) ? v : null;
  };
  /** A value settled to a palette tone or a literal. */
  const settled = (root: Json, raw: unknown): unknown => deref(root, raw, true);

  /* ── entries ────────────────────────────────────────────────────────── */
  const byPair = new Map<string, string>();   // `${group}|${light}|${dark}` -> entry ref
  const entry = (group: string, id: string, lightValue: unknown, darkValue: unknown): string => {
    const key = `${group}|${String(lightValue)}|${String(darkValue)}`;
    const hit = byPair.get(key);
    if (hit) return hit;
    /* No "Color-Vibrant" in a name: the CSS export rewrites that string to
       Color-8 anywhere in a path before looking it up (see Card-Accent). */
    let name = id.replace(/[^\w-]+/g, '-').replace(/Color-Vibrant/g, 'Vibrant');
    while (getAt(light, `${group}.${name}`) !== undefined) name += '-b';
    (light[group] ??= {})[name] = { value: lightValue, type: 'color' };
    (dark[group] ??= {})[name] = { value: darkValue, type: 'color' };
    const ref = `{${group}.${name}}`;
    byPair.set(key, ref);
    if (group === BAND_CSS_GROUP) stats.cssEntries++;
    else stats.entries++;
    return ref;
  };
  /** The light value an entry carries: the reference itself when its target
   *  is everywhere the entry is (a CSS-only entry, or a group Figma exports
   *  whole), else what it resolves to in light mode. */
  const lightValueFor = (ref: string, group = BAND_GROUP) =>
    group === BAND_CSS_GROUP || FIGMA_ALIASABLE.has(ref.slice(1).split('.')[0]) ? ref : settled(light, ref);

  const writeBoth = (path: string, value: string) => {
    for (const mode of [light, dark]) if (getAt(mode, path) !== undefined) writeLeaf(mode, path, value);
  };

  /* ── the dark table's own answer for tone T ─────────────────────────── */
  const toneAnswer = (ref: string, T: number, cardTone: number): string | null => {
    const p = ref.slice(1, -1);
    let m = p.match(/^(Text|Header|Border|Icon|Icon-Variant|Eyebrows|Default-Button-Border|Quiet)\.(?:Surfaces|Containers)\.([\w-]+)\.Color-\d+$/);
    if (m) return `{${m[1]}.Surfaces.${m[2]}.Color-${T}}`;
    m = p.match(/^(Hover|Pressed)\.Containers\.([\w-]+)\.Color-\d+$/);
    if (m) return `{${m[1]}.${m[2]}.Color-${cardTone}}`;
    m = p.match(/^(Hover|Pressed)\.([\w-]+)\.Color-\d+$/);
    if (m) return `{${m[1]}.${m[2]}.Color-${T}}`;
    m = p.match(/^Focus-Visible\.(?:Surfaces|Containers)\.Background-\d+$/);
    if (m) return `{Focus-Visible.Surfaces.Background-${T}}`;
    return null;
  };

  /* Recorded before anything below moves: the page reads these. */
  const pageIcons: Json = {};
  const pendingUnits: PendingUnit[] = [];
  const originals: Record<string, string> = {};

  for (const theme of BAND_THEMES) {
    const sections = light.Themes?.[theme];
    if (!sections?.Surfaces?.Background) continue;
    const bgTone = String(deref(light, sections.Surfaces.Background.value, true)).match(/^\{Colors\.([\w-]+)\.Color-(\d+)\}$/);
    if (!bgTone) continue;
    const palette = bgTone[1];
    const L = Number(bgTone[2]);
    const S = bandSurfaceTone(L);
    const tones = bandTones(S);
    const cardTone = bandCardTone(S);
    const ramp = Array.from({ length: 12 }, (_, i) => String(dark.Colors?.[palette]?.[`Color-${i + 1}`]?.value ?? '').slice(0, 7).toLowerCase());
    if (ramp.some((h) => !/^#[0-9a-f]{6}$/.test(h))) continue;
    const neutralRamp = Array.from({ length: 12 }, (_, i) => String(dark.Colors?.Neutral?.[`Color-${i + 1}`]?.value ?? '').slice(0, 7).toLowerCase());
    const black = opts.blackCards && neutralRamp.every((h) => /^#[0-9a-f]{6}$/.test(h)) ? blackCardHexesForPage(neutralRamp, ramp[S - 1]) : null;
    const cards = black ? black.cards : bandCardHexesForRamp(ramp, S);
    const cardFace = black ? `{Colors.Neutral.Color-${black.tone}}` : `{Colors.${palette}.Color-${cardTone}}`;
    stats.bands.push({ theme, palette, L, S, tones, cardTone, ...(black ? { blackCardTone: black.tone } : {}) });

    pageIcons[palette] = {};
    for (const section of Object.keys(SECTION_LEVEL)) {
      for (const [k, leaf] of Object.entries<Json>(sections[section]?.Icons ?? {})) {
        if (k.startsWith('On-') && typeof leaf?.value === 'string') (pageIcons[palette][section] ??= {})[k] = leaf.value;
      }
    }

    const scopes: Array<{ section: string; T: number; grounds: string[] }> = [
      ...Object.entries(SECTION_LEVEL).map(([section, level]) => {
        const T = tones[level as DarkLadderLevel];
        return { section, T, grounds: [ramp[T - 1]] };
      }),
      { section: 'Containers', T: S, grounds: DARK_CARD_LEVELS.map((l) => cards[l]) },
    ];

    for (const { section, T, grounds } of scopes) {
      const node = sections[section];
      if (!node) continue;
      const base = `Themes.${theme}.${section}`;
      const card = section === 'Containers';
      const passes = (hexes: string[], th: number) => hexes.length > 0 && hexes.every((h) => grounds.every((g) => contrastOn(h, g) >= th));
      const lightBand = lum(grounds[0]) > 0.18;

      /* Backgrounds. */
      if (!card) {
        const ref = node.Background?.value;
        const want = `{Colors.${palette}.Color-${T}}`;
        if (typeof ref === 'string') {
          writeBoth(`${base}.Background`, deref(light, ref, true) === want
            ? want
            : entry(BAND_GROUP, `Background-${palette}-${ref.slice(1, -1).replace(/^Backgrounds\.[\w-]+\./, '')}-T${T}`, lightValueFor(ref), want));
        }
      } else {
        for (const level of DARK_CARD_LEVELS) {
          const ref = node[level]?.value;
          if (typeof ref !== 'string') continue;
          const want = level === 'Container-Highest' ? cardFace : cards[level];
          writeBoth(`${base}.${level}`, entry(BAND_GROUP, `Card-${theme}-${level}`, lightValueFor(ref), want));
        }
      }

      /* A tonal state button's border IS its fill: it moves with its unit. */
      const tonalBorder = (rel: string) => {
        const m = rel.match(/^Buttons\.([\w-]+)\.Border$/);
        return !!m && /^\{Tonal-Button\./.test(String(node.Buttons?.[m[1]]?.Button?.value ?? ''));
      };

      /* Single roles. */
      const decided = new Map<string, string>();   // rel -> the value now written
      for (const [rel, leaf] of leaves(node)) {
        if (skipped(rel, card) || rel.startsWith('Icons.On-') || /-Variant$/.test(rel) || rel === 'Border-Variant') continue;
        const ref = typeof leaf.value === 'string' && refOf(leaf.value) ? leaf.value : null;
        if (!ref) continue;
        const btnField = rel.match(/^Buttons\.([\w-]+)\.([\w-]+)$/);
        if (btnField && !['Border', 'Outline-Text', 'Outline-Quiet'].includes(btnField[2])) continue;   // fills: below
        if (btnField && (UNIT_FILL.test(ref) || tonalBorder(rel))) continue;                           // a unit's own border
        const th = thresholdOf(rel);
        /* A near-black card's hover and pressed stay the ladder's card
           states (solved for a dark card), not the band's light card tone. */
        const answer = card && black && /^\{(Hover|Pressed)\./.test(ref) ? null : toneAnswer(ref, T, cardTone);
        if (!answer && !th) continue;
        const group = cssOnly(rel) ? BAND_CSS_GROUP : BAND_GROUP;
        const want = answer ? settled(toneKeyed, answer) : null;
        const wantHexes = want ? paintsOf(toneKeyed, want) : [];
        const fits = (raw: unknown) => (th ? passes(paintsOf(dark, raw), th) : same(paintsOf(dark, raw), wantHexes));
        /* 1. Already right. */
        if (fits(ref)) { stats.kept++; decided.set(rel, ref); continue; }
        let value: string | null = null;
        /* 2. Another index of the same table, the same in light mode. */
        const idx = ref.slice(1, -1).match(/^(.*\.(?:Color|Background)-)(\d+)$/);
        const lightHexes = paintsOf(light, ref);
        if (idx && lightHexes.length) {
          for (let k = 1; k <= 12 && !value; k++) {
            const alt = `{${idx[1]}${k}}`;
            if (alt !== ref && same(paintsOf(light, alt), lightHexes) && String(settled(light, alt)) === String(settled(light, ref)) && fits(alt)) value = alt;
          }
          if (value) stats.sameTable++;
        }
        /* 3. The light answer's own palette tone. */
        const tone = lightTone(ref);
        if (!value && tone && fits(tone)) { value = tone; stats.toColors++; }
        /* 4. An entry: the dark table's answer for this tone. Along its own
              palette, away from the band, when even that does not clear (or,
              for a role that names a palette color directly, from that). */
        const walk = (start: string): string | null => {
          const t = start.match(/^\{Colors\.([\w-]+)\.Color-(\d+|Vibrant)\}$/);
          if (!t) return null;
          const from = t[2] === 'Vibrant' ? 8 : Number(t[2]);
          for (let d = 1; d <= 11; d++) {
            const k = lightBand ? from - d : from + d;
            if (k < 1 || k > 12) break;
            const cand = `{Colors.${t[1]}.Color-${k}}`;
            if (passes(paintsOf(dark, cand), th)) return cand;
          }
          return null;
        };
        if (!value && want !== null) {
          let darkValue: unknown = want;
          if (th && !passes(wantHexes, th)) {
            darkValue = walk(String(want)) ?? want;
            stats.fallbacks.push(`${theme}/${section}/${rel}: ${String(want)} -> ${String(darkValue)}`);
          }
          value = entry(group, `${ref.slice(1, -1)}-T${T}`, lightValueFor(ref, group), darkValue);
        }
        if (!value && th && tone) {
          const darkValue = walk(tone);
          if (darkValue) {
            stats.fallbacks.push(`${theme}/${section}/${rel}: ${tone} -> ${darkValue}`);
            value = entry(group, `${ref.slice(1, -1)}-${palette}-T${T}`, lightValueFor(ref, group), darkValue);
          }
        }
        if (!value) continue;
        writeBoth(`${base}.${rel}`, value);
        decided.set(rel, value);
        /* The Figma payload draws a button's border from Default-Button-Border
           at the index its {Border.…} reference names — so it needs the
           reference this one replaced. */
        if (/^Buttons\.[\w-]+\.Border$/.test(rel)) originals[`${theme}.${section}.${rel}`] = ref;
      }

      /* Border-Variant: the band's border at the adaptive variant alpha over
         the band — the formula the CSS export and the Figma payload use for
         every other surface. */
      {
        const ref = node['Border-Variant']?.value;
        const border = decided.get('Border') ?? node.Border?.value;
        const bHex = border ? hexIn(dark, border) : null;
        if (typeof ref === 'string' && bHex) {
          const want = variantHex8(bHex, BORDER_VARIANT_ALPHA, grounds[0]).toLowerCase();
          if (hexIn(dark, ref) !== want && String(deref(dark, ref, false)).toLowerCase() !== want) {
            writeBoth(`${base}.Border-Variant`, entry(BAND_GROUP, `${ref.slice(1, -1)}-T${T}`, lightValueFor(ref), want));
          }
        }
      }

      /* Icon variants: the band's icon at the flat variant alpha (the CSS
         bakes it; Figma draws the icon at that opacity). CSS only. */
      for (const [k, leaf] of Object.entries<Json>(node.Icons ?? {})) {
        if (!k.endsWith('-Variant') || typeof leaf?.value !== 'string') continue;
        const iconKey = `Icons.${k.slice(0, -'-Variant'.length)}`;
        const icon = decided.get(iconKey) ?? getAt(node, iconKey)?.value;
        const iHex = icon ? hexIn(dark, icon) : null;
        if (!iHex) continue;
        const want = variantHex8(iHex, ICON_VARIANT_ALPHA).toLowerCase();
        if (String(deref(dark, leaf.value, false)).toLowerCase() === want) continue;
        writeBoth(`${base}.Icons.${k}`, entry(BAND_CSS_GROUP, `${leaf.value.slice(1, -1)}-T${T}`, leaf.value, want));
      }

      /* Content ON an icon, against the icon actually drawn there. */
      for (const [k, leaf] of Object.entries<Json>(node.Icons ?? {})) {
        if (!k.startsWith('On-') || typeof leaf?.value !== 'string') continue;
        const iconKey = `Icons.${k.slice(3)}`;
        const icon = decided.get(iconKey) ?? getAt(node, iconKey)?.value;
        const iHex = icon ? hexIn(dark, icon) : null;
        if (!iHex) continue;
        const ok = (raw: unknown) => { const hs = paintsOf(dark, raw); return hs.length > 0 && hs.every((h) => contrastOn(h, iHex) >= 4.5); };
        if (ok(leaf.value)) { stats.kept++; continue; }
        const tone = lightTone(leaf.value);
        if (tone && ok(tone)) { writeBoth(`${base}.Icons.${k}`, tone); stats.toColors++; continue; }
        /* The Text table's answer for the icon's own tone. */
        const it = String(deref(dark, icon, true)).match(/^\{Colors\.([\w-]+)\.Color-(\d+)\}$/);
        let want: unknown = it ? settled(toneKeyed, `{Text.Surfaces.${it[1]}.Color-${it[2]}}`) : null;
        if (!want || !ok(want)) {
          const pal = it?.[1] ?? palette;
          const order = lum(iHex) > 0.18 ? [1, 2, 3, 4] : [12, 11, 10, 9];
          const pick = order.map((n) => `{Colors.${pal}.Color-${n}}`).find(ok);
          stats.fallbacks.push(`${theme}/${section}/Icons.${k}: ${String(want)} -> ${String(pick ?? want)}`);
          want = pick ?? want;
        }
        if (!want) continue;
        writeBoth(`${base}.Icons.${k}`, entry(BAND_GROUP, `${leaf.value.slice(1, -1)}-on-${String(icon).slice(1, -1)}`, lightValueFor(leaf.value), want));
      }

      /* Button fills, as units. A state button: fill = border, 3:1 on the
         band, its label 4.5:1 on the fill. A black/white button: label 4.5:1,
         edge 3:1 by its fill or its own border. A unit that fails moves to
         another tone of its table whose light entry is this one's, or to the
         entry the dark table holds for the band's tone. */
      for (const [b, unit] of Object.entries<Json>(node.Buttons ?? {})) {
        if (!unit || typeof unit !== 'object') continue;   // a surface's Default is Cell-Button's and never matches
        const fillRef = unit.Button?.value;
        const um = typeof fillRef === 'string' ? fillRef.match(UNIT_FILL) : null;
        if (!um) continue;
        const prefix = um[1];
        const n = Number(um[2]);
        const tonal = prefix.startsWith('Tonal-Button.');
        const unitRef = (k: number) => `${prefix}Color-${k}`;
        const fields = Object.keys(unit).filter((f) => String(unit[f]?.value ?? '').startsWith(`{${unitRef(n)}.`));
        const fits = (root: Json, src: string, k: number) => {
          const f = hexIn(root, `{${src}Color-${k}.Button}`);
          const t = hexIn(root, `{${src}Color-${k}.Text}`);
          const e = !tonal && fields.includes('Border') ? hexIn(root, `{${src}Color-${k}.Border}`) : null;
          if (!f || !t || contrastOn(t, f) < 4.5) return false;
          return grounds.every((g) => Math.max(contrastOn(f, g), e ? contrastOn(e, g) : 0) >= 3);
        };
        const borderMatches = !tonal || same(paintsOf(dark, unit.Border?.value), paintsOf(dark, fillRef));
        if (fits(dark, prefix, n) && borderMatches) { stats.buttonsKept++; continue; }
        const lightOf = (k: number) => fields.map((f) => String(deref(light, `{${unitRef(k)}.${f}}`, false))).join('|');
        const wanted = lightOf(n);
        let pick: number | null = null;
        for (let k = 1; k <= 12 && pick === null; k++) {
          if (k !== n && lightOf(k) === wanted && fits(dark, prefix, k)) pick = k;
        }
        if (pick !== null) {
          for (const f of fields) writeBoth(`${base}.Buttons.${b}.${f}`, `{${unitRef(pick)}.${f}}`);
          if (tonal && typeof unit.Border?.value === 'string') writeBoth(`${base}.Buttons.${b}.Border`, `{${unitRef(pick)}.Button}`);
          stats.buttonsReused++;
          continue;
        }
        /* Its own unit — made below, once every band section that reads the
           same light entry is known. */
        pendingUnits.push({ theme, section, base, b, prefix, n, tonal, fields, T, grounds, highlight: unit.Highlight?.value, lowlight: unit.Lowlight?.value });
      }
    }
  }

  /* Band button units. Sections whose light entries resolve to the same
     colors share one unit — a light entry repeats across tones (Info's on
     light tones 9-12 is one entry; black/white has two faces) — and its dark
     side is the tone-keyed entry for a band tone that fits ALL of them (their
     own tones first, then the nearest). Each field is a Figma variable, and
     Modes has little room. */
  const groups = new Map<string, PendingUnit[]>();
  for (const u of pendingUnits) {
    const lightKey = u.fields.map((f) => String(deref(light, `{${u.prefix}Color-${u.n}.${f}}`, false))).join('|');
    const key = `${u.prefix}|${u.fields.join(',')}|${lightKey}`;
    groups.set(key, [...(groups.get(key) ?? []), u]);
  }
  for (const units of groups.values()) {
    const { prefix, n, tonal, fields } = units[0];
    const src = prefix.replace('.Containers.', '.Surfaces.').replace('Container-', '');
    const grounds = [...new Set(units.flatMap((u) => u.grounds))];
    const fitsAll = (k: number) => {
      const f = hexIn(toneKeyed, `{${src}Color-${k}.Button}`);
      const t = hexIn(toneKeyed, `{${src}Color-${k}.Text}`);
      const e = !tonal && fields.includes('Border') ? hexIn(toneKeyed, `{${src}Color-${k}.Border}`) : null;
      if (!f || !t || contrastOn(t, f) < 4.5) return false;
      return grounds.every((g) => Math.max(contrastOn(f, g), e ? contrastOn(e, g) : 0) >= 3);
    };
    const own = [...new Set(units.map((u) => u.T))];
    const order = [...own, ...Array.from({ length: 12 }, (_, i) => i + 1).filter((k) => !own.includes(k))
      .sort((a, z) => Math.abs(a - own[0]) - Math.abs(z - own[0]))];
    const tStar = order.find(fitsAll);
    if (tStar === undefined) {
      stats.fallbacks.push(`${units.map((u) => `${u.theme}/${u.section}`).join(', ')}/Buttons.${units[0].b}: no tone-keyed entry fits every band that reads ${prefix}Color-${n}`);
    }
    const T = tStar ?? own[0];
    const id = `${`${prefix}Color-${n}`.replace(/\./g, '-')}-T${T}`;
    for (const f of fields) {
      ((light[BAND_BUTTON_GROUP] ??= {})[id] ??= {})[f] = { value: lightValueFor(`{${prefix}Color-${n}.${f}}`), type: 'color' };
      ((dark[BAND_BUTTON_GROUP] ??= {})[id] ??= {})[f] = { value: settled(toneKeyed, `{${src}Color-${T}.${f}}`), type: 'color' };
    }
    stats.buttonUnits++;
    for (const u of units) {
      for (const f of fields) writeBoth(`${u.base}.Buttons.${u.b}.${f}`, `{${BAND_BUTTON_GROUP}.${id}.${f}}`);
      if (!u.tonal) continue;
      /* A state button's border is its fill — the unit's own Button. */
      if (getAt(light, `${u.base}.Buttons.${u.b}.Border`) !== undefined) writeBoth(`${u.base}.Buttons.${u.b}.Border`, `{${BAND_BUTTON_GROUP}.${id}.Button}`);
      /* Its bevel stays its entry's (the literal the section carries IS that
         entry's light value), so the Figma payload has a bevel to read
         without two more variables per unit. */
      for (const [f, lit] of [['Highlight', u.highlight], ['Lowlight', u.lowlight]] as const) {
        const ref = `{${prefix}Color-${n}.${f}}`;
        if (typeof lit === 'string' && !lit.startsWith('{') && settled(light, ref) === lit) writeBoth(`${u.base}.Buttons.${u.b}.${f}`, ref);
      }
    }
  }

  for (const mode of [light, dark]) {
    mode[LADDER_BANDS_KEY] = Object.fromEntries(stats.bands.map((b) => [b.theme, b]));
    mode[LADDER_PAGE_ICONS_KEY] = JSON.parse(JSON.stringify(pageIcons));
    mode[BAND_ORIGINALS_KEY] = { ...originals };
  }
  return stats;
}
