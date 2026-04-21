import React from 'react';
import { View,Image, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '../config/theme';

/**
 * En-tête de marque Sof Pain.
 * Réutilisable sur toutes les pages qui ont besoin du branding
 * (connexion, inscription, confirmation email, etc.)
 *
 * Props :
 *   - compact (boolean) : version réduite pour les écrans où le header prend trop de place
 */
export default function BrandHeader({ compact = false }) {
  return (
    <View style={styles.container}>
      <Text style={[styles.brandName, compact && styles.brandNameCompact]}>
        Sof Pain
      </Text>
      <Text style={[styles.tagline, compact && styles.taglineCompact]}>
        L'artisan des professionnels
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  logoCompact: {
    fontSize: 48,
    marginBottom: spacing.xs,
  },
  brandName: {
    fontSize: fontSizes.title,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  brandNameCompact: {
    fontSize: fontSizes.xxl,
  },
  tagline: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  taglineCompact: {
    fontSize: fontSizes.xs,
  },
});