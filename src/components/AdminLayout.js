import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius } from '../config/theme';

/**
 * Layout commun pour tous les écrans admin.
 * - Desktop : sidebar à gauche avec les sections
 * - Mobile : onglets en bas
 *
 * Props :
 *   - children : le contenu de l'écran actif
 *   - currentSection (string) : clé de la section active
 *   - onNavigate (function) : callback pour changer de section
 *   - navigation : prop de react-navigation (pour logout)
 */

// Liste des sections du panneau admin
// Pour ajouter une section plus tard, il suffira d'ajouter un objet ici
const SECTIONS = [
  { key: 'products', label: 'Produits', icon: '🥖' },
  { key: 'orders', label: 'Commandes', icon: '📦', disabled: true, badge: 'Bientôt' },
  { key: 'clients', label: 'Clients', icon: '👥', disabled: true, badge: 'Bientôt' },
  { key: 'stats', label: 'Statistiques', icon: '📊', disabled: true, badge: 'Bientôt' },
];

export default function AdminLayout({
  children,
  currentSection,
  onNavigate,
  navigation,
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Déconnexion
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  // Rendu d'un item de navigation (utilisé pour sidebar et tabs)
  const renderNavItem = (section) => {
    const isActive = currentSection === section.key;
    const isDisabled = section.disabled;

    return (
      <TouchableOpacity
        key={section.key}
        style={[
          isDesktop ? styles.sidebarItem : styles.tabItem,
          isActive && (isDesktop ? styles.sidebarItemActive : styles.tabItemActive),
          isDisabled && styles.disabled,
        ]}
        onPress={() => !isDisabled && onNavigate(section.key)}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        <Text style={isDesktop ? styles.sidebarIcon : styles.tabIcon}>
          {section.icon}
        </Text>
        <Text
          style={[
            isDesktop ? styles.sidebarLabel : styles.tabLabel,
            isActive && (isDesktop ? styles.sidebarLabelActive : styles.tabLabelActive),
          ]}
        >
          {section.label}
        </Text>
        {section.badge && isDesktop && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{section.badge}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        {/* SIDEBAR (desktop) */}
        {isDesktop && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.logo}>🥖</Text>
              <Text style={styles.brandName}>Sof Pain</Text>
              <Text style={styles.brandRole}>Espace Admin</Text>
            </View>

            <View style={styles.sidebarNav}>
              {SECTIONS.map(renderNavItem)}
            </View>

            <View style={styles.sidebarFooter}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutIcon}>🚪</Text>
                <Text style={styles.logoutText}>Déconnexion</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CONTENU PRINCIPAL */}
        <View style={styles.content}>
          {/* Header mobile */}
          {!isDesktop && (
            <View style={styles.mobileHeader}>
              <Text style={styles.mobileHeaderLogo}>🥖</Text>
              <Text style={styles.mobileHeaderTitle}>Sof Pain Admin</Text>
              <TouchableOpacity onPress={handleLogout} style={styles.mobileLogout}>
                <Text style={styles.mobileLogoutIcon}>🚪</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Enfant (écran actif) */}
          <View style={styles.childrenContainer}>{children}</View>

          {/* TABS (mobile) */}
          {!isDesktop && (
            <View style={styles.tabBar}>
              {SECTIONS.map(renderNavItem)}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  layout: {
    flex: 1,
    flexDirection: 'column',
  },
  layoutDesktop: {
    flexDirection: 'row',
  },

  // --- SIDEBAR (desktop) ---
  sidebar: {
    width: 260,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
  },
  sidebarHeader: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  logo: {
    fontSize: 40,
    marginBottom: spacing.xs,
  },
  brandName: {
    fontSize: fontSizes.xl,
    fontWeight: 'bold',
    color: colors.primary,
  },
  brandRole: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  sidebarNav: {
    flex: 1,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  sidebarItemActive: {
    backgroundColor: colors.secondary,
  },
  sidebarIcon: {
    fontSize: fontSizes.lg,
    marginRight: spacing.md,
  },
  sidebarLabel: {
    fontSize: fontSizes.md,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  sidebarLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.accent,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
  },
  badgeText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  sidebarFooter: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  logoutIcon: {
    fontSize: fontSizes.lg,
    marginRight: spacing.md,
  },
  logoutText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // --- CONTENU ---
  content: {
    flex: 1,
  },
  childrenContainer: {
    flex: 1,
  },

  // --- HEADER MOBILE ---
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mobileHeaderLogo: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  mobileHeaderTitle: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.primary,
  },
  mobileLogout: {
    padding: spacing.xs,
  },
  mobileLogoutIcon: {
    fontSize: 20,
  },

  // --- TABS (mobile) ---
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  tabItemActive: {
    // rien de spécial, on change juste la couleur du texte/icône
  },
  tabIcon: {
    fontSize: fontSizes.xl,
    marginBottom: spacing.xs,
  },
  tabLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
});