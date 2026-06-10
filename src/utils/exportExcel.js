import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

const n2 = (v) => parseFloat(Number(v ?? 0).toFixed(2));
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

function setColWidths(ws, widths) {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

function downloadWb(wb, filename) {
  if (Platform.OS !== 'web') return;
  XLSX.writeFile(wb, filename);
}
export function exportComptaExcel(rows, products, monthLabel, livreurs = []) {
  const livreurMap = Object.fromEntries(
    livreurs.map((l) => [l.id, [l.prenom, l.nom].filter(Boolean).join(' ')])
  );

  const headers = ['Client', 'Ville', 'Livreur'];
  const colWidths = [28, 18, 20];
  products.forEach((p) => {
    headers.push(`${p.nom} (Qté)`);
    headers.push(`${p.nom} (PU €)`);
    colWidths.push(Math.max(p.nom.length + 6, 12));
    colWidths.push(Math.max(p.nom.length + 6, 12));
  });
  headers.push('Total HT (€)');
  colWidths.push(14);

  const dataRows = rows.map((row) => {
    const clientName =
      row.client.nom_societe ||
      [row.client.prenom, row.client.nom].filter(Boolean).join(' ') ||
      'Client';
    const cells = [
      clientName,
      row.client.ville || '',
      livreurMap[row.client.livreur_id] || '',
    ];
    products.forEach((p) => {
      const agg = row.productAgg[p.id];
      if (agg) {
        cells.push(agg.qty);
        cells.push(n2(agg.price));
      } else {
        cells.push('', '');
      }
    });
    cells.push(n2(row.totalHt));
    return cells;
  });

  const totalRow = ['TOTAL GLOBAL', '', ''];
  products.forEach((p) => {
    let totalQty = 0;
    rows.forEach((r) => { if (r.productAgg[p.id]) totalQty += r.productAgg[p.id].qty; });
    totalRow.push(totalQty > 0 ? totalQty : '');
    totalRow.push('');
  });
  totalRow.push(n2(rows.reduce((s, r) => s + Number(r.totalHt || 0), 0)));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalRow]);
  setColWidths(ws, colWidths);
  XLSX.utils.book_append_sheet(wb, ws, `Compta ${monthLabel}`);
  downloadWb(wb, `comptabilite_${monthLabel.replace(/\s+/g, '_').toLowerCase()}.xlsx`);
}
export async function exportClientsExcel() {
  const [cliRes, livRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nom, prenom, nom_societe, email, telephone, ville, livreur_id, livreur_surgele_id, actif, created_at')
      .eq('role', 'client')
      .order('nom_societe', { ascending: true }),
    supabase.from('livreurs').select('id, nom, prenom'),
  ]);

  if (cliRes.error) throw cliRes.error;

  const livreurMap = Object.fromEntries(
    (livRes.data || []).map((l) => [l.id, [l.prenom, l.nom].filter(Boolean).join(' ')])
  );

  const headers = ['Société', 'Nom', 'Prénom', 'Email', 'Téléphone', 'Ville', 'Livreur Frais', 'Livreur Surgelé', 'Actif', 'Créé le'];
  const widths = [28, 18, 18, 30, 16, 18, 20, 20, 8, 12];

  const dataRows = (cliRes.data || []).map((c) => [
    c.nom_societe || '',
    c.nom || '',
    c.prenom || '',
    c.email || '',
    c.telephone || '',
    c.ville || '',
    livreurMap[c.livreur_id] || '',
    livreurMap[c.livreur_surgele_id] || '',
    c.actif === false ? 'Non' : 'Oui',
    fmt(c.created_at),
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  setColWidths(ws, widths);
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  downloadWb(wb, `clients_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
export async function exportOrdersExcel(ids = null) {
  let ordersQ = supabase
    .from('orders')
    .select(`
      id, numero, client_nom, date_commande, total_ht, livreur_id,
      client:profiles!client_id(nom, prenom, nom_societe, email, telephone, role)
    `)
    .order('date_commande', { ascending: false });
  if (ids && ids.length > 0) {
    ordersQ = ordersQ.in('id', ids);
  }

  let itemsQ = supabase.from('order_items').select('order_id, product_id, quantite, prix_unitaire_ht');
  if (ids && ids.length > 0) {
    itemsQ = itemsQ.in('order_id', ids);
  }

  const [ordRes, itemsRes, prodRes, livRes] = await Promise.all([
    ordersQ,
    itemsQ,
    supabase.from('products').select('id, nom').eq('actif', true).order('nom'),
    supabase.from('livreurs').select('id, nom, prenom'),
  ]);

  if (ordRes.error) throw ordRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const livreurMap = Object.fromEntries(
    (livRes.data || []).map((l) => [l.id, [l.prenom, l.nom].filter(Boolean).join(' ')])
  );

  const products = prodRes.data || [];
  const itemsByOrder = {};
  for (const it of (itemsRes.data || [])) {
    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = {};
    itemsByOrder[it.order_id][it.product_id] = it;
  }

  const headers = ['N°', 'Type', 'Date', 'Société', 'Contact', 'Email', 'Téléphone'];
  const widths = [8, 12, 12, 28, 22, 30, 16];
  products.forEach((p) => {
    headers.push(`${p.nom} (Qté)`);
    headers.push(`${p.nom} (PU €)`);
    widths.push(Math.max(p.nom.length + 6, 14));
    widths.push(Math.max(p.nom.length + 6, 14));
  });
  headers.push('Total HT (€)', 'Livreur Assigné');
  widths.push(14, 20);

  const orders = (ordRes.data || []).filter((o) => !o.client || o.client.role === 'client');

  const dataRows = orders.map((o) => {
    const contact = [o.client?.prenom, o.client?.nom].filter(Boolean).join(' ') || o.client_nom || '';
    const cells = [
      o.numero || '',
      o.type_commande === 'surgele' ? 'Surgelé' : 'Frais',
      fmt(o.date_commande),
      o.client?.nom_societe || '',
      contact,
      o.client?.email || '',
      o.client?.telephone || '',
    ];
    const oItems = itemsByOrder[o.id] || {};
    products.forEach((p) => {
      const it = oItems[p.id];
      if (it) {
        cells.push(it.quantite);
        cells.push(n2(it.prix_unitaire_ht));
      } else {
        cells.push('', '');
      }
    });
    cells.push(n2(o.total_ht), livreurMap[o.livreur_id] || '');
    return cells;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  setColWidths(ws, widths);
  XLSX.utils.book_append_sheet(wb, ws, 'Commandes');
  downloadWb(wb, `commandes_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
export async function exportSage50CSV(monthLabel) {
  if (Platform.OS !== 'web') return;

  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, numero, date_commande, total_ht, type_commande,
      client_nom,
      client:profiles!client_id(nom_societe, nom, prenom, code_sage)
    `)
    .gte('date_commande', startOfMonth.toISOString())
    .lte('date_commande', endOfMonth.toISOString())
    .neq('statut', 'annulee')
    .order('date_commande', { ascending: true });

  if (error) throw error;

  const lines = [
    'Date;N° Commande;Compte Client;Nom Client;Type;Montant HT'
  ];

  for (const o of (orders || [])) {
    const date = fmt(o.date_commande);
    const num = o.numero || o.id.slice(0, 8);
    const codeSage = o.client?.code_sage || '';
    const compte = codeSage ? `411${codeSage}` : '';
    const nomClient = o.client?.nom_societe
      || [o.client?.prenom, o.client?.nom].filter(Boolean).join(' ')
      || o.client_nom
      || '';
    const type = o.type_commande === 'surgele' ? 'Surgelé' : 'Frais';
    const ht = n2(o.total_ht);
    lines.push(`${date};${num};${compte};${nomClient};${type};${ht}`);
  }

  const bom = '﻿';
  const csv = bom + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sage50_${monthLabel.replace(/\s+/g, '_').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMonthlyBonExcel(client, monthLabel, orders, products) {
  const clientName = client.nom_societe || [client.prenom, client.nom].filter(Boolean).join(' ') || 'Client';
  
  const headers = ['Date', 'N° Commande'];
  const widths = [12, 10];
  
  products.forEach(p => {
    headers.push(`${p.nom} (Qté)`);
    headers.push(`${p.nom} (PU €)`);
    widths.push(Math.max(p.nom.length + 6, 12));
    widths.push(Math.max(p.nom.length + 6, 12));
  });
  
  headers.push('Total HT (€)');
  widths.push(14);

  const dataRows = orders.map(o => {
    const cells = [
      fmt(o.date_commande),
      o.numero || ''
    ];
    
    const itemsMap = {};
    (o.order_items || []).forEach(it => {
      itemsMap[it.product_id] = it;
    });

    products.forEach(p => {
      const it = itemsMap[p.id];
      if (it) {
        cells.push(it.quantite);
        cells.push(n2(it.prix_unitaire_ht));
      } else {
        cells.push('', '');
      }
    });

    cells.push(n2(o.total_ht));
    return cells;
  });

  const totalRow = ['TOTAL DU MOIS', ''];
  products.forEach(p => {
    let totalQty = 0;
    orders.forEach(o => {
      const items = o.order_items || [];
      const it = items.find(i => i.product_id === p.id);
      if (it) totalQty += it.quantite;
    });
    totalRow.push(totalQty > 0 ? totalQty : '', '');
  });
  totalRow.push(n2(orders.reduce((acc, o) => acc + Number(o.total_ht || 0), 0)));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    [`Bon Mensuel - ${clientName}`],
    [`Période : ${monthLabel}`],
    [],
    headers,
    ...dataRows,
    [],
    totalRow
  ]);
  
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }
  ];

  setColWidths(ws, widths);
  XLSX.utils.book_append_sheet(wb, ws, 'Bon Mensuel');
  downloadWb(wb, `bon_mensuel_${clientName.replace(/\s+/g, '_').toLowerCase()}_${monthLabel.replace(/\s+/g, '_').toLowerCase()}.xlsx`);
}

