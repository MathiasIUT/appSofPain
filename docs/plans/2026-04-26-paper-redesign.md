# React Native Paper Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every custom UI component with React Native Paper (MD2) equivalents, preserving 100% of existing features.

**Architecture:** Install react-native-paper, configure a MD2 theme with brand colors, wrap the app root with PaperProvider, update shared components (Input, QuantityInput, EmptyState) to use Paper internally, rewrite all screens to import from paper instead of deleted custom components, then delete the 10 obsolete custom component files.

**Tech Stack:** react-native-paper v5 (MD2 mode), @expo/vector-icons/MaterialCommunityIcons, Expo SDK 54, React Native 0.81

---

## File Map

**New:**
- `src/config/paperTheme.js`

**Modified:**
- `App.js`
- `src/components/Input.js`
- `src/components/QuantityInput.js`
- `src/components/EmptyState.js`
- `src/screens/LoginScreen.js`
- `src/screens/RegisterScreen.js`
- `src/screens/ConfirmEmailScreen.js`
- `src/screens/ClientHome.js`
- `src/screens/CartScreen.js`
- `src/screens/CheckoutScreen.js`
- `src/screens/OrderConfirmationScreen.js`
- `src/screens/MyOrdersScreen.js`
- `src/screens/OrderDetailScreen.js`
- `src/screens/AdminProductsScreen.js`
- `src/screens/AdminOrdersScreen.js`
- `src/screens/AdminClientsScreen.js`
- `src/screens/AdminStatsScreen.js`

**Deleted:**
- `src/components/Button.js`
- `src/components/Card.js`
- `src/components/SearchBar.js`
- `src/components/Badge.js`
- `src/components/StatusTag.js`
- `src/components/Divider.js`
- `src/components/Typography.js`
- `src/components/PageHeader.js`
- `src/components/SectionHeader.js`
- `src/components/DataRow.js`

---

## Shared helpers (copy into each screen that needs them)

```js
// Status chip config — paste at top of any screen using order status
const STATUS_CFG = {
  nouvelle:       { label: 'Nouvelle',       bg: '#E3F2FD', text: '#1055A0' },
  en_preparation: { label: 'En préparation', bg: '#FFF3E0', text: '#D84315' },
  en_livraison:   { label: 'En livraison',   bg: 'rgba(196,146,74,0.12)', text: '#A67A38' },
  livree:         { label: 'Livrée',         bg: '#E8F5E9', text: '#276228' },
  annulee:        { label: 'Annulée',        bg: '#FFEBEE', text: '#B71C1C' },
};
// Usage: <Chip compact style={{ backgroundColor: STATUS_CFG[status].bg }}
//              textStyle={{ color: STATUS_CFG[status].text, fontWeight: '600', fontSize: 12 }}>
//          {STATUS_CFG[status].label}
//        </Chip>
```

---

## Task 1: Install react-native-paper

**Files:** `package.json` (modified by npx expo install)

- [ ] **Step 1: Install the package**

```bash
npx expo install react-native-paper
```

Expected output: package added to dependencies, no errors.

- [ ] **Step 2: Verify install**

```bash
node -e "require('./node_modules/react-native-paper/package.json'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add react-native-paper"
```

---

## Task 2: Create paperTheme.js

**Files:** Create `src/config/paperTheme.js`

- [ ] **Step 1: Create the file**

```js
import { MD2LightTheme } from 'react-native-paper';
import { colors } from './theme';

export const paperTheme = {
  ...MD2LightTheme,
  colors: {
    ...MD2LightTheme.colors,
    primary:      colors.primary,       // #C4924A
    accent:       colors.primaryDark,   // #A67A38
    background:   colors.background,    // #FAF8F4
    surface:      colors.surface,       // #FFFFFF
    text:         colors.textPrimary,   // #1A0A04
    placeholder:  colors.textLight,     // #9A7350
    error:        colors.error,         // #B71C1C
    notification: colors.primary,
    onSurface:    colors.textPrimary,
    disabled:     colors.textLight,
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/config/paperTheme.js
git commit -m "feat: Paper MD2 theme with brand colors"
```

---

## Task 3: Wrap App.js with PaperProvider

**Files:** Modify `App.js`

- [ ] **Step 1: Rewrite App.js**

```js
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AppNavigator from './src/navigation/AppNavigator';
import { CartProvider } from './src/contexts/CartContext';
import { paperTheme } from './src/config/paperTheme';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={paperTheme}
        settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
      >
        <StatusBar style="dark" />
        <CartProvider>
          <AppNavigator />
        </CartProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Start dev server and verify no crash**

```bash
npx expo start --web
```

Expected: app loads, no red error screen.

- [ ] **Step 3: Commit**

```bash
git add App.js
git commit -m "feat: wrap app with PaperProvider (MD2)"
```

---

## Task 4: Update Input.js

**Files:** Modify `src/components/Input.js`

- [ ] **Step 1: Rewrite Input.js**

```js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, HelperText } from 'react-native-paper';
import { colors, spacing } from '../config/theme';

export default function Input({
  label,
  value,
  onChangeText,
  error,
  helperText,
  required = false,
  multiline = false,
  ...textInputProps
}) {
  return (
    <View style={styles.container}>
      <TextInput
        mode="flat"
        label={required ? `${label} *` : label}
        value={value}
        onChangeText={onChangeText}
        error={!!error}
        multiline={multiline}
        style={styles.input}
        contentStyle={multiline ? styles.multilineContent : undefined}
        {...textInputProps}
      />
      {error ? (
        <HelperText type="error" visible>{error}</HelperText>
      ) : helperText ? (
        <HelperText type="info" visible>{helperText}</HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface },
  multilineContent: { minHeight: 100, paddingTop: 8 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Input.js
git commit -m "feat: Input uses Paper TextInput (flat mode)"
```

---

## Task 5: Update QuantityInput.js

**Files:** Modify `src/components/QuantityInput.js`

- [ ] **Step 1: Rewrite QuantityInput.js**

```js
import React from 'react';
import { View, TextInput, Text, StyleSheet, Platform } from 'react-native';
import { Button } from 'react-native-paper';
import { colors, spacing, borderRadius } from '../config/theme';

export default function QuantityInput({ value, onChange, min = 0, max = 999, unit }) {
  const handleChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    const num = parseInt(cleaned, 10);
    if (cleaned === '' || isNaN(num)) onChange(Math.max(min, 1));
    else onChange(Math.min(Math.max(num, min), max));
  };

  if (value === 0) {
    return (
      <Button
        mode="contained"
        onPress={() => onChange(Math.max(1, min))}
        style={styles.addBtn}
        contentStyle={styles.addBtnContent}
      >
        Ajouter
      </Button>
    );
  }

  const atMin = value <= min;

  return (
    <View style={styles.row}>
      <Button
        mode="contained"
        compact
        onPress={() => { if (!atMin) onChange(value - 1); }}
        disabled={atMin}
        style={styles.stepBtn}
        contentStyle={styles.stepBtnContent}
        labelStyle={styles.stepBtnLabel}
      >
        −
      </Button>

      <View style={styles.center}>
        <TextInput
          style={styles.input}
          value={String(value)}
          onChangeText={handleChange}
          keyboardType="numeric"
          maxLength={3}
        />
        {unit ? (
          <Text style={styles.unit}>{value > 1 ? unit + 's' : unit}</Text>
        ) : null}
      </View>

      <Button
        mode="contained"
        compact
        onPress={() => { if (value < max) onChange(value + 1); }}
        style={styles.stepBtn}
        contentStyle={styles.stepBtnContent}
        labelStyle={styles.stepBtnLabel}
      >
        +
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  addBtn: { borderRadius: borderRadius.md },
  addBtnContent: { paddingVertical: 4 },
  stepBtn: { borderRadius: borderRadius.md, minWidth: 44 },
  stepBtnContent: { paddingHorizontal: 0, minWidth: 44, height: 44 },
  stepBtnLabel: { fontSize: 22, lineHeight: 24 },
  center: { flex: 1, alignItems: 'center' },
  input: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    width: '100%',
    height: 44,
    ...Platform.select({ web: { outlineStyle: 'none', cursor: 'text' } }),
  },
  unit: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/QuantityInput.js
git commit -m "feat: QuantityInput uses Paper Button for stepper"
```

---

## Task 6: Update EmptyState.js

**Files:** Modify `src/components/EmptyState.js`

- [ ] **Step 1: Rewrite EmptyState.js**

```js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button, Text as PaperText } from 'react-native-paper';
import { spacing, colors } from '../config/theme';

export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <PaperText variant="headlineSmall" style={styles.title}>{title}</PaperText>
      {subtitle ? (
        <PaperText variant="bodyMedium" style={styles.subtitle}>{subtitle}</PaperText>
      ) : null}
      {action ? (
        <Button
          mode={action.variant === 'secondary' ? 'outlined' : 'contained'}
          onPress={action.onPress}
          style={styles.btn}
        >
          {action.title}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  icon: { fontSize: 48, marginBottom: spacing.lg },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
    color: colors.textSecondary,
  },
  btn: { marginTop: spacing.md },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/EmptyState.js
git commit -m "feat: EmptyState uses Paper Text + Button"
```

---

## Task 7: Rewrite LoginScreen.js

**Files:** Modify `src/screens/LoginScreen.js`

- [ ] **Step 1: Rewrite the file** — keep all logic (validate, handleLogin, showAlert) unchanged, replace only JSX and imports:

```js
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
```

- [ ] **Step 2: Verify** — open `/` in browser, confirm login form renders with Paper inputs and gold button.

- [ ] **Step 3: Commit**

```bash
git add src/screens/LoginScreen.js
git commit -m "feat: LoginScreen uses Paper components"
```

---

## Task 8: Rewrite RegisterScreen.js

**Files:** Modify `src/screens/RegisterScreen.js`

- [ ] **Step 1: Rewrite the file** — keep all logic (form state, validate, handleRegister, showAlert) unchanged:

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/RegisterScreen.js
git commit -m "feat: RegisterScreen uses Paper components"
```

---

## Task 9: Rewrite ConfirmEmailScreen.js

**Files:** Modify `src/screens/ConfirmEmailScreen.js`

- [ ] **Step 1: Rewrite the file** — keep handleResend logic unchanged:

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/ConfirmEmailScreen.js
git commit -m "feat: ConfirmEmailScreen uses Paper components"
```

---

## Task 10: Rewrite ClientHome.js

**Files:** Modify `src/screens/ClientHome.js`

- [ ] **Step 1: Rewrite the file** — keep loadData, handleLogout, filteredProducts, handleChange (in ProductCard) logic unchanged:

```js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Card, Chip, Searchbar, Text } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, shadows, borderRadius } from '../config/theme';
import ScreenLayout from '../components/ScreenLayout';
import QuantityInput from '../components/QuantityInput';
import EmptyState from '../components/EmptyState';
import { useCart } from '../contexts/CartContext';

const VISIBLE_CATEGORY_SLUGS = ['frais'];

export default function ClientHome({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState(null);
  const { items: cartItems, totals } = useCart();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const [profileRes, prodRes] = await Promise.all([
        supabase.from('profiles').select('nom, prenom, nom_societe').eq('id', user.id).single(),
        supabase.from('products').select('*, category:categories(id, nom, slug)').eq('actif', true).order('nom', { ascending: true }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (prodRes.error) throw prodRes.error;
      const visible = (prodRes.data || []).filter((p) => VISIBLE_CATEGORY_SLUGS.includes(p.category?.slug));
      setProducts(visible);
    } catch (err) {
      console.error('Erreur chargement catalogue :', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => p.nom.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [products, searchQuery]);

  const cartFooter = cartItems.length > 0 ? (
    <View style={styles.cartBar}>
      <View style={styles.cartBarInfo}>
        <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {totals.nbProduitsDistincts} produit{totals.nbProduitsDistincts > 1 ? 's' : ''} · {totals.nbArticles} palette{totals.nbArticles > 1 ? 's' : ''}
        </Text>
        <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '700' }}>
          {totals.totalTtc.toFixed(2)} € TTC
        </Text>
      </View>
      <Button mode="contained" onPress={() => navigation.navigate('Cart')} style={styles.cartBarBtn}>
        Voir mon panier
      </Button>
    </View>
  ) : null;

  const topHeader = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Image source={require('../../assets/logo1.png')} style={styles.logo} resizeMode="contain" />
        <View>
          <Text variant="bodyMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
            Bonjour {profile?.prenom || ''}
          </Text>
          {profile?.nom_societe ? (
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>{profile.nom_societe}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.headerRight}>
        <Button mode="contained" compact onPress={() => navigation.navigate('Cart')} style={styles.cartBtn}>
          Panier {totals.nbArticles > 0 ? `(${totals.nbArticles})` : ''}
        </Button>
        <Button mode="outlined" compact onPress={() => navigation.navigate('MyOrders')} style={styles.ordersBtn}>
          Mes commandes
        </Button>
        <Button mode="text" compact onPress={handleLogout}>
          Déconnexion
        </Button>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={{ color: colors.textSecondary, marginTop: spacing.md }}>
          Chargement du catalogue...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <ScreenLayout header={topHeader} footer={cartFooter}>
      <Searchbar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Rechercher un produit..."
        style={styles.searchbar}
      />

      <View style={styles.catalogHeader}>
        <Text variant="headlineMedium" style={{ color: colors.textPrimary, fontWeight: '700' }}>Catalogue</Text>
        <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
          {products.length} produit{products.length > 1 ? 's' : ''} disponible{products.length > 1 ? 's' : ''}
        </Text>
      </View>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={searchQuery ? '🔍' : '📦'}
          title={searchQuery ? 'Aucun résultat' : 'Aucun produit disponible'}
          subtitle={searchQuery ? `Aucun produit ne correspond à "${searchQuery}"` : 'Revenez bientôt pour découvrir nos produits.'}
        />
      ) : (
        <View style={[styles.productsGrid, isDesktop && styles.productsGridDesktop]}>
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>
      )}
    </ScreenLayout>
  );
}

function ProductCard({ product }) {
  const { items, addToCart, setQuantity } = useCart();
  const TVA = Number(product.tva_pourcent);
  const prixHt = Number(product.prix_palette_ht);
  const prixTtc = prixHt * (1 + TVA / 100);
  const inCart = items.find((i) => i.product.id === product.id);
  const currentQty = inCart ? inCart.quantite_palettes : 0;

  const handleChange = (qty) => {
    if (qty === 0) setQuantity(product.id, 0);
    else if (currentQty === 0) addToCart(product, qty);
    else setQuantity(product.id, qty);
  };

  return (
    <Card style={styles.productCard} elevation={1}>
      <Card.Cover
        source={product.image_url ? { uri: product.image_url } : require('../../assets/logo1.png')}
        style={styles.productCover}
      />
      <Card.Content style={styles.productContent}>
        <Text variant="titleLarge" numberOfLines={2} style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: 4 }}>
          {product.nom}
        </Text>
        {product.description ? (
          <Text variant="bodySmall" numberOfLines={2} style={{ color: colors.textSecondary, marginBottom: 8 }}>
            {product.description}
          </Text>
        ) : null}
        <Text variant="bodySmall" style={{ color: colors.textSecondary, marginBottom: 12 }}>
          24 cartons / palette · {product.unites_par_carton} unité{product.unites_par_carton > 1 ? 's' : ''} / carton
        </Text>
        <View style={styles.pricingBlock}>
          <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '800' }}>{prixTtc.toFixed(2)} € TTC</Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>{prixHt.toFixed(2)} € HT · TVA {TVA}%</Text>
        </View>
        <QuantityInput value={currentQty} onChange={handleChange} min={0} unit="palette" />
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: spacing.xl },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap', gap: spacing.md, ...shadows.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 180, gap: spacing.sm },
  logo: { width: 48, height: 48 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  cartBtn: { borderRadius: borderRadius.md },
  ordersBtn: { borderRadius: borderRadius.md },
  searchbar: { marginBottom: spacing.md, backgroundColor: colors.surface },
  catalogHeader: { marginBottom: spacing.md },
  productsGrid: { gap: spacing.md },
  productsGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  productCard: { flex: 1, minWidth: 280, maxWidth: 360, backgroundColor: colors.surface },
  productCover: { height: 180 },
  productContent: { paddingTop: spacing.md },
  pricingBlock: { marginBottom: spacing.md, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cartBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.sidebarBg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.md, ...shadows.lg,
  },
  cartBarInfo: { flex: 1 },
  cartBarBtn: { borderRadius: borderRadius.md },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/ClientHome.js
git commit -m "feat: ClientHome uses Paper components"
```

---

## Task 11: Rewrite CartScreen.js

**Files:** Modify `src/screens/CartScreen.js`

- [ ] **Step 1: Rewrite the file** — keep showConfirm, handleClear logic unchanged:

```js
import React from 'react';
import { View, Image, TouchableOpacity, Alert, Platform, useWindowDimensions, StyleSheet } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, borderRadius } from '../config/theme';
import ScreenLayout from '../components/ScreenLayout';
import QuantityInput from '../components/QuantityInput';
import EmptyState from '../components/EmptyState';
import { useCart } from '../contexts/CartContext';

const showConfirm = (title, message) =>
  new Promise((resolve) => {
    if (Platform.OS === 'web') resolve(window.confirm(`${title}\n\n${message}`));
    else Alert.alert(title, message, [
      { text: 'Annuler', onPress: () => resolve(false), style: 'cancel' },
      { text: 'Confirmer', onPress: () => resolve(true) },
    ]);
  });

export default function CartScreen({ navigation }) {
  const { items, setQuantity, removeFromCart, clearCart, totals } = useCart();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const handleClear = async () => {
    const ok = await showConfirm('Vider le panier', 'Êtes-vous sûr de vouloir retirer tous les articles ?');
    if (ok) clearCart();
  };

  const summaryCard = items.length > 0 ? (
    <Card style={styles.summaryFooter} elevation={2}>
      <Card.Content>
        <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>Total HT</Text><Text variant="bodyMedium">{totals.totalHt.toFixed(2)} €</Text></View>
        <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>TVA</Text><Text variant="bodyMedium">{totals.totalTva.toFixed(2)} €</Text></View>
        <Divider style={styles.divider} />
        <View style={styles.dataRow}>
          <Text variant="titleLarge" style={{ fontWeight: '700' }}>Total TTC</Text>
          <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '800' }}>{totals.totalTtc.toFixed(2)} €</Text>
        </View>
        <Button mode="contained" onPress={() => navigation.navigate('Checkout')}
          style={styles.checkoutBtn} contentStyle={styles.checkoutContent}>
          Valider ma commande
        </Button>
        <Text variant="bodySmall" style={styles.hint}>Aucun paiement ne sera débité à cette étape.</Text>
      </Card.Content>
    </Card>
  ) : null;

  return (
    <ScreenLayout footer={!isDesktop ? summaryCard : null}>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Button mode="text" compact onPress={() => navigation.goBack()} style={styles.backBtn}>← Retour</Button>
        <Text variant="headlineMedium" style={{ color: colors.textPrimary, fontWeight: '700' }}>Mon panier</Text>
        {items.length > 0 && (
          <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
            {totals.nbProduitsDistincts} produit{totals.nbProduitsDistincts > 1 ? 's' : ''} · {totals.nbArticles} palette{totals.nbArticles > 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {items.length === 0 ? (
        <EmptyState icon="🛒" title="Votre panier est vide" subtitle="Parcourez le catalogue pour ajouter des produits."
          action={{ title: 'Voir le catalogue', onPress: () => navigation.goBack() }} />
      ) : (
        <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
          <View style={[styles.itemsColumn, isDesktop && styles.itemsColumnDesktop]}>
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text variant="titleLarge" style={{ color: colors.textPrimary, fontWeight: '700' }}>Articles</Text>
              <Button mode="text" compact onPress={handleClear}>Vider le panier</Button>
            </View>

            {items.map((item) => (
              <CartItemRow key={item.product.id} item={item}
                onSetQuantity={(qty) => { if (qty <= 0) removeFromCart(item.product.id); else setQuantity(item.product.id, qty); }}
                onRemove={() => removeFromCart(item.product.id)} />
            ))}
          </View>

          {isDesktop && <View style={styles.summaryColumn}>{summaryCard}</View>}
        </View>
      )}
    </ScreenLayout>
  );
}

function CartItemRow({ item, onSetQuantity, onRemove }) {
  const { product, quantite_palettes } = item;
  const TVA = Number(product.tva_pourcent);
  const prixHt = Number(product.prix_palette_ht);
  const sousTotalHt = prixHt * quantite_palettes;
  const sousTotalTtc = sousTotalHt * (1 + TVA / 100);

  return (
    <Card style={styles.cartItem} elevation={1}>
      <View style={styles.cartItemInner}>
        <View style={styles.cartItemImage}>
          {product.image_url
            ? <Image source={{ uri: product.image_url }} style={styles.cartItemImg} />
            : <View style={styles.cartItemImgEmpty}><Text variant="bodySmall" style={{ color: colors.primary }}>Sof Pain</Text></View>}
        </View>
        <View style={styles.cartItemBody}>
          <Text variant="titleMedium" numberOfLines={2} style={{ color: colors.textPrimary, fontWeight: '700' }}>{product.nom}</Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 4 }}>
            {prixHt.toFixed(2)} € HT / palette · TVA {TVA}%
          </Text>
          <View style={styles.cartItemBottom}>
            <QuantityInput value={quantite_palettes} onChange={onSetQuantity} min={1} unit="palette" />
            <View style={styles.cartItemTotals}>
              <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: '800' }}>{sousTotalTtc.toFixed(2)} € TTC</Text>
              <Text variant="bodySmall" style={{ color: colors.textSecondary }}>{sousTotalHt.toFixed(2)} € HT</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onRemove} style={Platform.select({ web: { cursor: 'pointer' } })}>
            <Text variant="bodySmall" style={{ color: colors.error, textDecorationLine: 'underline', marginTop: 4 }}>Retirer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: spacing.lg },
  backBtn: { alignSelf: 'flex-start', marginLeft: -8, marginBottom: spacing.sm },
  layout: { flexDirection: 'column', gap: spacing.lg },
  layoutDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  itemsColumn: { flex: 1, gap: spacing.md },
  itemsColumnDesktop: { flex: 2 },
  summaryColumn: { flex: 1, maxWidth: 360 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cartItem: { backgroundColor: colors.surface },
  cartItemInner: { flexDirection: 'row', overflow: 'hidden' },
  cartItemImage: { width: 120, backgroundColor: colors.secondary },
  cartItemImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  cartItemImgEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cartItemBody: { flex: 1, padding: spacing.md, gap: spacing.sm },
  cartItemBottom: { gap: spacing.sm },
  cartItemTotals: { alignItems: 'flex-end', marginTop: spacing.xs },
  summaryFooter: { marginTop: spacing.md, backgroundColor: colors.surface },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  divider: { marginVertical: spacing.sm },
  checkoutBtn: { marginTop: spacing.lg, borderRadius: borderRadius.md },
  checkoutContent: { paddingVertical: 8 },
  hint: { textAlign: 'center', marginTop: spacing.sm, fontStyle: 'italic', color: colors.textSecondary },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/CartScreen.js
git commit -m "feat: CartScreen uses Paper components"
```

---

## Task 12: Rewrite CheckoutScreen.js

**Files:** Modify `src/screens/CheckoutScreen.js`

- [ ] **Step 1: Rewrite the file** — keep all Supabase logic (useEffect profile load, useEffect empty cart redirect, validate, handleSubmit) unchanged:

```js
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert, Platform, useWindowDimensions, StyleSheet } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, borderRadius } from '../config/theme';
import Input from '../components/Input';
import ScreenLayout from '../components/ScreenLayout';
import { useCart } from '../contexts/CartContext';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

const getDefaultDeliveryDate = () => {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
};
const formatDateFr = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

export default function CheckoutScreen({ navigation }) {
  const { items, totals, clearCart } = useCart();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ telephone: '', adresse: '', code_postal: '', ville: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) { setProfile(data); setForm((prev) => ({ ...prev, telephone: data.telephone || '', adresse: data.adresse || '', code_postal: data.code_postal || '', ville: data.ville || '' })); }
      } catch (err) { console.error('Erreur chargement profil :', err); }
    })();
  }, []);

  useEffect(() => {
    if (items.length === 0) navigation.reset({ index: 0, routes: [{ name: 'ClientHome' }] });
  }, [items.length, navigation]);

  const updateField = (field, value) => { setForm({ ...form, [field]: value }); if (errors[field]) setErrors({ ...errors, [field]: null }); };

  const validate = () => {
    const newErrors = {};
    if (!form.telephone.trim()) newErrors.telephone = 'Le téléphone est requis';
    else if (!/^[0-9+\s().-]{8,20}$/.test(form.telephone.trim())) newErrors.telephone = 'Numéro de téléphone invalide';
    if (!form.adresse.trim()) newErrors.adresse = "L'adresse est requise";
    else if (form.adresse.trim().length > 200) newErrors.adresse = 'Adresse trop longue (max 200 caractères)';
    if (!form.code_postal.trim()) newErrors.code_postal = 'Le code postal est requis';
    else if (!/^[0-9]{4,6}$/.test(form.code_postal.trim())) newErrors.code_postal = 'Code postal invalide';
    if (!form.ville.trim()) newErrors.ville = 'La ville est requise';
    else if (form.ville.trim().length > 100) newErrors.ville = 'Ville trop longue (max 100 caractères)';
    if (form.notes.trim().length > 1000) newErrors.notes = 'Notes trop longues (max 1000 caractères)';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { showAlert('Formulaire incomplet', 'Veuillez remplir les champs requis.'); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');
      const adresseComplete = `${form.adresse.trim()}\n${form.code_postal.trim()} ${form.ville.trim()}\nTél : ${form.telephone.trim()}`;
      const { data: order, error: orderError } = await supabase.from('orders').insert({
        client_id: user.id, statut: 'nouvelle', date_livraison_souhaitee: getDefaultDeliveryDate(),
        adresse_livraison: adresseComplete, notes_client: form.notes.trim() || null,
      }).select('*').single();
      if (orderError) throw orderError;
      const orderItems = items.map((item) => {
        const prixHt = Number(item.product.prix_palette_ht);
        const tva = Number(item.product.tva_pourcent);
        return { order_id: order.id, product_id: item.product.id, product_nom: item.product.nom, quantite_palettes: item.quantite_palettes, cartons_par_palette: 24, prix_palette_ht: prixHt, tva_pourcent: tva, sous_total_ht: prixHt * item.quantite_palettes };
      });
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;
      const { data: updatedOrder } = await supabase.from('orders').select('*').eq('id', order.id).single();
      clearCart();
      navigation.replace('OrderConfirmation', { order: updatedOrder || order, items: orderItems, client: profile });
    } catch (err) {
      console.error('Erreur création commande :', err);
      showAlert('Erreur', err.message || 'Impossible de créer la commande.');
    } finally { setSubmitting(false); }
  };

  return (
    <ScreenLayout>
      {/* Page header */}
      <View style={styles.pageHeader}>
        <Button mode="text" compact onPress={() => navigation.goBack()} style={styles.backBtn}>← Retour</Button>
        <Text variant="headlineMedium" style={{ color: colors.textPrimary, fontWeight: '700' }}>Valider ma commande</Text>
        <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>Renseignez les coordonnées de livraison</Text>
      </View>

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.formColumn, isDesktop && styles.formColumnDesktop]}>
          <Card elevation={1}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.sectionTitle}>Coordonnées de livraison</Text>
              <Input label="Téléphone" required value={form.telephone} onChangeText={(v) => updateField('telephone', v)}
                placeholder="Ex : 06 12 34 56 78" keyboardType="phone-pad" error={errors.telephone} editable={!submitting} />
              <Input label="Adresse" required value={form.adresse} onChangeText={(v) => updateField('adresse', v)}
                placeholder="Ex : 12 rue de la Boulangerie" error={errors.adresse} editable={!submitting} />
              <View style={styles.row}>
                <View style={styles.half}>
                  <Input label="Code postal" required value={form.code_postal}
                    onChangeText={(v) => updateField('code_postal', v.replace(/[^0-9]/g, '').slice(0, 6))}
                    placeholder="75001" keyboardType="numeric" error={errors.code_postal} editable={!submitting} />
                </View>
                <View style={styles.half}>
                  <Input label="Ville" required value={form.ville} onChangeText={(v) => updateField('ville', v)}
                    placeholder="Paris" error={errors.ville} editable={!submitting} />
                </View>
              </View>
              <Input label="Notes / Instructions spéciales" value={form.notes} onChangeText={(v) => updateField('notes', v)}
                placeholder="Précisions pour la livraison..." multiline helperText="Facultatif" editable={!submitting} />
            </Card.Content>
          </Card>

          <Card elevation={1} style={styles.mt}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.sectionTitle}>Date de livraison</Text>
              <View style={styles.deliveryBox}>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Livraison prévue le</Text>
                <Text variant="headlineSmall" style={{ color: colors.primary, fontWeight: '700', marginTop: 4, marginBottom: spacing.xs }}>
                  {formatDateFr(getDefaultDeliveryDate())}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textSecondary, fontStyle: 'italic' }}>
                  Dans 7 jours. L'entreprise vous contactera pour ajuster si besoin.
                </Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        <View style={[styles.summaryColumn, isDesktop && styles.summaryColumnDesktop]}>
          <Card elevation={1}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.sectionTitle}>Récapitulatif</Text>
              {items.map((item) => {
                const sousTotal = Number(item.product.prix_palette_ht) * item.quantite_palettes;
                return (
                  <View key={item.product.id} style={styles.dataRow}>
                    <Text variant="bodySmall" style={{ color: colors.textLight, flex: 1 }}>{item.product.nom} × {item.quantite_palettes}</Text>
                    <Text variant="bodyMedium">{sousTotal.toFixed(2)} €</Text>
                  </View>
                );
              })}
              <Divider style={styles.divider} />
              <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>Total HT</Text><Text variant="bodyMedium">{totals.totalHt.toFixed(2)} €</Text></View>
              <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>TVA</Text><Text variant="bodyMedium">{totals.totalTva.toFixed(2)} €</Text></View>
              <Divider style={styles.divider} />
              <View style={styles.dataRow}>
                <Text variant="titleLarge" style={{ fontWeight: '700' }}>Total TTC</Text>
                <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '800' }}>{totals.totalTtc.toFixed(2)} €</Text>
              </View>
              <Button mode="contained" onPress={handleSubmit} loading={submitting} disabled={submitting}
                style={styles.confirmBtn} contentStyle={styles.confirmContent}>
                Confirmer ma commande
              </Button>
              <Text variant="bodySmall" style={styles.hint}>
                En confirmant, un bon de commande sera généré. Aucun paiement n'est effectué à cette étape.
              </Text>
            </Card.Content>
          </Card>
        </View>
      </View>

      {submitting && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodyLarge" style={{ marginTop: spacing.md }}>Création de la commande...</Text>
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: spacing.lg },
  backBtn: { alignSelf: 'flex-start', marginLeft: -8, marginBottom: spacing.sm },
  sectionTitle: { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.md },
  layout: { flexDirection: 'column', gap: spacing.lg },
  layoutDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  formColumn: { flex: 1, gap: spacing.md },
  formColumnDesktop: { flex: 2 },
  summaryColumn: { width: '100%' },
  summaryColumnDesktop: { flex: 1, maxWidth: 380 },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  deliveryBox: { backgroundColor: colors.secondary, padding: spacing.md, borderRadius: 8 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  divider: { marginVertical: spacing.sm },
  confirmBtn: { marginTop: spacing.lg, borderRadius: borderRadius.md },
  confirmContent: { paddingVertical: 8 },
  hint: { textAlign: 'center', marginTop: spacing.sm, fontStyle: 'italic', color: colors.textSecondary },
  mt: { marginTop: spacing.md },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/CheckoutScreen.js
git commit -m "feat: CheckoutScreen uses Paper components"
```

---

## Task 13: Rewrite OrderConfirmationScreen.js

**Files:** Modify `src/screens/OrderConfirmationScreen.js`

- [ ] **Step 1: Rewrite the file** — keep handleDownloadPdf, handleBackToCatalog, handleViewOrders, formatDate unchanged:

```js
import React, { useState } from 'react';
import { View, Alert, Platform, useWindowDimensions, StyleSheet } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { colors, spacing, borderRadius, shadows } from '../config/theme';
import ScreenLayout from '../components/ScreenLayout';
import { generateOrderPdf } from '../utils/generateOrderPdf';

const showAlert = (title, message) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

const formatDate = (input) => {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function OrderConfirmationScreen({ navigation, route }) {
  const { order, items, client } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [generating, setGenerating] = useState(false);

  const handleDownloadPdf = async () => {
    if (!order || !items || !client) { showAlert('Erreur', 'Informations de commande incomplètes.'); return; }
    setGenerating(true);
    try { await generateOrderPdf(order, items, client); }
    catch (err) { console.error('Erreur génération PDF :', err); showAlert('Erreur', 'Impossible de générer le bon de commande.'); }
    finally { setGenerating(false); }
  };

  const handleBackToCatalog = () => navigation.reset({ index: 0, routes: [{ name: 'ClientHome' }] });
  const handleViewOrders = () => navigation.reset({ index: 0, routes: [{ name: 'ClientHome' }, { name: 'MyOrders' }] });

  if (!order) {
    return (
      <ScreenLayout scroll contentStyle={styles.centered}>
        <Text variant="headlineSmall">Commande introuvable</Text>
        <Button mode="text" onPress={handleBackToCatalog} style={styles.mt}>Retour au catalogue</Button>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout scroll contentStyle={styles.scrollContent}>
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        <View style={styles.successBadge}>
          <Text variant="headlineMedium" style={{ color: colors.white, textAlign: 'center' }}>✓</Text>
        </View>

        <Text variant="headlineMedium" style={styles.title}>Commande enregistrée</Text>
        <Text variant="bodyLarge" style={styles.subtitle}>Votre bon de commande a été généré avec succès.</Text>

        <Card style={styles.infoCard} elevation={1}>
          <Card.Content>
            <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>Numéro de commande</Text><Text variant="bodyMedium" style={{ fontFamily: 'monospace' }}>{order.numero}</Text></View>
            <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>Date de commande</Text><Text variant="bodyMedium">{formatDate(order.date_commande)}</Text></View>
            <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>Livraison prévue</Text><Text variant="bodyMedium">{formatDate(order.date_livraison_souhaitee)}</Text></View>
            <Divider style={styles.divider} />
            <View style={styles.dataRow}>
              <Text variant="titleLarge" style={{ fontWeight: '700' }}>Total TTC</Text>
              <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '800' }}>{Number(order.total_ttc).toFixed(2)} €</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.noticeCard} elevation={0}>
          <Card.Content>
            <Text variant="bodyMedium" style={{ fontWeight: '700', color: colors.textPrimary }}>Prochaines étapes</Text>
            <Text variant="bodySmall" style={{ color: colors.textSecondary, marginTop: 6 }}>
              Téléchargez votre bon de commande ci-dessous, puis contactez l'entreprise Sof Pain pour confirmer votre livraison. Aucun paiement n'a été débité à cette étape.
            </Text>
          </Card.Content>
        </Card>

        <Button mode="contained" onPress={handleDownloadPdf} loading={generating} disabled={generating}
          style={styles.pdfBtn} contentStyle={styles.pdfContent}>
          Télécharger le bon de commande
        </Button>

        <View style={styles.actionsRow}>
          <Button mode="outlined" onPress={handleViewOrders} style={styles.actionBtn}>Voir mes commandes</Button>
          <Button mode="text" onPress={handleBackToCatalog} style={styles.actionBtn}>Retour au catalogue</Button>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  container: { width: '100%', maxWidth: 560, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, ...shadows.md },
  containerDesktop: { padding: spacing.xxl },
  successBadge: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { textAlign: 'center', color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.sm },
  subtitle: { textAlign: 'center', color: colors.textSecondary, marginBottom: spacing.lg },
  infoCard: { width: '100%', marginBottom: spacing.md, backgroundColor: colors.surface },
  noticeCard: { width: '100%', marginBottom: spacing.lg, backgroundColor: colors.secondary },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  divider: { marginVertical: spacing.sm },
  pdfBtn: { width: '100%', borderRadius: borderRadius.md, marginBottom: spacing.md },
  pdfContent: { paddingVertical: 8 },
  actionsRow: { width: '100%', flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 140 },
  mt: { marginTop: spacing.md },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/OrderConfirmationScreen.js
git commit -m "feat: OrderConfirmationScreen uses Paper components"
```

---

## Task 14: Rewrite MyOrdersScreen.js

**Files:** Modify `src/screens/MyOrdersScreen.js`

- [ ] **Step 1: Rewrite the file** — keep loadOrders, EN_COURS/EFFECTUEES logic, fmt unchanged:

```js
import React, { useState, useEffect, useCallback } from 'react';
import { View, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { ActivityIndicator, Card, Chip, Text } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, borderRadius } from '../config/theme';
import ScreenLayout from '../components/ScreenLayout';
import EmptyState from '../components/EmptyState';

const STATUS_CFG = {
  nouvelle:       { label: 'Nouvelle',       bg: '#E3F2FD', text: '#1055A0' },
  en_preparation: { label: 'En préparation', bg: '#FFF3E0', text: '#D84315' },
  en_livraison:   { label: 'En livraison',   bg: 'rgba(196,146,74,0.12)', text: '#A67A38' },
  livree:         { label: 'Livrée',         bg: '#E8F5E9', text: '#276228' },
  annulee:        { label: 'Annulée',        bg: '#FFEBEE', text: '#B71C1C' },
};

const EN_COURS   = ['nouvelle', 'en_preparation', 'en_livraison'];
const EFFECTUEES = ['livree', 'annulee'];
const fmt = (d) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function MyOrdersScreen({ navigation }) {
  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('en_cours');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from('orders').select('*').eq('client_id', user.id).order('date_commande', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) { console.error('Erreur chargement commandes :', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const countEnCours   = orders.filter((o) => EN_COURS.includes(o.statut)).length;
  const countEffectuee = orders.filter((o) => EFFECTUEES.includes(o.statut)).length;
  const displayed      = orders.filter((o) => activeTab === 'en_cours' ? EN_COURS.includes(o.statut) : EFFECTUEES.includes(o.statut));

  return (
    <ScreenLayout>
      <View style={styles.pageHeader}>
        <Text variant="headlineMedium" style={{ color: colors.textPrimary, fontWeight: '700' }}>Mes commandes</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[{ key: 'en_cours', label: 'En cours', count: countEnCours }, { key: 'effectuees', label: 'Effectuées', count: countEffectuee }].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)} activeOpacity={0.8}>
              <Text variant="bodyLarge" style={{ color: active ? colors.primary : colors.textSecondary, fontWeight: active ? '700' : '400' }}>
                {tab.label}
              </Text>
              <Chip compact style={{ backgroundColor: active ? colors.primary : colors.border }}
                textStyle={{ color: active ? colors.white : colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                {tab.count}
              </Chip>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text variant="bodyLarge" style={{ color: colors.textSecondary, marginTop: spacing.md }}>Chargement...</Text>
        </View>
      ) : displayed.length === 0 ? (
        <EmptyState
          icon={activeTab === 'en_cours' ? '📋' : '✅'}
          title={activeTab === 'en_cours' ? 'Aucune commande en cours' : 'Aucune commande effectuée'}
          subtitle={activeTab === 'en_cours' ? 'Vos commandes actives apparaîtront ici.' : 'Vos commandes livrées ou annulées apparaîtront ici.'} />
      ) : (
        <View style={styles.list}>
          {displayed.map((item) => {
            const cfg = STATUS_CFG[item.statut] || { label: item.statut, bg: '#F5F5F5', text: '#666' };
            return (
              <TouchableOpacity key={item.id} onPress={() => navigation.navigate('OrderDetail', { order: item })}
                activeOpacity={0.75} style={Platform.select({ web: { cursor: 'pointer' } })}>
                <Card elevation={1} style={styles.orderCard}>
                  <Card.Content>
                    <View style={styles.cardTop}>
                      <Text variant="titleLarge" style={{ color: colors.textPrimary, fontWeight: '700' }}>N° {item.numero}</Text>
                      <Chip compact style={{ backgroundColor: cfg.bg }} textStyle={{ color: cfg.text, fontWeight: '600', fontSize: 12 }}>
                        {cfg.label}
                      </Chip>
                    </View>
                    <View style={styles.cardBottom}>
                      <Text variant="bodySmall" style={{ color: colors.textSecondary }}>{fmt(item.date_commande)}</Text>
                      <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: '800' }}>
                        {Number(item.total_ttc ?? 0).toFixed(2)} €
                      </Text>
                    </View>
                    {item.date_livraison_souhaitee ? (
                      <Text variant="bodySmall" style={{ color: colors.textLight, fontStyle: 'italic', marginTop: 4 }}>
                        Livraison souhaitée : {fmt(item.date_livraison_souhaitee)}
                      </Text>
                    ) : null}
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  pageHeader: { marginBottom: spacing.lg },
  tabs: { flexDirection: 'row', marginBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent', ...Platform.select({ web: { cursor: 'pointer' } }) },
  tabActive: { borderBottomColor: colors.primary },
  centered: { alignItems: 'center', paddingVertical: spacing.xxl },
  list: { gap: spacing.sm },
  orderCard: { backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/MyOrdersScreen.js
git commit -m "feat: MyOrdersScreen uses Paper components"
```

---

## Task 15: Rewrite OrderDetailScreen.js

**Files:** Modify `src/screens/OrderDetailScreen.js`

- [ ] **Step 1: Rewrite the file** — keep all useEffect loading logic and handlePdf unchanged:

```js
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert, Platform, useWindowDimensions, StyleSheet } from 'react-native';
import { Button, Card, Chip, Divider, Text } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing } from '../config/theme';
import ScreenLayout from '../components/ScreenLayout';
import { generateOrderPdf } from '../utils/generateOrderPdf';

const STATUS_CFG = {
  nouvelle:       { label: 'Nouvelle',       bg: '#E3F2FD', text: '#1055A0' },
  en_preparation: { label: 'En préparation', bg: '#FFF3E0', text: '#D84315' },
  en_livraison:   { label: 'En livraison',   bg: 'rgba(196,146,74,0.12)', text: '#A67A38' },
  livree:         { label: 'Livrée',         bg: '#E8F5E9', text: '#276228' },
  annulee:        { label: 'Annulée',        bg: '#FFEBEE', text: '#B71C1C' },
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const n2 = (v) => Number(v ?? 0).toFixed(2);
const showAlert = (title, msg) => { if (Platform.OS === 'web') window.alert(`${title}\n\n${msg}`); else Alert.alert(title, msg); };

export default function OrderDetailScreen({ navigation, route }) {
  const { order } = route.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const [items, setItems]           = useState([]);
  const [client, setClient]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!order?.id) { setLoading(false); return; }
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); return; }
        const [ownershipRes, itemsRes, profileRes] = await Promise.all([
          supabase.from('orders').select('id').eq('id', order.id).eq('client_id', user.id).single(),
          supabase.from('order_items').select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
          supabase.from('profiles').select('*').eq('id', user.id).single(),
        ]);
        if (!ownershipRes.data) { navigation.goBack(); return; }
        if (itemsRes.data) setItems(itemsRes.data);
        if (profileRes.data) setClient(profileRes.data);
      } catch (err) { console.error('Erreur chargement détail commande :', err); }
      finally { setLoading(false); }
    })();
  }, [order?.id]);

  const handlePdf = async () => {
    if (!client) { showAlert('Erreur', 'Profil client non chargé.'); return; }
    setPdfLoading(true);
    try { await generateOrderPdf(order, items, client); }
    catch (err) { console.error('Erreur PDF :', err); showAlert('Erreur', 'Impossible de générer le bon de commande.'); }
    finally { setPdfLoading(false); }
  };

  if (!order) {
    return (
      <ScreenLayout scroll contentStyle={styles.centered}>
        <Text variant="bodyLarge" style={{ color: colors.textSecondary }}>Commande introuvable.</Text>
        <Button mode="text" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>← Retour</Button>
      </ScreenLayout>
    );
  }

  const cfg = STATUS_CFG[order.statut] || { label: order.statut, bg: '#F5F5F5', text: '#666' };

  return (
    <ScreenLayout contentStyle={isDesktop ? styles.bodyDesktop : undefined}>
      <View style={styles.pageHeader}>
        <Button mode="text" compact onPress={() => navigation.goBack()} style={styles.backBtn}>← Retour</Button>
        <Text variant="headlineMedium" style={{ color: colors.textPrimary, fontWeight: '700' }}>N° {order.numero}</Text>
        <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>Passée le {fmt(order.date_commande)}</Text>
      </View>

      <View style={styles.statusRow}>
        <Chip compact style={{ backgroundColor: cfg.bg }} textStyle={{ color: cfg.text, fontWeight: '600', fontSize: 13 }}>
          {cfg.label}
        </Chip>
      </View>

      <Card elevation={1} style={styles.mb}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.sectionTitle}>Livraison</Text>
          <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>Date souhaitée</Text><Text variant="bodyMedium">{fmt(order.date_livraison_souhaitee)}</Text></View>
          {order.adresse_livraison ? (
            <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>Adresse</Text><Text variant="bodyMedium" style={{ flex: 1, textAlign: 'right' }}>{order.adresse_livraison}</Text></View>
          ) : null}
          {order.notes_client ? (
            <View style={[styles.notesBox]}>
              <Text variant="labelSmall" style={{ color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6 }}>Notes</Text>
              <Text variant="bodyMedium" style={{ fontStyle: 'italic' }}>{order.notes_client}</Text>
            </View>
          ) : null}
        </Card.Content>
      </Card>

      <Card elevation={1} style={styles.mb}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.sectionTitle}>Produits commandés</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} />
          ) : items.length === 0 ? (
            <Text variant="bodySmall" style={{ color: colors.textSecondary, fontStyle: 'italic' }}>Aucun article trouvé.</Text>
          ) : (
            <>
              <View style={styles.tableHead}>
                <Text variant="labelSmall" style={[styles.label, { flex: 3 }]}>Produit</Text>
                <Text variant="labelSmall" style={[styles.label, styles.right, { flex: 1.5 }]}>Palettes</Text>
                <Text variant="labelSmall" style={[styles.label, styles.right, { flex: 2 }]}>ST HT</Text>
              </View>
              {items.map((it, idx) => (
                <View key={it.id} style={[styles.tableRow, idx % 2 === 1 && styles.rowAlt]}>
                  <Text variant="bodyMedium" numberOfLines={2} style={{ flex: 3 }}>{it.product_nom}</Text>
                  <Text variant="bodyMedium" style={[styles.right, { flex: 1.5 }]}>{it.quantite_palettes} pal.</Text>
                  <Text variant="bodyMedium" style={[styles.right, { flex: 2 }]}>{n2(it.sous_total_ht)} €</Text>
                </View>
              ))}
              <Divider style={styles.divider} />
              <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>Total HT</Text><Text variant="bodyMedium">{n2(order.total_ht)} €</Text></View>
              <View style={styles.dataRow}><Text variant="bodySmall" style={{ color: colors.textLight }}>TVA</Text><Text variant="bodyMedium">{n2(order.total_tva)} €</Text></View>
              <Divider style={styles.divider} />
              <View style={styles.dataRow}>
                <Text variant="titleLarge" style={{ fontWeight: '700' }}>Total TTC</Text>
                <Text variant="titleLarge" style={{ color: colors.primary, fontWeight: '800' }}>{n2(order.total_ttc)} €</Text>
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      <Button mode="contained" onPress={handlePdf} loading={pdfLoading} disabled={pdfLoading || loading}
        style={styles.pdfBtn} contentStyle={styles.pdfContent}>
        📄  Télécharger le bon de commande
      </Button>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  bodyDesktop: { maxWidth: 720, alignSelf: 'center', width: '100%' },
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  pageHeader: { marginBottom: spacing.md },
  backBtn: { alignSelf: 'flex-start', marginLeft: -8, marginBottom: spacing.sm },
  statusRow: { marginBottom: spacing.lg },
  sectionTitle: { color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.md },
  mb: { marginBottom: spacing.md, backgroundColor: colors.surface },
  notesBox: { backgroundColor: colors.secondary, borderRadius: 8, padding: spacing.sm, marginTop: spacing.sm, gap: 4 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  divider: { marginVertical: spacing.sm },
  tableHead: { flexDirection: 'row', paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xs },
  tableRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 4, borderRadius: 4 },
  rowAlt: { backgroundColor: colors.secondary },
  label: { color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.6 },
  right: { textAlign: 'right' },
  pdfBtn: { borderRadius: borderRadius.md, marginBottom: spacing.lg },
  pdfContent: { paddingVertical: 8 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/OrderDetailScreen.js
git commit -m "feat: OrderDetailScreen uses Paper components"
```

---

## Task 16: Rewrite AdminProductsScreen.js

**Files:** Modify `src/screens/AdminProductsScreen.js`

- [ ] **Step 1: Rewrite the file** — keep loadData, handleCreate, handleEdit, handleSaved, filteredProducts, stats logic unchanged:

```js
import React, { useState, useEffect, useCallback } from 'react';
import { View, Image, TouchableOpacity, StyleSheet, ScrollView, Platform, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Card, Chip, Text } from 'react-native-paper';
import { supabase } from '../config/supabase';
import { colors, spacing, borderRadius } from '../config/theme';
import EmptyState from '../components/EmptyState';
import ProductFormModal from '../components/ProductFormModal';

const VISIBLE_CATEGORY_SLUGS = ['frais'];

export default function AdminProductsScreen() {
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [showInactive, setShowInactive]     = useState(false);
  const [modalVisible, setModalVisible]     = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const loadData = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').order('ordre'),
        supabase.from('products').select('*, category:categories(id, nom, slug)').order('created_at', { ascending: false }),
      ]);
      if (catRes.error) throw catRes.error;
      if (prodRes.error) throw prodRes.error;
      const visibleCategories = (catRes.data || []).filter((c) => VISIBLE_CATEGORY_SLUGS.includes(c.slug));
      setCategories(visibleCategories);
      setProducts((prodRes.data || []).filter((p) => VISIBLE_CATEGORY_SLUGS.includes(p.category?.slug)));
    } catch (err) { console.error('Erreur chargement produits :', err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = () => { setEditingProduct(null); setModalVisible(true); };
  const handleEdit   = (product) => { setEditingProduct(product); setModalVisible(true); };
  const handleSaved  = () => { loadData(); };

  const filteredProducts = products.filter((p) => {
    if (!showInactive && !p.actif) return false;
    if (filterCategory !== 'all' && p.category_id !== filterCategory) return false;
    return true;
  });

  const stats = { total: products.length, actifs: products.filter((p) => p.actif).length };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={{ color: colors.textSecondary, marginTop: spacing.md }}>Chargement des produits...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text variant="headlineSmall" style={{ color: colors.textPrimary, fontWeight: '700' }}>Produits</Text>
          <Button mode="contained" compact onPress={handleCreate} style={styles.addBtn}>+ Ajouter un produit</Button>
        </View>

        <Text variant="bodySmall" style={{ color: colors.textSecondary, marginBottom: spacing.lg }}>
          {stats.actifs} actif{stats.actifs > 1 ? 's' : ''} sur {stats.total} au total
        </Text>

        {categories.length > 1 && (
          <View style={styles.filtersRow}>
            <Chip selected={filterCategory === 'all'} onPress={() => setFilterCategory('all')}
              style={styles.filterChip} selectedColor={colors.primary}>Toutes</Chip>
            {categories.map((cat) => (
              <Chip key={cat.id} selected={filterCategory === cat.id} onPress={() => setFilterCategory(cat.id)}
                style={styles.filterChip} selectedColor={colors.primary}>{cat.nom}</Chip>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.toggleInactive} onPress={() => setShowInactive(!showInactive)} activeOpacity={0.7}>
          <View style={[styles.checkbox, showInactive && styles.checkboxChecked]}>
            {showInactive && <View style={styles.checkboxInner} />}
          </View>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Afficher les produits désactivés</Text>
        </TouchableOpacity>

        {filteredProducts.length === 0 ? (
          <EmptyState title="Aucun produit"
            subtitle={products.length === 0 ? 'Commencez par ajouter votre premier produit.' : 'Aucun produit ne correspond aux filtres.'} />
        ) : (
          <View style={[styles.productsGrid, isDesktop && styles.productsGridDesktop]}>
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onEdit={() => handleEdit(product)} />
            ))}
          </View>
        )}
      </ScrollView>

      <ProductFormModal visible={modalVisible} product={editingProduct} categories={categories}
        onClose={() => setModalVisible(false)} onSaved={handleSaved} />
    </>
  );
}

function ProductCard({ product, onEdit }) {
  const actifCfg = product.actif
    ? { label: 'Actif',     bg: '#E8F5E9', text: '#276228' }
    : { label: 'Désactivé', bg: '#FFEBEE', text: '#B71C1C' };

  return (
    <Card style={[styles.productCard, !product.actif && styles.productCardInactive]} elevation={1}>
      <View style={styles.productImage}>
        {product.image_url
          ? <Image source={{ uri: product.image_url }} style={styles.productImg} />
          : <View style={styles.productImgEmpty}><Text variant="titleLarge" style={{ color: colors.primary }}>Sof Pain</Text></View>}
        {!product.actif && (
          <View style={styles.inactiveBadge}>
            <Chip compact style={{ backgroundColor: actifCfg.bg }} textStyle={{ color: actifCfg.text, fontWeight: '600', fontSize: 11 }}>
              {actifCfg.label}
            </Chip>
          </View>
        )}
      </View>
      <Card.Content>
        <Chip compact style={{ backgroundColor: 'rgba(196,146,74,0.1)', marginBottom: 8 }} textStyle={{ color: colors.primary, fontSize: 11 }}>
          {product.category?.nom || 'Sans catégorie'}
        </Chip>
        <Text variant="titleMedium" numberOfLines={2} style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: 4 }}>{product.nom}</Text>
        {product.description ? (
          <Text variant="bodySmall" numberOfLines={2} style={{ color: colors.textSecondary, marginBottom: 8 }}>{product.description}</Text>
        ) : null}
        <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
          24 cartons / palette · {product.unites_par_carton} unité{product.unites_par_carton > 1 ? 's' : ''} / carton
        </Text>
        <View style={styles.priceRow}>
          <Text variant="titleMedium" style={{ color: colors.primary, fontWeight: '800' }}>{Number(product.prix_palette_ht).toFixed(2)} €</Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}> HT / palette</Text>
        </View>
        <Button mode="outlined" compact onPress={onEdit} style={styles.editBtn}>Modifier</Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  addBtn: { borderRadius: borderRadius.md },
  filtersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: { backgroundColor: colors.surface },
  toggleInactive: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl, alignSelf: 'flex-start', gap: spacing.sm, ...Platform.select({ web: { cursor: 'pointer' } }) },
  checkbox: { width: 18, height: 18, borderWidth: 1.5, borderColor: colors.border, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkboxChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkboxInner: { width: 10, height: 10, backgroundColor: colors.white, borderRadius: 1 },
  productsGrid: { gap: spacing.md },
  productsGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  productCard: { flex: 1, minWidth: 280, maxWidth: 360, backgroundColor: colors.surface },
  productCardInactive: { opacity: 0.6 },
  productImage: { width: '100%', aspectRatio: 1.5, backgroundColor: colors.secondary, overflow: 'hidden' },
  productImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  productImgEmpty: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  inactiveBadge: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm, marginBottom: spacing.sm },
  editBtn: { borderRadius: borderRadius.md },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/AdminProductsScreen.js
git commit -m "feat: AdminProductsScreen uses Paper components"
```

---

## Task 17: Rewrite AdminOrdersScreen.js

**Files:** Modify `src/screens/AdminOrdersScreen.js`

- [ ] **Step 1: Replace imports and all custom component usages** — keep STATUTS, STATUT_COLORS, loadOrders, openOrder, closeModal, handleOrderUpdated, and the full Modal internals. Replace only `SectionHeader`, `Card`, `Typography`, `StatusTag`, `Button`, `EmptyState` with Paper equivalents:

At the top of the file, change imports to:
```js
import { ActivityIndicator, Button, Card, Chip, Text } from 'react-native-paper';
```
Remove imports of: `Button`, `Typography`, `Card`, `SectionHeader`, `StatusTag`, `EmptyState` from `../components/...`

Add the STATUS_CFG constant (same as in other screens).

Replace `SectionHeader` with:
```jsx
<View style={styles.sectionHeader}>
  <Text variant="headlineSmall" style={{ color: colors.textPrimary, fontWeight: '700' }}>Commandes</Text>
  <Button mode="text" compact onPress={loadOrders}>↻ Actualiser</Button>
</View>
```

Replace `StatusTag` with:
```jsx
<Chip compact style={{ backgroundColor: STATUS_CFG[item.statut]?.bg || '#F5F5F5' }}
  textStyle={{ color: STATUS_CFG[item.statut]?.text || '#666', fontWeight: '600', fontSize: 11 }}>
  {STATUS_CFG[item.statut]?.label || item.statut}
</Chip>
```

Replace `Typography` with Paper `Text` using appropriate variants and color via `style`.

Replace `EmptyState` with `<EmptyState .../>` — EmptyState is kept, it now uses Paper internally.

Replace `Card` wrappers in OrderRow with Paper `Card`.

Replace all inline `Text`/`TextInput` from react-native inside the Modal with Paper `Text`/`TextInput`.

In the Modal's status update section, replace the custom status buttons with Paper `Button mode="outlined"` or `Chip`.

- [ ] **Step 2: Commit**

```bash
git add src/screens/AdminOrdersScreen.js
git commit -m "feat: AdminOrdersScreen uses Paper components"
```

---

## Task 18: Rewrite AdminClientsScreen.js

**Files:** Modify `src/screens/AdminClientsScreen.js`

- [ ] **Step 1: Replace imports and usages** — keep all Supabase logic and Modal internals. Same pattern as Task 17:

Remove imports: `Button`, `Typography`, `Card`, `SectionHeader`, `SearchBar`, `Badge`, `EmptyState` from `../components/...`

Add Paper imports:
```js
import { ActivityIndicator, Button, Card, Chip, Searchbar, Text } from 'react-native-paper';
```

Replace `SearchBar` with:
```jsx
<Searchbar value={search} onChangeText={setSearch} placeholder="Rechercher un client..." style={styles.searchbar} />
```

Replace `SectionHeader` with inline View + Paper Text + Button.

Replace `Badge` for actif/inactif with `Chip` using same color logic as STATUS_CFG pattern:
```jsx
<Chip compact style={{ backgroundColor: client.actif ? '#E8F5E9' : '#FFEBEE' }}
  textStyle={{ color: client.actif ? '#276228' : '#B71C1C', fontWeight: '600', fontSize: 11 }}>
  {client.actif ? 'Actif' : 'Inactif'}
</Chip>
```

Replace `Card` with Paper `Card`.

Replace `Typography` with Paper `Text`.

Replace all inline react-native `Text`/`TextInput` inside the Modal with Paper equivalents.

- [ ] **Step 2: Commit**

```bash
git add src/screens/AdminClientsScreen.js
git commit -m "feat: AdminClientsScreen uses Paper components"
```

---

## Task 19: Rewrite AdminStatsScreen.js

**Files:** Modify `src/screens/AdminStatsScreen.js`

- [ ] **Step 1: Replace imports and usages** — keep all data loading, period selector, and calculation logic unchanged:

Remove imports: `Button`, `Typography`, `Card`, `SectionHeader`, `EmptyState` from `../components/...`

Add Paper imports:
```js
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';
```

Replace `SectionHeader` with inline View + Paper Text.

Replace `Card` with Paper `Card` + `Card.Content`.

Replace all `Typography` with Paper `Text` using appropriate variants.

Replace custom filter/tab buttons with Paper `Button mode="outlined"` or `Chip`.

Stat number displays (`Typography variant="h1" color="primary"`) become:
```jsx
<Text variant="headlineLarge" style={{ color: colors.primary, fontWeight: '800' }}>{value}</Text>
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/AdminStatsScreen.js
git commit -m "feat: AdminStatsScreen uses Paper components"
```

---

## Task 20: Delete obsolete custom components

**Files:** Delete 10 files

- [ ] **Step 1: Delete the files**

```bash
rm src/components/Button.js
rm src/components/Card.js
rm src/components/SearchBar.js
rm src/components/Badge.js
rm src/components/StatusTag.js
rm src/components/Divider.js
rm src/components/Typography.js
rm src/components/PageHeader.js
rm src/components/SectionHeader.js
rm src/components/DataRow.js
```

- [ ] **Step 2: Start dev server and verify no import errors**

```bash
npx expo start --web
```

Navigate through all screens. Expected: no "module not found" or "cannot find" errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete obsolete custom components (replaced by react-native-paper)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Install react-native-paper — Task 1
- ✅ MD2 theme with brand colors — Task 2
- ✅ PaperProvider in App.js — Task 3
- ✅ Input uses Paper TextInput — Task 4
- ✅ QuantityInput uses Paper Button — Task 5
- ✅ EmptyState uses Paper Text + Button — Task 6
- ✅ All 9 client screens rewritten — Tasks 7–15
- ✅ All 4 admin screens rewritten — Tasks 16–19
- ✅ 10 custom components deleted — Task 20
- ✅ AdminLayout untouched (no custom component imports)
- ✅ ScreenLayout untouched (no custom component imports)
- ✅ BrandHeader untouched
- ✅ ProductFormModal untouched (out of scope)

**Consistency check:**
- STATUS_CFG is defined identically in Tasks 14, 15, 16, 17 — copy-paste the same object each time
- Paper `Button` children = label string (not `title` prop) — confirmed in all tasks
- Paper `Card` used with `Card.Content` for padded content, without for raw layout — confirmed in CartScreen cartItem
- `colors` and `spacing` imported from `../config/theme` in all screens — confirmed
