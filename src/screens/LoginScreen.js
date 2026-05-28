import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, shadows, spacing, fontSizes, borderRadius } from '../config/theme';
import BrandHeader from '../components/BrandHeader';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const passwordRef = useRef(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, actif')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.actif === false) {
           await supabase.auth.signOut();
           return;
        }

        if (profile?.role === 'admin') {
          navigation.reset({ index: 0, routes: [{ name: 'AdminDashboard' }] });
        } else if (profile?.role) {
          navigation.reset({ index: 0, routes: [{ name: 'ClientHome' }] });
        }
      }
    };
    checkSession();
  }, [navigation]);

  const validate = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = 'L\'identifiant est requis';
    }

    if (!password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }

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
          showAlert(
            'Compte non confirmé',
            'Vous devez d\'abord confirmer votre email. Vérifiez votre boîte mail.'
          );
        } else if (authError.message.includes('Invalid login credentials')) {
          showAlert('Erreur', 'Email ou mot de passe incorrect.');
        } else {
          showAlert('Erreur', authError.message);
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, actif, nom, prenom, nom_societe')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profile) {
        // Le profil n'existe plus = compte supprimé.
        // On déconnecte la session auth immédiatement.
        await supabase.auth.signOut();
        showAlert(
          'Compte supprimé',
          'Ce compte a été supprimé. Si vous pensez qu\'il s\'agit d\'une erreur, contactez l\'administrateur.'
        );
        return;
      }

      if (profile.actif === false) {
        await supabase.auth.signOut();
        showAlert(
          'Compte désactivé',
          "Votre compte a été désactivé. Contactez l'administrateur."
        );
        return;
      }

      if (profile.role === 'admin') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'AdminDashboard' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ClientHome' }],
        });
      }
    } catch (err) {
      showAlert('Erreur', 'Une erreur inattendue est survenue.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={[styles.card, isDesktop && styles.cardDesktop]}>
            <BrandHeader />

            <View style={styles.titleBlock}>
              <Text style={styles.title}>Connexion</Text>
              <Text style={styles.subtitle}>
                Connectez-vous avec vos identifiants fournis
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Identifiant</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Votre identifiant de connexion"
                  placeholderTextColor={colors.textLight}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) setErrors({ ...errors, email: null });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe</Text>
                <TextInput
                  ref={passwordRef}
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textLight}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Se connecter</Text>
                )}
              </TouchableOpacity>

              <View style={styles.linksRow}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword', { mode: 'reset' })}
                  style={styles.linkBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkText}>Mot de passe oublié</Text>
                </TouchableOpacity>
                <Text style={styles.linkSeparator}>·</Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword', { mode: 'first_login' })}
                  style={styles.linkBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkTextSecondary}>Première connexion ?</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
  },
  cardDesktop: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    ...shadows.lg,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.sm,
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
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  linksRow: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  linkBtn: {
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  linkText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  linkTextSecondary: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  linkSeparator: {
    color: colors.textLight,
    fontSize: fontSizes.sm,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
  },
});