import { getJSON, setJSON, KEYS } from './db';
import { seedPlan } from './seed';
import { PlanDay, MealSlot, Recipe, Budget } from '../types/models';
import { pushPlan } from '../lib/sync';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The real Mon–Sun dates for the week containing today — recomputed on
 * every call so the planner never shows a stale calendar. Meals are still
 * stored per weekday slot (not per absolute date), so this only fixes what's
 * *displayed*; a filled-in Monday repeats every week until changed. */
function currentWeekDates(): { day: string; date: string }[] {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { day: DAY_ABBR[d.getDay()], date: String(d.getDate()) };
  });
}

export async function getPlan(): Promise<PlanDay[]> {
  const stored = await getJSON<PlanDay[]>(KEYS.plan, seedPlan());
  const week = currentWeekDates();
  return week.map((w, i) => ({
    day: w.day,
    date: w.date,
    breakfast: stored[i]?.breakfast ?? null,
    lunch: stored[i]?.lunch ?? null,
    merienda: stored[i]?.merienda ?? null,
    dinner: stored[i]?.dinner ?? null,
  }));
}

export async function setPlan(plan: PlanDay[]): Promise<void> {
  await setJSON(KEYS.plan, plan);
  pushPlan(plan).catch(() => {});
}

export async function fillSlot(dayIndex: number, slot: MealSlot, recipeIdOrText: string | null): Promise<PlanDay[]> {
  const plan = await getPlan();
  const next = plan.map((d, i) => (i === dayIndex ? { ...d, [slot]: recipeIdOrText } : d));
  await setPlan(next);
  return next;
}

const AUTOFILL_PICKS = ['Ginataang Gulay', 'Tinolang Manok', 'Pancit Bihon', 'Ginisang Munggo'];

export async function autoFillWeek(): Promise<PlanDay[]> {
  const plan = await getPlan();
  const next = plan.map((d, i) => ({
    ...d,
    breakfast: d.breakfast || 'Champorado',
    lunch: d.lunch || 'Ginisang Munggo',
    merienda: d.merienda || 'Turon',
    dinner: d.dinner || AUTOFILL_PICKS[i % AUTOFILL_PICKS.length],
  }));
  await setPlan(next);
  return next;
}

const BUDGET_VALUE: Record<Budget, number> = { $: 6, $$: 12, $$$: 20 };

export function computeWeekBudget(plan: PlanDay[], recipes: Recipe[]): number {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  let total = 0;
  for (const day of plan) {
    for (const slot of ['breakfast', 'lunch', 'merienda', 'dinner'] as MealSlot[]) {
      const val = day[slot];
      if (!val) continue;
      const recipe = byId.get(val);
      total += recipe ? BUDGET_VALUE[recipe.budget] : 4;
    }
  }
  return total;
}
