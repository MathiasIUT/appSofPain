import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Text as PaperText } from 'react-native-paper';
import { spacing, colors } from '../config/theme';

export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <PaperText variant="headlineSmall" style={styles.title}>{title}</PaperText>
      {subtitle ? (
        <PaperText variant="bodyMedium" style={styles.subtitle}>{subtitle}</PaperText>
      ) : null}
      {action ? (
        <Button
          mode={action.variant === 'secondary' ? 'outlined' : 'contained'}
          onPress={action.onPress}
          style={styles.btn}
        >
          {action.title}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  icon: { fontSize: 48, marginBottom: spacing.lg },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
    color: colors.textSecondary,
  },
  btn: { marginTop: spacing.md },
});
