/* Portion: pure calculations. No screen code here, so this file can be tested on its own
   and reused unchanged in a future App Store build. */
(function (root) {
  'use strict';
  const KCAL_PER_KG = 7700;      // about 3,500 kcal per pound of body weight
  const KG_PER_LB = 0.45359237;
  const CM_PER_IN = 2.54;
  const G_PER_OZ = 28.3495;
  const MIN_KCAL = { male: 1500, female: 1200 }; // lowest budget the app will set

  const ACTIVITY = [
    { id: 'sedentary', factor: 1.2, label: 'Mostly sitting', hint: 'Desk job, little walking' },
    { id: 'light', factor: 1.375, label: 'Lightly active', hint: 'On your feet for part of the day' },
    { id: 'active', factor: 1.55, label: 'Active', hint: 'On your feet most of the day' },
    { id: 'very', factor: 1.725, label: 'Very active', hint: 'Physical work all day' }
  ];

  /* Mifflin-St Jeor resting energy, kcal per day */
  function bmr(sex, kg, cm, age) {
    return 10 * kg + 6.25 * cm - 5 * age + (sex === 'male' ? 5 : -161);
  }
  function bmi(kg, cm) { const m = cm / 100; return kg / (m * m); }
  function bmiCategory(v) {
    if (v < 18.5) return { id: 'under', label: 'Underweight' };
    if (v < 25) return { id: 'healthy', label: 'Healthy weight' };
    if (v < 30) return { id: 'over', label: 'Overweight' };
    return { id: 'obese', label: 'Obesity' };
  }
  function healthyRangeKg(cm) { const m = cm / 100; return [18.5 * m * m, 24.9 * m * m]; }

  function ageFrom(p, now) { return (now || new Date()).getFullYear() - p.birthYear; }

  /* Daily calorie plan from a saved profile */
  function plan(p, now) {
    const age = ageFrom(p, now);
    const rest = bmr(p.sex, p.weightKg, p.heightCm, age);
    const act = ACTIVITY.find(a => a.id === p.activity) || ACTIVITY[0];
    const maintain = rest * act.factor;
    const sign = p.goal === 'lose' ? -1 : p.goal === 'gain' ? 1 : 0;
    const wanted = maintain + sign * (p.weeklyKg || 0) * KCAL_PER_KG / 7;
    const floor = MIN_KCAL[p.sex] || 1200;
    let budget = wanted, limited = false;
    if (budget < floor) { budget = floor; limited = true; }
    if (p.customKcal) { budget = Math.max(p.customKcal, floor); limited = p.customKcal < floor; }
    budget = Math.round(budget);
    const dailyChange = budget - maintain;
    const weeklyKg = dailyChange * 7 / KCAL_PER_KG;
    let weeks = null;
    if (p.goal !== 'maintain' && p.goalKg && Math.abs(weeklyKg) > 0.01) {
      const w = (p.goalKg - p.weightKg) / weeklyKg;
      if (w > 0) weeks = w;
    }
    return { age, bmr: Math.round(rest), maintain: Math.round(maintain), budget, limited, weeklyKg, weeks };
  }

  /* Calories an exercise adds above what the body burns at rest anyway.
     Resting calories are already in the daily budget, so 1 MET is removed to avoid counting them twice. */
  function exerciseKcal(met, kg, minutes) {
    return Math.max(0, (met - 1)) * 3.5 * kg / 200 * minutes;
  }

  /* Adult Dietary Reference Intakes. Sodium is a limit; potassium uses the 2019 update. */
  function targets(p, budget, now) {
    const age = ageFrom(p, now), m = p.sex === 'male', old = age > 50, vold = age > 70;
    const macro = p.macros || { carb: 50, protein: 20, fat: 30 };
    return {
      kcal: budget,
      carb: budget * macro.carb / 100 / 4,
      protein: budget * macro.protein / 100 / 4,
      fat: budget * macro.fat / 100 / 9,
      fiber: budget / 1000 * 14,
      satfat: { limit: budget * 0.10 / 9 },
      chol: { limit: 300 },
      sodium: { limit: 2300 },
      potassium: m ? 3400 : 2600,
      calcium: vold || (!m && old) ? 1200 : 1000,
      iron: !m && !old ? 18 : 8,
      magnesium: m ? (age <= 30 ? 400 : 420) : (age <= 30 ? 310 : 320),
      phosphorus: 700,
      zinc: m ? 11 : 8,
      copper: 0.9,
      manganese: m ? 2.3 : 1.8,
      selenium: 55,
      vitA: m ? 900 : 700,
      vitC: m ? 90 : 75,
      vitD: vold ? 20 : 15,
      vitE: 15,
      vitK: m ? 120 : 90,
      thiamin: m ? 1.2 : 1.1,
      riboflavin: m ? 1.3 : 1.1,
      niacin: m ? 16 : 14,
      vitB6: old ? (m ? 1.7 : 1.5) : 1.3,
      folate: 400,
      vitB12: 2.4,
      panto: 5,
      choline: m ? 550 : 425
    };
  }

  /* Display details for every nutrient the app tracks, in label order. */
  const NUTRIENTS = {
    kcal: ['Calories', 'kcal'], protein: ['Protein', 'g'], fat: ['Total fat', 'g'], carb: ['Carbohydrate', 'g'],
    fiber: ['Fiber', 'g'], sugar: ['Total sugars', 'g'], satfat: ['Saturated fat', 'g'], monofat: ['Monounsaturated fat', 'g'],
    polyfat: ['Polyunsaturated fat', 'g'], chol: ['Cholesterol', 'mg'], sodium: ['Sodium', 'mg'], potassium: ['Potassium', 'mg'],
    calcium: ['Calcium', 'mg'], iron: ['Iron', 'mg'], magnesium: ['Magnesium', 'mg'], phosphorus: ['Phosphorus', 'mg'], zinc: ['Zinc', 'mg'],
    copper: ['Copper', 'mg'], manganese: ['Manganese', 'mg'], selenium: ['Selenium', 'mcg'], vitA: ['Vitamin A', 'mcg'], vitC: ['Vitamin C', 'mg'],
    vitD: ['Vitamin D', 'mcg'], vitE: ['Vitamin E', 'mg'], vitK: ['Vitamin K', 'mcg'], thiamin: ['Thiamin (B1)', 'mg'], riboflavin: ['Riboflavin (B2)', 'mg'],
    niacin: ['Niacin (B3)', 'mg'], vitB6: ['Vitamin B6', 'mg'], folate: ['Folate', 'mcg'], vitB12: ['Vitamin B12', 'mcg'], panto: ['Pantothenic acid (B5)', 'mg'], choline: ['Choline', 'mg']
  };
  const KEYS = Object.keys(NUTRIENTS);

  /* Nutrient arrays are aligned to KEYS. null means USDA has no value. */
  function scale(per100, grams) {
    return per100.map(v => (v === null || v === undefined) ? null : v * grams / 100);
  }
  function emptyTotals() { return { sum: KEYS.map(() => 0), known: KEYS.map(() => 0), count: 0 }; }
  function addTo(t, n) {
    t.count++;
    KEYS.forEach((_, i) => { if (n[i] !== null && n[i] !== undefined) { t.sum[i] += n[i]; t.known[i]++; } });
    return t;
  }
  function totals(entries) { return entries.reduce((t, e) => addTo(t, e.n), emptyTotals()); }

  /* Mixing calculation: adds every ingredient, then divides by the finished weight.
     finalGrams is optional; leave it out to use the raw ingredient weight. */
  function mixRecipe(ingredients, finalGrams) {
    const raw = ingredients.reduce((g, i) => g + i.grams, 0);
    const weight = finalGrams > 0 ? finalGrams : raw;
    const t = totals(ingredients.map(i => ({ n: scale(i.per100, i.grams) })));
    const per100 = t.sum.map((v, i) => t.known[i] === 0 ? null : (weight > 0 ? v * 100 / weight : 0));
    return { rawGrams: raw, grams: weight, total: t.sum, per100, missing: KEYS.filter((_, i) => t.known[i] < ingredients.length) };
  }

  /* Reads phrases such as "1 slice of cake", "I ate 2 eggs" or "200 g rice". */
  function parseQuick(text) {
    let s = String(text || '').trim().toLowerCase().replace(/^(i\s+(ate|had|drank)|ate|had)\s+/, '');
    const frac = { '½': .5, '¼': .25, '¾': .75, '1/2': .5, '1/4': .25, '3/4': .75, 'half': .5, 'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4 };
    const m = s.match(/^(\d+(?:\.\d+)?|½|¼|¾|1\/2|1\/4|3\/4|half|an?|one|two|three|four)\s+(.+)$/);
    if (!m) return { qty: null, unit: null, term: s };
    const qty = frac[m[1]] !== undefined ? frac[m[1]] : parseFloat(m[1]);
    let rest = m[2].trim(), unit = null;
    const u = rest.match(/^(slices?|pieces?|cups?|bowls?|plates?|tbsp|tablespoons?|tsp|teaspoons?|grams?|gm|g|ounces?|oz|servings?|fl oz|glass(?:es)?|cans?|bottles?|scoops?)\b\.?\s*(?:of\s+)?(.+)$/);
    if (u) { unit = u[1]; rest = u[2]; }
    const g = rest.match(/^(?:of\s+)(.+)$/); if (g) rest = g[1];
    return { qty, unit, term: rest.trim() };
  }

  const api = { KCAL_PER_KG, KG_PER_LB, CM_PER_IN, G_PER_OZ, MIN_KCAL, ACTIVITY, NUTRIENTS, KEYS, bmr, bmi, bmiCategory, healthyRangeKg, ageFrom, plan, exerciseKcal, targets, scale, totals, mixRecipe, parseQuick };
  root.PortionCalc = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
