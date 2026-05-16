import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ADD_ONS } from '../utils/addOns/registry';

export interface CartItem {
  /** Unique key combining add-on + design system; safer than two-key compares. */
  key: string;
  addOnSlug: string;
  designSystemId: string;
  designSystemName: string;
}

interface CartContextValue {
  items: CartItem[];
  add: (addOnSlug: string, designSystemId: string, designSystemName: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  has: (addOnSlug: string, designSystemId: string) => boolean;
  totalCents: number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((addOnSlug: string, designSystemId: string, designSystemName: string) => {
    const key = `${designSystemId}::${addOnSlug}`;
    setItems(prev => prev.some(i => i.key === key) ? prev : [...prev, { key, addOnSlug, designSystemId, designSystemName }]);
  }, []);

  const remove = useCallback((key: string) => {
    setItems(prev => prev.filter(i => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const has = useCallback(
    (addOnSlug: string, designSystemId: string) =>
      items.some(i => i.addOnSlug === addOnSlug && i.designSystemId === designSystemId),
    [items],
  );

  const totalCents = useMemo(() => {
    return items.reduce((sum, i) => {
      const addon = ADD_ONS.find(a => a.slug === i.addOnSlug);
      return sum + (addon?.priceUsdCents || 0);
    }, 0);
  }, [items]);

  return (
    <CartContext.Provider value={{ items, add, remove, clear, has, totalCents }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside a <CartProvider>');
  return ctx;
}
