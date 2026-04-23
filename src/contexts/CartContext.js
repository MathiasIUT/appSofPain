import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

/**
 * Contexte du panier.
 *
 * Fournit un panier accessible depuis n'importe quel écran de l'app.
 * Le panier est stocké en mémoire uniquement (si le client relance l'app, il perd son panier).
 * Plus tard, on pourra persister dans AsyncStorage si besoin.
 *
 * Structure d'un item du panier :
 *   {
 *     product: { id, nom, prix_palette_ht, tva_pourcent, image_url, ... },
 *     quantite_palettes: number
 *   }
 */

const CartContext = createContext(null);

export function CartProvider({ children }) {
  // Liste des articles dans le panier
  // Clé = product.id pour éviter les doublons
  const [items, setItems] = useState([]);

  // Ajouter un produit au panier (ou incrémenter si déjà présent)
  const addToCart = useCallback((product, quantite = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantite_palettes: i.quantite_palettes + quantite }
            : i
        );
      }
      return [...prev, { product, quantite_palettes: quantite }];
    });
  }, []);

  // Modifier directement la quantité d'un produit
  const setQuantity = useCallback((productId, quantite) => {
    setItems((prev) => {
      if (quantite <= 0) {
        // Quantité à 0 = on retire du panier
        return prev.filter((i) => i.product.id !== productId);
      }
      return prev.map((i) =>
        i.product.id === productId ? { ...i, quantite_palettes: quantite } : i
      );
    });
  }, []);

  // Retirer un produit du panier
  const removeFromCart = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  // Vider entièrement le panier (utile après validation de commande)
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // Totaux calculés à la volée
  const totals = useMemo(() => {
    let totalHt = 0;
    let totalTva = 0;

    items.forEach((item) => {
      const ligneHt = Number(item.product.prix_palette_ht) * item.quantite_palettes;
      const ligneTva = ligneHt * (Number(item.product.tva_pourcent) / 100);
      totalHt += ligneHt;
      totalTva += ligneTva;
    });

    return {
      totalHt: Math.round(totalHt * 100) / 100,
      totalTva: Math.round(totalTva * 100) / 100,
      totalTtc: Math.round((totalHt + totalTva) * 100) / 100,
      nbArticles: items.reduce((acc, i) => acc + i.quantite_palettes, 0),
      nbProduitsDistincts: items.length,
    };
  }, [items]);

  const value = {
    items,
    addToCart,
    setQuantity,
    removeFromCart,
    clearCart,
    totals,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Hook pour utiliser le panier dans un composant.
 *
 * Usage :
 *   const { items, addToCart, totals } = useCart();
 */
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé à l\'intérieur d\'un CartProvider');
  }
  return context;
}