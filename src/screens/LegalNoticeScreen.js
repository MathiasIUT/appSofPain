import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

export default function LegalNoticeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mentions Légales</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Informations légales</Text>
        <Text style={styles.title}>Mentions légales</Text>

        <Text style={styles.sectionTitle}>1. Éditeur de l'application et du site</Text>
        <Text style={styles.paragraph}>L'application Sof Pain est éditée par :</Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Raison sociale :</Text> Sof Pain</Text>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Forme juridique :</Text> SAS (Société par Actions Simplifiée)</Text>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Capital social :</Text> 4000 €</Text>
          <Text style={styles.listItem}>• <Text style={styles.bold}>SIRET :</Text> 82806427900015</Text>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Adresse du siège social :</Text> 7 allée de l'esperance, 93110 Rosny-sous-Bois</Text>
          <Text style={styles.listItem}>
            • <Text style={styles.bold}>Téléphone :</Text>{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('tel:+33180892731')}>01 80 89 27 31</Text>
          </Text>
          <Text style={styles.listItem}>
            • <Text style={styles.bold}>Email :</Text>{' '}
            <Text style={styles.link} onPress={() => Linking.openURL('mailto:contact@sofpain.com')}>contact@sofpain.com</Text>
          </Text>
        </View>

        <Text style={styles.sectionTitle}>2. Directeur de la publication</Text>
        <Text style={styles.paragraph}>Hamza GUNES</Text>

        <Text style={styles.sectionTitle}>3. Hébergement</Text>
        <Text style={styles.paragraph}>L'infrastructure de l'application est hébergée par :</Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Hébergeur Interface :</Text> Vercel Inc. (440 N Barranca Ave #4133, Covina, CA 91723, États-Unis)</Text>
          <Text style={styles.listItem}>• <Text style={styles.bold}>Base de données :</Text> Supabase</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>4. Propriété intellectuelle</Text>
        <Text style={styles.paragraph}>
          L'ensemble du contenu de cette application (textes, images, graphismes, logo, icônes) est la propriété exclusive de Sof Pain, sauf mention contraire. Toute reproduction, distribution ou utilisation sans autorisation écrite préalable est interdite.
        </Text>

        <Text style={styles.sectionTitle}>5. Limitation de responsabilité</Text>
        <Text style={styles.paragraph}>
          Sof Pain s'efforce de maintenir les informations de cette application à jour et exactes. Toutefois, nous ne pouvons garantir l'exhaustivité ou l'exactitude des informations publiées, et déclinons toute responsabilité pour les erreurs ou omissions éventuelles.
        </Text>
        <Text style={styles.paragraph}>
          Sof Pain ne saurait être tenu responsable des dommages directs ou indirects résultant de l'accès ou de l'utilisation de cette application.
        </Text>

        <Text style={styles.sectionTitle}>6. Droit applicable</Text>
        <Text style={styles.paragraph}>
          La présente application et ses mentions légales sont soumises au droit français. Tout litige relatif à l'utilisation de l'application sera soumis à la compétence exclusive des tribunaux français.
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
});
