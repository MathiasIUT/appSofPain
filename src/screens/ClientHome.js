import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  TextInput,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, shadows, spacing, fontSizes, borderRadius } from '../config/theme';
import Button from '../components/Button';
import { useCart } from '../contexts/CartContext';

// Slugs des catégories affichées dans le catalogue client.
// Ajouter 'surgele' plus tard si le client le propose.
const VISIBLE_CATEGORY_SLUGS = ['frais'];

export default function ClientHome({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState(null);
  const [clientPrices, setClientPrices] = useState({});

  const { items: cartItems, totals } = useCart();

  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Chargement initial : profil + produits
  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const [profileRes, prodRes, pricesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('nom, prenom, nom_societe')
          .eq('id', user.id)
          .single(),
        supabase
          .from('products')
          .select('*, category:categories(id, nom, slug)')
          .eq('actif', true)
          .order('nom', { ascending: true }),
        supabase
          .from('client_prices')
          .select('product_id, prix_palette_ht')
          .eq('client_id', user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (prodRes.error) throw prodRes.error;

      // Construction de la map des prix spécifiques au client
      const priceMap = {};
      (pricesRes.data || []).forEach(p => { priceMap[p.product_id] = Number(p.prix_palette_ht); });
      setClientPrices(priceMap);

      // Ne garder que les produits des catégories visibles
      const visibleProducts = (prodRes.data || []).filter((p) =>
        VISIBLE_CATEGORY_SLUGS.includes(p.category?.slug)
      ).map(p => ({
        ...p,
        // Appliquer le prix spécifique au client si disponible
        prix_palette_ht: priceMap[p.id] !== undefined ? priceMap[p.id] : p.prix_palette_ht,
      }));
      setProducts(visibleProducts);
    } catch (err) {
      console.error('Erreur chargement catalogue :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Déconnexion
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  // Filtrer les produits selon la recherche
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.nom.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement du catalogue...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ====== HEADER ====== */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/logo1.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headerText}>
            <Text style={styles.welcome}>Bonjour {profile?.prenom || ''}</Text>
            {profile?.nom_societe ? (
              <Text style={styles.society}>{profile.nom_societe}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Bouton panier */}
          <TouchableOpacity
            style={styles.cartButton}
            onPress={() => navigation.navigate('Cart')}
            activeOpacity={0.7}
          >
            <Text style={styles.cartButtonText}>Panier</Text>
            {totals.nbArticles > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totals.nbArticles}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* Bouton mes commandes (placeholder pour plus tard) */}
          <TouchableOpacity
            style={styles.ordersButton}
            onPress={() => navigation.navigate('MyOrders')}
            activeOpacity={0.7}
          >
            <Text style={styles.ordersButtonText}>Mes commandes</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        {/* Titre + barre de recherche */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Catalogue</Text>
          <Text style={styles.subtitle}>
            {products.length} produit{products.length > 1 ? 's' : ''} disponible
            {products.length > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Barre de recherche */}
        <View style={styles.searchBarContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit..."
            placeholderTextColor={colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
            >
              <Text style={styles.clearSearchText}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Liste des produits */}
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'Aucun résultat' : 'Aucun produit disponible'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? `Aucun produit ne correspond à "${searchQuery}"`
                : 'Revenez bientôt pour découvrir nos produits.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.productsGrid, isDesktop && styles.productsGridDesktop]}>
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ====== BARRE PANIER EN BAS (si au moins un article) ====== */}
      {cartItems.length > 0 ? (
        <View style={styles.cartBar}>
          <View style={styles.cartBarInfo}>
            <Text style={styles.cartBarCount}>
              {totals.nbProduitsDistincts} produit{totals.nbProduitsDistincts > 1 ? 's' : ''} ·{' '}
              {totals.nbArticles} palette{totals.nbArticles > 1 ? 's' : ''}
            </Text>
            <Text style={styles.cartBarTotal}>
              {totals.totalTtc.toFixed(2)} € TTC
            </Text>
          </View>
          <Button
            title="Voir mon panier"
            onPress={() => navigation.navigate('Cart')}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------
// Composant ProductCard avec boutons +/-
// ---------------------------------------------------------

function ProductCard({ product }) {
  const { items, addToCart, setQuantity } = useCart();
  const TVA = Number(product.tva_pourcent);
  const prixHt = Number(product.prix_palette_ht);
  const prixTtc = prixHt * (1 + TVA / 100);

  // Quantité actuelle dans le panier
  const inCart = items.find((i) => i.product.id === product.id);
  const currentQty = inCart ? inCart.quantite_palettes : 0;

  const handleIncrement = () => {
    if (currentQty === 0) {
      addToCart(product, 1);
    } else {
      setQuantity(product.id, currentQty + 1);
    }
  };

  const handleDecrement = () => {
    if (currentQty > 0) {
      setQuantity(product.id, currentQty - 1);
    }
  };

  return (
    <View style={styles.productCard}>
      {/* Image */}
      <View style={styles.productImage}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImg} />
        ) : (
          <View style={styles.productImgEmpty}>
            <Text style={styles.productImgEmptyText}>Sof Pain</Text>
          </View>
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.nom}
        </Text>

        <Text style={styles.productDesc} numberOfLines={2}>
          {product.description || ' '}
        </Text>

        <View style={styles.productMeta}>
          <Text style={styles.productMetaItem}>
            24 cartons / palette · {product.unites_par_carton} unité
            {product.unites_par_carton > 1 ? 's' : ''} / carton
          </Text>
        </View>

        {/* Prix */}
        <View style={styles.pricingBlock}>
          <View>
            <Text style={styles.priceTtc}>{prixTtc.toFixed(2)} € TTC</Text>
            <Text style={styles.priceHt}>
              {prixHt.toFixed(2)} € HT · TVA {TVA}%
            </Text>
            <Text style={styles.pricePer}>par palette</Text>
          </View>
        </View>

        {/* Espace flexible pour pousser le bouton vers le bas */}
        <View style={{ flex: 1 }} />

        {/* Boutons +/- avec saisie manuelle ou "Ajouter" */}
        {currentQty === 0 ? (
          <Button
            title="Ajouter au panier"
            onPress={handleIncrement}
            fullWidth
          />
        ) : (
          <View>
            <View style={styles.quantityRow}>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={handleDecrement}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyButtonText}>−</Text>
              </TouchableOpacity>
              <View style={styles.qtyDisplay}>
                <TextInput
                  style={styles.qtyInput}
                  value={String(currentQty)}
                  onChangeText={(v) => {
                    // On n'autorise que les chiffres
                    const cleaned = v.replace(/[^0-9]/g, '');
                    const num = parseInt(cleaned, 10);
                    // Si champ vide ou 0, on garde 1 minimum pour ne pas sortir du panier pendant la saisie
                    if (cleaned === '' || isNaN(num)) {
                      setQuantity(product.id, 1);
                    } else {
                      // Plafond à 999 pour éviter n'importe quoi
                      setQuantity(product.id, Math.min(num, 999));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={styles.qtyLabel}>
                  palette{currentQty > 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.qtyButton}
                onPress={handleIncrement}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexWrap: 'wrap',
    gap: spacing.md,
    ...shadows.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 200,
  },
  logo: {
    width: 60,
    height: 60,
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  welcome: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  society: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  cartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  cartButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  cartBadge: {
    backgroundColor: colors.white,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    paddingHorizontal: 6,
  },
  cartBadgeText: {
    color: colors.primary,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  ordersButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  ordersButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  logoutButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  logoutText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: '500',
  },

  // Contenu principal
  content: {
    flex: 1,
  },
  contentInner: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  titleBlock: {
    marginBottom: spacing.lg,
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

  // Barre de recherche
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  clearSearchBtn: {
    padding: spacing.xs,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  clearSearchText: {
    fontSize: 20,
    color: colors.textSecondary,
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
  },

  // Grille
  productsGrid: {
    gap: spacing.md,
  },
  productsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  productCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    flex: 1,
    minWidth: 280,
    maxWidth: 360,
    ...shadows.sm,
  },
  productImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.secondary,
  },
  productImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImgEmpty: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImgEmptyText: {
    color: colors.primary,
    fontSize: fontSizes.lg,
    fontWeight: '600',
    letterSpacing: 1,
  },
  productInfo: {
    padding: spacing.md,
    flex: 1,
  },
  productName: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  productDesc: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
    minHeight: 36,
  },
  productMeta: {
    marginBottom: spacing.md,
  },
  productMetaItem: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  pricingBlock: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  priceTtc: {
    fontSize: fontSizes.lg,
    fontWeight: '800',
    color: colors.primary,
  },
  priceHt: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pricePer: {
    fontSize: fontSizes.xs,
    color: colors.textLight,
    fontStyle: 'italic',
  },

  // Quantité +/-
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.md,
  },
  qtyButton: {
    minWidth: 36,
    minHeight: 36,
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  qtyButtonText: {
    color: colors.white,
    fontSize: fontSizes.xl,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  qtyDisplay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    fontSize: fontSizes.xl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    width: '100%',
    height: 44,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        cursor: 'text',
      },
    }),
  },
  qtyLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Barre panier flottante en bas
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    gap: spacing.md,
    ...shadows.lg,
  },
  cartBarInfo: {
    flex: 1,
  },
  cartBarCount: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  cartBarTotal: {
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    color: colors.primary,
  },
});