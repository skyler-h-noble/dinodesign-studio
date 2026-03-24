import { useEffect, useState } from 'react';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack,
  ButtonGroup,
} from '@dynodesign/components';
import type { StageProps, ColorScheme, UserSelections, TypographyStyle, ComponentStyle } from '../../types';
import { loadGoogleFonts } from '../../utils/googleFontsManager';
import PhonePreview from '../PhonePreview';
import '../../styles/review.css';

interface Props extends StageProps {
  designSystemName: string;
  colorScheme: ColorScheme | null;
  userSelections: UserSelections;
  typographyStyles: TypographyStyle[];
  componentStyle: ComponentStyle;
  moodBoardUrl?: string | null;
}

const STYLE_LABELS: Record<ComponentStyle, string> = {
  professional: 'Professional',
  modern: 'Modern',
  bold: 'Bold',
  playful: 'Playful',
};

export default function ReviewStage({
  onNext, onBack, designSystemName, colorScheme, userSelections,
  typographyStyles, componentStyle, moodBoardUrl,
}: Props) {
  const colors = colorScheme?.colors || [];
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');

  // Load typography fonts into the page
  useEffect(() => {
    if (typographyStyles.length > 0) {
      const families = typographyStyles.map(t => t.family).filter(Boolean);
      if (families.length) loadGoogleFonts(families);
    }
  }, [typographyStyles]);

  return (
    <div className="review-page">
      <VStack spacing={4} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <VStack spacing={1}>
          <H2>Review Your Design System</H2>
          <Body style={{ color: 'var(--Quiet)' }}>
            Preview how your design system will look across your application.
          </Body>
        </VStack>

        <div className="review-layout">
          {/* ─── Left: Phone Preview ─── */}
          <div className="review-preview-col">
            <VStack spacing={2} alignItems="center">
              <ButtonGroup size="small" variant="outline">
                <Button
                  variant={previewMode === 'light' ? 'default' : 'outline'}
                  color="default"
                  size="small"
                  onClick={() => setPreviewMode('light')}
                >Light</Button>
                <Button
                  variant={previewMode === 'dark' ? 'default' : 'outline'}
                  color="default"
                  size="small"
                  onClick={() => setPreviewMode('dark')}
                >Dark</Button>
              </ButtonGroup>

              <div className="review-preview-scaler">
                <PhonePreview
                  colorScheme={colorScheme}
                  userSelections={userSelections}
                  componentStyle={componentStyle}
                  mode={previewMode}
                  typographyStyles={typographyStyles}
                  moodBoardUrl={moodBoardUrl}
                  designSystemName={designSystemName}
                />
              </div>

              <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                {designSystemName} &bull; {STYLE_LABELS[componentStyle]} &bull; {previewMode === 'light' ? 'Light' : 'Dark'} Mode
              </BodySmall>
            </VStack>
          </div>

          {/* ─── Right: QR + CTA ─── */}
          <div className="review-details-col">
            {/* QR Code placeholder */}
            <div className="review-card" style={{ textAlign: 'center' }}>
              <BodySmall style={{ fontWeight: 600 }}>Share Preview</BodySmall>
              <div style={{
                width: 120, height: 120, margin: '8px auto',
                background: 'var(--Container-Low, #f0f0f0)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--Border)',
              }}>
                <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>QR Code</BodySmall>
              </div>
              <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                Scan to preview on mobile
              </BodySmall>
            </div>

            {/* CTA */}
            <div className="review-cta">
              <H3 style={{ fontSize: '1rem' }}>Ready to use your design system?</H3>
              <BodySmall style={{ color: 'var(--Quiet)', marginBottom: 12 }}>
                Get your hosted playground, Figma integration, and code package.
              </BodySmall>
              <Button
                variant="solid"
                color="default"
                onClick={onNext}
                style={{ width: '100%', padding: '14px 24px', fontSize: '1rem', fontWeight: 700 }}
              >
                Get Your Design System
              </Button>
            </div>

            <Button variant="outline" color="default" onClick={onBack} style={{ width: '100%' }}>
              Back
            </Button>
          </div>
        </div>

        {/* ─── Details row below preview ─── */}
        <div style={{ width: '100%', borderTop: '1px solid var(--Border)', marginTop: 16, paddingTop: 24 }}>
          <div className="review-grid">
            {/* Coloring */}
            <div className="review-card">
              <BodySmall style={{ fontWeight: 600 }}>Coloring</BodySmall>
              <HStack spacing={1} style={{ marginTop: 8 }}>
                {colors.slice(0, 3).map((c, i) => (
                  <div key={i} style={{ width: 36, height: 36, borderRadius: 6, background: c, border: '1px solid var(--Border)' }} />
                ))}
              </HStack>
              <BodySmall style={{ color: 'var(--Quiet)', marginTop: 8 }}>Theme: {colorScheme?.name || 'Custom'}</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Style: {STYLE_LABELS[componentStyle]}</BodySmall>
            </div>

            {/* Typography */}
            {typographyStyles.length > 0 && (
              <div className="review-card">
                <BodySmall style={{ fontWeight: 600 }}>Typography</BodySmall>
                {typographyStyles.map((t, i) => (
                  <BodySmall key={i} style={{ color: 'var(--Quiet)', marginTop: 2, textTransform: 'capitalize' }}>
                    {t.type}: {t.family} ({t.weight}){t.allCaps ? ' ALL CAPS' : ''}
                  </BodySmall>
                ))}
              </div>
            )}

            {/* Settings summary */}
            <div className="review-card">
              <BodySmall style={{ fontWeight: 600 }}>Settings</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)', marginTop: 2 }}>Background: {userSelections.background}</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Cards: {userSelections.cardColoring} &bull; Text: {userSelections.textColoring}</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>Buttons: {userSelections.button}</BodySmall>
            </div>
          </div>
        </div>
      </VStack>
    </div>
  );
}
