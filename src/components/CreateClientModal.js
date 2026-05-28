import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, ScrollView, TextInput,
  TouchableOpacity, Platform, Alert,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

// Pas d'envoi d'email à la création — le client reçoit l'email quand il clique "Première connexion ?"
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
    code_postal: '', ville: '', email: '',
    nom: '', prenom: '', note_interne_admin: '',
  });
  const [livreurId, setLivreurId] = useState(null);
  const [livreurSurgeleId, setLivreurSurgeleId] = useState(null);
  const [livreurs, setLivreurs] = useState([]);
  const [useCustomPrices, setUseCustomPrices] = useState(false);
  const [products, setProducts] = useState([]);
  const [customPrices, setCustomPrices] = useState({});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});


  useEffect(() => {
    if (!visible) return;
    // Reset form
    setForm({
      nom_societe: '', siret: '', telephone: '', adresse: '',
      code_postal: '', ville: '', email: '',
      nom: '', prenom: '', note_interne_admin: '',
    });
    setLivreurId(null);
    setLivreurSurgeleId(null);
    setUseCustomPrices(false);
    setCustomPrices({});
    setErrors({});

    // Load livreurs and products
    (async () => {
      const [livRes, prodRes] = await Promise.all([
        supabase.from('livreurs').select('id, nom, prenom, type_livreur').eq('actif', true),
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
    if (!form.email.trim()) e.email = 'L\'email est requis pour envoyer le lien de connexion';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const email = form.email.trim();
      // Mot de passe temporaire aléatoire — jamais communiqué, le client le remplacera via le lien
      const tempPassword = Array.from(crypto.getRandomValues(new Uint8Array(18)))
        .map(b => b.toString(36)).join('').slice(0, 18);

      // Sauvegarder la session admin avant signUp (qui change le session courant)
      const { data: sessionData } = await supabase.auth.getSession();
      const adminSession = sessionData?.session;
      const adminUserId = adminSession?.user?.id;

      // Créer le compte auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: tempPassword,
        options: {
          data: {
            nom: form.nom.trim(),
            prenom: form.prenom.trim(),
            nom_societe: form.nom_societe.trim(),
            telephone: form.telephone.trim(),
          },
        },
      });

      // Restore admin session immediately so RLS policies pass
      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
      }

      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Erreur création utilisateur');

      const { error: updateError } = await supabase.from('profiles').update({
        adresse: form.adresse.trim() || null,
        code_postal: form.code_postal.trim() || null,
        ville: form.ville.trim() || null,
        siret: form.siret.trim() || null,
        livreur_id: livreurId || null,
        livreur_surgele_id: livreurSurgeleId || null,
        email: email,
        note_interne_admin: form.note_interne_admin.trim() || null,
      }).eq('id', userId);

      if (updateError) throw updateError;

      // Insert custom prices if enabled — on sauvegarde tous les prix sans filtrage
      if (useCustomPrices) {
        const rows = [];
        for (const [productId, price] of Object.entries(customPrices)) {
          const p = parseFloat(String(price).replace(',', '.'));
          if (!isNaN(p) && p >= 0) {
            rows.push({ client_id: userId, product_id: productId, prix_unitaire_ht: p });
          }
        }
        if (rows.length > 0) {
          // S'assurer qu'on est bien connecté en tant qu'admin avant l'insert
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession || currentSession.user.id !== adminUserId) {
            await supabase.auth.setSession({
              access_token: adminSession.access_token,
              refresh_token: adminSession.refresh_token,
            });
          }
          const { error: priceError } = await supabase.from('client_prices').insert(rows);
          if (priceError) {
            console.error('Erreur insertion prix:', priceError);
            throw priceError;
          }
        }
      }

      // Compte créé avec succès. Aucun email n'est envoyé à ce stade.
      // Le client recevra son email de bienvenue en cliquant "Première connexion ?" sur la page de connexion.
      showAlert('Client créé ✓',
        `Le compte a été créé pour ${email}.\n\nLe client devra cliquer sur "Première connexion ?" sur la page de connexion pour recevoir son lien d\'accès.`
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
            {renderField('email', 'Email', 'contact@societe.fr', { required: true, inputProps: { keyboardType: 'email-address', autoCapitalize: 'none' } })}

            {/* Adresse */}
            <Text style={s.sectionTitle}>Adresse</Text>
            {renderField('adresse', 'Adresse', '1 rue de la Boulangerie')}
            <View style={s.row}>
              {renderField('code_postal', 'Code postal', '75000', { inputProps: { keyboardType: 'numeric' } })}
              {renderField('ville', 'Ville', 'Paris')}
            </View>

            {/* Identifiants */}
            <Text style={s.sectionTitle}>Connexion</Text>
            <View style={s.infoBox}>
              <Text style={s.infoText}>
                Un email sera envoyé au client avec un lien pour créer son propre mot de passe.
              </Text>
            </View>

            {/* Notes */}
            <Text style={s.sectionTitle}>Notes Internes</Text>
            {renderField('note_interne_admin', 'Note admin (réservée à l\'équipe)', 'Ajoutez une note interne pour ce client...', {
              inputProps: { multiline: true, style: { minHeight: 80, textAlignVertical: 'top' } }
            })}

            {/* Livreur Frais */}
            <Text style={s.sectionTitle}>Livreur Frais assigné</Text>
            {livreurs.filter(l => l.type_livreur === 'frais' || l.type_livreur === 'les_deux').length === 0 ? (
              <Text style={s.emptyText}>Aucun livreur disponible. Créez-en un dans l'onglet Logistique.</Text>
            ) : (
              <View style={s.chipsRow}>
                <TouchableOpacity
                  style={[s.chip, !livreurId && s.chipActive]}
                  onPress={() => setLivreurId(null)}
                >
                  <Text style={[s.chipText, !livreurId && s.chipTextActive]}>Aucun</Text>
                </TouchableOpacity>
                {livreurs.filter(l => l.type_livreur === 'frais' || l.type_livreur === 'les_deux').map(l => (
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

            <Text style={s.sectionTitle}>Livreur Surgelé assigné</Text>
            {livreurs.filter(l => l.type_livreur === 'surgele' || l.type_livreur === 'les_deux').length === 0 ? (
              <Text style={s.emptyText}>Aucun livreur disponible. Créez-en un dans l'onglet Logistique.</Text>
            ) : (
              <View style={s.chipsRow}>
                <TouchableOpacity
                  style={[s.chip, !livreurSurgeleId && s.chipActive]}
                  onPress={() => setLivreurSurgeleId(null)}
                >
                  <Text style={[s.chipText, !livreurSurgeleId && s.chipTextActive]}>Aucun</Text>
                </TouchableOpacity>
                {livreurs.filter(l => l.type_livreur === 'surgele' || l.type_livreur === 'les_deux').map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={[s.chip, livreurSurgeleId === l.id && s.chipActive]}
                    onPress={() => setLivreurSurgeleId(l.id)}
                  >
                    <Text style={[s.chipText, livreurSurgeleId === l.id && s.chipTextActive]}>
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
