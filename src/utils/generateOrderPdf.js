import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';

export async function generateOrderPdf(order, items, client) {
  const html = buildOrderHtml(order, items, client);

  if (Platform.OS === 'web') {
    const printWindow = window.open('', '_blank', 'width=960,height=760');
    if (!printWindow) {
      window.alert(
        'Votre navigateur a bloqué la fenêtre d\'impression.\n\n' +
        'Autorisez les popups pour ce site dans les paramètres de votre navigateur, puis réessayez.'
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
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Bon de commande ${order.numero}`,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

export function buildOrderHtml(order, items, client) {
  const body = buildOrderBody(order, items, client);
  return wrapInHtmlDocument(body, `Bon de commande ${order.numero}`);
}

export async function generateMultipleOrdersPdf(ordersList) {
  const bodies = ordersList.map(o => `
    <div style="page-break-after: always;">
      ${buildOrderBody(o.order, o.items, o.client)}
    </div>
  `).join('');

  const html = wrapInHtmlDocument(bodies, `Export de ${ordersList.length} commandes`);

  if (Platform.OS === 'web') {
    const printWindow = window.open('', '_blank', 'width=960,height=760');
    if (!printWindow) {
      window.alert('Votre navigateur a bloqué la fenêtre d\'impression.');
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
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Export de ${ordersList.length} commandes`,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

function buildOrderBody(order, items, client) {
  const dateCommande = fmt(order.date_commande ?? new Date());
  const nomClient = [client?.prenom, client?.nom].filter(Boolean).join(' ');
  const logoUri = 'https://zoemyisrqqfybgfnnlay.supabase.co/storage/v1/object/public/products/logo1.png';

  const typeBadgeHtml = order.type_commande === 'surgele'
    ? `<span style="display:inline-block; background:#E3F2FD; color:#1565C0; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:700; margin-bottom:8px;">Surgelé</span>`
    : `<span style="display:inline-block; background:#E8F5E9; color:#2E7D32; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:700; margin-bottom:8px;">Frais</span>`;

  const lignes = items.map((it) => {
    const pu = Number(it.prix_unitaire_ht);
    const stHt = Number(it.sous_total_ht);
    return `
      <tr>
        <td class="product-name">${esc(it.product_nom)}</td>
        <td class="c">${esc(String(it.quantite))}</td>
        <td class="r">${n2(pu)} €</td>
        <td class="r">${n2(stHt)} €</td>
      </tr>`;
  }).join('');

  const adresseHtml = esc(order.adresse_livraison ?? '').replace(/\n/g, '<br>');

  return `
<header class="page-header">
  <div class="brand">
    <img src="${logoUri}" style="height: 80px; object-fit: contain;" alt="Sof Pain" />
    <div class="brand-tagline">L'artisan des professionnels</div>
  </div>
  <div class="doc-meta">
    <h1>Bon de commande</h1>
    <div>${typeBadgeHtml}</div>
    <div class="num">N° ${esc(order.numero)}</div>
    <div class="date">Émis le ${dateCommande}</div>
  </div>
</header>

<div class="info-row">
  <div class="info-block">
    <h3>Client</h3>
    <p class="strong">${esc(client?.nom_societe || nomClient || 'N/A')}</p>
    ${client?.nom_societe && nomClient ? `<p>${esc(nomClient)}</p>` : ''}
    <p class="muted">${esc(client?.email ?? '')}</p>
    ${client?.telephone ? `<p class="muted">Tél : ${esc(client.telephone)}</p>` : ''}
    ${client?.adresse ? `<p class="muted">${esc(client.adresse)}</p>` : ''}
    ${client?.siret ? `<p class="muted">SIRET : ${esc(client.siret)}</p>` : ''}
  </div>
  <div class="info-block">
    <h3>Livraison</h3>
    ${adresseHtml ? `<p>${adresseHtml}</p>` : '<p class="muted">Adresse non renseignée</p>'}
    ${order.date_livraison_souhaitee && order.type_commande !== 'surgele' ? `<p class="delivery-date" style="margin-top: 12px; font-weight: bold; color: var(--primary);">Livraison souhaitée le ${fmt(order.date_livraison_souhaitee)}</p>` : ''}
  </div>
</div>

<div class="table-wrap">
  <div class="table-section-title">Détail de la commande</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;min-width:180px">Produit</th>
        <th class="c">Quantité</th>
        <th class="r">PU HT</th>
        <th class="r">ST HT</th>
      </tr>
    </thead>
    <tbody>${lignes}</tbody>
  </table>
</div>

<div class="totals-wrap">
  <div class="totals-box">
    <table>
      <tr class="final"><td class="lbl">Total HT</td><td style="text-align:right">${n2(order.total_ht)} €</td></tr>
    </table>
  </div>
</div>

${order.notes_client ? `
<div class="notes-block">
  <strong>Notes du client</strong>
  ${esc(order.notes_client).replace(/\n/g, '<br>')}
</div>` : ''}

<footer class="page-footer">
  <p>Document généré le ${fmt(new Date())} — Sof Pain · L'artisan des professionnels</p>
  <div class="seal">Document non contractuel</div>
</footer>`;
}

function wrapInHtmlDocument(content, title) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>${esc(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --primary:      #C4924A;
    --primary-dark: #1A0A04;
    --light:        #F6EFE4;
    --mid:          #D9AE72;
    --gray:         #5C3A1E;
    --gray-light:   #9A7350;
    --border:       #E8D8C4;
    --text:         #1A0A04;
  }

  html { font-size: 14px; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: var(--text);
    background: #fff;
    padding: 48px 56px;
    line-height: 1.6;
  }

  /* ── En-tête ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 32px;
    border-bottom: 3px solid var(--primary);
    margin-bottom: 40px;
  }
  .brand-name {
    font-size: 2rem;
    font-weight: 800;
    color: var(--primary);
    letter-spacing: -0.5px;
  }
  .brand-tagline {
    font-size: 0.85rem;
    color: var(--gray-light);
    font-style: italic;
    margin-top: 4px;
    letter-spacing: 0.3px;
  }
  .doc-meta { text-align: right; }
  .doc-meta h1 {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .doc-meta .num {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text);
    margin-top: 6px;
  }
  .doc-meta .date {
    font-size: 0.85rem;
    color: var(--gray-light);
    margin-top: 3px;
  }

  /* ── Infos 2 colonnes ── */
  .info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 40px;
  }
  .info-block {
    background: var(--light);
    border-radius: 10px;
    padding: 20px 24px;
    border-left: 4px solid var(--primary);
  }
  .info-block h3 {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--primary);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .info-block p {
    font-size: 0.92rem;
    color: var(--text);
    margin-bottom: 4px;
    line-height: 1.5;
  }
  .info-block p.muted   { color: var(--gray-light); font-size: 0.85rem; }
  .info-block p.strong  { font-weight: 700; font-size: 1rem; }
  .info-block .delivery-date {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--primary);
    margin-top: 8px;
  }

  /* ── Tableau produits ── */
  .table-section-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--primary);
    margin-bottom: 12px;
  }
  .table-wrap { margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; }
  thead tr { background: var(--primary-dark); color: #fff; }
  thead th {
    padding: 12px 14px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  tbody tr { border-bottom: 1px solid var(--border); }
  tbody tr:nth-child(even) { background: var(--light); }
  tbody td { padding: 12px 14px; font-size: 0.92rem; }
  .product-name { font-weight: 600; }
  .c    { text-align: center; }
  .r    { text-align: right; }
  .bold { font-weight: 700; color: var(--primary); }

  /* ── Totaux ── */
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 36px;
  }
  .totals-box {
    width: 320px;
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
  }
  .totals-box table { width: 100%; }
  .totals-box td {
    padding: 10px 16px;
    font-size: 0.92rem;
    border-bottom: 1px solid var(--border);
  }
  .totals-box .lbl { color: var(--gray); }
  .totals-box .val { text-align: right; font-weight: 600; }
  .totals-box tr.final { background: var(--primary-dark); }
  .totals-box tr.final td {
    color: var(--mid);
    font-size: 1.15rem;
    font-weight: 800;
    padding: 14px 16px;
    border-bottom: none;
  }

  /* ── Notes ── */
  .notes-block {
    background: var(--light);
    border-left: 4px solid var(--mid);
    border-radius: 0 10px 10px 0;
    padding: 16px 20px;
    margin-bottom: 36px;
    font-size: 0.92rem;
    line-height: 1.6;
  }
  .notes-block strong { color: var(--primary); display: block; margin-bottom: 6px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 1px; }

  /* ── Pied de page ── */
  .page-footer {
    border-top: 1px solid var(--border);
    padding-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
  }
  .page-footer p { font-size: 0.78rem; color: var(--gray-light); font-style: italic; }
  .page-footer .seal { font-size: 0.75rem; color: var(--mid); font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; }

  /* ── Impression ── */
  @media print {
    body { padding: 24px 32px; font-size: 13px; }
    @page { margin: 10mm; size: A4; }
  }
</style>
</head>
<body>
${content}
</body>
</html>`;
}

const n2 = (v) => Number(v ?? 0).toFixed(2);
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
