import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { colors, spacing } from '../config/theme';

/**
 * En-tête de marque Sof Pain.
 * Affiche le logo officiel de l'entreprise.
 *
 * Props :
 *   - size ('sm' | 'md' | 'lg') : taille du logo (default: 'md')
 */
export default function BrandHeader({ size = 'md' }) {
  const logoSize = {
    sm: 60,
    md: 100,
    lg: 140,
  }[size];

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo1.png')}
        style={[styles.logo, { width: logoSize, height: logoSize }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    // width et height définies dynamiquement via la prop size
  },
});