import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';
import Button from '../components/Button';
import { generateOrderPdf } from '../utils/generateOrderPdf';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const formatDate = (input) => {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Écran affiché après la création d'une commande.
 * Permet de télécharger le bon de commande PDF.
 */
export default function OrderConfirmationScreen({ navigation, route }) {
  const { order, items, client } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [generating, setGenerating] = useState(false);

  const handleDownloadPdf = async () => {
    if (!order || !items || !client) {
      showAlert('Erreur', 'Informations de commande incomplètes.');
      return;
    }

    setGenerating(true);
    try {
      await generateOrderPdf(order, items, client);
    } catch (err) {
      console.error('Erreur génération PDF :', err);
      showAlert('Erreur', 'Impossible de générer le bon de commande.');
    } finally {
      setGenerating(false);
    }
  };

  const handleBackToCatalog = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'ClientHome' }],
    });
  };

  const handleViewOrders = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'ClientHome' }, { name: 'MyOrders' }],
    });
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Commande introuvable</Text>
          <View style={{ marginTop: spacing.lg }}>
            <Button title="Retour au catalogue" onPress={handleBackToCatalog} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
      >
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          {/* Badge succès */}
          <View style={styles.successBadge}>
            <Text style={styles.successBadgeText}>✓</Text>
          </View>

          <Text style={styles.title}>Commande enregistrée</Text>
          <Text style={styles.subtitle}>
            Votre bon de commande a été généré avec succès.
          </Text>

          {/* Infos commande */}
          <View style={styles.infoBox}>
            <InfoLine label="Numéro de commande" value={order.numero} highlight />
            <InfoLine label="Date de commande" value={formatDate(order.date_commande)} />
            <InfoLine
              label="Total TTC"
              value={`${Number(order.total_ttc).toFixed(2)} €`}
              highlight
            />
          </View>

          {/* Message informatif */}
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Prochaines étapes</Text>
            <Text style={styles.noticeText}>
              Téléchargez votre bon de commande ci-dessous, puis contactez l'entreprise
              Sof Pain pour confirmer votre livraison. Aucun paiement n'a été débité
              à cette étape.
            </Text>
          </View>

          {/* Bouton principal : télécharger le PDF */}
          <View style={styles.actionPrimary}>
            <Button
              title="Télécharger le bon de commande"
              onPress={handleDownloadPdf}
              loading={generating}
              disabled={generating}
              fullWidth
              size="lg"
            />
          </View>

          {/* Actions secondaires */}
          <View style={styles.actionsRow}>
            <View style={styles.actionFlex}>
              <Button
                title="Voir mes commandes"
                variant="secondary"
                onPress={handleViewOrders}
                fullWidth
              />
            </View>
            <View style={styles.actionFlex}>
              <Button
                title="Retour au catalogue"
                variant="ghost"
                onPress={handleBackToCatalog}
                fullWidth
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoLine({ label, value, highlight }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    flexGrow: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDesktop: {
    padding: spacing.xxl,
  },
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successBadgeText: {
    color: colors.white,
    fontSize: 40,
    fontWeight: 'bold',
    lineHeight: 44,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  infoBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  infoLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  infoValueHighlight: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    color: colors.primary,
  },

  notice: {
    width: '100%',
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noticeTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  noticeText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  actionPrimary: {
    width: '100%',
    marginBottom: spacing.md,
  },
  actionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  actionFlex: {
    flex: 1,
    minWidth: 140,
  },
});