import { getJSON, setJSON, KEYS } from './db';
import { PlanDay, MealSlot, Recipe } from '../types/models';
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
  const stored = await getJSON<PlanDay[]>(KEYS.plan, []);
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

export async function clearWeek(): Promise<PlanDay[]> {
  const plan = await getPlan();
  const next = plan.map((d) => ({ ...d, breakfast: null, lunch: null, merienda: null, dinner: null }));
  await setPlan(next);
  return next;
}

/** Fills empty slots with real recipe ids cycled from the given library —
 * previously this used hardcoded dish-name strings that matched no actual
 * recipe, which silently broke anything keyed off a real Recipe object for
 * an auto-filled day (grocery-list ingredients, budget totals, etc). */
export async function autoFillWeek(recipes: Recipe[]): Promise<PlanDay[]> {
  const plan = await getPlan();
  if (recipes.length === 0) return plan;
  let idx = 0;
  const pick = () => recipes[idx++ % recipes.length].id;
  const next = plan.map((d) => ({
    ...d,
    breakfast: d.breakfast || pick(),
    lunch: d.lunch || pick(),
    merienda: d.merienda || pick(),
    dinner: d.dinner || pick(),
  }));
  await setPlan(next);
  return next;
}
