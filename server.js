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
