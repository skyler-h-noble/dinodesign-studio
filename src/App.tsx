import { useState, useCallback } from 'react';
import { DynoDesignProvider } from '@dynodesign/components';
import type { Stage, ColorScheme, UserSelections } from './types';
import { STAGE_ORDER } from './types';
import {
  generateSemanticLightModeScale,
  generateSemanticDarkModeScale,
  getLightness,
} from './utils/colorScale';

import TopNav from './components/TopNav';
import WelcomeStage from './components/stages/WelcomeStage';
import DesignSystemNameStage from './components/stages/DesignSystemNameStage';
import UploadStage from './components/stages/UploadStage';
import ColorStage from './components/stages/ColorStage';
import ColorAssignmentStage from './components/stages/ColorAssignmentStage';
import TypographyStage from './components/stages/TypographyStage';
import ComponentStyleStage from './components/stages/ComponentStyleStage';
import ReviewStage from './components/stages/ReviewStage';
import ExportStage from './components/stages/ExportStage';

function App() {
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

  const goNext = useCallback(() => {
    const currentIndex = STAGE_ORDER.indexOf(stage);
    if (currentIndex < STAGE_ORDER.length - 1) {
      setStage(STAGE_ORDER[currentIndex + 1]);
    }
  }, [stage]);

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
            }}
            onGenerate={(_mode) => {
              // TODO: auto mode will skip to review in a future sprint
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
        return <TypographyStage onNext={goNext} onBack={goBack} />;
      case 'component-style':
        return <ComponentStyleStage onNext={goNext} onBack={goBack} />;
      case 'review':
        return <ReviewStage onNext={goNext} onBack={goBack} />;
      case 'export':
        return <ExportStage onNext={goNext} onBack={goBack} />;
      default:
        return <WelcomeStage onNext={goNext} onBack={goBack} />;
    }
  };

  const showNav = stage !== 'welcome';

  return (
    <DynoDesignProvider
      defaultTheme="Default"
      defaultStyle="Modern"
      defaultSurface="Surface"
    >
      {showNav && <TopNav designSystemName={designSystemName} />}
      <main data-surface="Surface" style={{ minHeight: '100vh' }}>
        {renderStage()}
      </main>
    </DynoDesignProvider>
  );
}

export default App;
