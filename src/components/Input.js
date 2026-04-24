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
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    minHeight: 50,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  inputFocused: {
    borderColor: colors.borderFocus,
    borderWidth: 2,
  },
  inputMultiline: {
    minHeight: 110,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.error,
    borderWidth: 2,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  helperText: {
    color: colors.textLight,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
});
