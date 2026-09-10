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
import { useMemo, useState } from 'react';
import {
  AppBar, Button, H1, H2, H4, Body, BodySmall, Caption, Label,
  VStack, HStack, Card, Divider, SwitchInput, Chip, CodeBlock, Section,
  Tabs, TabList, Tab, TextField, Alert,
} from '@omni-design/components';
import {
  navDefinition, defaultNavMatrix, NAV_LAYOUTS, type NavLayout, type NavOptions,
} from '../utils/addOns/navDefinition';
import {
  DEFAULT_BREAKPOINTS, sortBreakpoints, validateBreakpoints, breakpointRange,
  completeMatrix, conditionsAt, type Breakpoint, type ConditionMatrix,
} from '../utils/addOns/breakpoints';
import { toAddonSpec, tokensUsed } from '../utils/addOns/toAddonSpec';
import NavLayoutPreview from './NavLayoutPreview';
import DefinitionRenderer from './DefinitionRenderer';

export default function NavDesignerPage() {
  const [options, setOptions] = useState<NavOptions>({
    layout: 'brand-left', search: true, actions: true, avatar: true, sticky: true,
  });

  const set = <K extends keyof NavOptions>(k: K, v: NavOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  /* Recomputed from the definition rather than tracked alongside it, so what
     is shown is always what would be published. */
  const { definition, spec, tokens } = useMemo(() => {
    const def = navDefinition(options);
    return { definition: def, spec: toAddonSpec(def), tokens: tokensUsed(def) };
  }, [options]);

  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>(DEFAULT_BREAKPOINTS);
  const [selectedBp, setSelectedBp] = useState<string>(DEFAULT_BREAKPOINTS[0].id);
  const [matrix, setMatrix] = useState<ConditionMatrix>({});

  const problems = validateBreakpoints(breakpoints);
  const sorted = sortBreakpoints(breakpoints);

  /* The full table, recompleted whenever the conditions or breakpoints change.
     A hole would read as FALSE downstream, silently hiding a part at whichever
     widths were never visited — so every cell is filled, and a cell that has
     never been touched takes the design's own default rather than a blanket
     true. */
  const full = useMemo(() => {
    const names = Object.keys(definition.conditions || {});
    const seed = defaultNavMatrix(names, sorted);
    return completeMatrix(matrix, names, sorted, (c, bp) => seed[c]?.[bp.id] ?? true);
  }, [definition, matrix, sorted]);

  const active = useMemo(() => conditionsAt(full, selectedBp), [full, selectedBp]);
  /* Writes one cell. The row is spread from the COMPLETED table rather than
     from raw state, so setting a value at one breakpoint cannot blank the
     others by writing a row that only has the cell just touched. */
  const setCondition = (name: string, value: boolean) =>
    setMatrix((m) => ({ ...m, [name]: { ...full[name], [selectedBp]: value } }));

  const range = breakpointRange(sorted, selectedBp);
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

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Layout</H4>
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
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Preview</H4>

              {/* One tab per breakpoint. Designing per width is the point: a
                  responsive component is a table of conditions by breakpoint,
                  not one layout with parts switched off. */}
              <Tabs value={selectedBp} onChange={(v: string) => setSelectedBp(v)}>
                <TabList>
                  {sorted.map((b) => (
                    <Tab key={b.id} value={b.id}>{b.label}</Tab>
                  ))}
                </TabList>
              </Tabs>

              {/* Rendered THROUGH the definition, not drawn beside it. The same
                  description compiles to Figma nodes and to these elements, so
                  this is the component rather than a picture of it.

                  Constrained to the breakpoint's own lower bound, because a
                  layout that only holds at 1400px tells you nothing about the
                  width it was designed for. */}
              <div style={{
                border: '1px solid var(--Border)',
                borderRadius: 'var(--Card-Radius, 8px)',
                overflow: 'hidden',
                maxWidth: range ? Math.max(range.from, 320) : undefined,
                resize: 'horizontal',
              }}>
                <DefinitionRenderer definition={definition} conditions={active} showSlots />
              </div>
              <Caption color="quiet">
                {range && (range.to === null
                  ? `${range.from}px and up`
                  : `${range.from}\u2013${range.to}px`)} — shown at its narrowest, which is
                where a layout breaks if it is going to.
              </Caption>

              <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                {Object.entries(definition.conditions || {}).map(([name, def]) => (
                  <SwitchInput
                    key={name}
                    checked={!!active[name]}
                    onChange={(e: { target: { checked: boolean } }) =>
                      setCondition(name, e.target.checked)}
                    label={name.split('/').pop() + (def.trigger === 'scroll' ? ' (scroll)' : '')}
                  />
                ))}
              </HStack>
              <Caption color="quiet">
                These are set PER BREAKPOINT — the same shape Figma stores, where a
                boolean holds one value per Device-Sizes mode. Device conditions
                become breakpoints in CSS; the scroll ones cannot, so they stay false
                at every width and are switched by a listener instead.
              </Caption>
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Right-hand slots</H4>
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
              <Divider />
              <SwitchInput
                checked={options.layout === 'hero' ? true : !!options.sticky}
                disabled={options.layout === 'hero'}
                onChange={(e: { target: { checked: boolean } }) => set('sticky', e.target.checked)}
                label="Sticky"
              />
              {options.layout === 'hero' && (
                <>
                  <Divider />
                  <SwitchInput
                    checked={!!options.condensed}
                    onChange={(e: { target: { checked: boolean } }) => set('condensed', e.target.checked)}
                    label="Brand and actions animate in when stuck"
                  />
                  <Caption color="quiet">
                    A SCROLL condition, not a width one — no media query can detect it, so
                    it compiles to a scroll listener in React and to a mode a designer
                    flips by hand in Figma. Without it the strip carries navigation only,
                    because showing the brand before the hero scrolls past would show it
                    twice.
                  </Caption>
                </>
              )}
              <Caption color="quiet">
                {options.layout === 'hero'
                  ? 'Intrinsic to this layout: tabs under a hero that do not stick are simply tabs under a hero. Sticky sits on the tab strip, not the whole nav — the hero scrolls away.'
                  : 'Reaches the React component only. Figma has no scroll behaviour, so it is left out of the spec rather than faked as a frame.'}
              </Caption>
            </VStack>
          </Card>

          <Card padding="medium">
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
          </Card>

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Tokens this needs</H4>
              <Body>
                A design system missing one of these imports the nav with that field
                unbound — no error, just a value that looks chosen.
              </Body>
              <HStack gap="var(--Sizing-1)" style={{ flexWrap: 'wrap' }}>
                {tokens.map((t) => <Chip key={t} label={t} size="small" />)}
              </HStack>
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
                code={JSON.stringify(spec, null, 2)}
                language="JSON"
                maxHeight={360}
              />
            </VStack>
          </Card>
        </VStack>
      </Section>
    </div>
  );
}
