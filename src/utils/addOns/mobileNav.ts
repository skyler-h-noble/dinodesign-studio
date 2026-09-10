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
 * ── The FAB is composed, not enumerated ───────────────────────────────────
 * A floating FAB is a SIBLING of the bar: the bar's geometry is identical with
 * or without it. Only a centred one changes anything, and what it changes is
 * how the items distribute — which the NavBar already handles by having two
 * item slots rather than one.
 *
 * So the FAB is an option on the definition rather than a variant of the
 * component. Enumerating it would multiply style × orientation × labels ×
 * fab × fabPosition into thirty-two variants, most differing only by whether
 * something beside them exists.
 */
import { t, type ComponentDefinition, type ConditionDef, type NodeDef } from './defineComponent';

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
  /** Bottom bar or toolbar. */
  itemCount?: number;
  showLabels?: boolean;
  /** Toolbar only. */
  toolbarStyle?: 'fixed' | 'floating';
  toolbarOrientation?: 'horizontal' | 'vertical';
  /** A FAB is composed beside the bar, never a variant of it. */
  fab?: boolean;
  fabPosition?: 'center' | 'end';
  theme?: string;
  surface?: string;
}

/** Five is the ceiling, and it is a reach limit rather than a taste one: below
 *  about 64px a target stops being reliably hittable with a thumb, and five
 *  items is where a 360px phone reaches that. A FAB takes one of the five,
 *  because it occupies the same row. */
export const MAX_BOTTOM_ITEMS = 5;

export function maxItemsWithFab(fab: boolean): number {
  return fab ? MAX_BOTTOM_ITEMS - 1 : MAX_BOTTOM_ITEMS;
}

export const MOBILE_CONDITIONS: Record<string, ConditionDef> = {
  'Adaptive-Nav/Show-Labels': {
    description: 'Labels under the bottom bar icons. Off leaves icons alone.',
    trigger: 'device',
  },
  'Adaptive-Nav/Show-Top-Bar': {
    description: 'The top bar. Off where navigation and identity both sit at the bottom.',
    trigger: 'device',
  },
};

const GAP = t('Sizing-2');
const PAD_X = t('Sizing-3');
const PAD_Y = t('Sizing-2');

const slot = (name: string, width: NodeDef['width'], when?: string): NodeDef => ({
  name, kind: 'slot', width, height: 'hug',
  ...(when ? { presence: { when } } : {}),
});

/** One bottom-bar item: an icon holder with an optional label under it.
 *
 *  Built as a column because that is what the design is — the label sits
 *  UNDER the icon rather than beside it, which is what distinguishes a nav
 *  item from a tab and is why it cannot reuse the tab's structure. */
function navItem(index: number, withLabel: boolean): NodeDef {
  return {
    name: `Nav-Item-${index + 1}`,
    kind: 'stack',
    direction: 'column',
    align: 'center',
    gap: t('Sizing-Half'),
    width: 'hug',
    height: 'hug',
    children: withLabel
      ? [slot(`Nav-Icon-${index + 1}`, 'hug'), slot(`Nav-Label-${index + 1}`, 'hug', 'Adaptive-Nav/Show-Labels')]
      : [slot(`Nav-Icon-${index + 1}`, 'hug')],
  };
}

/** The bottom bar. Two item groups with the FAB between them when it is
 *  centred — which is the arrangement the NavBar's two slots exist for, and
 *  the reason a centred FAB needs no variant of its own. */
function bottomBar(o: MobileOptions): NodeDef {
  const count = Math.min(o.itemCount ?? 4, maxItemsWithFab(!!o.fab));
  const items = Array.from({ length: count }, (_, i) => navItem(i, o.showLabels !== false));
  const centred = o.fab && o.fabPosition !== 'end';
  const split = centred ? Math.ceil(count / 2) : count;

  const group = (name: string, children: NodeDef[]): NodeDef => ({
    name, kind: 'stack', direction: 'row', justify: 'between', align: 'center',
    gap: GAP, width: 'fill', height: 'hug', children,
  });

  const children: NodeDef[] = centred
    ? [
        group('Nav-Item-Slot-Start', items.slice(0, split)),
        slot('FAB', 'hug'),
        group('Nav-Item-Slot-End', items.slice(split)),
      ]
    : [group('Nav-Item-Slot', items), ...(o.fab ? [slot('FAB', 'hug')] : [])];

  return {
    name: 'Bottom-Bar',
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
    children,
  };
}

function topBar(o: MobileOptions): NodeDef {
  const menu = o.showMenu !== false ? [slot('Menu-Button', 'hug')] : [];
  const actions: NodeDef[] = [];
  for (let i = 0; i < (o.topActions ?? 1); i++) actions.push(slot(`Action-${i + 1}`, 'hug'));
  if (o.showAvatar) actions.push(slot('Avatar', 'hug'));

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
    sticky: true,
    children: centred
      ? [
          { name: 'Start', kind: 'stack', direction: 'row', justify: 'start', align: 'center',
            gap: GAP, width: 'fill', height: 'hug', children: menu },
          { name: 'Center', kind: 'stack', direction: 'row', justify: 'center', align: 'center',
            width: 'hug', height: 'hug', children: [slot('Brand', 'hug')] },
          { name: 'End', kind: 'stack', direction: 'row', justify: 'end', align: 'center',
            gap: GAP, width: 'fill', height: 'hug', children: actions },
        ]
      : [
          { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
            width: 'hug', height: 'hug', children: [...menu, slot('Brand', 'hug')] },
          { name: 'End', kind: 'stack', direction: 'row', justify: 'end', align: 'center',
            gap: GAP, width: 'fill', height: 'hug', children: actions },
        ],
  };
}

/** The toolbar: actions rather than navigation, and it can float. */
function toolbar(o: MobileOptions): NodeDef {
  const count = Math.min(o.itemCount ?? 4, maxItemsWithFab(!!o.fab));
  const vertical = o.toolbarOrientation === 'vertical';
  const items = Array.from({ length: count }, (_, i) => navItem(i, o.showLabels !== false));
  if (o.fab) items.push(slot('FAB', 'hug'));

  return {
    name: 'Toolbar',
    kind: 'stack',
    direction: vertical ? 'column' : 'row',
    justify: 'between',
    align: 'center',
    gap: GAP,
    padding: { top: PAD_Y, bottom: PAD_Y, left: PAD_X, right: PAD_X },
    width: vertical ? 'hug' : 'fill',
    height: vertical ? 'fill' : 'hug',
    /* Floating gets a radius and sits inside the safe area; fixed spans the
       edge. The difference is a corner and an inset, which is why it is an
       option rather than a second component. */
    radius: o.toolbarStyle === 'floating' ? t('Sizing-6') : undefined,
    surface: o.surface ?? 'Surface',
    theme: o.theme,
    children: items,
  };
}

export function mobileNavDefinition(o: MobileOptions): ComponentDefinition {
  const children: NodeDef[] = [];

  if (o.layout !== 'bottom-only') children.push(topBar(o));
  if (o.layout === 'top-and-bottom' || o.layout === 'bottom-only') children.push(bottomBar(o));
  if (o.layout === 'toolbar') children.push(toolbar(o));

  return {
    id: 'adaptive-nav',
    label: 'Adaptive Nav',
    schemaVersion: 1,
    conditions: MOBILE_CONDITIONS,
    root: {
      name: 'Adaptive Nav',
      kind: 'stack',
      direction: 'column',
      justify: 'between',
      width: 'fill',
      height: 'hug',
      children,
    },
  };
}
