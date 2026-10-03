// menuLevels.ts — the Menu-Levels collection, as CSS.
//
// Seven modes, one variable (Left-Margin): the indent of a menu row at each
// nesting depth. The table and its regularity check have lived in
// figmaModeMapping since September, with tests, and nothing emitted them — so
// the collection reached neither stylesheet and TreeView indents with a
// hardcoded 9px + 12px instead.
//
// Those are not the same shape. Figma's values are ABSOLUTE per depth, and a
// compounding per-level indent cannot produce 8 / 36 / 64 and then 176 at depth
// six; it would need a different step at every rung, which is precisely the
// hand-typed ladder this collection was straightened out of.
//
// One emitter, called by the preview AND the export. Writing the seven values
// into each of them separately would have put a third and fourth copy of the
// ladder in the codebase, and a table duplicated per consumer is how the
// original irregular one survived as long as it did.
import { MENU_LEVEL_LEFT_MARGIN } from './figmaModeMapping';

/**
 * The per-level indents, plus the data-attribute scope that reads them.
 *
 * The literal sits on `--Menu-Level-{N}-Left-Margin` and
 * `[data-menu-level="level-N"]` points `--Menu-Left-Margin` at it — the same
 * direction as Overline -> Eyebrow, so the two names cannot drift. A component
 * can take whichever suits it: index the depth it already knows, or set the
 * attribute on the row and read one name.
 */
export function menuLevelCSS(indent = '  '): string {
  const levels = Object.entries(MENU_LEVEL_LEFT_MARGIN);
  const vars = levels.map(([, px], n) => `${indent}--Menu-Level-${n}-Left-Margin: ${px}px;`);
  return vars.join('\n');
}

/** The scoped arm, emitted outside the :root block that carries the values. */
export function menuLevelScopeCSS(): string {
  return Object.keys(MENU_LEVEL_LEFT_MARGIN)
    .map((mode, n) => `[data-menu-level="${mode}"] {\n  --Menu-Left-Margin: var(--Menu-Level-${n}-Left-Margin);\n}`)
    .join('\n');
}
