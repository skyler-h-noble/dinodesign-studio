// INTERNAL CLAUDE.md / AAID tuning workbench.
//
// This is NOT a customer-facing feature. The product we ship to end users
// is the CLAUDE.md naming-convention document (patent claims 62–72). End
// users run their own AI agent (Claude Code, Cursor, Copilot, etc.) against
// that document — their API cost, their context window.
//
// This workbench exists for ONE reason: to evaluate what an AI agent
// produces when given a Figma frame plus the current CLAUDE.md, so we can
// iterate the CLAUDE.md prompt until output quality is reliably high.
//
// Admin-only. Calls Anthropic with OUR key (stored in browser localStorage
// for the dev tool — would move to a secret manager if we ever opened this
// beyond internal use, but the customer-facing product doesn't call any
// AI provider on our infrastructure).

import React, { useEffect, useMemo, useState } from 'react';
import * as DynoComponents from '@dynodesign/components';
import { CustomLivePreview } from '../utils/customLivePreview';
import {
  Card,
  VStack,
  HStack,
  Body,
  BodySmall,
  Caption,
  H2,
  H3,
  Button,
  ButtonGroup,
  TextField,
  TextArea,
  Alert,
  Chip,
  CircularProgress,
  Link,
} from '@dynodesign/components';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { getPublicFileUrl } from '../utils/firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import {
  parseFigmaUrl,
  fetchFigmaNode,
  fetchFigmaImage,
  fetchFigmaVariables,
} from '../utils/figmaApi';
import { convertFigmaToCode } from '../utils/figmaToCode';
import {
  logConversionAttempt,
  logConversionVerdict,
} from '../utils/figmaConversionFeedback';
import { prepareLiveCode } from '../utils/prepareLiveCode';
import { FIXTURES, loadFixture, type FigmaFixture } from '../utils/figmaFixtures';

const LS_FIGMA_TOKEN = 'aaid-workbench:figma-token';
const LS_ANTHROPIC_KEY = 'aaid-workbench:anthropic-key';
const LS_DINO_ID = 'aaid-workbench:dino-id';

// Per-brand CSS, in the exact order the production playground injects it
// (see netlify/edge-functions/playground-css.ts) and that main.tsx loads the
// lib defaults in. These override the default theme so the preview renders
// against the real hosted brand. Filenames MUST match what the generator
// writes to design-systems/<uuid>/ in hosted Storage — the old tokens-*.css
// names 404'd, which silently fell back to the local default theme.
const BRAND_CSS_FILES = ['foundation.css', 'core.css', 'Light-Mode.css', 'base.css', 'styles.css'];

interface BrandMeta {
  designSystemName?: string;
  headerFontFamily?: string;
  componentStyle?: string;
  colors?: string[];
}

export default function AaidWorkbenchPage() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [figmaToken, setFigmaToken] = useState(() => localStorage.getItem(LS_FIGMA_TOKEN) ?? '');
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem(LS_ANTHROPIC_KEY) ?? '');
  const [dinoId, setDinoId] = useState(() => localStorage.getItem(LS_DINO_ID) ?? '');
  const [brandMeta, setBrandMeta] = useState<BrandMeta | null>(null);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandError, setBrandError] = useState<string | null>(null);

  const [figmaUrl, setFigmaUrl] = useState('');
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  // Native width (CSS px) of the Figma frame, read from its absoluteBoundingBox.
  // Both panels render at this width so the side-by-side is a true 1:1 scale
  // comparison rather than the Figma image being stretched to fill its column.
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [jsx, setJsx] = useState<string>('');
  const [missingComponents, setMissingComponents] = useState<string[]>([]);
  const [conversionId, setConversionId] = useState<string | null>(null);

  const [rightView, setRightView] = useState<'code' | 'preview'>('code');
  // Source mode for the frame input. 'live' = paste a Figma URL + fetch
  // via REST PAT (rate-limited). 'fixture' = load a pre-saved JSON file
  // from public/figma-fixtures/. Fixtures bypass Figma entirely — instant
  // and durable across sessions.
  const [sourceMode, setSourceMode] = useState<'live' | 'fixture'>('fixture');
  const [fixtureId, setFixtureId] = useState<string>(FIXTURES[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<'good' | 'bad' | null>(null);
  const [correction, setCorrection] = useState('');
  const [verdictSaved, setVerdictSaved] = useState(false);

  const tokensSet = figmaToken.trim() !== '' && anthropicKey.trim() !== '';

  // Admin check — mirrors AdminProposals pattern.
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        setIsAdmin(snap.exists() && snap.data().isAdmin === true);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, [user]);

  // Persist tokens + dinoId to localStorage so the user only pastes once.
  useEffect(() => { localStorage.setItem(LS_FIGMA_TOKEN, figmaToken); }, [figmaToken]);
  useEffect(() => { localStorage.setItem(LS_ANTHROPIC_KEY, anthropicKey); }, [anthropicKey]);
  useEffect(() => { localStorage.setItem(LS_DINO_ID, dinoId); }, [dinoId]);

  // Brand CSS injection. When a Design ID is provided, inject the design
  // system's tokens-*.css files as <link> tags so any rendered output in
  // the workbench uses the customer's actual brand. Also fetches the
  // designSystems/{id} Firestore doc for metadata that informs the prompt
  // (header font family, component style — context the AAID should be
  // aware of when generating brand-appropriate code).
  useEffect(() => {
    const trimmed = dinoId.trim();
    if (!trimmed) {
      // Remove any previously injected brand <link> tags.
      document.querySelectorAll('link[data-aaid-brand]').forEach(n => n.remove());
      setBrandMeta(null);
      setBrandError(null);
      return;
    }

    setBrandLoading(true);
    setBrandError(null);

    // Inject CSS links (idempotent — clear old ones first).
    document.querySelectorAll('link[data-aaid-brand]').forEach(n => n.remove());
    for (const filename of BRAND_CSS_FILES) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = getPublicFileUrl(trimmed, filename);
      link.setAttribute('data-aaid-brand', trimmed);
      document.head.appendChild(link);
    }

    // Fetch brand metadata for the prompt.
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'designSystems', trimmed));
        if (!snap.exists()) {
          setBrandError('Design system not found.');
          setBrandMeta(null);
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        setBrandMeta({
          designSystemName: typeof data.name === 'string' ? data.name : undefined,
          headerFontFamily: typeof data.headerFontFamily === 'string' ? data.headerFontFamily : undefined,
          componentStyle: typeof data.componentStyle === 'string' ? data.componentStyle : undefined,
          colors: Array.isArray(data.colors) ? data.colors.filter((c): c is string => typeof c === 'string') : undefined,
        });
      } catch (e) {
        setBrandError(e instanceof Error ? e.message : String(e));
      } finally {
        setBrandLoading(false);
      }
    })();

    // Cleanup on unmount — remove injected <link> tags so they don't leak
    // brand styles into other studio pages.
    return () => {
      document.querySelectorAll(`link[data-aaid-brand="${trimmed}"]`).forEach(n => n.remove());
    };
  }, [dinoId]);

  const urlParts = useMemo(() => parseFigmaUrl(figmaUrl.trim()), [figmaUrl]);

  const activeFixture: FigmaFixture | undefined = useMemo(
    () => FIXTURES.find(f => f.id === fixtureId),
    [fixtureId],
  );

  // The Convert button is enabled when:
  //   - fixture mode: a fixture is selected and Anthropic key is set
  //   - live mode: URL parses + both keys are set
  const canConvert = sourceMode === 'fixture'
    ? Boolean(activeFixture && anthropicKey.trim())
    : Boolean(urlParts && tokensSet);

  const handleConvert = async () => {
    if (!user || !canConvert) return;
    setBusy(true);
    setError(null);
    setJsx('');
    setImgUrl(null);
    setFrameWidth(null);
    setMissingComponents([]);
    setConversionId(null);
    setVerdict(null);
    setCorrection('');
    setVerdictSaved(false);

    try {
      // Two source modes:
      //   - fixture: load a pre-saved JSON file from public/figma-fixtures.
      //     Zero Figma API hits; durable across sessions; used as the
      //     primary R&D path while tuning the AAID prompt.
      //   - live: fetch frame + image from Figma REST API via the user's
      //     PAT, with a 60-minute localStorage cache to limit re-fetches.
      let frameJson: unknown | null = null;
      let image: string | null = null;
      let figmaUrlForLog = '';
      let fileKeyForLog = '';
      let nodeIdForLog = '';

      if (sourceMode === 'fixture' && activeFixture) {
        frameJson = await loadFixture(activeFixture);
        // No screenshot for fixtures — would need to ship PNG alongside.
        // Skipped for now; the live render is the visual feedback that
        // matters during prompt tuning.
        image = null;
        figmaUrlForLog = activeFixture.sourceUrl ?? `fixture:${activeFixture.id}`;
        // Synthesize ids from the fixture id so feedback logs partition
        // cleanly between live and fixture conversions.
        fileKeyForLog = `fixture:${activeFixture.id}`;
        nodeIdForLog = (frameJson as { id?: string })?.id ?? activeFixture.id;
      } else if (sourceMode === 'live' && urlParts) {
        const cacheKey = `aaid-workbench:cache:${urlParts.fileKey}:${urlParts.nodeId}`;
        const cacheTtlMs = 60 * 60 * 1000;
        const now = Date.now();
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw) as { ts: number; frameJson: unknown; image: string | null };
            if (now - parsed.ts < cacheTtlMs) {
              frameJson = parsed.frameJson;
              image = parsed.image;
            }
          }
        } catch { /* corrupt cache — fall through to network fetch */ }

        if (frameJson === null) {
          const [fetchedFrame, fetchedImage] = await Promise.all([
            fetchFigmaNode(urlParts.fileKey, urlParts.nodeId, figmaToken),
            fetchFigmaImage(urlParts.fileKey, urlParts.nodeId, figmaToken).catch(() => null),
          ]);
          frameJson = fetchedFrame;
          image = fetchedImage;
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ ts: now, frameJson, image }));
          } catch (storeErr) {
            console.warn('Could not cache Figma frame:', storeErr);
          }
        }
        figmaUrlForLog = figmaUrl.trim();
        fileKeyForLog = urlParts.fileKey;
        nodeIdForLog = urlParts.nodeId;
      } else {
        throw new Error('No source selected — pick a fixture or paste a Figma URL.');
      }

      if (image) setImgUrl(image);

      // Debug: expose the raw Figma frame JSON so we can inspect what the API
      // returns (e.g. explicitVariableModes / boundVariables for Theme/Surface/
      // Effects modes). Open DevTools console and run: copy(__frameJson)
      if (typeof window !== 'undefined') {
        (window as unknown as { __frameJson: unknown }).__frameJson = frameJson;
      }

      // Capture the frame's native width so both panels render at the same
      // scale. Figma node JSON exposes it on absoluteBoundingBox.
      const fw = (frameJson as { absoluteBoundingBox?: { width?: number } })
        ?.absoluteBoundingBox?.width;
      setFrameWidth(typeof fw === 'number' && fw > 0 ? Math.round(fw) : null);

      const { jsx: generatedJsx, missingComponents: missing } = await convertFigmaToCode(
        frameJson,
        {},  // variables omitted — endpoint requires file_variables scope
        anthropicKey,
        brandMeta ?? undefined,
      );
      setJsx(generatedJsx);
      setMissingComponents(missing);

      // Log the attempt for the feedback loop. Includes dinoId so we can
      // later partition outputs by brand and see whether token-naming
      // accuracy varies across brands. Wrapped in its own try/catch so a
      // Firestore rule mismatch doesn't kill the visible JSX — feedback
      // logging is best-effort, not a blocker for using the workbench.
      try {
        const id = await logConversionAttempt({
          figmaUrl: figmaUrlForLog,
          fileKey: fileKeyForLog,
          nodeId: nodeIdForLog,
          dinoId: dinoId.trim() || null,
          generatedJsx,
          missingComponents: missing,
          rendered: 'pending',
          userId: user.uid,
        });
        setConversionId(id);
      } catch (logErr) {
        console.warn('Could not log conversion attempt (verdict logging disabled for this run):', logErr);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // A Figma 403 / expired-token error means the stored PAT is dead. Clear
      // it so the token input reappears (it's gated on !tokensSet) — otherwise
      // the field stays hidden behind the dead token and you'd have to clear
      // localStorage by hand. The Anthropic key is untouched.
      if (/Figma API 403|Token expired|"status":403/i.test(msg)) {
        setFigmaToken('');
        setError(msg + '  — your Figma token expired; paste a fresh one above and Convert again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerdict = async (v: 'good' | 'bad') => {
    setVerdict(v);
    if (!conversionId) return;
    try {
      await logConversionVerdict(conversionId, { userVerdict: v });
    } catch (e) { console.error('Failed to log verdict:', e); }
  };

  const handleSaveCorrection = async () => {
    if (!conversionId) return;
    try {
      await logConversionVerdict(conversionId, {
        userCorrection: correction,
        userVerdict: verdict ?? undefined,
      });
      setVerdictSaved(true);
    } catch (e) { console.error('Failed to log correction:', e); }
  };

  const copyJsx = () => navigator.clipboard.writeText(jsx);

  if (isAdmin === null) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <CircularProgress />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
        <Alert severity="error">Admin access required.</Alert>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <VStack gap="var(--Sizing-3)">
        <VStack gap="var(--Sizing-Half)">
          <H2>AAID workbench</H2>
          <BodySmall color="quiet">
            Internal tool. Paste a Figma frame URL → see what an AI agent produces
            using our current CLAUDE.md as context. The verdict + correction feed
            a Firestore log so we can tune the CLAUDE.md until output quality is
            reliably high.
          </BodySmall>
        </VStack>

        {!tokensSet && (
          <Card padding="medium">
            <VStack gap="var(--Sizing-2)">
              <H3>One-time setup</H3>
              <BodySmall>
                Stored in browser localStorage. Used only by this dev tool.
              </BodySmall>
              <TextField
                label="Figma personal access token"
                helperText="Generate at figma.com/developers/api#access-tokens — needs file_read scope."
                value={figmaToken}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFigmaToken(e.target.value)}
                type="password"
                fullWidth
              />
              <TextField
                label="Anthropic API key"
                helperText="Generate at console.anthropic.com. Workbench-only — never shipped to customers."
                value={anthropicKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAnthropicKey(e.target.value)}
                type="password"
                fullWidth
              />
            </VStack>
          </Card>
        )}

        <Card padding="medium">
          <VStack gap="var(--Sizing-1)">
            <H3>Brand context (Design ID)</H3>
            <BodySmall color="quiet">
              Optional. Paste a Design ID (UUID) to load that brand's tokens
              into the workbench. The generated code resolves universal token
              names against this brand's CSS, and brand metadata (header font,
              component style) is passed to the prompt so the AAID can make
              brand-aware suggestions. Leaving this blank converts against
              the default-theme tokens only.
            </BodySmall>
            <TextField
              label="Design ID"
              placeholder="e.g. 618ab9a8-879e-44fa-8432-4000a2eb66f5"
              value={dinoId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDinoId(e.target.value)}
              fullWidth
            />
            {brandLoading && <Caption color="quiet">Loading brand…</Caption>}
            {brandError && <Caption color="error">{brandError}</Caption>}
            {brandMeta && !brandLoading && !brandError && (
              <HStack gap="var(--Sizing-Half)" style={{ flexWrap: 'wrap' }}>
                {brandMeta.designSystemName && (
                  <Chip label={brandMeta.designSystemName} size="small" />
                )}
                {brandMeta.headerFontFamily && (
                  <Chip label={`Header: ${brandMeta.headerFontFamily}`} size="small" />
                )}
                {brandMeta.componentStyle && (
                  <Chip label={`Style: ${brandMeta.componentStyle}`} size="small" />
                )}
              </HStack>
            )}
          </VStack>
        </Card>

        <Card padding="medium">
          <VStack gap="var(--Sizing-2)">
            <HStack gap="var(--Sizing-1)" alignItems="center">
              <Caption color="quiet">Source:</Caption>
              <ButtonGroup
                value={sourceMode}
                onChange={(v: 'live' | 'fixture') => setSourceMode(v)}
                size="small"
              >
                <Button value="fixture" size="small">Fixture</Button>
                <Button value="live" size="small">Live URL (PAT)</Button>
              </ButtonGroup>
              {sourceMode === 'fixture' && (
                <Caption color="quiet">
                  · zero Figma calls, durable across sessions
                </Caption>
              )}
              {sourceMode === 'live' && (
                <Caption color="quiet">
                  · counts against your PAT's rate limit (~30/min)
                </Caption>
              )}
            </HStack>

            {sourceMode === 'fixture' && (
              <HStack gap="var(--Sizing-1)" alignItems="flex-end">
                <div style={{ flex: 1 }}>
                  <Caption color="quiet">Fixture</Caption>
                  <select
                    value={fixtureId}
                    onChange={(e) => setFixtureId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--Border)',
                      background: 'var(--Background)',
                      color: 'var(--Text)',
                      fontFamily: 'inherit',
                      fontSize: 14,
                    }}
                  >
                    {FIXTURES.map(f => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="primary"
                  onClick={handleConvert}
                  disabled={!canConvert || busy}
                >
                  {busy ? 'Converting…' : 'Convert'}
                </Button>
              </HStack>
            )}

            {sourceMode === 'live' && (
              <>
                <HStack gap="var(--Sizing-1)" alignItems="flex-end">
                  <TextField
                    label="Figma frame URL"
                    placeholder="https://www.figma.com/design/.../?node-id=123-456"
                    value={figmaUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFigmaUrl(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="primary"
                    onClick={handleConvert}
                    disabled={!canConvert || busy}
                  >
                    {busy ? 'Converting…' : 'Convert'}
                  </Button>
                </HStack>
                {figmaUrl && !urlParts && (
                  <Caption color="error">Could not parse URL — expected format /design/&lt;fileKey&gt;?node-id=&lt;id&gt;.</Caption>
                )}
              </>
            )}

            {sourceMode === 'fixture' && activeFixture?.note && (
              <Caption color="quiet">{activeFixture.note}</Caption>
            )}
            {sourceMode === 'fixture' && activeFixture?.sourceUrl && (
              <Caption color="quiet">
                Source: <Link href={activeFixture.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {activeFixture.sourceUrl}
                </Link>
              </Caption>
            )}
          </VStack>
        </Card>

        {error && <Alert severity="error">{error}</Alert>}

        {(imgUrl || jsx) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--Sizing-3)' }}>
            {/* Left: original Figma frame */}
            <Card padding="medium">
              <VStack gap="var(--Sizing-1)">
                <HStack gap="var(--Sizing-1)" justifyContent="space-between" alignItems="center" style={{ width: '100%' }}>
                  <H3>Original (Figma)</H3>
                  {figmaUrl.trim() && (
                    <Link
                      href={figmaUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open in Figma ↗
                    </Link>
                  )}
                </HStack>
                {imgUrl ? (
                  // Container is sized to the frame's true width (368). The PNG
                  // includes the frame's drop-shadow bleed, so the image is a bit
                  // wider (×1.12) to land the CONTENT at the frame width; overflow
                  // is visible so the shadow spills out instead of being clipped
                  // or widening the box. Layout width stays = the frame width.
                  <div
                    style={{
                      width: frameWidth ? `${frameWidth}px` : '100%',
                      maxWidth: '100%',
                      overflow: 'visible',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt="Figma frame"
                      style={{
                        width: frameWidth ? `${Math.round(frameWidth * 1.12)}px` : 'auto',
                        height: 'auto',
                        flexShrink: 0,
                        borderRadius: 8,
                        background: 'var(--Container)',
                      }}
                    />
                  </div>
                ) : (
                  <Body color="quiet">No screenshot available.</Body>
                )}
              </VStack>
            </Card>

            {/* Right: generated code OR live preview, switchable */}
            <Card padding="medium">
              <VStack gap="var(--Sizing-1)">
                <HStack gap="var(--Sizing-1)" justifyContent="space-between" alignItems="center" style={{ width: '100%' }}>
                  <H3>{rightView === 'code' ? 'Generated JSX' : 'Live preview'}</H3>
                  <HStack gap="var(--Sizing-1)">
                    <ButtonGroup
                      value={rightView}
                      onChange={(v: 'code' | 'preview') => setRightView(v)}
                      size="small"
                    >
                      <Button value="code" size="small">Code</Button>
                      <Button value="preview" size="small">Preview</Button>
                    </ButtonGroup>
                    {jsx && rightView === 'code' && (
                      <Button size="small" variant="primary-outline" onClick={copyJsx}>Copy</Button>
                    )}
                  </HStack>
                </HStack>

                {rightView === 'code' && (
                  <pre style={{
                    background: 'var(--Container)',
                    padding: 12,
                    borderRadius: 8,
                    fontSize: 12,
                    lineHeight: 1.5,
                    maxHeight: 600,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                  }}>
                    <code>{jsx || (busy ? 'Generating…' : '(awaiting conversion)')}</code>
                  </pre>
                )}

                {rightView === 'preview' && (
                  <LivePreviewPanel jsx={jsx} busy={busy} frameWidth={frameWidth} />
                )}

                {missingComponents.length > 0 && (
                  <VStack gap="var(--Sizing-Half)">
                    <Caption color="quiet">Lib gaps flagged in output:</Caption>
                    <HStack gap="var(--Sizing-Half)" style={{ flexWrap: 'wrap' }}>
                      {missingComponents.map(name => (
                        <Chip key={name} label={name} size="small" />
                      ))}
                    </HStack>
                  </VStack>
                )}
              </VStack>
            </Card>
          </div>
        )}

        {jsx && conversionId && (
          <Card padding="medium">
            <VStack gap="var(--Sizing-2)">
              <H3>Was this output usable?</H3>
              <HStack gap="var(--Sizing-1)">
                <Button
                  variant={verdict === 'good' ? 'success' : 'success-outline'}
                  onClick={() => handleVerdict('good')}
                >
                  👍 Good
                </Button>
                <Button
                  variant={verdict === 'bad' ? 'error' : 'error-outline'}
                  onClick={() => handleVerdict('bad')}
                >
                  👎 Needs work
                </Button>
              </HStack>
              <TextArea
                label="What was wrong / what would you have written instead?"
                value={correction}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCorrection(e.target.value)}
                rows={6}
                fullWidth
                placeholder="Wrong component? Missing token? Misnamed prop? Inline color slipped through? Be specific — this teaches the CLAUDE.md what to avoid."
              />
              <HStack gap="var(--Sizing-1)" alignItems="center">
                <Button variant="primary" onClick={handleSaveCorrection} disabled={!correction.trim() && !verdict}>
                  Save feedback
                </Button>
                {verdictSaved && <Caption color="success">Saved.</Caption>}
              </HStack>
            </VStack>
          </Card>
        )}
      </VStack>
    </div>
  );
}

/** Live-renders the generated JSX using react-live + the studio's installed
 *  lib components. The right card's toggle decides whether this or the code
 *  pre is shown. Transformation (strip imports, find default export,
 *  append render(...)) lives in prepareLiveCode. Any reference to a
 *  MISSING-LIB-COMPONENT name will throw at render time — caught by
 *  LiveError and displayed inline. */
function LivePreviewPanel({ jsx, busy, frameWidth }: { jsx: string; busy: boolean; frameWidth: number | null }) {
  const prepared = useMemo(() => prepareLiveCode(jsx), [jsx]);

  // Scope provides every identifier the generated code could reference.
  // React must be in scope so JSX compiled by sucrase has access to it.
  // Spread the whole lib so any component the AAID emitted is available
  // without us having to enumerate. `useState` / `useEffect` etc. are
  // surfaced from React for completeness.
  const scope = useMemo(() => ({
    React,
    useState: React.useState,
    useEffect: React.useEffect,
    useRef: React.useRef,
    useMemo: React.useMemo,
    useCallback: React.useCallback,
    ...DynoComponents,
  }), []);

  if (busy) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <CircularProgress />
      </div>
    );
  }
  if (!jsx) {
    return (
      <div style={{ padding: 24 }}>
        <BodySmall color="quiet">(awaiting conversion)</BodySmall>
      </div>
    );
  }
  if (prepared.error) {
    return <Alert severity="warning">{prepared.error}</Alert>;
  }

  return (
    <>
      <CustomLivePreview
        code={prepared.code}
        scope={scope}
        style={{
          // No padding/background of our own — the converted design paints and
          // sizes itself, so the preview renders the frame flush (no workbench
          // chrome adding padding around it). Width tracks the Figma frame for
          // a 1:1 scale comparison.
          minHeight: 200,
          width: frameWidth ? `${frameWidth}px` : 'auto',
          maxWidth: '100%',
        }}
      />
      {/* Collapsed transformed-code panel for debugging. */}
      <details style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--Quiet)' }}>
          Transformed code (what the preview is parsing)
        </summary>
        <pre style={{
          background: 'var(--Container)',
          padding: 12,
          borderRadius: 8,
          fontSize: 11,
          lineHeight: 1.5,
          maxHeight: 300,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          marginTop: 6,
        }}>
          <code>{prepared.code}</code>
        </pre>
      </details>
    </>
  );
}
