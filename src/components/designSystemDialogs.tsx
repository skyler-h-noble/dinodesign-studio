import { useEffect, useState } from 'react';
import {
  Body, BodySmall, VStack, HStack, Button,
  Modal, TextField, Alert,
} from '@dynodesign/components';
import {
  collection, doc, deleteDoc, updateDoc, getDocs, writeBatch,
} from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { deleteDesignSystemFiles } from '../utils/firebase/storage';
import { isDesignNameTaken } from '../utils/designSystemNames';
import { useAuth } from '../contexts/AuthContext';

/** Shared rename + delete dialogs for design systems. Used from the My Designs
 *  list card and from the design system detail page header. The `target` shape
 *  is narrow on purpose — these dialogs only need the id and current name. */

export interface DesignSystemTarget {
  id: string;
  name: string;
}

export function RenameDesignSystemModal({
  target, onClose, onRenamed,
}: {
  target: DesignSystemTarget | null;
  onClose: () => void;
  onRenamed: (id: string, newName: string) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) { setName(target.name); setError(null); }
  }, [target]);

  if (!target) return null;

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== target.name && !saving;

  const handleSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    setError(null);
    try {
      if (await isDesignNameTaken(user.uid, trimmed, target.id)) {
        setError('You already have a design system with this name.');
        setSaving(false);
        return;
      }
      await updateDoc(doc(db, 'designSystems', target.id), {
        name: trimmed,
        'snapshot.designSystemName': trimmed,
      });
      onRenamed(target.id, trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not rename. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} title="Rename design system">
      <VStack spacing={3} style={{ minWidth: 360 }}>
        <TextField
          label="Design system name"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          size="small"
          disabled={saving}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSave(); }}
        />
        {error && (
          <Alert variant="light" color="error" size="small">{error}</Alert>
        )}
        <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
          <Button variant="primary-outline" size="small" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="default" size="small" onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </HStack>
      </VStack>
    </Modal>
  );
}

export function DeleteDesignSystemModal({
  target, onClose, onDeleted,
}: {
  target: DesignSystemTarget | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) { setConfirmText(''); setError(null); }
  }, [target]);

  if (!target) return null;

  const matches = confirmText === target.name;

  const handleDelete = async () => {
    if (!matches) return;
    setDeleting(true);
    setError(null);
    try {
      // Storage first — if this fails the design system doc still exists
      // and the user can retry, rather than leaving orphaned files.
      await deleteDesignSystemFiles(target.id);

      // Best-effort: clear the events + versions subcollections in batches.
      // Failure here doesn't block the parent doc deletion — orphaned
      // subcollections are invisible once the parent is gone.
      for (const sub of ['events', 'versions']) {
        try {
          const subSnap = await getDocs(collection(db, 'designSystems', target.id, sub));
          if (!subSnap.empty) {
            const batch = writeBatch(db);
            subSnap.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        } catch (subErr) {
          console.warn(`Failed to clear ${sub} subcollection:`, subErr);
        }
      }

      await deleteDoc(doc(db, 'designSystems', target.id));
      onDeleted(target.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not delete. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} title="Delete this design system?">
      <VStack spacing={3} style={{ minWidth: 380, maxWidth: 460 }}>
        <Body style={{ color: 'var(--Text)' }}>
          This will permanently delete <strong>{target.name}</strong>, its hosted
          files, the Figma export, and all history. This action cannot be undone.
        </Body>
        <BodySmall style={{ color: 'var(--Quiet)' }}>
          To confirm, type the name of the design system below.
        </BodySmall>
        <TextField
          label={target.name}
          value={confirmText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmText(e.target.value)}
          size="small"
          disabled={deleting}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' && matches) handleDelete(); }}
        />
        {error && (
          <Alert variant="light" color="error" size="small">{error}</Alert>
        )}
        <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
          <Button variant="primary-outline" size="small" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="error"
            size="small"
            onClick={handleDelete}
            disabled={!matches || deleting}
          >
            {deleting ? 'Deleting…' : 'Delete this design system'}
          </Button>
        </HStack>
      </VStack>
    </Modal>
  );
}

/** MISSING-LIB-COMPONENT: Popover
 *  Needed for: ellipsis dropdown anchored to a trigger button — used by the
 *  card on MyDesignsPage and the header on DesignSystemDetail.
 *  Proposed API: <Popover anchorEl={el} open onClose>{children}</Popover>
 *  Lib-track: add to @dynodesign/components/src/components/Popover/
 *
 *  Until the lib ships one, this is a small portal-positioned dropdown
 *  anchored via getBoundingClientRect, closes on outside-click + Escape. */
export function MenuButton({
  onClick, children,
}: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '8px 14px',
        background: 'transparent',
        border: 'none',
        color: 'var(--Text)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--Hover, rgba(0,0,0,0.05))')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Body component="span" style={{ display: 'block' }}>{children}</Body>
    </button>
  );
}
