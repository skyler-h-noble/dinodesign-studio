/**
 * The mesh gradient's PURE half — the shape, the parser and the CSS generator.
 *
 * Split out of meshGradient.ts so it can be imported without dragging in the
 * Firebase *client* SDK. Publishing these files is an admin-side job that runs
 * under Node with firebase-admin, and `meshGradient.ts` imports
 * `firebase/firestore` + `./firebase/client` at module scope, which needs a
 * browser and VITE_ env vars to even load.
 *
 * The alternative was restating the CSS template inside the script. That is the
 * duplicate-declaration trap this repo keeps paying for: two copies of one
 * template, and the published file drifts from what the app previews with no
 * error at either end.
 *
 * meshGradient.ts re-exports everything here, so existing imports are unchanged.
 */

export interface MeshGradient {
  /** The layered background value: the radial-gradient stack plus its base. */
  background: string;
  /** Foreground color for text sitting on the mesh. A token, not a hex. */
  color?: string;
}

/**
 * Accept either a bare background value or a whole pasted CSS rule.
 *
 * The mesh is authored in a browser dev-tools panel and arrives as a full
 * `.gradient-figure { ... }` block. Requiring the value to be extracted by
 * hand first is how a trailing brace or a missing semicolon ends up inside the
 * stored string, where it silently invalidates the whole declaration — a CSS
 * parser drops the property and paints nothing, with no error anywhere.
 */
export function parseMeshGradient(input: string): MeshGradient | null {
  const src = (input || '').trim();
  if (!src) return null;

  const pick = (prop: string): string | null => {
    // Match `prop: <value>;` at a declaration boundary, so `background` does
    // not also match `background-color` or the `-color` half of it.
    const re = new RegExp(`(?:^|[{;\\s])${prop}\\s*:\\s*([^;}]+)`, 'i');
    const m = src.match(re);
    return m ? m[1].trim() : null;
  };

  const background = src.includes('{') || /background\s*:/i.test(src)
    ? pick('background')
    : src;
  if (!background) return null;

  const color = pick('color');
  return { background, ...(color ? { color } : {}) };
}

/**
 * The CSS a system publishes for its mesh.
 *
 * The stack is declared ONCE as a custom property and every consumer reads it.
 * Sizing and type deliberately stay out: a hero is full-bleed and a card is
 * not, so baking the card's 800x450 into the shared value would make the hero
 * wrong, and baking its font families in would override whatever typography
 * the system actually chose.
 */
/**
 * The BlackWhite ramp is a LIGHT-MODE-ONLY palette.
 *
 * Dark-Mode.css references --BW-Color-N (e.g. `--Eyebrow: var(--BW-Color-8)`)
 * but never DEFINES one, so every BW token is undefined there. A mesh's text
 * color is solved as a BW tone, which meant the card read correctly in light
 * mode and, in dark, resolved to nothing — `color` fell back to inherited, and
 * on a dark page that is light text on a light mesh. Invisible, silent, and
 * indistinguishable from a styling choice.
 *
 * The mesh itself does NOT have this problem: it is built from --Primary-Color-N
 * and friends, which every mode defines, so the same mesh renders in both. Its
 * text has to be equally mode-independent, and it can be — the composition is
 * fixed, so the color solved against it is a fixed answer.
 *
 * The token stays FIRST so the value tracks a system that does define it; the
 * literal only fires when nothing does. BlackWhite is black and white, and the
 * values are identical across every system checked, so the literal is a
 * transcription rather than a guess.
 *
 * Fixing the palette itself would be better and is not possible here: a
 * system's CSS is frozen per system in Storage and cannot be regenerated.
 * mesh-gradient.css CAN be republished, which is why the repair lives here.
 *
 * UPDATE (2026-11-03): the export now writes BW into Dark-Mode.css too, but
 * MIRRORED — `--BW-Color-6` is #ffffff there (exportColorSystem, "BW goes in
 * BOTH modes"). So on a current system the light-mode text token above turns
 * WHITE in dark mode while the mesh stays pale: the same failure from the
 * other side. The dark variant below (see `darkMeshCSS`) is what fixes it; the
 * literal fallback here still covers systems published before BW reached the
 * dark sheet.
 */
const BW_LITERAL: Record<string, string> = {
  '1': '#ffffff', '2': '#ffffff', '3': '#ffffff', '4': '#ffffff',
  '5': '#040404', '6': '#040404', '7': '#040404', '8': '#040404',
  '9': '#040404', '10': '#040404', '11': '#040404', '12': '#040404',
};

/** Give a bare `var(--BW-Color-N)` a literal fallback. Anything else passes through. */
export function withBwFallback(value: string): string {
  const m = /^var\(\s*--BW-Color-(\d+)\s*\)$/.exec(String(value).trim());
  if (!m) return value;
  const lit = BW_LITERAL[m[1]];
  return lit ? `var(--BW-Color-${m[1]}, ${lit})` : value;
}

/* ── Dark mode ──────────────────────────────────────────────────────────────
 *
 * Palette tones are ABSOLUTE: Color-1 is the darkest and Color-12 the lightest
 * in Light-Mode.css AND in Dark-Mode.css (the dark sheet only desaturates them
 * a little). So a mesh authored on tones 7-12 is a pale card in both modes,
 * and on a dark page it reads as a light hole in the layout.
 *
 * How a page goes dark: the consumer swaps Light-Mode.css for Dark-Mode.css.
 * mesh-gradient.css is loaded once and is NOT swapped, so it cannot just ship a
 * second file. What it can do is notice which sheet is loaded. Every token name
 * is the same in both sheets, so presence tells it nothing — but one VALUE is a
 * fixed, generator-owned flag: the BW ramp is mirrored in the dark sheet, so
 * `--BW-Color-6` is `#ffffff` there and `#040404` in the light one (a literal
 * written from one constant in exportColorSystem, not a computed color).
 *
 * `@container style(--BW-Color-6: #ffffff)` matches on exactly that. Style
 * queries on custom properties are Baseline since May 2026 (Chrome/Edge 111,
 * Safari 18, Firefox 151). A browser without them keeps the light mesh — the
 * behavior before this existed. A style query reads the PARENT's value, so the
 * rule sits on `body` (whose parent, <html>, carries the sheet's :root tokens),
 * and everything inside the page inherits from there.
 *
 * `:root[data-mode="dark"]` is a second trigger for pages that set the
 * attribute (the portfolio does). It is not something a consumer can be
 * assumed to do, but it costs nothing and covers older browsers there.
 *
 * Considered and rejected:
 *   - `@media (prefers-color-scheme: dark)` follows the OS, not the sheet the
 *     page loaded, so it is wrong whenever the two disagree.
 *   - Mode-flipping tokens like --Background or --Text-Primary: they are
 *     surface-scoped and cover a few tones, not a per-stop mapping.
 *   - A new flag in the mode sheets: would only help systems exported after
 *     it, and every published system's sheets are frozen.
 */

/** A palette that has a 1-12 lightness ramp in both modes. BW is excluded on
 *  purpose: it is already mirrored per mode, so mirroring it again would undo
 *  that. */
const MIRRORABLE = 'Primary|Secondary|Tertiary|Neutral|Info|Success|Warning|Error';
const TONE_TOKEN = new RegExp(`^var\\(\\s*--(${MIRRORABLE})-Color-(\\d+)\\s*\\)$`);
const TONE_TOKENS = new RegExp(`var\\(\\s*--(${MIRRORABLE})-Color-(\\d+)\\s*\\)`, 'g');

/**
 * The tone a light-mode stop takes in dark mode.
 *
 * Mirror the ramp — tone N becomes 13 - N, so 12 (the palest) becomes 1 (the
 * darkest) and the stops keep their order of lightness — then hold the result
 * on the dark side of the 5/6 line. That line is Omni's text rule
 * (`textForTone` / `allowedTones` in heroSpec): a fill that stays on tones 1-5
 * takes white text everywhere, which is what lets the whole mesh share one
 * text color. A mirrored 6 or 7 would land on 7 or 6 and break that, so they
 * stop at 5.
 *
 * Tones 1-5 are already dark in the dark sheet and stay as they are.
 */
export function darkTone(tone: number): number {
  if (tone <= 5) return tone;
  return Math.max(1, Math.min(5, 13 - tone));
}

/** The text color on a dark mesh: white. A literal on purpose — no BW tone is
 *  white in BOTH sheets (BW-1 is white in light, BW-6 in dark), and the
 *  `data-mode` trigger can fire with either sheet loaded. */
export const DARK_MESH_TEXT = '#ffffff';

/**
 * The background stack for dark mode, or null when it cannot be derived.
 *
 * Every color in the stack must be a palette tone token. A raw color, a BW
 * tone, a `-Vibrant` or a var() with its own fallback has no known place on the
 * ramp, so guessing a dark twin for it would be inventing one. Those meshes get
 * no dark variant (the publish script says so) rather than a wrong one.
 */
export function darkMeshBackground(background: string): string | null {
  const vars = background.match(/var\([^)]*\)/g) || [];
  if (!vars.length || vars.some((v) => !TONE_TOKEN.test(v.trim()))) return null;
  if (/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i.test(background)) return null;
  return background.replace(TONE_TOKENS, (_m, family: string, n: string) =>
    `var(--${family}-Color-${darkTone(Number(n))})`);
}

/** The dark-mode block appended to mesh-gradient.css, or '' when the mesh has
 *  no derivable dark twin. Appended AFTER the existing rules so the light file
 *  is unchanged byte for byte: a system republished with this keeps exactly
 *  what it painted in light mode. */
export function darkMeshCSS(mesh: MeshGradient): string {
  const dark = darkMeshBackground(mesh.background);
  if (!dark) return '';
  const decls = `    --Mesh-Gradient: ${dark};
    --Mesh-Gradient-Text: ${DARK_MESH_TEXT};`;
  return `
/* Dark mode. Palette tones are the same lightness in both mode sheets, so the
   light mesh would stay pale on a dark page. Each stop is mirrored onto the
   dark side of the ramp (tone N -> 13 - N, held at 5 or darker) and the text
   turns white.
   It switches on when Dark-Mode.css is the sheet loaded — that sheet sets
   --BW-Color-6 to #ffffff — or when <html data-mode="dark"> is set. */
@container style(--BW-Color-6: #ffffff) {
  :where(body) {
${decls}
  }
}

:root[data-mode="dark"] {
${decls.replace(/^ {2}/gm, '')}
}
`;
}

export function generateMeshGradientCSS(mesh: MeshGradient): string {
  return lightMeshCSS(mesh) + darkMeshCSS(mesh);
}

function lightMeshCSS(mesh: MeshGradient): string {
  const color = withBwFallback(mesh.color || 'var(--Text)');
  return `/* Mesh gradient — authored per design system, not derived.
   Consumers read --Mesh-Gradient rather than restating the stack, so the hero
   and the card cannot drift apart. */
:root {
  --Mesh-Gradient: ${mesh.background};
  --Mesh-Gradient-Text: ${color};
}

/* Any region that should carry the mesh. */
.mesh-gradient,
.gradient-figure,
.hero-mesh {
  background: var(--Mesh-Gradient);
  color: var(--Mesh-Gradient-Text);
}

/* The card is a fixed figure; the hero is not. Only the card constrains its
   own box, and it caps at the viewport so a narrow screen does not scroll
   sideways. */
.gradient-figure {
  position: relative;
  width: 800px;
  height: 450px;
  max-width: 100%;
}

/* Text sitting on the mesh. Type comes from the system's own roles — the
   authored mesh decides color and position, never which face to set. */
.gradient-figure .gradient-text {
  position: absolute;
  left: 6%;
  top: 49.33%;
  width: 65.63%;
  height: 40%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
  justify-content: flex-end;
  text-align: left;
}

.gradient-figure .t-eyebrow {
  margin: 0;
  font-family: var(--Font-Family-Eyebrow);
  font-size: var(--Eyebrow-Large-Font-Size, 18px);
  font-weight: var(--Font-Weight-Eyebrow, 400);
  letter-spacing: var(--Eyebrow-Large-Letter-Spacing, 0.04em);
  line-height: 1.5;
}

.gradient-figure .t-title {
  margin: 0;
  font-family: var(--Font-Family-Header);
  font-size: var(--H2-Font-Size, 40px);
  font-weight: var(--Font-Weight-Header, 400);
  line-height: 1.2;
}
`;
}
