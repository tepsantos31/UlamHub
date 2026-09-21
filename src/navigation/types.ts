import { ExtractedRecipe } from '../api/client';

export type RootStackParamList = {
  Splash: undefined;
  OnboardingCarousel: undefined;
  OnboardingAuth: undefined;
  OnboardingQuiz: undefined;
  Main: { screen?: keyof MainTabParamList } | undefined;
  RecipeDetail: { recipeId: string };
  CookMode: { recipeId: string };
  KitchenAI: { prefill?: string } | undefined;
  AddRecipe: undefined;
  AddRecipeReview: { method: 'manual' | 'url' | 'photo' | 'leftover'; extracted?: ExtractedRecipe; sourceUrl?: string };
  Notifications: undefined;
  Paywall: undefined;
  LeftoverAlchemist: undefined;
  IngredientScanner: undefined;
  PartyPlanner: undefined;
  Household: undefined;
  SharedRecipe: { rowId: string };
  SupportChat: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Browse: { filter?: string } | undefined;
  Planner: undefined;
  Grocery: undefined;
  Profile: undefined;
};
