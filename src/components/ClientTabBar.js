import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { colors, spacing, fontSizes } from '../config/theme';
import { supabase } from '../config/supabase';

export default function ClientTabBar({ navigation, currentRoute }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  
  if (isDesktop) return null;
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };
  
  return (
    <View style={styles.tabBar}>
      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => currentRoute !== 'ClientHome' && navigation.navigate('ClientHome')}
      >
        <Text style={[styles.tabLabel, currentRoute === 'ClientHome' && styles.tabLabelActive]}>Accueil</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => currentRoute !== 'MyOrders' && navigation.navigate('MyOrders')}
      >
        <Text style={[styles.tabLabel, currentRoute === 'MyOrders' && styles.tabLabelActive]}>Commandes</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={() => currentRoute !== 'ClientProfile' && navigation.navigate('ClientProfile')}
      >
        <Text style={[styles.tabLabel, currentRoute === 'ClientProfile' && styles.tabLabelActive]}>Profil</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.tabItem} 
        onPress={handleLogout}
      >
        <Text style={styles.tabLabel}>Déconnexion</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs,
    paddingBottom: Platform.OS === 'ios' ? 20 : spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  tabLabel: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  }
});
