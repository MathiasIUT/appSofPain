# Admin Clients Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter la section "Clients" dans le dashboard admin — liste des clients, modal de détail avec édition des coordonnées, activation/désactivation du compte, et historique des commandes.

**Architecture:** Un seul fichier `AdminClientsScreen.js` suivant le pattern exact d'`AdminOrdersScreen.js`. Migration SQL pour ajouter `actif boolean` à `profiles`. Modifications légères de `AdminDashboard.js` et `LoginScreen.js`.

**Tech Stack:** React Native (Expo / web), Supabase JS client, StyleSheet (pas de lib externe)

> **Note tests:** Ce projet n'a pas de framework de tests automatisés. Les étapes de vérification sont manuelles (lancer l'app et tester dans le navigateur via `npx expo start --web`).

---

## Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `sql/07_profiles_actif.sql` | Créer — migration colonne actif |
| `src/screens/AdminClientsScreen.js` | Créer — écran complet (liste + modal) |
| `src/screens/AdminDashboard.js` | Modifier — brancher AdminClientsScreen sur `case 'clients'` |
| `src/screens/LoginScreen.js` | Modifier — vérifier `actif` après login réussi |

---

## Task 1 : Migration SQL — colonne `actif` sur `profiles`

**Files:**
- Create: `sql/07_profiles_actif.sql`

- [ ] **Créer le fichier de migration**

Contenu exact de `sql/07_profiles_actif.sql` :

```sql
-- Ajout de la colonne actif sur profiles
-- Tous les comptes existants restent actifs par défaut
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;
```

- [ ] **Exécuter dans Supabase**

Aller dans le dashboard Supabase → SQL Editor → coller et exécuter le contenu du fichier.
Vérifier qu'aucune erreur n'apparaît. La colonne doit apparaître dans Table Editor > profiles.

- [ ] **Commit**

```bash
git add sql/07_profiles_actif.sql
git commit -m "feat(sql): ajout colonne actif sur profiles"
```

---

## Task 2 : Créer `AdminClientsScreen.js`

**Files:**
- Create: `src/screens/AdminClientsScreen.js`

- [ ] **Créer le fichier avec le contenu complet suivant**

```javascript
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

// ─── Écran principal ─────────────────────────────────────────────────────────

export default function AdminClientsScreen() {
  const [clients, setClients]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('tous');
  const [search, setSearch]             = useState('');
  const [selectedClient, setSelected]   = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Erreur chargement clients :', err);
      showAlert('Erreur', 'Impossible de charger les clients.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  const filtered = clients
    .filter((c) => {
      if (filter === 'actifs')   return c.actif !== false;
      if (filter === 'inactifs') return c.actif === false;
      return true;
    })
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.nom_societe?.toLowerCase().includes(q) ||
        c.nom?.toLowerCase().includes(q) ||
        c.prenom?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    });

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
          <Text style={styles.screenCount}>{filtered.length} / {clients.length}</Text>
        </View>
        <TouchableOpacity onPress={loadClients} style={styles.refreshBtn} activeOpacity={0.7}>
          <Text style={styles.refreshText}>↻ Actualiser</Text>
        </TouchableOpacity>
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
          const count = f.key === 'tous'
            ? clients.length
            : f.key === 'actifs'
              ? clients.filter((c) => c.actif !== false).length
              : clients.filter((c) => c.actif === false).length;
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
              <View style={[styles.filterCount, active && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{count}</Text>
              </View>
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

// ─── Modal détail client ─────────────────────────────────────────────────────

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

  const isActif = client.actif !== false;
  const changed = Object.keys(form).some((k) => form[k] !== initial[k]);

  useEffect(() => {
    (async () => {
      setLoadingOrders(true);
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('client_id', client.id)
          .order('date_commande', { ascending: false });
        if (error) throw error;
        setOrders(data || []);
      } catch (err) {
        console.error('Erreur chargement commandes client :', err);
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
          nom:         form.nom         || null,
          prenom:      form.prenom      || null,
          nom_societe: form.nom_societe || null,
          email:       form.email       || null,
          telephone:   form.telephone   || null,
          adresse:     form.adresse     || null,
          code_postal: form.code_postal || null,
          ville:       form.ville       || null,
          siret:       form.siret       || null,
        })
        .eq('id', client.id)
        .select('*')
        .single();
      if (error) throw error;
      onUpdated(data);
      showAlert('Succès', 'Profil client mis à jour.');
    } catch (err) {
      console.error('Erreur mise à jour client :', err);
      showAlert('Erreur', 'Impossible de mettre à jour le client.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActif = () => {
    const displayName = client.nom_societe || client.email || 'ce client';
    const msg = isActif
      ? `Désactiver le compte de ${displayName} ? Il ne pourra plus se connecter.`
      : `Réactiver le compte de ${displayName} ?`;
    confirmAction(msg, async () => {
      setToggling(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ actif: !isActif })
          .eq('id', client.id)
          .select('*')
          .single();
        if (error) throw error;
        onUpdated(data);
        showAlert('Succès', isActif ? 'Compte désactivé.' : 'Compte réactivé.');
      } catch (err) {
        console.error('Erreur toggle actif :', err);
        showAlert('Erreur', 'Impossible de modifier le statut du compte.');
      } finally {
        setToggling(false);
      }
    });
  };

  const setField = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const displayName = client.nom_societe
    || [client.prenom, client.nom].filter(Boolean).join(' ')
    || client.email || '—';

  return (
    <View style={modal.container}>

      {/* ── Header ─────────────────────────────────────────── */}
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

      {/* ── Body ───────────────────────────────────────────── */}
      <ScrollView style={modal.body} contentContainerStyle={modal.bodyContent} showsVerticalScrollIndicator={false}>

        {/* Informations ─────────────────────────────────── */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Informations</Text>
          <View style={modal.row2}>
            <FormField label="Prénom"    value={form.prenom}     onChangeText={setField('prenom')}     placeholder="Prénom" />
            <FormField label="Nom"       value={form.nom}        onChangeText={setField('nom')}        placeholder="Nom" />
          </View>
          <FormField label="Société"     value={form.nom_societe} onChangeText={setField('nom_societe')} placeholder="Nom de la société" />
          <FormField label="Email"       value={form.email}      onChangeText={setField('email')}      placeholder="email@exemple.fr" keyboardType="email-address" autoCapitalize="none" />
          <FormField label="Téléphone"   value={form.telephone}  onChangeText={setField('telephone')}  placeholder="06 00 00 00 00" keyboardType="phone-pad" />
          <FormField label="SIRET"       value={form.siret}      onChangeText={setField('siret')}      placeholder="000 000 000 00000" />
        </View>

        {/* Adresse ──────────────────────────────────────── */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Adresse</Text>
          <FormField label="Adresse"     value={form.adresse}    onChangeText={setField('adresse')}    placeholder="1 rue de la Boulangerie" />
          <View style={modal.row2}>
            <FormField label="Code postal" value={form.code_postal} onChangeText={setField('code_postal')} placeholder="75000" keyboardType="numeric" />
            <FormField label="Ville"       value={form.ville}       onChangeText={setField('ville')}       placeholder="Paris" />
          </View>
        </View>

        {changed && (
          <Button
            title="Enregistrer les modifications"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            fullWidth
            size="lg"
          />
        )}

        {/* Statut du compte ─────────────────────────────── */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Statut du compte</Text>
          <TouchableOpacity
            style={[modal.toggleBtn, isActif ? modal.toggleBtnDanger : modal.toggleBtnSuccess]}
            onPress={handleToggleActif}
            disabled={toggling}
            activeOpacity={0.8}
          >
            {toggling
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={modal.toggleBtnText}>
                  {isActif ? '🔒 Désactiver le compte' : '✅ Réactiver le compte'}
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Historique commandes ─────────────────────────── */}
        <View style={modal.section}>
          <Text style={modal.sectionTitle}>Historique des commandes ({orders.length})</Text>
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
                    <Text style={modal.orderNum}>N° {o.numero}</Text>
                    <Text style={modal.orderDate}>{fmt(o.date_commande)}</Text>
                  </View>
                  <Text style={modal.orderTotal}>{n2(o.total_ttc)} €</Text>
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

// ─── Sous-composant champ formulaire ─────────────────────────────────────────

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
  screenTitle:  { fontSize: fontSizes.xl, fontWeight: '700', color: colors.textPrimary },
  screenCount:  { fontSize: fontSizes.sm, color: colors.textSecondary },
  refreshBtn:   { ...Platform.select({ web: { cursor: 'pointer' } }) },
  refreshText:  { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '500' },

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
  rowInactive: { opacity: 0.6 },
  rowCol:      { flexDirection: 'column', justifyContent: 'center' },
  rowColFlex:  { flex: 1 },
  rowName:     { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  rowEmail:    { fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: 1 },
  rowMeta:     { fontSize: fontSizes.xs, color: colors.textSecondary },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  modalBoxDesktop: {
    borderRadius: 16,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    paddingVertical: Platform.OS === 'web' ? spacing.sm : 10,
    fontSize: fontSizes.sm,
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
  orderTotal:     { fontSize: fontSizes.sm, fontWeight: '600', color: colors.primary },
  orderBadge:     { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.round, minWidth: 90, alignItems: 'center' },
  orderBadgeText: { fontSize: fontSizes.xs, fontWeight: '600' },
});
```

- [ ] **Vérifier manuellement**

Lancer l'app (`npx expo start --web`), se connecter en admin, aller sur la section "Clients".
- La liste se charge et affiche les clients
- La barre de recherche filtre en temps réel
- Les chips Tous / Actifs / Inactifs fonctionnent
- Cliquer sur un client ouvre le modal
- Le formulaire affiche les coordonnées du client
- Le bouton "Enregistrer" n'apparaît que si on modifie un champ
- Le bouton désactiver/réactiver demande confirmation

- [ ] **Commit**

```bash
git add src/screens/AdminClientsScreen.js
git commit -m "feat(admin): écran gestion clients avec liste, recherche, filtres et modal"
```

---

## Task 3 : Brancher AdminClientsScreen dans AdminDashboard

**Files:**
- Modify: `src/screens/AdminDashboard.js`

- [ ] **Ajouter l'import et remplacer le case 'clients'**

Remplacer les lignes 1-9 de `src/screens/AdminDashboard.js` :

```javascript
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AdminLayout from '../components/AdminLayout';
import AdminProductsScreen from './AdminProductsScreen';
import AdminOrdersScreen from './AdminOrdersScreen';
import AdminClientsScreen from './AdminClientsScreen';
import { colors, spacing, fontSizes } from '../config/theme';
```

Remplacer le `renderSection` (lignes 14-27) :

```javascript
  const renderSection = () => {
    switch (currentSection) {
      case 'products':
        return <AdminProductsScreen />;
      case 'orders':
        return <AdminOrdersScreen />;
      case 'clients':
        return <AdminClientsScreen />;
      case 'stats':
        return <ComingSoon section={currentSection} />;
      default:
        return <AdminProductsScreen />;
    }
  };
```

- [ ] **Vérifier manuellement**

Recharger l'app, aller sur la section "Clients" — l'écran doit s'afficher (plus le "Coming Soon").

- [ ] **Commit**

```bash
git add src/screens/AdminDashboard.js
git commit -m "feat(admin): brancher AdminClientsScreen sur la section clients"
```

---

## Task 4 : Vérification `actif` au login

**Files:**
- Modify: `src/screens/LoginScreen.js`

- [ ] **Modifier la requête de profil et ajouter la vérification**

Dans `src/screens/LoginScreen.js`, remplacer la ligne 83 (select du profil) :

```javascript
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, actif, nom, prenom, nom_societe')
        .eq('id', authData.user.id)
        .single();
```

Après le `if (profileError)` block (après la ligne 90), ajouter la vérification actif avant le switch de navigation :

```javascript
      if (profile.actif === false) {
        await supabase.auth.signOut();
        showAlert(
          'Compte désactivé',
          'Votre compte a été désactivé. Contactez l\'administrateur.'
        );
        return;
      }
```

Le bloc `handleLogin` complet doit ressembler à ceci à partir de la ligne 62 :

```javascript
  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        if (authError.message.includes('Email not confirmed')) {
          showAlert(
            'Compte non confirmé',
            'Vous devez d\'abord confirmer votre email. Vérifiez votre boîte mail.'
          );
        } else if (authError.message.includes('Invalid login credentials')) {
          showAlert('Erreur', 'Email ou mot de passe incorrect.');
        } else {
          showAlert('Erreur', authError.message);
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, actif, nom, prenom, nom_societe')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        showAlert('Erreur', 'Impossible de récupérer votre profil.');
        return;
      }

      if (profile.actif === false) {
        await supabase.auth.signOut();
        showAlert(
          'Compte désactivé',
          'Votre compte a été désactivé. Contactez l\'administrateur.'
        );
        return;
      }

      if (profile.role === 'admin') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'AdminDashboard' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ClientHome' }],
        });
      }
    } catch (err) {
      showAlert('Erreur', 'Une erreur inattendue est survenue.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Vérifier manuellement**

1. Dans Supabase Table Editor, mettre `actif = false` sur un compte client de test.
2. Tenter de se connecter avec ce compte — un message "Compte désactivé" doit apparaître.
3. Remettre `actif = true` — la connexion doit fonctionner normalement.
4. Vérifier que la connexion admin n'est pas affectée.

- [ ] **Commit**

```bash
git add src/screens/LoginScreen.js
git commit -m "feat(auth): bloquer la connexion des comptes clients désactivés"
```

---

## Récapitulatif des commits

| # | Message | Fichiers |
|---|---|---|
| 1 | `feat(sql): ajout colonne actif sur profiles` | `sql/07_profiles_actif.sql` |
| 2 | `feat(admin): écran gestion clients avec liste, recherche, filtres et modal` | `src/screens/AdminClientsScreen.js` |
| 3 | `feat(admin): brancher AdminClientsScreen sur la section clients` | `src/screens/AdminDashboard.js` |
| 4 | `feat(auth): bloquer la connexion des comptes clients désactivés` | `src/screens/LoginScreen.js` |
