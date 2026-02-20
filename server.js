const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

/* Servir tous les fichiers statiques du répertoire courant */
app.use(express.static(path.join(__dirname), {
    setHeaders(res, filePath) {
        /* Pas de cache pour les fichiers HTML — toujours la dernière version */
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

/* Route par défaut :
   - SITE_MODE=dashboard  → ficheatelier-index.html  (déploiement atelier interne)
   - sinon                → index.html               (site client public)          */
const ROOT_FILE = process.env.SITE_MODE === 'dashboard'
    ? 'dashboard.html'
    : 'index.html';

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, ROOT_FILE));
});

app.listen(PORT, () => {
    console.log(`OLDA Studio démarré sur le port ${PORT}`);
});
