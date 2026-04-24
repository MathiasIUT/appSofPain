import React, { useState, useEffect, useCallback } from 'react';
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
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';
import Button from '../components/Button';
import { generateOrderPdf } from '../utils/generateOrderPdf';

// ─── Constantes ──────────────────────────────────────────────────────────────

const STATUTS = [
  { key: 'toutes',         label: 'Toutes' },
  { key: 'nouvelle',       label: 'Nouvelle' },
  { key: 'en_preparation', label: 'En préparation' },
  { key: 'en_livraison',   label: 'En livraison' },
  { key: 'livree',         label: 'Livrée' },
  { key: 'annulee',        label: 'Annulée' },
];

const STATUT_LABELS = {
  nouvelle:       'Nouvelle',
  en_preparation: 'En préparation',
  en_livraison:   'En livraison',
  livree:         'Livrée',
  annulee:        'Annulée',
};

const STATUT_COLORS = {
  nouvelle:       '#2196F3',
  en_preparation: '#FF9800',
  en_livraison:   '#00BCD4',
  livree:         '#4CAF50',
  annulee:        '#E53935',
};

const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const n2  = (v) => Number(v ?? 0).toFixed(2);

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function AdminOrdersScreen() {
  const [orders, setOrders]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState('toutes');
  const [selectedOrder, setSelected]  = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Chargement des commandes avec les infos client
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:profiles!orders_client_id_fkey(
            id, nom, prenom, nom_societe, email, telephone
          )
        `)
        .order('date_commande', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('Erreur chargement commandes admin :', err);
      showAlert('Erreur', 'Impossible de charger les commandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const displayed = filter === 'toutes'
    ? orders
    : orders.filter((o) => o.statut === filter);

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

  return (
    <View style={styles.container}>

      {/* ── Barre du haut ──────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.screenTitle}>Commandes</Text>
          <Text style={styles.screenCount}>{displayed.length} / {orders.length}</Text>
        </View>
        <TouchableOpacity onPress={loadOrders} style={styles.refreshBtn} activeOpacity={0.7}>
          <Text style={styles.refreshText}>↻ Actualiser</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filtres par statut ──────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        {STATUTS.map((s) => {
          const count = s.key === 'toutes'
            ? orders.length
            : orders.filter((o) => o.statut === s.key).length;
          const active = filter === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(s.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {s.label}
              </Text>
              <View style={[styles.filterCount, active && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Liste ───────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Aucune commande{filter !== 'toutes' ? ' pour ce statut' : ''}.</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => <OrderRow item={item} onPress={openOrder} isDesktop={isDesktop} />}
        />
      )}

      {/* ── Modal détail commande ───────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, isDesktop && styles.modalBoxDesktop]}>
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
  const sColor = STATUT_COLORS[item.statut] || colors.textSecondary;
  const clientName = item.client?.nom_societe
    || [item.client?.prenom, item.client?.nom].filter(Boolean).join(' ')
    || '—';

  return (
    <TouchableOpacity
      style={[styles.row, isDesktop && styles.rowDesktop]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      {/* Numéro + date */}
      <View style={styles.rowCol}>
        <Text style={styles.rowNum}>N° {item.numero}</Text>
        <Text style={styles.rowDate}>{fmt(item.date_commande)}</Text>
      </View>

      {/* Client */}
      <View style={[styles.rowCol, styles.rowColFlex]}>
        <Text style={styles.rowClient} numberOfLines={1}>{clientName}</Text>
        {item.client?.email ? (
          <Text style={styles.rowEmail} numberOfLines={1}>{item.client.email}</Text>
        ) : null}
      </View>

      {/* Livraison */}
      {isDesktop && (
        <View style={styles.rowCol}>
          <Text style={styles.rowLabel}>Livraison</Text>
          <Text style={styles.rowDate}>{fmt(item.date_livraison_souhaitee)}</Text>
        </View>
      )}

      {/* Total */}
      <View style={[styles.rowCol, styles.rowColRight]}>
        <Text style={styles.rowTotal}>{n2(item.total_ttc)} €</Text>
        <Text style={styles.rowTotalLabel}>TTC</Text>
      </View>

      {/* Statut */}
      <View style={[styles.badge, { backgroundColor: sColor + '22' }]}>
        <Text style={[styles.badgeText, { color: sColor }]}>
          {STATUT_LABELS[item.statut] || item.statut}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Modal détail ────────────────────────────────────────────────────────────

function OrderDetailModal({ order, onClose, onUpdated }) {
  const [items, setItems]           = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [statut, setStatut]         = useState(order.statut);
  const [notesAdmin, setNotesAdmin] = useState(order.notes_admin || '');
  const [saving, setSaving]         = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
          .order('created_at', { ascending: true });
        if (error) throw error;
        setItems(data || []);
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
        .update({ statut, notes_admin: notesAdmin || null })
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
    if (!order.client) return;
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
    || '—';

  const changed = statut !== order.statut || notesAdmin !== (order.notes_admin || '');

  return (
    <View style={modal.container}>

      {/* ── Header modal ───────────────────────────────────── */}
      <View style={modal.header}>
        <View>
          <Text style={modal.headerNum}>N° {order.numero}</Text>
          <Text style={modal.headerDate}>Passée le {fmt(order.date_commande)}</Text>
        </View>
        <View style={modal.headerRight}>
          <Button
            title="📄 PDF"
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

      <ScrollView style={modal.scroll} contentContainerStyle={modal.body}>

        {/* ── Statut ─────────────────────────────────────── */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Statut</Text>
          <View style={modal.statutRow}>
            {STATUTS.filter((s) => s.key !== 'toutes').map((s) => {
              const active = statut === s.key;
              const c = STATUT_COLORS[s.key];
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[modal.statutChip, active && { backgroundColor: c, borderColor: c }]}
                  onPress={() => setStatut(s.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[modal.statutChipText, active && modal.statutChipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Client ─────────────────────────────────────── */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Client</Text>
          <View style={modal.infoGrid}>
            <InfoItem label="Société"   value={order.client?.nom_societe || '—'} />
            <InfoItem label="Contact"   value={clientName} />
            <InfoItem label="Email"     value={order.client?.email || '—'} />
            <InfoItem label="Téléphone" value={order.client?.telephone || '—'} />
          </View>
        </View>

        {/* ── Livraison ───────────────────────────────────── */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Livraison</Text>
          <View style={modal.infoGrid}>
            <InfoItem label="Date souhaitée" value={fmt(order.date_livraison_souhaitee)} />
            {order.date_livraison_reelle ? (
              <InfoItem label="Date réelle" value={fmt(order.date_livraison_reelle)} />
            ) : null}
          </View>
          {order.adresse_livraison ? (
            <View style={modal.addressBox}>
              <Text style={modal.addressLabel}>Adresse</Text>
              <Text style={modal.addressText}>{order.adresse_livraison}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Produits ────────────────────────────────────── */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Produits commandés</Text>
          {loadingItems ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : (
            <>
              {/* En-tête */}
              <View style={modal.tableHead}>
                <Text style={[modal.th, { flex: 3 }]}>Produit</Text>
                <Text style={[modal.th, modal.right, { flex: 1.2 }]}>Pal.</Text>
                <Text style={[modal.th, modal.right, { flex: 1.5 }]}>PU HT</Text>
                <Text style={[modal.th, modal.right, { flex: 1 }]}>TVA</Text>
                <Text style={[modal.th, modal.right, { flex: 1.8 }]}>ST HT</Text>
              </View>
              {items.map((it, idx) => (
                <View key={it.id} style={[modal.tableRow, idx % 2 === 1 && modal.rowAlt]}>
                  <Text style={[modal.td, { flex: 3 }]} numberOfLines={2}>{it.product_nom}</Text>
                  <Text style={[modal.td, modal.right, { flex: 1.2 }]}>{it.quantite_palettes}</Text>
                  <Text style={[modal.td, modal.right, { flex: 1.5 }]}>{n2(it.prix_palette_ht)} €</Text>
                  <Text style={[modal.td, modal.right, { flex: 1 }]}>{n2(it.tva_pourcent)} %</Text>
                  <Text style={[modal.td, modal.right, modal.bold, { flex: 1.8 }]}>{n2(it.sous_total_ht)} €</Text>
                </View>
              ))}

              {/* Totaux */}
              <View style={modal.totals}>
                <TotalLine label="Total HT"  value={`${n2(order.total_ht)} €`} />
                <TotalLine label="TVA"       value={`${n2(order.total_tva)} €`} />
                <TotalLine label="Total TTC" value={`${n2(order.total_ttc)} €`} final />
              </View>
            </>
          )}
        </View>

        {/* ── Notes client ────────────────────────────────── */}
        {order.notes_client ? (
          <View style={modal.section}>
            <Text style={modal.sectionTitle}>Notes du client</Text>
            <View style={modal.notesClientBox}>
              <Text style={modal.notesClientText}>{order.notes_client}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Notes admin ─────────────────────────────────── */}
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

        {/* ── Actions ─────────────────────────────────────── */}
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

  // Top bar
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
  topBarLeft:   { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  screenTitle:  { fontSize: fontSizes.xl, fontWeight: '700', color: colors.textPrimary },
  screenCount:  { fontSize: fontSizes.sm, color: colors.textSecondary },
  refreshBtn:   { ...Platform.select({ web: { cursor: 'pointer' } }) },
  refreshText:  { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '500' },

  // Filtres
  filtersScroll: { maxHeight: 56, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  filtersRow:    { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm, flexDirection: 'row' },
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
  filterChipActive:  { borderColor: colors.primary, backgroundColor: colors.secondary },
  filterLabel:       { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: '500' },
  filterLabelActive: { color: colors.primary, fontWeight: '700' },
  filterCount:       { backgroundColor: colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterCountActive: { backgroundColor: colors.primary },
  filterCountText:   { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  filterCountTextActive: { color: colors.white },

  // États
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  emptyIcon:   { fontSize: 36, marginBottom: spacing.sm },
  emptyText:   { fontSize: fontSizes.md, color: colors.textSecondary },

  // Liste
  list:        { padding: spacing.lg, paddingBottom: spacing.xxl },
  listDesktop: { maxWidth: 1100, alignSelf: 'center', width: '100%' },

  // Ligne
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
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  rowDesktop: { paddingVertical: spacing.md },
  rowCol:     { flexDirection: 'column', justifyContent: 'center' },
  rowColFlex: { flex: 1 },
  rowColRight:{ alignItems: 'flex-end' },
  rowNum:     { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  rowDate:    { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  rowLabel:   { fontSize: fontSizes.xs, color: colors.textLight },
  rowClient:  { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textPrimary },
  rowEmail:   { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  rowTotal:   { fontSize: fontSizes.md, fontWeight: '700', color: colors.primary },
  rowTotalLabel: { fontSize: fontSizes.xs, color: colors.textLight, textAlign: 'right' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
    minWidth: 90,
    alignItems: 'center',
  },
  badgeText:  { fontSize: fontSizes.xs, fontWeight: '600' },
  arrow:      { fontSize: 20, color: colors.border, marginLeft: spacing.xs },

  // Modal overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    ...Platform.select({ web: { justifyContent: 'center', alignItems: 'center' } }),
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    ...Platform.select({ web: { borderRadius: 16, width: '100%', maxWidth: 780, maxHeight: '90%' } }),
  },
  modalBoxDesktop: {
    borderRadius: 16,
    maxWidth: 780,
    alignSelf: 'center',
    width: '100%',
    maxHeight: '90%',
  },
});

// ─── Styles modal ────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { flex: 1 },
  body:      { padding: spacing.lg, paddingBottom: spacing.xxl },

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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerNum:   { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary },
  headerDate:  { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  closeBtn:    { padding: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  closeText:   { fontSize: fontSizes.lg, color: colors.textSecondary, fontWeight: '600' },

  // Sections
  section:      { marginBottom: spacing.lg },
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

  // Statut chips
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
  statutChipText:       { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textSecondary },
  statutChipTextActive: { color: colors.white, fontWeight: '700' },

  // Infos client/livraison
  infoGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoItem:  { minWidth: 160, flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm },
  infoLabel: { fontSize: fontSizes.xs, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textPrimary },

  // Adresse
  addressBox:  { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm },
  addressLabel:{ fontSize: fontSizes.xs, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  addressText: { fontSize: fontSizes.sm, color: colors.textPrimary, lineHeight: 20 },

  // Tableau produits
  tableHead: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  th:      { fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow:{ flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 4, borderRadius: borderRadius.sm },
  rowAlt:  { backgroundColor: colors.secondary },
  td:      { fontSize: fontSizes.sm, color: colors.textPrimary },
  right:   { textAlign: 'right' },
  bold:    { fontWeight: '600' },

  // Totaux
  totals:        { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 4 },
  totalLine:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLineFinal:{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.xs },
  totalLabel:    { fontSize: fontSizes.sm, color: colors.textSecondary },
  totalValue:    { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textPrimary },
  totalLabelFinal:{ fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  totalValueFinal:{ fontSize: fontSizes.lg, fontWeight: '700', color: colors.primary },

  // Notes client
  notesClientBox:  { backgroundColor: colors.secondary, borderRadius: borderRadius.md, padding: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.primary },
  notesClientText: { fontSize: fontSizes.sm, color: colors.textPrimary, fontStyle: 'italic', lineHeight: 20 },

  // Notes admin
  notesInput: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
