import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack,
} from '@dynodesign/components';
import type { StageProps, ColorScheme, UserSelections, TypographyStyle, ComponentStyle, SurfaceStyle } from '../../types';
import { generateAndUploadDesignSystem } from '../../utils/generateDesignSystem';
import '../../styles/export.css';

interface Props extends StageProps {
  designSystemName: string;
  colorScheme: ColorScheme | null;
  userSelections: UserSelections;
  typographyStyles: TypographyStyle[];
  componentStyle: ComponentStyle;
  dinoId: string | null;
  onDinoIdGenerated: (id: string) => void;
  moodBoardUrl?: string | null;
  surfaceStyle?: SurfaceStyle;
}

export default function ExportStage({
  onBack, designSystemName, colorScheme, userSelections,
  typographyStyles, componentStyle, dinoId, onDinoIdGenerated, moodBoardUrl, surfaceStyle,
}: Props) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];

  // Generate on mount if no ID yet
  useEffect(() => {
    if (dinoId || isGenerating || !colorScheme) return;

    setIsGenerating(true);
    setGenError(null);

    generateAndUploadDesignSystem({
      designSystemName,
      colorScheme,
      userSelections,
      typographyStyles,
      componentStyle,
      surfaceStyle,
    })
      .then(id => {
        onDinoIdGenerated(id);
        setIsGenerating(false);
      })
      .catch(err => {
        console.error('Generation failed:', err);
        setGenError(err.message);
        setIsGenerating(false);
      });
  }, []);

  const uniqueId = dinoId || 'generating...';
  const showcaseBase = 'https://sunny-cendol-af27ce.netlify.app';
  const playgroundUrl = `${showcaseBase}/?user=${dinoId || ''}`;
  const storybookUrl = 'https://dinodesign.ai/storybook';
  const claudeMdUrl = `${window.location.origin}/api/tokens/${dinoId || ''}/md`;
  const installCmd = `npm install @dynodesign/components && npx @dynodesign/init ${dinoId || ''}`;
  const hasId = !!dinoId;

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  if (isGenerating) {
    return (
      <div className="export-page">
        <VStack spacing={4} style={{ maxWidth: 800, margin: '0 auto', alignItems: 'center', paddingTop: 80 }}>
          <div className="typo-spinner" />
          <H2>Generating Your Design System</H2>
          <Body style={{ color: 'var(--Quiet)' }}>Uploading CSS tokens, Figma JSON, and documentation...</Body>
        </VStack>
      </div>
    );
  }

  if (genError) {
    return (
      <div className="export-page">
        <VStack spacing={4} style={{ maxWidth: 800, margin: '0 auto', alignItems: 'center', paddingTop: 80 }}>
          <H2>Generation Failed</H2>
          <Body style={{ color: 'var(--Quiet)' }}>{genError}</Body>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Make sure the Supabase storage bucket &quot;design-systems&quot; exists and allows public uploads.
          </BodySmall>
          <Button variant="outline" color="default" onClick={onBack}>Back</Button>
        </VStack>
      </div>
    );
  }

  return (
    <div className="export-page">
      <VStack spacing={4} style={{ maxWidth: 800, margin: '0 auto' }}>
        <VStack spacing={1}>
          <H2>Start Using Your Design System</H2>
          <Body style={{ color: 'var(--Quiet)' }}>
            {designSystemName} is ready. Choose how you want to use it.
          </Body>
        </VStack>

        {/* Color preview strip */}
        <HStack spacing={1}>
          {colors.slice(0, 3).map((c, i) => (
            <div key={i} style={{ width: 40, height: 40, borderRadius: 8, background: c, border: '1px solid var(--Border)' }} />
          ))}
        </HStack>

        {/* Your unique ID */}
        <div className="export-card">
          <VStack spacing={2}>
            <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 600 }}>Your Design System ID</BodySmall>
            <div className="export-id-row">
              <code className="export-id-code">{uniqueId}</code>
              <Button variant="outline" color="default" size="small" onClick={() => handleCopy(uniqueId, setCopiedId)}>
                {copiedId ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </VStack>
        </div>

        <div className="export-cards-grid">
          {/* 1. Hosted Design System */}
          <div className="export-card">
            <VStack spacing={3}>
              <div className="export-card-icon" style={{ background: colors[0] }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8" /><path d="M12 17v4" />
                </svg>
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Hosted Design System</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                View your complete design system with all 49 components rendered with your brand tokens. Share the playground link with your team.
              </BodySmall>
              <Button
                variant="solid"
                color="default"
                style={{ width: '100%' }}
                disabled={!hasId}
                onClick={() => window.open(playgroundUrl, '_blank')}
              >
                Open Playground
              </Button>
            </VStack>
          </div>

          {/* 2. Figma Design System */}
          <div className="export-card">
            <VStack spacing={3}>
              <div className="export-card-icon" style={{ background: '#1e1e1e' }}>
                <svg width="20" height="20" viewBox="0 0 38 57" fill="none">
                  <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
                  <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
                  <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
                  <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
                  <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
                </svg>
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Figma Design System</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Get a full Figma design system with your brand tokens applied to every component, style, and variable.
              </BodySmall>
              <VStack spacing={1} style={{ width: '100%' }}>
                <BodySmall style={{ fontWeight: 600 }}>How to use:</BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>1. Open the DinoDesign Figma Design System Template</BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>2. Run the DinoDesign Figma Plugin inside the template</BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>3. Enter your ID: <code className="export-inline-code">{uniqueId}</code></BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>4. Watch your design system update with your brand tokens</BodySmall>
              </VStack>
              <Button variant="solid" color="default" style={{ width: '100%' }} disabled>
                Open Figma Template (Coming Soon)
              </Button>
            </VStack>
          </div>

          {/* 3. Add to Your Code Project */}
          <div className="export-card">
            <VStack spacing={3}>
              <div className="export-card-icon" style={{ background: colors[2] || colors[0] }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Add to Your Code Project</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Install the DinoDesign component library and connect your design system to your React project.
              </BodySmall>
              <VStack spacing={1} style={{ width: '100%' }}>
                <BodySmall style={{ fontWeight: 600 }}>Run in your terminal:</BodySmall>
                <div className="export-code-block">
                  <code>{installCmd}</code>
                  <Button
                    variant="outline"
                    color="default"
                    size="small"
                    onClick={() => handleCopy(installCmd, setCopiedInstall)}
                    style={{ flexShrink: 0 }}
                  >
                    {copiedInstall ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <BodySmall style={{ color: 'var(--Quiet)', marginTop: 4 }}>
                  This installs the component library and downloads your CSS token files automatically.
                </BodySmall>
              </VStack>
            </VStack>
          </div>

          {/* 4. Storybook */}
          <div className="export-card">
            <VStack spacing={3}>
              <div className="export-card-icon" style={{ background: '#FF4785' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M16.34.24l-.12 2.71a.18.18 0 0 0 .29.15l1.06-.8.9.7a.18.18 0 0 0 .28-.14L18.65.1l1.33-.1a1.2 1.2 0 0 1 1.28 1.2v21.6A1.2 1.2 0 0 1 20 24l-16.1-.72a1.2 1.2 0 0 1-1.15-1.16L2 2.32a1.2 1.2 0 0 1 1.13-1.27l13.2-.83.01.02zM13.27 9.3c0 .47 3.16.24 3.59-.08 0-3.2-1.72-4.89-4.86-4.89-3.15 0-4.9 1.72-4.9 4.29 0 4.45 6 4.53 6 6.96 0 .7-.32 1.1-1.05 1.1-.96 0-1.35-.49-1.3-2.16 0-.36-3.65-.48-3.77 0-.27 4.03 2.23 5.2 5.1 5.2 2.79 0 4.97-1.49 4.97-4.18 0-4.77-6.1-4.64-6.1-7 0-.97.72-1.1 1.13-1.1.45 0 1.25.07 1.19 1.87z"/>
                </svg>
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Storybook</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Browse interactive component documentation with usage examples, prop tables, and live previews for all 49 components.
              </BodySmall>
              <Button
                variant="solid"
                color="default"
                style={{ width: '100%' }}
                onClick={() => window.open(storybookUrl, '_blank')}
              >
                Open Storybook
              </Button>
            </VStack>
          </div>

          {/* 5. Start Using in AI — full width */}
          <div className="export-card" style={{ gridColumn: '1 / -1' }}>
            <VStack spacing={3}>
              <div className="export-card-icon" style={{ background: 'var(--Buttons-Primary-Button)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8V4H8" /><rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M2 12h20" /><path d="M12 2v20" />
                </svg>
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Start Using in AI</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Connect your design system to Cursor, Claude Code, or any AI coding assistant. Your hosted design system includes a CLAUDE.md file that teaches AI how to use your tokens and components correctly.
              </BodySmall>

              <VStack spacing={2} style={{ width: '100%' }}>
                <BodySmall style={{ fontWeight: 600 }}>For Claude Code:</BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>
                  Add this URL to your project's CLAUDE.md so Claude knows your design system:
                </BodySmall>
                <div className="export-code-block">
                  <code>{claudeMdUrl}</code>
                  <Button
                    variant="outline"
                    color="default"
                    size="small"
                    onClick={() => handleCopy(claudeMdUrl, setCopiedClaude)}
                    style={{ flexShrink: 0 }}
                  >
                    {copiedClaude ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                <BodySmall style={{ fontWeight: 600, marginTop: 4 }}>For Cursor:</BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>
                  Add the same URL as a doc reference in your .cursorrules file. It explains all 49 components, every token variable, and the correct usage patterns for your design system.
                </BodySmall>
              </VStack>
            </VStack>
          </div>
        </div>

        {/* Temporary: Download All as ZIP */}
        {hasId && (
          <div className="export-card" style={{ width: '100%' }}>
            <VStack spacing={2}>
              <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 600 }}>Temporary: Download All Files</BodySmall>
              <Button
                variant="solid"
                color="default"
                style={{ width: '100%' }}
                onClick={async () => {
                  const zip = new JSZip();
                  const base = `https://aqpmdqlhffjakkznxudv.supabase.co/storage/v1/object/public/design-system/${dinoId}`;
                  const files = ['foundation.css', 'core.css', 'Light-Mode.css', 'Dark-Mode.css', 'base.css', 'styles.css', 'tokens.json', 'DINO-TOKENS.md', 'theme.json'];
                  for (const f of files) {
                    try {
                      const res = await fetch(`${base}/${f}`);
                      if (res.ok) zip.file(f, await res.text());
                    } catch { /* skip */ }
                  }
                  if (moodBoardUrl) {
                    try {
                      const res = await fetch(moodBoardUrl);
                      if (res.ok) zip.file('mood-board.png', await res.blob());
                    } catch { /* skip */ }
                  }
                  const blob = await zip.generateAsync({ type: 'blob' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${designSystemName || 'design-system'}.zip`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
              >
                Download All (.zip)
              </Button>
            </VStack>
          </div>
        )}

        <HStack spacing={2} style={{ marginTop: 16 }}>
          <Button variant="outline" color="default" onClick={onBack}>Back</Button>
        </HStack>
      </VStack>
    </div>
  );
}
