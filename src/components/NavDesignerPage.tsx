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
} from '@omni-design/components';
import {
  navDefinition, NAV_LAYOUTS, type NavLayout, type NavOptions,
} from '../utils/addOns/navDefinition';
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

  /* Which conditions are true in the preview. Defaults to the widest state —
     everything a large screen shows — because that is the layout being
     designed; the narrow states are what you flip to check. */
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const active = useMemo(() => {
    const base: Record<string, boolean> = {};
    for (const name of Object.keys(definition.conditions || {})) {
      base[name] = name !== 'Adaptive-Nav/Show-Menu-Button'   // the tabs' counterpart
        && name !== 'Adaptive-Nav/Show-Condensed';            // only true once scrolled
    }
    return { ...base, ...overrides };
  }, [definition, overrides]);
  const setActive = setOverrides;

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
              {/* Rendered THROUGH the definition, not drawn beside it. The same
                  description compiles to Figma nodes and to these elements, so
                  this is the component rather than a picture of it. */}
              <div style={{
                border: '1px solid var(--Border)',
                borderRadius: 'var(--Card-Radius, 8px)',
                overflow: 'hidden',
              }}>
                <DefinitionRenderer definition={definition} conditions={active} showSlots />
              </div>

              <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                {Object.entries(definition.conditions || {}).map(([name, def]) => (
                  <SwitchInput
                    key={name}
                    checked={!!active[name]}
                    onChange={(e: { target: { checked: boolean } }) =>
                      setActive((a) => ({ ...a, [name]: e.target.checked }))}
                    label={name.split('/').pop() + (def.trigger === 'scroll' ? ' (scroll)' : '')}
                  />
                ))}
              </HStack>
              <Caption color="quiet">
                Flip a condition to see that state. These are the same booleans the
                Figma component binds its layers to — device ones become breakpoints,
                the scroll one becomes a listener. A part behind a condition that is
                off is not rendered at all, exactly as it is not drawn in Figma.
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
