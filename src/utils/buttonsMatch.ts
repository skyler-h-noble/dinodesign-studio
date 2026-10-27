/**
 * Buttons › Match — the Buttons palette of the theme a component sits in.
 *
 * The Icons collection already has a Match mode (Snackbar's icon uses it): in
 * a Primary zone it is Primary, in a Success zone Success, and in the Default
 * theme it is Default. Buttons gets the same, so a status indicator — Progress
 * Bar, Progress Dial — takes the colour of the zone it reports on instead of
 * always the brand's Default.
 *
 * It is not a new set of colours. In every theme and surface level it is
 * exactly that theme's own palette entry — Buttons.Primary inside the Primary
 * theme — so it inherits the per-surface tuning those entries already carry
 * (the outline Border holds 3:1 against its own surfaces; asserted in
 * buttonsMatch.test.ts).
 *
 * Two emitters, one rule (invariant 5):
 *   Figma payload  addButtonsMatchToThemes — a COPY of the palette group into
 *                  Themes.<theme>.<level>.Buttons.Match, so the Theme
 *                  collection gets Buttons/Match/* beside Buttons/<Palette>/*.
 *   CSS            withButtonsMatchCSS — in every block that declares a
 *                  theme's own --Buttons-<Palette>-*, an alias
 *                  --Buttons-Match-*: var(--Buttons-<Palette>-*). Declared in
 *                  the SAME block, so a nested zone's block re-declares it and
 *                  nothing is inherited across zones.
 * The export and the preview both call withButtonsMatchCSS.
 */
import { THEME_PALETTES } from './themes';

/** The palette a theme's Match resolves to, or null for a theme with none of
 *  its own (the CSS-only bar themes inherit Match from the zone around them). */
export function matchPaletteFor(themeName: string): string | null {
  if (themeName === 'Default') return 'Default';
  return (THEME_PALETTES as readonly string[]).includes(themeName) ? themeName : null;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Figma payload side: Buttons.Match in every level group of every theme. */
export function addButtonsMatchToThemes(themes: Record<string, any> | undefined): void {
  if (!themes) return;
  for (const [themeName, theme] of Object.entries(themes)) {
    const pal = matchPaletteFor(themeName);
    if (!pal || !theme || typeof theme !== 'object') continue;
    for (const group of Object.values<any>(theme)) {
      const buttons = group?.Buttons;
      if (buttons && buttons[pal] && !buttons.Match) buttons.Match = clone(buttons[pal]);
    }
  }
}

/** CSS side: alias --Buttons-Match-* to the block's own theme palette. */
export function withButtonsMatchCSS(css: string): string {
  return css.replace(/([^{}]*)\{([^{}]*)\}/g, (whole, selector: string, body: string) => {
    if (/--Buttons-Match-/.test(body)) return whole;
    const themes = [...selector.matchAll(/data-theme="([\w-]+)"/g)].map((m) => m[1]);
    // A block naming no theme is Default's unscoped scope (or not a theme block at all).
    const themeName = themes.length ? themes[0] : 'Default';
    if (themes.some((t) => t !== themeName)) return whole;
    const pal = matchPaletteFor(themeName);
    if (!pal) return whole;
    const re = new RegExp(`^[ \\t]*--Buttons-${pal}-([A-Za-z-]+):`, 'gm');
    const slots = [...new Set([...body.matchAll(re)].map((m) => m[1]))];
    if (!slots.length) return whole;
    const lines = slots.map((s) => `  --Buttons-Match-${s}: var(--Buttons-${pal}-${s});`);
    return `${selector}{${body.replace(/\s*$/, '')}\n${lines.join('\n')}\n}`;
  });
}
