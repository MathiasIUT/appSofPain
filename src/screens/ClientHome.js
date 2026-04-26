import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Card, Chip, Searchbar, Text } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, shadows, borderRadius } from '../config/theme';
import ScreenLayout from '../components/ScreenLayout';
import QuantityInput from '../components/QuantityInput';
import EmptyState from '../components/EmptyState';
import { useCart } from '../contexts/CartContext';

const VISIBLE_CATEGORY_SLUGS = ['frais'];

export default function ClientHome({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState(null);
  const { items: cartItems, totals } = useCart();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const [profileRes, prodRes] = await Promise.all([
        supabase.from('profiles').select('nom, prenom, nom_societe').eq('id', user.id).single(),
        supabase.from('products').select('*, category:categories(id, nom, slug)').eq('actif', true).order('nom', { ascending: true }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (prodRes.error) throw prodRes.error;
      const visible = (prodRes.data || []).filter((p) => VISIBLE_CATEGORY_SLUGS.includes(p.category?.slug));
      setProducts(visible);
    } catch (err) {
      console.error('Erreur chargement catalogue :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => p.nom.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [products, searchQuery]);

  const cartFooter = cartItems.length > 0 ? (
    <View style={styles.cartBar}>
      <View style={styles.cartBarInfo}>
        <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {totals.nbProduitsDistincts} produit{totals.nbProduitsDistincts > 1 ? 's' : ''} · {totals.nbArticles} palette{totals.nbArticles > 1 ? 's' : ''}
        </Text>
        <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '700' }}>
          {totals.totalTtc.toFixed(2)} € TTC
        </Text>
      </View>
      <Button mode="contained" onPress={() => navigation.navigate('Cart')} style={styles.cartBarBtn}>
        Voir mon panier
      </Button>
    </View>
  ) : null;

  const topHeader = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image source={require('../../assets/logo1.png')} style={styles.logo} resizeMode="contain" />
        <View>
          <Text variant="bodyMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
            Bonjour {profile?.prenom || ''}
          </Text>
          {profile?.nom_societe ? (
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>{profile.nom_societe}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.headerRight}>
        <Button mode="contained" compact onPress={() => navigation.navigate('Cart')} style={styles.cartBtn}>
          Panier {totals.nbArticles > 0 ? `(${totals.nbArticles})` : ''}
        </Button>
        <Button mode="outlined" compact onPress={() => navigation.navigate('MyOrders')} style={styles.ordersBtn}>
          Mes commandes
        </Button>
        <Button mode="text" compact onPress={handleLogout}>
          Déconnexion
        </Button>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={{ color: colors.textSecondary, marginTop: spacing.md }}>
          Chargement du catalogue...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <ScreenLayout header={topHeader} footer={cartFooter}>
      <Searchbar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Rechercher un produit..."
        style={styles.searchbar}
      />

      <View style={styles.catalogHeader}>
        <Text variant="headlineMedium" style={{ color: colors.textPrimary, fontWeight: '700' }}>Catalogue</Text>
        <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
          {products.length} produit{products.length > 1 ? 's' : ''} disponible{products.length > 1 ? 's' : ''}
        </Text>
      </View>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={searchQuery ? '🔍' : '📦'}
          title={searchQuery ? 'Aucun résultat' : 'Aucun produit disponible'}
          subtitle={searchQuery ? `Aucun produit ne correspond à "${searchQuery}"` : 'Revenez bientôt pour découvrir nos produits.'}
        />
      ) : (
        <View style={[styles.productsGrid, isDesktop && styles.productsGridDesktop]}>
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>
      )}
    </ScreenLayout>
  );
}

function ProductCard({ product }) {
  const { items, addToCart, setQuantity } = useCart();
  const TVA = Number(product.tva_pourcent);
  const prixHt = Number(product.prix_palette_ht);
  const prixTtc = prixHt * (1 + TVA / 100);
  const inCart = items.find((i) => i.product.id === product.id);
  const currentQty = inCart ? inCart.quantite_palettes : 0;

  const handleChange = (qty) => {
    if (qty === 0) setQuantity(product.id, 0);
    else if (currentQty === 0) addToCart(product, qty);
    else setQuantity(product.id, qty);
  };

  return (
    <Card style={styles.productCard} elevation={1}>
      <Card.Cover
        source={product.image_url ? { uri: product.image_url } : require('../../assets/logo1.png')}
        style={styles.productCover}
      />
      <Card.Content style={styles.productContent}>
        <Text variant="titleLarge" numberOfLines={2} style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: 4 }}>
          {product.nom}
        </Text>
        {product.description ? (
          <Text variant="bodySmall" numberOfLines={2} style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {product.description}
          </Text>
        ) : null}
        <Text variant="bodySmall" style={{ color: colors.textSecondary, marginBottom: 12 }}>
          24 cartons / palette · {product.unites_par_carton} unité{product.unites_par_carton > 1 ? 's' : ''} / carton
        </Text>
        <View style={styles.pricingBlock}>
          <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '800' }}>{prixTtc.toFixed(2)} € TTC</Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>{prixHt.toFixed(2)} € HT · TVA {TVA}%</Text>
        </View>
        <QuantityInput value={currentQty} onChange={handleChange} min={0} unit="palette" />
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap', gap: spacing.md, ...shadows.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 180, gap: spacing.sm },
  logo: { width: 48, height: 48 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cartBtn: { borderRadius: borderRadius.md },
  ordersBtn: { borderRadius: borderRadius.md },
  searchbar: { marginBottom: spacing.md, backgroundColor: colors.surface },
  catalogHeader: { marginBottom: spacing.md },
  productsGrid: { gap: spacing.md },
  productsGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  productCard: { flex: 1, minWidth: 280, maxWidth: 360, backgroundColor: colors.surface },
  productCover: { height: 180 },
  productContent: { paddingTop: spacing.md },
  pricingBlock: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cartBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.sidebarBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.md, ...shadows.lg,
  },
  cartBarInfo: { flex: 1 },
  cartBarBtn: { borderRadius: borderRadius.md },
});
