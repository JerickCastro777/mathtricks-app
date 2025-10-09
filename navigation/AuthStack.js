import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

const AuthStack = createStackNavigator();

export default function AuthStackScreen() {
  return (
    <AuthStack.Navigator
      initialRouteName="Login"
      screenOptions={{
        presentation: 'modal',
        headerStyle: { backgroundColor: '#0D1B2A' },
        headerTintColor: '#fff',
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
    </AuthStack.Navigator>
  );
}
