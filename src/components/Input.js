import React from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

/**
 * Champ de saisie standardisé.
 *
 * Props :
 *   - label (string) : libellé au-dessus du champ
 *   - value (string) : valeur actuelle
 *   - onChangeText (function) : callback de changement
 *   - error (string) : message d'erreur (affiché en rouge sous le champ)
 *   - placeholder (string) : placeholder
 *   - helperText (string) : texte d'aide (affiché en gris sous le champ)
 *   - required (boolean) : affiche un astérisque rouge après le label
 *   - ...props : toutes les autres props de TextInput (keyboardType, etc.)
 */
export default function Input({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  helperText,
  required = false,
  multiline = false,
  ...textInputProps
}) {
  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}

      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          error && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...textInputProps}
      />

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  helperText: {
    color: colors.textLight,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
});