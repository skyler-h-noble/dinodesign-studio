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
  /** Foreground colour for text sitting on the mesh. A token, not a hex. */
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
export function generateMeshGradientCSS(mesh: MeshGradient): string {
  const color = mesh.color || 'var(--Text)';
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
   authored mesh decides colour and position, never which face to set. */
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
