/**
 * A component definition both targets compile FROM.
 *
 * ── Why a third artifact ───────────────────────────────────────────────────
 * The obvious move is "generate the Figma component from the React one", and
 * it does not work: React renders to DOM, Figma needs frames with auto-layout,
 * and there is no faithful mechanical translation between them. Going the
 * other way — generate React from the Figma node tree — loses the behaviour,
 * which is most of what a component IS.
 *
 * So neither side is derived from the other. This definition is the source and
 * both are outputs:
 *
 *     definition ──→ AddonSpec  ──→ plugin builds the Figma component
 *                └─→ JSX + CSS  ──→ the library component
 *
 * Drift is the specific thing this prevents. A Figma component and a React
 * component that merely LOOK alike diverge on the first change, and nothing
 * reports it — the same failure mode as every silent bug in this codebase.
 *
 * ── What a definition may NOT contain ──────────────────────────────────────
 * No colours, no pixel sizes, no font names. Only token NAMES. A literal here
 * would ship the author's brand to every customer who imports the add-on, and
 * that is invisible until someone opens it in a different palette. The type
 * enforces it: there is nowhere to put a hex.
 *
 * Behaviour is also absent, deliberately. Focus management, keyboard nav and
 * state machines cannot be expressed as a node tree, so React owns them and
 * the definition describes only what both targets share: structure, tokens,
 * and which parts exist when.
 */

/** A token reference. The name is resolved per target — a Figma variable of
 *  that name, or the CSS custom property it maps to. */
export interface TokenRef { token: string }

export const t = (token: string): TokenRef => ({ token });

/* NAMES ARE COLLECTION-RELATIVE. The plugin indexes local variables by
   `v.name`, which is the path WITHIN a collection — the collection name is not
   part of it. So the Sizing collection's Sizing-2 is 'Sizing-2', not
   'Sizing/Sizing-2'; a group inside a collection does count, which is why the
   Theme collection's Surface group gives 'Surface/Background'.

   Getting this wrong binds nothing and paints Figma's defaults, which reads as
   a design decision rather than a failure. */

/** Sizing follows the target's own layout system rather than a measurement.
 *  `hug` and `fill` are the whole reason a component can adapt; a fixed px
 *  would pin it, which is exactly what must not happen to a nav. */
export type Sizing = 'hug' | 'fill' | { fixed: TokenRef };

/** A part exists either always, or when a boolean token says so.
 *
 *  `when` is what makes one component responsive instead of three variants:
 *  in Figma it binds the layer's `visible` to that boolean; in CSS it becomes
 *  the breakpoint the boolean stands for. */
export type Presence = 'always' | { when: string };

export interface NodeDef {
  /** Layer name in Figma, and the basis of the class name in CSS. */
  name: string;
  /** `stack` is a frame with auto-layout; `slot` is a named hole the consumer
   *  fills — children in React, an empty frame in Figma for a designer to
   *  drop into. `text` carries copy. */
  kind: 'stack' | 'slot' | 'text';
  direction?: 'row' | 'column';
  /** Distribution along the main axis. `between` is what puts brand left and
   *  actions right without a spacer element. */
  justify?: 'start' | 'center' | 'end' | 'between';
  align?: 'start' | 'center' | 'end';
  gap?: TokenRef;
  padding?: { top?: TokenRef; right?: TokenRef; bottom?: TokenRef; left?: TokenRef };
  width?: Sizing;
  height?: Sizing;
  radius?: TokenRef;
  /** A hairline outline, named by the token its COLOUR comes from.
   *
   *  The colour is a token because it has to be — a literal would ship this
   *  library's border to everyone. The WEIGHT is not in the definition at all:
   *  a hairline is one pixel on both targets, the way the 4px under a dropdown
   *  is, and putting a number here would be the first pixel in a format whose
   *  whole point is that there is nowhere to put one.
   *
   *  It exists because a floating panel needs an edge and a surface level
   *  cannot always give it one: a menu at Surface-Brightest over a page that
   *  is already Surface-Brightest has no visible boundary, and the panel reads
   *  as text lying loose on the page. */
  border?: TokenRef;
  /** Surface level, NOT a colour. In Figma this is the variable group the
   *  fill comes from; in CSS it is a data-surface attribute and the fill is
   *  var(--Background). The level lives in different places on each target,
   *  which is why it cannot be stored as a paint. */
  surface?: string;
  /** Palette this subtree resolves against.
   *
   *  Travels differently from `surface` on each target, which is the reason
   *  both are stored as names rather than as a colour: in Figma a theme is a
   *  MODE of the Theme collection, so it becomes an explicit mode pin, while
   *  the surface is part of the variable's own path. In the DOM both are
   *  attributes — data-theme and data-surface — and the pair is what exposes
   *  the whole matched token set rather than one colour. */
  theme?: string;
  presence?: Presence;
  /** A full-bleed band: paints edge to edge, but its CONTENT respects the
   *  page's content ceiling.
   *
   *  The distinction is the whole point of a capped breakpoint. Capping the
   *  bar itself leaves bare page either side of a floating coloured strip;
   *  capping only what is inside it gives an unbroken band with the content
   *  aligned to everything else on the page. The second is what every capped
   *  layout means and the first is never what anyone wants. */
  band?: boolean;
  /** Sticks to the top of the scroll container once it reaches it.
   *
   *  A property of THIS node, not of the component. In a hero layout the hero
   *  scrolls away and only the tab strip sticks, so a component-level flag
   *  could not say which part stays — and getting that wrong pins the hero to
   *  the viewport, which is the opposite of the pattern.
   *
   *  React-only: Figma has no scroll behaviour, so toAddonSpec drops it. A
   *  flag that means nothing on one target is better than a frame pretending
   *  to mean something. */
  sticky?: boolean;
  /** Sits OVER its parent rather than in the flow beside its siblings.
   *
   *  Both targets can express it — Figma as layoutPositioning ABSOLUTE with
   *  constraints, CSS as position:absolute against a relative parent — but
   *  neither infers it, so it has to be said. Without it, content meant to
   *  float over a hero image would push the hero down instead. */
  overlay?: {
    anchor: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    /** Hangs BELOW the parent rather than sitting inside it.
     *
     *  A dropdown panel is anchored to the bottom edge of the control it opens
     *  from, and that is not one of the four corners — every corner puts the
     *  panel ON the thing it drops from. The horizontal half of `anchor` still
     *  decides which side it lines up with, which is the whole difference
     *  between a menu under an avatar at the right of a bar and one that runs
     *  off the edge of the page.
     *
     *  It also means the panel leaves its parent's box, so both targets have
     *  to stop clipping: CSS by not hiding overflow, Figma by clearing
     *  clipsContent on every frame between here and the root. A clipped panel
     *  is invisible with nothing to say why. */
    drop?: boolean;
  };
  text?: string;
  children?: NodeDef[];
}

/** What makes a condition true.
 *
 *  Not decoration — the two compile to different machinery and neither can
 *  stand in for the other:
 *
 *    device  the viewport implies it → a media query in CSS, a Device-Sizes
 *            mode in Figma. Known before anything renders.
 *    scroll  the page position implies it → a scroll or intersection listener
 *            in React, and in Figma only a mode a designer flips by hand to
 *            see the state. There is no CSS that expresses it.
 *    interaction  a person opened it → React state, and in Figma a mode a
 *            designer flips by hand. Like scroll in that no width makes it
 *            true, but distinct from it: scroll is ambient and reverses on its
 *            own, while this one has been ASKED for and stays until dismissed.
 *            Collapsing the two would have a scroll listener drive a menu.
 *
 *  Recording the trigger keeps the React compiler from emitting a breakpoint
 *  for something a breakpoint cannot detect. Only `device` is width-driven, so
 *  that is the test to write — not `!== 'scroll'`, which quietly admits every
 *  trigger added after it. */
export type ConditionTrigger = 'device' | 'scroll' | 'interaction';

export interface ConditionDef {
  description: string;
  trigger: ConditionTrigger;
}

export interface ComponentDefinition {
  /** Stable id — the add-on id, never changes once shipped. */
  id: string;
  label: string;
  schemaVersion: 1;
  /** Booleans the component reads. Declared up front so both compilers agree
   *  on the set, and so a breakpoint cannot be invented by a typo in a
   *  `when` — a layer bound to a variable that does not exist never shows and
   *  never errors. */
  conditions?: Record<string, ConditionDef>;
  root: NodeDef;
}

/* ── A first definition: the three-slot bar ────────────────────────────────
 *
 * Deliberately the nav's skeleton with the responsive axis left out. It
 * exercises the parts that are load-bearing — slots, token-only styling, a
 * conditional part, fill/hug sizing — without the complexity that would make
 * a first round trip hard to debug.
 */
export const slotBar: ComponentDefinition = {
  id: 'slot-bar',
  label: 'Slot Bar',
  schemaVersion: 1,
  conditions: {
    /* Grouped, because a bare 'Show-Divider' is too generic for a namespace
       shared by every add-on. The collection name is not part of a variable's
       name, so this resolves as Add-Ons → Adaptive-Nav/Show-Divider — group
       included, collection excluded, the same shape as Surface/Background. */
    'Adaptive-Nav/Show-Divider': {
      description: 'Hairline under the bar. Off when the bar sits on its own surface.',
      trigger: 'device',
    },
  },
  root: {
    name: 'Slot Bar',
    kind: 'stack',
    direction: 'column',
    width: 'fill',
    height: 'hug',
    surface: 'Surface',
    children: [
      {
        name: 'Bar',
        kind: 'stack',
        direction: 'row',
        justify: 'between',
        align: 'center',
        gap: t('Sizing-2'),
        padding: {
          top: t('Sizing-2'), bottom: t('Sizing-2'),
          left: t('Sizing-3'), right: t('Sizing-3'),
        },
        width: 'fill',
        height: 'hug',
        children: [
          { name: 'Start', kind: 'slot', width: 'hug', height: 'hug' },
          { name: 'Center', kind: 'slot', width: 'fill', height: 'hug' },
          { name: 'End', kind: 'slot', width: 'hug', height: 'hug' },
        ],
      },
      {
        name: 'Divider',
        kind: 'stack',
        direction: 'row',
        width: 'fill',
        height: { fixed: t('Sizing-Quarter') },
        surface: 'Surface-Dim',
        presence: { when: 'Adaptive-Nav/Show-Divider' },
      },
    ],
  },
};
