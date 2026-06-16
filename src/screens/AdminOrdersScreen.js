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
import { exportOrdersExcel } from '../utils/exportExcel';
const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '"”';
const n2 = (v) => Number(v ?? 0).toFixed(2);

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

const PAGE_SIZE = 30;
export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedOrder, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [takeOrderVisible, setTakeOrderVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const loadOrders = useCallback(async (reset = true, currentLength = 0) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const from = reset ? 0 : currentLength;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('orders')
        .select(`
          id, numero, client_id, client_nom, statut, date_commande,
          total_ht, total_tva, total_ttc, livreur_id, notes_client, notes_admin,
          adresse_livraison, type_commande,
          client:profiles!client_id(
            id, nom, prenom, nom_societe, email, telephone
          )
        `, { count: 'exact' })
        .order('date_commande', { ascending: false })
        .range(from, to);

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
  }, []);
  useEffect(() => { loadOrders(true); }, []);

  const hasMore = orders.length < totalCount;

  const openOrder = useCallback((order) => {
    setSelected(order);
    setModalVisible(true);
  }, []);

  const closeModal = () => {
    setModalVisible(false);
    setSelected(null);
  };

  const handleOrderUpdated = (updated) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    setSelected((prev) => prev ? { ...prev, ...updated } : prev);
  };

  const handleRefresh = () => { loadOrders(true); };

  const toggleSelection = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = async () => {
    if (selectedIds.size === totalCount) {
      setSelectedIds(new Set());
      return;
    }
    setSelectingAll(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('id');
      if (data) setSelectedIds(new Set(data.map((o) => o.id)));
    } catch (err) {
      console.error('Erreur sélection totale :', err);
    } finally {
      setSelectingAll(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);

    setBulkActionLoading(true);
    try {
      const { data: nonTraite } = await supabase
        .from('orders')
        .select('numero, livreur_id, livreur:livreurs(nom, prenom)')
        .in('id', ids)
        .neq('statut', 'traite');

      let msg = `Vous allez supprimer définitivement ${ids.length} commande(s).\nCette action est irréversible et les données seront perdues, faites un export au préalable si vous souhaitez garder ces données.`;

      if (nonTraite?.length > 0) {
        const list = nonTraite.map((o) => {
          const livreurName = o.livreur
            ? `tournée de ${[o.livreur.prenom, o.livreur.nom].filter(Boolean).join(' ')}`
            : 'non assignée à un livreur';
          return `"¢ NÂ° ${o.numero} (${livreurName})`;
        }).join('\n');
        msg += `\n\nATTENTION : ${nonTraite.length} commande(s) pas encore traitée(s) :\n${list}\n\nSupprimez quand même ?`;
      }

      const confirmed = await new Promise((resolve) => {
        if (Platform.OS === 'web') {
          resolve(window.confirm(msg));
        } else {
          Alert.alert('Supprimer définitivement', msg, [
            { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) },
          ]);
        }
      });

      if (!confirmed) return;
      const { error: itemsErr } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', ids);
      if (itemsErr) throw itemsErr;
      const { error: ordersErr } = await supabase
        .from('orders')
        .delete()
        .in('id', ids);
      if (ordersErr) throw ordersErr;

      setSelectedIds(new Set());
      loadOrders(true);
    } catch (err) {
      console.error(err);
      showAlert('Erreur', 'Impossible de supprimer les commandes.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkExportExcel = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      await exportOrdersExcel(Array.from(selectedIds));
    } catch (err) {
      console.error(err);
      showAlert('Erreur', "Impossible d'exporter les commandes.");
    } finally {
      setBulkActionLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      {/* â”€â”€ Barre du haut â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.screenTitle}>Commandes</Text>
          <Text style={styles.screenCount}>{`${orders.length} / ${totalCount}`}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => setTakeOrderVisible(true)}
            style={styles.takeOrderBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.takeOrderBtnText}>+ Prendre commande</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
            <Text style={styles.refreshText}>â†» Actualiser</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* â”€â”€ Barre d'actions en masse â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {selectedIds.size > 0 && (
        <View style={styles.bulkActionBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <TouchableOpacity onPress={selectAll} style={styles.selectAllBtn} disabled={selectingAll}>
              <Text style={styles.selectAllBtnText}>
                {selectingAll ? 'Chargement...' : selectedIds.size === totalCount ? 'Tout désélectionner' : `Tout sélectionner (${totalCount})`}
              </Text>
            </TouchableOpacity>
            <Text style={styles.bulkActionText}>{selectedIds.size} sélectionnée(s)</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Exporter Excel"
              variant="secondary"
              size="sm"
              onPress={handleBulkExportExcel}
              loading={bulkActionLoading}
              disabled={bulkActionLoading}
            />
            <Button
              title="Supprimer définitivement"
              variant="danger"
              size="sm"
              onPress={handleBulkDelete}
              loading={bulkActionLoading}
              disabled={bulkActionLoading}
            />
          </View>
        </View>
      )}

      {/*  Liste des commandes */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
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
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android' || Platform.OS === 'web'}
          renderItem={({ item }) => (
            <OrderRow
              item={item}
              onPress={openOrder}
              isDesktop={isDesktop}
              selected={selectedIds.has(item.id)}
              onToggle={() => toggleSelection(item.id)}
            />
          )}
          ListFooterComponent={hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => loadOrders(false, orders.length)}
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

      {/* â”€â”€ Modal détail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

      {/* â”€â”€ Modal prise de commande admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <TakeOrderModal
        visible={takeOrderVisible}
        onClose={() => setTakeOrderVisible(false)}
        onOrderCreated={() => loadOrders(true)}
      />
    </View>
  );
}
const OrderRow = React.memo(({ item, onPress, isDesktop, selected, onToggle }) => {
  const clientName = item.client?.nom_societe
    || [item.client?.prenom, item.client?.nom].filter(Boolean).join(' ')
    || item.client_nom
    || '"” Client supprimé "”';

  const orderDate = new Date(item.date_commande);
  const diffDays = Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, 45 - diffDays);
  const warningColor = daysLeft <= 7 ? colors.error : colors.textLight;
  const noLivreur = !item.livreur_id;

  return (
    <View style={styles.rowWrapper}>
      <TouchableOpacity onPress={onToggle} style={styles.checkboxContainer}>
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.row, { flex: 1, marginLeft: 0 }, noLivreur && { borderColor: colors.error, borderWidth: 1.5 }]}
        onPress={() => onPress(item)}
        activeOpacity={0.75}
      >
        <View style={styles.rowCol}>
          <Text style={styles.rowNum}>{`NÂ° ${item.numero}`}</Text>
          <Text style={styles.rowDate}>{fmt(item.date_commande)}</Text>
          {item.type_commande === 'surgele' ? (
            <View style={{ backgroundColor: '#E3F2FD', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
              <Text style={{ color: '#1565C0', fontSize: 10, fontWeight: '700' }}>Surgelé</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#E8F5E9', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 }}>
              <Text style={{ color: '#2E7D32', fontSize: 10, fontWeight: '700' }}>Frais</Text>
            </View>
          )}
          {noLivreur && (
            <View style={{ backgroundColor: colors.error + '22', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, alignSelf: 'flex-start', marginTop: 3 }}>
              <Text style={{ color: colors.error, fontSize: 10, fontWeight: '700' }}>Sans livreur</Text>
            </View>
          )}
          <Text style={[styles.rowDeleteWarning, { color: warningColor }]}>
            Suppression dans {daysLeft} j
          </Text>
        </View>

        <View style={[styles.rowCol, styles.rowColFlex]}>
          <Text style={styles.rowClient} numberOfLines={1}>{clientName}</Text>
          {item.client?.email ? (
            <Text style={styles.rowEmail} numberOfLines={1}>{item.client.email}</Text>
          ) : null}
        </View>



        <View style={[styles.rowCol, styles.rowColRight]}>
          <Text style={styles.rowTotal}>{`${n2(item.total_ht)} â‚¬`}</Text>
          <Text style={styles.rowTotalLabel}>HT</Text>
        </View>



        <Text style={styles.arrow}>"º</Text>
      </TouchableOpacity>
    </View>
  );
});

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
  const [editingQty, setEditingQty] = useState(false);
  const [draftQty, setDraftQty] = useState({});
  const [savingItems, setSavingItems] = useState(false);
  const [localTotalHt, setLocalTotalHt] = useState(Number(order.total_ht || 0));
  // Surgelé : date de livraison assignée par l'admin
  const [dateLivraisonAdmin, setDateLivraisonAdmin] = useState(
    order.date_livraison_souhaitee
      ? new Date(order.date_livraison_souhaitee).toISOString().split('T')[0]
      : ''
  );
  const [savingSurgele, setSavingSurgele] = useState(false);

  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 900;

  useEffect(() => {
    (async () => {
      setLoadingItems(true);
      try {
        const [itemsRes, livRes] = await Promise.all([
          supabase.from('order_items').select('*').eq('order_id', order.id)
            .order('created_at', { ascending: true }),
          supabase.from('livreurs').select('id, nom, prenom, type_livreur').eq('actif', true),
        ]);
        if (itemsRes.error) throw itemsRes.error;
        const fetched = itemsRes.data || [];
        setItems(fetched);
        setLivreurs(livRes.data || []);
        const clientData = order.client || {
          nom_societe: order.client_nom || 'Client inconnu',
          telephone: order.adresse_livraison?.match(/Tél\s*:\s*(.+)/)?.[1]?.trim() || ''
        };
        setPreviewHtml(buildOrderHtml(order, fetched, clientData));
      } catch (err) {
        console.error('Erreur chargement items :', err);
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [order.id]);
  const startEditQty = () => {
    const init = {};
    items.forEach(it => { init[it.id] = it.quantite; });
    setDraftQty(init);
    setEditingQty(true);
  };

  const cancelEditQty = () => {
    setDraftQty({});
    setEditingQty(false);
  };

  const changeQty = (itemId, delta) => {
    setDraftQty(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] ?? 0) + delta),
    }));
  };

  const setQtyDirect = (itemId, value) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setDraftQty(prev => ({ ...prev, [itemId]: parsed }));
    }
  };
  const handleSaveItems = async () => {
    const remaining = items.filter(it => (draftQty[it.id] ?? it.quantite) > 0);
    if (remaining.length === 0) {
      showAlert('Erreur', 'La commande doit contenir au moins un article.');
      return;
    }

    const toDelete = items.filter(it => (draftQty[it.id] ?? it.quantite) === 0);
    const toUpdate = items.filter(it => {
      const newQty = draftQty[it.id] ?? it.quantite;
      return newQty > 0 && newQty !== it.quantite;
    });

    if (toDelete.length === 0 && toUpdate.length === 0) {
      setEditingQty(false);
      return;
    }

    setSavingItems(true);
    try {
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('order_items')
          .delete()
          .in('id', toDelete.map(it => it.id));
        if (delErr) throw delErr;
      }
      for (const it of toUpdate) {
        const newQty = draftQty[it.id];
        const newSousTotal = Number((newQty * Number(it.prix_unitaire_ht)).toFixed(2));
        const { error: updErr } = await supabase
          .from('order_items')
          .update({ quantite: newQty, sous_total_ht: newSousTotal })
          .eq('id', it.id);
        if (updErr) throw updErr;
      }
      const updatedItems = items
        .filter(it => (draftQty[it.id] ?? it.quantite) > 0)
        .map(it => ({
          ...it,
          quantite: draftQty[it.id] ?? it.quantite,
          sous_total_ht: Number(((draftQty[it.id] ?? it.quantite) * Number(it.prix_unitaire_ht)).toFixed(2)),
        }));

      const newTotalHt = updatedItems.reduce((sum, it) => sum + it.sous_total_ht, 0);
      const newTotalHtRounded = Number(newTotalHt.toFixed(2));

      const { data: updatedOrder, error: orderErr } = await supabase
        .from('orders')
        .update({ total_ht: newTotalHtRounded })
        .eq('id', order.id)
        .select('*')
        .single();
      if (orderErr) throw orderErr;
      setItems(updatedItems);
      setLocalTotalHt(newTotalHtRounded);
      onUpdated({ ...updatedOrder });
      const clientData = order.client || {
        nom_societe: order.client_nom || 'Client inconnu',
        telephone: order.adresse_livraison?.match(/Tél\s*:\s*(.+)/)?.[1]?.trim() || ''
      };
      setPreviewHtml(buildOrderHtml({ ...order, total_ht: newTotalHtRounded }, updatedItems, clientData));

      setEditingQty(false);
      setDraftQty({});
      showAlert('Succès', 'Les quantités ont été mises à jour.');
    } catch (err) {
      console.error('Erreur mise à jour quantités :', err);
      showAlert('Erreur', 'Impossible de modifier les quantités.');
    } finally {
      setSavingItems(false);
    }
  };

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

  // Actions spécifiques commandes surgelées
  const handleValiderSurgele = async () => {
    if (order.statut !== 'nouvelle') return;
    setSavingSurgele(true);
    try {
      const updateData = { statut: 'en_preparation' };
      if (dateLivraisonAdmin) updateData.date_livraison_souhaitee = dateLivraisonAdmin;
      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      setStatut('en_preparation');
      onUpdated(data);
      showAlert('Succès', 'Commande passée en préparation.');
    } catch (err) {
      console.error('Erreur validation surgelé :', err);
      showAlert('Erreur', 'Impossible de valider la commande.');
    } finally {
      setSavingSurgele(false);
    }
  };

  const handleAssignerDateSurgele = async () => {
    if (!dateLivraisonAdmin) {
      showAlert('Erreur', 'Veuillez saisir une date de livraison.');
      return;
    }
    setSavingSurgele(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ date_livraison_souhaitee: dateLivraisonAdmin })
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      onUpdated(data);
      showAlert('Succès', 'Date de livraison enregistrée.');
    } catch (err) {
      console.error('Erreur assignation date surgelé :', err);
      showAlert('Erreur', 'Impossible d\'enregistrer la date.');
    } finally {
      setSavingSurgele(false);
    }
  };

  const handleLivrerSurgele = async () => {
    setSavingSurgele(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .update({ statut: 'livree' })
        .eq('id', order.id)
        .select('*')
        .single();
      if (error) throw error;
      setStatut('livree');
      onUpdated(data);
      showAlert('Succès', 'Commande marquée comme livrée.');
    } catch (err) {
      console.error('Erreur livraison surgelé :', err);
      showAlert('Erreur', 'Impossible de marquer la commande comme livrée.');
    } finally {
      setSavingSurgele(false);
    }
  };

  const handlePdf = async () => {
    const clientData = order.client || {
      nom_societe: order.client_nom || 'Client inconnu',
      telephone: order.adresse_livraison?.match(/Tél\s*:\s*(.+)/)?.[1]?.trim() || ''
    };

    setPdfLoading(true);
    try {
      await generateOrderPdf(order, items, clientData);
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
    || '"” Client supprimé "”';
  const telephone = order.client?.telephone
    || (order.adresse_livraison?.match(/Tél\s*:\s*(.+)/)?.[1]?.trim())
    || '"”';

  const changed = statut !== order.statut || notesAdmin !== (order.notes_admin || '') || selectedLivreur !== (order.livreur_id || null);
  const bodyHeight = Math.min(height * 0.88, 820) - 64;

  return (
    <View style={modal.container}>

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View style={modal.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={modal.headerNum}>{`NÂ° ${order.numero}`}</Text>
            {order.type_commande === 'surgele' ? (
              <View style={{ backgroundColor: '#E3F2FD', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 }}>
                <Text style={{ color: '#1565C0', fontSize: 10, fontWeight: '700' }}>Surgelé</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#E8F5E9', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 }}>
                <Text style={{ color: '#2E7D32', fontSize: 10, fontWeight: '700' }}>Frais</Text>
              </View>
            )}
          </View>
          <Text style={modal.headerDate}>Passée le {fmt(order.date_commande)}</Text>
        </View>
        <View style={modal.headerRight}>
          <Button
            title="Imprimer PDF"
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

      {/* â”€â”€ Body : 2 colonnes sur desktop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View style={[modal.body, isDesktop && { flexDirection: 'row', height: bodyHeight }]}>

        {/* â”€â”€ Colonne gauche : infos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <ScrollView
          style={[modal.leftCol, isDesktop && modal.leftColDesktop]}
          contentContainerStyle={modal.leftColContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Client */}
          <View style={modal.section}>
            <Text style={modal.sectionTitle}>Client</Text>
            <View style={modal.infoGrid}>
              <InfoItem label="Société" value={order.client?.nom_societe || '"”'} />
              <InfoItem label="Contact" value={clientName} />
              <InfoItem label="Email" value={order.client?.email || '"”'} />
              <InfoItem label="Téléphone" value={telephone} />
              {order.date_livraison_souhaitee ? (
                <InfoItem label="Date livraison souhaitée" value={fmt(order.date_livraison_souhaitee)} />
              ) : null}
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
            <Text style={[modal.sectionTitle, { marginTop: spacing.md }]}>
              Livreur assigné ({order.type_commande === 'surgele' ? 'Surgelé' : 'Frais'})
            </Text>
            {!selectedLivreur && (
              <View style={{ backgroundColor: colors.error + '18', borderWidth: 1, borderColor: colors.error + '55', borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ flex: 1, fontSize: 12, color: colors.error, fontWeight: '600' }}>
                  Aucun livreur assigné "” cette commande n'apparaît chez aucun livreur en logistique. Sélectionnez un livreur ci-dessous et sauvegardez.
                </Text>
              </View>
            )}
            <View style={modal.statutRow}>
              <TouchableOpacity
                style={[modal.statutChip, !selectedLivreur && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setSelectedLivreur(null)}
              >
                <Text style={[modal.statutChipText, !selectedLivreur && modal.statutChipTextActive]}>Aucun</Text>
              </TouchableOpacity>
              {livreurs
                .filter(l => 
                  l.type_livreur === 'les_deux' || 
                  l.type_livreur === (order.type_commande === 'surgele' ? 'surgele' : 'frais')
                )
                .map(l => {
                const isDefault = order.type_commande === 'surgele' ? l.id === order.client?.livreur_surgele_id : l.id === order.client?.livreur_id;
                return (
                  <TouchableOpacity
                    key={l.id}
                    style={[
                      modal.statutChip,
                      selectedLivreur === l.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                      isDefault && selectedLivreur !== l.id && { borderColor: order.type_commande === 'surgele' ? '#1565C0' : '#2E7D32', borderWidth: 2 }
                    ]}
                    onPress={() => setSelectedLivreur(l.id)}
                  >
                    <Text style={[
                      modal.statutChipText,
                      selectedLivreur === l.id && modal.statutChipTextActive,
                      isDefault && selectedLivreur !== l.id && { color: order.type_commande === 'surgele' ? '#1565C0' : '#2E7D32', fontWeight: 'bold' }
                    ]}>
                      {[l.prenom, l.nom].filter(Boolean).join(' ') || 'Livreur'}
                      {isDefault ? ' (Défaut)' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Produits */}
          <View style={modal.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={[modal.sectionTitle, { marginBottom: 0, paddingBottom: 0, borderBottomWidth: 0 }]}>Produits commandés</Text>
              {!loadingItems && !editingQty && (
                <TouchableOpacity
                  onPress={startEditQty}
                  style={modal.editQtyBtn}
                  activeOpacity={0.7}
                >
                  <Text style={modal.editQtyBtnText}>Modifier les quantités</Text>
                </TouchableOpacity>
              )}
            </View>
            {loadingItems ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : (
              <>
                <View style={modal.tableHead}>
                  <Text style={[modal.th, { flex: 3 }]}>Produit</Text>
                  <Text style={[modal.th, modal.right, { flex: editingQty ? 2 : 1.2 }]}>Qté</Text>
                  {!editingQty && <Text style={[modal.th, modal.right, { flex: 1.5 }]}>PU HT</Text>}
                  <Text style={[modal.th, modal.right, { flex: 1.8 }]}>ST HT</Text>
                </View>
                {items.map((it, idx) => {
                  const currentQty = editingQty ? (draftQty[it.id] ?? it.quantite) : it.quantite;
                  const isDeleted = editingQty && currentQty === 0;
                  const subTotal = editingQty
                    ? Number((currentQty * Number(it.prix_unitaire_ht)).toFixed(2))
                    : it.sous_total_ht;
                  return (
                    <View
                      key={it.id}
                      style={[
                        modal.tableRow,
                        idx % 2 === 1 && modal.rowAlt,
                        isDeleted && modal.rowDeleted,
                      ]}
                    >
                      <Text
                        style={[modal.td, { flex: 3 }, isDeleted && modal.tdStrike]}
                        numberOfLines={2}
                      >
                        {it.product_nom}
                      </Text>
                      {editingQty ? (
                        <View style={[modal.qtyControl, { flex: 2 }]}>
                          <TouchableOpacity
                            onPress={() => changeQty(it.id, -1)}
                            style={modal.qtyBtn}
                            activeOpacity={0.7}
                          >
                            <Text style={modal.qtyBtnText}>âˆ’</Text>
                          </TouchableOpacity>
                          <TextInput
                            style={modal.qtyInput}
                            value={String(currentQty)}
                            onChangeText={(v) => setQtyDirect(it.id, v)}
                            keyboardType="numeric"
                            selectTextOnFocus
                          />
                          <TouchableOpacity
                            onPress={() => changeQty(it.id, 1)}
                            style={modal.qtyBtn}
                            activeOpacity={0.7}
                          >
                            <Text style={modal.qtyBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={[modal.td, modal.right, { flex: 1.2 }]}>{it.quantite}</Text>
                      )}
                      {!editingQty && (
                        <Text style={[modal.td, modal.right, { flex: 1.5 }]}>{`${n2(it.prix_unitaire_ht)} â‚¬`}</Text>
                      )}
                      <Text style={[modal.td, modal.right, modal.bold, { flex: 1.8 }, isDeleted && modal.tdStrike]}>
                        {isDeleted ? '"”' : `${n2(subTotal)} â‚¬`}
                      </Text>
                    </View>
                  );
                })}
                <View style={modal.totals}>
                  <TotalLine label="Total HT" value={`${n2(localTotalHt)} â‚¬`} />
                </View>

                {/* Boutons confirmation édition */}
                {editingQty && (
                  <View style={modal.editQtyActions}>
                    <TouchableOpacity
                      onPress={cancelEditQty}
                      style={modal.editQtyCancelBtn}
                      disabled={savingItems}
                      activeOpacity={0.7}
                    >
                      <Text style={modal.editQtyCancelText}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveItems}
                      style={[modal.editQtySaveBtn, savingItems && { opacity: 0.6 }]}
                      disabled={savingItems}
                      activeOpacity={0.8}
                    >
                      {savingItems
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={modal.editQtySaveText}>✓ Valider les quantités</Text>}
                    </TouchableOpacity>
                  </View>
                )}
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

          {/* ── Section Surgelé (admin) ────────────────────── */}
          {order.type_commande === 'surgele' && (
            <View style={[modal.section, { marginTop: spacing.md }]}>
              <Text style={modal.sectionTitle}>Gestion surgelé</Text>

              {/* Date de livraison assignée par l'admin */}
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ fontSize: fontSizes.xs, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }}>
                  Date de livraison
                </Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={dateLivraisonAdmin}
                    onChange={(e) => setDateLivraisonAdmin(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 14,
                      borderRadius: 8,
                      border: `1.5px solid ${colors.border}`,
                      backgroundColor: colors.background,
                      color: colors.textPrimary,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <TextInput
                    style={modal.notesInput}
                    value={dateLivraisonAdmin}
                    onChangeText={setDateLivraisonAdmin}
                    placeholder="AAAA-MM-JJ"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                  />
                )}
                {dateLivraisonAdmin ? (
                  <Text style={{ fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 4 }}>
                    {fmt(dateLivraisonAdmin)}
                  </Text>
                ) : null}
              </View>

              {/* Bouton Valider (nouvelle → en_preparation) */}
              {statut === 'nouvelle' && (
                <TouchableOpacity
                  style={[surgeleStyles.actionBtn, surgeleStyles.validateBtn, savingSurgele && { opacity: 0.6 }]}
                  onPress={handleValiderSurgele}
                  disabled={savingSurgele}
                  activeOpacity={0.8}
                >
                  {savingSurgele ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={surgeleStyles.actionBtnText}>Valider la commande (En preparation)</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Bouton Assigner date (si déjà en_preparation) */}
              {statut === 'en_preparation' && (
                <TouchableOpacity
                  style={[surgeleStyles.actionBtn, surgeleStyles.dateBtn, savingSurgele && { opacity: 0.6 }]}
                  onPress={handleAssignerDateSurgele}
                  disabled={savingSurgele}
                  activeOpacity={0.8}
                >
                  {savingSurgele ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={surgeleStyles.actionBtnText}>Enregistrer la date de livraison</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Bouton Livré (en_preparation → livree) */}
              {statut === 'en_preparation' && (
                <TouchableOpacity
                  style={[surgeleStyles.actionBtn, surgeleStyles.livrBtn, savingSurgele && { opacity: 0.6 }, { marginTop: spacing.sm }]}
                  onPress={handleLivrerSurgele}
                  disabled={savingSurgele}
                  activeOpacity={0.8}
                >
                  {savingSurgele ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={surgeleStyles.actionBtnText}>Marquer comme livré</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Statuts inattendus : traite ou en_livraison → bouton de secours pour ne pas bloquer l'admin */}
              {(statut === 'traite' || statut === 'en_livraison') && (
                <TouchableOpacity
                  style={[surgeleStyles.actionBtn, surgeleStyles.livrBtn, savingSurgele && { opacity: 0.6 }]}
                  onPress={handleLivrerSurgele}
                  disabled={savingSurgele}
                  activeOpacity={0.8}
                >
                  {savingSurgele ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={surgeleStyles.actionBtnText}>Marquer comme livré</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* Statut livré */}
              {statut === 'livree' && (
                <View style={surgeleStyles.livreeBadge}>
                  <Text style={surgeleStyles.livreeBadgeText}>Livrée</Text>
                </View>
              )}

              {/* Statut annulé */}
              {statut === 'annulee' && (
                <View style={surgeleStyles.annuleeBadge}>
                  <Text style={surgeleStyles.annuleeBadgeText}>Annulée</Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>

        {/* â”€â”€ Colonne droite : aperçu PDF (desktop web only) â”€â”€ */}
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
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  screenTitle: { fontSize: fontSizes.lg, fontWeight: '800', color: colors.textPrimary },
  screenCount: { fontSize: fontSizes.sm, color: colors.textSecondary },
  refreshBtn: { ...Platform.select({ web: { cursor: 'pointer' } }) },
  refreshText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  excelBtn: {
    backgroundColor: '#217346',
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  excelBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSizes.sm },
  takeOrderBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  takeOrderBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSizes.sm },

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
  rowDeleteWarning: { fontSize: fontSizes.xs - 1, marginTop: 2, fontWeight: '600' },
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

  rowWrapper: { flexDirection: 'row', alignItems: 'center' },
  checkboxContainer: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.primary },
  checkmark: { color: colors.white, fontSize: 14, fontWeight: 'bold' },

  bulkActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectAllBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 4, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  selectAllBtnText: { fontSize: fontSizes.sm, color: colors.textSecondary },
  bulkActionText: { fontSize: fontSizes.md, fontWeight: '600', color: colors.textPrimary },

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
const modal = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
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
  body: { flex: 1 },
  leftCol: { flex: 1 },
  leftColDesktop: { flex: 1, borderRightWidth: 1, borderRightColor: colors.border },
  leftColContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
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
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  infoItem: { minWidth: 140, flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.sm },
  infoLabel: { fontSize: fontSizes.xs, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textPrimary },
  addressBox: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm },
  addressLabel: { fontSize: fontSizes.xs, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  addressText: { fontSize: fontSizes.sm, color: colors.textPrimary, lineHeight: 20 },
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
  totals: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 4 },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalLineFinal: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.xs },
  totalLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  totalValue: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textPrimary },
  totalLabelFinal: { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  totalValueFinal: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.primary },
  rowDeleted: { opacity: 0.45, backgroundColor: '#FFE5E5' },
  tdStrike: { textDecorationLine: 'line-through', color: colors.textLight },
  editQtyBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  editQtyBtnText: { fontSize: fontSizes.xs, color: colors.primary, fontWeight: '600' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  qtyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16, lineHeight: 18 },
  qtyInput: {
    width: 38, height: 26,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.sm,
    textAlign: 'center',
    fontSize: fontSizes.sm, fontWeight: '600',
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  editQtyActions: {
    flexDirection: 'row', gap: spacing.sm,
    marginTop: spacing.md, justifyContent: 'flex-end',
  },
  editQtyCancelBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  editQtyCancelText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: '600' },
  editQtySaveBtn: {
    flex: 1, paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: '#2E7D32',
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  editQtySaveText: { color: '#fff', fontWeight: '700', fontSize: fontSizes.sm },
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

function TakeOrderModal({ visible, onClose, onOrderCreated }) {
  const [step, setStep] = useState('client');
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [clientPrices, setClientPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [manualLines, setManualLines] = useState([]);
  const [qtyDraft, setQtyDraft] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [orderType, setOrderType] = useState('frais');
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  useEffect(() => {
    if (!visible) return;
    setStep('client');
    setSelectedClient(null);
    setClientPrices({});
    setQuantities({});
    setManualLines([]);
    setQtyDraft({});
    setSearch('');
    setLoading(true);
    Promise.all([
      supabase
        .from('profiles')
        .select('id, nom, prenom, nom_societe, email, telephone, ville, livreur_id, livreur_surgele_id')
        .eq('role', 'client')
        .order('nom_societe', { ascending: true }),
      supabase
        .from('products')
        .select('id, nom, prix_unitaire_ht, increment, tva_pourcent, category:categories(id, slug)')
        .eq('actif', true)
        .order('nom'),
    ]).then(([cliRes, prodRes]) => {
      setClients(cliRes.data || []);
      setProducts(prodRes.data || []);
    }).finally(() => setLoading(false));
  }, [visible]);

  const handleSelectClient = async (client) => {
    setSelectedClient(client);
    setQuantities({});
    setManualLines([]);
    setQtyDraft({});
    setStep('products');
    try {
      const { data } = await supabase
        .from('client_prices')
        .select('product_id, prix_unitaire_ht')
        .eq('client_id', client.id);
      const map = {};
      (data || []).forEach(row => { map[row.product_id] = Number(row.prix_unitaire_ht); });
      setClientPrices(map);
    } catch (err) {
      console.error('Erreur chargement prix client :', err);
    }
  };

  const getPrice = (product) =>
    clientPrices[product.id] !== undefined
      ? clientPrices[product.id]
      : Number(product.prix_unitaire_ht || 0);

  const q = search.toLowerCase().trim();
  const filteredClients = q
    ? clients.filter((c) =>
      (c.nom_societe || '').toLowerCase().includes(q) ||
      (c.nom || '').toLowerCase().includes(q) ||
      (c.prenom || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.ville || '').toLowerCase().includes(q)
    )
    : clients;

  const addManualLine = () => setManualLines(prev => [
    ...prev,
    { id: Date.now().toString(), nom: '', quantite: '1', prix: '', tva: '5.5' },
  ]);

  const updateManualLine = (id, field, value) =>
    setManualLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));

  const removeManualLine = (id) =>
    setManualLines(prev => prev.filter(l => l.id !== id));

  const catalogueLines = products
    .filter((p) => (quantities[p.id] || 0) > 0)
    .map((p) => ({ product: p, quantite: quantities[p.id], prix: getPrice(p) }));

  const validManualLines = manualLines.filter(
    l => l.nom.trim() && Number(l.quantite) > 0 && Number(l.prix) > 0
  );

  const allOrderLines = [...catalogueLines, ...validManualLines.map(l => ({
    manual: true, nom: l.nom.trim(),
    quantite: Number(l.quantite), prix: Number(l.prix), tva: Number(l.tva) || 0,
  }))];

  let totalHt = 0;
  let totalTva = 0;
  allOrderLines.forEach((l) => {
    const ht = l.prix * l.quantite;
    totalHt += ht;
    totalTva += ht * ((l.manual ? l.tva : Number(l.product.tva_pourcent)) / 100);
  });
  totalHt = Math.round(totalHt * 100) / 100;
  totalTva = Math.round(totalTva * 100) / 100;
  const totalTtc = Math.round((totalHt + totalTva) * 100) / 100;

  const setQty = (productId, inc, dir) => {
    setQuantities((prev) => {
      const cur = prev[productId] || 0;
      const next = dir === '+' ? cur + inc : Math.max(0, cur - inc);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleSubmit = async () => {
    if (allOrderLines.length === 0) {
      showAlert('Attention', 'Veuillez sélectionner au moins un produit.');
      return;
    }
    setSubmitting(true);
    try {
      const adresse = selectedClient.ville || 'Commande prise par admin';

      let dateLivraison = null;
      if (orderType === 'surgele') {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        dateLivraison = d.toISOString().split('T')[0];
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          client_id: selectedClient.id,
          livreur_id: orderType === 'surgele' ? (selectedClient.livreur_surgele_id || null) : (selectedClient.livreur_id || null),
          statut: 'nouvelle',
          adresse_livraison: adresse,
          total_ht: totalHt,
          total_tva: totalTva,
          total_ttc: totalTtc,
          type_commande: orderType,
          date_livraison_souhaitee: dateLivraison,
        })
        .select('*')
        .single();

      if (orderError) throw orderError;

      const { error: itemsError } = await supabase.from('order_items').insert(
        allOrderLines.map((l) => l.manual ? ({
          order_id: order.id,
          product_id: null,
          product_nom: l.nom,
          quantite: l.quantite,
          increment: 1,
          prix_unitaire_ht: l.prix,
          tva_pourcent: l.tva,
          sous_total_ht: Math.round(l.prix * l.quantite * 100) / 100,
        }) : ({
          order_id: order.id,
          product_id: l.product.id,
          product_nom: l.product.nom,
          quantite: l.quantite,
          increment: l.product.increment || 1,
          prix_unitaire_ht: l.prix,
          tva_pourcent: l.product.tva_pourcent,
          sous_total_ht: Math.round(l.prix * l.quantite * 100) / 100,
        }))
      );

      if (itemsError) throw itemsError;

      showAlert('Commande créée', 'La commande a été créée avec succès.');
      onOrderCreated();
      onClose();
    } catch (err) {
      console.error('Erreur création commande admin :', err);
      showAlert('Erreur', 'Impossible de créer la commande.');
    } finally {
      setSubmitting(false);
    }
  };

  const clientName = selectedClient
    ? selectedClient.nom_societe ||
    [selectedClient.prenom, selectedClient.nom].filter(Boolean).join(' ') ||
    selectedClient.email
    : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={to.overlay}>
        <View style={[to.box, isDesktop && to.boxDesktop]}>
          {/* Header */}
          <View style={to.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {step === 'products' && (
                <TouchableOpacity onPress={() => setStep('client')} style={to.backBtn} activeOpacity={0.7}>
                  <Text style={to.backText}>â†</Text>
                </TouchableOpacity>
              )}
              <View>
                <Text style={to.headerTitle}>Prendre une commande</Text>
                {step === 'products' && clientName ? (
                  <Text style={to.headerSub}>{clientName}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={to.closeBtn} activeOpacity={0.7}>
              <Text style={to.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={to.centered}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : step === 'client' ? (
            /* â”€â”€ Étape 1 : choix du client â”€â”€ */
            <>
              <View style={to.searchBar}>
                <TextInput
                  style={to.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Rechercher un client..."
                  placeholderTextColor={colors.textLight}
                />
              </View>
              <FlatList
                data={filteredClients}
                keyExtractor={(c) => c.id}
                contentContainerStyle={to.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                ListEmptyComponent={<Text style={to.emptyText}>Aucun client trouvé.</Text>}
                renderItem={({ item: c }) => {
                  const name =
                    c.nom_societe ||
                    [c.prenom, c.nom].filter(Boolean).join(' ') ||
                    c.email ||
                    '"”';
                  const sub = [c.email, c.ville].filter(Boolean).join(' Â· ');
                  return (
                    <TouchableOpacity
                      style={to.clientRow}
                      onPress={() => handleSelectClient(c)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={to.clientName}>{name}</Text>
                        {sub ? <Text style={to.clientSub} numberOfLines={1}>{sub}</Text> : null}
                      </View>
                      <Text style={to.chevron}>"º</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </>
          ) : (
            /* â”€â”€ Étape 2 : sélection produits â”€â”€ */
            <>
              {/* Tabs Frais / Surgelé */}
              <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity 
                  style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 4 }, orderType === 'frais' && { backgroundColor: '#E8F5E9' }]}
                  onPress={() => setOrderType('frais')}
                >
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }, orderType === 'frais' && { color: '#2E7D32' }]}>Frais</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 4 }, orderType === 'surgele' && { backgroundColor: '#E3F2FD' }]}
                  onPress={() => setOrderType('surgele')}
                >
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }, orderType === 'surgele' && { color: '#1565C0' }]}>Surgelé</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={products.filter(p => p.category?.slug === orderType)}
                keyExtractor={(p) => p.id}
                contentContainerStyle={[to.listContent, { paddingBottom: 90 }]}
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                renderItem={({ item: p }) => {
                  const qty = quantities[p.id] || 0;
                  const inc = p.increment || 1;
                  const prix = getPrice(p);
                  return (
                    <View style={[to.productRow, qty > 0 && to.productRowActive]}>
                      <View style={{ flex: 1 }}>
                        <Text style={to.productName}>{p.nom}</Text>
                        <Text style={to.productPrice}>{`${n2(prix)} â‚¬/u HT`}</Text>
                      </View>
                      <View style={to.stepper}>
                        <TouchableOpacity
                          style={[to.stepBtn, qty === 0 && to.stepBtnOff]}
                          onPress={() => setQty(p.id, inc, '-')}
                          disabled={qty === 0}
                          activeOpacity={0.7}
                        >
                          <Text style={to.stepBtnText}>âˆ’</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={[to.stepQty, to.stepQtyInput, qty > 0 && to.stepQtyActive]}
                          value={qtyDraft[p.id] !== undefined ? qtyDraft[p.id] : String(qty)}
                          onChangeText={(v) => {
                            const cleaned = v.replace(/[^0-9]/g, '');
                            setQtyDraft(prev => ({ ...prev, [p.id]: cleaned }));
                            const n = parseInt(cleaned, 10);
                            if (!isNaN(n)) setQuantities(prev => n === 0 ? (({ [p.id]: _, ...rest }) => rest)(prev) : { ...prev, [p.id]: n });
                          }}
                          onBlur={() => {
                            const raw = parseInt(qtyDraft[p.id], 10);
                            if (!isNaN(raw) && raw > 0) {
                              const rounded = Math.ceil(raw / inc) * inc;
                              setQuantities(prev => ({ ...prev, [p.id]: rounded }));
                            } else if (!raw || raw === 0) {
                              setQuantities(prev => { const { [p.id]: _, ...rest } = prev; return rest; });
                            }
                            setQtyDraft(prev => { const { [p.id]: _, ...rest } = prev; return rest; });
                          }}
                          keyboardType="numeric"
                          maxLength={4}
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={to.stepBtn}
                          onPress={() => setQty(p.id, inc, '+')}
                          activeOpacity={0.7}
                        >
                          <Text style={to.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                ListFooterComponent={
                  /* â”€â”€ Lignes manuelles â”€â”€ */
                  <View style={to.manualSection}>
                    <View style={to.manualHeader}>
                      <Text style={to.manualTitle}>Saisie manuelle</Text>
                      <TouchableOpacity onPress={addManualLine} style={to.addLineBtn} activeOpacity={0.7}>
                        <Text style={to.addLineBtnText}>+ Ajouter une ligne</Text>
                      </TouchableOpacity>
                    </View>
                    {manualLines.map((l) => (
                      <View key={l.id} style={to.manualRow}>
                        <TextInput
                          style={[to.manualInput, { flex: 1 }]}
                          placeholder="Libellé"
                          placeholderTextColor={colors.textLight}
                          value={l.nom}
                          onChangeText={v => updateManualLine(l.id, 'nom', v)}
                        />
                        <TextInput
                          style={[to.manualInput, { width: 48 }]}
                          placeholder="Qté"
                          placeholderTextColor={colors.textLight}
                          value={l.quantite}
                          onChangeText={v => updateManualLine(l.id, 'quantite', v.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          maxLength={4}
                        />
                        <TextInput
                          style={[to.manualInput, { width: 80 }]}
                          placeholder="Prix HT"
                          placeholderTextColor={colors.textLight}
                          value={l.prix}
                          onChangeText={v => updateManualLine(l.id, 'prix', v.replace(/[^0-9.]/g, ''))}
                          keyboardType="numeric"
                        />
                        <TouchableOpacity onPress={() => removeManualLine(l.id)} style={to.removeLineBtn} activeOpacity={0.7}>
                          <Text style={to.removeLineBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                }
              />

              {/* Footer totaux */}
              <View style={to.footer}>
                <View style={{ flex: 1 }}>
                  <Text style={to.footerInfo}>
                    {allOrderLines.length > 0
                      ? `${allOrderLines.length} ligne${allOrderLines.length > 1 ? 's' : ''} Â· ${n2(totalHt)} â‚¬ HT`
                      : 'Aucun produit sélectionné'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[to.submitBtn, (allOrderLines.length === 0 || submitting) && to.submitBtnOff]}
                  onPress={handleSubmit}
                  disabled={allOrderLines.length === 0 || submitting}
                  activeOpacity={0.8}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={to.submitBtnText}>Valider la commande</Text>
                  }
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const to = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    ...Platform.select({ web: { justifyContent: 'center', alignItems: 'center' } }),
  },
  box: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '92%',
    flex: 1,
  },
  boxDesktop: {
    borderRadius: borderRadius.xl,
    width: '48%',
    maxWidth: 680,
    maxHeight: '88%',
    flex: undefined,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary },
  headerSub: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600', marginTop: 2 },
  backBtn: { padding: spacing.xs, marginRight: 4, ...Platform.select({ web: { cursor: 'pointer' } }) },
  backText: { fontSize: fontSizes.xl, color: colors.primary, fontWeight: '600' },
  closeBtn: { padding: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  closeText: { fontSize: fontSizes.lg, color: colors.textSecondary, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
  },
  listContent: { padding: spacing.md },
  emptyText: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl, fontSize: fontSizes.md },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  clientName: { fontSize: fontSizes.md, fontWeight: '600', color: colors.textPrimary },
  clientSub: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.textLight, marginLeft: spacing.sm },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  productRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  productName: { fontSize: fontSizes.md, fontWeight: '600', color: colors.textPrimary },
  productPrice: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },
  customTag: { color: colors.primary, fontStyle: 'italic' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  stepBtnOff: { backgroundColor: colors.border },
  stepBtnText: { fontSize: fontSizes.lg, color: '#fff', fontWeight: '700', lineHeight: 20 },
  stepQty: { minWidth: 36, textAlign: 'center', fontSize: fontSizes.md, fontWeight: '600', color: colors.textSecondary },
  stepQtyInput: { ...Platform.select({ web: { outlineStyle: 'none' } }), paddingVertical: 2 },
  stepQtyActive: { color: colors.primary },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.md,
  },
  footerInfo: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: '500' },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  submitBtnOff: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSizes.md },

  manualSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  manualTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  addLineBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  addLineBtnText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.primary },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  manualInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  removeLineBtn: {
    padding: 6,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  removeLineBtnText: { fontSize: fontSizes.md, color: colors.error, fontWeight: '700' },
});

const surgeleStyles = StyleSheet.create({
  actionBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  validateBtn: { backgroundColor: '#1565C0' },
  dateBtn: { backgroundColor: '#0277BD' },
  livrBtn: { backgroundColor: '#2E7D32' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSizes.sm },
  livreeBadge: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  livreeBadgeText: { color: '#2E7D32', fontWeight: '700', fontSize: fontSizes.sm },
  annuleeBadge: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: '#9E9E9E',
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  annuleeBadgeText: { color: '#757575', fontWeight: '700', fontSize: fontSizes.sm },
});