/**
 * Accessibility findings for one conversion.
 *
 * Sibling of conversionDrift, and deliberately separate from it. Drift asks
 * "does the code match the design" — hardcoded colours, dropped variants,
 * unmapped instances. This asks "can the code be used", which is a different
 * question with a different failure mode: drift is visible the moment you look
 * at the preview, and almost nothing here is. A button with no accessible name
 * renders perfectly.
 *
 * It is also separate from accessibilityReport.ts, which checks the design
 * SYSTEM's tokens for WCAG contrast across modes and surfaces. That runs once
 * per design system; this runs once per converted frame, over the emitted JSX.
 *
 * WHY THIS EXISTS AT ALL. There is no Accessible Name property in the Figma
 * file — a deliberate choice, because a required field gets filled badly and a
 * default value like "button" is worse than an empty one (it passes automated
 * checks AND silences the lib's own dev warning). So the converter DERIVES the
 * name from the layer name, the icon's meaning, or convention, and its prompt
 * ends with "flag every control where you had to guess".
 *
 * That flag had nowhere to go. This is where it goes: the guesses become a list
 * the designer can correct, because they are the only one who knows whether a
 * house icon means Home or Dashboard.
 *
 * Everything here is static analysis of the emitted JSX. No browser, no render,
 * so it is testable the same way drift is.
 */

import type { DriftFinding } from './conversionDrift';

export type { DriftFinding as A11yFinding };

/* ── What counts as a control with no readable text ─────────────────────────
   Button Types that render nothing a screen reader can announce as a label.
   `text` is absent on purpose: its visible label IS the accessible name, and
   adding aria-label there makes the control announce twice. */
const LABELLESS_PROPS = ['iconOnly', 'avatar', 'letterNumber', 'swatch'];

/** Names that exist but say nothing.
 *
 *  These are the dangerous ones. An UNNAMED button trips the lib's dev warning
 *  and shows up in an audit; a button named "button" or "JD" passes every
 *  automated check, silences the warning, and tells the user nothing. Worse
 *  than no label, and only findable by reading it. */
const MEANINGLESS_NAME = /^(button|btn|icon|link|image|img|click|here|untitled|label|text)$/i;

/** A bare number or two-to-three initials — the CONTENT of a letterNumber or
 *  Avatar button, mistaken for its name. "3" is a count, not a name; "JD" is a
 *  person, not an action. */
const CONTENT_NOT_NAME = /^([0-9]+|[A-Z]{1,3}|[0-9]+\+)$/;

/** The converter's own marker for a name it inferred rather than read.
 *
 *      // DERIVED-ARIA-LABEL: "Dashboard" on Button — house icon, inferred…
 *
 *  Same shape as the MISSING-LIB-COMPONENT tags the pipeline already extracts,
 *  and for the same reason: a grep-able marker in the emitted code outlives any
 *  metadata carried beside it. */
const DERIVED_LABEL = /\/\/\s*DERIVED-ARIA-LABEL:\s*["“']([^"”']+)["”']\s*(?:on\s+[\w.]+\s*)?(?:[—-]\s*([^\n]*))?/g;

/** The converter's marker for a list it inferred from typed markers rather
 *  than read from _aaid.list.
 *
 *      // DERIVED-LIST: 3 items on <List> — markers typed as "• " in one node
 *
 *  Distinct from a list Figma actually knows about, which is read and needs no
 *  confirmation. This one is a judgement about intent: a line starting with
 *  "-" may be a dash. */
const DERIVED_LIST = /\/\/\s*DERIVED-LIST:\s*([^\n]*)/g;

/** A bullet or number the designer typed into the string, left in the output.
 *
 *  Figma DRAWS a native list's marker, so a real list's characters never
 *  contain one. A marker surviving into the JSX therefore means the text was
 *  copied verbatim — the list was never recognised as a list. */
const TYPED_MARKER = /^\s*(?:[•·▪◦‣∙*]|[-–—]\s|\d+[.)]\s|[a-z][.)]\s)/i;

/** Typography components — the ones a stray bullet would land in. */
const TYPOGRAPHY = /^(Body|BodySmall|BodyLarge|Subtitle|SubtitleLarge|Caption|Label|Overline|Typography|p|span)$/;

/** Opening tags, with their attribute blob. Good enough for emitted JSX, which
 *  is machine-written and regular — the same assumption conversionDrift makes. */
const TAG = /<([A-Za-z][\w.]*)((?:\s+[^<>]*?)?)(\/?)>/g;

/** One attribute, quoted or braced: aria-label="x" / aria-label={'x'}. */
function attr(attrs: string, name: string): string | null {
  const q = new RegExp(`${name}\\s*=\\s*"([^"]*)"`).exec(attrs);
  if (q) return q[1];
  const b = new RegExp(`${name}\\s*=\\s*\\{\\s*['"\`]([^'"\`]*)['"\`]\\s*\\}`).exec(attrs);
  if (b) return b[1];
  return null;
}

/** Is a boolean-ish JSX prop present? `iconOnly` and `iconOnly={true}` both. */
function hasFlag(attrs: string, name: string): boolean {
  if (new RegExp(`\\b${name}\\s*=\\s*\\{\\s*false\\s*\\}`).test(attrs)) return false;
  return new RegExp(`\\b${name}\\b`).test(attrs);
}

interface Tag { name: string; attrs: string; index: number; selfClosing: boolean }

function tags(jsx: string): Tag[] {
  const out: Tag[] = [];
  for (const m of jsx.matchAll(TAG)) {
    out.push({ name: m[1], attrs: m[2] || '', index: m.index ?? 0, selfClosing: m[3] === '/' });
  }
  return out;
}

/** The text between a tag and its closing tag, roughly. Used to tell a labelled
 *  control from an empty one — not to parse the tree. */
function innerText(jsx: string, t: Tag): string {
  if (t.selfClosing) return '';
  const close = jsx.indexOf(`</${t.name}>`, t.index);
  if (close < 0) return '';
  const inner = jsx.slice(jsx.indexOf('>', t.index) + 1, close);
  return inner.replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').trim();
}

export function computeA11y(jsx: string, notes?: string): DriftFinding[] {
  const findings: DriftFinding[] = [];
  if (!jsx.trim()) return findings;

  const all = tags(jsx);

  for (const t of all) {
    const isButton = t.name === 'Button' || t.name === 'Fab' || t.name === 'IconButton';
    const named = attr(t.attrs, 'aria-label')
      ?? attr(t.attrs, 'aria-labelledby')
      ?? attr(t.attrs, 'title');
    const labelless = LABELLESS_PROPS.some(p => hasFlag(t.attrs, p));
    const text = innerText(jsx, t);

    // ── A control that renders no readable text and carries no name ────────
    if (isButton && labelless && !named) {
      findings.push({
        severity: 'error',
        kind: 'unnamed-control',
        message: 'Button renders no readable text and has no accessible name — a screen reader announces it as just "button".',
        detail: t.attrs.trim().slice(0, 120),
        where: t.name,
      });
    }

    // ── A name that exists but says nothing ────────────────────────────────
    if (named !== null && named.trim()) {
      const n = named.trim();
      if (MEANINGLESS_NAME.test(n)) {
        findings.push({
          severity: 'error',
          kind: 'meaningless-name',
          message: `aria-label="${n}" names the control type, not the action. It passes automated checks and silences the lib's own warning, which makes it worse than no label.`,
          detail: n,
          where: t.name,
        });
      } else if (CONTENT_NOT_NAME.test(n)) {
        findings.push({
          severity: 'error',
          kind: 'meaningless-name',
          message: `aria-label="${n}" is the control's CONTENT, not its name. "${n}" tells the user what is displayed, never what the control does.`,
          detail: n,
          where: t.name,
        });
      } else if (text && n.toLowerCase() === text.toLowerCase()) {
        findings.push({
          severity: 'warning',
          kind: 'redundant-name',
          message: `aria-label="${n}" repeats the visible text. Harmless but pointless — the visible label is already the accessible name.`,
          detail: n,
          where: t.name,
        });
      }
    }

    // ── Labelled twice ─────────────────────────────────────────────────────
    // The button owns the name; an icon inside must carry none. Both, and a
    // screen reader reads "Delete, Delete button".
    if (isButton && named) {
      const close = jsx.indexOf(`</${t.name}>`, t.index);
      const inner = close > 0 ? jsx.slice(t.index, close) : '';
      for (const child of tags(inner).slice(1)) {
        const childLabel = attr(child.attrs, 'aria-label') ?? attr(child.attrs, 'titleAccess');
        if (childLabel) {
          findings.push({
            severity: 'error',
            kind: 'double-label',
            message: `Button is labelled "${named}" and contains an icon labelled "${childLabel}". A screen reader reads both — remove the icon's label.`,
            detail: `${named} + ${childLabel}`,
            where: `${t.name} > ${child.name}`,
          });
        }
      }
    }

    // ── Interactive elements the lib should own ────────────────────────────
    // Kept here rather than in drift because the consequence is behavioural,
    // not visual: a raw <button> has none of the lib's focus ring, target size
    // or naming warnings, and looks identical until someone tabs to it.
    if (/^(button|input|select|textarea)$/.test(t.name)) {
      findings.push({
        severity: 'error',
        kind: 'raw-interactive',
        message: `<${t.name}> bypasses the library — no focus ring, no minimum target size, none of the lib's accessible-name warnings.`,
        where: t.name,
      });
    }
    if (t.name === 'a' && hasFlag(t.attrs, 'href') && !innerText(jsx, t) && !named) {
      findings.push({
        severity: 'error',
        kind: 'link-no-text',
        message: 'Link has no text and no accessible name — it is announced as an empty link.',
        where: 'a',
      });
    }

    // ── A list rendered as loose lines of prose ────────────────────────────
    /* The marker is IN the text, which only happens when the list was not
       recognised as one. The output is a stack of <Body> elements: no list
       role, no item count, no way to jump by list — WCAG 1.3.1 Info and
       Relationships. And the glyph is content now, so it is announced.

       Error rather than warning because the fix is structural. Restyling does
       not recover it; the markup has to change. */
    if (TYPOGRAPHY.test(t.name)) {
      const body = innerText(jsx, t);
      if (body && TYPED_MARKER.test(body)) {
        findings.push({
          severity: 'error',
          kind: 'prose-list',
          message: `<${t.name}> starts with a list marker, so the text is a list item that was emitted as a paragraph. A screen reader announces no list and no item count, and reads the marker as content. Use <List> + <ListItem>, which render <ul role="list"> with <li> children.`,
          detail: body.slice(0, 60),
          where: t.name,
        });
      }
    }

    // ── A list item that kept its typed marker ─────────────────────────────
    // The structure is right, the text is not: <List> draws the marker, so a
    // typed one is read out on top of it — "bullet bullet First item".
    if (t.name === 'ListItem') {
      const body = innerText(jsx, t);
      if (body && TYPED_MARKER.test(body)) {
        findings.push({
          severity: 'warning',
          kind: 'double-marker',
          message: `<ListItem> text still begins with a typed "${body.slice(0, 3).trim()}". <List> renders the marker itself, so this one is duplicate content — visible twice and announced twice.`,
          detail: body.slice(0, 60),
          where: 'ListItem',
        });
      }
    }

    // ── Images ─────────────────────────────────────────────────────────────
    if (t.name === 'img' && attr(t.attrs, 'alt') === null) {
      findings.push({
        severity: 'warning',
        kind: 'image-no-alt',
        message: 'Image has no alt attribute. Decorative images need alt="" explicitly — a missing attribute is not the same as an empty one.',
        where: 'img',
      });
    }
  }

  // ── Heading order ────────────────────────────────────────────────────────
  // A skipped level breaks the document outline screen-reader users navigate
  // by, and is completely invisible on screen — H1 and H3 just look like two
  // different sizes.
  const levels = all
    .map(t => /^H([1-6])$/.exec(t.name))
    .filter((m): m is RegExpExecArray => !!m)
    .map(m => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) {
      findings.push({
        severity: 'warning',
        kind: 'heading-skip',
        message: `Heading level jumps from H${levels[i - 1]} to H${levels[i]}. Screen readers navigate by this outline; a gap reads as a missing section.`,
        detail: `H${levels[i - 1]} → H${levels[i]}`,
        where: `H${levels[i]}`,
      });
    }
  }

  // ── Names the converter had to guess ─────────────────────────────────────
  /* The reason this module exists. With no Accessible Name property in Figma,
     the converter derives names — from the layer name, the icon's meaning, or
     convention — and its prompt is told to flag every one it guessed at. That
     flag previously went into notes nobody reads.

     Info, not warning: a derived name is usually right. It needs a human to
     confirm the ACTION matches the glyph, which is a thing only the designer
     knows. */
  /* Read from the JSX itself, not a side channel. The converter writes its
     notes as a comment block at the top of the output — the same place
     MISSING-LIB-COMPONENT tags go and are already extracted from — so the
     marker travels with the code and survives being copied, saved or pasted
     into a PR. A separate notes field would be dropped by all three. */
  for (const src of [jsx, notes || '']) {
    for (const m of src.matchAll(DERIVED_LIST)) {
      findings.push({
        severity: 'info',
        kind: 'derived-list',
        message: `List structure was inferred from typed markers, not read from the design — ${m[1].trim()}. Confirm these lines are really a list: a line starting with "-" may be a dash. A list authored with Figma's own list control is read rather than guessed and is not reported here.`,
        detail: m[1].trim().slice(0, 80),
        where: 'List',
      });
    }
    for (const m of src.matchAll(DERIVED_LABEL)) {
      findings.push({
        severity: 'info',
        kind: 'derived-name',
        message: `Accessible name "${m[1]}" was inferred, not authored${m[2] ? ` — ${m[2].trim()}` : ''}. Confirm it names the ACTION: a house icon that opens a dashboard is "Dashboard", not "Home".`,
        detail: m[1],
        where: m[2] ? undefined : 'derived',
      });
    }
  }

  return findings;
}

export function a11ySummary(findings: DriftFinding[]) {
  return {
    errors: findings.filter(f => f.severity === 'error').length,
    warnings: findings.filter(f => f.severity === 'warning').length,
    info: findings.filter(f => f.severity === 'info').length,
  };
}
