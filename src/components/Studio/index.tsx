import {
  useState, useEffect, useRef, useCallback, type PointerEvent,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import {
  COLORS, LOGO_COLORS, REFERENCES, COLLECTIONS, SIZES,
  PRICE_TSHIRT, PRICE_PERSO, LOGO_SECTIONS,
  applyFabricColor, isLightColor,
} from '../../data/products';
import type { CartItem, Color, LogoPlacement } from '../../types';

// ── Default logo placement values ──────────────────────
const DEFAULT_LOGO: LogoPlacement = {
  id: null, type: null, svg: null, url: null, name: null,
  x: 66.5, y: 28, w: 19, color: '#1A1A1A',
};
const DEFAULT_LOGO_BACK: LogoPlacement = {
  id: null, type: null, svg: null, url: null, name: null,
  x: 47.9, y: 31, w: 30, color: '#1A1A1A',
};

function buildRefs(prefix: string) {
  return Array.from({ length: 10 }, (_, i) => {
    const code = `${prefix.toUpperCase()[0]}-${String(i + 1).padStart(3, '0')}`;
    const ref = REFERENCES[code];
    const label = ref ? `${code}  ·  ${ref.fournisseur}` : code;
    return { value: code, label };
  });
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface Props {
  onNext: () => void;
}

export default function Studio({ onNext }: Props) {
  const { addItem } = useCart();

  // ── Product config ──────────────────────────────────
  const [collection, setCollection] = useState('');
  const [reference, setReference]   = useState('');
  const [taille, setTaille]         = useState('M');
  const [dtfArriere, setDtfArriere] = useState('');
  const [color, setColor]           = useState<Color>(COLORS[0]);
  const [note, setNote]             = useState('');
  const [prixTshirt, setPrixTshirt] = useState(25);
  const [prixPerso, setPrixPerso]   = useState(0);

  // ── T-shirt visual ───────────────────────────────────
  const [side, setSide]             = useState<'front' | 'back'>('front');
  const [svgFront, setSvgFront]     = useState('');
  const [svgBack, setSvgBack]       = useState('');
  const [logoAvant, setLogoAvant]      = useState<LogoPlacement>({ ...DEFAULT_LOGO });
  const [logoArriere, setLogoArriere]  = useState<LogoPlacement>({ ...DEFAULT_LOGO_BACK });

  // ── Logo sheet ───────────────────────────────────────
  const [showSheet, setShowSheet] = useState(false);

  // ── Drag ─────────────────────────────────────────────
  const [dragging, setDragging]   = useState(false);
  const stageRef                  = useRef<HTMLDivElement>(null);
  const dragOffsetRef             = useRef({ dx: 0, dy: 0 });

  // ── Fetch SVGs ───────────────────────────────────────
  useEffect(() => {
    fetch('/tshirt-front.svg').then(r => r.text()).then(setSvgFront).catch(() => {});
    fetch('/tshirt-back.svg').then(r => r.text()).then(setSvgBack).catch(() => {});
  }, []);

  // Auto-prix et auto-largeur DTF selon référence + taille
  useEffect(() => {
    const ref = REFERENCES[reference];
    if (ref) {
      setPrixTshirt(ref.prix);
      const largeur = ref.largeurs[taille];
      if (largeur) setDtfArriere(String(largeur));
    }
  }, [reference, taille]);

  const total       = prixTshirt + prixPerso;
  const refOpts     = collection ? buildRefs(collection) : [];
  const currentLogo    = side === 'front' ? logoAvant    : logoArriere;
  const setCurrentLogo = side === 'front' ? setLogoAvant : setLogoArriere;

  function renderSvg(raw: string): string {
    return applyFabricColor(raw, color.h);
  }

  // ── Drag handlers ──────────────────────────────────
  const onLogoPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!currentLogo.id && !currentLogo.url) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    dragOffsetRef.current = {
      dx: e.clientX - rect.left - (currentLogo.x / 100) * rect.width,
      dy: e.clientY - rect.top  - (currentLogo.y / 100) * rect.height,
    };
  }, [currentLogo]);

  const onLogoPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const newX = Math.min(100, Math.max(0, ((e.clientX - rect.left - dragOffsetRef.current.dx) / rect.width)  * 100));
    const newY = Math.min(100, Math.max(0, ((e.clientY - rect.top  - dragOffsetRef.current.dy) / rect.height) * 100));
    setCurrentLogo(prev => ({ ...prev, x: newX, y: newY }));
  }, [dragging, setCurrentLogo]);

  const onLogoPointerUp = useCallback(() => setDragging(false), []);

  // ── Pick logo ────────────────────────────────────────
  function pickAtelier(logoId: string, svg: string, name: string) {
    const pos = side === 'front' ? { x: 66.5, y: 28, w: 19 } : { x: 47.9, y: 31, w: 30 };
    setCurrentLogo(prev => ({ ...prev, id: logoId, type: 'atelier', svg, url: null, name, ...pos }));
    setShowSheet(false);
  }

  function pickUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      const pos = side === 'front' ? { x: 66.5, y: 28, w: 19 } : { x: 47.9, y: 31, w: 30 };
      setCurrentLogo(prev => ({ ...prev, id: 'upload', type: 'upload', svg: null, url, name: file.name, ...pos }));
      setShowSheet(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function removeLogo() {
    setCurrentLogo(side === 'front' ? { ...DEFAULT_LOGO } : { ...DEFAULT_LOGO_BACK });
  }

  // ── Add to cart ──────────────────────────────────────
  function addToCart() {
    if (!collection || !reference || !taille) {
      alert('Veuillez sélectionner une collection, une référence et une taille.');
      return;
    }
    const item: CartItem = {
      id: uid(), famille: 'textile', collection, reference,
      couleur: color, taille, dtfArriere, logoAvant, logoArriere, note,
      prix: { tshirt: prixTshirt, personnalisation: prixPerso, total },
      addedAt: new Date().toISOString(),
    };
    addItem(item);
    // Reset for next item
    setNote(''); setReference(''); setDtfArriere('');
    setLogoAvant({ ...DEFAULT_LOGO });
    setLogoArriere({ ...DEFAULT_LOGO_BACK });
  }

  // ── Logo overlay (FIX: toujours visible sur les 2 côtés) ──
  function renderLogoOverlay(logo: LogoPlacement, isActive: boolean, sideKey: 'front' | 'back') {
    const hasLogo = !!(logo.id || logo.url);

    if (!hasLogo) {
      // Pip d'ajout uniquement sur le côté actif
      if (!isActive) return null;
      const cls = sideKey === 'front' ? 'logo-tap-front' : 'logo-tap-back';
      return (
        <div className={cls} onClick={() => setShowSheet(true)} title="Ajouter un logo">
          <div className="logo-tap-pip">＋</div>
        </div>
      );
    }

    // Logo présent → visible des DEUX côtés ; drag uniquement sur le côté actif
    return (
      <div
        className="logo-zone"
        style={{
          left: `${logo.x}%`,
          top:  `${logo.y}%`,
          width: `${logo.w}%`,
          cursor: isActive ? (dragging ? 'grabbing' : 'grab') : 'default',
          pointerEvents: isActive ? 'auto' : 'none',
        }}
        onPointerDown={isActive ? onLogoPointerDown : undefined}
        onPointerMove={isActive ? onLogoPointerMove : undefined}
        onPointerUp={isActive ? onLogoPointerUp : undefined}
        onPointerCancel={isActive ? onLogoPointerUp : undefined}
      >
        <div className="logo-inner">
          {logo.type === 'atelier' && logo.svg ? (
            <div
              style={{ color: logo.color, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              dangerouslySetInnerHTML={{ __html: logo.svg }}
            />
          ) : logo.url ? (
            <img src={logo.url} alt={logo.name ?? 'logo'} />
          ) : null}
        </div>
        {isActive && <div className="logo-frame" />}
      </div>
    );
  }

  return (
    <div className="step-panel" style={{ gap: 12 }}>

      {/* ── FAMILLE (vertical, mug disabled) ──────── */}
      <div className="card">
        <div className="card-title">Type de produit</div>
        <div className="card-body">

          {/* Textile — sélectionné */}
          <div className="family-row selected">
            <div className="family-row-icon">👕</div>
            <div className="family-row-text">
              <div className="family-row-name">T-Shirt</div>
              <div className="family-row-sub">Personnalisation DTF</div>
            </div>
            <div className="family-row-check">✓</div>
          </div>

          {/* Mug — non cliquable */}
          <div className="family-row disabled">
            <div className="family-row-icon">☕</div>
            <div className="family-row-text">
              <div className="family-row-name">Mug</div>
              <div className="family-row-sub">Sublimation</div>
            </div>
            <div className="family-row-soon">Bientôt</div>
          </div>

        </div>
      </div>

      {/* ── T-SHIRT STUDIO ────────────────────────── */}
      <>
        {/* T-shirt visual */}
        <div className="card">
          <div className="card-title">Aperçu — cliquer pour changer de vue</div>
          <div className="stage">
            <div className="shirts-grid">
              {(['front', 'back'] as const).map(s => {
                const raw    = s === 'front' ? svgFront : svgBack;
                const logo   = s === 'front' ? logoAvant : logoArriere;
                const active = side === s;
                return (
                  <div
                    key={s}
                    className={`shirt-col ${active ? 'active' : ''}`}
                    onClick={() => setSide(s)}
                  >
                    <div className="shirt-side-label">
                      {s === 'front' ? 'Avant' : 'Arrière'}
                    </div>
                    <div
                      className="svg-view"
                      ref={active ? stageRef : undefined}
                      style={{ position: 'relative' }}
                    >
                      {raw ? (
                        <div
                          className="svg-box"
                          dangerouslySetInnerHTML={{ __html: renderSvg(raw) }}
                        />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.04)', borderRadius: 8 }} />
                      )}
                      {/* Logo toujours visible, drag uniquement sur côté actif */}
                      {renderLogoOverlay(logo, active, s)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Float bar logo controls */}
            <AnimatePresence>
              {(currentLogo.id || currentLogo.url) && (
                <motion.div
                  className="logo-float-bar"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="fbar-label">
                    {currentLogo.name ?? 'Logo'} · {side === 'front' ? 'Avant' : 'Arrière'}
                  </span>
                  <button className="fbar-btn fbar-change" onClick={() => setShowSheet(true)}>
                    Changer
                  </button>
                  <button className="fbar-btn fbar-delete" onClick={removeLogo}>
                    Suppr.
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Couleur logo (sans curseur taille) */}
            <AnimatePresence>
              {(currentLogo.id || currentLogo.url) && currentLogo.type === 'atelier' && (
                <motion.div
                  style={{ padding: '0 12px 10px' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="text-xs text-3" style={{ marginBottom: 6 }}>Couleur logo</div>
                  <div className="logo-colors">
                    {LOGO_COLORS.map(lc => (
                      <button
                        key={lc.h}
                        className={`logo-color-swatch ${currentLogo.color === lc.h ? 'selected' : ''}`}
                        style={{
                          background: lc.h,
                          boxShadow: lc.h === '#FFFFFF' ? 'inset 0 0 0 1px rgba(0,0,0,0.12)' : undefined,
                        }}
                        title={lc.n}
                        onClick={() => setCurrentLogo(prev => ({ ...prev, color: lc.h }))}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bouton ajout logo si aucun logo sur ce côté */}
            {!currentLogo.id && !currentLogo.url && (
              <div style={{ padding: '0 12px 10px' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: 'auto', paddingLeft: 14, paddingRight: 14 }}
                  onClick={() => setShowSheet(true)}
                >
                  + Logo {side === 'front' ? 'Avant' : 'Arrière'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Color picker */}
        <div className="card">
          <div className="card-title">Couleur — {color.n}</div>
          <div className="card-body">
            <div className="swatches-grid">
              {COLORS.map(c => (
                <button
                  key={c.h}
                  className={`swatch ${color.h === c.h ? 'selected' : ''}`}
                  style={{ background: c.h }}
                  data-light={isLightColor(c.h) ? '1' : '0'}
                  title={c.n}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
      </>

      {/* ── RÉFÉRENCE ─────────────────────────────── */}
      <div className="card">
        <div className="card-title">Référence produit</div>
        <div className="card-body">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Collection</div>
            <select
              className="native-select"
              value={collection}
              onChange={e => { setCollection(e.target.value); setReference(''); }}
            >
              <option value="">Choisir…</option>
              {COLLECTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>Référence</div>
            <select
              className="native-select"
              value={reference}
              onChange={e => setReference(e.target.value)}
              disabled={!collection}
            >
              <option value="">—</option>
              {refOpts.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>Taille</div>
            <select
              className="native-select"
              value={taille}
              onChange={e => setTaille(e.target.value)}
            >
              {SIZES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Largeur DTF arrière
              {dtfArriere && (
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 600,
                  color: 'var(--text-3)', textTransform: 'none', letterSpacing: 0,
                }}>
                  (auto depuis référence)
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                placeholder="ex: 280"
                value={dtfArriere}
                onChange={e => setDtfArriere(e.target.value)}
                min={100}
                max={500}
                style={{ paddingRight: 46 }}
              />
              <span style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                fontSize: 13, fontWeight: 600, color: 'var(--text-3)',
                pointerEvents: 'none',
              }}>
                mm
              </span>
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 6 }}>Notes</div>
            <textarea
              className="input"
              rows={2}
              placeholder="Ex: logo sur la manche…"
              value={note}
              onChange={e => setNote(e.target.value)}
              style={{ resize: 'vertical', minHeight: 60 }}
            />
          </div>
        </div>
      </div>

      {/* ── PRIX ──────────────────────────────────── */}
      <div className="card">
        <div className="card-title">Tarification</div>
        <div className="card-body">
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Support</div>
            <select
              className="native-select"
              value={prixTshirt}
              onChange={e => setPrixTshirt(+e.target.value)}
            >
              {PRICE_TSHIRT.map(p => (
                <option key={p} value={p}>{p} €</option>
              ))}
            </select>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Personnalisation</div>
            <select
              className="native-select"
              value={prixPerso}
              onChange={e => setPrixPerso(+e.target.value)}
            >
              {PRICE_PERSO.map(p => (
                <option key={p} value={p}>{p} €</option>
              ))}
            </select>
          </div>

          <div className="total-bubble">
            <div className="total-main">
              <span className="total-label">Total article</span>
              <span className="total-amount">{total} €</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CTA ───────────────────────────────────── */}
      <button className="btn btn-dark" onClick={addToCart}>
        + Ajouter au panier
      </button>
      <button className="btn btn-primary" onClick={onNext}>
        Informations client →
      </button>

      {/* ── LOGO SHEET ────────────────────────────── */}
      <AnimatePresence>
        {showSheet && (
          <LogoSheet
            onClose={() => setShowSheet(false)}
            onPickAtelier={pickAtelier}
            onPickUpload={pickUpload}
            currentId={currentLogo.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Logo Bottom Sheet ───────────────────────────────────
interface SheetProps {
  onClose: () => void;
  onPickAtelier: (id: string, svg: string, name: string) => void;
  onPickUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  currentId: string | null;
}

function LogoSheet({ onClose, onPickAtelier, onPickUpload, currentId }: SheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <motion.div
      className="sheet-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span className="sheet-title">Choisir un logo</span>
          <button className="sheet-close" onClick={onClose}>×</button>
        </div>
        <div className="sheet-scroll">
          {LOGO_SECTIONS.map(section => (
            <div key={section.key}>
              <div className="sheet-section-title">{section.label}</div>
              <div className="logo-grid" style={{ marginBottom: 20 }}>
                {section.logos.map(logo => (
                  <button
                    key={logo.id}
                    className={`logo-item ${currentId === logo.id ? 'selected' : ''}`}
                    onClick={() => logo.s && onPickAtelier(logo.id, logo.s, `${section.label} · ${logo.n}`)}
                  >
                    <div className="logo-item-preview">
                      {logo.s && (
                        <div
                          style={{ color: '#1A1A1A', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          dangerouslySetInnerHTML={{ __html: logo.s }}
                        />
                      )}
                    </div>
                    <span className="logo-item-name">{logo.n}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="sheet-section-title">Votre logo</div>
          <div className="upload-row" onClick={() => inputRef.current?.click()}>
            <span style={{ fontSize: 22 }}>📁</span>
            <div>
              <div className="fw-600" style={{ fontSize: 14 }}>Importer un fichier</div>
              <div className="text-xs text-3">PNG, JPEG, SVG, WebP</div>
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            style={{ display: 'none' }}
            onChange={onPickUpload}
          />
          <div style={{ height: 32 }} />
        </div>
      </motion.div>
    </motion.div>
  );
}
