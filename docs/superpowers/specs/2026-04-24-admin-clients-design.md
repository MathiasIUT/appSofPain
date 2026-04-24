# Admin Clients Screen — Design Spec
Date: 2026-04-24

## Objectif

Implémenter la section "Clients" du dashboard admin de SofPain. L'admin peut consulter la liste des clients inscrits, modifier leurs coordonnées, activer/désactiver leurs comptes, et consulter leur historique de commandes.

## Architecture

Un seul fichier `src/screens/AdminClientsScreen.js`, structuré de la même façon qu'`AdminOrdersScreen.js` : liste + modal inline. Pas de nouveau composant externe. Un fichier SQL de migration `sql/07_profiles_actif.sql` ajoute la colonne `actif` à `profiles`.

## Migration SQL

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS actif boolean NOT NULL DEFAULT true;
```

Tous les comptes existants restent actifs. Aucune modification des RLS.

## Liste des clients

- Données affichées par ligne : nom société (ou Prénom Nom), email, téléphone, ville, badge Actif/Inactif
- Barre de recherche (filtre local sur nom/société/email)
- Filtre rapide : Tous / Actifs / Inactifs (même pattern que les chips de statut dans AdminOrdersScreen)
- Tri par défaut : date d'inscription descendante
- Chargement depuis `profiles` où `role = 'client'`

## Modal détail client

### Section 1 — Informations éditables
Champs : nom, prénom, nom_societe, email, telephone, adresse, code_postal, ville, siret.
Bouton "Enregistrer" visible uniquement si des changements sont détectés (comparaison avec les valeurs initiales).
Mise à jour via `supabase.from('profiles').update(...)`.

### Section 2 — Statut du compte
Toggle Actif/Inactif avec bouton dédié ("Désactiver le compte" / "Réactiver le compte").
Confirmation avant désactivation (window.alert sur web, Alert.alert sur mobile).
Mise à jour du champ `profiles.actif`.

### Section 3 — Historique des commandes
Liste read-only des commandes du client : numéro, date, total TTC, badge statut.
Chargement depuis `orders` où `client_id = client.id`, tri par date descendante.
Lecture seule — pas d'action possible depuis ce modal.

## Vérification actif au login

Dans `LoginScreen.js`, après `supabase.auth.signInWithPassword(...)` réussi :
- Récupérer `profiles.actif` pour l'utilisateur connecté
- Si `actif = false` : appeler `supabase.auth.signOut()` et afficher un message "Votre compte a été désactivé. Contactez l'administrateur."

## Intégration AdminDashboard

Remplacer le `case 'clients'` dans `AdminDashboard.js` (actuellement `<ComingSoon />`) par `<AdminClientsScreen />`. Ajouter l'import correspondant.

## Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `sql/07_profiles_actif.sql` | Créer — migration colonne actif |
| `src/screens/AdminClientsScreen.js` | Créer — écran complet |
| `src/screens/AdminDashboard.js` | Modifier — brancher AdminClientsScreen |
| `src/screens/LoginScreen.js` | Modifier — vérification actif post-login |

## Contraintes

- Suivre exactement les patterns visuels et de code d'AdminOrdersScreen (styles, structure, nommage)
- Responsive : même logique `isDesktop = width >= 900`
- Pas de dépendances supplémentaires
