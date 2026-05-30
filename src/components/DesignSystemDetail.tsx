import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { createPortal } from 'react-dom';
import JSZip from 'jszip';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Tabs, TabList, Tab, TextField,
  Breadcrumbs, BreadcrumbItem,
  Modal, Chip,
} from '@dynodesign/components';
import ComputerIcon from '@mui/icons-material/Computer';
import CodeIcon from '@mui/icons-material/Code';
import GridViewIcon from '@mui/icons-material/GridView';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { doc, getDoc, collection, query, where, getDocs, setDoc, addDoc, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { getPublicFileUrl, getFigmaTemplateUrl } from '../utils/firebase/storage';
import { LIB_DYNAMIC_CSS_FILES } from '../utils/cssgen/exportToCSS';
import { loadGoogleFonts } from '../utils/googleFontsManager';
import { useAuth } from '../contexts/AuthContext';
import { buildPreviewCSS } from '../utils/buildPreviewCSS';
import { generateAndUploadDesignSystem } from '../utils/generateDesignSystem';
import AppHeader from './AppHeader';
import {
  RenameDesignSystemModal, DeleteDesignSystemModal, RegenerateDesignSystemModal, MenuButton,
} from './designSystemDialogs';
import '../styles/export.css';

/**
 * Design system detail page — accessed from the My Designs tab. Three inner
 * tabs: Use My Design (export-stage hub), Settings (subscription/payment),
 * History (creation date + future events).
 */

interface LinkedFigmaFile {
  fileKey: string;
  fileName: string;
  fileUrl: string | null;
  lastSeenAt: Date | null;
}

interface Record {
  name: string;
  colors: string[];
  headerFontFamily: string | null;
  componentStyle: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  version: number;
  lastPushedVersion: number;
  lastPushedAt: Date | null;
  monthlyAddOns?: { playground?: boolean; designerPortal?: boolean };
  plan?: string;
  linkedFigmaFiles: LinkedFigmaFile[];
  /** Full rehydration snapshot from the design system doc — used here to
   *  drive brand-themed rendering of the detail page itself, so the app
   *  chrome adopts the user's design system once they've created one. */
  snapshot: any | null;
}

function figmaFileUrl(file: LinkedFigmaFile): string {
  if (file.fileUrl) return file.fileUrl;
  const slug = (file.fileName || 'design').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
  return `https://www.figma.com/design/${encodeURIComponent(file.fileKey)}/${encodeURIComponent(slug)}`;
}

function FigmaGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.5)} viewBox="0 0 38 57" fill="none" aria-hidden="true">
      <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
      <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
      <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
      <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
      <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
    </svg>
  );
}

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
}

interface EventRecord {
  id: string;
  kind: 'created' | 'updated' | 'pushed' | string;
  version: number;
  at: Date | null;
  summary?: string;
}

interface VersionRecord {
  id: string;
  version: number;
  createdAt: Date | null;
  name: string;
  componentStyle: string;
  colors: string[];
  headerFontFamily: string | null;
  snapshot: any;
}

type Status = 'loading' | 'ready' | 'not-found';
type Inner = 'use' | 'settings' | 'history';

export default function DesignSystemDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [record, setRecord] = useState<Record | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [tab, setTab] = useState<Inner>('use');
  const [showFigmaUpdateModal, setShowFigmaUpdateModal] = useState(false);
  const [showFigmaImportModal, setShowFigmaImportModal] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<VersionRecord | null>(null);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reprocessed') === '1') {
      setShowFigmaUpdateModal(true);
      params.delete('reprocessed');
      const next = window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash;
      window.history.replaceState(null, '', next);
    }
  }, []);

  async function loadVersions(designId: string) {
    try {
      const vSnap = await getDocs(query(
        collection(db, 'designSystems', designId, 'versions'),
        orderBy('version', 'desc'),
      ));
      const list: VersionRecord[] = [];
      vSnap.forEach(d => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          version: Number(data.version || 0),
          createdAt: data.createdAt?.toDate?.() || null,
          name: data.name || '',
          componentStyle: data.componentStyle || 'modern',
          colors: Array.isArray(data.colors) ? data.colors : [],
          headerFontFamily: data.headerFontFamily || null,
          snapshot: data.snapshot,
        });
      });
      setVersions(list);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  }

  async function loadEvents(designId: string) {
    try {
      const evSnap = await getDocs(query(
        collection(db, 'designSystems', designId, 'events'),
        orderBy('at', 'desc'),
        limit(50),
      ));
      const list: EventRecord[] = [];
      evSnap.forEach(d => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          kind: data.kind || 'updated',
          version: Number(data.version || 0),
          at: data.at?.toDate?.() || null,
          summary: data.summary || undefined,
        });
      });
      setEvents(list);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  }

  useEffect(() => {
    if (!id) { setStatus('not-found'); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'designSystems', id));
        if (!snap.exists()) {
          if (!cancelled) setStatus('not-found');
          return;
        }
        const data = snap.data() as any;
        const linkedRaw: any[] = Array.isArray(data.linkedFigmaFiles) ? data.linkedFigmaFiles : [];
        const linked: LinkedFigmaFile[] = linkedRaw
          .map(f => ({
            fileKey: String(f.fileKey || ''),
            fileName: String(f.fileName || ''),
            fileUrl: f.fileUrl ? String(f.fileUrl) : null,
            lastSeenAt: f.lastSeenAt?.toDate?.() || (f.lastSeenAt ? new Date(f.lastSeenAt) : null),
          }))
          .filter(f => f.fileKey)
          .sort((a, b) => (b.lastSeenAt?.getTime() || 0) - (a.lastSeenAt?.getTime() || 0));
        const r: Record = {
          name: data.name || 'Untitled',
          colors: Array.isArray(data.colors) ? data.colors.slice(0, 3) : [],
          headerFontFamily: data.headerFontFamily || null,
          componentStyle: data.componentStyle || 'modern',
          createdAt: data.createdAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
          version: Number(data.version || 0),
          lastPushedVersion: Number(data.lastPushedVersion || 0),
          lastPushedAt: data.lastPushedAt?.toDate?.() || null,
          monthlyAddOns: data.monthlyAddOns,
          plan: data.plan,
          linkedFigmaFiles: linked,
          snapshot: data.snapshot || null,
        };
        if (cancelled) return;
        setRecord(r);
        setStatus('ready');
        if (r.headerFontFamily) loadGoogleFonts([r.headerFontFamily]).catch(() => {});

        // Load payments tied to this user (filtered to this design system if
        // the payment record carries a designSystemId; otherwise show all).
        if (user) {
          const paySnap = await getDocs(query(collection(db, 'payments'), where('userId', '==', user.uid)));
          const pays: PaymentRecord[] = [];
          paySnap.forEach(d => {
            const pd = d.data() as any;
            pays.push({
              id: d.id,
              date: pd.date?.toDate?.()?.toLocaleDateString() || 'Unknown',
              description: pd.description || '',
              amount: pd.amount || 0,
              status: pd.status || 'paid',
            });
          });
          if (!cancelled) setPayments(pays);
        }
        if (!cancelled) await loadEvents(id);
        if (!cancelled) await loadVersions(id);
      } catch (err) {
        console.error('Failed to load design system:', err);
        if (!cancelled) setStatus('not-found');
      }
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  if (status === 'loading') {
    return (
      <>
        <AppHeader />
        <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
          <Body style={{ color: 'var(--Quiet)' }}>Loading design system…</Body>
        </VStack>
      </>
    );
  }
  if (status === 'not-found' || !record || !id) {
    return (
      <>
        <AppHeader />
        <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
          <H2>Design system not found</H2>
          <Button variant="primary-outline" onClick={() => window.location.href = '/account#my-designs'}>
            Back to My Designs
          </Button>
        </VStack>
      </>
    );
  }

  const headerStyle: React.CSSProperties = record.headerFontFamily
    ? { fontFamily: `'${record.headerFontFamily}', serif` }
    : {};
  const colors = record.colors.length ? record.colors : ['#666', '#999', '#ccc'];

  return (
    <>
      <BrandCSSInjector snapshot={record.snapshot} />
      <main data-theme="Brand" data-surface="Surface" style={{ minHeight: '100vh', background: 'var(--Background)' }}>
      <AppHeader />
      <VStack spacing={4} style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <Breadcrumbs size="small">
          <BreadcrumbItem href="/my-designs">My Designs</BreadcrumbItem>
          <BreadcrumbItem>{record.name || 'Untitled'}</BreadcrumbItem>
        </Breadcrumbs>
        {/* Header strip — name in user's font, swatches, ID with copy */}
        <DetailHeader
          record={record}
          id={id}
          headerStyle={headerStyle}
          colors={colors}
          onRequestRename={() => setRenameOpen(true)}
          onRequestDelete={() => setDeleteOpen(true)}
          onRequestRegenerate={() => setRegenerateOpen(true)}
          onMarkPushed={async () => {
            try {
              await setDoc(doc(db, 'designSystems', id), {
                lastPushedAt: serverTimestamp(),
                lastPushedVersion: record.version,
              }, { merge: true });
              await addDoc(collection(db, 'designSystems', id, 'events'), {
                kind: 'pushed',
                version: record.version,
                at: serverTimestamp(),
                summary: `Marked v${record.version} as pushed to Figma`,
              });
              setRecord({
                ...record,
                lastPushedAt: new Date(),
                lastPushedVersion: record.version,
              });
              loadEvents(id);
            } catch (err) {
              console.error('Failed to mark as pushed:', err);
            }
          }}
        />

        <Tabs value={tab} onChange={(v: Inner) => setTab(v)}>
          <TabList aria-label="Design system sections">
            <Tab value="use">Use My Design</Tab>
            <Tab value="settings">Settings</Tab>
            <Tab value="history">History</Tab>
          </TabList>
        </Tabs>

        {tab === 'use' && <UseMyDesignTab id={id} record={record} onOpenFigmaImport={() => setShowFigmaImportModal(true)} />}
        {tab === 'settings' && <SettingsTab id={id} record={record} payments={payments} />}
        {tab === 'history' && (
          <VersionsTab
            record={record}
            versions={versions}
            restoringVersionId={restoringVersionId}
            onRequestRestore={setRestoreTarget}
          />
        )}
      </VStack>
      </main>

      <FigmaUpdateModal
        open={showFigmaUpdateModal}
        onClose={() => setShowFigmaUpdateModal(false)}
        hasLinkedFile={record.linkedFigmaFiles.length > 0}
      />

      <FigmaImportModal
        open={showFigmaImportModal}
        onClose={() => setShowFigmaImportModal(false)}
        id={id}
        name={record.name}
      />

      <RenameDesignSystemModal
        target={renameOpen ? { id, name: record.name } : null}
        onClose={() => setRenameOpen(false)}
        onRenamed={(_, newName) => setRecord({ ...record, name: newName })}
      />
      <DeleteDesignSystemModal
        target={deleteOpen ? { id, name: record.name } : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => { window.location.href = '/my-designs'; }}
      />
      <RegenerateDesignSystemModal
        target={regenerateOpen ? { id, name: record.name } : null}
        onClose={() => setRegenerateOpen(false)}
        onRegenerated={(_, newVersion) => {
          setRecord({ ...record, version: newVersion, updatedAt: new Date() });
          loadVersions(id);
          loadEvents(id);
        }}
      />

      <RestoreVersionModal
        target={restoreTarget}
        currentVersion={record.version}
        restoring={restoringVersionId === restoreTarget?.id}
        onClose={() => { if (!restoringVersionId) setRestoreTarget(null); }}
        onConfirm={async () => {
          if (!restoreTarget) return;
          setRestoringVersionId(restoreTarget.id);
          try {
            const docSnap = await getDoc(doc(db, 'designSystems', id));
            const data = docSnap.exists() ? docSnap.data() as any : {};
            const prevVersion = Number(data.version || 0);
            const nextVersion = prevVersion + 1;

            // Re-run the generator using the historical snapshot. The
            // generator overwrites the canonical CSS/JSON files in
            // Firebase Storage at design-systems/{id}/...
            await generateAndUploadDesignSystem({
              ...restoreTarget.snapshot,
              uuid: id,
              version: nextVersion,
            });

            // Update the parent doc + create a fresh versions/{N} entry so
            // the restore is itself a version (auditable + restorable again).
            await setDoc(doc(db, 'designSystems', id), {
              updatedAt: serverTimestamp(),
              version: nextVersion,
              colors: restoreTarget.colors,
              componentStyle: restoreTarget.componentStyle,
              headerFontFamily: restoreTarget.headerFontFamily,
              name: restoreTarget.name,
              snapshot: restoreTarget.snapshot,
            }, { merge: true });

            await setDoc(doc(db, 'designSystems', id, 'versions', String(nextVersion)), {
              version: nextVersion,
              createdAt: serverTimestamp(),
              name: restoreTarget.name,
              componentStyle: restoreTarget.componentStyle,
              colors: restoreTarget.colors,
              headerFontFamily: restoreTarget.headerFontFamily,
              snapshot: restoreTarget.snapshot,
            });

            await addDoc(collection(db, 'designSystems', id, 'events'), {
              kind: 'restored',
              version: nextVersion,
              at: serverTimestamp(),
              summary: `Restored v${restoreTarget.version} as v${nextVersion}`,
            });

            setRecord({
              ...record,
              version: nextVersion,
              updatedAt: new Date(),
              colors: restoreTarget.colors,
              componentStyle: restoreTarget.componentStyle,
              headerFontFamily: restoreTarget.headerFontFamily,
              name: restoreTarget.name,
              snapshot: restoreTarget.snapshot,
            });
            await loadVersions(id);
            await loadEvents(id);
            setRestoreTarget(null);
          } catch (err) {
            console.error('Restore failed:', err);
            alert('Restore failed. Check the console for details.');
          } finally {
            setRestoringVersionId(null);
          }
        }}
      />
    </>
  );
}

/**
 * Builds the design system's brand CSS from its snapshot (the same shape
 * the create flow stores in Firestore) and injects it into the document
 * head. Pair with `data-theme="Brand"` on a container so the page chrome
 * adopts the user's tokens instead of DinoDesign's defaults.
 */
function BrandCSSInjector({ snapshot }: { snapshot: any | null }) {
  const css = useMemo(() => {
    if (!snapshot || !snapshot.colorScheme || !snapshot.userSelections) return '';
    try {
      return buildPreviewCSS({
        colorScheme: snapshot.colorScheme,
        userSelections: snapshot.userSelections,
        componentStyle: snapshot.componentStyle || 'modern',
        mode: 'light',
        typographyStyles: snapshot.typographyStyles,
      });
    } catch (err) {
      console.error('Failed to build brand CSS for detail page:', err);
      return '';
    }
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot?.typographyStyles?.length) return;
    const families = snapshot.typographyStyles
      .map((t: any) => t?.family)
      .filter((f: any): f is string => typeof f === 'string' && f.length > 0);
    if (families.length) loadGoogleFonts(families).catch(() => {});
  }, [snapshot]);

  if (!css) return null;
  return <style id="dino-detail-brand-css" dangerouslySetInnerHTML={{ __html: css }} />;
}

function FigmaUpdateModal({ open, onClose, hasLinkedFile }: { open: boolean; onClose: () => void; hasLinkedFile: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Update your Figma file" size="medium">
      <VStack spacing={3}>
        <Body>
          Your design system has been reprocessed and republished. To pull the
          latest tokens into Figma, open the DinoDesign plugin and run an
          update.
        </Body>
        <Card padding="medium">
          <VStack spacing={2}>
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
              In Figma
            </BodySmall>
            <Step n={1} body="Open your linked Figma file." />
            <Step n={2} body="Open the DinoDesign plugin from Plugins → Development." />
            <Step n={3} body="Click Update Design System. The plugin already has your ID — no need to re-enter it." />
            <Step n={4} body="Wait for the run to finish. Your styles, variables, and components will refresh in place." />
          </VStack>
        </Card>
        {!hasLinkedFile && (
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Once the plugin finishes the import, your Figma file will appear in
            the Settings tab under "Linked Figma files."
          </BodySmall>
        )}
        <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
          <Button variant="primary" onClick={onClose}>Got it</Button>
        </HStack>
      </VStack>
    </Modal>
  );
}

function Step({ n, body }: { n: number; body: string }) {
  return (
    <HStack spacing={2} style={{ alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0,
        width: 24,
        height: 24,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--Buttons-Primary-Button)',
        color: 'var(--Buttons-Primary-Text)',
        fontSize: '0.75rem',
        fontWeight: 700,
      }}>{n}</div>
      <BodySmall style={{ flex: 1, paddingTop: 2 }}>{body}</BodySmall>
    </HStack>
  );
}

function DetailHeader({ record, id, headerStyle, colors, onMarkPushed, onRequestRename, onRequestDelete, onRequestRegenerate }: { record: Record; id: string; headerStyle: React.CSSProperties; colors: string[]; onMarkPushed: () => Promise<void>; onRequestRename: () => void; onRequestDelete: () => void; onRequestRegenerate: () => void }) {
  const [copied, setCopied] = useState(false);
  const [marking, setMarking] = useState(false);
  // Portal-anchored ellipsis menu — the lib's Menu silent-fails without a
  // Dropdown ancestor (see CLAUDE.md), so this mirrors the MyDesignsPage card
  // pattern: anchor to the trigger via getBoundingClientRect, portal to body,
  // close on outside-click + Escape.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (menuButtonRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);
  const handleCopy = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const pending = record.version > record.lastPushedVersion ? record.version - record.lastPushedVersion : 0;
  return (
    <Card padding="medium">
      <VStack spacing={3}>
        <HStack spacing={3} style={{ alignItems: 'center' }}>
          <HStack spacing={1} style={{ flexShrink: 0 }}>
            {colors.slice(0, 3).map((c, i) => (
              <div key={i} style={{ width: 44, height: 44, borderRadius: 8, background: c, border: '1px solid var(--Border)' }} />
            ))}
          </HStack>
          <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ ...headerStyle, margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>{record.name}</h2>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              {record.componentStyle} · v{record.version} · created {record.createdAt?.toLocaleDateString() || 'unknown'}
            </BodySmall>
          </VStack>
          <HStack spacing={1} style={{ flexShrink: 0, alignItems: 'center' }}>
            <Button
              variant="primary-outline"
              size="small"
              onClick={() => window.location.href = `/create?id=${id}`}
            >
              Edit
            </Button>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuPos({
                  top: rect.bottom + window.scrollY + 4,
                  right: window.innerWidth - rect.right - window.scrollX,
                });
                setMenuOpen(prev => !prev);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 4,
                color: 'var(--Quiet)',
                display: 'flex',
              }}
            >
              <MoreVertIcon style={{ fontSize: 20 }} />
            </button>
            {menuOpen && menuPos && createPortal(
              <div
                ref={menuRef}
                role="menu"
                style={{
                  position: 'absolute',
                  top: menuPos.top,
                  right: menuPos.right,
                  minWidth: 160,
                  background: 'var(--Container, #fff)',
                  border: '1px solid var(--Border, #d4d4d4)',
                  borderRadius: 'var(--Style-Border-Radius, 6px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
                  padding: '4px 0',
                  zIndex: 1300,
                  color: 'var(--Text)',
                }}
              >
                <MenuButton onClick={() => { setMenuOpen(false); onRequestRegenerate(); }}>
                  Regenerate
                </MenuButton>
                <MenuButton onClick={() => { setMenuOpen(false); onRequestRename(); }}>
                  Rename
                </MenuButton>
                <MenuButton onClick={() => { setMenuOpen(false); onRequestDelete(); }}>
                  Delete
                </MenuButton>
              </div>,
              document.body,
            )}
          </HStack>
        </HStack>
        {pending > 0 && (
          <HStack spacing={2} style={{
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--Warning-Color-11, #fff8e1)',
            border: '1px solid var(--Buttons-Warning-Border, #ffd54f)',
            fontSize: 12,
            alignItems: 'center',
          }}>
            <BodySmall style={{ flex: 1 }}>
              <strong>{pending} {pending === 1 ? 'change' : 'changes'}</strong> not yet pushed to Figma. Re-import in the plugin to sync.
            </BodySmall>
            <Button
              variant="primary-outline"
              size="small"
              disabled={marking}
              onClick={async () => {
                setMarking(true);
                try { await onMarkPushed(); } finally { setMarking(false); }
              }}
            >
              {marking ? 'Marking…' : 'Mark as pushed'}
            </Button>
          </HStack>
        )}
        <HStack spacing={1} style={{ alignItems: 'center' }}>
          <BodySmall style={{ color: 'var(--Quiet)', flexShrink: 0, width: 24 }}>ID:</BodySmall>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextField
              value={id || ''}
              size="small"
              fullWidth
              InputProps={{ readOnly: true }}
              onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
              endAdornment={
                <Button
                  variant="ghost"
                  size="small"
                  onClick={handleCopy}
                  startIcon={<ContentCopyIcon style={{ fontSize: 16 }} />}
                  sx={{ minWidth: 0, padding: '2px 8px' }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              }
            />
          </div>
        </HStack>
      </VStack>
    </Card>
  );
}

function UseMyDesignTab({ id, record, onOpenFigmaImport }: { id: string; record: Record; onOpenFigmaImport: () => void }) {
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedClaude, setCopiedClaude] = useState(false);
  const copyTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  useEffect(() => () => { copyTimers.current.forEach(clearTimeout); }, []);
  const handleCopy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    const t = setTimeout(() => { setter(false); copyTimers.current.delete(t); }, 2000);
    copyTimers.current.add(t);
  };

  const showcaseBase = 'https://designology.netlify.app';
  const playgroundUrl = `${showcaseBase}/?user=${id}`;
  const claudeMdUrl = `${window.location.origin}/api/tokens/${id}/md`;
  const installCmd = `npm install @dynodesign/components && npx @dynodesign/init ${id}`;

  return (
    <VStack spacing={5}>
    <div className="export-cards-grid">
      <Card padding="medium">
        <VStack spacing={3}>
          <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Primary-Button)', color: 'var(--Buttons-Primary-Text)' }}>
            <ComputerIcon />
          </div>
          <H3 style={{ fontSize: '1.1rem' }}>Hosted Design System</H3>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            View your complete design system with all components rendered with your brand tokens.
          </BodySmall>
          <Button variant="primary" style={{ width: '100%' }} onClick={() => window.open(playgroundUrl, '_blank')}>
            Open Playground
          </Button>
        </VStack>
      </Card>

      <Card padding="medium">
        <VStack spacing={3}>
          <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#fff' }}>
            <svg width="20" height="20" viewBox="0 0 38 57" fill="none">
              <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
              <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
              <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
              <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
              <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
            </svg>
          </div>
          <H3 style={{ fontSize: '1.1rem' }}>Figma Design System</H3>
          {record.linkedFigmaFiles.length > 0 ? (
            <>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Your design system is live in Figma. Jump straight to the file.
              </BodySmall>
              <Button
                variant="primary"
                style={{ width: '100%' }}
                onClick={() => window.open(figmaFileUrl(record.linkedFigmaFiles[0]), '_blank', 'noopener')}
              >
                Jump to your Figma File
              </Button>
            </>
          ) : (
            <>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Get a full Figma design system with your brand tokens applied to every component, style, and variable.
              </BodySmall>
              <Button
                variant="primary"
                style={{ width: '100%' }}
                onClick={onOpenFigmaImport}
              >
                Get your design into Figma
              </Button>
            </>
          )}
        </VStack>
      </Card>

      <Card padding="medium">
        <VStack spacing={3}>
          <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Tertiary-Button)', color: 'var(--Buttons-Tertiary-Text)' }}>
            <CodeIcon />
          </div>
          <H3 style={{ fontSize: '1.1rem' }}>Add to Your Code Project</H3>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Install the DinoDesign component library and connect your design system to your React project.
          </BodySmall>
          <VStack spacing={1} style={{ width: '100%' }}>
            <BodySmall style={{ fontWeight: 600 }}>Run in your terminal:</BodySmall>
            <div className="export-code-block">
              <code>{installCmd}</code>
              <Button variant="primary-outline" size="small" onClick={() => handleCopy(installCmd, setCopiedInstall)} style={{ flexShrink: 0 }}>
                {copiedInstall ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </VStack>
        </VStack>
      </Card>

      <Card padding="medium">
        <VStack spacing={3}>
          <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Secondary-Button)', color: 'var(--Buttons-Secondary-Text)' }}>
            <GridViewIcon />
          </div>
          <H3 style={{ fontSize: '1.1rem' }}>Start Using in AI</H3>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Connect your design system to Cursor, Claude Code, or any AI coding assistant.
          </BodySmall>
          <VStack spacing={1} style={{ width: '100%' }}>
            <BodySmall style={{ fontWeight: 600 }}>CLAUDE.md URL:</BodySmall>
            <div className="export-code-block">
              <code>{claudeMdUrl}</code>
              <Button variant="primary-outline" size="small" onClick={() => handleCopy(claudeMdUrl, setCopiedClaude)} style={{ flexShrink: 0 }}>
                {copiedClaude ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </VStack>
        </VStack>
      </Card>

      <Card padding="medium">
        <VStack spacing={3}>
          <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Success-Button)', color: 'var(--Buttons-Success-Text)' }}>
            <CheckCircleOutlineIcon />
          </div>
          <H3 style={{ fontSize: '1.1rem' }}>Accessibility Report</H3>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Detailed contrast report for every background, surface, and container.
          </BodySmall>
          <Button
            variant="primary"
            style={{ width: '100%' }}
            onClick={() => window.open(`/accessibility-report?id=${id}`, '_blank', 'noopener')}
          >
            Open Accessibility Report
          </Button>
        </VStack>
      </Card>

      <Card padding="medium" sx={{ gridColumn: '1 / -1' }}>
        <VStack spacing={2}>
          <BodySmall style={{ fontWeight: 600 }}>Download All Files</BodySmall>
          <Button
            variant="primary-outline"
            style={{ width: '100%' }}
            onClick={async () => {
              const zip = new JSZip();
              const files = ['foundation.css', 'core.css', 'typography-tokens.css', 'Light-Mode.css', 'Dark-Mode.css', 'base.css', 'styles.css', 'tokens.json', 'figma.json', 'DINO-TOKENS.md', 'theme.json'];
              for (const f of files) {
                try {
                  const res = await fetch(getPublicFileUrl(id, f));
                  if (res.ok) zip.file(f, await res.text());
                } catch { /* skip */ }
              }
              try {
                const moodRes = await fetch(getPublicFileUrl(id, 'moodboard.png'));
                if (moodRes.ok) zip.file('mood-board.png', await moodRes.blob());
              } catch { /* skip */ }
              const blob = await zip.generateAsync({ type: 'blob' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${record.name || 'design-system'}.zip`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            Download All (.zip)
          </Button>
          <Button
            variant="primary-outline"
            style={{ width: '100%' }}
            onClick={async () => {
              type DirHandle = FileSystemDirectoryHandle & {
                queryPermission?: (d: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
                requestPermission?: (d: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
              };
              type WritableFile = { createWritable: () => Promise<{ write: (c: string) => Promise<void>; close: () => Promise<void> }> };
              const w = window as unknown as { showDirectoryPicker?: (opts?: unknown) => Promise<DirHandle> };
              if (!w.showDirectoryPicker) {
                alert('Your browser doesn’t support direct folder writes. Use Chrome or Edge for this.');
                return;
              }

              // IndexedDB persistence so the folder is remembered between sessions.
              const DB_NAME = 'dynodesign-studio';
              const STORE = 'handles';
              const KEY = 'dinodesign-public-styles';
              const openDB = () => new Promise<IDBDatabase>((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = () => req.result.createObjectStore(STORE);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
              });
              const idbGet = async (): Promise<DirHandle | null> => {
                const db = await openDB();
                return new Promise(resolve => {
                  const tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
                  tx.onsuccess = () => resolve((tx.result as DirHandle) ?? null);
                  tx.onerror = () => resolve(null);
                });
              };
              const idbSet = async (h: DirHandle) => {
                const db = await openDB();
                return new Promise<void>(resolve => {
                  const tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(h, KEY);
                  tx.onsuccess = () => resolve();
                  tx.onerror = () => resolve();
                });
              };

              try {
                let dirHandle = await idbGet();
                if (dirHandle) {
                  const perm = (await dirHandle.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
                  if (perm !== 'granted') {
                    const requested = await dirHandle.requestPermission?.({ mode: 'readwrite' });
                    if (requested !== 'granted') dirHandle = null;
                  }
                }
                if (!dirHandle) {
                  dirHandle = await w.showDirectoryPicker({
                    id: 'dinodesign-public-styles',
                    mode: 'readwrite',
                    startIn: 'documents',
                  });
                  await idbSet(dirHandle);
                }

                let written = 0;
                for (const f of LIB_DYNAMIC_CSS_FILES) {
                  try {
                    const res = await fetch(getPublicFileUrl(id, f));
                    if (!res.ok) continue;
                    const content = await res.text();
                    const fh = await dirHandle.getFileHandle(f, { create: true });
                    const writable = await (fh as unknown as WritableFile).createWritable();
                    await writable.write(content);
                    await writable.close();
                    written += 1;
                  } catch (e) {
                    console.error(`Failed to write ${f}:`, e);
                  }
                }
                alert(`Pushed ${written} of ${LIB_DYNAMIC_CSS_FILES.length} dynamic CSS files to DinoDesign.`);
              } catch (err) {
                if ((err as { name?: string })?.name !== 'AbortError') {
                  console.error('Push to local DinoDesign failed:', err);
                  alert('Push failed. See console for details.');
                }
              }
            }}
          >
            Push to local DinoDesign
          </Button>
          <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
            Writes the 3 dynamic CSS files (base / Light-Mode / Dark-Mode) into your DinoDesign repo folder. Chrome/Edge only. First click prompts you to pick the folder; after that it remembers.
          </BodySmall>
        </VStack>
      </Card>
    </div>

    </VStack>
  );
}

function FigmaImportModal({
  open, onClose, id, name,
}: { open: boolean; onClose: () => void; id: string; name: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Get your design into Figma" size="medium">
      <VStack spacing={3} style={{ paddingTop: 8 }}>
        <FigmaStep n={1} title="Download your Figma file">
          <VStack spacing={2}>
            <BodySmall>
              Download the DinoDesign Figma file. We'll rename it to match your design system so it's easy to find in Figma.
            </BodySmall>
            <div>
              <Button
                variant="primary"
                size="small"
                onClick={async () => {
                  try {
                    const res = await fetch(getFigmaTemplateUrl(), { cache: 'no-cache' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const safe = (name || 'design-system')
                      .trim()
                      .replace(/[\\/:*?"<>|]+/g, '-')
                      .replace(/\s+/g, ' ')
                      || 'design-system';
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `${safe}.fig`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                  } catch (err) {
                    console.error('Figma template download failed:', err);
                    alert('Could not download the Figma file. Please try again.');
                  }
                }}
              >
                Download {(name || 'design-system')}.fig
              </Button>
            </div>
          </VStack>
        </FigmaStep>
        <FigmaStep
          n={2}
          title="Import into Figma"
          body="Open Figma and import your file by dragging and dropping the .fig file into the Figma home screen, or click Import and select the downloaded file."
        />
        <FigmaStep
          n={3}
          title="Open the file"
          body="Once imported, open the file. You'll land on the Almost There page, which walks you through connecting your branded design system."
        />
        <FigmaStep
          n={4}
          title="Install the DinoDesign Plugin"
          body="From the Almost There page, install the DinoDesign Plugin directly in Figma."
        />
        <FigmaStep n={5} title="Enter your DinoDesign ID">
          <BodySmall style={{ display: 'block', marginBottom: 8 }}>
            In the plugin, paste in your unique DinoDesign ID:
          </BodySmall>
          <code style={{
            display: 'inline-block',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.85em',
            padding: '4px 10px',
            borderRadius: 4,
            background: 'var(--Container)',
            border: '1px solid var(--Border)',
            wordBreak: 'break-all',
          }}>{id}</code>
        </FigmaStep>
        <FigmaStep
          n={6}
          title="Import your design system"
          body="Press ⌘L to open the URL input field, paste in your Figma file URL, then click Import Design System. Let it run — this is where the magic happens."
        />
        <FigmaStep
          n={7}
          title="Explore"
          body="Once complete, head to the Using Your DinoDesign System page for tips and tricks on getting the most out of your branded design system."
        />
      </VStack>
    </Modal>
  );
}

function FigmaStep({ n, title, body, children }: { n: number; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <HStack spacing={2} style={{ alignItems: 'flex-start' }}>
      <div style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--Buttons-Primary-Button)',
        color: 'var(--Buttons-Primary-Text)',
        fontSize: '0.8rem',
        fontWeight: 700,
      }}>{n}</div>
      <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
        <BodySmall style={{ fontWeight: 600 }}>Step {n} — {title}</BodySmall>
        {body && <BodySmall style={{ color: 'var(--Quiet)' }}>{body}</BodySmall>}
        {children}
      </VStack>
    </HStack>
  );
}

function SettingsTab({ id, record, payments }: { id: string; record: Record; payments: PaymentRecord[] }) {
  const addOns = useMemo(() => {
    const list: string[] = [];
    if (record.monthlyAddOns?.playground) list.push('Playground');
    if (record.monthlyAddOns?.designerPortal) list.push('Designer Portal');
    return list;
  }, [record]);

  return (
    <VStack spacing={3}>
      <Card padding="medium">
        <VStack spacing={2}>
          <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
            Subscription
          </BodySmall>
          <KV k="Plan" v={record.plan || 'design-system (one-time)'} />
          <KV k="Status" v={record.plan === 'cancelled' || record.plan === 'expired' ? 'Expired' : 'Active'} />
        </VStack>
      </Card>

      <Card padding="medium">
        <VStack spacing={2}>
          <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
            Hosting
          </BodySmall>
          <KV k="Tokens" v="Firebase Storage · public read" />
          <HStack spacing={2} style={{ padding: '6px 0', alignItems: 'baseline' }}>
            <BodySmall style={{ color: 'var(--Quiet)', width: 130, flexShrink: 0 }}>Playground URL</BodySmall>
            <a
              href={`https://designology.netlify.app/?user=${id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--Hotlink)',
                textDecoration: 'underline',
                wordBreak: 'break-all',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
              }}
            >
              {`https://designology.netlify.app/?user=${id}`}
            </a>
          </HStack>
        </VStack>
      </Card>

      <Card padding="medium">
        <VStack spacing={2}>
          <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
            Linked Figma files
          </BodySmall>
          {record.linkedFigmaFiles.length === 0 ? (
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              No Figma files linked yet. Pair the DinoDesign plugin from your Account
              page, then run an import — the file you imported into will show up here.
            </BodySmall>
          ) : (
            <VStack spacing={0}>
              {record.linkedFigmaFiles.map(f => (
                <HStack key={f.fileKey} spacing={2} style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--Border)',
                  alignItems: 'center',
                }}>
                  <FigmaGlyph size={14} />
                  <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
                    <BodySmall style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.fileName || 'Untitled file'}
                    </BodySmall>
                    <BodySmall style={{ color: 'var(--Quiet)', fontSize: 11 }}>
                      Last imported{' '}
                      {f.lastSeenAt
                        ? f.lastSeenAt.toLocaleDateString() + ' ' + f.lastSeenAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'unknown'}
                    </BodySmall>
                  </VStack>
                  <Button
                    variant="primary-outline"
                    size="small"
                    onClick={() => window.open(figmaFileUrl(f), '_blank', 'noopener')}
                  >
                    Open in Figma
                  </Button>
                </HStack>
              ))}
            </VStack>
          )}
        </VStack>
      </Card>

      <Card padding="medium">
        <VStack spacing={2}>
          <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
            Add-Ons
          </BodySmall>
          {addOns.length === 0 ? (
            <BodySmall style={{ color: 'var(--Quiet)' }}>None</BodySmall>
          ) : (
            <BodySmall>{addOns.join(' · ')}</BodySmall>
          )}
        </VStack>
      </Card>

      <Card padding="medium">
        <VStack spacing={2}>
          <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
            Payment Details
          </BodySmall>
          {payments.length === 0 ? (
            <BodySmall style={{ color: 'var(--Quiet)' }}>No payments on file</BodySmall>
          ) : (
            <VStack spacing={0}>
              {payments.slice(0, 6).map(p => (
                <HStack key={p.id} spacing={2} style={{ padding: '6px 0', borderBottom: '1px solid var(--Border)' }}>
                  <BodySmall style={{ width: 90, color: 'var(--Quiet)', flexShrink: 0 }}>{p.date}</BodySmall>
                  <BodySmall style={{ flex: 1 }}>{p.description}</BodySmall>
                  <BodySmall style={{ fontWeight: 600, flexShrink: 0 }}>${(p.amount / 100).toFixed(2)}</BodySmall>
                </HStack>
              ))}
            </VStack>
          )}
        </VStack>
      </Card>
    </VStack>
  );
}

function VersionsTab({
  record, versions, restoringVersionId, onRequestRestore,
}: {
  record: Record;
  versions: VersionRecord[];
  restoringVersionId: string | null;
  onRequestRestore: (v: VersionRecord) => void;
}) {
  if (versions.length === 0) {
    return (
      <Card padding="medium">
        <VStack spacing={2}>
          <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
            Versions
          </BodySmall>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            No version snapshots yet. Every time you reprocess this design
            system, a new version snapshot gets stored here so you can
            restore it later.
          </BodySmall>
        </VStack>
      </Card>
    );
  }

  return (
    <Card padding="medium">
      <VStack spacing={2}>
        <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
          Versions
        </BodySmall>
        <VStack spacing={0}>
          {versions.map((v, i) => {
            const isCurrent = v.version === record.version;
            const isRestoring = restoringVersionId === v.id;
            const swatches = (v.colors.length ? v.colors : ['#666', '#999', '#ccc']).slice(0, 3);
            return (
              <HStack
                key={v.id}
                spacing={3}
                style={{
                  padding: '14px 0',
                  borderBottom: i < versions.length - 1 ? '1px solid var(--Border)' : 'none',
                  alignItems: 'center',
                }}
              >
                <HStack spacing={1} style={{ flexShrink: 0 }}>
                  {swatches.map((c, j) => (
                    <div
                      key={j}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: c,
                        border: '1px solid var(--Border)',
                      }}
                    />
                  ))}
                </HStack>
                <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
                  <HStack spacing={1} style={{ alignItems: 'center' }}>
                    <BodySmall style={{ fontWeight: 700 }}>v{v.version}</BodySmall>
                    {isCurrent && (
                      <Chip variant="success-light" size="small" label="Current" />
                    )}
                  </HStack>
                  <BodySmall style={{ color: 'var(--Quiet)', fontSize: 11 }}>
                    {v.componentStyle}
                    {' · '}
                    {v.createdAt
                      ? `${v.createdAt.toLocaleDateString()} ${v.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'unknown date'}
                  </BodySmall>
                </VStack>
                {!isCurrent && (
                  <Button
                    variant="primary-outline"
                    size="small"
                    disabled={isRestoring || restoringVersionId !== null}
                    onClick={() => onRequestRestore(v)}
                  >
                    {isRestoring ? 'Restoring…' : 'Restore this version'}
                  </Button>
                )}
              </HStack>
            );
          })}
        </VStack>
      </VStack>
    </Card>
  );
}

function RestoreVersionModal({
  target, currentVersion, restoring, onClose, onConfirm,
}: {
  target: VersionRecord | null;
  currentVersion: number;
  restoring: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!target) return null;
  return (
    <Modal open onClose={onClose} title={`Restore v${target.version}?`} size="medium">
      <VStack spacing={3}>
        <Body>
          This rebuilds your hosted CSS and JSON files using the v{target.version}
          snapshot and bumps the version number to v{currentVersion + 1}. Nothing is
          lost — your current v{currentVersion} stays in the history and you can
          restore it back any time.
        </Body>
        <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
          <Button variant="primary-outline" size="small" onClick={onClose} disabled={restoring}>
            Cancel
          </Button>
          <Button variant="primary" size="small" onClick={onConfirm} disabled={restoring}>
            {restoring ? 'Restoring…' : `Restore v${target.version}`}
          </Button>
        </HStack>
      </VStack>
    </Modal>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <HStack spacing={2}>
      <BodySmall style={{ color: 'var(--Quiet)', width: 140, flexShrink: 0 }}>{k}</BodySmall>
      <BodySmall>{v}</BodySmall>
    </HStack>
  );
}

