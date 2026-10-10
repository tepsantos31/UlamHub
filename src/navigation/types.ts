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
  AddRecipe: { sharedUrl?: string } | undefined;
  AddRecipeReview: { method: 'manual' | 'url' | 'photo' | 'leftover' | 'whatcanimake'; extracted?: ExtractedRecipe; sourceUrl?: string };
  ShareIntent: undefined;
  Notifications: undefined;
  Paywall: undefined;
  LeftoverAlchemist: undefined;
  WhatCanIMake: undefined;
  IngredientScanner: undefined;
  PartyPlanner: { selectedRecipeIds?: string[] } | undefined;
  SelectPartyDishes: { limit: number; initialSelectedIds: string[] };
  EditDayPlan: { dayIndex: number };
  MyRecipes: undefined;
  Kitchen: undefined;
  KitchenJoin: { code?: string } | undefined;
  MemberKitchen: { memberId: string; kitchenName: string };
  SharedRecipe: { rowId: string };
  SupportChat: undefined;
  Legal: { doc: 'privacy' | 'terms' };
};

export type MainTabParamList = {
  Home: undefined;
  Browse: { filter?: string } | undefined;
  Planner: undefined;
  Grocery: undefined;
  Profile: undefined;
};
