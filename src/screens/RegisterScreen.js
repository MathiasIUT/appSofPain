import React, { useState } from 'react';
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

export default function RegisterScreen({ navigation }) {
  // État du formulaire
  const [form, setForm] = useState({
    nom: '',
    prenom: '',
    nomSociete: '',
    email: '',
    telephone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Responsive
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  // Mise à jour d'un champ + effacement de son erreur
  const updateField = (field, value) => {
    setForm({ ...form, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: null });
  };

  // Validation du formulaire
  const validate = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.nom.trim()) newErrors.nom = 'Le nom est requis';
    if (!form.prenom.trim()) newErrors.prenom = 'Le prénom est requis';
    if (!form.nomSociete.trim()) newErrors.nomSociete = 'Le nom de société est requis';


    if (!form.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!emailRegex.test(form.email.trim())) {
      newErrors.email = 'Format d\'email invalide';
    }

     if (!form.telephone.trim()) {
      newErrors.telephone = 'Le numéro de téléphone est requis';
    } else if (form.telephone.trim().length < 10) {
      newErrors.telephone = 'Format de téléphone invalide';
    }

    if (!form.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (form.password.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Veuillez confirmer le mot de passe';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Gestion de l'inscription
  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();

      // Inscription auprès de Supabase.
      // Les données nom/prenom/nomSociete sont passées dans options.data
      // et seront récupérées par le trigger SQL `handle_new_user` qui
      // créera automatiquement le profil dans la table `profiles`.
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            nom: form.nom.trim(),
            prenom: form.prenom.trim(),
            nom_societe: form.nomSociete.trim(),
            telephone: form.telephone.trim(),
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          showAlert('Erreur', 'Cet email est déjà associé à un compte.');
        } else {
          showAlert('Erreur', error.message);
        }
        return;
      }

      // Inscription réussie -> redirection vers l'écran de confirmation
      navigation.replace('ConfirmEmail', { email });
    } catch (err) {
      showAlert('Erreur', 'Une erreur inattendue est survenue.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Composant réutilisable pour un champ de formulaire
  const renderField = (field, label, placeholder, options = {}) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, errors[field] && styles.inputError]}
        placeholder={placeholder}
        placeholderTextColor={colors.textLight}
        value={form[field]}
        onChangeText={(text) => updateField(field, text)}
        editable={!loading}
        {...options}
      />
      {errors[field] && <Text style={styles.errorText}>{errors[field]}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, isDesktop && styles.cardDesktop]}>
            <BrandHeader compact />

            <View style={styles.titleBlock}>
              <Text style={styles.title}>Créer un compte</Text>
              <Text style={styles.subtitle}>
                Rejoignez les professionnels qui nous font confiance
              </Text>
            </View>

            <View style={styles.form}>
              {/* Nom + Prénom côte à côte sur desktop, empilés sur mobile */}
              <View style={isDesktop ? styles.row : null}>
                <View style={isDesktop ? styles.halfField : null}>
                  {renderField('nom', 'Nom', 'Dupont', { autoCapitalize: 'words' })}
                </View>
                <View style={isDesktop ? styles.halfField : null}>
                  {renderField('prenom', 'Prénom', 'Jean', { autoCapitalize: 'words' })}
                </View>
              </View>

              {renderField('nomSociete', 'Nom de société', 'Boulangerie Dupont SARL', {
                autoCapitalize: 'words',
              })}

              {renderField('email', 'Email', 'exemple@societe.fr', {
                keyboardType: 'email-address',
                autoCapitalize: 'none',
                autoCorrect: false,
              })}

              {renderField('telephone', 'Téléphone', '06 12 34 56 78', {
                keyboardType: 'phone-pad',
              })}

              {renderField('password', 'Mot de passe', 'Au moins 8 caractères', {
                secureTextEntry: true,
                autoCapitalize: 'none',
              })}

              {renderField('confirmPassword', 'Confirmer le mot de passe', '••••••••', {
                secureTextEntry: true,
                autoCapitalize: 'none',
              })}

              {/* Bouton d'inscription */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={styles.buttonText}>Créer mon compte</Text>
                )}
              </TouchableOpacity>

              {/* Lien vers la connexion */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Déjà un compte ? </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  disabled={loading}
                >
                  <Text style={styles.footerLink}>Se connecter</Text>
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
    maxWidth: 480,
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
  titleBlock: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
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
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  footerLink: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
});