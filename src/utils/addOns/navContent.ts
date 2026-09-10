/**
 * What goes IN the nav's slots: tab labels, action buttons, their icons.
 *
 * Slots on their own are holes — enough to describe an arrangement, not enough
 * to look at one and judge it. A bar with "Home Products Pricing About" reads
 * differently from a bar with four equal grey boxes, and the difference is
 * exactly what a designer needs to see.
 *
 * ── What travels and what does not ────────────────────────────────────────
 * Labels DO reach the spec. A published nav arriving with plausible tab names
 * is a component a designer edits; one arriving with four empty frames is a
 * component they have to build. Generic names are a starting point, not
 * identity — unlike a brand mark, which is why that stays local.
 *
 * ICONS DO NOT travel as artwork. Baking MUI's vector paths into the spec
 * would put this library's icon set into every customer's file, where they
 * already have their own — the same mistake as baking a colour. The NAME
 * travels and the Figma side leaves an icon-sized frame for the customer's own
 * component, which is the names-not-values rule applied to shapes.
 */

/** Icons a navigation actually uses. Curated rather than open: an icon picker
 *  over MUI's several thousand is a search problem, and every name offered
 *  here has to mean something to whoever fills the slot in Figma. */
export const NAV_ICONS = [
  'search', 'menu', 'close', 'notifications', 'settings', 'account',
  'home', 'add', 'more', 'chevron-down', 'help', 'cart',
] as const;
export type NavIcon = (typeof NAV_ICONS)[number];

/** The library's Button variants. Kept in step with Button.js by hand, so a
 *  variant offered here is one that renders — an invented one falls back to
 *  default and looks like a bug in the component rather than in this list. */
export const BUTTON_VARIANTS = [
  'default', 'primary', 'secondary', 'tertiary', 'neutral',
  'info', 'success', 'warning', 'error',
] as const;
export const BUTTON_TREATMENTS = ['solid', 'outline', 'light', 'ghost', 'text'] as const;
export type ButtonTreatment = (typeof BUTTON_TREATMENTS)[number];

/** Compose what the lib expects: 'primary-outline', 'default', 'error-ghost'. */
export function buttonVariant(colour: string, treatment: ButtonTreatment): string {
  return treatment === 'solid' ? colour : `${colour}-${treatment}`;
}

export interface NavItem {
  id: string;
  label: string;
  icon?: NavIcon;
  /** Which side of the label the icon sits. Ignored when iconOnly. */
  iconPosition?: 'start' | 'end';
  /** No label rendered. It still needs one — an icon-only control with no
   *  accessible name is announced as just "button", and a name that describes
   *  the ACTION is the only thing that makes it usable. */
  iconOnly?: boolean;
}

export interface NavButtonItem extends NavItem {
  colour: string;
  treatment: ButtonTreatment;
}

/* Tabs are BUTTONS. Your Figma Tab is built on Button tokens — Button-Padding,
   Button-Text, Typography/Buttons/Small — so a tab is a button with a
   treatment, not a separate kind of thing. Typing them the same way is what
   lets one editor serve both and stops a "tab variant" and a "button variant"
   drifting into two vocabularies for one idea. */
export const DEFAULT_TABS: NavButtonItem[] = [
  { id: 'tab-1', label: 'Home', colour: 'default', treatment: 'text' },
  { id: 'tab-2', label: 'Products', colour: 'default', treatment: 'text' },
  { id: 'tab-3', label: 'Pricing', colour: 'default', treatment: 'text' },
  { id: 'tab-4', label: 'About', colour: 'default', treatment: 'text' },
];

export const DEFAULT_ACTIONS: NavButtonItem[] = [
  { id: 'act-1', label: 'Sign in', colour: 'default', treatment: 'text' },
  { id: 'act-2', label: 'Get started', colour: 'default', treatment: 'solid' },
];

export const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

/** Problems that would ship rather than fail.
 *
 *  Both are invisible without a screen reader, which is why they are checked
 *  here instead of being left to notice: an icon-only control with no name is
 *  announced as "button", and a blank label renders an empty tab that can
 *  still be focused and clicked. */
export function itemProblems(item: NavItem): string[] {
  const out: string[] = [];
  if (!item.label.trim()) {
    out.push(item.iconOnly
      ? 'Needs a name. An icon-only control with none is announced as just "button".'
      : 'Needs a label, or it renders as an empty control that can still be focused.');
  }
  if (item.iconOnly && !item.icon) {
    out.push('Icon-only with no icon renders as nothing at all.');
  }
  if (item.iconOnly && item.label.trim() && item.label.trim().length <= 2) {
    // "OK" or "X" as an accessible name says what is drawn, not what happens.
    out.push(`"${item.label}" names the glyph rather than the action.`);
  }
  return out;
}
