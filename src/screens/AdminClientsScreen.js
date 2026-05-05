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

// ─── Constantes ──────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'tous',     label: 'Tous' },
  { key: 'actifs',   label: 'Actifs' },
  { key: 'inactifs', label: 'Inactifs' },
];

const ORDER_STATUS_LABELS = {
  nouvelle:       'Nouvelle',
  en_preparation: 'En préparation',
  en_livraison:   'En livraison',
  livree:         'Livrée',
  annulee:        'Annulée',
};

const ORDER_STATUS_COLORS = {
  nouvelle:       '#2196F3',
  en_preparation: '#FF9800',
  en_livraison:   '#00BCD4',
  livree:         '#4CAF50',
  annulee:        '#E53935',
};

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

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function AdminClientsScreen() {
  const [clients, setClients]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [filter, setFilter]             = useState('tous');
  const [search, setSearch]             = useState('');
  const [totalCount, setTotalCount]     = useState(0);
  const [selectedClient, setSelected]   = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
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

      // Filtre actif/inactif côté serveur
      if (filter === 'actifs') query = query.neq('actif', false);
      if (filter === 'inactifs') query = query.eq('actif', false);

      // Recherche côté serveur
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

  // Recharger quand le filtre ou la recherche change
  useEffect(() => { loadClients(true); }, [filter, debouncedSearch]);

  const hasMore = clients.length < totalCount;
  const filtered = clients; // Le filtrage est maintenant côté serveur

  const openClient = (client) => {
    setSelected(client);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelected(null);
  };

  const handleClientUpdated = (updated) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
  };

  return (
    <View style={styles.container}>

      {/* ── Barre du haut ──────────────────────────────────── */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.screenTitle}>Clients</Text>
          <Text style={styles.screenCount}>{`${clients.length} / ${totalCount}`}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => loadClients(true)} style={styles.refreshBtn} activeOpacity={0.7}>
            <Text style={styles.refreshText}>↻ Actualiser</Text>
          </TouchableOpacity>
          <Button title="+ Créer un client" onPress={() => setCreateVisible(true)} size="sm" />
        </View>
      </View>

      {/* ── Recherche ───────────────────────────────────────── */}
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

      {/* ── Filtres ─────────────────────────────────────────── */}
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

      {/* ── Liste ───────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>👥</Text>
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

      {/* ── Modal détail ────────────────────────────────────── */}
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
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal création ────────────────────────────────── */}
      <CreateClientModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={() => loadClients(true)}
      />
    </View>
  );
}

// ─── Ligne client ────────────────────────────────────────────────────────────

function ClientRow({ item, onPress }) {
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
}

function ClientDetailModal({ client, onClose, onUpdated }) {
  const initial = {
    nom:         client.nom         || '',
    prenom:      client.prenom      || '',
    nom_societe: client.nom_societe || '',
    email:       client.email       || '',
    telephone:   client.telephone   || '',
    adresse:     client.adresse     || '',
    code_postal: client.code_postal || '',
    ville:       client.ville       || '',
    siret:       client.siret       || '',
  };

  const [form, setForm]                   = useState(initial);
  const [saving, setSaving]               = useState(false);
  const [toggling, setToggling]           = useState(false);
  const [orders, setOrders]               = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [livreurs, setLivreurs]           = useState([]);
  const [selectedLivreur, setSelectedLivreur] = useState(client.livreur_id || null);
  const [savingLivreur, setSavingLivreur] = useState(false);
  const [clientPrices, setClientPrices]   = useState({});
  const [products, setProducts]           = useState([]);
  const [savingPrices, setSavingPrices]   = useState(false);
  const [showPrices, setShowPrices]       = useState(false);

  const isActif = client.actif !== false;
  const changed = Object.keys(form).some((k) => form[k] !== initial[k]);

  // Monthly HT total
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthOrders = orders.filter(o => o.date_commande >= monthStart && o.statut !== 'annulee');
  const monthTotalHt = monthOrders.reduce((acc, o) => acc + Number(o.total_ht || 0), 0);

  useEffect(() => {
    (async () => {
      setLoadingOrders(true);
      try {
        const [ordRes, livRes, prodRes, pricesRes] = await Promise.all([
          supabase.from('orders').select('*').eq('client_id', client.id)
            .order('date_commande', { ascending: false }),
          supabase.from('livreurs').select('id, nom, prenom').eq('actif', true),
          supabase.from('products').select('id, nom, prix_unitaire_ht').eq('actif', true).order('nom'),
          supabase.from('client_prices').select('*').eq('client_id', client.id),
        ]);
        setOrders(ordRes.data || []);
        setLivreurs(livRes.data || []);
        setProducts(prodRes.data || []);
        const priceMap = {};
        (pricesRes.data || []).forEach(p => { priceMap[p.product_id] = String(p.prix_unitaire_ht); });
        setClientPrices(priceMap);
      } catch (err) {
        console.error('Erreur chargement données client :', err);
      } finally {
        setLoadingOrders(false);
      }
    })();
  }, [client.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          nom: form.nom.trim(), 
          prenom: form.prenom.trim(),
          nom_societe: form.nom_societe.trim(), 
          email: form.email.trim(),
          telephone: form.telephone.trim(), 
          adresse: form.adresse.trim(),
          code_postal: form.code_postal.trim(), 
          ville: form.ville.trim(),
          siret: form.siret.trim(),
        })
        .eq('id', client.id).select('*').single();
      if (error) throw error;
      onUpdated(data);
      showAlert('Succès', 'Profil client mis à jour.');
    } catch (err) {
      console.error('Erreur MAJ client:', err);
      showAlert('Erreur', 'Détail : ' + (err.message || JSON.stringify(err)));
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
      onUpdated(data);
      // Optional: showAlert('Succès', 'Livreur assigné mis à jour.');
    } catch (err) {
      showAlert('Erreur', 'Impossible de changer le livreur.');
    } finally { setSavingLivreur(false); }
  };

  const handleSavePrices = async () => {
    setSavingPrices(true);
    try {
      // Delete existing custom prices
      await supabase.from('client_prices').delete().eq('client_id', client.id);
      // Insert new custom prices that differ from defaults
      const rows = [];
      for (const [productId, price] of Object.entries(clientPrices)) {
        const p = parseFloat(price);
        const prod = products.find(pr => pr.id === productId);
        if (!isNaN(p) && p >= 0 && prod && Math.abs(p - Number(prod.prix_unitaire_ht)) > 0.001) {
          rows.push({ client_id: client.id, product_id: productId, prix_unitaire_ht: p });
        }
      }
      if (rows.length > 0) await supabase.from('client_prices').insert(rows);
      showAlert('Succès', `${rows.length} prix personnalisé(s) enregistré(s).`);
    } catch (err) {
      showAlert('Erreur', 'Impossible de sauvegarder les prix.');
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

  const setField = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const displayName = client.nom_societe
    || [client.prenom, client.nom].filter(Boolean).join(' ')
    || client.email || '—';

  const livreurChanged = selectedLivreur !== (client.livreur_id || null);

  return (
    <View style={modal.container}>
      {/* Header */}
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

        {/* Total du mois */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Total du mois en cours</Text>
          <View style={modal.monthBox}>
            <Text style={modal.monthLabel}>
              {now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </Text>
            <Text style={modal.monthTotal}>{`${monthTotalHt.toFixed(2)} € HT`}</Text>
            <Text style={modal.monthSub}>
              {`${monthOrders.length} commande${monthOrders.length > 1 ? 's' : ''} (hors annulées)`}
            </Text>
          </View>
        </View>

        {/* Informations */}
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

        {/* Adresse */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Adresse</Text>
          <FormField label="Adresse" value={form.adresse} onChangeText={setField('adresse')} placeholder="1 rue de la Boulangerie" />
          <View style={modal.row2}>
            <FormField label="Code postal" value={form.code_postal} onChangeText={setField('code_postal')} placeholder="75000" keyboardType="numeric" />
            <FormField label="Ville" value={form.ville} onChangeText={setField('ville')} placeholder="Paris" />
          </View>
        </View>

        {changed && (
          <Button title="Enregistrer les modifications" onPress={handleSave}
            loading={saving} disabled={saving} fullWidth size="lg" />
        )}

        {/* Livreur assigné */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Livreur assigné</Text>
          {livreurs.length === 0 ? (
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
                {livreurs.map(l => (
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

        {/* Prix personnalisés */}
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

        {/* Statut du compte */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Statut du compte</Text>
          <TouchableOpacity
            style={[modal.toggleBtn, isActif ? modal.toggleBtnDanger : modal.toggleBtnSuccess]}
            onPress={handleToggleActif} disabled={toggling} activeOpacity={0.8}
          >
            {toggling
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={modal.toggleBtnText}>
                  {isActif ? '🔒 Désactiver le compte' : '✅ Réactiver le compte'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Historique commandes */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>{`Historique des commandes (${orders.length})`}</Text>
          {loadingOrders ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : orders.length === 0 ? (
            <Text style={modal.emptyOrders}>Aucune commande pour ce client.</Text>
          ) : (
            orders.map((o, idx) => {
              const sColor = ORDER_STATUS_COLORS[o.statut] || colors.textSecondary;
              return (
                <View key={o.id} style={[modal.orderRow, idx % 2 === 1 && modal.orderRowAlt]}>
                  <View style={{ flex: 1 }}>
                    <Text style={modal.orderNum}>{`N° ${o.numero}`}</Text>
                    <Text style={modal.orderDate}>{fmt(o.date_commande)}</Text>
                  </View>
                  <Text style={modal.orderTotal}>{`${n2(o.total_ht)} € HT`}</Text>
                  <View style={[modal.orderBadge, { backgroundColor: sColor + '22' }]}>
                    <Text style={[modal.orderBadgeText, { color: sColor }]}>
                      {ORDER_STATUS_LABELS[o.statut] || o.statut}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

// ─── Champ formulaire ────────────────────────────────────────────────────────

function FormField({ label, value, onChangeText, placeholder, ...rest }) {
  return (
    <View style={modal.fieldWrap}>
      <Text style={modal.fieldLabel}>{label}</Text>
      <TextInput
        style={modal.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        {...rest}
      />
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
  topBarLeft:   { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  screenTitle:  { fontSize: fontSizes.xl, fontWeight: '800', color: colors.textPrimary },
  screenCount:  { fontSize: fontSizes.sm, color: colors.textSecondary },
  refreshBtn:   { ...Platform.select({ web: { cursor: 'pointer' } }) },
  refreshText:  { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },

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
  filterChipActive:      { borderColor: colors.primary, backgroundColor: colors.secondary },
  filterLabel:           { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: '500' },
  filterLabelActive:     { color: colors.primary, fontWeight: '700' },
  filterCount:           { backgroundColor: colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  filterCountActive:     { backgroundColor: colors.primary },
  filterCountText:       { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  filterCountTextActive: { color: colors.white },

  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  emptyIcon:   { fontSize: 36, marginBottom: spacing.sm },
  emptyText:   { fontSize: fontSizes.md, color: colors.textSecondary },

  list:        { padding: spacing.lg, paddingBottom: spacing.xxl },
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
  rowCol:      { flexDirection: 'column', justifyContent: 'center' },
  rowColFlex:  { flex: 1 },
  rowName:     { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  rowEmail:    { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  rowMeta:     { fontSize: fontSizes.xs, color: colors.textSecondary },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    minWidth: 60,
    alignItems: 'center',
  },
  badgeText: { fontSize: fontSizes.xs, fontWeight: '600' },
  arrow:     { fontSize: 20, color: colors.border, marginLeft: spacing.xs },

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

// ─── Styles modal ────────────────────────────────────────────────────────────

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
  headerName:      { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  headerBadge:     { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.round },
  headerBadgeText: { fontSize: fontSizes.xs, fontWeight: '600' },
  closeBtn:        { padding: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  closeText:       { fontSize: fontSizes.lg, color: colors.textSecondary, fontWeight: '600' },

  body:        { flex: 1 },
  bodyContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },

  section:      { marginBottom: spacing.sm },
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

  row2:       { flexDirection: 'row', gap: spacing.sm },
  fieldWrap:  { flex: 1, marginBottom: spacing.sm },
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
  toggleBtnDanger:  { backgroundColor: colors.error },
  toggleBtnSuccess: { backgroundColor: colors.success },
  toggleBtnText:    { color: colors.white, fontWeight: '600', fontSize: fontSizes.sm },

  emptyOrders: { fontSize: fontSizes.sm, color: colors.textSecondary, fontStyle: 'italic', paddingVertical: spacing.sm },

  orderRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9, paddingHorizontal: 4, borderRadius: borderRadius.sm },
  orderRowAlt:    { backgroundColor: colors.secondary },
  orderNum:       { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textPrimary },
  orderDate:      { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  orderTotal:     { fontSize: fontSizes.sm, fontWeight: '700', color: colors.primary },
  orderBadge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.round, minWidth: 90, alignItems: 'center' },
  orderBadgeText: { fontSize: fontSizes.xs, fontWeight: '600' },

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
