import { Button, H2, Body, VStack, HStack } from '@dynodesign/components';
import type { StageProps } from '../../types';

export default function TypographyStage({ onNext, onBack }: StageProps) {
  return (
    <VStack spacing={4} style={{ padding: '64px 24px', maxWidth: 800, margin: '0 auto' }}>
      <H2>Typography Selection</H2>
      <Body>Choose fonts for your design system.</Body>
      <HStack spacing={2}>
        <Button variant="outline" color="default" onClick={onBack}>Back</Button>
        <Button color="default" onClick={onNext}>Next</Button>
      </HStack>
    </VStack>
  );
}
