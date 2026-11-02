import * as Print from 'expo-print';
import { Platform } from 'react-native';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const n2 = (value) => Number(value ?? 0).toFixed(2);

function decodeBase64(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const input = value.replace(/[^A-Za-z0-9+/]/g, '');
  const output = new Uint8Array(Math.floor(input.length * 3 / 4));
  let outputIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (const character of input) {
    buffer = (buffer << 6) | alphabet.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[outputIndex++] = (buffer >> bits) & 0xff;
    }
  }

  return output.subarray(0, outputIndex);
}

function buildHtml(order, items, client, deliveredAt) {
  const clientName = client?.nom_societe
    || [client?.prenom, client?.nom].filter(Boolean).join(' ')
    || order.client_nom
    || 'Client';
  const deliveredLabel = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(deliveredAt);
  const rows = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.product_nom || 'Produit')}</td>
      <td class="quantity">${escapeHtml(item.quantite)}</td>
      <td class="price">${n2(item.prix_unitaire_ht)} €</td>
      <td class="price">${n2(item.sous_total_ht ?? Number(item.quantite) * Number(item.prix_unitaire_ht))} €</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bon de livraison n° ${escapeHtml(order.numero)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; color: #222; padding: 32px; }
    header { display: flex; justify-content: space-between; border-bottom: 3px solid #C4924A; padding-bottom: 18px; }
    h1 { margin: 0; color: #8A5A24; font-size: 24px; }
    .number { margin-top: 8px; font-size: 18px; font-weight: bold; }
    .delivered { margin-top: 8px; color: #444; }
    .client { margin: 24px 0; padding: 16px; background: #FFF6EC; border-left: 4px solid #C4924A; }
    .client-name { font-size: 18px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #F4F4F4; text-align: left; }
    th, td { padding: 10px; border-bottom: 1px solid #DDD; }
    .quantity { width: 100px; text-align: center; }
    .price { width: 120px; text-align: right; }
    .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
    .address { white-space: pre-line; color: #555; margin-top: 8px; }
    footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #DDD; color: #777; font-size: 12px; }
    @media print { body { padding: 12mm; } tr { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Bon de livraison</h1>
      <div class="number">Commande n° ${escapeHtml(order.numero)}</div>
      <div class="delivered">Livraison validée le ${escapeHtml(deliveredLabel)}</div>
    </div>
    <img src="https://zoemyisrqqfybgfnnlay.supabase.co/storage/v1/object/public/products/logo1.png" alt="Sof Pain" style="height:64px;object-fit:contain">
  </header>
  <section class="client">
    <div class="client-name">${escapeHtml(clientName)}</div>
    ${client?.telephone ? `<div>Tél. : ${escapeHtml(client.telephone)}</div>` : ''}
    ${order.adresse_livraison ? `<div class="address">${escapeHtml(order.adresse_livraison)}</div>` : ''}
  </section>
  <table>
    <thead><tr><th>Produit</th><th class="quantity">Quantité</th><th class="price">Prix unitaire HT</th><th class="price">Total HT</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total HT : ${n2(order.total_ht)} €</div>
  <footer>Document généré automatiquement par Sof Pain · ${escapeHtml(deliveredLabel)}</footer>
</body>
</html>`;
}

export async function generateDeliveryNotePdfBytes(order, items, client, deliveredAt = new Date()) {
  const html = buildHtml(order, items, client, deliveredAt);
  if (Platform.OS === 'web') {
    const module = await import('html2pdf.js');
    const html2pdf = module.default || module;
    const dataUri = await html2pdf()
      .from(html)
      .set({
        margin: 10,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .outputPdf('datauristring');
    const response = await fetch(dataUri);
    if (!response.ok) throw new Error('Impossible de lire le PDF généré.');
    return new Uint8Array(await response.arrayBuffer());
  }

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  if (!base64) throw new Error('Impossible de générer le PDF sur cet appareil.');
  return decodeBase64(base64);
}
