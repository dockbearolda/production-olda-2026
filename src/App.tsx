import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CartProvider } from './context/CartContext';
import Studio from './components/Studio';
import ClientForm from './components/ClientForm';
import Payment from './components/Payment';
import CartBadge from './components/CartBadge';
import CartDrawer from './components/CartDrawer';
import type { Step, ClientInfo, CartItem } from './types';

const STEP_LABELS: Record<Step, string> = {
  studio:  'Studio',
  client:  'Informations',
  payment: 'Paiement',
};

const STEP_ORDER: Step[] = ['studio', 'client', 'payment'];

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-100%' : '100%',
    opacity: 0,
  }),
};

const EMPTY_CLIENT: ClientInfo = {
  nom: '', prenom: '', email: '', telephone: '', adresse: '', deadline: '',
};

function AppInner() {
  const [step, setStep]             = useState<Step>('studio');
  const [direction, setDirection]   = useState(1);
  const [clientInfo, setClientInfo] = useState<ClientInfo>(EMPTY_CLIENT);
  const [cartOpen, setCartOpen]     = useState(false);
  const [editItem, setEditItem]     = useState<CartItem | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);

  function goTo(next: Step) {
    const nextIdx = STEP_ORDER.indexOf(next);
    setDirection(nextIdx > stepIndex ? 1 : -1);
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const showBack = step !== 'studio';
  const progressPct = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  return (
    <div className="app-root">
      {/* ── HEADER ─────────────────────────────────── */}
      <header className="app-header">
        <div className="header-bar">
          <button
            className={`header-back ${!showBack ? 'hidden' : ''}`}
            onClick={() => goTo(STEP_ORDER[stepIndex - 1])}
            aria-label="Retour"
          >
            ‹
          </button>

          <div className="header-center">
            <span className="header-title">Studio Olda</span>
            <span className="header-subtitle">{STEP_LABELS[step]}</span>
          </div>

          <CartBadge onClick={() => setCartOpen(true)} />
        </div>

        <div className="progress-track">
          <motion.div
            className="progress-fill"
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
      </header>

      {/* ── STEP CONTENT ───────────────────────────── */}
      <div className="step-outer">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
            style={{ width: '100%', minHeight: '100%' }}
          >
            {step === 'studio' && (
              <Studio
                onNext={() => goTo('client')}
                editItem={editItem}
                onDoneEditing={() => setEditItem(null)}
              />
            )}
            {step === 'client' && (
              <ClientForm
                info={clientInfo}
                onChange={setClientInfo}
                onNext={() => goTo('payment')}
                onBack={() => goTo('studio')}
              />
            )}
            {step === 'payment' && (
              <Payment
                clientInfo={clientInfo}
                onBack={() => goTo('client')}
                onEditCart={() => goTo('studio')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── CART DRAWER ─────────────────────────────── */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onValidate={() => goTo('client')}
        onEdit={(item) => {
          setEditItem(item);
          setCartOpen(false);
          goTo('studio');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppInner />
    </CartProvider>
  );
}
