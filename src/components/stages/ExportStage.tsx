import { Button, H2, Body, VStack, HStack } from '@dynodesign/components';
import type { StageProps } from '../../types';

export default function ExportStage({ onNext, onBack }: StageProps) {
  return (
    <VStack spacing={4} style={{ padding: '64px 24px', maxWidth: 800, margin: '0 auto' }}>
      <H2>Export Options</H2>
      <Body>Download your design system files.</Body>
      <HStack spacing={2}>
        <Button variant="outline" color="neutral" onClick={onBack}>Back</Button>
        <Button color="primary" onClick={onNext}>Done</Button>
      </HStack>
    </VStack>
  );
}
