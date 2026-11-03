/* Portion: the Foods tab, plus creating your own foods and recipes. */
(function () {
  'use strict';
  const C = window.PortionCalc, S = window.PortionStore, F = window.PortionFoods, U = window.PortionUI, A = window.PortionAdd;
  const L = {};
  let group = '', query = '';

  L.render = () => {
    const mine = F.custom(), rec = F.recipes(), groups = F.commonGroups();
    return `<header class="top"><h1>Foods</h1></header>
      <div class="search-box">${U.icon('search', 20)}<input id="lib-search" type="search" autocomplete="off" autocapitalize="off" placeholder="Search ${F.total.toLocaleString('en-US')} foods" value="${U.esc(query)}" aria-label="Search foods"></div>
      <div class="btn-row two"><button class="btn ghost" data-act="new-recipe">${U.icon('plus', 18)} New recipe</button><button class="btn ghost" data-act="new-food">${U.icon('plus', 18)} New food</button></div>
      <div id="lib-out"></div>`;
  };
  L.bind = root => {
    const out = root.querySelector('#lib-out'), input = root.querySelector('#lib-search');
    const browse = () => {
      const mine = [...F.recipes(), ...F.custom()];
      const list = F.common(group);
      out.innerHTML = `${mine.length ? `<h3 class="sec">My recipes and foods</h3><div class="group">${mine.map(f => A.resultRow({ id: f.id, name: f.name, kcal: f.per100[0], tag: f.kind === 'recipe' ? `Recipe, ${U.num(f.servingG, 0)} g per ${f.servingName}` : 'My food' })).join('')}</div>` : ''}
        <h3 class="sec">Common foods</h3>
        <div class="chips scroll"><button class="chip ${group ? '' : 'on'}" data-g="">All</button>${F.commonGroups().map(g => `<button class="chip ${g === group ? 'on' : ''}" data-g="${U.esc(g)}">${U.esc(g)}</button>`).join('')}</div>
        <div class="group">${list.map(r => A.resultRow(r)).join('')}</div>`;
    };
    const run = () => {
      query = input.value;
      if (!query.trim()) return browse();
      const res = F.search(query, 60);
      out.innerHTML = res.length ? `<div class="group">${res.map(r => A.resultRow(r)).join('')}</div>` : `<p class="empty">No food called "${U.esc(query)}". Create it from its ingredients, or enter the label values.</p>`;
    };
    let t; input.oninput = () => { clearTimeout(t); t = setTimeout(run, 90); };
    out.onclick = e => {
      const g = e.target.closest('[data-g]');
      if (g) { group = g.dataset.g; browse(); return; }
      const b = e.target.closest('[data-food]');
      if (b) L.details(b.dataset.food);
    };
    run();
  };

  L.details = id => {
    const f = F.get(id); if (!f) return;
    const P = window.PortionApp;
    A.amount({
      food: f, confirm: `Add to ${P.suggestMeal()}`, onSave: v => {
        const meal = P.suggestMeal(), d = S.day(S.today());
        d.foods.push(Object.assign({ id: S.uid('e'), foodId: f.id, name: f.name, meal }, v));
        S.saveDay(d, P.budget()); P.render(); U.toast(`Added to ${meal}`);
      },
      extra: el => {
        if (f.kind === 'usda') return;
        el.innerHTML = `<div class="btn-row two"><button class="btn ghost" id="edit-f">Edit</button><button class="btn ghost danger-text" id="del-f">Delete</button></div>`;
        el.querySelector('#edit-f').onclick = () => f.kind === 'recipe' ? L.recipe(f) : L.food(f);
        el.querySelector('#del-f').onclick = () => U.confirm(`Delete ${f.name}?`, 'Past diary entries stay as they are.', 'Delete', () => {
          S.set((f.kind === 'recipe' ? 'recipe:' : 'food:') + f.id, Object.assign({}, f, { deleted: true }));
          P.render(); U.toast('Deleted');
        });
      }
    });
  };

  /* Offered when a search finds nothing. */
  L.chooseNew = name => U.sheet(`Create ${name}`, (el, api) => {
    el.innerHTML = `<p class="muted">How would you like to add it?</p><div class="group">
      <button class="row-btn" id="n-r"><span class="row-main"><span class="row-title">From ingredients</span><span class="row-sub">Eggs, butter, flour and so on. Portion adds up the nutrients.</span></span></button>
      <button class="row-btn" id="n-f"><span class="row-main"><span class="row-title">From a nutrition label</span><span class="row-sub">Type the numbers from the package.</span></span></button></div>`;
    el.querySelector('#n-r').onclick = () => { api.close(); L.recipe({ name }); };
    el.querySelector('#n-f').onclick = () => { api.close(); L.food({ name }); };
  });

  /* Food from a nutrition label: values are typed per serving, stored per 100 g. */
  L.food = f => U.sheet(f && f.id ? 'Edit food' : 'New food', (el, api) => {
    f = f || {};
    const serv = (f.servings && f.servings[0]) || { label: '1 serving', g: 100 };
    const val = k => { const i = C.KEYS.indexOf(k); return f.per100 && f.per100[i] !== null ? +(f.per100[i] * serv.g / 100).toFixed(2) : ''; };
    const nf = (k, attrs) => { const [n, u] = C.NUTRIENTS[k]; return U.field('nf-' + k, `${n} (${u})`, val(k), `inputmode="decimal" ${attrs || ''}`); };
    const main = ['kcal', 'fat', 'satfat', 'carb', 'fiber', 'sugar', 'protein', 'chol', 'sodium'];
    const rest = C.KEYS.filter(k => !main.includes(k));
    el.innerHTML = `${U.field('nf-name', 'Food name', f.name || '', 'autocomplete="off"')}
      <div class="grid2">${U.field('nf-sl', 'Serving name', serv.label, 'autocomplete="off"')}${U.field('nf-sg', 'Serving weight (g)', serv.g, 'inputmode="decimal"')}</div>
      <h3 class="sec">Nutrition per serving</h3>
      <div class="grid2">${main.map(k => nf(k)).join('')}</div>
      <details class="more"><summary>Vitamins and minerals</summary><div class="grid2">${rest.map(k => nf(k)).join('')}</div></details>
      <p class="error" id="nf-err" hidden></p><button class="btn" id="nf-save">Save food</button>`;
    el.querySelector('#nf-save').onclick = () => {
      const g = v => el.querySelector('#' + v).value.trim();
      const name = g('nf-name'), sg = parseFloat(g('nf-sg')), kcal = parseFloat(g('nf-kcal')), err = el.querySelector('#nf-err');
      if (!name || !(sg > 0) || !(kcal >= 0)) { err.textContent = 'Enter a name, a serving weight and calories.'; err.hidden = false; return; }
      const per100 = C.KEYS.map(k => { const raw = g('nf-' + k); return raw === '' || isNaN(+raw) ? null : +raw * 100 / sg; });
      const id = f.id || S.uid('c');
      S.set('food:' + id, { id, kind: 'custom', name, per100, servings: [{ label: g('nf-sl') || '1 serving', g: sg }] });
      api.close(); window.PortionApp.render(); U.toast('Food saved');
    };
  });

  /* Recipe builder: the mixing calculation in calc.js adds up every ingredient. */
  L.recipe = r => U.sheet(r && r.id ? 'Edit recipe' : 'New recipe', (el, api) => {
    r = r || {};
    const items = (r.ingredients || []).map(i => Object.assign({}, i));
    let portions = r.servingsCount || 8, sized = r.servingG || null;
    el.innerHTML = `${U.field('r-name', 'Recipe name', r.name || '', 'autocomplete="off" placeholder="Cake"')}
      <h3 class="sec">Ingredients</h3><div class="group" id="r-items"></div>
      <button class="btn ghost" id="r-add">${U.icon('plus', 18)} Add ingredient</button>
      <h3 class="sec">Finished recipe</h3>
      ${U.field('r-final', 'Finished weight in grams (optional)', r.finalG || '', 'inputmode="decimal" placeholder="Weigh it after cooking"')}
      <p class="hint">Cooking changes weight as water escapes. Leave this blank to use the ingredient total.</p>
      <div class="grid2">${U.field('r-sname', 'Call one serving a', r.servingName || 'slice', 'autocomplete="off"')}${U.field('r-count', 'Number of servings', portions, 'inputmode="decimal"')}</div>
      ${U.field('r-size', 'Or weight of one serving (g)', '', 'inputmode="decimal"')}
      <div id="r-sum"></div><p class="error" id="r-err" hidden></p><button class="btn" id="r-save">Save recipe</button>`;
    const q = s => el.querySelector(s), box = q('#r-items'), sum = q('#r-sum');
    const mix = () => C.mixRecipe(items, parseFloat(q('#r-final').value) || 0);
    const serveG = m => sized || (m.grams / (parseFloat(q('#r-count').value) || 1));
    const update = (from) => {
      const m = mix(), sg = serveG(m), name = q('#r-sname').value || 'serving';
      box.innerHTML = items.length ? items.map((it, i) => `<button class="row-btn" data-i="${i}"><span class="row-main"><span class="row-title">${U.esc(it.name)}</span><span class="row-sub">${U.esc(A.amountText(it.qty, it.serving, it.grams))}</span></span><span class="row-num">${U.int(it.per100[0] * it.grams / 100)}<small>kcal</small></span></button>`).join('') : '<p class="empty small">Add each ingredient with its amount, for example 200 g flour.</p>';
      if (from !== 'size') q('#r-size').value = items.length ? +sg.toFixed(1) : '';
      if (from === 'size') q('#r-count').value = +(m.grams / sg).toFixed(1);
      if (!items.length) { sum.innerHTML = ''; return; }
      const f = sg / 100, at = i => (m.per100[i] || 0) * f;
      sum.innerHTML = `<div class="amt-sum recipe-sum"><div class="amt-kcal"><strong>${U.int(at(0))}</strong> kcal per ${U.esc(name)}<small>${U.num(sg, 1)} g each, ${U.num(m.grams, 0)} g in total</small></div>
        <div class="macro-mini"><span class="m-c">Carbs <b>${U.num(at(3), 1)} g</b></span><span class="m-p">Protein <b>${U.num(at(1), 1)} g</b></span><span class="m-f">Fat <b>${U.num(at(2), 1)} g</b></span></div></div>`;
    };
    q('#r-final').oninput = () => { sized = null; update(); };
    q('#r-count').oninput = () => { sized = null; update(); };
    q('#r-sname').oninput = () => update('name');
    q('#r-size').oninput = () => { const v = parseFloat(q('#r-size').value); sized = v > 0 ? v : null; if (sized) update('size'); };
    const addOne = (food, pr, pickerApi) => A.amount({
      food, qty: pr && pr.qty, unit: pr && pr.unit, confirm: 'Add ingredient', noFav: true,
      onSave: v => { items.push({ foodId: food.id, name: food.name, per100: food.per100, qty: v.qty, serving: v.serving, grams: v.grams }); pickerApi && pickerApi.close(); sized = null; update(); }
    });
    q('#r-add').onclick = () => A.picker({ title: 'Add ingredient', onPick: addOne });
    box.onclick = e => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const i = +b.dataset.i, it = items[i];
      const food = F.get(it.foodId) || { id: it.foodId, name: it.name, per100: it.per100, servings: [] };
      A.amount({
        food, qty: it.qty, servingLabel: it.serving, confirm: 'Save ingredient', noFav: true,
        remove: () => { items.splice(i, 1); sized = null; update(); },
        onSave: v => { Object.assign(it, { qty: v.qty, serving: v.serving, grams: v.grams }); sized = null; update(); }
      });
    };
    q('#r-save').onclick = () => {
      const name = q('#r-name').value.trim(), err = q('#r-err');
      if (!name || !items.length) { err.textContent = 'Enter a name and at least one ingredient.'; err.hidden = false; return; }
      const m = mix(), sg = serveG(m), sname = q('#r-sname').value.trim() || 'serving', id = r.id || S.uid('r');
      S.set('recipe:' + id, {
        id, kind: 'recipe', name, ingredients: items, finalG: parseFloat(q('#r-final').value) || null,
        per100: m.per100, servingName: sname, servingG: sg, servingsCount: m.grams / sg,
        servings: [{ label: '1 ' + sname, g: sg }]
      });
      api.close(); window.PortionApp.render(); U.toast('Recipe saved');
    };
    update();
  });

  window.PortionLibrary = L;
})();
