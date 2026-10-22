/**
 * Advanced: the Default button on every background, at every surface level.
 *
 * Four themes by five levels. Each cell is the real background with the real
 * Default button on it — color from the main choice, tone from the cell — so a
 * person can judge it rather than read a description of it. The only thing a
 * cell changes is the TONE — Fixed, Tonal, or any tone of the button's color;
 * color stays one decision.
 *
 * The cells come from buildPreviewCSS's own defaultButtonFor (onButtonGrid), so
 * the grid cannot show a different button from the preview. Each cell paints
 * its values as custom properties on a Section and renders lib components into
 * it; nothing here picks a color.
 */
import { useMemo, useState } from 'react';
import { Button, Caption, Label, Section, Select, ToggleButtonGroup, VStack } from '@omni-design/components';
import { buildPreviewCSS, type ButtonGridCell } from '../utils/buildPreviewCSS';
import type { ButtonTone, CellTone } from '../utils/buttonChoice';
import type { ColorScheme, UserSelections } from '../types';

const LEVEL_LABEL: Record<string, string> = {
  'Surface-Dimmest': 'Dimmest',
  'Surface-Dim': 'Dim',
  'Surface': 'Base',
  'Surface-Bright': 'Bright',
  'Surface-Brightest': 'Brightest',
};

/* The picker: the two rules first, then every tone of the button's color.
   Swatch and name only — a cell is too narrow for more, and the contrast is
   already in the caption above it. */
function toneOptions(c: ButtonGridCell) {
  const tonal = c.options.find((o) => o.tone === c.tonalTone);
  return [
    { value: 'fixed', label: 'Fixed', color: c.fixedHex },
    { value: 'tonal', label: 'Tonal', color: tonal?.hex ?? c.fixedHex },
    ...c.options.map((o) => ({ value: String(o.tone), label: `Tone ${o.tone}`, color: o.hex })),
  ];
}

interface Props {
  colorScheme: ColorScheme;
  userSelections: UserSelections;
  onChange: (cellTones: UserSelections['buttonCellTones']) => void;
}

export function ButtonToneGrid({ colorScheme, userSelections, onChange }: Props) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const cells = useMemo(() => {
    let out: ButtonGridCell[] = [];
    buildPreviewCSS({
      colorScheme,
      userSelections,
      componentStyle: 'modern',
      mode,
      // The grid reads only colors; the sliders change radii and shadows.
      styleCustomizations: undefined,
      onButtonGrid: (c: ButtonGridCell[]) => { out = c; },
    } as never);
    return out;
  }, [colorScheme, userSelections, mode]);

  const isBW = userSelections.button === 'black-white';
  const mainTone: ButtonTone = userSelections.buttonTone === 'tonal' || userSelections.button === 'tonal' ? 'tonal' : 'fixed';
  const custom = userSelections.buttonCellTones ?? {};
  const anyCustom = Object.keys(custom).length > 0;

  /* Store only what differs from the main tone: a cell set back to it is
     dropped, so changing the main tone later still moves every untouched cell. */
  const setCell = (key: string, tone: CellTone) => {
    const { [key]: _old, ...rest } = custom;
    onChange(tone === mainTone ? rest : { ...rest, [key]: tone });
  };

  const themes = ['Primary', 'Secondary', 'Tertiary', 'Neutral'] as const;

  return (
    <VStack spacing={2} style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, width: '100%' }}>
        <ToggleButtonGroup value={mode} onChange={(v: 'light' | 'dark') => v && setMode(v)} size="small">
          <Button value="light" size="small">Light</Button>
          <Button value="dark" size="small">Dark</Button>
        </ToggleButtonGroup>
        {anyCustom && (
          <Button variant="ghost" size="small" onClick={() => onChange({})}>Reset all</Button>
        )}
      </div>
      {themes.map((theme) => (
        <VStack key={theme} spacing={1} style={{ width: '100%' }}>
          <Label component="span">{theme} backgrounds</Label>
          <div className="button-tone-grid-row">
            {cells.filter((c) => c.theme === theme).map((c) => {
              const key = `${c.theme}/${c.level}`;
              return (
                <Section
                  key={key}
                  theme={theme}
                  surface={c.level}
                  className={'button-tone-grid-cell' + (c.custom ? ' is-custom' : '')}
                  style={c.vars as React.CSSProperties}
                >
                  <VStack spacing={1} alignItems="center">
                    <Caption>{LEVEL_LABEL[c.level]}{c.custom ? ' · custom' : ''}</Caption>
                    <Button size="small">Button</Button>
                    {/* Two lines in ONE caption, so they sit at the caption's
                        own line height rather than a stack gap apart, left
                        aligned. Both on every cell, so the cells compare. */}
                    <Caption style={{ alignSelf: 'stretch', textAlign: 'left' }}>
                      Fill {c.fillContrast.toFixed(1)}:1
                      <br />Border {c.borderContrast.toFixed(1)}:1
                    </Caption>
                    {/* color="default" reads the cell's own --Text. The lib's
                        default is "primary", which reads --Text-Primary — not
                        set per cell, so the label came from the page and went
                        pale on the lighter cells. */}
                    {!isBW && (
                      <Select
                        mode="color"
                        color="default"
                        size="small"
                        fullWidth
                        /* The trigger's 140px floor is wider than a cell, so it
                           overflowed and the shell clipped the arrow. */
                        minWidth={0}
                        value={String(c.tone)}
                        onChange={(v: string) => setCell(key, v === 'fixed' || v === 'tonal' ? v : Number(v))}
                        options={toneOptions(c)}
                        aria-label={`Button tone on ${theme} ${LEVEL_LABEL[c.level]}`}
                      />
                    )}
                  </VStack>
                </Section>
              );
            })}
          </div>
        </VStack>
      ))}
    </VStack>
  );
}

export default ButtonToneGrid;
