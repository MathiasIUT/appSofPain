import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export async function generateDriverTourPdf(livreur, orders) {
  const html = buildHtml(livreur, orders);

  if (Platform.OS === 'web') {
    const printWindow = window.open('', '_blank', 'width=960,height=760');
    if (!printWindow) {
      window.alert(
        "Votre navigateur a bloqué la fenêtre d'impression.\\n\\n" +
        "Autorisez les popups pour ce site dans les paramètres de votre navigateur, puis réessayez."
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
    const dName = [livreur.prenom, livreur.nom].filter(Boolean).join('_') || 'Livreur';
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Tournée ${dName}`,
      UTI: 'com.adobe.pdf',
    });
  }
  return uri;
}

const esc = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const fmt = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function buildHtml(livreur, orders) {
  const dateStr = fmt(new Date());
  const livreurName = [livreur.prenom, livreur.nom].filter(Boolean).join(' ') || 'Livreur inconnu';

  const commandesHtml = orders.map((o) => {
    const clientName = o.client?.nom_societe || [o.client?.prenom, o.client?.nom].filter(Boolean).join(' ') || 'Client inconnu';
    const telephone = o.client?.telephone || '';
    const adresse = esc(o.adresse_livraison || '').replace(/\\n/g, '<br>');
    const notesClient = o.notes_client ? `<b>Client:</b> ${esc(o.notes_client)}<br>` : '';
    const notesAdmin = o.notes_admin ? `<b>Admin:</b> ${esc(o.notes_admin)}` : '';

    const itemsStr = (o.order_items || []).map(it => {
      return `• <b>${esc(it.product_nom)}</b> : ${esc(String(it.quantite))} u.`;
    }).join('<br>');

    return `
      <tr>
        <td class="col-num">${esc(o.numero)}</td>
        <td class="col-client">
          <strong>${esc(clientName)}</strong><br>
          ${telephone ? `📞 ${esc(telephone)}` : ''}
        </td>
        <td class="col-adresse">${adresse || '<i>Non renseignée</i>'}</td>
        <td class="col-produits">${itemsStr}</td>
        <td class="col-notes">${notesClient}${notesAdmin}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Tournée de ${esc(livreurName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --primary: #C4924A; --text: #000; --border: #ccc; }
  
  /* Police plus petite pour tout compacter */
  html { font-size: 11px; } 
  body { 
    font-family: 'Helvetica Neue', Arial, sans-serif; 
    color: var(--text); 
    padding: 15px; 
    line-height: 1.3; 
  }
  
  /* En-tête très condensé */
  .page-header { 
    display: flex; 
    justify-content: space-between; 
    align-items: baseline; 
    border-bottom: 2px solid var(--primary); 
    padding-bottom: 5px; 
    margin-bottom: 10px; 
  }
  .header-left h1 { font-size: 16px; text-transform: uppercase; margin-bottom: 2px; }
  .header-right { text-align: right; font-weight: bold; font-size: 14px; color: var(--primary); }
  
  /* Tableau dense */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid var(--border); padding: 5px 6px; vertical-align: top; word-wrap: break-word; }
  th { background: #f4f4f4; text-transform: uppercase; font-size: 10px; color: #333; text-align: left; }
  
  /* Largeurs des colonnes adaptées au mode portrait */
  .col-num { width: 8%; font-weight: bold; text-align: center; }
  .col-client { width: 22%; }
  .col-adresse { width: 30%; }
  .col-produits { width: 25%; }
  .col-notes { width: 15%; font-size: 9.5px; color: #444; }
  
  /* Impressions PDF */
  @media print {
    @page { margin: 8mm; }
    body { padding: 0; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="page-header">
    <div class="header-left">
      <h1>Tournée : ${esc(livreurName)}</h1>
      <p style="color:#555;">Date d'impression : ${dateStr} &nbsp;|&nbsp; ${orders.length} commande(s)</p>
    </div>
    <div class="header-right">SOF PAIN</div>
  </div>
  
  ${orders.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th class="col-num">N°</th>
        <th class="col-client">Client / Tél.</th>
        <th class="col-adresse">Adresse</th>
        <th class="col-produits">Produits (Qté)</th>
        <th class="col-notes">Notes</th>
      </tr>
    </thead>
    <tbody>
      ${commandesHtml}
    </tbody>
  </table>
  ` : '<p>Aucune commande à livrer.</p>'}
</body>
</html>`;
}
