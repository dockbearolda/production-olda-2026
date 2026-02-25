import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import type { CartItem } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onValidate: () => void;
  onEdit: (item: CartItem) => void;
}

function CartItemRow({ item, onRemove, onEdit }: { item: CartItem; onRemove: () => void; onEdit: () => void }) {
  const ref = item.reference || item.famille;
  const sub = [item.collection, ref, item.taille].filter(Boolean).join(' · ');
  return (
    <div className="cart-item">
      <div
        className="cart-item-color"
        style={{ background: item.couleur.h }}
        title={item.couleur.n}
      />
      <div className="cart-item-info">
        <div className="cart-item-title">{item.couleur.n}</div>
        <div className="cart-item-sub">{sub}</div>
        {item.logoAvant.id && (
          <div className="cart-item-sub" style={{ marginTop: 2, color: 'var(--accent)' }}>
            Logo avant · Logo arrière
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <span className="cart-item-price">{item.prix.total} €</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="cart-item-edit"
            onClick={onEdit}
            aria-label="Modifier"
          >
            ✏️
          </button>
          <button className="cart-item-delete" onClick={onRemove} aria-label="Supprimer">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CartDrawer({ open, onClose, onValidate, onEdit }: Props) {
  const { items, removeItem, total } = useCart();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cart-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="cart-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="sheet-handle" />

            {/* Header */}
            <div className="sheet-header">
              <span className="sheet-title">
                Panier{items.length > 0 ? ` (${items.length})` : ''}
              </span>
              <button className="sheet-close" onClick={onClose}>×</button>
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {items.length === 0 ? (
                <div className="cart-empty">
                  <div className="cart-empty-icon">🛍️</div>
                  <div>Votre panier est vide</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    Ajoutez des articles depuis le Studio
                  </div>
                </div>
              ) : (
                <>
                  {items.map(item => (
                    <CartItemRow
                      key={item.id}
                      item={item}
                      onRemove={() => removeItem(item.id)}
                      onEdit={() => { onEdit(item); onClose(); }}
                    />
                  ))}

                  {/* Total */}
                  <div className="cart-total-row">
                    <span>Total</span>
                    <span>{total} €</span>
                  </div>
                </>
              )}
            </div>

            {/* CTA */}
            {items.length > 0 && (
              <div style={{ padding: '12px 16px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => { onClose(); onValidate(); }}
                >
                  Valider le panier →
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
