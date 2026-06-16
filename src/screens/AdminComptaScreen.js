import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Platform,
  Alert,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import { generateMonthlyBonPdf, generateMonthlyBonPdfBase64 } from '../utils/generateMonthlyBonPdf';
import { exportComptaExcel, exportMonthlyBonExcel, exportSage50CSV } from '../utils/exportExcel';
import ConfirmModal from '../components/ConfirmModal';

const n2 = (v) => Number(v ?? 0).toFixed(2);

export default function AdminComptaScreen({ fixedComptaType = 'frais' }) {
  const { width } = useWindowDimensions();
  const isMobile = width < 700;
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [livreurs, setLivreurs] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientPrices, setClientPrices] = useState([]);
  const [orders, setOrders] = useState([]);

  const [selectedLivreurId, setSelectedLivreurId] = useState('all');
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingSage, setExportingSage] = useState(false);
  const [search, setSearch] = useState('');

  const [bonClient, setBonClient] = useState(null);
  const [bonVisible, setBonVisible] = useState(false);

  const openBon = (client) => { setBonClient(client); setBonVisible(true); };
  const closeBon = () => { setBonVisible(false); setBonClient(null); };

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const [livRes, prodRes, cliRes, pricesRes, ordRes] = await Promise.all([
        supabase.from('livreurs').select('*').eq('actif', true),
        supabase.from('products').select('*, category:categories(slug)').eq('actif', true).order('nom'),
        supabase.from('profiles').select('*').eq('role', 'client'),
        supabase.from('client_prices').select('*'),
        supabase
          .from('orders')
          .select('id, client_id, client_nom, client_uuid_snapshot, total_ht, type_commande, order_items(product_id, quantite, prix_unitaire_ht)')
          .gte('date_commande', startOfMonth.toISOString())
          .lte('date_commande', endOfMonth.toISOString())
          .neq('statut', 'annulee')
      ]);

      if (livRes.error) throw livRes.error;
      if (prodRes.error) throw prodRes.error;
      if (cliRes.error) throw cliRes.error;
      if (pricesRes.error) throw pricesRes.error;
      if (ordRes.error) throw ordRes.error;

      setLivreurs(livRes.data || []);
      setProducts(prodRes.data || []);
      setClients(cliRes.data || []);
      setClientPrices(pricesRes.data || []);
      setOrders(ordRes.data || []);

    } catch (err) {
      console.error('Erreur chargement compta:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const monthLabel = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      const displayProducts = products.filter(p => (p.category?.slug || 'frais') === fixedComptaType);
      exportComptaExcel(tableData.rows, displayProducts, monthLabelCap, livreurs);
    } catch (err) {
      console.error('Erreur export Excel compta :', err);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportSage = async () => {
    setExportingSage(true);
    try {
      await exportSage50CSV(monthLabelCap);
    } catch (err) {
      console.error('Erreur export Sage 50 :', err);
    } finally {
      setExportingSage(false);
    }
  };

  const tableData = useMemo(() => {
    const displayProducts = products.filter(p => (p.category?.slug || 'frais') === fixedComptaType);
    const validProductIds = new Set(displayProducts.map(p => p.id));
    const filteredOrders = orders.filter(o => (o.type_commande || 'frais') === fixedComptaType);
    let filteredClients = clients;
    const targetLivreurField = fixedComptaType === 'surgele' ? 'livreur_surgele_id' : 'livreur_id';
    
    if (selectedLivreurId === 'unassigned') {
      filteredClients = clients.filter(c => !c[targetLivreurField]);
    } else if (selectedLivreurId !== 'all') {
      filteredClients = clients.filter(c => c[targetLivreurField] === selectedLivreurId);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filteredClients = filteredClients.filter(c => {
        const name = [c.nom_societe, c.prenom, c.nom].filter(Boolean).join(' ').toLowerCase();
        return name.includes(q);
      });
    }

    const result = [];
    let globalTotalHt = 0;

    for (const client of filteredClients) {
      const clientOrders = filteredOrders.filter(o => o.client_id === client.id);

      const productAgg = {};
      let totalHt = 0;

      for (const order of clientOrders) {
        totalHt += Number(order.total_ht || 0);
        for (const item of (order.order_items || [])) {
          if (!validProductIds.has(item.product_id)) continue;
          if (!productAgg[item.product_id]) {
            productAgg[item.product_id] = { qty: 0, price: item.prix_unitaire_ht };
          }
          productAgg[item.product_id].qty += item.quantite;
          productAgg[item.product_id].price = item.prix_unitaire_ht;
        }
      }

      globalTotalHt += totalHt;

      result.push({
        client,
        productAgg,
        totalHt
      });
    }

    if (selectedLivreurId === 'all') {
      const orphanOrders = filteredOrders.filter(o => !o.client_id && o.client_nom);
      const orphanByKey = {};
      for (const order of orphanOrders) {
        if (search.trim() && !order.client_nom?.toLowerCase().includes(search.toLowerCase())) {
          continue;
        }
        const key = order.client_uuid_snapshot || `name-${order.client_nom}`;
        if (!orphanByKey[key]) {
          orphanByKey[key] = {
            productAgg: {},
            totalHt: 0,
            name: order.client_nom,
            uuid_snapshot: order.client_uuid_snapshot || null,
          };
        }
        orphanByKey[key].totalHt += Number(order.total_ht || 0);
        for (const item of (order.order_items || [])) {
          if (!validProductIds.has(item.product_id)) continue;
          if (!orphanByKey[key].productAgg[item.product_id]) {
            orphanByKey[key].productAgg[item.product_id] = { qty: 0, price: item.prix_unitaire_ht };
          }
          orphanByKey[key].productAgg[item.product_id].qty += item.quantite;
          orphanByKey[key].productAgg[item.product_id].price = item.prix_unitaire_ht;
        }
      }
      for (const [key, data] of Object.entries(orphanByKey)) {
        globalTotalHt += data.totalHt;
        result.push({
          client: {
            id: `deleted-${key}`,
            nom_societe: `${data.name} (supprimé)`,
            ville: '',
            _orphan_name: data.name,
            _orphan_uuid: data.uuid_snapshot,
          },
          productAgg: data.productAgg,
          totalHt: data.totalHt,
        });
      }
    }

    result.sort((a, b) => {
      const nameA = a.client.nom_societe || a.client.nom || '';
      const nameB = b.client.nom_societe || b.client.nom || '';
      return nameA.localeCompare(nameB);
    });

    return { rows: result, globalTotalHt, displayProducts };
  }, [clients, orders, selectedLivreurId, search, fixedComptaType, products]);

  const getDisplayPrice = (productId, clientId, aggregatedPrice) => {
    if (aggregatedPrice !== undefined) return aggregatedPrice;

    const custom = clientPrices.find(cp => cp.client_id === clientId && cp.product_id === productId);
    if (custom) return custom.prix_unitaire_ht;

    const base = products.find(p => p.id === productId);
    return base ? base.prix_unitaire_ht : 0;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View>
          <Text style={styles.title}>Comptabilité {fixedComptaType === 'surgele' ? 'Surgelé' : 'Frais'}</Text>
          {!isMobile && <Text style={styles.subtitle}>Bilan par livreur et par mois</Text>}
        </View>

        <View style={[styles.headerRow2, isMobile && styles.headerRow2Mobile]}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              style={[styles.excelBtn, (exportingExcel || loading) && { opacity: 0.5 }]}
              onPress={handleExportExcel}
              disabled={exportingExcel || loading}
              activeOpacity={0.8}
            >
              <Text style={styles.excelBtnText}>{exportingExcel ? '...' : 'Excel'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sageBtn, (exportingSage || loading) && { opacity: 0.5 }]}
              onPress={handleExportSage}
              disabled={exportingSage || loading}
              activeOpacity={0.8}
            >
              <Text style={styles.excelBtnText}>{exportingSage ? '...' : 'Sage 50'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.datePicker}>
            <TouchableOpacity style={styles.dateBtn} onPress={handlePrevMonth}>
              <Text style={styles.dateBtnText}>◀</Text>
            </TouchableOpacity>
            <View style={styles.dateLabelWrap}>
              <Text style={styles.dateLabel}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
            </View>
            <TouchableOpacity style={styles.dateBtn} onPress={handleNextMonth}>
              <Text style={styles.dateBtnText}>▶</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un client dans ce bilan..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
      </View>



      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          <TouchableOpacity
            style={[styles.tab, selectedLivreurId === 'all' && styles.tabActive]}
            onPress={() => setSelectedLivreurId('all')}
          >
            <Text style={[styles.tabText, selectedLivreurId === 'all' && styles.tabTextActive]}>
              Tous les clients
            </Text>
          </TouchableOpacity>

          {livreurs
            .filter(l => l.type_livreur === 'les_deux' || l.type_livreur === fixedComptaType)
            .map(l => (
            <TouchableOpacity
              key={l.id}
              style={[styles.tab, selectedLivreurId === l.id && styles.tabActive]}
              onPress={() => setSelectedLivreurId(l.id)}
            >
              <Text style={[styles.tabText, selectedLivreurId === l.id && styles.tabTextActive]}>
                {[l.prenom, l.nom].filter(Boolean).join(' ')}
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[styles.tab, selectedLivreurId === 'unassigned' && styles.tabActive]}
            onPress={() => setSelectedLivreurId('unassigned')}
          >
            <Text style={[styles.tabText, selectedLivreurId === 'unassigned' && styles.tabTextActive]}>
              Sans livreur
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.tableWrapper}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Calcul des données...</Text>
          </View>
        ) : tableData.rows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Aucun client trouvé pour ce livreur.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            style={styles.horizontalScroll}
            contentContainerStyle={{ flexGrow: 1 }}
            showsHorizontalScrollIndicator={true}
          >
            <ScrollView
              style={styles.verticalScroll}
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={true}
            >
              <View style={[styles.table, { flex: 1 }]}>

                {/* Ligne d'en-tête */}
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.th, styles.colClient]}>
                    <Text style={styles.thText}>Client</Text>
                  </View>
                  {tableData.displayProducts.map(p => (
                    <View key={p.id} style={[styles.th, styles.colProduct]}>
                      <Text style={styles.thText} numberOfLines={2}>{p.nom}</Text>
                    </View>
                  ))}
                  <View style={[styles.th, styles.colTotal]}>
                    <Text style={styles.thText}>TOTAL HT</Text>
                  </View>
                </View>

                {/* Lignes clients */}
                {tableData.rows.map((row, idx) => {
                  const clientName = row.client.nom_societe || [row.client.prenom, row.client.nom].filter(Boolean).join(' ') || 'Client sans nom';

                  return (
                    <View key={row.client.id} style={[styles.tableRow, idx % 2 === 1 && styles.rowAlt]}>
                      <View style={[styles.td, styles.colClient]}>
                        <Text style={styles.tdClientText} numberOfLines={2}>{clientName}</Text>
                        <Text style={styles.tdClientSub} numberOfLines={1}>{row.client.ville || ''}</Text>
                        {!row.client[fixedComptaType === 'surgele' ? 'livreur_surgele_id' : 'livreur_id'] && !String(row.client.id).startsWith('deleted-') && (
                          <View style={{ backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' }}>
                            <Text style={{ color: '#D32F2F', fontSize: 10, fontWeight: '700' }}>SANS LIVREUR</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => openBon(row.client)}
                          style={styles.bonBtn}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.bonBtnText}>Voir le détail →</Text>
                        </TouchableOpacity>
                      </View>

                      {tableData.displayProducts.map(p => {
                        const agg = row.productAgg[p.id];
                        const qty = agg ? agg.qty : 0;
                        const price = getDisplayPrice(p.id, row.client.id, agg ? agg.price : undefined);

                        return (
                          <View key={p.id} style={[styles.td, styles.colProduct]}>
                            {qty > 0 ? (
                              <>
                                <Text style={styles.tdQtyText}>{qty}</Text>
                                <Text style={styles.tdPriceText}>{`(${n2(price)} €)`}</Text>
                              </>
                            ) : (
                              <Text style={styles.tdEmptyText}>—</Text>
                            )}
                          </View>
                        );
                      })}

                      <View style={[styles.td, styles.colTotal]}>
                        <Text style={styles.tdTotalText}>{`${n2(row.totalHt)} €`}</Text>
                      </View>
                    </View>
                  );
                })}

                {/* Ligne Total Général */}
                <View style={[styles.tableRow, styles.rowFooter]}>
                  <View style={[styles.td, styles.colClient]}>
                    <Text style={styles.tdFooterText}>TOTAL GLOBAL</Text>
                  </View>
                  {tableData.displayProducts.map(p => {
                    let totalQty = 0;
                    tableData.rows.forEach(r => {
                      if (r.productAgg[p.id]) totalQty += r.productAgg[p.id].qty;
                    });

                    return (
                      <View key={p.id} style={[styles.td, styles.colProduct]}>
                        <Text style={[styles.tdQtyText, { color: colors.primary, fontWeight: '700' }]}>
                          {totalQty > 0 ? totalQty : '—'}
                        </Text>
                      </View>
                    );
                  })}
                  <View style={[styles.td, styles.colTotal]}>
                    <Text style={[styles.tdTotalText, { fontSize: 16 }]}>{`${n2(tableData.globalTotalHt)} €`}</Text>
                  </View>
                </View>

              </View>
            </ScrollView>
          </ScrollView>
        )}
      </View>

      <Modal
        visible={bonVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeBon}
      >
        <View style={styles.bonOverlay}>
          <View style={styles.bonBox}>
            {bonClient && (
              <BonMensuelModal
                client={bonClient}
                currentDate={currentDate}
                products={tableData.displayProducts}
                comptaType={fixedComptaType}
                onClose={closeBon}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BonMensuelModal({ client, currentDate, products, comptaType, onClose }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const isOrphan = String(client.id).startsWith('deleted-');

  const clientName = isOrphan
    ? (client._orphan_name || 'Client supprimé')
    : (client.nom_societe || [client.prenom, client.nom].filter(Boolean).join(' ') || 'Client');

  const monthLabel = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  const totalMois = orders.reduce((acc, o) => acc + Number(o.total_ht || 0), 0);
  const n2 = (v) => Number(v ?? 0).toFixed(2);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

        let query = supabase
          .from('orders')
          .select('id, numero, date_commande, total_ht, order_items(product_id, quantite, prix_unitaire_ht, products(nom))')
          .gte('date_commande', startOfMonth.toISOString())
          .lte('date_commande', endOfMonth.toISOString())
          .neq('statut', 'annulee')
          .eq('type_commande', comptaType)
          .order('date_commande', { ascending: true });

        if (isOrphan) {
          if (client._orphan_uuid) {
            query = query.is('client_id', null).eq('client_uuid_snapshot', client._orphan_uuid);
          } else {
            query = query.is('client_id', null).eq('client_nom', client._orphan_name);
          }
        } else {
          query = query.eq('client_id', client.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error('Erreur chargement bon mensuel:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [client.id, currentDate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const enriched = orders.map(o => ({
        ...o,
        order_items: (o.order_items || []).map(it => ({
          ...it,
          product_nom: it.products?.nom || `Produit #${it.product_id}`,
        })),
      }));
      await generateMonthlyBonPdf(client, currentDate, enriched);
    } catch (err) {
      console.error('Erreur export PDF:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      exportMonthlyBonExcel(client, monthLabelCap, orders, products);
    } catch (err) {
      console.error('Erreur export Excel:', err);
    } finally {
      setExportingExcel(false);
    }
  };

  const handleSendEmail = async () => {
    setConfirmVisible(false);
    setSendingEmail(true);
    try {
      const enriched = orders.map(o => ({
        ...o,
        order_items: (o.order_items || []).map(it => ({
          ...it,
          product_nom: it.products?.nom || `Produit #${it.product_id}`,
        })),
      }));

      const pdfBase64 = await generateMonthlyBonPdfBase64(client, currentDate, enriched);

      const { data, error } = await supabase.functions.invoke('send-monthly-bill', {
        body: {
          email: client.email,
          clientName: clientName,
          monthLabel: monthLabelCap,
          pdfBase64: pdfBase64,
          orders: enriched,
          totalMois: totalMois,
        }
      });

      if (error) throw error;
      
      const successMsg = `Le bilan mensuel a été envoyé avec succès à ${client.email}`;
      if (Platform.OS === 'web') window.alert(successMsg);
      else Alert.alert('Succès', successMsg);
    } catch (err) {
      console.error('Erreur envoi email:', err);
      const errMsg = err.message || 'Impossible d\'envoyer l\'email.';
      if (Platform.OS === 'web') window.alert(errMsg);
      else Alert.alert('Erreur', errMsg);
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <View style={bon.container}>
      <View style={bon.header}>
        <View style={{ flex: 1 }}>
          <Text style={bon.headerTitle}>Bon mensuel</Text>
          <Text style={bon.headerSub}>{clientName} · {monthLabelCap}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={bon.closeBtn} activeOpacity={0.7}>
          <Text style={bon.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={bon.actionsBar}>
        <TouchableOpacity
          style={[bon.exportBtn, exporting && { opacity: 0.6 }]}
          onPress={handleExport}
          disabled={exporting || loading}
          activeOpacity={0.8}
        >
          {exporting
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={bon.exportBtnText}>PDF</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[bon.exportBtn, { backgroundColor: '#217346' }, exportingExcel && { opacity: 0.6 }]}
          onPress={handleExportExcel}
          disabled={exportingExcel || loading}
          activeOpacity={0.8}
        >
          {exportingExcel
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={bon.exportBtnText}>Excel</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={[bon.exportBtn, { backgroundColor: colors.primary }, (sendingEmail || loading) && { opacity: 0.6 }]}
          onPress={() => {
            if (!client.email) {
              if (Platform.OS === 'web') window.alert('Ce client n\'a pas d\'adresse email enregistrée.');
              else Alert.alert('Erreur', 'Ce client n\'a pas d\'adresse email enregistrée.');
              return;
            }
            setConfirmVisible(true);
          }}
          disabled={sendingEmail || loading}
          activeOpacity={0.8}
        >
          {sendingEmail
            ? <ActivityIndicator size="small" color={colors.white} />
            : <Text style={bon.exportBtnText}>Envoyer</Text>
          }
        </TouchableOpacity>
        <View style={bon.totalPill}>
          <Text style={bon.totalPillLabel}>Total du mois</Text>
          <Text style={bon.totalPillValue}>{n2(totalMois)} € HT</Text>
        </View>
      </View>

      {loading ? (
        <View style={bon.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={bon.loadingText}>Chargement...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={bon.centered}>
          <Text style={bon.emptyText}>Aucune commande ce mois-ci.</Text>
        </View>
      ) : (
        <ScrollView style={bon.body} contentContainerStyle={bon.bodyContent} showsVerticalScrollIndicator={false}>
          {orders.map((o) => {
            const items = o.order_items || [];
            const sousTotal = Number(o.total_ht || 0);
            return (
              <View key={o.id} style={bon.orderCard}>
                <View style={bon.orderCardHeader}>
                  <Text style={bon.orderNum}>Commande N° {o.numero}</Text>
                  <Text style={bon.orderDate}>{fmtDate(o.date_commande)}</Text>
                </View>
                <View style={bon.itemsTable}>
                  <View style={bon.itemsTableHeader}>
                    <Text style={[bon.thText, { flex: 2 }]}>Produit</Text>
                    <Text style={[bon.thText, bon.thRight, { flex: 0.6 }]}>Qté</Text>
                    <Text style={[bon.thText, bon.thRight, { flex: 1 }]}>PU HT</Text>
                    <Text style={[bon.thText, bon.thRight, { flex: 1 }]}>Total HT</Text>
                  </View>
                  {items.map((it, idx) => {
                    const nom = it.products?.nom || `Produit #${it.product_id}`;
                    const pu = Number(it.prix_unitaire_ht || 0);
                    const ligneTotal = pu * it.quantite;
                    return (
                      <View key={idx} style={[bon.itemRow, idx % 2 === 1 && bon.itemRowAlt]}>
                        <Text style={[bon.tdText, { flex: 2 }]} numberOfLines={2}>{nom}</Text>
                        <Text style={[bon.tdText, bon.tdRight, { flex: 0.6 }]}>{it.quantite}</Text>
                        <Text style={[bon.tdText, bon.tdRight, bon.tdMuted, { flex: 1 }]}>{n2(pu)} €</Text>
                        <Text style={[bon.tdText, bon.tdRight, { flex: 1 }]}>{n2(ligneTotal)} €</Text>
                      </View>
                    );
                  })}
                  <View style={bon.sousTotalRow}>
                    <Text style={bon.sousTotalLabel}>Sous-total</Text>
                    <Text style={bon.sousTotalValue}>{n2(sousTotal)} € HT</Text>
                  </View>
                </View>
              </View>
            );
          })}
          <View style={bon.totalGlobal}>
            <Text style={bon.totalGlobalLabel}>TOTAL DU MOIS</Text>
            <Text style={bon.totalGlobalValue}>{n2(totalMois)} € HT</Text>
          </View>
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      )}

      <ConfirmModal
        visible={confirmVisible}
        title="Envoyer le bilan ?"
        message={`Voulez-vous envoyer le bon de commande mensuel par email à ${client.email} ?\n\nLe document PDF sera joint à l'envoi.`}
        confirmLabel="Oui, envoyer"
        cancelLabel="Annuler"
        loading={sendingEmail}
        onConfirm={handleSendEmail}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  headerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  headerRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerRow2Mobile: {
    justifyContent: 'space-between',
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  excelBtn: {
    backgroundColor: '#217346',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  sageBtn: {
    backgroundColor: '#0073C6',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  excelBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSizes.sm,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? spacing.sm : 10,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 2,
  },
  dateBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  dateBtnText: {
    color: colors.primary,
    fontSize: 14,
  },
  dateLabelWrap: {
    minWidth: 140,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tabsContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  tabActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tableWrapper: {
    flex: 1,
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  },
  horizontalScroll: {
    flex: 1,
  },
  verticalScroll: {
    flex: 1,
  },
  table: {
    minWidth: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowAlt: {
    backgroundColor: '#FAFAFA',
  },
  rowFooter: {
    backgroundColor: colors.secondary,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
  },
  th: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  thText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  td: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  colClient: {
    width: 220,
    flexShrink: 0,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
  },
  colProduct: {
    minWidth: 90,
    flex: 1,
  },
  colTotal: {
    width: 120,
    flexShrink: 0,
    backgroundColor: '#FFF9F5',
  },
  tdClientText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tdClientSub: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  tdQtyText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tdPriceText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tdEmptyText: {
    color: colors.textLight,
  },
  tdTotalText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.primary,
  },
  tdFooterText: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.primary,
  },
  bonBtn: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    alignSelf: 'flex-start',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  bonBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  bonOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    ...Platform.select({ web: { justifyContent: 'center', alignItems: 'center' } }),
  },
  bonBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '94%',
    ...Platform.select({ web: { borderRadius: borderRadius.xl, width: '92%', maxWidth: 760, maxHeight: '90%' } }),
  },
});

const bon = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.textPrimary },
  headerSub: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  closeBtn: { padding: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  closeText: { fontSize: fontSizes.lg, color: colors.textSecondary, fontWeight: '600' },

  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  exportBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  exportBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSizes.sm },
  totalPill: {
    backgroundColor: colors.secondary,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'flex-end',
  },
  totalPillLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalPillValue: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.primary, marginTop: 2 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  emptyText: { color: colors.textSecondary, fontSize: fontSizes.md },

  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, gap: spacing.md },

  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderNum: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textPrimary },
  orderDate: { fontSize: fontSizes.sm, color: colors.textSecondary },

  itemsTable: { paddingBottom: 4 },
  itemsTableHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  thRight: { textAlign: 'right' },

  itemRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  itemRowAlt: { backgroundColor: '#FAFAFA' },
  tdText: { fontSize: fontSizes.sm, color: colors.textPrimary },
  tdRight: { textAlign: 'right' },
  tdMuted: { color: colors.textSecondary },

  sousTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sousTotalLabel: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textSecondary },
  sousTotalValue: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.primary },

  totalGlobal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary + '12',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    marginTop: spacing.sm,
  },
  totalGlobalLabel: { fontSize: fontSizes.sm, fontWeight: '800', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  totalGlobalValue: { fontSize: fontSizes.xl, fontWeight: '900', color: colors.primary },
});
