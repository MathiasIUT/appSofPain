import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { spacing } from '../config/theme';

export default function BrandHeader({ size = 'md' }) {
  const logoSize = { sm: 120, md: 160, lg: 220 }[size];

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo1.png')}
        style={{ width: logoSize, height: logoSize }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: -20,
  },
});
