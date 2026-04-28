import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';
import Button from '../components/Button';
import Input from '../components/Input';
import { useCart } from '../contexts/CartContext';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Date par défaut : aujourd'hui + 7 jours, au format YYYY-MM-DD (compatible Postgres)
const getDefaultDeliveryDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
};

// Format pour l'affichage : JJ/MM/AAAA
const formatDateFr = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Écran de validation de commande.
 * - Affiche le résumé du panier
 * - Demande les coordonnées de livraison
 * - Crée la commande + les lignes dans Supabase
 * - Redirige vers l'écran de confirmation
 */
export default function CheckoutScreen({ navigation }) {
  const { items, totals, clearCart } = useCart();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Charger le profil client (pour pré-remplir téléphone si disponible)
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          setProfile(data);
          // Pré-remplir si les champs existent dans le profil
          setForm((prev) => ({
            ...prev,
            telephone: data.telephone || '',
            adresse: data.adresse || '',
            code_postal: data.code_postal || '',
            ville: data.ville || '',
          }));
        }
      } catch (err) {
        console.error('Erreur chargement profil :', err);
      }
    })();
  }, []);

  // Si le panier est vide, on renvoie au catalogue
  useEffect(() => {
    if (items.length === 0) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'ClientHome' }],
      });
    }
  }, [items.length, navigation]);

  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: null });
  };

  const validate = () => {
    const newErrors = {};
    if (!form.telephone.trim()) {
      newErrors.telephone = 'Le téléphone est requis';
    } else if (!/^[0-9+\s().-]{8,20}$/.test(form.telephone.trim())) {
      newErrors.telephone = 'Numéro de téléphone invalide';
    }
    if (!form.adresse.trim()) {
      newErrors.adresse = 'L\'adresse est requise';
    } else if (form.adresse.trim().length > 200) {
      newErrors.adresse = 'Adresse trop longue (max 200 caractères)';
    }
    if (!form.code_postal.trim()) {
      newErrors.code_postal = 'Le code postal est requis';
    } else if (!/^[0-9]{4,6}$/.test(form.code_postal.trim())) {
      newErrors.code_postal = 'Code postal invalide';
    }
    if (!form.ville.trim()) {
      newErrors.ville = 'La ville est requise';
    } else if (form.ville.trim().length > 100) {
      newErrors.ville = 'Ville trop longue (max 100 caractères)';
    }
    if (form.notes.trim().length > 1000) {
      newErrors.notes = 'Notes trop longues (max 1000 caractères)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validation finale de la commande : création en BDD
  const handleSubmit = async () => {
    if (!validate()) {
      showAlert('Formulaire incomplet', 'Veuillez remplir les champs requis.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      // Construction de l'adresse complète (texte libre dans orders.adresse_livraison)
      const adresseComplete = `${form.adresse.trim()}\n${form.code_postal.trim()} ${form.ville.trim()}\nTél : ${form.telephone.trim()}`;

      // Récupérer le livreur assigné au client
      const livreurId = profile?.livreur_id || null;

      // 1. Création de la commande
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          client_id: user.id,
          livreur_id: livreurId,
          statut: 'nouvelle',
          date_livraison_souhaitee: getDefaultDeliveryDate(),
          adresse_livraison: adresseComplete,
          notes_client: form.notes.trim() || null,
        })
        .select('*')
        .single();

      if (orderError) throw orderError;

      // 2. Insertion des lignes de commande
      const orderItems = items.map((item) => {
        const prixHt = Number(item.product.prix_palette_ht);
        const tva = Number(item.product.tva_pourcent);
        return {
          order_id: order.id,
          product_id: item.product.id,
          product_nom: item.product.nom,
          quantite_palettes: item.quantite_palettes,
          cartons_par_palette: 24,
          prix_palette_ht: prixHt,
          tva_pourcent: tva,
          sous_total_ht: prixHt * item.quantite_palettes,
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Récupérer la commande à jour (totaux recalculés par le trigger SQL)
      const { data: updatedOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order.id)
        .single();

      // 4. Vider le panier
      clearCart();

      // 5. Naviguer vers la confirmation
      navigation.replace('OrderConfirmation', {
        order: updatedOrder || order,
        items: orderItems,
        client: profile,
      });
    } catch (err) {
      console.error('Erreur création commande :', err);
      showAlert('Erreur', err.message || 'Impossible de créer la commande.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Retour au panier</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Valider ma commande</Text>
          <Text style={styles.subtitle}>
            Renseignez les coordonnées de livraison
          </Text>
        </View>

        <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
          {/* FORMULAIRE */}
          <View style={[styles.formColumn, isDesktop && styles.formColumnDesktop]}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Coordonnées de livraison</Text>

              <Input
                label="Téléphone"
                required
                value={form.telephone}
                onChangeText={(v) => updateField('telephone', v)}
                placeholder="Ex : 06 12 34 56 78"
                keyboardType="phone-pad"
                error={errors.telephone}
                editable={!submitting}
              />

              <Input
                label="Adresse"
                required
                value={form.adresse}
                onChangeText={(v) => updateField('adresse', v)}
                placeholder="Ex : 12 rue de la Boulangerie"
                error={errors.adresse}
                editable={!submitting}
              />

              <View style={styles.row}>
                <View style={styles.half}>
                  <Input
                    label="Code postal"
                    required
                    value={form.code_postal}
                    onChangeText={(v) =>
                      updateField('code_postal', v.replace(/[^0-9]/g, '').slice(0, 6))
                    }
                    placeholder="75001"
                    keyboardType="numeric"
                    error={errors.code_postal}
                    editable={!submitting}
                  />
                </View>
                <View style={styles.half}>
                  <Input
                    label="Ville"
                    required
                    value={form.ville}
                    onChangeText={(v) => updateField('ville', v)}
                    placeholder="Paris"
                    error={errors.ville}
                    editable={!submitting}
                  />
                </View>
              </View>

              <Input
                label="Notes / Instructions spéciales"
                value={form.notes}
                onChangeText={(v) => updateField('notes', v)}
                placeholder="Précisions pour la livraison, horaires préférés..."
                multiline
                helperText="Facultatif"
                editable={!submitting}
              />
            </View>

            <View style={[styles.card, { marginTop: spacing.md }]}>
              <Text style={styles.cardTitle}>Date de livraison</Text>
              <View style={styles.deliveryDateBox}>
                <Text style={styles.deliveryDateLabel}>Livraison prévue le</Text>
                <Text style={styles.deliveryDateValue}>
                  {formatDateFr(getDefaultDeliveryDate())}
                </Text>
                <Text style={styles.deliveryDateHint}>
                  Dans 7 jours. L'entreprise vous contactera pour ajuster si besoin.
                </Text>
              </View>
            </View>
          </View>

          {/* RÉCAP COMMANDE */}
          <View style={[styles.summaryColumn, isDesktop && styles.summaryColumnDesktop]}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Récapitulatif</Text>

              <View style={styles.itemsList}>
                {items.map((item) => {
                  const prixHt = Number(item.product.prix_palette_ht);
                  const sousTotal = prixHt * item.quantite_palettes;
                  return (
                    <View key={item.product.id} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {item.product.nom}
                        </Text>
                        <Text style={styles.itemQty}>
                          {item.quantite_palettes} palette
                          {item.quantite_palettes > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>{sousTotal.toFixed(2)} €</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>Total HT</Text>
                <Text style={styles.totalValue}>{totals.totalHt.toFixed(2)} €</Text>
              </View>
              <View style={styles.totalLine}>
                <Text style={styles.totalLabel}>TVA</Text>
                <Text style={styles.totalValue}>{totals.totalTva.toFixed(2)} €</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.totalLine}>
                <Text style={styles.totalLabelFinal}>Total TTC</Text>
                <Text style={styles.totalValueFinal}>
                  {totals.totalTtc.toFixed(2)} €
                </Text>
              </View>

              <View style={styles.submitAction}>
                <Button
                  title="Confirmer ma commande"
                  onPress={handleSubmit}
                  loading={submitting}
                  disabled={submitting}
                  fullWidth
                  size="lg"
                />
              </View>

              <Text style={styles.submitHint}>
                En confirmant, un bon de commande sera généré. Aucun paiement n'est
                effectué à cette étape.
              </Text>
            </View>
          </View>
        </View>

        {submitting ? (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.overlayText}>Création de la commande...</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    alignSelf: 'flex-start',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  backText: {
    fontSize: fontSizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  titleBlock: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Layout 2 colonnes
  layout: {
    flexDirection: 'column',
    gap: spacing.lg,
  },
  layoutDesktop: {
    flexDirection: 'row',
  },
  formColumn: {
    flex: 1,
    gap: spacing.md,
  },
  formColumnDesktop: {
    flex: 2,
  },
  summaryColumn: {
    width: '100%',
  },
  summaryColumnDesktop: {
    flex: 1,
    maxWidth: 380,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  // Ligne code postal + ville
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },

  // Date de livraison
  deliveryDateBox: {
    backgroundColor: colors.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  deliveryDateLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deliveryDateValue: {
    fontSize: fontSizes.xl,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 4,
  },
  deliveryDateHint: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  // Récap items
  itemsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  itemQty: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  totalLabelFinal: {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  totalValueFinal: {
    fontSize: fontSizes.lg,
    color: colors.primary,
    fontWeight: '700',
  },
  submitAction: {
    marginTop: spacing.lg,
  },
  submitHint: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 16,
  },

  // Overlay loading
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    marginTop: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
});