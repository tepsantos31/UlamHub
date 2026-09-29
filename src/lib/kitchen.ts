import { supabase, supabaseConfigured } from './supabase';

// Reuses the same underlying `households` table as before for what a
// kitchen *is* — renaming that wasn't worth the migration risk, since it's
// an implementation detail nobody outside the app ever sees. Membership is
// now a real many-to-many table (kitchen_members), so an account can own a
// kitchen and separately belong to any number of others at once.

export interface KitchenInfo {
  id: string;
  name: string;
  inviteCode: string;
  myRole: 'owner' | 'member';
  // Only set when myRole === 'member' — who owns this kitchen, so the UI can
  // link straight to their recipes without a separate crew-browsing step.
  ownerId?: string;
  ownerName?: string;
}

async function requireUserId(): Promise<string> {
  if (!supabaseConfigured) throw new Error('Cloud accounts are not set up on this build yet.');
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You need to be signed in.');
  return userId;
}

/** Every kitchen this account belongs to — the one you own and any you've
 * joined, in no particular order. */
export async function getMyKitchens(): Promise<KitchenInfo[]> {
  const userId = await requireUserId();
  const { data: memberships } = await supabase.from('kitchen_members').select('kitchen_id, role').eq('user_id', userId);
  const rows = (memberships ?? []) as { kitchen_id: string; role: 'owner' | 'member' }[];
  if (rows.length === 0) return [];

  const roleById = new Map(rows.map((r) => [r.kitchen_id, r.role]));
  const { data: kitchens } = await supabase
    .from('households')
    .select('id, name, invite_code')
    .in('id', rows.map((r) => r.kitchen_id));

  return Promise.all(
    ((kitchens ?? []) as { id: string; name: string; invite_code: string }[]).map(async (k) => {
      const myRole = roleById.get(k.id) ?? 'member';
      if (myRole === 'owner') {
        return { id: k.id, name: k.name, inviteCode: k.invite_code, myRole };
      }
      // Joined kitchen — look up its owner so the UI can link straight to
      // their recipes. profiles is locked to self-only RLS, so this goes
      // through the same narrow RPC as before rather than a direct read.
      const { data: members } = await supabase.rpc('kitchen_members_list', { kid: k.id });
      const owner = ((members ?? []) as { id: string; name: string; role: 'owner' | 'member' }[]).find((m) => m.role === 'owner');
      return {
        id: k.id,
        name: k.name,
        inviteCode: k.invite_code,
        myRole,
        ownerId: owner?.id,
        ownerName: owner?.name || 'Someone',
      };
    }),
  );
}

export async function createKitchen(name: string): Promise<KitchenInfo> {
  await requireUserId();
  // Atomic RPC: generates a unique invite code server-side and makes this
  // account its owner in the same transaction.
  const { data, error } = await supabase.rpc('create_kitchen', { kitchen_name: name.trim() || 'My Kitchen' });
  const kitchen = (data as { id: string; name: string; invite_code: string }[] | null)?.[0];
  if (error || !kitchen) throw error ?? new Error('Could not create kitchen.');
  return { id: kitchen.id, name: kitchen.name, inviteCode: kitchen.invite_code, myRole: 'owner' };
}

/** Every account gets exactly one kitchen, created automatically the first
 * time it's ever actually signed in — never a manual "create" step. Starts
 * out as "My Kitchen"; the owner can rename it later from the Kitchen screen
 * (see renameKitchen). Safe to call on every sign-in: no-ops once the
 * account already owns one. */
export async function ensureOwnKitchen(): Promise<void> {
  if (!supabaseConfigured) return;
  try {
    const mine = await getMyKitchens();
    if (mine.some((k) => k.myRole === 'owner')) return;
    await createKitchen('My Kitchen');
  } catch {
    // Best-effort — a hiccup here shouldn't block sign-in; My Kitchen will
    // just look empty until this succeeds on a later launch.
  }
}

export async function renameKitchen(kitchenId: string, name: string): Promise<void> {
  await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give your kitchen a name.');
  const { error } = await supabase.from('households').update({ name: trimmed }).eq('id', kitchenId);
  if (error) throw error;
}

/** Looks a kitchen up by its invite code without joining it — lets the UI
 * confirm "Request to join <name>?" (e.g. from a tapped invite link) before
 * actually sending the request. */
export async function lookupKitchenByCode(inviteCode: string): Promise<{ id: string; name: string }> {
  await requireUserId();
  const code = inviteCode.trim().toUpperCase();
  const { data, error } = await supabase.rpc('lookup_kitchen_by_code', { code });
  const kitchen = (data as { id: string; name: string }[] | null)?.[0];
  if (error || !kitchen) throw new Error('No kitchen found with that code — double check it and try again.');
  return kitchen;
}

export interface KitchenJoinRequest {
  id: string;
  kitchenId: string;
  kitchenName: string;
  fromUserId: string;
  fromUserName: string;
  status: 'pending' | 'approved' | 'declined';
}

/** Sends a request to join a kitchen by id — joining isn't instant, the
 * owner has to approve it first. No-ops if you're already a member or
 * already have a pending request in for this kitchen. */
export async function requestJoinKitchenById(kitchenId: string): Promise<void> {
  const userId = await requireUserId();

  const { data: alreadyMember } = await supabase
    .from('kitchen_members')
    .select('kitchen_id')
    .eq('kitchen_id', kitchenId)
    .eq('user_id', userId)
    .maybeSingle();
  if (alreadyMember) throw new Error("You're already in this kitchen.");

  const { data: existing } = await supabase
    .from('kitchen_join_requests')
    .select('id')
    .eq('kitchen_id', kitchenId)
    .eq('from_user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) return;

  const name = await myName();
  const { error } = await supabase
    .from('kitchen_join_requests')
    .insert({ kitchen_id: kitchenId, from_user_id: userId, from_user_name: name, status: 'pending' });
  if (error) throw error;
}

/** Convenience for the "join with a code" form — looks up then sends the
 * request in one call, returning the kitchen's name for confirmation. */
export async function requestJoinKitchenByCode(inviteCode: string): Promise<string> {
  const found = await lookupKitchenByCode(inviteCode);
  await requestJoinKitchenById(found.id);
  return found.name;
}

/** Requests to join a kitchen that are still pending your approval, for
 * kitchens you own. */
export async function getIncomingKitchenJoinRequests(): Promise<KitchenJoinRequest[]> {
  const userId = await requireUserId();
  const { data: owned } = await supabase.from('kitchen_members').select('kitchen_id').eq('user_id', userId).eq('role', 'owner');
  const kitchenIds = ((owned ?? []) as { kitchen_id: string }[]).map((r) => r.kitchen_id);
  if (kitchenIds.length === 0) return [];

  const [{ data: requests }, { data: kitchens }] = await Promise.all([
    supabase.from('kitchen_join_requests').select('*').in('kitchen_id', kitchenIds).eq('status', 'pending'),
    supabase.from('households').select('id, name').in('id', kitchenIds),
  ]);
  const nameById = new Map(((kitchens ?? []) as { id: string; name: string }[]).map((k) => [k.id, k.name]));
  return ((requests ?? []) as any[]).map((r) => ({
    id: r.id,
    kitchenId: r.kitchen_id,
    kitchenName: nameById.get(r.kitchen_id) ?? 'Your kitchen',
    fromUserId: r.from_user_id,
    fromUserName: r.from_user_name,
    status: r.status,
  }));
}

/** Kitchen join requests you've sent that are still pending. */
export async function getMySentKitchenJoinRequests(): Promise<KitchenJoinRequest[]> {
  const userId = await requireUserId();
  const { data: requests } = await supabase
    .from('kitchen_join_requests')
    .select('*')
    .eq('from_user_id', userId)
    .eq('status', 'pending');
  const rows = (requests ?? []) as any[];
  if (rows.length === 0) return [];

  const { data: kitchens } = await supabase
    .from('households')
    .select('id, name')
    .in('id', rows.map((r) => r.kitchen_id));
  const nameById = new Map(((kitchens ?? []) as { id: string; name: string }[]).map((k) => [k.id, k.name]));
  return rows.map((r) => ({
    id: r.id,
    kitchenId: r.kitchen_id,
    kitchenName: nameById.get(r.kitchen_id) ?? 'a kitchen',
    fromUserId: r.from_user_id,
    fromUserName: r.from_user_name,
    status: r.status,
  }));
}

export async function respondToKitchenJoinRequest(requestId: string, approve: boolean): Promise<void> {
  await requireUserId();
  const { error } = await supabase.rpc('respond_to_kitchen_join_request', { request_id: requestId, approve });
  if (error) throw error;
}

export async function leaveKitchen(kitchenId: string): Promise<void> {
  await requireUserId();
  const { error } = await supabase.rpc('leave_kitchen', { kid: kitchenId });
  if (error) throw error;
}

export interface KitchenLeaveNotice {
  id: string;
  kitchenId: string;
  kitchenName: string;
  userName: string;
}

/** "So-and-so left" notices for kitchens you own, left behind by
 * leaveKitchen() — surfaced once, then dismissed with dismissKitchenLeaveNotice. */
export async function getKitchenLeaveNotices(): Promise<KitchenLeaveNotice[]> {
  const userId = await requireUserId();
  const { data: owned } = await supabase.from('kitchen_members').select('kitchen_id').eq('user_id', userId).eq('role', 'owner');
  const kitchenIds = ((owned ?? []) as { kitchen_id: string }[]).map((r) => r.kitchen_id);
  if (kitchenIds.length === 0) return [];

  const [{ data: notices }, { data: kitchens }] = await Promise.all([
    supabase.from('kitchen_leave_notices').select('*').in('kitchen_id', kitchenIds).order('created_at', { ascending: false }),
    supabase.from('households').select('id, name').in('id', kitchenIds),
  ]);
  const nameById = new Map(((kitchens ?? []) as { id: string; name: string }[]).map((k) => [k.id, k.name]));
  return ((notices ?? []) as any[]).map((n) => ({
    id: n.id,
    kitchenId: n.kitchen_id,
    kitchenName: nameById.get(n.kitchen_id) ?? 'your kitchen',
    userName: n.user_name,
  }));
}

export async function dismissKitchenLeaveNotice(noticeId: string): Promise<void> {
  await requireUserId();
  await supabase.from('kitchen_leave_notices').delete().eq('id', noticeId).then(() => {});
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
