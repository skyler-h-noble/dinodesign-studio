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

/** Where icon names come from.
 *
 *  A free-text field rather than a picker, and the reason is the size of the
 *  set: MUI ships several thousand, so a picker is a search problem, and a
 *  curated dozen is a guess about what a nav needs that will be wrong for
 *  somebody. Typed names put the whole set in reach.
 *
 *  The cost is that a typo resolves to nothing and renders an empty control
 *  that can still be focused — so an unrecognised name is reported rather than
 *  left to look like a missing icon. */
export const ICON_REFERENCE_URL = 'https://mui.com/material-ui/material-icons/';

/** How an avatar is filled. The lib's Avatar takes all three; which one is a
 *  real choice, because a photo, initials and a glyph are different content
 *  rather than different styling. */
export const AVATAR_TYPES = ['photo', 'initials', 'icon'] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];

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

/**
 * One tab or button, with the same boolean props the Figma component has.
 *
 * Named to match Figma's variant properties — startIcon, startAvatar, endIcon,
 * endAvatar, text — rather than to some tidier scheme of my own. The converter
 * has to line these up with the component's variants either way, and two
 * vocabularies for one set of switches is a translation step that exists only
 * to be got wrong.
 *
 * Both ends can carry either, and independently: a tab with an avatar before
 * the label and a chevron after it is one item, not a special case.
 */
export interface NavItem {
  id: string;
  /** Shown when `text`, and the accessible name either way — an item with no
   *  visible label still has to be announced as something. */
  label: string;
  text?: boolean;
  startIcon?: boolean;
  startIconName?: string;
  endIcon?: boolean;
  endIconName?: string;
  startAvatar?: boolean;
  endAvatar?: boolean;
  /** Applies to whichever avatar is on. Both ends carrying different avatars
   *  is not a thing a nav item does. */
  avatarType?: AvatarType;
  avatarInitials?: string;
}

export interface NavButtonItem extends NavItem {
  colour: string;
  treatment: ButtonTreatment;
}

/* A TAB IS NOT A BUTTON, and the distinction is visual rather than semantic.
   
   It is built FROM Button tokens — Button-Padding, Button-Text,
   Typography/Buttons/Small — which is what keeps it the same size and type as
   the buttons beside it. But its treatment is a SELECTOR: an indicator bar on
   one edge, a track hairline along the rest, and the selected one carrying
   --Text while the others carry --Quiet. A button's treatment is a fill, an
   outline or nothing.
   
   So a tab has no colour and no treatment to choose. Giving it button variants
   would offer a solid or outlined tab, which the design system does not have,
   and would lose the indicator that makes a tab legible as one. */
export const DEFAULT_TABS: NavItem[] = [
  { id: 'tab-1', label: 'Home', text: true },
  { id: 'tab-2', label: 'Products', text: true },
  { id: 'tab-3', label: 'Pricing', text: true },
  { id: 'tab-4', label: 'About', text: true },
];

export const DEFAULT_ACTIONS: NavButtonItem[] = [
  { id: 'act-1', label: 'Sign in', text: true, colour: 'default', treatment: 'text' },
  { id: 'act-2', label: 'Get started', text: true, colour: 'default', treatment: 'solid' },
];

export const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

/** Problems that would ship rather than fail.
 *
 *  Both are invisible without a screen reader, which is why they are checked
 *  here instead of being left to notice: an icon-only control with no name is
 *  announced as "button", and a blank label renders an empty tab that can
 *  still be focused and clicked. */
/** Would this item render anything at all?
 *
 *  The one problem that is not a warning: an item with no text, no icon and no
 *  avatar is an empty control that still takes focus and can still be clicked.
 *  There is no reading of it that is intended, so it is refused rather than
 *  reported. */
export function itemRendersNothing(item: NavItem): boolean {
  const hasText = !!item.text && !!item.label.trim();
  const hasIcon = !!(item.startIcon && item.startIconName?.trim())
    || !!(item.endIcon && item.endIconName?.trim());
  const hasAvatar = !!(item.startAvatar || item.endAvatar);
  return !hasText && !hasIcon && !hasAvatar;
}

export function itemProblems(item: NavItem): string[] {
  const out: string[] = [];
  const hasDecorator = item.startIcon || item.endIcon || item.startAvatar || item.endAvatar;

  if (!item.label.trim()) {
    out.push(item.text
      ? 'Needs a label, or it renders as an empty control that can still be focused.'
      : 'Needs a name. With the text off it is announced as just "button".');
  } else if (!item.text && item.label.trim().length <= 2) {
    // "OK" or "X" as an accessible name says what is drawn, not what happens.
    out.push(`"${item.label}" names the glyph rather than the action.`);
  }

  if (!item.text && !hasDecorator) {
    out.push('Text off with no icon or avatar renders nothing at all.');
  }
  if (item.startIcon && !item.startIconName?.trim()) out.push('Start icon has no name.');
  if (item.endIcon && !item.endIconName?.trim()) out.push('End icon has no name.');
  if ((item.startAvatar || item.endAvatar) && item.avatarType === 'initials'
      && !item.avatarInitials?.trim()) {
    out.push('Avatar set to initials with none given.');
  }
  return out;
}
