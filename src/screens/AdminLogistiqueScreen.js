import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, TextInput, Platform, Alert, useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import Button from '../components/Button';
import useDebounce from '../hooks/useDebounce';

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
    return l.nom?.toLowerCase().includes(q) || l.prenom?.toLowerCase().includes(q)
      || l.telephone?.toLowerCase().includes(q);
  });

  return (
    <View style={s.container}>
      {/* Barre du haut */}
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

      {/* Recherche */}
      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} placeholder="Rechercher un livreur..."
          placeholderTextColor={colors.textLight} value={search} onChangeText={setSearch} />
      </View>

      {/* Liste */}
      {loading ? (
        <View style={s.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.centered}>
          <Text style={s.emptyIcon}>🚚</Text>
          <Text style={s.emptyText}>{search ? 'Aucun résultat.' : 'Aucun livreur.'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          contentContainerStyle={[s.list, isDesktop && s.listDesktop]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.row, item.actif === false && s.rowInactive]}
              onPress={() => { setSelected(item); setDetailVisible(true); }}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{[item.prenom, item.nom].filter(Boolean).join(' ') || '—'}</Text>
                <Text style={s.rowMeta}>{item.telephone || '—'}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: item.actif !== false ? colors.success + '22' : colors.error + '22' }]}>
                <Text style={[s.badgeText, { color: item.actif !== false ? colors.success : colors.error }]}>
                  {item.actif !== false ? 'Actif' : 'Inactif'}
                </Text>
              </View>
              <Text style={s.arrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create Modal */}
      <CreateLivreurModal visible={createVisible} onClose={() => setCreateVisible(false)} onCreated={load} />

      {/* Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" transparent onRequestClose={() => setDetailVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, isDesktop && s.modalBoxDesktop]}>
            {selected && <LivreurDetail livreur={selected} onClose={() => { setDetailVisible(false); setSelected(null); }}
              onUpdated={(u) => { setLivreurs(prev => prev.map(l => l.id === u.id ? { ...l, ...u } : l)); setSelected(prev => prev ? { ...prev, ...u } : prev); }} />}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Create Livreur Modal ───────────────────────────────────────────────────

function CreateLivreurModal({ visible, onClose, onCreated }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [form, setForm] = useState({ nom: '', prenom: '', telephone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setForm({ nom: '', prenom: '', telephone: '' }); }, [visible]);

  const handleCreate = async () => {
    if (!form.nom.trim() && !form.prenom.trim()) { showAlert('Erreur', 'Nom ou prénom requis.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('livreurs').insert({
        nom: form.nom.trim() || null,
        prenom: form.prenom.trim() || null,
        telephone: form.telephone.trim() || null,
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
            <Field label="Téléphone" value={form.telephone} onChangeText={v => setForm(p => ({ ...p, telephone: v }))} placeholder="06 00 00 00 00" keyboardType="phone-pad" />
            <Button title="Créer le livreur" onPress={handleCreate} loading={saving} disabled={saving} fullWidth size="lg" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Livreur Detail ─────────────────────────────────────────────────────────

function LivreurDetail({ livreur, onClose, onUpdated }) {
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [toggling, setToggling] = useState(false);
  const isActif = livreur.actif !== false;

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      try {
        const [cRes, oRes] = await Promise.all([
          supabase.from('profiles').select('id, nom_societe, nom, prenom').eq('role', 'client').eq('livreur_id', livreur.id),
          supabase.from('orders').select('*, client:profiles(nom_societe, nom, prenom)')
            .eq('livreur_id', livreur.id).in('statut', ['nouvelle', 'en_preparation', 'en_livraison'])
            .order('date_commande', { ascending: false }),
        ]);
        setClients(cRes.data || []);
        setOrders(oRes.data || []);
      } catch (err) { console.error(err); }
      finally { setLoadingData(false); }
    })();
  }, [livreur.id]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const { data, error } = await supabase.from('livreurs')
        .update({ actif: !isActif }).eq('id', livreur.id).select('*').single();
      if (error) throw error;
      onUpdated(data);
      showAlert('Succès', isActif ? 'Livreur désactivé.' : 'Livreur réactivé.');
    } catch (err) {
      showAlert('Erreur', 'Impossible de modifier le statut.');
    } finally { setToggling(false); }
  };

  const displayName = [livreur.prenom, livreur.nom].filter(Boolean).join(' ') || '—';

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <View style={s.modalHeader}>
        <View>
          <Text style={s.modalHeaderTitle}>{displayName}</Text>
          <Text style={{ fontSize: fontSizes.xs, color: isActif ? colors.success : colors.error, fontWeight: '600' }}>
            {isActif ? 'Actif' : 'Inactif'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}><Text style={s.closeText}>✕</Text></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={s.sectionTitle}>Informations</Text>
        <Text style={s.infoLine}>📱 {livreur.telephone || '—'}</Text>

        <Text style={s.sectionTitle}>Clients assignés ({clients.length})</Text>
        {loadingData ? <ActivityIndicator color={colors.primary} /> :
          clients.length === 0 ? <Text style={s.emptyText}>Aucun client assigné.</Text> :
          clients.map(c => (
            <View key={c.id} style={s.clientRow}>
              <Text style={s.clientName}>{c.nom_societe || [c.prenom, c.nom].filter(Boolean).join(' ') || '—'}</Text>
            </View>
          ))
        }

        <Text style={s.sectionTitle}>Commandes en cours ({orders.length})</Text>
        {loadingData ? <ActivityIndicator color={colors.primary} /> :
          orders.length === 0 ? <Text style={s.emptyText}>Aucune commande en cours.</Text> :
          orders.map(o => (
            <View key={o.id} style={s.orderLine}>
              <Text style={s.orderNum}>N° {o.numero}</Text>
              <Text style={s.orderClient}>{o.client?.nom_societe || [o.client?.prenom, o.client?.nom].filter(Boolean).join(' ') || '—'}</Text>
              <Text style={s.orderAmount}>{Number(o.total_ht || 0).toFixed(2)} € HT</Text>
            </View>
          ))
        }

        <TouchableOpacity
          style={[s.toggleBtn, isActif ? { backgroundColor: colors.error } : { backgroundColor: colors.success }]}
          onPress={handleToggle} disabled={toggling}
        >
          {toggling ? <ActivityIndicator color={colors.white} size="small" /> :
            <Text style={s.toggleBtnText}>{isActif ? '🔒 Désactiver' : '✅ Réactiver'}</Text>}
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
  clientRow: {
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  clientName: { fontSize: fontSizes.sm, color: colors.textPrimary, fontWeight: '500' },
  orderLine: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  orderNum: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textPrimary },
  orderClient: { flex: 1, fontSize: fontSizes.xs, color: colors.textSecondary },
  orderAmount: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.primary },
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
