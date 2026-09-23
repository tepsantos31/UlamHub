import { supabase, supabaseConfigured } from './supabase';
import { Recipe, PlanDay, GroceryGroup, SettingsState, OnboardingState, ProfileState } from '../types/models';

interface SyncContext {
  userId: string;
  scopeId: string; // household_id if in one, else the user's own id
}

// Every push/pull below is a no-op when Supabase isn't configured yet, or
// when there's no signed-in session — callers never need to check first.
async function getContext(): Promise<SyncContext | null> {
  if (!supabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userId).maybeSingle();
  const scopeId = (profile as { household_id: string | null } | null)?.household_id ?? userId;
  return { userId, scopeId };
}

// Personal-only tables (settings, onboarding) are keyed by owner_id, never
// shared with a household — distinct from the scope_id tables above.
async function pushPersonal(table: string, column: string, value: unknown) {
  const ctx = await getContext();
  if (!ctx) return;
  await supabase
    .from(table)
    .upsert({ owner_id: ctx.userId, [column]: value }, { onConflict: 'owner_id' })
    .then(() => {});
}

async function pullPersonal<T>(table: string, column: string): Promise<T | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { data } = await supabase.from(table).select(column).eq('owner_id', ctx.userId).maybeSingle();
  return (data as Record<string, T> | null)?.[column] ?? null;
}

// ---- recipes (multi-row collection, not a scope_id singleton) ----

export async function pushRecipe(recipe: Recipe): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  const { photoAsset, ...portable } = recipe; // require() result isn't portable off-device — never sync it
  await supabase
    .from('recipes')
    .upsert(
      {
        id: recipe.id,
        owner_id: ctx.userId,
        household_id: ctx.scopeId !== ctx.userId ? ctx.scopeId : null,
        data: portable,
      },
      { onConflict: 'id,owner_id' },
    )
    .then(() => {});
}

/** Uploads a recipe's local photo (a file:// URI from the picker, or a
 * data: URI from AI generation) to Supabase Storage and returns its public
 * URL — or null if there's nothing to do (no photo, it's already a remote
 * URL, or there's no signed-in session to upload as). Keyed by owner +
 * recipe id, so re-uploading for the same recipe just overwrites the old
 * file rather than piling up orphaned ones. */
export async function uploadRecipePhoto(recipe: Recipe): Promise<string | null> {
  if (!recipe.photoUri || !/^(file:|data:)/.test(recipe.photoUri)) return null;
  const ctx = await getContext();
  if (!ctx) return null;

  const isPng = recipe.photoUri.startsWith('data:image/png');
  const ext = isPng ? 'png' : 'jpg';
  const path = `${ctx.userId}/${recipe.id}.${ext}`;

  const response = await fetch(recipe.photoUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error } = await supabase.storage
    .from('recipe-photos')
    .upload(path, arrayBuffer, { contentType: isPng ? 'image/png' : 'image/jpeg', upsert: true });
  if (error) return null;

  const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path);
  return data.publicUrl;
}

/** Only this account's own recipes — kitchen crew-mates' recipes live in
 * their own kitchen and are fetched on demand via fetchKitchenMemberRecipes,
 * not merged into your local list. */
export async function pullRecipes(): Promise<Recipe[] | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { data, error } = await supabase.from('recipes').select('data').eq('owner_id', ctx.userId);
  if (error || !data) return null;
  return data.map((row) => row.data as Recipe);
}

/** A specific kitchen crew-mate's recipes, read-only. RLS only returns rows
 * if the caller actually shares a kitchen (household_id) with that member —
 * an unrelated user's id here just comes back empty, not an error. */
export async function fetchKitchenMemberRecipes(memberId: string): Promise<Recipe[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await supabase.from('recipes').select('data').eq('owner_id', memberId);
  if (error || !data) return [];
  return data.map((row) => row.data as Recipe);
}

// ---- sharing a single recipe via a public link ----

/** Upserts the recipe (same as pushRecipe) and marks it publicly readable,
 * returning the row_id to build a share link from. Null if not signed in. */
export async function shareRecipe(recipe: Recipe): Promise<string | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { photoAsset, ...portable } = recipe;
  const { data, error } = await supabase
    .from('recipes')
    .upsert(
      {
        id: recipe.id,
        owner_id: ctx.userId,
        household_id: ctx.scopeId !== ctx.userId ? ctx.scopeId : null,
        data: portable,
        is_shared: true,
      },
      { onConflict: 'id,owner_id' },
    )
    .select('row_id')
    .single();
  if (error || !data) return null;
  return (data as { row_id: string }).row_id;
}

/** Reads a shared recipe by its row_id — works even when signed out, since
 * is_shared rows are publicly readable. Null if the link is invalid/unshared. */
export async function fetchSharedRecipe(rowId: string): Promise<Recipe | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await supabase.from('recipes').select('data').eq('row_id', rowId).eq('is_shared', true).maybeSingle();
  if (error || !data) return null;
  return data.data as Recipe;
}

/** Revokes a share link — the row stays (still synced/owned as normal), it
 * just stops being publicly readable. Only the owner can do this (RLS). */
export async function unshareRecipe(rowId: string): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  await supabase.from('recipes').update({ is_shared: false }).eq('row_id', rowId).then(() => {});
}

export interface TrendingRecipe {
  id: string;
  shareCount: number;
  rowId: string;
  name: string;
  country: string;
  type: string;
}

/** Recipes shared by the most people across every user, most-shared first.
 * Needs a signed-in session (the RPC is granted to `authenticated`), but the
 * underlying data is the same is_shared=true rows that are already publicly
 * readable one-by-one — this just adds the ability to discover/aggregate them. */
export async function fetchTrendingRecipes(limit = 10): Promise<TrendingRecipe[]> {
  if (!supabaseConfigured) return [];
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return [];
  const { data, error } = await supabase.rpc('trending_recipes', { result_limit: limit });
  if (error || !data) return [];
  return (data as any[])
    .filter((row) => row.name)
    .map((row) => ({
      id: row.id,
      shareCount: Number(row.share_count),
      rowId: row.row_id,
      name: row.name,
      country: row.country ?? '',
      type: row.type ?? '',
    }));
}

// ---- meal plan & grocery list — personal to this account, never shared
// with a kitchen crew (only recipes are; see fetchKitchenMemberRecipes) ----

async function pushOwn(table: string, column: string, value: unknown) {
  const ctx = await getContext();
  if (!ctx) return;
  await supabase
    .from(table)
    .upsert({ scope_id: ctx.userId, [column]: value }, { onConflict: 'scope_id' })
    .then(() => {});
}

async function pullOwn<T>(table: string, column: string): Promise<T | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { data } = await supabase.from(table).select(column).eq('scope_id', ctx.userId).maybeSingle();
  return (data as Record<string, T> | null)?.[column] ?? null;
}

export const pushPlan = (days: PlanDay[]) => pushOwn('meal_plans', 'days', days);
export const pullPlan = () => pullOwn<PlanDay[]>('meal_plans', 'days');

export const pushGrocery = (groups: GroceryGroup[]) => pushOwn('grocery_lists', 'groups', groups);
export const pullGrocery = () => pullOwn<GroceryGroup[]>('grocery_lists', 'groups');

// ---- personal-only documents (never shared with a household) ----

export const pushSettings = (settings: SettingsState) => pushPersonal('settings', 'data', settings);
export const pullSettings = () => pullPersonal<SettingsState>('settings', 'data');

export const pushOnboarding = (state: OnboardingState) => pushPersonal('onboarding', 'data', state);
export const pullOnboarding = () => pullPersonal<OnboardingState>('onboarding', 'data');

// ---- profile — backed by the `profiles` row Supabase auto-creates on sign-up ----

export async function pushProfile(profile: ProfileState): Promise<void> {
  const ctx = await getContext();
  if (!ctx) return;
  await supabase
    .from('profiles')
    .update({ name: profile.name, handle: profile.handle, avatar_initial: profile.avatarInitial })
    .eq('id', ctx.userId)
    .then(() => {});
}

export async function pullProfile(): Promise<ProfileState | null> {
  const ctx = await getContext();
  if (!ctx) return null;
  const { data } = await supabase
    .from('profiles')
    .select('name, handle, avatar_initial')
    .eq('id', ctx.userId)
    .maybeSingle();
  if (!data) return null;
  return { name: data.name, handle: data.handle, avatarInitial: data.avatar_initial };
}
