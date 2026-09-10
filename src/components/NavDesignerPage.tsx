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
  Tabs, TabList, Tab, TextField, Alert, Modal, RadioGroup, Avatar,
} from '@omni-design/components';
import {
  navDefinition, defaultNavMatrix, applyExclusivity, NAV_EXCLUSIVE,
  NAV_LAYOUTS, type NavLayout, type NavOptions,
} from '../utils/addOns/navDefinition';
import {
  DEFAULT_BREAKPOINTS, sortBreakpoints, displayBreakpoints, primaryBreakpoint,
  validateBreakpoints, breakpointRange,
  completeMatrix, conditionsAt, type Breakpoint, type ConditionMatrix,
} from '../utils/addOns/breakpoints';
import ScaledPreview from './ScaledPreview';
import TuneIcon from '@mui/icons-material/Tune';
import {
  loadBrandAsset, releaseBrandAsset, BRAND_TYPES, type BrandAsset,
} from '../utils/addOns/brandAsset';
import {
  DEFAULT_TABS, DEFAULT_ACTIONS, buttonVariant, itemProblems, newId,
  type NavItem, type NavButtonItem,
} from '../utils/addOns/navContent';
import NavItemEditor from './NavItemEditor';
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
  const { definition, spec } = useMemo(() => {
    const def = navDefinition(options);
    /* tokensUsed is no longer read here — the token list came out with the
       card that showed it. It stays exported because the publish script prints
       it before writing, which is where the check actually matters: a missing
       variable imports unbound and silently looks like a design decision. */
    return { definition: def, spec: toAddonSpec(def) };   // spec re-derived below with the table
  }, [options]);

  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>(DEFAULT_BREAKPOINTS);
  /* Opens on the WIDEST. Design runs desktop-down: the wide layout is the one
     being designed and the narrow ones are what it degrades into. */
  const [selectedBp, setSelectedBp] = useState<string>(primaryBreakpoint(DEFAULT_BREAKPOINTS)!.id);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [actions, setActions] = useState<NavButtonItem[]>(DEFAULT_ACTIONS);
  const [editing, setEditing] = useState<{ kind: 'tab' | 'button'; id: string } | null>(null);

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

  const slotContent = useMemo(() => {
    const mark = brand ? (
      <img src={brand.url} alt="" style={{ height: 24, width: 'auto', display: 'block' }} />
    ) : null;

    const label = (i: NavItem) => (i.iconOnly ? null : i.label);
    const glyph = (i: NavItem) => (i.icon ? <NavIconGlyph name={i.icon} /> : null);

    const tabStrip = (
      <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center' }}>
        {tabs.map((t) => {
          const problems = itemProblems(t);
          return (
            <Button
              key={t.id}
              variant="default-text"
              size="small"
              iconOnly={t.iconOnly}
              /* An icon-only control needs a name and its icon must not carry
                 one, or a screen reader announces the control twice. */
              aria-label={t.iconOnly ? t.label || 'Unnamed tab' : undefined}
              onClick={() => setEditing({ kind: 'tab', id: t.id })}
              style={itemChrome(problems)}
            >
              {t.iconPosition === 'end' ? <>{label(t)}{glyph(t)}</> : <>{glyph(t)}{label(t)}</>}
            </Button>
          );
        })}
        <Button
          iconOnly
          size="small"
          variant="default-ghost"
          aria-label="Add a tab"
          onClick={() => {
            const item = { id: newId('tab'), label: 'New tab' };
            setTabs((xs) => [...xs, item]);
            setEditing({ kind: 'tab', id: item.id });
          }}
        >
          <NavIconGlyph name="add" />
        </Button>
      </HStack>
    );

    const actionGroup = (
      <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center' }}>
        {actions.map((a) => {
          const problems = itemProblems(a);
          return (
            <Button
              key={a.id}
              variant={buttonVariant(a.colour, a.treatment)}
              size="small"
              iconOnly={a.iconOnly}
              aria-label={a.iconOnly ? a.label || 'Unnamed button' : undefined}
              onClick={() => setEditing({ kind: 'button', id: a.id })}
              style={itemChrome(problems)}
            >
              {a.iconPosition === 'end' ? <>{label(a)}{glyph(a)}</> : <>{glyph(a)}{label(a)}</>}
            </Button>
          );
        })}
        <Button
          iconOnly
          size="small"
          variant="default-ghost"
          aria-label="Add a button"
          onClick={() => {
            const item: NavButtonItem = {
              id: newId('act'), label: 'New', colour: 'default', treatment: 'outline',
            };
            setActions((xs) => [...xs, item]);
            setEditing({ kind: 'button', id: item.id });
          }}
        >
          <NavIconGlyph name="add" />
        </Button>
      </HStack>
    );

    /* The lib's Avatar, not a circle drawn here. A stand-in would have its own
       size, radius and border, and would drift from the real one the moment
       either changed — the preview's whole claim is that it renders the same
       components the nav will. */
    const avatar = <Avatar size="x-small" alt="Account" />;

    const out: Record<string, React.ReactNode> = {
      Tabs: tabStrip,
      Actions: actionGroup,
      Avatar: avatar,
    };
    if (mark) { out.Brand = mark; out['Condensed-Brand'] = mark; }
    return out;
  }, [brand, tabs, actions]);
  const [scale, setScale] = useState(1);
  const [matrix, setMatrix] = useState<ConditionMatrix>({});

  const problems = validateBreakpoints(breakpoints);
  const sorted = sortBreakpoints(breakpoints);
  const shown = displayBreakpoints(breakpoints);
  const current = sorted.find((b) => b.id === selectedBp);

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

  const active = useMemo(() => conditionsAt(full, selectedBp), [full, selectedBp]);

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
              <BodySmall color="quiet">
                {NAV_LAYOUTS.find((l) => l.id === options.layout)?.description}
              </BodySmall>

              {options.layout === 'rail' && (
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

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Preview</H4>

              {/* Laid out at the breakpoint's real width and TRANSFORMED down,
                  rather than squeezed into the card. Squeezing would make the
                  tabs wrap and the items collapse, so what is on screen would
                  be the narrow arrangement wearing a wide label — every
                  judgement from it about the wrong design. */}
              <div
                style={{
                  border: '1px solid var(--Border)',
                  borderRadius: 'var(--Card-Radius, 8px)',
                  overflow: 'hidden',
                }}
              >
                <ScaledPreview width={previewWidth} onScale={setScale}>
                  {/* The cap lives HERE, not in the definition: it is a property
                      of the breakpoint, not of the component, and the same nav
                      is uncapped at every narrower width. */}
                  <div style={{
                    maxWidth: current?.maxWidth,
                    marginLeft: current?.align === 'center' ? 'auto' : undefined,
                    marginRight: current?.align === 'center' ? 'auto' : undefined,
                  }}>
                    <DefinitionRenderer
                      definition={definition}
                      conditions={active}
                      slots={slotContent}
                      showSlots
                    />
                  </div>
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

              {/* WHICH SLOTS EXIST — structural, and the same at every width.
                  Kept apart from the visibility switches below because the two
                  are different decisions that look alike: this one removes the
                  slot from the component entirely, that one hides an existing
                  slot at one breakpoint. Merging them into one row of switches
                  would make "off" mean two different things. */}
              <Label>Included</Label>
              <HStack gap="var(--Sizing-3)" style={{ flexWrap: 'wrap' }}>
                {([['search', 'Search'], ['actions', 'Actions'], ['avatar', 'Avatar']] as const).map(
                  ([key, label]) => (
                    <SwitchInput
                      key={key}
                      checked={!!options[key]}
                      onChange={(e: { target: { checked: boolean } }) => set(key, e.target.checked)}
                      label={label}
                    />
                  ),
                )}
              </HStack>
              <Caption color="quiet">
                Every breakpoint. A slot switched off here is not in the component at
                all — nothing to bind, nothing to fill.
              </Caption>

              {navigationChoice && (
                <>
                  <Divider />
                  {/* Radio, not two switches. It is one decision — both on shows
                      two navigations, both off shows none — and a radio cannot
                      express either, where a pair of switches needs a rule and a
                      label to say so. */}
                  <RadioGroup
                    label={`Navigation at ${current?.label}`}
                    orientation="horizontal"
                    value={navigationChoice.value}
                    onChange={(e: { target: { value: string } }) =>
                      setCondition(e.target.value, true)}
                    options={navigationChoice.options}
                  />
                </>
              )}

              {otherConditions.length > 0 && (
                <>
                  <Divider />
                  <Label>At {current?.label} only</Label>
                  <HStack gap="var(--Sizing-3)" style={{ flexWrap: 'wrap' }}>
                    {otherConditions.map((name) => {
                      const def = definition.conditions?.[name];
                      return (
                        <SwitchInput
                          key={name}
                          checked={!!active[name]}
                          onChange={(e: { target: { checked: boolean } }) =>
                            setCondition(name, e.target.checked)}
                          /* "Search" alone did not say what the switch does.
                             The heading gives the breakpoint; the label has to
                             give the rest, or it reads as a noun with no verb. */
                          label={`Show ${name.split('/').pop()!.replace(/^Show-/, '').replace(/-/g, ' ').toLowerCase()}`
                            + (def?.trigger === 'scroll' ? ' (on scroll)' : '')}
                        />
                      );
                    })}
                  </HStack>
                  <Caption color="quiet">
                    This breakpoint only — the same shape Figma stores, where a boolean
                    holds one value per Device-Sizes mode. Device conditions become
                    breakpoints in CSS; the scroll ones cannot, so they stay false at
                    every width and are switched by a listener instead.
                  </Caption>
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
        kind={editing?.kind ?? 'tab'}
        onChange={updateItem}
        onRemove={removeItem}
        onClose={() => setEditing(null)}
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
