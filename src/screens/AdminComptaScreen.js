import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';

const n2 = (v) => Number(v ?? 0).toFixed(2);

export default function AdminComptaScreen() {
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [livreurs, setLivreurs] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientPrices, setClientPrices] = useState([]);
  const [orders, setOrders] = useState([]);
  
  const [selectedLivreurId, setSelectedLivreurId] = useState('all');

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Définir la plage de dates (mois entier)
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      // 2. Charger les données de référence
      const [livRes, prodRes, cliRes, pricesRes, ordRes] = await Promise.all([
        supabase.from('livreurs').select('*').eq('actif', true),
        supabase.from('products').select('*').eq('actif', true).order('nom'),
        supabase.from('profiles').select('*').eq('role', 'client'),
        supabase.from('client_prices').select('*'),
        supabase
          .from('orders')
          .select('id, client_id, total_ht, order_items(product_id, quantite, prix_unitaire_ht)')
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

  // Préparer les données pour le tableau
  const tableData = useMemo(() => {
    // 1. Filtrer les clients par livreur
    let filteredClients = clients;
    if (selectedLivreurId === 'unassigned') {
      filteredClients = clients.filter(c => !c.livreur_id);
    } else if (selectedLivreurId !== 'all') {
      filteredClients = clients.filter(c => c.livreur_id === selectedLivreurId);
    }

    // 2. Agréger les commandes
    const result = [];
    let globalTotalHt = 0;

    for (const client of filteredClients) {
      const clientOrders = orders.filter(o => o.client_id === client.id);
      
      // Si on ne veut afficher que les clients qui ont commandé, on peut décommenter :
      // if (clientOrders.length === 0) continue;

      const productAgg = {};
      let totalHt = 0;

      for (const order of clientOrders) {
        totalHt += Number(order.total_ht || 0);
        for (const item of (order.order_items || [])) {
          if (!productAgg[item.product_id]) {
            productAgg[item.product_id] = { qty: 0, price: item.prix_unitaire_ht };
          }
          productAgg[item.product_id].qty += item.quantite;
          // on garde le dernier prix facturé
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

    // Trier par nom de société ou nom du client
    result.sort((a, b) => {
      const nameA = a.client.nom_societe || a.client.nom || '';
      const nameB = b.client.nom_societe || b.client.nom || '';
      return nameA.localeCompare(nameB);
    });

    return { rows: result, globalTotalHt };
  }, [clients, orders, selectedLivreurId]);

  // Récupérer le prix par défaut ou personnalisé pour un produit et un client
  const getDisplayPrice = (productId, clientId, aggregatedPrice) => {
    if (aggregatedPrice !== undefined) return aggregatedPrice;
    
    // Chercher prix personnalisé
    const custom = clientPrices.find(cp => cp.client_id === clientId && cp.product_id === productId);
    if (custom) return custom.prix_unitaire_ht;

    // Chercher prix de base
    const base = products.find(p => p.id === productId);
    return base ? base.prix_unitaire_ht : 0;
  };

  return (
    <View style={styles.container}>
      {/* ── EN-TÊTE & FILTRES DATE ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Comptabilité</Text>
          <Text style={styles.subtitle}>Bilan par livreur et par mois</Text>
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

      {/* ── ONGLETS LIVREURS ── */}
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

          {livreurs.map(l => (
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

      {/* ── TABLEAU ── */}
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
          <ScrollView horizontal style={styles.horizontalScroll} showsHorizontalScrollIndicator={true}>
            <ScrollView style={styles.verticalScroll} showsVerticalScrollIndicator={true}>
              <View style={styles.table}>
                
                {/* Ligne d'en-tête */}
                <View style={styles.tableHeaderRow}>
                  <View style={[styles.th, styles.colClient]}>
                    <Text style={styles.thText}>Client</Text>
                  </View>
                  {products.map(p => (
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
                        {!row.client.livreur_id && (
                          <View style={{ backgroundColor: '#FFEBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' }}>
                            <Text style={{ color: '#D32F2F', fontSize: 10, fontWeight: '700' }}>⚠️ SANS LIVREUR</Text>
                          </View>
                        )}
                      </View>
                      
                      {products.map(p => {
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
                  {products.map(p => {
                    // Calcul de la somme totale des quantités pour ce produit pour la vue actuelle
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
    width: 180,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
  },
  colProduct: {
    width: 80,
  },
  colTotal: {
    width: 100,
    backgroundColor: '#FFF9F5',
  },
  tdClientText: {
    fontSize: fontSizes.sm,
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
});
