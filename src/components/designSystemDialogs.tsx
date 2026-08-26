import { useEffect, useState } from 'react';
import {
  Body,
  BodySmall,
  VStack,
  HStack,
  Button,
  Modal,
  TextInput,
  Alert,
  LinearProgress,
} from '@omni-design/components';
import {
  collection, doc, deleteDoc, updateDoc, getDocs, writeBatch,
  getDoc, setDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { deleteDesignSystemFiles } from '../utils/firebase/storage';
import { isDesignNameTaken } from '../utils/designSystemNames';
import { generateAndUploadDesignSystem } from '../utils/generateDesignSystem';
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
        <TextInput
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
          <Button variant="default-outline" size="small" onClick={onClose} disabled={saving}>
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
        <BodySmall color="quiet">
          To confirm, type the name of the design system below.
        </BodySmall>
        <TextInput
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
          <Button variant="default-outline" size="small" onClick={onClose} disabled={deleting}>
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

/**
 * Regenerate ONE design system, in place.
 *
 * Pulled out of the modal so "Regenerate all" runs this exact path rather than
 * a second copy of it. A duplicated version bump or history write stays correct
 * for a month and then quietly stops matching — and this writes to Firestore,
 * so a divergence is not something a refresh undoes.
 *
 * Throws on failure; the caller decides whether to stop or carry on.
 */
export async function regenerateDesignSystem(target: DesignSystemTarget): Promise<number> {
  const t0 = performance.now();
  console.log(`\u{1F504} [Regenerate] Starting for ${target.id} (${target.name})`);

  const snap = await getDoc(doc(db, 'designSystems', target.id));
  if (!snap.exists()) throw new Error('Design system not found.');
  const data = snap.data() as any;
  const snapshot = data.snapshot;
  if (!snapshot || !snapshot.colorScheme || !snapshot.userSelections) {
    throw new Error('No rehydration snapshot stored \u2014 re-export from the editor once to populate it.');
  }

  const nextVersion = Number(data.version || 0) + 1;

  // Re-run the generator with the saved snapshot. Output overwrites the
  // canonical files in design-systems/{id}/... \u2014 the same paths the hosted
  // playground reads from.
  await generateAndUploadDesignSystem({ ...snapshot, uuid: target.id, version: nextVersion });

  await setDoc(doc(db, 'designSystems', target.id), {
    updatedAt: serverTimestamp(),
    version: nextVersion,
  }, { merge: true });

  await setDoc(doc(db, 'designSystems', target.id, 'versions', String(nextVersion)), {
    version: nextVersion,
    createdAt: serverTimestamp(),
    name: data.name || target.name,
    componentStyle: data.componentStyle || 'modern',
    colors: Array.isArray(data.colors) ? data.colors : [],
    headerFontFamily: data.headerFontFamily || null,
    snapshot,
  });

  await addDoc(collection(db, 'designSystems', target.id, 'events'), {
    kind: 'regenerated',
    version: nextVersion,
    at: serverTimestamp(),
    summary: `Regenerated as v${nextVersion} (no setting changes)`,
  });

  console.log(`\u2705 [Regenerate] ${target.name} done in ${Math.round(performance.now() - t0)}ms; now at v${nextVersion}`);
  return nextVersion;
}

export function RegenerateDesignSystemModal({
  target, onClose, onRegenerated,
}: {
  target: DesignSystemTarget | null;
  onClose: () => void;
  onRegenerated: (id: string, newVersion: number) => void;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) { setError(null); setRegenerating(false); }
  }, [target]);

  if (!target) return null;

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const nextVersion = await regenerateDesignSystem(target);
      onRegenerated(target.id, nextVersion);
      onClose();
    } catch (err: any) {
      console.error('Regenerate failed:', err);
      setError(err?.message || 'Could not regenerate. Try again.');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Modal open={!!target} onClose={regenerating ? () => {} : onClose} title="Regenerate design system?">
      <VStack spacing={3} style={{ minWidth: 380, maxWidth: 460 }}>
        <Body>
          This rebuilds <strong>{target.name}</strong>'s hosted CSS, tokens,
          and Figma files using the current snapshot. Settings stay the same —
          this is for picking up generator improvements (new tokens, fixes,
          etc.) without walking through the edit flow.
        </Body>
        <BodySmall color="quiet">
          The version number bumps by 1 and a new history entry is added. The
          previous files are overwritten in place.
        </BodySmall>
        {error && (
          <Alert variant="light" color="error" size="small">{error}</Alert>
        )}
        <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
          <Button variant="default-outline" size="small" onClick={onClose} disabled={regenerating}>
            Cancel
          </Button>
          <Button variant="default" size="small" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? 'Regenerating…' : 'Regenerate'}
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
 *  Lib-track: add to @omni-design/components/src/components/Popover/
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


/**
 * Regenerate EVERY design system, one at a time.
 *
 * Sequential on purpose. Each run re-executes the whole generator and uploads a
 * full set of files; firing nine at once would compete for the same Storage
 * bucket and Firestore quota, and a rate-limit part-way through would leave an
 * unknown subset regenerated. One at a time means the progress line is true and
 * a failure names exactly where it stopped.
 *
 * A failure does NOT abort the run. Regenerating is idempotent — it reads the
 * stored snapshot and bumps a version — so the useful outcome after one system
 * fails is that the other eight are current, with the failure reported rather
 * than blocking them. Systems with no rehydration snapshot are the common case
 * there, and no amount of retrying fixes those.
 */
export function RegenerateAllDesignSystemsModal({
  open, targets, onClose, onDone,
}: {
  open: boolean;
  targets: DesignSystemTarget[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const [failures, setFailures] = useState<Array<{ name: string; message: string }>>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (open) {
      setRunning(false); setDoneCount(0); setCurrent(null);
      setFailures([]); setFinished(false);
    }
  }, [open]);

  if (!open) return null;

  const total = targets.length;

  const runAll = async () => {
    setRunning(true);
    const failed: Array<{ name: string; message: string }> = [];
    for (const [i, t] of targets.entries()) {
      setCurrent(t.name);
      setDoneCount(i);
      try {
        await regenerateDesignSystem(t);
      } catch (err: any) {
        console.error(`Regenerate failed for ${t.name}:`, err);
        failed.push({ name: t.name, message: err?.message || 'Unknown error' });
        setFailures([...failed]);
      }
    }
    setDoneCount(total);
    setCurrent(null);
    setFinished(true);
    setRunning(false);
    onDone();
  };

  const succeeded = doneCount - failures.length;

  return (
    <Modal
      open={open}
      onClose={running ? () => {} : onClose}
      title={finished ? 'Regenerate complete' : `Regenerate all ${total} design systems?`}
    >
      <VStack spacing={3} style={{ minWidth: 420, maxWidth: 520 }}>
        {!running && !finished && (
          <>
            <Body>
              This rebuilds every design system&rsquo;s hosted CSS, tokens and Figma
              files from its stored snapshot. Settings stay the same &mdash; it is for
              picking up generator improvements without walking through each edit flow.
            </Body>
            <BodySmall color="quiet">
              Each system&rsquo;s version bumps by 1 and gains a history entry, and its
              previous files are overwritten in place. They run one at a time, so this
              takes a while. A system that fails is reported and the rest carry on.
            </BodySmall>
          </>
        )}

        {(running || finished) && (
          <VStack spacing={2}>
            {/* The lib's LinearProgress takes `value` alone — it has no
                `variant` prop, and an unknown one would land on the DOM. */}
            <LinearProgress value={total ? Math.round((doneCount / total) * 100) : 0} />
            <BodySmall color="quiet">
              {finished
                ? `${succeeded} of ${total} regenerated${failures.length ? `, ${failures.length} failed` : ''}.`
                : `${doneCount} of ${total} done${current ? ` \u2014 regenerating ${current}\u2026` : '\u2026'}`}
            </BodySmall>
          </VStack>
        )}

        {failures.length > 0 && (
          <Alert variant="light" color="error" size="small">
            <VStack spacing={1}>
              {failures.map((f) => (
                <BodySmall key={f.name}>
                  <strong>{f.name}</strong>: {f.message}
                </BodySmall>
              ))}
            </VStack>
          </Alert>
        )}

        <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
          {!finished && (
            <Button variant="default-outline" size="small" onClick={onClose} disabled={running}>
              Cancel
            </Button>
          )}
          {finished ? (
            <Button variant="default" size="small" onClick={onClose}>Close</Button>
          ) : (
            <Button variant="default" size="small" onClick={runAll} disabled={running || total === 0}>
              {running ? 'Regenerating\u2026' : `Regenerate all ${total}`}
            </Button>
          )}
        </HStack>
      </VStack>
    </Modal>
  );
}
