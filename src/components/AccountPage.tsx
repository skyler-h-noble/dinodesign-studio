import { useState, useEffect } from 'react';
import {
  H2, Body, BodySmall, VStack, HStack, Card, Button, Tabs, Tab,
} from '@dynodesign/components';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import AppHeader from './AppHeader';
import { loadGoogleFonts } from '../utils/googleFontsManager';

interface DesignSystem {
  id: string;
  name: string;
  createdAt: string;
  colors: string[];
  componentStyle: string;
  headerFontFamily: string | null;
  status: 'hosted' | 'expired';
  addOns: string[];
  pendingChanges: number;
}

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  type: string;
}

type TabKey = 'account' | 'my-designs' | 'history';

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    typeof window !== 'undefined' && window.location.hash === '#my-designs' ? 'my-designs' : 'account'
  );

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function loadAccount() {
      try {
        // Fetch design systems
        const dsQuery = query(
          collection(db, 'designSystems'),
          where('userId', '==', user!.uid)
        );
        const dsSnapshot = await getDocs(dsQuery);
        const systems: DesignSystem[] = [];
        dsSnapshot.forEach(d => {
          const data = d.data();
          const addOns: string[] = [];
          if (data.monthlyAddOns?.playground) addOns.push('Playground');
          if (data.monthlyAddOns?.storybook) addOns.push('Storybook');
          if (data.monthlyAddOns?.designerPortal) addOns.push('Designer Portal');
          const v = Number(data.version || 0);
          const pushed = Number(data.lastPushedVersion || 0);
          systems.push({
            id: d.id,
            name: data.name || 'Untitled',
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown',
            colors: data.colors || [],
            componentStyle: data.componentStyle || 'modern',
            headerFontFamily: data.headerFontFamily || null,
            status: data.plan === 'cancelled' || data.plan === 'expired' ? 'expired' : 'hosted',
            addOns,
            pendingChanges: v > pushed ? v - pushed : 0,
          });
        });
        setDesignSystems(systems);
        // Preload header fonts so card titles render in the user's chosen font.
        const fonts = Array.from(new Set(systems.map(s => s.headerFontFamily).filter(Boolean))) as string[];
        if (fonts.length) loadGoogleFonts(fonts).catch(() => {});

        // Fetch payment history
        const payQuery = query(
          collection(db, 'payments'),
          where('userId', '==', user!.uid)
        );
        const paySnapshot = await getDocs(payQuery);
        const pays: PaymentRecord[] = [];
        paySnapshot.forEach(d => {
          const data = d.data();
          pays.push({
            id: d.id,
            date: data.date?.toDate?.()?.toLocaleDateString() || 'Unknown',
            description: data.description || '',
            amount: data.amount || 0,
            status: data.status || 'paid',
            type: data.type || 'checkout',
          });
        });
        pays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPayments(pays);
      } catch (err) {
        console.error('Failed to load account:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, [user]);

  if (!user) {
    return (
      <>
        <AppHeader />
        <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
          <H2>Account</H2>
          <Body style={{ color: 'var(--Quiet)' }}>Sign in to view your account.</Body>
        </VStack>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <AppHeader />
        <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
          <H2>Account</H2>
          <Body style={{ color: 'var(--Quiet)' }}>Loading...</Body>
        </VStack>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <VStack spacing={4} style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
        <VStack spacing={0}>
          <H2 style={{ margin: 0 }}>Account</H2>
          <BodySmall style={{ color: 'var(--Quiet)' }}>{user.email}</BodySmall>
        </VStack>

        <Tabs
          value={['account', 'my-designs', 'history'].indexOf(activeTab)}
          onChange={(_: any, v: number) => {
            const next = (['account', 'my-designs', 'history'][v] || 'account') as TabKey;
            setActiveTab(next);
            if (next === 'my-designs') window.history.replaceState(null, '', '#my-designs');
            else window.history.replaceState(null, '', '#');
          }}
        >
          <Tab label="Account" />
          <Tab label="My Designs" />
          <Tab label="Purchase History" />
        </Tabs>

        {activeTab === 'account' && <AccountTab onSignOut={signOut} />}
        {activeTab === 'my-designs' && <MyDesignsTab designSystems={designSystems} />}
        {activeTab === 'history' && <PurchaseHistoryTab payments={payments} />}
      </VStack>
    </>
  );
}

function AccountTab({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Card padding="medium">
      <VStack spacing={2} alignItems="flex-start">
        <BodySmall style={{ color: 'var(--Quiet)' }}>
          Account settings will live here. For now, sign out is the only action.
        </BodySmall>
        <Button variant="primary-outline" size="small" onClick={onSignOut}>
          Sign Out
        </Button>
      </VStack>
    </Card>
  );
}

function MyDesignsTab({ designSystems }: { designSystems: DesignSystem[] }) {
  if (designSystems.length === 0) {
    return (
      <Card padding="medium">
        <VStack spacing={2} alignItems="center">
          <Body style={{ color: 'var(--Quiet)' }}>No design systems yet</Body>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Create your first design system by uploading a mood board.
          </BodySmall>
          <Button variant="default" size="small" onClick={() => window.location.href = '/create'}>
            Create a design system
          </Button>
        </VStack>
      </Card>
    );
  }

  return (
    <VStack spacing={2}>
      {designSystems.map(ds => (
        <DesignSystemCard key={ds.id} ds={ds} />
      ))}
    </VStack>
  );
}

function DesignSystemCard({ ds }: { ds: DesignSystem }) {
  const [copied, setCopied] = useState(false);
  const headerStyle: React.CSSProperties = ds.headerFontFamily
    ? { fontFamily: `'${ds.headerFontFamily}', serif`, fontWeight: 700, fontSize: '1.25rem', margin: 0 }
    : { fontWeight: 700, fontSize: '1.25rem', margin: 0 };

  const handleCopy = () => {
    navigator.clipboard.writeText(ds.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card padding="medium">
      <VStack spacing={3}>
        <HStack spacing={3} style={{ alignItems: 'flex-start' }}>
          <HStack spacing={1} style={{ flexShrink: 0 }}>
            {(ds.colors.length ? ds.colors : ['#666', '#999', '#ccc']).slice(0, 3).map((c, i) => (
              <div key={i} style={{
                width: 36, height: 36, borderRadius: 8,
                background: c, border: '1px solid var(--Border)',
              }} />
            ))}
          </HStack>

          <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
            <h3 style={headerStyle}>{ds.name}</h3>
            <BodySmall style={{ color: 'var(--Quiet)' }}>
              Created {ds.createdAt}
              {ds.addOns.length > 0 && ` · ${ds.addOns.join(' · ')}`}
            </BodySmall>
          </VStack>

          <Button
            variant="primary"
            size="small"
            startIcon={<OpenInNewIcon style={{ fontSize: 14 }} />}
            onClick={() => window.location.href = `/my-designs/${ds.id}`}
          >
            Open
          </Button>
        </HStack>

        {ds.pendingChanges > 0 && (
          <div style={{
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--Warning-Color-11, #fff8e1)',
            border: '1px solid var(--Buttons-Warning-Border, #ffd54f)',
            fontSize: 12, color: 'var(--Text)',
          }}>
            <strong>{ds.pendingChanges} {ds.pendingChanges === 1 ? 'change' : 'changes'}</strong> not yet pushed to Figma. Re-import in the plugin to sync.
          </div>
        )}

        <HStack spacing={1} style={{ alignItems: 'center', fontSize: 12 }}>
          <BodySmall style={{ color: 'var(--Quiet)', flexShrink: 0 }}>ID:</BodySmall>
          <code style={{
            fontSize: 11, fontFamily: 'SF Mono, Monaco, Consolas, monospace',
            background: 'var(--Container-Lowest, #f5f5f5)',
            padding: '2px 8px', borderRadius: 4, flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{ds.id}</code>
          <Button variant="primary-outline" size="small" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
}

function PurchaseHistoryTab({ payments }: { payments: PaymentRecord[] }) {
  if (payments.length === 0) {
    return (
      <Card padding="medium">
        <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center' }}>No purchases yet</BodySmall>
      </Card>
    );
  }
  return (
    <Card padding="medium">
      <VStack spacing={0}>
        <HStack spacing={2} style={{ paddingBottom: 8, borderBottom: '1px solid var(--Border)' }}>
          <BodySmall style={{ fontWeight: 600, width: 90 }}>Date</BodySmall>
          <BodySmall style={{ fontWeight: 600, flex: 1 }}>Description</BodySmall>
          <BodySmall style={{ fontWeight: 600, width: 80, textAlign: 'right' }}>Amount</BodySmall>
          <BodySmall style={{ fontWeight: 600, width: 60, textAlign: 'right' }}>Status</BodySmall>
        </HStack>
        {payments.map(p => (
          <HStack key={p.id} spacing={2} style={{ padding: '10px 0', borderBottom: '1px solid var(--Border)' }}>
            <BodySmall style={{ width: 90, color: 'var(--Quiet)', flexShrink: 0 }}>{p.date}</BodySmall>
            <BodySmall style={{ flex: 1 }}>{p.description}</BodySmall>
            <BodySmall style={{ width: 80, textAlign: 'right', fontWeight: 600, flexShrink: 0 }}>
              ${(p.amount / 100).toFixed(2)}
            </BodySmall>
            <BodySmall style={{
              width: 60, textAlign: 'right', fontWeight: 600, flexShrink: 0,
              color: p.status === 'paid' ? 'var(--Text-Success)' : p.status === 'failed' ? 'var(--Text-Error)' : 'var(--Quiet)',
            }}>
              {p.status}
            </BodySmall>
          </HStack>
        ))}
      </VStack>
    </Card>
  );
}
