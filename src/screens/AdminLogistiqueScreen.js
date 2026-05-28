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
              onUpdated={(updatedLivreur) => { setLivreurs(prev => prev.map(l => l.id === updatedLivreur.id ? updatedLivreur : l)); setSelected(updatedLivreur); }}
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
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={s.rowName}>{[item.prenom, item.nom].filter(Boolean).join(' ') || '—'}</Text>
      </View>
      <View style={[s.badge, { backgroundColor: item.type_livreur === 'surgele' ? '#E3F2FD' : item.type_livreur === 'frais' ? '#E8F5E9' : '#F3E5F5' }]}>
        <Text style={[s.badgeText, { color: item.type_livreur === 'surgele' ? '#1565C0' : item.type_livreur === 'frais' ? '#2E7D32' : '#7B1FA2' }]}>
          {item.type_livreur === 'surgele' ? 'Surgelé' : item.type_livreur === 'frais' ? 'Frais' : 'Les deux'}
        </Text>
      </View>
      <Text style={s.arrow}>›</Text>
    </TouchableOpacity>
  );
});

function CreateLivreurModal({ visible, onClose, onCreated }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [form, setForm] = useState({ nom: '', prenom: '', type_livreur: 'les_deux' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setForm({ nom: '', prenom: '', type_livreur: 'les_deux' }); }, [visible]);

  const handleCreate = async () => {
    if (!form.nom.trim() && !form.prenom.trim()) { showAlert('Erreur', 'Nom ou prénom requis.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('livreurs').insert({
        nom: form.nom.trim() || null,
        prenom: form.prenom.trim() || null,
        type_livreur: form.type_livreur,
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
            
            <View>
              <Text style={s.label}>Type de livreur</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                <TouchableOpacity
                  style={[s.typeBtn, form.type_livreur === 'frais' && s.typeBtnActiveFrais]}
                  onPress={() => setForm(p => ({ ...p, type_livreur: 'frais' }))}
                >
                  <Text style={[s.typeBtnText, form.type_livreur === 'frais' && s.typeBtnTextActive]}>Frais</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeBtn, form.type_livreur === 'surgele' && s.typeBtnActiveSurgele]}
                  onPress={() => setForm(p => ({ ...p, type_livreur: 'surgele' }))}
                >
                  <Text style={[s.typeBtnText, form.type_livreur === 'surgele' && s.typeBtnTextActive]}>Surgelé</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeBtn, form.type_livreur === 'les_deux' && s.typeBtnActiveDeux]}
                  onPress={() => setForm(p => ({ ...p, type_livreur: 'les_deux' }))}
                >
                  <Text style={[s.typeBtnText, form.type_livreur === 'les_deux' && s.typeBtnTextActive]}>Les deux</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Button title="Créer le livreur" onPress={handleCreate} loading={saving} disabled={saving} fullWidth size="lg" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LivreurDetail({ livreur, onClose, onDeleted, onUpdated }) {
  const [clients, setClients] = useState([]);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersOrderMap, setOrdersOrderMap] = useState({});
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printedDates, setPrintedDates] = useState({});
  const [selectedSurgele, setSelectedSurgele] = useState({});
  
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    nom: livreur.nom || '',
    prenom: livreur.prenom || '',
    type_livreur: livreur.type_livreur || 'les_deux',
    actif: livreur.actif !== false,
  });

  const getWeekBoundaries = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return { monIso: dateStr, sunIso: dateStr, monDisp: dateStr, sunDisp: dateStr };
    const day = d.getDay();
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      monIso: monday.toISOString().split('T')[0],
      sunIso: sunday.toISOString().split('T')[0],
      monDisp: monday.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}),
      sunDisp: sunday.toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'})
    };
  };

  const getGroupOrdersSorted = (groupKey, allOrders) => {
    let groupOrders;
    if (groupKey.endsWith('_surgele')) {
      const [monIso, sunIso] = groupKey.split('_');
      groupOrders = allOrders.filter(o => {
        if (o.type_commande !== 'surgele') return false;
        const w = getWeekBoundaries((o.date_commande || '').split('T')[0]);
        return w.monIso === monIso && w.sunIso === sunIso;
      });
    } else {
      const [isoDate, typeCmd] = groupKey.split('_');
      groupOrders = allOrders.filter(o => 
        (o.date_commande || '').split('T')[0] === isoDate && 
        (o.type_commande === 'surgele' ? 'surgele' : 'frais') === typeCmd
      );
    }
    const orderIds = ordersOrderMap[groupKey];
    if (!orderIds) return groupOrders;
    return [...groupOrders].sort((a, b) => {
      const ia = orderIds.indexOf(a.id);
      const ib = orderIds.indexOf(b.id);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };

  const moveOrder = (groupKey, fromIdx, toIdx) => {
    setOrdersOrderMap(prev => {
      const current = getGroupOrdersSorted(groupKey, orders).map(o => o.id);
      const next = [...current];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...prev, [groupKey]: next };
    });
  };

  const moveClient = async (fromIdx, toIdx) => {
    const nextClients = [...clients];
    const [moved] = nextClients.splice(fromIdx, 1);
    nextClients.splice(toIdx, 0, moved);
    setClients(nextClients);

    try {
      const updates = nextClients.map((c, idx) => ({
        id: c.id,
        ordre_tournee: idx,
      }));
      for (const update of updates) {
        await supabase.from('profiles').update({ ordre_tournee: update.ordre_tournee }).eq('id', update.id);
      }
    } catch (err) {
      showAlert('Erreur', 'Impossible de sauvegarder le nouvel ordre des clients.');
    }
  };

  const handleToggleClients = async () => {
    const next = !clientsOpen;
    setClientsOpen(next);
    if (next && !clientsLoaded) {
      setLoadingClients(true);
      try {
        const { data } = await supabase
          .from('profiles').select('id, nom_societe, nom, prenom, ordre_tournee, livreur_id, livreur_surgele_id')
          .eq('role', 'client')
          .or(`livreur_id.eq.${livreur.id},livreur_surgele_id.eq.${livreur.id}`)
          .order('ordre_tournee', { ascending: true })
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
          .from('orders').select('*, client:profiles(nom_societe, nom, prenom, telephone, ordre_tournee), order_items(*)')
          .eq('livreur_id', livreur.id).in('statut', ['nouvelle'])
          .order('numero', { ascending: true });
        const fetched = data || [];
        
        fetched.sort((a, b) => {
          const ordreA = a.client?.ordre_tournee || 0;
          const ordreB = b.client?.ordre_tournee || 0;
          if (ordreA !== ordreB) return ordreA - ordreB;
          return a.numero.localeCompare(b.numero);
        });

        setOrders(fetched);
        const newOrderMap = {};
        const groupsSet = new Set();
        fetched.forEach(o => {
          if (o.type_commande === 'surgele') {
            const w = getWeekBoundaries((o.date_commande || '').split('T')[0]);
            groupsSet.add(`${w.monIso}_${w.sunIso}_surgele`);
          } else {
            groupsSet.add(`${(o.date_commande || '').split('T')[0]}_frais`);
          }
        });
        const groups = [...groupsSet];
        groups.forEach(groupKey => {
          if (groupKey.endsWith('_surgele')) {
            const [monIso, sunIso] = groupKey.split('_');
            newOrderMap[groupKey] = fetched.filter(o => {
              if (o.type_commande !== 'surgele') return false;
              const w = getWeekBoundaries((o.date_commande || '').split('T')[0]);
              return w.monIso === monIso && w.sunIso === sunIso;
            }).map(o => o.id);
          } else {
            const [isoDate] = groupKey.split('_');
            newOrderMap[groupKey] = fetched
              .filter(o => o.type_commande !== 'surgele' && (o.date_commande || '').split('T')[0] === isoDate)
              .map(o => o.id);
          }
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

  const handleSaveEdit = async () => {
    if (!editForm.nom.trim() && !editForm.prenom.trim()) { showAlert('Erreur', 'Nom ou prénom requis.'); return; }
    setSavingEdit(true);
    try {
      const { data, error } = await supabase.from('livreurs')
        .update({
          nom: editForm.nom.trim() || null,
          prenom: editForm.prenom.trim() || null,
          type_livreur: editForm.type_livreur,
        })
        .eq('id', livreur.id)
        .select('*')
        .single();
      if (error) throw error;
      onUpdated?.(data);
      setIsEditing(false);
      showAlert('Succès', 'Livreur mis à jour.');
    } catch (err) {
      showAlert('Erreur', err.message || 'Impossible de mettre à jour le livreur.');
    } finally { setSavingEdit(false); }
  };

  const displayName = [livreur.prenom, livreur.nom].filter(Boolean).join(' ') || '—';

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <View style={s.modalHeader}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={s.modalHeaderTitle}>{displayName}</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)} style={{ padding: 4, backgroundColor: isEditing ? colors.primary : colors.surface, borderRadius: 4, borderWidth: 1, borderColor: colors.primary }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: isEditing ? colors.white : colors.primary }}>ÉDITER</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onClose}><Text style={s.closeText}>✕</Text></TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>

        {isEditing && (
          <View style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: 8, borderWidth: 1, borderColor: colors.border, gap: spacing.sm, marginBottom: spacing.sm }}>
            <Text style={s.sectionTitle}>Modifier les informations</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}><Field label="Prénom" value={editForm.prenom} onChangeText={v => setEditForm(p => ({ ...p, prenom: v }))} /></View>
              <View style={{ flex: 1 }}><Field label="Nom" value={editForm.nom} onChangeText={v => setEditForm(p => ({ ...p, nom: v }))} /></View>
            </View>
            <View>
              <Text style={s.label}>Type de livreur</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                <TouchableOpacity
                  style={[s.typeBtn, editForm.type_livreur === 'frais' && s.typeBtnActiveFrais]}
                  onPress={() => setEditForm(p => ({ ...p, type_livreur: 'frais' }))}
                >
                  <Text style={[s.typeBtnText, editForm.type_livreur === 'frais' && s.typeBtnTextActive]}>Frais</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeBtn, editForm.type_livreur === 'surgele' && s.typeBtnActiveSurgele]}
                  onPress={() => setEditForm(p => ({ ...p, type_livreur: 'surgele' }))}
                >
                  <Text style={[s.typeBtnText, editForm.type_livreur === 'surgele' && s.typeBtnTextActive]}>Surgelé</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.typeBtn, editForm.type_livreur === 'les_deux' && s.typeBtnActiveDeux]}
                  onPress={() => setEditForm(p => ({ ...p, type_livreur: 'les_deux' }))}
                >
                  <Text style={[s.typeBtnText, editForm.type_livreur === 'les_deux' && s.typeBtnTextActive]}>Les deux</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Button title="Enregistrer" onPress={handleSaveEdit} loading={savingEdit} disabled={savingEdit} style={{ marginTop: spacing.md }} />
          </View>
        )}

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
              : clients.map((c, idx) => {
                const isFrais = c.livreur_id === livreur.id;
                const isSurgele = c.livreur_surgele_id === livreur.id;
                const typeLabel = isFrais && isSurgele ? 'Frais + Surgelé' : isSurgele ? 'Surgelé' : 'Frais';
                const typeBgColor = isFrais && isSurgele ? '#7B1FA2' : isSurgele ? '#1565C0' : '#2E7D32';
                return (
                <View key={c.id} style={s.orderLine}>
                  <View style={[s.tourBadge, { backgroundColor: idx === 0 ? colors.primary : idx === clients.length - 1 ? '#888' : colors.secondary }]}>
                    <Text style={[s.tourBadgeText, { color: idx === 0 ? '#fff' : idx === clients.length - 1 ? '#fff' : colors.primary }]}>
                      {idx + 1}
                    </Text>
                  </View>
                  
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.orderNum} numberOfLines={1}>{c.nom_societe || [c.prenom, c.nom].filter(Boolean).join(' ') || '—'}</Text>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ backgroundColor: typeBgColor + '22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: typeBgColor }}>{typeLabel}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={s.reorderBtns}>
                    <TouchableOpacity
                      style={[s.reorderBtn, idx === 0 && s.reorderBtnDisabled]}
                      onPress={() => moveClient(idx, idx - 1)}
                      disabled={idx === 0}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.reorderBtnText, idx === 0 && s.reorderBtnTextDisabled]}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.reorderBtn, idx === clients.length - 1 && s.reorderBtnDisabled]}
                      onPress={() => moveClient(idx, idx + 1)}
                      disabled={idx === clients.length - 1}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.reorderBtnText, idx === clients.length - 1 && s.reorderBtnTextDisabled]}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                );
              })
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
              : [...new Set(orders.map(o => {
                  if (o.type_commande === 'surgele') {
                    const w = getWeekBoundaries((o.date_commande || '').split('T')[0]);
                    return `${w.monIso}_${w.sunIso}_surgele`;
                  }
                  return `${(o.date_commande || '').split('T')[0]}_frais`;
                }))]
                  .sort((a, b) => {
                    const isSurgeleA = a.endsWith('_surgele');
                    const isSurgeleB = b.endsWith('_surgele');
                    if (isSurgeleA && !isSurgeleB) return -1;
                    if (!isSurgeleA && isSurgeleB) return 1;
                    const dateA = a.split('_')[0];
                    const dateB = b.split('_')[0];
                    return dateB.localeCompare(dateA);
                  })
                  .map(groupKey => {
                    const isReservoir = groupKey.endsWith('_surgele');
                    const [iso1, iso2, typeCmd] = groupKey.split('_');
                    const dayOrders = getGroupOrdersSorted(groupKey, orders);
                    
                    let dateStr = '';
                    if (isReservoir) {
                      const w = getWeekBoundaries(iso1);
                      dateStr = `Semaine du ${w.monDisp} au ${w.sunDisp}`;
                    } else {
                      const dateObj = new Date(iso1);
                      dateStr = isNaN(dateObj) ? iso1 : dateObj.toLocaleDateString('fr-FR');
                    }

                    const isPrinted = !!printedDates[groupKey];
                    const labelType = isReservoir ? 'SURGELÉS (RÉSERVOIR)' : 'FRAIS';
                    const colorType = isReservoir ? '#1565C0' : '#2E7D32';

                    const ordersToProcess = isReservoir ? dayOrders.filter(o => selectedSurgele[o.id]) : dayOrders;
                    const hasSelection = isReservoir ? ordersToProcess.length > 0 : true;

                    return (
                      <View key={groupKey} style={{ marginBottom: spacing.md, backgroundColor: typeCmd === 'surgele' ? '#F5FAFF' : '#F9FBF9', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: typeCmd === 'surgele' ? '#E3F2FD' : '#E8F5E9' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: typeCmd === 'surgele' ? '#BBDEFB' : '#C8E6C9', marginBottom: spacing.xs }}>
                          <View style={{ flex: 1, marginRight: spacing.sm }}>
                            <Text style={{ fontSize: fontSizes.sm, fontWeight: '700', color: colorType }}>
                              {isReservoir ? `RÉSERVOIR SURGELÉS (${dateStr}) - ${dayOrders.length} cmd.` : `Tournée FRAIS du ${dateStr}`}
                            </Text>
                            <Text style={{ fontSize: fontSizes.xs, color: isPrinted ? colors.success : colors.error, fontWeight: '600', marginTop: 2 }}>
                              {isPrinted ? '✓ Tournée sélectionnée imprimée' : 'Tournée NON imprimée'}
                            </Text>
                            {isReservoir && (
                              <View style={{ flexDirection: 'row', marginTop: spacing.sm }}>
                                <TouchableOpacity onPress={() => {
                                  const allSelected = dayOrders.every(o => selectedSurgele[o.id]);
                                  const newSel = { ...selectedSurgele };
                                  dayOrders.forEach(o => { newSel[o.id] = !allSelected; });
                                  setSelectedSurgele(newSel);
                                  setPrintedDates(prev => ({...prev, [groupKey]: false}));
                                }}>
                                  <Text style={{ fontSize: 12, color: colorType, textDecorationLine: 'underline' }}>
                                    {dayOrders.every(o => selectedSurgele[o.id]) ? 'Tout décocher' : 'Tout cocher'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <TouchableOpacity
                              onPress={async () => {
                                if (!hasSelection) {
                                  showAlert('Attention', 'Veuillez sélectionner au moins une commande.');
                                  return;
                                }
                                setPrinting(true);
                                try {
                                  const titleDate = isReservoir ? '' : dateStr;
                                  const titleLabel = isReservoir ? 'SURGELÉS (Sélection)' : labelType;
                                  await generateDriverTourPdf(livreur, ordersToProcess, titleDate, titleLabel);
                                  setPrintedDates(prev => ({ ...prev, [groupKey]: true }));
                                  if (Platform.OS === 'web') {
                                    if (window.confirm(`La tournée a été générée. Voulez-vous retirer ces ${ordersToProcess.length} commandes de la liste ?`)) {
                                      archiverCommandes(ordersToProcess);
                                    }
                                  } else {
                                    Alert.alert('Traitement', `La tournée a été générée. Voulez-vous retirer ces ${ordersToProcess.length} commandes de la liste ?`, [
                                      { text: 'Non', style: 'cancel' },
                                      { text: 'Oui', onPress: () => archiverCommandes(ordersToProcess) },
                                    ]);
                                  }
                                } catch (e) { showAlert('Erreur', 'Impossible de générer le PDF.'); }
                                finally { setPrinting(false); }
                              }}
                              style={{ backgroundColor: colorType, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, ...Platform.select({ web: { cursor: 'pointer' } }) }}
                              disabled={printing}
                            >
                              {printing
                                ? <ActivityIndicator color={colors.white} size="small" />
                                : <Text style={{ color: colors.white, fontSize: 12, fontWeight: 'bold' }}>Imprimer la tournée</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => {
                                if (!hasSelection) {
                                  showAlert('Attention', 'Veuillez sélectionner au moins une commande.');
                                  return;
                                }
                                const confirmText = isPrinted
                                  ? `Cette sélection a bien été imprimée.\n\nVoulez-vous valider et retirer ces ${ordersToProcess.length} commandes de la liste (le statut passera à "Livré") ?`
                                  : `ATTENTION : La sélection N'A PAS ENCORE ÉTÉ IMPRIMÉE !\n\nSi vous la retirez par inadvertance, ces commandes passeront au statut "Livré" et il sera très difficile de les retrouver.\n\nVoulez-vous vraiment valider et retirer ces ${ordersToProcess.length} commandes ?`;
                                
                                if (Platform.OS === 'web') {
                                  if (window.confirm(confirmText)) archiverCommandes(ordersToProcess);
                                } else {
                                  Alert.alert(
                                    isPrinted ? 'Confirmation' : 'AVERTISSEMENT CRITIQUE',
                                    confirmText,
                                    [
                                      { text: 'Annuler', style: 'cancel' },
                                      { text: isPrinted ? 'Valider et retirer' : 'Retirer quand même (Erreur)', style: 'destructive', onPress: () => archiverCommandes(ordersToProcess) },
                                    ]
                                  );
                                }
                              }}
                              style={{ backgroundColor: colors.error, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, ...Platform.select({ web: { cursor: 'pointer' } }) }}
                              disabled={printing}
                            >
                              <Text style={{ color: colors.white, fontSize: 12, fontWeight: 'bold' }}>Retirer/Valider</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {dayOrders.map((o, idx) => {
                          const isSelected = !!selectedSurgele[o.id];
                          const opacity = (isReservoir && !isSelected) ? 0.6 : 1;
                          return (
                          <View key={o.id} style={[s.orderLine, { borderBottomColor: 'transparent', opacity }]}>
                            {isReservoir && (
                              <TouchableOpacity 
                                style={[s.checkbox, isSelected && s.checkboxChecked]}
                                onPress={() => {
                                  setSelectedSurgele(prev => ({...prev, [o.id]: !prev[o.id]}));
                                  setPrintedDates(prev => ({...prev, [groupKey]: false}));
                                }}
                              >
                                {isSelected && <View style={s.checkboxInner} />}
                              </TouchableOpacity>
                            )}
                            {/* Badge de position dans la tournée */}
                            <View style={[s.tourBadge, { backgroundColor: idx === 0 ? colorType : idx === dayOrders.length - 1 ? '#888' : colorType + '80' }]}>
                              <Text style={[s.tourBadgeText, { color: '#fff' }]}>
                                {idx + 1}
                              </Text>
                            </View>

                            {/* Infos commande */}
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={s.orderNum}>N° {o.numero}</Text>
                              <Text style={s.orderClient} numberOfLines={1}>
                                {o.client?.nom_societe || [o.client?.prenom, o.client?.nom].filter(Boolean).join(' ') || '—'}
                              </Text>
                              <Text style={{ fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' }}>
                                Prise le {new Date(o.created_at || o.date_commande).toLocaleDateString('fr-FR')}
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
                                onPress={() => moveOrder(groupKey, idx, idx - 1)}
                                disabled={idx === 0}
                                activeOpacity={0.7}
                              >
                                <Text style={[s.reorderBtnText, idx === 0 && s.reorderBtnTextDisabled]}>▲</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[s.reorderBtn, idx === dayOrders.length - 1 && s.reorderBtnDisabled]}
                                onPress={() => moveOrder(groupKey, idx, idx + 1)}
                                disabled={idx === dayOrders.length - 1}
                                activeOpacity={0.7}
                              >
                                <Text style={[s.reorderBtnText, idx === dayOrders.length - 1 && s.reorderBtnTextDisabled]}>▼</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          );
                        })}
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
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.round, width: 80, alignItems: 'center' },
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
  tourBadge: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  tourBadgeText: { fontSize: fontSizes.xs, fontWeight: '800' },
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
  typeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  typeBtnText: { fontSize: fontSizes.xs, fontWeight: '600', color: colors.textSecondary },
  typeBtnActiveFrais: { backgroundColor: '#E8F5E9', borderColor: '#2E7D32' },
  typeBtnActiveSurgele: { backgroundColor: '#E3F2FD', borderColor: '#1565C0' },
  typeBtnActiveDeux: { backgroundColor: '#F3E5F5', borderColor: '#7B1FA2' },
  typeBtnTextActive: { color: '#000' },
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
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
    marginRight: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  checkboxChecked: { backgroundColor: colors.primary },
  checkboxInner: { width: 10, height: 10, borderRadius: 2, backgroundColor: colors.white },
});
