import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import ClientTabBar from '../components/ClientTabBar';

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function ClientProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    nom_societe: '',
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    siret: '',
    note_interne_client: '',
  });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      setProfile(data);
      setForm({
        nom: data.nom || '',
        prenom: data.prenom || '',
        nom_societe: data.nom_societe || '',
        telephone: data.telephone || '',
        adresse: data.adresse || '',
        code_postal: data.code_postal || '',
        ville: data.ville || '',
        siret: data.siret || '',
        note_interne_client: data.note_interne_client || '',
      });
    } catch (err) {
      console.error('Erreur chargement profil :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const initial = profile ? {
    nom: profile.nom || '',
    prenom: profile.prenom || '',
    nom_societe: profile.nom_societe || '',
    telephone: profile.telephone || '',
    adresse: profile.adresse || '',
    code_postal: profile.code_postal || '',
    ville: profile.ville || '',
    siret: profile.siret || '',
    note_interne_client: profile.note_interne_client || '',
  } : form;

  const changed = Object.keys(form).some((k) => form[k] !== initial[k]);

  const setField = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const handleExportData = () => {
    const { notes_admin, ...sanitizedProfile } = profile || {};

    const data = {
      profile: sanitizedProfile,
      export_date: new Date().toISOString(),
      info: "Ceci est l'intégralité de vos données personnelles conservées par SofPain"
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;

    if (Platform.OS === 'web') {
      const link = document.createElement("a");
      link.href = jsonString;
      link.download = `donnees_sofpain_${profile?.nom || 'client'}.json`;
      link.click();
    } else {
      showAlert('Portabilité', 'Sur mobile, contactez le support pour recevoir votre export JSON par email.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('profiles')
        .update({
          nom: form.nom.trim(),
          prenom: form.prenom.trim(),
          nom_societe: form.nom_societe.trim(),
          telephone: form.telephone.trim(),
          adresse: form.adresse.trim(),
          code_postal: form.code_postal.trim(),
          ville: form.ville.trim(),
          siret: form.siret.trim(),
          note_interne_client: form.note_interne_client.trim(),
        })
        .eq('id', user.id);
      if (error) throw error;
      await loadProfile();
      showAlert('Succès', 'Votre profil a été mis à jour.');
    } catch (err) {
      console.error('Erreur MAJ profil :', err);
      showAlert('Erreur', 'Impossible de mettre à jour le profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Session expirée, veuillez vous reconnecter.');
      const snapshot = profile?.nom_societe
        || [profile?.prenom, profile?.nom].filter(Boolean).join(' ')
        || 'Client supprimé';
      const { error: ordersError } = await supabase.from('orders')
        .update({ client_nom: snapshot, client_uuid_snapshot: user.id, client_id: null })
        .eq('client_id', user.id);
      if (ordersError) console.warn('Avertissement orders :', ordersError.message);
      await supabase.from('client_prices').delete().eq('client_id', user.id);
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (deleteError) throw deleteError;
      await supabase.auth.signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      console.error('Erreur suppression compte :', err);
      setConfirmDelete(false);
      setDeleting(false);
      showAlert('Erreur de suppression', err.message || 'Impossible de supprimer vos données. Contactez l\'administrateur.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = profile?.nom_societe
    || [profile?.prenom, profile?.nom].filter(Boolean).join(' ')
    || '—';

  const initials = (
    (profile?.prenom?.[0] || '') + (profile?.nom?.[0] || '')
  ).toUpperCase() || (profile?.nom_societe?.[0] || '?').toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>‹ Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon profil</Text>
        <View style={{ width: 70 }} />
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* ── Carte identité ── */}
        <View style={styles.identityCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          {profile?.nom_societe && (
            <View style={styles.societeBadge}>
              <Text style={styles.societeBadgeText}>{profile.nom_societe}</Text>
            </View>
          )}
          {profile?.email ? (
            <Text style={styles.emailText}>{profile.email}</Text>
          ) : null}
          <View style={[
            styles.statusBadge,
            { backgroundColor: profile?.actif !== false ? colors.success + '18' : colors.error + '18' }
          ]}>
            <Text style={[
              styles.statusText,
              { color: profile?.actif !== false ? colors.success : colors.error }
            ]}>
              {profile?.actif !== false ? 'Compte actif' : 'Compte inactif'}
            </Text>
          </View>
        </View>

        {/* ── Section : Informations personnelles ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>

          <View style={styles.row2}>
            <FormField
              label="Prénom"
              value={form.prenom}
              onChangeText={setField('prenom')}
              placeholder="Votre prénom"
            />
            <FormField
              label="Nom"
              value={form.nom}
              onChangeText={setField('nom')}
              placeholder="Votre nom"
            />
          </View>

          <FormField
            label="Nom de société"
            value={form.nom_societe}
            onChangeText={setField('nom_societe')}
            placeholder="Raison sociale"
          />
          <FormField
            label="Téléphone"
            value={form.telephone}
            onChangeText={setField('telephone')}
            placeholder="06 00 00 00 00"
            keyboardType="phone-pad"
          />
          <FormField
            label="SIRET"
            value={form.siret}
            onChangeText={setField('siret')}
            placeholder="000 000 000 00000"
          />
          <FormField
            label="Note pour l'administrateur"
            value={form.note_interne_client}
            onChangeText={setField('note_interne_client')}
            placeholder="Écrivez un message ou une consigne pour l'équipe..."
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
        </View>

        {/* ── Section : Adresse ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Adresse de livraison</Text>

          <FormField
            label="Adresse"
            value={form.adresse}
            onChangeText={setField('adresse')}
            placeholder="1 rue de la Boulangerie"
          />
          <View style={styles.row2}>
            <FormField
              label="Code postal"
              value={form.code_postal}
              onChangeText={setField('code_postal')}
              placeholder="75000"
              keyboardType="numeric"
            />
            <FormField
              label="Ville"
              value={form.ville}
              onChangeText={setField('ville')}
              placeholder="Paris"
            />
          </View>
        </View>

        {/* ── Section : Portabilité ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mes données</Text>
          <Text style={styles.infoText}>
            Vous pouvez télécharger une copie de toutes vos données personnelles.
          </Text>
          <TouchableOpacity
            style={styles.exportBtn}
            onPress={handleExportData}
            activeOpacity={0.7}
          >
            <Text style={styles.exportBtnText}>Exporter mes données (.json)</Text>
          </TouchableOpacity>
        </View>

        {/* ── Bouton enregistrer ── */}
        {changed && (
          <View style={styles.saveWrap}>
            <Button
              title="Enregistrer les modifications"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
              fullWidth
              size="lg"
            />
          </View>
        )}

        {/* ── Section : Zone dangereuse ── */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerTitle}>Zone dangereuse</Text>
          <Text style={styles.dangerDesc}>
            La suppression de votre compte est irréversible. Toutes vos données
            (commandes, historique) seront conservées par l'administrateur pour
            des raisons comptables, mais vous ne pourrez plus vous connecter.
          </Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setConfirmDelete(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteBtnText}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl * 2 }} />
        </ScrollView>
      </View>

      {/* ── Modal confirmation suppression ── */}
      <ConfirmModal
        visible={confirmDelete}
        title="Supprimer mon compte"
        message={`Êtes-vous sûr de vouloir supprimer le compte de ${displayName} ?\n\nCette action désactivera définitivement votre accès à l'application.`}
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
        danger
        loading={deleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />

      <ClientTabBar navigation={navigation} currentRoute="ClientProfile" />
    </SafeAreaView>
  );
}

function FormField({ label, value, onChangeText, placeholder, style, ...rest }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, style]}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  backBtn: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  backText: {
    fontSize: fontSizes.md,
    color: colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
  },
  identityCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
  },
  displayName: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  societeBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    marginBottom: spacing.sm,
  },
  societeBadgeText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  emailText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
  },
  statusText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.primary,
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  row2: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fieldWrap: {
    flex: 1,
    marginBottom: spacing.sm,
  },
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

  infoText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  exportBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  exportBtnText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  saveWrap: {
    marginBottom: spacing.md,
  },
  dangerSection: {
    backgroundColor: colors.error + '08',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.error + '30',
    marginTop: spacing.sm,
  },
  dangerTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.error,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dangerDesc: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  deleteBtn: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  deleteBtnText: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
});
