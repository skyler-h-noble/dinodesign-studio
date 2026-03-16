import { Button, H2, Body, BodySmall, VStack, HStack, TextField, Card } from '@dynodesign/components';
import { useState } from 'react';
import type { StageProps } from '../../types';

interface Props extends StageProps {
  onSubmit: (name: string, date: string) => void;
}

export default function DesignSystemNameStage({ onNext, onBack, onSubmit }: Props) {
  const [name, setName] = useState('');
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleNext = () => {
    if (name.trim()) {
      onSubmit(name.trim(), date);
      onNext();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleNext();
    }
  };

  return (
    <VStack spacing={4} alignItems="center" style={{ padding: '80px 24px' }}>
      <VStack spacing={1} alignItems="center">
        <H2>Name Your Design System</H2>
        <Body style={{ color: 'var(--Quiet)' }}>
          Give your design system a name to get started
        </Body>
      </VStack>

      <Card padding="large" style={{ maxWidth: 480, width: '100%' }}>
        <VStack spacing={3}>
          <TextField
            label="Design System Name"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Acme Brand System"
            size="medium"
          />
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Created: {date}
          </BodySmall>
        </VStack>
      </Card>

      <HStack spacing={2}>
        <Button variant="outline" color="neutral" onClick={onBack}>
          Back
        </Button>
        <Button color="primary" onClick={handleNext} disabled={!name.trim()}>
          Next
        </Button>
      </HStack>
    </VStack>
  );
}
