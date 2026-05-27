import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [cartType, setCartType] = useState(null); // 'frais' | 'surgele' | null

  const addToCart = useCallback((product, quantite = 1) => {
    const productType = product.category?.slug === 'surgele' ? 'surgele' : 'frais';

    setItems((prev) => {
      // Vérification du type de panier si le panier n'est pas vide
      if (prev.length > 0 && cartType && cartType !== productType) {
        // Cette erreur sera gérée dans le composant appelant pour afficher une alerte
        throw new Error(`MIX_TYPE:${cartType}`);
      }

      const existing = prev.find((i) => i.product.id === product.id);
      let newItems;
      if (existing) {
        newItems = prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantite: i.quantite + quantite }
            : i
        );
      } else {
        newItems = [...prev, { product, quantite: quantite }];
      }

      // Mettre à jour le type si c'est le premier article
      if (prev.length === 0) {
        setCartType(productType);
      }

      return newItems;
    });
  }, [cartType]);

  const setQuantity = useCallback((productId, quantite) => {
    setItems((prev) => {
      let newItems;
      if (quantite <= 0) {
        // Quantité à 0 = on retire du panier
        newItems = prev.filter((i) => i.product.id !== productId);
      } else {
        newItems = prev.map((i) =>
          i.product.id === productId ? { ...i, quantite: quantite } : i
        );
      }

      // Si le panier se vide, on réinitialise le type
      if (newItems.length === 0) {
        setCartType(null);
      }

      return newItems;
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => {
      const newItems = prev.filter((i) => i.product.id !== productId);
      if (newItems.length === 0) {
        setCartType(null);
      }
      return newItems;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setEditingOrder(null);
    setCartType(null);
  }, []);

  const loadOrderIntoCart = useCallback((order, orderItems) => {
    setEditingOrder(order);
    setCartType(order.type_commande || 'frais');
    const loadedItems = orderItems.map(oi => ({
      product: {
        id: oi.product_id,
        nom: oi.product_nom,
        prix_unitaire_ht: oi.prix_unitaire_ht,
        tva_pourcent: oi.tva_pourcent,
        increment: oi.increment || 10,
        image_url: oi.products?.image_url || null,
        category: { slug: order.type_commande || 'frais' },
      },
      quantite: oi.quantite
    }));
    setItems(loadedItems);
  }, []);

  const reorderIntoCart = useCallback((orderItems, type_commande) => {
    setEditingOrder(null);
    setCartType(type_commande || 'frais');
    const loadedItems = orderItems.map(oi => ({
      product: {
        id: oi.product_id,
        nom: oi.product_nom,
        prix_unitaire_ht: oi.prix_unitaire_ht,
        tva_pourcent: oi.tva_pourcent,
        increment: oi.increment || 10,
        image_url: oi.products?.image_url || null,
        category: { slug: type_commande || 'frais' },
      },
      quantite: oi.quantite
    }));
    setItems(loadedItems);
  }, []);

  const totals = useMemo(() => {
    let totalHt = 0;
    let totalTva = 0;

    items.forEach((item) => {
      const prixUnitaire = Number(item.product.prix_unitaire_ht || 0);
      const ligneHt = prixUnitaire * item.quantite;
      const ligneTva = ligneHt * (Number(item.product.tva_pourcent) / 100);
      totalHt += ligneHt;
      totalTva += ligneTva;
    });

    return {
      totalHt: Math.round(totalHt * 100) / 100,
      totalTva: Math.round(totalTva * 100) / 100,
      totalTtc: Math.round((totalHt + totalTva) * 100) / 100,
      nbArticles: items.reduce((acc, i) => acc + i.quantite, 0),
      nbProduitsDistincts: items.length,
    };
  }, [items]);

  const value = useMemo(() => ({
    items,
    editingOrder,
    cartType,
    addToCart,
    setQuantity,
    removeFromCart,
    clearCart,
    loadOrderIntoCart,
    reorderIntoCart,
    totals,
  }), [items, editingOrder, cartType, addToCart, setQuantity, removeFromCart, clearCart, loadOrderIntoCart, reorderIntoCart, totals]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé à l\'intérieur d\'un CartProvider');
  }
  return context;
}