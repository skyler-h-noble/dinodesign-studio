import { useState, useCallback, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { DynoDesignProvider } from '@dynodesign/components';
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

function MainApp() {
  const [stage, setStage] = useState<Stage>('welcome');
  const [designSystemName, setDesignSystemName] = useState('');
  const [, setDateCreated] = useState('');
  const [moodBoardUrl, setMoodBoardUrl] = useState<string | null>(null);
  const [, setMoodBoardFile] = useState<File | null>(null);
  const [selectedColorScheme, setSelectedColorScheme] = useState<ColorScheme | null>(null);
  const [userSelections, setUserSelections] = useState<UserSelections>({
    defaultTheme: 'light',
    background: 'white',
    backgroundTheme: 'Neutral',
    backgroundN: 14,
    appBar: 'primary-light-bright',
    navBar: 'primary-light-dim',
    status: 'primary-light-bright',
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
  const [savedStyleCustomizations, setSavedStyleCustomizations] = useState<any>(null);

  const goNext = useCallback(() => {
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
    }
  }, [stage, autoAssigned, selectedColorScheme, surfaceStyle]);

  const customBackRef = useRef<(() => void) | null>(null);
  const customNextRef = useRef<(() => void) | null>(null);
  const [customNextLabel, setCustomNextLabel] = useState<string | null>(null);

  const goBack = useCallback(() => {
    if (customBackRef.current) {
      customBackRef.current();
      return;
    }
    const currentIndex = STAGE_ORDER.indexOf(stage);
    if (currentIndex > 0) {
      setStage(STAGE_ORDER[currentIndex - 1]);
    }
  }, [stage]);

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
            surfaceStyle={surfaceStyle}
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

  // Component style radii
  const STYLE_BUTTON_RADII: Record<ComponentStyle, number> = { professional: 2, modern: 4, bold: 8, playful: 64 };
  const cardRadius = savedStyleCustomizations?.[componentStyle]?.radius ?? { professional: 4, modern: 8, bold: 16, playful: 24 }[componentStyle];
  const buttonRadius = STYLE_BUTTON_RADII[componentStyle];

  // Build brand token CSS variables from the selected color scheme
  const brandTokens = useMemo(() => {
    if (!selectedColorScheme?.tonePalettes) return {};
    const p = selectedColorScheme.tonePalettes.primary || [];
    const pc = toneToColorNumber(selectedColorScheme.extractedTones?.primary || 60);
    const sc = toneToColorNumber(selectedColorScheme.extractedTones?.secondary || 60);

    // Surface background based on user selection
    const bgN = userSelections.background === 'primary-light' ? 11
      : userSelections.background === 'primary-base' ? pc
      : 12; // white default
    const bgPalette = (userSelections.background === 'white' || userSelections.background === 'black')
      ? ['#050505','#1a1a1a','#2e2e2e','#434343','#585858','#8e8e8e','#a3a3a3','#b8b8b8','#cccccc','#e0e0e0','#f0f0f0','#fafafa']
      : p.map(t => t.hex);

    const containerHex = bgPalette[10] || '#f0f0f0'; // Color-11
    const bgHex = bgPalette[bgN - 1] || '#ffffff';
    const headerHex = p[3]?.hex || '#333';
    const textHex = p[3]?.hex || '#333';
    const quietHex = p[4]?.hex || '#666';
    const borderHex = p[7]?.hex || '#ccc';
    const btnBg = p[pc - 1]?.hex || '#888';
    const btnText = pc >= 9 ? (p[1]?.hex || '#fff') : (p[10]?.hex || '#fff');
    const scHex = (selectedColorScheme.tonePalettes.secondary || [])[sc - 1]?.hex || '#888';

    return {
      '--Background': bgHex,
      '--Surface': bgHex,
      '--Container': containerHex,
      '--Container-Low': containerHex,
      '--Container-Lowest': containerHex,
      '--Header': headerHex,
      '--Text': textHex,
      '--Quiet': quietHex,
      '--Border': borderHex,
      '--Border-Variant': borderHex,
      '--Hotlink': p[5]?.hex || '#5276cf',
      '--Buttons-Primary-Button': btnBg,
      '--Buttons-Primary-Text': btnText,
      '--Buttons-Primary-Border': btnBg,
      '--Buttons-Secondary-Button': scHex,
      '--Buttons-Secondary-Text': btnText,
      '--Buttons-Secondary-Border': scHex,
      '--Buttons-Default-Button': containerHex,
      '--Buttons-Default-Text': textHex,
      '--Buttons-Default-Border': borderHex,
      '--Focus-Visible': '#3b82f6',
    };
  }, [selectedColorScheme, userSelections.background]);

  // Resolve nav option to hex color
  const resolveNavColor = (opt: string): string | undefined => {
    if (!selectedColorScheme?.tonePalettes) return undefined;
    const p = selectedColorScheme.tonePalettes.primary || [];
    const pc = toneToColorNumber(selectedColorScheme.extractedTones?.primary || 60);
    const neutral = ['#050505','#1a1a1a','#2e2e2e','#434343','#585858','#8e8e8e','#a3a3a3','#b8b8b8','#cccccc','#e0e0e0','#f0f0f0','#fafafa'];
    switch (opt) {
      case 'black': return neutral[0];
      case 'white': return '#ffffff';
      case 'primary-light': return p[10]?.hex;
      case 'primary-light-bright': return p[11]?.hex;
      case 'primary-light-dim': return p[9]?.hex;
      case 'primary': return p[pc - 1]?.hex;
      case 'primary-bright': return p[Math.min(pc, 11)]?.hex;
      case 'primary-dim': return p[Math.max(pc - 2, 0)]?.hex;
      default: return undefined;
    }
  };

  // Apply brand tokens after color-assignment stage
  const applyBrand = ['color-assignment', 'typography', 'component-style', 'review', 'export'].includes(stage);
  const styleVars = {
    '--Style-Border-Radius': `${buttonRadius}px`,
    '--Card-Radius': `${cardRadius}px`,
    ...(applyBrand ? brandTokens : {}),
  } as React.CSSProperties;

  return (
    <DynoDesignProvider
      defaultTheme="Default"
      defaultStyle="Modern"
      defaultSurface="Surface"
    >
      {isExport && <TopNav designSystemName={designSystemName} />}
      {showTopBar && (
        <CreationTopBar designSystemName={designSystemName} onBack={goBack} themed={applyBrand} />
      )}
      {applyBrand && Object.keys(brandTokens).length > 0 && (
        <style>{`
          [data-theme="Default"],
          [data-theme="Default"] [data-surface] {
            ${Object.entries(brandTokens).map(([k, v]) => `${k}: ${v} !important;`).join('\n            ')}
          }
          [data-theme="App-Bar"] {
            --Background: ${resolveNavColor(userSelections.appBar) || 'var(--Surface)'} !important;
            ${Object.entries(brandTokens).filter(([k]) => k !== '--Background' && k !== '--Surface').map(([k, v]) => `${k}: ${v} !important;`).join('\n            ')}
          }
          [data-theme="Nav-Bar"] {
            --Background: ${resolveNavColor(userSelections.navBar) || 'var(--Surface)'} !important;
            ${Object.entries(brandTokens).filter(([k]) => k !== '--Background' && k !== '--Surface').map(([k, v]) => `${k}: ${v} !important;`).join('\n            ')}
          }
        `}</style>
      )}
      <main style={{ ...styleVars, minHeight: '100vh', paddingBottom: showBottomBar ? 72 : 0, overflowX: 'hidden' }}>
        {renderStage()}
      </main>
      {showBottomBar && !isFirstStage && (
        <CreationBottomBar onNext={goNext} nextLabel={nextLabel} themed={applyBrand} />
      )}
    </DynoDesignProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/api/tokens/:uuid" element={<ApiTokensJson />} />
        <Route path="/api/tokens/:uuid/md" element={<ApiTokensMd />} />
        <Route path="/tune" element={<ToneTuner />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
