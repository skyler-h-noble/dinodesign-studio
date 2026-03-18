import { useState } from 'react';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Checkbox, Label,
} from '@dynodesign/components';
import type { StageProps, ComponentStyle, ColorScheme } from '../../types';
import '../../styles/component-style.css';

interface Props extends StageProps {
  colorScheme: ColorScheme | null;
  onStyleSelected: (style: ComponentStyle, customizations: StyleCustomizations) => void;
  selectedStyle?: ComponentStyle;
  savedCustomizations?: Record<ComponentStyle, StyleCustomizations>;
}

export interface StyleCustomizations {
  radius: number;
  bevel: number;
}

const STYLE_DEFAULTS: Record<ComponentStyle, { label: string; description: string; radius: number; bevel: number }> = {
  professional: { label: 'Professional', description: 'Clean lines, minimal radius, subtle shadows', radius: 4, bevel: 0 },
  modern: { label: 'Modern', description: 'Balanced curves with medium shadows', radius: 12, bevel: 0 },
  bold: { label: 'Bold', description: 'Sharp, strong elements with minimal rounding', radius: 2, bevel: 0 },
  playful: { label: 'Playful', description: 'Maximum curves with dynamic shadows', radius: 24, bevel: 2 },
};

const STYLE_KEYS: ComponentStyle[] = ['professional', 'modern', 'bold', 'playful'];

const DEFAULT_CUSTOMIZATIONS: Record<ComponentStyle, StyleCustomizations> = {
  professional: { radius: 4, bevel: 0 },
  modern: { radius: 12, bevel: 0 },
  bold: { radius: 2, bevel: 0 },
  playful: { radius: 24, bevel: 2 },
};

export default function ComponentStyleStage({
  onNext, onBack, colorScheme, onStyleSelected, selectedStyle: initialStyle, savedCustomizations,
}: Props) {
  const [selected, setSelected] = useState<ComponentStyle>(initialStyle || 'modern');
  const [customizations, setCustomizations] = useState<Record<ComponentStyle, StyleCustomizations>>(
    savedCustomizations || DEFAULT_CUSTOMIZATIONS
  );
  const [expandedCard, setExpandedCard] = useState<ComponentStyle | null>(null);

  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];

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
    <div className="comp-style-page">
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
                className={`comp-style-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelected(styleKey)}
              >
                <VStack spacing={3}>
                  <div className="comp-style-card-header">
                    <H3 style={{ fontSize: '1rem' }}>{style.label}</H3>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => setSelected(styleKey)}
                      onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      variant="primary"
                    />
                  </div>

                  <BodySmall style={{ color: 'var(--Quiet)' }}>{style.description}</BodySmall>

                  {/* Preview */}
                  <div className="comp-style-preview">
                    <div className="comp-preview-card" style={cardPreviewStyle}>
                      <div
                        className="comp-preview-header"
                        style={{ borderRadius: `${custom.radius}px ${custom.radius}px 0 0`, background: colors[0] }}
                      />
                      <div className="comp-preview-body">
                        <div className="comp-preview-text-line" style={{ width: '70%' }} />
                        <div className="comp-preview-text-line" style={{ width: '90%' }} />
                        <div className="comp-preview-text-line" style={{ width: '50%' }} />
                        <HStack spacing={1} style={{ marginTop: 8 }}>
                          <div
                            className="comp-preview-button"
                            style={{ borderRadius: Math.max(custom.radius / 3, 2), background: colors[0] }}
                          />
                          <div
                            className="comp-preview-button outline"
                            style={{ borderRadius: Math.max(custom.radius / 3, 2), borderColor: colors[0] }}
                          />
                        </HStack>
                      </div>
                    </div>

                    <HStack spacing={1} style={{ marginTop: 8 }}>
                      <div className="comp-preview-chip" style={{ borderRadius: custom.radius * 0.75, background: colors[1] }} />
                      <div className="comp-preview-chip" style={{ borderRadius: custom.radius * 0.75, background: colors[2] }} />
                      <div className="comp-preview-input" style={{ borderRadius: Math.max(custom.radius / 3, 2) }} />
                    </HStack>
                  </div>

                  {/* Radius values */}
                  <div className="comp-style-radii">
                    <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                      Radius: {custom.radius}px {custom.bevel > 0 ? `\u2022 Bevel: ${custom.bevel}` : ''}
                    </BodySmall>
                  </div>

                  {/* Customize toggle */}
                  <Button
                    variant="outline"
                    color="default"
                    size="small"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setExpandedCard(isExpanded ? null : styleKey);
                    }}
                    style={{ fontSize: '0.75rem' }}
                  >
                    {isExpanded ? 'Hide' : 'Customize'}
                  </Button>

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

        <HStack spacing={2} style={{ marginTop: 16 }}>
          <Button variant="outline" color="default" onClick={onBack}>Back</Button>
          <Button variant="solid" color="default" onClick={handleComplete}>Next</Button>
        </HStack>
      </VStack>
    </div>
  );
}
