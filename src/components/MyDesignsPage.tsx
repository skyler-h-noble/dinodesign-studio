import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  H2, Body, BodySmall, VStack, HStack, Card, Button, Select,
} from '@dynodesign/components';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { getPublicFileUrl } from '../utils/firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { loadGoogleFonts } from '../utils/googleFontsManager';
import AppHeader from './AppHeader';
import {
  RenameDesignSystemModal, DeleteDesignSystemModal, RegenerateDesignSystemModal, MenuButton,
} from './designSystemDialogs';

interface LinkedFigmaFile {
  fileKey: string;
  fileName: string;
  lastSeenAt: Date | null;
}

interface DesignSystem {
  id: string;
  name: string;
  createdAt: string;
  /** Sort keys: timestamps in ms. `recencyMs` prefers updatedAt (last
   *  reprocess) and falls back to createdAt for designs that haven't been
   *  re-exported yet. */
  recencyMs: number;
  colors: string[];
  componentStyle: string;
  headerFontFamily: string | null;
  status: 'hosted' | 'expired';
  addOns: string[];
  pendingChanges: number;
  /** True before the very first Figma push, so the pill can read
   *  "Not yet pushed to Figma" instead of "1 change not pushed". */
  neverPushed: boolean;
  linkedFigmaFiles: LinkedFigmaFile[];
  moodBoardUrl: string | null;
}

type SortKey = 'recent' | 'oldest' | 'name-asc' | 'name-desc';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
];

function figmaFileUrl(fileKey: string, fileName?: string): string {
  const slug = (fileName || 'design').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'design';
  return `https://www.figma.com/file/${encodeURIComponent(fileKey)}/${encodeURIComponent(slug)}`;
}

function FigmaGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 38 57" fill="none" aria-hidden="true">
      <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE"/>
      <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
      <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
      <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
      <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
    </svg>
  );
}

export default function MyDesignsPage() {
  const { user } = useAuth();
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<DesignSystem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DesignSystem | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<DesignSystem | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('recent');

  const sortedDesigns = useMemo(() => {
    const out = [...designSystems];
    switch (sortBy) {
      case 'recent':
        out.sort((a, b) => b.recencyMs - a.recencyMs);
        break;
      case 'oldest':
        out.sort((a, b) => a.recencyMs - b.recencyMs);
        break;
      case 'name-asc':
        out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        break;
      case 'name-desc':
        out.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
        break;
    }
    return out;
  }, [designSystems, sortBy]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const dsSnap = await getDocs(query(
          collection(db, 'designSystems'),
          where('userId', '==', user.uid),
        ));
        const list: DesignSystem[] = [];
        dsSnap.forEach(d => {
          const data = d.data() as any;
          const addOns: string[] = [];
          if (data.monthlyAddOns?.playground) addOns.push('Playground');
          if (data.monthlyAddOns?.storybook) addOns.push('Storybook');
          if (data.monthlyAddOns?.designerPortal) addOns.push('Designer Portal');
          const v = Number(data.version || 0);
          const pushed = Number(data.lastPushedVersion || 0);
          const linkedRaw: any[] = Array.isArray(data.linkedFigmaFiles) ? data.linkedFigmaFiles : [];
          const linked: LinkedFigmaFile[] = linkedRaw
            .map(r => ({
              fileKey: String(r.fileKey || ''),
              fileName: String(r.fileName || ''),
              lastSeenAt: r.lastSeenAt?.toDate?.() || (r.lastSeenAt ? new Date(r.lastSeenAt) : null),
            }))
            .filter(f => f.fileKey)
            .sort((a, b) => (b.lastSeenAt?.getTime() || 0) - (a.lastSeenAt?.getTime() || 0));
          const moodBoardUrl = (typeof data.moodBoardUrl === 'string' && data.moodBoardUrl)
            ? data.moodBoardUrl
            : getPublicFileUrl(d.id, 'moodboard.png');
          const createdDate: Date | null = data.createdAt?.toDate?.() || null;
          const updatedDate: Date | null = data.updatedAt?.toDate?.() || null;
          const recencyMs = (updatedDate?.getTime() || createdDate?.getTime() || 0);
          list.push({
            id: d.id,
            name: data.name || 'Untitled',
            createdAt: createdDate?.toLocaleDateString() || 'Unknown',
            recencyMs,
            colors: data.colors || [],
            componentStyle: data.componentStyle || 'modern',
            headerFontFamily: data.headerFontFamily || null,
            status: data.plan === 'cancelled' || data.plan === 'expired' ? 'expired' : 'hosted',
            addOns,
            pendingChanges: v > pushed ? v - pushed : 0,
            neverPushed: pushed === 0,
            linkedFigmaFiles: linked,
            moodBoardUrl,
          });
        });
        if (cancelled) return;
        setDesignSystems(list);
        const fonts = Array.from(new Set(list.map(s => s.headerFontFamily).filter(Boolean))) as string[];
        if (fonts.length) loadGoogleFonts(fonts).catch(() => {});
      } catch (err) {
        console.error('Failed to load design systems:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleRenamed = (id: string, newName: string) => {
    setDesignSystems(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
  };

  const handleDeleted = (id: string) => {
    setDesignSystems(prev => prev.filter(d => d.id !== id));
  };

  if (!user) {
    return (
      <>
        <AppHeader />
        <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
          <H2>My Designs</H2>
          <Body style={{ color: 'var(--Quiet)' }}>Sign in to see your design systems.</Body>
        </VStack>
      </>
    );
  }
  if (loading) {
    return (
      <>
        <AppHeader />
        <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
          <H2>My Designs</H2>
          <Body style={{ color: 'var(--Quiet)' }}>Loading…</Body>
        </VStack>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <VStack spacing={4} style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <HStack spacing={2} style={{ alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <VStack spacing={0} style={{ flex: 1, minWidth: 220 }}>
            <H2 style={{ margin: 0 }}>My Designs</H2>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              {designSystems.length === 0
                ? 'No design systems yet — create your first one.'
                : `${designSystems.length} design${designSystems.length === 1 ? '' : 's'}`}
            </BodySmall>
          </VStack>
          {designSystems.length > 1 && (
            <div style={{ minWidth: 180, flexShrink: 0 }}>
              <Select
                label="Sort by"
                size="small"
                fullWidth
                value={sortBy}
                onChange={(val: string) => setSortBy(val as SortKey)}
                options={SORT_OPTIONS}
              />
            </div>
          )}
        </HStack>

        {designSystems.length === 0 ? (
          <Card padding="medium">
            <VStack spacing={2} alignItems="center">
              <Body style={{ color: 'var(--Quiet)' }}>No design systems yet</Body>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Upload a mood board to extract colors and generate a complete design system.
              </BodySmall>
              <Button variant="default" size="small" onClick={() => window.location.href = '/create'}>
                Create a design system
              </Button>
            </VStack>
          </Card>
        ) : (
          <div style={{
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}>
            {sortedDesigns.map(ds => (
              <DesignSystemCard
                key={ds.id}
                ds={ds}
                onRename={() => setRenameTarget(ds)}
                onDelete={() => setDeleteTarget(ds)}
                onRegenerate={() => setRegenerateTarget(ds)}
              />
            ))}
          </div>
        )}
      </VStack>

      <RenameDesignSystemModal
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={handleRenamed}
      />
      <DeleteDesignSystemModal
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={handleDeleted}
      />
      <RegenerateDesignSystemModal
        target={regenerateTarget}
        onClose={() => setRegenerateTarget(null)}
        onRegenerated={() => {
          // Refresh nothing critical at the list level — the card already
          // shows v + pending-changes derived from the doc, which updates
          // on next visit. Keep this lightweight to avoid a full reload.
          setRegenerateTarget(null);
        }}
      />
    </>
  );
}

function DesignSystemCard({
  ds, onRename, onDelete, onRegenerate,
}: { ds: DesignSystem; onRename: () => void; onDelete: () => void; onRegenerate: () => void }) {
  const [moodBoardOk, setMoodBoardOk] = useState(true);
  // The lib's Menu component reads its open state from a Dropdown context, so
  // the `open` / `anchorEl` props we'd pass are ignored and the menu never
  // renders. Inline a small portal-positioned dropdown instead — anchored to
  // the button via getBoundingClientRect so it escapes the Card's overflow.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  // Removed [render] diagnostic — confirmed state flows correctly.

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (menuButtonRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);
  const headerStyle: React.CSSProperties = ds.headerFontFamily
    ? { fontFamily: `'${ds.headerFontFamily}', serif`, fontWeight: 700, fontSize: '1rem', margin: 0, lineHeight: 1.2 }
    : { fontWeight: 700, fontSize: '1rem', margin: 0, lineHeight: 1.2 };

  const showHero = !!ds.moodBoardUrl && moodBoardOk;
  const swatches = (ds.colors.length ? ds.colors : ['#666', '#999', '#ccc']).slice(0, 3);

  return (
    <Card padding="small">
      <VStack spacing={2}>
        {/* Hero — mood board, or color swatch fallback */}
        {showHero ? (
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 10',
            borderRadius: 6,
            overflow: 'hidden',
            background: 'var(--Container-Lowest, #f5f5f5)',
            border: '1px solid var(--Border)',
          }}>
            <img
              src={ds.moodBoardUrl!}
              alt={`${ds.name} mood board`}
              loading="lazy"
              onError={() => setMoodBoardOk(false)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        ) : (
          <div style={{
            display: 'flex',
            gap: 4,
            width: '100%',
            aspectRatio: '16 / 10',
            borderRadius: 6,
            overflow: 'hidden',
          }}>
            {swatches.map((c, i) => (
              <div key={i} style={{ flex: 1, background: c }} />
            ))}
          </div>
        )}

        {/* Name + ellipsis menu */}
        <HStack spacing={1} style={{ alignItems: 'flex-start', minWidth: 0 }}>
          <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ ...headerStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ds.name}
            </h3>
            <BodySmall style={{ color: 'var(--Quiet)', fontSize: 11 }}>
              {ds.createdAt}
              {ds.addOns.length > 0 && ` · ${ds.addOns.join(' · ')}`}
            </BodySmall>
          </VStack>

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
              padding: 4,
              borderRadius: 4,
              color: 'var(--Quiet)',
              display: 'flex',
              flexShrink: 0,
            }}
          >
            <MoreVertIcon style={{ fontSize: 18 }} />
          </button>
          {menuOpen && menuPos && createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: 'absolute',
                top: menuPos.top,
                right: menuPos.right,
                minWidth: 140,
                background: 'var(--Container, #fff)',
                border: '1px solid var(--Border, #d4d4d4)',
                borderRadius: 'var(--Style-Border-Radius, 6px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
                padding: '4px 0',
                zIndex: 1300,
                color: 'var(--Text)',
              }}
            >
              <MenuButton
                onClick={() => { setMenuOpen(false); onRegenerate(); }}
              >
                Regenerate
              </MenuButton>
              <MenuButton
                onClick={() => { setMenuOpen(false); onRename(); }}
              >
                Rename
              </MenuButton>
              <MenuButton
                onClick={() => { setMenuOpen(false); onDelete(); }}
              >
                Delete
              </MenuButton>
            </div>,
            document.body,
          )}
        </HStack>

        {/* Swatches strip — only when hero is the mood board */}
        {showHero && (
          <HStack spacing={1}>
            {swatches.map((c, i) => (
              <div key={i} style={{
                width: 18, height: 18, borderRadius: 4,
                background: c, border: '1px solid var(--Border)',
              }} />
            ))}
          </HStack>
        )}

        {/* Linked Figma file — first one only at this size */}
        {ds.linkedFigmaFiles.length > 0 && (
          <Button
            variant="primary-outline"
            size="small"
            startIcon={<FigmaGlyph />}
            style={{ width: '100%' }}
            onClick={() => window.open(
              figmaFileUrl(ds.linkedFigmaFiles[0].fileKey, ds.linkedFigmaFiles[0].fileName),
              '_blank',
              'noopener',
            )}
          >
            {ds.linkedFigmaFiles.length === 1
              ? `Open in Figma`
              : `Open in Figma (+${ds.linkedFigmaFiles.length - 1})`}
          </Button>
        )}

        <Button
          variant="primary"
          size="small"
          startIcon={<OpenInNewIcon style={{ fontSize: 14 }} />}
          style={{ width: '100%' }}
          onClick={() => window.location.href = `/my-designs/${ds.id}`}
        >
          Open
        </Button>

        {/* Pending changes — content-sized pill, centered, so the tag
            background sits inset within the card padding rather than
            filling the entire card content width. Two cases: never-pushed
            (just-created) reads "Not yet pushed to Figma"; subsequent
            updates show the change count. */}
        {ds.pendingChanges > 0 && (
          <div style={{
            color: 'var(--Text-Warning, #5d4037)',
            fontSize: 11,
            background: 'var(--Warning-Color-11, #fff8e1)',
            padding: '4px 10px',
            borderRadius: 999,
            alignSelf: 'center',
            maxWidth: '100%',
          }}>
            {ds.neverPushed
              ? 'Not yet pushed to Figma'
              : `${ds.pendingChanges} ${ds.pendingChanges === 1 ? 'change' : 'changes'} not pushed`}
          </div>
        )}
      </VStack>
    </Card>
  );
}

