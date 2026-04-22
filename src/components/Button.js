import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

/**
 * Bouton standardisé de l'app.
 *
 * Props :
 *   - title (string) : texte du bouton
 *   - onPress (function) : callback au clic
 *   - variant ('primary' | 'secondary' | 'danger' | 'ghost') : style
 *   - size ('sm' | 'md' | 'lg') : taille
 *   - loading (boolean) : affiche un spinner à la place du texte
 *   - disabled (boolean) : désactive le bouton
 *   - icon (string) : emoji/texte placé avant le titre (ex: '➕')
 *   - fullWidth (boolean) : prend toute la largeur disponible
 *   - style (object) : style additionnel pour override
 */
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

  const buttonStyles = [
    styles.base,
    styles[`size_${size}`],
    styles[`variant_${variant}`],
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`textSize_${size}`],
    styles[`textVariant_${variant}`],
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary}
          size="small"
        />
      ) : (
        <>
          {icon && <Text style={[textStyles, styles.icon]}>{icon}</Text>}
          <Text style={textStyles}>{title}</Text>
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
    ...Platform.select({
      web: {
        cursor: 'pointer',
        userSelect: 'none',
      },
    }),
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: spacing.sm,
  },

  // Tailles
  size_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  size_md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  size_lg: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
  },

  // Variantes
  variant_primary: {
    backgroundColor: colors.primary,
  },
  variant_secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  variant_danger: {
    backgroundColor: colors.error,
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },

  // Texte
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  textSize_sm: {
    fontSize: fontSizes.sm,
  },
  textSize_md: {
    fontSize: fontSizes.md,
  },
  textSize_lg: {
    fontSize: fontSizes.lg,
  },
  textVariant_primary: {
    color: colors.textOnPrimary,
  },
  textVariant_secondary: {
    color: colors.primary,
  },
  textVariant_danger: {
    color: colors.white,
  },
  textVariant_ghost: {
    color: colors.primary,
  },
});