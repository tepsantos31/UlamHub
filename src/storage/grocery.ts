import { getJSON, setJSON, KEYS } from './db';
import { GroceryGroup, PlanDay, Recipe, MealSlot } from '../types/models';
import { pushGrocery } from '../lib/sync';

const GROUP_ORDER = ['Produce', 'Meat', 'Seafood', 'Pantry & Condiments'];

// There's no ingredient database to look up — grouping is a cheap keyword
// guess instead. Order matters below: an ingredient is tested against
// Seafood, then Meat, then Produce, so a word that could plausibly belong
// to more than one list resolves to whichever category is checked first.
const SEAFOOD_WORDS = ['shrimp', 'fish', 'tanigue', 'bangus', 'tilapia', 'squid', 'crab', 'prawn', 'bagoong'];
const MEAT_WORDS = ['chicken', 'pork', 'beef', 'thigh', 'belly', 'meat', 'liver'];
const PRODUCE_WORDS = [
  'garlic', 'onion', 'ginger', 'tomato', 'kalamansi', 'calamansi', 'leaves', 'beans', 'eggplant',
  'spinach', 'vegetable', 'chili', 'sili', 'lemongrass', 'banana',
];

function categorize(name: string): string {
  const n = name.toLowerCase();
  if (SEAFOOD_WORDS.some((w) => n.includes(w))) return 'Seafood';
  if (MEAT_WORDS.some((w) => n.includes(w))) return 'Meat';
  if (PRODUCE_WORDS.some((w) => n.includes(w))) return 'Produce';
  // Anything unrecognized is assumed to be a pantry staple/condiment rather
  // than a fresh ingredient — the safer default for an unknown item.
  return 'Pantry & Condiments';
}

function formatQtyNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(2)));
}

function parseQty(q: string): { qty: number; unit: string } | null {
  const m = /^(-?\d+(?:\.\d+)?)\s*(.*)$/.exec(q.trim());
  if (!m) return null;
  return { qty: parseFloat(m[1]), unit: m[2].trim() };
}

/** Folds a newly-needed amount into an existing display quantity — summed
 * when the units match (two recipes both measuring garlic in cloves add up
 * to one real total), otherwise listed side by side rather than one of them
 * silently overwriting the other, since adding mismatched units together
 * would just be wrong. */
function combineQty(existingQ: string, addQty: number, addUnit: string): string {
  const existing = parseQty(existingQ);
  const unit = addUnit.trim();
  if (existing && existing.unit.toLowerCase() === unit.toLowerCase()) {
    return `${formatQtyNum(existing.qty + addQty)} ${existing.unit}`.trim();
  }
  return `${existingQ} + ${addQty} ${unit}`.trim();
}

// A stable fingerprint of which recipe sits in which slot — used only to
// notice whether the meal plan has actually changed since the list was last
// cleared (see clearGrocery/getDismissedKeys below), not stored anywhere a
// user would see it.
function planSignature(plan: PlanDay[]): string {
  return plan.map((d) => `${d.day}:${d.breakfast ?? ''}|${d.lunch ?? ''}|${d.merienda ?? ''}|${d.dinner ?? ''}`).join(',');
}

interface GroceryDismissal {
  planSignature: string;
  keys: string[]; // lowercased ingredient names
}

/** Plan-derived ingredient names that should stay off the list because the
 * user cleared them and nothing about the plan has changed since. The
 * dismissal is scoped to a specific plan snapshot — the moment the plan
 * actually changes (a swapped dish, an auto-fill, a cleared week), it's
 * treated as stale and ignored, so a genuinely new need for that ingredient
 * isn't suppressed forever. */
async function getDismissedKeys(plan: PlanDay[]): Promise<Set<string>> {
  const dismissal = await getJSON<GroceryDismissal | null>(KEYS.groceryDismissed, null);
  if (!dismissal || dismissal.planSignature !== planSignature(plan)) return new Set();
  return new Set(dismissal.keys);
}

export async function getGrocery(): Promise<GroceryGroup[]> {
  return getJSON<GroceryGroup[]>(KEYS.grocery, []);
}

export async function setGrocery(groups: GroceryGroup[]): Promise<void> {
  await setJSON(KEYS.grocery, groups);
  pushGrocery(groups).catch(() => {});
}

export async function toggleGroceryItem(groupIndex: number, itemIndex: number): Promise<GroceryGroup[]> {
  const groups = await getGrocery();
  const next = groups.map((g, gi) =>
    gi !== groupIndex ? g : { ...g, items: g.items.map((it, ii) => (ii !== itemIndex ? it : { ...it, checked: !it.checked })) },
  );
  await setGrocery(next);
  return next;
}

/** Empties the list. Plan-derived items (everything not flagged `manual`)
 * are remembered as dismissed for the current plan snapshot, so
 * regenerateFromPlan doesn't just put them straight back the next time this
 * screen opens — only an actual change to the meal plan brings them back. */
export async function clearGrocery(plan: PlanDay[]): Promise<GroceryGroup[]> {
  const existing = await getGrocery();
  const derivedKeys = existing.flatMap((g) => g.items.filter((it) => !it.manual).map((it) => it.n.toLowerCase()));
  await setJSON<GroceryDismissal>(KEYS.groceryDismissed, { planSignature: planSignature(plan), keys: derivedKeys });
  await setGrocery([]);
  return [];
}

export async function addManualItem(name: string, qty: string): Promise<GroceryGroup[]> {
  const groups = await getGrocery();
  const category = categorize(name);
  const idx = groups.findIndex((g) => g.name === category);
  // manual: true protects this item from regenerateFromPlan's weekly rebuild —
  // it isn't tied to any recipe/meal-plan slot, so without the flag it would
  // get silently dropped the next time the Grocery List screen loads.
  const item = { n: name, q: qty || '', checked: false, manual: true };
  let next: GroceryGroup[];
  if (idx >= 0) {
    next = groups.map((g, i) => (i === idx ? { ...g, items: [...g.items, item] } : g));
  } else {
    next = [...groups, { name: category, sub: '', items: [item] }];
  }
  await setGrocery(next);
  return next;
}

/** Rebuilds the auto-derived portion of the grocery list from this week's plan,
 * keeping any manual items and preserving checked-state for items that survive. */
export async function regenerateFromPlan(plan: PlanDay[], recipes: Recipe[]): Promise<GroceryGroup[]> {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const existing = await getGrocery();
  const checkedByName = new Map<string, boolean>();
  const manualItems: { category: string; item: GroceryGroup['items'][number] }[] = [];
  for (const g of existing) {
    for (const it of g.items) {
      checkedByName.set(it.n.toLowerCase(), it.checked);
      if (it.manual) manualItems.push({ category: g.name, item: it });
    }
  }

  const dismissed = await getDismissedKeys(plan);

  // Accumulate the amount needed across the whole week — two different
  // dinners both calling for garlic should both count, not just whichever
  // recipe happened to be scanned first.
  const derived = new Map<string, { name: string; q: string; category: string }>();
  for (const day of plan) {
    for (const slot of ['breakfast', 'lunch', 'merienda', 'dinner'] as MealSlot[]) {
      const val = day[slot];
      if (!val) continue;
      const recipe = byId.get(val);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        // have: true means it's a pantry staple the cook is assumed to
        // already own (soy sauce, salt, oil, etc.) — only the ingredients
        // they'd actually need to shop for go on the derived list.
        if (ing.have) continue;
        const key = ing.name.toLowerCase();
        if (dismissed.has(key)) continue;
        const current = derived.get(key);
        if (current) {
          current.q = combineQty(current.q, ing.qty, ing.unit);
        } else {
          derived.set(key, { name: ing.name, q: `${ing.qty} ${ing.unit}`.trim(), category: categorize(ing.name) });
        }
      }
    }
  }

  const groups: GroceryGroup[] = GROUP_ORDER.map((name) => ({ name, sub: '', items: [] }));
  const byCategory = new Map(groups.map((g) => [g.name, g]));

  for (const { name, q, category } of derived.values()) {
    const group = byCategory.get(category) ?? byCategory.get('Pantry & Condiments')!;
    group.items.push({ n: name, q, checked: checkedByName.get(name.toLowerCase()) ?? false });
  }
  for (const { category, item } of manualItems) {
    const group = byCategory.get(category) ?? byCategory.get('Pantry & Condiments')!;
    if (!group.items.some((it) => it.n.toLowerCase() === item.n.toLowerCase())) {
      group.items.push(item);
    }
  }

  const nonEmpty = groups.filter((g) => g.items.length > 0);
  await setGrocery(nonEmpty);
  return nonEmpty;
}

// The only caller (RecipeDetailScreen's "Add to grocery") already filters
// `recipe.ingredients` down to exactly what the user checked "need to buy"
// before calling this — so every ingredient reaching this function should be
// added, full stop. (Do not re-check `ing.have` here: that's the recipe's
// static seed default, and re-applying it would silently drop an ingredient
// the user explicitly checked despite its seed data saying they already
// have it.)
export async function addMissingIngredientsToGrocery(recipe: Recipe): Promise<GroceryGroup[]> {
  const groups = await getGrocery();
  const next = groups.map((g) => ({ ...g, items: [...g.items] }));
  const byCategory = new Map(next.map((g) => [g.name, g]));
  for (const ing of recipe.ingredients) {
    const category = categorize(ing.name);
    let group = byCategory.get(category);
    if (!group) {
      group = { name: category, sub: '', items: [] };
      next.push(group);
      byCategory.set(category, group);
    }
    // Adding the same ingredient from a second recipe should top up how much
    // is needed, not get silently skipped because something with that name
    // is already on the list.
    const existingItem = group.items.find((it) => it.n.toLowerCase() === ing.name.toLowerCase());
    if (existingItem) {
      existingItem.q = combineQty(existingItem.q, ing.qty, ing.unit);
    } else {
      // Flagged manual so regenerateFromPlan's weekly rebuild keeps it —
      // otherwise it's silently dropped the next time Grocery List opens,
      // since it isn't part of this week's meal plan.
      group.items.push({ n: ing.name, q: `${ing.qty} ${ing.unit}`.trim(), checked: false, manual: true });
    }
  }
  await setGrocery(next);
  return next;
}
