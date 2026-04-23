import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/**
 * Génère et propose le téléchargement du bon de commande PDF.
 *
 * Sur web    → ouvre une fenêtre d'impression (Ctrl+P → Enregistrer en PDF)
 * Sur mobile → génère un vrai fichier PDF et ouvre le menu de partage natif
 */
export async function generateOrderPdf(order, items, client) {
  const html = buildHtml(order, items, client);

  if (Platform.OS === 'web') {
    // ── WEB : on ouvre une fenêtre dédiée avec le contenu du bon de commande
    // L'utilisateur fait Ctrl+P → "Enregistrer en PDF" ou imprime directement.
    const printWindow = window.open('', '_blank', 'width=900,height=700');
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
    // On attend que les ressources soient chargées avant de lancer l'impression
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    return;
  }

  // ── MOBILE : on utilise expo-print pour générer un vrai PDF
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

// ─────────────────────────────────────────────────────────────────────────────
// Construction du HTML
// ─────────────────────────────────────────────────────────────────────────────

function buildHtml(order, items, client) {
  const dateCommande  = fmt(order.date_commande  ?? new Date());
  const dateLivraison = order.date_livraison_souhaitee
    ? fmt(order.date_livraison_souhaitee)
    : 'À définir';

  const nomClient = [client?.prenom, client?.nom].filter(Boolean).join(' ');

  // Construire les lignes du tableau produits
  const lignes = items
    .map((it) => {
      const pu    = Number(it.prix_palette_ht);
      const stHt  = Number(it.sous_total_ht);
      const tva   = Number(it.tva_pourcent);
      const stTtc = stHt * (1 + tva / 100);
      return `
      <tr>
        <td>${esc(it.product_nom)}</td>
        <td class="c">${it.quantite_palettes}</td>
        <td class="c">${it.cartons_par_palette}</td>
        <td class="r">${n2(pu)} €</td>
        <td class="c">${n1(tva)} %</td>
        <td class="r">${n2(stHt)} €</td>
        <td class="r bold">${n2(stTtc)} €</td>
      </tr>`;
    })
    .join('');

  const totalHt  = n2(order.total_ht);
  const totalTva = n2(order.total_tva);
  const totalTtc = n2(order.total_ttc);

  // Adresse formatée : on remplace les sauts de ligne par <br>
  const adresseHtml = esc(order.adresse_livraison ?? '')
    .replace(/\n/g, '<br>');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bon de commande ${esc(order.numero)}</title>
<style>
  /* ── Reset & base ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 13px; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a;
    background: #fff;
    padding: 48px 52px;
    line-height: 1.55;
  }

  /* ── Couleurs maison ── */
  :root {
    --primary:  #7B4F2E;   /* brun chaud Sof Pain */
    --light:    #F6EDE4;   /* fond clair */
    --mid:      #C49A6C;   /* accent */
    --gray:     #6B6B6B;
    --border:   #D9CFC6;
  }

  /* ── Entête ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 28px;
    border-bottom: 3px solid var(--primary);
    margin-bottom: 36px;
  }
  .brand img {
    width: 160px;
    height: auto;
  }
  .brand-name {
    font-size: 1.7rem;
    font-weight: 800;
    color: var(--primary);
    letter-spacing: 0.5px;
  }
  .brand-tagline {
    font-size: 0.78rem;
    color: var(--gray);
    font-style: italic;
    margin-top: 3px;
    letter-spacing: 0.3px;
  }
  .doc-meta {
    text-align: right;
  }
  .doc-meta h1 {
    font-size: 1.55rem;
    font-weight: 800;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .doc-meta .num {
    font-size: 1rem;
    font-weight: 700;
    color: #1a1a1a;
    margin-top: 4px;
  }
  .doc-meta .date {
    font-size: 0.82rem;
    color: var(--gray);
    margin-top: 2px;
  }

  /* ── Bloc info 2 colonnes ── */
  .info-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-bottom: 36px;
  }
  .info-block {
    background: var(--light);
    border-radius: 8px;
    padding: 18px 20px;
  }
  .info-block h3 {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--primary);
    border-bottom: 1px solid var(--mid);
    padding-bottom: 6px;
    margin-bottom: 10px;
  }
  .info-block p {
    font-size: 0.88rem;
    color: #1a1a1a;
    margin-bottom: 3px;
  }
  .info-block p.muted { color: var(--gray); font-size: 0.82rem; }
  .info-block p.strong { font-weight: 700; }
  .info-block .delivery-date {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--primary);
    margin-top: 6px;
  }

  /* ── Tableau produits ── */
  .table-wrap { margin-bottom: 28px; }
  .table-title {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--primary);
    margin-bottom: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  thead tr {
    background: var(--primary);
    color: #fff;
  }
  thead th {
    padding: 10px 12px;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  tbody tr { border-bottom: 1px solid var(--border); }
  tbody tr:nth-child(even) { background: var(--light); }
  tbody td {
    padding: 10px 12px;
    font-size: 0.88rem;
  }
  .c { text-align: center; }
  .r { text-align: right; }
  .bold { font-weight: 700; }

  /* ── Totaux ── */
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 32px;
  }
  .totals-box {
    width: 300px;
    background: var(--light);
    border-radius: 8px;
    overflow: hidden;
  }
  .totals-box table { width: 100%; }
  .totals-box td {
    padding: 8px 14px;
    font-size: 0.88rem;
    border-bottom: 1px solid var(--border);
  }
  .totals-box .lbl { color: var(--gray); }
  .totals-box .val { text-align: right; font-weight: 600; }
  .totals-box tr.final { background: var(--primary); }
  .totals-box tr.final td {
    color: #fff;
    font-size: 1rem;
    font-weight: 800;
    padding: 12px 14px;
    border-bottom: none;
  }

  /* ── Notes ── */
  .notes-block {
    background: var(--light);
    border-left: 4px solid var(--primary);
    border-radius: 0 8px 8px 0;
    padding: 14px 18px;
    margin-bottom: 32px;
    font-size: 0.88rem;
  }
  .notes-block strong { color: var(--primary); }

  /* ── Pied de page ── */
  .page-footer {
    border-top: 1px solid var(--border);
    padding-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .page-footer p {
    font-size: 0.75rem;
    color: var(--gray);
    font-style: italic;
  }
  .page-footer .seal {
    font-size: 0.72rem;
    color: var(--mid);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* ── Impression ── */
  @media print {
    body { padding: 24px 32px; }
    @page { margin: 10mm; size: A4; }
  }
</style>
</head>
<body>

<!-- ══ EN-TÊTE ══ -->
<header class="page-header">
  <div class="brand">
    <div class="brand-name">Sof Pain</div>
    <div class="brand-tagline">L'artisan des professionnels</div>
  </div>
  <div class="doc-meta">
    <h1>Bon de commande</h1>
    <div class="num">N° ${esc(order.numero)}</div>
    <div class="date">Émis le ${dateCommande}</div>
  </div>
</header>

<!-- ══ INFOS CLIENT + LIVRAISON ══ -->
<div class="info-row">
  <div class="info-block">
    <h3>Client</h3>
    <p class="strong">${esc(client?.nom_societe ?? 'N/A')}</p>
    <p>${esc(nomClient)}</p>
    <p class="muted">${esc(client?.email ?? '')}</p>
    ${client?.telephone ? `<p class="muted">Tél : ${esc(client.telephone)}</p>` : ''}
  </div>
  <div class="info-block">
    <h3>Adresse de livraison</h3>
    <p>${adresseHtml || 'Non renseignée'}</p>
    <p class="muted" style="margin-top:10px;">Livraison souhaitée</p>
    <p class="delivery-date">${dateLivraison}</p>
  </div>
</div>

<!-- ══ TABLEAU PRODUITS ══ -->
<div class="table-wrap">
  <div class="table-title">Détail de la commande</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Produit</th>
        <th class="c">Palettes</th>
        <th class="c">Cartons<br>/palette</th>
        <th class="r">PU HT</th>
        <th class="c">TVA</th>
        <th class="r">ST HT</th>
        <th class="r">ST TTC</th>
      </tr>
    </thead>
    <tbody>
      ${lignes}
    </tbody>
  </table>
</div>

<!-- ══ TOTAUX ══ -->
<div class="totals-wrap">
  <div class="totals-box">
    <table>
      <tr>
        <td class="lbl">Total HT</td>
        <td class="val">${totalHt} €</td>
      </tr>
      <tr>
        <td class="lbl">TVA (5,5 %)</td>
        <td class="val">${totalTva} €</td>
      </tr>
      <tr class="final">
        <td>Total TTC</td>
        <td style="text-align:right">${totalTtc} €</td>
      </tr>
    </table>
  </div>
</div>

${order.notes_client
  ? `<div class="notes-block">
       <strong>Notes du client :</strong><br>
       ${esc(order.notes_client).replace(/\n/g, '<br>')}
     </div>`
  : ''}

<!-- ══ PIED DE PAGE ══ -->
<footer class="page-footer">
  <p>
    Document généré automatiquement le ${fmt(new Date())} —
    Sof Pain · L'artisan des professionnels
  </p>
  <div class="seal">Document non contractuel</div>
</footer>

</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const n2  = (v) => Number(v ?? 0).toFixed(2);
const n1  = (v) => Number(v ?? 0).toFixed(1);
const esc = (t) =>
  String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const fmt = (d) =>
  new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });