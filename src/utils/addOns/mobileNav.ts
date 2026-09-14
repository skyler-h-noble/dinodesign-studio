/**
 * Mobile layouts — a different set from the desktop ones, not the same ones
 * narrowed.
 *
 * Below the tablet cluster a nav stops being "the desktop bar with fewer
 * items". Reach decides the arrangement: the bottom of the screen is where a
 * thumb lands, so navigation moves there and the top bar keeps only identity
 * and the way in. That is a different component shape, not a breakpoint of the
 * same one — which is why these are their own layouts rather than more
 * conditions on the desktop ones.
 *
 * ── The FAB is the component's ────────────────────────────────────────────
 * It sits IN the bar, in an item's place — an outlined ring at the end or in
 * the middle — and the Nav-Bar component renders it (`fabAction`,
 * `fabPosition`), the same way it renders the items and their labels. So it
 * is not in the definition at all: the bar is one slot, and what fills it
 * decides whether there is a ring and where.
 *
 * This used to compose the FAB as a SIBLING slot beside the bar — a solid
 * button floating next to the pill — which is a different pattern from the
 * design's, and it left the frame with a slot the builder had nothing to put
 * in. The option survives on MobileOptions because it drives the preview and
 * the reach ceiling: a ring takes one of the five places.
 */
import { t, type ComponentDefinition, type ConditionDef, type NodeDef } from './defineComponent';
import { accountNode, signedInOnly, ACCOUNT_MENU_CONDITIONS } from './accountMenu';
import { SPEED_DIAL_CONDITIONS } from './speedDial';
import { pageSlot, APP_BAR_ELEVATION, BRAND_CONDITION } from './navDefinition';

export type MobileLayout = 'top-only' | 'top-and-bottom' | 'toolbar' | 'bottom-only';

export const MOBILE_LAYOUTS: { id: MobileLayout; label: string; description: string }[] = [
  {
    id: 'top-only',
    label: 'Top bar only',
    description: 'Menu, brand and actions in one bar. Navigation opens as a drawer.',
  },
  {
    id: 'top-and-bottom',
    label: 'Top and bottom',
    description: 'Identity and actions at the top, navigation within thumb reach at the bottom.',
  },
  {
    id: 'toolbar',
    label: 'Top bar and toolbar',
    description: 'A toolbar of actions rather than navigation — fixed or floating, across or down.',
  },
  {
    id: 'bottom-only',
    label: 'Bottom bar only',
    description: 'Navigation alone, no top bar. For apps whose identity lives in the content.',
  },
];

export interface MobileOptions {
  layout: MobileLayout;
  /** Top bar. */
  brandAlign?: 'left' | 'center';
  showMenu?: boolean;
  topActions?: number;
  showAvatar?: boolean;
  /** Whether that avatar opens the account menu. The same panel as the desktop
   *  bar's, from the same builder — a phone's account menu is not a different
   *  component, it is the same one on a narrower screen. */
  avatarMenu?: boolean;
  /** Bottom bar or toolbar. */
  itemCount?: number;
  showLabels?: boolean;
  /** Fixed spans the bottom edge and paints it; floating is a pill inset
   *  from it, and the pill paints ITSELF. Both the bottom bar and the
   *  toolbar are the Nav-Bar component, so both have this axis — it was
   *  toolbar-only in name while the preview applied it to the bottom bar
   *  too, which is how a floating bar came to sit inside a painted band. */
  barStyle?: 'fixed' | 'floating';
  /** Toolbar only. */
  toolbarOrientation?: 'horizontal' | 'vertical';
  /** A ring in the bar, rendered by the component — the preview passes it
   *  through; the definition carries nothing for it. */
  fab?: boolean;
  fabPosition?: 'center' | 'end';
  /** The ring opens a speed dial rather than acting. The actions are the
   *  page's list (see speedDial.ts); the definition carries only the
   *  open/closed variable. */
  fabSpeedDial?: boolean;
  theme?: string;
  surface?: string;
}

/** Five is the ceiling, and it is a reach limit rather than a taste one: below
 *  about 64px a target stops being reliably hittable with a thumb, and five
 *  items is where a 360px phone reaches that. A FAB takes one of the five,
 *  because it occupies the same row. */
export const MAX_BOTTOM_ITEMS = 5;
/** And two is the floor. One item is not navigation — there is nowhere to
 *  go — and a bar holding it is a button that has taken the whole edge. */
export const MIN_BOTTOM_ITEMS = 2;

export function maxItemsWithFab(fab: boolean): number {
  return fab ? MAX_BOTTOM_ITEMS - 1 : MAX_BOTTOM_ITEMS;
}

/** The counts the bar can hold: two up to the ceiling. */
export function bottomItemCounts(fab: boolean): number[] {
  const out: number[] = [];
  for (let n = MIN_BOTTOM_ITEMS; n <= maxItemsWithFab(fab); n++) out.push(n);
  return out;
}

/** Which of the nav's items the bar shows, at the count asked for.
 *
 *  The first N of the tabs — and when the nav has fewer tabs than that,
 *  stand-ins for the rest, so picking 5 with four tabs shows five and not
 *  a count that silently stayed at four. A stand-in is named as one,
 *  because the real fifth item is the user's to add. */
export function bottomBarItems<T extends { label: string }>(
  tabs: T[], count: number, placeholder: (n: number) => T,
): T[] {
  const n = Math.max(MIN_BOTTOM_ITEMS, count);
  const out = tabs.slice(0, n);
  while (out.length < n) out.push(placeholder(out.length + 1));
  return out;
}

export const MOBILE_CONDITIONS: Record<string, ConditionDef> = {
  ...BRAND_CONDITION,
  'Adaptive-Nav/Show-Labels': {
    description: 'Labels under the bottom bar icons. Off leaves icons alone.',
    trigger: 'device',
    /* The definition binds nothing to this: the bar is one slot and the items
       are added when the nav is built. The builder binds each label's
       visibility to this variable, so it has to exist in the file even though
       nothing here gates on it. */
    boundWhenBuilt: true,
  },
  'Adaptive-Nav/Show-Top-Bar': {
    description: 'The top bar. Off where navigation and identity both sit at the bottom.',
    trigger: 'device',
  },
  ...ACCOUNT_MENU_CONDITIONS,
};

const GAP = t('Sizing-2');
const PAD_X = t('Sizing-3');
const PAD_Y = t('Sizing-2');

const slot = (name: string, width: NodeDef['width'], when?: string): NodeDef => ({
  name, kind: 'slot', width, height: 'hug',
  ...(when ? { presence: { when } } : {}),
});

/* navItem is gone. It hand-built an icon holder and a label per item —
   a second implementation of what the Nav-Bar component already owns, which
   would have drifted from it the moment either changed. The bar is one slot
   now and the component fills it. */

/** What the frame around the Nav-Bar contributes — and it is one thing or
 *  the other, never both.
 *
 *  FLOATING: the bar is a pill the COMPONENT paints — its own fill, its own
 *  corners — sitting inset from the screen edge. The frame is then only the
 *  positioner that holds that inset, and it must be transparent. Painted, it
 *  put a second, full-width band behind the pill — a bar inside a bar, in
 *  two tones of the same surface — which is not a floating bar at all, it is
 *  a fixed bar with a pill drawn on it.
 *
 *  FIXED: the bar IS the screen edge. The component already spans it and
 *  paints it, so the frame carries the surface, the band and the elevation
 *  (the component has no shadow of its own) and NO padding — an inset here
 *  showed as a stripe of frame around a component that is meant to reach the
 *  corners, and it pushed the first and last items away from where a thumb
 *  actually lands.
 *
 *  So padding and paint are mutually exclusive: the inset belongs to
 *  floating, the paint to fixed. */
function barFrame(o: MobileOptions): Pick<NodeDef, 'padding' | 'surface' | 'theme' | 'band' | 'elevation'> {
  if (o.barStyle === 'floating') {
    /* The sides are the page's MARGIN, the same token the desktop bar pads
       with and for the same reason: a pill whose edge sits at a different x
       from the page's contents reads as misaligned however carefully it is
       inset. On the page's margin its outer edge lines up with everything
       above it — 16 at xs, 24 at sm — and it is per breakpoint for free.
       
       It was Sizing-3, the bar's CONTENT padding, which is a different
       measure: on a 320px phone 24 a side plus the pill's own ends left the
       items under half the width.
       
       The bottom stays a spacing step. It is a gap off the screen edge, not
       an alignment with anything. */
    return { padding: { top: PAD_Y, bottom: PAD_Y, left: t('Margin'), right: t('Margin') } };
  }
  return {
    surface: o.surface ?? 'Surface',
    theme: o.theme,
    band: true,
    elevation: APP_BAR_ELEVATION,
  };
}

/** The bottom bar: one slot, filled by the Nav-Bar component. */
function bottomBar(o: MobileOptions): NodeDef {
  /* ONE SLOT, the same shape the rail uses, where Rail-Items is a single slot
     the real Rail drops into.
     
     This hand-built a Nav-Item-N stack per item, each holding its own
     Nav-Icon-N and Nav-Label-N. That is a second implementation of a shipped
     component: the design's Nav-Bar already owns the item's geometry, its
     selected pill and its label, and the copy here would drift from it the
     moment either changed. It also could not be filled — the group was a
     STACK, so the preview's BottomNavigation never landed and every item
     rendered as two dashed boxes.
     
     The FAB is the component's too, so a centred one no longer splits this
     into two slots with a FAB slot between: the ring is placed among the
     items by whatever fills the slot. */
  const children: NodeDef[] = [slot('Nav-Item-Slot', 'fill')];

  return {
    name: 'Bottom-Bar',
    kind: 'stack',
    direction: 'row',
    justify: 'between',
    align: 'center',
    gap: GAP,
    width: 'fill',
    height: 'hug',
    ...barFrame(o),
    /* Pinned to the bottom edge, and that is the whole point of a bottom bar:
       it is where a thumb rests, which is only true if it stays there. In the
       flow it sat directly under the content — so on a short page it floated
       in the middle of the screen, which is the one place a bottom bar must
       never be.
       
       Not sticky: a bottom bar that scrolls away is a footer. */
    pin: 'bottom',
    sticky: true,
    children,
  };
}

function topBar(o: MobileOptions): NodeDef {
  const menu = o.showMenu !== false ? [slot('Menu-Button', 'hug')] : [];
  const actions: NodeDef[] = [];
  for (let i = 0; i < (o.topActions ?? 1); i++) actions.push(slot(`Action-${i + 1}`, 'hug'));
  if (o.showAvatar) actions.push(signedInOnly(accountNode({ withMenu: o.avatarMenu })));

  /* Centred brand needs both sides to claim equal space, or "centred" means
     "wherever the menu button and the actions happen to leave it". The same
     rule as the desktop bar, for the same reason. */
  const centred = o.brandAlign === 'center';
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
    surface: o.surface ?? 'Surface',
    theme: o.theme,
    band: true,
    sticky: true,
    pin: 'top',
    elevation: APP_BAR_ELEVATION,
    children: centred
      ? [
          { name: 'Start', kind: 'stack', direction: 'row', justify: 'start', align: 'center',
            gap: GAP, width: 'fill', height: 'hug', children: menu },
          { name: 'Center', kind: 'stack', direction: 'row', justify: 'center', align: 'center',
            width: 'hug', height: 'hug', children: [slot('Brand', 'hug', 'Adaptive-Nav/Show-Brand')] },
          { name: 'End', kind: 'stack', direction: 'row', justify: 'end', align: 'center',
            gap: GAP, width: 'fill', height: 'hug', children: actions },
        ]
      : [
          { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
            width: 'hug', height: 'hug', children: [...menu, slot('Brand', 'hug', 'Adaptive-Nav/Show-Brand')] },
          { name: 'End', kind: 'stack', direction: 'row', justify: 'end', align: 'center',
            gap: GAP, width: 'fill', height: 'hug', children: actions },
        ],
  };
}

/** The toolbar: actions rather than navigation, and it can float. */
function toolbar(o: MobileOptions): NodeDef {
  const vertical = o.toolbarOrientation === 'vertical';
  /* The same one slot as the bottom bar, for the same reason: a toolbar IS
     the Nav-Bar component — its Style and Orientation are two of that
     component's three variant axes. */
  const items: NodeDef[] = [slot('Nav-Item-Slot', vertical ? 'hug' : 'fill')];

  return {
    name: 'Toolbar',
    kind: 'stack',
    direction: vertical ? 'column' : 'row',
    justify: 'between',
    align: 'center',
    gap: GAP,
    width: vertical ? 'hug' : 'fill',
    height: vertical ? 'fill' : 'hug',
    /* Floating sits inside the safe area and the component draws the pill;
       fixed spans the edge and the frame paints it. The corner is the
       component's, not the frame's — a radius here drew a second rounded
       shape around the one the Nav-Bar already has. */
    ...barFrame(o),
    children: items,
  };
}

/* pageSlot is shared with the desktop layouts — one Page, one shape. It was
   defined here and nowhere else, which is why no desktop nav had one. */

export function mobileNavDefinition(o: MobileOptions): ComponentDefinition {
  const children: NodeDef[] = [];

  if (o.layout !== 'bottom-only') children.push(topBar(o));
  if (o.layout === 'top-and-bottom' || o.layout === 'bottom-only') {
    children.push(pageSlot(), bottomBar(o));
  }
  if (o.layout === 'toolbar') children.push(pageSlot(), toolbar(o));

  return {
    id: 'adaptive-nav',
    label: 'Adaptive Nav',
    schemaVersion: 1,
    /* The speed dial's variable only when there is a dial to bind it to. It
       is published on the strength of "the build will bind it" — and with no
       dial the build binds nothing, so the variable would be a control that
       flips nothing in every file that imported it. */
    conditions: o.fab && o.fabSpeedDial
      ? { ...MOBILE_CONDITIONS, ...SPEED_DIAL_CONDITIONS }
      : MOBILE_CONDITIONS,
    root: {
      name: 'Adaptive Nav',
      kind: 'stack',
      direction: 'column',
      justify: 'between',
      width: 'fill',
      /* FILL, like the desktop root. Hugging made the nav as tall as its bars
         with the page squeezed between them, so a pinned bottom bar had no
         bottom to pin to. */
      height: 'fill',
      children,
    },
  };
}
