import { getJSON, setJSON, KEYS } from './db';
import { GroceryGroup, Recipe, Ingredient } from '../types/models';
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

/** Merges a flat list of ingredients into a working set of grocery groups in
 * place — combining with whatever's already there (and with each other)
 * rather than duplicating. Shared by addMissingIngredientsToGrocery (one
 * recipe, caller has already decided which ingredients to include) and
 * addRecipesToGrocery (several recipes at once, pantry staples excluded). */
function mergeIngredientsIntoGroups(groups: GroceryGroup[], ingredients: Ingredient[]): GroceryGroup[] {
  const next = groups.map((g) => ({ ...g, items: [...g.items] }));
  const byCategory = new Map(next.map((g) => [g.name, g]));
  for (const ing of ingredients) {
    const category = categorize(ing.name);
    let group = byCategory.get(category);
    if (!group) {
      group = { name: category, sub: '', items: [] };
      next.push(group);
      byCategory.set(category, group);
    }
    const existingItem = group.items.find((it) => it.n.toLowerCase() === ing.name.toLowerCase());
    if (existingItem) {
      existingItem.q = combineQty(existingItem.q, ing.qty, ing.unit);
    } else {
      // Flagged manual since this list is now only ever changed by explicit
      // user action (never auto-regenerated from the meal plan), so there's
      // nothing for the flag to protect against any more — it's kept only
      // because GroceryItem still has the field.
      group.items.push({ n: ing.name, q: `${ing.qty} ${ing.unit}`.trim(), checked: false, manual: true });
    }
  }
  return next;
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

/** Empties the list. The grocery list is never auto-regenerated from the
 * meal plan any more, so there's nothing to re-derive and bring items back —
 * Clear really does just clear it. */
export async function clearGrocery(): Promise<GroceryGroup[]> {
  await setGrocery([]);
  return [];
}

/** Adds a manually-typed item — merges into an existing item of the same
 * name (wherever it is) instead of creating a second line for it. Manual qty
 * is free text rather than a parsed number + unit, so it can't reuse
 * combineQty the way the recipe-sourced add functions do; two non-empty
 * quantities are just appended. */
export async function addManualItem(name: string, qty: string): Promise<GroceryGroup[]> {
  const groups = await getGrocery();
  const trimmedQty = qty.trim();
  const existingGroupIdx = groups.findIndex((g) => g.items.some((it) => it.n.toLowerCase() === name.toLowerCase()));

  if (existingGroupIdx >= 0) {
    const next = groups.map((g, gi) => {
      if (gi !== existingGroupIdx) return g;
      return {
        ...g,
        items: g.items.map((it) => {
          if (it.n.toLowerCase() !== name.toLowerCase()) return it;
          const combinedQty = !trimmedQty ? it.q : !it.q ? trimmedQty : `${it.q} + ${trimmedQty}`;
          return { ...it, q: combinedQty };
        }),
      };
    });
    await setGrocery(next);
    return next;
  }

  const category = categorize(name);
  const idx = groups.findIndex((g) => g.name === category);
  const item = { n: name, q: trimmedQty, checked: false, manual: true };
  let next: GroceryGroup[];
  if (idx >= 0) {
    next = groups.map((g, i) => (i === idx ? { ...g, items: [...g.items, item] } : g));
  } else {
    next = [...groups, { name: category, sub: '', items: [item] }];
  }
  await setGrocery(next);
  return next;
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
  const next = mergeIngredientsIntoGroups(groups, recipe.ingredients);
  await setGrocery(next);
  return next;
}

/** Adds every non-pantry-staple ingredient across several recipes to the
 * grocery list in one go, combining quantities across them (and with
 * whatever's already on the list) the same way addMissingIngredientsToGrocery
 * does for a single recipe. This is what the Meal Planner's per-day
 * "Add to grocery list" button calls — meal planning no longer syncs to the
 * grocery list on its own, so this explicit action is the only way a
 * planned day's ingredients end up there. */
export async function addRecipesToGrocery(recipes: Recipe[]): Promise<GroceryGroup[]> {
  const groups = await getGrocery();
  // have: true means it's a pantry staple the cook is assumed to already own
  // (soy sauce, salt, oil, etc.) — only what they'd actually need to shop
  // for goes on the list. Unlike addMissingIngredientsToGrocery, there's no
  // per-ingredient checkbox UI feeding this, so this filter is the only
  // thing standing in for "do I already have this".
  const ingredients = recipes.flatMap((r) => r.ingredients.filter((ing) => !ing.have));
  const next = mergeIngredientsIntoGroups(groups, ingredients);
  await setGrocery(next);
  return next;
}
