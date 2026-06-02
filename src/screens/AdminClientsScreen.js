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
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import Button from '../components/Button';
import CreateClientModal from '../components/CreateClientModal';
import useDebounce from '../hooks/useDebounce';
import ConfirmModal from '../components/ConfirmModal';
import { exportClientsExcel } from '../utils/exportExcel';

const FILTERS = [
  { key: 'tous', label: 'Tous' },
  { key: 'actifs', label: 'Actifs' },
  { key: 'inactifs', label: 'Inactifs' },
];



const fmt = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const n2 = (v) => Number(v ?? 0).toFixed(2);

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

const confirmAction = (msg, onConfirm) => {
  if (Platform.OS === 'web') {
    if (window.confirm(msg)) onConfirm();
  } else {
    Alert.alert('Confirmation', msg, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

const PAGE_SIZE = 30;

export default function AdminClientsScreen() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('tous');
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [selectedClient, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const debouncedSearch = useDebounce(search, 300);

  const loadClients = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const from = reset ? 0 : clients.length;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('role', 'client')
        .order('created_at', { ascending: false })
        .range(from, to);
      if (filter === 'actifs') query = query.neq('actif', false);
      if (filter === 'inactifs') query = query.eq('actif', false);
      if (debouncedSearch.trim()) {
        const q = `%${debouncedSearch.trim()}%`;
        query = query.or(`nom_societe.ilike.${q},nom.ilike.${q},prenom.ilike.${q},email.ilike.${q}`);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      if (reset) {
        setClients(data || []);
      } else {
        setClients((prev) => [...prev, ...(data || [])]);
      }
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('Erreur chargement clients :', err);
      showAlert('Erreur', 'Impossible de charger les clients.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, debouncedSearch, clients.length]);

  useEffect(() => { loadClients(true); }, [filter, debouncedSearch]);

  const hasMore = clients.length < totalCount;
  const filtered = clients; // Le filtrage est maintenant côté serveur

  const openClient = useCallback((client) => {
    setSelected(client);
    setModalVisible(true);
  }, []);

  const closeModal = () => {
    setModalVisible(false);
    setSelected(null);
  };

  const handleClientUpdated = (updated) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
  };

  const handleClientDeleted = (deletedId) => {
    setClients((prev) => prev.filter((c) => c.id !== deletedId));
    setTotalCount((prev) => prev - 1);
    closeModal();
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportClientsExcel();
    } catch (err) {
      console.error('Erreur export Excel clients :', err);
      showAlert('Erreur', "Impossible d'exporter les clients.");
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.screenTitle}>Clients</Text>
          <Text style={styles.screenCount}>{`${clients.length} / ${totalCount}`}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => loadClients(true)} style={styles.refreshBtn} activeOpacity={0.7}>
            <Text style={styles.refreshText}>↻ Actualiser</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExportExcel}
            disabled={exportingExcel}
            style={[styles.excelBtn, exportingExcel && { opacity: 0.5 }]}
            activeOpacity={0.8}
          >
            <Text style={styles.excelBtnText}>{exportingExcel ? '...' : 'Excel'}</Text>
          </TouchableOpacity>
          <Button title="+ Créer un client" onPress={() => setCreateVisible(true)} size="sm" />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher par nom, société, email..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      <View style={styles.filtersRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
              {active && (
                <View style={[styles.filterCount, styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, styles.filterCountTextActive]}>{totalCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>
            {search.trim() ? 'Aucun résultat pour cette recherche.' : 'Aucun client.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android' || Platform.OS === 'web'}
          renderItem={({ item }) => (
            <ClientRow item={item} onPress={openClient} />
          )}
          ListFooterComponent={hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => loadClients(false)}
              disabled={loadingMore}
              activeOpacity={0.7}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>
                  {`Charger plus (${clients.length}/${totalCount})`}
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, isDesktop && styles.modalBoxDesktop]}>
            {selectedClient && (
              <ClientDetailModal
                client={selectedClient}
                onClose={closeModal}
                onUpdated={handleClientUpdated}
                onDeleted={handleClientDeleted}
              />
            )}
          </View>
        </View>
      </Modal>

      <CreateClientModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={() => loadClients(true)}
      />
    </View>
  );
}

const ClientRow = React.memo(({ item, onPress }) => {
  const displayName = item.nom_societe
    || [item.prenom, item.nom].filter(Boolean).join(' ')
    || '—';
  const isActif = item.actif !== false;

  return (
    <TouchableOpacity
      style={[styles.row, !isActif && styles.rowInactive]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={[styles.rowCol, styles.rowColFlex]}>
        <Text style={styles.rowName} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.rowEmail} numberOfLines={1}>{item.email || '—'}</Text>
      </View>

      <View style={styles.rowCol}>
        <Text style={styles.rowMeta} numberOfLines={1}>{item.telephone || '—'}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{item.ville || '—'}</Text>
      </View>

      <View style={[styles.badge, { backgroundColor: isActif ? colors.success + '22' : colors.error + '22' }]}>
        <Text style={[styles.badgeText, { color: isActif ? colors.success : colors.error }]}>
          {isActif ? 'Actif' : 'Inactif'}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
});

function ClientDetailModal({ client, onClose, onUpdated, onDeleted }) {
  const initial = {
    nom: client.nom || '',
    prenom: client.prenom || '',
    nom_societe: client.nom_societe || '',
    email: client.email || '',
    telephone: client.telephone || '',
    adresse: client.adresse || '',
    code_postal: client.code_postal || '',
    ville: client.ville || '',
    siret: client.siret || '',
    note_interne_client: client.note_interne_client || '',
    note_interne_admin: client.note_interne_admin || '',
  };

  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [livreurs, setLivreurs] = useState([]);
  const [selectedLivreur, setSelectedLivreur] = useState(client.livreur_id || null);
  const [savingLivreur, setSavingLivreur] = useState(false);
  const [selectedLivreurSurgele, setSelectedLivreurSurgele] = useState(client.livreur_surgele_id || null);
  const [savingLivreurSurgele, setSavingLivreurSurgele] = useState(false);

  useEffect(() => {
    setSelectedLivreur(client.livreur_id || null);
    setSelectedLivreurSurgele(client.livreur_surgele_id || null);
  }, [client.id, client.livreur_id, client.livreur_surgele_id]);
  const [clientPrices, setClientPrices] = useState({});
  const [products, setProducts] = useState([]);
  const [savingPrices, setSavingPrices] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isActif = client.actif !== false;
  const changed = Object.keys(form).some((k) => form[k] !== initial[k]);

  useEffect(() => {
    (async () => {
      try {
        const [livRes, prodRes, pricesRes] = await Promise.all([
          supabase.from('livreurs').select('id, nom, prenom, type_livreur').eq('actif', true),
          supabase.from('products').select('id, nom, prix_unitaire_ht').eq('actif', true).order('nom'),
          supabase.from('client_prices').select('*').eq('client_id', client.id),
        ]);
        setLivreurs(livRes.data || []);
        setProducts(prodRes.data || []);
        const priceMap = {};
        (pricesRes.data || []).forEach(p => { priceMap[p.product_id] = String(p.prix_unitaire_ht); });
        setClientPrices(priceMap);
      } catch (err) {
        console.error('Erreur chargement données client :', err);
      }
    })();
  }, [client.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newEmail = form.email.trim();
      const emailChanged = newEmail && newEmail !== initial.email;

      // Si l'email change, mettre à jour l'email dans auth.users via l'edge function
      if (emailChanged) {
        const { error: authEmailError } = await supabase.functions.invoke('update-auth-email', {
          body: { userId: client.id, newEmail },
        });
        if (authEmailError) throw new Error(`Erreur mise à jour email auth: ${authEmailError.message}`);
      }

      const { data, error } = await supabase.from('profiles').update({
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        nom_societe: form.nom_societe.trim(),
        email: newEmail,
        telephone: form.telephone.trim(),
        adresse: form.adresse.trim(),
        code_postal: form.code_postal.trim(),
        ville: form.ville.trim(),
        siret: form.siret.trim(),
        note_interne_admin: form.note_interne_admin.trim(),
      }).eq('id', client.id).select('*').single();
      if (error) throw error;
      onUpdated(data);
      showAlert('Succès', emailChanged
        ? 'Profil mis à jour. Le client devra utiliser le nouvel email pour se connecter.'
        : 'Profil mis à jour.');
    } catch (err) {
      showAlert('Erreur', err.message);
    } finally { setSaving(false); }
  };

  const handleSelectLivreur = async (livId) => {
    setSelectedLivreur(livId);
    setSavingLivreur(true);
    try {
      const { data, error } = await supabase.from('profiles')
        .update({ livreur_id: livId || null })
        .eq('id', client.id).select('*').single();
      if (error) throw error;
      await supabase.from('orders')
        .update({ livreur_id: livId || null })
        .eq('client_id', client.id)
        .in('statut', ['nouvelle', 'en_preparation'])
        .neq('type_commande', 'surgele');

      onUpdated(data);
    } catch (err) {
      showAlert('Erreur', 'Impossible de changer le livreur frais.');
    } finally { setSavingLivreur(false); }
  };

  const handleSelectLivreurSurgele = async (livId) => {
    setSelectedLivreurSurgele(livId);
    setSavingLivreurSurgele(true);
    try {
      const { data, error } = await supabase.from('profiles')
        .update({ livreur_surgele_id: livId || null })
        .eq('id', client.id).select('*').single();
      if (error) throw error;
      await supabase.from('orders')
        .update({ livreur_id: livId || null })
        .eq('client_id', client.id)
        .in('statut', ['nouvelle', 'en_preparation'])
        .eq('type_commande', 'surgele');

      onUpdated(data);
    } catch (err) {
      showAlert('Erreur', 'Impossible de changer le livreur surgelé.');
    } finally { setSavingLivreurSurgele(false); }
  };

  const handleSavePrices = async () => {
    setSavingPrices(true);
    try {
      await supabase.from('client_prices').delete().eq('client_id', client.id);
      const rows = [];
      for (const [productId, price] of Object.entries(clientPrices)) {
        const p = parseFloat(price);
        const prod = products.find(pr => pr.id === productId);
        if (!isNaN(p) && p >= 0 && prod && Math.abs(p - Number(prod.prix_unitaire_ht)) > 0.001) {
          rows.push({ client_id: client.id, product_id: productId, prix_unitaire_ht: p });
        }
      }
      if (rows.length > 0) await supabase.from('client_prices').insert(rows);
      showAlert('Succès', 'Prix enregistrés.');
    } catch (err) {
      showAlert('Erreur', 'Erreur sauvegarde prix.');
    } finally { setSavingPrices(false); }
  };

  const handleToggleActif = () => {
    const displayName = client.nom_societe || client.email || 'ce client';
    const msg = isActif
      ? `Désactiver le compte de ${displayName} ?`
      : `Réactiver le compte de ${displayName} ?`;
    confirmAction(msg, async () => {
      setToggling(true);
      try {
        const { data, error } = await supabase.from('profiles')
          .update({ actif: !isActif }).eq('id', client.id).select('*').single();
        if (error) throw error;
        onUpdated(data);
        showAlert('Succès', isActif ? 'Compte désactivé.' : 'Compte réactivé.');
      } catch (err) {
        showAlert('Erreur', 'Impossible de modifier le statut.');
      } finally { setToggling(false); }
    });
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const snapshot = client.nom_societe
        || [client.prenom, client.nom].filter(Boolean).join(' ')
        || 'Client supprimé';

      await supabase.from('orders')
        .update({
          client_nom: snapshot,
          client_uuid_snapshot: client.id,
          client_id: null,
        })
        .eq('client_id', client.id);

      await supabase.from('client_prices').delete().eq('client_id', client.id);

      const { error } = await supabase.from('profiles')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      setConfirmDelete(false);
      showAlert('Compte supprimé', `Le profil de ${snapshot} a été supprimé. Son nom a été conservé sur les commandes pour la comptabilité.`);
      onDeleted(client.id);
    } catch (err) {
      console.error('Erreur suppression admin :', err);
      showAlert('Erreur', 'Impossible de supprimer le compte. Détail : ' + err.message);
    } finally { setDeleting(false); }
  };

  const setField = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const displayName = client.nom_societe
    || [client.prenom, client.nom].filter(Boolean).join(' ')
    || client.email || '—';

  const livreurChanged = selectedLivreur !== (client.livreur_id || null);

  return (
    <View style={modal.container}>
      <View style={modal.header}>
        <View style={{ flex: 1 }}>
          <Text style={modal.headerName} numberOfLines={1}>{displayName}</Text>
          <View style={[modal.headerBadge, { backgroundColor: isActif ? colors.success + '22' : colors.error + '22' }]}>
            <Text style={[modal.headerBadgeText, { color: isActif ? colors.success : colors.error }]}>
              {isActif ? 'Compte actif' : 'Compte inactif'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={modal.closeBtn} activeOpacity={0.7}>
          <Text style={modal.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={modal.body} contentContainerStyle={modal.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Informations</Text>
          <View style={modal.row2}>
            <FormField label="Prénom" value={form.prenom} onChangeText={setField('prenom')} placeholder="Prénom" />
            <FormField label="Nom" value={form.nom} onChangeText={setField('nom')} placeholder="Nom" />
          </View>
          <FormField label="Société" value={form.nom_societe} onChangeText={setField('nom_societe')} placeholder="Nom de la société" />
          <FormField label="Email" value={form.email} onChangeText={setField('email')} placeholder="email@exemple.fr" keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Téléphone" value={form.telephone} onChangeText={setField('telephone')} placeholder="06 00 00 00 00" keyboardType="phone-pad" />
          <FormField label="SIRET" value={form.siret} onChangeText={setField('siret')} placeholder="000 000 000 00000" />
        </View>

        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Adresse</Text>
          <FormField label="Adresse" value={form.adresse} onChangeText={setField('adresse')} placeholder="1 rue de la Boulangerie" />
          <View style={modal.row2}>
            <FormField label="Code postal" value={form.code_postal} onChangeText={setField('code_postal')} placeholder="75000" keyboardType="numeric" />
            <FormField label="Ville" value={form.ville} onChangeText={setField('ville')} placeholder="Paris" />
          </View>
        </View>

        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Notes Internes</Text>
          <FormField
            label="Note du client"
            value={form.note_interne_client}
            placeholder="Aucune note du client."
            multiline
            editable={false}
            style={{ minHeight: 60, textAlignVertical: 'top', backgroundColor: colors.background + '80' }}
          />
          <FormField
            label="Note admin"
            value={form.note_interne_admin}
            onChangeText={setField('note_interne_admin')}
            placeholder="Ajoutez une note interne pour ce client..."
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        {changed && (
          <Button title="Enregistrer les modifications" onPress={handleSave}
            loading={saving} disabled={saving} fullWidth size="lg" />
        )}

        {/* Livreur Frais assigné */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Livreur Frais assigné</Text>
          {livreurs.filter(l => l.type_livreur === 'frais' || l.type_livreur === 'les_deux').length === 0 ? (
            <Text style={modal.emptyOrders}>Aucun livreur disponible.</Text>
          ) : (
            <>
              <View style={modal.chipsRow}>
                <TouchableOpacity
                  style={[modal.chip, !selectedLivreur && modal.chipActive]}
                  onPress={() => handleSelectLivreur(null)}
                >
                  <Text style={[modal.chipText, !selectedLivreur && modal.chipTextActive]}>Aucun</Text>
                </TouchableOpacity>
                {livreurs.filter(l => l.type_livreur === 'frais' || l.type_livreur === 'les_deux').map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={[modal.chip, selectedLivreur === l.id && modal.chipActive]}
                    onPress={() => handleSelectLivreur(l.id)}
                  >
                    <Text style={[modal.chipText, selectedLivreur === l.id && modal.chipTextActive]}>
                      {[l.prenom, l.nom].filter(Boolean).join(' ') || 'Livreur'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {savingLivreur && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.sm }} />
              )}
            </>
          )}
        </View>

        {/* Livreur Surgelé assigné */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Livreur Surgelé assigné</Text>
          {livreurs.filter(l => l.type_livreur === 'surgele' || l.type_livreur === 'les_deux').length === 0 ? (
            <Text style={modal.emptyOrders}>Aucun livreur disponible.</Text>
          ) : (
            <>
              <View style={modal.chipsRow}>
                <TouchableOpacity
                  style={[modal.chip, !selectedLivreurSurgele && modal.chipActive]}
                  onPress={() => handleSelectLivreurSurgele(null)}
                >
                  <Text style={[modal.chipText, !selectedLivreurSurgele && modal.chipTextActive]}>Aucun</Text>
                </TouchableOpacity>
                {livreurs.filter(l => l.type_livreur === 'surgele' || l.type_livreur === 'les_deux').map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={[modal.chip, selectedLivreurSurgele === l.id && modal.chipActive]}
                    onPress={() => handleSelectLivreurSurgele(l.id)}
                  >
                    <Text style={[modal.chipText, selectedLivreurSurgele === l.id && modal.chipTextActive]}>
                      {[l.prenom, l.nom].filter(Boolean).join(' ') || 'Livreur'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {savingLivreurSurgele && (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.sm }} />
              )}
            </>
          )}
        </View>

        <View style={modal.section}>
          <TouchableOpacity onPress={() => setShowPrices(!showPrices)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={modal.sectionTitle}>{`Prix personnalisés ${showPrices ? '▾' : '▸'}`}</Text>
          </TouchableOpacity>
          {showPrices && (
            <>
              {products.map(p => {
                const hasCustom = clientPrices[p.id] !== undefined;
                const displayPrice = hasCustom ? clientPrices[p.id] : String(p.prix_unitaire_ht);
                return (
                  <View key={p.id} style={modal.priceRow}>
                    <Text style={modal.priceName} numberOfLines={1}>{p.nom}</Text>
                    <View style={modal.priceInputWrap}>
                      <TextInput
                        style={modal.priceInput}
                        value={displayPrice}
                        onChangeText={v => setClientPrices(prev => ({ ...prev, [p.id]: v }))}
                        keyboardType="decimal-pad"
                        placeholder={String(p.prix_unitaire_ht)}
                        placeholderTextColor={colors.textLight}
                      />
                      <Text style={modal.priceUnit}>€ HT</Text>
                    </View>
                  </View>
                );
              })}
              <View style={{ marginTop: spacing.sm }}>
                <Button title="Sauvegarder les prix" onPress={handleSavePrices}
                  loading={savingPrices} disabled={savingPrices} fullWidth size="sm" />
              </View>
            </>
          )}
        </View>

        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Statut du compte</Text>
          <TouchableOpacity
            style={[modal.toggleBtn, isActif ? modal.toggleBtnDanger : modal.toggleBtnSuccess]}
            onPress={handleToggleActif} disabled={toggling} activeOpacity={0.8}
          >
            {toggling
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={modal.toggleBtnText}>
                {isActif ? 'Désactiver le compte' : 'Réactiver le compte'}
              </Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[modal.toggleBtn, modal.toggleBtnDelete]}
            onPress={() => setConfirmDelete(true)}
            activeOpacity={0.8}
          >
            <Text style={modal.toggleBtnText}>Supprimer le compte</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmDelete}
        title="Supprimer DÉFINITIVEMENT"
        message={`ATTENTION : Vous allez supprimer toutes les données de ${displayName}.\n\nCette action est irréversible et supprimera le profil de la base de données.`}
        confirmLabel="Supprimer pour de bon"
        cancelLabel="Annuler"
        danger
        loading={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}

function FormField({ label, value, onChangeText, placeholder, style, ...rest }) {
  return (
    <View style={modal.fieldWrap}>
      <Text style={modal.fieldLabel}>{label}</Text>
      <TextInput
        style={[modal.fieldInput, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        {...rest}
      />
    </View>
  );
}

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
  excelBtn: {
    backgroundColor: '#217346',
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  excelBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSizes.sm },
  refreshText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },

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

  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  rowInactive: { opacity: 0.6 },
  rowCol: { flexDirection: 'column', justifyContent: 'center' },
  rowColFlex: { flex: 1 },
  rowName: { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  rowEmail: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  rowMeta: { fontSize: fontSizes.xs, color: colors.textSecondary },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    minWidth: 60,
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
    maxWidth: 720,
    maxHeight: '90%',
    alignSelf: 'center',
  },
});



const modal = StyleSheet.create({
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
  headerName: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  headerBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.round },
  headerBadgeText: { fontSize: fontSizes.xs, fontWeight: '600' },
  closeBtn: { padding: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  closeText: { fontSize: fontSizes.lg, color: colors.textSecondary, fontWeight: '600' },

  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  section: { marginBottom: spacing.sm },
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

  row2: { flexDirection: 'row', gap: spacing.sm },
  fieldWrap: { flex: 1, marginBottom: spacing.sm },
  fieldLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },

  toggleBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  toggleBtnDanger: { backgroundColor: colors.error },
  toggleBtnSuccess: { backgroundColor: colors.success },
  toggleBtnDelete: { backgroundColor: '#6B2D2D', marginTop: spacing.sm },
  toggleBtnText: { color: colors.white, fontWeight: '600', fontSize: fontSizes.sm },

  emptyOrders: { fontSize: fontSizes.sm, color: colors.textSecondary, fontStyle: 'italic', paddingVertical: spacing.sm },

  monthBox: {
    backgroundColor: colors.secondary, padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  monthLabel: { fontSize: fontSizes.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  monthTotal: { fontSize: fontSizes.xl, fontWeight: '800', color: colors.primary, marginTop: 4 },
  monthSub: { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 2 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingVertical: 6, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.secondary },
  chipText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  priceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  priceName: { flex: 1, fontSize: fontSizes.sm, color: colors.textPrimary, marginRight: spacing.sm },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  priceInput: {
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 8,
    fontSize: fontSizes.sm, color: colors.textPrimary, width: 90, textAlign: 'right',
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  priceUnit: { fontSize: fontSizes.xs, color: colors.textSecondary },
});
