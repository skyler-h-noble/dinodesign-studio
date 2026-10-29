/**
 * The Adaptive Nav as ONE component, across every width.
 *
 * The desktop arrangement (navDefinition) and the phone arrangement
 * (mobileNavDefinition) used to be two definitions, and the page compiled
 * whichever the selected breakpoint called for — so a published spec was only
 * ever the desktop nav or the phone nav, never the nav that switches between
 * them. Here both sit under one root, each gated by a WIDTH condition:
 *
 *   Adaptive-Nav/Desktop   the top-bar arrangement (tabs / menu button, rail, hero)
 *   Adaptive-Nav/Mobile    the phone arrangement (top bar, bottom bar, toolbar)
 *
 * Exactly one is on at each breakpoint — Mobile below 600, and at any tablet
 * breakpoint where the bottom bar was chosen. Two booleans rather than one for
 * the same reason Show-Tabs and Show-Menu-Button are two: Figma binds
 * `visible` to a boolean and cannot invert one.
 *
 * Conditions shared by both arrangements — Show-Brand, Signed-In, the account
 * menu — are one variable each, so the brand or the session is decided once
 * for every width.
 */
import { navDefinition, type NavOptions } from './navDefinition';
import { mobileNavDefinition, type MobileOptions } from './mobileNav';
import { isMobileBreakpoint, offersBottomBar, type Breakpoint } from './breakpoints';
import type { ComponentDefinition, ConditionDef } from './defineComponent';

export const DESKTOP_CONDITION = 'Adaptive-Nav/Desktop';
export const MOBILE_CONDITION = 'Adaptive-Nav/Mobile';

export const ARRANGEMENT_CONDITIONS: Record<string, ConditionDef> = {
  [DESKTOP_CONDITION]: {
    description: 'The top-bar arrangement — tabs or a menu button, a rail, a hero. The counterpart of Mobile.',
    trigger: 'device',
  },
  [MOBILE_CONDITION]: {
    description: 'The phone arrangement — a top bar, a bottom bar or a toolbar. On below 600, and at tablet widths that chose the bottom bar.',
    trigger: 'device',
  },
};

export function adaptiveNavDefinition(desktop: NavOptions, mobile: MobileOptions): ComponentDefinition {
  const d = navDefinition(desktop);
  // Both arrangements wear the design system's App-Bar / Nav-Bar themes.
  const m = mobileNavDefinition(mobile);
  return {
    id: 'adaptive-nav',
    label: 'Adaptive Nav',
    schemaVersion: 1,
    conditions: { ...d.conditions, ...m.conditions, ...ARRANGEMENT_CONDITIONS },
    root: {
      name: 'Adaptive Nav',
      kind: 'stack',
      direction: 'column',
      width: 'fill',
      height: 'fill',
      children: [
        { ...d.root, name: 'Desktop', presence: { when: DESKTOP_CONDITION } },
        { ...m.root, name: 'Mobile', presence: { when: MOBILE_CONDITION } },
      ],
    },
  };
}

/** Whether a breakpoint uses the phone arrangement: always below the mobile
 *  line, and where the bottom bar was chosen above it. */
export const mobileAt = (bp: Breakpoint | undefined, bottomBarAt: Record<string, boolean>): boolean =>
  !!bp && (isMobileBreakpoint(bp) || (!!bottomBarAt[bp.id] && offersBottomBar(bp)));

/** The Desktop / Mobile rows of the matrix — set by the arrangement choice,
 *  never by a switch, so they are written over whatever the matrix holds. */
export function arrangementRows(
  breakpoints: Breakpoint[],
  bottomBarAt: Record<string, boolean>,
): Record<string, Record<string, boolean>> {
  const mobileRow: Record<string, boolean> = {};
  const desktopRow: Record<string, boolean> = {};
  for (const bp of breakpoints) {
    const m = mobileAt(bp, bottomBarAt);
    mobileRow[bp.id] = m;
    desktopRow[bp.id] = !m;
  }
  return { [MOBILE_CONDITION]: mobileRow, [DESKTOP_CONDITION]: desktopRow };
}
