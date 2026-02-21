const express = require('express');
const path    = require('path');
const http    = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 3000;

const IS_DASHBOARD    = process.env.SITE_MODE === 'dashboard';
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || 'd1e9c4cd170eb57f8ce6254b5aa70b7f708e465d48daefc7f3b0b7e16bd9f4dc';
const CLIENT_ORIGIN   = process.env.CLIENT_ORIGIN  || 'https://oldastudio.up.railway.app';

/* ── Configuration DASHOLDA (transfert automatique des commandes) ── */
const DASHOLDA_URL    = process.env.DASHOLDA_URL              || 'https://dasholda.up.railway.app';
const DASHOLDA_SECRET = process.env.DASHOLDA_WEBHOOK_SECRET   || '';

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

/* ── CORS pour les requêtes cross-origin du site client ── */
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin',  CLIENT_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
 * DASHOLDA attend : orderNumber, customerName, customerEmail (requis),
 * total, subtotal, items[] (non vide), paymentStatus, notes, currency.
 */
function mapToDasholda(order) {
    const prix     = order.prix     || {};
    const paiement = order.paiement || {};
    const fiche    = order.fiche    || {};

    const tshirtVal = parseFloat(prix.tshirt)           || 0;
    const persoVal  = parseFloat(prix.personnalisation)  || 0;
    const subtotal  = tshirtVal + persoVal;
    const totalVal  = parseFloat(prix.total)             || subtotal;

    /* E-mail synthétique — OLDA Studio ne collecte pas les adresses e-mail */
    const emailSlug    = (order.commande || 'cmd').replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const customerEmail = `${emailSlug}@commandes.oldastudio.fr`;

    /* Libellé de l'article */
    const itemName = [order.collection, order.reference, order.taille ? `(${order.taille})` : '']
        .filter(Boolean).join(' ') || 'T-shirt OLDA';

    /* Notes enrichies */
    const notes = [
        order.note        || '',
        order.famille     ? `Famille: ${order.famille}`           : '',
        order.couleurTshirt ? `Couleur: ${order.couleurTshirt}`   : '',
        order.logoAvant   ? `Logo avant: ${order.logoAvant}`      : '',
        order.logoArriere ? `Logo arrière: ${order.logoArriere}`  : ''
    ].filter(Boolean).join(' | ') || '';

    return {
        orderNumber   : order.commande   || '',
        customerName  : order.nom        || '',
        customerEmail,
        customerPhone : order.telephone  || '',
        paymentStatus : paiement.statut === 'OUI' ? 'PAID' : 'PENDING',
        total         : totalVal,
        subtotal,
        shipping      : 0,
        tax           : 0,
        currency      : 'EUR',
        notes,
        items: [{
            name    : itemName,
            sku     : order.reference || '',
            quantity: 1,
            price   : subtotal || totalVal,
            imageUrl: fiche.mockupFront || null
        }]
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
        const headers = { 'Content-Type': 'application/json' };
        if (DASHOLDA_SECRET) headers['x-webhook-secret'] = DASHOLDA_SECRET;

        const r = await fetch(DASHOLDA_URL + '/api/orders', {
            method : 'POST',
            headers,
            body   : JSON.stringify(payload)
        });

        if (!r.ok) {
            const txt = await r.text().catch(() => '');
            throw new Error(`HTTP ${r.status} — ${txt.slice(0, 300)}`);
        }

        const data = await r.json();
        console.log('[→DASHOLDA] OK :', order.commande, '— id:', data.id || '?');
        res.status(201).json({ ok: true, commande: order.commande, dasholadId: data.id });

    } catch (err) {
        console.error('[→DASHOLDA] ERREUR pour', order.commande, '—', err.message);
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

/* ── Fichiers statiques ── */
app.use(express.static(path.join(__dirname), {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

/* ── API Commandes (dashboard uniquement) ── */
if (IS_DASHBOARD) {

    /* POST /api/orders — reçoit une commande du site client */
    app.post('/api/orders', (req, res) => {
        const auth = req.headers['authorization'] || '';
        if (auth !== 'Bearer ' + DASHBOARD_TOKEN) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const order = req.body;
        if (!order || !order.commande) {
            return res.status(400).json({ error: 'Données manquantes (champ commande requis)' });
        }

        /* Initialisation */
        if (!order.statut) order.statut = 'en_attente';
        order._reçuLe = new Date().toISOString();

        orders.set(order.commande, order);

        console.log('[Dashboard] Nouvelle commande :', order.commande, '—', order.nom);

        /* Diffusion temps réel à tous les clients dashboard connectés */
        if (io) {
            io.emit('new-order', {
                commande  : order.commande,
                nom       : order.nom,
                statut    : order.statut,
                timestamp : order._reçuLe
            });
            io.emit('stats-update', computeStats());
        }

        res.status(201).json({ ok: true, commande: order.commande });
    });

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
}

/* ── Route racine ── */
const ROOT_FILE = IS_DASHBOARD ? 'dashboard.html' : 'index.html';

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, ROOT_FILE));
});

server.listen(PORT, () => {
    const mode = IS_DASHBOARD ? 'Dashboard (temps réel activé)' : 'Site client';
    console.log(`OLDA Studio — ${mode} — port ${PORT}`);
});
