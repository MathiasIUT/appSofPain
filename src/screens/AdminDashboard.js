import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AdminLayout from '../components/AdminLayout';
import AdminProductsScreen from './AdminProductsScreen';
import { colors, spacing, fontSizes } from '../config/theme';

/**
 * Écran principal admin.
 * Affiche la section active selon la navigation interne (sidebar/tabs).
 */
export default function AdminDashboard({ navigation }) {
  const [currentSection, setCurrentSection] = useState('products');

  // Rendu de la section active
  const renderSection = () => {
    switch (currentSection) {
      case 'products':
        return <AdminProductsScreen />;
      case 'orders':
      case 'clients':
      case 'stats':
        return <ComingSoon section={currentSection} />;
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

// Placeholder pour les sections pas encore développées
function ComingSoon({ section }) {
  const labels = {
    orders: 'Gestion des commandes',
    clients: 'Gestion des clients',
    stats: 'Statistiques',
  };

  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonIcon}>🚧</Text>
      <Text style={styles.comingSoonTitle}>{labels[section] || 'Section'}</Text>
      <Text style={styles.comingSoonText}>Cette section sera disponible prochainement.</Text>
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
  comingSoonIcon: {
    fontSize: 80,
    marginBottom: spacing.lg,
  },
  comingSoonTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  comingSoonText: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});