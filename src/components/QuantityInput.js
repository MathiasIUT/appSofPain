import React from 'react';
import { View, TextInput, Text, StyleSheet, Platform } from 'react-native';
import { Button } from 'react-native-paper';
import { colors, spacing, borderRadius } from '../config/theme';

export default function QuantityInput({ value, onChange, min = 0, max = 999, unit }) {
  const handleChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    if (cleaned === '' || isNaN(num)) onChange(Math.max(min, 1));
    else onChange(Math.min(Math.max(num, min), max));
  };

  if (value === 0) {
    return (
      <Button
        mode="contained"
        onPress={() => onChange(Math.max(1, min))}
        style={styles.addBtn}
        contentStyle={styles.addBtnContent}
      >
        Ajouter
      </Button>
    );
  }

  const atMin = value <= min;

  return (
    <View style={styles.row}>
      <Button
        mode="contained"
        compact
        onPress={() => { if (!atMin) onChange(value - 1); }}
        disabled={atMin}
        style={styles.stepBtn}
        contentStyle={styles.stepBtnContent}
        labelStyle={styles.stepBtnLabel}
      >
        −
      </Button>

      <View style={styles.center}>
        <TextInput
          style={styles.input}
          value={String(value)}
          onChangeText={handleChange}
          keyboardType="numeric"
          maxLength={3}
        />
        {unit ? (
          <Text style={styles.unit}>{value > 1 ? unit + 's' : unit}</Text>
        ) : null}
      </View>

      <Button
        mode="contained"
        compact
        onPress={() => { if (value < max) onChange(value + 1); }}
        style={styles.stepBtn}
        contentStyle={styles.stepBtnContent}
        labelStyle={styles.stepBtnLabel}
      >
        +
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  addBtn: { borderRadius: borderRadius.md },
  addBtnContent: { paddingVertical: 4 },
  stepBtn: { borderRadius: borderRadius.md, minWidth: 44 },
  stepBtnContent: { paddingHorizontal: 0, minWidth: 44, height: 44 },
  stepBtnLabel: { fontSize: 22, lineHeight: 24 },
  center: { flex: 1, alignItems: 'center' },
  input: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    width: '100%',
    height: 44,
    ...Platform.select({ web: { outlineStyle: 'none', cursor: 'text' } }),
  },
  unit: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
