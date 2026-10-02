// Scaling by a servings ratio (e.g. x1.5) produces ugly floats like
// 83.33333 — round to 2 decimals, then drop a trailing .00/.50->.5 so a
// clean number like "4" doesn't render as "4.00".
export function formatNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(2)));
}

type MetricUnit = 'g' | 'kg' | 'ml' | 'l';

// Ingredient units are free-typed (manual entry) or AI-extracted, so the same
// metric unit shows up spelled many different ways ("Kg", "grams", "mL",
// "liters"...) — normalize every variant down to one of the four keys below
// before ever comparing against it. Matching the raw string directly (as
// this used to) meant only recipes that happened to type the unit exactly
// as "g"/"kg"/"ml"/"l" ever converted; everything else silently no-opped
// when switching to US, which is what made the toggle look broken.
const UNIT_ALIASES: Record<string, MetricUnit> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
};

// US customary equivalents for the metric units recipes are authored in.
const CONVERSIONS: Record<MetricUnit, { factor: number; unit: string }> = {
  g: { factor: 1 / 28.35, unit: 'oz' },
  kg: { factor: 2.205, unit: 'lb' },
  ml: { factor: 1 / 29.57, unit: 'fl oz' },
  l: { factor: 4.227, unit: 'cups' },
};

export function scaleIngredient(qty: number, unit: string, servingsRatio: number, system: 'metric' | 'imperial') {
  const scaledQty = qty * servingsRatio;
  const kind = UNIT_ALIASES[unit.trim().toLowerCase()];
  if (system === 'metric' || !kind) {
    // Rounded to the nearest 5 for g/ml specifically — a scaled quantity
    // like "83ml" reads as a precise measurement a home cook can't actually
    // hit; "85ml" reads like a normal recipe amount.
    const rounded = kind === 'ml' || kind === 'g' ? Math.round(scaledQty / 5) * 5 : scaledQty;
    return { qty: formatNum(rounded), unit };
  }
  const conv = CONVERSIONS[kind];
  return { qty: formatNum(scaledQty * conv.factor), unit: conv.unit };
}
