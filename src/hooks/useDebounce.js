import { useState, useEffect } from 'react';

/**
 * Debounce un valeur. Retourne la valeur après `delay` ms sans changement.
 * Utile pour éviter de spammer l'API Supabase à chaque frappe de recherche.
 *
 * @param {*} value - La valeur à debouncer
 * @param {number} delay - Délai en ms (défaut : 300)
 * @returns {*} La valeur debouncée
 */
export default function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
