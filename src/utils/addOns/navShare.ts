/**
 * An Adaptive Nav back into the studio — the same way in as a chart, a hero or
 * a bento: a link carrying the whole setup in #spec=. Everything the page
 * decides travels; the uploaded brand does not (it stays local, like the
 * published add-on), and neither does preview-only state such as Signed in.
 */
import { encodeChartSpec, decodeChartSpec } from './charts/chartShare';

export const NAV_SHARE_VERSION = 'adaptive-nav/1';

export interface NavShareState {
  version: typeof NAV_SHARE_VERSION;
  options: unknown;
  mobile: unknown;
  breakpoints: unknown;
  /** The user's per-breakpoint overrides; the seed fills the rest. */
  matrix: unknown;
  bottomBarAt: unknown;
  tabs: unknown;
  actions: unknown;
  accountItems: unknown;
  dialItems: unknown;
  componentSize: 'small' | 'medium' | 'large';
  selectedTab?: string;
}

export const encodeNavState = (s: NavShareState): string => encodeChartSpec(s);

/** The state in a link (or a bare #spec= fragment), or null when there is
 *  none or it is not an Adaptive Nav — a broken link leaves the defaults. */
export function readNavState(text: string): NavShareState | null {
  const m = text.match(/[#&]spec=([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const s = decodeChartSpec(m[1]) as NavShareState;
    return s && typeof s === 'object' && s.version === NAV_SHARE_VERSION ? s : null;
  } catch {
    return null;
  }
}
