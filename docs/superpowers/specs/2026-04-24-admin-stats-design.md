# Admin Statistics Screen — Design Spec
Date: 2026-04-24

## Objectif

Implémenter la section "Statistiques" du dashboard admin SofPain. Métriques professionnelles et pertinentes pour un B2B de commande de pain en palette, avec filtrage par période.

## Architecture

Un seul fichier `src/screens/AdminStatsScreen.js`. Zéro dépendance externe — graphiques construits avec des View React Native à hauteur/largeur proportionnelle. Données chargées en deux requêtes Supabase, calculs 100% côté client.

## Filtre de période

Chips : **7 j / 30 j / 90 j / 12 mois / Tout**. Le changement de période filtre les données déjà en mémoire (pas de nouveau fetch). Par défaut : 30 j.

## Données chargées

- **Requête 1 :** `orders` où `date_commande >= debut_periode`, avec join `client:profiles!client_id(nom, prenom, nom_societe)`
- **Requête 2 :** `order_items` pour les IDs des orders de la période (pour les stats produits)
- Les deux requêtes se lancent en parallèle (`Promise.all`)

## Bloc 1 — 4 KPIs (cartes en grille 2×2)

| Métrique | Calcul | Format |
|---|---|---|
| CA TTC | Somme `total_ttc` | `12 450,00 €` |
| Nb commandes | Count orders | `42` |
| Panier moyen | CA TTC ÷ nb commandes | `296,43 €` |
| Clients actifs | Count distinct `client_id` | `8` |

## Bloc 2 — CA mensuel (barres verticales)

Revenus TTC agrégés par mois. Barres View de hauteur proportionnelle à la valeur max (hauteur fixe container : 160px). Label mois abrégé (Jan, Fév…) + montant formaté sous chaque barre. Affiche les N derniers mois couverts par la période sélectionnée (max 12).

## Bloc 3 — Répartition par statut (barres horizontales)

Une ligne par statut : label, barre pleine couleur proportionnelle au count total, compteur. Couleurs identiques à AdminOrdersScreen (nouvelle #2196F3, en_preparation #FF9800, en_livraison #00BCD4, livree #4CAF50, annulee #E53935).

## Bloc 4 — Top 5 produits

Tableau : rang (①②③…), nom produit, palettes commandées, CA HT. Trié par palettes décroissant. Sources : order_items des orders de la période.

## Bloc 5 — Top 5 clients

Tableau : rang, nom société ou Prénom Nom, nb commandes, CA TTC. Trié par CA TTC décroissant.

## Intégration AdminDashboard

Remplacer `case 'stats': return <ComingSoon />` par `<AdminStatsScreen />` et ajouter l'import.
Retirer `disabled: true, badge: 'Bientôt'` sur l'item stats dans `AdminLayout.js`.

## Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `src/screens/AdminStatsScreen.js` | Créer — écran complet |
| `src/screens/AdminDashboard.js` | Modifier — brancher AdminStatsScreen |
| `src/components/AdminLayout.js` | Modifier — activer l'onglet Stats |
