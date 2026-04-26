import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert, useWindowDimensions, StyleSheet } from 'react-native';
import { Button, TextInput, Text, HelperText, Surface } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, borderRadius, shadows } from '../config/theme';
import BrandHeader from '../components/BrandHeader';
import ScreenLayout from '../components/ScreenLayout';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) newErrors.email = "L'email est requis";
    else if (!emailRegex.test(email.trim())) newErrors.email = "Format d'email invalide";
    if (!password) newErrors.password = 'Le mot de passe est requis';
    else if (password.length < 6) newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        if (authError.message.includes('Email not confirmed')) {
          showAlert('Compte non confirmé', "Vous devez d'abord confirmer votre email.");
        } else if (authError.message.includes('Invalid login credentials')) {
          showAlert('Erreur', 'Email ou mot de passe incorrect.');
        } else {
          showAlert('Erreur', authError.message);
        }
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, actif')
        .eq('id', authData.user.id)
        .single();
      if (profileError) { showAlert('Erreur', 'Impossible de récupérer votre profil.'); return; }
      if (profile.actif === false) {
        await supabase.auth.signOut();
        showAlert('Compte désactivé', "Votre compte a été désactivé.");
        return;
      }
      if (profile.role === 'admin') navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
      else navigation.reset({ index: 0, routes: [{ name: 'ClientHome' }] });
    } catch (err) {
      showAlert('Erreur', 'Une erreur inattendue est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout scroll contentStyle={styles.scrollContent}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <Surface style={[styles.card, isDesktop && styles.cardDesktop]} elevation={isDesktop ? 2 : 0}>
          <BrandHeader />

          <Text variant="headlineMedium" style={styles.title}>Connexion</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>Accédez à votre espace de commande</Text>

          <TextInput
            mode="flat"
            label="Email"
            value={email}
            onChangeText={(t) => { setEmail(t); if (errors.email) setErrors({ ...errors, email: null }); }}
            placeholder="exemple@societe.fr"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={!!errors.email}
            disabled={loading}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.email}>{errors.email}</HelperText>

          <TextInput
            mode="flat"
            label="Mot de passe"
            value={password}
            onChangeText={(t) => { setPassword(t); if (errors.password) setErrors({ ...errors, password: null }); }}
            secureTextEntry
            autoCapitalize="none"
            error={!!errors.password}
            disabled={loading}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.password}>{errors.password}</HelperText>

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.submitBtn}
            contentStyle={styles.submitContent}
          >
            Se connecter
          </Button>

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>Pas encore de compte ? </Text>
            <Text
              variant="bodyMedium"
              style={[styles.link, Platform.select({ web: { cursor: 'pointer' } })]}
              onPress={() => !loading && navigation.navigate('Register')}
            >
              Créer un compte
            </Text>
          </View>
        </Surface>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  flex: { width: '100%', maxWidth: 440 },
  card: { width: '100%', padding: spacing.md, backgroundColor: colors.surface },
  cardDesktop: { padding: spacing.xxl, borderRadius: borderRadius.xl },
  title: { textAlign: 'center', color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { textAlign: 'center', color: colors.textSecondary, marginBottom: spacing.xl },
  input: { backgroundColor: colors.surface },
  submitBtn: { marginTop: spacing.md, borderRadius: borderRadius.md },
  submitContent: { paddingVertical: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl, flexWrap: 'wrap' },
  link: { color: colors.primary, fontWeight: '600' },
});
