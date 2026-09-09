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

/** One row of the schematic: a labelled box sized like the slot it stands for. */
function SlotBox({ label, grow, muted }: { label: string; grow?: boolean; muted?: boolean }) {
  return (
    <div
      data-surface={muted ? 'Surface-Dim' : 'Container'}
      style={{
        flex: grow ? 1 : '0 0 auto',
        minWidth: grow ? 0 : 88,
        padding: 'var(--Sizing-2, 8px) var(--Sizing-3, 12px)',
        borderRadius: 'var(--Card-Radius, 8px)',
        border: '1px solid var(--Border)',
        background: 'var(--Background)',
        textAlign: 'center',
      }}
    >
      <Caption color="quiet">{label}</Caption>
    </div>
  );
}

function Schematic({ options }: { options: NavOptions }) {
  const right = [
    options.search && 'Search',
    options.actions && 'Actions',
    options.avatar && 'Avatar',
  ].filter(Boolean) as string[];

  const bar = (
    <HStack gap="var(--Sizing-2)" style={{ alignItems: 'center', width: '100%' }}>
      {options.layout === 'brand-centre' ? (
        <>
          <SlotBox label="Tabs / Menu" />
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <SlotBox label="Brand" />
          </div>
        </>
      ) : (
        <>
          <SlotBox label="Brand" />
          {options.layout === 'rail'
            ? <div style={{ flex: 1 }} />
            : <div style={{ flex: 1 }}><SlotBox label="Tabs / Menu" grow /></div>}
        </>
      )}
      {right.length
        ? right.map((r) => <SlotBox key={r} label={r} />)
        : <SlotBox label="End (empty)" muted />}
    </HStack>
  );

  return (
    <div
      data-surface="Surface"
      style={{
        border: '1px solid var(--Border)',
        borderRadius: 'var(--Card-Radius, 8px)',
        padding: 'var(--Sizing-2, 8px)',
        background: 'var(--Background)',
      }}
    >
      {options.layout === 'rail' ? (
        <HStack gap="var(--Sizing-2)" style={{ alignItems: 'stretch' }}>
          <div style={{ width: 96 }}><SlotBox label="Rail" muted /></div>
          <div style={{ flex: 1 }}>{bar}</div>
        </HStack>
      ) : bar}
    </div>
  );
}

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
              <HStack gap="var(--Sizing-2)" style={{ flexWrap: 'wrap' }}>
                {NAV_LAYOUTS.map((l) => (
                  <Button
                    key={l.id}
                    variant={options.layout === l.id ? 'default' : 'default-outline'}
                    onClick={() => set('layout', l.id as NavLayout)}
                  >
                    {l.label}
                  </Button>
                ))}
              </HStack>
              <BodySmall color="quiet">
                {NAV_LAYOUTS.find((l) => l.id === options.layout)?.description}
              </BodySmall>
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack gap="var(--Sizing-3)">
              <H4>Preview</H4>
              <Schematic options={options} />
              <Caption color="quiet">
                A schematic, not the component. Drawing the real thing here would be a
                second implementation of the layout, and the two would disagree the
                moment either changed.
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
                checked={!!options.sticky}
                onChange={(e: { target: { checked: boolean } }) => set('sticky', e.target.checked)}
                label="Sticky"
              />
              <Caption color="quiet">
                Sticky reaches the React component only. Figma has no scroll behaviour,
                so it is left out of the spec rather than faked as a frame.
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
