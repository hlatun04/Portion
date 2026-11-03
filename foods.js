/* Portion: food lookup and search across USDA foods, your own foods and your recipes. */
(function () {
  'use strict';
  const C = window.PortionCalc, S = window.PortionStore;
  const D = window.PORTION_FOODS;
  const n33 = C.KEYS.length;
  const byId = new Map();
  const index = [];
  const stem = w => w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && /(oes|ches|shes)$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
  const words = s => s.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim().split(' ').filter(Boolean);
  const LOW = /^(babyfood|school lunch|mcdonald|burger king|kfc|wendy|taco bell|subway|pizza hut|papa john|domino|little caesars|applebee|denny|t\.g\.i|olive garden|cracker barrel|carrabba|on the border|popeyes|campbell|keebler|kraft|kellogg|general mills|quaker|usda commodity)/i;

  D.rows.forEach((r, i) => {
    byId.set(r[0], i);
    const name = r[1], hay = words(name + ' ' + r[4]).map(stem);
    index.push({ i, hay, alias: words(r[4]).map(stem), low: LOW.test(name) || r[2] === D.groups.indexOf('Baby foods') });
  });

  function fromRow(r) {
    const per100 = [];
    for (let k = 0; k < n33; k++) { const v = r[7][k]; per100.push(v === undefined ? null : v); }
    return { id: r[0], kind: 'usda', name: r[1], group: D.groups[r[2]], common: !!r[3], desc: r[5], servings: r[6].map(s => ({ label: s[0], g: s[1] })), per100 };
  }
  const F = {};
  F.get = id => {
    if (id && id[0] === 'c') { const f = S.get('food:' + id); return f && !f.deleted ? f : null; }
    if (id && id[0] === 'r') { const f = S.get('recipe:' + id); return f && !f.deleted ? f : null; }
    const i = byId.get(id);
    return i === undefined ? null : fromRow(D.rows[i]);
  };
  F.custom = () => S.list('food:').filter(f => !f.deleted).sort((a, b) => a.name.localeCompare(b.name));
  F.recipes = () => S.list('recipe:').filter(f => !f.deleted).sort((a, b) => a.name.localeCompare(b.name));
  F.total = D.rows.length;
  F.common = group => D.rows.filter(r => r[3] && (!group || D.groups[r[2]] === group)).map(r => ({ id: r[0], name: r[1], kcal: r[7][0], group: D.groups[r[2]], servings: r[6] }));
  F.commonGroups = () => [...new Set(D.rows.filter(r => r[3]).map(r => D.groups[r[2]]))];

  function score(q, hay, nameWords, alias, base) {
    let s = base;
    for (const t of q) {
      let hit = -1;
      for (let i = 0; i < hay.length; i++) {
        const w = hay[i];
        if (w === t) { hit = Math.max(hit, 30); }
        else if (w.startsWith(t)) { hit = Math.max(hit, 18); }
        else if (t.length >= 4 && w.includes(t)) { hit = Math.max(hit, 6); }
      }
      if (hit < 0) return -1;
      s += hit;
      if (nameWords[0] === t) s += 25;
      if (alias.includes(t)) s += 40;
    }
    if (nameWords.join(' ') === q.join(' ')) s += 60;
    return s - nameWords.length * 1.5;
  }

  /* Returns the best matches. Your own foods come first, then common foods, then the rest of USDA. */
  F.search = (text, limit) => {
    const q = words(text).map(stem).filter(w => !['of', 'with', 'the'].includes(w));
    if (!q.length) return [];
    const out = [];
    for (const f of [...F.custom(), ...F.recipes()]) {
      const nw = words(f.name).map(stem), s = score(q, nw, nw, [], 2000);
      if (s > 0) out.push({ s, id: f.id, name: f.name, kcal: f.per100[0], tag: f.kind === 'recipe' ? 'Recipe' : 'My food', common: true });
    }
    for (const e of index) {
      const r = D.rows[e.i];
      const nw = r[3] ? words(r[1]).map(stem) : e.hay;
      const s = score(q, e.hay, nw, e.alias, r[3] ? 1000 : e.low ? 0 : 200);
      if (s > 0) out.push({ s, id: r[0], name: r[1], kcal: r[7][0], common: !!r[3], desc: r[5] });
    }
    out.sort((a, b) => b.s - a.s || a.name.length - b.name.length);
    return out.slice(0, limit || 40);
  };

  /* Serving choices for the amount picker. */
  F.servings = food => {
    const list = (food.servings || []).slice();
    list.push({ label: 'g', g: 1, unit: true }, { label: 'oz', g: C.G_PER_OZ, unit: true });
    return list;
  };
  F.matchServing = (list, unit) => {
    if (!unit) return list[0].unit ? list.find(s => s.label === 'g') : list[0];
    const u = unit.replace(/s$/, '').replace(/^(gram|gm)$/, 'g').replace(/^ounce$/, 'oz').replace(/^tablespoon$/, 'tbsp').replace(/^teaspoon$/, 'tsp');
    return list.find(s => s.label === u) || list.find(s => s.label.toLowerCase().includes(u)) || list[0];
  };

  window.PortionFoods = F;
})();
