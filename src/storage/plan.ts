import { getJSON, setJSON, KEYS } from './db';
import { PlanDay, Recipe } from '../types/models';
import { pushPlan } from '../lib/sync';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// A fresh day starts with this many empty placeholder slots; Auto-fill turns
// all of them into real dishes, and "+ Add a dish" appends more beyond it.
const DEFAULT_DISH_COUNT = 2;

/** The real Mon–Sun dates for the week containing today — recomputed on
 * every call so the planner never shows a stale calendar. Dishes are still
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

function withMinimumDishes(dishes: (string | null)[]): (string | null)[] {
  if (dishes.length >= DEFAULT_DISH_COUNT) return dishes;
  return [...dishes, ...Array(DEFAULT_DISH_COUNT - dishes.length).fill(null)];
}

export async function getPlan(): Promise<PlanDay[]> {
  const stored = await getJSON<PlanDay[]>(KEYS.plan, []);
  const week = currentWeekDates();
  return week.map((w, i) => ({
    day: w.day,
    date: w.date,
    dishes: withMinimumDishes(stored[i]?.dishes ?? []),
  }));
}

export async function setPlan(plan: PlanDay[]): Promise<void> {
  await setJSON(KEYS.plan, plan);
  pushPlan(plan).catch(() => {});
}

/** Replaces (or, with `null`, clears) the dish at an existing slot. */
export async function fillDish(dayIndex: number, dishIndex: number, recipeIdOrText: string | null): Promise<PlanDay[]> {
  const plan = await getPlan();
  const next = plan.map((d, i) =>
    i === dayIndex ? { ...d, dishes: d.dishes.map((val, di) => (di === dishIndex ? recipeIdOrText : val)) } : d,
  );
  await setPlan(next);
  return next;
}

/** Appends a new dish slot to a day, beyond its default two — this is what
 * the Meal Planner's "+ Add a dish" button calls. */
export async function addDish(dayIndex: number, recipeId: string): Promise<PlanDay[]> {
  const plan = await getPlan();
  const next = plan.map((d, i) => (i === dayIndex ? { ...d, dishes: [...d.dishes, recipeId] } : d));
  await setPlan(next);
  return next;
}

export async function clearWeek(): Promise<PlanDay[]> {
  const plan = await getPlan();
  const next = plan.map((d) => ({ ...d, dishes: Array(DEFAULT_DISH_COUNT).fill(null) }));
  await setPlan(next);
  return next;
}

/** Fills every empty placeholder slot with a real recipe id cycled from the
 * given library — previously this used hardcoded dish-name strings that
 * matched no actual recipe, which silently broke anything keyed off a real
 * Recipe object for an auto-filled day (grocery-list ingredients, budget
 * totals, etc). A fresh day has DEFAULT_DISH_COUNT empty slots, so this is
 * what gives it that many real dishes; any extra slots added with
 * "+ Add a dish" get filled too if left empty. */
export async function autoFillWeek(recipes: Recipe[]): Promise<PlanDay[]> {
  const plan = await getPlan();
  if (recipes.length === 0) return plan;
  let idx = 0;
  const pick = () => recipes[idx++ % recipes.length].id;
  const next = plan.map((d) => ({ ...d, dishes: d.dishes.map((val) => val || pick()) }));
  await setPlan(next);
  return next;
}
