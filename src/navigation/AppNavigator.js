import React, { Suspense, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../config/theme';
import { supabase } from '../config/supabase';

const LoginScreen             = React.lazy(() => import('../screens/LoginScreen'));
const ForgotPasswordScreen    = React.lazy(() => import('../screens/ForgotPasswordScreen'));
const CreatePasswordScreen    = React.lazy(() => import('../screens/CreatePasswordScreen'));
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

const linking = {
  prefixes: ['https://app.sofpain.com', 'sofpain://'],
  config: {
    screens: {
      Login: '',
      ForgotPassword: 'forgot-password',
      CreatePassword: 'create-password',
      ResetPassword: 'reset-password',
      AdminDashboard: 'admin',
      ClientHome: 'home',
      Cart: 'cart',
      Checkout: 'checkout',
      OrderConfirmation: 'order-confirmation',
      MyOrders: 'my-orders',
      OrderDetail: 'order/:id',
      ClientProfile: 'profile',
    },
  },
};

export default function AppNavigator() {
  useEffect(() => {
    //attendre que navigationRef soit prêt puis naviguer
    const navigateWhenReady = (target) => {
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: target }] });
      } else {
        // Retry toutes les 50ms jusqu'à ce que le NavigationContainer soit monté
        const timer = setInterval(() => {
          if (navigationRef.isReady()) {
            clearInterval(timer);
            navigationRef.reset({ index: 0, routes: [{ name: target }] });
          }
        }, 50);
        // Sécurité : arrêter après 5s
        setTimeout(() => clearInterval(timer), 5000);
      }
    };


    if (typeof window !== 'undefined' && window.location?.hash) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && refreshToken && (type === 'recovery' || type === 'signup')) {
        const currentPath = window.location.pathname || '';

        // Établir la session Supabase avec les tokens du lien email
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ error }) => {
            if (error) {
              console.error('Erreur setSession:', error.message);
              return;
            }
            // Nettoyer le hash de l'URL pour éviter une réutilisation des tokens
            window.history.replaceState(null, '', currentPath);

            // Router vers le bon écran selon le path du lien email
            const target = currentPath.includes('create-password') ? 'CreatePassword' : 'ResetPassword';
            navigateWhenReady(target);
          });
      }
    }


    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        const url = typeof window !== 'undefined' ? (window.location?.href || '') : '';
        const target = url.includes('create-password') ? 'CreatePassword' : 'ResetPassword';
        navigateWhenReady(target);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
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
        <Stack.Screen name="CreatePassword"  component={withSuspense(CreatePasswordScreen)} />
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
