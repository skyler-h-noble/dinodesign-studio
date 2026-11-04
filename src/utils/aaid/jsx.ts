// jsx.ts — the small element model the compiler builds before printing.
//
// The tables (propTables.ts) produce these; the printer (emitJsx.ts) turns them
// into text. Keeping the model separate from the text means attribute order,
// quoting and line breaking are decided in exactly one place, which is what
// makes the output byte-stable.

export type PropValue =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'true' }
  | { kind: 'node'; value: JsxNode }
  | { kind: 'style'; value: Array<[string, string | number]> };

export interface JsxElement {
  kind: 'element';
  tag: string;
  props: Array<[string, PropValue]>;
  children: JsxNode[];
  /** Where the tag is imported from. Absent = '@omni-design/components'. */
  module?: string;
}

export interface JsxText {
  kind: 'text';
  value: string;
}

export interface JsxFallback {
  kind: 'fallback';
  id: string;
  name: string;
  reason: string;
}

export interface JsxComment {
  kind: 'comment';
  value: string;
}

export type JsxNode = JsxElement | JsxText | JsxFallback | JsxComment;

export const LIB_MODULE = '@omni-design/components';

export function el(tag: string, props: Array<[string, PropValue]> = [], children: JsxNode[] = [], module?: string): JsxElement {
  const e: JsxElement = { kind: 'element', tag, props, children };
  if (module) e.module = module;
  return e;
}

export const str = (value: string): PropValue => ({ kind: 'string', value });
export const n = (value: number): PropValue => ({ kind: 'number', value });
export const yes: PropValue = { kind: 'true' };
export const node = (value: JsxNode): PropValue => ({ kind: 'node', value });
export const style = (value: Array<[string, string | number]>): PropValue => ({ kind: 'style', value });
export const text = (value: string): JsxText => ({ kind: 'text', value });

/** A literal from a table, as a PropValue. */
export function lit(v: string | number | true): PropValue {
  if (v === true) return yes;
  return typeof v === 'number' ? n(v) : str(v);
}
