/**
 * Forced interaction states for the parity page.
 *
 * Figma draws Hover, Pressed and Focus-Visible as their own variants, side by
 * side. A browser only shows one of them at a time, under a real pointer. So
 * every rule that says `:hover`, `:active` or `:focus-visible` is copied once
 * more with the pseudo-class swapped for a wrapper class:
 *
 *   .css-abc:hover            ->  .pseudo-hover-all .css-abc
 *   .css-abc:focus-visible .x ->  .pseudo-focus-visible-all .css-abc .x
 *
 * Wrapping a variant in `pseudo-hover-all` then paints everything inside it as
 * hovered, using the component's OWN rules — nothing restated by hand, which is
 * the point: a hand-written hover style would measure the copy, not the lib.
 *
 * The copies go in one <style> that is rebuilt on demand, because emotion
 * inserts a component's rules when it first renders.
 */

const STATES = [
  { pseudo: ':hover', cls: 'pseudo-hover-all' },
  { pseudo: ':active', cls: 'pseudo-active-all' },
  { pseudo: ':focus-visible', cls: 'pseudo-focus-visible-all' },
  /* A field shows focus on its SHELL with :focus-within (the <input> inside is
     what takes focus), so Focus-Visible forces that too. */
  { pseudo: ':focus-within', cls: 'pseudo-focus-visible-all' },
] as const;

export type ForcedState = 'hover' | 'active' | 'focus-visible';
export const forcedStateClass = (s: ForcedState) => `pseudo-${s}-all`;

const STYLE_ID = 'parity-pseudo-states';

/* A control nested in the one being forced keeps its OWN states: the Input's
   end decorator is a button, and an Input drawn as Hover is not hovering its
   decorator. Wrapping that control in `.pseudo-own-state` keeps every forced
   copy off it — the guard goes on the subject, ahead of any pseudo-element. */
export const OWN_STATE_CLASS = 'pseudo-own-state';
function ownStateGuard(sel: string): string {
  const guard = `:not(.${OWN_STATE_CLASS}, .${OWN_STATE_CLASS} *)`;
  const m = sel.match(/::?(before|after|placeholder|marker|selection)$/);
  return m ? sel.slice(0, m.index) + guard + m[0] : sel + guard;
}

function rewrite(selectorText: string): string[] {
  const out: string[] = [];
  for (const { pseudo, cls } of STATES) {
    if (!selectorText.includes(pseudo)) continue;
    const parts = selectorText
      .split(',')
      .filter((p) => p.includes(pseudo))
      .map((p) => `.${cls} ${ownStateGuard(p.trim().split(pseudo).join(''))}`);
    if (parts.length) out.push(parts.join(', '));
  }
  return out;
}

function collect(rules: CSSRuleList, into: string[]) {
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule) {
      for (const sel of rewrite(r.selectorText)) into.push(`${sel} { ${r.style.cssText} }`);
    } else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) {
      collect((r as CSSGroupingRule).cssRules, into);
    }
  }
}

/** Rebuild the forced-state copies from every stylesheet on the page. */
export function refreshPseudoStates(): number {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    if ((sheet.ownerNode as HTMLElement | null)?.id === STYLE_ID) continue;
    let list: CSSRuleList;
    try { list = sheet.cssRules; } catch { continue; } // cross-origin sheet
    collect(list, rules);
  }
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = rules.join('\n');
  return rules.length;
}
