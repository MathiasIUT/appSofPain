import React, { Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../config/theme';

const LoginScreen = React.lazy(() => import('../screens/LoginScreen'));
const AdminDashboard = React.lazy(() => import('../screens/AdminDashboard'));
const ClientHome = React.lazy(() => import('../screens/ClientHome'));
const CartScreen = React.lazy(() => import('../screens/CartScreen'));
const CheckoutScreen = React.lazy(() => import('../screens/CheckoutScreen'));
const OrderConfirmationScreen = React.lazy(() => import('../screens/OrderConfirmationScreen'));
const MyOrdersScreen = React.lazy(() => import('../screens/MyOrdersScreen'));
const OrderDetailScreen = React.lazy(() => import('../screens/OrderDetailScreen'));
const ClientProfileScreen = React.lazy(() => import('../screens/ClientProfileScreen'));

const Stack = createNativeStackNavigator();

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
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {/* Authentification */}
        <Stack.Screen name="Login" component={withSuspense(LoginScreen)} />

        {/* Admin */}
        <Stack.Screen name="AdminDashboard" component={withSuspense(AdminDashboard)} />

        {/* Client */}
        <Stack.Screen name="ClientHome" component={withSuspense(ClientHome)} />
        <Stack.Screen name="Cart" component={withSuspense(CartScreen)} />
        <Stack.Screen name="Checkout" component={withSuspense(CheckoutScreen)} />
        <Stack.Screen name="OrderConfirmation" component={withSuspense(OrderConfirmationScreen)} />
        <Stack.Screen name="MyOrders" component={withSuspense(MyOrdersScreen)} />
        <Stack.Screen name="OrderDetail" component={withSuspense(OrderDetailScreen)} />
        <Stack.Screen name="ClientProfile" component={withSuspense(ClientProfileScreen)} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA', // ou colors.background
  },
});