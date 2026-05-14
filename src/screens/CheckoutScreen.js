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

// Format pour l'affichage : JJ/MM/AAAA
const formatDateFr = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

export default function CheckoutScreen({ navigation }) {
  const { items, totals, clearCart, editingOrder } = useCart();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    telephone: '',
    adresse: '',
    code_postal: '',
    ville: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

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
      } finally {
        setLoadingProfile(false);
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      showAlert('Formulaire incomplet', 'Veuillez remplir les champs requis.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      const adresseComplete = `${form.adresse.trim()}\n${form.code_postal.trim()} ${form.ville.trim()}\nTél : ${form.telephone.trim()}`;
      const livreurId = profile?.livreur_id || null;

      let orderId;
      let orderToPass;

      if (editingOrder) {
        // MISE À JOUR d'une commande existante
        const { data: updatedOrder, error: updateError } = await supabase
          .from('orders')
          .update({
            adresse_livraison: adresseComplete,
            total_ht: totals.totalHt,
            total_tva: totals.totalTva,
            total_ttc: totals.totalTtc,
            date_commande: new Date().toISOString(), // Règle de minuit : réinitialise la date
          })
          .eq('id', editingOrder.id)
          .select('*')
          .single();

        if (updateError) throw updateError;
        orderId = updatedOrder.id;
        orderToPass = updatedOrder;

        // Supprimer les anciens items
        const { error: delError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);
        if (delError) throw delError;

      } else {
        // CRÉATION d'une nouvelle commande
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            client_id: user.id,
            livreur_id: livreurId,
            statut: 'nouvelle',
            adresse_livraison: adresseComplete,
            total_ht: totals.totalHt,
            total_tva: totals.totalTva,
            total_ttc: totals.totalTtc,
          })
          .select('*')
          .single();

        if (orderError) throw orderError;
        orderId = order.id;
        orderToPass = order;
      }

      const orderItems = items.map((item) => {
        const prixUnitaire = Number(item.product.prix_unitaire_ht || 0);
        const increment = Number(item.product.increment || 10);
        const tva = Number(item.product.tva_pourcent);
        return {
          order_id: orderId,
          product_id: item.product.id,
          product_nom: item.product.nom,
          quantite: item.quantite,
          increment: increment,
          prix_unitaire_ht: prixUnitaire,
          tva_pourcent: tva,
          sous_total_ht: prixUnitaire * item.quantite,
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      const { data: finalOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      clearCart();

      navigation.replace('OrderConfirmation', {
        order: finalOrder || orderToPass,
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

      {loadingProfile ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: spacing.md, color: colors.textSecondary }}>Chargement de vos informations...</Text>
        </View>
      ) : (
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
              </View>
              </View>
            {/* RÉCAP COMMANDE */}
            <View style={[styles.summaryColumn, isDesktop && styles.summaryColumnDesktop]}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Récapitulatif</Text>

                <View style={styles.itemsList}>
                  {items.map((item) => {
                    const prixUnitaire = Number(item.product.prix_unitaire_ht || 0);
                    const sousTotal = prixUnitaire * item.quantite;
                    return (
                      <View key={item.product.id} style={styles.itemRow}>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.product.nom}
                          </Text>
                          <Text style={styles.itemQty}>
                            {`${item.quantite} unité${item.quantite > 1 ? 's' : ''}`}
                          </Text>
                        </View>
                        <Text style={styles.itemPrice}>{`${sousTotal.toFixed(2)} €`}</Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.divider} />

                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>Total HT</Text>
                  <Text style={styles.totalValue}>{`${totals.totalHt.toFixed(2)} €`}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>TVA</Text>
                  <Text style={styles.totalValue}>{`${totals.totalTva.toFixed(2)} €`}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabelFinal}>Total TTC</Text>
                  <Text style={styles.totalValueFinal}>
                    {`${totals.totalTtc.toFixed(2)} €`}
                  </Text>
                </View>

                <View style={styles.submitAction}>
                  <Button
                    title={editingOrder ? "Confirmer la modification" : "Confirmer ma commande"}
                    onPress={handleSubmit}
                    loading={submitting}
                    disabled={submitting}
                    fullWidth
                    size="lg"
                  />
                </View>

                <Text style={styles.submitHint}>
                  {editingOrder 
                    ? "En confirmant, votre commande sera mise à jour."
                    : "En confirmant, un bon de commande sera généré. Aucun paiement n'est effectué à cette étape."}
                </Text>
              </View>
            </View>
          </View>

          {submitting ? (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.overlayText}>
                {editingOrder ? "Mise à jour en cours..." : "Création de la commande..."}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
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

  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  half: {
    flex: 1,
  },

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