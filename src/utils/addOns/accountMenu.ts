/**
 * The avatar as a way IN, rather than as a picture.
 *
 * An avatar in the top right of an application bar is almost never decoration
 * — it is the account menu's trigger. Offering only the picture meant every
 * design system importing this add-on had to rebuild the same panel, and
 * rebuild it slightly differently each time, which is the drift this whole
 * architecture exists to prevent.
 *
 * ── Why one module for both layouts ───────────────────────────────────────
 * The desktop bar and the mobile top bar both end in an avatar, and the menu
 * that opens from it is the same panel in both. Written twice it would be two
 * panels that agree today: the desktop one would get the divider rule and the
 * mobile one would not, and nothing would report it.
 *
 * ── What travels ──────────────────────────────────────────────────────────
 * The PANEL travels — its radius, its surface, the fact that it hangs under
 * the avatar aligned to the same edge. The ROWS do not: they are a slot, the
 * same as the tabs, so the importing design system fills them with its own
 * menu rows rather than receiving this library's. Names, never values, applied
 * to structure.
 */
import { t, type ConditionDef, type NodeDef } from './defineComponent';

/** Open or closed. One condition, shared by both layouts — two names for one
 *  state would let a design system open the desktop menu and not the mobile
 *  one, which is not a thing anybody wants to express. */
export const ACCOUNT_MENU_CONDITION = 'Adaptive-Nav/Show-Account-Menu';

/** Signed in or not. The account is only there for someone who has one, and
 *  a nav genuinely differs between the two — so it is a variable of its own,
 *  published with the rest, that a design system can bind anything else to.
 *  Here it gates the account. */
export const SIGNED_IN_CONDITION = 'Adaptive-Nav/Signed-In';

/** And its counterpart. TWO booleans rather than one, because Figma binds a
 *  layer's `visible` to a boolean and cannot invert it — the same reason
 *  Show-Tabs and Show-Menu-Button are a pair rather than one flag. */
export const SIGNED_OUT_CONDITION = 'Adaptive-Nav/Signed-Out';

export const ACCOUNT_MENU_CONDITIONS: Record<string, ConditionDef> = {
  [SIGNED_IN_CONDITION]: {
    description:
      'Someone is signed in. Off shows the nav as a visitor sees it, with no account.',
    trigger: 'session',
  },
  [SIGNED_OUT_CONDITION]: {
    description:
      'Nobody is signed in. Shows the nav a visitor sees — sign in, get started.',
    trigger: 'session',
  },
  [ACCOUNT_MENU_CONDITION]: {
    description:
      'The account menu, open. Driven by a click on the avatar, not by viewport width.',
    /* Not `scroll`, though both are false at every width. Scroll is ambient
       and undoes itself; this one has been asked for and stays until it is
       dismissed. One trigger for both would put a scroll listener on a menu. */
    trigger: 'interaction',
  },
};

/**
 * One row of the menu.
 *
 * A label and, optionally, an icon and a rule above it. Deliberately NOT the
 * NavItem shape: a menu row has no start/end pair, no avatar and no button
 * variant, and offering those would offer a solid-filled menu row, which the
 * design system does not have.
 */
export interface AccountMenuItem {
  id: string;
  label: string;
  iconName?: string;
  /** A rule ABOVE this row.
   *
   *  Grouping, not decoration — "Sign out" belongs apart from "Profile", and
   *  the separation is what says so. Stored on the row below the rule rather
   *  than as a row of its own so that removing a row cannot leave a divider
   *  stranded at the top or doubled up in the middle. */
  dividerBefore?: boolean;
}

export const DEFAULT_ACCOUNT_MENU: AccountMenuItem[] = [
  { id: 'acct-1', label: 'Profile', iconName: 'Person' },
  { id: 'acct-2', label: 'Settings', iconName: 'Settings' },
  { id: 'acct-3', label: 'Sign out', iconName: 'Logout', dividerBefore: true },
];

/** Problems that would ship rather than fail.
 *
 *  A blank label is the one that matters: a menu row with no text is a
 *  clickable empty strip that a screen reader announces as nothing at all, and
 *  it looks like padding rather than like a fault. */
export function accountItemProblems(item: AccountMenuItem): string[] {
  const out: string[] = [];
  if (!item.label.trim()) out.push('No label — the row renders as an empty strip.');
  return out;
}

/** The whole list's problems, including the one no single row can see. */
export function accountMenuProblems(items: AccountMenuItem[]): string[] {
  const out: string[] = [];
  for (const i of items) out.push(...accountItemProblems(i));
  /* An avatar that opens nothing is worse than an avatar that does nothing:
     it takes focus, announces itself as a menu, and then has no menu. */
  if (!items.length) out.push('No rows — the avatar would open an empty panel.');
  return out;
}

export const newAccountItem = (): AccountMenuItem => ({
  id: `acct-${Math.random().toString(36).slice(2, 8)}`,
  label: 'New item',
});

/**
 * The avatar, and the panel that drops from it.
 *
 * Without a menu this is just the Avatar slot, unchanged — the wrapper exists
 * only to give the panel something to hang off, and a wrapper around a single
 * slot would be a frame in every design that does not use the menu.
 *
 * `when` gates the whole account group, not the avatar alone: the menu cannot
 * be open at a width where the thing that opens it is not there.
 */
export function accountNode(opts: { withMenu?: boolean; when?: string }): NodeDef {
  const avatar: NodeDef = { name: 'Avatar', kind: 'slot', width: 'hug', height: 'hug' };
  const gate = opts.when ? { presence: { when: opts.when } as const } : {};

  if (!opts.withMenu) return { ...avatar, ...gate };

  /* The gate goes on the GROUP, and only there. Repeated on the avatar inside
     it, the same condition would be evaluated twice on both targets for one
     decision — and the copy would be the one somebody forgot to change. */
  return {
    name: 'Account',
    kind: 'stack',
    direction: 'row',
    align: 'center',
    width: 'hug',
    height: 'hug',
    ...gate,
    children: [avatar, accountPanel()],
  };
}

/** The account, for a signed-in user only.
 *
 *  A WRAPPER, and it is there because Figma needs it: a layer's visibility
 *  binds to one boolean, and the account is gated by two — the width says
 *  whether the avatar fits, the session says whether there is an account at
 *  all. Two conditions on one layer is not a thing a plugin can write, so the
 *  AND is a frame with the session on it around a node with the width on it.
 *
 *  Named for what it gates rather than for what it holds, so the layer list
 *  reads as the decision: Signed-In › Account › Avatar. */
export function signedOutOnly(node: NodeDef): NodeDef {
  return { ...signedInOnly(node), name: 'Signed-Out', presence: { when: SIGNED_OUT_CONDITION } };
}

export function signedInOnly(node: NodeDef): NodeDef {
  return {
    name: 'Signed-In',
    kind: 'stack',
    direction: 'row',
    align: 'center',
    width: 'hug',
    height: 'hug',
    presence: { when: SIGNED_IN_CONDITION },
    children: [node],
  };
}

/**
 * The floating panel.
 *
 * Matched to the library's own Menu panel rather than invented: the same
 * Dropdown-Frame-Radius, the same 4px gap under the trigger, the same
 * right-edge alignment. That token is documented as "the floating frame of a
 * dropdown or menu panel", which is exactly this, and following it is what
 * keeps a published nav's menu the same shape as every other menu in the
 * system instead of one rounder or squarer than the rest.
 *
 * It separates from the bar by SURFACE, not by a stroke. The definition has no
 * stroke field — a panel that carried a literal border colour would ship this
 * library's border to everyone, which is the one thing a definition may not do
 * — so the level does the work, and a level resolves in each design system's
 * own palette on both targets.
 */
function accountPanel(): NodeDef {
  return {
    name: 'Account-Menu',
    kind: 'slot',
    direction: 'column',
    width: 'hug',
    height: 'hug',
    radius: t('Other/Dropdown-Frame-Radius'),
    padding: { top: t('Sizing-1'), bottom: t('Sizing-1') },
    /* Brightest, because a panel floats ABOVE what it covers and the brightest
       level is the one that reads as nearest in both light and dark. Not a
       shadow: the definition cannot express one, and a level that resolves
       per theme is closer to the intent than a shadow that would not. */
    surface: 'Surface-Brightest',
    /* And an edge. The level alone is not enough: a panel at the brightest
       level floating over a page that is ALSO at the brightest level has no
       boundary at all, and the rows read as text lying loose on the page. The
       library's own Menu draws the same hairline for the same reason. */
    border: t('Border'),
    /* Right, following the avatar it drops from. A left-aligned panel under a
       control at the right of a bar runs off the page — the alignment is not a
       preference, it is which edge there is room on. */
    overlay: { anchor: 'top-right', drop: true },
    presence: { when: ACCOUNT_MENU_CONDITION },
  };
}
