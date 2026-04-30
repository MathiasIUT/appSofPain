import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Platform, Alert,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import Button from './Button';

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function CreateClientModal({ visible, onClose, onCreated }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [form, setForm] = useState({
    nom_societe: '', siret: '', telephone: '', adresse: '',
    code_postal: '', ville: '', email: '', password: '',
    nom: '', prenom: '',
  });
  const [livreurId, setLivreurId] = useState(null);
  const [livreurs, setLivreurs] = useState([]);
  const [useCustomPrices, setUseCustomPrices] = useState(false);
  const [products, setProducts] = useState([]);
  const [customPrices, setCustomPrices] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Generate a unique identifier for clients without email
  const generateIdentifier = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return `cli_${id}@sofpain.local`;
  };

  useEffect(() => {
    if (!visible) return;
    // Reset form
    setForm({
      nom_societe: '', siret: '', telephone: '', adresse: '',
      code_postal: '', ville: '', email: '', password: '',
      nom: '', prenom: '',
    });
    setLivreurId(null);
    setUseCustomPrices(false);
    setCustomPrices({});
    setErrors({});

    // Load livreurs and products
    (async () => {
      const [livRes, prodRes] = await Promise.all([
        supabase.from('livreurs').select('id, nom, prenom').eq('actif', true),
        supabase.from('products').select('id, nom, prix_unitaire_ht').eq('actif', true).order('nom'),
      ]);
      setLivreurs(livRes.data || []);
      const prods = prodRes.data || [];
      setProducts(prods);
      const defaults = {};
      prods.forEach(p => { defaults[p.id] = String(p.prix_unitaire_ht); });
      setCustomPrices(defaults);
    })();
  }, [visible]);

  const setField = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.nom_societe.trim()) e.nom_societe = 'Requis';
    if (!form.telephone.trim()) e.telephone = 'Requis';
    if (!form.password || form.password.length < 6) e.password = 'Min. 6 caractères';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const email = form.email.trim() || generateIdentifier();
      // Create auth user via signUp
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            nom: form.nom.trim(),
            prenom: form.prenom.trim(),
            nom_societe: form.nom_societe.trim(),
            telephone: form.telephone.trim(),
          },
        },
      });
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Erreur création utilisateur');

      const { error: updateError } = await supabase.from('profiles').update({
        adresse: form.adresse.trim() || null,
        code_postal: form.code_postal.trim() || null,
        ville: form.ville.trim() || null,
        siret: form.siret.trim() || null,
        livreur_id: livreurId || null,
        email: email,
      }).eq('id', userId);

      if (updateError) throw updateError;

      // Insert custom prices if enabled
      if (useCustomPrices) {
        const rows = [];
        for (const [productId, price] of Object.entries(customPrices)) {
          const p = parseFloat(price);
          if (!isNaN(p) && p >= 0) {
            const defaultPrice = products.find(pr => pr.id === productId)?.prix_unitaire_ht;
            if (defaultPrice !== undefined && Math.abs(p - Number(defaultPrice)) > 0.001) {
              rows.push({ client_id: userId, product_id: productId, prix_unitaire_ht: p });
            }
          }
        }
        if (rows.length > 0) {
          await supabase.from('client_prices').insert(rows);
        }
      }

      const loginId = email.includes('@sofpain.local') ? email.split('@')[0] : email;
      showAlert('Client créé ✓',
        `Identifiant : ${email}\nMot de passe : ${form.password}\n\nTransmettez ces informations au client.`
      );
      onCreated?.();
      onClose();
    } catch (err) {
      console.error('Erreur création client :', err);
      showAlert('Erreur', err.message || 'Impossible de créer le client.');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (key, label, placeholder, opts = {}) => (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}{opts.required ? ' *' : ''}</Text>
      <TextInput
        style={[s.fieldInput, errors[key] && { borderColor: colors.error }]}
        value={form[key]}
        onChangeText={v => setField(key, v)}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        editable={!saving}
        {...(opts.inputProps || {})}
      />
      {errors[key] && <Text style={s.errorText}>{errors[key]}</Text>}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.box, isDesktop && s.boxDesktop]}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Créer un client</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.body} contentContainerStyle={s.bodyContent}>
            {/* Société */}
            <Text style={s.sectionTitle}>Société</Text>
            {renderField('nom_societe', 'Nom de société', 'Ex: Boulangerie Dupont', { required: true })}
            {renderField('siret', 'N° SIRET', '000 000 000 00000')}
            <View style={s.row}>
              {renderField('nom', 'Nom', 'Dupont')}
              {renderField('prenom', 'Prénom', 'Jean')}
            </View>

            {/* Contact */}
            <Text style={s.sectionTitle}>Contact</Text>
            {renderField('telephone', 'Téléphone', '06 00 00 00 00', { required: true, inputProps: { keyboardType: 'phone-pad' } })}
            {renderField('email', 'Email', 'optionnel@societe.fr (facultatif)', { inputProps: { keyboardType: 'email-address', autoCapitalize: 'none' } })}

            {/* Adresse */}
            <Text style={s.sectionTitle}>Adresse</Text>
            {renderField('adresse', 'Adresse', '1 rue de la Boulangerie')}
            <View style={s.row}>
              {renderField('code_postal', 'Code postal', '75000', { inputProps: { keyboardType: 'numeric' } })}
              {renderField('ville', 'Ville', 'Paris')}
            </View>

            {/* Identifiants */}
            <Text style={s.sectionTitle}>Identifiants de connexion</Text>
            <View style={s.infoBox}>
              <Text style={s.infoText}>
                {form.email.trim()
                  ? `Le client se connectera avec : ${form.email.trim()}`
                  : 'Un identifiant sera généré automatiquement (pas d\'email renseigné)'}
              </Text>
            </View>
            {renderField('password', 'Mot de passe', 'Min. 6 caractères', {
              required: true,
              inputProps: { autoCapitalize: 'none' },
            })}

            {/* Livreur */}
            <Text style={s.sectionTitle}>Livreur assigné</Text>
            {livreurs.length === 0 ? (
              <Text style={s.emptyText}>Aucun livreur disponible. Créez-en un dans l'onglet Logistique.</Text>
            ) : (
              <View style={s.chipsRow}>
                <TouchableOpacity
                  style={[s.chip, !livreurId && s.chipActive]}
                  onPress={() => setLivreurId(null)}
                >
                  <Text style={[s.chipText, !livreurId && s.chipTextActive]}>Aucun</Text>
                </TouchableOpacity>
                {livreurs.map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={[s.chip, livreurId === l.id && s.chipActive]}
                    onPress={() => setLivreurId(l.id)}
                  >
                    <Text style={[s.chipText, livreurId === l.id && s.chipTextActive]}>
                      {[l.prenom, l.nom].filter(Boolean).join(' ') || 'Livreur'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Prix */}
            <Text style={s.sectionTitle}>Tarification</Text>
            <TouchableOpacity
              style={s.toggleRow}
              onPress={() => setUseCustomPrices(!useCustomPrices)}
            >
              <View style={[s.checkbox, useCustomPrices && s.checkboxChecked]}>
                {useCustomPrices && <View style={s.checkboxInner} />}
              </View>
              <Text style={s.toggleLabel}>Personnaliser les prix pour ce client</Text>
            </TouchableOpacity>

            {useCustomPrices && products.map(p => (
              <View key={p.id} style={s.priceRow}>
                <Text style={s.priceName} numberOfLines={1}>{p.nom}</Text>
                <View style={s.priceInputWrap}>
                  <TextInput
                    style={s.priceInput}
                    value={customPrices[p.id] || ''}
                    onChangeText={v => setCustomPrices(prev => ({ ...prev, [p.id]: v }))}
                    keyboardType="decimal-pad"
                    placeholder={String(p.prix_unitaire_ht)}
                    placeholderTextColor={colors.textLight}
                  />
                  <Text style={s.priceUnit}>€ HT</Text>
                </View>
              </View>
            ))}

            {/* Submit */}
            <View style={{ marginTop: spacing.lg }}>
              <Button
                title="Créer le client"
                onPress={handleCreate}
                loading={saving}
                disabled={saving}
                fullWidth
                size="lg"
              />
            </View>
            <View style={{ height: spacing.xxl }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    ...Platform.select({ web: { justifyContent: 'center', alignItems: 'center' } }),
  },
  box: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl,
    maxHeight: '92%',
  },
  boxDesktop: {
    borderRadius: borderRadius.xl, width: '96%', maxWidth: 680,
    maxHeight: '90%', alignSelf: 'center',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary },
  closeBtn: { padding: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  closeText: { fontSize: fontSizes.lg, color: colors.textSecondary, fontWeight: '600' },
  body: { flex: 1 },
  bodyContent: { padding: spacing.lg, gap: spacing.xs },
  sectionTitle: {
    fontSize: fontSizes.xs, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, color: colors.primary, marginTop: spacing.md,
    marginBottom: spacing.sm, paddingBottom: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  fieldWrap: { flex: 1, marginBottom: spacing.sm },
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
  errorText: { color: colors.error, fontSize: fontSizes.xs, marginTop: 2 },
  infoBox: {
    backgroundColor: colors.secondary, padding: spacing.md,
    borderRadius: borderRadius.md, marginBottom: spacing.sm,
  },
  infoText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontStyle: 'italic' },
  emptyText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontStyle: 'italic', marginBottom: spacing.sm },
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
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  checkbox: {
    width: 20, height: 20, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: 4, marginRight: spacing.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkboxInner: { width: 10, height: 10, backgroundColor: colors.white, borderRadius: 2 },
  toggleLabel: { fontSize: fontSizes.sm, color: colors.textPrimary },
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
