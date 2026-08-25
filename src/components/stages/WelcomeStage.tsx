import { H1, Body, BodySmall, VStack, Card, HStack } from '@omni-design/components';
import AddIcon from '@mui/icons-material/Add';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import type { StageProps } from '../../types';

interface Props extends StageProps {
  onLoadSystem?: () => void;
}

export default function WelcomeStage({ onNext, onLoadSystem }: Props) {
  return (
    <VStack spacing={6} alignItems="center" style={{ padding: '80px 24px' }}>
      <VStack spacing={2} alignItems="center">
        <H1 style={{ textAlign: 'center' }}>OmniDesign</H1>
        <Body style={{ textAlign: 'center' }}>Evolve your prehistoric design system approach</Body>
      </VStack>

      <VStack spacing={2} style={{ maxWidth: 480, width: '100%' }}>
        <Card
          onClick={onNext}
          clickable
          padding="medium"
          elevation={1}
          sx={{ border: '2px solid var(--Buttons-Default-Border)' }}
        >
          <HStack spacing={2} alignItems="center">
            <AddIcon style={{ color: 'var(--Icons-Primary)' }} />
            <VStack spacing={0}>
              <Body style={{ fontWeight: 600 }}>Create New Design System</Body>
              <BodySmall color="quiet">
                Upload a mood board to generate colors, typography, and components
              </BodySmall>
            </VStack>
          </HStack>
        </Card>

        <Card
          onClick={onLoadSystem}
          clickable
          padding="medium"
          elevation={1}
        >
          <HStack spacing={2} alignItems="center">
            <FolderOpenIcon style={{ color: 'var(--Icons-Secondary)' }} />
            <VStack spacing={0}>
              <Body style={{ fontWeight: 600 }}>Load Existing System</Body>
              <BodySmall color="quiet">
                Continue working on a saved design system
              </BodySmall>
            </VStack>
          </HStack>
        </Card>

      </VStack>
    </VStack>
  );
}
