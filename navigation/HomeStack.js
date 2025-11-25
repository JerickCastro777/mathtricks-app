import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import HomeScreen from "../screens/HomeScreen";
import ExerciseScreen from "../screens/ExerciseScreen"; 
import TimeAttackScreen from '../screens/TimeAttackScreen';

const HomeStack = createStackNavigator();

export default function HomeStackScreen() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="Inicio"
        component={HomeScreen}
        options={{ headerTitleAlign: "center" }}
      />
      <HomeStack.Screen
        name="ExerciseScreen"
        component={ExerciseScreen}
        options={{ headerTitle: "Ejercicios" }}
      />
      <HomeStack.Screen
        name="TimeAttackScreen"
        component={TimeAttackScreen}
        options={{ title: 'Contrarreloj' }}
      />
    </HomeStack.Navigator>
  );
}
