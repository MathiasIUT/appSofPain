import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Récupération sécurisée des variables depuis app.config.js
const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};

const supabaseUrl = extra.supabaseUrl;
const supabaseAnonKey = extra.supabaseAnonKey;

// Vérification explicite avec message clair
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Variables Supabase manquantes !\n\n' +
      'Vérifiez que :\n' +
      '1. Le fichier .env existe à la racine du projet\n' +
      '2. Il contient SUPABASE_URL et SUPABASE_ANON_KEY\n' +
      '3. app.config.js existe (et pas app.json)\n' +
      '4. dotenv est installé (npm install dotenv)\n' +
      '5. Expo a été redémarré avec --clear\n\n' +
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