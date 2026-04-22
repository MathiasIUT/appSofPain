import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { colors, spacing } from '../config/theme';

/**
 * En-tête de marque Sof Pain.
 * Affiche le logo officiel de l'entreprise.
 *
 * Props :
 *   - size ('sm' | 'md' | 'lg') : taille du logo
 *     - sm : 140px (utilisé dans les écrans secondaires type ConfirmEmail)
 *     - md : 200px (défaut, utilisé sur la page de connexion/inscription)
 *     - lg : 260px (utilisé si on veut vraiment que ça crève l'écran)
 */
export default function BrandHeader({ size = 'md' }) {
  const logoSize = {
    sm: 220,
    md: 280,
    lg: 340,
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
    // Dimensions définies dynamiquement via la prop size
  },
});