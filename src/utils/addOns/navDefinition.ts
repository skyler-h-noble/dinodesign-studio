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
import { accountNode, ACCOUNT_MENU_CONDITIONS } from './accountMenu';

export type NavLayout = 'brand-left' | 'brand-centre' | 'rail' | 'hero';

export interface NavOptions {
  layout: NavLayout;
  /** Right-hand slot contents. Each is a slot the consumer fills. */
  search?: boolean;
  actions?: boolean;
  avatar?: boolean;
  /** Whether the avatar OPENS something.
   *
   *  An avatar in the top right is almost never decoration — it is the account
   *  menu's trigger — but "almost never" is not never, so it stays a choice
   *  rather than becoming the only shape on offer. */
  avatarMenu?: boolean;
  /** Whether the bar sticks. Only a CHOICE in the two plain bar layouts —
   *  see stickyBar below. Defaults to true. */
  sticky?: boolean;
  /** Where the bar sits relative to the rail. Only meaningful for 'rail'. */
  barPosition?: 'above-rail' | 'beside-rail';
  /** Where the page title sits in the bar. Only meaningful for 'rail'. */
  titleAlign?: 'left' | 'center';
  /** Rail only: the rail can widen into a labelled drawer.
   *
   *  A CAPABILITY, not a state. The rail ships collapsed and the toggle is
   *  the user's; what this decides is whether the toggle exists at all,
   *  which is a design decision about the product rather than about the
   *  moment. */
  railExpandable?: boolean;
  /** Palette and surface level the nav paints on. Names, never colours — the
   *  same definition lands in each design system's own brand. */
  theme?: string;
  surface?: string;
  /** Hero only: brand and actions animate into the strip once it sticks. */
  condensed?: boolean;
  /** Hero only: where the tab strip sits under the hero.
   *
   *  A real choice, not a default with an escape hatch. Left keeps the tabs
   *  on the page's own text edge, which is what a content site wants; centred
   *  balances them under a full-bleed image, which is what a marketing hero
   *  wants. Neither is right for both. */
  heroTabsAlign?: 'left' | 'center';
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
  /* No "sticky" in these two names: it is a choice here, and a name that
     states one setting of a switch is wrong half the time. The other two keep
     it, because there it is not a choice. */
  { id: 'brand-left',   label: 'Brand left',    description: 'Brand, then tabs, then actions on the right.' },
  { id: 'brand-centre', label: 'Brand centred', description: 'Tabs or a menu button on the left, brand centred, actions right.' },
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
  /* Actions and the avatar are conditions too, not structural options.
     
     They were global switches beside per-breakpoint ones, which invented a
     distinction a user has no reason to hold: "does the avatar exist" and
     "does the avatar show at this width" are the same question asked twice.
     A slot that is off at EVERY breakpoint is simply omitted, which is
     derivable rather than a second control. */
  'Adaptive-Nav/Show-Actions': {
    description: 'Action buttons in the bar. Off where the width cannot hold them.',
    trigger: 'device',
  },
  'Adaptive-Nav/Show-Avatar': {
    description: 'The account avatar.',
    trigger: 'device',
  },
  /* Open or closed, and it is NOT a width. Declared here alongside the rest so
     both compilers see one set, and defined next to the panel it gates so the
     two cannot be changed apart. */
  ...ACCOUNT_MENU_CONDITIONS,
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

/**
 * The page the nav sits against.
 *
 * A slot rather than a fixed height, because it is not the nav's — the page
 * owns it. Emitting it as a FILLING slot says exactly that: the nav reserves
 * the space and something else puts content in it.
 *
 * It was missing from every desktop layout, and its absence was invisible
 * because the nav still rendered: a bar on its own looks fine until you ask
 * where the content goes, and then there is nowhere for the sticky bar to
 * stick OVER and no way to see that it needs an inset at all.
 */
export const pageSlot = (): NodeDef => ({
  name: 'Page',
  kind: 'slot',
  width: 'fill',
  height: 'fill',
});

const slot = (name: string, width: NodeDef['width'], when?: string): NodeDef => ({
  name,
  kind: 'slot',
  width,
  height: 'hug',
  ...(when ? { presence: { when } } : {}),
});

/** The level the design system's Component-Elevations gives an app bar.
 *
 *  2 — the "AppBar, Toolbars, Menus" group's base. Taken from the collection
 *  rather than picked: a bar that invents its own shadow stops agreeing with
 *  every other bar in the system the moment the brand's shadow controls move.
 *
 *  Note the LIB's AppBar draws level 1, so the two disagree. The design system
 *  is the authority here, and the lib is worth a look. */
export const APP_BAR_ELEVATION = 2;

/**
 * The brand's rectangle, and it is the SAME rectangle in both arrangements.
 *
 * Rail-Width across, App-Bar Height down, at the top-left corner — the
 * intersection of the rail's column and the bar's row. Which component happens
 * to contain it changes with barPosition; where it lands on screen does not.
 *
 * That was the bug: above the rail the brand sat in the bar's Start group,
 * which hugs, so it landed at the bar's left padding and the rail beneath it
 * started somewhere else entirely. Beside the rail it was already right. A
 * brand that moves when you change where the bar sits reads as two different
 * logos rather than one in two layouts.
 *
 * `inRail` decides which axis is fixed and which fills, because the container
 * already constrains the other one: the rail is Rail-Width wide, so the block
 * fills it and fixes its height; the bar is App-Bar Height tall, so the block
 * fills it and fixes its width.
 */
function brandBlock(inRail: boolean): NodeDef {
  return {
    name: 'Brand-Block',
    kind: 'stack',
    direction: 'row',
    justify: 'center',
    align: 'center',
    width: inRail ? 'fill' : { fixed: t('Other/Rail-Width') },
    height: inRail ? { fixed: t('Other/App-Bar Height') } : 'fill',
    /* Only in the rail. In the bar the rule IS the bar's own bottom edge, and
       a second one inside it would draw the same line twice. */
    ...(inRail ? { borderBottom: t('Border-Variant') } : {}),
    children: [slot('Brand', 'hug')],
  };
}

const GAP: TokenRef = t('Sizing-2');
const PAD_Y: TokenRef = t('Sizing-2');
const PAD_X: TokenRef = t('Sizing-3');

/** The end slot is the same in all three layouts — only its contents vary. */
function endSlot(o: NavOptions): NodeDef {
  const children: NodeDef[] = [];
  if (o.search) children.push(slot('Search', 'hug', 'Adaptive-Nav/Show-Search'));
  if (o.actions) children.push(slot('Actions', 'hug', 'Adaptive-Nav/Show-Actions'));
  /* The avatar, or the avatar and the panel it opens. One builder for both
     ends of that choice, shared with the mobile bar, because the menu under a
     mobile avatar is the same panel and two copies would agree only until the
     first change. */
  if (o.avatar) {
    children.push(accountNode({
      withMenu: o.avatarMenu,
      when: 'Adaptive-Nav/Show-Avatar',
    }));
  }
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
/** Inline navigation. Just the tabs — the menu button that replaces them
 *  lives somewhere else entirely, and pairing them here put a control that
 *  belongs at the far left in the middle of the bar. */
function navigationSlots(): NodeDef[] {
  return [slot('Tabs', 'hug', 'Adaptive-Nav/Show-Tabs')];
}

/** The menu button, which sits BEFORE the brand.
 *
 *  It replaces the tabs, but not in their place: it opens navigation as a
 *  drawer, and a drawer opens from the edge. Leaving it where the tabs were
 *  put it after the brand and in the middle of the bar, which reads as one
 *  more item rather than as the way in. */
const menuButton = (): NodeDef =>
  slot('Menu-Button', 'hug', 'Adaptive-Nav/Show-Menu-Button');

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
        width: 'fill', height: 'hug', children: [menuButton(), ...navigationSlots()] },
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
    const start: NodeDef[] = [menuButton()];
    if (o.condensed) start.push(slot('Condensed-Brand', 'hug', 'Adaptive-Nav/Show-Condensed'));
    start.push(...navigationSlots());
    /* Centred means centred in the BAR, which needs the SPACE_BETWEEN to have
       something to push against on both sides — the same geometry the centred
       brand uses, and for the same reason. Centring inside a single filling
       group would put the tabs wherever the menu button and the condensed
       brand happen to leave them. */
    const tabsCentred = o.heroTabsAlign === 'center';
    children = tabsCentred
      ? [
          /* THREE groups, and the third is why it works. Two FILL sides with a
             HUG middle is what actually centres the middle — with only a
             filling Start the space-between pushed the tabs hard right, which
             is the bug this had.
             
             The End group is empty unless condensed brings the actions down,
             and an empty FILLING group is the point: it claims the same width
             as the Start, so the middle lands on the bar's centre line rather
             than wherever the menu button happens to leave it. Same geometry
             as the centred brand, for the same reason. */
          { name: 'Start', kind: 'stack', direction: 'row', justify: 'start', align: 'center',
            gap: GAP, width: 'fill', height: 'hug', children: [menuButton()] },
          { name: 'Center', kind: 'stack', direction: 'row', justify: 'center', align: 'center',
            gap: GAP, width: 'hug', height: 'hug',
            children: o.condensed
              ? [slot('Condensed-Brand', 'hug', 'Adaptive-Nav/Show-Condensed'), ...navigationSlots()]
              : navigationSlots() },
          o.condensed
            ? { ...endSlot(o), width: 'fill' as const, justify: 'end' as const,
                presence: { when: 'Adaptive-Nav/Show-Condensed' } as const }
            : { name: 'End', kind: 'stack' as const, direction: 'row' as const, justify: 'end' as const,
                align: 'center' as const, width: 'fill' as const, height: 'hug' as const, children: [] },
        ]
      : [
          { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
            width: 'fill', height: 'hug', children: start },
        ];
    /* Only for the LEFT-aligned arrangement. The centred one already ends
       with a filling End — it needs one to balance the Start — so pushing
       another here gave the bar two, and the second took a share of the width
       that pulled the "centred" tabs off centre again. */
    if (o.condensed && !tabsCentred) {
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
    /* Above the rail the bar spans the whole width and carries the brand, so
       its title belongs at the LEFT — beside the brand, where a title in an
       application bar goes. Centring it there pushes it into the middle of a
       1920px span, half a screen from the thing it names.
       
       Beside the rail the bar is only the content column and centring is a
       real choice, so it stays one. */
    const centred = !brandInBar && o.titleAlign === 'center';
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
            /* Rail-Width wide and flush to the bar's left edge, so it sits
               directly above the rail rather than at the bar's padding. */
            brandBlock(false),
            slot('Title', 'fill'),
            endSlot(o),
          ]
        : [slot('Title', 'fill'), endSlot(o)];
  } else {
    children = [
      { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
        width: 'hug', height: 'hug', children: [menuButton(), brand] },
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
    /* No LEFT padding when the brand block is in the bar: the block is
       Rail-Width wide and has to start at x=0 to line up with the rail under
       it. Padding would inset it and the two would miss each other by exactly
       Sizing-3, which reads as the rail being misaligned rather than the bar
       being padded. */
    padding: {
      top: PAD_Y, bottom: PAD_Y, right: PAD_X,
      ...(o.layout === 'rail' && o.barPosition === 'above-rail' ? {} : { left: PAD_X }),
    },
    width: 'fill',
    /* FIXED at the design system's own App-Bar Height, not hug.
     
       Hugging meant the bar was as tall as its tallest child plus padding —
       92px where the token says 64 — so the inset that clears it was 28px
       short and the rail slid under the bar. The token and the thing it
       measures have to be the same number, and the design system is the one
       that decides it. */
    height: { fixed: t('Other/App-Bar Height') },
    /* The bar carries the pair itself rather than inheriting it.
       
       Inheriting works — custom properties cascade — but it leaves the bar
       transparent and painting whatever is behind it. A sticky bar over
       scrolling content has to have its OWN background or the content shows
       through as it passes under, which is the one thing a sticky bar must not
       do. Setting the attributes on the element that paints is also the rule:
       it exposes the matched set, so the text and borders inside resolve
       against the bar's surface rather than the page's. */
    surface: o.surface ?? 'Surface',
    theme: o.theme,
    // Paints edge to edge; its content respects the page's ceiling.
    band: true,
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

/* Sticky is a CHOICE in two layouts and intrinsic in the other two.
 *
 * A plain top bar can reasonably scroll away — a marketing page whose nav
 * gives way to the content is a real design, not a mistake. So brand-left and
 * brand-centre offer it, defaulting to on.
 *
 * The other two cannot. A rail layout is an application frame, and a frame
 * whose bar scrolls off leaves the rail beside nothing. Tabs under a hero that
 * do not stick are simply tabs under a hero — the pattern IS the sticking.
 * Offering the switch there would be offering an answer that unmakes the
 * layout.
 *
 * It sits on the BAR rather than the root in all four, and in the rail layout
 * that distinction earns its keep: a full-height rail is already in view and
 * does not stick, while the bar beside it does. */
export function stickyBar(o: NavOptions): boolean {
  if (o.layout === 'rail' || o.layout === 'hero') return true;
  return o.sticky !== false;
}
function railNode(fullHeight: boolean): NodeDef {
  return {
    name: 'Rail',
    kind: 'stack',
    direction: 'column',
    /* Centre, not start. The brand and the rail's items are different widths
       and both belong on the rail's centre line — left-aligned, the brand sat
       against the edge while the items centred themselves, and the column read
       as two things rather than one. */
    align: 'center',
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
    /* VERTICAL only. The horizontal inset belongs to the Rail component — the
       design's Rail Slot insets its items by Sizing-1 — so adding Sizing-3
       here too meant 24px of definition padding around 8px of component
       padding around a 44px item, inside a rail 80px wide. The item had 32px
       to live in and the labels wrapped.
       
       What is left is room for the brand above the items, which is this
       wrapper's own job. */
    padding: { top: PAD_Y, bottom: PAD_Y },
    presence: { when: 'Adaptive-Nav/Show-Rail' },
    /* The brand belongs to whichever element reaches the top-left corner. A
       full-height rail does, so it carries the brand and the bar beside it
       starts with the title. Under a full-width bar the rail does not, and the
       brand stays in the bar. Putting it in both would show it twice; putting
       it in the bar while the rail runs past it leaves the corner empty. */
    children: fullHeight
      ? [
          brandBlock(true),
          slot('Rail-Items', 'hug'),
        ]
      : [slot('Rail-Items', 'hug')],
  };
}

function railChildren(o: NavOptions): NodeDef[] {
  // Named apart from the exported stickyBar() to avoid a shadow that would
  // read as a call site and is not one — the rail's bar is always sticky.
  /* PINNED only when the bar spans the whole width.
   *
   * Above the rail it does, so it pins to the viewport's top edge. BESIDE the
   * rail it does not — it occupies the column to the rail's right, and a node
   * pinned left:0 right:0 spans the rail as well, which is the arrangement
   * "beside" exists to avoid. There it sticks within its own column instead,
   * which puts it at the top of the content and nowhere near the rail.
   *
   * The elevation is the same either way: it is the same bar. */
  const spansFullWidth = o.barPosition === 'above-rail';
  const railBar = {
    ...bar(o),
    sticky: true,
    elevation: APP_BAR_ELEVATION,
    ...(spansFullWidth ? { pin: 'top' as const } : {}),
  };
  /* Above: the bar spans the whole width and the rail starts beneath it, so
     the bar's brand and actions clear the rail. Beside: the rail runs the full
     height and the bar occupies only the column to its right, which is what
     puts the brand above the content rather than above the rail.
     
     A sibling either way — nesting the rail under the bar would tie its height
     to the bar's, and it would stop being a rail. */
  /* The page goes WITH the bar, on the side of the rail the content is on.
     Above: the bar spans the top and the rail and the page share the row
     beneath it. Beside: the rail runs the full height and the bar and page
     stack in the column to its right. */
  return o.barPosition === 'above-rail'
    ? [railBar, {
        name: 'Body', kind: 'stack', direction: 'row',
        width: 'fill', height: 'fill',
        children: [railNode(false), pageSlot()],
      }]
    : [railNode(true), {
        name: 'Body', kind: 'stack', direction: 'column',
        width: 'fill', height: 'fill',
        children: [railBar, pageSlot()],
      }];
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
    /* FILL, not hug. The nav is a frame for a screen, not a strip: the bars
       are at the edges and everything between them is page. Hugging made the
       root as tall as its bars, so the rail and the content had 153px to
       share and the page had nowhere to be. */
    height: 'fill',
    surface: o.surface ?? 'Surface',
    theme: o.theme,
    children: o.layout === 'rail'
      ? railChildren(o)
      : [{ ...bar(o), sticky: stickyBar(o), pin: 'top' as const, elevation: APP_BAR_ELEVATION }, pageSlot()],
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
        /* Only a DEVICE condition can be true because of a width. Testing for
           'scroll' by name seeded every trigger added afterwards as true,
           which would have opened the account menu at every breakpoint the
           moment it existed. */
        def && def.trigger !== 'device' ? false
        : name === 'Adaptive-Nav/Show-Menu-Button' ? bp.id === narrowest
        : name === 'Adaptive-Nav/Show-Tabs' ? bp.id !== narrowest
        : name === 'Adaptive-Nav/Show-Rail' ? bp.id === widest
        : name === 'Adaptive-Nav/Show-Search' ? bp.id !== narrowest
        : name === 'Adaptive-Nav/Show-Actions' ? bp.id !== narrowest
        : true;
    }
  }
  return out;
}
