import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';
import BrandHeader from '../components/BrandHeader';

// Alert cross-platform
const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function ConfirmEmailScreen({ navigation, route }) {
  const { email } = route.params || {};
  const [resending, setResending] = useState(false);

  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Renvoyer l'email de confirmation
  const handleResend = async () => {
    if (!email) {
      showAlert('Erreur', 'Email introuvable.');
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        showAlert('Erreur', error.message);
      } else {
        showAlert(
          'Email renvoyé',
          'Un nouveau lien de confirmation vient de vous être envoyé.'
        );
      }
    } catch (err) {
      showAlert('Erreur', 'Une erreur inattendue est survenue.');
      console.error(err);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, isDesktop && styles.cardDesktop]}>
          <BrandHeader compact />

          {/* Grand icône email */}
          <Text style={styles.icon}>📧</Text>

          <Text style={styles.title}>Vérifiez votre boîte mail</Text>

          <Text style={styles.message}>
            Nous avons envoyé un lien de confirmation à :
          </Text>

          {email && <Text style={styles.email}>{email}</Text>}

          <Text style={styles.instructions}>
            Cliquez sur le lien dans l'email pour activer votre compte, puis revenez ici pour vous connecter.
          </Text>

          {/* Encart informatif */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>📬 Vous n'avez rien reçu ?</Text>
            <Text style={styles.infoText}>
              • Vérifiez vos courriers indésirables (spam){'\n'}
              • Patientez quelques minutes, l'email peut prendre un peu de temps{'\n'}
              • Cliquez sur "Renvoyer l'email" ci-dessous
            </Text>
          </View>

          {/* Bouton renvoyer */}
          <TouchableOpacity
            style={[styles.buttonSecondary, resending && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={resending}
            activeOpacity={0.8}
          >
            {resending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.buttonSecondaryText}>Renvoyer l'email</Text>
            )}
          </TouchableOpacity>

          {/* Bouton retour connexion */}
          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              })
            }
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Retour à la connexion</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  cardDesktop: {
    backgroundColor: colors.surface,
    padding: spacing.xxl,
    borderRadius: borderRadius.xl,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  icon: {
    fontSize: 72,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: fontSizes.md,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  instructions: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  infoBox: {
    backgroundColor: colors.secondary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    width: '100%',
  },
  infoTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    width: '100%',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: colors.primary,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});