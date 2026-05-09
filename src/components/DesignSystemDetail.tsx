import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import JSZip from 'jszip';
import {
  Button, H2, H3, Body, BodySmall, VStack, HStack, Card, Tabs, Tab,
} from '@dynodesign/components';
import ComputerIcon from '@mui/icons-material/Computer';
import CodeIcon from '@mui/icons-material/Code';
import GridViewIcon from '@mui/icons-material/GridView';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { getPublicFileUrl } from '../utils/firebase/storage';
import { loadGoogleFonts } from '../utils/googleFontsManager';
import { useAuth } from '../contexts/AuthContext';
import AppHeader from './AppHeader';
import '../styles/export.css';

/**
 * Design system detail page — accessed from the My Designs tab. Three inner
 * tabs: Use My Design (export-stage hub), Settings (subscription/payment),
 * History (creation date + future events).
 */

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
  monthlyAddOns?: { playground?: boolean; storybook?: boolean; designerPortal?: boolean };
  plan?: string;
}

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: string;
}

type Status = 'loading' | 'ready' | 'not-found';
type Inner = 'use' | 'settings' | 'history';

export default function DesignSystemDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [record, setRecord] = useState<Record | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tab, setTab] = useState<Inner>('use');

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
      <AppHeader />
      <VStack spacing={4} style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Header strip — name in user's font, swatches, ID with copy */}
        <DetailHeader record={record} id={id} headerStyle={headerStyle} colors={colors} />

        <Tabs
          value={['use', 'settings', 'history'].indexOf(tab)}
          onChange={(_: any, v: number) => setTab(['use', 'settings', 'history'][v] as Inner)}
        >
          <Tab label="Use My Design" />
          <Tab label="Settings" />
          <Tab label="History" />
        </Tabs>

        {tab === 'use' && <UseMyDesignTab id={id} record={record} />}
        {tab === 'settings' && <SettingsTab record={record} payments={payments} />}
        {tab === 'history' && <HistoryTab record={record} />}
      </VStack>
    </>
  );
}

function DetailHeader({ record, id, headerStyle, colors }: { record: Record; id: string; headerStyle: React.CSSProperties; colors: string[] }) {
  const [copied, setCopied] = useState(false);
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
        </HStack>
        {pending > 0 && (
          <div style={{
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--Warning-Color-11, #fff8e1)',
            border: '1px solid var(--Buttons-Warning-Border, #ffd54f)',
            fontSize: 12,
          }}>
            <strong>{pending} {pending === 1 ? 'change' : 'changes'}</strong> not yet pushed to Figma. Re-import in the plugin to sync.
          </div>
        )}
        <HStack spacing={1} style={{ alignItems: 'center', fontSize: 12 }}>
          <BodySmall style={{ color: 'var(--Quiet)', flexShrink: 0 }}>ID:</BodySmall>
          <code style={{
            fontSize: 11, fontFamily: 'SF Mono, Monaco, Consolas, monospace',
            background: 'var(--Container-Lowest, #f5f5f5)',
            padding: '2px 8px', borderRadius: 4, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{id}</code>
          <Button variant="primary-outline" size="small" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
}

function UseMyDesignTab({ id, record }: { id: string; record: Record }) {
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
  const storybookUrl = `${showcaseBase}/storybook/?user=${id}`;
  const claudeMdUrl = `${window.location.origin}/api/tokens/${id}/md`;
  const installCmd = `npm install @dynodesign/components && npx @dynodesign/init ${id}`;

  return (
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
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Get a full Figma design system with your brand tokens applied to every component, style, and variable.
          </BodySmall>
          <Button variant="primary" style={{ width: '100%' }} disabled>
            Open Figma Template (Coming Soon)
          </Button>
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
          <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--Buttons-Error-Button)', color: 'var(--Buttons-Error-Text)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.34.24l-.12 2.71a.18.18 0 0 0 .29.15l1.06-.8.9.7a.18.18 0 0 0 .28-.14L18.65.1l1.33-.1a1.2 1.2 0 0 1 1.28 1.2v21.6A1.2 1.2 0 0 1 20 24l-16.1-.72a1.2 1.2 0 0 1-1.15-1.16L2 2.32a1.2 1.2 0 0 1 1.13-1.27l13.2-.83.01.02zM13.27 9.3c0 .47 3.16.24 3.59-.08 0-3.2-1.72-4.89-4.86-4.89-3.15 0-4.9 1.72-4.9 4.29 0 4.45 6 4.53 6 6.96 0 .7-.32 1.1-1.05 1.1-.96 0-1.35-.49-1.3-2.16 0-.36-3.65-.48-3.77 0-.27 4.03 2.23 5.2 5.1 5.2 2.79 0 4.97-1.49 4.97-4.18 0-4.77-6.1-4.64-6.1-7 0-.97.72-1.1 1.13-1.1.45 0 1.25.07 1.19 1.87z"/>
            </svg>
          </div>
          <H3 style={{ fontSize: '1.1rem' }}>Storybook</H3>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Browse interactive component documentation with usage examples, prop tables, and live previews.
          </BodySmall>
          <Button variant="primary" style={{ width: '100%' }} onClick={() => window.open(storybookUrl, '_blank')}>
            Open Storybook
          </Button>
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
        </VStack>
      </Card>
    </div>
  );
}

function SettingsTab({ record, payments }: { record: Record; payments: PaymentRecord[] }) {
  const addOns = useMemo(() => {
    const list: string[] = [];
    if (record.monthlyAddOns?.playground) list.push('Playground');
    if (record.monthlyAddOns?.storybook) list.push('Storybook');
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
          <KV k="Playground URL" v={`https://designology.netlify.app/?user=${record ? '(this id)' : ''}`} />
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

function HistoryTab({ record }: { record: Record }) {
  const events: Array<{ when: Date | null; label: string; detail?: string }> = [];
  if (record.createdAt) events.push({ when: record.createdAt, label: 'Created', detail: `v1` });
  if (record.updatedAt && record.updatedAt.getTime() !== record.createdAt?.getTime()) {
    events.push({ when: record.updatedAt, label: 'Last updated', detail: `v${record.version}` });
  }
  if (record.lastPushedAt) {
    events.push({ when: record.lastPushedAt, label: 'Pushed to Figma', detail: `v${record.lastPushedVersion}` });
  }
  events.sort((a, b) => (b.when?.getTime() || 0) - (a.when?.getTime() || 0));

  return (
    <Card padding="medium">
      <VStack spacing={2}>
        <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
          Activity
        </BodySmall>
        {events.length === 0 ? (
          <BodySmall style={{ color: 'var(--Quiet)' }}>No history yet.</BodySmall>
        ) : (
          <VStack spacing={0}>
            {events.map((e, i) => (
              <HStack key={i} spacing={2} style={{ padding: '8px 0', borderBottom: i < events.length - 1 ? '1px solid var(--Border)' : 'none' }}>
                <BodySmall style={{ width: 110, color: 'var(--Quiet)', flexShrink: 0 }}>
                  {e.when?.toLocaleDateString() || '—'}
                </BodySmall>
                <BodySmall style={{ fontWeight: 600 }}>{e.label}</BodySmall>
                {e.detail && <BodySmall style={{ color: 'var(--Quiet)' }}>· {e.detail}</BodySmall>}
              </HStack>
            ))}
          </VStack>
        )}
      </VStack>
    </Card>
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
