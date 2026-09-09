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

export default function NavDesignerPage() {
  const [options, setOptions] = useState<NavOptions>({
    layout: 'brand-left', search: true, actions: true, avatar: true, sticky: true,
  });

  const set = <K extends keyof NavOptions>(k: K, v: NavOptions[K]) =>
    setOptions((o) => ({ ...o, [k]: v }));

  /* Recomputed from the definition rather than tracked alongside it, so what
     is shown is always what would be published. */
  const { spec, tokens } = useMemo(() => {
    const def = navDefinition(options);
    return { spec: toAddonSpec(def), tokens: tokensUsed(def) };
  }, [options]);

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
              <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap', alignItems: 'stretch' }}>
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
                        flex: '1 1 200px', minWidth: 180, cursor: 'pointer',
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
              </HStack>
              <BodySmall color="quiet">
                {NAV_LAYOUTS.find((l) => l.id === options.layout)?.description}
              </BodySmall>
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Preview</H4>
              <div style={{ maxWidth: 480 }}>
                <NavLayoutPreview layout={options.layout} options={options} />
              </div>
              <Caption color="quiet">
                A diagram, not the component. Drawing the real thing here would be a
                second implementation of the layout, and the two would disagree the
                moment either changed. Faded parts are the condensed state — present,
                but not until the hero has scrolled past.
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
