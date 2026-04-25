# Visual Refresh — SofPain Design System

**Date:** 2026-04-25
**Status:** Approved
**Approach:** Option B — Full component system + screen rebuild

---

## Goal

Replace all inline `StyleSheet` usage across every screen with a shared component kit, Bootstrap-style. Keep 100% of existing features, Supabase logic, navigation, auth guards, PDF export, and security. Change only the visual layer.

Brand colors are preserved exactly: warm gold `#C4924A`, espresso `#1A0A04`, cream `#F6EFE4`.

---

## 1. Theme Enhancements (`src/config/theme.js`)

Add a `typography` map to the existing theme. All other tokens (colors, spacing, shadows, borderRadius) stay unchanged.

```
typography = {
  display:    { fontSize: 44, fontWeight: '800', lineHeight: 52, letterSpacing: -0.5 },
  h1:         { fontSize: 36, fontWeight: '800', lineHeight: 44 },
  h2:         { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  h3:         { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  h4:         { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  bodyLg:     { fontSize: 18, fontWeight: '400', lineHeight: 28 },
  body:       { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  caption:    { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label:      { fontSize: 13, fontWeight: '700', lineHeight: 18, letterSpacing: 0.6, textTransform: 'uppercase' },
  price:      { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  priceSmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
}
```

---

## 2. Component Kit (`src/components/`)

### 2.1 Keep & improve existing
- **`Button`** — add `size="xs"` variant; rename `icon` prop to `leftIcon` for clarity; keep all variants (primary, secondary, danger, ghost)
- **`Input`** — already solid, no changes needed

### 2.2 New components

#### `Typography`
```
<Typography variant="h2" color="textPrimary" style={...}>Text</Typography>
```
Reads from `theme.typography`. Default color is `textPrimary`. Accepts `color` as a key from `theme.colors` or a raw hex.

#### `Card`
White surface (`colors.surface`) with `borderRadius.lg`, `border` color border, and `shadows.sm`. Accepts `style` override and `padded` boolean (default true, adds `spacing.md` padding).

#### `ScreenLayout`
Wraps `SafeAreaView` + optional `ScrollView` with consistent `paddingHorizontal: spacing.lg` and `paddingBottom: spacing.xxl`. Props: `scroll` (boolean, default true), `style`, `contentStyle`. For screens with a fixed header outside the scroll zone (ClientHome, CartScreen), the header is rendered as a direct child of `ScreenLayout` before the scroll area — `ScreenLayout` exposes a `header` prop slot for this.

#### `PageHeader`
Displays screen title (h2) + optional subtitle (body, textSecondary). Used at the top of every client screen content area. Props: `title`, `subtitle`, `onBack` (optional — renders a ← back arrow button when provided, used in CartScreen, CheckoutScreen, OrderDetailScreen).

#### `SectionHeader`
Section title (h4, textPrimary) + optional right-side action button (ghost variant). Used inside admin screens above tables/lists.

#### `Badge`
Pill chip. Props: `label`, `color` (key from colors, e.g. `"success"`, `"error"`, `"primary"`), `size` (sm/md). Renders colored background at 15% opacity + matching text.

#### `StatusTag`
Thin wrapper around `Badge` with hardcoded color map for order statuses:
- `en_attente` → warning
- `confirmee` → info
- `en_preparation` → primary
- `livree` → success
- `annulee` → error

#### `SearchBar`
TextInput with search icon (🔍) on left, clear button (×) on right when value is non-empty. Same border style as `Input`. Props: `value`, `onChangeText`, `placeholder`.

#### `QuantityInput`
The `− [n] +` stepper extracted from `ClientHome`. Props: `value`, `onChange`, `min` (default 0), `max` (default 999), `unit` (e.g. "palette"). When value is 0, renders an "Ajouter" `Button` instead.

#### `EmptyState`
Centered layout with emoji icon slot, title (h3), and subtitle (body). Props: `icon`, `title`, `subtitle`, `action` (optional Button config).

#### `DataRow`
Single row of `label: value` for detail panels. Props: `label`, `value`, `mono` (monospace value, for prices/numbers). Renders label as `caption` variant (textLight) and value as `body` (textPrimary).

#### `Divider`
1px horizontal line using `colors.border`. Accepts `style` for margin overrides.

---

## 3. Screen Rewrites

### Rule
Every screen file must import zero styles from `StyleSheet` for layout/spacing/color. The only `StyleSheet` calls allowed are for truly screen-specific one-off overrides that no shared component covers.

### 3.1 Client Screens (mobile-first)

#### `LoginScreen`
- Use `ScreenLayout scroll` (no ScrollView inline)
- Centered card (maxWidth 440) using `Card`
- `BrandHeader` at top
- `Typography variant="h2"` for "Connexion"
- `Typography variant="body" color="textSecondary"` for subtitle
- Replace inline input/button with `Input` + `Button` components
- Footer link uses `Typography variant="body"`

#### `RegisterScreen`
- Same treatment as LoginScreen
- All fields use `Input` component

#### `ConfirmEmailScreen`
- `ScreenLayout` + centered `Card`
- `EmptyState`-style layout with ✉️ icon, title, message

#### `ClientHome`
- Header: logo (48×48) + user initial avatar circle (espresso bg, gold initial) + cart badge button + "Mes commandes" ghost button + logout link
- `SearchBar` component pinned below header
- `PageHeader` with "Catalogue" + product count subtitle
- `ProductCard` (local component) rebuilt: 180px image, `Card` wrapper, `Typography` for name/desc/meta, `QuantityInput` at bottom
- Products grid: 1 col mobile, 2-3 col desktop
- Cart bottom bar: espresso background (`colors.sidebarBg`), white text for count, gold `Button` "Voir mon panier"

#### `CartScreen`
- `ScreenLayout scroll`
- Back arrow header using `PageHeader` with back prop
- Each cart item: `Card` with product name (h4), `QuantityInput`, unit price (`Typography variant="price"`)
- "Vider le panier" as `Button variant="ghost"` in `SectionHeader`
- Sticky bottom footer: `Card` with totals + `Button variant="primary" fullWidth`

#### `CheckoutScreen`
- `ScreenLayout scroll`
- `PageHeader` "Valider la commande"
- Order summary in `Card` with `DataRow` per line item
- Totals section: `DataRow` for HT / TVA / TTC
- Delivery date picker in `Card`
- `Button variant="primary" fullWidth` at bottom

#### `OrderConfirmationScreen`
- `ScreenLayout`
- Centered `EmptyState` with ✅ icon, "Commande confirmée" title, order number subtitle
- Two buttons: "Voir ma commande" (primary) + "Retour au catalogue" (secondary)

#### `MyOrdersScreen`
- `ScreenLayout scroll`
- `PageHeader` "Mes commandes"
- Each order: `Card` with date, `StatusTag`, total, arrow →
- `EmptyState` when no orders

#### `OrderDetailScreen`
- `ScreenLayout scroll`
- `PageHeader` with order number
- `StatusTag` prominent at top
- `Card` with `DataRow` rows for each order line
- `Card` with `DataRow` for totals (HT / TVA / TTC)
- PDF export button: `Button variant="secondary"` with 📄 icon

### 3.2 Admin Screens (desktop-first)

#### `AdminLayout`
- Sidebar unchanged in structure
- Nav items: add emoji icon prefix (📦 Produits, 📋 Commandes, 👥 Clients, 📊 Statistiques)
- Active item: replace full background fill with a 3px left accent bar (`colors.primary`) + slightly lighter background — more refined
- Logo size reduced to 180×180 (currently 250×250, too large)
- "Espace Administrateur" label: use `Typography variant="label" color="sidebarMuted"`

#### `AdminProductsScreen`
- `SectionHeader` "Produits" with "+ Ajouter un produit" `Button variant="primary" size="sm"`
- Category filter row: `Badge`-style tab buttons
- Product list: table on desktop (columns: image thumb, nom, catégorie, prix HT, TVA, stock, actif, actions), `Card` rows on mobile
- `Badge` for actif/inactif status
- Edit/delete actions: icon buttons (✏️ / 🗑️) using `Button variant="ghost" size="xs"`
- `EmptyState` when no products

#### `AdminOrdersScreen`
- `SectionHeader` "Commandes" with period selector
- Each order row: `Card` (mobile) or table row (desktop) with `StatusTag`, client name, total, date
- Status filter using `Badge` tab buttons
- `EmptyState` when no orders

#### `AdminClientsScreen`
- `SectionHeader` "Clients"
- Each client: `Card` row with name, company, email, `Badge` actif/inactif, edit action
- `EmptyState` when no clients

#### `AdminStatsScreen`
- Stat cards: `Card` with large number (`Typography variant="h1" color="primary"`) + label
- Charts/tables stay as-is (no chart library change)

---

## 4. Constraints

- Zero new external dependencies
- All Supabase queries, auth checks, navigation resets, PDF export — untouched
- All existing features preserved (cart, quantity editing, order confirmation, PDF, admin CRUD)
- React Native + Expo + Web compatible (Platform.select for web cursor: pointer stays)
- `ProductFormModal` not in scope for visual refresh (complex modal, left for a future pass)

---

## 5. File Changes Summary

**Modified:**
- `src/config/theme.js` — add `typography` export

**New components:**
- `src/components/Typography.js`
- `src/components/Card.js`
- `src/components/ScreenLayout.js`
- `src/components/PageHeader.js`
- `src/components/SectionHeader.js`
- `src/components/Badge.js`
- `src/components/StatusTag.js`
- `src/components/SearchBar.js`
- `src/components/QuantityInput.js`
- `src/components/EmptyState.js`
- `src/components/DataRow.js`
- `src/components/Divider.js`

**Rewritten screens:**
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

**Modified components:**
- `src/components/Button.js` — add `size="xs"`, rename `icon` → `leftIcon`
- `src/components/AdminLayout.js` — emoji icons, accent-bar active state, smaller logo
- `src/components/BrandHeader.js` — no change needed
