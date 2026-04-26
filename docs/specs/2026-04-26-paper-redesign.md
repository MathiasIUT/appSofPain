# React Native Paper Redesign — SofPain

**Date:** 2026-04-26
**Status:** Approved
**Design language:** Material Design 2 via `react-native-paper`

---

## Goal

Replace every custom UI component with React Native Paper equivalents. Keep 100% of existing features, Supabase logic, navigation, auth, PDF export, and security. Change only the visual layer.

Brand colors preserved: warm gold `#C4924A`, espresso `#1A0A04`, cream `#FAF8F4`.

---

## 1. Dependency

Add `react-native-paper` to the project. No other new dependency.

---

## 2. Paper Theme (`src/config/paperTheme.js`)

New file exporting a MD2 `DefaultTheme` override:

```
colors:
  primary:      #C4924A   ← gold — buttons, active states, focus rings
  accent:       #1A0A04   ← espresso — secondary accents
  background:   #FAF8F4   ← cream — screen background
  surface:      #FFFFFF   ← white — cards, inputs
  text:         #1A0A04   ← espresso — body text
  placeholder:  #9A7350   ← muted gold-brown
  error:        #B71C1C
  notification: #C4924A   ← badge color
```

---

## 3. App Root (`App.js`)

Wrap with `PaperProvider theme={paperTheme}` inside `SafeAreaProvider`, outside `CartProvider`.

---

## 4. Component Changes

### 4.1 Deleted custom components
These are replaced by direct Paper imports in screens — no wrapper needed:

| Deleted file | Paper replacement |
|---|---|
| `Button.js` | `<Button>` from paper (mode: contained / outlined / text) |
| `Card.js` | `<Card>` + `<Card.Content>` from paper |
| `SearchBar.js` | `<Searchbar>` from paper |
| `Badge.js` | `<Chip>` from paper (compact) |
| `StatusTag.js` | `<Chip>` from paper with status color map |
| `Divider.js` | `<Divider>` from paper |
| `Typography.js` | `<Text>` from paper (variant prop) |
| `PageHeader.js` | `<Appbar.Header>` + `<Appbar.Content>` from paper |
| `SectionHeader.js` | `<Text variant="titleMedium">` + inline Button |
| `DataRow.js` | `<DataTable.Row>` or inline Text pairs |

### 4.2 Kept & updated

- **`Input.js`** → replaced internally with `<TextInput>` from paper (mode="flat"), same external props
- **`ScreenLayout.js`** → kept as-is (SafeAreaView + ScrollView wrapper)
- **`QuantityInput.js`** → kept as-is (no Paper equivalent), uses paper Button internally for ±
- **`EmptyState.js`** → kept, uses paper Text + Button internally
- **`BrandHeader.js`** → kept as-is (logo image, no component dependency)
- **`AdminLayout.js`** → kept custom (dark espresso sidebar, no Paper equivalent for web sidebar)

---

## 5. Screen-by-Screen Changes

### Client screens

#### `LoginScreen`
- `TextInput` (paper, flat) for email + password
- `Button` (paper, contained, gold) for "Se connecter"
- `Text` (paper) for title, subtitle, footer link

#### `RegisterScreen`
- Same treatment as LoginScreen

#### `ConfirmEmailScreen`
- `Text` (paper) for title + message
- `Button` (paper, outlined) for any action

#### `ClientHome`
- `Searchbar` (paper) pinned below header
- `Card` + `Card.Content` + `Card.Cover` for product cards
- `Button` (paper, contained) for cart action bar
- `Badge` (paper) on cart icon for item count
- `Text` (paper) for product names, prices, descriptions
- `QuantityInput` kept (custom stepper)
- Cart bottom bar: dark espresso surface, gold contained Button

#### `CartScreen`
- `Appbar.Header` + `Appbar.BackAction` + `Appbar.Content` for header
- Each item: `Card` + `Card.Content` with `QuantityInput` + `Text`
- "Vider le panier": `Button` mode="text"
- Bottom summary: `Card` with total `Text` + contained gold `Button`

#### `CheckoutScreen`
- `Appbar.Header` for navigation
- Summary in `Card` + `Card.Content` with `Divider` between rows
- Date picker stays (no change)
- `Button` (contained, fullWidth) to confirm

#### `OrderConfirmationScreen`
- Centered layout with large `Text` (headline), `Text` (subtitle)
- Two `Button`s: contained (primary) + outlined (secondary)

#### `MyOrdersScreen`
- `Appbar.Header` or plain `Text` title
- Each order: `Card` + `Card.Content` with `Chip` status + `Text` for date/total
- `EmptyState` when empty

#### `OrderDetailScreen`
- `Appbar.Header` with back action
- `Chip` for status at top
- `Card` sections with `Divider`-separated `DataTable` rows
- PDF button: `Button` mode="outlined" with icon

### Admin screens

#### `AdminLayout`
- Sidebar stays custom (espresso bg, gold active state, no Paper equivalent)
- Uses Paper `Text` for nav labels inside

#### `AdminProductsScreen`
- `Searchbar` (paper) for filtering
- `Chip`s for category filter tabs
- `DataTable` with `DataTable.Header` / `DataTable.Row` / `DataTable.Cell`
- `Button` (paper, contained, sm) for "+ Ajouter"
- `IconButton` for edit/delete actions
- `Chip` compact for actif/inactif status

#### `AdminOrdersScreen`
- `Chip`s for status filter tabs
- `DataTable` for order list
- `Chip` for status in each row

#### `AdminClientsScreen`
- `DataTable` for client list
- `Chip` for actif/inactif
- `IconButton` for edit action

#### `AdminStatsScreen`
- `Card` + `Card.Content` for stat blocks
- Large `Text` (headline, gold color) for numbers
- Charts and period selector stay as-is

---

## 6. Constraints

- Zero feature changes — all Supabase queries, auth checks, navigation, PDF export untouched
- `ProductFormModal` not in scope (complex modal, separate pass)
- React Native + Expo + Web compatible
- `Platform.select({ web: { cursor: 'pointer' } })` kept where needed

---

## 7. Files Summary

**New:**
- `src/config/paperTheme.js`

**Modified:**
- `App.js` — add PaperProvider
- `src/config/theme.js` — no changes (Paper theme reads from same color values)
- `src/components/Input.js` — use Paper TextInput internally
- `src/components/QuantityInput.js` — use Paper Button for ± buttons
- `src/components/EmptyState.js` — use Paper Text + Button
- `src/components/AdminLayout.js` — use Paper Text for nav labels
- All screens — swap custom components for Paper imports

**Deleted:**
- `src/components/Button.js`
- `src/components/Card.js`
- `src/components/SearchBar.js`
- `src/components/Badge.js`
- `src/components/StatusTag.js`
- `src/components/Divider.js`
- `src/components/Typography.js`
- `src/components/PageHeader.js`
- `src/components/SectionHeader.js`
- `src/components/DataRow.js`
