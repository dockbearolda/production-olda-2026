// ============================================================
//  OLDA — Google Apps Script  |  Enregistrement des commandes
//  À déployer comme Application Web (voir instructions bas de page)
// ============================================================

const SHEET_NAME   = 'Commandes';
const TIMEZONE     = 'Europe/Paris';

const HEADERS = [
  'N° Commande',
  'Date',
  'Client',
  'Téléphone',
  'Collection',
  'Référence',
  'Taille',
  'Couleur T-shirt',
  'Logo Avant',
  'Couleur Logo Av.',
  'Logo Arrière',
  'Couleur Logo Ar.',
  'Note',
  'Prix T-shirt (€)',
  'Personnalisation (€)',
  'Total (€)',
  'Statut paiement',
  'Acompte (€)',
  'Horodatage'
];

// Couleurs du thème
const COLOR_HEADER_BG   = '#1C1C2E';
const COLOR_HEADER_FG   = '#FFFFFF';
const COLOR_PAYE_OUI    = '#C6EFCE';  // vert clair
const COLOR_PAYE_ACPTE  = '#FFEB9C';  // jaune clair
const COLOR_PAYE_NON    = '#FFC7CE';  // rouge clair
const COLOR_ROW_EVEN    = '#F8F9FA';  // gris très léger
const COLOR_ROW_ODD     = '#FFFFFF';

// ─────────────────────────────────────────────────────────────
//  POINT D'ENTRÉE  —  reçoit les commandes du formulaire
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    var raw  = e.postData ? e.postData.contents : '';
    if (!raw) throw new Error('Corps de requête vide');

    var data = JSON.parse(raw);
    var sheet = getOrCreateSheet_();

    // ── Ligne de données ──────────────────────────────────────
    var ts = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');

    var row = [
      data.commande         || '',
      data.date             || '',
      data.nom              || '',
      data.telephone        || '',
      data.collection       || '',
      data.reference        || '',
      data.taille           || '',
      data.couleurTshirt    || '',
      data.logoAvant        || '',
      data.couleurLogoAvant || '',
      data.logoArriere      || '',
      data.couleurLogoArriere || '',
      data.note             || '',
      data.prixTshirt       || '',
      data.personnalisation || '',
      data.total            || '',
      data.paye             || '',
      data.acompte          || '',
      ts
    ];

    sheet.appendRow(row);

    // ── Mise en forme de la ligne ajoutée ─────────────────────
    var lastRow = sheet.getLastRow();
    formatDataRow_(sheet, lastRow, data.paye);

    // ── Réponse succès ────────────────────────────────────────
    return jsonResponse_({ status: 'ok', row: lastRow });

  } catch (err) {
    logError_(err);
    return jsonResponse_({ status: 'error', message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  GET  —  vérification que le script est en ligne
// ─────────────────────────────────────────────────────────────
function doGet() {
  return jsonResponse_({ status: 'ok', message: 'OLDA API opérationnelle' });
}

// ─────────────────────────────────────────────────────────────
//  FEUILLE  —  création ou récupération
// ─────────────────────────────────────────────────────────────
function getOrCreateSheet_() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    setupHeaders_(sheet);
  } else if (sheet.getLastRow() === 0) {
    setupHeaders_(sheet);
  }

  return sheet;
}

// ─────────────────────────────────────────────────────────────
//  EN-TÊTES  —  création + style
// ─────────────────────────────────────────────────────────────
function setupHeaders_(sheet) {
  var nbCols = HEADERS.length;

  sheet.getRange(1, 1, 1, nbCols).setValues([HEADERS]);

  var hRange = sheet.getRange(1, 1, 1, nbCols);
  hRange.setBackground(COLOR_HEADER_BG);
  hRange.setFontColor(COLOR_HEADER_FG);
  hRange.setFontWeight('bold');
  hRange.setFontSize(11);
  hRange.setHorizontalAlignment('center');
  hRange.setVerticalAlignment('middle');

  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  // Largeurs fixes pour les colonnes clés
  sheet.setColumnWidth(1,  160);  // N° Commande
  sheet.setColumnWidth(2,  110);  // Date
  sheet.setColumnWidth(3,  160);  // Client
  sheet.setColumnWidth(4,  120);  // Téléphone
  sheet.setColumnWidth(5,  110);  // Collection
  sheet.setColumnWidth(6,  110);  // Référence
  sheet.setColumnWidth(7,   80);  // Taille
  sheet.setColumnWidth(8,  130);  // Couleur T-shirt
  sheet.setColumnWidth(9,  120);  // Logo Avant
  sheet.setColumnWidth(10, 130);  // Couleur Logo Av.
  sheet.setColumnWidth(11, 120);  // Logo Arrière
  sheet.setColumnWidth(12, 130);  // Couleur Logo Ar.
  sheet.setColumnWidth(13, 200);  // Note
  sheet.setColumnWidth(14, 120);  // Prix T-shirt
  sheet.setColumnWidth(15, 140);  // Personnalisation
  sheet.setColumnWidth(16, 100);  // Total
  sheet.setColumnWidth(17, 130);  // Statut paiement
  sheet.setColumnWidth(18, 100);  // Acompte
  sheet.setColumnWidth(19, 150);  // Horodatage
}

// ─────────────────────────────────────────────────────────────
//  MISE EN FORME  —  ligne de données
// ─────────────────────────────────────────────────────────────
function formatDataRow_(sheet, rowIndex, paye) {
  var nbCols   = HEADERS.length;
  var rowRange = sheet.getRange(rowIndex, 1, 1, nbCols);

  // Alternance de couleur de fond
  var bgColor = (rowIndex % 2 === 0) ? COLOR_ROW_EVEN : COLOR_ROW_ODD;
  rowRange.setBackground(bgColor);
  rowRange.setVerticalAlignment('middle');
  sheet.setRowHeight(rowIndex, 28);

  // Couleur de la cellule "Statut paiement" (colonne 17)
  var payCell = sheet.getRange(rowIndex, 17);
  var payeUpper = (paye || '').toUpperCase();
  if (payeUpper === 'OUI') {
    payCell.setBackground(COLOR_PAYE_OUI);
    payCell.setFontWeight('bold');
  } else if (payeUpper === 'ACOMPTE') {
    payCell.setBackground(COLOR_PAYE_ACPTE);
    payCell.setFontWeight('bold');
  } else {
    payCell.setBackground(COLOR_PAYE_NON);
    payCell.setFontWeight('bold');
  }
}

// ─────────────────────────────────────────────────────────────
//  UTILITAIRES
// ─────────────────────────────────────────────────────────────
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function logError_(err) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Erreurs');
  if (!sheet) sheet = ss.insertSheet('Erreurs');
  var ts = Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  sheet.appendRow([ts, err.message, err.stack || '']);
}

// ─────────────────────────────────────────────────────────────
//  FONCTION DE TEST  —  à lancer manuellement depuis l'éditeur
// ─────────────────────────────────────────────────────────────
function testerAvecCommandeFactice() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        commande    : '2026-0217-TestClient',
        date        : '17/02/2026',
        nom         : 'Client Test',
        telephone   : '0600000000',
        collection  : 'Homme',
        reference   : 'H-001',
        taille      : 'L',
        couleurTshirt        : 'Noir',
        logoAvant            : 'OLDA-01',
        couleurLogoAvant     : 'Blanc',
        logoArriere          : '',
        couleurLogoArriere   : '',
        note                 : 'Commande de test automatique',
        prixTshirt           : '25',
        personnalisation     : '10',
        total                : '35 €',
        paye                 : 'ACOMPTE',
        acompte              : '15'
      })
    }
  };

  var result = doPost(fakeEvent);
  Logger.log('Résultat : ' + result.getContent());
}

// ─────────────────────────────────────────────────────────────
//  INSTRUCTIONS DE DÉPLOIEMENT
// ─────────────────────────────────────────────────────────────
//
//  1. Ouvrir le Google Sheet qui recevra les commandes
//  2. Extensions → Apps Script
//  3. Supprimer le code existant, coller TOUT ce fichier
//  4. Sauvegarder (Ctrl+S)
//  5. Exécuter "testerAvecCommandeFactice" pour vérifier
//     (accepter les autorisations demandées par Google)
//  6. Déployer → Nouveau déploiement
//       Type         : Application Web
//       Exécuter en  : Moi (votre compte Google)
//       Accès        : Tout le monde
//  7. Copier l'URL générée
//  8. Dans index.html ligne 705, remplacer la valeur de API :
//       const API = "COLLER_L_URL_ICI";
//  9. Valider une commande test → la ligne doit apparaître
//     dans l'onglet "Commandes" du Google Sheet
//
// ─────────────────────────────────────────────────────────────
