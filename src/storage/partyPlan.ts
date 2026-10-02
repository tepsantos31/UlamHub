import { getJSON, setJSON, KEYS } from './db';

export interface SavedPartyPlan {
  dishIds: string[];
  dishCount: number;
  occasion: string;
  partyDate: string | null; // ISO date (yyyy-mm-dd)
  remindDaysBefore: number | null;
  notificationId: string | null; // scheduled local reminder, so it can be cancelled/rescheduled
}

export const DEFAULT_PARTY_PLAN: SavedPartyPlan = {
  dishIds: [],
  dishCount: 6,
  occasion: 'Party',
  partyDate: null,
  remindDaysBefore: null,
  notificationId: null,
};

export async function getPartyPlan(): Promise<SavedPartyPlan> {
  return getJSON<SavedPartyPlan>(KEYS.partyPlan, DEFAULT_PARTY_PLAN);
}

export async function setPartyPlan(plan: SavedPartyPlan): Promise<void> {
  await setJSON(KEYS.partyPlan, plan);
}

export async function clearPartyPlan(): Promise<void> {
  await setJSON(KEYS.partyPlan, DEFAULT_PARTY_PLAN);
}
