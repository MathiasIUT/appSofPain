import { supabase } from '../config/supabase';

export const DEFAULT_HORAIRES = { ouverture: 9, fermeture: 20 };

// Récupère les horaires de commande depuis app_settings (fallback : 9h-20h)
export async function fetchHorairesCommande() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'horaires_commande')
      .single();
    if (error || !data?.value) return DEFAULT_HORAIRES;
    const ouverture = Number(data.value.ouverture);
    const fermeture = Number(data.value.fermeture);
    if (isNaN(ouverture) || isNaN(fermeture)) return DEFAULT_HORAIRES;
    return { ouverture, fermeture };
  } catch {
    return DEFAULT_HORAIRES;
  }
}

// Calcule la date de commande (= date de tournée) selon les horaires :
// - entre ouverture et fermeture : la commande compte pour aujourd'hui (heure réelle conservée)
// - après la fermeture : reportée automatiquement au jour suivant
// - avant l'ouverture : rattachée à la tournée du jour même
// Les commandes hors créneau sont horodatées à 12h pour que la date (UTC)
// corresponde toujours au bon jour de tournée.
export function computeDateCommande(horaires = DEFAULT_HORAIRES, now = new Date()) {
  const d = new Date(now);
  const h = d.getHours();
  if (h >= horaires.fermeture) {
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
  } else if (h < horaires.ouverture) {
    d.setHours(12, 0, 0, 0);
  }
  return d.toISOString();
}

// Les commandes frais passées aujourd'hui sont livrées sur la tournée de demain.
// La colonne date_livraison_souhaitee est de type `date` : conserver une date locale.
export function computeDateLivraisonFrais(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Les anciennes commandes frais utilisaient date_commande comme date de tournée.
export function getDateTourneeFrais(order) {
  return order?.date_livraison_souhaitee || (order?.date_commande || '').split('T')[0];
}

// true si la commande passée maintenant sera reportée au jour suivant
export function isHorsCreneau(horaires = DEFAULT_HORAIRES, now = new Date()) {
  return now.getHours() >= horaires.fermeture;
}
