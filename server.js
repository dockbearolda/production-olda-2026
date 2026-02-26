const express = require('express');
const path    = require('path');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;

/* Dashboard actif par défaut — mettre SITE_MODE=form pour le site formulaire */
const IS_DASHBOARD    = process.env.SITE_MODE !== 'form';
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || 'd1e9c4cd170eb57f8ce6254b5aa70b7f708e465d48daefc7f3b0b7e16bd9f4dc';
const CLIENT_ORIGIN   = process.env.CLIENT_ORIGIN  || 'https://oldastudio.up.railway.app';

/* ── Configuration DASHOLDA (transfert automatique des commandes) ── */
const DASHOLDA_URL    = process.env.DASHOLDA_URL              || 'https://dasholda.up.railway.app';
const DASHOLDA_SECRET = process.env.DASHOLDA_WEBHOOK_SECRET   || 'd1e9c4cd170eb57f8ce6254b5aa70b7f708e465d48daefc7f3b0b7e16bd9f4dc';

/* ── Diagnostic de démarrage — visible dans les logs Railway ── */
console.log('━━━ OLDA Studio — Démarrage ━━━');
console.log('  SITE_MODE       :', process.env.SITE_MODE || '(non défini → dashboard)');
console.log('  DASHBOARD_TOKEN :', DASHBOARD_TOKEN ? '✅ défini (' + DASHBOARD_TOKEN.slice(0, 8) + '…)' : '❌ MANQUANT');
console.log('  DASHOLDA_URL    :', DASHOLDA_URL    ? '✅ ' + DASHOLDA_URL                               : '❌ MANQUANT');
console.log('  CLIENT_ORIGIN   :', CLIENT_ORIGIN);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

/* ── Log en mémoire des envois échoués vers DASHOLDA ── */
const failedForwards = [];

/* ── Stockage mémoire des commandes (dashboard uniquement) ── */
const orders = new Map();

const STATUS_KEYS = [
    'en_attente', 'a_preparer', 'maquette_a_faire', 'prt_a_faire',
    'validation', 'impression', 'pressage', 'client_a_contacter',
    'client_prevenu', 'archives'
];

function computeStats() {
    const stats = {};
    STATUS_KEYS.forEach(k => { stats[k] = 0; });
    for (const order of orders.values()) {
        const s = order.statut || 'en_attente';
        if (Object.prototype.hasOwnProperty.call(stats, s)) stats[s]++;
        else stats['en_attente']++;
    }
    return { stats, total: orders.size };
}

/* ── Socket.io (dashboard uniquement) ── */
let io = null;
if (IS_DASHBOARD) {
    io = new Server(server, {
        cors: {
            origin: [CLIENT_ORIGIN, 'http://localhost:3000'],
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        console.log('[Socket.io] Client connecté :', socket.id);
        /* Envoyer les stats actuelles au nouveau client */
        socket.emit('stats-update', computeStats());
        socket.on('disconnect', () => {
            console.log('[Socket.io] Client déconnecté :', socket.id);
        });
    });
}

/* ── CORS — autorise explicitement oldastudio + dasholda + localhost ── */
const ALLOWED_ORIGINS = [
    'https://oldastudio.up.railway.app',
    'https://dasholda.up.railway.app',
    'http://localhost:3000',
    CLIENT_ORIGIN   /* valeur de la var Railway CLIENT_ORIGIN si différente */
].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i); /* déduplique */

app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin',  origin);
    } else if (!origin) {
        /* Requête same-origin ou serveur-à-serveur — pas de header CORS nécessaire */
    } else {
        /* Origine inconnue : on répond quand même pour ne pas bloquer les tests */
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); /* cache preflight 24h */
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.use(express.json({ limit: '15mb' }));

/* ══════════════════════════════════════════════════════════════
   DASHOLDA — Mapping + Relay webhook
   Convertit le format OLDA Studio → format attendu par DASHOLDA
   ══════════════════════════════════════════════════════════════ */

/**
 * Transforme une commande OLDA Studio en payload DASHOLDA.
 * Supporte les commandes multi-articles (champ items[]) et single-article.
 * DASHOLDA attend : orderNumber, customerName, customerEmail (requis),
 * total, subtotal, items[] (non vide), paymentStatus, notes, currency.
 */
function mapToDasholda(order) {
    const prix     = order.prix     || {};
    const paiement = order.paiement || {};
    const fiche    = order.fiche    || {};

    const totalVal  = parseFloat(prix.total) || 0;
    const subtotal  = parseFloat(prix.tshirt) + parseFloat(prix.personnalisation || '0') || totalVal;

    /* E-mail — utilise l'adresse fournie ou en génère une synthétique */
    const customerEmail = order.email
        ? order.email
        : `${(order.commande || 'cmd').replace(/[^a-z0-9]/gi, '-').toLowerCase()}@commandes.oldastudio.fr`;

    /* Catégorie produit */
    const familleMap = { textile: 't-shirt', mug: 'mug' };
    const product_type = familleMap[order.famille] || order.famille || 't-shirt';

    /* Nom complet du client */
    const customerName = [order.nom, order.prenom].filter(Boolean).join(' ') || '';

    /* Construction des items :
       - Si order.items[] (multi-article tunnel React) → mappe chaque article
       - Sinon (legacy single-article) → crée un item unique */
    let items;
    if (Array.isArray(order.items) && order.items.length > 0) {
        items = order.items.map(item => {
            const p = item.prix || {};
            const name = [item.collection, item.reference, item.taille ? `(${item.taille})` : '']
                .filter(Boolean).join(' ') || 'T-shirt OLDA';
            const price = parseFloat(p.total) || parseFloat(p.tshirt) || 0;
            const notesParts = [
                item.note                ? item.note                               : '',
                item.couleurTshirt       ? `Couleur: ${item.couleurTshirt}`        : '',
                item.logoAvant           ? `Logo avant: ${item.logoAvant}`         : '',
                item.logoArriere         ? `Logo arrière: ${item.logoArriere}`     : '',
            ].filter(Boolean);
            return {
                name,
                sku:      item.reference || '',
                quantity: 1,
                price,
                notes:    notesParts.join(' | '),
                imageUrl: item.imageUrl || null,
            };
        });
    } else {
        /* Legacy single-article */
        const itemName = [order.collection, order.reference, order.taille ? `(${order.taille})` : '']
            .filter(Boolean).join(' ') || 'T-shirt OLDA';
        items = [{
            name    : itemName,
            sku     : order.reference || '',
            quantity: 1,
            price   : subtotal || totalVal,
            imageUrl: fiche.visuelAvant || fiche.mockupFront || null,
        }];
    }

    /* Notes globales de la commande */
    const prt = order.prt || {};
    const notes = [
        order.note                  ? order.note                              : '',
        order.famille               ? `Famille: ${order.famille}`             : '',
        order.adresse               ? `Adresse: ${order.adresse}`             : '',
        order.limit                 ? `Deadline: ${order.limit}`              : '',
        order.deadline              ? `Deadline: ${order.deadline}`           : '',
        /* Fiche atelier */
        fiche.typeProduit           ? `Type: ${fiche.typeProduit}`            : '',
        fiche.couleur               ? `Couleur: ${fiche.couleur}`             : '',
        fiche.tailleDTFAr           ? `DTF arrière: ${fiche.tailleDTFAr}`    : '',
        fiche.visuelArriere         ? `Visuel arrière: ${fiche.visuelArriere}`: '',
        /* PRT (press transfer) */
        prt.refPrt                  ? `PRT ref: ${prt.refPrt}`                : '',
        prt.taillePrt               ? `PRT taille: ${prt.taillePrt}`         : '',
        prt.quantite                ? `PRT qté: ${prt.quantite}`              : '',
        /* Legacy fields */
        order.couleurTshirt         ? `Couleur: ${order.couleurTshirt}`       : '',
        order.logoAvant             ? `Logo avant: ${order.logoAvant}`        : '',
        order.logoArriere           ? `Logo arrière: ${order.logoArriere}`    : '',
    ].filter(Boolean).join(' | ') || '';

    return {
        orderNumber   : order.commande     || '',
        customerName,
        customerEmail,
        customerPhone : order.telephone    || '',
        paymentStatus : paiement.statut === 'OUI' ? 'PAID' : 'PENDING',
        product_type,
        total         : totalVal,
        subtotal,
        shipping      : 0,
        tax           : 0,
        currency      : 'EUR',
        notes,
        items,
        /* Adresse de livraison */
        shippingAddress: order.adresse || null,
    };
}

/* POST /api/webhook/forward-to-dasholda
   Reçoit une commande depuis index.html (auth Bearer),
   la mappe au format DASHOLDA et la transmet via POST sécurisé. */
app.post('/api/webhook/forward-to-dasholda', async (req, res) => {
    const auth = req.headers['authorization'] || '';
    if (auth !== 'Bearer ' + DASHBOARD_TOKEN) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    const order = req.body;
    if (!order || !order.commande) {
        return res.status(400).json({ error: 'Données manquantes (champ commande requis)' });
    }

    if (!DASHOLDA_URL) {
        console.warn('[→DASHOLDA] DASHOLDA_URL non configurée — transfert ignoré pour :', order.commande);
        return res.status(503).json({ error: 'DASHOLDA_URL non configurée sur ce serveur' });
    }

    const payload = mapToDasholda(order);

    try {
        const headers = {
            'Content-Type' : 'application/json',
            'Authorization': 'Bearer ' + DASHBOARD_TOKEN   /* token concordant avec DASHOLDA */
        };
        if (DASHOLDA_SECRET) headers['x-webhook-secret'] = DASHOLDA_SECRET;

        const targetUrl = DASHOLDA_URL.replace(/\/$/, '') + '/api/orders';
        console.log('[→DASHOLDA] Envoi vers', targetUrl, '— commande:', order.commande);

        const r = await fetch(targetUrl, {
            method : 'POST',
            headers,
            body   : JSON.stringify(payload)
        });

        if (!r.ok) {
            const txt = await r.text().catch(() => '');
            throw new Error(`HTTP ${r.status} — ${txt.slice(0, 300)}`);
        }

        const data = await r.json().catch(() => ({}));
        console.log('✅ Connexion établie avec le Dashboard — commande:', order.commande, '— id:', data.id || '?');
        res.status(201).json({ ok: true, commande: order.commande, dasholadId: data.id });

    } catch (err) {
        console.error('❌ Erreur de liaison :', err.message, '— commande:', order.commande);
        failedForwards.push({
            commande : order.commande,
            payload,
            erreur   : err.message,
            tentéLe  : new Date().toISOString()
        });
        res.status(502).json({ ok: false, error: err.message });
    }
});

/* GET /api/webhook/failed-forwards
   Consulte la liste des transferts échoués (protégé par le même token). */
app.get('/api/webhook/failed-forwards', (req, res) => {
    const auth = req.headers['authorization'] || '';
    if (auth !== 'Bearer ' + DASHBOARD_TOKEN) {
        return res.status(401).json({ error: 'Non autorisé' });
    }
    res.json({ count: failedForwards.length, items: failedForwards });
});

/* GET /api/config — expose les variables Railway au client (token + URL) */
app.get('/api/config', (req, res) => {
    const url = DASHOLDA_URL || '';
    res.json({
        dasholda_url    : url.startsWith('http') ? url : ('https://' + url),
        dashboard_token : DASHBOARD_TOKEN
    });
});

/* GET /api/ping — health-check ultra-léger (pas d'auth requise) */
app.get('/api/ping', (req, res) => {
    res.json({
        ok      : true,
        mode    : IS_DASHBOARD ? 'dashboard' : 'form',
        dasholda: DASHOLDA_URL || null,
        token   : DASHBOARD_TOKEN ? 'défini' : 'MANQUANT',
        ts      : new Date().toISOString()
    });
});

/* ── POST /api/orders — reçoit une commande et transmet à DASHOLDA ── */
app.post('/api/orders', async (req, res) => {
    const auth = req.headers['authorization'] || '';
    if (auth !== 'Bearer ' + DASHBOARD_TOKEN) {
        return res.status(401).json({ error: 'Non autorisé' });
    }

    const order = req.body;
    if (!order || !order.commande) {
        return res.status(400).json({ error: 'Données manquantes (champ commande requis)' });
    }

    if (!order.statut) order.statut = 'en_attente';
    order._reçuLe = new Date().toISOString();

    orders.set(order.commande, order);
    console.log('✅ Commande reçue :', order.commande, '—', order.nom || order.customerName || '?');

    if (io) {
        io.emit('new-order', {
            commande  : order.commande,
            nom       : order.nom,
            statut    : order.statut,
            timestamp : order._reçuLe
        });
        io.emit('stats-update', computeStats());
    }

    /* ── Transfert automatique vers DASHOLDA ── */
    let dasholadaId = null;
    if (DASHOLDA_URL) {
        const payload = mapToDasholda(order);
        try {
            const headers = {
                'Content-Type' : 'application/json',
                'Authorization': 'Bearer ' + DASHBOARD_TOKEN
            };
            if (DASHOLDA_SECRET) headers['x-webhook-secret'] = DASHOLDA_SECRET;

            const targetUrl = DASHOLDA_URL.replace(/\/$/, '') + '/api/orders';
            console.log('[→DASHOLDA] Auto-transfert vers', targetUrl, '— commande:', order.commande);

            const r = await fetch(targetUrl, {
                method : 'POST',
                headers,
                body   : JSON.stringify(payload)
            });

            if (r.ok) {
                const data = await r.json().catch(() => ({}));
                dasholadaId = data.id || null;
                console.log('✅ DASHOLDA confirmé — commande:', order.commande, '— id:', dasholadaId || '?');
            } else {
                const txt = await r.text().catch(() => '');
                throw new Error(`HTTP ${r.status} — ${txt.slice(0, 300)}`);
            }
        } catch (err) {
            console.error('⚠️ Transfert DASHOLDA échoué (commande stockée localement) :', err.message, '— commande:', order.commande);
            failedForwards.push({
                commande : order.commande,
                payload,
                erreur   : err.message,
                tentéLe  : new Date().toISOString()
            });
        }
    }

    res.status(201).json({ ok: true, commande: order.commande, dasholadaId });
});

/* ── API dashboard (stats, liste, mise à jour statut) ── */
if (IS_DASHBOARD) {

    /* GET /api/stats — statistiques par statut */
    app.get('/api/stats', (req, res) => {
        res.json(computeStats());
    });

    /* GET /api/orders — liste complète (protégée) */
    app.get('/api/orders', (req, res) => {
        const auth = req.headers['authorization'] || '';
        if (auth !== 'Bearer ' + DASHBOARD_TOKEN) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
        res.json({ orders: Array.from(orders.values()), total: orders.size });
    });

    /* GET /api/orders/list — liste complète pour la page analytics (non protégée, même niveau que /api/stats) */
    app.get('/api/orders/list', (req, res) => {
        res.json({ orders: Array.from(orders.values()), total: orders.size });
    });

    /* PATCH /api/orders/:id/statut — mise à jour du statut d'une commande */
    app.patch('/api/orders/:id/statut', (req, res) => {
        const id = req.params.id;
        const { statut } = req.body;

        if (!STATUS_KEYS.includes(statut)) {
            return res.status(400).json({ error: 'Statut invalide' });
        }

        const order = orders.get(id);
        if (!order) {
            return res.status(404).json({ error: 'Commande introuvable' });
        }

        order.statut = statut;
        orders.set(id, order);

        if (io) {
            io.emit('stats-update', computeStats());
            io.emit('order-updated', { commande: id, statut });
        }

        res.json({ ok: true, commande: id, statut });
    });
}

/* ══════════════════════════════════════════════════════════════
   FICHIERS STATIQUES — APRÈS toutes les routes /api/*
   1. Vite build (dist/) — JS bundles, CSS, assets React
   2. Racine — SVGs t-shirt, images, dashboard.html, analytics.html
   Placé ICI pour ne pas intercepter les routes /api/* ci-dessus.
   ══════════════════════════════════════════════════════════════ */

/* Build React (dist/) */
const DIST_DIR = path.join(__dirname, 'dist');
const fs = require('fs');
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR, {
        setHeaders(res, filePath) {
            if (filePath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
        }
    }));
}

/* Racine — SVGs, images, manifest.json, dashboard.html, analytics.html */
app.use(express.static(path.join(__dirname), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

/* ── Route racine ── */
app.get('/', (req, res) => {
    if (IS_DASHBOARD) {
        return res.sendFile(path.join(__dirname, 'dashboard.html'));
    }
    /* Sert le build React si disponible, sinon fallback legacy */
    const distIndex = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(distIndex)) {
        return res.sendFile(distIndex);
    }
    res.status(503).send('Build React non disponible. Lancez npm run build.');
});

/* ── Routes dashboard ── */
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/dashboard/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, 'analytics.html'));
});

server.listen(PORT, () => {
    const mode = IS_DASHBOARD ? 'Dashboard (temps réel activé)' : 'Site client';
    console.log(`OLDA Studio — ${mode} — port ${PORT}`);
});
