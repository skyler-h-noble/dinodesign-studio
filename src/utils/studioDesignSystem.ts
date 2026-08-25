/**
 * The studio wearing one of its own design systems.
 *
 * main.tsx imports the LIB's default sheets at build time. Those are the
 * fallback skin — correct, generic, and nobody's brand. This layers a published
 * design system on top so OmniDesign is dressed in something it made itself.
 *
 * Injected as one <style> APPENDED to <head>, not as <link>s: Vite decides
 * where the bundled CSS lands and a static <link> in index.html can end up
 * before it, in which case the lib defaults would win and nothing would change.
 * Appending at runtime puts these last, so equal-specificity rules resolve in
 * this system's favour without a single !important.
 *
 * @import is stripped and the font URLs re-issued as real <link> elements.
 * Inside an injected <style> an @import must precede every other rule, and a
 * css2 URL contains semicolons (`wght@400;600;700`) that naive splitting
 * truncates — the exact failure the portfolio hit, where two of four imports
 * parsed and the rest of the sheet was silently dropped.
 */

const BUCKET = 'dino-design.firebasestorage.app';
const HOST = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/`;

/** Load order matters — later files refine earlier ones. Mirrors main.tsx. */
const SHEETS = [
  'foundation.css',
  'core.css',
  'typography-tokens.css',
  'Light-Mode.css',
  'base.css',
  'styles.css',
] as const;

const STYLE_ID = 'omni-studio-design-system';

/**
 * The systems the studio can wear — the same three the portfolio offers, so a
 * visitor moving between them sees one brand rather than two.
 *
 * Kept as a literal list rather than read from Firestore: this is chrome, it
 * has to resolve before first paint, and a network round trip to decide what
 * the app looks like is a worse trade than three ids in source.
 */
export interface StudioTheme { id: string; name: string; }
export const STUDIO_THEMES: StudioTheme[] = [
  { id: 'd1bd0ba4-4906-4801-93c3-49db251f10d2', name: 'Cocktail Hour' },
  { id: 'a2d6e6cf-d16a-4a6b-b4f6-8d4c282fb4f2', name: "Surf's Up" },
  { id: 'd7ad345c-33d7-43f6-8f30-41728bf395e6', name: 'Popsicle' },
];

const STORAGE_KEY = 'omniStudioTheme';

/** The id to open on: the last one chosen, else the first. A stale id — a
 *  system since deleted — would 404 every sheet and leave the studio on the
 *  lib defaults, so anything read back is checked against the list. */
export function initialStudioThemeId(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && STUDIO_THEMES.some((t) => t.id === saved)) return saved;
  } catch { /* private mode */ }
  return STUDIO_THEMES[0].id;
}

export function rememberStudioTheme(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private mode */ }
}

/** Sheets already fetched, so switching back is instant rather than another
 *  eight requests. */
const cache = new Map<string, string>();

const fileUrl = (id: string, name: string) =>
  `${HOST}${encodeURIComponent(`design-systems/${id}/${name}`)}?alt=media`;

/** A missing sheet contributes nothing rather than failing the whole skin. */
async function fetchText(url: string): Promise<string> {
  try {
    const r = await fetch(url);
    return r.ok ? await r.text() : '';
  } catch {
    return '';
  }
}

/** Font sheets ride alongside as links. Async is fine: text renders in a
 *  fallback face and swaps when the webfont lands. */
function ensureFonts(urls: string[]): void {
  for (const href of urls) {
    if (document.querySelector(`link[data-omni-font="${CSS.escape(href)}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-omni-font', href);
    document.head.appendChild(link);
  }
}

/**
 * Fetch a published design system and dress the studio in it.
 *
 * Resolves once applied. Deliberately not awaited before first paint: the lib
 * defaults are already in the bundle, so the app is styled from the first
 * frame and this refines it — a network hiccup costs the brand, never the UI.
 */
export async function applyStudioDesignSystem(id: string): Promise<void> {
  let combined = cache.get(id);
  if (combined === undefined) {
    const parts = await Promise.all(SHEETS.map((f) => fetchText(fileUrl(id, f))));
    combined = parts.join('\n\n');
    if (combined.trim()) cache.set(id, combined);
  }
  if (!combined.trim()) return;

  const fonts = new Set<string>();
  // Match the WHOLE @import — url() and all — so a css2 URL's internal
  // semicolons cannot cut it short.
  const css = combined.replace(
    /@import\s+(?:url\([^)]*\)|(['"])(?:(?!\1).)*\1)[^;]*;/g,
    (m) => {
      const u = m.match(/https?:\/\/[^)'"\s]+/);
      if (u) fonts.add(u[0]);
      return '';
    },
  );

  ensureFonts([...fonts]);

  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}
