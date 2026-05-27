import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';
import Input from './Input';
import Button from './Button';

// ---- Helpers plateforme ----
const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const showConfirm = (title, message) =>
  new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(`${title}\n\n${message}`));
    } else {
      Alert.alert(title, message, [
        { text: 'Annuler', onPress: () => resolve(false), style: 'cancel' },
        { text: 'Confirmer', onPress: () => resolve(true) },
      ]);
    }
  });

/**
 * Modal de création ou modification d'un produit.
 */
export default function ProductFormModal({
  visible,
  product,
  categories,
  onClose,
  onSaved,
}) {
  const isEditing = !!product;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [form, setForm] = useState({
    nom: '',
    description: '',
    category_id: '',
    increment: '',
    prix_unitaire_ht: '',
    actif: true,
    image_url: null,
    sachets_par_carton: '',
    cartons_par_palette: '24',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);

  useEffect(() => {
    if (visible) {
      if (product) {
        setForm({
          nom: product.nom || '',
          description: product.description || '',
          category_id: product.category_id || '',
          increment: String(product.increment ?? 10),
          prix_unitaire_ht: String(product.prix_unitaire_ht || ''),
          actif: product.actif !== false,
          image_url: product.image_url || null,
          sachets_par_carton: product.sachets_par_carton ? String(product.sachets_par_carton) : '',
          cartons_par_palette: product.cartons_par_palette ? String(product.cartons_par_palette) : '24',
        });
      } else {
        setForm({
          nom: '',
          description: '',
          category_id: categories[0]?.id || '',
          increment: '10',
          prix_unitaire_ht: '',
          actif: true,
          image_url: null,
          sachets_par_carton: '',
          cartons_par_palette: '24',
        });
      }
      setErrors({});
      setPendingImage(null);
    }
  }, [visible, product, categories]);

  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: null });
  };

  const validate = () => {
    const newErrors = {};
    if (!form.nom.trim()) newErrors.nom = 'Le nom est requis';
    if (!form.category_id) newErrors.category_id = 'La catégorie est requise';

    const unites = parseInt(form.increment, 10);
    if (!form.increment || isNaN(unites) || unites < 1) {
      newErrors.increment = 'Doit être un nombre entier supérieur ou égal à 1';
    }

    const prix = parseFloat(form.prix_unitaire_ht.replace(',', '.'));
    if (form.prix_unitaire_ht === '' || isNaN(prix) || prix < 0) {
      newErrors.prix_unitaire_ht = 'Doit être un nombre supérieur ou égal à 0';
    }

    const selectedCategory = categories.find(c => c.id === form.category_id);
    if (selectedCategory?.slug === 'surgele') {
      const sachets = parseInt(form.sachets_par_carton, 10);
      if (!form.sachets_par_carton || isNaN(sachets) || sachets < 1) {
        newErrors.sachets_par_carton = 'Requis pour les produits surgelés';
      }
      const cartons = parseInt(form.cartons_par_palette, 10);
      if (!form.cartons_par_palette || isNaN(cartons) || cartons < 1) {
        newErrors.cartons_par_palette = 'Requis pour les produits surgelés';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showAlert(
            'Permission refusée',
            "L'accès à vos photos est nécessaire pour ajouter une image."
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setPendingImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Erreur sélection image :', err);
      showAlert('Erreur', "Impossible de sélectionner l'image.");
    }
  };

  const uploadImage = async (asset) => {
    try {
      setUploading(true);

      let fileBody;
      let contentType;

      if (Platform.OS === 'web') {
        // Sur web : asset.uri est un blob: URL, on fetch puis on récupère le vrai MIME
        const response = await fetch(asset.uri);
        fileBody = await response.blob();
        contentType = fileBody.type || 'image/jpeg';
      } else {
        // Sur mobile : expo-image-picker fournit généralement le mimeType
        const response = await fetch(asset.uri);
        fileBody = await response.arrayBuffer();
        contentType = asset.mimeType || 'image/jpeg';
      }

      // On déduit l'extension du contentType (fiable, contrairement à l'URI)
      // Exemples : "image/jpeg" -> "jpeg", "image/png" -> "png"
      const mimeExtension = (contentType.split('/').pop() || 'jpeg')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10); // sécurité : max 10 caractères
      const extension = mimeExtension === 'jpeg' ? 'jpg' : mimeExtension;

      // Nom de fichier sûr : uniquement chiffres + extension propre
      const fileName = `product_${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, fileBody, {
          contentType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      return publicData.publicUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPendingImage(null);
    updateField('image_url', null);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    try {
      let finalImageUrl = form.image_url;
      if (pendingImage) {
        finalImageUrl = await uploadImage(pendingImage);
      }

      const payload = {
        nom: form.nom.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id,
        increment: parseInt(form.increment, 10),
        prix_unitaire_ht: parseFloat(form.prix_unitaire_ht.replace(',', '.')),
        actif: form.actif,
        image_url: finalImageUrl,
      };

      const selectedCategory = categories.find(c => c.id === form.category_id);
      if (selectedCategory?.slug === 'surgele') {
        payload.sachets_par_carton = parseInt(form.sachets_par_carton, 10);
        payload.cartons_par_palette = parseInt(form.cartons_par_palette, 10);
      } else {
        payload.sachets_par_carton = null;
        payload.cartons_par_palette = null;
      }

      if (isEditing) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Erreur save produit :', err);
      showAlert('Erreur', err.message || "Impossible d'enregistrer le produit.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const action = form.actif ? 'désactiver' : 'réactiver';
    const actionTitle = action.charAt(0).toUpperCase() + action.slice(1);
    const extraMessage = form.actif
      ? '\n\nLes clients ne pourront plus le commander.'
      : '';
    const confirmed = await showConfirm(
      `${actionTitle} ce produit`,
      `Voulez-vous vraiment ${action} "${form.nom}" ?${extraMessage}`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ actif: !form.actif })
        .eq('id', product.id);
      if (error) throw error;

      onSaved();
      onClose();
    } catch (err) {
      console.error('Erreur toggle actif :', err);
      showAlert('Erreur', err.message || 'Impossible de modifier le statut.');
    } finally {
      setSaving(false);
    }
  };

  // Image à afficher (preview de la nouvelle ou existante)
  const previewUri = pendingImage?.uri || form.image_url;

  // Calculs pour le récapitulatif tarifaire
  const prixNum = parseFloat((form.prix_unitaire_ht || '').replace(',', '.'));
  const incrementValue = parseInt(form.increment || '10', 10);
  const showSummary =
    !errors.prix_unitaire_ht && !isNaN(prixNum) && prixNum > 0 && !isNaN(incrementValue) && incrementValue > 0;
  
  const selectedCategory = categories.find(c => c.id === form.category_id);
  const isSurgele = selectedCategory?.slug === 'surgele';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, isDesktop && styles.modalDesktop]}>
          {/* En-tête */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isEditing ? 'Modifier le produit' : 'Nouveau produit'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Section image */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Photo du produit</Text>
              {previewUri ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: previewUri }} style={styles.imagePreview} />
                  <View style={styles.imageActions}>
                    <Button
                      title="Changer la photo"
                      variant="secondary"
                      size="sm"
                      onPress={handlePickImage}
                      disabled={uploading || saving}
                    />
                    <Button
                      title="Retirer"
                      variant="ghost"
                      size="sm"
                      onPress={handleRemoveImage}
                      disabled={uploading || saving}
                    />
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.imagePicker}
                  onPress={handlePickImage}
                  disabled={uploading || saving}
                  activeOpacity={0.7}
                >
                  <Text style={styles.imagePickerTitle}>Ajouter une photo</Text>
                  <Text style={styles.imagePickerHint}>
                    Formats acceptés : JPG, PNG, WEBP
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Catégorie */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Catégorie *</Text>
              <View style={styles.categoryChips}>
                {categories.map((cat) => {
                  const active = form.category_id === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => updateField('category_id', cat.id)}
                      disabled={saving}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          active && styles.chipLabelActive,
                        ]}
                      >
                        {cat.nom}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.category_id ? (
                <Text style={styles.errorText}>{errors.category_id}</Text>
              ) : null}
            </View>

            {/* Nom */}
            <Input
              label="Nom du produit"
              required
              value={form.nom}
              onChangeText={(v) => updateField('nom', v)}
              placeholder="Ex : Pain sandwich"
              error={errors.nom}
              editable={!saving}
            />

            {/* Description */}
            <Input
              label="Description"
              value={form.description}
              onChangeText={(v) => updateField('description', v)}
              placeholder="Description du produit (facultatif)"
              multiline
              editable={!saving}
            />

            {/* Increment de commande */}
            <Input
              label="Multiple de commande"
              required
              value={form.increment}
              onChangeText={(v) =>
                updateField('increment', v.replace(/[^0-9]/g, ''))
              }
              placeholder="Ex : 10"
              keyboardType="numeric"
              error={errors.increment}
              helperText="Les clients commanderont ce produit par multiple de cette valeur (10 par défaut)"
              editable={!saving}
            />

            {/* Prix unitaire HT */}
            <Input
              label="Prix unitaire HT (€)"
              required
              value={form.prix_unitaire_ht}
              onChangeText={(v) =>
                updateField('prix_unitaire_ht', v.replace(/[^0-9.,]/g, ''))
              }
              placeholder="Ex : 2.50"
              keyboardType="decimal-pad"
              error={errors.prix_unitaire_ht}
              helperText="Prix d'une seule unité. Le prix d'un lot sera calculé automatiquement."
              editable={!saving}
            />

            {/* Inputs Surgelé */}
            {isSurgele && (
              <>
                <Input
                  label="Sachets par carton"
                  required
                  value={form.sachets_par_carton}
                  onChangeText={(v) =>
                    updateField('sachets_par_carton', v.replace(/[^0-9]/g, ''))
                  }
                  placeholder="Ex : 50"
                  keyboardType="numeric"
                  error={errors.sachets_par_carton}
                  editable={!saving}
                />
                <Input
                  label="Cartons par palette"
                  required
                  value={form.cartons_par_palette}
                  onChangeText={(v) =>
                    updateField('cartons_par_palette', v.replace(/[^0-9]/g, ''))
                  }
                  placeholder="Ex : 24"
                  keyboardType="numeric"
                  error={errors.cartons_par_palette}
                  editable={!saving}
                />
              </>
            )}

            {/* Résumé tarifaire */}
            {showSummary ? (
              <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Récapitulatif tarifaire</Text>
                <PricingSummary 
                  prixUnitaire={prixNum} 
                  increment={incrementValue} 
                  tva={5.5} 
                  isSurgele={isSurgele}
                  cartonsParPalette={parseInt(form.cartons_par_palette || '0', 10)}
                />
              </View>
            ) : null}
          </ScrollView>

          {/* Actions en pied */}
          <View style={styles.footer}>
            {isEditing ? (
              <Button
                title={form.actif ? 'Désactiver' : 'Réactiver'}
                variant={form.actif ? 'danger' : 'secondary'}
                size="md"
                onPress={handleToggleActive}
                disabled={saving || uploading}
              />
            ) : (
              <View />
            )}
            <View style={styles.footerRight}>
              <Button
                title="Annuler"
                variant="ghost"
                onPress={onClose}
                disabled={saving || uploading}
              />
              <Button
                title={isEditing ? 'Enregistrer' : 'Créer le produit'}
                onPress={handleSave}
                loading={saving || uploading}
                disabled={saving || uploading}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Résumé tarifaire ----
function PricingSummary({ prixUnitaire, increment, tva, isSurgele, cartonsParPalette }) {
  const prixLotHt = prixUnitaire * increment;

  if (isSurgele && cartonsParPalette > 0) {
    const prixPaletteHt = prixUnitaire * cartonsParPalette;
    return (
      <View>
        <SummaryRow
          label="Prix HT / carton"
          value={`${prixUnitaire.toFixed(2)} €`}
          bold
        />
        <SummaryRow
          label={`Prix HT / palette (${cartonsParPalette} cartons)`}
          value={`${prixPaletteHt.toFixed(2)} €`}
          bold
        />
      </View>
    );
  }

  return (
    <View>
      <SummaryRow
        label={`Prix HT / lot (${increment} u.)`}
        value={`${prixLotHt.toFixed(2)} €`}
        bold
      />
    </View>
  );
}

function SummaryRow({ label, value, bold }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.bold]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalDesktop: {
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  closeText: {
    fontSize: 28,
    color: colors.textSecondary,
    lineHeight: 30,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  imagePicker: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  imagePickerTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  imagePickerHint: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  imagePreviewContainer: {
    gap: spacing.sm,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  imageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  chipLabelActive: {
    color: colors.white,
    fontWeight: '600',
  },
  errorText: {
    color: colors.error,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  summary: {
    backgroundColor: colors.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
  },
  summaryTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  bold: {
    fontWeight: '700',
    color: colors.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  footerRight: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: 'auto',
  },
});