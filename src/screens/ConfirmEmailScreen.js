import React, { useState } from 'react';
import { View, Platform, Alert, useWindowDimensions, StyleSheet } from 'react-native';
import { Button, Text, Surface, Card } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, borderRadius } from '../config/theme';
import BrandHeader from '../components/BrandHeader';
import ScreenLayout from '../components/ScreenLayout';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function ConfirmEmailScreen({ navigation, route }) {
  const { email } = route.params || {};
  const [resending, setResending] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const handleResend = async () => {
    if (!email) { showAlert('Erreur', 'Email introuvable.'); return; }
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email });
      if (error) showAlert('Erreur', error.message);
      else showAlert('Email renvoyé', 'Un nouveau lien de confirmation vient de vous être envoyé.');
    } catch (err) {
      showAlert('Erreur', 'Une erreur inattendue est survenue.');
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenLayout scroll contentStyle={styles.scrollContent}>
      <Surface style={[styles.card, isDesktop && styles.cardDesktop]} elevation={isDesktop ? 2 : 0}>
        <BrandHeader compact />

        <Text style={styles.icon}>📧</Text>

        <Text variant="headlineMedium" style={styles.title}>Vérifiez votre boîte mail</Text>

        <Text variant="bodyMedium" style={styles.body}>Nous avons envoyé un lien de confirmation à :</Text>
        {email ? <Text variant="bodyMedium" style={styles.email}>{email}</Text> : null}
        <Text variant="bodyMedium" style={[styles.body, styles.mt]}>
          Cliquez sur le lien dans l'email pour activer votre compte, puis revenez ici pour vous connecter.
        </Text>

        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ fontWeight: '700', color: colors.textPrimary }}>📬 Vous n'avez rien reçu ?</Text>
            <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 8 }}>
              {'• Vérifiez vos courriers indésirables (spam)\n• Patientez quelques minutes\n• Cliquez sur "Renvoyer l\'email" ci-dessous'}
            </Text>
          </Card.Content>
        </Card>

        <Button mode="outlined" onPress={handleResend} loading={resending} disabled={resending}
          style={styles.btn} contentStyle={styles.btnContent}>
          Renvoyer l'email
        </Button>

        <Button mode="contained" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
          style={[styles.btn, styles.mt]} contentStyle={styles.btnContent}>
          Retour à la connexion
        </Button>
      </Surface>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 480, padding: spacing.md, backgroundColor: colors.surface, alignItems: 'center' },
  cardDesktop: { padding: spacing.xxl, borderRadius: borderRadius.xl },
  icon: { fontSize: 48, textAlign: 'center', marginVertical: spacing.lg },
  title: { textAlign: 'center', color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.md },
  body: { textAlign: 'center', color: colors.textSecondary },
  email: { textAlign: 'center', color: colors.primary, fontWeight: '600', marginTop: 4 },
  mt: { marginTop: spacing.sm },
  infoCard: { width: '100%', marginVertical: spacing.lg, backgroundColor: colors.secondary },
  btn: { width: '100%', borderRadius: borderRadius.md },
  btnContent: { paddingVertical: 6 },
});
