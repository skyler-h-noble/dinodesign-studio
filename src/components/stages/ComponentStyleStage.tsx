import { useState, useEffect } from 'react';
import {
  Button, ButtonGroup, H2, H3, Body, BodySmall, VStack, HStack, Card, Label, Slider,
  TextInput, SearchField, Select,
} from '@dynodesign/components';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { StageProps, ComponentStyle, ColorScheme, UserSelections } from '../../types';
import { loadGoogleFonts } from '../../utils/googleFontsManager';
import { computeRadii, migrateLegacyRadii } from '../../utils/componentRadii';
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
  // Card padding in pixels. Card-Radius derives = Button-Radius + cardPadding.
  // Modal-Padding = cardPadding × 1.5; Modal-Radius = Button-Radius + Modal-Padding.
  // (Was named `radius` and held Card radius in pixels — see legacy migration.)
  cardPadding: number;
  // Three radii below are stored as PERCENT (0–100) of their respective heights.
  // Computed-pixel tokens live in utils/componentRadii.ts.
  buttonRadius: number;
  iconButtonRadius: number;
  inputRadius: number;
  bevel: number;
  bevelOpacity: number;
  buttonHeight: number;
  smallButtonHeight: number;
  largeButtonHeight: number;
  minButtonWidth: number;
  inputPadding: number;
}

const STYLE_DEFAULTS: Record<ComponentStyle, { label: string; description: string } & StyleCustomizations> = {
  professional: { label: 'Pro', description: 'Clean lines, minimal radius', cardPadding: 12, buttonRadius: 6, bevel: 0, bevelOpacity: 50, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100, inputRadius: 6, inputPadding: 2 },
  modern: { label: 'Modern', description: 'Balanced curves, medium shadows', cardPadding: 16, buttonRadius: 12, bevel: 0, bevelOpacity: 50, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100, inputRadius: 12, inputPadding: 2 },
  bold: { label: 'Bold', description: 'Strong elements, generous rounding', cardPadding: 20, buttonRadius: 25, bevel: 0, bevelOpacity: 50, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100, inputRadius: 25, inputPadding: 4 },
  playful: { label: 'Playful', description: 'Maximum curves, dynamic feel', cardPadding: 24, buttonRadius: 100, bevel: 10, bevelOpacity: 80, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100, inputRadius: 100, inputPadding: 4 },
};

const STYLE_KEYS: ComponentStyle[] = ['professional', 'modern', 'bold', 'playful'];

const DEFAULT_CUSTOMIZATIONS: Record<ComponentStyle, StyleCustomizations> = Object.fromEntries(
  STYLE_KEYS.map(k => [k, {
    cardPadding: STYLE_DEFAULTS[k].cardPadding,
    buttonRadius: STYLE_DEFAULTS[k].buttonRadius,
    bevel: STYLE_DEFAULTS[k].bevel,
    bevelOpacity: STYLE_DEFAULTS[k].bevelOpacity,
    buttonHeight: STYLE_DEFAULTS[k].buttonHeight,
    smallButtonHeight: STYLE_DEFAULTS[k].smallButtonHeight,
    largeButtonHeight: STYLE_DEFAULTS[k].largeButtonHeight,
    minButtonWidth: STYLE_DEFAULTS[k].minButtonWidth,
    iconButtonRadius: STYLE_DEFAULTS[k].iconButtonRadius,
    inputRadius: STYLE_DEFAULTS[k].inputRadius,
    inputPadding: STYLE_DEFAULTS[k].inputPadding,
  }])
) as Record<ComponentStyle, StyleCustomizations>;

export default function ComponentStyleStage({
  onNext, onBack, colorScheme, onStyleSelected, selectedStyle: initialStyle, savedCustomizations,
  userSelections, typographyStyles,
}: Props) {
  const [selected, setSelected] = useState<ComponentStyle>(initialStyle || 'modern');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ button: true });
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [customizations, setCustomizations] = useState<Record<ComponentStyle, StyleCustomizations>>(() => {
    if (!savedCustomizations) return DEFAULT_CUSTOMIZATIONS;
    // Merge saved with defaults to fill any missing new fields, then run the
    // legacy-radii migration in case the saved record predates the percent model.
    const merged = { ...DEFAULT_CUSTOMIZATIONS };
    for (const key of STYLE_KEYS) {
      if (savedCustomizations[key]) {
        merged[key] = migrateLegacyRadii({
          ...DEFAULT_CUSTOMIZATIONS[key],
          ...savedCustomizations[key],
        }) as StyleCustomizations;
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

  // buttonRadius is now percent (0-100), so no clamping needed against
  // largeButtonHeight — the computed pixel value scales with the height.


  return (
    <div className="comp-style-page" style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ─── Left: persistent sidebar ─── */}
      <div data-surface="Surface-Dim" style={{
        width: settingsOpen ? 280 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.2s ease',
        borderRight: settingsOpen ? '1px solid var(--Border)' : 'none',
        background: 'var(--Background)',
      }}>
        <div style={{ width: 280, padding: '8px 16px', boxSizing: 'border-box' }}>
          <VStack spacing={2}>
            <H3 style={{ fontSize: '1rem', margin: 0 }}>Component Style</H3>

            {/* Presets */}
            <VStack spacing={1}>
              <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>Presets</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Choose a base style then fine-tune the details.</BodySmall>
              <ButtonGroup
                size="small"
                value={selected}
                onChange={(val: typeof selected) => {
                  setSelected(val);
                  setCustomizations(prev => ({
                    ...prev,
                    [val]: DEFAULT_CUSTOMIZATIONS[val],
                  }));
                }}
              >
                {STYLE_KEYS.map(styleKey => {
                  const style = STYLE_DEFAULTS[styleKey];
                  return (
                    <Button key={styleKey} value={styleKey} size="small">
                      {style.label}
                    </Button>
                  );
                })}
              </ButtonGroup>
            </VStack>

            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)', marginTop: 24 }}>Components</BodySmall>
            {[
              { key: 'button', label: 'Button', defaultOpen: true, content: (
                <VStack spacing={2} style={{ width: '100%' }}>
                  <Slider
                    label="Desktop Button Height"
                    min={24}
                    max={48}
                    step={null}
                    marks={[
                      { value: 24 }, { value: 32 }, { value: 40 }, { value: 44 }, { value: 48 },
                    ]}
                    value={custom.buttonHeight}
                    onChange={(_: any, v: number | number[]) => updateCustom('buttonHeight', v as number)}
                    size="small"
                    valueLabelDisplay="auto"
                  />
                  <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>iOS: 44px, Android: 48px</BodySmall>
                  <Slider label="Small Button Height" min={24} max={32} value={custom.smallButtonHeight} onChange={(_: any, v: number | number[]) => updateCustom('smallButtonHeight', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Large Button Height" min={44} max={72} value={custom.largeButtonHeight} onChange={(_: any, v: number | number[]) => updateCustom('largeButtonHeight', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Border Radius (%)" min={0} max={100} value={custom.buttonRadius} onChange={(_: any, v: number | number[]) => updateCustom('buttonRadius', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Minimum Width" min={40} max={120} value={custom.minButtonWidth} onChange={(_: any, v: number | number[]) => updateCustom('minButtonWidth', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Bevel" min={0} max={20} value={custom.bevel} onChange={(_: any, v: number | number[]) => updateCustom('bevel', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Bevel Opacity" min={0} max={100} value={custom.bevelOpacity} onChange={(_: any, v: number | number[]) => updateCustom('bevelOpacity', v as number)} size="small" valueLabelDisplay="auto" />
                </VStack>
              )},
              { key: 'icon', label: 'Icon Button', defaultOpen: false, content: (
                <VStack spacing={2} style={{ width: '100%' }}>
                  <Slider label="Border Radius (%)" min={0} max={100} value={custom.iconButtonRadius} onChange={(_: any, v: number | number[]) => updateCustom('iconButtonRadius', v as number)} size="small" valueLabelDisplay="auto" />
                </VStack>
              )},
              { key: 'card', label: 'Card', defaultOpen: false, content: (
                <VStack spacing={2} style={{ width: '100%' }}>
                  <Slider label="Padding" min={0} max={48} value={custom.cardPadding} onChange={(_: any, v: number | number[]) => updateCustom('cardPadding', v as number)} size="small" valueLabelDisplay="auto" />
                  <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.65rem' }}>
                    Card radius auto-derives = Button-Radius + Padding. Modal padding = Padding × 1.5.
                  </BodySmall>
                </VStack>
              )},
              { key: 'input', label: 'Input', defaultOpen: false, content: (
                <VStack spacing={2} style={{ width: '100%' }}>
                  <Slider label="Border Radius (%)" min={0} max={100} value={custom.inputRadius} onChange={(_: any, v: number | number[]) => updateCustom('inputRadius', v as number)} size="small" valueLabelDisplay="auto" />
                  <Slider label="Padding" min={0} max={16} value={custom.inputPadding} onChange={(_: any, v: number | number[]) => updateCustom('inputPadding', v as number)} size="small" valueLabelDisplay="auto" />
                </VStack>
              )},
            ].map(section => {
              const isOpen = openSections[section.key] ?? section.defaultOpen;
              return (
                <div key={section.key} style={{ borderBottom: '1px solid var(--Border)' }}>
                  <div
                    onClick={() => setOpenSections(prev => ({ ...prev, [section.key]: !isOpen }))}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer' }}
                  >
                    <H3 style={{ fontSize: '0.9rem', margin: 0 }}>{section.label}</H3>
                    {isOpen
                      ? <ExpandMoreIcon style={{ color: 'var(--Quiet)', fontSize: 18 }} />
                      : <ChevronRightIcon style={{ color: 'var(--Quiet)', fontSize: 18 }} />
                    }
                  </div>
                  {isOpen && <div style={{ paddingBottom: 8 }}>{section.content}</div>}
                </div>
              );
            })}
          </VStack>
        </div>
      </div>

      {/* ─── Right: main content ─── */}
      <div style={{ flex: 1, minWidth: 0, transition: 'margin 0.2s ease' }}>
        <VStack spacing={4} style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px' }}>

          {!settingsOpen && (
            <HStack spacing={2} style={{ justifyContent: 'center' }}>
              <Button variant="outline" size="small" onClick={() => setSettingsOpen(true)}>
                Customize
              </Button>
            </HStack>
          )}

          {/* Preview */}
          {(() => {
            const radii = computeRadii(custom);
            // Padding tokens derive from the medium button radius in pixels
            // (kept consistent with generateFigmaJSON.ts).
            const btnR = radii.buttonRadius;
            const buttonPadding = btnR > 8 ? Math.round(btnR / 2) : 4;
            const smButtonPadding = btnR >= 8 ? 8 : btnR;
            const lgButtonPadding = btnR > 32 ? Math.round((btnR * 2) / 3) : 16;
            return (
            <div
              style={{
                '--Style-Border-Radius': `${radii.buttonRadius}px`,
                '--Button-Radius': `${radii.buttonRadius}px`,
                '--Sm-Button-Radius': `${radii.smButtonRadius}px`,
                '--Lg-Button-Radius': `${radii.lgButtonRadius}px`,
                '--Card-Radius': `${radii.cardRadius}px`,
                '--Card-Padding': `${radii.cardPadding}px`,
                '--Icon-Button-Radius': `${radii.iconButtonRadius}px`,
                '--Sm-Icon-Button-Radius': `${radii.smIconButtonRadius}px`,
                '--Lg-Icon-Button-Radius': `${radii.lgIconButtonRadius}px`,
                '--Button-Height': `${custom.buttonHeight}px`,
                '--Small-Button-Height': `${custom.smallButtonHeight}px`,
                '--Large-Button-Height': `${custom.largeButtonHeight}px`,
                '--Min-Button-Width': `${custom.minButtonWidth}px`,
                '--Input-Radius': `${radii.inputRadius}px`,
                '--Input-Padding': `${custom.inputPadding}px`,
                '--Modal-Padding': `${radii.modalPadding}px`,
                '--Modal-Radius': `${radii.modalRadius}px`,
                '--Button-Padding': `${buttonPadding}px`,
                '--Sm-Button-Padding': `${smButtonPadding}px`,
                '--Large-Button-Padding': `${lgButtonPadding}px`,
                '--Button-Border-Width': '2px',
                // Inject the user's bevel settings so the live preview matches
                // the exported CSS exactly. Without these, the lib's Button
                // falls back to its static --Button-Bevel: 11% (foundations.css)
                // and --Button-Bevel-Opacity: 0.5 — which doesn't reflect what
                // ships with the design system.
                '--Button-Bevel': custom.bevel,
                '--Button-Bevel-Opacity': custom.bevelOpacity / 100,
              } as React.CSSProperties}
            >
            <Card
              padding="medium"
              style={{
                borderRadius: radii.cardRadius,
                maxWidth: 400,
                width: '100%',
                margin: '0 auto',
              }}
              >
                <VStack spacing={4}>
                  {/* Style: Solid, Outline, Ghost */}
                  <VStack spacing={2}>
                    <Label style={{ fontSize: '0.7rem', color: 'var(--Quiet)' }}>Style</Label>
                    <HStack spacing={2} style={{ flexWrap: 'wrap' }}>
                      <Button variant="primary" size="medium"
                        sx={{ minHeight: `${custom.buttonHeight}px` }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Solid
                      </Button>
                      <Button variant="primary-outline" size="medium"
                        sx={{ minHeight: `${custom.buttonHeight}px` }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Outline
                      </Button>
                      <Button variant="ghost" size="medium"
                        sx={{ minHeight: `${custom.buttonHeight}px` }}
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
                        sx={{ minHeight: `${custom.smallButtonHeight}px` }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Small
                      </Button>
                      <Button variant="primary" size="medium"
                        sx={{ minHeight: `${custom.buttonHeight}px` }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        Medium
                      </Button>
                      <Button variant="primary" size="large"
                        sx={{ minHeight: `${custom.largeButtonHeight}px` }}
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
                        sx={{
                          minHeight: `${custom.buttonHeight}px`,
                          minWidth: `${custom.buttonHeight}px`,
                          maxWidth: `${custom.buttonHeight}px`,
                          borderRadius: `${radii.iconButtonRadius}px`,
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <CalendarTodayIcon style={{ fontSize: 20 }} />
                      </Button>
                      <Button variant="primary-outline" size="medium" iconOnly
                        sx={{
                          minHeight: `${custom.buttonHeight}px`,
                          minWidth: `${custom.buttonHeight}px`,
                          maxWidth: `${custom.buttonHeight}px`,
                          borderRadius: `${radii.iconButtonRadius}px`,
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <CalendarTodayIcon style={{ fontSize: 20 }} />
                      </Button>
                      <Button variant="ghost" size="medium" iconOnly
                        sx={{
                          minHeight: `${custom.buttonHeight}px`,
                          minWidth: `${custom.buttonHeight}px`,
                          maxWidth: `${custom.buttonHeight}px`,
                          borderRadius: `${radii.iconButtonRadius}px`,
                        }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <CalendarTodayIcon style={{ fontSize: 20 }} />
                      </Button>
                    </HStack>
                  </VStack>

                  {/* Inputs: text, search, dropdown */}
                  <VStack spacing={2}>
                    <Label style={{ fontSize: '0.7rem', color: 'var(--Quiet)' }}>Inputs</Label>
                    <VStack spacing={2}>
                      <TextInput label="Text" placeholder="Type here..." size="small" fullWidth />
                      <SearchField placeholder="Search..." size="small" fullWidth />
                      <Select
                        label="Dropdown"
                        labelPosition="top"
                        size="small"
                        fullWidth
                        value=""
                        onChange={() => {}}
                        options={[
                          { value: 'opt1', label: 'Option 1' },
                          { value: 'opt2', label: 'Option 2' },
                          { value: 'opt3', label: 'Option 3' },
                        ]}
                      />
                    </VStack>
                  </VStack>
                </VStack>
              </Card>
          </div>
            );
          })()}
        </VStack>
      </div>
    </div>
  );
}
