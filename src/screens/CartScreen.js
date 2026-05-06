import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, shadows, spacing, fontSizes, borderRadius } from '../config/theme';
import Button from '../components/Button';
import { useCart } from '../contexts/CartContext';

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
 * Écran du panier.
 * Liste les articles ajoutés, permet de modifier les quantités
 * et de supprimer des articles. Bouton "Valider" amène au checkout.
 */
export default function CartScreen({ navigation }) {
  const { items, setQuantity, removeFromCart, clearCart, totals } = useCart();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const handleClear = async () => {
    const ok = await showConfirm(
      'Vider le panier',
      'Êtes-vous sûr de vouloir retirer tous les articles ?'
    );
    if (ok) clearCart();
  };

  const handleValidate = () => {
    navigation.navigate('Checkout');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header simple avec retour */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Retour au catalogue</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Mon panier</Text>
          {items.length > 0 ? (
            <Text style={styles.subtitle}>
              {`${totals.nbProduitsDistincts} produit${totals.nbProduitsDistincts > 1 ? 's' : ''} · ${totals.nbArticles} unité${totals.nbArticles > 1 ? 's' : ''}`}
            </Text>
          ) : null}
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Votre panier est vide</Text>
            <Text style={styles.emptyText}>
              Parcourez le catalogue pour ajouter des produits.
            </Text>
            <View style={styles.emptyAction}>
              <Button
                title="Voir le catalogue"
                onPress={() => navigation.goBack()}
              />
            </View>
          </View>
        ) : (
          <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
            {/* Colonne articles */}
            <View style={[styles.itemsColumn, isDesktop && styles.itemsColumnDesktop]}>
              {items.map((item) => (
                <CartItemRow
                  key={item.product.id}
                  item={item}
                  onIncrement={() =>
                    setQuantity(item.product.id, item.quantite + (item.product.increment || 10))
                  }
                  onDecrement={() =>
                    setQuantity(item.product.id, Math.max(0, item.quantite - (item.product.increment || 10)))
                  }
                  onSetQuantity={(qty) => setQuantity(item.product.id, qty)}
                  onRemove={() => removeFromCart(item.product.id)}
                />
              ))}

              <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Vider le panier</Text>
              </TouchableOpacity>
            </View>

            {/* Colonne récap */}
            <View style={[styles.summaryColumn, isDesktop && styles.summaryColumnDesktop]}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Récapitulatif</Text>

                <SummaryLine
                  label="Total HT"
                  value={`${totals.totalHt.toFixed(2)} €`}
                />
                <SummaryLine
                  label="TVA"
                  value={`${totals.totalTva.toFixed(2)} €`}
                />

                <View style={styles.summaryDivider} />

                <SummaryLine
                  label="Total TTC"
                  value={`${totals.totalTtc.toFixed(2)} €`}
                  highlight
                />

                <View style={styles.summaryAction}>
                  <Button
                    title="Valider ma commande"
                    onPress={handleValidate}
                    fullWidth
                    size="lg"
                  />
                </View>

                <Text style={styles.summaryHint}>
                  Aucun paiement ne sera débité à cette étape. Un bon de commande
                  sera généré après validation.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------

function CartItemRow({ item, onIncrement, onDecrement, onSetQuantity, onRemove }) {
  const { product, quantite } = item;
  const TVA = Number(product.tva_pourcent);
  const prixUnitaireHt = Number(product.prix_unitaire_ht || 0);
  const increment = Number(product.increment || 10);
  const sousTotalHt = prixUnitaireHt * quantite;
  const sousTotalTtc = sousTotalHt * (1 + TVA / 100);

  // Gestion saisie manuelle de la quantité
  const handleManualChange = (value) => {
    const cleaned = value.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    if (cleaned === '' || isNaN(num)) {
      // On garde au moins 1 pendant la saisie pour ne pas vider le panier involontairement
      onSetQuantity(1);
    } else {
      // Plafond à 9999 pour éviter n'importe quoi
      onSetQuantity(Math.min(num, 9999));
    }
  };

  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemImage}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.cartItemImg} />
        ) : (
          <View style={styles.cartItemImgEmpty}>
            <Text style={styles.cartItemImgEmptyText}>Sof Pain</Text>
          </View>
        )}
      </View>

      <View style={styles.cartItemBody}>
        <Text style={styles.cartItemName}>{product.nom}</Text>
        <Text style={styles.cartItemPriceUnit}>
          {`${prixUnitaireHt.toFixed(2)} € HT / unité · TVA ${TVA}%`}
        </Text>

        <View style={styles.cartItemControls}>
          <View style={styles.cartQtyRow}>
            <TouchableOpacity
              style={styles.cartQtyBtn}
              onPress={onDecrement}
              activeOpacity={0.7}
            >
              <Text style={styles.cartQtyBtnText}>−</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.cartQtyInput}
              value={String(quantite)}
              onChangeText={handleManualChange}
              onBlur={() => {
                if (quantite > 0) {
                  const rounded = Math.ceil(quantite / increment) * increment;
                  onSetQuantity(Math.min(rounded, 9999));
                }
              }}
              keyboardType="numeric"
              maxLength={4}
            />
            <TouchableOpacity
              style={styles.cartQtyBtn}
              onPress={onIncrement}
              activeOpacity={0.7}
            >
              <Text style={styles.cartQtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cartItemTotals}>
            <Text style={styles.cartItemSubtotalMain}>
              {`${sousTotalHt.toFixed(2)} € HT`}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onRemove} style={styles.cartItemRemove}>
          <Text style={styles.cartItemRemoveText}>Retirer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SummaryLine({ label, value, highlight }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLabel, highlight && styles.summaryLabelHighlight]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, highlight && styles.summaryValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------
// Styles
// ---------------------------------------------------------

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

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyAction: {
    marginTop: spacing.md,
  },

  // Layout 2 colonnes sur desktop
  layout: {
    flexDirection: 'column',
    gap: spacing.lg,
  },
  layoutDesktop: {
    flexDirection: 'row',
  },
  itemsColumn: {
    flex: 1,
    gap: spacing.md,
  },
  itemsColumnDesktop: {
    flex: 2,
  },
  summaryColumn: {
    width: '100%',
  },
  summaryColumnDesktop: {
    flex: 1,
    maxWidth: 360,
  },

  // Articles du panier
  cartItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  cartItemImage: {
    width: 120,
    backgroundColor: colors.secondary,
  },
  cartItemImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cartItemImgEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemImgEmptyText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  cartItemBody: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cartItemName: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cartItemPriceUnit: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cartQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    gap: spacing.sm,
  },
  cartQtyBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  cartQtyBtnText: {
    color: colors.white,
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  cartQtyInput: {
    fontSize: fontSizes.md,
    fontWeight: 'bold',
    color: colors.textPrimary,
    minWidth: 60,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    height: 36,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        cursor: 'text',
      },
    }),
  },
  cartItemTotals: {
    alignItems: 'flex-end',
  },
  cartItemSubtotalMain: {
    fontSize: fontSizes.md,
    fontWeight: 'bold',
    color: colors.primary,
  },
  cartItemRemove: {
    alignSelf: 'flex-start',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  cartItemRemoveText: {
    fontSize: fontSizes.xs,
    color: colors.error,
    textDecorationLine: 'underline',
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  clearBtnText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    textDecorationLine: 'underline',
  },

  // Récapitulatif
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  summaryTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  summaryLabelHighlight: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: fontSizes.md,
  },
  summaryValueHighlight: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: fontSizes.xl,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  summaryAction: {
    marginTop: spacing.lg,
  },
  summaryHint: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 16,
  },
});