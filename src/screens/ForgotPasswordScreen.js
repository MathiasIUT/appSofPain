import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import BrandHeader from '../components/BrandHeader';


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

      // Récupérer le profil pour personnaliser l'email
      const { data: profile } = await supabase
        .from('profiles')
        .select('nom, prenom, nom_societe')
        .eq('email', trimmed)
        .single();

      if (isFirstLogin) {
        const { error: fnError } = await supabase.functions.invoke('send-welcome-email', {
          body: {
            email: trimmed,
            nom: profile?.nom || '',
            prenom: profile?.prenom || '',
            nom_societe: profile?.nom_societe || '',
          },
        });
        if (fnError) throw fnError;
      } else {
        const { error: fnError } = await supabase.functions.invoke('send-reset-password-email', {
          body: { email: trimmed },
        });
        if (fnError) throw fnError;
      }

      setSent(true);
    } catch (err) {
      let errorMessage = "Impossible d'envoyer l'email. Vérifiez l'adresse saisie.";
      if (err instanceof Error) {
        if (err.message.includes('FunctionsHttpError') || err.name === 'FunctionsHttpError') {
          try {
            const context = await err.context?.json();
            if (context?.error) {
              errorMessage = `Erreur Serveur: ${context.error}`;
              if (context.details) {
                errorMessage += `\nDétails: ${JSON.stringify(context.details)}`;
              }
            }
          } catch (e) {
            errorMessage = err.message;
          }
        } else {
           errorMessage = err.message;
        }
      }
      setError(errorMessage);
      console.error('Erreur ForgotPassword:', err);
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
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
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
                    returnKeyType="go"
                    onSubmitEditing={handleSend}
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
