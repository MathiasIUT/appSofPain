import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import BrandHeader from '../components/BrandHeader';

const REDIRECT_RESET = 'https://commande.sofpain.com/reset-password';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export default function ForgotPasswordScreen({ navigation, route }) {
  const mode = route?.params?.mode || 'reset';
  const isFirstLogin = mode === 'first_login';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError("L'email est requis."); return; }
    setError('');
    setLoading(true);
    try {
      const { data: exists, error: rpcError } = await supabase.rpc('check_client_email', { p_email: trimmed });
      if (rpcError) throw rpcError;
      if (!exists) {
        setError("Cet email n'est pas associé à un compte Sof Pain.");
        return;
      }

      if (isFirstLogin) {
        // Appelle l'Edge Function pour envoyer l'email de bienvenue personnalisé
        const { error: fnError } = await supabase.functions.invoke('send-welcome-email', {
          body: { email: trimmed },
        });
        if (fnError) throw fnError;
      } else {
        // Mot de passe oublié → email Supabase standard vers /reset-password
        const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: REDIRECT_RESET,
        });
        if (err) throw err;
      }

      setSent(true);
    } catch (err) {
      setError("Impossible d'envoyer l'email. Vérifiez l'adresse saisie.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const title = isFirstLogin ? 'Première connexion' : 'Mot de passe oublié';
  const subtitleSent = isFirstLogin
    ? 'Email envoyé ! Consultez votre boîte mail et cliquez sur le lien pour créer votre mot de passe.'
    : 'Email envoyé ! Consultez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.';
  const subtitleDefault = isFirstLogin
    ? 'Saisissez votre email pour recevoir votre lien de première connexion.'
    : 'Saisissez votre email pour recevoir un lien de réinitialisation de mot de passe.';
  const btnLabel = isFirstLogin ? 'Recevoir mon lien de connexion' : 'Envoyer le lien';


  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <BrandHeader />

            <View style={s.titleBlock}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.subtitle}>
                {sent ? subtitleSent : subtitleDefault}
              </Text>
            </View>

            {!sent && (
              <View style={s.form}>
                <View style={s.inputGroup}>
                  <Text style={s.label}>Email</Text>
                  <TextInput
                    style={[s.input, error && s.inputError]}
                    value={email}
                    onChangeText={v => { setEmail(v); setError(''); }}
                    placeholder="votre@email.fr"
                    placeholderTextColor={colors.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  {error ? <Text style={s.errorText}>{error}</Text> : null}
                </View>

                <TouchableOpacity
                  style={[s.btn, loading && s.btnDisabled]}
                  onPress={handleSend}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading
                    ? <ActivityIndicator color={colors.textOnPrimary} />
                    : <Text style={s.btnText}>{btnLabel}</Text>}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backLink} activeOpacity={0.7}>
              <Text style={s.backText}>← Retour à la connexion</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 440 },
  titleBlock: { alignItems: 'center', marginBottom: spacing.xl },
  title: { fontSize: fontSizes.xxl, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSizes.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  form: { width: '100%' },
  inputGroup: { marginBottom: spacing.lg },
  label: { fontSize: fontSizes.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 13,
    fontSize: fontSizes.md, color: colors.textPrimary,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: fontSizes.xs, marginTop: spacing.xs },
  btn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: spacing.md, ...shadows.sm,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.textOnPrimary, fontSize: fontSizes.lg, fontWeight: '700' },
  backLink: { marginTop: spacing.xl, alignItems: 'center', ...Platform.select({ web: { cursor: 'pointer' } }) },
  backText: { color: colors.primary, fontSize: fontSizes.sm, fontWeight: '500' },
});
