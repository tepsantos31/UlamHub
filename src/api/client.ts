import Constants from 'expo-constants';
import { Ingredient, RecipeStep } from '../types/models';
import { supabase } from '../lib/supabase';

// The phone (Expo Go) can't reach "localhost" of the dev machine — resolve the
// LAN IP Metro is already using (Constants.expoConfig.hostUri, e.g. "192.168.1.23:8081")
// and talk to the backend on the same host, port 4000.
function resolveApiBase(): string {
  const hostUri = Constants.expoConfig?.hostUri; // "192.168.1.23:8081" | undefined
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:4000`;
  return 'http://localhost:4000';
}

export const API_BASE_URL = resolveApiBase();

async function post<T>(path: string, body: unknown): Promise<T> {
  // Every AI route requires a real signed-in session — the backend verifies
  // this token before doing anything (and rate-limits per user on top of it).
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) throw new Error('Sign in to use AI features.');
    if (res.status === 429) throw new Error(text ? JSON.parse(text).error : "You've hit the rate limit — try again shortly.");
    throw new Error(`Request to ${path} failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface ExtractedRecipe {
  name: string;
  country: string;
  region: string;
  type: string;
  servings: number;
  timeMinutes: number;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  sourceUrl?: string;
}

export function extractRecipe(input: { url?: string; text?: string; imageBase64?: string }): Promise<ExtractedRecipe> {
  return post<ExtractedRecipe>('/api/extract-recipe', input);
}

export interface ChatContext {
  pantry?: string[];
  recipeNames?: string[];
}

export interface ChatHistoryItem {
  role: 'user' | 'ai';
  text: string;
}

export function chatMessage(input: { message: string; history?: ChatHistoryItem[]; context?: ChatContext }): Promise<{ reply: string }> {
  return post<{ reply: string }>('/api/chat', input);
}

export function supportChat(input: { message: string; history?: ChatHistoryItem[] }): Promise<{ reply: string }> {
  return post<{ reply: string }>('/api/support-chat', input);
}

export function leftoverAlchemist(input: { imageBase64?: string; text?: string }): Promise<ExtractedRecipe> {
  return post<ExtractedRecipe>('/api/leftover-alchemist', input);
}

export interface ScannedIngredient {
  name: string;
  alternateNames: string[];
  englishOrScientificName: string;
  description: string;
  commonUses: string[];
  substitutes: string[];
}

export function scanIngredient(input: { imageBase64: string }): Promise<ScannedIngredient> {
  return post<ScannedIngredient>('/api/scan-ingredient', input);
}

export interface PartyCourse {
  course: 'Main' | 'Side' | 'Dessert' | 'Drinks';
  dishName: string;
  description: string;
  servesNote: string;
}

export interface PartyTimelineItem {
  label: string;
  hoursBeforeGuests: number;
  note: string;
}

export interface PartyPlan {
  theme: string;
  courses: PartyCourse[];
  timeline: PartyTimelineItem[];
  estimatedBudget: number;
  shoppingList: Ingredient[];
}

export function generatePartyPlan(input: {
  guestCount: number;
  occasion: string;
  budgetTotal?: number;
  dietary?: string[];
  cuisine?: string;
}): Promise<PartyPlan> {
  return post<PartyPlan>('/api/party-plan', input);
}

export function getRecipeStory(input: { name: string; country: string; region?: string; type: string }): Promise<{ story: string }> {
  return post<{ story: string }>('/api/recipe-story', input);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
