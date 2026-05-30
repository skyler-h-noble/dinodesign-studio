import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { DynoDesignProvider } from '@dynodesign/components';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import PricingPage, { type PurchaseSelection } from './components/PricingPage';
import CheckoutSuccess from './components/CheckoutSuccess';
import { redirectToCheckout } from './utils/stripe/checkout';
import { db } from './utils/firebase/client';
import { getPublicFileUrl } from './utils/firebase/storage';
import type { Stage, ColorScheme, UserSelections, TypographyStyle, ComponentStyle, SurfaceStyle } from './types';
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
import TypographyStage from './components/stages/TypographyStage';
import ComponentStyleStage from './components/stages/ComponentStyleStage';
import ReviewStage from './components/stages/ReviewStage';
import ExportStage from './components/stages/ExportStage';
import Playground from './components/Playground';
import { ApiTokensJson, ApiTokensMd } from './components/ApiTokens';
import ToneTuner from './components/ToneTuner';
import AccountPage from './components/AccountPage';
import LandingPage from './components/LandingPage';
import AddOnCatalogPage from './components/AddOnCatalogPage';
import AccessibilityReport from './components/AccessibilityReport';
import DesignSystemDetail from './components/DesignSystemDetail';
import MyDesignsPage from './components/MyDesignsPage';
import AdminProposals from './components/AdminProposals';

function MainApp() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

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
      // User is logged in — show pricing page
      setShowPricingModal(true);
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
  }, [stage, autoAssigned, selectedColorScheme, surfaceStyle, moodBoardUrl, user, pendingReExport]);

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
          <TypographyStage
            onNext={goNext}
            onBack={goBack}
            colorScheme={selectedColorScheme}
            moodBoardUrl={moodBoardUrl}
            designSystemName={designSystemName}
            onTypographyComplete={setTypographyStyles}
            savedFontSamples={savedFontSamples}
            savedSelectedSample={savedSelectedSample}
            onFontSamplesGenerated={(samples, selected) => {
              setSavedFontSamples(samples);
              setSavedSelectedSample(selected);
            }}
            savedTypographySettings={savedTypographySettings}
            onTypographySettingsChange={setSavedTypographySettings}
            savedFirstTrio={pendingReExport ? typographyStyles : undefined}
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
  const buttonRadius = savedStyleCustomizations?.[componentStyle]?.buttonRadius ?? { professional: 2, modern: 4, bold: 8, playful: 64 }[componentStyle];

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

  const styleVars = {
    '--Style-Border-Radius': `${buttonRadius}px`,
    '--Button-Radius': `${buttonRadius}px`,
    '--Button-Icon-Radius': `${iconButtonRadius}px`,
    '--Button-Bevel': `${bevel}`,
    '--Button-Bevel-Opacity': `${bevelOpacity / 100}`,
    '--Button-Bevel-Px': `${bevelPx}px`,
    '--Button-Height': `${buttonHeight}px`,
    '--Small-Button-Height': `${smallButtonHeight}px`,
    '--Large-Button-Height': `${largeButtonHeight}px`,
    '--Button-Min-Width': `${minButtonWidth}px`,
    '--Card-Radius': `${cardRadius}px`,
    '--Card-Padding': `${cardRadius >= 16 ? 20 : 16}px`,
    ...(applyBrand && headerFont ? {
      '--Header-Font-Family': `'${headerFont.family}', serif`,
      '--Font-Family-Header': `'${headerFont.family}', serif`,
      '--Set-Font-Family-Header': `'${headerFont.family}', serif`,
      '--Set-Font-Family-Header-Weight': headerFont.weight,
      '--Set-Header-Letter-Spacing': headerFont.letterSpacing || '0em',
      '--Set-Header-Text-Transform': headerFont.allCaps ? 'uppercase' : 'none',
      '--Header-Text-Transform': headerFont.allCaps ? 'uppercase' : 'none',
      '--Header-Letter-Spacing': headerFont.letterSpacing || '0em',
    } : {}),
    ...(applyBrand && decorativeFont ? {
      '--Set-Font-Family-Decorative': `'${decorativeFont.family}', sans-serif`,
      '--Set-Font-Family-Decorative-Weight': decorativeFont.weight,
      '--Set-Font-Family-Decorative-Letter-Spacing': decorativeFont.letterSpacing || '0em',
      '--Set-Font-Family-Decorative-Text-Transform': decorativeFont.allCaps ? 'uppercase' : 'none',
    } : {}),
    ...(applyBrand && bodyFont ? {
      '--Body-Font-Family': `'${bodyFont.family}', sans-serif`,
      '--Font-Family-Body': `'${bodyFont.family}', sans-serif`,
      '--Set-Font-Family-Body': `'${bodyFont.family}', sans-serif`,
      '--Set-Font-Family-Body-Weight': bodyFont.weight,
      '--Set-Font-Family-Body-Letter-Spacing': bodyFont.letterSpacing || '0em',
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
          --Buttons-Primary-Active: var(--Buttons-Default-Active);
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
          --Current-Bevel-Highlight: var(--Buttons-Primary-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Primary-Lowlight, 0, 0, 0);
        }
        .btn-default {
          --Current-Bevel-Highlight: var(--Buttons-Default-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Default-Lowlight, 0, 0, 0);
        }
        .btn-secondary, .btn-secondary-outline, .btn-secondary-light {
          --Current-Bevel-Highlight: var(--Buttons-Secondary-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Secondary-Lowlight, 0, 0, 0);
        }
        .btn-tertiary, .btn-tertiary-outline, .btn-tertiary-light {
          --Current-Bevel-Highlight: var(--Buttons-Tertiary-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Tertiary-Lowlight, 0, 0, 0);
        }
        .btn-neutral, .btn-neutral-outline, .btn-neutral-light {
          --Current-Bevel-Highlight: var(--Buttons-Neutral-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Neutral-Lowlight, 0, 0, 0);
        }
        .btn-info, .btn-info-outline, .btn-info-light {
          --Current-Bevel-Highlight: var(--Buttons-Info-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Info-Lowlight, 0, 0, 0);
        }
        .btn-success, .btn-success-outline, .btn-success-light {
          --Current-Bevel-Highlight: var(--Buttons-Success-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Success-Lowlight, 0, 0, 0);
        }
        .btn-warning, .btn-warning-outline, .btn-warning-light {
          --Current-Bevel-Highlight: var(--Buttons-Warning-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Warning-Lowlight, 0, 0, 0);
        }
        .btn-error, .btn-error-outline, .btn-error-light, .btn-danger {
          --Current-Bevel-Highlight: var(--Buttons-Error-Highlight, 255, 255, 255);
          --Current-Bevel-Lowlight: var(--Buttons-Error-Lowlight, 0, 0, 0);
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
            inset var(--_bevel, 0px) var(--_bevel, 0px) var(--_bevel, 0px) calc(0px - var(--_bevel, 0px)) rgba(var(--Current-Bevel-Highlight, 255, 255, 255), var(--Button-Bevel-Opacity, 0.5)),
            inset calc(0px - var(--_bevel, 0px)) calc(0px - var(--_bevel, 0px)) var(--_bevel, 0px) calc(0px - var(--_bevel, 0px)) rgba(var(--Current-Bevel-Lowlight, 0, 0, 0), var(--Button-Bevel-Opacity, 0.5));
        }
      `}} />
      {/* Inject brand CSS — same tokens as the phone preview */}
      {brandCSS && <style id="dino-brand-css" dangerouslySetInnerHTML={{ __html: brandCSS }} />}
      <div style={styleVars as React.CSSProperties}>
        {isExport && <AppHeader />}
        {showTopBar && (
          <CreationTopBar designSystemName={designSystemName} onBack={goBack} themed={applyBrand} />
        )}
        <main data-theme={applyBrand ? 'Brand' : 'Default'} data-surface="Surface" style={{ minHeight: '100vh', paddingBottom: (showBottomBar && !showPricingModal) ? 72 : 0, overflowX: 'hidden', background: 'var(--Background)' }}>
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
            // User just authenticated — show pricing
            setShowPricingModal(true);
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
        <Route path="/api/tokens/:uuid" element={<ApiTokensJson />} />
        <Route path="/api/tokens/:uuid/md" element={<ApiTokensMd />} />
        <Route path="/tune" element={<ToneTuner />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/accessibility-report" element={<AccessibilityReport />} />
        <Route path="/my-designs" element={<MyDesignsPage />} />
        <Route path="/my-designs/:id" element={<DesignSystemDetail />} />
        <Route path="/admin/proposals" element={<AdminProposals />} />
      </Routes>
    </BrowserRouter>
    </DynoDesignProvider>
  );
}

export default App;
