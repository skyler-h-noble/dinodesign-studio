import { useState, useCallback } from 'react';
import { DynoDesignProvider } from '@dynodesign/components';
import type { Stage, ColorScheme } from './types';
import { STAGE_ORDER } from './types';

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
        return <ColorAssignmentStage onNext={goNext} onBack={goBack} />;
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
