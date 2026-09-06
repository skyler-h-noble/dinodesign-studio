import { useState, useRef, useLayoutEffect } from 'react';
import {
  H3, BodySmall, Label, Caption, Slider, SwitchInput, Button,
  VStack, HStack, Card,
} from '@omni-design/components';
import { LightPad } from '../LightPad';
import {
  effectLevelRecipe, shadowLayerCount, dropshadowRGB,
  SHADOW_DEFAULTS, SHADOW_LEVELS, type ShadowLevel,
} from '../../utils/dropshadow';
import type { StageProps, ComponentStyle } from '../../types';
import type { StyleCustomizations } from './ComponentStyleStage';

/**
 * Shadow — the step after Component Style Settings.
 *
 * Josh Comeau's shadow-palette generator, adapted to five elevation levels.
 * The five controls live on StyleCustomizations, so they travel with the
 * component style the user picked and reach the CSS export, the preview and
 * the Figma payload through the same _componentStyle record every other
 * slider on the previous step uses.
 *
 * The full breakdown — the per-layer Figma slot table and the generated CSS —
 * is on the /tune-shadows utility page. This step is the design decision, not
 * the audit.
 *
 * MISSING-LIB-COMPONENT tags in this file: XYPad (in components/LightPad.tsx).
 */

interface Props extends StageProps {
  componentStyle: ComponentStyle;
  customizations: StyleCustomizations;
  onChange: (c: StyleCustomizations) => void;
  /** The page background these shadows will fall onto, so the preview judges
   *  them against the brand's own surface rather than a stand-in. */
  surfaceHex?: string;
}

/** Label row: name left, live value right. */
function ControlLabel({ name, value }: { name: string; value: string }) {
  return (
    <HStack style={{ justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
      <Label>{name}</Label>
      <Caption color="quiet">{value}</Caption>
    </HStack>
  );
}

export default function ShadowStage({ customizations, onChange, surfaceHex }: Props) {
  const [c, setC] = useState<StyleCustomizations>(customizations);

  /* Push straight to the parent rather than syncing from an effect. onChange is
     a fresh closure on every App render, so an effect keyed on it would fire
     every parent render; keyed only on the values it needs a ref, which is a
     lint error and still a render-phase write. Writing both at the call site
     has neither problem and keeps Continue carrying the current values. */
  const commit = (next: StyleCustomizations) => { setC(next); onChange(next); };

  const set = <K extends keyof StyleCustomizations>(k: K, v: StyleCustomizations[K]) =>
    commit({ ...c, [k]: v });

  const o = {
    intensity: c.shadowIntensity, crispy: c.shadowCrispy, resolution: c.shadowResolution,
    lightX: c.shadowLightX, lightY: c.shadowLightY, tint: c.shadowTint,
  };

  /* Read the surface the cards actually sit on, rather than re-deriving it.
     App used to compute this from the background selection, which duplicated
     logic the cascade already owns and got it wrong for Neutral backgrounds —
     the lookup only covered chromatic palettes, returned undefined, and the
     shadow fell back to a cream default, so a green brand cast warm shadows.
     Measuring the resolved --Background cannot disagree with what is painted.
     useLayoutEffect runs before paint, so the corrected colour lands in the
     same frame; the state guard stops it looping. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measuredBg, setMeasuredBg] = useState<string | null>(null);
  /* Mount + surfaceHex only.
     This ran with NO dependency array, on the reasoning that the guard made the
     setState a no-op once settled. That is the precise pattern behind React's
     "Maximum update depth exceeded" — the guard stops the value oscillating but
     React still counts a setState-inside-an-effect on every single render, and
     the page renders continuously while a Card's box-shadow transition runs.
     Reading once is enough: the surface behind the cards does not change while
     this step is open. */
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const m = getComputedStyle(el).backgroundColor.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return;
    const hex = `#${[1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join('')}`;
    setMeasuredBg((prev) => (prev === hex ? prev : hex));
  }, [surfaceHex]);

  const surface = measuredBg || surfaceHex || '#f0ebe0';
  const rgb = dropshadowRGB(surface, o);
  // The recipe emits rgba(var(--Dropshadow-Color), a); resolve the var here so
  // each swatch previews against the surface it was derived from.
  const resolve = (level: ShadowLevel) =>
    effectLevelRecipe(level, o).replace(/var\(--Dropshadow-Color\)/g, rgb);

  const reset = () => commit({
    ...c,
    shadowIntensity: SHADOW_DEFAULTS.intensity,
    shadowCrispy: SHADOW_DEFAULTS.crispy,
    shadowResolution: SHADOW_DEFAULTS.resolution,
    shadowLightX: SHADOW_DEFAULTS.lightX,
    shadowLightY: SHADOW_DEFAULTS.lightY,
    shadowTint: SHADOW_DEFAULTS.tint,
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ─── Left: persistent sidebar. Same frame as Component Style Settings —
           data-surface + the painted --Background and the right border are what
           make it read as a rail rather than floating controls. ─── */}
      <div data-surface="Surface-Dim" style={{
        width: 296,
        flexShrink: 0,
        overflow: 'hidden',
        borderRight: '1px solid var(--Border)',
        background: 'var(--Background)',
      }}>
        <div style={{ width: 296, padding: '8px 16px', boxSizing: 'border-box' }}>
        <VStack spacing={2}>
          <H3 style={{ fontSize: '1rem', margin: 0 }}>Shadow Settings</H3>

          <VStack spacing={0}>
            <ControlLabel name="Intensity" value={c.shadowIntensity.toFixed(2)} />
            <Slider variant="default" size="small" min={0.05} max={1} step={0.01}
              value={c.shadowIntensity} aria-label="Intensity"
              onChange={(_: unknown, v: number | number[]) => set('shadowIntensity', v as number)} />
            <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
              The weight every level composites to. Also deepens the shadow colour.
            </BodySmall>
          </VStack>

          <VStack spacing={0}>
            <ControlLabel name="Crispy" value={c.shadowCrispy.toFixed(2)} />
            <Slider variant="default" size="small" min={0} max={1} step={0.01}
              value={c.shadowCrispy} aria-label="Crispy"
              onChange={(_: unknown, v: number | number[]) => set('shadowCrispy', v as number)} />
            <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
              Blur {(1.8 - 0.9 * c.shadowCrispy).toFixed(2)}× the offset, tuck-in
              −{(5 * c.shadowCrispy).toFixed(1)}px. Crisper = tighter.
            </BodySmall>
          </VStack>

          <VStack spacing={0}>
            <ControlLabel name="Resolution" value={c.shadowResolution.toFixed(2)} />
            <Slider variant="default" size="small" min={0} max={1} step={0.01}
              value={c.shadowResolution} aria-label="Resolution"
              onChange={(_: unknown, v: number | number[]) => set('shadowResolution', v as number)} />
            <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
              Layers {SHADOW_LEVELS.map((l) => shadowLayerCount(l, o)).join(' / ')}. More layers,
              same size shadow.
            </BodySmall>
          </VStack>

          <VStack spacing={0} style={{ width: '100%' }}>
            <ControlLabel name="Light Position" value={`${c.shadowLightX.toFixed(2)}, ${c.shadowLightY.toFixed(2)}`} />
            <LightPad
              x={c.shadowLightX}
              y={c.shadowLightY}
              onChange={(lx, ly) => commit({ ...c, shadowLightX: lx, shadowLightY: ly })}
            />
            <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
              The shadow falls away from the light. Centre it horizontally for a
              straight-down offset.
            </BodySmall>
          </VStack>

          <VStack spacing={0}>
            <ControlLabel name="Tint Shadow" value={c.shadowTint ? 'on' : 'neutral grey'} />
            {/* The lib's Switch ignores `checked` on first render — it mounts
                from defaultChecked and then keeps its own state, so
                checked={true} alone renders an OFF switch. The key remounts it
                so Reset can move it back. */}
            <SwitchInput
              key={`tint-${c.shadowTint}`}
              defaultChecked={c.shadowTint}
              checked={c.shadowTint}
              aria-label="Tint shadow"
              onChange={(e: { target: { checked: boolean } }) => set('shadowTint', e.target.checked)}
            />
            <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
              Off gives a neutral grey. A neutral surface stays grey either way.
            </BodySmall>
          </VStack>

          <Button size="small" variant="neutral-outline" onClick={reset}>Reset to defaults</Button>
        </VStack>
        </div>
      </div>

      {/* ─── Right: the five elevations on the brand's own surface ─── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <VStack spacing={3} style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
          {/* data-surface is what makes the Cards inside resolve: the brand CSS
              keys containers off `[data-surface] [data-surface="Container"]`, so
              a wrapper carrying only data-theme leaves --Background undefined
              and every Card renders transparent — the panel showing straight
              through it. Painted from the cascade rather than the literal hex
              for the same reason; surfaceHex still feeds the shadow MATHS, and
              both come from the same background selection. */}
          <div
            ref={wrapRef}
            data-surface="Surface"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 36, padding: '48px 32px', borderRadius: 12,
              background: 'var(--Background)',
            }}
          >
            {SHADOW_LEVELS.map((l) => (
              <Card
                key={l}
                padding="medium"
                sx={{
                  width: '100%', maxWidth: 320,
                  /* The Card ROOT is transparent — border and shadow only. The
                     background lives on its inner content Box, so height and
                     centring have to go THERE or the card paints a band in the
                     middle and shows the page through the top and bottom. */
                  '& > *': {
                    minHeight: 76, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', textAlign: 'center',
                  },
                  /* boxShadow is normally a lib-component override to avoid.
                     Here the generated shadow IS the subject — there is no
                     variant for "this arbitrary elevation". Nothing else about
                     the Card's appearance is touched. */
                  boxShadow: resolve(l),
                }}
              >
                <Caption color="quiet">Level {l}</Caption>
              </Card>
            ))}
          </div>
        </VStack>
      </div>
    </div>
  );
}
