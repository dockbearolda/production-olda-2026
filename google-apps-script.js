/**
 * Google Apps Script — OLDA Production
 *
 * Colonnes Google Sheets :
 *   A = N°              B = Date           C = Client
 *   D = Téléphone       E = Collection     F = Référence
 *   G = Taille          H = Couleur T-shirt
 *   I = Motif Logo Av   J = Motif Logo Ar  K = Logo Arrière
 *   L = Note            M = Prix T-shirt   N = Personnalisation
 *   O = Total           P = Payé           Q = Fiche
 *
 * ── INSTALLATION ──
 * 1. Ouvrir le Google Sheet
 * 2. Extensions → Apps Script
 * 3. Coller ce code et sauvegarder
 * 4. Déployer → Nouveau déploiement → Application Web
 *    - Exécuter en tant que : Moi
 *    - Accès : Tout le monde
 * 5. Copier l'URL du déploiement et la coller dans index.html (const API = "...")
 */

/* ── En-têtes (créés automatiquement si la feuille est vide) ── */
var HEADERS = [
  'N°', 'Date', 'Client', 'Téléphone',
  'Collection', 'Référence', 'Taille', 'Couleur T-shirt',
  'Motif Logo Av', 'Motif Logo Ar', 'Logo Arrière',
  'Note', 'Prix T-shirt', 'Personnalisation', 'Total',
  'Payé', 'Fiche'
];

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Commandes') || ss.getActiveSheet();

    /* Créer les en-têtes si la première ligne est vide */
    if (sheet.getLastRow() === 0 || sheet.getRange(1, 1).getValue() === '') {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#1a1a1a')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    /* Construire la ligne A → Q */
    var row = [
      data.commande        || '',   // A — N°
      data.date            || '',   // B — Date
      data.nom             || '',   // C — Client
      data.telephone       || '',   // D — Téléphone
      data.collection      || '',   // E — Collection
      data.reference       || '',   // F — Référence
      data.taille          || '',   // G — Taille
      data.couleurTshirt   || '',   // H — Couleur T-shirt
      data.logoAvant       || '',   // I — Motif Logo Av
      data.logoArriere     || '',   // J — Motif Logo Ar
      data.couleurLogoArriere || '', // K — Logo Arrière (couleur)
      data.note            || '',   // L — Note
      data.prixTshirt      || '',   // M — Prix T-shirt
      data.personnalisation || '',  // N — Personnalisation
      data.total           || '',   // O — Total
      formatPaye(data),             // P — Payé
      ''                            // Q — Fiche (image insérée après)
    ];

    var newRow = sheet.getLastRow() + 1;
    sheet.getRange(newRow, 1, 1, row.length).setValues([row]);

    /* ── Insérer l'image de la fiche en colonne Q ── */
    if (data.fiche && data.fiche.indexOf('data:image') === 0) {
      try {
        var base64 = data.fiche.split(',')[1];
        var blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', 'fiche.png');
        var folder = getOrCreateFolder('Fiches_OLDA');
        var file = folder.createFile(blob);
        file.setName((data.commande || 'fiche') + '.png');
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var url = 'https://drive.google.com/uc?id=' + file.getId();
        sheet.getRange(newRow, 17).setValue(url);
      } catch (imgErr) {
        sheet.getRange(newRow, 17).setValue('Erreur image');
        Logger.log('Image error: ' + imgErr);
      }
    }

    /* ── Auto-resize colonnes ── */
    sheet.autoResizeColumns(1, HEADERS.length);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', row: newRow }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('doPost error: ' + err);
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ── GET pour tester que le script est en ligne ── */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'OLDA API active' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ── Formater le statut de paiement ── */
function formatPaye(data) {
  var statut = data.paye || 'NON';
  if (statut === 'ACOMPTE' && data.acompte) {
    return 'ACOMPTE (' + data.acompte + ' €)';
  }
  return statut;
}

/* ── Créer / récupérer le dossier Drive pour les fiches ── */
function getOrCreateFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}
