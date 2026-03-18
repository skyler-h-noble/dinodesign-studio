import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { DynoDesignProvider } from '@dynodesign/components';
import type { Stage, ColorScheme, UserSelections, TypographyStyle, ComponentStyle, SurfaceStyle } from './types';
import { STAGE_ORDER } from './types';
import {
  generateSemanticLightModeScale,
  generateSemanticDarkModeScale,
  getLightness,
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
    appBar: 'white',
    navBar: 'white',
    status: 'white',
    button: 'primary',
    cardColoring: 'tonal',
    textColoring: 'tonal',
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

  const goBack = useCallback(() => {
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

  const showTopBar = designSystemName && stage !== 'welcome' && stage !== 'name';
  const showBottomBar = stage !== 'export'; // export has its own layout
  const isFirstStage = stage === 'welcome';

  // Bottom bar label
  const nextLabel = stage === 'review' ? 'Get Your Design System' : 'Continue';

  return (
    <DynoDesignProvider
      defaultTheme="Default"
      defaultStyle="Modern"
      defaultSurface="Surface"
    >
      {showTopBar && (
        <CreationTopBar designSystemName={designSystemName} onBack={goBack} />
      )}
      <main data-surface="Surface" style={{ minHeight: '100vh', paddingBottom: showBottomBar ? 72 : 0 }}>
        {renderStage()}
      </main>
      {showBottomBar && !isFirstStage && (
        <CreationBottomBar onNext={goNext} nextLabel={nextLabel} />
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
