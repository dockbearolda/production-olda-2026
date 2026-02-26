import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import type { ClientInfo, PaymentStatus } from '../../types';

interface Props {
  clientInfo: ClientInfo;
  onBack: () => void;       // → étape client info
  onEditCart: () => void;   // → retour Studio pour modifier le panier
}

// Generate order number like: Nom-Prenom-DDMMYY-HHMM
function generateOrderNo(info: ClientInfo): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const cap = (s: string) => s ? s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()) : '';
  const nom    = cap(info.nom.trim()).replace(/\s+/g, '-');
  const prenom = cap(info.prenom.trim()).replace(/\s+/g, '-');
  const namePart = nom && prenom ? `${nom}-${prenom}` : nom || prenom || 'Client';
  return `${namePart}-${dd}${mm}${yy}-${hh}${mi}`;
}

export default function Payment({ clientInfo, onBack, onEditCart }: Props) {
  const { items, total, clearCart } = useCart();
  const [payStatus, setPayStatus]   = useState<PaymentStatus>('unpaid');
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState('');
  const [exchangeRate, setExchangeRate] = useState(1.08); // EUR to USD default

  // Fetch USD exchange rate on mount
  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/EUR')
      .then(r => r.json())
      .then(d => {
        if (d?.rates?.USD) setExchangeRate(d.rates.USD);
      })
      .catch(() => {/* silently fail, use default */});
  }, []);

  // ── Build DASHOLDA payload ─────────────────────────────
  async function submit() {
    if (items.length === 0) {
      setError('Votre panier est vide. Ajoutez au moins un article.');
      return;
    }
    /* Email optionnel ; si fourni, valider le format */
    if (clientInfo.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clientInfo.email.trim())) {
      setError('Email invalide — retournez à l\'étape précédente pour la corriger.');
      return;
    }
    if (!clientInfo.nom.trim() || !clientInfo.prenom.trim()) {
      setError('Nom et prénom requis — retournez à l\'étape précédente.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // Fetch config (token + URL)
      const cfgRes = await fetch('/api/config');
      const cfg = await cfgRes.json() as { dashboard_token: string };
      const token = cfg.dashboard_token;

      const orderNo = generateOrderNo(clientInfo);

      // Build a multi-item order payload
      const orderPayload = {
        commande:     orderNo,
        nom:          clientInfo.nom,
        prenom:       clientInfo.prenom,
        email:        clientInfo.email,
        telephone:    clientInfo.telephone,
        adresse:      clientInfo.adresse,
        deadline:     clientInfo.deadline,
        famille:      items[0]?.famille ?? 'textile',
        // Items list for multi-article support
        items: items.map(item => ({
          collection:       item.collection,
          reference:        item.reference,
          couleurTshirt:    item.couleur.n,
          taille:           item.taille,
          note:             item.note,
          logoAvant:        item.logoAvant.name ?? '',
          logoArriere:      item.logoArriere.name ?? '',
          prix: {
            tshirt:          item.prix.tshirt,
            personnalisation: item.prix.personnalisation,
            total:            item.prix.total,
          },
        })),
        prix: {
          total: String(total),
          tshirt: String(items.reduce((s, i) => s + i.prix.tshirt, 0)),
          personnalisation: String(items.reduce((s, i) => s + i.prix.personnalisation, 0)),
        },
        paiement: { statut: payStatus === 'paid' ? 'OUI' : 'NON' },
        _reçuLe: new Date().toISOString(),
      };

      const res = await fetch('/api/webhook/forward-to-dasholda', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `Erreur HTTP ${res.status}`);
      }

      // Success!
      clearCart();
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de l\'envoi.');
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen (Apple-style notification) ─────────────────────
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => window.location.reload(), 2500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (success) {
    return (
      <div className="step-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ fontSize: 60 }}
          >
            ✓
          </motion.div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)' }}>
              Commande envoyée
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 8 }}>
              Votre commande a été transmise à l'atelier.
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1 }}
            style={{ fontSize: 12, color: 'var(--text-3)' }}
          >
            Redirection en cours…
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const totalInUSD = Math.round(total * exchangeRate * 100) / 100;

  return (
    <div className="step-panel" style={{ gap: 16 }}>

      {/* ── ORDER SUMMARY ─────────────────────────── */}
      <div className="card">
        <div className="card-title">Récapitulatif de la commande</div>
        <div className="card-body" style={{ gap: 0 }}>
          {items.length === 0 ? (
            <div style={{ padding: '12px 0', color: 'var(--text-3)', textAlign: 'center', fontSize: 14 }}>
              Panier vide — retournez au Studio pour ajouter des articles.
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="summary-item">
                <div
                  className="summary-color"
                  style={{ background: item.couleur.h }}
                  title={item.couleur.n}
                />
                <div className="summary-info">
                  <div className="summary-title">{item.couleur.n} · {item.taille}</div>
                  <div className="summary-sub">
                    {[item.collection, item.reference].filter(Boolean).join(' ')}
                    {item.logoAvant.id && ' · Logo ✓'}
                    {item.note && ` · ${item.note.slice(0, 40)}`}
                  </div>
                </div>
                <div className="summary-price">{item.prix.total} €</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── CLIENT INFO RECAP ──────────────────────── */}
      <div className="card">
        <div className="card-title">Client</div>
        <div className="card-body" style={{ gap: 6 }}>
          <div className="flex-between">
            <span className="text-sm text-2">Nom</span>
            <span className="text-sm fw-600">{clientInfo.nom} {clientInfo.prenom}</span>
          </div>
          <div className="flex-between">
            <span className="text-sm text-2">Téléphone</span>
            <span className="text-sm fw-600">{clientInfo.telephone || '—'}</span>
          </div>
          <div className="flex-between">
            <span className="text-sm text-2">Email</span>
            <span className="text-sm fw-600">{clientInfo.email || '—'}</span>
          </div>
          {clientInfo.adresse && (
            <div className="flex-between" style={{ alignItems: 'flex-start' }}>
              <span className="text-sm text-2">Adresse</span>
              <span className="text-sm fw-600" style={{ textAlign: 'right', maxWidth: '60%' }}>
                {clientInfo.adresse}
              </span>
            </div>
          )}
          {clientInfo.deadline && (
            <div className="flex-between">
              <span className="text-sm text-2">Deadline</span>
              <span className="text-sm fw-600">{clientInfo.deadline}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── TOTAL ─────────────────────────────────── */}
      <div className="total-bubble">
        <div className="total-row">
          <span>Total (EUR)</span>
          <span>{total} €</span>
        </div>
        <div className="total-row">
          <span className="text-sm text-2">Taux: {exchangeRate.toFixed(4)}</span>
          <span className="text-sm text-2">1 € = {exchangeRate.toFixed(2)} $</span>
        </div>
        <div className="total-main">
          <span className="total-label">Total (USD)</span>
          <span className="total-amount">${totalInUSD.toFixed(2)}</span>
        </div>
      </div>

      {/* ── PAYMENT STATUS ────────────────────────── */}
      <div className="card">
        <div className="card-title">Statut du paiement</div>
        <div className="card-body" style={{ gap: 8 }}>
          <button
            className={`pay-opt ${payStatus === 'paid' ? 'paid' : ''}`}
            onClick={() => setPayStatus('paid')}
          >
            <span>💳 Payé</span>
          </button>
          <button
            className={`pay-opt ${payStatus === 'unpaid' ? 'unpaid' : ''}`}
            onClick={() => setPayStatus('unpaid')}
          >
            <span>⏳ À régler</span>
          </button>
        </div>
      </div>

      {/* ── ERROR ─────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              background: 'rgba(255,59,48,0.08)',
              border: '1px solid rgba(255,59,48,0.25)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 14,
              color: 'var(--red)',
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SUBMIT ────────────────────────────────── */}
      <button
        className="btn btn-primary"
        onClick={submit}
        disabled={loading || items.length === 0}
        style={{ opacity: items.length === 0 ? 0.5 : 1 }}
      >
        {loading ? (
          <><span className="btn-spinner" /> Envoi en cours…</>
        ) : (
          '✓ Envoyer à l\'Atelier'
        )}
      </button>

      <button className="btn btn-ghost" onClick={onBack} disabled={loading}>
        ← Modifier les informations
      </button>

      <button className="btn btn-ghost" onClick={onEditCart} disabled={loading}
        style={{ color: 'var(--accent)', borderColor: 'rgba(0,122,255,0.25)' }}>
        ← Modifier le panier
      </button>
    </div>
  );
}
