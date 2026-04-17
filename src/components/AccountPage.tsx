import { useState, useEffect } from 'react';
import {
  H2, H3, Body, BodySmall, VStack, HStack, Card, Button, Badge, Divider,
} from '@dynodesign/components';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase/client';

interface DesignSystem {
  id: string;
  name: string;
  createdAt: string;
  colors: string[];
  componentStyle: string;
  status: 'hosted' | 'expired';
  addOns: string[];
}

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  type: string;
}

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
          systems.push({
            id: d.id,
            name: data.name || 'Untitled',
            createdAt: data.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown',
            colors: data.colors || [],
            componentStyle: data.componentStyle || 'modern',
            status: data.plan === 'cancelled' || data.plan === 'expired' ? 'expired' : 'hosted',
            addOns,
          });
        });
        setDesignSystems(systems);

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
      <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
        <H2>Account</H2>
        <Body style={{ color: 'var(--Quiet)' }}>Sign in to view your account.</Body>
      </VStack>
    );
  }

  if (loading) {
    return (
      <VStack spacing={4} style={{ padding: 40, alignItems: 'center' }}>
        <H2>Account</H2>
        <Body style={{ color: 'var(--Quiet)' }}>Loading...</Body>
      </VStack>
    );
  }

  const showcaseBase = 'https://designology.netlify.app';

  return (
    <VStack spacing={5} style={{ padding: '40px 24px', maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <HStack spacing={3} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <VStack spacing={0}>
          <H2 style={{ margin: 0 }}>Account</H2>
          <BodySmall style={{ color: 'var(--Quiet)' }}>{user.email}</BodySmall>
        </VStack>
        <Button variant="outline" size="small" onClick={() => signOut()}>
          Sign Out
        </Button>
      </HStack>

      <Divider />

      {/* Design Systems */}
      <VStack spacing={3}>
        <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
          Your Design Systems
        </BodySmall>

        {designSystems.length === 0 ? (
          <Card padding="medium">
            <VStack spacing={2} alignItems="center">
              <Body style={{ color: 'var(--Quiet)' }}>No design systems yet</Body>
              <BodySmall style={{ color: 'var(--Quiet)' }}>
                Create your first design system by uploading a mood board.
              </BodySmall>
              <Button variant="default" size="small" onClick={() => window.location.href = '/'}>
                Create a design system
              </Button>
            </VStack>
          </Card>
        ) : (
          designSystems.map(ds => (
            <Card key={ds.id} padding="medium">
              <VStack spacing={2}>
                <HStack spacing={3} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <HStack spacing={2} style={{ alignItems: 'center', flex: 1 }}>
                    {/* Color swatches */}
                    <HStack spacing={1}>
                      {ds.colors.slice(0, 3).map((c, i) => (
                        <div key={i} style={{
                          width: 24, height: 24, borderRadius: 6,
                          background: c, border: '1px solid var(--Border)',
                        }} />
                      ))}
                    </HStack>

                    <VStack spacing={0}>
                      <HStack spacing={1} alignItems="center">
                        <Body style={{ fontWeight: 700 }}>{ds.name}</Body>
                        <Badge
                          variant={ds.status === 'hosted' ? 'success' : 'neutral'}
                          size="small"
                        >
                          {ds.status === 'hosted' ? 'Hosted' : 'Expired'}
                        </Badge>
                      </HStack>
                      <BodySmall style={{ color: 'var(--Quiet)' }}>
                        Created {ds.createdAt}
                        {ds.addOns.length > 0 && ` · ${ds.addOns.join(' · ')}`}
                      </BodySmall>
                    </VStack>
                  </HStack>

                  <HStack spacing={1}>
                    {ds.status === 'hosted' && (
                      <Button
                        variant="outline"
                        size="small"
                        startIcon={<OpenInNewIcon style={{ fontSize: 14 }} />}
                        onClick={() => window.open(`${showcaseBase}/?user=${ds.id}`, '_blank')}
                      >
                        View
                      </Button>
                    )}
                    {ds.status === 'expired' && (
                      <Button
                        variant="default"
                        size="small"
                        onClick={() => {
                          // TODO: Stripe reactivation flow
                          console.log('Reactivate:', ds.id);
                        }}
                      >
                        Reactivate
                      </Button>
                    )}
                  </HStack>
                </HStack>
              </VStack>
            </Card>
          ))
        )}
      </VStack>

      <Divider />

      {/* Purchase History */}
      <VStack spacing={3}>
        <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
          Purchase History
        </BodySmall>

        {payments.length === 0 ? (
          <Card padding="medium">
            <BodySmall style={{ color: 'var(--Quiet)', textAlign: 'center' }}>No purchases yet</BodySmall>
          </Card>
        ) : (
          <Card padding="medium">
            <VStack spacing={0}>
              {/* Header */}
              <HStack spacing={2} style={{ paddingBottom: 8, borderBottom: '1px solid var(--Border)' }}>
                <BodySmall style={{ fontWeight: 600, width: 90 }}>Date</BodySmall>
                <BodySmall style={{ fontWeight: 600, flex: 1 }}>Description</BodySmall>
                <BodySmall style={{ fontWeight: 600, width: 80, textAlign: 'right' }}>Amount</BodySmall>
                <BodySmall style={{ fontWeight: 600, width: 60, textAlign: 'right' }}>Status</BodySmall>
              </HStack>
              {/* Rows */}
              {payments.map(p => (
                <HStack key={p.id} spacing={2} style={{ padding: '10px 0', borderBottom: '1px solid var(--Border)' }}>
                  <BodySmall style={{ width: 90, color: 'var(--Quiet)', flexShrink: 0 }}>{p.date}</BodySmall>
                  <BodySmall style={{ flex: 1 }}>{p.description}</BodySmall>
                  <BodySmall style={{ width: 80, textAlign: 'right', fontWeight: 600, flexShrink: 0 }}>
                    ${(p.amount / 100).toFixed(2)}
                  </BodySmall>
                  <BodySmall style={{
                    width: 60,
                    textAlign: 'right',
                    fontWeight: 600,
                    flexShrink: 0,
                    color: p.status === 'paid' ? 'var(--Text-Success)' : p.status === 'failed' ? 'var(--Text-Error)' : 'var(--Quiet)',
                  }}>
                    {p.status}
                  </BodySmall>
                </HStack>
              ))}
            </VStack>
          </Card>
        )}
      </VStack>
    </VStack>
  );
}
