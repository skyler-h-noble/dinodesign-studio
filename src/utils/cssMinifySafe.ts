/**
 * Whitespace-only CSS minifier for a design system's published sheets.
 *
 * Comments go, and so does the whitespace BETWEEN tokens: around braces, after
 * colons, between declarations and rules. Every declaration VALUE is kept
 * byte-for-byte apart from its leading and trailing whitespace. No color,
 * number, unit or quote is rewritten.
 *
 * That limit is the point. A value-rewriting minifier (shortening #aabbcc to
 * #abc, dropping zero units, merging rules) was tried against the token
 * snapshot of a real system and produced 1.1M differences; this pass produced
 * zero across all 1,047 tokens. It also makes the output easy to check: parse
 * both sheets and the declaration lists must be identical
 * (src/__tests__/cssMinifySafe.test.ts does exactly that on generated sheets).
 *
 * Shared by the generator (the brotli copies under design-systems/<id>/br/)
 * and scripts/brotli-test-upload.cjs, which imports this file directly (Node
 * strips the types), so the two can never minify differently.
 *
 * Anything the pass does not understand — CSS nesting, a stray top-level
 * declaration, an unbalanced brace — makes `minifyCss` throw rather than guess.
 * `minifyCssSafe` catches that and returns the sheet unchanged: a larger file
 * still renders correctly, a mangled one does not.
 */

/** At-rules whose block holds RULES (recursed into). Every other at-rule with
 *  a block — @font-face, @page, @property — holds declarations. */
const GROUPING_AT_RULES = /^@(media|container|scope|supports|layer|document|-moz-document|starting-style)\b/i;

/** Index just past the string that opens at `i` (t[i] is the quote). */
function skipString(t: string, i: number): number {
  const q = t[i];
  for (let k = i + 1; k < t.length; k++) {
    if (t[k] === '\\') { k++; continue; }
    if (t[k] === q) return k + 1;
  }
  throw new Error('cssMinifySafe: unterminated string');
}

/** The sheet without its comments. Comment markers inside strings are kept. */
export function stripCssComments(t: string): string {
  let out = '';
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === '"' || c === "'") {
      const e = skipString(t, i);
      out += t.slice(i, e);
      i = e;
    } else if (c === '/' && t[i + 1] === '*') {
      const j = t.indexOf('*/', i + 2);
      i = j < 0 ? t.length : j + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** First index at or after `from` of any char in `stops`, outside strings and
 *  parentheses, or -1. */
function findTopLevel(t: string, from: number, stops: string, end = t.length): number {
  let paren = 0;
  for (let i = from; i < end; i++) {
    const c = t[i];
    if (c === '"' || c === "'") { i = skipString(t, i) - 1; continue; }
    if (c === '(') paren++;
    else if (c === ')') paren--;
    else if (paren === 0 && stops.includes(c)) return i;
  }
  return -1;
}

/** Index just past the `}` that closes the block opened at `open`. */
function blockEnd(t: string, open: number): number {
  let depth = 0;
  for (let i = open; i < t.length; i++) {
    const c = t[i];
    if (c === '"' || c === "'") { i = skipString(t, i) - 1; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i + 1;
  }
  throw new Error('cssMinifySafe: unbalanced braces');
}

/** Collapse whitespace runs outside strings to one space; with
 *  `tightCommas`, none around a comma (a selector list). */
function collapseWhitespace(s: string, tightCommas = false): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") {
      const e = skipString(s, i);
      out += s.slice(i, e);
      i = e;
    } else if (/\s/.test(c)) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (!(tightCommas && (out.endsWith(',') || s[i] === ','))) out += ' ';
    } else {
      out += c;
      i++;
    }
  }
  return out.trim();
}

/** A selector list: whitespace collapsed, none around the commas. */
const normalizeSelector = (s: string) => collapseWhitespace(s, true);

/** A declaration block, minified: `a:1;b:2`. */
function declarations(body: string): string {
  const out: string[] = [];
  let start = 0;
  for (;;) {
    const semi = findTopLevel(body, start, ';');
    const part = body.slice(start, semi < 0 ? body.length : semi);
    const colon = part.indexOf(':');
    if (colon >= 0) {
      const name = part.slice(0, colon).trim();
      const value = part.slice(colon + 1).trim();
      /* `--x:;` (no token at all) was invalid before the empty custom property
         was allowed, and older engines still drop it; `--x: ;` is valid
         everywhere. Keep the one space. */
      out.push(`${name}:${value === '' ? ' ' : value}`);
    } else if (part.trim()) {
      throw new Error(`cssMinifySafe: not a declaration: ${part.trim().slice(0, 60)}`);
    }
    if (semi < 0) break;
    start = semi + 1;
  }
  return out.join(';');
}

/** A list of rules and at-rules, minified. */
function rules(t: string): string {
  const out: string[] = [];
  let i = 0;
  for (;;) {
    while (i < t.length && /\s/.test(t[i])) i++;
    if (i >= t.length) break;
    const j = findTopLevel(t, i, '{;}');
    if (j < 0 || t[j] === '}') throw new Error('cssMinifySafe: stray text outside a rule');
    const head = t.slice(i, j).trim();
    if (t[j] === ';') {
      // A statement at-rule: @import, @charset, @layer a, b; — kept verbatim.
      if (!head.startsWith('@')) throw new Error('cssMinifySafe: declaration outside a rule');
      out.push(head + ';');
      i = j + 1;
      continue;
    }
    const k = blockEnd(t, j);
    const body = t.slice(j + 1, k - 1);
    if (head.startsWith('@')) {
      out.push(GROUPING_AT_RULES.test(head)
        ? `${collapseWhitespace(head)}{${rules(body)}}`
        : `${collapseWhitespace(head)}{${declarations(body)}}`);
    } else {
      // Nested style rules (CSS nesting) are not handled; leave the sheet be.
      if (findTopLevel(body, 0, '{') >= 0) throw new Error('cssMinifySafe: nested rule');
      out.push(`${normalizeSelector(head)}{${declarations(body)}}`);
    }
    i = k;
  }
  return out.join('');
}

/** Minify, or throw on anything the pass does not understand. */
export function minifyCss(css: string): string {
  return rules(stripCssComments(css));
}

/** Minify; on anything unexpected, the sheet unchanged. */
export function minifyCssSafe(css: string): string {
  try {
    return minifyCss(css);
  } catch (err) {
    console.warn('[cssMinifySafe] kept the sheet unminified:', (err as Error).message);
    return css;
  }
}
