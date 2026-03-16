import { Button, H2, Body, VStack, TextField, HStack } from '@dynodesign/components';
import { useState } from 'react';
import type { StageProps } from '../../types';

interface Props extends StageProps {
  onSubmit: (name: string, date: string) => void;
}

export default function DesignSystemNameStage({ onNext, onBack, onSubmit }: Props) {
  const [name, setName] = useState('');
  const date = new Date().toLocaleDateString();

  const handleNext = () => {
    if (name.trim()) {
      onSubmit(name.trim(), date);
      onNext();
    }
  };

  return (
    <VStack spacing={4} style={{ padding: '64px 24px', maxWidth: 600, margin: '0 auto' }}>
      <H2>Name Your Design System</H2>
      <TextField
        label="Design System Name"
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        placeholder="e.g., My Brand System"
      />
      <Body>Created: {date}</Body>
      <HStack spacing={2}>
        <Button variant="outline" color="neutral" onClick={onBack}>Back</Button>
        <Button color="primary" onClick={handleNext} disabled={!name.trim()}>Next</Button>
      </HStack>
    </VStack>
  );
}
