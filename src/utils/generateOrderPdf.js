import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

/**
 * Génère et propose le téléchargement/partage d'un bon de commande PDF.
 *
 * @param {object} order - La commande (telle qu'insérée en BDD, avec les champs de la table `orders`)
 * @param {Array}  items - Les lignes de commande (chaque item doit contenir :
 *                          { product_nom, quantite_palettes, cartons_par_palette,
 *                            prix_palette_ht, tva_pourcent, sous_total_ht })
 * @param {object} client - Profil du client : { nom, prenom, nom_societe, email, ... }
 */
export async function generateOrderPdf(order, items, client) {
  // Charger le logo en base64 pour l'intégrer au PDF (fiable cross-platform)
  let logoBase64 = '';
  try {
    const asset = Asset.fromModule(require('../../assets/logo1.png'));
    await asset.downloadAsync();

    if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      logoBase64 = await blobToBase64(blob);
    } else {
      const FileSystem = require('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      logoBase64 = `data:image/png;base64,${base64}`;
    }
  } catch (err) {
    console.warn('Logo non chargé, PDF sans logo :', err);
  }

  const html = buildHtml(order, items, client, logoBase64);

  // Générer le PDF
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // Proposer le partage / téléchargement
  if (Platform.OS === 'web') {
    // Sur web : on déclenche un téléchargement direct
    const link = document.createElement('a');
    link.href = uri;
    link.download = `bon-de-commande-${order.numero}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // Sur mobile : on ouvre le menu de partage natif
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Bon de commande',
        UTI: 'com.adobe.pdf',
      });
    }
  }

  return uri;
}

// ---------------------------------------------------------
// Construction du HTML du PDF
// ---------------------------------------------------------

function buildHtml(order, items, client, logoBase64) {
  const dateCommande = formatDate(order.date_commande || new Date());
  const dateLivraison = order.date_livraison_souhaitee
    ? formatDate(order.date_livraison_souhaitee)
    : 'À définir';

  const nomClient = [client.prenom, client.nom].filter(Boolean).join(' ');

  const itemsRows = items
    .map((item) => {
      const sousTotalHt = Number(item.sous_total_ht).toFixed(2);
      return `
        <tr>
          <td>${escapeHtml(item.product_nom)}</td>
          <td class="center">${item.quantite_palettes}</td>
          <td class="center">${item.cartons_par_palette}</td>
          <td class="right">${Number(item.prix_palette_ht).toFixed(2)} €</td>
          <td class="center">${Number(item.tva_pourcent).toFixed(1)} %</td>
          <td class="right strong">${sousTotalHt} €</td>
        </tr>
      `;
    })
    .join('');

  const totalHt = Number(order.total_ht).toFixed(2);
  const totalTva = Number(order.total_tva).toFixed(2);
  const totalTtc = Number(order.total_ttc).toFixed(2);

  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="Sof Pain" class="logo" />`
    : `<div class="logo-placeholder">SOF PAIN</div>`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Bon de commande ${escapeHtml(order.numero)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      color: #2C2C2C;
      margin: 0;
      padding: 40px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 24px;
      border-bottom: 2px solid #8B5E3C;
    }
    .header-left {
      flex: 1;
    }
    .logo {
      width: 140px;
      height: auto;
      max-height: 140px;
      margin-bottom: 8px;
    }
    .logo-placeholder {
      width: 140px;
      height: 60px;
      background: #8B5E3C;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
      letter-spacing: 2px;
      border-radius: 8px;
    }
    .tagline {
      color: #6B6B6B;
      font-style: italic;
      font-size: 11px;
      margin-top: 4px;
    }
    .header-right {
      text-align: right;
    }
    .doc-title {
      font-size: 24px;
      font-weight: bold;
      color: #8B5E3C;
      margin: 0 0 4px 0;
    }
    .doc-number {
      font-size: 14px;
      color: #2C2C2C;
      font-weight: 600;
    }
    .doc-date {
      color: #6B6B6B;
      margin-top: 4px;
    }
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #8B5E3C;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #E0E0E0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    .info-block p {
      margin: 2px 0;
    }
    .info-block .label {
      font-size: 10px;
      color: #9E9E9E;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-block .value {
      font-weight: 600;
      color: #2C2C2C;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th {
      background: #F5E6D3;
      color: #2C2C2C;
      padding: 10px 8px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      border-bottom: 2px solid #8B5E3C;
    }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #E0E0E0;
      font-size: 12px;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .strong { font-weight: 600; }
    .totals {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-table {
      width: 280px;
      border-collapse: collapse;
    }
    .totals-table td {
      padding: 6px 8px;
      border: none;
      font-size: 12px;
    }
    .totals-table .label-col {
      text-align: right;
      color: #6B6B6B;
    }
    .totals-table .value-col {
      text-align: right;
      font-weight: 600;
      width: 110px;
    }
    .total-final {
      border-top: 2px solid #8B5E3C !important;
      padding-top: 10px !important;
    }
    .total-final .label-col,
    .total-final .value-col {
      font-size: 14px;
      font-weight: bold;
      color: #8B5E3C;
    }
    .notes {
      background: #FAF7F2;
      border-left: 3px solid #8B5E3C;
      padding: 12px 16px;
      margin-top: 24px;
      font-size: 11px;
    }
    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #E0E0E0;
      text-align: center;
      color: #9E9E9E;
      font-size: 10px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <!-- Entête -->
  <div class="header">
    <div class="header-left">
      ${logoImg}
      <div class="tagline">L'artisan des professionnels</div>
    </div>
    <div class="header-right">
      <div class="doc-title">BON DE COMMANDE</div>
      <div class="doc-number">N° ${escapeHtml(order.numero)}</div>
      <div class="doc-date">Émis le ${dateCommande}</div>
    </div>
  </div>

  <!-- Infos client + livraison -->
  <div class="section">
    <div class="info-grid">
      <div class="info-block">
        <div class="section-title">Client</div>
        <p><span class="value">${escapeHtml(client.nom_societe || 'N/A')}</span></p>
        <p>${escapeHtml(nomClient)}</p>
        <p>${escapeHtml(client.email || '')}</p>
        ${client.telephone ? `<p>Tél : ${escapeHtml(client.telephone)}</p>` : ''}
      </div>
      <div class="info-block">
        <div class="section-title">Livraison</div>
        ${order.adresse_livraison
          ? `<p>${escapeHtml(order.adresse_livraison).replace(/\n/g, '<br />')}</p>`
          : '<p>Adresse non renseignée</p>'}
        <p style="margin-top: 8px;">
          <span class="label">Livraison souhaitée</span><br />
          <span class="value">${dateLivraison}</span>
        </p>
      </div>
    </div>
  </div>

  <!-- Tableau des produits -->
  <div class="section">
    <div class="section-title">Détail de la commande</div>
    <table>
      <thead>
        <tr>
          <th>Produit</th>
          <th class="center">Palettes</th>
          <th class="center">Cartons / palette</th>
          <th class="right">Prix HT / palette</th>
          <th class="center">TVA</th>
          <th class="right">Sous-total HT</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totaux -->
    <div class="totals">
      <table class="totals-table">
        <tr>
          <td class="label-col">Total HT</td>
          <td class="value-col">${totalHt} €</td>
        </tr>
        <tr>
          <td class="label-col">TVA</td>
          <td class="value-col">${totalTva} €</td>
        </tr>
        <tr class="total-final">
          <td class="label-col">Total TTC</td>
          <td class="value-col">${totalTtc} €</td>
        </tr>
      </table>
    </div>
  </div>

  ${order.notes_client
    ? `<div class="notes">
        <strong>Notes du client :</strong><br />
        ${escapeHtml(order.notes_client).replace(/\n/g, '<br />')}
      </div>`
    : ''}

  <div class="footer">
    Sof Pain — L'artisan des professionnels<br />
    Document généré automatiquement le ${formatDate(new Date())}
  </div>
</body>
</html>
  `.trim();
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}