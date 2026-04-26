import React, { useState } from 'react';
import { View, KeyboardAvoidingView, Platform, Alert, useWindowDimensions, StyleSheet } from 'react-native';
import { Button, TextInput, Text, HelperText, Surface } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, borderRadius } from '../config/theme';
import BrandHeader from '../components/BrandHeader';
import ScreenLayout from '../components/ScreenLayout';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({ nom: '', prenom: '', nomSociete: '', email: '', telephone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: null });
  };

  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.nom.trim()) newErrors.nom = 'Le nom est requis';
    if (!form.prenom.trim()) newErrors.prenom = 'Le prénom est requis';
    if (!form.nomSociete.trim()) newErrors.nomSociete = 'Le nom de société est requis';
    if (!form.email.trim()) newErrors.email = "L'email est requis";
    else if (!emailRegex.test(form.email.trim())) newErrors.email = "Format d'email invalide";
    if (!form.telephone.trim()) newErrors.telephone = 'Le numéro de téléphone est requis';
    else if (form.telephone.trim().length < 10) newErrors.telephone = 'Format de téléphone invalide';
    if (!form.password) newErrors.password = 'Le mot de passe est requis';
    else if (form.password.length < 8) newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    if (!form.confirmPassword) newErrors.confirmPassword = 'Veuillez confirmer le mot de passe';
    else if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: { data: { nom: form.nom.trim(), prenom: form.prenom.trim(), nom_societe: form.nomSociete.trim(), telephone: form.telephone.trim() } },
      });
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          showAlert('Erreur', 'Cet email est déjà associé à un compte.');
        } else { showAlert('Erreur', error.message); }
        return;
      }
      navigation.replace('ConfirmEmail', { email });
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
          <BrandHeader compact />

          <Text variant="headlineMedium" style={styles.title}>Créer un compte</Text>
          <Text variant="bodyLarge" style={styles.subtitle}>Rejoignez les professionnels qui nous font confiance</Text>

          <View style={isDesktop ? styles.row : null}>
            <View style={isDesktop ? styles.half : null}>
              <TextInput mode="flat" label="Nom" value={form.nom} onChangeText={(v) => updateField('nom', v)}
                placeholder="Dupont" autoCapitalize="words" error={!!errors.nom} disabled={loading} style={styles.input} />
              <HelperText type="error" visible={!!errors.nom}>{errors.nom}</HelperText>
            </View>
            <View style={isDesktop ? styles.half : null}>
              <TextInput mode="flat" label="Prénom" value={form.prenom} onChangeText={(v) => updateField('prenom', v)}
                placeholder="Jean" autoCapitalize="words" error={!!errors.prenom} disabled={loading} style={styles.input} />
              <HelperText type="error" visible={!!errors.prenom}>{errors.prenom}</HelperText>
            </View>
          </View>

          <TextInput mode="flat" label="Nom de société" value={form.nomSociete} onChangeText={(v) => updateField('nomSociete', v)}
            placeholder="Boulangerie Dupont SARL" autoCapitalize="words" error={!!errors.nomSociete} disabled={loading} style={styles.input} />
          <HelperText type="error" visible={!!errors.nomSociete}>{errors.nomSociete}</HelperText>

          <TextInput mode="flat" label="Email" value={form.email} onChangeText={(v) => updateField('email', v)}
            placeholder="exemple@societe.fr" keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            error={!!errors.email} disabled={loading} style={styles.input} />
          <HelperText type="error" visible={!!errors.email}>{errors.email}</HelperText>

          <TextInput mode="flat" label="Téléphone" value={form.telephone} onChangeText={(v) => updateField('telephone', v)}
            placeholder="06 12 34 56 78" keyboardType="phone-pad" error={!!errors.telephone} disabled={loading} style={styles.input} />
          <HelperText type="error" visible={!!errors.telephone}>{errors.telephone}</HelperText>

          <TextInput mode="flat" label="Mot de passe" value={form.password} onChangeText={(v) => updateField('password', v)}
            placeholder="Au moins 8 caractères" secureTextEntry autoCapitalize="none"
            error={!!errors.password} disabled={loading} style={styles.input} />
          <HelperText type="error" visible={!!errors.password}>{errors.password}</HelperText>

          <TextInput mode="flat" label="Confirmer le mot de passe" value={form.confirmPassword}
            onChangeText={(v) => updateField('confirmPassword', v)} secureTextEntry autoCapitalize="none"
            error={!!errors.confirmPassword} disabled={loading} style={styles.input} />
          <HelperText type="error" visible={!!errors.confirmPassword}>{errors.confirmPassword}</HelperText>

          <Button mode="contained" onPress={handleRegister} loading={loading} disabled={loading}
            style={styles.submitBtn} contentStyle={styles.submitContent}>
            Créer mon compte
          </Button>

          <View style={styles.footer}>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>Déjà un compte ? </Text>
            <Text variant="bodyMedium"
              style={[styles.link, Platform.select({ web: { cursor: 'pointer' } })]}
              onPress={() => !loading && navigation.navigate('Login')}>
              Se connecter
            </Text>
          </View>
        </Surface>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xl },
  flex: { width: '100%', maxWidth: 480 },
  card: { width: '100%', padding: spacing.md, backgroundColor: colors.surface },
  cardDesktop: { padding: spacing.xxl, borderRadius: borderRadius.xl },
  title: { textAlign: 'center', color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { textAlign: 'center', color: colors.textSecondary, marginBottom: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  input: { backgroundColor: colors.surface },
  submitBtn: { marginTop: spacing.md, borderRadius: borderRadius.md },
  submitContent: { paddingVertical: 8 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl, flexWrap: 'wrap' },
  link: { color: colors.primary, fontWeight: '600' },
});
