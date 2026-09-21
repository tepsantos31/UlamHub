import { getJSON, setJSON, KEYS } from './db';
import { seedPlan } from './seed';
import { PlanDay, MealSlot, Recipe, Budget } from '../types/models';
import { pushPlan } from '../lib/sync';

export async function getPlan(): Promise<PlanDay[]> {
  return getJSON<PlanDay[]>(KEYS.plan, seedPlan());
}

export async function setPlan(plan: PlanDay[]): Promise<void> {
  await setJSON(KEYS.plan, plan);
  pushPlan(plan).catch(() => {});
}

export async function fillSlot(dayIndex: number, slot: MealSlot, recipeIdOrText: string): Promise<PlanDay[]> {
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
