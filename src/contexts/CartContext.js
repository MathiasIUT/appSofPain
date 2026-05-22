import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);

  const addToCart = useCallback((product, quantite = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantite: i.quantite + quantite }
            : i
        );
      }
      return [...prev, { product, quantite: quantite }];
    });
  }, []);

  const setQuantity = useCallback((productId, quantite) => {
    setItems((prev) => {
      if (quantite <= 0) {
        // Quantité à 0 = on retire du panier
        return prev.filter((i) => i.product.id !== productId);
      }
      return prev.map((i) =>
        i.product.id === productId ? { ...i, quantite: quantite } : i
      );
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setEditingOrder(null);
  }, []);

  const loadOrderIntoCart = useCallback((order, orderItems) => {
    setEditingOrder(order);
    const loadedItems = orderItems.map(oi => ({
      product: {
        id: oi.product_id,
        nom: oi.product_nom,
        prix_unitaire_ht: oi.prix_unitaire_ht,
        tva_pourcent: oi.tva_pourcent,
        increment: oi.increment || 10,
      },
      quantite: oi.quantite
    }));
    setItems(loadedItems);
  }, []);

  const reorderIntoCart = useCallback((orderItems) => {
    setEditingOrder(null);
    const loadedItems = orderItems.map(oi => ({
      product: {
        id: oi.product_id,
        nom: oi.product_nom,
        prix_unitaire_ht: oi.prix_unitaire_ht,
        tva_pourcent: oi.tva_pourcent,
        increment: oi.increment || 10,
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
    addToCart,
    setQuantity,
    removeFromCart,
    clearCart,
    loadOrderIntoCart,
    reorderIntoCart,
    totals,
  }), [items, editingOrder, addToCart, setQuantity, removeFromCart, clearCart, loadOrderIntoCart, reorderIntoCart, totals]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé à l\'intérieur d\'un CartProvider');
  }
  return context;
}