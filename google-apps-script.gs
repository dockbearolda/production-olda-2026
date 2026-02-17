// ============================================================
//  OLDA — Google Apps Script  |  Enregistrement des commandes
// ============================================================

const SHEET_NAME = 'Commandes';
const TIMEZONE   = 'Europe/Paris';

// ─────────────────────────────────────────────────────────────
//  POINT D'ENTRÉE  —  reçoit les commandes du formulaire
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    var raw = e.postData ? e.postData.contents : '';
    if (!raw) throw new Error('Corps de requête vide');

    var data  = JSON.parse(raw);
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Feuille "' + SHEET_NAME + '" introuvable');

    // Ligne A → R (18 colonnes)
    var row = [
      data.commande          || '',  // A  N° COMMANDE
      data.date              || '',  // B  DATE
      data.nom               || '',  // C  NOM
      '',                            // D  TÉLÉPHONE (écrit séparément en texte pur)
      data.collection        || '',  // E  COLLECTION
      data.reference         || '',  // F  RÉFÉRENCE
      data.taille            || '',  // G  TAILLE
      data.couleurTshirt     || '',  // H  COULEUR T-SHIRT
      data.logoAvant         || '',  // I  LOGO AVANT
      data.couleurLogoAvant  || '',  // J  COULEUR LOGO AVANT
      data.logoArriere       || '',  // K  LOGO ARRIÈRE
      data.couleurLogoArriere|| '',  // L  COULEUR LOGO ARRIÈRE
      data.prixTshirt        || '',  // M  PRIX T-SHIRT
      data.personnalisation  || '',  // N  PERSONNALISATION
      data.total             || '',  // O  TOTAL
      data.paye              || '',  // P  PAYÉ
      '',                            // Q  FICHE (lien, défini via setFormula)
      data.note              || ''   // R  NOTE
    ];

    sheet.appendRow(row);

    var lastRow = sheet.getLastRow();

    // TÉLÉPHONE — format texte puis setValue garantit la conservation du + et du 0 initial
    var telCell = sheet.getRange(lastRow, 4);
    telCell.setNumberFormat('@');
    telCell.setValue(data.telephone || '');

    // Ligne entière — fond pastel rose (Femme) ou bleu (Homme)
    var collectionLower = (data.collection || '').toLowerCase();
    var rowRange = sheet.getRange(lastRow, 1, 1, row.length);
    if (collectionLower.indexOf('femme') !== -1) {
      rowRange.setBackground('#FFE8F0');  // Rose pastel
    } else if (collectionLower.indexOf('homme') !== -1) {
      rowRange.setBackground('#DCE8FF');  // Bleu pastel
    }

    // Colonne P (col 16) — couleur pastel Apple selon statut paiement
    var payCell   = sheet.getRange(lastRow, 16);
    var payeUpper = (data.paye || '').toUpperCase();
    if (payeUpper === 'OUI') {
      payCell.setBackground('#D9F5E4');  // Vert pastel Apple
      payCell.setFontColor('#196030');
      payCell.setFontWeight('bold');
    } else {
      payCell.setBackground('#FFE5E3');  // Rouge pastel Apple
      payCell.setFontColor('#C01010');
      payCell.setFontWeight('bold');
    }

    // Colonne Q (col 17) — lien vers la fiche atelier
    if (data.fiche) {
      sheet.getRange(lastRow, 17).setFormula('=HYPERLINK("' + data.fiche + '","Voir fiche")');
    }

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
//  UTILITAIRES
// ─────────────────────────────────────────────────────────────
function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Retourne true si la couleur hex est sombre (pour choisir texte blanc ou noir)
function isColorDark_(hex) {
  hex = (hex || '').replace('#', '');
  if (hex.length < 6) return false;
  var r = parseInt(hex.substring(0, 2), 16);
  var g = parseInt(hex.substring(2, 4), 16);
  var b = parseInt(hex.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
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
        commande           : '2026-0217-Test',
        date               : '17/02/2026',
        nom                : 'Client Test',
        telephone          : '0612345678',
        collection         : 'Femme',
        reference          : 'F-002',
        taille             : 'M',
        couleurTshirt      : 'Rose',
        couleurTshirtHex   : '#FF2D55',
        logoAvant          : 'OLDA-03',
        couleurLogoAvant   : 'Blanc',
        logoArriere        : '',
        couleurLogoArriere : '',
        prixTshirt         : '25',
        personnalisation   : '10',
        total              : '35 €',
        paye               : 'OUI',
        fiche              : 'https://ficheatelier.pages.dev#test'
      })
    }
  };

  var result = doPost(fakeEvent);
  Logger.log('Résultat : ' + result.getContent());
}

// ─────────────────────────────────────────────────────────────
//  DÉPLOIEMENT
// ─────────────────────────────────────────────────────────────
//
//  1. Google Sheet → Extensions → Apps Script
//  2. Supprimer le code existant, coller CE fichier → Sauvegarder
//  3. Lancer "testerAvecCommandeFactice" pour vérifier
//  4. Déployer → Nouveau déploiement
//       Type        : Application Web
//       Exécuter en : Moi
//       Accès       : Tout le monde
//  5. Copier l'URL → index.html const API = "..."
//
//  NOTE : Le script écrit uniquement les données.
//  Le design (couleurs, polices, largeurs) reste 100% manuel.
//  Le 0 du téléphone est toujours conservé automatiquement.
//
// ─────────────────────────────────────────────────────────────
