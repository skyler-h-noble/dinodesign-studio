import { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card,
} from '@dynodesign/components';
import ComputerIcon from '@mui/icons-material/Computer';
import CodeIcon from '@mui/icons-material/Code';
import GridViewIcon from '@mui/icons-material/GridView';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { StageProps, ColorScheme, UserSelections, TypographyStyle, ComponentStyle, SurfaceStyle } from '../../types';
import { generateAndUploadDesignSystem } from '../../utils/generateDesignSystem';
import { LIB_DYNAMIC_CSS_FILES } from '../../utils/cssgen/exportToCSS';
import { getPublicFileUrl } from '../../utils/firebase/storage';
import { db } from '../../utils/firebase/client';
import { isDesignNameTaken } from '../../utils/designSystemNames';
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
  /** Full list of swatches extracted from the mood board (the "Core Colors"
   *  the user sees in ColorStage's extraction step). Persisted in the
   *  rehydration snapshot so editing brings back the original 6+ choices,
   *  not just the 3 currently selected as primary/secondary/tertiary. */
  topColors?: Array<{ hex: string; isSwatch?: boolean }>;
  /** Per-Core-Color tweaks (chroma sliders, hex locks) — also persisted in
   *  the snapshot so editing restores the user's saturation and lock state. */
  colorEdits?: {
    chromaPerColor?: number[];
    darkChromaPerColor?: number[];
    lockedColorMap?: Record<number, string>;
  };
  /** Sidebar typography settings (style category / weight / spacing / caps
   *  per role). Persisted alongside the chosen Google Font trio so the
   *  Typography stage's left panel comes back the same on edit. */
  typographySettings?: TypographyStyle[] | null;
  /** True when MainApp loaded an existing design system from Firestore and the
   *  user has clicked through to the export stage. Triggers a re-export to the
   *  same UUID with version + 1 and writes an 'updated' event. */
  pendingReExport?: boolean;
  onReExportComplete?: () => void;
}

export default function ExportStage({
  onBack, designSystemName, colorScheme, userSelections,
  typographyStyles, componentStyle, dinoId, onDinoIdGenerated, moodBoardUrl, moodBoardFile, surfaceStyle, styleCustomizations,
  topColors, colorEdits, typographySettings, pendingReExport, onReExportComplete,
}: Props) {
  const { user } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // Tracks which dinoId we've already started a re-export for. React 18 dev
  // StrictMode invokes effects twice; without this ref the second invocation
  // would race against the first and the post-upload state updates
  // (setIsGenerating(false) + onReExportComplete) would never fire.
  const reExportStartedFor = useRef<string | null>(null);
  const colors = colorScheme?.colors || ['#666', '#999', '#ccc'];
  const headerFont = typographyStyles.find(t => t.type === 'header');

  // Build the rehydration snapshot once per render — same shape used on both
  // first export and re-export so the next /create?id= can restore state.
  // Persists the Firebase Storage URL (not the local blob URL), so the
  // mood board survives a page refresh and is visible to anyone who can
  // read the design system.
  const buildSnapshot = (id: string | null) => ({
    designSystemName,
    colorScheme,
    userSelections,
    typographyStyles,
    componentStyle,
    styleCustomizations: styleCustomizations || null,
    surfaceStyle: surfaceStyle || null,
    moodBoardUrl: id ? getPublicFileUrl(id, 'moodboard.png') : null,
    // Persist the full Core Colors set so the next /create?id=<uuid> can
    // restore the same swatches the user saw when they first extracted —
    // not just the 3 (primary/secondary/tertiary) inside `colorScheme`.
    topColors: topColors || null,
    // Per-color customisations (chroma sliders, hex locks) that the palette
    // generator can't reconstruct from the extracted hexes alone.
    colorEdits: colorEdits || null,
    // Sidebar typography state (style categories per role). Lets the
    // Typography stage restore the left panel exactly as the user left it,
    // separate from `typographyStyles` which carries the chosen Google
    // Font names.
    typographySettings: typographySettings || null,
  });

  // First export: no dinoId yet. Generate fresh UUID, write Firestore +
  // 'created' event.
  useEffect(() => {
    if (dinoId || isGenerating || !colorScheme || pendingReExport) return;
    let mounted = true;
    setIsGenerating(true);
    setGenError(null);

    (async () => {
      // Backstop uniqueness check — the name stage caught duplicates for users
      // who were signed in at naming time, but anonymous users sign in later
      // in the review→pricing flow and may now collide with an older design.
      if (user) {
        try {
          const taken = await isDesignNameTaken(user.uid, designSystemName);
          if (taken) {
            if (!mounted) return;
            setGenError(`You already have a design system named "${designSystemName}". Go back and rename it before exporting.`);
            setIsGenerating(false);
            return;
          }
        } catch {
          // Non-fatal: if the check itself errors we don't want to block
          // export. Continue and let Firestore enforce constraints at write.
        }
      }

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
        version: 1,
      })
      .then(async id => {
        if (!mounted) return;
        if (user) {
          try {
            const snapshot = buildSnapshot(id);
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
              moodBoardUrl: getPublicFileUrl(id, 'moodboard.png'),
              // Rehydration snapshot — read on /create?id=<uuid>
              snapshot,
            }, { merge: true });
            // Phase 1 of versioning: append the snapshot to a versions
            // subcollection keyed by version number. Future Cloud Function
            // can regenerate any historical CSS/tokens from this doc.
            await setDoc(doc(db, 'designSystems', id, 'versions', '1'), {
              version: 1,
              createdAt: serverTimestamp(),
              name: designSystemName,
              componentStyle,
              colors: colors.slice(0, 3),
              headerFontFamily: headerFont?.family || null,
              snapshot,
            });
            await addDoc(collection(db, 'designSystems', id, 'events'), {
              kind: 'created',
              version: 1,
              at: serverTimestamp(),
              summary: `Created — ${componentStyle} style, ${colors.length} core colors`,
            });
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
    })();

    return () => { mounted = false; };
  }, []);

  // Re-export: existing dinoId loaded from Firestore. Bump version, upload
  // to the same UUID, and append an 'updated' event.
  useEffect(() => {
    if (!pendingReExport || !dinoId || !colorScheme || !user) return;
    // Guard against React 18 StrictMode double-invocation: only one
    // re-export per dinoId per component lifetime. Tying this to a ref
    // (not a closure-scoped `mounted` flag) keeps the in-flight async
    // work alive when StrictMode reruns the effect.
    if (reExportStartedFor.current === dinoId) return;
    reExportStartedFor.current = dinoId;

    (async () => {
      setIsGenerating(true);
      setGenError(null);
      try {
        // Read current version so we can bump it monotonically.
        const snap = await getDoc(doc(db, 'designSystems', dinoId));
        const data = snap.exists() ? snap.data() as any : {};
        const prevVersion = Number(data.version || 0);
        const nextVersion = prevVersion + 1;

        await generateAndUploadDesignSystem({
          designSystemName,
          colorScheme,
          userSelections,
          typographyStyles,
          componentStyle,
          surfaceStyle,
          moodBoardUrl,
          moodBoardFile,
          styleCustomizations,
          uuid: dinoId,
          version: nextVersion,
        });

        const snapshot = buildSnapshot(dinoId);
        await setDoc(doc(db, 'designSystems', dinoId), {
          updatedAt: serverTimestamp(),
          version: nextVersion,
          colors: colors.slice(0, 3),
          componentStyle,
          headerFontFamily: headerFont?.family || null,
          name: designSystemName,
          moodBoardUrl: getPublicFileUrl(dinoId, 'moodboard.png'),
          snapshot,
        }, { merge: true });
        // Phase 1 of versioning: store this re-export's snapshot under
        // versions/{N}. Old versions stay reachable for regeneration.
        await setDoc(doc(db, 'designSystems', dinoId, 'versions', String(nextVersion)), {
          version: nextVersion,
          createdAt: serverTimestamp(),
          name: designSystemName,
          componentStyle,
          colors: colors.slice(0, 3),
          headerFontFamily: headerFont?.family || null,
          snapshot,
        });
        await addDoc(collection(db, 'designSystems', dinoId, 'events'), {
          kind: 'updated',
          version: nextVersion,
          at: serverTimestamp(),
          summary: `Updated — ${componentStyle} style`,
        });

        setIsGenerating(false);
        onReExportComplete?.();
      } catch (err: any) {
        console.error('Re-export failed:', err);
        setGenError(err?.message || String(err));
        setIsGenerating(false);
        // Allow a retry after failure (e.g. transient Firestore error).
        reExportStartedFor.current = null;
      }
    })();
    // No cleanup needed — the ref guard prevents double-firing and we
    // deliberately want the async work to run to completion even if the
    // effect is torn down by StrictMode's double-invocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReExport, dinoId, colorScheme, user]);

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

        {/* Export directly to DinoDesign lib (dev workflow) */}
        {hasId && (
          <Card padding="medium" sx={{ width: '100%' }}>
            <VStack spacing={2}>
              <BodySmall style={{ fontWeight: 600 }}>Export to DinoDesign</BodySmall>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Writes the 3 dynamic CSS files (<code>base.css</code>, <code>Light-Mode.css</code>, <code>Dark-Mode.css</code>) to your DinoDesign folder. First time you'll pick the folder; after that the studio remembers it and writes directly. Static lib files are left alone. Chrome/Edge only.
              </BodySmall>
              <Button
                variant="primary-outline"
                style={{ width: '100%' }}
                onClick={async () => {
                  type DirHandle = FileSystemDirectoryHandle & {
                    queryPermission?: (d: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
                    requestPermission?: (d: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
                  };
                  type WritableFile = { createWritable: () => Promise<{ write: (c: string) => Promise<void>; close: () => Promise<void> }> };
                  const w = window as unknown as { showDirectoryPicker?: (opts?: unknown) => Promise<DirHandle> };
                  if (!w.showDirectoryPicker) {
                    alert('Your browser doesn’t support direct folder writes. Use Chrome or Edge for this button.');
                    return;
                  }

                  // Tiny IndexedDB helper to persist the directory handle across sessions.
                  const DB_NAME = 'dynodesign-studio';
                  const STORE = 'handles';
                  const KEY = 'dinodesign-public-styles';
                  const openDB = () => new Promise<IDBDatabase>((resolve, reject) => {
                    const req = indexedDB.open(DB_NAME, 1);
                    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                  });
                  const idbGet = async (): Promise<DirHandle | null> => {
                    const db = await openDB();
                    return new Promise(resolve => {
                      const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
                      tx.onsuccess = () => resolve((tx.result as DirHandle) ?? null);
                      tx.onerror = () => resolve(null);
                    });
                  };
                  const idbSet = async (h: DirHandle) => {
                    const db = await openDB();
                    return new Promise<void>(resolve => {
                      const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(h, KEY);
                      tx.onsuccess = () => resolve();
                      tx.onerror = () => resolve();
                    });
                  };

                  try {
                    let dirHandle = await idbGet();
                    if (dirHandle) {
                      // Re-check or re-request permission.
                      const perm = (await dirHandle.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
                      if (perm !== 'granted') {
                        const requested = await dirHandle.requestPermission?.({ mode: 'readwrite' });
                        if (requested !== 'granted') dirHandle = null;
                      }
                    }
                    if (!dirHandle) {
                      dirHandle = await w.showDirectoryPicker({
                        id: 'dinodesign-public-styles',
                        mode: 'readwrite',
                        startIn: 'documents',
                      });
                      await idbSet(dirHandle);
                    }

                    let written = 0;
                    for (const f of LIB_DYNAMIC_CSS_FILES) {
                      try {
                        const res = await fetch(getPublicFileUrl(dinoId!, f));
                        if (!res.ok) continue;
                        const content = await res.text();
                        const fileHandle = await dirHandle.getFileHandle(f, { create: true });
                        const writable = await (fileHandle as unknown as WritableFile).createWritable();
                        await writable.write(content);
                        await writable.close();
                        written += 1;
                      } catch (e) {
                        console.error(`Failed to write ${f}:`, e);
                      }
                    }
                    alert(`Exported ${written} of ${LIB_DYNAMIC_CSS_FILES.length} dynamic CSS files to DinoDesign.`);
                  } catch (err) {
                    // AbortError = user cancelled the picker; ignore silently.
                    if ((err as { name?: string })?.name !== 'AbortError') {
                      console.error('Export to DinoDesign failed:', err);
                      alert('Export failed. See console for details.');
                    }
                  }
                }}
              >
                Export to DinoDesign
              </Button>
            </VStack>
          </Card>
        )}
      </VStack>
    </div>
  );
}
