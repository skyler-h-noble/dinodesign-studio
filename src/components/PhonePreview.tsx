import {
  Button, H3, Body, BodySmall, VStack, Card, Chip,
} from '@omni-design/components';
import type { ColorScheme, UserSelections, ComponentStyle, TypographyStyle } from '../types';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { useMemo } from 'react';

interface PhonePreviewProps {
  colorScheme: ColorScheme | null;
  userSelections: UserSelections;
  componentStyle?: ComponentStyle;
  mode: 'light' | 'dark';
  typographyStyles?: TypographyStyle[];
  moodBoardUrl?: string | null;
  designSystemName?: string;
}

export default function PhonePreview({
  colorScheme,
  userSelections,
  componentStyle = 'modern',
  mode,
  typographyStyles,
  moodBoardUrl,
  designSystemName = 'Your Design System',
}: PhonePreviewProps) {
  const css = useMemo(() => {
    if (!colorScheme) return '';
    try {
      return buildPreviewCSS({ colorScheme, userSelections, componentStyle, mode, typographyStyles });
    } catch { return ''; }
  }, [colorScheme, userSelections, componentStyle, mode, typographyStyles]);

  if (!colorScheme) return null;

  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div className="phone-frame" data-theme="Brand-Nav-Bar" style={{
        width: 390, borderRadius: 48, border: '8px solid #2e2e2e',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        maxHeight: 844, background: 'var(--Background, #000)',
      }}>
        {/* ── Status Bar ── */}
        <div data-theme="Brand-Status" style={{
          background: 'var(--Background, #fff)', height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px 0 35px', position: 'relative', flexShrink: 0,
          color: 'var(--Text)',
        }}>
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            top: 8, width: 110, height: 32, background: '#000', borderRadius: 20, zIndex: 10,
          }} />
          <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "-apple-system, 'SF Pro Display', sans-serif" }}>9:41</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="18" height="10" viewBox="0 0 18 10" fill="none"><rect x="0" y="6" width="3" height="4" rx="0.5" fill="currentColor"/><rect x="4" y="4" width="3" height="6" rx="0.5" fill="currentColor"/><rect x="8" y="2" width="3" height="8" rx="0.5" fill="currentColor"/><rect x="12" y="0" width="3" height="10" rx="0.5" fill="currentColor"/><rect x="16" y="0" width="2" height="10" rx="0.5" fill="currentColor" opacity="0.3"/></svg>
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M8 9.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" fill="currentColor"/><path d="M5.2 7.4a4 4 0 0 1 5.6 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M2.8 5a7 7 0 0 1 10.4 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M0.4 2.6A10 10 0 0 1 15.6 2.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none"><rect x="0" y="1" width="20" height="10" rx="2" stroke="currentColor" strokeWidth="1"/><rect x="1" y="2" width="17" height="8" rx="1.2" fill="currentColor"/><path d="M21 4v4a2 2 0 0 0 0-4z" fill="currentColor"/></svg>
          </div>
        </div>

        {/* ── App Bar ── */}
        <div data-theme="Brand-App-Bar" style={{
          background: 'var(--Background, #fff)', height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', flexShrink: 0, color: 'var(--Text)', marginTop: -1,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'block', width: 28, height: 2, background: 'var(--Text)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 28, height: 2, background: 'var(--Text)', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 28, height: 2, background: 'var(--Text)', borderRadius: 2 }} />
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: 40,
            background: 'var(--Buttons-Default-Button, transparent)',
            border: '1px solid var(--Buttons-Default-Border, rgba(0,0,0,0.12))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--Buttons-Default-Text, #1a1a1a)" strokeWidth="1.5">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round"/>
            </svg>
          </div>
        </div>

        {/* ── Main Content ── */}
        <div data-theme="Brand" style={{
          background: 'var(--Background, #fff)', flex: 1, overflowY: 'auto',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 16,
          color: 'var(--Text)',
          scrollbarWidth: 'none',
        }}>
          {/* The hero line sits tight to the app bar — a display heading is the
              start of the page, not a block floating in the middle of it. The
              16px container gap plus its own leading left an obvious hole. */}
          {/* Welcome heading */}
          {/* The page's one expressive moment, so it takes the DISPLAY face —
              the whole point of the Display role is a hero line, and rendering it
              in the Header face meant the picked display font never appeared in
              the preview at all. */}
          <h2 style={{
            /* Brand-owned tokens FIRST. --Font-Family-Display is defined by the
               lib (to the HEADER family on Desktop), so putting it first meant
               its fallbacks never ran and this line rendered in the header face
               — the exact bug the comment above says was already fixed once. */
            fontFamily: 'var(--Set-Font-Family-Display, var(--Set-Font-Family-Decorative, var(--Font-Family-Display, Arial, sans-serif)))',
            // Every value comes from the Display-Large step, so the preview
            // shows the step it claims to. Mixing the face's own weight and
            // letter-spacing with a different step's size is how "Welcome"
            // ended up sized from Display-SMALL while everything else was Large.
            fontWeight: 'var(--Display-Large-Font-Weight, var(--Set-Font-Family-Decorative-Weight, 400))' as any,
            letterSpacing: 'var(--Display-Large-Letter-Spacing, var(--Set-Font-Family-Decorative-Letter-Spacing, 0em))',
            // Capped for the phone. Display-Large is sized for a desktop hero;
            // dropped into a ~320px mock at full size it filled a third of the
            // screen and pushed the cards below the fold. min() keeps every
            // OTHER Display-Large property — face, weight, tracking, casing —
            // so the step is still the one being previewed, and only the size
            // is answerable to the surface it is drawn on.
            fontSize: 'min(var(--Display-Large-Font-Size, 34px), 30px)' as any,
            // Tighter than the token's own leading, for the same reason: a
            // display line set for a desktop measure is over-leaded at 30px.
            lineHeight: 1.1,
            // All-caps is a per-style token the scale already emits. The preview
            // simply never read it, so ticking "All caps" changed the type panel
            // and nothing else — the one place a user goes to check.
            textTransform: 'var(--Display-Large-Text-Transform, none)' as any,
            color: 'var(--Header)', margin: '-4px 0 -4px 0',
          }}>Welcome</h2>

          {/* Mood board banner */}
          {moodBoardUrl && (
            <div style={{ width: '100%', height: 202, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
              <img src={moodBoardUrl} alt="Mood board" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}

          {/* Main card */}
          <Card padding="medium" style={{ flexShrink: 0 }}>
            <VStack spacing={3}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Eyebrow ABOVE the heading — that is what an eyebrow is: a
                      small label introducing the line beneath it. It was below,
                      reading as a subtitle. And it takes the Eyebrow/Overline
                      tokens, not Decorative: the sizes live under Overline while
                      the face and colour live under Eyebrow. */}
                  <span style={{
                    fontFamily: 'var(--Font-Family-Eyebrow, var(--Set-Font-Family-Eyebrow, sans-serif))',
                    fontWeight: 'var(--Font-Weight-Eyebrow, 600)' as any,
                    letterSpacing: 'var(--Eyebrow-Medium-Letter-Spacing, var(--Overline-Medium-Letter-Spacing, 0.1em))',
                    textTransform: 'var(--Eyebrow-Medium-Text-Transform, var(--Overline-Medium-Text-Transform, uppercase))' as any,
                    fontSize: 'var(--Eyebrow-Medium-Font-Size, var(--Overline-Medium-Font-Size, 13px))' as any,
                    color: 'var(--Eyebrow, var(--Quiet))',
                  }}>Adaptive &amp; Accessible</span>
                  <H3 style={{ fontSize: 18, whiteSpace: 'nowrap' }}>{designSystemName}</H3>
                </div>
                <Button variant="secondary" size="small" style={{
                  width: 40, height: 40, minWidth: 'auto', borderRadius: 40, padding: 0, flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round"/><line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round"/>
                  </svg>
                </Button>
              </div>
              <Body style={{ fontSize: 15, lineHeight: 1.5 }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna ali.
              </Body>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="default" size="small">Button</Button>
                <Button variant="outline" color="default" size="small">Outline</Button>
              </div>
            </VStack>
          </Card>

          {/* Two-column cards — 50/50 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flexShrink: 0 }}>
            <Card padding="medium" style={{ minWidth: 0 }}>
              <VStack spacing={2}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {/* Eyebrow above the heading — see the note on the main card. */}
                    <span style={{
                      fontFamily: 'var(--Font-Family-Eyebrow, var(--Set-Font-Family-Eyebrow, sans-serif))',
                      fontWeight: 'var(--Font-Weight-Eyebrow, 600)' as any,
                      letterSpacing: 'var(--Eyebrow-Medium-Letter-Spacing, var(--Overline-Medium-Letter-Spacing, 0.1em))',
                      textTransform: 'var(--Eyebrow-Medium-Text-Transform, var(--Overline-Medium-Text-Transform, uppercase))' as any,
                      fontSize: 'var(--Eyebrow-Medium-Font-Size, var(--Overline-Medium-Font-Size, 13px))' as any,
                      color: 'var(--Eyebrow, var(--Quiet))',
                    }}>Explore</span>
                    <H3 style={{ fontSize: 16 }}>Next Steps</H3>
                  </div>
                  <Button variant="secondary" size="small" style={{
                    width: 36, height: 36, minWidth: 'auto', borderRadius: 36, padding: 0, flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </Button>
                </div>
                {moodBoardUrl && (
                  <div style={{ width: '100%', height: 56, borderRadius: 8, overflow: 'hidden' }}>
                    <img src={moodBoardUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(2.2)', objectPosition: '0% 30%' }} />
                  </div>
                )}
                <BodySmall style={{ lineHeight: 1.5 }}>Incididunt ut labore et dolore.</BodySmall>
              </VStack>
            </Card>

            <Card padding="medium" color="tertiary" style={{ minWidth: 0 }}>
              <VStack spacing={2}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <H3 style={{ fontSize: 16 }}>Have fun!</H3>
                  <Chip
                    label="NEW"
                    size="small"
                    variant="tertiary"
                    sx={{
                      borderRadius: '2px',
                      alignSelf: 'flex-start',
                      // Override the lib's variant colors so the chip reads
                      // the brand's --Tag-Default-* tokens (mapped to the
                      // complementary palette per Tag.Default rules — for
                      // a tertiary card that's the primary palette). Lib's
                      // Chip doesn't ship a `default` variant, so we keep
                      // tertiary as the structural variant and just swap
                      // the colors via sx.
                      backgroundColor: 'var(--Tag-Default-BG, var(--Tag-Tertiary-BG))',
                      color: 'var(--Tag-Default-Text, var(--Tag-Tertiary-Text))',
                      borderColor: 'var(--Tag-Default-BG, var(--Tag-Tertiary-BG))',
                    }}
                  />
                </div>
                {moodBoardUrl && (
                  <div style={{ width: '100%', height: 56, borderRadius: 8, overflow: 'hidden' }}>
                    <img src={moodBoardUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(2.2)', objectPosition: '100% 70%' }} />
                  </div>
                )}
                <BodySmall style={{ lineHeight: 1.5 }}>Incididunt ut labore et dolore.</BodySmall>
              </VStack>
            </Card>
          </div>
        </div>

        {/* ── Nav Bar ── */}
        <nav data-theme="Brand-Nav-Bar" style={{
          background: 'var(--Background, #fff)', height: 83,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 32px', flexShrink: 0,
        }}>
          {[
            { label: 'Home', active: true, icon: <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" strokeWidth="1.5" fill="none"/> },
            { label: 'Tickets', icon: <><rect x="2" y="7" width="20" height="14" rx="2" strokeWidth="1.5" fill="none"/><path d="M2 11h20" strokeWidth="1.5"/><path d="M7 3v4M17 3v4" strokeWidth="1.5" strokeLinecap="round"/><path d="M7 15l2 2 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></> },
            { label: 'Travel', icon: <><path d="M22 2L11 13" strokeWidth="1.5" strokeLinecap="round"/><path d="M22 2L15 22l-4-9-9-4 20-7z" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></> },
            { label: 'Hotels', icon: <><rect x="2" y="3" width="20" height="18" rx="2" strokeWidth="1.5" fill="none"/><path d="M2 9h20" strokeWidth="1.5"/><path d="M9 3v6M15 3v6" strokeWidth="1.5"/><rect x="6" y="13" width="4" height="5" rx="1" strokeWidth="1.2" fill="none"/><rect x="14" y="13" width="4" height="5" rx="1" strokeWidth="1.2" fill="none"/></> },
            { label: 'Food', icon: <><rect x="3" y="10" width="18" height="11" rx="2" strokeWidth="1.5" fill="none"/><path d="M7 10V7a5 5 0 0 1 10 0v3" strokeWidth="1.5" strokeLinecap="round" fill="none"/><circle cx="12" cy="15.5" r="1.5"/></> },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 40 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: item.active ? 'var(--Text)' : 'transparent',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke={item.active ? 'var(--Background)' : 'var(--Quiet)'}
                  strokeWidth="1.5"
                >{item.icon}</svg>
              </div>
              <span style={{
                fontFamily: 'var(--Set-Font-Family-Body, Arial, sans-serif)',
                fontWeight: 700, fontSize: 11,
                color: item.active ? 'var(--Text)' : 'var(--Quiet)',
              }}>{item.label}</span>
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
