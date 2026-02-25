import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { CartItem } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updated: CartItem) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = 'olda_cart_v1';

function loadCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: CartItem) => setItems(prev => [...prev, item]);

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  const updateItem = (id: string, updated: CartItem) =>
    setItems(prev => prev.map(i => i.id === id ? updated : i));

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.prix.total, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateItem, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
