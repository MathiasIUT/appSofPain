import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

export default function PrivacyPolicyScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confidentialité</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>RGPD & Données personnelles</Text>
        <Text style={styles.title}>Politique de confidentialité</Text>

        <Text style={styles.sectionTitle}>1. Responsable du traitement</Text>
        <Text style={styles.paragraph}>Le responsable du traitement des données personnelles collectées est :</Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Sof Pain</Text> — SAS</Text>
          <Text style={styles.listItem}>
            • <Text style={styles.bold}>Email :</Text>{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('mailto:contact@sofpain.com')}>contact@sofpain.com</Text>
          </Text>
          <Text style={styles.listItem}>
            • <Text style={styles.bold}>Téléphone :</Text>{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('tel:+33180892731')}>01 80 89 27 31</Text>
          </Text>
        </View>

        <Text style={styles.sectionTitle}>2. Données collectées</Text>
        <Text style={styles.paragraph}>
          L'application Sof Pain collecte des données nécessaires à la gestion de vos commandes et à l'accès à votre espace client professionnel.
        </Text>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 1.5 }]}>Données</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText, { flex: 2 }]}>Finalité</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Email, mot de passe, nom, prénom, nom de société</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Création et gestion du compte client, connexion sécurisée</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Historique de commandes, produits favoris</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Faciliter vos réassorts et suivi de facturation</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1.5 }]}>Téléphone, adresses</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>Livraison de vos commandes et contact</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>3. Hébergement des données</Text>
        <Text style={styles.paragraph}>
          Vos données sont stockées de manière sécurisée sur nos serveurs de base de données (Supabase). Sof Pain s'engage à appliquer des standards de sécurité élevés pour empêcher tout accès non autorisé.
        </Text>

        <Text style={styles.sectionTitle}>4. Partage des données</Text>
        <Text style={styles.paragraph}>
          Sof Pain ne vend, ne loue et ne partage aucune donnée personnelle avec des tiers à des fins commerciales. Vos données ne sont transmises à aucun prestataire externe, sauf obligation légale.
        </Text>

        <Text style={styles.sectionTitle}>5. Vos droits (RGPD)</Text>
        <Text style={styles.paragraph}>
          Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez des droits suivants :
        </Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Droit d'accès</Text> — obtenir une copie de vos données</Text>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Droit de rectification</Text> — corriger des données inexactes</Text>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Droit à l'effacement</Text> — demander la suppression de votre compte et de vos données</Text>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Droit à la limitation</Text> — limiter le traitement</Text>
        </View>
        <Text style={styles.paragraph}>
          Pour exercer ces droits, contactez-nous à : <Text style={styles.link} onPress={() => Linking.openURL('mailto:contact@sofpain.com')}>contact@sofpain.com</Text>
        </Text>

        <Text style={styles.sectionTitle}>6. Suppression de compte</Text>
        <Text style={styles.paragraph}>
          Si vous souhaitez supprimer définitivement votre compte et l'ensemble de vos données associées, vous pouvez en faire la demande en contactant notre équipe via l'adresse email ci-dessus. L'action sera traitée dans les plus brefs délais.
        </Text>

        <Text style={styles.sectionTitle}>7. Modifications</Text>
        <Text style={styles.paragraph}>
          Cette politique de confidentialité peut être mise à jour à tout moment. Nous vous encourageons à la consulter régulièrement.
        </Text>

        <View style={styles.divider} />
        
        <Text style={styles.footerDate}>Dernière mise à jour : juin 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  backButtonText: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  eyebrow: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSizes.xxxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  paragraph: {
    fontSize: fontSizes.md,
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  list: {
    marginBottom: spacing.md,
    paddingLeft: spacing.sm,
  },
  listItem: {
    fontSize: fontSizes.md,
    lineHeight: 24,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  bold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xxl,
  },
  footerDate: {
    fontSize: fontSizes.sm,
    color: colors.textLight,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginVertical: spacing.md,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeader: {
    backgroundColor: colors.surface,
  },
  tableCell: {
    padding: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  tableHeaderText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
