/**
 * The speed dial — what the bar's FAB opens.
 *
 * A ring in the bar can act, or it can open a short list of actions: an icon
 * and a label each, stacked above the ring. The list is the design, the same
 * way the account menu's rows are, so it is edited as a list and kept here as
 * a model rather than as props scattered through the page.
 *
 * ── Why it is not in the definition ───────────────────────────────────────
 * The bar is ONE slot filled by the Nav-Bar component, and the ring is the
 * component's — so the panel it opens is the component's too, the way the
 * items and their labels are. The definition carries nothing for it but the
 * variable: open or closed is a state a design system needs to flip in Figma,
 * and a variable the builder will bind still has to exist in the file.
 */
import type { ConditionDef } from './defineComponent';

export const SPEED_DIAL_CONDITION = 'Adaptive-Nav/Show-Speed-Dial';

export const SPEED_DIAL_CONDITIONS: Record<string, ConditionDef> = {
  [SPEED_DIAL_CONDITION]: {
    description: 'The speed dial, open. Driven by a press on the bar\'s FAB, not by viewport width.',
    trigger: 'interaction',
    /* The definition binds nothing to this: the ring and its panel are the
       component's, added when the nav is built. The builder binds the panel's
       visibility to this variable, so it has to exist in the file. */
    boundWhenBuilt: true,
  },
};

/** One action. An icon and a label — no divider, no variant: a speed dial is
 *  a flat list of a few peers, and grouping inside it is a menu's job. */
export interface SpeedDialItem {
  id: string;
  label: string;
  iconName?: string;
}

/** Six is the ceiling, and it is a reach one: the panel climbs from the bar,
 *  and past six rows the top action is out of thumb reach on the phones a
 *  bottom bar exists for. */
export const MAX_SPEED_DIAL_ITEMS = 6;

export const DEFAULT_SPEED_DIAL: SpeedDialItem[] = [
  { id: 'dial-1', label: 'New post', iconName: 'Edit' },
  { id: 'dial-2', label: 'Upload', iconName: 'Upload' },
  { id: 'dial-3', label: 'Record', iconName: 'Mic' },
];

export const newSpeedDialItem = (): SpeedDialItem => ({
  id: `dial-${Math.random().toString(36).slice(2, 8)}`,
  label: 'New action',
  iconName: 'Add',
});

/** Problems that would ship rather than fail. */
export function speedDialProblems(items: SpeedDialItem[]): string[] {
  const out: string[] = [];
  if (items.length === 0) out.push('No actions — a dial that opens onto nothing.');
  if (items.length > MAX_SPEED_DIAL_ITEMS) {
    out.push(`${items.length} actions — past ${MAX_SPEED_DIAL_ITEMS} the top one is out of thumb reach.`);
  }
  for (const i of items) {
    if (!i.label.trim()) out.push('An action with no label is announced as nothing.');
  }
  return out;
}
