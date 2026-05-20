import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, TextInput, Platform, Alert, useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import Button from '../components/Button';
import useDebounce from '../hooks/useDebounce';
import { generateDriverTourPdf } from '../utils/generateDriverTourPdf';

const showAlert = (t, m) => {
  if (Platform.OS === 'web') window.alert(`${t}\n\n${m}`);
  else Alert.alert(t, m);
};

export default function AdminLogistiqueScreen() {
  const [livreurs, setLivreurs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('livreurs').select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLivreurs(data || []);
    } catch (err) {
      showAlert('Erreur', 'Impossible de charger les livreurs.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const debouncedSearch = useDebounce(search, 300);

  const filtered = livreurs.filter(l => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return l.nom?.toLowerCase().includes(q) || l.prenom?.toLowerCase().includes(q);
  });

  const handlePressLivreur = useCallback((livreur) => {
    setSelected(livreur);
    setDetailVisible(true);
  }, []);

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <Text style={s.title}>Logistique — Livreurs</Text>
          <Text style={s.count}>{filtered.length} / {livreurs.length}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <TouchableOpacity onPress={load} style={s.refreshBtn}><Text style={s.refreshText}>↻</Text></TouchableOpacity>
          <Button title="+ Ajouter un livreur" onPress={() => setCreateVisible(true)} size="sm" />
        </View>
      </View>

      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} placeholder="Rechercher un livreur..."
          placeholderTextColor={colors.textLight} value={search} onChangeText={setSearch} />
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyText}>{search ? 'Aucun résultat.' : 'Aucun livreur.'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={[s.list, isDesktop && s.listDesktop]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android' || Platform.OS === 'web'}
          renderItem={({ item }) => (
            <LivreurRow item={item} onPress={handlePressLivreur} />
          )}
        />
      )}

      <CreateLivreurModal visible={createVisible} onClose={() => setCreateVisible(false)} onCreated={load} />

      <Modal visible={detailVisible} animationType="slide" transparent onRequestClose={() => setDetailVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, isDesktop && s.modalBoxDesktop]}>
            {selected && <LivreurDetail livreur={selected} onClose={() => { setDetailVisible(false); setSelected(null); }}
              onDeleted={(id) => { setLivreurs(prev => prev.filter(l => l.id !== id)); setDetailVisible(false); setSelected(null); }} />}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const LivreurRow = React.memo(({ item, onPress }) => {
  return (
    <TouchableOpacity style={[s.row, item.actif === false && s.rowInactive]}
      onPress={() => onPress(item)}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName}>{[item.prenom, item.nom].filter(Boolean).join(' ') || '—'}</Text>
      </View>
      <View style={[s.badge, { backgroundColor: item.actif !== false ? colors.success + '22' : colors.error + '22' }]}>
        <Text style={[s.badgeText, { color: item.actif !== false ? colors.success : colors.error }]}>
          {item.actif !== false ? 'Actif' : 'Inactif'}
        </Text>
      </View>
      <Text style={s.arrow}>›</Text>
    </TouchableOpacity>
  );
});

function CreateLivreurModal({ visible, onClose, onCreated }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [form, setForm] = useState({ nom: '', prenom: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setForm({ nom: '', prenom: '' }); }, [visible]);

  const handleCreate = async () => {
    if (!form.nom.trim() && !form.prenom.trim()) { showAlert('Erreur', 'Nom ou prénom requis.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('livreurs').insert({
        nom: form.nom.trim() || null,
        prenom: form.prenom.trim() || null,
        actif: true,
      });
      if (error) throw error;
      showAlert('Succès', 'Livreur créé.');
      onCreated?.();
      onClose();
    } catch (err) {
      showAlert('Erreur', err.message || 'Impossible de créer le livreur.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, isDesktop && s.modalBoxDesktop]}>
          <View style={s.modalHeader}>
            <Text style={s.modalHeaderTitle}>Ajouter un livreur</Text>
            <TouchableOpacity onPress={onClose}><Text style={s.closeText}>✕</Text></TouchableOpacity>
          </View>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <Field label="Prénom" value={form.prenom} onChangeText={v => setForm(p => ({ ...p, prenom: v }))} placeholder="Jean" />
            <Field label="Nom" value={form.nom} onChangeText={v => setForm(p => ({ ...p, nom: v }))} placeholder="Dupont" />
            <Button title="Créer le livreur" onPress={handleCreate} loading={saving} disabled={saving} fullWidth size="lg" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LivreurDetail({ livreur, onClose, onDeleted }) {
  const [clients, setClients] = useState([]);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [orders, setOrders] = useState([]);
  // ordersOrderMap : { [isoDate]: [orderId, orderId, ...] } — ordre de livraison par jour
  const [ordersOrderMap, setOrdersOrderMap] = useState({});
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Retourne les commandes d'un jour dans l'ordre de la tournée
  const getDayOrdersSorted = (isoDate, allOrders) => {
    const dayOrders = allOrders.filter(o => (o.date_commande || '').split('T')[0] === isoDate);
    const orderIds = ordersOrderMap[isoDate];
    if (!orderIds) return dayOrders;
    return [...dayOrders].sort((a, b) => {
      const ia = orderIds.indexOf(a.id);
      const ib = orderIds.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };

  // Déplace une commande d'une position dans la tournée
  const moveOrder = (isoDate, fromIdx, toIdx) => {
    setOrdersOrderMap(prev => {
      const current = getDayOrdersSorted(isoDate, orders).map(o => o.id);
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...prev, [isoDate]: next };
    });
  };

  const handleToggleClients = async () => {
    const next = !clientsOpen;
    setClientsOpen(next);
    if (next && !clientsLoaded) {
      setLoadingClients(true);
      try {
        const { data } = await supabase
          .from('profiles').select('id, nom_societe, nom, prenom')
          .eq('role', 'client').eq('livreur_id', livreur.id)
          .order('nom_societe', { ascending: true });
        setClients(data || []);
        setClientsLoaded(true);
      } catch (err) { console.error(err); }
      finally { setLoadingClients(false); }
    }
  };

  const handleToggleOrders = async () => {
    const next = !ordersOpen;
    setOrdersOpen(next);
    if (next && !ordersLoaded) {
      setLoadingOrders(true);
      try {
        const { data } = await supabase
          .from('orders').select('*, client:profiles(nom_societe, nom, prenom, telephone), order_items(*)')
          .eq('livreur_id', livreur.id).in('statut', ['nouvelle'])
          .order('numero', { ascending: true });
        const fetched = data || [];
        setOrders(fetched);
        // Initialiser l'ordre par défaut (par numéro de commande croissant)
        const newOrderMap = {};
        const dates = [...new Set(fetched.map(o => (o.date_commande || '').split('T')[0]))];
        dates.forEach(isoDate => {
          newOrderMap[isoDate] = fetched
            .filter(o => (o.date_commande || '').split('T')[0] === isoDate)
            .map(o => o.id);
        });
        setOrdersOrderMap(newOrderMap);
        setOrdersLoaded(true);
      } catch (err) { console.error(err); }
      finally { setLoadingOrders(false); }
    }
  };

  const archiverCommandes = async (ordersToArchive) => {
    try {
      const { error } = await supabase.from('orders')
        .update({ statut: 'traite' })
        .in('id', ordersToArchive.map(o => o.id));
      if (error) throw error;
      setOrders(prev => prev.filter(o => !ordersToArchive.find(x => x.id === o.id)));
      showAlert('Succès', 'Les commandes ont été marquées comme traitées.');
    } catch (e) {
      showAlert('Erreur', 'Impossible de traiter les commandes.');
    }
  };

  const handleDelete = async () => {
    const confirm = Platform.OS === 'web'
      ? window.confirm(`Supprimer le livreur "${displayName}" ? Cette action est irréversible.`)
      : await new Promise(resolve => Alert.alert(
        'Supprimer le livreur',
        `Supprimer "${displayName}" ? Cette action est irréversible.`,
        [{ text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) }]
      ));
    if (!confirm) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('livreurs').delete().eq('id', livreur.id);
      if (error) throw error;
      onDeleted(livreur.id);
      onClose();
    } catch (err) {
      showAlert('Erreur', err.message || 'Impossible de supprimer le livreur.');
    } finally { setDeleting(false); }
  };

  const displayName = [livreur.prenom, livreur.nom].filter(Boolean).join(' ') || '—';

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <View style={s.modalHeader}>
        <Text style={s.modalHeaderTitle}>{displayName}</Text>
        <TouchableOpacity onPress={onClose}><Text style={s.closeText}>✕</Text></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>

        <TouchableOpacity onPress={handleToggleClients} style={s.accordionHeader}>
          <Text style={[s.sectionTitle, { borderBottomWidth: 0, paddingBottom: 0, marginTop: 0 }]}>
            Clients assignés {clientsLoaded ? `(${clients.length})` : ''}
          </Text>
          <Text style={[s.accordionArrow, clientsOpen && s.accordionArrowOpen]}>›</Text>
        </TouchableOpacity>
        {clientsOpen && (
          loadingClients
            ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
            : clients.length === 0
              ? <Text style={s.emptyText}>Aucun client assigné.</Text>
              : clients.map(c => (
                <View key={c.id} style={s.clientRow}>
                  <Text style={s.clientName}>{c.nom_societe || [c.prenom, c.nom].filter(Boolean).join(' ') || '—'}</Text>
                </View>
              ))
        )}

        <TouchableOpacity onPress={handleToggleOrders} style={s.accordionHeader}>
          <Text style={[s.sectionTitle, { borderBottomWidth: 0, paddingBottom: 0, marginTop: 0 }]}>
            Commandes en cours {ordersLoaded ? `(${orders.length})` : ''}
          </Text>
          <Text style={[s.accordionArrow, ordersOpen && s.accordionArrowOpen]}>›</Text>
        </TouchableOpacity>
        {ordersOpen && (
          loadingOrders
            ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.sm }} />
            : orders.length === 0
              ? <Text style={s.emptyText}>Aucune commande en cours.</Text>
              : [...new Set(orders.map(o => (o.date_commande || '').split('T')[0]))]
                  .sort((a, b) => b.localeCompare(a))
                  .map(isoDate => {
                    const dayOrders = getDayOrdersSorted(isoDate, orders);
                    const dateObj = new Date(isoDate);
                    const dateStr = isNaN(dateObj) ? isoDate : dateObj.toLocaleDateString('fr-FR');
                    return (
                      <View key={isoDate} style={{ marginBottom: spacing.md }}>
                        {/* ── En-tête du jour ── */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xs }}>
                          <View>
                            <Text style={{ fontSize: fontSizes.sm, fontWeight: '700', color: colors.primary }}>
                              Journée du {dateStr}
                            </Text>
                            <Text style={{ fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 }}>
                              {dayOrders.length} livraison{dayOrders.length > 1 ? 's' : ''} · Glissez ↑↓ pour réordonner
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <TouchableOpacity
                              onPress={async () => {
                                setPrinting(true);
                                try {
                                  await generateDriverTourPdf(livreur, dayOrders, dateStr);
                                  if (Platform.OS === 'web') {
                                    if (window.confirm('La tournée a été générée. Voulez-vous retirer ces commandes de la liste ?')) {
                                      archiverCommandes(dayOrders);
                                    }
                                  } else {
                                    Alert.alert('Traitement', 'La tournée a été générée. Voulez-vous retirer ces commandes de la liste ?', [
                                      { text: 'Non', style: 'cancel' },
                                      { text: 'Oui', onPress: () => archiverCommandes(dayOrders) },
                                    ]);
                                  }
                                } catch (e) { showAlert('Erreur', 'Impossible de générer le PDF.'); }
                                finally { setPrinting(false); }
                              }}
                              style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, ...Platform.select({ web: { cursor: 'pointer' } }) }}
                              disabled={printing}
                            >
                              {printing
                                ? <ActivityIndicator color={colors.white} size="small" />
                                : <Text style={{ color: colors.white, fontSize: 12, fontWeight: 'bold' }}>Imprimer la tournée</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => {
                                const confirmText = `Voulez-vous retirer la tournée du ${dateStr} de la liste ?`;
                                if (Platform.OS === 'web') {
                                  if (window.confirm(confirmText)) archiverCommandes(dayOrders);
                                } else {
                                  Alert.alert('Confirmation', confirmText, [
                                    { text: 'Annuler', style: 'cancel' },
                                    { text: 'Retirer', style: 'destructive', onPress: () => archiverCommandes(dayOrders) },
                                  ]);
                                }
                              }}
                              style={{ backgroundColor: colors.error, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, ...Platform.select({ web: { cursor: 'pointer' } }) }}
                              disabled={printing}
                            >
                              <Text style={{ color: colors.white, fontSize: 12, fontWeight: 'bold' }}>Retirer/Valider</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* ── Liste des commandes réordonnables ── */}
                        {dayOrders.map((o, idx) => (
                          <View key={o.id} style={s.orderLine}>
                            {/* Badge de position dans la tournée */}
                            <View style={[s.tourBadge, { backgroundColor: idx === 0 ? colors.primary : idx === dayOrders.length - 1 ? '#888' : colors.secondary }]}>
                              <Text style={[s.tourBadgeText, { color: idx === 0 ? '#fff' : idx === dayOrders.length - 1 ? '#fff' : colors.primary }]}>
                                {idx + 1}
                              </Text>
                            </View>

                            {/* Infos commande */}
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={s.orderNum}>N° {o.numero}</Text>
                              <Text style={s.orderClient} numberOfLines={1}>
                                {o.client?.nom_societe || [o.client?.prenom, o.client?.nom].filter(Boolean).join(' ') || '—'}
                              </Text>
                              {o.adresse_livraison ? (
                                <Text style={s.orderAddress} numberOfLines={1}>{o.adresse_livraison.split('\n')[0]}</Text>
                              ) : null}
                            </View>

                            <Text style={s.orderAmount}>{Number(o.total_ht || 0).toFixed(2)} €</Text>

                            {/* Boutons de réordonnancement */}
                            <View style={s.reorderBtns}>
                              <TouchableOpacity
                                style={[s.reorderBtn, idx === 0 && s.reorderBtnDisabled]}
                                onPress={() => moveOrder(isoDate, idx, idx - 1)}
                                disabled={idx === 0}
                                activeOpacity={0.7}
                              >
                                <Text style={[s.reorderBtnText, idx === 0 && s.reorderBtnTextDisabled]}>▲</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[s.reorderBtn, idx === dayOrders.length - 1 && s.reorderBtnDisabled]}
                                onPress={() => moveOrder(isoDate, idx, idx + 1)}
                                disabled={idx === dayOrders.length - 1}
                                activeOpacity={0.7}
                              >
                                <Text style={[s.reorderBtnText, idx === dayOrders.length - 1 && s.reorderBtnTextDisabled]}>▼</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })
        )}

        <TouchableOpacity style={[s.toggleBtn, { backgroundColor: colors.error, marginTop: spacing.lg }]} onPress={handleDelete} disabled={deleting}>
          {deleting
            ? <ActivityIndicator color={colors.white} size="small" />
            : <Text style={s.toggleBtnText}>Supprimer le livreur</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, ...rest }) {
  return (
    <View>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={s.fieldInput} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor={colors.textLight} {...rest} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  title: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.textPrimary },
  count: { fontSize: fontSizes.sm, color: colors.textSecondary },
  refreshBtn: { ...Platform.select({ web: { cursor: 'pointer' } }) },
  refreshText: { fontSize: fontSizes.lg, color: colors.primary, fontWeight: '600' },
  searchWrap: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? spacing.sm : 10,
    fontSize: fontSizes.sm, color: colors.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 36, marginBottom: spacing.sm },
  emptyText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontStyle: 'italic' },
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  listDesktop: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.border, ...shadows.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  rowInactive: { opacity: 0.6 },
  rowName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.round, minWidth: 60, alignItems: 'center' },
  badgeText: { fontSize: fontSizes.xs, fontWeight: '600' },
  arrow: { fontSize: 20, color: colors.border, marginLeft: spacing.xs },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
    ...Platform.select({ web: { justifyContent: 'center', alignItems: 'center' } }),
  },
  modalBox: {
    backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl, maxHeight: '92%',
  },
  modalBoxDesktop: {
    borderRadius: borderRadius.xl, width: '96%', maxWidth: 600,
    maxHeight: '90%', alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalHeaderTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary },
  closeText: { fontSize: fontSizes.lg, color: colors.textSecondary, fontWeight: '600', ...Platform.select({ web: { cursor: 'pointer' } }) },
  sectionTitle: {
    fontSize: fontSizes.xs, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, color: colors.primary, marginTop: spacing.sm,
    paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  infoLine: { fontSize: fontSizes.md, color: colors.textPrimary },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.sm, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  accordionArrow: {
    fontSize: 20, color: colors.primary, fontWeight: '700',
    transform: [{ rotate: '0deg' }],
  },
  accordionArrowOpen: {
    transform: [{ rotate: '90deg' }],
  },
  clientRow: {
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  clientName: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: '500' },
  orderLine: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  orderNum: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textPrimary },
  orderClient: { fontSize: fontSizes.xs, color: colors.textSecondary },
  orderAddress: { fontSize: fontSizes.xs, color: colors.textLight, fontStyle: 'italic' },
  orderAmount: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.primary, minWidth: 60, textAlign: 'right' },
  // Badge de position dans la tournée
  tourBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  tourBadgeText: { fontSize: fontSizes.xs, fontWeight: '800' },
  // Boutons réordonnancement
  reorderBtns: { flexDirection: 'column', gap: 2, flexShrink: 0 },
  reorderBtn: {
    width: 28, height: 22, borderRadius: 4,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  reorderBtnDisabled: { opacity: 0.25, backgroundColor: colors.background },
  reorderBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary, lineHeight: 13 },
  reorderBtnTextDisabled: { color: colors.textLight },
  toggleBtn: {
    borderRadius: borderRadius.md, paddingVertical: spacing.md,
    alignItems: 'center', marginTop: spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  toggleBtnText: { color: colors.white, fontWeight: '600', fontSize: fontSizes.sm },
  fieldLabel: {
    fontSize: fontSizes.xs, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: fontSizes.md, color: colors.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
});
