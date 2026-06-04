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
  Alert,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import Button from '../components/Button';
import ProductFormModal from '../components/ProductFormModal';
const VISIBLE_CATEGORY_SLUGS = ['frais', 'surgele'];

/**
 * Écran admin : liste des produits avec filtres + création/modification via modal.
 */
export default function AdminProductsScreen() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const loadData = useCallback(async () => {
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
      const visibleCategories = (catRes.data || []).filter((c) =>
        VISIBLE_CATEGORY_SLUGS.includes(c.slug)
      );
      setCategories(visibleCategories);
      const visibleProducts = (prodRes.data || []).filter((p) =>
        VISIBLE_CATEGORY_SLUGS.includes(p.category?.slug)
      );
      setProducts(visibleProducts);
    } catch (err) {
      console.error('Erreur chargement produits :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  const handleCreate = () => {
    setEditingProduct(null);
    setModalVisible(true);
  };
  const handleEdit = (product) => {
    setEditingProduct(product);
    setModalVisible(true);
  };

  const handleSaved = () => { loadData(); };

  const handleDelete = async (product) => {
    try {
      const { count, error: checkError } = await supabase
        .from('order_items').select('id', { count: 'exact', head: true })
        .eq('product_id', product.id);
      if (checkError) throw checkError;

      if (count > 0) {
        const msg = `"${product.nom}" est présent dans ${count} commande${count > 1 ? 's' : ''} existante${count > 1 ? 's' : ''}.\n\nSuppression impossible — désactivez-le à la place pour le retirer du catalogue sans perdre l'historique.`;
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Suppression impossible', msg);
        return;
      }

      const confirmed = Platform.OS === 'web'
        ? window.confirm(`Supprimer "${product.nom}" ? Cette action est irréversible.`)
        : await new Promise(resolve => Alert.alert(
            'Supprimer le produit',
            `Supprimer "${product.nom}" ? Cette action est irréversible.`,
            [{ text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
             { text: 'Supprimer', style: 'destructive', onPress: () => resolve(true) }]
          ));
      if (!confirmed) return;

      const { error } = await supabase.from('products').delete().eq('id', product.id);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== product.id));
    } catch (err) {
      if (Platform.OS === 'web') window.alert(`Erreur\n\n${err.message || 'Impossible de supprimer le produit.'}`);
      else Alert.alert('Erreur', err.message || 'Impossible de supprimer le produit.');
    }
  };
  const filteredProducts = products.filter((p) => {
    if (!showInactive && !p.actif) return false;
    if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;
    return true;
  });

  const stats = {
    total: products.length,
    actifs: products.filter((p) => p.actif).length,
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
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        {/* En-tête */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Gestion des produits</Text>
            <Text style={styles.subtitle}>
              {stats.actifs} produit{stats.actifs > 1 ? 's' : ''} actif
              {stats.actifs > 1 ? 's' : ''} sur {stats.total} au total
            </Text>
          </View>
          <Button title="Ajouter un produit" onPress={handleCreate} />
        </View>

        {/* Filtres (seulement si plus d'une catégorie visible) */}
        {categories.length > 1 && (
          <View style={styles.filtersRow}>
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
        )}

        <TouchableOpacity
          style={styles.toggleInactive}
          onPress={() => setShowInactive(!showInactive)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, showInactive && styles.checkboxChecked]}>
            {showInactive && <View style={styles.checkboxInner} />}
          </View>
          <Text style={styles.toggleInactiveLabel}>
            Afficher les produits désactivés
          </Text>
        </TouchableOpacity>

        {/* Liste des produits */}
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aucun produit</Text>
            <Text style={styles.emptyText}>
              {products.length === 0
                ? 'Commencez par ajouter votre premier produit.'
                : 'Aucun produit ne correspond aux filtres sélectionnés.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.productsGrid, isDesktop && styles.productsGridDesktop]}>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => handleEdit(product)}
                onDelete={() => handleDelete(product)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal de création/modification */}
      <ProductFormModal
        visible={modalVisible}
        product={editingProduct}
        categories={categories}
        onClose={() => setModalVisible(false)}
        onSaved={handleSaved}
      />
    </>
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

function ProductCard({ product, onEdit, onDelete }) {
  return (
    <View style={[styles.productCard, !product.actif && styles.productCardInactive]}>
      {/* Image ou placeholder */}
      <View style={styles.productImage}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.productImg} />
        ) : (
          <View style={styles.productImgEmpty}>
            <Text style={styles.productImgEmptyText}>Sof Pain</Text>
          </View>
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

        <Text style={styles.productDesc} numberOfLines={2}>
          {product.description || ' '}
        </Text>

        <View style={styles.productDetails}>
          <Text style={styles.productDetailItem}>
            Multiple de {product.increment || 10}
          </Text>
          {product.category?.slug === 'surgele' && (
            <Text style={styles.productDetailItem}>
              1 palette = {product.cartons_par_palette || 24} cartons · 1 carton = {product.sachets_par_carton} sachets
            </Text>
          )}
        </View>

        <View style={styles.productPriceRow}>
          <Text style={styles.productPrice}>
            {`${Number(product.prix_unitaire_ht || 0).toFixed(2)} € HT`}
          </Text>
          <Text style={styles.productPriceUnit}>/ unité</Text>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Modifier" variant="secondary" size="sm" onPress={onEdit} />
          </View>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: {
    flex: 1,
    minWidth: 200,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  filtersRow: {
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
    backgroundColor: colors.secondary,
    borderColor: colors.primary,
  },
  chipLabel: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  chipLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  toggleInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    alignSelf: 'flex-start',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 3,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    backgroundColor: colors.white,
    borderRadius: 1,
  },
  toggleInactiveLabel: {
    fontSize: fontSizes.sm,
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
  productCardInactive: {
    opacity: 0.6,
  },
  productImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F3E5D8',
    overflow: 'hidden',
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
  inactiveBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.error,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.sm,
  },
  inactiveBadgeText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  productInfo: {
    padding: spacing.md,
    flex: 1,
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
    minHeight: 36,
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
    fontWeight: '700',
    color: colors.primary,
  },
  productPriceUnit: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  deleteBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  deleteBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.error,
  },
});