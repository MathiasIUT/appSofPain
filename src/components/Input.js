import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import { colors, spacing } from '../config/theme';

export default function Input({
  label,
  value,
  onChangeText,
  error,
  helperText,
  required = false,
  multiline = false,
  ...textInputProps
}) {
  return (
    <View style={styles.container}>
      <TextInput
        mode="flat"
        label={required ? `${label} *` : label}
        value={value}
        onChangeText={onChangeText}
        error={!!error}
        multiline={multiline}
        style={styles.input}
        contentStyle={multiline ? styles.multilineContent : undefined}
        {...textInputProps}
      />
      {error ? (
        <HelperText type="error" visible>{error}</HelperText>
      ) : helperText ? (
        <HelperText type="info" visible>{helperText}</HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface },
  multilineContent: { minHeight: 100, paddingTop: 8 },
});
