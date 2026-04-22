import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes } from '../config/theme';
import Button from '../components/Button';
import BrandHeader from '../components/BrandHeader';

/**
 * Placeholder pour l'écran d'accueil client.
 * Sera remplacé par le vrai catalogue dans une prochaine livraison.
 */
export default function ClientHome({ navigation }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <BrandHeader />

        <Text style={styles.title}>Espace Client</Text>
        <Text style={styles.subtitle}>
          Le catalogue et la prise de commande seront bientôt disponibles.
        </Text>

        <View style={styles.buttonContainer}>
          <Button title="Se déconnecter" variant="secondary" onPress={handleLogout} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    maxWidth: 400,
  },
  buttonContainer: {
    marginTop: spacing.lg,
  },
});