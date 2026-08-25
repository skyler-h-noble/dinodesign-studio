import { useEffect, useState } from 'react';
import {
  AppBar, Button, H1, H2, Body, BodySmall, VStack, HStack, Card, Modal,
} from '@dynodesign/components';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase/client';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import AvatarDropdown from './AvatarDropdown';
import { ADD_ONS, formatPrice, type AddOn } from '../utils/addOns/registry';
import { purchaseAddOn, getEntitlements } from '../utils/addOns/entitlements';

interface DesignSystemSummary {
  id: string;
  name: string;
  addOns: string[];
}

export default function AddOnCatalogPage() {
  const { user, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [purchasingAddOn, setPurchasingAddOn] = useState<AddOn | null>(null);

  return (
    <div
      data-theme="Default"
      data-surface="Surface"
      style={{ background: 'var(--Background)', color: 'var(--Text)', minHeight: '100vh' }}
    >
      <AppBar
        brand="OmniDesign"
        onBrandClick={() => { window.location.href = '/'; }}
        endSlot={
          <HStack spacing={1} style={{ alignItems: 'center' }}>
            <Button variant="default" size="small" onClick={() => { window.location.href = '/create'; }}>
              Get Started
            </Button>
            {user ? (
              <AvatarDropdown
                user={user}
                onSignOut={async () => { await signOut(); window.location.href = '/'; }}
              />
            ) : (
              <Button variant="outline" color="default" size="small" onClick={() => setShowAuthModal(true)}>
                Login
              </Button>
            )}
          </HStack>
        }
      />

      <section style={{ padding: '64px 24px' }}>
        <VStack spacing={5} style={{ maxWidth: 1100, margin: '0 auto' }}>
          <VStack spacing={1} alignItems="center">
            <BodySmall style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--Quiet)', fontSize: '0.7rem', textAlign: 'center' }}>
              Add-On Catalog
            </BodySmall>
            <H1 style={{ textAlign: 'center' }}>Expand your design system</H1>
            <Body style={{ color: 'var(--Quiet)', textAlign: 'center', maxWidth: 620 }}>
              Premium components styled with your brand tokens. Add what you need to any of your design systems.
            </Body>
          </VStack>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {ADD_ONS.map(addon => (
              <Card key={addon.slug} padding="medium">
                <VStack spacing={2}>
                  <HStack spacing={1} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <BodySmall style={{ fontWeight: 700 }}>{addon.title}</BodySmall>
                    <BodySmall style={{ color: 'var(--Quiet)', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      {addon.available ? formatPrice(addon.priceUsdCents) + ' / design system' : 'Coming soon'}
                    </BodySmall>
                  </HStack>
                  <BodySmall color="quiet">{addon.description}</BodySmall>
                  {addon.available && (
                    <Button
                      variant="primary"
                      size="small"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => {
                        if (!user) { setShowAuthModal(true); return; }
                        setPurchasingAddOn(addon);
                      }}
                    >
                      Add to a design system
                    </Button>
                  )}
                </VStack>
              </Card>
            ))}
          </div>

          <HStack spacing={2} style={{ justifyContent: 'center', paddingTop: 16 }}>
            <Button variant="outline" color="default" size="medium" onClick={() => { window.location.href = '/'; }}>
              Back to home
            </Button>
            <Button variant="primary" size="medium" onClick={() => { window.location.href = '/create'; }}>
              Build your design system
            </Button>
          </HStack>
        </VStack>
      </section>

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />

      {purchasingAddOn && user && (
        <AddOnPurchaseModal
          addOn={purchasingAddOn}
          userId={user.uid}
          onClose={() => setPurchasingAddOn(null)}
        />
      )}
    </div>
  );
}

// ─── Purchase modal ─────────────────────────────────────────────────────────

function AddOnPurchaseModal({
  addOn,
  userId,
  onClose,
}: {
  addOn: AddOn;
  userId: string;
  onClose: () => void;
}) {
  const [systems, setSystems] = useState<DesignSystemSummary[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the user's design systems on mount, including which add-ons each already has.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'designSystems'), where('userId', '==', userId)));
        const list: DesignSystemSummary[] = [];
        snap.forEach(d => {
          const data = d.data() as { name?: string; addOns?: string[] };
          list.push({ id: d.id, name: data.name || '(untitled)', addOns: data.addOns || [] });
        });
        if (!cancelled) setSystems(list);
      } catch (err) {
        console.error('Failed to load design systems for add-on purchase:', err);
        if (!cancelled) setError('Could not load your design systems.');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handlePurchase = async (dsId: string) => {
    setWorking(dsId);
    setError(null);
    try {
      await purchaseAddOn(dsId, addOn.slug);
      // Optimistically update the local list so the just-purchased system
      // flips to the "unlocked" state without a refetch.
      setSystems(prev => prev?.map(s => s.id === dsId
        ? { ...s, addOns: [...s.addOns, addOn.slug] }
        : s
      ) || null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setWorking(null);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Add "${addOn.title}" to a design system`} size="medium">
      <VStack spacing={3}>
        <BodySmall color="quiet">
          {addOn.description}
        </BodySmall>
        <BodySmall style={{ fontWeight: 600 }}>
          Price: {formatPrice(addOn.priceUsdCents)} per design system
        </BodySmall>

        {error && <Body style={{ color: 'var(--Buttons-Error-Button, #b00)' }}>{error}</Body>}

        {systems === null ? (
          <Body color="quiet">Loading your design systems…</Body>
        ) : systems.length === 0 ? (
          <VStack spacing={2}>
            <Body>You don't have any design systems yet.</Body>
            <Button variant="primary" size="small" onClick={() => { window.location.href = '/create'; }}>
              Create one
            </Button>
          </VStack>
        ) : (
          <VStack spacing={2}>
            {systems.map(sys => {
              const unlocked = sys.addOns.includes(addOn.slug);
              const isWorking = working === sys.id;
              return (
                <HStack key={sys.id} spacing={2} style={{ justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--Border)' }}>
                  <BodySmall style={{ fontWeight: 600 }}>{sys.name}</BodySmall>
                  {unlocked ? (
                    <BodySmall style={{ color: 'var(--Buttons-Success-Button, #2a8)', fontWeight: 600 }}>Unlocked ✓</BodySmall>
                  ) : (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => handlePurchase(sys.id)}
                      disabled={isWorking}
                    >
                      {isWorking ? 'Adding…' : `Add for ${formatPrice(addOn.priceUsdCents)}`}
                    </Button>
                  )}
                </HStack>
              );
            })}
          </VStack>
        )}

        <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
          <Button variant="outline" color="default" size="small" onClick={onClose}>Close</Button>
        </HStack>
      </VStack>
    </Modal>
  );
}

// Re-export for convenience (the modal also calls it internally).
export { getEntitlements };
