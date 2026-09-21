import { getJSON, setJSON, KEYS } from './db';
import { PantryItem, Country } from '../types/models';
import { pushPantry } from '../lib/sync';
import { getOnboarding } from './onboarding';

const COUNTRY_STAPLES: Partial<Record<Country, PantryItem[]>> = {
  Filipino: [
    { name: 'Patis (fish sauce)', have: true },
    { name: 'Toyo (soy sauce)', have: true },
    { name: 'Suka (vinegar)', have: true },
    { name: 'Bagoong', have: false },
  ],
  Italian: [
    { name: 'Olive oil', have: true },
    { name: 'Parmesan cheese', have: true },
    { name: 'Canned tomatoes', have: true },
    { name: 'Balsamic vinegar', have: false },
  ],
  American: [
    { name: 'BBQ sauce', have: true },
    { name: 'Ketchup', have: true },
    { name: 'Worcestershire sauce', have: false },
    { name: 'Yellow mustard', have: true },
  ],
  Mexican: [
    { name: 'Lime', have: true },
    { name: 'Cumin', have: true },
    { name: 'Chili powder', have: true },
    { name: 'Corn tortillas', have: false },
  ],
};

const BASE_STAPLES: PantryItem[] = [
  { name: 'Garlic', have: true },
  { name: 'Onion', have: true },
  { name: 'Chili', have: false },
];

async function buildSeedPantry(): Promise<PantryItem[]> {
  const onboarding = await getOnboarding();
  const countries = onboarding.quiz.countries.length ? onboarding.quiz.countries : (['Filipino'] as Country[]);
  const staples = countries.flatMap((c) => COUNTRY_STAPLES[c] ?? []);
  return [...staples, ...BASE_STAPLES];
}

export async function getPantry(): Promise<PantryItem[]> {
  return getJSON<PantryItem[]>(KEYS.pantry, await buildSeedPantry());
}

export async function setPantry(items: PantryItem[]): Promise<void> {
  await setJSON(KEYS.pantry, items);
  pushPantry(items).catch(() => {});
}

export async function toggleHave(name: string): Promise<PantryItem[]> {
  const items = await getPantry();
  const next = items.map((i) => (i.name === name ? { ...i, have: !i.have } : i));
  await setPantry(next);
  return next;
}

export function lowStockItems(items: PantryItem[]): PantryItem[] {
  return items.filter((i) => !i.have);
}
