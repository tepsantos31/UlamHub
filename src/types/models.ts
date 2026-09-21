import { ImageSourcePropType } from 'react-native';

export type Country =
  | 'Filipino'
  | 'Italian'
  | 'American'
  | 'Mexican'
  | 'Japanese'
  | 'Indian'
  | 'Chinese'
  | 'Greek';

// Cuisine-specific regional style, e.g. Philippine regions for Filipino dishes.
// Optional and only meaningful for cuisines with a documented regional tradition.
export type Region =
  | 'Ilocano'
  | 'Kapampangan'
  | 'Bicolano'
  | 'Batangueño'
  | 'Visayan'
  | 'Chavacano'
  | 'Maguindanaoan'
  | 'Tagalog';

export type Household = 'solo' | 'couple' | 'family' | 'multigen';
export type Skill = 'beginner' | 'home' | 'pro';
export type Diet = 'Vegetarian' | 'Halal' | 'Low-sodium' | 'Diabetic-friendly';
export type Budget = '$' | '$$' | '$$$';
export type Difficulty = 'Beginner' | 'Home cook' | 'Experienced';
export type MealSlot = 'breakfast' | 'lunch' | 'merienda' | 'dinner';

export interface Ingredient {
  name: string;
  qty: number;
  unit: string;
  have?: boolean;
}

export interface RecipeStep {
  n: number;
  text: string;
  sec: number; // 0 = no timer
  tl?: string; // display label e.g. "20 min"
}

export interface SaucePairing {
  name: string;
  note: string;
}

export interface FlavorBalance {
  label: string; // "Sour"
  val: number; // 0-100
  color: string;
}

export interface Nutrition {
  kcal?: number;
  protein: number;
  carbs: number;
  fat: number;
  sodium: number;
  fiber: number;
}

export interface Recipe {
  id: string;
  name: string;
  country: Country | string;
  region?: Region | string; // cuisine-specific regional style, e.g. Philippine region for Filipino dishes
  type: string; // Guisado, Nilaga, Inihaw, Ginataan, Kilawin...
  time: number; // minutes
  kcal: number;
  rating: number;
  cooks: number;
  budget: Budget;
  diff: Difficulty;
  author: string;
  servingsBase: number;
  sourceUrl?: string;
  photoUri?: string; // real photo if user imported one; otherwise placeholder is shown
  photoAsset?: ImageSourcePropType; // bundled photo for seed dishes (require()'d in seed.ts)
  ingredients: Ingredient[];
  steps: RecipeStep[];
  nutrition: Nutrition;
  saucePairings: SaucePairing[];
  flavorBalance: FlavorBalance[];
  dietTags?: Diet[];
  userAdded?: boolean;
  favorite?: boolean;
  story?: string;
  madeItPhotos?: string[];
  sharedRowId?: string; // set once this recipe has a live public share link
}

export interface PlanDay {
  day: string; // Mon, Tue...
  date: string; // day-of-month
  breakfast: string | null; // recipe id or free text
  lunch: string | null;
  merienda: string | null;
  dinner: string | null;
}

export interface GroceryItem {
  n: string;
  q: string;
  checked: boolean;
  manual?: boolean;
}

export interface GroceryGroup {
  name: string;
  sub: string;
  items: GroceryItem[];
}

export interface PantryItem {
  name: string;
  have: boolean;
}

export interface QuizState {
  household: Household;
  countries: Country[];
  skill: Skill;
  diet: Diet[];
  diaspora: boolean;
}

export interface OnboardingState {
  complete: boolean;
  quiz: QuizState;
}

export interface SettingsState {
  unit: 'metric' | 'imperial';
  notif: {
    mealRem: boolean;
    pantry: boolean;
    grocery: boolean;
    social: boolean;
  };
  plan: 'monthly' | 'annual' | 'family' | null;
  planExpiresAt?: string; // ISO date — when the current paid period runs out
}

export interface ProfileState {
  name: string;
  handle: string;
  avatarInitial: string;
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  recipeId?: string;
}
