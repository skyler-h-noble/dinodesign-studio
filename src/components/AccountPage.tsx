import { useEffect, useState } from 'react';
import {
  H2, H3, Body, BodySmall, VStack, HStack, Card, Button, Avatar, Divider,
  Tabs, TabList, Tab, TabPanel, SwitchInput,
  Accordion, AccordionGroup, AccordionSummary, AccordionDetails, Link,
} from '@dynodesign/components';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import AppHeader from './AppHeader';
import PluginPairing from './PluginPairing';
import { ADD_ONS, formatPrice, type AddOn } from '../utils/addOns/registry';
import { useCart } from '../contexts/CartContext';

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | string;
  type: string;
}

interface DesignSystemRecord {
  id: string;
  name: string;
  addOns: string[];
  hosting: {
    playground: boolean;
    designerPortal: boolean;
  };
}

interface AccountSummary {
  designSystemCount: number;
  activeAddOns: string[];
  totalSpend: number;
}

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [designSystems, setDesignSystems] = useState<DesignSystemRecord[]>([]);
  const [summary, setSummary] = useState<AccountSummary>({ designSystemCount: 0, activeAddOns: [], totalSpend: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('overview');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        // Design systems with full per-system info for the tabs.
        const dsSnap = await getDocs(query(
          collection(db, 'designSystems'),
          where('userId', '==', user.uid),
        ));
        const addOnsAggregate = new Set<string>();
        const systems: DesignSystemRecord[] = [];
        dsSnap.forEach(d => {
          const data = d.data() as any;
          const dsAddOns: string[] = Array.isArray(data.addOns) ? data.addOns : [];
          dsAddOns.forEach(slug => addOnsAggregate.add(slug));
          systems.push({
            id: d.id,
            name: data.name || '(untitled)',
            addOns: dsAddOns,
            hosting: {
              playground: !!data.monthlyAddOns?.playground,
              designerPortal: !!data.monthlyAddOns?.designerPortal,
            },
          });
        });
        systems.sort((a, b) => a.name.localeCompare(b.name));

        // Payments
        const paySnap = await getDocs(query(
          collection(db, 'payments'),
          where('userId', '==', user.uid),
        ));
        const pays: PaymentRecord[] = [];
        let total = 0;
        paySnap.forEach(d => {
          const data = d.data() as any;
          const amount = Number(data.amount || 0);
          if ((data.status || 'paid') === 'paid') total += amount;
          pays.push({
            id: d.id,
            date: data.date?.toDate?.()?.toLocaleDateString() || 'Unknown',
            description: data.description || '',
            amount,
            status: data.status || 'paid',
            type: data.type || 'checkout',
          });
        });
        pays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (cancelled) return;
        setDesignSystems(systems);
        setSummary({
          designSystemCount: dsSnap.size,
          activeAddOns: Array.from(addOnsAggregate),
          totalSpend: total,
        });
        setPayments(pays);
      } catch (err) {
        console.error('Failed to load account:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
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
          <Body style={{ color: 'var(--Quiet)' }}>Loading…</Body>
        </VStack>
      </>
    );
  }

  const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();

  const handleHostingToggle = async (dsId: string, key: keyof DesignSystemRecord['hosting'], value: boolean) => {
    try {
      await updateDoc(doc(db, 'designSystems', dsId), {
        [`monthlyAddOns.${key}`]: value,
      });
      setDesignSystems(prev => prev.map(s => s.id === dsId
        ? { ...s, hosting: { ...s.hosting, [key]: value } }
        : s,
      ));
    } catch (err) {
      console.error(`Failed to update hosting (${key}) for ${dsId}:`, err);
    }
  };

  return (
    <>
      <AppHeader />
      <VStack spacing={4} style={{ padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
        <H2 style={{ margin: 0 }}>Account</H2>

        {/* Profile (always visible above tabs) */}
        <Card padding="medium">
          <VStack spacing={3}>
            <HStack spacing={3} alignItems="center">
              <Avatar
                src={user.photoURL || undefined}
                alt={user.displayName || user.email || 'Account'}
                size="large"
              >
                {!user.photoURL ? initial : undefined}
              </Avatar>
              <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
                <H3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  {user.displayName || user.email?.split('@')[0] || 'You'}
                </H3>
                <BodySmall style={{ color: 'var(--Quiet)' }}>{user.email}</BodySmall>
              </VStack>
              <Button
                variant="primary-outline"
                size="small"
                onClick={() => window.location.href = '/my-designs'}
              >
                My Designs
              </Button>
            </HStack>
          </VStack>
        </Card>

        <Tabs value={activeTab} onChange={(val: string) => setActiveTab(val)}>
          <TabList aria-label="Account sections">
            <Tab value="overview">Overview</Tab>
            {designSystems.map(ds => (
              <Tab key={ds.id} value={ds.id}>{ds.name}</Tab>
            ))}
          </TabList>

          {/* ─── Overview tab ─── */}
          <TabPanel value="overview">
            <VStack spacing={4}>
              {/* At a glance */}
              <Card padding="medium">
                <VStack spacing={2}>
                  <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
                    At a glance
                  </BodySmall>
                  <HStack spacing={4} style={{ flexWrap: 'wrap' }}>
                    <Stat k="Design systems" v={String(summary.designSystemCount)} />
                    <Stat k="Add-ons unlocked" v={summary.activeAddOns.length === 0 ? '—' : String(summary.activeAddOns.length)} />
                    <Stat k="Total spend" v={`$${(summary.totalSpend / 100).toFixed(2)}`} />
                  </HStack>
                </VStack>
              </Card>

              {/* Payment History */}
              <Card padding="medium">
                <VStack spacing={2}>
                  <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
                    Payment history
                  </BodySmall>
                  {payments.length === 0 ? (
                    <BodySmall style={{ color: 'var(--Quiet)' }}>No purchases yet.</BodySmall>
                  ) : (
                    <VStack spacing={0}>
                      <HStack spacing={2} style={{ paddingBottom: 8, borderBottom: '1px solid var(--Border)' }}>
                        <BodySmall style={{ fontWeight: 600, width: 90, flexShrink: 0 }}>Date</BodySmall>
                        <BodySmall style={{ fontWeight: 600, flex: 1 }}>Description</BodySmall>
                        <BodySmall style={{ fontWeight: 600, width: 80, textAlign: 'right', flexShrink: 0 }}>Amount</BodySmall>
                        <BodySmall style={{ fontWeight: 600, width: 60, textAlign: 'right', flexShrink: 0 }}>Status</BodySmall>
                      </HStack>
                      {payments.slice(0, 20).map(p => (
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
                  )}
                </VStack>
              </Card>

              <PluginPairing />

              <Card padding="medium">
                <VStack spacing={2} alignItems="flex-start">
                  <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
                    Account actions
                  </BodySmall>
                  <HStack spacing={2}>
                    <Button variant="primary-outline" size="small" onClick={() => signOut()}>
                      Sign Out
                    </Button>
                  </HStack>
                </VStack>
              </Card>
            </VStack>
          </TabPanel>

          {/* ─── Per-design-system tabs ─── */}
          {designSystems.map(ds => (
            <TabPanel key={ds.id} value={ds.id}>
              <DesignSystemPanel
                ds={ds}
                onHostingToggle={handleHostingToggle}
              />
            </TabPanel>
          ))}
        </Tabs>

        <Divider />
      </VStack>
    </>
  );
}

// ─── Per-DS panel ───────────────────────────────────────────────────────────

function DesignSystemPanel({
  ds,
  onHostingToggle,
}: {
  ds: DesignSystemRecord;
  onHostingToggle: (dsId: string, key: 'playground' | 'designerPortal', value: boolean) => Promise<void>;
}) {
  const cart = useCart();

  return (
    <VStack spacing={4}>
      <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <H3 style={{ margin: 0 }}>{ds.name}</H3>
        <Button
          variant="primary-outline"
          size="small"
          onClick={() => window.location.href = `/my-designs/${ds.id}`}
        >
          Open
        </Button>
      </HStack>

      {/* Add-ons — one accordion wrapping the whole list */}
      <Card padding="medium">
        <AccordionGroup>
          <Accordion>
            <AccordionSummary>
              <HStack spacing={2} style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
                  Add-ons
                </BodySmall>
                <BodySmall style={{ color: 'var(--Quiet)' }}>
                  {ds.addOns.length} of {ADD_ONS.length} active
                </BodySmall>
              </HStack>
            </AccordionSummary>
            <AccordionDetails>
              <VStack spacing={1}>
                <BodySmall style={{ color: 'var(--Quiet)' }}>
                  Each add-on is purchased per design system. Add items to your cart and check out at any time.
                </BodySmall>
                <VStack spacing={2} style={{ paddingTop: 8 }}>
                  {ADD_ONS.map(addon => {
                    const unlocked = ds.addOns.includes(addon.slug);
                    const inCart = cart.has(addon.slug, ds.id);
                    return (
                      <AddOnRow
                        key={addon.slug}
                        addon={addon}
                        unlocked={unlocked}
                        inCart={inCart}
                        onAddToCart={() => cart.add(addon.slug, ds.id, ds.name)}
                        onRemoveFromCart={() => {
                          const item = cart.items.find(i => i.addOnSlug === addon.slug && i.designSystemId === ds.id);
                          if (item) cart.remove(item.key);
                        }}
                      />
                    );
                  })}
                </VStack>
              </VStack>
            </AccordionDetails>
          </Accordion>
        </AccordionGroup>
      </Card>

      {/* Hosting preferences */}
      <Card padding="medium">
        <VStack spacing={2}>
          <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', color: 'var(--Quiet)' }}>
            Hosting preferences
          </BodySmall>
          <BodySmall style={{ color: 'var(--Quiet)' }}>
            Turn on hosted views for this design system. Billed monthly when enabled.
          </BodySmall>
          <VStack spacing={2} style={{ paddingTop: 8 }}>
            <HostingToggle
              label="Playground"
              description="Live, interactive demo of your design system at a public URL."
              checked={ds.hosting.playground}
              onChange={v => onHostingToggle(ds.id, 'playground', v)}
            />
            <HostingToggle
              label="Designer Hub"
              description="Private portal for designers to view tokens, components, and Figma links."
              checked={ds.hosting.designerPortal}
              onChange={v => onHostingToggle(ds.id, 'designerPortal', v)}
            />
          </VStack>
        </VStack>
      </Card>
    </VStack>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function AddOnRow({
  addon, unlocked, inCart, onAddToCart, onRemoveFromCart,
}: {
  addon: AddOn;
  unlocked: boolean;
  inCart: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
}) {
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid var(--Border)' }}>
      <HStack spacing={2} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <BodySmall style={{ fontWeight: 700 }}>{addon.title}</BodySmall>
        <AddOnStatusBadge addon={addon} unlocked={unlocked} inCart={inCart} />
      </HStack>
      <BodySmall style={{ color: 'var(--Quiet)', marginTop: 4 }}>
        {addon.description}
      </BodySmall>
      <HStack spacing={2} style={{ alignItems: 'center', marginTop: 6 }}>
        <Link
          href="/add-ons"
          onClick={(e: React.MouseEvent) => { e.preventDefault(); window.location.href = '/add-ons'; }}
          style={{ fontSize: '0.875rem' }}
        >
          View in catalog
        </Link>
        {!unlocked && addon.available && (
          inCart ? (
            <Button
              variant="outline"
              color="default"
              size="small"
              onClick={onRemoveFromCart}
            >
              Remove from cart
            </Button>
          ) : (
            <Button
              variant="primary"
              size="small"
              onClick={onAddToCart}
            >
              Add to cart · {formatPrice(addon.priceUsdCents)}
            </Button>
          )
        )}
      </HStack>
    </div>
  );
}

function AddOnStatusBadge({
  addon, unlocked, inCart,
}: {
  addon: AddOn;
  unlocked: boolean;
  inCart: boolean;
}) {
  if (unlocked) {
    return (
      <BodySmall style={{ color: 'var(--Text-Success, #2a8)', fontWeight: 600, flexShrink: 0 }}>
        Active ✓
      </BodySmall>
    );
  }
  if (inCart) {
    return (
      <BodySmall style={{ color: 'var(--Hotlink, #2563eb)', fontWeight: 600, flexShrink: 0 }}>
        In cart
      </BodySmall>
    );
  }
  if (!addon.available) {
    return (
      <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 600, flexShrink: 0 }}>
        Coming soon
      </BodySmall>
    );
  }
  return (
    <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 600, flexShrink: 0 }}>
      {formatPrice(addon.priceUsdCents)}
    </BodySmall>
  );
}

function HostingToggle({
  label, description, checked, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <HStack spacing={2} style={{ alignItems: 'flex-start' }}>
      <SwitchInput
        checked={checked}
        onChange={(_: any, v: boolean) => onChange(v)}
        size="small"
      />
      <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
        <BodySmall style={{ fontWeight: 600 }}>{label}</BodySmall>
        <BodySmall style={{ color: 'var(--Quiet)' }}>{description}</BodySmall>
      </VStack>
    </HStack>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <VStack spacing={0}>
      <BodySmall style={{ color: 'var(--Quiet)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6rem' }}>{k}</BodySmall>
      <H3 style={{ margin: 0, fontSize: '1.4rem' }}>{v}</H3>
    </VStack>
  );
}
