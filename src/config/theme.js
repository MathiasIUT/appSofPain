// ─── Palette extraite du logo Sof Pain ───────────────────────────────────────
// Or chaud  #C4924A  — couleur de "PAIN" dans le logo
// Espresso  #1A0A04  — couleur de "SOF" et des détails fins
// Crème     #F6EFE4  — fond chaud neutre

export const colors = {
  // ── Couleurs de marque ─────────────────────────────
  primary:       '#C4924A',          // or chaud — boutons, accents
  primaryDark:   '#A67A38',          // or foncé — états actifs
  primaryLight:  '#D9AE72',          // or clair — highlights
  primaryGhost:  'rgba(196,146,74,0.10)',

  // ── Surfaces ───────────────────────────────────────
  background:    '#FAF8F4',          // blanc crème très doux
  surface:       '#FFFFFF',
  secondary:     '#F6EFE4',          // crème chaude — zones de mise en valeur

  // ── Sidebar admin (espresso du logo) ───────────────
  sidebarBg:     '#1A0A04',          // espresso — "SOF"
  sidebarText:   '#EDD9B4',          // or pâle
  sidebarActive: '#C4924A',          // or primary actif
  sidebarMuted:  'rgba(237,217,180,0.40)',

  // ── Texte ──────────────────────────────────────────
  textPrimary:   '#1A0A04',          // espresso — lecture principale
  textSecondary: '#5C3A1E',          // brun moyen
  textLight:     '#9A7350',          // brun clair / placeholder
  textOnPrimary: '#FFFFFF',

  // ── Bordures ───────────────────────────────────────
  border:        '#E8D8C4',
  borderFocus:   '#C4924A',
  borderStrong:  '#BFA080',

  // ── États sémantiques ──────────────────────────────
  success:      '#276228',
  successLight: '#E8F5E9',
  error:        '#B71C1C',
  errorLight:   '#FFEBEE',
  warning:      '#D84315',
  warningLight: '#FFF3E0',
  info:         '#1055A0',
  infoLight:    '#E3F2FD',

  // ── Misc ───────────────────────────────────────────
  white:  '#FFFFFF',
  black:  '#000000',
  accent: '#D9AE72',
};

export const shadows = {
  sm: {
    shadowColor: '#1A0A04',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#1A0A04',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1A0A04',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 24,
    elevation: 8,
  },
};

// Espacement généreux pour que l'interface respire
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  40,
  xxl: 64,
};

// Typographie lisible — pas de taille en dessous de 14
export const fontSizes = {
  xs:    14,
  sm:    16,
  md:    18,
  lg:    22,
  xl:    28,
  xxl:   36,
  title: 44,
};

export const borderRadius = {
  sm:    8,
  md:    12,
  lg:    16,
  xl:    24,
  round: 999,
};
