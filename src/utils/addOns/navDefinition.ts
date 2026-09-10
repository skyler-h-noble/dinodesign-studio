/**
 * The adaptive nav, as a ComponentDefinition.
 *
 * Three desktop layouts, and they are NOT three components. All three are a
 * top bar with a start / centre / end slot plus an optional rail; what differs
 * is which slot holds the brand and whether the rail exists. Building them as
 * separate definitions would triple the surface for one axis of difference and
 * let the shared parts drift.
 *
 * ── What is a variant and what is a mode ──────────────────────────────────
 * The distinction decides the whole structure, so it is worth stating:
 *
 *   layout   a designer PICKS it → a variant. Nothing about the device
 *            implies whether the brand sits left or centred.
 *   device   the viewport IMPLIES it → a mode. Which parts exist at which
 *            width is not a choice made per instance.
 *
 * So the layout produces one definition per pick, while the responsive axis
 * lives inside each as boolean-driven visibility. That is why a nav with three
 * breakpoints is still one Figma component rather than nine variants.
 *
 * ── Sticky has no Figma equivalent ────────────────────────────────────────
 * Figma has no scroll behaviour, so `sticky` cannot appear in the node tree at
 * all. It is carried on the definition for the React compiler and deliberately
 * ignored by toAddonSpec — a flag that means nothing on one target is better
 * than a fake frame that pretends to mean something.
 */
import { t, type ComponentDefinition, type ConditionDef, type NodeDef, type TokenRef } from './defineComponent';

export type NavLayout = 'brand-left' | 'brand-centre' | 'rail' | 'hero';

export interface NavOptions {
  layout: NavLayout;
  /** Right-hand slot contents. Each is a slot the consumer fills. */
  search?: boolean;
  actions?: boolean;
  avatar?: boolean;
  /** Where the bar sits relative to the rail. Only meaningful for 'rail'. */
  barPosition?: 'above-rail' | 'beside-rail';
  /** Where the page title sits in the bar. Only meaningful for 'rail'. */
  titleAlign?: 'left' | 'center';
  /** Palette and surface level the nav paints on. Names, never colours — the
   *  same definition lands in each design system's own brand. */
  theme?: string;
  surface?: string;
  /** Hero only: brand and actions animate into the strip once it sticks. */
  condensed?: boolean;
}

/** Palettes a nav can resolve against — the Theme collection's modes.
 *
 *  Default first because it is the collection's default mode: a nav that sets
 *  no theme inherits whatever the page is, which is usually what you want and
 *  is why it is not simply Primary. */
export const NAV_THEMES = [
  'Default', 'Primary', 'Secondary', 'Tertiary', 'Neutral',
  'Info', 'Success', 'Warning', 'Error',
] as const;

/** Surface levels, dimmest to brightest. Names, not colours: what each paints
 *  depends on the theme, which is the point. */
export const NAV_SURFACES = [
  'Surface-Dimmest', 'Surface-Dim', 'Surface', 'Surface-Bright', 'Surface-Brightest',
] as const;

export const NAV_LAYOUTS: { id: NavLayout; label: string; description: string }[] = [
  /* Every name says sticky, because every one of them is: a top nav that
     scrolls away is not a variation on a top nav, it is a header. Naming it
     is what stops someone looking for the option that used to be here. */
  { id: 'brand-left',   label: 'Sticky bar, brand left',    description: 'Brand, then tabs, then actions on the right.' },
  { id: 'brand-centre', label: 'Sticky bar, brand centred', description: 'Tabs or a menu button on the left, brand centred, actions right.' },
  { id: 'rail',         label: 'Sticky bar + rail',         description: 'Navigation in a rail down the side. The bar sits above it or beside it.' },
  { id: 'hero',         label: 'Hero + sticky tabs',        description: 'A hero area with the tab strip beneath it, which sticks once it reaches the top.' },
];

/** Every boolean the nav reads, with what each means.
 *
 *  Declared in one place so both compilers agree on the set and a breakpoint
 *  cannot be invented by a typo in a `when` — a layer bound to a variable that
 *  does not exist never shows and never errors. */
export const NAV_CONDITIONS: Record<string, ConditionDef> = {
  'Adaptive-Nav/Show-Rail': {
    description: 'The side rail. Off below the width where a rail costs more than it gives.',
    trigger: 'device',
  },
  'Adaptive-Nav/Show-Tabs': {
    description: 'Inline tabs. Off once they no longer fit, which is what the menu button replaces.',
    trigger: 'device',
  },
  'Adaptive-Nav/Show-Menu-Button': {
    description: 'The menu button that opens navigation as a drawer. The counterpart of Show-Tabs.',
    trigger: 'device',
  },
  'Adaptive-Nav/Show-Search': {
    description: 'Search in the bar. Off when it collapses to an icon.',
    trigger: 'device',
  },
  /* SCROLL, not width — and that is the whole reason the trigger is recorded.
     No media query can detect it, so a compiler that treated this like the
     others would emit a breakpoint for a state a breakpoint cannot see. In
     Figma it is a mode a designer flips by hand to view the condensed state. */
  'Adaptive-Nav/Show-Condensed': {
    description:
      'Brand and actions in the sticky strip, once the hero has scrolled past. '
      + 'Driven by scroll position, not viewport width.',
    trigger: 'scroll',
  },
};

/**
 * Conditions where exactly one of the set is true.
 *
 * Tabs and the menu button are one decision expressed as two booleans. Both on
 * shows two navigations; both off shows none — and neither state fails, they
 * just look wrong in a way that is easy to create and hard to notice.
 *
 * Declared rather than left to the UI so the rule travels with the definition:
 * a design system setting these variables by hand, or a second editor, has the
 * same constraint available. Two booleans rather than one because Figma binds
 * `visible` to a boolean and cannot invert one, so each layer needs its own.
 */
export const NAV_EXCLUSIVE: string[][] = [
  ['Adaptive-Nav/Show-Tabs', 'Adaptive-Nav/Show-Menu-Button'],
];

/** Apply the exclusivity rules to one change.
 *
 *  Turning a member ON turns its partners off. Turning the last one OFF is
 *  refused rather than allowed to produce a nav with no navigation in it —
 *  the caller gets the row back unchanged. */
export function applyExclusivity(
  row: Record<string, boolean>,
  changed: string,
  value: boolean,
): Record<string, boolean> {
  const group = NAV_EXCLUSIVE.find((g) => g.includes(changed));
  if (!group) return { ...row, [changed]: value };

  if (value) {
    const out = { ...row, [changed]: true };
    for (const other of group) if (other !== changed) out[other] = false;
    return out;
  }
  // Turning this one off leaves the group empty unless another is already on.
  const anotherOn = group.some((n) => n !== changed && row[n]);
  return anotherOn ? { ...row, [changed]: false } : row;
}

const slot = (name: string, width: NodeDef['width'], when?: string): NodeDef => ({
  name,
  kind: 'slot',
  width,
  height: 'hug',
  ...(when ? { presence: { when } } : {}),
});

const GAP: TokenRef = t('Sizing-2');
const PAD_Y: TokenRef = t('Sizing-2');
const PAD_X: TokenRef = t('Sizing-3');

/** The end slot is the same in all three layouts — only its contents vary. */
function endSlot(o: NavOptions): NodeDef {
  const children: NodeDef[] = [];
  if (o.search) children.push(slot('Search', 'hug', 'Adaptive-Nav/Show-Search'));
  if (o.actions) children.push(slot('Actions', 'hug'));
  if (o.avatar) children.push(slot('Avatar', 'hug'));
  return {
    name: 'End',
    kind: 'stack',
    direction: 'row',
    align: 'center',
    gap: GAP,
    width: 'hug',
    height: 'hug',
    children,
  };
}

/** Tabs and the menu button are one decision expressed twice: exactly one is
 *  visible at any width, so they are mutually exclusive conditions rather than
 *  a single boolean, which is what lets a designer see both states. */
function navigationSlots(): NodeDef[] {
  return [
    slot('Tabs', 'hug', 'Adaptive-Nav/Show-Tabs'),
    slot('Menu-Button', 'hug', 'Adaptive-Nav/Show-Menu-Button'),
  ];
}

function bar(o: NavOptions): NodeDef {
  const brand = slot('Brand', 'hug');
  let children: NodeDef[];

  if (o.layout === 'brand-centre') {
    /* Centred means centred in the BAR, which needs the two side groups to
       claim equal space — not the brand centred in whatever is left over.
       
       Filling the middle and centring inside it is the obvious arrangement and
       it is wrong: the tabs and the actions are different widths, so the
       leftover region is off-centre and the brand lands wherever it happens to
       fall. Two FILL sides with a HUG middle is what actually centres it,
       because equal flex gives both sides the same width whatever they hold.
       
       Same instruction on both targets: Figma distributes remaining space
       equally between FILL children, CSS gives equal flex-basis. */
    children = [
      { name: 'Start', kind: 'stack', direction: 'row', justify: 'start', align: 'center', gap: GAP,
        width: 'fill', height: 'hug', children: navigationSlots() },
      { name: 'Center', kind: 'stack', direction: 'row', justify: 'center', align: 'center',
        width: 'hug', height: 'hug', children: [brand] },
      { ...endSlot(o), width: 'fill', justify: 'end' },
    ];
  } else if (o.layout === 'hero') {
    /* No brand in the bar: it belongs to the hero slot above, and repeating it
       here would show it twice until the bar sticks — and then show it twice
       anyway, because nothing removes the hero's copy on scroll. Navigation
       leads instead. */
    /* Condensed adds the brand and actions BEHIND a scroll condition rather
       than unconditionally. Unconditional, they would show while the hero is
       still on screen — duplicating what the hero already shows — which is the
       reason the plain hero bar carries no brand at all. */
    /* TABS ONLY. The brand belongs to the hero and the actions sit OVER the
       hero image, so the strip under a hero is navigation and nothing else.
       
       Condensed is what brings the actions down here, once the hero has
       scrolled past and its overlay has gone with it. Without condensed there
       is no End slot at all — an empty one would still take part in the
       SPACE_BETWEEN and push the tabs off centre. */
    const start: NodeDef[] = [];
    if (o.condensed) start.push(slot('Condensed-Brand', 'hug', 'Adaptive-Nav/Show-Condensed'));
    start.push(...navigationSlots());
    children = [
      { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
        width: 'fill', height: 'hug', children: start },
    ];
    if (o.condensed) {
      children.push({ ...endSlot(o), presence: { when: 'Adaptive-Nav/Show-Condensed' } });
    }
  } else if (o.layout === 'rail') {
    /* Navigation lives in the rail, so the bar carries no tabs — its middle is
       the page TITLE, the way an application bar works.
       
       Centred needs the same geometry as brand-centre and for the same reason:
       the brand and the actions are different widths, so a title centred in
       what is left over is not centred in the bar. Two FILL sides with a HUG
       title is what actually centres it.
       
       Left-aligned is the simpler case — the title just fills after the brand,
       and no equal-width trick is needed because nothing is being balanced. */
    /* No brand in the bar when the rail is full height — it is at the top of
       the rail instead, which is the corner it occupies. */
    const brandInBar = o.barPosition === 'above-rail';
    const centred = o.titleAlign === 'center';
    children = centred
      ? [
          { name: 'Start', kind: 'stack', direction: 'row', justify: 'start', align: 'center', gap: GAP,
            width: 'fill', height: 'hug', children: brandInBar ? [brand] : [] },
          { name: 'Title', kind: 'stack', direction: 'row', justify: 'center', align: 'center',
            width: 'hug', height: 'hug', children: [slot('Title', 'hug')] },
          { ...endSlot(o), width: 'fill', justify: 'end' },
        ]
      : brandInBar
        ? [
            { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
              width: 'hug', height: 'hug', children: [brand] },
            slot('Title', 'fill'),
            endSlot(o),
          ]
        : [slot('Title', 'fill'), endSlot(o)];
  } else {
    children = [
      { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
        width: 'hug', height: 'hug', children: [brand] },
      { name: 'Center', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
        width: 'fill', height: 'hug', children: navigationSlots() },
      endSlot(o),
    ];
  }

  return {
    name: 'Bar',
    kind: 'stack',
    direction: 'row',
    justify: 'between',
    align: 'center',
    gap: GAP,
    padding: { top: PAD_Y, bottom: PAD_Y, left: PAD_X, right: PAD_X },
    width: 'fill',
    height: 'hug',
    children,
  };
}

/**
 * Hero, with the tab strip beneath it.
 *
 * The hero itself is a SLOT — it is a separate add-on, and duplicating its
 * structure here would be a second definition of the same thing to keep in
 * step.
 *
 * Stickiness sits on the Bar rather than the component. In the other three
 * layouts the whole nav sticks or does not; here the hero scrolls away and
 * only the tabs stay, so a component-level flag could not express which part
 * remains — and applied to the root it would pin the hero to the viewport,
 * which is the opposite of the pattern.
 */
function heroRoot(o: NavOptions): NodeDef {
  return {
    name: 'Adaptive Nav',
    kind: 'stack',
    direction: 'column',
    width: 'fill',
    height: 'hug',
    surface: o.surface ?? 'Surface',
    theme: o.theme,
    children: [
      {
        /* The hero and what floats on it. A wrapper rather than putting the
           overlay beside the slot, because an overlay anchors to its PARENT —
           on the root it would pin to the whole nav and hang over the tab
           strip too. */
        name: 'Hero-Area',
        kind: 'stack',
        direction: 'column',
        width: 'fill',
        height: 'hug',
        children: [
          slot('Hero', 'fill'),
          /* Over the image, top-right. Hidden once condensed, because the same
             actions reappear in the sticky strip and showing both would be the
             duplicate this layout is arranged to avoid. */
          {
            ...endSlot(o),
            name: 'Hero-Actions',
            overlay: { anchor: 'top-right' as const },
            ...(o.condensed ? { presence: { when: 'Adaptive-Nav/Hide-When-Condensed' } as const } : {}),
          },
        ],
      },
      {
        ...bar(o),
        // Intrinsic to the pattern, not optional: tabs that do not stick are
        // simply tabs under a hero.
        sticky: true,
      },
    ],
  };
}

/* The bar is ALWAYS sticky.
 *
 * It was an option, and it should not have been: a top nav that scrolls away
 * is not a variation on a top nav, it is a header. Every layout here is a
 * navigation that stays reachable, so the flag was a control that could only
 * ever be turned to the wrong answer.
 *
 * Sticky sits on the BAR rather than the root in all four, and in the rail
 * layout that distinction earns its keep: a full-height rail is already in
 * view and does not stick, while the bar beside it does. */
function railNode(fullHeight: boolean): NodeDef {
  return {
    name: 'Rail',
    kind: 'stack',
    direction: 'column',
    align: 'start',
    gap: GAP,
    width: 'hug',
    /* Full height only when it runs beside the bar. Below a full-width bar it
       fills what is left, which is the same instruction from the row's point
       of view — but expressed on the wrong axis it would stretch the rail
       across the page instead. */
    height: fullHeight ? 'fill' : 'fill',
    /* One step dimmer than the bar, so the rail reads as a distinct region
       without naming a second colour. Relative to whatever the nav is set to,
       which is why it is a level rather than a fixed surface. */
    surface: 'Surface-Dim',
    padding: { top: PAD_Y, bottom: PAD_Y, left: PAD_X, right: PAD_X },
    presence: { when: 'Adaptive-Nav/Show-Rail' },
    /* The brand belongs to whichever element reaches the top-left corner. A
       full-height rail does, so it carries the brand and the bar beside it
       starts with the title. Under a full-width bar the rail does not, and the
       brand stays in the bar. Putting it in both would show it twice; putting
       it in the bar while the rail runs past it leaves the corner empty. */
    children: fullHeight
      ? [slot('Brand', 'hug'), slot('Rail-Items', 'hug')]
      : [slot('Rail-Items', 'hug')],
  };
}

function railChildren(o: NavOptions): NodeDef[] {
  const stickyBar = { ...bar(o), sticky: true };
  /* Above: the bar spans the whole width and the rail starts beneath it, so
     the bar's brand and actions clear the rail. Beside: the rail runs the full
     height and the bar occupies only the column to its right, which is what
     puts the brand above the content rather than above the rail.
     
     A sibling either way — nesting the rail under the bar would tie its height
     to the bar's, and it would stop being a rail. */
  return o.barPosition === 'above-rail'
    ? [stickyBar, railNode(false)]
    : [railNode(true), stickyBar];
}

export function navDefinition(o: NavOptions): ComponentDefinition {
  if (o.layout === 'hero') {
    return {
      id: 'adaptive-nav',
      label: 'Adaptive Nav',
      schemaVersion: 1,
      conditions: NAV_CONDITIONS,
      root: heroRoot(o),
    };
  }

  const root: NodeDef = {
    name: 'Adaptive Nav',
    kind: 'stack',
    /* Beside: the rail runs the full height, so the root is a row and the bar
       sits to its right. Above: the bar spans the full width and the rail
       hangs below it, so the root is a column. */
    direction: o.layout === 'rail' && o.barPosition !== 'above-rail' ? 'row' : 'column',
    width: 'fill',
    height: 'hug',
    surface: o.surface ?? 'Surface',
    theme: o.theme,
    children: o.layout === 'rail'
      ? railChildren(o)
      : [{ ...bar(o), sticky: true }],
  };

  return {
    id: 'adaptive-nav',
    label: 'Adaptive Nav',
    schemaVersion: 1,
    conditions: NAV_CONDITIONS,
    root,
  };
}

/**
 * A sensible starting matrix: which conditions are true at which breakpoint.
 *
 * Not arbitrary defaults — this encodes the design intent the layouts are
 * built around, so a new definition opens on something coherent rather than
 * everything-on, which is a state no real nav is ever in.
 *
 *   tabs / menu button   mutually exclusive, and the narrowest breakpoint is
 *                        where tabs stop fitting. Setting both true would show
 *                        two navigations at once; both false would show none.
 *   rail                 only where there is width to spare for it.
 *   search               collapses to an icon at the narrowest width, which is
 *                        the consumer's job — here it simply leaves the bar.
 *   scroll conditions    false everywhere. They are not width-driven at all,
 *                        and seeding them true would show a condensed state
 *                        that only exists after scrolling.
 */
export function defaultNavMatrix(
  conditionNames: string[],
  breakpoints: { id: string; minWidth: number }[],
): Record<string, Record<string, boolean>> {
  const sorted = [...breakpoints].sort((a, b) => a.minWidth - b.minWidth);
  const narrowest = sorted[0]?.id;
  const widest = sorted[sorted.length - 1]?.id;

  const out: Record<string, Record<string, boolean>> = {};
  for (const name of conditionNames) {
    const def = NAV_CONDITIONS[name];
    out[name] = {};
    for (const bp of sorted) {
      out[name][bp.id] =
        def?.trigger === 'scroll' ? false
        : name === 'Adaptive-Nav/Show-Menu-Button' ? bp.id === narrowest
        : name === 'Adaptive-Nav/Show-Tabs' ? bp.id !== narrowest
        : name === 'Adaptive-Nav/Show-Rail' ? bp.id === widest
        : name === 'Adaptive-Nav/Show-Search' ? bp.id !== narrowest
        : true;
    }
  }
  return out;
}
