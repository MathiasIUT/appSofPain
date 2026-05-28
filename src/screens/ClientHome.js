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
const VISIBLE_CATEGORY_SLUGS = ['frais', 'surgele'];

export default function ClientHome({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState(null);
  const [clientPrices, setClientPrices] = useState({});
  const [selectedTab, setSelectedTab] = useState('frais');

  const { items: cartItems, totals } = useCart();

  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
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
          .select('product_id, prix_unitaire_ht')
          .eq('client_id', user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (prodRes.error) throw prodRes.error;
      const priceMap = {};
      (pricesRes.data || []).forEach(p => { priceMap[p.product_id] = Number(p.prix_unitaire_ht); });
      setClientPrices(priceMap);
      const visibleProducts = (prodRes.data || []).filter((p) =>
        VISIBLE_CATEGORY_SLUGS.includes(p.category?.slug)
      ).map(p => ({
        ...p,
        prix_unitaire_ht: priceMap[p.id] !== undefined ? priceMap[p.id] : p.prix_unitaire_ht,
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
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => p.category?.slug === selectedTab);
    if (!searchQuery.trim()) return result;
    const q = searchQuery.trim().toLowerCase();
    return result.filter(
      (p) =>
        p.nom.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    );
  }, [products, searchQuery, selectedTab]);

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

          {/* Bouton mes commandes */}
          <TouchableOpacity
            style={styles.ordersButton}
            onPress={() => navigation.navigate('MyOrders')}
            activeOpacity={0.7}
          >
            <Text style={styles.ordersButtonText}>Mes commandes</Text>
          </TouchableOpacity>

          {/* Bouton profil */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('ClientProfile')}
            activeOpacity={0.7}
          >
            <Text style={styles.profileButtonText}>Mon profil</Text>
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
        {/* Titre + infos */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Catalogue</Text>
          <Text style={styles.subtitle}>
            {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} disponible{filteredProducts.length > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Tabs Frais / Surgelé */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tabBtn, selectedTab === 'frais' && styles.tabBtnActive]}
            onPress={() => setSelectedTab('frais')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, selectedTab === 'frais' && styles.tabBtnTextActive]}>Pain Frais</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, selectedTab === 'surgele' && styles.tabBtnActive]}
            onPress={() => setSelectedTab('surgele')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabBtnText, selectedTab === 'surgele' && styles.tabBtnTextActive]}>Pain Surgelé</Text>
          </TouchableOpacity>
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
              <ProductCard key={product.id} product={product} isDesktop={isDesktop} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* ====== BARRE PANIER EN BAS (si au moins un article) ====== */}
      {cartItems.length > 0 ? (
        <View style={styles.cartBar}>
          <View style={styles.cartBarInfo}>
            <Text style={styles.cartBarCount}>
              {`${totals.nbProduitsDistincts} produit${totals.nbProduitsDistincts > 1 ? 's' : ''} · ${totals.nbArticles} unité${totals.nbArticles > 1 ? 's' : ''}`}
            </Text>
            <Text style={styles.cartBarTotal}>
              {`${totals.totalHt.toFixed(2)} € HT`}
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

function ProductCard({ product, isDesktop }) {
  const { items, addToCart, setQuantity, clearCart } = useCart();
  const TVA = Number(product.tva_pourcent);
  const prixUnitaireHt = Number(product.prix_unitaire_ht || 0);
  const increment = Number(product.increment || 10);
  const isSurgele = product.category?.slug === 'surgele';
  const inCart = items.find((i) => i.product.id === product.id);
  const currentQty = inCart ? inCart.quantite : 0;

  const handleIncrement = () => {
    try {
      if (currentQty === 0) {
        addToCart(product, increment);
      } else {
        setQuantity(product.id, currentQty + increment);
      }
    } catch (err) {
      if (err.message && err.message.startsWith('MIX_TYPE')) {
        const typePanier = err.message.split(':')[1];
        const msg = typePanier === 'frais'
          ? "Votre panier contient déjà du frais. Voulez-vous vider le panier pour commander du surgelé ?"
          : "Votre panier contient déjà du surgelé. Voulez-vous vider le panier pour commander du frais ?";
        
        if (Platform.OS === 'web') {
          if (window.confirm(msg)) {
            clearCart();
            addToCart(product, increment);
          }
        } else {
          Alert.alert("Panier mixte impossible", msg, [
            { text: "Annuler", style: "cancel" },
            { 
              text: "Vider le panier", 
              style: "destructive", 
              onPress: () => {
                clearCart();
                addToCart(product, increment);
              } 
            }
          ]);
        }
      } else {
        console.error(err);
      }
    }
  };

  const handleDecrement = () => {
    if (currentQty > 0) {
      setQuantity(product.id, Math.max(0, currentQty - increment));
    }
  };

  return (
    <View style={[styles.productCard, isDesktop && styles.productCardDesktop]}>
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
          {isSurgele ? (
            <>
              <Text style={styles.productMetaItem}>
                {`Commande par palette entière (${product.cartons_par_palette || 24} cartons)`}
              </Text>
              <Text style={styles.productMetaItem}>
                {`1 carton = ${product.sachets_par_carton} sachets`}
              </Text>
            </>
          ) : (
            <Text style={styles.productMetaItem}>
              {`Commande par lot de ${increment}`}
            </Text>
          )}
        </View>

        {/* Prix */}
        <View style={styles.pricingBlock}>
          <View>
            <Text style={styles.priceMain}>{`${prixUnitaireHt.toFixed(2)} € HT / ${isSurgele ? 'carton' : 'unité'}`}</Text>
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
                    const cleaned = v.replace(/[^0-9]/g, '');
                    if (cleaned !== '') {
                      setQuantity(product.id, parseInt(cleaned, 10));
                    }
                  }}
                  onBlur={() => {
                    if (currentQty > 0) {
                      const rounded = Math.ceil(currentQty / increment) * increment;
                      setQuantity(product.id, Math.min(rounded, 9999));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={4}
                />
                <Text style={styles.qtyLabel}>
                  {`unité${currentQty > 1 ? 's' : ''}`}
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
  profileButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  profileButtonText: {
    color: colors.textSecondary,
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
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm - 2,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.white,
  },
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
  productCardDesktop: {
    flex: 0,
    width: '48%',
    minWidth: 280,
    maxWidth: 360,
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
  priceMain: {
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