import { supabase, supabaseConfigured } from './supabase';

// Reuses the same underlying `households` table/RPCs as before — renaming
// the whole schema wasn't worth the migration risk, since it's an
// implementation detail nobody outside the app ever sees. Everything
// user-facing is "Kitchen" / "crew" now.

export interface KitchenCrewMember {
  id: string;
  name: string;
  avatarInitial: string;
}

export interface KitchenInfo {
  id: string;
  name: string;
  inviteCode: string;
  crew: KitchenCrewMember[];
}

async function requireUserId(): Promise<string> {
  if (!supabaseConfigured) throw new Error('Cloud accounts are not set up on this build yet.');
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You need to be signed in.');
  return userId;
}

export async function getMyKitchen(): Promise<KitchenInfo | null> {
  const userId = await requireUserId();
  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userId).maybeSingle();
  const kitchenId = profile?.household_id;
  if (!kitchenId) return null;

  const [{ data: kitchen }, { data: members }] = await Promise.all([
    supabase.from('households').select('id, name, invite_code').eq('id', kitchenId).maybeSingle(),
    // profiles is locked to self-only RLS — crew-mates' names come through this
    // narrow function instead of a direct table read.
    supabase.rpc('household_members', { hid: kitchenId }),
  ]);
  if (!kitchen) return null;

  return {
    id: kitchen.id,
    name: kitchen.name,
    inviteCode: kitchen.invite_code,
    crew: ((members ?? []) as { id: string; name: string; avatar_initial: string }[])
      .filter((m) => m.id !== userId)
      .map((m) => ({
        id: m.id,
        name: m.name || 'Someone',
        avatarInitial: m.avatar_initial || 'U',
      })),
  };
}

export async function createKitchen(name: string): Promise<KitchenInfo> {
  await requireUserId();
  // Atomic RPC: generates a unique invite code server-side and sets this
  // user as the first member in the same transaction.
  const { data, error } = await supabase.rpc('create_household', { household_name: name.trim() || 'My Kitchen' });
  const kitchen = (data as { id: string; name: string; invite_code: string }[] | null)?.[0];
  if (error || !kitchen) throw error ?? new Error('Could not create kitchen.');

  return { id: kitchen.id, name: kitchen.name, inviteCode: kitchen.invite_code, crew: [] };
}

export async function joinKitchen(inviteCode: string): Promise<KitchenInfo> {
  const userId = await requireUserId();
  const code = inviteCode.trim().toUpperCase();
  // Kitchens are locked to member-only reads — looking one up by its exact
  // code (the only legitimate way to discover one you're not in yet) goes
  // through this function instead of a direct table select.
  const { data, error } = await supabase.rpc('lookup_household_by_code', { code });
  const kitchen = (data as { id: string; name: string }[] | null)?.[0];
  if (error || !kitchen) throw new Error('No kitchen found with that code — double check it and try again.');

  const { error: profileErr } = await supabase.from('profiles').update({ household_id: kitchen.id }).eq('id', userId);
  if (profileErr) throw profileErr;

  const info = await getMyKitchen();
  if (!info) throw new Error('Joined, but could not load the kitchen — try reopening this screen.');
  return info;
}

export async function leaveKitchen(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('profiles').update({ household_id: null }).eq('id', userId);
  if (error) throw error;
}

// ---- requesting a crew-mate's recipe (browsing is read-only; adding it to
// your own editable cookbook needs the owner's OK first) ----

export interface RecipeRequest {
  id: string;
  recipeId: string;
  recipeName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  status: 'pending' | 'approved' | 'declined';
}

function mapRequest(row: {
  id: string;
  recipe_id: string;
  recipe_name: string;
  from_user_id: string;
  from_user_name: string;
  to_user_id: string;
  status: 'pending' | 'approved' | 'declined';
}): RecipeRequest {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    recipeName: row.recipe_name,
    fromUserId: row.from_user_id,
    fromUserName: row.from_user_name,
    toUserId: row.to_user_id,
    status: row.status,
  };
}

async function myName(): Promise<string> {
  const userId = await requireUserId();
  const { data } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
  return (data as { name: string } | null)?.name || 'Someone';
}

/** Asks a crew-mate for permission to copy their recipe into your own
 * (editable) cookbook. No-ops if you already have a pending or approved
 * request for it, so re-tapping the button is always safe. */
export async function requestRecipe(recipe: { id: string; name: string }, ownerId: string): Promise<void> {
  const userId = await requireUserId();
  const { data: existing } = await supabase
    .from('recipe_requests')
    .select('id')
    .eq('recipe_id', recipe.id)
    .eq('from_user_id', userId)
    .eq('to_user_id', ownerId)
    .in('status', ['pending', 'approved'])
    .maybeSingle();
  if (existing) return;

  const name = await myName();
  const { error } = await supabase.from('recipe_requests').insert({
    recipe_id: recipe.id,
    recipe_name: recipe.name,
    from_user_id: userId,
    from_user_name: name,
    to_user_id: ownerId,
    status: 'pending',
  });
  if (error) throw error;
}

/** Your latest outstanding request (if any) for a specific crew-mate's
 * recipe, so the UI can show "Requested" / "Approved" instead of the button. */
export async function getMyRequestStatus(recipeId: string, ownerId: string): Promise<RecipeRequest | null> {
  const userId = await requireUserId();
  const { data } = await supabase
    .from('recipe_requests')
    .select('*')
    .eq('recipe_id', recipeId)
    .eq('from_user_id', userId)
    .eq('to_user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapRequest(data as any) : null;
}

/** Pending requests other crew members have sent you for your own recipes. */
export async function getIncomingRequests(): Promise<RecipeRequest[]> {
  const userId = await requireUserId();
  const { data } = await supabase
    .from('recipe_requests')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return ((data ?? []) as any[]).map(mapRequest);
}

export async function respondToRequest(requestId: string, approve: boolean): Promise<void> {
  await requireUserId();
  const { error } = await supabase
    .from('recipe_requests')
    .update({ status: approve ? 'approved' : 'declined' })
    .eq('id', requestId);
  if (error) throw error;
}

/** Your requests that were just approved — the caller copies the recipe
 * into local storage, then calls clearRequest to remove it here. */
export async function getMyApprovedRequests(): Promise<RecipeRequest[]> {
  const userId = await requireUserId();
  const { data } = await supabase.from('recipe_requests').select('*').eq('from_user_id', userId).eq('status', 'approved');
  return ((data ?? []) as any[]).map(mapRequest);
}

export async function clearRequest(requestId: string): Promise<void> {
  await requireUserId();
  await supabase.from('recipe_requests').delete().eq('id', requestId).then(() => {});
}
