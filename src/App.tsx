import { useState, useCallback, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { DynoDesignProvider } from '@dynodesign/components';
import { useAuth } from './contexts/AuthContext';
import AuthModal from './components/AuthModal';
import PricingPage, { type PurchaseSelection } from './components/PricingPage';
import CheckoutSuccess from './components/CheckoutSuccess';
import { redirectToCheckout } from './utils/stripe/checkout';
import { db } from './utils/firebase/client';
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

import TopNav from './components/TopNav';
import { CreationTopBar, CreationBottomBar } from './components/CreationNav';
import WelcomeStage from './components/stages/WelcomeStage';
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
import AccessibilityReport from './components/AccessibilityReport';
import DesignSystemDetail from './components/DesignSystemDetail';

function MainApp() {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

  const [stage, setStage] = useState<Stage>('welcome');
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
  const [savedFontSamples, setSavedFontSamples] = useState<any[]>([]);
  const [savedSelectedSample, setSavedSelectedSample] = useState<number | null>(null);
  const [savedStyleCustomizations, setSavedStyleCustomizations] = useState<any>({
    modern: { radius: 8, buttonRadius: 4, bevel: 0, bevelOpacity: 50, buttonHeight: 32, smallButtonHeight: 24, largeButtonHeight: 56, minButtonWidth: 60, iconButtonRadius: 4 },
  });

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
  }, [stage, autoAssigned, selectedColorScheme, surfaceStyle, moodBoardUrl, user]);

  const customBackRef = useRef<(() => void) | null>(null);
  const customNextRef = useRef<(() => void) | null>(null);
  const [customNextLabel, setCustomNextLabel] = useState<string | null>(null);

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
    const currentIndex = STAGE_ORDER.indexOf(stage);
    if (currentIndex > 0) {
      setStage(STAGE_ORDER[currentIndex - 1]);
      window.scrollTo(0, 0);
    }
  }, [stage, showPricingModal]);

  const handleNameSubmit = (name: string, date: string) => {
    setDesignSystemName(name);
    setDateCreated(date);
  };

  const renderStage = () => {
    switch (stage) {
      case 'welcome':
        return <WelcomeStage onNext={goNext} onBack={goBack} />;
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
            onCustomBackChange={(handler) => { customBackRef.current = handler; }}
            onCustomNextChange={(handler) => { customNextRef.current = handler; }}
            onNextLabelChange={setCustomNextLabel}
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
          />
        );
      default:
        return <WelcomeStage onNext={goNext} onBack={goBack} />;
    }
  };

  const isExport = stage === 'export';
  const showTopBar = designSystemName && stage !== 'welcome' && stage !== 'name' && !isExport;
  const showBottomBar = !isExport && stage !== 'name' && stage !== 'welcome'; // export/name/welcome have own nav
  const isFirstStage = stage === 'welcome';

  // Bottom bar label
  const nextLabel = customNextLabel || (stage === 'review' ? 'Get Your Design System' : 'Continue');

  // Bottom bar disabled state — block stage progression when prerequisites aren't met
  const canProceed = (() => {
    if (stage === 'upload') return !!moodBoardUrl;
    return true;
  })();

  // Component style radii — from saved customizations or defaults
  const cardRadius = savedStyleCustomizations?.[componentStyle]?.radius ?? { professional: 4, modern: 8, bold: 16, playful: 24 }[componentStyle];
  const buttonRadius = savedStyleCustomizations?.[componentStyle]?.buttonRadius ?? { professional: 2, modern: 4, bold: 8, playful: 64 }[componentStyle];

  // Apply brand tokens after color-assignment stage
  const applyBrand = ['color-assignment', 'typography', 'component-style', 'review', 'export'].includes(stage);

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
    <DynoDesignProvider
      defaultTheme="Default"
      defaultStyle="Modern"
      defaultSurface="Surface"
    >
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
          box-shadow:
            inset var(--_bevel, 0px) var(--_bevel, 0px) var(--_bevel, 0px) rgba(var(--Current-Bevel-Highlight, 255, 255, 255), var(--Button-Bevel-Opacity, 0.5)),
            inset calc(0px - var(--_bevel, 0px)) calc(0px - var(--_bevel, 0px)) var(--_bevel, 0px) rgba(var(--Current-Bevel-Lowlight, 0, 0, 0), var(--Button-Bevel-Opacity, 0.5));
        }
      `}} />
      {/* Inject brand CSS — same tokens as the phone preview */}
      {brandCSS && <style id="dino-brand-css" dangerouslySetInnerHTML={{ __html: brandCSS }} />}
      <div style={styleVars as React.CSSProperties}>
        {isExport && <TopNav designSystemName={designSystemName} />}
        {showTopBar && (
          <CreationTopBar designSystemName={designSystemName} onBack={goBack} themed={applyBrand} />
        )}
        <main data-theme={applyBrand ? 'Brand' : 'Default'} data-surface="Surface" style={{ minHeight: '100vh', paddingBottom: (showBottomBar && !showPricingModal) ? 72 : 0, overflowX: 'hidden', background: 'var(--Background)' }}>
          {showPricingModal ? (
            <PricingPage
              onCheckout={async (selection: PurchaseSelection) => {
                if (!user) return;
                try {
                  const result = await redirectToCheckout({
                    tierKey: selection.tier.key,
                    addOns: {
                      playground: selection.addOns.playground,
                      storybook: selection.addOns.storybook,
                      designerPortal: selection.addOns.designerPortal,
                    },
                    userId: user.uid,
                    successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
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
    </DynoDesignProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/create" element={<MainApp />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/api/tokens/:uuid" element={<ApiTokensJson />} />
        <Route path="/api/tokens/:uuid/md" element={<ApiTokensMd />} />
        <Route path="/tune" element={<ToneTuner />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/accessibility-report" element={<AccessibilityReport />} />
        <Route path="/my-designs/:id" element={<DesignSystemDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
