import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { DynoDesignProvider } from '@dynodesign/components';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import RenameDesignModal from './components/RenameDesignModal';
import PricingPage, { type PurchaseSelection } from './components/PricingPage';
import CheckoutSuccess from './components/CheckoutSuccess';
import { redirectToCheckout } from './utils/stripe/checkout';
import { auth, db } from './utils/firebase/client';
import { getPublicFileUrl } from './utils/firebase/storage';
import { isDesignNameTaken } from './utils/designSystemNames';
import type { Stage, ColorScheme, UserSelections, TypographyStyle, ComponentStyle, SurfaceStyle } from './types';
import type { TypographyMeta, TypographyUploads } from './components/TypographyTestPage';
import { STAGE_ORDER } from './types';
import {
  generateSemanticLightModeScale,
  generateSemanticDarkModeScale,
  getLightness,
  toneToColorNumber,
} from './utils/colorScale';
import { assessImageStyle } from './utils/imageAnalysis';
import { autoAssignColors } from './utils/autoAssignColors';
import { suggestComponentStyle } from './utils/autoSuggestStyle';
import { buildPreviewCSS } from './utils/buildPreviewCSS';

import AppHeader from './components/AppHeader';
import { CreationTopBar, CreationBottomBar } from './components/CreationNav';
import DesignSystemNameStage from './components/stages/DesignSystemNameStage';
import UploadStage from './components/stages/UploadStage';
import ColorStage from './components/stages/ColorStage';
import ColorAssignmentStage from './components/stages/ColorAssignmentStage';
import TypographyStageV2 from './components/stages/TypographyStageV2';
import ComponentStyleStage from './components/stages/ComponentStyleStage';
import ReviewStage from './components/stages/ReviewStage';
import ExportStage from './components/stages/ExportStage';
import Playground from './components/Playground';
import GeneratedPreview from './components/GeneratedPreview';
import { ApiTokensJson, ApiTokensMd } from './components/ApiTokens';
import ToneTuner from './components/ToneTuner';
import AccountPage from './components/AccountPage';
import LandingPage from './components/LandingPage';
import AddOnCatalogPage from './components/AddOnCatalogPage';
import AccessibilityReport from './components/AccessibilityReport';
import DesignSystemDetail from './components/DesignSystemDetail';
import MyDesignsPage from './components/MyDesignsPage';
import AdminProposals from './components/AdminProposals';
import TypographyTestPage from './components/TypographyTestPage';
import AaidWorkbenchPage from './components/AaidWorkbenchPage';

// Internal test accounts — these skip the pricing/Stripe checkout and go
// straight to the export/delivery page so we can exercise the full design-
// system flow (view hosted system, copy Dino ID, Figma import) without paying.
// Everyone else still hits the pricing gate. Scope stays to these two emails
// on purpose — this is NOT a global bypass.
const TEST_EMAILS = new Set([
  'lise.w.noble@gmail.com',
  'skyler.h.noble@gmail.com',
]);
const canBypassCheckout = (u: User | null): boolean =>
  !!u?.email && TEST_EMAILS.has(u.email.toLowerCase());

function MainApp() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // True while the URL has `?id=...` but we haven't loaded the snapshot yet.
  // Hides the default 'name' stage from briefly flashing before rehydration
  // completes — important on the post-Stripe full reload, when Firebase Auth
  // takes a beat to restore the session before the Firestore read can fire.
  const [rehydrating, setRehydrating] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return !!params.get('id');
  });

  const [stage, setStage] = useState<Stage>('name');
  const [designSystemName, setDesignSystemName] = useState('');
  const [, setDateCreated] = useState('');
  const [moodBoardUrl, setMoodBoardUrl] = useState<string | null>(null);
  const [moodBoardFile, setMoodBoardFile] = useState<File | null>(null);
  // Public Storage URL for the moodboard — populated asynchronously by
  // UploadStage once the file finishes uploading in the background.
  // Distinct from moodBoardUrl (which holds the local blob: preview URL).
  // TypographyStageV2 uses this so it doesn't have to re-upload itself.
  const [moodBoardPublicUrl, setMoodBoardPublicUrl] = useState<string | null>(null);
  const [selectedColorScheme, setSelectedColorScheme] = useState<ColorScheme | null>(null);
  const [userSelections, setUserSelections] = useState<UserSelections>({
    defaultTheme: 'light',
    background: 'white',
    backgroundTheme: 'Neutral',
    backgroundN: 12,
    appBar: 'primary-light',
    navBar: 'primary-light',
    status: 'primary-light',
    button: 'primary',
    cardColoring: 'tonal',
    textColoring: 'tonal',
    decorativeMode: 'surface-components',
  });
  const [typographyStyles, setTypographyStyles] = useState<TypographyStyle[]>([]);
  // Sidecar meta for the typography stage — trio index, body family mode,
  // customize-modal categories. Persisted alongside typographyStyles so the
  // matcher's full UI state rehydrates on re-entry (not just family/weight/
  // spacing). See TypographyMeta in TypographyTestPage.
  const [typographyMeta, setTypographyMeta] = useState<TypographyMeta | undefined>(undefined);
  // Custom font uploads per role. Each record carries the synthetic family
  // name + the Firebase Storage path so the matcher can re-fetch + re-
  // register the FontFace on page reload / stage re-entry.
  const [typographyUploads, setTypographyUploads] = useState<TypographyUploads | undefined>(undefined);
  const [componentStyle, setComponentStyle] = useState<ComponentStyle>('modern');
  const [dinoId, setDinoId] = useState<string | null>(null);
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>('light-tonal');
  const [autoAssigned, setAutoAssigned] = useState(false);
  const [savedSchemes, setSavedSchemes] = useState<ColorScheme[]>([]);
  const [savedTopColors, setSavedTopColors] = useState<any[]>([]);
  // Per-color customisations the user made in ColorStage that the palette
  // generator can't recreate from extracted hexes alone: chroma slider
  // positions per Core Color, and any hexes the user explicitly locked.
  // These get persisted into the design system's snapshot on export.
  const [savedColorEdits, setSavedColorEdits] = useState<{
    chromaPerColor?: number[];
    darkChromaPerColor?: number[];
    lockedColorMap?: Record<number, string>;
  }>({});
  const [savedFontSamples, setSavedFontSamples] = useState<any[]>([]);
  const [savedSelectedSample, setSavedSelectedSample] = useState<number | null>(null);
  // The Typography Settings sidebar (font category / weight / letter-spacing /
  // all-caps) — persists across stage navigation so customizations survive
  // when the user clicks back into the Typography stage.
  const [savedTypographySettings, setSavedTypographySettings] = useState<TypographyStyle[] | null>(null);
  const [savedStyleCustomizations, setSavedStyleCustomizations] = useState<any>({
    modern: { radius: 8, buttonRadius: 4, bevel: 0, bevelOpacity: 50, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 100 },
  });
  const [pendingReExport, setPendingReExport] = useState(false);
  const [originalSnapshot, setOriginalSnapshot] = useState<any>(null);

  // Rehydrate from /create?id=<uuid>: load the snapshot we stored at the
  // last export and jump the user straight to the review stage so they can
  // make tweaks and re-export to the same UUID. Bumps version on re-export.
  //
  // Depends on `user` so we re-run once Firebase Auth restores the session.
  // Without this, a full page load (e.g., the post-Stripe redirect) would
  // run the effect while `user` is still null and Firestore's
  // `isOwner(resource.data.userId)` rule rejects the read.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    if (!editId) return;
    if (!user) return; // wait until auth state hydrates
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'designSystems', editId));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const s = data.snapshot;
        if (!s) {
          console.warn('Design system has no rehydration snapshot — likely created before edit support; cannot edit.');
          return;
        }
        if (cancelled) return;
        if (s.designSystemName) setDesignSystemName(s.designSystemName);
        if (s.colorScheme) setSelectedColorScheme(s.colorScheme);
        if (s.userSelections) setUserSelections(s.userSelections);
        if (Array.isArray(s.typographyStyles)) setTypographyStyles(s.typographyStyles);
        // Sidecar meta + uploads — restore so the matcher UI rehydrates
        // its trio pick, body family mode, customize-modal categories,
        // and custom font registrations on edit / Stripe re-entry.
        if (s.typographyMeta) setTypographyMeta(s.typographyMeta);
        if (s.typographyUploads) setTypographyUploads(s.typographyUploads);
        if (s.componentStyle) setComponentStyle(s.componentStyle);
        if (s.surfaceStyle) setSurfaceStyle(s.surfaceStyle);
        // Restore the Core Colors swatches from the snapshot so editing
        // shows the same 6 colors the user originally extracted.
        if (Array.isArray(s.topColors) && s.topColors.length) {
          setSavedTopColors(s.topColors);
        }
        // Restore per-color edits (chroma sliders, hex locks). Hex edits to
        // the swatches themselves live in s.topColors above.
        if (s.colorEdits && typeof s.colorEdits === 'object') {
          setSavedColorEdits(s.colorEdits);
        }
        // Restore the Typography sidebar settings (style category / weight /
        // spacing / caps per role). The chosen Google Font trio is in
        // s.typographyStyles above; this controls the left panel + alt deck.
        if (Array.isArray(s.typographySettings) && s.typographySettings.length === 3) {
          setSavedTypographySettings(s.typographySettings);
        }
        if (s.styleCustomizations) {
          setSavedStyleCustomizations((prev: any) => ({
            ...prev,
            [s.componentStyle || 'modern']: s.styleCustomizations,
          }));
        }
        // Always use the deterministic Storage URL on rehydration. Older
        // design systems persisted a transient blob URL into the snapshot;
        // the file itself is always at design-systems/{id}/moodboard.png.
        setMoodBoardUrl(getPublicFileUrl(editId, 'moodboard.png'));
        setDinoId(editId);
        setOriginalSnapshot(s);
        setAutoAssigned(true); // skip auto-assign overrides
        // ?stage=<name> resumes at a specific stage — used by the post-Stripe
        // success redirect to drop the user straight into Export instead of
        // back into the Color editing flow. Default behavior (no `stage` in
        // URL) is the existing re-edit jump to 'color'.
        const requestedStage = params.get('stage') as Stage | null;
        if (requestedStage && STAGE_ORDER.includes(requestedStage)) {
          setStage(requestedStage);
        } else {
          // Land on the Color stage's Theme sub-step so the user can pick a
          // different theme variant. ColorStage starts on 'theme' whenever
          // `selectedScheme` is set, and `pendingReExport` blocks it from
          // re-running color extraction on the mood board.
          setStage('color');
        }
        setPendingReExport(true);
      } catch (err) {
        console.error('Failed to rehydrate design system:', err);
      } finally {
        if (!cancelled) setRehydrating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Where a signed-in user goes once their design name is confirmed unique:
  // straight to the export/delivery page for the internal test accounts,
  // otherwise the pricing gate.
  const routePastName = useCallback((u: User | null) => {
    if (canBypassCheckout(u)) {
      setStage('export');
      window.scrollTo(0, 0);
    } else {
      setShowPricingModal(true);
    }
  }, []);

  // Runs the moment a user is confirmed signed-in on the review→export path
  // (either just authenticated in the modal, or already signed in when they
  // hit Continue). Two jobs: (1) catch a name collision that only surfaces now
  // — an anonymous user may have named their design the same as one they
  // already own, so re-check against THEIR uid and open the rename modal (which
  // keeps all their work — only the name changes) before we create a duplicate;
  // (2) otherwise route past checkout for the test accounts / to pricing.
  const proceedAfterAuth = useCallback(async (u: User | null) => {
    if (!u) return;
    try {
      const taken = await isDesignNameTaken(u.uid, designSystemName, dinoId || undefined);
      if (taken) {
        setShowRenameModal(true);
        return;
      }
    } catch {
      // Non-fatal — let the export-stage backstop / Firestore enforce uniqueness.
    }
    routePastName(u);
  }, [designSystemName, dinoId, routePastName]);

  const goNext = useCallback(() => {
    // Block leaving the upload stage without a mood board
    if (stage === 'upload' && !moodBoardUrl) {
      return;
    }
    // Gate: require auth before entering the export stage, then show pricing
    if (stage === 'review') {
      if (!user) {
        setShowAuthModal(true);
        return;
      }
      // Edit flow: user already paid for this design system. Skip the pricing
      // gate and reprocess straight to the export stage so tokens get
      // republished with the new selections.
      if (pendingReExport) {
        setStage('export');
        window.scrollTo(0, 0);
        return;
      }
      // Already logged in — re-check for a name collision, then route to
      // pricing (or straight to export for the internal test accounts).
      void proceedAfterAuth(user);
      return;
    }
    if (customNextRef.current) {
      customNextRef.current();
      return;
    }
    const currentIndex = STAGE_ORDER.indexOf(stage);
    if (currentIndex < STAGE_ORDER.length - 1) {
      const nextStage = STAGE_ORDER[currentIndex + 1];

      // Auto-assign color selections when entering color-assignment for the first time
      // Auto-assign color selections when entering color-assignment for the first time
      if (nextStage === 'color-assignment' && !autoAssigned && selectedColorScheme) {
        const defaults = autoAssignColors(surfaceStyle, selectedColorScheme);
        setUserSelections(defaults);
        setAutoAssigned(true);
      }

      // Auto-suggest component style based on mood when entering component-style
      if (nextStage === 'component-style' && selectedColorScheme) {
        const suggested = suggestComponentStyle(selectedColorScheme.colors[0]);
        setComponentStyle(suggested);
      }

      setStage(nextStage);
      window.scrollTo(0, 0);
    }
  }, [stage, autoAssigned, selectedColorScheme, surfaceStyle, moodBoardUrl, user, pendingReExport, proceedAfterAuth]);

  const customBackRef = useRef<(() => void) | null>(null);
  const customNextRef = useRef<(() => void) | null>(null);
  const [customNextLabel, setCustomNextLabel] = useState<string | null>(null);

  // Stripe Checkout sends the browser fully off-site, so all in-flight React
  // state is lost on return. Before the redirect we mint a dsId (if we don't
  // already have one), snapshot the build, and write
  // `designSystems/{dsId}` with `status: 'pending_payment'`. The success
  // page reads dsId from the return URL and bounces us to
  // `/create?id=<dsId>&stage=export`, where the existing rehydration
  // effect loads the snapshot back.
  const saveDraftBeforeCheckout = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    const id = dinoId || crypto.randomUUID();
    const snapshot = {
      designSystemName,
      colorScheme: selectedColorScheme,
      userSelections,
      typographyStyles,
      // Sidecars so the matcher's full UI state rehydrates post-Stripe.
      typographyMeta: typographyMeta || null,
      typographyUploads: typographyUploads || null,
      componentStyle,
      styleCustomizations: savedStyleCustomizations?.[componentStyle] || null,
      surfaceStyle,
      moodBoardUrl: moodBoardUrl || getPublicFileUrl(id, 'moodboard.png'),
      topColors: savedTopColors || null,
      colorEdits: savedColorEdits || null,
      typographySettings: savedTypographySettings || null,
    };
    try {
      await setDoc(
        doc(db, 'designSystems', id),
        {
          userId: user.uid,
          name: designSystemName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'pending_payment',
          componentStyle,
          snapshot,
        },
        { merge: true },
      );
      if (!dinoId) setDinoId(id);
      return id;
    } catch (err) {
      console.error('Failed to save draft before checkout:', err);
      return null;
    }
  }, [
    user,
    dinoId,
    designSystemName,
    selectedColorScheme,
    userSelections,
    typographyStyles,
    typographyMeta,
    typographyUploads,
    componentStyle,
    savedStyleCustomizations,
    surfaceStyle,
    moodBoardUrl,
    savedTopColors,
    savedColorEdits,
    savedTypographySettings,
  ]);

  const goBack = useCallback(() => {
    // If the pricing modal is open, Back just closes it (returns to the stage
    // beneath) instead of navigating stages.
    if (showPricingModal) {
      setShowPricingModal(false);
      window.scrollTo(0, 0);
      return;
    }
    if (customBackRef.current) {
      customBackRef.current();
      return;
    }
    // Edit flow: stages before color (upload, name) would let the
    // user re-extract or rename, breaking the re-export contract. From the
    // landing stage (color), Back returns to the design system detail page
    // instead of stepping into earlier flow.
    if (pendingReExport && stage === 'color' && dinoId) {
      window.location.href = `/my-designs/${dinoId}`;
      return;
    }
    const currentIndex = STAGE_ORDER.indexOf(stage);
    if (currentIndex > 0) {
      setStage(STAGE_ORDER[currentIndex - 1]);
      window.scrollTo(0, 0);
    }
  }, [stage, showPricingModal, pendingReExport, dinoId]);

  const handleNameSubmit = (name: string, date: string) => {
    setDesignSystemName(name);
    setDateCreated(date);
  };

  const renderStage = () => {
    switch (stage) {
      case 'name':
        return (
          <DesignSystemNameStage
            onNext={goNext}
            onBack={goBack}
            onSubmit={handleNameSubmit}
          />
        );
      case 'upload':
        return (
          <UploadStage
            onNext={goNext}
            onBack={goBack}
            onImageUploaded={(url, file) => {
              setMoodBoardUrl(url);
              setMoodBoardFile(file);
              // New upload = stale public URL; clear it so v2 doesn't try
              // to analyze the previous moodboard.
              setMoodBoardPublicUrl(null);
              // Clear old color data so ColorStage re-extracts
              setSavedSchemes([]);
              setSavedTopColors([]);
              setSelectedColorScheme(null);
              setAutoAssigned(false);
              // Detect surface style from the mood board
              assessImageStyle(url).then(style => {
                setSurfaceStyle(style);
              });
            }}
            onMoodboardPublicUrlReady={(publicUrl) => {
              setMoodBoardPublicUrl(publicUrl);
            }}
            onGenerate={(_mode) => {
              goNext();
            }}
          />
        );
      case 'color':
        return (
          <ColorStage
            onNext={goNext}
            onBack={goBack}
            moodBoardUrl={moodBoardUrl}
            selectedScheme={selectedColorScheme}
            onSchemeSelected={setSelectedColorScheme}
            savedSchemes={savedSchemes}
            onSchemesGenerated={setSavedSchemes}
            savedTopColors={savedTopColors}
            onTopColorsExtracted={setSavedTopColors}
            savedColorEdits={savedColorEdits}
            onColorEditsChange={setSavedColorEdits}
            onCustomBackChange={(handler) => { customBackRef.current = handler; }}
            onCustomNextChange={(handler) => { customNextRef.current = handler; }}
            onNextLabelChange={setCustomNextLabel}
            editMode={pendingReExport}
          />
        );
      case 'color-assignment':
        return (
          <ColorAssignmentStage
            onNext={goNext}
            onBack={goBack}
            colorScheme={selectedColorScheme}
            userSelections={userSelections}
            onSelectionsChanged={setUserSelections}
            moodBoardUrl={moodBoardUrl}
            designSystemName={designSystemName}
            onColorsReordered={(newColors) => {
              if (!selectedColorScheme) return;
              setSelectedColorScheme({
                ...selectedColorScheme,
                colors: newColors,
                extractedTones: {
                  primary: getLightness(newColors[0]),
                  secondary: getLightness(newColors[1]),
                  tertiary: getLightness(newColors[2]),
                },
                tonePalettes: {
                  primary: generateSemanticLightModeScale(newColors[0]),
                  secondary: generateSemanticLightModeScale(newColors[1]),
                  tertiary: generateSemanticLightModeScale(newColors[2]),
                },
                darkModeTonePalettes: {
                  primary: generateSemanticDarkModeScale(newColors[0]),
                  secondary: generateSemanticDarkModeScale(newColors[1]),
                  tertiary: generateSemanticDarkModeScale(newColors[2]),
                },
              });
            }}
          />
        );
      case 'typography':
        return (
          <TypographyStageV2
            onNext={goNext}
            onBack={goBack}
            colorScheme={selectedColorScheme}
            // Prefer the public Storage URL prepped during upload — the
            // analysis for it has been running in the background since
            // the user picked their moodboard. Fall back to the blob URL
            // only when V2 mounts before that finishes (rare).
            moodBoardUrl={moodBoardPublicUrl ?? moodBoardUrl}
            moodBoardFile={moodBoardFile}
            designSystemName={designSystemName}
            onTypographyComplete={setTypographyStyles}
            initialTypography={typographyStyles}
            initialTypographyMeta={typographyMeta}
            onTypographyMetaChange={setTypographyMeta}
            initialTypographyUploads={typographyUploads}
            onTypographyUploadsChange={setTypographyUploads}
            decorativeMode={userSelections.decorativeMode}
            onDecorativeModeChange={(mode) => setUserSelections({ ...userSelections, decorativeMode: mode })}
          />
        );
      case 'component-style':
        return (
          <ComponentStyleStage
            onNext={goNext}
            onBack={goBack}
            colorScheme={selectedColorScheme}
            onStyleSelected={(style, customs) => {
              setComponentStyle(style);
              setSavedStyleCustomizations((prev: any) => ({ ...(prev || {}), [style]: customs }));
            }}
            selectedStyle={componentStyle}
            savedCustomizations={savedStyleCustomizations}
            userSelections={userSelections}
            typographyStyles={typographyStyles}
          />
        );
      case 'review':
        return (
          <ReviewStage
            onNext={goNext}
            onBack={goBack}
            designSystemName={designSystemName}
            colorScheme={selectedColorScheme}
            userSelections={userSelections}
            typographyStyles={typographyStyles}
            componentStyle={componentStyle}
            moodBoardUrl={moodBoardUrl}
            pendingReExport={pendingReExport}
            originalSnapshot={originalSnapshot}
          />
        );
      case 'export':
        return (
          <ExportStage
            onNext={goNext}
            onBack={goBack}
            designSystemName={designSystemName}
            colorScheme={selectedColorScheme}
            userSelections={userSelections}
            typographyStyles={typographyStyles}
            componentStyle={componentStyle}
            dinoId={dinoId}
            onDinoIdGenerated={setDinoId}
            moodBoardUrl={moodBoardUrl}
            moodBoardFile={moodBoardFile}
            surfaceStyle={surfaceStyle}
            styleCustomizations={savedStyleCustomizations?.[componentStyle]}
            topColors={savedTopColors}
            colorEdits={savedColorEdits}
            typographySettings={savedTypographySettings}
            pendingReExport={pendingReExport}
            onReExportComplete={() => {
              setPendingReExport(false);
              if (dinoId) {
                window.location.href = `/my-designs/${dinoId}?reprocessed=1`;
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  const isExport = stage === 'export';
  const showTopBar = designSystemName && stage !== 'name' && !isExport;
  const showBottomBar = !isExport && stage !== 'name'; // export/name have own nav
  const isFirstStage = stage === 'name';

  // Bottom bar label
  const nextLabel = customNextLabel || (stage === 'review' ? (pendingReExport ? 'Reprocess Design System' : 'Get Your Design System') : 'Continue');

  // Bottom bar disabled state — block stage progression when prerequisites aren't met
  const canProceed = (() => {
    if (stage === 'upload') return !!moodBoardUrl;
    return true;
  })();

  // Component style radii — from saved customizations or defaults
  const cardRadius = savedStyleCustomizations?.[componentStyle]?.radius ?? { professional: 4, modern: 8, bold: 16, playful: 24 }[componentStyle];
  const buttonRadius = savedStyleCustomizations?.[componentStyle]?.buttonRadius ?? { professional: 6, modern: 12, bold: 25, playful: 100 }[componentStyle];

  // Apply brand tokens after color-assignment stage. When the user is
  // editing an existing design system (pendingReExport === true), the
  // colors/typography/component style are already known and rehydrated
  // from Firestore at mount, so the brand chrome can show from the very
  // first stage instead of switching on mid-flow.
  const applyBrand = pendingReExport
    || ['color-assignment', 'typography', 'component-style', 'review', 'export'].includes(stage);

  // Build full brand CSS from the same logic as the phone preview
  // Post-process to add !important so it overrides DynoDesignProvider's theme
  const brandCSS = useMemo(() => {
    if (!applyBrand || !selectedColorScheme) return '';
    console.log('🎨 [brandCSS] Regenerating. Background:', userSelections.background, 'AppBar:', userSelections.appBar, 'NavBar:', userSelections.navBar);
    try {
      const css = buildPreviewCSS({
        colorScheme: selectedColorScheme,
        userSelections,
        componentStyle,
        mode: 'light',
        typographyStyles,
      });
      // No !important needed — Brand theme selectors don't conflict with provider
      return css;
    } catch {
      return '';
    }
  }, [applyBrand, selectedColorScheme, userSelections, componentStyle, typographyStyles]);
  // Typography font families for inline style injection
  const headerFont = typographyStyles.find(t => t.type === 'header');
  const decorativeFont = typographyStyles.find(t => t.type === 'decorative');
  const bodyFont = typographyStyles.find(t => t.type === 'body');

  const bevel = savedStyleCustomizations?.[componentStyle]?.bevel ?? 0;
  const bevelOpacity = savedStyleCustomizations?.[componentStyle]?.bevelOpacity ?? 50;
  const buttonHeight = savedStyleCustomizations?.[componentStyle]?.buttonHeight ?? 32;
  const smallButtonHeight = savedStyleCustomizations?.[componentStyle]?.smallButtonHeight ?? 24;
  const largeButtonHeight = savedStyleCustomizations?.[componentStyle]?.largeButtonHeight ?? 56;
  const minButtonWidth = savedStyleCustomizations?.[componentStyle]?.minButtonWidth ?? 60;
  const iconButtonRadius = savedStyleCustomizations?.[componentStyle]?.iconButtonRadius ?? buttonRadius;

  const bevelPx = Math.round(buttonHeight * bevel / 100);

  // buttonRadius / iconButtonRadius are PERCENTS (0–100) of the button height.
  // Convert to px (capped at the large button height, mirroring computeRadii /
  // buildPreviewCSS) so studio chrome — e.g. the bottom-nav Continue button —
  // matches the preview. These were previously emitted as `${percent}px`, which
  // made every chrome button far more rounded than the design's actual radius.
  const buttonRadiusPx = Math.min(Math.round(buttonHeight * buttonRadius / 100), largeButtonHeight);
  const iconButtonRadiusPx = Math.min(Math.round(buttonHeight * iconButtonRadius / 100), largeButtonHeight);

  const styleVars = {
    '--Style-Border-Radius': `${buttonRadiusPx}px`,
    '--Button-Radius': `${buttonRadiusPx}px`,
    '--Button-Icon-Radius': `${iconButtonRadiusPx}px`,
    '--Button-Bevel': `${bevel}`,
    '--Button-Bevel-Opacity': `${bevelOpacity / 100}`,
    '--Button-Bevel-Px': `${bevelPx}px`,
    '--Button-Height': `${buttonHeight}px`,
    '--Small-Button-Height': `${smallButtonHeight}px`,
    '--Large-Button-Height': `${largeButtonHeight}px`,
    '--Button-Min-Width': `${minButtonWidth}px`,
    '--Card-Radius': `${cardRadius}px`,
    '--Card-Padding': `${cardRadius >= 16 ? 20 : 16}px`,
    ...(applyBrand && headerFont ? (() => {
      const headerTT = headerFont.allCaps ? 'uppercase' : 'none';
      const headerLS = headerFont.letterSpacing || '0em';
      // The lib's H1–H6 and Display components read per-size tokens
      // (`--H1-Text-Transform`, `--Display-Large-Text-Transform`, etc.) —
      // NOT the aggregate `--Header-Text-Transform`. Emit one variable
      // per heading size so the all-caps choice actually reaches the
      // rendered headers. Letter-spacing has the same shape but the
      // existing aggregates already work because the lib treats them as
      // fallbacks. We still emit per-size letter-spacing for symmetry.
      const headerSizes = ['Display-Large', 'Display-Small', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
      const perSize: Record<string, string> = {};
      for (const s of headerSizes) {
        perSize[`--${s}-Text-Transform`] = headerTT;
        perSize[`--${s}-Letter-Spacing`] = headerLS;
      }
      return {
        '--Header-Font-Family': `'${headerFont.family}', serif`,
        '--Font-Family-Header': `'${headerFont.family}', serif`,
        '--Set-Font-Family-Header': `'${headerFont.family}', serif`,
        '--Set-Font-Family-Header-Weight': headerFont.weight,
        '--Set-Header-Letter-Spacing': headerLS,
        '--Set-Header-Text-Transform': headerTT,
        '--Header-Text-Transform': headerTT,
        '--Header-Letter-Spacing': headerLS,
        ...perSize,
      };
    })() : {}),
    ...(applyBrand && decorativeFont ? (() => {
      const decoTT = decorativeFont.allCaps ? 'uppercase' : 'none';
      // Overline is the decorative role. The lib reads per-size tokens
      // (`--Overline-Small-Text-Transform`, etc.) with a hardcoded `uppercase`
      // fallback — so we MUST emit one per size, including when the choice is
      // lowercase, or overline stays stuck in all-caps.
      const overlineSizes = ['Overline-Small', 'Overline-Medium', 'Overline-Large'];
      const perSize: Record<string, string> = {};
      for (const s of overlineSizes) perSize[`--${s}-Text-Transform`] = decoTT;
      return {
        '--Set-Font-Family-Decorative': `'${decorativeFont.family}', sans-serif`,
        '--Set-Font-Family-Decorative-Weight': decorativeFont.weight,
        '--Set-Font-Family-Decorative-Letter-Spacing': decorativeFont.letterSpacing || '0em',
        '--Set-Font-Family-Decorative-Text-Transform': decoTT,
        ...perSize,
      };
    })() : {}),
    ...(applyBrand && bodyFont ? {
      '--Body-Font-Family': `'${bodyFont.family}', sans-serif`,
      '--Font-Family-Body': `'${bodyFont.family}', sans-serif`,
      '--Set-Font-Family-Body': `'${bodyFont.family}', sans-serif`,
      '--Set-Font-Family-Body-Weight': bodyFont.weight,
      '--Set-Font-Family-Body-Letter-Spacing': bodyFont.letterSpacing || '0em',
      // Default font-family for the whole tree. The lib's H1–H6 and Body
      // components consume their own --Header-Font-Family / --Body-Font-Family
      // tokens explicitly, but raw HTML — inline <span>, <div>, <p> text
      // that isn't wrapped in a lib component — only picks up the brand
      // font when we set fontFamily on an ancestor. Without this, those
      // bits of text fall back to the browser's default (Times Roman on
      // most desktops) even when the picked Body font is Inter. Headings
      // and Body components keep overriding; this is just the baseline.
      fontFamily: `'${bodyFont.family}', sans-serif`,
    } : {}),
  } as React.CSSProperties;

  return (
    <>
      {/* Default theme overrides — fix dark containers from library CSS + add effects */}
      <style id="dino-default-effects" dangerouslySetInnerHTML={{ __html: `
        [data-theme="Default"],
        [data-theme="Default"][data-surface="Surface"] {
          --Background: #f5f5f5;
          --Text: #1a1a1a;
          --Header: #1a1a1a;
          --Quiet: #6b6b6b;
          --Border: #d4d4d4;
          --Border-Variant: #d4d4d426;
          --Card-Padding: 16px;
          --Checkbox-Radius: 4px;
          --Shadow-1: none;
          --Shadow-2: none;
          --Dropshadow-Color: 120, 120, 120;
        }
        [data-theme="Default"] [data-surface^="Container"],
        [data-theme="Default"][data-surface^="Container"] {
          --Container: #ffffff;
          --Container-Low: #fafafa;
          --Container-Lowest: #f5f5f5;
          --Container-High: #ffffff;
          --Container-Highest: #ffffff;
          --Text: #1a1a1a;
          --Header: #1a1a1a;
          --Quiet: #6b6b6b;
          --Border: #d4d4d4;
          --Border-Variant: #d4d4d466;
          --Dropshadow-Color: 100, 100, 100;
        }
        [data-theme="Default"] {
          --Effect-Level-0: none;
          --Effect-Level-1: 0 1px 2px rgba(var(--Dropshadow-Color), 0.28);
          --Effect-Level-2: 0 2px 4px rgba(var(--Dropshadow-Color), 0.22), 0 1px 2px rgba(var(--Dropshadow-Color), 0.28);
          --Effect-Level-3: 0 4px 8px rgba(var(--Dropshadow-Color), 0.17), 0 2px 4px rgba(var(--Dropshadow-Color), 0.22);
          --Effect-Level-4: 0 8px 16px rgba(var(--Dropshadow-Color), 0.13), 0 4px 8px rgba(var(--Dropshadow-Color), 0.17);
          --Effect-Level-5: 0 16px 32px rgba(var(--Dropshadow-Color), 0.1), 0 8px 16px rgba(var(--Dropshadow-Color), 0.13);
        }
      `}} />
      {/* `@dynodesign/components`'s Button has no "default" in its color list,
          so variant="default" silently falls through to the Primary styles and
          reads --Buttons-Primary-*. Redirect those reads to --Buttons-Default-*
          on any .btn-default so the button actually renders with the Default
          palette (which tracks the user's button-mode choice). */}
      <style id="dino-btn-default-redirect" dangerouslySetInnerHTML={{ __html: `
        .btn-default {
          --Buttons-Primary-Button: var(--Buttons-Default-Button);
          --Buttons-Primary-Text: var(--Buttons-Default-Text);
          --Buttons-Primary-Border: var(--Buttons-Default-Border);
          --Buttons-Primary-Hover: var(--Buttons-Default-Hover);
          --Buttons-Primary-Pressed: var(--Buttons-Default-Pressed);
        }
      `}} />
      {/* Canonical @dynodesign/components 0.1.8 doesn't render the swatch
          fill (the `swatch`/`swatchColor` props pass through as DOM
          attributes). Studio-side workaround: the consumer sets
          `--swatch-color` inline on each swatch Button and these rules paint
          the fill. Wins over `.btn-primary` because of `!important`.
          MISSING-LIB-COMPONENT: Button swatch variant — re-add to canonical lib. */}
      <style id="dino-swatch-fill" dangerouslySetInnerHTML={{ __html: `
        .dino-swatch[style*="--swatch-color"] {
          background-color: var(--swatch-color) !important;
          background-image: none !important;
          border-color: var(--swatch-color) !important;
          color: transparent !important;
        }
        .dino-swatch[style*="--swatch-color"]:hover,
        .dino-swatch[style*="--swatch-color"]:active,
        .dino-swatch[style*="--swatch-color"].Mui-focusVisible {
          background-color: var(--swatch-color) !important;
          background-image: none !important;
          border-color: var(--swatch-color) !important;
          opacity: 0.9;
        }
        /* Canonical lib 0.1.8 Select with mode=color paints the trigger
           swatch using the option's value (e.g. primary-light) instead of
           its color field, producing an empty/invalid background. Consumer
           sets --select-trigger-color and this rule paints the first child
           of the combobox flex:1 box (i.e. the broken swatch).
           MISSING-LIB-COMPONENT: Select wrapper — port color-trigger fix. */
        .dino-color-select[style*="--select-trigger-color"] [role="combobox"] > div:first-child > div > div:first-child {
          background-color: var(--select-trigger-color) !important;
          background-image: none !important;
        }
      `}} />
      {/* Per-variant bevel shadow. Each variant exposes its palette's
          Highlight/Lowlight RGB triples via --Current-Bevel-*; one rule
          applies the shadow, skipping ghost/text (flat by design). */}
      <style id="dino-button-bevel" dangerouslySetInnerHTML={{ __html: `
        .btn-primary, .btn-primary-outline, .btn-primary-light, .btn-outline {
          --Current-Bevel-Highlight: var(--Buttons-Primary-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Primary-Lowlight, black);
        }
        .btn-default {
          --Current-Bevel-Highlight: var(--Buttons-Default-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Default-Lowlight, black);
        }
        .btn-secondary, .btn-secondary-outline, .btn-secondary-light {
          --Current-Bevel-Highlight: var(--Buttons-Secondary-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Secondary-Lowlight, black);
        }
        .btn-tertiary, .btn-tertiary-outline, .btn-tertiary-light {
          --Current-Bevel-Highlight: var(--Buttons-Tertiary-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Tertiary-Lowlight, black);
        }
        .btn-neutral, .btn-neutral-outline, .btn-neutral-light {
          --Current-Bevel-Highlight: var(--Buttons-Neutral-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Neutral-Lowlight, black);
        }
        .btn-info, .btn-info-outline, .btn-info-light {
          --Current-Bevel-Highlight: var(--Buttons-Info-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Info-Lowlight, black);
        }
        .btn-success, .btn-success-outline, .btn-success-light {
          --Current-Bevel-Highlight: var(--Buttons-Success-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Success-Lowlight, black);
        }
        .btn-warning, .btn-warning-outline, .btn-warning-light {
          --Current-Bevel-Highlight: var(--Buttons-Warning-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Warning-Lowlight, black);
        }
        .btn-error, .btn-error-outline, .btn-error-light, .btn-danger {
          --Current-Bevel-Highlight: var(--Buttons-Error-Highlight, white);
          --Current-Bevel-Lowlight: var(--Buttons-Error-Lowlight, black);
        }
        /* Size-scaled bevel: --_bevel is derived from the bevel % × the
           button's own height token, matching DinoDesign Button.js. MUI adds
           .MuiButton-size{Small,Medium,Large} based on the size prop. */
        body .MuiButton-root[class*="btn-"]:not(.btn-ghost):not(.btn-text):not([class*="-outline"]):not(.dino-swatch) {
          --_bevel: calc(var(--Button-Bevel, 0) * var(--Button-Height, 0px) / 100);
        }
        body .MuiButton-root[class*="btn-"].MuiButton-sizeSmall:not(.btn-ghost):not(.btn-text):not([class*="-outline"]):not(.dino-swatch) {
          --_bevel: calc(var(--Button-Bevel, 0) * var(--Small-Button-Height, 0px) / 100);
        }
        body .MuiButton-root[class*="btn-"].MuiButton-sizeLarge:not(.btn-ghost):not(.btn-text):not([class*="-outline"]):not(.dino-swatch) {
          --_bevel: calc(var(--Button-Bevel, 0) * var(--Large-Button-Height, 0px) / 100);
        }
        body .MuiButton-root[class*="btn-"]:not(.btn-ghost):not(.btn-text):not([class*="-outline"]):not(.dino-swatch),
        body .MuiButton-root[class*="btn-"]:not(.btn-ghost):not(.btn-text):not([class*="-outline"]):not(.dino-swatch):hover,
        body .MuiButton-root[class*="btn-"]:not(.btn-ghost):not(.btn-text):not([class*="-outline"]):not(.dino-swatch):active,
        body .MuiButton-root[class*="btn-"]:not(.btn-ghost):not(.btn-text):not([class*="-outline"]):not(.dino-swatch).Mui-focusVisible {
          /* Negative spread of -_bevel pulls the inset shadow inward so it
             stays at the corners instead of fanning into the button center.
             Net coverage: offset(b) + blur(b) - spread(b) = b pixels from the
             edge — i.e., the bevel reads as the chosen % of button height and
             leaves the bg under the text untouched. */
          box-shadow:
            inset var(--_bevel, 0px) var(--_bevel, 0px) var(--_bevel, 0px) calc(0px - var(--_bevel, 0px)) color-mix(in srgb, var(--Current-Bevel-Highlight, white) calc(var(--Button-Bevel-Opacity, 0.5) * 100%), transparent),
            inset calc(0px - var(--_bevel, 0px)) calc(0px - var(--_bevel, 0px)) var(--_bevel, 0px) calc(0px - var(--_bevel, 0px)) color-mix(in srgb, var(--Current-Bevel-Lowlight, black) calc(var(--Button-Bevel-Opacity, 0.5) * 100%), transparent);
        }
      `}} />
      {/* Inject brand CSS — same tokens as the phone preview */}
      {brandCSS && <style id="dino-brand-css" dangerouslySetInnerHTML={{ __html: brandCSS }} />}
      <div style={styleVars as React.CSSProperties}>
        {isExport && <AppHeader />}
        {showTopBar && (
          <CreationTopBar designSystemName={designSystemName} onBack={goBack} themed={applyBrand} />
        )}
        <main data-theme={applyBrand ? 'Brand' : 'Default'} data-surface="Surface" style={{ minHeight: '100vh', paddingBottom: (showBottomBar && !showPricingModal) ? 120 : 0, overflowX: 'hidden', background: 'var(--Background)' }}>
          {showPricingModal ? (
            <PricingPage
              onCheckout={async (selection: PurchaseSelection) => {
                if (!user) return;
                try {
                  // Save a draft of the in-progress design system to Firestore
                  // first so we can rehydrate after Stripe sends the browser
                  // off-site and back. dsId rides along in the success URL.
                  const draftDsId = await saveDraftBeforeCheckout();
                  const successUrl = `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}${draftDsId ? `&dsId=${draftDsId}` : ''}`;
                  const result = await redirectToCheckout({
                    tierKey: selection.tier.key,
                    addOns: {
                      playground: selection.addOns.playground,
                      designerPortal: selection.addOns.designerPortal,
                    },
                    userId: user.uid,
                    dsId: draftDsId || undefined,
                    successUrl,
                    cancelUrl: window.location.href,
                  });
                  // Dev mode: payment handled inline, advance to export
                  if (result === 'dev_complete') {
                    setShowPricingModal(false);
                    const currentIndex = STAGE_ORDER.indexOf(stage);
                    if (currentIndex < STAGE_ORDER.length - 1) {
                      setStage(STAGE_ORDER[currentIndex + 1]);
                      window.scrollTo(0, 0);
                    }
                  }
                  // Production: redirected to Stripe (won't reach here)
                } catch (err) {
                  console.error('Checkout failed:', err);
                }
              }}
            />
          ) : rehydrating ? (
            // Brief loading state while we restore an in-progress build from
            // Firestore (post-Stripe redirect or /my-designs edit). Without
            // this the default 'name' stage flashes for a beat before the
            // snapshot loads and we jump to the resumed stage.
            <div style={{
              minHeight: '60vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div className="typo-spinner" />
            </div>
          ) : (
            renderStage()
          )}
        </main>
        {showBottomBar && !isFirstStage && !showPricingModal && (
          <CreationBottomBar onNext={goNext} nextLabel={nextLabel} themed={applyBrand} disabled={!canProceed} />
        )}

        <AuthModal
          open={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            // Just authenticated — use the fresh Firebase user (context `user`
            // hasn't propagated yet this tick). Re-checks the name for a
            // collision, then routes to pricing (or export for test accounts).
            void proceedAfterAuth(auth.currentUser);
          }}
        />

        <RenameDesignModal
          open={showRenameModal}
          currentName={designSystemName}
          userId={(user || auth.currentUser)?.uid || ''}
          excludeId={dinoId || undefined}
          onClose={() => setShowRenameModal(false)}
          onConfirm={(newName) => {
            setDesignSystemName(newName);
            setShowRenameModal(false);
            routePastName(user || auth.currentUser);
          }}
        />

      </div>
    </>
  );
}

function App() {
  return (
    <DynoDesignProvider
      defaultTheme="Default"
      defaultStyle="Modern"
      defaultSurface="Surface"
    >
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/add-ons" element={<AddOnCatalogPage />} />
        <Route path="/create" element={<MainApp />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/preview" element={<GeneratedPreview />} />
        <Route path="/api/tokens/:uuid" element={<ApiTokensJson />} />
        <Route path="/api/tokens/:uuid/md" element={<ApiTokensMd />} />
        <Route path="/tune" element={<ToneTuner />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/accessibility-report" element={<AccessibilityReport />} />
        <Route path="/my-designs" element={<MyDesignsPage />} />
        <Route path="/my-designs/:id" element={<DesignSystemDetail />} />
        <Route path="/admin/proposals" element={<AdminProposals />} />
        <Route path="/test/typography" element={<TypographyTestPage />} />
        <Route path="/admin/aaid-workbench" element={<AaidWorkbenchPage />} />
      </Routes>
    </BrowserRouter>
    </DynoDesignProvider>
  );
}

export default App;
