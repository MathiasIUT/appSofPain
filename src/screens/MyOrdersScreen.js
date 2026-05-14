import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const PAGE_SIZE = 20;

export default function MyOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const ordersLengthRef = useRef(0);

  useEffect(() => { ordersLengthRef.current = orders.length; }, [orders.length]);

  const loadOrders = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const from = reset ? 0 : ordersLengthRef.current;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('client_id', user.id)
        .order('date_commande', { ascending: false })
        .range(from, to);
      if (error) throw error;

      if (reset) {
        setOrders(data || []);
      } else {
        setOrders((prev) => [...prev, ...(data || [])]);
      }
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('Erreur chargement commandes :', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { loadOrders(true); }, []);

  const hasMore = orders.length < totalCount;
  const displayed = orders;

  const handlePressOrder = useCallback((order) => {
    navigation.navigate('OrderDetail', { order });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ─────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes commandes</Text>
      </View>


      {/* ── Contenu ────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : displayed.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>
            Aucune commande
          </Text>
          <Text style={styles.emptySubtitle}>
            Vos commandes passées apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            isDesktop && styles.listDesktop,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android' || Platform.OS === 'web'}
          renderItem={({ item }) => <OrderCard item={item} onPress={handlePressOrder} />}
          ListFooterComponent={hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={() => loadOrders(false)}
              disabled={loadingMore}
              activeOpacity={0.7}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>
                  Charger plus ({orders.length}/{totalCount})
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        />
      )}
    </SafeAreaView>
  );
}

const OrderCard = React.memo(({ item, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardNum}>N° {item.numero}</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardDate}>
          {fmt(item.date_commande)}
        </Text>
        <Text style={styles.cardTotal}>
          {Number(item.total_ht ?? 0).toFixed(2)} € HT
        </Text>
      </View>
      <Text style={styles.cardArrow}>›</Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  backText: { color: colors.primary, fontWeight: '500', fontSize: fontSizes.sm },
  headerTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  tabBadge: {
    backgroundColor: colors.border,
    borderRadius: borderRadius.round,
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: colors.primary },
  tabBadgeText: { fontSize: fontSizes.xs - 1, fontWeight: '600', color: colors.textSecondary },
  tabBadgeTextActive: { color: colors.white },

  // États vides / loading
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary, fontSize: fontSizes.sm },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },

  // Liste
  list: { padding: spacing.lg, paddingBottom: spacing.xxl },
  listDesktop: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  loadMoreBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, marginTop: spacing.md,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  loadMoreText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },

  // Card commande
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardNum: { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.round,
  },
  badgeText: { fontSize: fontSizes.xs, fontWeight: '600' },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: { fontSize: fontSizes.sm, color: colors.textSecondary },
  cardTotal: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.primary },
  cardDelivery: {
    fontSize: fontSizes.xs,
    color: colors.textLight,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  cardArrow: {
    position: 'absolute',
    right: spacing.lg,
    top: '50%',
    fontSize: 22,
    color: colors.border,
  },
});