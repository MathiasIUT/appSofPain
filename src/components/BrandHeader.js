import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { spacing } from '../config/theme';

export default function BrandHeader({ size = 'md' }) {
  const logoSize = { sm: 200, md: 260, lg: 320 }[size];

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
    marginBottom: spacing.xl,
  },
});
