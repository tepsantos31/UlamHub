import { supabase, supabaseConfigured } from './supabase';
import { runInitialSync } from './initialSync';

export interface HouseholdMember {
  id: string;
  name: string;
  avatarInitial: string;
}

export interface HouseholdInfo {
  id: string;
  name: string;
  inviteCode: string;
  members: HouseholdMember[];
}

async function requireUserId(): Promise<string> {
  if (!supabaseConfigured) throw new Error('Cloud accounts are not set up on this build yet.');
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new Error('You need to be signed in.');
  return userId;
}

export async function getMyHousehold(): Promise<HouseholdInfo | null> {
  const userId = await requireUserId();
  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userId).maybeSingle();
  const householdId = profile?.household_id;
  if (!householdId) return null;

  const [{ data: household }, { data: members }] = await Promise.all([
    supabase.from('households').select('id, name, invite_code').eq('id', householdId).maybeSingle(),
    // profiles is locked to self-only RLS — co-members' names come through this
    // narrow function instead of a direct table read.
    supabase.rpc('household_members', { hid: householdId }),
  ]);
  if (!household) return null;

  return {
    id: household.id,
    name: household.name,
    inviteCode: household.invite_code,
    members: ((members ?? []) as { id: string; name: string; avatar_initial: string }[]).map((m) => ({
      id: m.id,
      name: m.name || 'Someone',
      avatarInitial: m.avatar_initial || 'U',
    })),
  };
}

export async function createHousehold(name: string): Promise<HouseholdInfo> {
  await requireUserId();
  // Atomic RPC: generates a unique invite code server-side and sets this
  // user as the first member in the same transaction — see create_household()
  // in supabase/schema.sql for why this can't be a plain client-side insert.
  const { data, error } = await supabase.rpc('create_household', { household_name: name.trim() || 'My Household' });
  const household = (data as { id: string; name: string; invite_code: string }[] | null)?.[0];
  if (error || !household) throw error ?? new Error('Could not create household.');

  await runInitialSync().catch(() => {});
  return { id: household.id, name: household.name, inviteCode: household.invite_code, members: [] };
}

export async function joinHousehold(inviteCode: string): Promise<HouseholdInfo> {
  const userId = await requireUserId();
  const code = inviteCode.trim().toUpperCase();
  // Households are locked to member-only reads — looking one up by its exact
  // code (the only legitimate way to discover one you're not in yet) goes
  // through this function instead of a direct table select.
  const { data, error } = await supabase.rpc('lookup_household_by_code', { code });
  const household = (data as { id: string; name: string }[] | null)?.[0];
  if (error || !household) throw new Error('No household found with that code — double check it and try again.');

  const { error: profileErr } = await supabase.from('profiles').update({ household_id: household.id }).eq('id', userId);
  if (profileErr) throw profileErr;

  await runInitialSync().catch(() => {});
  const info = await getMyHousehold();
  if (!info) throw new Error('Joined, but could not load the household — try reopening this screen.');
  return info;
}

export async function leaveHousehold(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('profiles').update({ household_id: null }).eq('id', userId);
  if (error) throw error;
}
