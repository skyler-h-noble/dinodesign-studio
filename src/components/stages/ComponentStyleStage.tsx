import { useState, useEffect } from 'react';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Label, Slider,
  Accordion, AccordionSummary, AccordionDetails,
} from '@dynodesign/components';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import type { StageProps, ComponentStyle, ColorScheme, UserSelections } from '../../types';
import { loadGoogleFonts } from '../../utils/googleFontsManager';
import '../../styles/component-style.css';

interface Props extends StageProps {
  colorScheme: ColorScheme | null;
  onStyleSelected: (style: ComponentStyle, customizations: StyleCustomizations) => void;
  selectedStyle?: ComponentStyle;
  savedCustomizations?: Record<ComponentStyle, StyleCustomizations>;
  userSelections?: UserSelections;
  typographyStyles?: import('../../types').TypographyStyle[];
}

export interface StyleCustomizations {
  radius: number;
  buttonRadius: number;
  bevel: number;
  bevelOpacity: number;
  buttonHeight: number;
  smallButtonHeight: number;
  largeButtonHeight: number;
  minButtonWidth: number;
  iconButtonRadius: number;
}

const STYLE_DEFAULTS: Record<ComponentStyle, { label: string; description: string } & StyleCustomizations> = {
  professional: { label: 'Professional', description: 'Clean lines, minimal radius', radius: 4, buttonRadius: 2, bevel: 0, bevelOpacity: 50, buttonHeight: 36, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 2 },
  modern: { label: 'Modern', description: 'Balanced curves, medium shadows', radius: 8, buttonRadius: 4, bevel: 0, bevelOpacity: 50, buttonHeight: 36, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 4 },
  bold: { label: 'Bold', description: 'Strong elements, generous rounding', radius: 16, buttonRadius: 8, bevel: 0, bevelOpacity: 50, buttonHeight: 36, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 8 },
  playful: { label: 'Playful', description: 'Maximum curves, dynamic feel', radius: 24, buttonRadius: 64, bevel: 10, bevelOpacity: 80, buttonHeight: 36, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 64 },
};

const STYLE_KEYS: ComponentStyle[] = ['professional', 'modern', 'bold', 'playful'];

const DEFAULT_CUSTOMIZATIONS: Record<ComponentStyle, StyleCustomizations> = Object.fromEntries(
  STYLE_KEYS.map(k => [k, {
    radius: STYLE_DEFAULTS[k].radius,
    buttonRadius: STYLE_DEFAULTS[k].buttonRadius,
    bevel: STYLE_DEFAULTS[k].bevel,
    buttonHeight: STYLE_DEFAULTS[k].buttonHeight,
    smallButtonHeight: STYLE_DEFAULTS[k].smallButtonHeight,
    largeButtonHeight: STYLE_DEFAULTS[k].largeButtonHeight,
    minButtonWidth: STYLE_DEFAULTS[k].minButtonWidth,
    iconButtonRadius: STYLE_DEFAULTS[k].iconButtonRadius,
  }])
) as Record<ComponentStyle, StyleCustomizations>;

export default function ComponentStyleStage({
  onNext, onBack, colorScheme, onStyleSelected, selectedStyle: initialStyle, savedCustomizations,
  userSelections, typographyStyles,
}: Props) {
  const [selected, setSelected] = useState<ComponentStyle>(initialStyle || 'modern');
  const [customizations, setCustomizations] = useState<Record<ComponentStyle, StyleCustomizations>>(() => {
    if (!savedCustomizations) return DEFAULT_CUSTOMIZATIONS;
    // Merge saved with defaults to fill any missing new fields
    const merged = { ...DEFAULT_CUSTOMIZATIONS };
    for (const key of STYLE_KEYS) {
      if (savedCustomizations[key]) {
        merged[key] = { ...DEFAULT_CUSTOMIZATIONS[key], ...savedCustomizations[key] };
      }
    }
    return merged;
  });

  useEffect(() => {
    if (typographyStyles && typographyStyles.length > 0) {
      const families = typographyStyles.map(t => t.family).filter(Boolean);
      if (families.length) loadGoogleFonts(families);
    }
  }, [typographyStyles]);

  const custom = customizations[selected];
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ button: true, iconButton: true, card: true });
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const updateCustom = (field: keyof StyleCustomizations, value: number) => {
    setCustomizations(prev => ({
      ...prev,
      [selected]: { ...prev[selected], [field]: value },
    }));
  };

  // Save customizations whenever they change
  useEffect(() => {
    onStyleSelected(selected, customizations[selected]);
  }, [selected, customizations]);

  // Bevel is a % of button height — compute px for each size
  const bevelPx = (height: number) => Math.round(height * custom.bevel / 100);
  const bevelStyleFor = (height: number) => {
    const px = bevelPx(height);
    if (px <= 0 || custom.bevel <= 0) return 'none';
    return `inset -${px}px -${px}px ${px}px color-mix(in srgb, var(--Buttons-Default-Highlight, #ffffff) ${custom.bevelOpacity}%, transparent), inset ${px}px ${px}px ${px}px color-mix(in srgb, var(--Buttons-Default-Lowlight, #000000) ${custom.bevelOpacity}%, transparent)`;
  };
  const bevelStyle = bevelStyleFor(custom.buttonHeight);

  return (
    <div className="comp-style-page">
      <VStack spacing={4} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <H2 style={{ textAlign: 'center' }}>Component Style</H2>
        <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
          Choose a base style then fine-tune the details.
        </Body>

        {/* Style selector row */}
        <HStack spacing={2} style={{ width: '100%', flexWrap: 'wrap' }}>
          {STYLE_KEYS.map(styleKey => {
            const style = STYLE_DEFAULTS[styleKey];
            const isSelected = selected === styleKey;
            return (
              <Button
                key={styleKey}
                variant={isSelected ? 'solid' : 'outline'}
                color="default"
                size="small"
                onClick={() => {
                  setSelected(styleKey);
                  setCustomizations(prev => ({
                    ...prev,
                    [styleKey]: DEFAULT_CUSTOMIZATIONS[styleKey],
                  }));
                }}
              >
                {style.label}
              </Button>
            );
          })}
        </HStack>

        {/* Main layout: controls left, preview right */}
        <div className="comp-style-layout">
          {/* Left column — Controls */}
          <div className="comp-style-controls">
            <Accordion defaultExpanded>
              <AccordionSummary>
                <H3 style={{ fontSize: '1rem', margin: 0 }}>Button</H3>
              </AccordionSummary>
              <AccordionDetails>
                <VStack spacing={2} style={{ width: '100%' }}>
                  <Slider label="Desktop Button Height" min={28} max={48} value={custom.buttonHeight} onChange={(_: any, v: number | number[]) => updateCustom('buttonHeight', v as number)} size="small" valueLabelDisplay="auto" />
                  <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>iOS: 44px, Android: 48px</BodySmall>
                  <Slider label="Small Button Height" min={24} max={32} value={custom.smallButtonHeight} onChange={(_: any, v: number | number[]) => updateCustom('smallButtonHeight', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Large Button Height" min={44} max={72} value={custom.largeButtonHeight} onChange={(_: any, v: number | number[]) => updateCustom('largeButtonHeight', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Border Radius" min={0} max={64} value={custom.buttonRadius} onChange={(_: any, v: number | number[]) => updateCustom('buttonRadius', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Minimum Width" min={40} max={120} value={custom.minButtonWidth} onChange={(_: any, v: number | number[]) => updateCustom('minButtonWidth', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Bevel" min={0} max={20} value={custom.bevel} onChange={(_: any, v: number | number[]) => updateCustom('bevel', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Bevel Opacity" min={0} max={100} value={custom.bevelOpacity} onChange={(_: any, v: number | number[]) => updateCustom('bevelOpacity', v as number)} size="small" valueLabelDisplay="auto" />
                </VStack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary>
                <H3 style={{ fontSize: '1rem', margin: 0 }}>Icon Button</H3>
              </AccordionSummary>
              <AccordionDetails>
                <VStack spacing={2} style={{ width: '100%' }}>
                  <Slider label="Border Radius" min={0} max={64} value={custom.iconButtonRadius} onChange={(_: any, v: number | number[]) => updateCustom('iconButtonRadius', v as number)} size="small" valueLabelDisplay="auto" />
                </VStack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary>
                <H3 style={{ fontSize: '1rem', margin: 0 }}>Card</H3>
              </AccordionSummary>
              <AccordionDetails>
                <VStack spacing={2} style={{ width: '100%' }}>
                  <Slider label="Border Radius" min={0} max={32} value={custom.radius} onChange={(_: any, v: number | number[]) => updateCustom('radius', v as number)} size="small" valueLabelDisplay="auto" />
                </VStack>
              </AccordionDetails>
            </Accordion>
          </div>

          {/* Right column — Preview */}
          <div className="comp-style-preview-area">
            <div
              style={{
                '--Style-Border-Radius': `${custom.buttonRadius}px`,
                '--Card-Radius': `${custom.radius}px`,
                '--Icon-Button-Radius': `${custom.iconButtonRadius}px`,
                '--Button-Height': `${custom.buttonHeight}px`,
                '--Button-Min-Width': `${custom.minButtonWidth}px`,
              } as React.CSSProperties}
            >
              <Card
                padding="medium"
                style={{
                  borderRadius: custom.radius,
                  maxWidth: 400,
                  width: '100%',
                }}
              >
                <VStack spacing={4}>
                  {/* Style: Solid, Outline, Ghost */}
                  <VStack spacing={2}>
                    <Label style={{ fontSize: '0.7rem', color: 'var(--Quiet)' }}>Style</Label>
                    <HStack spacing={2} style={{ flexWrap: 'wrap' }}>
                      <Button variant="primary" size="medium"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Solid
                      </Button>
                      <Button variant="primary-outline" size="medium"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Outline
                      </Button>
                      <Button variant="ghost" size="medium"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Ghost
                      </Button>
                    </HStack>
                  </VStack>

                  {/* Size: Small, Medium, Large */}
                  <VStack spacing={2}>
                    <Label style={{ fontSize: '0.7rem', color: 'var(--Quiet)' }}>Size</Label>
                    <HStack spacing={2} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                      <Button variant="primary" size="small"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Small
                      </Button>
                      <Button variant="primary" size="medium"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Medium
                      </Button>
                      <Button variant="primary" size="large"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Large
                      </Button>
                    </HStack>
                  </VStack>

                  {/* Icon Buttons: Solid, Outline, Ghost */}
                  <VStack spacing={2}>
                    <Label style={{ fontSize: '0.7rem', color: 'var(--Quiet)' }}>Icon Buttons</Label>
                    <HStack spacing={2}>
                      <Button variant="primary" size="medium" iconOnly
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <CalendarTodayIcon style={{ fontSize: 20 }} />
                      </Button>
                      <Button variant="primary-outline" size="medium" iconOnly
                        style={{ height: custom.buttonHeight, width: custom.buttonHeight, borderRadius: custom.iconButtonRadius }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <CalendarTodayIcon style={{ fontSize: 20 }} />
                      </Button>
                      <Button variant="ghost" size="medium" iconOnly
                        style={{ height: custom.buttonHeight, width: custom.buttonHeight, borderRadius: custom.iconButtonRadius }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <CalendarTodayIcon style={{ fontSize: 20 }} />
                      </Button>
                    </HStack>
                  </VStack>
                </VStack>
              </Card>
            </div>
          </div>
        </div>
      </VStack>
    </div>
  );
}
