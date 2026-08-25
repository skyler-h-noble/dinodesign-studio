import { useEffect, useState } from 'react';
import { Modal, Button, Body, BodySmall, VStack, HStack, TextField, Alert } from '@omni-design/components';
import { isDesignNameTaken } from '../utils/designSystemNames';

interface Props {
  open: boolean;
  /** The name that collided with an existing design the user owns. */
  currentName: string;
  /** Signed-in user's uid — the namespace uniqueness is checked against. */
  userId: string;
  /** The in-progress draft's id, excluded from the check so it isn't seen as its own duplicate. */
  excludeId?: string;
  onClose: () => void;
  /** Called with the new, confirmed-unique name. */
  onConfirm: (newName: string) => void;
}

// Shown after sign-in when the in-progress design's name matches one the user
// already owns (an anonymous build named the same as an existing design, only
// caught once they authenticate). Lets them rename without losing any work —
// the whole build stays in memory; only the name changes.
export default function RenameDesignModal({ open, currentName, userId, excludeId, onClose, onConfirm }: Props) {
  const [name, setName] = useState(currentName);
  const [checking, setChecking] = useState(false);
  const [taken, setTaken] = useState(true); // starts taken — it's the colliding name

  // Reset to the colliding name each time the modal opens.
  useEffect(() => {
    if (open) { setName(currentName); setTaken(true); setChecking(false); }
  }, [open, currentName]);

  // Debounced uniqueness check as they type a new name.
  useEffect(() => {
    if (!open) return;
    const trimmed = name.trim();
    if (!trimmed) { setTaken(false); setChecking(false); return; }
    setChecking(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const isTaken = await isDesignNameTaken(userId, trimmed, excludeId);
        if (!cancelled) { setTaken(isTaken); setChecking(false); }
      } catch {
        if (!cancelled) { setTaken(false); setChecking(false); }
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [name, open, userId, excludeId]);

  const trimmed = name.trim();
  const canConfirm = trimmed.length > 0 && !taken && !checking;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canConfirm) handleConfirm();
  };

  return (
    <Modal open={open} onClose={onClose} title="Rename your design system">
      <VStack spacing={3} style={{ minWidth: 340, maxWidth: 420, width: '100%', margin: '0 auto' }}>
        <Body>
          You already have a design system named “{currentName}”. Pick a different
          name for this one to keep them separate.
        </Body>
        <TextField
          label="Design System Name"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Acme Brand System"
          size="medium"
          validation={taken && trimmed ? 'error' : undefined}
          validationMessage={taken && trimmed ? 'You already have a design system with this name.' : undefined}
        />
        {taken && trimmed && (
          <Alert variant="light" color="error" size="small">
            You already have a design system with this name. Pick a different name.
          </Alert>
        )}
        <HStack spacing={2} justifyContent="flex-end">
          <Button variant="primary-outline" size="medium" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="medium" onClick={handleConfirm} disabled={!canConfirm}>
            {checking ? 'Checking…' : 'Continue'}
          </Button>
        </HStack>
        <BodySmall color="quiet" style={{ textAlign: 'center' }}>
          Your colors, typography, and components are all kept — only the name changes.
        </BodySmall>
      </VStack>
    </Modal>
  );
}
