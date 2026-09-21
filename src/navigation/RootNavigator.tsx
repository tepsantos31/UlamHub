import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { SplashScreen } from '../screens/SplashScreen';
import { CarouselScreen } from '../screens/onboarding/CarouselScreen';
import { AuthScreen } from '../screens/onboarding/AuthScreen';
import { QuizScreen } from '../screens/onboarding/QuizScreen';
import { MainTabs } from './MainTabs';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { CookModeScreen } from '../screens/CookModeScreen';
import { KitchenAIScreen } from '../screens/KitchenAIScreen';
import { AddRecipeScreen } from '../screens/AddRecipeScreen';
import { AddRecipeReviewScreen } from '../screens/AddRecipeReviewScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PaywallScreen } from '../screens/PaywallScreen';
import { LeftoverAlchemistScreen } from '../screens/LeftoverAlchemistScreen';
import { IngredientScannerScreen } from '../screens/IngredientScannerScreen';
import { PartyPlannerScreen } from '../screens/PartyPlannerScreen';
import { HouseholdScreen } from '../screens/HouseholdScreen';
import { SharedRecipeScreen } from '../screens/SharedRecipeScreen';
import { SupportChatScreen } from '../screens/SupportChatScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="OnboardingCarousel" component={CarouselScreen} />
      <Stack.Screen name="OnboardingAuth" component={AuthScreen} />
      <Stack.Screen name="OnboardingQuiz" component={QuizScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <Stack.Screen name="CookMode" component={CookModeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="KitchenAI" component={KitchenAIScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="AddRecipe" component={AddRecipeScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="AddRecipeReview" component={AddRecipeReviewScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Paywall" component={PaywallScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="LeftoverAlchemist" component={LeftoverAlchemistScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="IngredientScanner" component={IngredientScannerScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="PartyPlanner" component={PartyPlannerScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Household" component={HouseholdScreen} />
      <Stack.Screen name="SharedRecipe" component={SharedRecipeScreen} />
      <Stack.Screen name="SupportChat" component={SupportChatScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
