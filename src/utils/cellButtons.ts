/**
 * The Default button for every theme section, written into the export with
 * the SAME function the preview and the Advanced tone grid use.
 *
 * The export used to decide the Default button itself, through its own tables
 * (Default-Button.<theme>.<shade>), while the preview decided it in
 * buildPreviewCSS. Two implementations of one rule drift (invariant 5): the
 * new color + tone choice, Match, picked tones, base-on-base and the label rule
 * all existed in the preview only, so the grid promised buttons Figma never
 * received.
 *
 * Now each section's button is computed by buildPreviewCSS's defaultButtonFor,
 * against the section's REAL background in that mode, and stored in a Modes
 * group:
 *
 *   Cell-Button.<Theme>.<Section>.{Button, Text, Quiet, Border, Hover,
 *     Pressed, Highlight, Lowlight, Outline-Text, Outline-Quiet}
 *
 * A Modes group because the value differs by light/dark and the Figma Theme
 * layer is mode-independent — the same reason Tonal-Button is one. Each theme
 * section's Buttons.Default then points into it. Values alias a palette tone
 * wherever the color IS one, so editing a palette in Figma still moves them.
 */
import { buildPreviewCSS } from './buildPreviewCSS';
import { parseBackground, parseBar } from './backgroundSelection';
import { defaultBackgroundTone, defaultSurfaceRefs } from './cssgen/exportToCSS';

type Ramp = { tone: number; color: string }[];
type Palettes = Record<string, Ramp>;

/** Themes whose Default button follows the user's choice. Info / Success /
 *  Warning / Error keep their own state button on their own surfaces. */
const CELL_THEMES = ['Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral', 'App-Bar', 'Nav-Bar', 'Status'];

/** Section name in the export → surface level in the picker. */
const SECTION_LEVEL: Record<string, string> = {
  'Surfaces': 'Surface',
  'Surfaces-Dim': 'Surface-Dim',
  'Surfaces-Dimmest': 'Surface-Dimmest',
  'Surfaces-Bright': 'Surface-Bright',
  'Surfaces-Brightest': 'Surface-Brightest',
};

export const CELL_BUTTON_FIELDS = [
  'Button', 'Text', 'Quiet', 'Border', 'Hover', 'Pressed', 'Highlight', 'Lowlight', 'Outline-Text', 'Outline-Quiet',
] as const;

interface Input {
  tonePalettes: Palettes;
  darkModeTonePalettes: Palettes;
  extractedTones?: { primary: number; secondary: number; tertiary: number };
  userSelections: Record<string, unknown>;
  computeHighlight: (hex: string) => string;
  computeLowlight: (hex: string) => string;
}

const toScheme = (input: Input) => {
  const conv = (p: Palettes) => Object.fromEntries(
    Object.entries(p).map(([k, ramp]) => [k, (ramp || []).map((t) => ({ hex: t.color, tone: t.tone }))]),
  );
  return {
    name: 'Export',
    colors: [],
    extractedTones: input.extractedTones,
    tonePalettes: conv(input.tonePalettes),
    darkModeTonePalettes: conv(input.darkModeTonePalettes),
  };
};

export function applyCellButtons(colorSystem: any, input: Input): number {
  const sel = input.userSelections as any;
  const scheme = toScheme(input);
  const pageTheme = parseBackground(sel.background).theme;
  const themePalette = (theme: string): string =>
    theme === 'Default' ? pageTheme
      : theme === 'App-Bar' ? parseBar(sel.appBar).theme
      : theme === 'Nav-Bar' ? parseBar(sel.navBar).theme
      : theme === 'Status' ? parseBar(sel.status).theme
      : theme;

  let written = 0;
  for (const modeName of ['Light-Mode', 'Dark-Mode'] as const) {
    const modeData: any = colorSystem?.Modes?.[modeName];
    if (!modeData?.Themes) continue;
    let resolve: any = null;
    buildPreviewCSS({
      colorScheme: scheme, userSelections: sel, componentStyle: 'modern',
      mode: modeName === 'Dark-Mode' ? 'dark' : 'light',
      styleCustomizations: undefined,
      onButtonResolver: (fn: unknown) => { resolve = fn; },
    } as never);
    if (!resolve) continue;

    // The Default theme reads its surfaces through {Default-Background.*},
    // which only the CSS / Figma generators expand. Expand it the same way.
    const { defPal, defN } = defaultBackgroundTone(colorSystem, modeData, modeName);
    const defaultRefs = defaultSurfaceRefs(defPal, defN);
    const deref = (ref: unknown): string | null => {
      let value: any = ref;
      for (let hop = 0; hop < 10 && typeof value === 'string' && value.startsWith('{'); hop++) {
        const viaDefault = defaultRefs[value.slice(1, -1)];
        if (viaDefault) { value = viaDefault; continue; }
        let node: any = modeData;
        for (const key of value.slice(1, -1).split('.')) { node = node?.[key]; if (node === undefined) break; }
        if (node === undefined) {
          node = colorSystem;
          for (const key of value.slice(1, -1).split('.')) { node = node?.[key]; if (node === undefined) return null; }
        }
        value = typeof node === 'string' ? node : node?.value;
      }
      return typeof value === 'string' && value.startsWith('#') ? value.slice(0, 7).toLowerCase() : null;
    };
    // Palette tone hex → {Colors.<Pal>.Color-N}, so values stay aliases.
    const colorRef = new Map<string, string>();
    for (const [pal, tones] of Object.entries<any>(modeData.Colors ?? {})) {
      for (const [cn, tok] of Object.entries<any>(tones ?? {})) {
        const hex = typeof tok?.value === 'string' && tok.value.startsWith('#') ? tok.value.slice(0, 7).toLowerCase() : null;
        if (hex && /^Color-\d+$/.test(cn) && !colorRef.has(hex)) colorRef.set(hex, `{Colors.${pal}.${cn}}`);
      }
    }
    // Only an OPAQUE color can alias a tone: #ffffffb3 (dark mode's 70% white
    // text) is not Color-12, and aliasing it would drop the alpha.
    const asToken = (hex: string) => ({
      value: (hex.length === 7 ? colorRef.get(hex.toLowerCase()) : undefined) ?? hex,
      type: 'color' as const,
    });

    const table: any = {};
    for (const theme of CELL_THEMES) {
      const sections = modeData.Themes[theme];
      if (!sections) continue;
      const pal = themePalette(theme);
      /* The tone ramp from this mode's own Colors table — every palette.
         It was read from the tone palettes passed in, which carry Primary,
         Secondary and Tertiary only, so a NEUTRAL page found no match and fell
         back to tone 1: a tonal button was solved for the wrong background
         and the export's dark Default button disagreed with the preview's. */
      const colorsOf = (modeData.Colors ?? {})[pal] ?? {};
      const ramp = Array.from({ length: 12 }, (_, i) => {
        const v = colorsOf[`Color-${i + 1}`]?.value;
        return { tone: i + 1, color: typeof v === 'string' && v.startsWith('#') ? v.slice(0, 7).toLowerCase() : '' };
      }).filter((t) => t.color);
      for (const [sectionName, section] of Object.entries<any>(sections)) {
        if (!(sectionName in SECTION_LEVEL) || !section?.Buttons?.Default) continue;
        const bgHex = deref(section.Background?.value);
        if (!bgHex) continue;
        // The background's tone index in its own palette; nearest by
        // lightness when it is not a palette tone (a pure black or white).
        let n = ramp.findIndex((t) => t.color.toLowerCase() === bgHex) + 1;
        if (!n) {
          const L = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
          let best = 1, bestD = Infinity;
          ramp.forEach((t, i) => { const d = Math.abs(L(t.color) - L(bgHex)); if (d < bestD) { bestD = d; best = i + 1; } });
          n = best;
        }
        const level = theme === pal ? SECTION_LEVEL[sectionName] : undefined;
        const b = resolve(pal, n, bgHex, false, level);
        const outline = (v: string, fallback: unknown) =>
          v.startsWith('var(') ? (fallback ? { value: (fallback as any).value ?? fallback, type: 'color' as const } : asToken(b.text)) : asToken(v);
        (table[theme] ??= {})[sectionName] = {
          Button: asToken(b.bg),
          Text: asToken(b.text),
          Quiet: asToken(b.quiet),
          Border: asToken(b.border),
          Hover: asToken(b.hover),
          Pressed: asToken(b.active),
          Highlight: { value: input.computeHighlight(b.bg.slice(0, 7)), type: 'color' },
          Lowlight: { value: input.computeLowlight(b.bg.slice(0, 7)), type: 'color' },
          'Outline-Text': outline(b.outlineText, section.Text),
          'Outline-Quiet': outline(b.outlineQuiet, section.Quiet),
        };
        written++;
      }
    }
    modeData['Cell-Button'] = table;
  }

  /* Share instead of copy. The page theme (Default) and the three bars each
     sit on one of the twenty theme x level backgrounds, so their entry is
     usually identical — in BOTH modes — to that theme section's. Point them
     at it and drop the copy: Figma's Modes collection has a hard 5,000
     variable limit, and a duplicate costs ten. */
  const L = colorSystem?.Modes?.['Light-Mode']?.['Cell-Button'] ?? {};
  const D = colorSystem?.Modes?.['Dark-Mode']?.['Cell-Button'] ?? {};
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const target = new Map<string, string>(); // 'Theme.Section' -> path it reads
  for (const [theme, sections] of Object.entries<any>(L)) {
    for (const sectionName of Object.keys(sections)) {
      let path = `${theme}.${sectionName}`;
      if (!['Primary', 'Secondary', 'Tertiary', 'Neutral'].includes(theme)) {
        for (const owner of ['Primary', 'Secondary', 'Tertiary', 'Neutral']) {
          const hit = Object.keys(L[owner] ?? {}).find((sec) =>
            same(L[owner][sec], L[theme][sectionName]) && same(D[owner]?.[sec], D[theme]?.[sectionName]));
          if (hit) { path = `${owner}.${hit}`; break; }
        }
      }
      target.set(`${theme}.${sectionName}`, path);
    }
  }
  for (const [key, path] of target) {
    if (key === path) continue;
    const [theme, sectionName] = key.split('.');
    delete L[theme]?.[sectionName];
    delete D[theme]?.[sectionName];
  }
  for (const m of [L, D]) for (const t of Object.keys(m)) if (!Object.keys(m[t]).length) delete m[t];

  // Point every covered section's Default button at its entry. The refs are
  // the same in both modes; the Modes group carries the per-mode values.
  for (const modeName of ['Light-Mode', 'Dark-Mode'] as const) {
    const themes: any = colorSystem?.Modes?.[modeName]?.Themes ?? {};
    for (const [key, path] of target) {
      const [theme, sectionName] = key.split('.');
      const btn = themes[theme]?.[sectionName]?.Buttons?.Default;
      if (!btn) continue;
      for (const f of CELL_BUTTON_FIELDS) {
        btn[f] = { value: `{Cell-Button.${path}.${f}}`, type: 'color' };
      }
    }
  }
  return written;
}
