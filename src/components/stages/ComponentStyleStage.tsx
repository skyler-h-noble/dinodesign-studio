import { useState, useEffect } from 'react';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Checkbox, Label, Link, Divider,
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
}

const STYLE_DEFAULTS: Record<ComponentStyle, { label: string; description: string; radius: number; buttonRadius: number; bevel: number }> = {
  professional: { label: 'Professional', description: 'Clean lines, minimal radius, subtle shadows', radius: 4, buttonRadius: 2, bevel: 0 },
  modern: { label: 'Modern', description: 'Balanced curves with medium shadows', radius: 8, buttonRadius: 4, bevel: 0 },
  bold: { label: 'Bold', description: 'Sharp, strong elements with minimal rounding', radius: 16, buttonRadius: 8, bevel: 0 },
  playful: { label: 'Playful', description: 'Maximum curves with dynamic shadows', radius: 24, buttonRadius: 64, bevel: 2 },
};

const STYLE_KEYS: ComponentStyle[] = ['professional', 'modern', 'bold', 'playful'];

const DEFAULT_CUSTOMIZATIONS: Record<ComponentStyle, StyleCustomizations> = {
  professional: { radius: 4, buttonRadius: 2, bevel: 0 },
  modern: { radius: 8, buttonRadius: 4, bevel: 0 },
  bold: { radius: 16, buttonRadius: 8, bevel: 0 },
  playful: { radius: 24, buttonRadius: 64, bevel: 0 },
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

  // Load typography fonts so they render correctly
  useEffect(() => {
    if (typographyStyles && typographyStyles.length > 0) {
      const families = typographyStyles.map(t => t.family).filter(Boolean);
      if (families.length) loadGoogleFonts(families);
    }
  }, [typographyStyles]);

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
                  {/* Title */}
                  <H3 style={{ fontSize: '1.1rem' }}>{style.label}</H3>

                  {/* Description */}
                  <BodySmall style={{ color: 'var(--Quiet)' }}>{style.description}</BodySmall>

                  {/* Card preview using real components */}
                  <div style={{ '--Style-Border-Radius': `${custom.buttonRadius}px`, '--Card-Radius': `${custom.radius}px`, width: '100%', boxSizing: 'border-box' } as React.CSSProperties}>
                    <Card
                      padding="medium"
                      style={{
                        width: '100%',
                        borderRadius: custom.radius,
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--Buttons-Primary-Button)' : undefined,
                      }}
                    >
                      <VStack spacing={3}>
                        {/* Header row with checkbox */}
                        <HStack spacing={3} style={{ width: '100%', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 28, lineHeight: 1.2, marginBottom: 4, color: 'var(--Header)', fontFamily: 'var(--Font-Family-Header, var(--Set-Font-Family-Header, inherit))', fontWeight: 'var(--Set-Font-Family-Header-Weight, 700)' as any, letterSpacing: 'var(--Set-Font-Family-Header-Letter-Spacing, 0em)' }}>
                              Your DynoDesign Systems
                            </div>
                            <div style={{
                              fontSize: 13, marginBottom: 4,
                              color: 'var(--Quiet)',
                              fontFamily: 'var(--Set-Font-Family-Decorative, inherit)',
                              fontWeight: 'var(--Set-Font-Family-Decorative-Weight, 400)' as any,
                              letterSpacing: 'var(--Set-Font-Family-Decorative-Letter-Spacing, 0em)',
                              textTransform: 'var(--Set-Font-Family-Decorative-Text-Transform, none)' as any,
                            }}>Adaptive &amp; Accessible</div>
                          </div>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => setSelected(styleKey)}
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            variant="primary"
                          />
                        </HStack>

                        {/* Body text */}
                        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--Text)', fontFamily: 'var(--Body-Font-Family, var(--Set-Font-Family-Body, inherit))' }}>
                          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna ali.
                        </div>

                        {/* Buttons row */}
                        <HStack spacing={2}>
                          <Button
                            variant="default"
                            size="medium"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            Button
                          </Button>
                          <Button
                            variant="secondary"
                            size="medium"
                            iconOnly
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          >
                            <CalendarTodayIcon style={{ fontSize: 20 }} />
                          </Button>
                        </HStack>

                        {/* Divider + Customize link */}
                        <Divider />
                        <Link
                          onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExpandedCard(isExpanded ? null : styleKey);
                          }}
                          style={{ fontSize: '0.8rem' }}
                        >
                          {isExpanded ? '⌃ Hide' : '⌄ Customize'}
                        </Link>

                        {/* Sliders inside card */}
                        {isExpanded && (
                          <VStack spacing={2} style={{ width: '100%' }} onClick={e => e.stopPropagation()}>
                            <VStack spacing={1} style={{ width: '100%' }}>
                              <div className="comp-slider-label">
                                <Label style={{ fontSize: '0.75rem' }}>Card Radius</Label>
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
                                <Label style={{ fontSize: '0.75rem' }}>Button Radius</Label>
                                <BodySmall style={{ color: 'var(--Quiet)' }}>{custom.buttonRadius}px</BodySmall>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="64"
                                value={custom.buttonRadius}
                                onChange={e => updateCustom(styleKey, 'buttonRadius', parseInt(e.target.value))}
                                className="comp-slider"
                              />
                            </VStack>
                          </VStack>
                        )}
                      </VStack>
                    </Card>
                  </div>
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
