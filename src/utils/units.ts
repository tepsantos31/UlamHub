export function formatNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(parseFloat(r.toFixed(2)));
}

const CONVERSIONS: Record<string, { factor: number; unit: string }> = {
  g: { factor: 1 / 28.35, unit: 'oz' },
  kg: { factor: 2.205, unit: 'lb' },
  ml: { factor: 1 / 29.57, unit: 'fl oz' },
  l: { factor: 4.227, unit: 'cups' },
};

export function scaleIngredient(qty: number, unit: string, servingsRatio: number, system: 'metric' | 'imperial') {
  const scaledQty = qty * servingsRatio;
  if (system === 'metric' || !CONVERSIONS[unit]) {
    const rounded = unit === 'ml' || unit === 'g' ? Math.round(scaledQty / 5) * 5 : scaledQty;
    return { qty: formatNum(rounded), unit };
  }
  const conv = CONVERSIONS[unit];
  return { qty: formatNum(scaledQty * conv.factor), unit: conv.unit };
}
