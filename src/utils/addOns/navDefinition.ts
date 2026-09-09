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
import { t, type ComponentDefinition, type NodeDef, type TokenRef } from './defineComponent';

export type NavLayout = 'brand-left' | 'brand-centre' | 'rail';

export interface NavOptions {
  layout: NavLayout;
  /** Right-hand slot contents. Each is a slot the consumer fills. */
  search?: boolean;
  actions?: boolean;
  avatar?: boolean;
  /** React-only; see the note above. */
  sticky?: boolean;
}

export const NAV_LAYOUTS: { id: NavLayout; label: string; description: string }[] = [
  { id: 'brand-left',   label: 'Brand left',    description: 'Brand, then tabs, then actions on the right.' },
  { id: 'brand-centre', label: 'Brand centred', description: 'Tabs or a menu button on the left, brand centred, actions right.' },
  { id: 'rail',         label: 'Left rail',     description: 'Brand and actions in the bar, navigation in a rail down the side.' },
];

/** Every boolean the nav reads, with what each means.
 *
 *  Declared in one place so both compilers agree on the set and a breakpoint
 *  cannot be invented by a typo in a `when` — a layer bound to a variable that
 *  does not exist never shows and never errors. */
export const NAV_CONDITIONS: Record<string, string> = {
  'Adaptive-Nav/Show-Rail': 'The side rail. Off below the width where a rail costs more than it gives.',
  'Adaptive-Nav/Show-Tabs': 'Inline tabs. Off once they no longer fit, which is what the menu button replaces.',
  'Adaptive-Nav/Show-Menu-Button': 'The menu button that opens navigation as a drawer. The counterpart of Show-Tabs.',
  'Adaptive-Nav/Show-Search': 'Search in the bar. Off when it collapses to an icon.',
};

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
    /* Brand centred needs the centre slot to FILL and the brand to sit inside
       it, or "centred" would only mean "after whatever is on the left". */
    children = [
      { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
        width: 'hug', height: 'hug', children: navigationSlots() },
      { name: 'Center', kind: 'stack', direction: 'row', justify: 'center', align: 'center',
        width: 'fill', height: 'hug', children: [brand] },
      endSlot(o),
    ];
  } else if (o.layout === 'rail') {
    // Navigation lives in the rail, so the bar carries no tabs at all.
    children = [
      { name: 'Start', kind: 'stack', direction: 'row', align: 'center', gap: GAP,
        width: 'hug', height: 'hug', children: [brand] },
      slot('Center', 'fill'),
      endSlot(o),
    ];
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

export function navDefinition(o: NavOptions): ComponentDefinition {
  const root: NodeDef = {
    name: 'Adaptive Nav',
    kind: 'stack',
    direction: o.layout === 'rail' ? 'row' : 'column',
    width: 'fill',
    height: 'hug',
    surface: 'Surface',
    children: o.layout === 'rail'
      ? [
          /* The rail is a sibling of the bar, not a child: it runs the full
             height beside the content, and nesting it under the bar would tie
             its height to the bar's. */
          { name: 'Rail', kind: 'stack', direction: 'column', align: 'start', gap: GAP,
            width: 'hug', height: 'fill', surface: 'Surface-Dim',
            padding: { top: PAD_Y, bottom: PAD_Y, left: PAD_X, right: PAD_X },
            presence: { when: 'Adaptive-Nav/Show-Rail' },
            children: [slot('Rail-Items', 'hug')] },
          bar(o),
        ]
      : [bar(o)],
  };

  return {
    id: 'adaptive-nav',
    label: 'Adaptive Nav',
    schemaVersion: 1,
    conditions: NAV_CONDITIONS,
    root,
  };
}
