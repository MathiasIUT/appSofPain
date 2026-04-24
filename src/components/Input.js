import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

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
  const [focused, setFocused] = useState(false);

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
          focused && styles.inputFocused,
          error && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  required: {
    color: colors.error,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    minHeight: 54,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    borderWidth: 2,
    backgroundColor: '#FFFDF9',
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
    backgroundColor: colors.errorLight,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  helperText: {
    color: colors.textLight,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
});
