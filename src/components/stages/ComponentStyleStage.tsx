import { useState, useMemo } from 'react';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Checkbox, Label,
} from '@dynodesign/components';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { toneToColorNumber } from '../../utils/colorScale';
import { buildPreviewCSS } from '../../utils/buildPreviewCSS';
import type { StageProps, ComponentStyle, ColorScheme, UserSelections } from '../../types';
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
  bevel: number;
}

const STYLE_DEFAULTS: Record<ComponentStyle, { label: string; description: string; radius: number; buttonRadius: number; bevel: number }> = {
  professional: { label: 'Professional', description: 'Clean lines, minimal radius, subtle shadows', radius: 4, buttonRadius: 2, bevel: 0 },
  modern: { label: 'Modern', description: 'Balanced curves with medium shadows', radius: 8, buttonRadius: 4, bevel: 0 },
  bold: { label: 'Bold', description: 'Sharp, strong elements with minimal rounding', radius: 16, buttonRadius: 8, bevel: 0 },
  playful: { label: 'Playful', description: 'Maximum curves with dynamic shadows', radius: 24, buttonRadius: 64, bevel: 2 },
};

const STYLE_KEYS: ComponentStyle[] = ['professional', 'modern', 'bold', 'playful'];

const DEFAULT_CUSTOMIZATIONS: Record<ComponentStyle, StyleCustomizations> = {
  professional: { radius: 4, bevel: 0 },
  modern: { radius: 8, bevel: 0 },
  bold: { radius: 16, bevel: 0 },
  playful: { radius: 24, bevel: 2 },
};

export default function ComponentStyleStage({
  onNext, onBack, colorScheme, onStyleSelected, selectedStyle: initialStyle, savedCustomizations,
  userSelections, typographyStyles,
}: Props) {
  const [selected, setSelected] = useState<ComponentStyle>(initialStyle || 'modern');
  const [customizations, setCustomizations] = useState<Record<ComponentStyle, StyleCustomizations>>(
    savedCustomizations || DEFAULT_CUSTOMIZATIONS
  );
  const [expandedCard, setExpandedCard] = useState<ComponentStyle | null>(null);

  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];
  const palettes = colorScheme?.tonePalettes;
  const PC = toneToColorNumber(colorScheme?.extractedTones?.primary || 60);

  // Build inline CSS variables from the tone palette for the card preview
  const previewTokens = useMemo(() => {
    const p = palettes?.primary || [];
    const n = palettes?.neutral || [];
    const header = typographyStyles?.find(t => t.type === 'header');
    const decorative = typographyStyles?.find(t => t.type === 'decorative');
    const body = typographyStyles?.find(t => t.type === 'body');

    // Use Color-11 (L=98) as container, Color-12 (L=99) as background
    const containerHex = p[10]?.hex || '#f5f5f5';
    const bgHex = p[11]?.hex || '#ffffff';
    const headerHex = p[3]?.hex || '#333';   // Color-4 for header on light bg
    const textHex = p[3]?.hex || '#333';     // Color-4 for text
    const quietHex = p[4]?.hex || '#666';    // Color-5 for quiet
    const borderHex = p[7]?.hex || 'rgba(0,0,0,0.1)';
    const btnBg = p[PC - 1]?.hex || colors[0];
    const btnText = PC >= 9 ? (p[1]?.hex || '#fff') : (p[10]?.hex || '#fff');
    const btnBorder = p[PC - 1]?.hex || colors[0];

    return {
      '--Background': bgHex,
      '--Container': containerHex,
      '--Header': headerHex,
      '--Text': textHex,
      '--Quiet': quietHex,
      '--Border': borderHex,
      '--Border-Variant': borderHex,
      '--Buttons-Primary-Button': btnBg,
      '--Buttons-Primary-Text': btnText,
      '--Buttons-Primary-Border': btnBorder,
      '--Buttons-Default-Button': containerHex,
      '--Buttons-Default-Text': textHex,
      '--Buttons-Default-Border': borderHex,
      '--Buttons-Default-Hover': `${containerHex}cc`,
      '--Buttons-Default-Active': `${containerHex}aa`,
      '--Font-Family-Header': header?.family ? `"${header.family}"` : 'inherit',
      '--Font-Family-Body': body?.family ? `"${body.family}"` : 'inherit',
      '--Font-Family-Decorative': decorative?.family ? `"${decorative.family}"` : 'inherit',
    } as React.CSSProperties;
  }, [palettes, typographyStyles, PC, colors]);

  const updateCustom = (style: ComponentStyle, field: keyof StyleCustomizations, value: number) => {
    setCustomizations(prev => ({
      ...prev,
      [style]: { ...prev[style], [field]: value },
    }));
  };

  const handleComplete = () => {
    onStyleSelected(selected, customizations[selected]);
    onNext();
  };

  const getCardStyle = (style: ComponentStyle) => {
    const c = customizations[style];
    return {
      borderRadius: c.radius,
      boxShadow: c.bevel > 0
        ? `0 2px 4px rgba(0,0,0,0.1), inset 0 ${c.bevel}px ${c.bevel * 2}px rgba(255,255,255,0.3), inset 0 -${c.bevel}px ${c.bevel * 2}px rgba(0,0,0,0.2)`
        : '0 2px 4px rgba(0,0,0,0.1)',
    };
  };

  return (
    <div
      className="comp-style-page"
      style={{ ...previewTokens, background: 'var(--Background)', minHeight: '100vh' } as React.CSSProperties}
    >
      <VStack spacing={4} style={{ maxWidth: 900, margin: '0 auto' }}>
        <H2>Component Style</H2>
        <Body style={{ color: 'var(--Quiet)' }}>
          Choose the shape language for your design system.
        </Body>

        <div className="comp-style-grid">
          {STYLE_KEYS.map(styleKey => {
            const style = STYLE_DEFAULTS[styleKey];
            const custom = customizations[styleKey];
            const isSelected = selected === styleKey;
            const isExpanded = expandedCard === styleKey;
            const cardPreviewStyle = getCardStyle(styleKey);

            return (
              <div
                key={styleKey}
                style={{ cursor: 'pointer', width: '100%' }}
                onClick={() => setSelected(styleKey)}
              >
                <VStack spacing={2}>
                  {/* Title + checkbox */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <H3 style={{ fontSize: '1.1rem' }}>{style.label}</H3>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => setSelected(styleKey)}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      variant="primary"
                    />
                  </div>

                  {/* Description */}
                  <BodySmall style={{ color: 'var(--Quiet)' }}>{style.description}</BodySmall>

                  {/* Card preview — sets border-radius tokens for this style */}
                  <div
                    style={{
                      ...cardPreviewStyle,
                      '--Style-Border-Radius': `${style.buttonRadius}px`,
                      '--Card-Radius': `${custom.radius}px`,
                      background: 'var(--Container)',
                      border: '1px solid var(--Border-Variant)',
                      borderRadius: custom.radius,
                      padding: Math.max(16, custom.radius),
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      width: '100%',
                      boxSizing: 'border-box',
                      boxShadow: '0 2px 2px rgba(0,0,0,0.15)',
                    } as React.CSSProperties}
                  >
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: 'var(--Header)', fontWeight: 700, fontSize: 16, fontFamily: 'var(--Font-Family-Header, inherit)' }}>
                          Your DynoDesign Systems
                        </div>
                        <div style={{ color: 'var(--Quiet)', fontSize: 11, fontFamily: 'var(--Font-Family-Decorative, inherit)', fontStyle: 'italic', marginTop: 6 }}>
                          Adaptive &amp; Accessible
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="medium"
                        iconOnly
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        <CalendarTodayIcon style={{ fontSize: 20 }} />
                      </Button>
                    </div>

                    {/* Body text */}
                    <div style={{ color: 'var(--Text)', fontSize: 14, lineHeight: 1.5, fontFamily: 'var(--Font-Family-Body, inherit)' }}>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna ali.
                    </div>

                    {/* Button */}
                    <div>
                      <Button
                        variant="default"
                        size="medium"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        Button
                      </Button>
                    </div>

                    {/* Customize link */}
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', borderTop: '1px solid var(--Border-Variant)', paddingTop: 12 }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setExpandedCard(isExpanded ? null : styleKey);
                      }}
                    >
                      <span style={{ color: 'var(--Hotlink, #5276cf)', fontSize: 18, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>⌄</span>
                      <span style={{ color: 'var(--Hotlink, #5276cf)', fontSize: 12, textDecoration: 'underline' }}>
                        {isExpanded ? 'Hide' : 'Customize'}
                      </span>
                    </div>
                  </div>

                  {/* Customization panel */}
                  {isExpanded && (
                    <div className="comp-customize-panel" onClick={e => e.stopPropagation()}>
                      <VStack spacing={3} style={{ width: '100%' }}>
                        <VStack spacing={1} style={{ width: '100%' }}>
                          <div className="comp-slider-label">
                            <Label style={{ fontSize: '0.8rem' }}>Border Radius</Label>
                            <BodySmall style={{ color: 'var(--Quiet)' }}>{custom.radius}px</BodySmall>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="32"
                            value={custom.radius}
                            onChange={e => updateCustom(styleKey, 'radius', parseInt(e.target.value))}
                            className="comp-slider"
                          />
                        </VStack>

                        <VStack spacing={1} style={{ width: '100%' }}>
                          <div className="comp-slider-label">
                            <Label style={{ fontSize: '0.8rem' }}>Bevel Intensity</Label>
                            <BodySmall style={{ color: 'var(--Quiet)' }}>{custom.bevel}</BodySmall>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="8"
                            value={custom.bevel}
                            onChange={e => updateCustom(styleKey, 'bevel', parseInt(e.target.value))}
                            className="comp-slider"
                          />
                        </VStack>
                      </VStack>
                    </div>
                  )}
                </VStack>
              </div>
            );
          })}
        </div>

        {/* Navigation handled by CreationTopBar/BottomBar */}
      </VStack>
    </div>
  );
}
