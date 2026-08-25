import { useState } from 'react';
import { Body, BodySmall, Button, HStack, Modal, VStack } from '@dynodesign/components';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import CloseIcon from '@mui/icons-material/Close';
import { useCart } from '../contexts/CartContext';
import { ADD_ONS, formatPrice } from '../utils/addOns/registry';
import { purchaseAddOn } from '../utils/addOns/entitlements';

/**
 * Shopping cart icon for the AppBar/AppHeader.
 * Click to open a checkout modal listing all items.
 *
 * DEV mode: clicking "Checkout" calls purchaseAddOn() for each item in
 * sequence, then clears the cart.
 * PROD mode: TODO — single Stripe Checkout session for the whole cart.
 */
export default function CartIcon() {
  const { items, totalCents } = useCart();
  const [open, setOpen] = useState(false);
  const count = items.length;

  return (
    <>
      <Button
        iconOnly
        variant="ghost"
        size="small"
        badge={count > 0}
        badgeContent={count}
        aria-label={count > 0 ? `Cart (${count} items)` : 'Cart (empty)'}
        onClick={() => setOpen(true)}
      >
        <ShoppingCartIcon style={{ fontSize: 22 }} />
      </Button>
      {open && <CartModal totalCents={totalCents} onClose={() => setOpen(false)} />}
    </>
  );
}

function CartModal({ totalCents, onClose }: { totalCents: number; onClose: () => void }) {
  const { items, remove, clear } = useCart();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setWorking(true);
    setError(null);
    try {
      // DEV mode: grant each item one at a time. PROD will batch via Stripe.
      for (const item of items) {
        await purchaseAddOn(item.designSystemId, item.addOnSlug);
      }
      clear();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Cart" size="medium">
      <VStack spacing={3}>
        {items.length === 0 ? (
          <Body color="quiet">Your cart is empty.</Body>
        ) : (
          <VStack spacing={2}>
            {items.map(item => {
              const addon = ADD_ONS.find(a => a.slug === item.addOnSlug);
              if (!addon) return null;
              return (
                <HStack
                  key={item.key}
                  spacing={2}
                  style={{ padding: '10px 0', borderBottom: '1px solid var(--Border)', alignItems: 'flex-start' }}
                >
                  <VStack spacing={0} style={{ flex: 1, minWidth: 0 }}>
                    <BodySmall style={{ fontWeight: 600 }}>{addon.title}</BodySmall>
                    <BodySmall color="quiet">
                      For: {item.designSystemName}
                    </BodySmall>
                  </VStack>
                  <BodySmall style={{ fontWeight: 600, flexShrink: 0, minWidth: 50, textAlign: 'right' }}>
                    {formatPrice(addon.priceUsdCents)}
                  </BodySmall>
                  <button
                    type="button"
                    aria-label="Remove from cart"
                    onClick={() => remove(item.key)}
                    style={{
                      border: 'none', background: 'transparent', cursor: 'pointer',
                      padding: 4, display: 'flex', alignItems: 'center', color: 'var(--Quiet)',
                    }}
                  >
                    <CloseIcon style={{ fontSize: 16 }} />
                  </button>
                </HStack>
              );
            })}
            <HStack spacing={2} style={{ padding: '10px 0', justifyContent: 'space-between' }}>
              <BodySmall style={{ fontWeight: 700 }}>Total</BodySmall>
              <BodySmall style={{ fontWeight: 700 }}>{formatPrice(totalCents)}</BodySmall>
            </HStack>
          </VStack>
        )}

        {error && <Body style={{ color: 'var(--Buttons-Error-Button, #b00)' }}>{error}</Body>}

        <HStack spacing={2} style={{ justifyContent: 'flex-end' }}>
          <Button variant="outline" color="default" size="small" onClick={onClose}>Close</Button>
          {items.length > 0 && (
            <Button
              variant="primary"
              size="small"
              onClick={handleCheckout}
              disabled={working}
            >
              {working ? 'Processing…' : `Checkout · ${formatPrice(totalCents)}`}
            </Button>
          )}
        </HStack>
      </VStack>
    </Modal>
  );
}
