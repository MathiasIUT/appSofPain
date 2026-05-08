import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Utilisation des variables d'environnement natives d'Expo (SDK 49+)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Vérification explicite avec message clair
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables Supabase manquantes !\n\n' +
    'Vérifiez que :\n' +
    '1. Le fichier .env existe à la racine du projet\n' +
    '2. Il contient EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
    '3. Expo a été redémarré avec --clear (npx expo start -c)\n\n' +
    `Valeurs actuelles : URL=${supabaseUrl}, KEY=${supabaseAnonKey ? 'définie' : 'MANQUANTE'}`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});