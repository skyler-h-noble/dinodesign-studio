import { useState, useEffect } from 'react';
import { INPUT_RADIUS_MAX } from '../../utils/componentRadii';
import {
  Button, ButtonGroup, H2, H3, Body, BodySmall, VStack, HStack, Card, Label, Slider,
  TextInput, SearchField, Select,
} from '@omni-design/components';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { StageProps, ComponentStyle, ColorScheme, UserSelections } from '../../types';
import { loadGoogleFonts } from '../../utils/googleFontsManager';
import { computeRadii, migrateLegacyRadii } from '../../utils/componentRadii';
import { shadowOptionsFromStyle, type ShadowOptions } from '../../utils/dropshadow';
import '../../styles/component-style.css';
import { CREATION_CHROME } from '../CreationNav';

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
  /* Shadow palette. Comeau's generator controls, driving every --Effect-Level
     recipe and the Figma shadow variables. Maths in utils/dropshadow.ts;
     shadowOptionsFrom() below is the only place these are read. */
  shadowIntensity: number;
  shadowCrispy: number;
  shadowResolution: number;
  shadowLightX: number;
  shadowLightY: number;
  shadowTint: boolean;
}

/** StyleCustomizations -> ShadowOptions. Thin wrapper over the shared mapper
 *  in utils/dropshadow so the studio and every exporter agree. */
export const shadowOptionsFrom = (c: Partial<StyleCustomizations> | undefined): ShadowOptions =>
  shadowOptionsFromStyle(c as Record<string, unknown> | undefined);

const STYLE_DEFAULTS: Record<ComponentStyle, { label: string; description: string } & StyleCustomizations> = {
  professional: { shadowIntensity: 0.30, shadowCrispy: 0.75, shadowResolution: 0.40, shadowLightX: -0.33, shadowLightY: -0.66, shadowTint: true, label: 'Pro', description: 'Clean lines, minimal radius', cardPadding: 12, buttonRadius: 12, bevel: 0, bevelOpacity: 50, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100, inputRadius: 12, inputPadding: 8 },
  modern: { shadowIntensity: 0.41, shadowCrispy: 0.50, shadowResolution: 0.50, shadowLightX: -0.33, shadowLightY: -0.66, shadowTint: true, label: 'Modern', description: 'Balanced curves, medium shadows', cardPadding: 16, buttonRadius: 25, bevel: 0, bevelOpacity: 50, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100, inputRadius: 25, inputPadding: 12 },
  bold: { shadowIntensity: 0.55, shadowCrispy: 0.45, shadowResolution: 0.65, shadowLightX: -0.33, shadowLightY: -0.66, shadowTint: true, label: 'Bold', description: 'Strong elements, generous rounding', cardPadding: 20, buttonRadius: 38, bevel: 0, bevelOpacity: 50, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100, inputRadius: 38, inputPadding: 12 },
  playful: { shadowIntensity: 0.50, shadowCrispy: 0.25, shadowResolution: 0.80, shadowLightX: -0.33, shadowLightY: -0.66, shadowTint: true, label: 'Playful', description: 'Maximum curves, dynamic feel', cardPadding: 24, buttonRadius: 100, bevel: 10, bevelOpacity: 80, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100, inputRadius: 38, inputPadding: 16 },
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
    shadowIntensity: STYLE_DEFAULTS[k].shadowIntensity,
    shadowCrispy: STYLE_DEFAULTS[k].shadowCrispy,
    shadowResolution: STYLE_DEFAULTS[k].shadowResolution,
    shadowLightX: STYLE_DEFAULTS[k].shadowLightX,
    shadowLightY: STYLE_DEFAULTS[k].shadowLightY,
    shadowTint: STYLE_DEFAULTS[k].shadowTint,
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

  /* The radii are stored as a PERCENT of the control's height; both sliders
     work in pixels against the large button, so each converts on the way in. */
  const asPercent = (px: number) =>
    Math.round(Math.min(100, px / Math.max(1, custom.largeButtonHeight) * 100));

  /* The input FOLLOWS the button, clamped.
     Three of the four presets already ship them equal — only `playful`
     diverges, at button 100 / input 38 — so the slider pair was two controls
     for one decision, and moving the button alone left an input that no
     longer matched the brand.
     The clamp is what makes following safe: a button can be a pill and an
     input cannot, because a pill-shaped field pushes its own text away from
     the leading edge, and worse the taller it gets. */
  const setButtonRadiusPx = (px: number) => {
    const pct = asPercent(px);
    setCustomizations(prev => {
      const cur = prev[selected];
      const cappedPct = asPercent(Math.min(px, INPUT_RADIUS_MAX));
      return {
        ...prev,
        [selected]: { ...cur, buttonRadius: pct, inputRadius: cappedPct },
      };
    });
  };

  /* An explicit override still wins — moving the input's own slider sets only
     the input, and the next button change does NOT silently take it back,
     because the button's handler writes the clamped button value either way.
     What the user cannot do is ask for more than the cap: the slider's max IS
     the cap, so the control cannot report a number the generator will not
     honour. A slider that can ask for 40 and silently get 16 is a control
     that lies about what it does. */
  const setInputRadiusPx = (px: number) =>
    updateCustom('inputRadius', asPercent(Math.min(px, INPUT_RADIUS_MAX)));

  // Save customizations whenever they change
  useEffect(() => {
    onStyleSelected(selected, customizations[selected]);
  }, [selected, customizations]);

  // buttonRadius is now percent (0-100), so no clamping needed against
  // largeButtonHeight — the computed pixel value scales with the height.


  return (
    /* Fill what is LEFT, not a whole viewport.
       minHeight: 100vh asked for a full screen inside a <main> that already
       guarantees one and then adds the bottom bar's reserve as padding, so the
       stage overflowed by exactly the chrome. The document scrolled past
       <main>, and what showed below it was the body — which carries data-theme
       but deliberately no data-surface, so it paints nothing and the gap came
       out in the UA's colour rather than the brand's. */
    <div className="comp-style-page" style={{ display: 'flex', minHeight: `calc(100vh - ${CREATION_CHROME})` }}>

      {/* ─── Left: persistent sidebar ─── */}
      <div data-surface="Surface-Dim" style={{
        width: settingsOpen ? 296 : 0,
        flexShrink: 0,
        /* Anchored between the two bars, not sized by its content.
           It was content-height with overflow: hidden, so a short panel left a
           band of page showing beneath it and a tall one was CLIPPED — the
           controls past the fold unreachable, with nothing to suggest a scroll
           container had given up. sticky + an explicit height makes the rail a
           fixed frame that scrolls inside itself. */
        position: 'sticky',
        top: 'var(--creation-top-h, 49px)',
        alignSelf: 'flex-start',
        height: `calc(100vh - ${CREATION_CHROME})`,
        /* overflowX stays hidden for the width collapse — the panel animates
             to 0 and its 296px content must be clipped, not scrolled sideways. */
        overflowX: 'hidden',
        overflowY: 'auto',
        transition: 'width 0.2s ease',
        borderRight: settingsOpen ? '1px solid var(--Border)' : 'none',
        background: 'var(--Background)',
      }}>
        <div style={{ width: 296, padding: '8px 16px', boxSizing: 'border-box' }}>
            <VStack spacing={2}>
              <H3 style={{ fontSize: '1rem', margin: 0 }}>Component Style Settings</H3>

              <BodySmall color="quiet" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', marginTop: 8 }}>Components</BodySmall>
              {[
                { key: 'button', label: 'Button', defaultOpen: true, content: (
                  <VStack spacing={2} style={{ width: '100%' }}>
                    <Slider variant="default"
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
                    <BodySmall color="quiet" style={{ fontSize: '0.65rem' }}>iOS: 44px, Android: 48px</BodySmall>
                    <Slider variant="default" label="Small Button Height" min={24} max={32} value={custom.smallButtonHeight} onChange={(_: any, v: number | number[]) => updateCustom('smallButtonHeight', v as number)} size="small" valueLabelDisplay="auto" />
                    <Slider variant="default" label="Large Button Height" min={44} max={72} value={custom.largeButtonHeight} onChange={(_: any, v: number | number[]) => updateCustom('largeButtonHeight', v as number)} size="small" valueLabelDisplay="auto" />
                    <Slider variant="default" label="Border Radius (px)" min={0} max={custom.largeButtonHeight} value={Math.round(custom.buttonRadius * custom.largeButtonHeight / 100)} onChange={(_: any, v: number | number[]) => setButtonRadiusPx(v as number)} size="small" valueLabelDisplay="auto" />
                    <Slider variant="default" label="Minimum Width" min={40} max={120} value={custom.minButtonWidth} onChange={(_: any, v: number | number[]) => updateCustom('minButtonWidth', v as number)} size="small" valueLabelDisplay="auto" />
                    <Slider variant="default" label="Bevel" min={0} max={20} value={custom.bevel} onChange={(_: any, v: number | number[]) => updateCustom('bevel', v as number)} size="small" valueLabelDisplay="auto" />
                    <Slider variant="default" label="Bevel Opacity" min={0} max={100} value={custom.bevelOpacity} onChange={(_: any, v: number | number[]) => updateCustom('bevelOpacity', v as number)} size="small" valueLabelDisplay="auto" />
                  </VStack>
                )},
                { key: 'icon', label: 'Icon Button', defaultOpen: false, content: (
                  <VStack spacing={2} style={{ width: '100%' }}>
                    <Slider variant="default" label="Border Radius (px)" min={0} max={custom.largeButtonHeight} value={Math.round(custom.iconButtonRadius * custom.largeButtonHeight / 100)} onChange={(_: any, v: number | number[]) => updateCustom('iconButtonRadius', Math.round(Math.min(100, (v as number) / Math.max(1, custom.largeButtonHeight) * 100)))} size="small" valueLabelDisplay="auto" />
                  </VStack>
                )},
                { key: 'input', label: 'Input', defaultOpen: false, content: (
                  <VStack spacing={2} style={{ width: '100%' }}>
                    <Slider variant="default" label="Border Radius (px)" min={0} max={Math.min(INPUT_RADIUS_MAX, custom.largeButtonHeight)} value={Math.min(INPUT_RADIUS_MAX, Math.round(custom.inputRadius * custom.largeButtonHeight / 100))} onChange={(_: any, v: number | number[]) => setInputRadiusPx(v as number)} size="small" valueLabelDisplay="auto" />
                    <Slider variant="default" label="Padding" min={0} max={16} step={4} value={custom.inputPadding} onChange={(_: any, v: number | number[]) => updateCustom('inputPadding', v as number)} size="small" valueLabelDisplay="auto" />
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

            {/* Presets — base style picker. Lives in the main column so the
                full row of options stays visible (the left nav crops them). */}
            <VStack spacing={1} alignItems="center">
              <BodySmall color="quiet" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>Presets</BodySmall>
              <BodySmall color="quiet" style={{ textAlign: 'center' }}>Choose a base style then fine-tune the details.</BodySmall>
              <ButtonGroup
                size="small"
                fit="equal"
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
                  // --Button-Min-Width, not --Min-Button-Width: the reversed name
                  // matched nothing, so this panel's preview never showed the floor.
                  '--Button-Min-Width': `${custom.minButtonWidth}px`,
                  '--Lg-Button-Min-Width': `${custom.minButtonWidth + 40}px`,
                  '--Input-Radius': `${radii.inputRadius}px`,
                  '--Input-Padding': `${custom.inputPadding}px`,
                  '--Modal-Padding': `${radii.modalPadding}px`,
                  '--Modal-Radius': `${radii.modalRadius}px`,
                  '--Button-Padding': '8px',
                  '--Sm-Button-Padding': 'var(--Button-Padding)',
                  '--Lg-Button-Padding': '16px',
                  '--Large-Button-Padding': 'var(--Lg-Button-Padding)',
                  '--Button-Border-Width': '2px',
                  // Inject the user's bevel settings so the live preview matches
                  // the exported CSS exactly. Without these, the lib's Button
                  // falls back to its static --Button-Bevel (foundation.css)
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
                      <Label color="quiet" style={{ fontSize: '0.7rem' }}>Style</Label>
                      <HStack spacing={2} style={{ flexWrap: 'wrap' }}>
                        <Button variant="default" size="medium"
                          sx={{ minHeight: `${custom.buttonHeight}px` }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          Solid
                        </Button>
                        <Button variant="default-outline" size="medium"
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
                      <Label color="quiet" style={{ fontSize: '0.7rem' }}>Size</Label>
                      <HStack spacing={2} style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                        <Button variant="default" size="small"
                          sx={{ minHeight: `${custom.smallButtonHeight}px` }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          Small
                        </Button>
                        <Button variant="default" size="medium"
                          sx={{ minHeight: `${custom.buttonHeight}px` }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          Medium
                        </Button>
                        <Button variant="default" size="large"
                          sx={{ minHeight: `${custom.largeButtonHeight}px` }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          Large
                        </Button>
                      </HStack>
                    </VStack>

                    {/* Icon Buttons: Solid, Outline, Ghost */}
                    <VStack spacing={2}>
                      <Label color="quiet" style={{ fontSize: '0.7rem' }}>Icon Buttons</Label>
                      <HStack spacing={2}>
                        <Button variant="default" size="medium" iconOnly
                          sx={{
                            minHeight: `${custom.buttonHeight}px`,
                            minWidth: `${custom.buttonHeight}px`,
                            maxWidth: `${custom.buttonHeight}px`,
                            borderRadius: `${radii.iconButtonRadius}px`,
                          }}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <CalendarTodayIcon style={{ fontSize: 20 }} />
                        </Button>
                        <Button variant="default-outline" size="medium" iconOnly
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
                      <Label color="quiet" style={{ fontSize: '0.7rem' }}>Inputs</Label>
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
