import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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

export async function generateMonthlyBonPdfBase64(client, date, orders) {
  const html = buildHtml(client, date, orders);

  if (Platform.OS === 'web') {
    try {
      const module = await import('html2pdf.js');
      const html2pdf = module.default || module;

      const opt = {
        margin: [5, 5, 5, 5],
        filename: 'bon_mensuel.pdf',
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 4, useCORS: true, logging: false, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const base64DataUri = await html2pdf().from(html).set(opt).outputPdf('datauristring');
      return base64DataUri;
    } catch (err) {
      console.error('Erreur génération PDF web:', err);
      throw new Error('Impossible de générer le PDF sur le Web.');
    }
  }

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  return base64;
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

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const n2 = (v) => Number(v ?? 0).toFixed(2);

const LOGO = 'https://zoemyisrqqfybgfnnlay.supabase.co/storage/v1/object/public/products/logo1.png';
const COLOR_PRIMARY = '#C4924A';
const COLOR_PRIMARY_LIGHT = '#FFF6EC';

function buildHtml(client, date, orders) {
  const clientName = client.nom_societe
    || [client.prenom, client.nom].filter(Boolean).join(' ')
    || 'Client inconnu';

  const monthLabel = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const printDate = fmtDate(new Date());
  const totalMois = orders.reduce((acc, o) => acc + Number(o.total_ht || 0), 0);

  // Génération des blocs de commande en pur tableau HTML
  let ordersRows = '';
  orders.forEach((o) => {
    const items = o.order_items || [];
    const sousTotalHt = Number(o.total_ht || 0);

    // En-tête de commande
    ordersRows += `
      <tr>
        <td colspan="4" style="padding:0;padding-top:14px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DDD;border-radius:6px;overflow:hidden;border-collapse:separate;">
            <!-- Titre commande -->
            <tr>
              <td colspan="4" style="background:#F0F0F0;padding:8px 12px;border-bottom:1px solid #DDD;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:11px;font-weight:bold;color:#1A1A1A;">Commande N° ${esc(o.numero)}</td>
                    <td align="right" style="font-size:10px;color:#666;font-weight:bold;">${fmtDate(o.date_commande)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- En-tête colonnes -->
            <tr style="background:#F7F7F7;">
              <td style="padding:6px 12px;font-size:9px;font-weight:bold;color:#666;text-transform:uppercase;border-bottom:1px solid #EEE;width:44%;">Produit</td>
              <td style="padding:6px 12px;font-size:9px;font-weight:bold;color:#666;text-transform:uppercase;border-bottom:1px solid #EEE;text-align:center;width:12%;">Qté</td>
              <td style="padding:6px 12px;font-size:9px;font-weight:bold;color:#666;text-transform:uppercase;border-bottom:1px solid #EEE;text-align:right;width:22%;">PU HT</td>
              <td style="padding:6px 12px;font-size:9px;font-weight:bold;color:#666;text-transform:uppercase;border-bottom:1px solid #EEE;text-align:right;width:22%;">Total HT</td>
            </tr>
    `;

    if (items.length === 0) {
      ordersRows += `
            <tr>
              <td colspan="4" style="padding:10px 12px;font-size:10px;color:#999;font-style:italic;text-align:center;">Aucun article</td>
            </tr>
      `;
    } else {
      items.forEach((it, idx) => {
        const prodNom = esc(it.product_nom || it.products?.nom || `Produit #${it.product_id}`);
        const qty = it.quantite;
        const pu = Number(it.prix_unitaire_ht || 0);
        const ligneTotal = n2(pu * qty);
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA';

        ordersRows += `
            <tr style="background-color:${rowBg};">
              <td style="padding:7px 12px;font-size:10px;color:#1A1A1A;border-bottom:1px solid #F5F5F5;">${prodNom}</td>
              <td style="padding:7px 12px;font-size:10px;color:#1A1A1A;text-align:center;border-bottom:1px solid #F5F5F5;font-weight:bold;">${qty}</td>
              <td style="padding:7px 12px;font-size:10px;color:#666;text-align:right;border-bottom:1px solid #F5F5F5;">${n2(pu)} €</td>
              <td style="padding:7px 12px;font-size:10px;color:#1A1A1A;text-align:right;border-bottom:1px solid #F5F5F5;font-weight:bold;">${ligneTotal} €</td>
            </tr>
        `;
      });
    }

    // Sous-total commande
    ordersRows += `
            <tr style="background:#FFF8F0;">
              <td colspan="3" style="padding:7px 12px;font-size:9px;font-weight:bold;color:#888;text-align:right;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid #E8D5BB;">Sous-total</td>
              <td style="padding:7px 12px;font-size:10px;font-weight:bold;color:${COLOR_PRIMARY};text-align:right;border-top:1px solid #E8D5BB;">${n2(sousTotalHt)} €</td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Bon mensuel — ${esc(clientName)} — ${esc(monthLabelCap)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #FFFFFF; color: #1A1A1A; }
</style>
</head>
<body style="margin:0;padding:0;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;padding:14px 20px;max-width:800px;margin:0 auto;">

  <!-- En-tête : Logo + Titre -->
  <tr>
    <td style="padding-bottom:16px;border-bottom:3px solid ${COLOR_PRIMARY};">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%">
            <img src="${LOGO}" alt="Sof Pain" style="height:64px;object-fit:contain;" />
            <div style="font-size:8px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Livraison de produits frais</div>
          </td>
          <td width="50%" align="right">
            <div style="font-size:18px;font-weight:900;text-transform:uppercase;color:#1A1A1A;letter-spacing:1px;">Bon Mensuel</div>
            <div style="font-size:13px;font-weight:700;color:${COLOR_PRIMARY};margin-top:3px;">${esc(monthLabelCap)}</div>
            <div style="font-size:8px;color:#999;margin-top:3px;">Imprimé le ${esc(printDate)}</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Bloc client -->
  <tr>
    <td style="padding-top:14px;padding-bottom:14px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR_PRIMARY_LIGHT};border-left:4px solid ${COLOR_PRIMARY};border-radius:4px;padding:10px 14px;">
        <tr>
          <td>
            <div style="font-size:8px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:1px;">Client</div>
            <div style="font-size:14px;font-weight:800;color:#1A1A1A;margin-top:2px;">${esc(clientName)}</div>
            ${client.adresse ? `<div style="font-size:9px;color:#666;margin-top:2px;">${esc(client.adresse)}${client.ville ? `, ${esc(client.ville)}` : ''}</div>` : ''}
          </td>
          <td align="right">
            ${client.telephone ? `<div style="font-size:9px;color:#666;">Tél : ${esc(client.telephone)}</div>` : ''}
            ${client.siret ? `<div style="font-size:9px;color:#666;margin-top:2px;">SIRET : ${esc(client.siret)}</div>` : ''}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Résumé -->
  <tr>
    <td style="padding-bottom:10px;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#F5F5F5;border:1px solid #DDD;border-radius:20px;padding:3px 12px;font-size:9px;color:#666;">
            <strong style="color:#1A1A1A;">${orders.length}</strong> commande${orders.length > 1 ? 's' : ''}
          </td>
          <td width="8"></td>
          <td style="background:#F5F5F5;border:1px solid #DDD;border-radius:20px;padding:3px 12px;font-size:9px;color:#666;">
            Période : <strong style="color:#1A1A1A;">${esc(monthLabelCap)}</strong>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Commandes -->
  ${orders.length > 0 ? ordersRows : `
  <tr>
    <td style="padding:20px;text-align:center;color:#999;font-style:italic;">Aucune commande ce mois-ci.</td>
  </tr>
  `}

  <!-- Total global -->
  <tr>
    <td style="padding-top:18px;border-top:2px solid ${COLOR_PRIMARY};margin-top:14px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="right">
            <span style="font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;margin-right:12px;">Total du mois</span>
            <span style="font-size:22px;font-weight:900;color:${COLOR_PRIMARY};">${n2(totalMois)} €</span>
            <span style="font-size:9px;color:#666;margin-left:4px;">HT</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Pied de page -->
  <tr>
    <td style="padding-top:16px;border-top:1px solid #DDD;margin-top:14px;font-size:8px;color:#999;text-align:center;">
      Document généré automatiquement par SofPain · ${esc(monthLabelCap)} · ${esc(clientName)}
    </td>
  </tr>

</table>

</body>
</html>`;
}
