import Constants from 'expo-constants';
import { Ingredient, RecipeStep, Nutrition } from '../types/models';
import { supabase } from '../lib/supabase';

// A release build has no Metro dev server to derive a host from, so it MUST
// be given the real deployed backend URL via EXPO_PUBLIC_API_BASE_URL (set at
// build time — see .env.example). In local dev, with no override set, fall
// back to resolving the LAN IP Metro is already using
// (Constants.expoConfig.hostUri, e.g. "192.168.1.23:8081") so a phone running
// Expo Go/a dev client can still reach the backend on the same host, port 4000.
function resolveApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) return process.env.EXPO_PUBLIC_API_BASE_URL;
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
  kcal: number;
  nutrition: Nutrition;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  sourceUrl?: string;
}

export function extractRecipe(input: { url?: string; text?: string; imageBase64?: string }): Promise<ExtractedRecipe> {
  return post<ExtractedRecipe>('/api/extract-recipe', input);
}

export interface ChatContext {
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

export function generateRecipePhoto(input: {
  name: string;
  country?: string;
  type?: string;
  ingredients?: string[];
}): Promise<{ imageBase64: string }> {
  return post<{ imageBase64: string }>('/api/generate-photo', input);
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

/** Permanently deletes the signed-in account and everything owned by it
 * (recipes, meal plan, grocery list, kitchen membership) — every table
 * cascades off the auth user server-side. Irreversible. */
export async function deleteAccount(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required');
  const res = await fetch(`${API_BASE_URL}/api/account`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text ? JSON.parse(text).error : `Could not delete account (${res.status})`);
  }
}
