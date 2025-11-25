// navigation/TabNavigator.jsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeStackScreen from './HomeStack';
import ProfileScreen from '../screens/ProfileScreen';
import { Text } from 'react-native';
import React, { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';
import AdminQuestionsScreen from '../screens/AdminQuestionsScreen'; 

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  const { user } = useContext(AppContext);
  const isAdmin = !!user?.isAdmin;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#1E3A8A",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          height: 70,
          position: "absolute",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 8,
          elevation: 6,
        },
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#cbd5e1",
        tabBarLabelStyle: { fontSize: 13, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="InicioTab"
        component={HomeStackScreen}
        options={{
          tabBarLabel: "Inicio",
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>🏠</Text>,
          headerShown: false,
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="Preguntas"
          component={AdminQuestionsScreen}
          options={{
            tabBarLabel: "Preguntas",
            tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>🧩</Text>,
            headerShown: true,
            title: 'Gestión de preguntas',
          }}
        />
      )}
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Perfil",
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>👤</Text>,
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
}
