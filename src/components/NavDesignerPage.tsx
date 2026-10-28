/**
 * Design the adaptive nav, then publish it as an add-on.
 *
 * What this edits is a ComponentDefinition — not a Figma file and not JSX. The
 * definition is the source both targets compile from, so a choice made here
 * reaches the Figma component and the React one as the same decision rather
 * than as two things that have to be kept in step.
 *
 * The preview is the definition rendered by DefinitionRenderer, with each slot
 * filled by the real library component (Tabs, Rail, BottomNavigation,
 * SearchField…) at the breakpoint's own width — the layout comes from the
 * definition, the parts from the lib, so neither is a second implementation.
 *
 * MISSING-LIB-COMPONENT tags in this file:
 *   FileInput — choosing a brand mark from disk (hidden input behind a Button)
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import AddOnTopNav from './addOns/AddOnTopNav';
import { systemExists } from '../utils/docs/systemCss';
import { libraryPageUrl } from '../utils/docs/docsLink';
import { liveSystemCss, type LiveSystemCss } from '../utils/addOns/charts/liveSystemCss';
import { encodeNavState, readNavState, NAV_SHARE_VERSION } from '../utils/addOns/navShare';
import { adaptiveNavDefinition, arrangementRows, ARRANGEMENT_CONDITIONS } from '../utils/addOns/adaptiveNav';
import { navCode } from '../utils/addOns/navCode';
import {
  Button, H1, H2, H3, H4, Body, BodySmall, Caption, Label,
  VStack, HStack, Card, SelectableCard, Divider, SwitchInput, Chip, CodeBlock, Section,
  Tabs, TabList, Tab, TabPanel, TextArea, TextField, Alert, Modal, RadioGroup, Avatar, Checkbox,
  Rail, BottomNavigation, MenuItem, MenuDivider, Ratio, SearchField, Subtitle, LabelExtraSmall,
  OmniDesignProvider, Link, ToggleButtonGroup,
} from '@omni-design/components';
import {
  navDefinition, defaultNavMatrix, applyExclusivity, NAV_EXCLUSIVE,
  NAV_LAYOUTS, type NavLayout, type NavOptions,
} from '../utils/addOns/navDefinition';
import {
  DEFAULT_BREAKPOINTS, sortBreakpoints, displayBreakpoints, primaryBreakpoint,
  validateBreakpoints, breakpointRange, isMobileBreakpoint,
  completeMatrix, conditionsAt, offersBottomBar,
  type Breakpoint, type ConditionMatrix,
} from '../utils/addOns/breakpoints';
import ScaledPreview from './ScaledPreview';
import {
  mobileNavDefinition, MOBILE_LAYOUTS, maxItemsWithFab, bottomItemCounts, bottomBarItems,
  type MobileLayout, type MobileOptions,
} from '../utils/addOns/mobileNav';
import TuneIcon from '@mui/icons-material/Tune';
import {
  loadBrandAsset, releaseBrandAsset, BRAND_TYPES, type BrandAsset,
} from '../utils/addOns/brandAsset';
import {
  DEFAULT_TABS, DEFAULT_ACTIONS, buttonVariant, itemProblems, sessionOf,
  type NavItem, type NavButtonItem, type Session,
} from '../utils/addOns/navContent';
import {
  DEFAULT_ACCOUNT_MENU, ACCOUNT_MENU_CONDITION, SIGNED_IN_CONDITION, SIGNED_OUT_CONDITION, type AccountMenuItem,
} from '../utils/addOns/accountMenu';
import NavItemEditor from './NavItemEditor';
import AccountMenuEditor from './AccountMenuEditor';
import SpeedDialEditor from './SpeedDialEditor';
import { DEFAULT_SPEED_DIAL, type SpeedDialItem } from '../utils/addOns/speedDial';
import NavIconGlyph from './NavIconGlyph';
import { loadBrand, type Brand } from '../utils/addOns/brand/brandStore';
import { BRAND_CSS, BRAND_COLOR_TOKEN, svgDataUrl } from '../utils/addOns/brand/brandSpec';
import { toAddonSpec, conditionsUsedBy } from '../utils/addOns/toAddonSpec';
import { contentInsets, contentInsetCSS } from '../utils/addOns/contentInsets';
import { tabsFit } from '../utils/addOns/barFit';
import { NAV_METRICS } from '../utils/componentSize';
import NavLayoutPreview from './NavLayoutPreview';
import DefinitionRenderer from './DefinitionRenderer';

/** The narrowest the sticky preview shrinks to.
 *
 *  Below about this a desktop nav's tabs and actions are a few pixels each,
 *  so the preview shows that something is there rather than what it is — and
 *  a preview you cannot read is worse than one that is simply out of the way. */
const PREVIEW_MIN_WIDTH = 300;

/** How far you scroll past the preview before it reaches that floor. Roughly
 *  a screenful, so the shrink reads as a response to scrolling rather than as
 *  a jump the moment it sticks. */
const SHRINK_OVER = 600;

/** The viewport width at which the tools and the preview sit side by side.
 *
 *  Below it they stack, because 40% of a narrow screen is too little for the
 *  controls and 60% is too little for a desktop nav at true width. */
const TWO_COL_MIN = 1100;

export default function NavDesignerPage() {
  const [options, setOptions] = useState<NavOptions>({
    layout: 'brand-left', search: true, actions: true, avatar: true,
  });

  const set = <K extends keyof NavOptions>(k: K, v: NavOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  /* Recomputed from the definition rather than tracked alongside it, so what
     is shown is always what would be published. */
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>(DEFAULT_BREAKPOINTS);
  /* Opens on the WIDEST. Design runs desktop-down: the wide layout is the one
     being designed and the narrow ones are what it degrades into. */
  const [selectedBp, setSelectedBp] = useState<string>(primaryBreakpoint(DEFAULT_BREAKPOINTS)!.id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /* Mobile choices are kept SEPARATELY from the desktop ones. They are
     different layouts with different options, so one shared object would need
     every field to be optional and every read to guess which set it is in. */
  const [mobile, setMobile] = useState<MobileOptions>({
    layout: 'top-and-bottom', brandAlign: 'left', showMenu: true,
    topActions: 1, showAvatar: true, itemCount: 4, showLabels: true,
    /* The bar defaults to FLOATING, and that is not decoration.
       
       Fixed and across, a toolbar IS a bottom bar — same component, same
       three variant axes, same place on the screen — so picking "top bar and
       toolbar" gave you something indistinguishable from "top and bottom" and
       the two options looked broken. The difference between them is what goes
       IN the bar (actions rather than navigation), which the preview cannot
       show on its own. Floating makes the pick visibly do something, and it
       is the arrangement a toolbar of actions usually wants anyway.
       
       One style for both bars, because both are the Nav-Bar component. When
       this was "toolbarStyle" the preview still applied it to the bottom bar,
       so a top-and-bottom nav rendered a floating pill inside a frame that
       the definition had painted as a fixed band. */
    barStyle: 'floating',
  });
  const setMobileOpt = <K extends keyof MobileOptions>(k: K, v: MobileOptions[K]) =>
    setMobile((m) => ({ ...m, [k]: v }));
  const [brand, setBrand] = useState<BrandAsset | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const brandInput = useRef<HTMLInputElement>(null);
  /* ?ds=<id>: that design system's saved brand (the Brand add-on) — the logo
     in Brand, the mark in Condensed-Brand, drawn as the adaptive mask the
     code uses. Preview only, like an upload: it never reaches the spec. */
  const [savedBrand, setSavedBrand] = useState<Brand | null>(null);
  /* /add-ons/nav/<design system id>, as every other add-on. ?ds= is the old
     way in and redirects there, so existing links keep working. */
  const { uuid } = useParams<{ uuid?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const ds = searchParams.get('ds');
    if (!uuid && ds && /^[0-9a-f-]{36}$/i.test(ds)) navigate(`/add-ons/nav/${ds.toLowerCase()}${window.location.hash}`, { replace: true });
  }, [uuid, searchParams, navigate]);
  const [exists, setExists] = useState<boolean | null>(null);
  /* That system's published CSS, so the page — preview included — draws in its
     brand, as Bento and Hero do. */
  const [systemCss, setSystemCss] = useState<LiveSystemCss | null>(null);
  useEffect(() => {
    let live = true;
    if (!uuid) { setExists(false); setSavedBrand(null); setSystemCss(null); return; }
    systemExists(uuid).then((ok) => { if (live) setExists(ok); });
    liveSystemCss(uuid).then((c) => { if (live) setSystemCss(c); });
    loadBrand(uuid.toLowerCase()).then((b) => { if (live) setSavedBrand(b); });
    return () => { live = false; };
  }, [uuid]);

  /* Fills the Brand slots locally. It does NOT reach toAddonSpec: a published
     add-on is imported by every design system, so a brand baked into one would
     put this logo in everyone's file. Brand is a slot for exactly that reason.

     Rendered as an <img>, never inlined — an uploaded SVG is a document that
     can carry scripts and event handlers, and inlining one would run them with
     this page's origin. In an <img> it is treated as an image: no scripts, no
     external fetches, no reach into the document. */
  const [tabs, setTabs] = useState<NavItem[]>(DEFAULT_TABS);
  /* Which tab reads as selected. A tab strip with none selected is a state a
     real nav is never in, and the indicator is the thing that makes a tab
     legible as a tab rather than a text button. */
  const [selectedTab, setSelectedTab] = useState<string>(DEFAULT_TABS[0].id);
  const [actions, setActions] = useState<NavButtonItem[]>(DEFAULT_ACTIONS);
  const [editing, setEditing] = useState<{ kind: 'tab' | 'button'; id: string } | null>(null);

  /* The account menu's rows, and whether the preview is showing them.
     
     Kept OUTSIDE the desktop and mobile option sets, both of them, because the
     menu is the same menu on either — a phone's account menu is not a second
     design. Two copies would be the two that disagreed.
     
     `menuOpen` is preview state, not a condition value. The condition exists
     and is published, but what it holds is decided by a click rather than by a
     width, so storing it in the breakpoint matrix would record "open at lg" as
     a design decision. */
  /* Which Component-Size mode everything in the nav resolves at. One control
     for the whole thing, not a size per component: the point of the mode is
     that a rail, a bar and the buttons in it move together, and three pickers
     would let them disagree in ways no design system has a name for. */
  const [componentSize, setComponentSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [accountItems, setAccountItems] = useState<AccountMenuItem[]>(DEFAULT_ACCOUNT_MENU);
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  /* The speed dial's actions, kept the way the account menu's rows are: a
     list edited as a list, local to the page, filling what the component
     opens. */
  const [dialItems, setDialItems] = useState<SpeedDialItem[]>(DEFAULT_SPEED_DIAL);
  const [dialEditorOpen, setDialEditorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /* Signed in, by default. A session state rather than a width, so it is
     one value for the whole nav — and true is the state a product is in
     most of the time, so it is the one to design in. */
  const [signedIn, setSignedIn] = useState(true);
  /* Scrolled past the hero, for the preview — the condensed state. A scroll
     position, so one value for the whole nav, like Signed in. */
  const [scrolled, setScrolled] = useState(false);

  const editingItem = editing
    ? (editing.kind === 'tab' ? tabs : actions).find((i) => i.id === editing.id) ?? null
    : null;

  const updateItem = (next: NavItem | NavButtonItem) => {
    if (!editing) return;
    if (editing.kind === 'tab') setTabs((xs) => xs.map((i) => (i.id === next.id ? next : i)));
    else setActions((xs) => xs.map((i) => (i.id === next.id ? (next as NavButtonItem) : i)));
  };

  const removeItem = () => {
    if (!editing) return;
    if (editing.kind === 'tab') setTabs((xs) => xs.filter((i) => i.id !== editing.id));
    else setActions((xs) => xs.filter((i) => i.id !== editing.id));
    setEditing(null);
  };

  /* Every item is a real control in the preview, and clicking one opens its
     settings. Editing what you just pointed at is the whole affordance —
     a list elsewhere would need the two kept in step, and they would not be.
     
     A problem shows on the item itself rather than in a summary: an unnamed
     icon-only button is invisible without a screen reader, so the only place
     the warning helps is where the thing is. */
  const itemChrome = (problems: string[]): CSSProperties => ({
    cursor: 'pointer',
    borderRadius: 'var(--Sizing-1, 4px)',
    outline: problems.length ? '2px solid var(--Buttons-Warning-Border)' : undefined,
    outlineOffset: 2,
  });

  /* Derived above the slot content rather than beside the rest, because which
     VOCABULARY applies decides what the slots hold: below the tablet cluster
     the avatar's options come from the mobile set, not the desktop one. */
  const problems = validateBreakpoints(breakpoints);
  const sorted = sortBreakpoints(breakpoints);
  const shown = displayBreakpoints(breakpoints);
  const current = sorted.find((b) => b.id === selectedBp);

  /* Which VOCABULARY this breakpoint is designing in.
   *
   * Below the mobile line it is always the bottom-bar set — a phone nav is a
   * different shape, not a narrower one. Between there and the bottom-bar
   * ceiling it is a CHOICE, recorded per breakpoint: a tablet can have a top
   * bar with tabs or a bottom bar within thumb reach, and both are real. The
   * bottom-bar layouts were simply unreachable above 599 before, so md and sm
   * could not have one at all. */
  const [bottomBarAt, setBottomBarAt] = useState<Record<string, boolean>>({});
  const onMobile = isMobileBreakpoint(current) || !!bottomBarAt[selectedBp];
  const canOfferBottomBar = offersBottomBar(current);

  /* One menu, asked about through whichever option set is in play. */
  const avatarOpensMenu = onMobile ? !!mobile.avatarMenu : !!options.avatarMenu;

  const { definition, spec } = useMemo(() => {
    /* Which VOCABULARY applies is decided by the breakpoint, not by a toggle.
       Below the tablet cluster a nav is a different component shape, so the
       definition comes from a different builder rather than the same one with
       parts switched off. */
    const def = onMobile
      ? mobileNavDefinition({ ...mobile, theme: options.theme, surface: options.surface })
      : navDefinition(options);
    /* tokensUsed is no longer read here — the token list came out with the
       card that showed it. It stays exported because the publish script prints
       it before writing, which is where the check actually matters: a missing
       variable imports unbound and silently looks like a design decision. */
    return { definition: def, spec: toAddonSpec(def) };   // spec re-derived below with the table
  }, [options, mobile, onMobile]);

  /* The nav across EVERY width: both arrangements under one root, switched by
     Adaptive-Nav/Desktop and /Mobile per breakpoint. This is what is
     published, matrixed and previewed; `definition` above stays the
     arrangement being edited at this breakpoint, for the controls. */
  const combined = useMemo(() => adaptiveNavDefinition(options, mobile), [options, mobile]);

  /* What the nav occupies, so the page can keep clear of it. Derived from the
     definition rather than measured, so it follows the arrangement and the
     size mode instead of a number read off the screen once. */
  const insets = useMemo(() => contentInsets(definition), [definition]);

  /* How tall a hero may get before it swallows the screen. A share of the
     device rather than a fixed number: the cap exists so the tab strip stays
     visible, and what counts as "visible" depends on the frame. */
  const heroCap = Math.round((current?.deviceHeight ?? 800) * 0.55);


  /* The nav metrics, resolved for the size on the picker.
   *
   * The preview had none of them. tok() emits var(--Rail-Width) with no
   * fallback, so a fixed width bound to it collapsed to nothing and the brand
   * block hugged instead of spanning the rail — the layout looked broken and
   * the definition was right.
   *
   * These land on the preview wrapper rather than at :root so the picker
   * actually drives them: switching size rewrites the same three names, which
   * is exactly what switching a Component-Size mode does in Figma. The
   * VALUES come from NAV_METRICS, the same table the CSS export and the Figma
   * payload read, so the preview cannot show a size the export does not
   * produce. */
  /* The preview shrinks as it sticks.
   *
   * A sticky preview that keeps its full height covers most of the screen,
   * and the controls it exists to show the effect of are underneath it. So it
   * gives ground as you scroll past — down to a floor rather than to nothing,
   * because below about 300px a nav stops being legible and the preview stops
   * being worth its space at all.
   *
   * Measured from the wrapper's own offset rather than window.scrollY: the
   * preview is one card in a column and what matters is how far PAST it the
   * page has gone, which is the same number whatever sits above it. */
  /* A SENTINEL, not the sticky element itself.
   *
   * A stuck element's top is pinned at 0 — that is what sticky means — so it
   * can never report how far past it the page has gone. Measuring it gave 0
   * at every scroll position and the preview never shrank. A zero-height
   * marker just above it keeps scrolling normally, and how far ITS top has
   * gone negative is exactly the distance the preview has been stuck for. */
  /* Whether there is room for the split. Below it the preview would be 40% of
     a narrow screen, which is less use than having it above the controls. */
  const [twoCol, setTwoCol] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${TWO_COL_MIN}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${TWO_COL_MIN}px)`);
    const on = () => setTwoCol(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [shrink, setShrink] = useState(0);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      const past = Math.max(0, -el.getBoundingClientRect().top);
      setShrink(Math.min(1, past / SHRINK_OVER));
    };
    /* Cancel and reschedule, never "skip if one is pending".
       
       The skip version wedges: if a scheduled frame is dropped — a background
       tab, a long task — the pending flag is never cleared and every scroll
       after it is ignored. The preview froze at whatever size it happened to
       be, which looked like the shrink not working at all rather than like a
       stuck listener. */
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const metricVars = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [name, byMode] of Object.entries(NAV_METRICS)) {
      out[`--${name.replace(/ /g, '-')}`] = `${byMode[componentSize]}px`;
    }
    /* The page's side margin, which is the BAR's side padding too — it comes
       from the breakpoint rather than the size mode, because it is a property
       of the screen rather than of the components on it. */
    if (current?.margin !== undefined) out['--Margin'] = `${current.margin}px`;
    return out as CSSProperties;
  }, [componentSize, current?.margin]);

  const slotContent = useMemo(() => {
    const mark = brand ? (
      <img src={brand.url} alt="" style={{ height: 24, width: 'auto', display: 'block' }} />
    ) : null;
    /* The saved brand, as the code draws it: one color from the bar's surface. */
    const saved = (slot: 'logo' | 'mark') => {
      const svg = savedBrand?.[slot]; const m = savedBrand?.meta[slot];
      if (!svg || !m) return null;
      return (
        <span className="omni-brand" role="img" aria-label={savedBrand!.meta.name || 'Brand'} style={{
          '--omni-brand-src': `url("${svgDataUrl(svg)}")`, '--omni-brand-aspect': String(m.aspect), '--omni-brand-height': '24px',
          ...(savedBrand!.meta.color !== 'brand' ? { '--omni-brand-color': BRAND_COLOR_TOKEN[savedBrand!.meta.color] } : {}),
        } as CSSProperties} />
      );
    };
    const savedLogo = saved('logo') || saved('mark');
    const savedMark = saved('mark') || saved('logo');

    /* COMPONENT SIZE REACHES EVERY PART. Size is a Component-Size MODE — one
       setting for the whole nav — so every lib component in the preview takes
       it: tabs, action buttons, the avatar, the menu button, search, the rail.
       The tabs, actions and avatar were pinned to "small", so the picker
       moved the bar's height and the rail's width and left the controls in
       them exactly as they were, which read as the picker doing nothing.
       Button sizes the avatar inside it for its own size, so the face needs
       no mapping of its own. */
    /* The library's own Tabs, not buttons dressed up. A tab's treatment is a
       SELECTOR — an indicator bar on one edge and a track along the rest, with
       the selected one carrying --Text and the others --Quiet — and none of
       that comes out of a button variant.
       
       Clicking still opens the editor, which is why the strip is controlled
       here rather than left to manage its own selection: selecting a tab and
       editing it are the same gesture. */
    /* One helper for both, because a tab and a button carry the same five
       boolean props — the difference is the treatment, not the content. */
    const deco = (i: NavItem, end: 'start' | 'end') => {
      const wantsIcon = end === 'start' ? i.startIcon : i.endIcon;
      const iconName = end === 'start' ? i.startIconName : i.endIconName;
      const wantsAvatar = end === 'start' ? i.startAvatar : i.endAvatar;
      if (wantsAvatar) {
        return (
          <Avatar
            size="x-small"
            alt=""
            initials={i.avatarType === 'initials' ? (i.avatarInitials || '?') : undefined}
            defaultPhoto={i.avatarType !== 'icon'}
          />
        );
      }
      return wantsIcon ? <NavIconGlyph name={iconName} /> : undefined;
    };

    const tabStrip = (
      <Tabs
        value={selectedTab}
        size={componentSize}
        onChange={(v: string) => {
          setSelectedTab(v);
          setEditing({ kind: 'tab', id: v });
        }}
      >
        <TabList>
          {tabs.map((t) => {
            const problems = itemProblems(t);
            return (
              <Tab
                key={t.id}
                value={t.id}
                iconOnly={!t.text}
                /* The accessible name survives the text being switched off —
                   that is the whole reason `label` is kept separately from
                   whether it is shown. */
                aria-label={!t.text ? t.label || 'Unnamed tab' : undefined}
                startDecorator={deco(t, 'start')}
                endDecorator={deco(t, 'end')}
                sx={problems.length
                  ? { outline: '2px solid var(--Buttons-Warning-Border)', outlineOffset: 2 }
                  : undefined}
              >
                {t.text ? t.label : null}
              </Tab>
            );
          })}
        </TabList>
      </Tabs>
    );

    /* One renderer, three groups. The buttons differ only in which session
       they belong to, so splitting the LIST rather than writing three
       renderers keeps a change to a button's look in one place. */
    const groupFor = (which: Session) => actions.filter((a) => sessionOf(a) === which);

    const renderActions = (list: NavButtonItem[]) => (
      <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center' }}>
        {list.map((a) => {
          const problems = itemProblems(a);
          const start = deco(a, 'start');
          const end = deco(a, 'end');
          return (
            <Button
              key={a.id}
              variant={buttonVariant(a.color, a.treatment)}
              size={componentSize}
              iconOnly={!a.text}
              aria-label={!a.text ? a.label || 'Unnamed button' : undefined}
              onClick={() => setEditing({ kind: 'button', id: a.id })}
              style={itemChrome(problems)}
            >
              {start}
              {a.text ? a.label : null}
              {end}
            </Button>
          );
        })}
      </HStack>
    );

    /* The lib's Avatar, not a circle drawn here. A stand-in would have its own
       size, radius and border, and would drift from the real one the moment
       either changed — the preview's whole claim is that it renders the same
       components the nav will. */
    /* The same avatar size Button gives an avatar inside it at this size
       (small → 16, medium → 24, large → 40), so the face is the same whether
       or not it opens a menu — otherwise switching the menu on changed the
       avatar's size, which is not what the switch means. */
    /* Pixel sizes, matching Figma's Button-Avatar ramp (16 / 20 / 40). These
       named standalone sizes before, and 20 is not one of them — a medium
       component drew a 24px face where the design says 20. xxx-small has since
       been removed from the library for the same reason. */
    const faceSize = ({ small: 16, medium: 20, large: 40 } as const)[componentSize];
    const face = <Avatar size="custom" customSize={faceSize} alt="" />;

    /* With a menu behind it the avatar stops being a picture and becomes a
       control, so it is rendered as one: Button's `avatar` Type, which is the
       shape the converter and the accessibility check both already know.
       
       The BUTTON carries the name and the Avatar inside it carries none —
       alt="" above — or a screen reader announces the control twice. Naming
       the ACTION rather than the picture is the same rule: "Your account",
       never "avatar".
       
       Without a menu it stays exactly what it was. An avatar that opens
       nothing should not take focus. */
    const avatar = avatarOpensMenu ? (
      <Button
        avatar
        variant="ghost"
        size={componentSize}
        aria-label="Your account"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        {face}
      </Button>
    ) : face;

    /* The panel's ROWS. The panel itself — its corner, its surface, the fact
       that it hangs under the avatar — comes from the definition and is
       compiled to both targets; only what goes in it is supplied here, the
       same division as the tabs.
       
       The library's MenuItem and MenuDivider, not rows drawn here. Both work
       outside a Dropdown: the default context's setOpen is a no-op, which is
       all a preview needs, and using them is what keeps this panel the same
       height, padding and hover as every other menu in the system. */
    const accountMenu = (
      <VStack gap="0" style={{ minWidth: 180 }}>
        {accountItems.map((i) => (
          <div key={i.id}>
            {i.dividerBefore && <MenuDivider />}
            <MenuItem onClick={() => setAccountEditorOpen(true)}>
              {/* A SPAN, not an HStack.

                MenuItem wraps everything it is given in one Body, which
                renders a <p> — so a div inside it is invalid nesting that
                the browser silently repairs by breaking the row apart. An
                inline-flex span is valid inside a paragraph and is a
                layout primitive, which is the sanctioned exception.

                The gap sits here rather than on MenuItem for the same
                reason: MenuItem's own gap applies to its one child, the
                paragraph, so it never reaches the icon. MenuItem having no
                startDecorator the way Tab does is a real lib gap. */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--Sizing-1, 4px)' }}>
                {i.iconName ? <NavIconGlyph name={i.iconName} /> : null}
                {i.label || 'Unnamed'}
              </span>
            </MenuItem>
          </div>
        ))}
      </VStack>
    );

    /* The hero the sticky tabs sit under — the lib's Ratio, not a div with
       an aspectRatio on it.
       
       Ratio already IS this: fit="width" fills the parent and derives the
       height from the ratio, and an empty one renders the image placeholder,
       so the hand-drawn box was a second implementation of a shipped
       component down to the "Hero 16:9" caption standing in for the
       placeholder art.
       
       A placeholder rather than a picture, still: the hero is its own add-on,
       and putting an image here would suggest this one owns it. */
    /* 16:9 and CAPPED, because on a 1920x1080 screen those two are the same
       thing: a full-width 16:9 hero is exactly 1080 tall, so it fills the
       viewport and the sticky tabs it exists to sit above are below the fold.
       
       That is what a real full-bleed hero does — aspect-ratio with a
       max-height, and the image crops rather than the layout growing. 55% of
       the frame leaves the strip and the start of the page visible, which is
       the arrangement being designed. */
    const hero = (
      <Ratio
        ratio="16:9"
        fit="width"
        maxHeight={heroCap}
        sx={{ width: '100%', overflow: 'hidden' }}
      />
    );

    /* The page the nav sits against.
       
       Painted, and painted with the PAGE's own background rather than left
       blank: a nav is judged against what it sits on, and an empty white
       strip is not that. data-theme="Default" is the page inheriting the
       brand's own default, which is what a real app's content area does.
       
       Inset by whatever the nav occupies. A pinned bar leaves the flow, so
       without the inset the content starts underneath it and the first thing
       on the page is hidden — the bug every consumer of a sticky nav hits and
       then fixes by typing a measured number into their own CSS. The numbers
       come from the definition, so they follow the arrangement and the size
       mode instead of being copied out of devtools. */
    const page = (
      /* The lib's Section paints the region (theme + surface + Background),
         rather than a div setting data-surface and painting it by hand. */
      <Section as="div" theme="Default" surface="Surface" padding="0"
        style={{ flex: 1, minHeight: 120, width: '100%', boxSizing: 'border-box' }}>
        <div style={{
          height: '100%',
          border: '1px dashed var(--Border-Variant)',
          borderRadius: 'var(--Card-Radius, 8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Caption color="quiet">Content</Caption>
        </div>
      </Section>
    );

    /* The library's Rail and BottomNavigation, not shapes drawn here.
       
       Both already exist and both take an items array of { icon, label } — so
       a stand-in would be a second implementation of a component that ships,
       and it would drift from the real one the moment either changed. The
       preview's only real claim is that it renders what the nav will.
       
       Rail also takes a fabAction, which is the same composition argument the
       definition makes: a FAB beside a rail is a prop, not a variant. */
    const toNavItem = (t: NavItem) => ({
      icon: <NavIconGlyph name={t.startIconName || t.endIconName || 'Home'} />,
      label: t.text ? t.label : undefined,
    });
    const railItems = tabs.map(toNavItem);
    /* The bottom bar shows the COUNT asked for, not every tab. It mapped the
       tabs straight through, so the count buttons changed nothing — always
       four, because there are four tabs. */
    const barItems = bottomBarItems(
      tabs, mobile.itemCount ?? 4,
      (n) => ({ id: `stand-in-${n}`, label: `Item ${n}`, text: true }),
    ).map(toNavItem);

    const rail = (
      <Rail
        items={railItems}
        defaultValue={0}
        size={componentSize}
        expandable={!!options.railExpandable}
      />
    );

    /* The FAB goes INTO the component. It is an outlined ring among the
       items — at the end, or centred with the items split either side —
       which the lib's BottomNavigation renders from fabAction, the way Rail
       does. It was a solid Fab in a slot beside the bar, which is a different
       pattern from the design's and put a second filled circle next to the
       selected item's. */
    const bottomNav = (
      <BottomNavigation
        items={barItems}
        defaultValue={0}
        showLabels={mobile.showLabels !== false}
        variant={mobile.barStyle === 'floating' ? 'floating' : 'fixed'}
        /* Down belongs to the TOOLBAR. Read for every layout, a Down picked
           there turned the bottom bar of Top and bottom on its side. */
        orientation={mobile.layout === 'toolbar' && mobile.toolbarOrientation === 'vertical' ? 'vertical' : 'horizontal'}
        fabAction={mobile.fab ? {
          icon: <NavIconGlyph name="Add" />,
          label: 'Create',
          /* With actions the ring is a speed dial: the component opens the
             panel above the bar and lays the rows out in the ring's column.
             The rows are this page's list, the way the account menu's are. */
          ...(mobile.fabSpeedDial ? {
            /* Labels in place, inside the preview's scale. Portalled to the
               body they escaped the transform and drew at full size beside
               a phone shown at half of it. */
            disablePortal: true,
            actions: dialItems.map((d) => ({
              key: d.id, label: d.label, icon: <NavIconGlyph name={d.iconName || 'Add'} />,
            })),
          } : {}),
        } : undefined}
        fabPosition={mobile.fabPosition ?? 'center'}
        fixed={false}
      />
    );

    /* Icon-only ghost with the menu glyph — the control as it actually is,
       not a labelled placeholder. A slot showing the word "Menu-Button" tells
       you the slot exists; the real control tells you whether it sits right
       beside the brand at this width, which is the thing being designed. */
    const menuButton = (
      <Button iconOnly variant="ghost" size={componentSize} aria-label="Open navigation">
        <NavIconGlyph name="Menu" />
      </Button>
    );

    /* The last four slots that were rendering as empty dashed boxes.
       
       Every one has a real component in the library, so a placeholder was a
       claim the preview could not back: it says "something goes here" where
       the whole point of the preview is that it shows what the nav will
       actually be. A Search slot in particular is a sized control — it is the
       widest thing in the bar after the tabs, and a 56px dashed box told you
       nothing about whether the bar still fits. */
    const search = <SearchField size={componentSize} placeholder="Search" />;

    /* The page title, in the rail layouts where the bar's middle is a title
       rather than navigation. Subtitle rather than a heading: it names the
       current view, and a bar is not a section of the document. */
    const title = <Subtitle color="standard">Page title</Subtitle>;

    /* The brand, when none is uploaded. A neutral word rather than a dashed
       box: the slot is the customer's to fill, but the bar's geometry depends
       on something being in it, and an empty box makes the brand look narrower
       than any real mark. */
    const brandPlaceholder = <Subtitle color="quiet">Brand</Subtitle>;

    const out: Record<string, React.ReactNode> = {
      Tabs: tabStrip,
      Actions: renderActions(groupFor('always')),
      'Signed-Out-Actions': renderActions(groupFor('signed-out')),
      'Signed-In-Actions': renderActions(groupFor('signed-in')),
      Avatar: avatar,
      'Account-Menu': accountMenu,
      Page: page,
      Hero: hero,
      'Rail-Items': rail,
      'Nav-Item-Slot': bottomNav,
      'Menu-Button': menuButton,
      Search: search,
      /* The mobile top bar's action slots: the actions as icon buttons, the
         phone's form of them. They rendered as empty dashed boxes. */
      ...Object.fromEntries([0, 1, 2].map((k) => {
        const list = [...groupFor('always'), ...groupFor(signedIn ? 'signed-in' : 'signed-out')];
        const a = list[k];
        const fallback = [['Search', 'Search'], ['Notifications', 'Notifications'], ['MoreVert', 'More']][k];
        const icon = a ? (a.startIconName || a.endIconName || fallback[0]) : fallback[0];
        return [`Action-${k + 1}`, (
          <Button key={`ma${k}`} iconOnly variant="ghost" size={componentSize} aria-label={a ? a.label : fallback[1]}>
            <NavIconGlyph name={icon} />
          </Button>
        )];
      })),
      Title: title,
      Brand: brandPlaceholder,
      'Condensed-Brand': brandPlaceholder,
    };
    if (savedLogo) { out.Brand = savedLogo; out['Condensed-Brand'] = savedMark; }
    // An upload here wins: it is what is being tried right now.
    if (mark) { out.Brand = mark; out['Condensed-Brand'] = mark; }
    return out;
  }, [brand, savedBrand, tabs, actions, mobile.showLabels, mobile.barStyle, mobile.toolbarOrientation, mobile.fab, mobile.fabPosition, mobile.fabSpeedDial, dialItems, mobile.itemCount,
      avatarOpensMenu, menuOpen, accountItems, componentSize, insets, heroCap,
      options.railExpandable, signedIn]);
  const [scale, setScale] = useState(1);
  const [matrix, setMatrix] = useState<ConditionMatrix>({});

  /* The share link: everything this page decides, in #spec=. */
  const shareLink = useMemo(() => {
    const token = encodeNavState({
      version: NAV_SHARE_VERSION, options, mobile, breakpoints, matrix, bottomBarAt,
      tabs, actions, accountItems, dialItems, componentSize, selectedTab,
    });
    return `${window.location.origin}/add-ons/nav/${uuid || ''}#spec=${token}`;
  }, [options, mobile, breakpoints, matrix, bottomBarAt, tabs, actions, accountItems, dialItems, componentSize, selectedTab, uuid]);

  /* A share link's setup, put back — on arrival, or pasted into Import. */
  const applyNavState = (st: NonNullable<ReturnType<typeof readNavState>>) => {
    setOptions(st.options as NavOptions);
    setMobile(st.mobile as MobileOptions);
    const bps = st.breakpoints as Breakpoint[];
    if (Array.isArray(bps) && bps.length) {
      setBreakpoints(bps);
      setSelectedBp(primaryBreakpoint(bps)!.id);
    }
    setMatrix((st.matrix || {}) as ConditionMatrix);
    setBottomBarAt((st.bottomBarAt || {}) as Record<string, boolean>);
    if (Array.isArray(st.tabs)) setTabs(st.tabs as NavItem[]);
    if (Array.isArray(st.actions)) setActions(st.actions as NavButtonItem[]);
    if (Array.isArray(st.accountItems)) setAccountItems(st.accountItems as AccountMenuItem[]);
    if (Array.isArray(st.dialItems)) setDialItems(st.dialItems as SpeedDialItem[]);
    if (st.componentSize) setComponentSize(st.componentSize);
    if (st.selectedTab) setSelectedTab(st.selectedTab);
  };
  /* Opened from a share link: once, on arrival — a broken or foreign link
     leaves the defaults. */
  useEffect(() => {
    const st = readNavState(window.location.hash);
    if (st) applyNavState(st);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tab, setTab] = useState<'build' | 'code' | 'export' | 'import'>('build');
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');
  /* Where the Build grid starts on the page, so its columns can fill the rest
     of the window exactly. */
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridTop, setGridTop] = useState(240);
  useEffect(() => {
    const measure = () => {
      const el = gridRef.current;
      if (el) setGridTop(Math.round(el.getBoundingClientRect().top + window.scrollY));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tab, twoCol]);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);




  /* The full table, recompleted whenever the conditions or breakpoints change.
     A hole would read as FALSE downstream, silently hiding a part at whichever
     widths were never visited — so every cell is filled, and a cell that has
     never been touched takes the design's own default rather than a blanket
     true. */
  const full = useMemo(() => {
    /* Only what THIS arrangement gates on. Completing over every declared
       condition put a Show-Rail switch on a layout with no rail — and worse,
       switched ON, saying a part exists when it does not. */
    const names = conditionsUsedBy(combined);
    /* Seeded from the bar's own CONTENT, not from the width alone. Four long
       labels beside a search field and two actions overlap at 900 where four
       short ones fit comfortably — same breakpoint, different answer — so the
       threshold is a floor and this decides the rest. */
    const seed = defaultNavMatrix(names, sorted, (bp) => {
      const b = sorted.find((x) => x.id === bp.id);
      const available = bp.minWidth - 2 * (b?.margin ?? 24);
      return tabsFit({
        tabs,
        actions: options.actions ? actions : [],
        hasSearch: !!options.search,
        hasAvatar: !!options.avatar,
        hasBrand: options.layout !== 'hero',
        size: componentSize,
      }, available);
    });
    /* Desktop / Mobile come from the arrangement chosen per breakpoint (forced
       below 600), never from the matrix — they are written over it. */
    return { ...completeMatrix(matrix, names, sorted, (c, bp) => seed[c]?.[bp.id] ?? true),
      ...arrangementRows(sorted, bottomBarAt) };
  }, [combined, matrix, sorted, tabs, actions, options.actions, options.search,
      options.avatar, options.layout, componentSize, bottomBarAt]);

  const matrixActive = useMemo(() => conditionsAt(full, selectedBp), [full, selectedBp]);

  /* Whether the avatar is even there at this width. On the desktop bar it is a
     condition; on mobile the top bar's avatar is a plain option, so asking the
     matrix would come back false and the menu could never be opened. */
  const avatarPresent = onMobile
    ? !!mobile.showAvatar
    : !!options.avatar && !!matrixActive['Adaptive-Nav/Show-Avatar'];

  /* The one condition the matrix does not decide.
     
     It is published like the others — the panel binds to it, and a design
     system needs the variable — but no width makes it true, so its value in
     the preview comes from the click that opened it. Left to the matrix the
     panel would be shut at every breakpoint with no way to look at it. */
  const menuShown = menuOpen && avatarOpensMenu && avatarPresent && signedIn;
  const active = useMemo<Record<string, boolean>>(
    () => ({
      ...matrixActive,
      [ACCOUNT_MENU_CONDITION]: menuShown,
      [SIGNED_IN_CONDITION]: signedIn,
      /* Signed-out was never set, so a visitor's actions never showed. */
      [SIGNED_OUT_CONDITION]: !signedIn,
      'Adaptive-Nav/Show-Condensed': scrolled,
      'Adaptive-Nav/Hide-When-Condensed': !scrolled,
    }),
    [matrixActive, menuShown, signedIn, scrolled],
  );

  /* The spec, WITH the responsive table. Derived after the matrix because it
     needs it: a spec that binds visibility to a variable and says nothing
     about what that variable holds at each width leaves every decision made
     here unrecorded, while looking correct because the binding is present. */
  const fullSpec = useMemo(
    /* `studio` carries the setup as a link, so the spec pasted back into
       Import reopens it for editing — the plugin ignores the field. */
    () => ({ ...toAddonSpec(combined, { breakpoints: sorted, matrix: full }), studio: shareLink }),
    [combined, sorted, full, shareLink],
  );
  /* The same definition and table, as one React file. */
  const reactCode = useMemo(() => navCode({
    definition: combined, breakpoints: sorted, matrix: full, options, mobile,
    tabs, actions, accountItems, dialItems, componentSize, editLink: shareLink,
  }), [combined, sorted, full, options, mobile, tabs, actions, accountItems, dialItems, componentSize, shareLink]);
  /* Writes one cell, at this breakpoint, honouring exclusivity.
     
     Tabs and the menu button are one decision in two booleans: switching one
     on switches the other off, and switching the last one off is refused
     rather than allowed to leave a nav with no navigation in it.
     
     Each row is spread from the COMPLETED table rather than raw state, so
     setting a value at one breakpoint cannot blank the others by writing a row
     containing only the cell just touched. */
  const setCondition = (name: string, value: boolean) => {
    const atBp: Record<string, boolean> = {};
    for (const n of Object.keys(full)) atBp[n] = full[n][selectedBp];
    const next = applyExclusivity(atBp, name, value);

    setMatrix((m) => {
      const out = { ...m };
      for (const n of Object.keys(next)) {
        if (next[n] === atBp[n]) continue;
        out[n] = { ...full[n], [selectedBp]: next[n] };
      }
      return out;
    });
  };

  /* Split the conditions this arrangement uses into the exclusive set — one
     decision, so one radio group — and everything else, which are independent
     switches. Doing it here rather than in the markup keeps the two kinds of
     control from being decided inside a map. */
  const usedConditions = conditionsUsedBy(definition);

  const navigationChoice = useMemo(() => {
    const group = NAV_EXCLUSIVE.find((g) => g.every((n) => usedConditions.includes(n)));
    if (!group) return null;
    return {
      /* Whichever is on. Falling back to the first keeps the radio from
         showing nothing selected in a state the rules do not allow anyway. */
      value: group.find((n) => active[n]) ?? group[0],
      options: group.map((n) => ({
        value: n,
        label: n.split('/').pop()!.replace(/^Show-/, '').replace(/-/g, ' '),
      })),
    };
  }, [usedConditions, active]);

  const otherConditions = usedConditions.filter(
    (n) => !NAV_EXCLUSIVE.some((g) => g.includes(n)),
  );

  const range = breakpointRange(sorted, selectedBp);

  /* Lay out at the DEVICE's width — the screen the breakpoint stands for, as
     the Figma frame is (falling back to the range's lower bound).
     
     Not at the cap. A capped breakpoint is a narrow content column inside a
     wide window, and rendering only the column would hide the thing the cap
     exists for: how much empty space sits either side, and whether the nav
     still relates to the page under it. */
  const previewWidth = current?.deviceWidth ?? Math.max(range?.from ?? 0, 320);
  /* Which platform's type a tablet or phone draws in. Omni switches type on
     data-device, not width — iOS's nav label is 10px, Android's 12, Desktop's
     11 — so the preview has to say which device it is. Desktop is the :root
     default and sets none. */
  const previewDevice = !current || current.id === 'desktop' || current.minWidth >= 1280
    ? null
    : current.minWidth < 600
      ? (platform === 'ios' ? 'IOS-Mobile' : 'Android-Mobile')
      : (platform === 'ios' ? 'IOS-Tablet' : 'Android-Tablet');

  /* How wide the preview may shrink to, and how far it takes to get there.
     
     300 is the floor: narrower than that a desktop nav's tabs and actions are
     a few pixels each and the preview shows that something is there rather
     than what it is. The distance is a screenful-ish — long enough that the
     shrink reads as a response to scrolling rather than a jump. */
  const previewMinWidth = Math.min(PREVIEW_MIN_WIDTH, previewWidth);
  /* The scale cap, interpolated. ScaledPreview already takes the smaller of
     this and what fits, so at rest this is 1 and the box is as big as the
     card allows — the shrink only ever takes width away. */
  /* Only when stacked. Side by side the preview has a column of its own and
     is always in view, so shrinking it would give the space back to nothing —
     the point of the shrink is to stop a full-width preview covering the
     controls underneath it, and side by side there is nothing underneath. */
  const previewMaxScale = twoCol
    ? 1
    : 1 - shrink * (1 - previewMinWidth / previewWidth);

  const editBp = (id: string, patch: Partial<Breakpoint>) =>
    setBreakpoints((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const page = (
    <div data-theme="Default" data-surface="Surface"
      style={{ background: 'var(--Background)', color: 'var(--Text)', minHeight: '100vh' }}>
      {savedBrand && <style>{BRAND_CSS}</style>}
      <AddOnTopNav title="Adaptive Nav" uuid={uuid} exists={exists} basePath="/add-ons/nav" />
      <Section padding="32px 24px 64px">
        {/* Wider when split. 960 is a comfortable measure for one column of
            forms, and it was the cap when everything was one column — but
            against a 40/60 split it leaves the preview 560px to lay a 1920px
            nav out in, which is a third of the resolution the column exists
            to provide. */}
        <VStack
          gap="var(--Sizing-4)"
          style={{ maxWidth: twoCol ? 1760 : 960, margin: '0 auto' }}
        >
          <Body color="quiet">
            One component for every width. The desktop and phone arrangements sit in
            the same spec, and which one shows — and which parts of it — is decided
            per device, not by a variant.{' '}
            <Link href={libraryPageUrl('adaptive-nav', uuid)} target="_blank" rel="noopener">
              About the Adaptive Nav in the component library
            </Link>
          </Body>

          <Tabs value={tab} onChange={(v: typeof tab) => setTab(v)} sx={{ overflow: 'clip' }}>
            <TabList aria-label="Adaptive Nav">
              <Tab value="build">Build</Tab>
              <Tab value="code">Code</Tab>
              <Tab value="export">Export</Tab>
              <Tab value="import">Import</Tab>
            </TabList>
            <TabPanel value="build">
          <VStack gap="var(--Sizing-2)">

          {/* Breakpoint first, because everything below is scoped to it — the
              layout, the conditions and the preview all describe THIS width.
              Widest first: design runs desktop-down, and the narrow ones are
              what the wide layout degrades into. */}
          <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center' }}>
            {/* A segmented control, not tabs, so it does not read as a second
                tab bar under Build / Code / Export / Import — the same device
                picker Bento and Hero use. */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <ToggleButtonGroup value={selectedBp} onChange={(v: string) => v && setSelectedBp(v)} size="small" aria-label="Device">
                {shown.map((b) => (
                  <Button key={b.id} value={b.id} size="small">{b.label}</Button>
                ))}
              </ToggleButtonGroup>
            </div>
            {/* Tablets and phones draw in their platform's type. */}
            <ToggleButtonGroup value={platform} onChange={(v: 'ios' | 'android') => v && setPlatform(v)} size="small" aria-label="Platform">
              <Button value="ios" size="small">iOS</Button>
              <Button value="android" size="small">Android</Button>
            </ToggleButtonGroup>
            {/* The button owns the name; the icon carries none, or a screen
                reader announces the control twice. */}
            <Button
              iconOnly
              variant="ghost"
              aria-label="Breakpoint settings"
              onClick={() => setSettingsOpen(true)}
            >
              <TuneIcon />
            </Button>
            {problems.length > 0 && (
              <Chip label={`${problems.length} problem${problems.length === 1 ? '' : 's'}`} size="small" />
            )}
          </HStack>

          {/* Tools left, preview right.
              
              The preview used to sit in the middle of the column it is a
              preview OF, so every control below it needed a scroll to reach
              and a scroll back to check. Side by side it is simply always
              there, which is what a preview is for.
              
              40/60: the controls are forms and read fine narrow, while the
              preview is laying a desktop nav out at its true width and then
              scaling — every percent of that column is resolution. It
              collapses to one column below TWO_COL_MIN, where 40% of the
              screen is too little for either. */}
          <div
            ref={gridRef}
            style={{
              display: 'grid',
              gridTemplateColumns: twoCol ? '40fr 60fr' : '1fr',
              gap: 'var(--Sizing-4, 32px)',
              alignItems: twoCol ? 'stretch' : 'start',
              /* Split, the two columns fill the window under the tabs and each
                 scrolls on its own — the controls can be long, and neither
                 should drag the other. The same frame as Bento. */
              ...(twoCol ? { height: `calc(100vh - ${gridTop + 24}px)`, minHeight: 480 } : {}),
            }}
          >
            {/* The scroll is on a wrapper, not the stack: a scrolling flex
                column shrinks its children to fit instead of overflowing, and
                every card came out clipped to a sliver. */}
            <div style={twoCol ? { minWidth: 0, minHeight: 0, overflowY: 'auto', padding: 6 } : { minWidth: 0 }}>
            <VStack gap="var(--Sizing-4)" style={{ minWidth: 0 }}>
          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Layout</H4>
              <BodySmall color="quiet">
                For {current?.label}
                {range && (range.to === null
                  ? ` — ${range.from}px and up`
                  : ` — ${range.from}\u2013${range.to}px`)}
                {current?.maxWidth
                  ? `, content capped at ${current.maxWidth}px and ${current.align === 'center' ? 'centred' : 'left-aligned'}`
                  : ''}
              </BodySmall>
              {/* Diagrams rather than words: four layouts differ in where the
                  parts sit, which a name cannot show and a picture can. */}
              {/* A grid, so all four are the same size. Wrapping flex left the
                  last row wider than the first, which made two layouts look
                  more important than the others. */}
              {onMobile ? (
                /* A different SET, not the same four narrowed. Below the tablet
                   cluster reach decides the arrangement — navigation moves to
                   the bottom where a thumb lands — so offering the desktop
                   layouts here would offer arrangements that do not apply. */
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 'var(--Sizing-2, 8px)',
                }}>
                  {MOBILE_LAYOUTS.map((l) => (
                    <Button
                      key={l.id}
                      variant={mobile.layout === l.id ? 'default' : 'default-outline'}
                      onClick={() => setMobileOpt('layout', l.id as MobileLayout)}
                      style={{ justifyContent: 'flex-start', height: 'auto', padding: 'var(--Sizing-2, 8px)' }}
                    >
                      {l.label}
                    </Button>
                  ))}
                </div>
              ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 'var(--Sizing-2, 8px)',
                alignItems: 'stretch',
              }}>
                {NAV_LAYOUTS.map((l) => {
                  const selected = options.layout === l.id;
                  return (
                    <SelectableCard
                      key={l.id}
                      selected={selected}
                      aria-label={l.label}
                      /* The lib's selectable card: role, Enter / Space, the
                         selected ring and the states, instead of a div styled
                         to look like one. */
                      onClick={() => {
                        set('layout', l.id as NavLayout);
                        setBottomBarAt((m) => ({ ...m, [selectedBp]: false }));
                      }}
                    >
                      <VStack gap="var(--Sizing-1)">
                        <NavLayoutPreview layout={l.id as NavLayout} options={options} />
                        <Label>{l.label}</Label>
                      </VStack>
                    </SelectableCard>
                  );
                })}
              </div>
              )}
              <BodySmall color="quiet">
                {onMobile
                  ? MOBILE_LAYOUTS.find((l) => l.id === mobile.layout)?.description
                  : NAV_LAYOUTS.find((l) => l.id === options.layout)?.description}
              </BodySmall>

              {/* The bottom-bar arrangements, OFFERED rather than swapped in.
                  
                  Below 600 they are the only set — a phone nav is a different
                  shape, not a narrower one. From there to 1280 they sit beside
                  the top-bar ones, because a tablet can legitimately have
                  either and swapping would take the tabs away from md, which
                  is a width where they still fit.
                  
                  They were unreachable above 599 entirely, so md and sm could
                  not have a bottom bar at all. */}
              {canOfferBottomBar && !isMobileBreakpoint(current) && (
                <>
                  <Divider />
                  <Label>Or put navigation at the bottom</Label>
                  <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                    {MOBILE_LAYOUTS.filter((l) => l.id !== 'top-only').map((l) => (
                      <Button
                        key={l.id}
                        size="small"
                        variant={onMobile && mobile.layout === l.id ? 'default' : 'default-outline'}
                        onClick={() => {
                          setMobileOpt('layout', l.id as MobileLayout);
                          setBottomBarAt((m) => ({ ...m, [selectedBp]: true }));
                        }}
                      >
                        {l.label}
                      </Button>
                    ))}
                  </HStack>
                  <Caption color="quiet">
                    Reach is what puts navigation at the bottom, and a tablet held
                    in two hands has the same thumbs as a phone. Above 1280 it stops
                    being offered — on a screen nobody holds, the bottom edge is a
                    long way from where the pointer already is.
                  </Caption>
                </>
              )}

              {!onMobile && options.layout === 'rail' && (
                <>
                  <Divider />
                  <Label>Application Bar position</Label>
                  <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                    {([
                      ['beside-rail', 'Beside the rail'],
                      ['above-rail', 'Above the rail'],
                    ] as const).map(([id, label]) => (
                      <Button
                        key={id}
                        variant={(options.barPosition ?? 'beside-rail') === id ? 'default' : 'default-outline'}
                        size="small"
                        onClick={() => set('barPosition', id)}
                      >
                        {label}
                      </Button>
                    ))}
                  </HStack>
                  <Divider />
                  <SwitchInput
                    checked={!!options.railExpandable}
                    onChange={(e: { target: { checked: boolean } }) =>
                      set('railExpandable', e.target.checked)}
                    label="Rail can expand to a drawer"
                  />
                  <Caption color="quiet">
                    Adds the toggle that widens the rail into a labelled drawer. A
                    capability rather than a state — the rail still ships collapsed,
                    and whether the toggle exists at all is a decision about the
                    product rather than about the moment.
                  </Caption>
                  <Divider />
                  <Label>Title alignment</Label>
                  <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                    {([['left', 'Left'], ['center', 'Centred']] as const).map(([id, label]) => (
                      <Button
                        key={id}
                        variant={(options.titleAlign ?? 'left') === id ? 'default' : 'default-outline'}
                        size="small"
                        onClick={() => set('titleAlign', id)}
                      >
                        {label}
                      </Button>
                    ))}
                  </HStack>
                  <Caption color="quiet">
                    Centred balances the brand and the actions so the title is central
                    in the BAR. Centring it in the space left over would put it
                    wherever those two happen to differ in width.
                  </Caption>

                  <Caption color="quiet">
                    Beside: the rail runs the full height and the Application Bar
                    occupies the column to its right, so the brand sits above the
                    CONTENT. Above: the bar spans the full width and the rail starts
                    beneath it, so the brand sits above the rail too.
                  </Caption>
                </>
              )}
            </VStack>
          </Card>


          {onMobile && (
            <Card padding="medium">
              <VStack gap="var(--Sizing-3)">
                <H4>Mobile options</H4>

                {mobile.layout !== 'bottom-only' && (
                  <>
                    <Label>Top bar</Label>
                    <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                      {([['left', 'Brand left'], ['center', 'Brand centred']] as const).map(([id, l]) => (
                        <Button
                          key={id}
                          size="small"
                          variant={(mobile.brandAlign ?? 'left') === id ? 'default' : 'default-outline'}
                          onClick={() => setMobileOpt('brandAlign', id)}
                        >
                          {l}
                        </Button>
                      ))}
                    </HStack>
                    <HStack gap="var(--Sizing-3)" style={{ flexWrap: 'wrap' }}>
                      <SwitchInput
                        checked={mobile.showMenu !== false}
                        onChange={(e: { target: { checked: boolean } }) => setMobileOpt('showMenu', e.target.checked)}
                        label="Menu button"
                      />
                      <SwitchInput
                        checked={!!mobile.showAvatar}
                        onChange={(e: { target: { checked: boolean } }) => {
                          const on = e.target.checked;
                          setMobileOpt('showAvatar', on);
                          // The menu goes with it. Left open, the panel would
                          // float under a bar with nothing in it.
                          if (!on) setMenuOpen(false);
                        }}
                        label="Avatar"
                      />
                    </HStack>
                    {/* The SAME menu as the desktop bar's, from the same rows.
                        A phone's account menu is not a second design, and two
                        lists would be the two that disagreed. */}
                    {mobile.showAvatar && (
                      <HStack gap="var(--Sizing-3)" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <SwitchInput
                          checked={!!mobile.avatarMenu}
                          onChange={(e: { target: { checked: boolean } }) => {
                            const on = e.target.checked;
                            setMobileOpt('avatarMenu', on);
                            if (!on) setMenuOpen(false);
                          }}
                          label="Avatar opens a menu"
                        />
                        {mobile.avatarMenu && (
                          <Button
                            variant="default-outline"
                            size="small"
                            onClick={() => setAccountEditorOpen(true)}
                          >
                            Edit menu
                          </Button>
                        )}
                      </HStack>
                    )}
                    <HStack gap="var(--Sizing-3)" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <SwitchInput
                        checked={(mobile.topActions ?? 1) > 0}
                        onChange={(e: { target: { checked: boolean } }) =>
                          /* Zero IS off. A separate boolean beside a count
                             would let the two disagree — off with a count of
                             two, or on with none — and neither reads as a
                             state anyone chose. */
                          setMobileOpt('topActions', e.target.checked ? 1 : 0)}
                        label="Action buttons"
                      />
                      {(mobile.topActions ?? 1) > 0 && (
                        <HStack gap="var(--Sizing-1)">
                          {[1, 2, 3].map((n) => (
                            <Button
                              key={n}
                              size="small"
                              variant={(mobile.topActions ?? 1) === n ? 'default' : 'default-outline'}
                              onClick={() => setMobileOpt('topActions', n)}
                            >
                              {n}
                            </Button>
                          ))}
                        </HStack>
                      )}
                    </HStack>
                  </>
                )}

                {/* Style is offered wherever there is a bar at the bottom,
                    not only for the toolbar: the bottom bar is the same
                    Nav-Bar component and floats the same way. Orientation
                    stays the toolbar's alone — a navigation bar runs along
                    the bottom edge, and "down" would make it a rail. */}
                {mobile.layout !== 'top-only' && (
                  <>
                    <Divider />
                    <Label>{mobile.layout === 'toolbar' ? 'Toolbar' : 'Bottom bar'}</Label>
                    <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                      {([['fixed', 'Fixed'], ['floating', 'Floating']] as const).map(([id, l]) => (
                        <Button key={id} size="small"
                          variant={(mobile.barStyle ?? 'fixed') === id ? 'default' : 'default-outline'}
                          onClick={() => setMobileOpt('barStyle', id)}>{l}</Button>
                      ))}
                      {mobile.layout === 'toolbar' &&
                        ([['horizontal', 'Across'], ['vertical', 'Down']] as const).map(([id, l]) => (
                          <Button key={id} size="small"
                            variant={(mobile.toolbarOrientation ?? 'horizontal') === id ? 'default' : 'default-outline'}
                            onClick={() => setMobileOpt('toolbarOrientation', id)}>{l}</Button>
                        ))}
                    </HStack>
                  </>
                )}

                {mobile.layout !== 'top-only' && (
                  <>
                    <Divider />
                    <Label>{mobile.layout === 'toolbar' ? 'Toolbar items' : 'Navigation items'}</Label>
                    <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      {bottomItemCounts(!!mobile.fab).map((n) => (
                        <Button
                          key={n}
                          size="small"
                          variant={(mobile.itemCount ?? 4) === n ? 'default' : 'default-outline'}
                          onClick={() => setMobileOpt('itemCount', n)}
                        >
                          {n}
                        </Button>
                      ))}
                    </HStack>
                    <Caption color="quiet">
                      Two to five. Five is a reach limit rather than a taste one: below
                      about 64px a target stops being reliably hittable with a thumb, and
                      five items is where a 360px phone reaches that. A FAB takes one of
                      the five, because it sits in the same row. One is not navigation.
                    </Caption>

                    <SwitchInput
                      checked={mobile.showLabels !== false}
                      onChange={(e: { target: { checked: boolean } }) => setMobileOpt('showLabels', e.target.checked)}
                      label="Labels under the icons"
                    />

                    <Divider />
                    <SwitchInput
                      checked={!!mobile.fab}
                      onChange={(e: { target: { checked: boolean } }) => {
                        const on = e.target.checked;
                        setMobile((m) => ({
                          ...m,
                          fab: on,
                          // Adding a FAB shrinks the ceiling, so a count that
                          // was legal a moment ago has to come down with it.
                          itemCount: Math.min(m.itemCount ?? 4, maxItemsWithFab(on)),
                        }));
                      }}
                      label="FAB"
                    />
                    {mobile.fab && (
                      <>
                        <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                          {([['center', 'Centred'], ['end', 'At the end']] as const).map(([id, l]) => (
                            <Button key={id} size="small"
                              variant={(mobile.fabPosition ?? 'center') === id ? 'default' : 'default-outline'}
                              onClick={() => setMobileOpt('fabPosition', id)}>{l}</Button>
                          ))}
                        </HStack>
                        <Caption color="quiet">
                          An outlined ring in the bar, drawn by the Nav-Bar component
                          in an item's place — so it takes one of the five, and the
                          definition carries nothing for it.
                        </Caption>
                        <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                          <SwitchInput
                            checked={!!mobile.fabSpeedDial}
                            onChange={(e: { target: { checked: boolean } }) =>
                              setMobileOpt('fabSpeedDial', e.target.checked)}
                            label="Opens a speed dial"
                          />
                          {mobile.fabSpeedDial && (
                            <Button
                              variant="default-outline"
                              size="small"
                              onClick={() => setDialEditorOpen(true)}
                            >
                              Edit actions
                            </Button>
                          )}
                        </HStack>
                        {mobile.fabSpeedDial && (
                          <Caption color="quiet">
                            Press the ring in the preview to open it. The actions climb from
                            the ring, first one nearest; open or closed is published as its
                            own variable, the way the account menu's is.
                          </Caption>
                        )}
                      </>
                    )}
                  </>
                )}
              </VStack>
            </Card>
          )}

          {/* No theme picker. The bars wear the design system's own App-Bar
              and Nav-Bar themes, chosen once in the studio — a second picker
              here could only disagree with that choice. */}

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Brand</H4>
              <Body color="quiet">
                Fills the Brand slot so the nav can be judged with a real mark in it.
                It stays local — a published add-on is imported by every design
                system, so a brand baked into one would put this logo in everyone's
                file. That is what the slot is for.
              </Body>

              {brandError && <Alert severity="error"><BodySmall>{brandError}</BodySmall></Alert>}

              <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {brand && (
                  <Card padding="small">
                    <img src={brand.url} alt="" style={{ height: 32, width: 'auto', display: 'block' }} />
                  </Card>
                )}
                <Button variant="default-outline" onClick={() => brandInput.current?.click()}>
                  {brand ? 'Replace' : 'Upload a mark'}
                </Button>
                {brand && (
                  <Button
                    variant="ghost"
                    onClick={() => { releaseBrandAsset(brand); setBrand(null); setBrandError(null); }}
                  >
                    Remove
                  </Button>
                )}
                {brand && <Caption color="quiet">{brand.name}</Caption>}
              </HStack>

              {/* MISSING-LIB-COMPONENT: FileInput
                  Needed for: choosing a brand mark from disk
                  Proposed API: <FileInput accept onSelect label />
                  Lib-track: add to @omni-design/components/src/components/FileInput/

                  Hidden and driven by the Button above, so what the user sees and
                  operates is a lib control; the raw input exists because there is no
                  lib equivalent and a file picker cannot be built without one. */}
              <input
                ref={brandInput}
                type="file"
                accept={BRAND_TYPES.join(',')}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Reset first: picking the same file twice fires no change
                  // event otherwise, so a re-upload after an error looks dead.
                  e.target.value = '';
                  if (!file) return;
                  const result = loadBrandAsset(file);
                  if (!result.ok) { setBrandError(result.error); return; }
                  releaseBrandAsset(brand);
                  setBrand(result.asset);
                  setBrandError(null);
                }}
              />
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Component size</H4>
              <Body color="quiet">
                One control for the whole nav. Size is a Component-Size MODE, so
                the rail's width, the bar's height and the buttons inside it move
                together — three separate pickers would let them disagree in ways
                the design system has no name for.
              </Body>
              <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                {(['small', 'medium', 'large'] as const).map((sz) => (
                  <Button
                    key={sz}
                    size="small"
                    variant={componentSize === sz ? 'default' : 'default-outline'}
                    onClick={() => setComponentSize(sz)}
                  >
                    {sz}
                  </Button>
                ))}
              </HStack>
              <Caption color="quiet">
                {/* From NAV_METRICS, the table the CSS and Figma read — it was
                    three hard-coded ternaries that had drifted (Rail 72 / 96,
                    App-Bar 72). App-Bar is the size's button height + 32. */}
                Rail-Width {NAV_METRICS['Rail-Width'][componentSize]}px
                {' · '}App-Bar-Height {NAV_METRICS['App-Bar-Height'][componentSize]}px
                {' · '}Nav-Bar Height {NAV_METRICS['Nav-Bar Height'][componentSize]}px
              </Caption>

              <Divider />
              <Label>Signed in</Label>
              <HStack gap="var(--Sizing-2)">
                {([[true, 'On'], [false, 'Off']] as const).map(([v, l]) => (
                  <Button key={l} size="small"
                    variant={signedIn === v ? 'default' : 'default-outline'}
                    onClick={() => setSignedIn(v)}>{l}</Button>
                ))}
              </HStack>
              <Caption color="quiet">
                A session state, not a width: one value for the whole nav, published
                as its own variable so a design can differ for a visitor. Here it
                gates the account — off shows the bar with no avatar.
              </Caption>
              {usedConditions.includes('Adaptive-Nav/Show-Condensed') && (
                <>
                  <Divider />
                  <Label>Scrolled past the hero</Label>
                  <HStack gap="var(--Sizing-2)">
                    {([[false, 'At top'], [true, 'Scrolled']] as const).map(([v, l]) => (
                      <Button key={l} size="small"
                        variant={scrolled === v ? 'default' : 'default-outline'}
                        onClick={() => setScrolled(v)}>{l}</Button>
                    ))}
                  </HStack>
                  <Caption color="quiet">
                    A scroll position, not a width: the brand and actions move into the
                    sticky strip once the hero has gone. Published as Show-Condensed and its
                    opposite, Hide-When-Condensed.
                  </Caption>
                </>
              )}
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Slots</H4>

              {/* One set, and every one of them is per breakpoint.
                  
                  There used to be two: a global "does this slot exist" and a
                  per-breakpoint "does it show". That invented a distinction a
                  user has no reason to hold — "does the avatar exist" and
                  "does the avatar show at this width" are the same question
                  asked twice — and it made the per-breakpoint group look like
                  the exception when it is the whole point of the add-on.
                  
                  A slot off at EVERY breakpoint is simply omitted from the
                  component, which is derivable rather than a second control. */}
              <Label>At {current?.label}</Label>
              <HStack gap="var(--Sizing-3)" style={{ flexWrap: 'wrap' }}>
                {/* Brand has no structural option — the slot is always in
                    the component — so its switch is the condition alone.
                    
                    A switch is live only where this arrangement READS its
                    condition. "Bottom bar only" has no top bar, so none of
                    these slots exist there, and a switch that flips a
                    variable nothing is bound to looks like it does nothing
                    — because it does nothing. Disabled rather than hidden, so
                    the set stays in one place across breakpoints. */}
                {([[null, 'Brand'], ['search', 'Search'], ['actions', 'Actions'], ['avatar', 'Avatar']] as const).map(
                  ([key, label]) => {
                    const cond = `Adaptive-Nav/Show-${label}`;
                    const applies = usedConditions.includes(cond);
                    return (
                      <SwitchInput
                        key={label}
                        checked={applies && (key === null || !!options[key]) && !!active[cond]}
                        disabled={!applies}
                        onChange={(e: { target: { checked: boolean } }) => {
                          const on = e.target.checked;
                          // Turning one on has to do both jobs: put the slot in
                          // the component and switch it on at this width.
                          if (on && key !== null && !options[key]) set(key, true);
                          setCondition(cond, on);
                        }}
                        label={label}
                      />
                    );
                  },
                )}
                {/* Every OTHER condition this arrangement uses.
                    
                    The three above are special only because each is also a
                    structural option — turning one on has to put the slot in
                    the component as well as switch it on here. The rest are
                    plain per-breakpoint switches, and they were not rendered
                    at all: `otherConditions` was computed and never used, so
                    Show-Rail had no control anywhere. Picking the rail layout
                    at a width where the seed had it off gave you a rail
                    layout with no rail and nothing to turn it back on. */}
                {otherConditions
                  .filter((n) => !['Adaptive-Nav/Show-Brand', 'Adaptive-Nav/Show-Search',
                                   'Adaptive-Nav/Show-Actions', 'Adaptive-Nav/Show-Avatar'].includes(n))
                  /* Width conditions only. Scroll, session and interaction
                     conditions are not per-breakpoint — they had switches here,
                     and flipping one wrote the published matrix. Signed in and
                     Scrolled have their own one-value controls under the sizes;
                     the account menu opens from the avatar. */
                  .filter((n) => definition.conditions?.[n]?.trigger === 'device')
                  // The arrangement is chosen with the layout cards, not a switch.
                  .filter((n) => !(n in ARRANGEMENT_CONDITIONS))
                  .map((name) => (
                    <SwitchInput
                      key={name}
                      checked={!!active[name]}
                      onChange={(e: { target: { checked: boolean } }) =>
                        setCondition(name, e.target.checked)}
                      label={name.split('/').pop()!.replace(/^Show-/, '').replace(/-/g, ' ')}
                    />
                  ))}
              </HStack>
              {onMobile && !usedConditions.includes('Adaptive-Nav/Show-Brand') && (
                <Caption color="quiet">
                  This arrangement has no top bar, so there is nothing here to show or hide.
                </Caption>
              )}

              {/* Only once the avatar is there. A menu behind a slot that does
                  not exist at this width is a setting with nothing to apply
                  to, and switching it on would look like it had done nothing. */}
              {!onMobile && options.avatar && (
                <>
                  <Divider />
                  <HStack gap="var(--Sizing-3)" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <SwitchInput
                      checked={!!options.avatarMenu}
                      onChange={(e: { target: { checked: boolean } }) => {
                        const on = e.target.checked;
                        set('avatarMenu', on);
                        // Turning it off has to shut the preview too, or the
                        // panel stays on screen with nothing left to close it.
                        if (!on) setMenuOpen(false);
                      }}
                      label="Avatar opens a menu"
                    />
                    {options.avatarMenu && (
                      <Button
                        variant="default-outline"
                        size="small"
                        onClick={() => setAccountEditorOpen(true)}
                      >
                        Edit menu
                      </Button>
                    )}
                  </HStack>
                  {options.avatarMenu && (
                    <Caption color="quiet">
                      Click the avatar in the preview to open it. Open or closed is a
                      click, not a width — so it is published as a variable the
                      component reads and left out of the breakpoint table, which
                      records design decisions rather than states.
                    </Caption>
                  )}
                </>
              )}

              {navigationChoice && (
                <>
                  <Divider />
                  {/* Radio, not two switches. It is one decision — both on shows
                      two navigations, both off shows none — and a radio cannot
                      express either, where a pair of switches needs a rule and a
                      label to say so. */}
                  <RadioGroup
                    label="Navigation"
                    orientation="horizontal"
                    value={navigationChoice.value}
                    onChange={(e: { target: { value: string } }) =>
                      setCondition(e.target.value, true)}
                    options={navigationChoice.options}
                  />
                </>
              )}

              {options.layout === 'hero' && (
                <>
                  <Divider />
                  <Label>Tab alignment</Label>
                  <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                    {([['left', 'Left'], ['center', 'Centred']] as const).map(([id, l]) => (
                      <Button
                        key={id}
                        size="small"
                        variant={(options.heroTabsAlign ?? 'center') === id ? 'default' : 'default-outline'}
                        onClick={() => set('heroTabsAlign', id)}
                      >
                        {l}
                      </Button>
                    ))}
                  </HStack>
                  <Caption color="quiet">
                    Left keeps the tabs on the page's own text edge, which is what a
                    content site wants. Centred balances them under a full-bleed
                    image. Centring uses the same two-filling-sides geometry the
                    centred brand does — centring inside one filling group would put
                    them wherever the menu button happens to leave them.
                  </Caption>
                  <Divider />
                  <SwitchInput
                    checked={!!options.condensed}
                    onChange={(e: { target: { checked: boolean } }) => set('condensed', e.target.checked)}
                    label="Brand and actions animate in when stuck"
                  />
                  <Caption color="quiet">
                    A SCROLL condition, not a width one — no media query can detect it,
                    so it compiles to a scroll listener in React and to a mode a
                    designer flips by hand in Figma. Without it the strip carries
                    navigation only, because showing the brand before the hero scrolls
                    past would show it twice.
                  </Caption>
                </>
              )}
            </VStack>
          </Card>

            </VStack>
            </div>

            {/* The right-hand column: the preview, fitted to the column's
                width AND height so the whole screen is in view — a 1080-tall
                desktop or an 844-tall phone fitted to width alone ran off the
                bottom, and the bottom bar is the part a phone layout is about.
                
                Stacked, it is sticky instead, and shrinks as the page scrolls
                (the sentinel measures how far). */}
            <div style={twoCol
              ? { minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--Sizing-1, 8px)' }
              : { position: 'sticky', top: 0, minWidth: 0 }}>
          <div ref={sentinelRef} aria-hidden style={{ height: 0 }} />
          <div
            data-surface="Surface"
            style={twoCol
              ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--Sizing-1, 8px)' }
              : {
                  position: 'sticky', top: 0, zIndex: 2, background: 'var(--Background)',
                  paddingTop: 'var(--Sizing-2, 8px)', paddingBottom: 'var(--Sizing-2, 8px)',
                }}
          >
              <div style={twoCol ? { flex: 1, minHeight: 0 } : undefined}>
                {/* Stops cropping while the menu is open. The box's height is
                    computed from the untransformed content, and an absolutely
                    positioned panel never counted towards it — so cropping
                    would cut the menu off entirely, which reads as the panel
                    not rendering rather than as the frame ending. */}
                <ScaledPreview
                  style={metricVars}
                  width={previewWidth}
                  height={current?.deviceHeight}
                  maxScale={previewMaxScale}
                  onScale={setScale}
                  frame
                  fitHeight={twoCol}
                  device={previewDevice}
                  clip={!menuShown}
                >
                  {/* The cap goes THROUGH the renderer rather than around it.
                      Wrapped outside, it capped the whole bar and left bare
                      page either side of a floating colored strip; passed in,
                      each band paints edge to edge and only its content caps. */}
                  <DefinitionRenderer
                    definition={combined}
                    conditions={active}
                    slots={slotContent}
                    contentMaxWidth={current?.maxWidth}
                    contentAlign={current?.align}
                    insets={insets}
                    showSlots
                  />
                </ScaledPreview>
              </div>
              {/* The device and how far it is scaled, as Bento and Hero say it:
                  a preview shown smaller than life without saying so gets
                  judged at the wrong size. */}
              <Caption color="quiet">
                {current?.label} · {previewWidth}
                {current?.deviceHeight ? ` × ${current.deviceHeight}` : ''} · {Math.round(scale * 100)}%
                {current?.maxWidth && current.maxWidth < previewWidth
                  ? ` · content capped at ${current.maxWidth}px`
                  : ''}
              </Caption>
          </div>
            </div>
          </div>
          </VStack>
            </TabPanel>
          <TabPanel value="code">
            <VStack gap="var(--Sizing-3)" style={{ paddingTop: 'var(--Sizing-2)' }}>
              <Body>
                One React file for every width, built from the library: the parts switch
                at your breakpoints, the menu button opens a drawer, the account menu
                opens from the avatar and the hero condenses on scroll. Wrap your page
                in it — it draws in your design system inside your OmniDesignProvider.
              </Body>
              <CodeBlock code={reactCode} language="JSX" maxHeight={480} />
              <H4>Share link</H4>
              <Body>
                The whole setup in one link — open it to carry on where this left off.
                An uploaded mark stays on this computer.
              </Body>
              <CodeBlock code={shareLink} language="URL" wrap />
            </VStack>
          </TabPanel>
          <TabPanel value="export">
            <VStack gap="var(--Sizing-3)" style={{ paddingTop: 'var(--Sizing-2)' }}>
              <Body>
                In Figma, open the Omni Design plugin, open the Add-ons tab, choose
                Adaptive Nav and paste this spec. It builds the nav as one component and
                writes which parts show on each device into Devices-Type — so the nav
                switches with the frame's device, the same way a Bento reflows.
              </Body>
              <Body color="quiet">
                Every value is a variable NAME, so it binds to each design system rather
                than carrying these colors.
              </Body>
              <CodeBlock code={JSON.stringify(fullSpec, null, 2)} language="JSON" maxHeight={420} />
            </VStack>
          </TabPanel>
          <TabPanel value="import">
            <div style={{ maxWidth: 560, paddingTop: 'var(--Sizing-2)' }}>
              <Card padding="medium">
                <VStack gap="var(--Sizing-2)">
                  <H3>Import a nav</H3>
                  <BodySmall color="quiet">
                    Edit a nav made with this add-on: paste its link, its React file or its
                    Figma spec — each one carries the whole setup. Only navs made here can be
                    opened. An uploaded logo stays on the computer it was added on.
                  </BodySmall>
                  <TextArea label="Nav link, code or spec" rows={4} fullWidth value={importText}
                    onChange={(e: { target: { value: string } }) => setImportText(e.target.value)} />
                  {importError && <Alert color="warning"><BodySmall>{importError}</BodySmall></Alert>}
                  <HStack gap="var(--Sizing-1)">
                    <Button variant="default-outline" size="small" disabled={!importText.trim()} onClick={() => {
                      const st = readNavState(importText);
                      if (!st) { setImportError('That is not an Adaptive Nav, or it was cut off when copying — only navs made with this add-on carry their setup.'); return; }
                      applyNavState(st); setImportError(null); setImportText(''); setTab('build');
                    }}>Load</Button>
                  </HStack>
                </VStack>
              </Card>
            </div>
          </TabPanel>
          </Tabs>
        </VStack>
      </Section>

      <NavItemEditor
        open={!!editing}
        item={editingItem}
        kind={editing?.kind ?? 'button'}
        onChange={updateItem}
        onRemove={removeItem}
        onClose={() => setEditing(null)}
      />

      <AccountMenuEditor
        open={accountEditorOpen}
        items={accountItems}
        onChange={setAccountItems}
        onClose={() => setAccountEditorOpen(false)}
      />

      <SpeedDialEditor
        open={dialEditorOpen}
        items={dialItems}
        onChange={setDialItems}
        onClose={() => setDialEditorOpen(false)}
      />

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} size="medium">
        <VStack gap="var(--Sizing-3)">
              <H4>Breakpoints</H4>
              <Body color="quiet">
                Each is a lower bound. The narrowest must start at 0 — a width no
                breakpoint covers has no condition values at all, and neither CSS nor
                Figma reports that.
              </Body>

              {problems.length > 0 && (
                <Alert severity="error">
                  <VStack gap="var(--Sizing-Half)">
                    {problems.map((p) => <BodySmall key={p.id + p.message}>{p.message}</BodySmall>)}
                  </VStack>
                </Alert>
              )}

              <VStack gap="var(--Sizing-2)">
                {sorted.map((b) => {
                  const r = breakpointRange(sorted, b.id);
                  return (
                    <HStack key={b.id} gap="var(--Sizing-2)" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <TextField
                        label="Name"
                        value={b.label}
                        onChange={(e: { target: { value: string } }) => editBp(b.id, { label: e.target.value })}
                        size="small"
                      />
                      <TextField
                        label="From (px)"
                        type="number"
                        value={String(b.minWidth)}
                        onChange={(e: { target: { value: string } }) =>
                          editBp(b.id, { minWidth: Number(e.target.value) || 0 })}
                        size="small"
                      />
                      <BodySmall color="quiet" style={{ paddingBottom: 8 }}>
                        {r && (r.to === null ? `${r.from}px and up` : `${r.from}\u2013${r.to}px`)}
                      </BodySmall>
                      <TextField
                        label="Max content (px)"
                        type="number"
                        value={b.maxWidth === undefined ? '' : String(b.maxWidth)}
                        placeholder="none"
                        onChange={(e: { target: { value: string } }) => {
                          // Empty means UNCAPPED, which is different from 0 —
                          // a cap of 0 would collapse the content entirely.
                          const raw = e.target.value.trim();
                          editBp(b.id, { maxWidth: raw === '' ? undefined : Number(raw) || undefined });
                        }}
                        size="small"
                      />
                      {b.maxWidth !== undefined && (
                        <Button
                          variant="default-outline"
                          size="small"
                          onClick={() => editBp(b.id, { align: b.align === 'center' ? 'left' : 'center' })}
                        >
                          {b.align === 'center' ? 'Centred' : 'Left'}
                        </Button>
                      )}
                      <Button
                        variant="default-outline"
                        size="small"
                        disabled={sorted.length <= 1}
                        onClick={() => {
                          setBreakpoints((bs) => bs.filter((x) => x.id !== b.id));
                          // Selecting a breakpoint that no longer exists would
                          // render every condition false — a state nobody designed.
                          if (selectedBp === b.id) setSelectedBp(sorted.find((x) => x.id !== b.id)!.id);
                        }}
                      >
                        Remove
                      </Button>
                    </HStack>
                  );
                })}
              </VStack>

              <div>
                <Button
                  variant="default-outline"
                  onClick={() => {
                    const widest = sorted[sorted.length - 1];
                    const id = `bp-${Date.now().toString(36)}`;
                    setBreakpoints((bs) => [...bs, {
                      id, label: 'New', minWidth: widest ? widest.minWidth + 320 : 0,
                    }]);
                  }}
                >
                  Add breakpoint
                </Button>
              </div>
              <Caption color="quiet">
                Adding one gives every condition a value there straight away, taken
                from the design's own defaults rather than a blanket true — an unset
                cell reads as false downstream and would hide parts at that width
                with nothing to say why.
              </Caption>
        </VStack>
      </Modal>

    </div>
  );

  if (exists !== true || !uuid || !systemCss) return page;
  return (
    <OmniDesignProvider {...systemCss.urls} defaultTheme="Default" defaultStyle="Modern" defaultSurface="Surface">
      {page}
    </OmniDesignProvider>
  );
}
