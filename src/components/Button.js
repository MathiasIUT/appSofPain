import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary}
          size="small"
        />
      ) : (
        <>
          {icon && <Text style={[styles.text, styles[`textSize_${size}`], styles[`textVariant_${variant}`], styles.icon]}>{icon}</Text>}
          <Text style={[styles.text, styles[`textSize_${size}`], styles[`textVariant_${variant}`]]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    minHeight: 48,
    ...Platform.select({ web: { cursor: 'pointer', userSelect: 'none' } }),
  },
  fullWidth: { width: '100%' },
  disabled:  { opacity: 0.45 },
  icon:      { marginRight: spacing.sm },

  // Tailles
  size_sm: { paddingVertical: spacing.sm,      paddingHorizontal: spacing.md,  minHeight: 38 },
  size_md: { paddingVertical: 13,              paddingHorizontal: spacing.lg              },
  size_lg: { paddingVertical: 15,              paddingHorizontal: spacing.xl              },

  // Variantes
  variant_primary: {
    backgroundColor: colors.primary,
    ...shadows.sm,
  },
  variant_secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  variant_danger: {
    backgroundColor: colors.error,
    ...shadows.sm,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },

  // Texte
  text: { fontWeight: '600', textAlign: 'center' },
  textSize_sm: { fontSize: fontSizes.sm },
  textSize_md: { fontSize: fontSizes.md },
  textSize_lg: { fontSize: fontSizes.lg },

  textVariant_primary:   { color: colors.textOnPrimary },
  textVariant_secondary: { color: colors.primary },
  textVariant_danger:    { color: colors.white },
  textVariant_ghost:     { color: colors.primary },
});
