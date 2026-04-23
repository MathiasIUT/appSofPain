import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ConfirmEmailScreen from '../screens/ConfirmEmailScreen';
import AdminDashboard from '../screens/AdminDashboard';
import ClientHome from '../screens/ClientHome';
import CartScreen from '../screens/CartScreen';

const Stack = createNativeStackNavigator();

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
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="ConfirmEmail" component={ConfirmEmailScreen} />

        {/* Admin */}
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />

        {/* Client */}
        <Stack.Screen name="ClientHome" component={ClientHome} />
        <Stack.Screen name="Cart" component={CartScreen} />
        {/* Checkout et MyOrders seront ajoutés dans les livraisons B et C */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}