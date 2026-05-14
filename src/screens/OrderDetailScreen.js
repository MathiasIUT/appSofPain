import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';
import Button from '../components/Button';
import { generateOrderPdf } from '../utils/generateOrderPdf';
import { useCart } from '../contexts/CartContext';



const fmt = (d) =>
  new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

const n2 = (v) => Number(v ?? 0).toFixed(2);

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function OrderDetailScreen({ navigation, route }) {
  const { order } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [items, setItems] = useState([]);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const { loadOrderIntoCart } = useCart();

  useEffect(() => {
    if (!order?.id) { setLoading(false); return; }
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); return; }

        const [ownershipRes, itemsRes, profileRes] = await Promise.all([
          supabase
            .from('orders')
            .select('id')
            .eq('id', order.id)
            .eq('client_id', user.id)
            .single(),
          supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),
        ]);

        if (!ownershipRes.data) {
          navigation.goBack();
          return;
        }
        if (itemsRes.data) setItems(itemsRes.data);
        if (profileRes.data) setClient(profileRes.data);
      } catch (err) {
        console.error('Erreur chargement détail commande :', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [order?.id]);

  const handlePdf = async () => {
    if (!client) {
      showAlert('Erreur', 'Profil client non chargé.');
      return;
    }
    setPdfLoading(true);
    try {
      await generateOrderPdf(order, items, client);
    } catch (err) {
      console.error('Erreur PDF :', err);
      showAlert('Erreur', 'Impossible de générer le bon de commande.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEditOrder = () => {
    const msg = "Attention, en modifiant cette commande, sa date d'enregistrement sera mise à jour.\n\nToute modification après minuit décalera automatiquement la livraison au jour suivant.\n\nSouhaitez-vous continuer ?";
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) {
        loadOrderIntoCart(order, items);
        navigation.navigate('Cart');
      }
    } else {
      Alert.alert(
        'Modifier la commande',
        msg,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Continuer',
            onPress: () => {
              loadOrderIntoCart(order, items);
              navigation.navigate('Cart');
            }
          }
        ]
      );
    }
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Commande introuvable.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }



  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>← Mes commandes</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, isDesktop && styles.bodyDesktop]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>N° {order.numero}</Text>
            <Text style={styles.dateText}>Passée le {fmt(order.date_commande)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Livraison</Text>

          {order.adresse_livraison ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adresse</Text>
              <Text style={[styles.infoValue, styles.infoValueRight]} numberOfLines={3}>
                {order.adresse_livraison}
              </Text>
            </View>
          ) : null}

          {order.notes_client ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{order.notes_client}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Produits commandés</Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
          ) : items.length === 0 ? (
            <Text style={styles.emptyText}>Aucun article trouvé.</Text>
          ) : (
            <>
              <View style={styles.tableHead}>
                <Text style={[styles.thCell, { flex: 3 }]}>Produit</Text>
                <Text style={[styles.thCell, styles.right, { flex: 1.5 }]}>Quantité</Text>
                <Text style={[styles.thCell, styles.right, { flex: 2 }]}>ST HT</Text>
              </View>

              {items.map((it, idx) => (
                <View
                  key={it.id}
                  style={[styles.tableRow, idx % 2 === 1 && styles.rowAlt]}
                >
                  <Text style={[styles.tdCell, { flex: 3 }]} numberOfLines={2}>
                    {it.product_nom}
                  </Text>
                  <Text style={[styles.tdCell, styles.right, { flex: 1.5 }]}>
                    {`${it.quantite} unité${it.quantite > 1 ? 's' : ''}`}
                  </Text>
                  <Text style={[styles.tdCell, styles.right, { flex: 2 }]}>
                    {`${n2(it.sous_total_ht)} €`}
                  </Text>
                </View>
              ))}

              <View style={styles.totalsWrap}>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>Total HT</Text>
                  <Text style={styles.totalValue}>{`${n2(order.total_ht)} €`}</Text>
                </View>
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>TVA</Text>
                  <Text style={styles.totalValue}>{`${n2(order.total_tva)} €`}</Text>
                </View>
                <View style={[styles.totalLine, styles.totalFinal]}>
                  <Text style={styles.totalLabelFinal}>Total TTC</Text>
                  <Text style={styles.totalValueFinal}>{`${n2(order.total_ttc)} €`}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Bouton PDF ───────────────────────────────── */}
        <Button
          title="Télécharger le bon de commande"
          onPress={handlePdf}
          loading={pdfLoading}
          disabled={pdfLoading || loading}
          fullWidth
          size="lg"
        />

        {/* ── Bouton Modifier ──────────────────────────── */}
        {order.statut === 'nouvelle' && (
          <View style={{ marginTop: spacing.md }}>
            <Button
              title="Modifier ma commande"
              onPress={handleEditOrder}
              disabled={pdfLoading || loading}
              fullWidth
              size="lg"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
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
  backText: { color: colors.primary, fontWeight: '500', fontSize: fontSizes.sm },

  // États
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { color: colors.textSecondary, fontSize: fontSizes.md },

  // Body scroll
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  bodyDesktop: { maxWidth: 720, alignSelf: 'center', width: '100%' },

  // Titre
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: { fontSize: fontSizes.xl, fontWeight: '700', color: colors.textPrimary },
  dateText: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
    marginLeft: spacing.sm,
  },
  badgeText: { fontSize: fontSizes.xs, fontWeight: '700' },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Infos livraison
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoLabel: { fontSize: fontSizes.sm, color: colors.textSecondary, flexShrink: 0 },
  infoValue: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textPrimary },
  infoValueRight: { flex: 1, textAlign: 'right' },

  // Notes
  notesBox: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  notesLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  notesText: { fontSize: fontSizes.sm, color: colors.textPrimary, fontStyle: 'italic' },

  // Tableau produits
  tableHead: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  thCell: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: borderRadius.sm,
  },
  rowAlt: { backgroundColor: colors.secondary },
  tdCell: { fontSize: fontSizes.sm, color: colors.textPrimary },
  right: { textAlign: 'right' },

  // Totaux
  totalsWrap: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 4,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: { fontSize: fontSizes.sm, color: colors.textSecondary },
  totalValue: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textPrimary },
  totalFinal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  totalLabelFinal: { fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  totalValueFinal: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.primary },

  emptyText: { color: colors.textSecondary, fontSize: fontSizes.sm, fontStyle: 'italic' },
});