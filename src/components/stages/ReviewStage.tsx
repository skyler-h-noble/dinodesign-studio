import { useEffect, useMemo, useState } from 'react';
import {
  Button, H2, H3, BodySmall, Overline, VStack, HStack,
  ButtonGroup, Card, Divider,
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
  pendingReExport?: boolean;
  originalSnapshot?: {
    designSystemName?: string;
    colorScheme?: ColorScheme | null;
    userSelections?: UserSelections;
    typographyStyles?: TypographyStyle[];
    componentStyle?: ComponentStyle;
  } | null;
}

const SELECTION_LABELS: Record<string, string> = {
  background: 'Background',
  cardColoring: 'Card coloring',
  textColoring: 'Text coloring',
  button: 'Default buttons',
  status: 'Status bar',
  appBar: 'App bar',
  navBar: 'Navigation bar',
};

function diffSnapshot(
  snap: NonNullable<Props['originalSnapshot']>,
  current: {
    designSystemName: string;
    colorScheme: ColorScheme | null;
    userSelections: UserSelections;
    typographyStyles: TypographyStyle[];
    componentStyle: ComponentStyle;
  },
): string[] {
  const changes: string[] = [];
  if (snap.designSystemName && snap.designSystemName !== current.designSystemName) {
    changes.push(`Name: ${snap.designSystemName} → ${current.designSystemName}`);
  }
  const beforeColors = (snap.colorScheme?.colors || []).join(', ');
  const afterColors = (current.colorScheme?.colors || []).join(', ');
  if (beforeColors && afterColors && beforeColors !== afterColors) {
    changes.push(`Color palette updated`);
  }
  if (snap.componentStyle && snap.componentStyle !== current.componentStyle) {
    changes.push(`Component style: ${snap.componentStyle} → ${current.componentStyle}`);
  }
  // userSelections per-field diff
  const prevSel = (snap.userSelections || {}) as Record<string, unknown>;
  const curSel = current.userSelections as unknown as Record<string, unknown>;
  Object.entries(SELECTION_LABELS).forEach(([key, label]) => {
    const before = prevSel[key];
    const after = curSel[key];
    if (before !== undefined && before !== after) {
      changes.push(`${label}: ${String(before)} → ${String(after)}`);
    }
  });
  // typography — compare per-role family/weight/allCaps
  const prevTypo = snap.typographyStyles || [];
  const curTypo = current.typographyStyles || [];
  ['header', 'body', 'decorative'].forEach(role => {
    const before = prevTypo.find(t => t.type === role);
    const after = curTypo.find(t => t.type === role);
    if (!before && !after) return;
    if (!before && after) { changes.push(`${role} typography added: ${after.family}`); return; }
    if (before && !after) { changes.push(`${role} typography removed`); return; }
    if (before && after) {
      if (before.family !== after.family) changes.push(`${role} font: ${before.family} → ${after.family}`);
      if (before.weight !== after.weight) changes.push(`${role} weight: ${before.weight} → ${after.weight}`);
      if (Boolean(before.allCaps) !== Boolean(after.allCaps)) changes.push(`${role} all-caps ${after.allCaps ? 'on' : 'off'}`);
    }
  });
  return changes;
}

const STYLE_LABELS: Record<ComponentStyle, string> = {
  professional: 'Professional',
  modern: 'Modern',
  bold: 'Bold',
  playful: 'Playful',
};

export default function ReviewStage({
  onNext, designSystemName, colorScheme, userSelections,
  typographyStyles, componentStyle, moodBoardUrl,
  pendingReExport, originalSnapshot,
}: Props) {
  const colors = colorScheme?.colors || [];
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const changes = useMemo(() => {
    if (!pendingReExport || !originalSnapshot) return [];
    return diffSnapshot(originalSnapshot, {
      designSystemName, colorScheme, userSelections, typographyStyles, componentStyle,
    });
  }, [pendingReExport, originalSnapshot, designSystemName, colorScheme, userSelections, typographyStyles, componentStyle]);

  // Load typography fonts into the page
  useEffect(() => {
    if (typographyStyles.length > 0) {
      const families = typographyStyles.map(t => t.family).filter(Boolean);
      if (families.length) loadGoogleFonts(families);
    }
  }, [typographyStyles]);

  // Edit flow gets a different layout: celebratory title, no QR card, full
  // changes list visible, and the sticky bottom bar (already labelled
  // "Reprocess Design System") serves as the CTA — no inline button.
  if (pendingReExport) {
    return (
      <div className="review-page">
        <VStack spacing={4} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <VStack spacing={1}>
            <H2 style={{ textAlign: 'center' }}>We see you have made some beautiful changes</H2>
            <Overline
              style={{
                color: 'var(--Text)',
                textAlign: 'center',
                fontFamily: 'var(--Set-Font-Family-Decorative, var(--Body-Font-Family, inherit))',
                fontWeight: 'var(--Set-Font-Family-Decorative-Weight, 400)' as any,
                letterSpacing: 'var(--Set-Font-Family-Decorative-Letter-Spacing, 0em)',
                textTransform: 'none',
              }}
            >
              Preview your updates and reprocess when ready.
            </Overline>
          </VStack>

          <div className="review-layout">
            {/* Left: same iPhone preview as the create flow */}
            <div className="review-preview-col">
              <VStack spacing={2} alignItems="center">
                <ButtonGroup
                  size="small"
                  value={previewMode}
                  onChange={(val: 'light' | 'dark') => setPreviewMode(val)}
                >
                  <Button value="light" size="small">Light</Button>
                  <Button value="dark" size="small">Dark</Button>
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

            {/* Right: full-height changes list, no QR, no inline button. */}
            <div className="review-details-col" style={{ minWidth: 0 }}>
              <Card padding="medium" style={{ minWidth: 0, width: '100%' }}>
                <VStack spacing={2} style={{ width: '100%', minWidth: 0 }}>
                  <H3 style={{ fontSize: '1rem' }}>These are the changes you've made</H3>
                  {changes.length > 0 ? (
                    <ul style={{
                      margin: 0,
                      padding: '4px 0 0 18px',
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      color: 'var(--Text)',
                      fontSize: '0.875rem',
                      lineHeight: 1.5,
                    }}>
                      {changes.map((c, i) => (
                        <li
                          key={i}
                          style={{
                            padding: '4px 0',
                            wordBreak: 'normal',
                            overflowWrap: 'break-word',
                          }}
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <BodySmall color="quiet">
                      No changes detected since your last export. You can still reprocess to refresh the published files.
                    </BodySmall>
                  )}
                </VStack>
              </Card>
            </div>
          </div>
        </VStack>
      </div>
    );
  }

  return (
    <div className="review-page">
      <VStack spacing={4} style={{ maxWidth: 1100, margin: '0 auto' }}>
        <VStack spacing={1}>
          <H2 style={{ textAlign: 'center' }}>Review Your Design System</H2>
          <Overline
            style={{
              color: 'var(--Text)',
              textAlign: 'center',
              fontFamily: 'var(--Set-Font-Family-Decorative, var(--Body-Font-Family, inherit))',
              fontWeight: 'var(--Set-Font-Family-Decorative-Weight, 400)' as any,
              letterSpacing: 'var(--Set-Font-Family-Decorative-Letter-Spacing, 0em)',
              textTransform: 'none',
            }}
          >
            Preview how your design system will look across your application.
          </Overline>
        </VStack>

        <div className="review-layout">
          {/* ─── Left: Phone Preview ─── */}
          <div className="review-preview-col">
            <VStack spacing={2} alignItems="center">
              <ButtonGroup
                size="small"
                value={previewMode}
                onChange={(val: 'light' | 'dark') => setPreviewMode(val)}
              >
                <Button value="light" size="small">Light</Button>
                <Button value="dark" size="small">Dark</Button>
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
            <Card padding="medium">
              <VStack spacing={2} alignItems="center" style={{ textAlign: 'center' }}>
                <BodySmall style={{ fontWeight: 600 }}>Share Preview</BodySmall>
                <div data-surface="Container-Low" style={{
                  width: 120, height: 120,
                  background: 'var(--Background)', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid var(--Border)',
                }}>
                  <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>QR Code</BodySmall>
                </div>
                <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem' }}>
                  Scan to preview on mobile
                </BodySmall>
              </VStack>
            </Card>

            {/* CTA — create flow only; the edit flow rendered earlier in
                this component with its own layout and uses the sticky bottom
                bar's "Reprocess Design System" button instead. */}
            <Card padding="medium">
              <VStack spacing={2}>
                <H3 style={{ fontSize: '1rem' }}>Ready to use your design system?</H3>
                <BodySmall color="quiet">
                  Get your hosted playground, Figma integration, and code package.
                </BodySmall>
                <Button
                  variant="primary"
                  onClick={onNext}
                  style={{ width: '100%', padding: '14px 24px', fontSize: '1rem', fontWeight: 700 }}
                >
                  Get Your Design System
                </Button>
              </VStack>
            </Card>
          </div>
        </div>

        {/* ─── Details row below preview ─── */}
        <Divider style={{ marginTop: 16 }} />
        <div style={{ width: '100%', paddingTop: 8 }}>
          <div className="review-grid">
            {/* Coloring */}
            <Card padding="medium">
              <VStack spacing={1}>
                <BodySmall style={{ fontWeight: 600 }}>Coloring</BodySmall>
                <HStack spacing={1}>
                  {colors.slice(0, 3).map((c, i) => (
                    <div
                      key={i}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--Style-Border-Radius, 6px)',
                        backgroundColor: c,
                        border: '1px solid var(--Border)',
                      }}
                    />
                  ))}
                </HStack>
                <BodySmall color="quiet">Theme: {colorScheme?.name || 'Custom'}</BodySmall>
                <BodySmall color="quiet">Style: {STYLE_LABELS[componentStyle]}</BodySmall>
              </VStack>
            </Card>

            {/* Typography */}
            {typographyStyles.length > 0 && (
              <Card padding="medium">
                <VStack spacing={1}>
                  <BodySmall style={{ fontWeight: 600 }}>Typography</BodySmall>
                  {typographyStyles.map((t, i) => (
                    <BodySmall key={i} style={{ color: 'var(--Quiet)', textTransform: 'capitalize' }}>
                      {t.type}: {t.family} ({t.weight}){t.allCaps ? ' ALL CAPS' : ''}
                    </BodySmall>
                  ))}
                </VStack>
              </Card>
            )}

            {/* Settings summary */}
            <Card padding="medium">
              <VStack spacing={1}>
                <BodySmall style={{ fontWeight: 600 }}>Settings</BodySmall>
                <BodySmall color="quiet">Background: {userSelections.background}</BodySmall>
                <BodySmall color="quiet">Cards: {userSelections.cardColoring} &bull; Text: {userSelections.textColoring}</BodySmall>
                <BodySmall color="quiet">Buttons: {userSelections.button}</BodySmall>
              </VStack>
            </Card>
          </div>
        </div>
      </VStack>
    </div>
  );
}
