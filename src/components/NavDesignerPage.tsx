/**
 * Design the adaptive nav, then publish it as an add-on.
 *
 * What this edits is a ComponentDefinition — not a Figma file and not JSX. The
 * definition is the source both targets compile from, so a choice made here
 * reaches the Figma component and the React one as the same decision rather
 * than as two things that have to be kept in step.
 *
 * The preview is a SCHEMATIC, deliberately. Rendering the real component would
 * mean a second implementation of the layout in this page, and the two would
 * disagree the moment either changed — the exact failure this architecture
 * exists to avoid. Boxes showing which slot sits where is the honest amount to
 * promise from a definition that has no behaviour in it yet.
 */
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  AppBar, Button, H1, H2, H4, Body, BodySmall, Caption, Label,
  VStack, HStack, Card, Divider, SwitchInput, Chip, CodeBlock, Section,
  Tabs, TabList, Tab, TextField, Alert, Modal, RadioGroup, Avatar, Checkbox,
  Rail, BottomNavigation, MenuItem, MenuDivider,
} from '@omni-design/components';
import {
  navDefinition, defaultNavMatrix, applyExclusivity, NAV_EXCLUSIVE,
  NAV_LAYOUTS, NAV_THEMES, NAV_SURFACES, type NavLayout, type NavOptions,
} from '../utils/addOns/navDefinition';
import {
  DEFAULT_BREAKPOINTS, sortBreakpoints, displayBreakpoints, primaryBreakpoint,
  validateBreakpoints, breakpointRange, isMobileBreakpoint,
  completeMatrix, conditionsAt, type Breakpoint, type ConditionMatrix,
} from '../utils/addOns/breakpoints';
import ScaledPreview from './ScaledPreview';
import {
  mobileNavDefinition, MOBILE_LAYOUTS, maxItemsWithFab,
  type MobileLayout, type MobileOptions,
} from '../utils/addOns/mobileNav';
import TuneIcon from '@mui/icons-material/Tune';
import {
  loadBrandAsset, releaseBrandAsset, BRAND_TYPES, type BrandAsset,
} from '../utils/addOns/brandAsset';
import {
  DEFAULT_TABS, DEFAULT_ACTIONS, buttonVariant, itemProblems,
  type NavItem, type NavButtonItem,
} from '../utils/addOns/navContent';
import {
  DEFAULT_ACCOUNT_MENU, ACCOUNT_MENU_CONDITION, type AccountMenuItem,
} from '../utils/addOns/accountMenu';
import NavItemEditor from './NavItemEditor';
import AccountMenuEditor from './AccountMenuEditor';
import NavIconGlyph from './NavIconGlyph';
import { toAddonSpec, conditionsUsedBy } from '../utils/addOns/toAddonSpec';
import NavLayoutPreview from './NavLayoutPreview';
import DefinitionRenderer from './DefinitionRenderer';

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
  });
  const setMobileOpt = <K extends keyof MobileOptions>(k: K, v: MobileOptions[K]) =>
    setMobile((m) => ({ ...m, [k]: v }));
  const [brand, setBrand] = useState<BrandAsset | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const brandInput = useRef<HTMLInputElement>(null);

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
  const [accountItems, setAccountItems] = useState<AccountMenuItem[]>(DEFAULT_ACCOUNT_MENU);
  const [accountEditorOpen, setAccountEditorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const onMobile = isMobileBreakpoint(current);

  /* One menu, asked about through whichever option set is in play. */
  const avatarOpensMenu = onMobile ? !!mobile.avatarMenu : !!options.avatarMenu;

  const slotContent = useMemo(() => {
    const mark = brand ? (
      <img src={brand.url} alt="" style={{ height: 24, width: 'auto', display: 'block' }} />
    ) : null;

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

    const actionGroup = (
      <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center' }}>
        {actions.map((a) => {
          const problems = itemProblems(a);
          const start = deco(a, 'start');
          const end = deco(a, 'end');
          return (
            <Button
              key={a.id}
              variant={buttonVariant(a.colour, a.treatment)}
              size="small"
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
    const face = <Avatar size="x-small" alt="" />;

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
        variant="default-ghost"
        size="small"
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

    /* The hero the sticky tabs sit under. 16:9 because that is what a hero
       image is — an aspect ratio rather than a height, so it stays right at
       every breakpoint instead of being a number that is only correct at the
       width it was picked at.
       
       A placeholder, not an image: the hero is its own add-on, and putting a
       picture here would suggest this one owns it. */
    const hero = (
      <div
        aria-hidden
        data-surface="Surface-Dim"
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          background: 'var(--Background)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: 'var(--Text-Quiet)', font: 'var(--Label-ExtraSmall-Font-Size, 11px)/1 var(--Font-Families-Body, sans-serif)' }}>
          Hero 16:9
        </span>
      </div>
    );

    /* The page the bars sit either end of. Filled with nothing in particular
       — its only job is to have height, so the two bars read as the top and
       the bottom of a screen rather than as one thick bar. */
    const page = (
      <div style={{ minHeight: 180, width: '100%' }} aria-hidden />
    );

    /* The library's Rail and BottomNavigation, not shapes drawn here.
       
       Both already exist and both take an items array of { icon, label } — so
       a stand-in would be a second implementation of a component that ships,
       and it would drift from the real one the moment either changed. The
       preview's only real claim is that it renders what the nav will.
       
       Rail also takes a fabAction, which is the same composition argument the
       definition makes: a FAB beside a rail is a prop, not a variant. */
    const railItems = tabs.map((t) => ({
      icon: <NavIconGlyph name={t.startIconName || t.endIconName || 'Home'} />,
      label: t.text ? t.label : undefined,
    }));

    const rail = <Rail items={railItems} defaultValue={0} />;

    const bottomNav = (
      <BottomNavigation
        items={railItems}
        defaultValue={0}
        showLabels={mobile.showLabels !== false}
      />
    );

    /* Icon-only ghost with the menu glyph — the control as it actually is,
       not a labelled placeholder. A slot showing the word "Menu-Button" tells
       you the slot exists; the real control tells you whether it sits right
       beside the brand at this width, which is the thing being designed. */
    const menuButton = (
      <Button iconOnly variant="default-ghost" size="small" aria-label="Open navigation">
        <NavIconGlyph name="Menu" />
      </Button>
    );

    const out: Record<string, React.ReactNode> = {
      Tabs: tabStrip,
      Actions: actionGroup,
      Avatar: avatar,
      'Account-Menu': accountMenu,
      Page: page,
      Hero: hero,
      'Rail-Items': rail,
      'Nav-Item-Slot': bottomNav,
      'Menu-Button': menuButton,
    };
    if (mark) { out.Brand = mark; out['Condensed-Brand'] = mark; }
    return out;
  }, [brand, tabs, actions, mobile.showLabels, avatarOpensMenu, menuOpen, accountItems]);
  const [scale, setScale] = useState(1);
  const [matrix, setMatrix] = useState<ConditionMatrix>({});

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


  /* The full table, recompleted whenever the conditions or breakpoints change.
     A hole would read as FALSE downstream, silently hiding a part at whichever
     widths were never visited — so every cell is filled, and a cell that has
     never been touched takes the design's own default rather than a blanket
     true. */
  const full = useMemo(() => {
    /* Only what THIS arrangement gates on. Completing over every declared
       condition put a Show-Rail switch on a layout with no rail — and worse,
       switched ON, saying a part exists when it does not. */
    const names = conditionsUsedBy(definition);
    const seed = defaultNavMatrix(names, sorted);
    return completeMatrix(matrix, names, sorted, (c, bp) => seed[c]?.[bp.id] ?? true);
  }, [definition, matrix, sorted]);

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
  const menuShown = menuOpen && avatarOpensMenu && avatarPresent;
  const active = useMemo<Record<string, boolean>>(
    () => ({ ...matrixActive, [ACCOUNT_MENU_CONDITION]: menuShown }),
    [matrixActive, menuShown],
  );

  /* The spec, WITH the responsive table. Derived after the matrix because it
     needs it: a spec that binds visibility to a variable and says nothing
     about what that variable holds at each width leaves every decision made
     here unrecorded, while looking correct because the binding is present. */
  const fullSpec = useMemo(
    () => toAddonSpec(definition, { breakpoints: sorted, matrix: full }),
    [definition, sorted, full],
  );
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

  /* Lay out at the VIEWPORT width — the breakpoint's own lower bound, which is
     where a layout breaks if it is going to.
     
     Not at the cap. A capped breakpoint is a narrow content column inside a
     wide window, and rendering only the column would hide the thing the cap
     exists for: how much empty space sits either side, and whether the nav
     still relates to the page under it. */
  const previewWidth = Math.max(range?.from ?? 0, 320);
  const editBp = (id: string, patch: Partial<Breakpoint>) =>
    setBreakpoints((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  return (
    <div data-theme="Default" data-surface="Surface"
      style={{ background: 'var(--Background)', color: 'var(--Text)', minHeight: '100vh' }}>
      <AppBar />
      <Section padding="32px 24px 64px">
        <VStack gap="var(--Sizing-4)" style={{ maxWidth: 960, margin: '0 auto' }}>
          <VStack gap="var(--Sizing-1)">
            <H1>Adaptive Nav</H1>
            <Body color="quiet">
              One component, one variant per layout. Which parts appear at which
              width is a mode, not a variant — so this is three specs, not nine.
            </Body>
          </VStack>

          {/* Breakpoint first, because everything below is scoped to it — the
              layout, the conditions and the preview all describe THIS width.
              Widest first: design runs desktop-down, and the narrow ones are
              what the wide layout degrades into. */}
          <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Tabs value={selectedBp} onChange={(v: string) => setSelectedBp(v)}>
                <TabList>
                  {shown.map((b) => (
                    <Tab key={b.id} value={b.id}>{b.label}</Tab>
                  ))}
                </TabList>
              </Tabs>
            </div>
            {/* The button owns the name; the icon carries none, or a screen
                reader announces the control twice. */}
            <Button
              iconOnly
              variant="default-ghost"
              aria-label="Breakpoint settings"
              onClick={() => setSettingsOpen(true)}
            >
              <TuneIcon />
            </Button>
            {problems.length > 0 && (
              <Chip label={`${problems.length} problem${problems.length === 1 ? '' : 's'}`} size="small" />
            )}
          </HStack>

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
                    <div
                      key={l.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={l.label}
                      onClick={() => set('layout', l.id as NavLayout)}
                      onKeyDown={(e) => {
                        // A div taking a click has to take Enter and Space too,
                        // or the picker is unreachable from the keyboard.
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set('layout', l.id as NavLayout); }
                      }}
                      style={{
                        cursor: 'pointer',
                        padding: 'var(--Sizing-1, 4px)',
                        borderRadius: 'var(--Card-Radius, 8px)',
                        border: '2px solid ' + (selected ? 'var(--Buttons-Primary-Border)' : 'var(--Border-Variant)'),
                        outlineOffset: 2,
                      }}
                    >
                      <NavLayoutPreview layout={l.id as NavLayout} options={options} />
                      <div style={{ padding: 'var(--Sizing-1, 4px) var(--Sizing-2, 8px)' }}>
                        <Label>{l.label}</Label>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
              <BodySmall color="quiet">
                {onMobile
                  ? MOBILE_LAYOUTS.find((l) => l.id === mobile.layout)?.description
                  : NAV_LAYOUTS.find((l) => l.id === options.layout)?.description}
              </BodySmall>

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

          {/* Sticky, so a change made further down is visible as it is made.
              Everything below this point edits what is in it, and scrolling to
              check each change and back is most of the work of using the page.

              It carries its own surface: a sticky element with a transparent
              background shows the content sliding under it, which is the one
              thing a sticky element cannot do. */}
          <div
            data-surface="Surface"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: 'var(--Background)',
              paddingTop: 'var(--Sizing-2, 8px)',
              paddingBottom: 'var(--Sizing-2, 8px)',
            }}
          >
          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Preview</H4>

              {/* Laid out at the breakpoint's real width and TRANSFORMED down,
                  rather than squeezed into the card. Squeezing would make the
                  tabs wrap and the items collapse, so what is on screen would
                  be the narrow arrangement wearing a wide label — every
                  judgement from it about the wrong design. */}
              {/* The frame is drawn INSIDE the scaler, on the sized box. Around
                  it, it spanned the container while the content sat at its own
                  smaller width, so the empty remainder read as part of the
                  design. Square, too: a rounded frame reads as a nav with
                  rounded corners rather than the edge of a viewport. */}
              <div>
                {/* Stops cropping while the menu is open. The box's height is
                    computed from the untransformed content, and an absolutely
                    positioned panel never counted towards it — so cropping
                    would cut the menu off entirely, which reads as the panel
                    not rendering rather than as the frame ending. */}
                <ScaledPreview
                  width={previewWidth}
                  onScale={setScale}
                  frame
                  clip={!menuShown}
                >
                  {/* The cap goes THROUGH the renderer rather than around it.
                      Wrapped outside, it capped the whole bar and left bare
                      page either side of a floating coloured strip; passed in,
                      each band paints edge to edge and only its content caps. */}
                  <DefinitionRenderer
                    definition={definition}
                    conditions={active}
                    slots={slotContent}
                    contentMaxWidth={current?.maxWidth}
                    contentAlign={current?.align}
                    showSlots
                  />
                </ScaledPreview>
              </div>

              <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Caption color="quiet">
                  {previewWidth}px
                  {scale < 0.999 ? ` at ${Math.round(scale * 100)}%` : ''}
                  {current?.maxWidth && current.maxWidth < previewWidth
                    ? ` — content capped at ${current.maxWidth}px`
                    : ''}
                </Caption>
              </HStack>

            </VStack>
          </Card>
          </div>

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

                {mobile.layout === 'toolbar' && (
                  <>
                    <Divider />
                    <Label>Toolbar</Label>
                    <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                      {([['fixed', 'Fixed'], ['floating', 'Floating']] as const).map(([id, l]) => (
                        <Button key={id} size="small"
                          variant={(mobile.toolbarStyle ?? 'fixed') === id ? 'default' : 'default-outline'}
                          onClick={() => setMobileOpt('toolbarStyle', id)}>{l}</Button>
                      ))}
                      {([['horizontal', 'Across'], ['vertical', 'Down']] as const).map(([id, l]) => (
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
                      {Array.from({ length: maxItemsWithFab(!!mobile.fab) }, (_, i) => i + 1).map((n) => (
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
                      Five is a reach limit rather than a taste one: below about 64px a
                      target stops being reliably hittable with a thumb, and five items
                      is where a 360px phone reaches that. A FAB takes one of the five,
                      because it sits in the same row.
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
                          Centred splits the items into the two slots the NavBar already
                          has — which is why a centred FAB needs no variant of its own.
                          At the end it is a sibling and the bar is unchanged.
                        </Caption>
                      </>
                    )}
                  </>
                )}
              </VStack>
            </Card>
          )}

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Theme and surface</H4>
              <Body color="quiet">
                Names, not colours. The same definition lands in each design system's
                own brand — what these paint depends on the palette it is imported
                into, which is why nothing here is a hex.
              </Body>

              <Label>Theme</Label>
              <HStack gap="var(--Sizing-1)" style={{ flexWrap: 'wrap' }}>
                {NAV_THEMES.map((t) => (
                  <Button
                    key={t}
                    size="small"
                    variant={(options.theme ?? 'Default') === t ? 'default' : 'default-outline'}
                    onClick={() => set('theme', t)}
                  >
                    {t}
                  </Button>
                ))}
              </HStack>
              <Caption color="quiet">
                Default inherits the page's own theme rather than pinning one — a nav
                that follows its surroundings is usually what you want, which is why it
                is not simply Primary.
              </Caption>

              <Label>Surface</Label>
              <HStack gap="var(--Sizing-1)" style={{ flexWrap: 'wrap' }}>
                {NAV_SURFACES.map((sf) => (
                  <Button
                    key={sf}
                    size="small"
                    variant={(options.surface ?? 'Surface') === sf ? 'default' : 'default-outline'}
                    onClick={() => set('surface', sf)}
                  >
                    {sf.replace('Surface-', '').replace('Surface', 'Base')}
                  </Button>
                ))}
              </HStack>
              <Caption color="quiet">
                A rail sits one step dimmer than whatever the bar is, so it reads as a
                distinct region without naming a second colour.
              </Caption>
            </VStack>
          </Card>

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
                  <div style={{
                    border: '1px solid var(--Border)',
                    borderRadius: 'var(--Card-Radius, 8px)',
                    padding: 'var(--Sizing-2, 8px)',
                  }}>
                    <img src={brand.url} alt="" style={{ height: 32, width: 'auto', display: 'block' }} />
                  </div>
                )}
                <Button variant="default-outline" onClick={() => brandInput.current?.click()}>
                  {brand ? 'Replace' : 'Upload a mark'}
                </Button>
                {brand && (
                  <Button
                    variant="default-ghost"
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
                {([['search', 'Search'], ['actions', 'Actions'], ['avatar', 'Avatar']] as const).map(
                  ([key, label]) => {
                    const cond = `Adaptive-Nav/Show-${label}`;
                    return (
                      <SwitchInput
                        key={key}
                        checked={!!options[key] && !!active[cond]}
                        onChange={(e: { target: { checked: boolean } }) => {
                          const on = e.target.checked;
                          // Turning one on has to do both jobs: put the slot in
                          // the component and switch it on at this width.
                          if (on && !options[key]) set(key, true);
                          setCondition(cond, on);
                        }}
                        label={label}
                      />
                    );
                  },
                )}
              </HStack>

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

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Spec</H4>
              <Body>
                What gets published. Every value is a variable NAME, so it rebinds to
                each design system rather than carrying these colours.
              </Body>
              <CodeBlock
                code={JSON.stringify(fullSpec, null, 2)}
                language="JSON"
                maxHeight={360}
              />
            </VStack>
          </Card>
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
}
