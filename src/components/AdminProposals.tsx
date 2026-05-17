// MISSING-LIB-COMPONENT: FileInput
// Needed for: admin upload of the master .fig template
// Proposed API: <FileInput accept=".fig" onChange={file => ...} />
// Lib-track: add to @dynodesign/components/src/components/FileInput/
import { useEffect, useRef, useState } from 'react';
import {
  H2, H3, H4, Body, BodySmall, VStack, HStack, Card, Button, Chip, Alert, Divider,
} from '@dynodesign/components';
import {
  collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc,
} from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { useAuth } from '../contexts/AuthContext';
import { uploadFigmaTemplate, FIGMA_TEMPLATE_FILENAME } from '../utils/firebase/storage';
import AppHeader from './AppHeader';

interface Proposal {
  id: string;
  componentName: string;
  useCase: string;
  proposedApi: string;
  implementation: string;
  sourceFilePath: string | null;
  libVersion: string | null;
  submittedBy: string | null;
  notes: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'inLib';
  submittedAt: Date | null;
}

type StatusFilter = 'pending' | 'accepted' | 'rejected' | 'inLib' | 'all';

const STATUS_LABELS: Record<Proposal['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  inLib: 'In Library',
};

const STATUS_COLORS: Record<Proposal['status'], 'warning' | 'success' | 'error' | 'primary'> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'error',
  inLib: 'primary',
};

export default function AdminProposals() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (cancelled) return;
        setIsAdmin(userDoc.exists() && userDoc.data().isAdmin === true);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Pull all, filter client-side. Volume should stay tiny; if it grows,
        // switch to a per-status query.
        const snap = await getDocs(query(
          collection(db, 'componentProposals'),
          orderBy('submittedAt', 'desc'),
        ));
        if (cancelled) return;
        const list: Proposal[] = [];
        snap.forEach(d => {
          const data = d.data() as any;
          list.push({
            id: d.id,
            componentName: data.componentName || 'Untitled',
            useCase: data.useCase || '',
            proposedApi: data.proposedApi || '',
            implementation: data.implementation || '',
            sourceFilePath: data.sourceFilePath || null,
            libVersion: data.libVersion || null,
            submittedBy: data.submittedBy || null,
            notes: data.notes || null,
            status: (data.status as Proposal['status']) || 'pending',
            submittedAt: data.submittedAt?.toDate?.() || null,
          });
        });
        setProposals(list);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load proposals');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  const filtered = filter === 'all' ? proposals : proposals.filter(p => p.status === filter);

  if (isAdmin === null) {
    return (
      <>
        <AppHeader />
        <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
          <Body style={{ color: 'var(--Quiet)' }}>Checking access…</Body>
        </VStack>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <AppHeader />
        <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
          <H2>Not authorized</H2>
          <Body style={{ color: 'var(--Quiet)' }}>
            This page is restricted to DynoDesign admins.
          </Body>
        </VStack>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <VStack spacing={4} style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <VStack spacing={0}>
          <H2 style={{ margin: 0 }}>Component Proposals</H2>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Submissions from `@dynodesign/components` consumers via `/ShareComponent`.
          </BodySmall>
        </VStack>

        <FigmaTemplateUploader />

        {/* Status filter */}
        <HStack spacing={1}>
          {(['pending', 'accepted', 'rejected', 'inLib', 'all'] as const).map(s => {
            const count = s === 'all' ? proposals.length : proposals.filter(p => p.status === s).length;
            return (
              <Button
                key={s}
                variant={filter === s ? 'default' : 'outline'}
                size="small"
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]} ({count})
              </Button>
            );
          })}
        </HStack>

        {error && <Alert variant="light" color="error" size="small">{error}</Alert>}

        {loading ? (
          <Body style={{ color: 'var(--Quiet)' }}>Loading…</Body>
        ) : filtered.length === 0 ? (
          <Card padding="medium">
            <Body style={{ color: 'var(--Quiet)' }}>
              No {filter === 'all' ? '' : filter + ' '}proposals.
            </Body>
          </Card>
        ) : (
          <VStack spacing={3}>
            {filtered.map(p => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onStatusChange={(status) => {
                  setProposals(prev => prev.map(x => x.id === p.id ? { ...x, status } : x));
                }}
              />
            ))}
          </VStack>
        )}
      </VStack>
    </>
  );
}

function ProposalCard({
  proposal, onStatusChange,
}: { proposal: Proposal; onStatusChange: (status: Proposal['status']) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setStatus = async (status: Proposal['status']) => {
    setBusy(true);
    setErr(null);
    try {
      await updateDoc(doc(db, 'componentProposals', proposal.id), {
        ...proposal,
        status,
        // Strip the fields the rule requires unchanged so we don't accidentally
        // mutate them via spread.
        componentName: proposal.componentName,
        proposedApi: proposal.proposedApi,
        implementation: proposal.implementation,
      });
      onStatusChange(status);
    } catch (e: any) {
      setErr(e?.message || 'Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="medium">
      <VStack spacing={2}>
        <HStack spacing={2} style={{ alignItems: 'center', width: '100%' }}>
          <H3 style={{ margin: 0, flex: 1 }}>{proposal.componentName}</H3>
          <Chip
            label={STATUS_LABELS[proposal.status]}
            size="small"
            variant={STATUS_COLORS[proposal.status]}
          />
        </HStack>

        <BodySmall style={{ color: 'var(--Quiet)' }}>
          {proposal.submittedAt?.toLocaleString() || 'Unknown date'}
          {proposal.libVersion ? ` · v${proposal.libVersion}` : ''}
          {proposal.sourceFilePath ? ` · ${proposal.sourceFilePath}` : ''}
          {proposal.submittedBy ? ` · ${proposal.submittedBy}` : ''}
        </BodySmall>

        <Divider />

        <BodySmall style={{ fontWeight: 600 }}>Use case</BodySmall>
        <Body>{proposal.useCase}</Body>

        <BodySmall style={{ fontWeight: 600 }}>Proposed API</BodySmall>
        <CodeBlock>{proposal.proposedApi}</CodeBlock>

        <BodySmall style={{ fontWeight: 600 }}>Inline implementation</BodySmall>
        <CodeBlock>{proposal.implementation}</CodeBlock>

        {proposal.notes && (
          <>
            <BodySmall style={{ fontWeight: 600 }}>Notes</BodySmall>
            <Body>{proposal.notes}</Body>
          </>
        )}

        {err && <Alert variant="light" color="error" size="small">{err}</Alert>}

        <HStack spacing={2}>
          <Button variant="success" size="small" disabled={busy || proposal.status === 'accepted'} onClick={() => setStatus('accepted')}>
            Accept
          </Button>
          <Button variant="primary" size="small" disabled={busy || proposal.status === 'inLib'} onClick={() => setStatus('inLib')}>
            Mark as in library
          </Button>
          <Button variant="error-outline" size="small" disabled={busy || proposal.status === 'rejected'} onClick={() => setStatus('rejected')}>
            Reject
          </Button>
          <Button variant="primary-outline" size="small" disabled={busy || proposal.status === 'pending'} onClick={() => setStatus('pending')}>
            Reopen
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
}

function FigmaTemplateUploader() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const upload = async () => {
    if (!pending) return;
    setBusy(true);
    setErr(null);
    setSuccess(null);
    try {
      await uploadFigmaTemplate(pending);
      setSuccess(`Uploaded ${pending.name} as ${FIGMA_TEMPLATE_FILENAME}.`);
      setPending(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="medium">
      <VStack spacing={2}>
        <H4 style={{ margin: 0 }}>Figma template</H4>
        <BodySmall style={{ color: 'var(--Quiet)' }}>
          The master .fig file every user downloads from their dashboard.
          Overwrites <code>figma-templates/{FIGMA_TEMPLATE_FILENAME}</code> in Storage.
        </BodySmall>

        {/* Raw <input type="file"> hidden; Button triggers the picker.
            The lib has no FileInput yet (see MISSING-LIB-COMPONENT tag at top of file). */}
        <input
          ref={fileRef}
          type="file"
          accept=".fig"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setPending(f);
            setErr(null);
            setSuccess(null);
          }}
        />

        <HStack spacing={2} style={{ alignItems: 'center' }}>
          <Button
            variant="primary-outline"
            size="small"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Choose .fig file
          </Button>
          {pending && (
            <BodySmall style={{ color: 'var(--Text)' }}>
              {pending.name} ({Math.round(pending.size / 1024)} KB)
            </BodySmall>
          )}
        </HStack>

        {err && <Alert variant="light" color="error" size="small">{err}</Alert>}
        {success && <Alert variant="light" color="success" size="small">{success}</Alert>}

        <HStack spacing={2}>
          <Button
            variant="primary"
            size="small"
            disabled={!pending || busy}
            onClick={upload}
          >
            {busy ? 'Uploading…' : 'Upload template'}
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      data-surface="Container-Lowest"
      style={{
        margin: 0,
        padding: 12,
        background: 'var(--Background)',
        border: '1px solid var(--Border)',
        borderRadius: 'var(--Style-Border-Radius, 6px)',
        fontSize: 12,
        lineHeight: 1.5,
        overflowX: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      {children}
    </pre>
  );
}
