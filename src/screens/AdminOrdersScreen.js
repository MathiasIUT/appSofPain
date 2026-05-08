import React, { useState, useEffect, useCallback, createElement } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import Button from '../components/Button';
import { generateOrderPdf, buildOrderHtml } from '../utils/generateOrderPdf';

// ─── Constantes ──────────────────────────────────────────────────────────────



const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const n2 = (v) => Number(v ?? 0).toFixed(2);

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

const PAGE_SIZE = 30;

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedOrder, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;



  // Charger les commandes paginées avec filtre serveur
  const loadOrders = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const from = reset ? 0 : orders.length;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('orders')
        .select(`
          id, numero, client_id, client_nom, statut, date_commande, date_livraison_souhaitee,
          total_ht, total_tva, total_ttc, livreur_id, notes_client, notes_admin,
          adresse_livraison, date_livraison_reelle,
          client:profiles!client_id(
            id, nom, prenom, nom_societe, email, telephone
          )
        `, { count: 'exact' })
        .order('date_commande', { ascending: false })
        .range(from, to)
        .eq('statut', 'nouvelle');

      const { data, error, count } = await query;
      if (error) throw error;

      if (reset) {
        setOrders(data || []);
      } else {
        setOrders((prev) => [...prev, ...(data || [])]);
      }
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('Erreur chargement commandes admin :', err);
      showAlert('Erreur', 'Impossible de charger les commandes.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [orders.length]);

  // Recharger au montage
  useEffect(() => { loadOrders(true); }, [loadOrders]);

  const hasMore = orders.length < totalCount;

  const openOrder = (order) => {
    setSelected(order);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelected(null);
  };

  const handleOrderUpdated = (updated) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    setSelected((prev) => prev ? { ...prev, ...updated } : prev);
  };

  const handleRefresh = () => { loadOrders(true); };

  return (
    <View style={styles.container}>

      {/* ── Barre du haut ──────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.screenTitle}>Commandes</Text>
          <Text style={styles.screenCount}>{`${orders.length} / ${totalCount}`}</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
          <Text style={styles.refreshText}>↻ Actualiser</Text>
        </TouchableOpacity>
      </View>



      {/* ── Liste ───────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>
            Aucune commande.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <OrderRow item={item} onPress={openOrder} isDesktop={isDesktop} />
          )}
          ListFooterComponent={hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => loadOrders(false)}
              disabled={loadingMore}
              activeOpacity={0.7}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>
                  {`Charger plus (${orders.length}/${totalCount})`}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        />
      )}

      {/* ── Modal détail ────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalBox,
            isDesktop && styles.modalBoxDesktop,
          ]}>
            {selectedOrder && (
              <OrderDetailModal
                order={selectedOrder}
                onClose={closeModal}
                onUpdated={handleOrderUpdated}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Ligne commande ──────────────────────────────────────────────────────────

function OrderRow({ item, onPress, isDesktop }) {
  const clientName = item.client?.nom_societe
    || [item.client?.prenom, item.client?.nom].filter(Boolean).join(' ')
    || item.client_nom
    || '— Client supprimé —';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={styles.rowCol}>
        <Text style={styles.rowNum}>{`N° ${item.numero}`}</Text>
        <Text style={styles.rowDate}>{fmt(item.date_commande)}</Text>
      </View>

      <View style={[styles.rowCol, styles.rowColFlex]}>
        <Text style={styles.rowClient} numberOfLines={1}>{clientName}</Text>
        {item.client?.email ? (
          <Text style={styles.rowEmail} numberOfLines={1}>{item.client.email}</Text>
        ) : null}
      </View>



      <View style={[styles.rowCol, styles.rowColRight]}>
        <Text style={styles.rowTotal}>{`${n2(item.total_ttc)} €`}</Text>
        <Text style={styles.rowTotalLabel}>TTC</Text>
      </View>



      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Modal détail commande ───────────────────────────────────────────────────

function OrderDetailModal({ order, onClose, onUpdated }) {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [statut, setStatut] = useState(order.statut);
  const [notesAdmin, setNotesAdmin] = useState(order.notes_admin || '');
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [livreurs, setLivreurs] = useState([]);
  const [selectedLivreur, setSelectedLivreur] = useState(order.livreur_id || null);

  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 900;

  useEffect(() => {
    (async () => {
      setLoadingItems(true);
      try {
        const [itemsRes, livRes] = await Promise.all([
          supabase.from('order_items').select('*').eq('order_id', order.id)
            .order('created_at', { ascending: true }),
          supabase.from('livreurs').select('id, nom, prenom').eq('actif', true),
        ]);
        if (itemsRes.error) throw itemsRes.error;
        const fetched = itemsRes.data || [];
        setItems(fetched);
        setLivreurs(livRes.data || []);
        if (order.client) {
          setPreviewHtml(buildOrderHtml(order, fetched, order.client));
        }
      } catch (err) {
        console.error('Erreur chargement items :', err);
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [order.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ statut, notes_admin: notesAdmin || null, livreur_id: selectedLivreur || null })
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      onUpdated(data);
      showAlert('Succès', 'Commande mise à jour.');
    } catch (err) {
      console.error('Erreur mise à jour commande :', err);
      showAlert('Erreur', 'Impossible de mettre à jour la commande.');
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    if (!order.client) {
      showAlert('Erreur', 'Infos client non disponibles.');
      return;
    }
    setPdfLoading(true);
    try {
      await generateOrderPdf(order, items, order.client);
    } catch (err) {
      console.error('Erreur PDF :', err);
      showAlert('Erreur', 'Impossible de générer le bon de commande.');
    } finally {
      setPdfLoading(false);
    }
  };

  const clientName = order.client?.nom_societe
    || [order.client?.prenom, order.client?.nom].filter(Boolean).join(' ')
    || order.client_nom
    || '— Client supprimé —';

  // Fallback : extraire le téléphone depuis l'adresse si absent du profil
  const telephone = order.client?.telephone
    || (order.adresse_livraison?.match(/Tél\s*:\s*(.+)/)?.[1]?.trim())
    || '—';

  const changed = statut !== order.statut || notesAdmin !== (order.notes_admin || '') || selectedLivreur !== (order.livreur_id || null);

  // Hauteur utile pour les colonnes (modal - header)
  const bodyHeight = Math.min(height * 0.88, 820) - 64;

  return (
    <View style={modal.container}>

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={modal.header}>
        <View>
          <Text style={modal.headerNum}>{`N° ${order.numero}`}</Text>
          <Text style={modal.headerDate}>Passée le {fmt(order.date_commande)}</Text>
        </View>
        <View style={modal.headerRight}>
          <Button
            title="📄 Imprimer PDF"
            variant="secondary"
            size="sm"
            onPress={handlePdf}
            loading={pdfLoading}
            disabled={pdfLoading}
          />
          <TouchableOpacity onPress={onClose} style={modal.closeBtn} activeOpacity={0.7}>
            <Text style={modal.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body : 2 colonnes sur desktop ──────────────────── */}
      <View style={[modal.body, isDesktop && { flexDirection: 'row', height: bodyHeight }]}>

        {/* ── Colonne gauche : infos ──────────────────────── */}
        <ScrollView
          style={[modal.leftCol, isDesktop && modal.leftColDesktop]}
          contentContainerStyle={modal.leftColContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Action sur la commande */}
          <View style={modal.section}>
            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Retirer la commande (Traitée / Imprimée)"
                onPress={() => setStatut('archivee')}
                variant="primary"
                fullWidth
              />
            </View>
          </View>

          {/* Client */}
          <View style={modal.section}>
            <Text style={modal.sectionTitle}>Client</Text>
            <View style={modal.infoGrid}>
              <InfoItem label="Société" value={order.client?.nom_societe || '—'} />
              <InfoItem label="Contact" value={clientName} />
              <InfoItem label="Email" value={order.client?.email || '—'} />
              <InfoItem label="Téléphone" value={telephone} />
            </View>
          </View>

          {/* Livraison */}
          <View style={modal.section}>
            {order.adresse_livraison ? (
              <View style={modal.addressBox}>
                <Text style={modal.addressLabel}>Adresse</Text>
                <Text style={modal.addressText}>{order.adresse_livraison}</Text>
              </View>
            ) : null}
            <Text style={[modal.sectionTitle, { marginTop: spacing.md }]}>Livreur assigné</Text>
            <View style={modal.statutRow}>
              <TouchableOpacity
                style={[modal.statutChip, !selectedLivreur && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setSelectedLivreur(null)}
              >
                <Text style={[modal.statutChipText, !selectedLivreur && modal.statutChipTextActive]}>Aucun</Text>
              </TouchableOpacity>
              {livreurs.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={[modal.statutChip, selectedLivreur === l.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setSelectedLivreur(l.id)}
                >
                  <Text style={[modal.statutChipText, selectedLivreur === l.id && modal.statutChipTextActive]}>
                    {[l.prenom, l.nom].filter(Boolean).join(' ') || 'Livreur'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Produits */}
          <View style={modal.section}>
            <Text style={modal.sectionTitle}>Produits commandés</Text>
            {loadingItems ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : (
              <>
                <View style={modal.tableHead}>
                  <Text style={[modal.th, { flex: 3 }]}>Produit</Text>
                  <Text style={[modal.th, modal.right, { flex: 1.2 }]}>Qté</Text>
                  <Text style={[modal.th, modal.right, { flex: 1.5 }]}>PU HT</Text>
                  <Text style={[modal.th, modal.right, { flex: 1 }]}>TVA</Text>
                  <Text style={[modal.th, modal.right, { flex: 1.8 }]}>ST HT</Text>
                </View>
                {items.map((it, idx) => (
                  <View key={it.id} style={[modal.tableRow, idx % 2 === 1 && modal.rowAlt]}>
                    <Text style={[modal.td, { flex: 3 }]} numberOfLines={2}>{it.product_nom}</Text>
                    <Text style={[modal.td, modal.right, { flex: 1.2 }]}>{it.quantite}</Text>
                    <Text style={[modal.td, modal.right, { flex: 1.5 }]}>{`${n2(it.prix_unitaire_ht)} €`}</Text>
                    <Text style={[modal.td, modal.right, { flex: 1 }]}>{`${n2(it.tva_pourcent)} %`}</Text>
                    <Text style={[modal.td, modal.right, modal.bold, { flex: 1.8 }]}>{`${n2(it.sous_total_ht)} €`}</Text>
                  </View>
                ))}
                <View style={modal.totals}>
                  <TotalLine label="Total HT" value={`${n2(order.total_ht)} €`} />
                  <TotalLine label="TVA" value={`${n2(order.total_tva)} €`} />
                  <TotalLine label="Total TTC" value={`${n2(order.total_ttc)} €`} final />
                </View>
              </>
            )}
          </View>

          {/* Notes client */}
          {order.notes_client ? (
            <View style={modal.section}>
              <Text style={modal.sectionTitle}>Notes du client</Text>
              <View style={modal.notesClientBox}>
                <Text style={modal.notesClientText}>{order.notes_client}</Text>
              </View>
            </View>
          ) : null}

          {/* Notes admin */}
          <View style={modal.section}>
            <Text style={modal.sectionTitle}>Notes internes (admin)</Text>
            <TextInput
              style={modal.notesInput}
              value={notesAdmin}
              onChangeText={setNotesAdmin}
              placeholder="Ajouter une note interne..."
              placeholderTextColor={colors.textLight}
              multiline
              numberOfLines={3}
            />
          </View>

          {changed ? (
            <Button
              title="Enregistrer les modifications"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              fullWidth
              size="lg"
            />
          ) : null}

          <View style={{ height: spacing.xl }} />
        </ScrollView>

        {/* ── Colonne droite : aperçu PDF (desktop web only) ── */}
        {isDesktop && Platform.OS === 'web' && (
          <View style={modal.rightCol}>
            <View style={modal.previewHeader}>
              <Text style={modal.sectionTitle}>Aperçu bon de commande</Text>
            </View>
            <View style={modal.iframeWrap}>
              {previewHtml
                ? createElement('iframe', {
                  srcDoc: previewHtml,
                  style: {
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    borderRadius: 8,
                    backgroundColor: '#fff',
                  },
                  title: 'Aperçu bon de commande',
                })
                : (
                  <View style={modal.previewLoading}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={modal.previewLoadingText}>Génération de l'aperçu...</Text>
                  </View>
                )
              }
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function InfoItem({ label, value }) {
  return (
    <View style={modal.infoItem}>
      <Text style={modal.infoLabel}>{label}</Text>
      <Text style={modal.infoValue}>{value}</Text>
    </View>
  );
}

function TotalLine({ label, value, final }) {
  return (
    <View style={[modal.totalLine, final && modal.totalLineFinal]}>
      <Text style={final ? modal.totalLabelFinal : modal.totalLabel}>{label}</Text>
      <Text style={final ? modal.totalValueFinal : modal.totalValue}>{value}</Text>
    </View>
  );
}

// ─── Styles liste ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  screenTitle: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.textPrimary },
  screenCount: { fontSize: fontSizes.sm, color: colors.textSecondary },
  refreshBtn: { ...Platform.select({ web: { cursor: 'pointer' } }) },
  refreshText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },

  filtersScroll: {
    maxHeight: 56,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.round,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  filterChipActive: { borderColor: colors.primary, backgroundColor: colors.secondary },
  filterLabel: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: '500' },
  filterLabelActive: { color: colors.primary, fontWeight: '700' },
  filterCount: { backgroundColor: colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterCountActive: { backgroundColor: colors.primary },
  filterCountText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  filterCountTextActive: { color: colors.white },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  emptyIcon: { fontSize: 36, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSizes.md, color: colors.textSecondary },

  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  listDesktop: { maxWidth: 1100, alignSelf: 'center', width: '100%' },
  loadMoreBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  loadMoreText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  rowCol: { flexDirection: 'column', justifyContent: 'center' },
  rowColFlex: { flex: 1 },
  rowColRight: { alignItems: 'flex-end' },
  rowNum: { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  rowDate: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  rowLabel: { fontSize: fontSizes.xs, color: colors.textLight },
  rowClient: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textPrimary },
  rowEmail: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  rowTotal: { fontSize: fontSizes.md, fontWeight: '700', color: colors.primary },
  rowTotalLabel: { fontSize: fontSizes.xs, color: colors.textLight, textAlign: 'right' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    minWidth: 90,
    alignItems: 'center',
  },
  badgeText: { fontSize: fontSizes.xs, fontWeight: '600' },
  arrow: { fontSize: 20, color: colors.border, marginLeft: spacing.xs },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    ...Platform.select({ web: { justifyContent: 'center', alignItems: 'center' } }),
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '92%',
  },
  modalBoxDesktop: {
    borderRadius: borderRadius.xl,
    width: '96%',
    maxWidth: 1160,
    maxHeight: '90%',
    alignSelf: 'center',
  },
});

// ─── Styles modal ────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  headerNum: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary },
  headerDate: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  closeBtn: { padding: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  closeText: { fontSize: fontSizes.lg, color: colors.textSecondary, fontWeight: '600' },

  // Layout 2 colonnes
  body: { flex: 1 },

  // Colonne gauche (infos)
  leftCol: { flex: 1 },
  leftColDesktop: { flex: 1, borderRightWidth: 1, borderRightColor: colors.border },
  leftColContent: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Colonne droite (aperçu)
  rightCol: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  previewHeader: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  iframeWrap: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    ...Platform.select({ web: { border: '1px solid ' + colors.border } }),
  },
  previewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewLoadingText: { fontSize: fontSizes.sm, color: colors.textSecondary },

  // Sections
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.primary,
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Statut
  statutRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statutChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: borderRadius.round,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  statutChipText: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textSecondary },
  statutChipTextActive: { color: colors.white, fontWeight: '700' },

  // Infos
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoItem: { minWidth: 140, flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm },
  infoLabel: { fontSize: fontSizes.xs, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textPrimary },

  // Adresse
  addressBox: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm },
  addressLabel: { fontSize: fontSizes.xs, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  addressText: { fontSize: fontSizes.sm, color: colors.textPrimary, lineHeight: 20 },

  // Tableau
  tableHead: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  th: { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 4, borderRadius: borderRadius.sm },
  rowAlt: { backgroundColor: colors.secondary },
  td: { fontSize: fontSizes.sm, color: colors.textPrimary },
  right: { textAlign: 'right' },
  bold: { fontWeight: '600' },

  // Totaux
  totals: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 4 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLineFinal: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.xs },
  totalLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  totalValue: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textPrimary },
  totalLabelFinal: { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  totalValueFinal: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.primary },

  // Notes
  notesClientBox: { backgroundColor: colors.secondary, borderRadius: borderRadius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  notesClientText: { fontSize: fontSizes.sm, color: colors.textPrimary, fontStyle: 'italic', lineHeight: 20 },
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});