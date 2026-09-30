/**
 * Will the tabs fit in the bar, or do they become menu items?
 *
 * ── Why this is an estimate and says so ───────────────────────────────────
 * Whether four tabs fit at 900px is not a property of the breakpoint. It
 * depends on the labels — "Home Products Pricing About" and "Dashboard
 * Integrations Administration Notifications" are the same four tabs and a
 * 200px difference — and on what else is in the bar: a search field, two
 * action buttons and an avatar all want the same row.
 *
 * So a fixed threshold is wrong in both directions. It hides tabs that would
 * have fitted, and it leaves tabs inline where they overlap the actions,
 * which is the failure that matters because it looks like a rendering bug
 * rather than a layout that ran out of room.
 *
 * This measures the CONTENT instead. It is an estimate — text width from an
 * average character advance, not from a font — and it is used only to seed
 * the default. Every breakpoint keeps its own switch, so a designer who
 * disagrees flips it and the estimate never overrides them.
 */
import type { NavItem, NavButtonItem } from './navContent';

/* Average advance per character at the label's own size, measured across the
   system stack rather than assumed: 0.55em is close for mixed-case Latin at
   these sizes, and being 10% out moves the threshold by a few pixels rather
   than changing the answer. */
const CHAR_ADVANCE = 0.55;

/** One tab or button's width: its text, its padding, and any decorators. */
export function itemWidth(item: NavItem, fontSize: number, padX: number): number {
  const text = item.text === false ? 0 : item.label.length * fontSize * CHAR_ADVANCE;
  const decorators =
    (item.startIcon || item.startAvatar ? fontSize + 4 : 0) +
    (item.endIcon || item.endAvatar ? fontSize + 4 : 0);
  return Math.ceil(text + decorators + padX * 2);
}

export interface BarContent {
  tabs: NavItem[];
  actions: NavButtonItem[];
  hasSearch: boolean;
  hasAvatar: boolean;
  hasBrand: boolean;
  /** Component-Size decides the type size and the paddings. */
  size: 'small' | 'medium' | 'large';
}

const SIZE = {
  small: { font: 14, padX: 8, gap: 16 },
  medium: { font: 16, padX: 8, gap: 16 },
  large: { font: 20, padX: 16, gap: 16 },
};

/** A search field's resting width. It collapses to an icon at narrow widths,
 *  which is the consumer's job — here it is the expanded one, because that is
 *  what has to fit. */
const SEARCH_WIDTH = 240;
const AVATAR_WIDTH = 32;
const BRAND_WIDTH = 120;

/** Everything the bar has to hold, in pixels. */
export function estimateBarWidth(c: BarContent): number {
  const s = SIZE[c.size];
  const tabs = c.tabs.reduce((w, t) => w + itemWidth(t, s.font, s.padX), 0)
    + Math.max(0, c.tabs.length - 1) * s.gap;
  const actions = c.actions.reduce((w, a) => w + itemWidth(a, s.font, s.padX), 0)
    + Math.max(0, c.actions.length - 1) * s.gap;
  const extras =
    (c.hasSearch ? SEARCH_WIDTH + s.gap : 0) +
    (c.hasAvatar ? AVATAR_WIDTH + s.gap : 0) +
    (c.hasBrand ? BRAND_WIDTH + s.gap : 0);
  return tabs + actions + extras;
}

/**
 * Whether the tabs fit inline at this width.
 *
 * `available` is the viewport minus the page's margins — the bar's own
 * padding is that margin, so the content box is what is left.
 */
export function tabsFit(c: BarContent, available: number): boolean {
  return estimateBarWidth(c) <= available;
}
