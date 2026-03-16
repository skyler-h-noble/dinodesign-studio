import { Button, H2, Body, VStack, HStack } from '@dynodesign/components';
import type { StageProps } from '../../types';

export default function ComponentStyleStage({ onNext, onBack }: StageProps) {
  return (
    <VStack spacing={4} style={{ padding: '64px 24px', maxWidth: 800, margin: '0 auto' }}>
      <H2>Component Style</H2>
      <Body>Select the shape language for your components.</Body>
      <HStack spacing={2}>
        <Button variant="outline" color="neutral" onClick={onBack}>Back</Button>
        <Button color="primary" onClick={onNext}>Next</Button>
      </HStack>
    </VStack>
  );
}
