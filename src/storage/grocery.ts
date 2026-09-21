import { getJSON, setJSON, KEYS } from './db';
import { seedGrocery } from './seed';
import { GroceryGroup, PlanDay, Recipe, MealSlot } from '../types/models';
import { pushGrocery } from '../lib/sync';

const GROUP_ORDER = ['Produce', 'Meat', 'Seafood', 'Pantry & Condiments'];

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
  return 'Pantry & Condiments';
}

export async function getGrocery(): Promise<GroceryGroup[]> {
  return getJSON<GroceryGroup[]>(KEYS.grocery, seedGrocery());
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

export async function addManualItem(name: string, qty: string): Promise<GroceryGroup[]> {
  const groups = await getGrocery();
  const category = categorize(name);
  const idx = groups.findIndex((g) => g.name === category);
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

  const derived = new Map<string, { name: string; qty: string; category: string }>();
  for (const day of plan) {
    for (const slot of ['breakfast', 'lunch', 'merienda', 'dinner'] as MealSlot[]) {
      const val = day[slot];
      if (!val) continue;
      const recipe = byId.get(val);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        if (ing.have) continue;
        const key = ing.name.toLowerCase();
        if (derived.has(key)) continue;
        derived.set(key, { name: ing.name, qty: `${ing.qty} ${ing.unit}`.trim(), category: categorize(ing.name) });
      }
    }
  }

  const groups: GroceryGroup[] = GROUP_ORDER.map((name) => ({ name, sub: '', items: [] }));
  const byCategory = new Map(groups.map((g) => [g.name, g]));

  for (const { name, qty, category } of derived.values()) {
    const group = byCategory.get(category) ?? byCategory.get('Pantry & Condiments')!;
    group.items.push({ n: name, q: qty, checked: checkedByName.get(name.toLowerCase()) ?? false });
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

export async function addMissingIngredientsToGrocery(recipe: Recipe): Promise<GroceryGroup[]> {
  const groups = await getGrocery();
  const next = groups.map((g) => ({ ...g, items: [...g.items] }));
  const byCategory = new Map(next.map((g) => [g.name, g]));
  for (const ing of recipe.ingredients) {
    if (ing.have) continue;
    const category = categorize(ing.name);
    let group = byCategory.get(category);
    if (!group) {
      group = { name: category, sub: '', items: [] };
      next.push(group);
      byCategory.set(category, group);
    }
    if (!group.items.some((it) => it.n.toLowerCase() === ing.name.toLowerCase())) {
      group.items.push({ n: ing.name, q: `${ing.qty} ${ing.unit}`.trim(), checked: false });
    }
  }
  await setGrocery(next);
  return next;
}
