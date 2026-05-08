import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AdminLayout from '../components/AdminLayout';
import AdminProductsScreen from './AdminProductsScreen';
import AdminOrdersScreen from './AdminOrdersScreen';
import AdminClientsScreen from './AdminClientsScreen';
import AdminLogistiqueScreen from './AdminLogistiqueScreen';
import AdminComptaScreen from './AdminComptaScreen';
import { supabase } from '../config/supabase';
import { colors, spacing, fontSizes } from '../config/theme';

export default function AdminDashboard({ navigation }) {
  const [currentSection, setCurrentSection] = useState('products');

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (data?.role !== 'admin') {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    });
  }, []);

  const renderSection = () => {
    switch (currentSection) {
      case 'products':
        return <AdminProductsScreen />;
      case 'orders':
        return <AdminOrdersScreen />;
      case 'clients':
        return <AdminClientsScreen />;
      case 'logistique':
        return <AdminLogistiqueScreen />;
      case 'compta':
        return <AdminComptaScreen />;
      default:
        return <AdminProductsScreen />;
    }
  };

  return (
    <AdminLayout
      currentSection={currentSection}
      onNavigate={setCurrentSection}
      navigation={navigation}
    >
      {renderSection()}
    </AdminLayout>
  );
}

function ComingSoon({ section }) {
  const labels = {
    orders: 'Gestion des commandes',
    clients: 'Gestion des clients',
    stats: 'Statistiques',
  };

  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonTitle}>{labels[section] || 'Section'}</Text>
      <Text style={styles.comingSoonText}>
        Cette fonctionnalité sera disponible dans une prochaine version.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  comingSoon: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  comingSoonTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  comingSoonText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 400,
  },
});