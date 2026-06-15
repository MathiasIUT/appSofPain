import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes, borderRadius, shadows } from '../config/theme';


const SECTIONS = [
  { key: 'products', label: 'Produits' },
  { key: 'orders', label: 'Commandes' },
  { key: 'clients', label: 'Clients' },
  { key: 'logistique', label: 'Logistique' },
  { key: 'compta_frais', label: 'ComptabilitÃ© Frais' },
  { key: 'compta_surgele', label: 'ComptabilitÃ© SurgelÃ©' },
];

export default function AdminLayout({
  children,
  currentSection,
  onNavigate,
  navigation,
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

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
              <Image
                source={require('../../assets/logo1.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.brandRole}>Espace Administrateur</Text>
            </View>

            <View style={styles.sidebarNav}>
              {SECTIONS.map(renderNavItem)}
            </View>

            <View style={styles.sidebarFooter}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>DÃ©connexion</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* CONTENU PRINCIPAL */}
        <View style={styles.content}>
          {/* Header mobile */}
          {!isDesktop && (
            <View style={styles.mobileHeader}>
              <Image
                source={require('../../assets/logo1.png')}
                style={styles.mobileLogo}
                resizeMode="contain"
              />
              <TouchableOpacity onPress={handleLogout} style={styles.mobileLogout}>
                <Text style={styles.mobileLogoutText}>DÃ©connexion</Text>
              </TouchableOpacity>
            </View>
          )}

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
  sidebar: {
    width: 300,
    backgroundColor: colors.sidebarBg,
    borderRightWidth: 0,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
    ...shadows.md,
  },
  sidebarHeader: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,217,196,0.15)',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 250,
    height: 250,
    marginBottom: spacing.sm,
  },
  brandRole: {
    fontSize: fontSizes.xs,
    color: colors.sidebarMuted,
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    backgroundColor: colors.sidebarActive,
  },
  sidebarLabel: {
    fontSize: fontSizes.md,
    color: colors.sidebarText,
    fontWeight: '500',
    flex: 1,
  },
  sidebarLabelActive: {
    color: colors.white,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: 'rgba(240,217,196,0.15)',
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
  },
  badgeText: {
    fontSize: 10,
    color: colors.sidebarText,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.35,
  },
  sidebarFooter: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(240,217,196,0.2)',
  },
  logoutButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  logoutText: {
    fontSize: fontSizes.md,
    color: colors.sidebarMuted,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  childrenContainer: {
    flex: 1,
  },
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.sidebarBg,
    borderBottomWidth: 0,
  },
  mobileLogo: {
    width: 56,
    height: 56,
  },
  mobileLogout: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  mobileLogoutText: {
    fontSize: fontSizes.sm,
    color: colors.sidebarText,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.sidebarBg,
    borderTopWidth: 0,
    paddingVertical: spacing.xs,
  },
  tabItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryLight,
  },
  tabLabel: {
    fontSize: 11,
    color: colors.sidebarText,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
});