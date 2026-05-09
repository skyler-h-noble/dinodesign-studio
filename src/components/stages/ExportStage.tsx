import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card,
} from '@dynodesign/components';
import ComputerIcon from '@mui/icons-material/Computer';
import CodeIcon from '@mui/icons-material/Code';
import GridViewIcon from '@mui/icons-material/GridView';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { StageProps, ColorScheme, UserSelections, TypographyStyle, ComponentStyle, SurfaceStyle } from '../../types';
import { generateAndUploadDesignSystem } from '../../utils/generateDesignSystem';
import { getPublicFileUrl } from '../../utils/firebase/storage';
import { db } from '../../utils/firebase/client';
import { useAuth } from '../../contexts/AuthContext';
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
  moodBoardFile?: File | null;
  styleCustomizations?: any;
  surfaceStyle?: SurfaceStyle;
}

export default function ExportStage({
  onBack, designSystemName, colorScheme, userSelections,
  typographyStyles, componentStyle, dinoId, onDinoIdGenerated, moodBoardUrl, moodBoardFile, surfaceStyle, styleCustomizations,
}: Props) {
  const { user } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];
  const headerFont = typographyStyles.find(t => t.type === 'header');

  // Generate on mount if no ID yet
  useEffect(() => {
    if (dinoId || isGenerating || !colorScheme) return;
    let mounted = true;

    setIsGenerating(true);
    setGenError(null);

    generateAndUploadDesignSystem({
      designSystemName,
      colorScheme,
      userSelections,
      typographyStyles,
      componentStyle,
      surfaceStyle,
      moodBoardUrl,
      moodBoardFile,
      styleCustomizations,
    })
      .then(async id => {
        if (!mounted) return;
        // Persist a Firestore record so this design system shows up in the
        // user's account list. Storage upload already happened above; this
        // is just the user-association metadata. Best-effort — failure here
        // doesn't block the user from proceeding.
        if (user) {
          try {
            await setDoc(doc(db, 'designSystems', id), {
              userId: user.uid,
              name: designSystemName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              version: 1,
              lastPushedAt: null,
              lastPushedVersion: 0,
              colors: colors.slice(0, 3),
              componentStyle,
              headerFontFamily: headerFont?.family || null,
            }, { merge: true });
          } catch (err) {
            console.error('Failed to write design system record:', err);
          }
        }
        onDinoIdGenerated(id);
        setIsGenerating(false);
      })
      .catch(err => {
        if (!mounted) return;
        console.error('Generation failed:', err);
        setGenError(err.message);
        setIsGenerating(false);
      });

    return () => { mounted = false; };
  }, []);

  const uniqueId = dinoId || 'generating...';
  const showcaseBase = 'https://designology.netlify.app';
  const playgroundUrl = `${showcaseBase}/?user=${dinoId || ''}`;
  const storybookUrl = `${showcaseBase}/storybook/?user=${dinoId || ''}`;
  const claudeMdUrl = `${window.location.origin}/api/tokens/${dinoId || ''}/md`;
  const installCmd = `npm install @dynodesign/components && npx @dynodesign/init ${dinoId || ''}`;
  const hasId = !!dinoId;
  const copyTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    return () => { copyTimers.current.forEach(clearTimeout); };
  }, []);

  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    const id = setTimeout(() => { setter(false); copyTimers.current.delete(id); }, 2000);
    copyTimers.current.add(id);
  };

  if (isGenerating) {
    return (
      <div className="export-page">
        <VStack spacing={4} style={{ maxWidth: 800, margin: '0 auto', alignItems: 'center', paddingTop: 80 }}>
          <div className="typo-spinner" />
          <H2 sx={{ textAlign: 'center', width: 'auto' }}>Generating Your Design System</H2>
          <Body sx={{ color: 'var(--Quiet)', textAlign: 'center', width: 'auto' }}>Uploading CSS tokens, Figma JSON, and documentation...</Body>
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
          <Button variant="primary-outline" onClick={onBack}>Back</Button>
        </VStack>
      </div>
    );
  }

  return (
    <div className="export-page">
      <VStack spacing={4}>
        <VStack spacing={1}>
          <H2 sx={{ textAlign: 'center', width: 'auto' }}>Start Using Your Design System</H2>
          <Body sx={{ color: 'var(--Quiet)', textAlign: 'center', width: 'auto' }}>
            {designSystemName} is ready. Choose how you want to use it.
          </Body>
        </VStack>

        {/* Color preview strip + ID */}
        <HStack spacing={2} style={{ alignItems: 'center' }}>
          {colors.slice(0, 3).map((c, i) => (
            <div key={i} style={{ width: 32, height: 32, borderRadius: 8, background: c, border: '1px solid var(--Border)' }} />
          ))}
          <div style={{ flex: 1 }} />
          <code className="export-id-code" data-surface="Container" style={{ maxWidth: 280 }}>{uniqueId}</code>
          <Button variant="primary-outline" size="small" onClick={() => handleCopy(uniqueId, setCopiedId)}>
            {copiedId ? 'Copied' : 'Copy'}
          </Button>
        </HStack>

        <div className="export-cards-grid">
          {/* Row 1: Hosted + Figma (50/50) */}
          <Card padding="medium">
            <VStack spacing={3}>
              <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Primary-Button)', color: 'var(--Buttons-Primary-Text)' }}>
                <ComputerIcon />
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Hosted Design System</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                View your complete design system with all 49 components rendered with your brand tokens. Share the playground link with your team.
              </BodySmall>
              <Button variant="primary" style={{ width: '100%' }} disabled={!hasId} onClick={() => window.open(playgroundUrl, '_blank')}>
                Open Playground
              </Button>
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack spacing={3}>
              <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#fff' }}>
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
              <Button variant="primary" style={{ width: '100%' }} disabled>
                Open Figma Template (Coming Soon)
              </Button>
            </VStack>
          </Card>

          {/* Row 2: Code Project + Storybook (50/50) */}
          <Card padding="medium">
            <VStack spacing={3}>
              <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Tertiary-Button)', color: 'var(--Buttons-Tertiary-Text)' }}>
                <CodeIcon />
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Add to Your Code Project</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Install the DinoDesign component library and connect your design system to your React project.
              </BodySmall>
              <VStack spacing={1} style={{ width: '100%' }}>
                <BodySmall style={{ fontWeight: 600 }}>Run in your terminal:</BodySmall>
                <div className="export-code-block">
                  <code>{installCmd}</code>
                  <Button variant="primary-outline" size="small" onClick={() => handleCopy(installCmd, setCopiedInstall)} style={{ flexShrink: 0 }}>
                    {copiedInstall ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </VStack>
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack spacing={3}>
              <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Error-Button)', color: 'var(--Buttons-Error-Text)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.34.24l-.12 2.71a.18.18 0 0 0 .29.15l1.06-.8.9.7a.18.18 0 0 0 .28-.14L18.65.1l1.33-.1a1.2 1.2 0 0 1 1.28 1.2v21.6A1.2 1.2 0 0 1 20 24l-16.1-.72a1.2 1.2 0 0 1-1.15-1.16L2 2.32a1.2 1.2 0 0 1 1.13-1.27l13.2-.83.01.02zM13.27 9.3c0 .47 3.16.24 3.59-.08 0-3.2-1.72-4.89-4.86-4.89-3.15 0-4.9 1.72-4.9 4.29 0 4.45 6 4.53 6 6.96 0 .7-.32 1.1-1.05 1.1-.96 0-1.35-.49-1.3-2.16 0-.36-3.65-.48-3.77 0-.27 4.03 2.23 5.2 5.1 5.2 2.79 0 4.97-1.49 4.97-4.18 0-4.77-6.1-4.64-6.1-7 0-.97.72-1.1 1.13-1.1.45 0 1.25.07 1.19 1.87z"/>
                </svg>
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Storybook</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Browse interactive component documentation with usage examples, prop tables, and live previews for all 49 components.
              </BodySmall>
              <Button variant="primary" style={{ width: '100%' }} onClick={() => window.open(storybookUrl, '_blank')}>
                Open Storybook
              </Button>
            </VStack>
          </Card>

          {/* Row 3: AI + Accessibility Report (50/50) */}
          <Card padding="medium">
            <VStack spacing={3}>
              <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Secondary-Button)', color: 'var(--Buttons-Secondary-Text)' }}>
                <GridViewIcon />
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Start Using in AI</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Connect your design system to Cursor, Claude Code, or any AI coding assistant.
              </BodySmall>
              <VStack spacing={1} style={{ width: '100%' }}>
                <BodySmall style={{ fontWeight: 600 }}>CLAUDE.md URL:</BodySmall>
                <div className="export-code-block">
                  <code>{claudeMdUrl}</code>
                  <Button variant="primary-outline" size="small" onClick={() => handleCopy(claudeMdUrl, setCopiedClaude)} style={{ flexShrink: 0 }}>
                    {copiedClaude ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </VStack>
            </VStack>
          </Card>

          <Card padding="medium">
            <VStack spacing={3}>
              <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Success-Button)', color: 'var(--Buttons-Success-Text)' }}>
                <CheckCircleOutlineIcon />
              </div>
              <H3 style={{ fontSize: '1.1rem' }}>Accessibility Report</H3>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Download a detailed contrast report showing Text, Header, Quiet, Border, Button, and Button Text contrast ratios for every background, surface, and container.
              </BodySmall>
              <Button
                variant="primary"
                style={{ width: '100%' }}
                disabled={!hasId}
                onClick={() => window.open(`/accessibility-report?id=${dinoId}`, '_blank', 'noopener')}
              >
                Open Accessibility Report
              </Button>
            </VStack>
          </Card>
        </div>

        {/* Download All as ZIP */}
        {hasId && (
          <Card padding="medium" sx={{ width: '100%' }}>
            <VStack spacing={2}>
              <BodySmall style={{ fontWeight: 600 }}>Download All Files</BodySmall>
              <Button
                variant="primary"
                style={{ width: '100%' }}
                onClick={async () => {
                  const zip = new JSZip();
                  const files = ['foundation.css', 'core.css', 'typography-tokens.css', 'Light-Mode.css', 'Dark-Mode.css', 'base.css', 'styles.css', 'tokens.json', 'figma.json', 'DINO-TOKENS.md', 'theme.json'];
                  for (const f of files) {
                    try {
                      const res = await fetch(getPublicFileUrl(dinoId!, f));
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
          </Card>
        )}
      </VStack>
    </div>
  );
}
