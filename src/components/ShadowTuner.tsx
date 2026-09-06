import { useState } from 'react';
import {
  H2, H4, Body, Caption, Overline, Label, Slider, SwitchInput, Card, Section,
  VStack, HStack, Divider, CodeBlock, Button, Link, Table,
} from '@omni-design/components';
import { LightPad } from './LightPad';
import {
  effectLevelRecipe, shadowLayers, shadowLayerCount, dropshadowAlphas,
  dropshadowRGB, SHADOW_LEVELS, SHADOW_DEFAULTS,
  type ShadowOptions, type ShadowLevel,
} from '../utils/dropshadow';

/**
 * Shadow Tuner — a utility page for dialling the shadow generator before its
 * values are committed to the Figma variables and the CSS export.
 *
 * Route: /tune-shadows
 *
 * Controls are Josh Comeau's shadow-palette generator, renamed where his name
 * is a joke (Oomph -> Intensity). The maths lives in src/utils/dropshadow.ts;
 * this page only drives ShadowOptions, so what renders here is exactly what
 * the CSS export and the Figma payload will produce for the same settings.
 *
 * MISSING-LIB-COMPONENT tags: XYPad — tagged in components/LightPad.tsx,
 * which this page and the Shadow stage share.
 */

/** The surface the shadows are judged against. Fixed rather than picked — a
 *  shadow is derived from the background it falls on, and one default keeps
 *  the tuner about the shadow rather than about colour. */
const SURFACE = '#f0ebe0';

/** Label row: name left, live value right. */
function ControlLabel({ name, value }: { name: string; value: string }) {
  return (
    <HStack style={{ justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
      <Label>{name}</Label>
      <Caption color="quiet">{value}</Caption>
    </HStack>
  );
}

export default function ShadowTuner() {
  const [o, setO] = useState<Required<ShadowOptions>>({ ...SHADOW_DEFAULTS });

  const set = <K extends keyof ShadowOptions>(k: K, v: Required<ShadowOptions>[K]) =>
    setO((prev) => ({ ...prev, [k]: v }));

  const rgb = dropshadowRGB(SURFACE, o);
  // The generator emits rgba(var(--Dropshadow-Color), a); resolve the var here
  // so each figure previews against the surface it was derived from.
  const resolve = (level: ShadowLevel) =>
    effectLevelRecipe(level, o).replace(/var\(--Dropshadow-Color\)/g, rgb);

  const css = [
    `--Dropshadow-Color: ${rgb};`,
    ...SHADOW_LEVELS.map((l) => `--Effect-Level-${l}:\n  ${effectLevelRecipe(l, o).split(', ').join(',\n  ')};`),
  ].join('\n');

  return (
    <>
      {/* Inline stylesheet rather than inline styles: the split needs media
          queries, which the style attribute cannot express. Scoped to this
          page's two class names. */}
      <style>{`
        .shadow-tuner-split {
          display: grid;
          grid-template-columns: 40% 60%;
          min-height: 100vh;
        }
        @media (max-width: 1400px) {
          .shadow-tuner-split { grid-template-columns: 30% 70%; }
        }
        @media (max-width: 900px) {
          .shadow-tuner-split { grid-template-columns: 1fr; }
          /* Stacked, the preview must not pin itself to the viewport or it
             eats the whole screen before the controls are reachable. */
          .shadow-tuner-preview {
            position: static;
            height: auto;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: flex-start;
          }
        }
      `}</style>
      <div className="shadow-tuner-split">
      {/* ── Preview, left. Sticky so it stays put while the tables scroll. ──
          Painted with the literal surface hex rather than a token: the whole
          point is to judge the shadow against the colour it was DERIVED from,
          and that colour is an input to the maths, not a theme surface. */}
      <aside
        className="shadow-tuner-preview"
        /* The panel paints the SURFACE the shadows fall onto, as a literal hex:
           it is an input to the maths, not a theme surface. data-theme is still
           set so the Container cards inside have a theme to resolve against —
           without it, data-surface="Container" has nothing to select from and
           --Background silently inherits the parent's tone. */
        data-theme="Neutral"
        style={{
          position: 'sticky', top: 0, alignSelf: 'start', height: '100vh',
          overflowY: 'auto', background: SURFACE,
          display: 'flex', flexDirection: 'column',
          /* flex-start, not centre: the cards should begin level with the
             tools column, so the top padding matches that Section's 40px.
             Centring also clips the first child off the top once the stack
             overflows, which is how Level 1 lost its top half earlier. */
          justifyContent: 'flex-start',
          gap: 36, padding: '40px 56px 56px',
        }}
      >
        {SHADOW_LEVELS.map((l) => (
          /* A Container Card sitting ON the surface, which is what a real card
             is — so the shadow falls onto the panel behind it rather than onto
             a box its own colour.

             sx carries boxShadow, which is normally a lib-component override to
             avoid. Here the generated shadow IS the subject: there is no
             variant for "this arbitrary elevation", and the whole page exists
             to look at it. Nothing else about the Card's appearance is
             touched — surface="Container" supplies the fill. */
          <Card
            key={l}
            surface="Container"
            sx={{
              width: '78%', maxWidth: 300, minHeight: 76,
              boxShadow: resolve(l),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              alignSelf: 'center', textAlign: 'center',
            }}
          >
            <Caption color="quiet">Level {l}</Caption>
          </Card>
        ))}
      </aside>

      {/* ── Tools, right ────────────────────────────────────────────────── */}
        <Section theme="Neutral" surface="Surface" padding="40px 40px 64px">
        <VStack spacing={3} style={{ maxWidth: 900 }}>
          <VStack spacing={1}>
            <Overline>Utility</Overline>
            <H2>Shadow Palette Generator</H2>
          </VStack>

          <Divider />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 36,
              alignItems: 'start',
            }}
          >
            {/* Left column: Intensity, then the light pad */}
            <VStack spacing={2}>
              <VStack spacing={0}>
                <ControlLabel name="Intensity" value={o.intensity.toFixed(2)} />
                <Slider
                  value={o.intensity} min={0.05} max={1} step={0.01}
                  aria-label="Intensity"
                  onChange={(_e: unknown, v: number) => set('intensity', v)}
                />
                <Caption color="quiet">
                  Comeau&apos;s &ldquo;Oomph&rdquo;. The total opacity every level composites to.
                  Each level hits the same total, so Resolution changes smoothness, never weight.
                </Caption>
              </VStack>

              <VStack spacing={0} style={{ width: '100%' }}>
                <ControlLabel name="Light Position" value={`${o.lightX.toFixed(2)}, ${o.lightY.toFixed(2)}`} />
                <LightPad x={o.lightX} y={o.lightY} onChange={(lx, ly) => setO((p) => ({ ...p, lightX: lx, lightY: ly }))} />
                <Caption color="quiet">
                  The shadow falls away from the light. Only the ratio matters — dragging
                  steers the shadow without lengthening it. Centre the light horizontally
                  for the straight-down offset your Figma styles use.
                </Caption>
              </VStack>
            </VStack>

            {/* Right column: Crispy, Tint, Resolution */}
            <VStack spacing={2}>
              <VStack spacing={0}>
                <ControlLabel name="Crispy" value={o.crispy.toFixed(2)} />
                <Slider
                  value={o.crispy} min={0} max={1} step={0.01}
                  aria-label="Crispy"
                  onChange={(_e: unknown, v: number) => set('crispy', v)}
                />
                <Caption color="quiet">
                  Drives blur and spread together: blur {(1.8 - 0.9 * o.crispy).toFixed(2)}× the
                  offset, outer tuck-in −{(5 * o.crispy).toFixed(1)}px. Crisper = tighter.
                </Caption>
              </VStack>

              <VStack spacing={0}>
                <ControlLabel name="Tint Shadow" value={o.tint ? 'on' : 'neutral grey'} />
                {/* The lib's Switch ignores `checked` on the first render — it
                    mounts from `defaultChecked` and then keeps its own internal
                    state, so `checked={true}` alone renders an OFF switch and
                    tint silently starts disabled. Seeding defaultChecked fixes
                    the mount; the key remounts it so Reset can move it back. */}
                <SwitchInput
                  key={`tint-${o.tint}`}
                  defaultChecked={o.tint}
                  checked={o.tint}
                  aria-label="Tint shadow"
                  onChange={(e: { target: { checked: boolean } }) => set('tint', e.target.checked)}
                />
                <Caption color="quiet">
                  Off gives a neutral grey. An achromatic surface stays grey either way —
                  injecting a hue there paints a pink shadow under a white card.
                </Caption>
              </VStack>

              <VStack spacing={0}>
                <ControlLabel name="Resolution" value={o.resolution.toFixed(2)} />
                <Slider
                  value={o.resolution} min={0} max={1} step={0.01}
                  aria-label="Resolution"
                  onChange={(_e: unknown, v: number) => set('resolution', v)}
                />
                <Caption color="quiet">
                  Layers {SHADOW_LEVELS.map((l) => shadowLayerCount(l, o)).join(' / ')}. Subdivides a
                  fixed envelope — more layers, same size shadow. Level N never drops below
                  N layers; level 5 reaches 10.
                </Caption>
              </VStack>

              <HStack>
                <Button size="small" variant="neutral-outline" onClick={() => setO({ ...SHADOW_DEFAULTS })}>
                  Reset to defaults
                </Button>
              </HStack>
            </VStack>
          </div>

          {/* ── Per-layer breakdown: what each Figma slot gets ──────────── */}
          <Card padding="medium">
            <VStack spacing={2}>
              <H4>Figma slots</H4>
              <Body color="quiet">
                X / Y / blur / spread @ opacity. Slots past a level&apos;s layer count take
                opacity 0 — that is how resolution changes without touching Figma.
              </Body>
              <div style={{ overflowX: 'auto' }}>
                <Table
                  size="small"
                  variant="outlined"
                  columns={[
                    { label: 'Slot', width: 60 },
                    ...SHADOW_LEVELS.map((l) => ({ label: `L${l} (${shadowLayerCount(l, o)})` })),
                  ]}
                  rows={Array.from({ length: 10 }, (_, i) => [
                    String(i + 1),
                    ...SHADOW_LEVELS.map((l) => {
                      const layers = shadowLayers(l, o);
                      const alphas = dropshadowAlphas(l, o);
                      return i >= layers.length
                        ? '— 0'
                        : `${layers[i][0]}/${layers[i][1]}/${layers[i][2]}/${layers[i][3]} @${Math.round(alphas[i] * 1000) / 1000}`;
                    }),
                  ])}
                />
              </div>
            </VStack>
          </Card>

          <CodeBlock code={css} language="CSS" wrap />

          <Divider />

          <VStack spacing={1}>
            <Caption color="quiet">
              Happy with these? The numbers become SHADOW_DEFAULTS in src/utils/dropshadow.ts,
              and everything downstream follows.
            </Caption>
            <Caption color="quiet">
              Inspired by Josh Comeau&apos;s{' '}
              <Link href="https://www.joshwcomeau.com/shadow-palette/" target="_blank" rel="noopener noreferrer">
                Shadow Palette Generator
              </Link>
              , adapted to work with Omni Design — five elevation levels instead of three, a
              shadow colour derived from the brand surface it falls on, and values that carry
              straight through to the CSS export and the Figma variables.
            </Caption>
          </VStack>
        </VStack>
        </Section>
      </div>
    </>
  );
}
