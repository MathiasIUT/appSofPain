import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Platform, Alert, useWindowDimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import { getDateTourneeFrais } from '../utils/orderSchedule';
import { generateDeliveryNotePdfBytes } from '../utils/generateDeliveryNotePdf';

const showAlert = (t, m) => {
  if (Platform.OS === 'web') window.alert(`${t}\n\n${m}`);
  else Alert.alert(t, m);
};

const fmtDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' });
};

// Bornes de semaine (lundi-dimanche) pour le groupement surgelé
const getWeekBoundaries = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d)) return { monIso: dateStr, sunIso: dateStr, monDisp: dateStr, sunDisp: dateStr };
  const day = d.getDay();
  const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    monIso: monday.toISOString().split('T')[0],
    sunIso: sunday.toISOString().split('T')[0],
    monDisp: monday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
    sunDisp: sunday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
  };
};

export default function LivreurDashboard({ navigation }) {
  const [livreur, setLivreur] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validating, setValidating] = useState(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      // Vérifier le rôle livreur
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, actif')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile || profile.role !== 'livreur' || profile.actif === false) {
        await supabase.auth.signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      // Récupérer la fiche livreur liée à ce compte
      const { data: livreurRow, error: livreurError } = await supabase
        .from('livreurs')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (livreurError && livreurError.code !== 'PGRST116') throw livreurError;
      if (!livreurRow) {
        showAlert('Erreur', 'Aucune tournée associée à ce compte. Contactez l\'administrateur.');
        setLivreur(null);
        setOrders([]);
        return;
      }
      setLivreur(livreurRow);

      // Ses commandes à livrer
      const { data: fetched, error: ordersError } = await supabase
        .from('orders')
        .select('*, client:profiles!client_id(nom_societe, nom, prenom, telephone, ordre_tournee), order_items(*)')
        .eq('livreur_id', livreurRow.id)
        .is('deleted_at', null)
        .in('statut', ['nouvelle', 'traite', 'en_preparation', 'en_livraison'])
        .order('date_commande', { ascending: true });
      if (ordersError) throw ordersError;

      const list = fetched || [];
      list.sort((a, b) => {
        const oa = a.client?.ordre_tournee || 0;
        const ob = b.client?.ordre_tournee || 0;
        if (oa !== ob) return oa - ob;
        return (a.numero || '').localeCompare(b.numero || '');
      });
      setOrders(list);
    } catch (err) {
      console.error('Erreur chargement tournées :', err);
      showAlert('Erreur', 'Impossible de charger vos tournées.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // Groupes : frais par jour de tournée, surgelé par semaine
  const groupKeys = [...new Set(orders.map(o => {
    if (o.type_commande === 'surgele') {
      const w = getWeekBoundaries((o.date_commande || '').split('T')[0]);
      return `${w.monIso}_${w.sunIso}_surgele`;
    }
    return `${getDateTourneeFrais(o)}_frais`;
  }))].sort((a, b) => {
    const sa = a.endsWith('_surgele');
    const sb = b.endsWith('_surgele');
    if (sa !== sb) return sa ? 1 : -1; // frais d'abord
    return a.split('_')[0].localeCompare(b.split('_')[0]); // plus ancien en premier
  });

  const getGroupOrders = (groupKey) => {
    if (groupKey.endsWith('_surgele')) {
      const [monIso, sunIso] = groupKey.split('_');
      return orders.filter(o => {
        if (o.type_commande !== 'surgele') return false;
        const w = getWeekBoundaries((o.date_commande || '').split('T')[0]);
        return w.monIso === monIso && w.sunIso === sunIso;
      });
    }
    const [isoDate] = groupKey.split('_');
    return orders.filter(o =>
      o.type_commande !== 'surgele' && getDateTourneeFrais(o) === isoDate
    );
  };

  const handleValiderCommande = async (order) => {
    const clientName = order.client?.nom_societe
      || [order.client?.prenom, order.client?.nom].filter(Boolean).join(' ')
      || order.client_nom
      || 'Client';
    const msg = `Valider la livraison de la commande N° ${order.numero} pour ${clientName} ?\n\nLe bon sera enregistré dans l’application et envoyé à l’adresse e-mail vérifiée du client.`;
    const confirmed = await new Promise((resolve) => {
      if (Platform.OS === 'web') resolve(window.confirm(msg));
      else Alert.alert('Valider la livraison', msg, [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Valider la commande', onPress: () => resolve(true) },
      ]);
    });
    if (!confirmed) return;

    setValidating(order.id);
    const storagePath = `${order.id}/delivery-note.pdf`;
    let uploaded = false;
    let deliveryRecorded = false;
    try {
      const pdfBytes = await generateDeliveryNotePdfBytes(
        order,
        order.order_items || [],
        order.client,
        new Date()
      );
      const { error: uploadError } = await supabase.storage
        .from('delivery-notes')
        .upload(storagePath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });
      if (uploadError) throw uploadError;
      uploaded = true;

      const { error: deliveryError } = await supabase.rpc('complete_order_delivery', {
        p_order_id: order.id,
        p_storage_path: storagePath,
      });
      if (deliveryError) throw deliveryError;
      deliveryRecorded = true;
      setOrders(prev => prev.filter(o => o.id !== order.id));

      const { error: emailError } = await supabase.functions.invoke('send-delivery-note', {
        body: { order_id: order.id },
      });
      if (emailError) {
        console.error('Livraison enregistrée, mais e-mail non envoyé :', emailError);
        showAlert(
          'Livraison validée',
          'Le bon est enregistré dans l’application, mais son e-mail n’a pas pu être envoyé. Le client pourra le consulter et demander un nouvel envoi depuis le détail de sa commande.'
        );
        return;
      }

      showAlert('Livraison validée', 'Le bon a été enregistré dans l’application et envoyé au client.');
    } catch (err) {
      console.error('Erreur validation livraison :', err);
      if (uploaded && !deliveryRecorded) {
        const { data: savedNote, error: noteCheckError } = await supabase
          .from('delivery_notes')
          .select('order_id')
          .eq('order_id', order.id)
          .maybeSingle();
        if (noteCheckError) {
          console.error('Impossible de vérifier si le bon a été enregistré :', noteCheckError);
        } else if (savedNote) {
          deliveryRecorded = true;
          setOrders(prev => prev.filter(o => o.id !== order.id));
        } else {
          const { error: cleanupError } = await supabase.storage
            .from('delivery-notes')
            .remove([storagePath]);
          if (cleanupError) console.error('Erreur nettoyage du PDF non associé :', cleanupError);
        }
      }
      showAlert(
        deliveryRecorded ? 'Livraison enregistrée' : 'Erreur',
        deliveryRecorded
          ? 'La livraison et son bon sont enregistrés, mais la confirmation a été interrompue. Vérifiez le statut du courriel dans le détail de la commande.'
          : 'Impossible de valider cette livraison et d’enregistrer son bon.'
      );
    } finally {
      setValidating(null);
    }
  };

  const livreurName = livreur ? [livreur.prenom, livreur.nom].filter(Boolean).join(' ') : '';

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          <Image source={require('../../assets/logo1.png')} style={s.logo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Mes tournées</Text>
            {livreurName ? <Text style={s.headerSub} numberOfLines={1}>{livreurName}</Text> : null}
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn} activeOpacity={0.7}>
          <Text style={s.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.loadingText}>Chargement de vos tournées...</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, isDesktop && s.contentDesktop]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}
        >
          <TouchableOpacity onPress={handleRefresh} style={s.refreshBtn} activeOpacity={0.7}>
            <Text style={s.refreshText}>↻ Actualiser</Text>
          </TouchableOpacity>

          {groupKeys.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>Aucune tournée en cours</Text>
              <Text style={s.emptyText}>Les commandes à livrer apparaîtront ici.</Text>
            </View>
          ) : (
            groupKeys.map(groupKey => {
              const isSurgele = groupKey.endsWith('_surgele');
              const groupOrders = getGroupOrders(groupKey);
              let title;
              if (isSurgele) {
                const w = getWeekBoundaries(groupKey.split('_')[0]);
                title = `Surgelé — semaine du ${w.monDisp} au ${w.sunDisp}`;
              } else {
                title = `Tournée frais — ${fmtDate(groupKey.split('_')[0])}`;
              }
              return (
                <View key={groupKey} style={[s.groupCard, isSurgele && s.groupCardSurgele]}>
                  <View style={s.groupHeader}>
                    <View style={s.groupHeading}>
                      <Text style={[s.groupTitle, isSurgele && { color: '#1565C0' }]}>{title}</Text>
                      <View style={[s.countBadge, isSurgele && { backgroundColor: '#E3F2FD' }]}>
                        <Text style={[s.countBadgeText, isSurgele && { color: '#1565C0' }]}>
                          {groupOrders.length} commande{groupOrders.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={handleRefresh}
                      disabled={refreshing}
                      accessibilityRole="button"
                      accessibilityLabel={`Actualiser la tournée ${title}`}
                      style={[s.groupRefreshBtn, refreshing && { opacity: 0.5 }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.groupRefreshText, isSurgele && { color: '#1565C0' }]}>
                        {refreshing ? 'Actualisation…' : '↻ Actualiser'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {groupOrders.map((o, idx) => {
                    const clientName = o.client?.nom_societe
                      || [o.client?.prenom, o.client?.nom].filter(Boolean).join(' ')
                      || o.client_nom || 'Client';
                    return (
                      <View key={o.id} style={[s.orderCard, idx > 0 && { marginTop: spacing.sm }]}>
                        <View style={s.orderHead}>
                          <View style={s.stopBadge}>
                            <Text style={s.stopBadgeText}>{idx + 1}</Text>
                          </View>
                          <Text style={s.clientName} numberOfLines={1}>{clientName}</Text>
                          <Text style={s.orderNum}>{`N° ${o.numero}`}</Text>
                        </View>
                        {o.adresse_livraison ? (
                          <Text style={s.address}>{o.adresse_livraison}</Text>
                        ) : null}
                        {o.client?.telephone ? (
                          <Text style={s.phone}>{`Tél : ${o.client.telephone}`}</Text>
                        ) : null}
                        {(o.order_items || []).length > 0 && (
                          <View style={s.itemsBox}>
                            {(o.order_items || []).map(it => (
                              <View key={it.id} style={s.itemRow}>
                                <Text style={s.itemName} numberOfLines={1}>{it.product_nom}</Text>
                                <Text style={s.itemQty}>{`× ${it.quantite}`}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {o.notes_client ? (
                          <Text style={s.notes}>{`Note : ${o.notes_client}`}</Text>
                        ) : null}
                        <TouchableOpacity
                          style={[s.validateBtn, validating === o.id && { opacity: 0.6 }]}
                          onPress={() => handleValiderCommande(o)}
                          disabled={validating !== null}
                          activeOpacity={0.8}
                        >
                          {validating === o.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={s.validateBtnText}>✓ Valider cette livraison</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.sidebarBg,
  },
  logo: { width: 48, height: 48 },
  headerTitle: { fontSize: fontSizes.md, fontWeight: '700', color: colors.white },
  headerSub: { fontSize: fontSizes.xs, color: colors.sidebarMuted },
  logoutBtn: {
    paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  logoutText: { fontSize: fontSizes.sm, color: colors.sidebarText, fontWeight: '500' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { marginTop: spacing.md, color: colors.textSecondary },
  content: { padding: spacing.md },
  contentDesktop: { maxWidth: 800, width: '100%', alignSelf: 'center' },
  refreshBtn: {
    alignSelf: 'flex-end', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  refreshText: { fontSize: fontSizes.sm, color: colors.primary, fontWeight: '600' },
  emptyBox: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.xxl, alignItems: 'center', ...shadows.sm,
  },
  emptyTitle: { fontSize: fontSizes.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  emptyText: { fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
  groupCard: {
    backgroundColor: '#F9FBF9', borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: '#E8F5E9',
    padding: spacing.md, marginBottom: spacing.lg,
  },
  groupCardSurgele: { backgroundColor: '#F5FAFF', borderColor: '#E3F2FD' },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md, flexWrap: 'wrap', gap: spacing.xs,
  },
  groupHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  groupTitle: { fontSize: fontSizes.md, fontWeight: '700', color: '#2E7D32', textTransform: 'capitalize', flexShrink: 1 },
  groupRefreshBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  groupRefreshText: { fontSize: fontSizes.xs, color: '#2E7D32', fontWeight: '700' },
  countBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: borderRadius.round },
  countBadgeText: { fontSize: fontSizes.xs, fontWeight: '700', color: '#2E7D32' },
  orderCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  orderHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  stopBadge: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  stopBadgeText: { fontSize: fontSizes.xs, fontWeight: '700', color: colors.white },
  clientName: { flex: 1, fontSize: fontSizes.md, fontWeight: '700', color: colors.textPrimary },
  orderNum: { fontSize: fontSizes.xs, color: colors.textLight },
  address: { fontSize: fontSizes.sm, color: colors.textPrimary, lineHeight: 20, marginBottom: 2 },
  phone: { fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  itemsBox: {
    backgroundColor: colors.background, borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, marginTop: spacing.xs,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  itemName: { flex: 1, fontSize: fontSizes.sm, color: colors.textPrimary, marginRight: spacing.sm },
  itemQty: { fontSize: fontSizes.sm, fontWeight: '700', color: colors.textPrimary },
  notes: { fontSize: fontSizes.xs, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.xs },
  validateBtn: {
    backgroundColor: '#2E7D32', borderRadius: borderRadius.md,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  validateBtnText: { fontSize: fontSizes.md, fontWeight: '700', color: colors.white },
});
