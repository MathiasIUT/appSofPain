import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Génère et ouvre le bon mensuel d'un client pour un mois donné.
 * @param {object} client  - profil client (nom_societe, prenom, nom, adresse, siret…)
 * @param {Date}   date    - n'importe quelle date du mois concerné
 * @param {Array}  orders  - commandes avec order_items enrichis
 */
export async function generateMonthlyBonPdf(client, date, orders) {
  const html = buildHtml(client, date, orders);

  if (Platform.OS === 'web') {
    const printWindow = window.open('', '_blank', 'width=960,height=760');
    if (!printWindow) {
      window.alert(
        "Votre navigateur a bloqué la fenêtre d'impression.\n\n" +
        "Autorisez les popups pour ce site puis réessayez."
      );
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    const clientName = client.nom_societe
      || [client.prenom, client.nom].filter(Boolean).join('_')
      || 'Client';
    const monthStr = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Bon mensuel — ${clientName} — ${monthStr}`,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const esc = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const n2 = (v) => Number(v ?? 0).toFixed(2);

// ─── Construction HTML ────────────────────────────────────────────────────────

function buildHtml(client, date, orders) {
  const clientName = client.nom_societe
    || [client.prenom, client.nom].filter(Boolean).join(' ')
    || 'Client inconnu';

  const monthLabel = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const printDate = fmtDate(new Date());

  // Total global du mois
  const totalMois = orders.reduce((acc, o) => acc + Number(o.total_ht || 0), 0);

  // Construire les lignes du tableau unique (ligne par ligne)
  let tableRows = '';
  orders.forEach((o, orderIndex) => {
    const items = o.order_items || [];
    const sousTotalHt = Number(o.total_ht || 0);
    const rowClass = orderIndex % 2 === 0 ? 'order-even' : 'order-odd';

    if (items.length === 0) {
      // Commande vide : une seule ligne
      tableRows += `
        <tr class="data-row ${rowClass}">
          <td>${fmtDate(o.date_commande)}</td>
          <td class="col-num">${esc(o.numero)}</td>
          <td colspan="4" style="color:#999;font-style:italic;">Aucun article</td>
        </tr>`;
    } else {
      items.forEach((it, itIndex) => {
        const prodNom = esc(it.product_nom || it.products?.nom || `Produit #${it.product_id}`);
        const qty = it.quantite;
        const pu = Number(it.prix_unitaire_ht || 0);
        const ligneTotal = n2(pu * qty);

        // La date et le N° de commande n'apparaissent que sur la 1ère ligne du groupe
        const dateCell = itIndex === 0
          ? `<td class="col-date" rowspan="${items.length}">${fmtDate(o.date_commande)}</td><td class="col-num" rowspan="${items.length}">${esc(o.numero)}</td>`
          : '';

        tableRows += `
        <tr class="data-row ${rowClass}">
          ${dateCell}
          <td class="col-produit">${prodNom}</td>
          <td class="col-qty">${qty}</td>
          <td class="col-pu">${n2(pu)} €</td>
          <td class="col-total">${ligneTotal} €</td>
        </tr>`;
      });
    }

    // Ligne sous-total par commande (optionnelle si 1 seul article)
    if (items.length > 1) {
      tableRows += `
        <tr class="subtotal-row">
          <td colspan="5" style="text-align:right;padding-right:8px;font-weight:700;font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Sous-total commande</td>
          <td class="col-total" style="font-weight:700;color:#C4924A;">${n2(sousTotalHt)} €</td>
        </tr>`;
    }
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bon mensuel — ${esc(clientName)} — ${esc(monthLabelCap)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --primary: #C4924A; --primary-light: #FFF6EC; --text: #1A1A1A; --muted: #666; --border: #DDD; }

  html { font-size: 10px; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: var(--text);
    padding: 16px 20px;
    line-height: 1.35;
  }

  /* ── En-tête ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid var(--primary);
    padding-bottom: 10px;
    margin-bottom: 12px;
  }
  .brand { font-size: 20px; font-weight: 900; color: var(--primary); letter-spacing: 2px; }
  .brand-sub { font-size: 8px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 16px; font-weight: 800; text-transform: uppercase; color: var(--text); }
  .doc-title .doc-period { font-size: 12px; font-weight: 700; color: var(--primary); margin-top: 2px; }
  .doc-title .doc-print { font-size: 8px; color: var(--muted); margin-top: 3px; }

  /* ── Bloc client ── */
  .client-block {
    background: var(--primary-light);
    border-left: 4px solid var(--primary);
    border-radius: 4px;
    padding: 8px 12px;
    margin-bottom: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .client-main { flex: 1; min-width: 200px; }
  .client-block .label { font-size: 8px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .client-name { font-size: 14px; font-weight: 800; color: var(--text); }
  .client-detail { font-size: 9px; color: var(--muted); margin-top: 2px; }

  /* ── Résumé ── */
  .summary-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .summary-pill {
    background: #F5F5F5;
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 9px;
    color: var(--muted);
  }
  .summary-pill strong { color: var(--text); }

  /* ── Tableau principal ── */
  .main-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    font-size: 10px;
  }
  .main-table thead tr {
    background: #F0F0F0;
  }
  .main-table th {
    padding: 6px 8px;
    text-align: left;
    font-size: 8.5px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 2px solid var(--border);
  }
  .main-table th.right, .main-table td.right { text-align: right; }
  .main-table th.center, .main-table td.center { text-align: center; }

  .data-row td {
    padding: 4px 8px;
    border-bottom: 1px solid #F0F0F0;
    vertical-align: top;
  }
  .order-even td { background: #FFFFFF; }
  .order-odd  td { background: #FAFAFA; }

  .col-date  { width: 10%; white-space: nowrap; color: var(--text); font-weight: 600; }
  .col-num   { width: 14%; font-size: 9px; color: var(--muted); white-space: nowrap; }
  .col-produit { width: 38%; }
  .col-qty   { width: 8%;  text-align: center; font-weight: 600; }
  .col-pu    { width: 13%; text-align: right; color: var(--muted); }
  .col-total { width: 13%; text-align: right; font-weight: 600; color: var(--text); }

  /* Ligne sous-total par commande */
  .subtotal-row td {
    padding: 3px 8px;
    background: #FFF8F0;
    border-bottom: 2px solid #E8D5BB;
    font-size: 9px;
  }

  /* ── Total global ── */
  .total-global {
    margin-top: 14px;
    border-top: 2px solid var(--primary);
    padding-top: 8px;
    display: flex;
    justify-content: flex-end;
    align-items: baseline;
    gap: 10px;
  }
  .total-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  .total-amount { font-size: 20px; font-weight: 900; color: var(--primary); }
  .total-ht-tag { font-size: 9px; color: var(--muted); }

  /* ── Pied de page ── */
  .page-footer {
    margin-top: 16px;
    border-top: 1px solid var(--border);
    padding-top: 6px;
    font-size: 8px;
    color: var(--muted);
    text-align: center;
  }

  /* ── Impression ── */
  @media print {
    @page { margin: 8mm 10mm; size: A4; }
    body { padding: 0; font-size: 9px; }
    .main-table { font-size: 9px; }
    .subtotal-row td { page-break-after: avoid; }
  }
</style>
</head>
<body>

  <!-- En-tête -->
  <div class="page-header">
    <div>
      <div class="brand">SOF PAIN</div>
      <div class="brand-sub">Livraison de produits frais</div>
    </div>
    <div class="doc-title">
      <h1>Bon Mensuel</h1>
      <div class="doc-period">${esc(monthLabelCap)}</div>
      <div class="doc-print">Imprimé le ${esc(printDate)}</div>
    </div>
  </div>

  <!-- Client -->
  <div class="client-block">
    <div class="client-main">
      <div class="label">Client</div>
      <div class="client-name">${esc(clientName)}</div>
      ${client.adresse ? `<div class="client-detail">📍 ${esc(client.adresse)}${client.ville ? `, ${esc(client.ville)}` : ''}</div>` : ''}
    </div>
    <div>
      ${client.telephone ? `<div class="client-detail">📞 ${esc(client.telephone)}</div>` : ''}
      ${client.siret ? `<div class="client-detail">SIRET : ${esc(client.siret)}</div>` : ''}
    </div>
  </div>

  <!-- Résumé -->
  <div class="summary-bar">
    <div class="summary-pill"><strong>${orders.length}</strong> commande${orders.length > 1 ? 's' : ''}</div>
    <div class="summary-pill">Période : <strong>${esc(monthLabelCap)}</strong></div>
  </div>

  <!-- Tableau des commandes -->
  ${orders.length > 0 ? `
  <table class="main-table">
    <thead>
      <tr>
        <th class="col-date">Date</th>
        <th class="col-num">N° Commande</th>
        <th class="col-produit">Produit</th>
        <th class="col-qty center">Qté</th>
        <th class="col-pu right">Prix unit. HT</th>
        <th class="col-total right">Montant HT</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  ` : '<p style="text-align:center;color:#999;padding:20px;">Aucune commande ce mois-ci.</p>'}

  <!-- Total global -->
  <div class="total-global">
    <span class="total-label">Total du mois</span>
    <span class="total-amount">${n2(totalMois)} €</span>
    <span class="total-ht-tag">HT</span>
  </div>

  <!-- Pied de page -->
  <div class="page-footer">
    Document généré automatiquement par SofPain · ${esc(monthLabelCap)} · ${esc(clientName)}
  </div>

</body>
</html>`;
}

