import { Alert, Button, H2, Body, BodySmall, VStack, HStack, TextField, Card } from '@dynodesign/components';
import { useEffect, useState } from 'react';
import type { StageProps } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { isDesignNameTaken } from '../../utils/designSystemNames';

interface Props extends StageProps {
  onSubmit: (name: string, date: string) => void;
}

export default function DesignSystemNameStage({ onNext, onBack, onSubmit }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [checking, setChecking] = useState(false);
  const [nameTaken, setNameTaken] = useState(false);
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Debounced uniqueness check. Only runs when the user is signed in — at this
  // stage they may still be anonymous and we'll re-check at save time anyway.
  useEffect(() => {
    if (!user) { setNameTaken(false); setChecking(false); return; }
    const trimmed = name.trim();
    if (!trimmed) { setNameTaken(false); setChecking(false); return; }
    setChecking(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const taken = await isDesignNameTaken(user.uid, trimmed);
        if (!cancelled) { setNameTaken(taken); setChecking(false); }
      } catch {
        if (!cancelled) { setNameTaken(false); setChecking(false); }
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [name, user]);

  const trimmed = name.trim();
  const canProceed = trimmed.length > 0 && !nameTaken && !checking;

  const handleNext = async () => {
    if (!trimmed) return;
    // Final guard before advancing. Anon users will re-check at save time.
    if (user && await isDesignNameTaken(user.uid, trimmed)) {
      setNameTaken(true);
      return;
    }
    onSubmit(trimmed, date);
    onNext();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canProceed) {
      handleNext();
    }
  };

  return (
    <VStack spacing={4} alignItems="center" style={{ padding: '80px 24px' }}>
      <VStack spacing={1} alignItems="center">
        <H2 style={{ textAlign: 'center' }}>Name Your Design System</H2>
        <Body style={{ color: 'var(--Quiet)', textAlign: 'center' }}>
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
            validation={nameTaken ? 'error' : undefined}
            validationMessage={nameTaken ? 'You already have a design system with this name.' : undefined}
          />
          {nameTaken && (
            <Alert variant="light" color="error" size="small">
              You already have a design system with this name. Pick a different name.
            </Alert>
          )}
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Created: {date}
          </BodySmall>
        </VStack>
      </Card>

      <HStack spacing={2}>
        <Button variant="primary-outline" size="medium" onClick={onBack}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="medium"
          onClick={handleNext}
          disabled={!canProceed}
          sx={{
            backgroundColor: 'var(--Text)',
            color: 'var(--Background)',
            borderColor: 'var(--Text)',
            '&:hover': { backgroundColor: 'var(--Text)', opacity: 0.85, borderColor: 'var(--Text)' },
          }}
        >
          Next
        </Button>
      </HStack>
    </VStack>
  );
}
