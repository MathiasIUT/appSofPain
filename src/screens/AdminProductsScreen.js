import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';
import Button from '../components/Button';

/**
 * Écran admin : liste des produits avec filtres.
 *
 * Pour l'instant (Livraison 1), l'écran est en lecture seule.
 * Les boutons "Ajouter" et "Modifier" seront fonctionnels dans la Livraison 2.
 */
export default function AdminProductsScreen() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all'); // 'all' | category_id
  const [showInactive, setShowInactive] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Chargement des catégories et produits
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('ordre'),
        supabase
          .from('products')
          .select('*, category:categories(id, nom, slug)')
          .order('created_at', { ascending: false }),
      ]);

      if (catRes.error) throw catRes.error;
      if (prodRes.error) throw prodRes.error;

      setCategories(catRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err) {
      console.error('Erreur chargement produits :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtres appliqués
  const filteredProducts = products.filter((p) => {
    if (!showInactive && !p.actif) return false;
    if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;
    return true;
  });

  // Statistiques en haut de l'écran
  const stats = {
    total: products.length,
    actifs: products.filter((p) => p.actif).length,
    frais: products.filter((p) => p.category?.slug === 'frais' && p.actif).length,
    surgele: products.filter((p) => p.category?.slug === 'surgele' && p.actif).length,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Chargement des produits...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* En-tête avec titre et bouton ajouter */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Gestion des produits</Text>
          <Text style={styles.subtitle}>
            {stats.actifs} produit{stats.actifs > 1 ? 's' : ''} actif
            {stats.actifs > 1 ? 's' : ''} ({stats.total} au total)
          </Text>
        </View>
        <Button
          title="Ajouter un produit"
          icon="➕"
          onPress={() => {
            // TODO: Livraison 2 - ouvrir le modal de création
            alert('Fonctionnalité disponible dans la prochaine livraison.');
          }}
        />
      </View>

      {/* Cartes de stats */}
      <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
        <StatCard label="Total produits" value={stats.total} icon="📦" />
        <StatCard label="Produits actifs" value={stats.actifs} icon="✅" />
        <StatCard label="Pain frais" value={stats.frais} icon="🥖" />
        <StatCard label="Pain surgelé" value={stats.surgele} icon="❄️" />
      </View>

      {/* Filtres */}
      <View style={styles.filters}>
        <Text style={styles.filtersLabel}>Filtrer par :</Text>
        <View style={styles.filterChips}>
          <FilterChip
            label="Toutes"
            active={filterCategory === 'all'}
            onPress={() => setFilterCategory('all')}
          />
          {categories.map((cat) => (
            <FilterChip
              key={cat.id}
              label={cat.nom}
              active={filterCategory === cat.id}
              onPress={() => setFilterCategory(cat.id)}
            />
          ))}
        </View>
        <TouchableOpacity
          style={styles.toggleInactive}
          onPress={() => setShowInactive(!showInactive)}
        >
          <Text style={styles.toggleInactiveIcon}>
            {showInactive ? '☑️' : '⬜'}
          </Text>
          <Text style={styles.toggleInactiveLabel}>
            Afficher les produits désactivés
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liste des produits */}
      {filteredProducts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>Aucun produit</Text>
          <Text style={styles.emptyText}>
            {products.length === 0
              ? 'Commencez par ajouter votre premier produit.'
              : 'Aucun produit ne correspond aux filtres.'}
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
  );
}

// ---------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------

function StatCard({ label, value, icon }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ProductCard({ product }) {
  const totalCartons = 24; // Fixe pour Sof Pain
  return (
    <View style={[styles.productCard, !product.actif && styles.productCardInactive]}>
      {/* Image ou placeholder */}
      <View style={styles.productImage}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImg} />
        ) : (
          <Text style={styles.productImgPlaceholder}>
            {product.category?.slug === 'surgele' ? '❄️' : '🥖'}
          </Text>
        )}
        {!product.actif && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Désactivé</Text>
          </View>
        )}
      </View>

      <View style={styles.productInfo}>
        <View style={styles.productCategoryTag}>
          <Text style={styles.productCategoryTagText}>
            {product.category?.nom || 'Sans catégorie'}
          </Text>
        </View>

        <Text style={styles.productName} numberOfLines={2}>
          {product.nom}
        </Text>

        {product.description && (
          <Text style={styles.productDesc} numberOfLines={2}>
            {product.description}
          </Text>
        )}

        <View style={styles.productDetails}>
          <Text style={styles.productDetailItem}>
            📦 {totalCartons} cartons / palette
          </Text>
          <Text style={styles.productDetailItem}>
            🔢 {product.unites_par_carton} unités / carton
          </Text>
        </View>

        <View style={styles.productPriceRow}>
          <Text style={styles.productPrice}>
            {Number(product.prix_palette_ht).toFixed(2)} € HT
          </Text>
          <Text style={styles.productPriceUnit}>/ palette</Text>
        </View>

        <View style={styles.productActions}>
          <Button
            title="Modifier"
            variant="secondary"
            size="sm"
            onPress={() => {
              // TODO: Livraison 2 - ouvrir le modal d'édition
              alert('Fonctionnalité disponible dans la prochaine livraison.');
            }}
          />
        </View>
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
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

  // Stats cards
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  statsGridDesktop: {
    // sur desktop, grosses cartes alignées
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  // Filtres
  filters: {
    marginBottom: spacing.lg,
  },
  filtersLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface,
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
  toggleInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  toggleInactiveIcon: {
    fontSize: fontSizes.md,
    marginRight: spacing.sm,
  },
  toggleInactiveLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
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

  // Products grid
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
  },
  productCardInactive: {
    opacity: 0.6,
  },
  productImage: {
    width: '100%',
    height: 160,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  productImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImgPlaceholder: {
    fontSize: 64,
  },
  inactiveBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.error,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  inactiveBadgeText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  productInfo: {
    padding: spacing.md,
  },
  productCategoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  productCategoryTagText: {
    fontSize: fontSizes.xs,
    color: colors.primary,
    fontWeight: '600',
  },
  productName: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  productDesc: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  productDetails: {
    marginBottom: spacing.md,
  },
  productDetailItem: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  productPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  productPrice: {
    fontSize: fontSizes.xl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  productPriceUnit: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  productActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});