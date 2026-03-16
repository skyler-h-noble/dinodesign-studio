import { H1, Body, VStack, Card } from '@dynodesign/components';
import type { StageProps } from '../../types';

export default function WelcomeStage({ onNext }: StageProps) {
  return (
    <VStack spacing={4} alignItems="center" style={{ padding: '64px 24px' }}>
      <H1>DinoDesign</H1>
      <Body>Evolve your prehistoric design system approach</Body>
      <VStack spacing={2} style={{ maxWidth: 400, width: '100%' }}>
        <Card onClick={onNext} padding="medium">
          <Body>Create New Design System</Body>
        </Card>
        <Card padding="medium">
          <Body>Load Existing System</Body>
        </Card>
        <Card padding="medium">
          <Body>Accessibility Check</Body>
        </Card>
      </VStack>
    </VStack>
  );
}
