import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import { BottomNavBar } from './BottomNavBar';
import { HomeScreen } from '../screens/HomeScreen';
import { BrowseScreen } from '../screens/BrowseScreen';
import { MealPlannerScreen } from '../screens/MealPlannerScreen';
import { GroceryListScreen } from '../screens/GroceryListScreen';
import { ProfileSettingsScreen } from '../screens/ProfileSettingsScreen';
import { SupportChatHead } from '../components/SupportChatHead';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomNavBar {...props} />}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Browse" component={BrowseScreen} />
        <Tab.Screen name="Planner" component={MealPlannerScreen} />
        <Tab.Screen name="Grocery" component={GroceryListScreen} />
        <Tab.Screen name="Profile" component={ProfileSettingsScreen} />
      </Tab.Navigator>
      <SupportChatHead />
    </View>
  );
}
