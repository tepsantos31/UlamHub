import { ImageSourcePropType } from 'react-native';

export type Country =
  | 'Filipino'
  | 'Italian'
  | 'American'
  | 'Mexican'
  | 'Japanese'
  | 'Indian'
  | 'Chinese'
  | 'Greek'
  | 'Thai'
  | 'Korean'
  | 'Vietnamese'
  | 'French'
  | 'Spanish'
  | 'Lebanese';

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

export interface Ingredient {
  name: string;
  qty: number;
  unit: string;
  // Seed-data default for "already a pantry staple, not worth shopping for"
  // (soy sauce, salt, oil...). RecipeDetailScreen lets the user override this
  // per-ingredient via its own toBuyFlags state before adding to groceries —
  // this field is only ever the starting checkbox state, never read directly
  // when deciding what to add from that screen.
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
  savedFromShare?: boolean; // true if this was saved via a share link rather than created/imported directly
}

export interface PlanDay {
  day: string; // Mon, Tue...
  date: string; // day-of-month
  // Recipe ids, in display order — not tied to a meal type (breakfast/lunch/
  // etc). `null` is an empty placeholder slot; every day has at least
  // DEFAULT_DISH_COUNT (see storage/plan.ts) of these by default, and
  // "+ Add a dish" appends more.
  dishes: (string | null)[];
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
  language: 'en' | 'es';
  notif: {
    // Gates whether PartyPlannerScreen actually schedules the local
    // reminder it builds from "Remind me how many days before" — see its
    // onSave(). Off means that date/days-before info is still saved with
    // the party plan, it just never turns into a scheduled notification.
    party: boolean;
    // Gates the "Kitchen requests" group on NotificationsScreen — covers
    // both incoming kitchen join requests and incoming recipe requests.
    social: boolean;
  };
  plan: 'monthly' | 'annual' | null;
  planExpiresAt?: string; // ISO date — when the current paid period runs out
  // True once the user has cancelled — the plan stays active (and features
  // stay unlocked) until planExpiresAt, it just won't renew after that.
  planCancelled?: boolean;
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
