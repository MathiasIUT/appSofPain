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
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';
import Button from '../components/Button';
import { generateOrderPdf } from '../utils/generateOrderPdf';
import { useCart } from '../contexts/CartContext';



const fmt = (d) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? `${d}T12:00:00` : d).toLocaleDateString('fr-FR', {
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
  const [deleting, setDeleting] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(order);
  const [deliveryNote, setDeliveryNote] = useState(null);
  const [openingDeliveryNote, setOpeningDeliveryNote] = useState(false);
  const [resendingDeliveryNote, setResendingDeliveryNote] = useState(false);
  const { loadOrderIntoCart, reorderIntoCart } = useCart();

  useEffect(() => {
    if (!order?.id) { setLoading(false); return; }
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); return; }

        const [ownershipRes, itemsRes, profileRes, deliveryNoteRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .eq('id', order.id)
            .eq('client_id', user.id)
            .is('deleted_at', null)
            .single(),
          supabase
            .from('order_items')
            .select('*, products(image_url)')
            .eq('order_id', order.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single(),
          supabase
            .from('delivery_notes')
            .select('storage_path, created_at, email_sent_at, email_error')
            .eq('order_id', order.id)
            .maybeSingle(),
        ]);

        if (ownershipRes.error) throw ownershipRes.error;
        if (itemsRes.error) throw itemsRes.error;
        if (profileRes.error) throw profileRes.error;
        if (deliveryNoteRes.error) throw deliveryNoteRes.error;
        if (!ownershipRes.data) {
          navigation.goBack();
          return;
        }
        setCurrentOrder(ownershipRes.data);
        if (itemsRes.data) setItems(itemsRes.data);
        if (profileRes.data) setClient(profileRes.data);
        setDeliveryNote(deliveryNoteRes.data);
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

  const handleOpenDeliveryNote = async () => {
    if (!deliveryNote?.storage_path) return;
    setOpeningDeliveryNote(true);
    try {
      const { data, error } = await supabase.storage
        .from('delivery-notes')
        .createSignedUrl(deliveryNote.storage_path, 300);
      if (error) throw error;
      if (Platform.OS === 'web') window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      else await Linking.openURL(data.signedUrl);
    } catch (err) {
      console.error('Erreur ouverture bon de livraison :', err);
      showAlert('Erreur', 'Impossible d’ouvrir le bon de livraison.');
    } finally {
      setOpeningDeliveryNote(false);
    }
  };

  const handleResendDeliveryNote = async () => {
    setResendingDeliveryNote(true);
    try {
      const { error } = await supabase.functions.invoke('send-delivery-note', {
        body: { order_id: currentOrder.id },
      });
      if (error) throw error;
      setDeliveryNote((previous) => ({
        ...previous,
        email_sent_at: new Date().toISOString(),
        email_error: null,
      }));
      showAlert('E-mail envoyé', 'Le bon de livraison a été envoyé à votre adresse e-mail vérifiée.');
    } catch (err) {
      console.error('Erreur nouvel envoi du bon de livraison :', err);
      showAlert('Erreur', 'Impossible d’envoyer le bon de livraison. Réessayez plus tard.');
    } finally {
      setResendingDeliveryNote(false);
    }
  };

  const handleReorder = () => {
    if (!items || items.length === 0) {
      showAlert('Erreur', 'Impossible de charger les articles à recommander.');
      return;
    }
    reorderIntoCart(items);
    navigation.navigate('Cart');
  };

  const handleEditOrder = () => {
    const msg = "Attention, en modifiant cette commande, sa date d'enregistrement sera mise à jour.\n\nToute modification après l'heure limite de commande décalera automatiquement la livraison au jour suivant.\n\nSouhaitez-vous continuer ?";
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

  const handleDeleteOrder = async () => {
    const msg = `Placer la commande N° ${order.numero} dans la corbeille ?\n\nElle sera masquée des listes et des documents. L’administrateur pourra la restaurer pendant 7 jours, après quoi elle sera supprimée définitivement.`;
    const proceed = Platform.OS === 'web' ? window.confirm(msg) : await new Promise(resolve => {
      Alert.alert(
        'Placer la commande dans la corbeille',
        msg,
        [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continuer', style: 'destructive', onPress: () => resolve(true) }
        ]
      );
    });

    if (!proceed) return;

    setDeleting(true);
    try {
      const { error } = await supabase.rpc('trash_my_order', {
        p_order_id: order.id,
      });
      if (error) throw error;

      showAlert('Succès', 'La commande a été placée dans la corbeille.');
      navigation.goBack();
    } catch (err) {
      console.error('Erreur suppression commande :', err);
      showAlert('Erreur', err.message);
    } finally {
      setDeleting(false);
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={styles.title}>N° {order.numero}</Text>
              {order.type_commande === 'surgele' ? (
                <View style={{ backgroundColor: '#E3F2FD', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 }}>
                  <Text style={{ color: '#1565C0', fontSize: 12, fontWeight: '700' }}>Surgelé</Text>
                </View>
              ) : (
                <View style={{ backgroundColor: '#E8F5E9', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 }}>
                  <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: '700' }}>Frais</Text>
                </View>
              )}
            </View>
            <Text style={styles.dateText}>Passée le {fmt(order.created_at || order.date_commande)}</Text>
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

          {order.type_commande === 'surgele' && order.date_livraison_souhaitee ? (
            <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
              <Text style={styles.infoLabel}>Date de livraison estimée :</Text>
              <Text style={[styles.infoValue, styles.infoValueRight]}>
                {fmt(order.date_livraison_souhaitee)}
              </Text>
            </View>
          ) : null}
          {order.type_commande !== 'surgele' && order.date_commande ? (
            <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
              <Text style={styles.infoLabel}>Date de livraison estimée :</Text>
              <Text style={[styles.infoValue, styles.infoValueRight]}>
                {fmt(order.date_livraison_souhaitee || new Date(new Date(order.date_commande).getTime() + 86400000))}
              </Text>
            </View>
          ) : null}

          {order.type_commande === 'surgele' && currentOrder.statut === 'en_preparation' ? (
            <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
              <Text style={styles.infoLabel}>Statut</Text>
              <View style={{ backgroundColor: '#E3F2FD', borderRadius: 4, paddingVertical: 3, paddingHorizontal: 8 }}>
                <Text style={{ color: '#1565C0', fontSize: 12, fontWeight: '700' }}>En préparation</Text>
              </View>
            </View>
          ) : null}

          {currentOrder.statut === 'livree' ? (
            <View style={[styles.infoRow, { marginTop: spacing.xs }]}>
              <Text style={styles.infoLabel}>Statut</Text>
              <View>
                <View style={{ backgroundColor: '#E8F5E9', borderRadius: 4, paddingVertical: 3, paddingHorizontal: 8 }}>
                  <Text style={{ color: '#2E7D32', fontSize: 12, fontWeight: '700' }}>Livré</Text>
                </View>
                {currentOrder.delivered_at ? (
                  <Text style={{ color: colors.textSecondary, fontSize: fontSizes.xs, marginTop: 4 }}>
                    {`Le ${new Date(currentOrder.delivered_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {order.notes_client ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{order.notes_client}</Text>
            </View>
          ) : null}
        </View>

        {currentOrder.statut === 'livree' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Bon de livraison</Text>
            {deliveryNote ? (
              <>
                <Text style={styles.deliveryNoteText}>
                  {deliveryNote.email_sent_at
                    ? 'Le bon est disponible ici et a été envoyé à votre adresse e-mail vérifiée.'
                    : 'Le bon est disponible ici. Son envoi par e-mail est à relancer.'}
                </Text>
                <Button
                  title="Consulter le bon de livraison"
                  onPress={handleOpenDeliveryNote}
                  loading={openingDeliveryNote}
                  disabled={openingDeliveryNote || resendingDeliveryNote}
                  fullWidth
                  size="lg"
                />
                {!deliveryNote.email_sent_at && (
                  <Button
                    title="Renvoyer le bon par e-mail"
                    onPress={handleResendDeliveryNote}
                    loading={resendingDeliveryNote}
                    disabled={openingDeliveryNote || resendingDeliveryNote}
                    fullWidth
                    size="lg"
                    variant="outline"
                  />
                )}
              </>
            ) : (
              <Text style={styles.deliveryNoteText}>Le bon de livraison n’est pas encore disponible.</Text>
            )}
          </View>
        )}

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
                <View style={[styles.totalLine, styles.totalFinal]}>
                  <Text style={styles.totalLabelFinal}>Total HT</Text>
                  <Text style={styles.totalValueFinal}>{`${n2(order.total_ht)} €`}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Bouton Recommander ───────────────────────────────── */}
        <Button
          title="Recommander à l'identique"
          onPress={handleReorder}
          disabled={pdfLoading || loading}
          fullWidth
          size="lg"
          style={{ marginBottom: spacing.md }}
        />

        {/* ── Bouton PDF ───────────────────────────────── */}
        <Button
          title="Télécharger le bon de commande"
          onPress={handlePdf}
          loading={pdfLoading}
          disabled={pdfLoading || loading}
          fullWidth
          size="lg"
          variant="outline"
        />

        {/* ── Boutons Modifier/Supprimer ──────────────── */}
        {/* Pour les frais : uniquement si statut === 'nouvelle'. Pour le surgelé : idem. */}
        {currentOrder.statut === 'nouvelle' && order.type_commande !== 'surgele' && (
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Button
              title="Modifier ma commande"
              onPress={handleEditOrder}
              disabled={pdfLoading || loading || deleting}
              fullWidth
              size="lg"
            />
            <TouchableOpacity
              style={[styles.deleteBtn, (pdfLoading || loading || deleting) && { opacity: 0.5 }]}
              onPress={handleDeleteOrder}
              disabled={pdfLoading || loading || deleting}
              activeOpacity={0.8}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.deleteBtnText}>Supprimer ma commande</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { color: colors.textSecondary, fontSize: fontSizes.md },
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  bodyDesktop: { maxWidth: 720, alignSelf: 'center', width: '100%' },
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
  deliveryNoteText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoLabel: { fontSize: fontSizes.sm, color: colors.textSecondary, flexShrink: 0 },
  infoValue: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.textPrimary },
  infoValueRight: { flex: 1, textAlign: 'right' },
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

  deleteBtn: {
    backgroundColor: '#D32F2F',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  deleteBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSizes.md,
  },
});