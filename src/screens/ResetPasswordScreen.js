import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';
import BrandHeader from '../components/BrandHeader';

export default function ResetPasswordScreen({ navigation }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  const validate = () => {
    const e = {};
    if (password.length < 8) e.password = 'Minimum 8 caractères.';
    if (password !== confirm) e.confirm = 'Les mots de passe ne correspondent pas.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err) {
      setErrors({ password: err.message || 'Impossible de mettre à jour le mot de passe.' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={s.container}>
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.card}>
            <BrandHeader />
            <View style={s.titleBlock}>
              <Text style={s.title}>Mot de passe créé</Text>
              <Text style={s.subtitle}>Votre mot de passe a été enregistré avec succès. Vous pouvez maintenant vous connecter.</Text>
            </View>
            <TouchableOpacity
              style={s.btn}
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
              activeOpacity={0.8}
            >
              <Text style={s.btnText}>Aller à la connexion</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <BrandHeader />

            <View style={s.titleBlock}>
              <Text style={s.title}>Créer mon mot de passe</Text>
              <Text style={s.subtitle}>Choisissez un mot de passe sécurisé pour votre compte.</Text>
            </View>

            <View style={s.form}>
              <View style={s.inputGroup}>
                <Text style={s.label}>Nouveau mot de passe</Text>
                <TextInput
                  style={[s.input, errors.password && s.inputError]}
                  value={password}
                  onChangeText={v => { setPassword(v); setErrors(p => ({ ...p, password: null })); }}
                  placeholder="Minimum 8 caractères"
                  placeholderTextColor={colors.textLight}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
                {errors.password ? <Text style={s.errorText}>{errors.password}</Text> : null}
              </View>

              <View style={s.inputGroup}>
                <Text style={s.label}>Confirmer le mot de passe</Text>
                <TextInput
                  style={[s.input, errors.confirm && s.inputError]}
                  value={confirm}
                  onChangeText={v => { setConfirm(v); setErrors(p => ({ ...p, confirm: null })); }}
                  placeholder="Répétez votre mot de passe"
                  placeholderTextColor={colors.textLight}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
                {errors.confirm ? <Text style={s.errorText}>{errors.confirm}</Text> : null}
              </View>

              <TouchableOpacity
                style={[s.btn, loading && s.btnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={colors.textOnPrimary} />
                  : <Text style={s.btnText}>Enregistrer mon mot de passe</Text>}
              </TouchableOpacity>
            </View>
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
});
