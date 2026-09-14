/**
 * How much room the nav takes, so the page underneath can keep clear of it.
 *
 * ── Why this has to be computed rather than documented ────────────────────
 * A nav that STICKS or is FIXED leaves the flow. The page then starts at the
 * top of the viewport, underneath the bar, and the first heading is hidden —
 * which looks like a layout bug in the consumer's page rather than a missing
 * inset in ours. Every consumer hits it, and every one of them solves it by
 * measuring the bar in devtools and typing that number into their own CSS,
 * where it stops tracking the size mode the moment anything changes.
 *
 * So the add-on works it out and ships it. The inset is a consequence of the
 * arrangement the designer chose — which edges carry a pinned bar — and the
 * arrangement is in the definition, so nothing here is a guess.
 *
 * ── Tokens, not pixels ────────────────────────────────────────────────────
 * Each edge resolves to a variable, so the inset follows the size mode the
 * same way the bar does. A number would be correct at medium and wrong at the
 * other two, and wrong quietly: the page would simply sit 8px under the bar.
 */
import type { ComponentDefinition, NodeDef } from './defineComponent';

export type Edge = 'top' | 'bottom' | 'left' | 'right';

/** The token each edge's inset reads, keyed by the bar that occupies it. */
export const EDGE_TOKEN: Record<Edge, string> = {
  top: '--App-Bar-Height',
  bottom: '--Nav-Bar-Height',
  left: '--Rail-Width',
  right: '--Rail-Width',
};

/** Fallbacks are the DESIGN's numbers at medium, the same rule the component
 *  metrics follow: an unbound token then insets by the intended amount rather
 *  than by an invented one. */
export const EDGE_FALLBACK: Record<Edge, number> = {
  top: 64,
  bottom: 83,
  left: 80,
  right: 80,
};

export interface ContentInsets {
  /** Edge → the CSS value to inset by. Absent means the bar on that edge is
   *  in the flow and takes its own space, so the page needs nothing. */
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}

/** Which edge a node occupies, from the name the definitions actually emit.
 *
 *  By NAME rather than by position, because position is ambiguous: the rail
 *  is the first child when it runs beside the bar and the second when it
 *  hangs below one, and both are still the left edge. */
function edgeOf(node: NodeDef): Edge | null {
  switch (node.name) {
    case 'Bar': return 'top';
    case 'Bottom-Bar': return 'bottom';
    case 'Rail': return 'left';
    case 'Toolbar':
      /* A vertical toolbar is a rail on the right; a horizontal one is a
         second bottom bar. The direction is on the node, so this does not
         have to be told. */
      return node.direction === 'column' ? 'right' : 'bottom';
    default: return null;
  }
}

/**
 * The insets a page needs to clear this nav.
 *
 * Only PINNED bars count. A bar in the flow already occupies its own space —
 * insetting for it too would push the page down by twice the bar's height,
 * which is the mistake that makes people distrust the number and hardcode
 * their own.
 */
export function contentInsets(def: ComponentDefinition): ContentInsets {
  const out: ContentInsets = {};

  const walk = (node: NodeDef) => {
    const edge = edgeOf(node);
    /* `sticky` is the definition's word for "leaves the flow when it has to".
       A rail is not marked sticky and does not need to be: it runs the full
       height beside the content rather than over it, so the page is already
       clear of it and an inset would double the gap. */
    if (edge && node.sticky && !out[edge]) {
      out[edge] = `var(${EDGE_TOKEN[edge]}, ${EDGE_FALLBACK[edge]}px)`;
    }
    (node.children || []).forEach(walk);
  };
  walk(def.root);
  return out;
}

/** The same thing as CSS a consumer can paste.
 *
 *  Emitted as padding on the PAGE rather than a margin on the nav: a margin
 *  would move the bar, and the bar is where it is meant to be — it is the
 *  content that has to start lower. */
export function contentInsetCSS(insets: ContentInsets, selector = '.page'): string | null {
  const lines = (['top', 'bottom', 'left', 'right'] as Edge[])
    .filter((e) => insets[e])
    .map((e) => `  padding-${e}: ${insets[e]};`);
  if (!lines.length) return null;
  return [`${selector} {`, ...lines, '}'].join('\n');
}
