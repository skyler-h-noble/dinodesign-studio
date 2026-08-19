// generateTypographyTokensCSS.ts — turn the type scale into the Desktop block
// of typography-tokens.css, plus the rules that a variable file can't express
// (role re-mapping, Display grain, Display bounce).
//
// Only the Desktop block is generated. IOS-Mobile / IOS-Tablet / Android keep
// the values they have always shipped — they are spliced through from the
// static file untouched.

import {
  buildTypeScale,
  resolveRoles,
  DISPLAY_STEPS,
  FACE_TOKEN,
  axisToken,
  weightToken,
  variationAxes,
  axesToCss,
  bounceChars,
  noiseParams,
  GROUP_ORDER,
  GROUP_DESCRIPTIONS,
  NOISE_FILTER_ID,
  SYSTEM_UI_STACK,
  type TypeStyle,
  type FamilyRole,
} from '../typeScale';
import type { TypographyStyle } from '../../types';

/**
 * What each face token resolves to. The Platform var is the Figma-side name and
 * stays as the outer lookup so a Figma-driven platform override still wins; the
 * Set-* token is what actually resolves in the browser (nothing ever defines
 * --Platform-Font-Families-*).
 *
 * Eyebrow is the OS UI stack — a plain interface label, deliberately not one of
 * the picked faces. --Set-Font-Family-Eyebrow is read first so a design can
 * override it with a real family without this file changing.
 */
const FACE_SOURCE: Record<FamilyRole, string> = {
  header: 'var(--Platform-Font-Families-Header, var(--Set-Font-Family-Header))',
  // Set-Font-Family-Display is the token now; Decorative is kept as the
  // fallback so designs saved before the four faces still resolve.
  display: 'var(--Set-Font-Family-Display, var(--Platform-Font-Families-Decorative, var(--Set-Font-Family-Decorative)))',
  eyebrow: `var(--Set-Font-Family-Eyebrow, ${SYSTEM_UI_STACK})`,
  body: 'var(--Platform-Font-Families-Body, var(--Set-Font-Family-Body))',
};

/** Faces in the order they're declared. */
const FACES: FamilyRole[] = ['display', 'header', 'eyebrow', 'body'];

/** The axis-settings token each face publishes. Named off the face token so
 *  the pair reads together (--Font-Family-Header / --Font-Variation-Header).
 *  PROVISIONAL: the Flex work replaces this single settings string with
 *  per-axis variables. */
const VARIATION_TOKEN: Record<FamilyRole, string> = {
  display: 'Font-Variation-Display',
  header: 'Font-Variation-Header',
  eyebrow: 'Font-Variation-Eyebrow',
  body: 'Font-Variation-Body',
};

/** px values print as integers when they are whole (18px, not 18.00px). */
const px = (n: number) => `${+n.toFixed(2)}px`;

/** Token base → the class the lib puts on the element (`typography-<style>`).
 *  The lib spells the smallest step "extra-small"; the token spells it
 *  "ExtraSmall". */
const libClass = (token: string) => `typography-${token.replace(/ExtraSmall/g, 'Extra-Small').toLowerCase()}`;

/** Every Display step's selector, derived from the scale so adding a step
 *  never leaves one of the Display rules behind. `prefix` doubles the class
 *  when the rule has to out-specify the component's own emotion style. */
const displaySelectors = (prefix = '', suffix = '') =>
  DISPLAY_STEPS.map((s) => `${prefix}.${libClass(s.token)}${suffix}`).join(',\n');

function styleBlock(s: TypeStyle): string {
  const lines: string[] = [];
  // Each style names its own family, relative to one of the four faces, so a
  // consumer can style anything from its own tokens without knowing which face
  // it sits on. The Eyebrow face is the exception: --Font-Family-Eyebrow is
  // already the whole answer for that group, so three per-step copies of it
  // would be three names for one value.
  if (s.familyRole !== 'eyebrow') {
    lines.push(`  --${s.token}-Font-Family:   var(--${FACE_TOKEN[s.familyRole]});`);
  }
  lines.push(
    `  --${s.token}-Font-Size:     ${px(s.size)};`,
    `  --${s.token}-Font-Weight:   ${s.weightFromFace ? `var(--${weightToken(s.familyRole)})` : s.weight};`,
    `  --${s.token}-Line-Height:   ${px(s.lineHeight)};`,
    `  --${s.token}-Letter-Spacing: ${s.letterSpacing};`,
    `  --${s.token}-Text-Transform: ${s.textTransform};`,
  );
  for (const w of s.extraWeights || []) {
    lines.push(`  --${s.token}-${w.suffix}-Font-Weight: ${w.weight};`);
  }
  if (s.paragraphSpacing) {
    lines.push(`  --${s.token}-Paragraph-Spacing: ${px(s.paragraphSpacing)};`);
  }
  return lines.join('\n');
}

/** The `[data-platform="Desktop"] { … }` block, generated from the scale. */
export function generateDesktopTypographyBlock(typography: TypographyStyle[] | null | undefined): string {
  return `[data-platform="Desktop"] {\n${typographyDeclarations(typography)}\n}`;
}

/** Just the custom-property declarations, so the export and the studio's live
 *  preview can put the same ramp behind different selectors. */
export function typographyDeclarations(typography: TypographyStyle[] | null | undefined): string {
  const styles = buildTypeScale(typography);
  const groups = GROUP_ORDER.filter((g) => styles.some((s) => s.group === g));

  const roles = resolveRoles(typography);
  const out: string[] = [];

  // The four faces. Every other family variable in the file is relative to
  // one of these, so re-pointing a face re-points everything wearing it.
  out.push('  /* Faces */');
  for (const face of FACES) {
    out.push(`  --${FACE_TOKEN[face]}: ${FACE_SOURCE[face]};`);
  }

  // Weight is a property of the face, not of any one step — the styles that
  // take their weight from a face reference these rather than restating a
  // number. On a variable face this is the wght axis; on a static one it is
  // just the chosen weight, so the token means the same thing either way.
  out.push('');
  out.push('  /* Face weights */');
  for (const face of FACES) {
    out.push(`  --${weightToken(face)}: ${roles[face].weight};`);
  }

  // One variable per axis per face, then a font-variation-settings value built
  // out of them. Setting Width alone is `--Font-Width-Header: 106`.
  const axisFaces = FACES.filter((f) => variationAxes(roles[f].axes).length);
  if (axisFaces.length) {
    out.push('');
    out.push('  /* Variable-font axes */');
    for (const face of axisFaces) {
      for (const [tag, value] of variationAxes(roles[face].axes)) {
        out.push(`  --${axisToken(tag, face)}: ${value};`);
      }
      out.push(`  --${VARIATION_TOKEN[face]}: ${axesToCss(roles[face].axes, face)};`);
    }
  }

  for (const group of groups) {
    const inGroup = styles.filter((s) => s.group === group);
    const desc = GROUP_DESCRIPTIONS[group];
    out.push('');
    out.push(desc ? `  /* ${group} — ${desc} */` : `  /* ${group} */`);
    out.push(inGroup.map(styleBlock).join('\n'));
  }

  // Leading blank line only between groups, never at the top of the block.
  return out.join('\n').replace(/^\n/, '');
}

/**
 * Rules the token file can't express as variables.
 *
 * The lib hard-codes each style's family in STYLE_MAP — display-* reads
 * --Header-Font-Family and overline-* reads --Decorative-Font-Family — so the
 * two groups that moved face (Display onto the Display face, Overline onto the
 * Eyebrow face) need a rule, not a token. Two class selectors so the rule beats
 * the single-class emotion style the component generates at runtime.
 *
 * LIB FOLLOW-UP: once STYLE_MAP reads each style's own --<style>-Font-Family
 * token, this whole block can go.
 */
function roleOverrideRules(): string {
  return `/* ---------------------------------------------------------------------------
   Face re-mapping
   Display renders in the Display face (it used to follow Header, which left the
   expressive face with nowhere to appear at size). Overline is the eyebrow spec
   now, on the Eyebrow face. The lib hard-codes both families, so they are
   corrected here rather than through a token.

   Both read the face token, which is what keeps decorative mode working:
   core.css re-points --Font-Family-Eyebrow at the Display face inside
   [data-decorative], on a higher-specificity selector.
--------------------------------------------------------------------------- */
${displaySelectors('.typography')} {
  font-family: var(--Font-Family-Display);
}

.typography.typography-overline,
.typography.typography-overline-small,
.typography.typography-overline-medium,
.typography.typography-overline-large {
  font-family: var(--Font-Family-Eyebrow);
}`;
}

/** Paragraph spacing is the space BETWEEN paragraphs of a style, which is what
 *  Figma's paragraphSpacing means. margin-bottom on the style itself is a
 *  different thing — it also puts space after the LAST paragraph, where Figma
 *  puts none. The adjacent-sibling rule is the exact CSS equivalent. */
function paragraphSpacingRules(styles: TypeStyle[]): string {
  const withPs = styles.filter((s) => s.paragraphSpacing);
  if (!withPs.length) return '';
  const rules = withPs.map((s) => {
    const cls = `.${libClass(s.token)}`;
    return `${cls} + ${cls} {\n  margin-block-start: var(--${s.token}-Paragraph-Spacing);\n}`;
  });
  return `/* ---------------------------------------------------------------------------
   Paragraph spacing — space only where one paragraph follows another, which is
   what the Figma token means.
--------------------------------------------------------------------------- */
${rules.join('\n\n')}`;
}

/** Variable-font axes, applied per face. Body first so the faces that follow
 *  can override it — equal specificity, order decides. */
function variationRules(styles: TypeStyle[], roles: ReturnType<typeof resolveRoles>): string {
  const rules: string[] = [];
  const selectorsFor = (face: FamilyRole) =>
    styles.filter((s) => s.familyRole === face).map((s) => `.${libClass(s.token)}`);

  if (variationAxes(roles.body.axes).length) {
    rules.push(`.typography {\n  font-variation-settings: var(--${VARIATION_TOKEN.body});\n}`);
  }
  for (const face of ['header', 'display', 'eyebrow'] as const) {
    if (!variationAxes(roles[face].axes).length) continue;
    const sel = selectorsFor(face);
    if (!sel.length) continue;
    rules.push(`${sel.join(',\n')} {\n  font-variation-settings: var(--${VARIATION_TOKEN[face]});\n}`);
  }
  if (!rules.length) return '';
  return `/* ---------------------------------------------------------------------------
   Variable-font axes
   wght is deliberately absent — font-weight already carries it, and declaring
   it in both places lets the two disagree.
--------------------------------------------------------------------------- */
${rules.join('\n\n')}`;
}

/** A font file can't be roughened, so grain is SVG turbulence displacing the
 *  rendered glyph edges. The <svg> has to be pasted into the document once for
 *  the filter to resolve, so it ships as a comment right next to the rule. */
function noiseRules(noise: number): string {
  if (!noise) return '';
  const p = noiseParams(noise);
  return `/* ---------------------------------------------------------------------------
   Display noise / grain (${noise}/100)
   A font file can't be roughened, so the grain is generated as SVG turbulence
   that displaces the rendered glyph edges. Paste this <svg> once anywhere in
   the document for the Display filter to resolve.

   <svg aria-hidden="true" style="position:absolute;width:0;height:0">
     <filter id="${NOISE_FILTER_ID}">
       <feTurbulence type="fractalNoise" baseFrequency="${p.baseFrequency}" numOctaves="3" result="noise"/>
       <feDisplacementMap in="SourceGraphic" in2="noise" scale="${p.scale}" xChannelSelector="R" yChannelSelector="G"/>
     </filter>
   </svg>
--------------------------------------------------------------------------- */
${displaySelectors('.typography')} {
  filter: url(#${NOISE_FILTER_ID});
}`;
}

/** Per-character offsets can't be expressed without per-character elements, so
 *  the export ships the nth-child rules AND the one-liner that creates them. */
function bounceRules(bounce: number): string {
  if (!bounce) return '';
  const chars = bounceChars(24, bounce);
  const offsets = chars.map((c, i) => {
    const sel = displaySelectors('', ` > span:nth-child(${i + 1})`);
    return `${sel} { transform: translateY(${c.dy}em) rotate(${c.rot}deg) scale(${c.scale}); }`;
  });
  return `/* ---------------------------------------------------------------------------
   Display bounce — hand-lettering rise and fall (${bounce}/100)

   A font can't do this: every glyph in a face is identical, so the variation
   has to live on individual characters. Wrap each character in a <span>:

   const el = document.querySelector('.typography-display-large');
   el.innerHTML = [...el.textContent]
     .map(c => c === ' ' ? ' ' : \`<span>\${c}</span>\`).join('');

   …then these rules give each position its offset. Offsets are fixed, not
   random, so the lettering looks the same on every load.
--------------------------------------------------------------------------- */
${displaySelectors('', ' > span')} { display: inline-block; transform-origin: 50% 60%; }

${offsets.join('\n')}`;
}

/** Everything that follows the platform blocks. */
export function generateTypographyRules(typography: TypographyStyle[] | null | undefined): string {
  const styles = buildTypeScale(typography);
  const roles = resolveRoles(typography);
  return [
    roleOverrideRules(),
    paragraphSpacingRules(styles),
    variationRules(styles, roles),
    noiseRules(roles.display.noise || 0),
    bounceRules(roles.display.bounce || 0),
  ].filter(Boolean).join('\n\n');
}

/**
 * Replace the Desktop block in the shipped typography-tokens.css with the
 * generated one and append the rules. The other three platform blocks pass
 * through untouched.
 */
export function buildTypographyTokensCSS(
  staticCSS: string,
  typography: TypographyStyle[] | null | undefined
): string {
  // Anchored to the start of a line — the file's header comment mentions
  // [data-platform="Desktop"] in prose, and an unanchored search finds that
  // first and splices the generated block into the middle of the comment.
  const marker = '\n[data-platform="Desktop"]';
  const markerAt = staticCSS.indexOf(marker);
  const start = markerAt === -1 ? -1 : markerAt + 1;
  // A closing brace in the first column ends the block — every nested value in
  // this file is indented, so this can't match early.
  const end = start === -1 ? -1 : staticCSS.indexOf('\n}', start);
  if (start === -1 || end === -1) {
    console.warn('⚠️ typography-tokens.css: no Desktop block found — appending the generated scale instead');
    return `${staticCSS}\n\n${generateDesktopTypographyBlock(typography)}\n\n${generateTypographyRules(typography)}\n`;
  }
  const before = staticCSS.slice(0, start);
  const after = staticCSS.slice(end + 2);
  return `${before}${generateDesktopTypographyBlock(typography)}${after}\n\n${generateTypographyRules(typography)}\n`;
}
