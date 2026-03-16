import { useState, useCallback } from 'react';
import { DynoDesignProvider } from '@dynodesign/components';
import type { Stage } from './types';
import { STAGE_ORDER } from './types';

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
  // Stage navigation
  const [stage, setStage] = useState<Stage>('welcome');

  // Design system state (will be wired up in later sprints)
  const [, setDesignSystemName] = useState('');
  const [, setDateCreated] = useState('');

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
        return <UploadStage onNext={goNext} onBack={goBack} />;
      case 'color':
        return <ColorStage onNext={goNext} onBack={goBack} />;
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

  return (
    <DynoDesignProvider
      defaultTheme="Default"
      defaultStyle="Modern"
      defaultSurface="Surface"
    >
      <main data-surface="Surface" style={{ minHeight: '100vh' }}>
        {renderStage()}
      </main>
    </DynoDesignProvider>
  );
}

// Suppress unused for now — will be consumed in later sprints
void App;

export default App;
