import React, { Suspense, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../config/theme';
import { supabase } from '../config/supabase';

const LoginScreen             = React.lazy(() => import('../screens/LoginScreen'));
const ForgotPasswordScreen    = React.lazy(() => import('../screens/ForgotPasswordScreen'));
const ResetPasswordScreen     = React.lazy(() => import('../screens/ResetPasswordScreen'));
const AdminDashboard          = React.lazy(() => import('../screens/AdminDashboard'));
const ClientHome              = React.lazy(() => import('../screens/ClientHome'));
const CartScreen              = React.lazy(() => import('../screens/CartScreen'));
const CheckoutScreen          = React.lazy(() => import('../screens/CheckoutScreen'));
const OrderConfirmationScreen = React.lazy(() => import('../screens/OrderConfirmationScreen'));
const MyOrdersScreen          = React.lazy(() => import('../screens/MyOrdersScreen'));
const OrderDetailScreen       = React.lazy(() => import('../screens/OrderDetailScreen'));
const ClientProfileScreen     = React.lazy(() => import('../screens/ClientProfileScreen'));

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

const Fallback = () => (
  <View style={styles.fallbackContainer}>
    <ActivityIndicator size="large" color={colors?.primary || '#E85D04'} />
  </View>
);

const withSuspense = (Component) => (props) => (
  <Suspense fallback={<Fallback />}>
    <Component {...props} />
  </Suspense>
);

export default function AppNavigator() {
  useEffect(() => {
    // Quand Supabase détecte un lien de réinitialisation dans l'URL (web),
    // l'événement PASSWORD_RECOVERY est déclenché → on redirige vers ResetPassword.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (navigationRef.isReady()) {
          navigationRef.reset({ index: 0, routes: [{ name: 'ResetPassword' }] });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {/* Authentification */}
        <Stack.Screen name="Login"           component={withSuspense(LoginScreen)} />
        <Stack.Screen name="ForgotPassword"  component={withSuspense(ForgotPasswordScreen)} />
        <Stack.Screen name="ResetPassword"   component={withSuspense(ResetPasswordScreen)} />

        {/* Admin */}
        <Stack.Screen name="AdminDashboard"  component={withSuspense(AdminDashboard)} />

        {/* Client */}
        <Stack.Screen name="ClientHome"         component={withSuspense(ClientHome)} />
        <Stack.Screen name="Cart"               component={withSuspense(CartScreen)} />
        <Stack.Screen name="Checkout"           component={withSuspense(CheckoutScreen)} />
        <Stack.Screen name="OrderConfirmation"  component={withSuspense(OrderConfirmationScreen)} />
        <Stack.Screen name="MyOrders"           component={withSuspense(MyOrdersScreen)} />
        <Stack.Screen name="OrderDetail"        component={withSuspense(OrderDetailScreen)} />
        <Stack.Screen name="ClientProfile"      component={withSuspense(ClientProfileScreen)} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
});
