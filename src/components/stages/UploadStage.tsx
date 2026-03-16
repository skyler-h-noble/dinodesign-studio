import { Button, H2, Body, VStack, HStack } from '@dynodesign/components';
import type { StageProps } from '../../types';

export default function UploadStage({ onNext, onBack }: StageProps) {
  return (
    <VStack spacing={4} style={{ padding: '64px 24px', maxWidth: 600, margin: '0 auto' }}>
      <H2>Upload Mood Board</H2>
      <Body>Upload an image to extract colors and styles for your design system.</Body>
      <div
        style={{
          border: '2px dashed var(--Border)',
          borderRadius: 'var(--Style-Border-Radius)',
          padding: '64px 24px',
          textAlign: 'center',
          cursor: 'pointer',
        }}
      >
        <Body>Drag and drop an image here, or click to browse</Body>
      </div>
      <HStack spacing={2}>
        <Button variant="outline" color="neutral" onClick={onBack}>Back</Button>
        <Button color="primary" onClick={onNext}>Next</Button>
      </HStack>
    </VStack>
  );
}
