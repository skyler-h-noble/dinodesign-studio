/**
 * The top bar of an add-on page (Charts, Hero Generator): the add-on's name,
 * centered, and nothing else — no menu, drawer or search.
 *
 * It is the lib AppBar, whose own data-theme="App-Bar" picks up the bar color
 * the user chose for their system — the page is wrapped in that system's CSS,
 * so nothing here names a color. Passing children replaces the bar's default
 * contents (hamburger, search, login). Sticky, so it stays in view; the pages'
 * sticky previews sit below it (ADD_ON_NAV_HEIGHT).
 *
 * AddOnBackLink is the link back to the user's hosted design system, which
 * sits under the bar at the top of the page.
 */
import { AppBar, H3, Link } from '@omni-design/components';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { componentDocsIndexUrl } from '../../utils/docs/docsLink';

/** Room the sticky bar takes, for sticky content below it (the bar is 64). */
export const ADD_ON_NAV_HEIGHT = 64;

export default function AddOnTopNav({ title }: { title: string }) {
  return (
    // Layout primitive: keeps the bar pinned while the page scrolls.
    <div style={{ position: 'sticky', top: 0, zIndex: 10 }}>
      <AppBar sx={{ justifyContent: 'center' }}>
        {/* The page's one h1, at H3's size so it sits in the 64px bar. */}
        <H3 component="h1" width="hug">{title}</H3>
      </AppBar>
    </div>
  );
}

export function AddOnBackLink({ uuid }: { uuid?: string }) {
  if (!uuid) return null;
  return (
    <Link href={componentDocsIndexUrl(uuid)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
      <ArrowBackIcon fontSize="small" aria-hidden="true" />
      Your Omni Design System
    </Link>
  );
}
