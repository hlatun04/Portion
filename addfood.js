/* Portion: finding a food and choosing how much. Used by the diary and by the recipe builder. */
(function () {
  'use strict';
  const C = window.PortionCalc, S = window.PortionStore, F = window.PortionFoods, U = window.PortionUI;
  const A = {};

  const round = n => n.map(v => v === null ? null : +v.toFixed(3));

  function resultRow(r, extra) {
    return `<button class="row-btn" data-food="${U.esc(r.id)}" ${extra || ''}>
      <span class="row-main"><span class="row-title">${U.esc(r.name)}</span>
      ${r.tag ? `<span class="row-sub">${U.esc(r.tag)}</span>` : ''}</span>
      <span class="row-num">${U.int(r.kcal || 0)}<small>kcal/100 g</small></span></button>`;
  }
  A.resultRow = resultRow;

  /* opts: { title, onPick(food, {qty, unit}) } */
  A.picker = opts => U.sheet(opts.title || 'Add food', (el, api) => {
    el.innerHTML = `<div class="search-box">${U.icon('search', 20)}<input id="food-search" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Try: 1 slice of cake" aria-label="Search foods"></div>
      <div id="food-results"></div>`;
    const input = el.querySelector('#food-search'), out = el.querySelector('#food-results');
    let parsed = { qty: null, unit: null };

    const idle = () => {
      const meta = S.meta(), list = id => { const f = F.get(id); return f ? { id, name: f.name, kcal: f.per100[0] } : null; };
      const fav = (meta.favorites || []).map(list).filter(Boolean), rec = (meta.recents || []).map(list).filter(Boolean).slice(0, 12);
      const sec = (t, a) => a.length ? `<h3 class="sec">${t}</h3><div class="group">${a.map(r => resultRow(r)).join('')}</div>` : '';
      const mine = [...F.recipes(), ...F.custom()].map(f => ({ id: f.id, name: f.name, kcal: f.per100[0], tag: f.kind === 'recipe' ? 'Recipe' : 'My food' }));
      out.innerHTML = (sec('Favorites', fav) + sec('Recent', rec) + sec('My foods and recipes', mine)) ||
        `<p class="empty">Search ${F.total.toLocaleString('en-US')} foods by name, for example rice, lentils or burger. You can type the amount too: 2 eggs, or 200 g rice.</p>`;
    };
    const run = () => {
      const q = input.value.trim();
      if (!q) { parsed = { qty: null, unit: null }; return idle(); }
      const p = C.parseQuick(q);
      let res = F.search(p.term);
      parsed = p;
      if (!res.length) { res = F.search(q); parsed = { qty: null, unit: null }; }
      out.innerHTML = res.length ? `<div class="group">${res.map(r => resultRow(r)).join('')}</div>` :
        `<p class="empty">No food called "${U.esc(q)}" yet.</p><button class="btn" data-new>Create "${U.esc(q)}"</button>`;
    };
    let t; input.oninput = () => { clearTimeout(t); t = setTimeout(run, 90); };
    out.onclick = e => {
      if (e.target.closest('[data-new]')) { api.close(); window.PortionLibrary.chooseNew(input.value.trim()); return; }
      const b = e.target.closest('[data-food]'); if (!b) return;
      const food = F.get(b.dataset.food); if (food) opts.onPick(food, parsed, api);
    };
    idle();
    if (window.matchMedia('(min-width: 768px)').matches) setTimeout(() => input.focus(), 50);
  });

  /* opts: { food, qty, unit, confirm, remove, extra(el) , onSave({qty, serving, grams, n}) } */
  A.amount = opts => U.sheet(opts.food.name, (el, api) => {
    const food = opts.food, list = F.servings(food);
    let serving = F.matchServing(list, opts.unit);
    if (opts.servingLabel) serving = list.find(s => s.label === opts.servingLabel) || serving;
    let qty = opts.qty || (serving.unit ? (serving.label === 'g' ? 100 : 1) : 1);
    const meta = S.meta(), isFav = () => (S.meta().favorites || []).includes(food.id);

    el.innerHTML = `
      ${food.desc ? `<p class="source">USDA: ${U.esc(food.desc)}</p>` : ''}
      <div class="amount">
        <button class="step" data-step="-1" aria-label="Less">&minus;</button>
        <input id="amt-qty" inputmode="decimal" value="${qty}" aria-label="Amount">
        <button class="step" data-step="1" aria-label="More">+</button>
      </div>
      <div class="chips" id="amt-serv" role="group" aria-label="Serving">${list.map((s, i) => `<button class="chip ${s === serving ? 'on' : ''}" data-s="${i}">${U.esc(s.unit ? (s.label === 'g' ? 'grams' : 'ounces') : s.label)}</button>`).join('')}</div>
      <div id="amt-sum"></div>
      <div id="amt-extra"></div>
      <div class="btn-row">
        ${opts.remove ? `<button class="btn ghost danger-text" id="amt-del">Remove</button>` : ''}
        <button class="btn" id="amt-save">${U.esc(opts.confirm || 'Add')}</button>
      </div>
      ${opts.noFav ? '' : `<button class="link-btn" id="amt-fav">${U.icon('star', 18)}<span></span></button>`}
      <details class="more"><summary>Full nutrition</summary><div id="amt-facts"></div></details>`;

    const inp = el.querySelector('#amt-qty'), sum = el.querySelector('#amt-sum');
    const grams = () => (parseFloat(inp.value) || 0) * serving.g;
    const update = () => {
      const g = grams(), n = C.scale(food.per100, g), at = i => n[i] === null ? 0 : n[i];
      sum.innerHTML = `<div class="amt-sum"><div class="amt-kcal"><strong>${U.int(at(0))}</strong> kcal<small>${U.num(g, 0)} g</small></div>
        <div class="macro-mini"><span class="m-c">Carbs <b>${U.num(at(3), 1)} g</b></span><span class="m-p">Protein <b>${U.num(at(1), 1)} g</b></span><span class="m-f">Fat <b>${U.num(at(2), 1)} g</b></span></div></div>`;
      el.querySelector('#amt-facts').innerHTML = U.factsLabel(n, { serving: `${U.num(g, 0)} g` });
      el.querySelector('#amt-save').disabled = g <= 0;
    };
    inp.oninput = update;
    el.onclick = e => {
      const st = e.target.closest('[data-step]');
      if (st) {
        const step = serving.label === 'g' ? 10 : serving.unit ? 1 : .5;
        inp.value = Math.max(0, +((parseFloat(inp.value) || 0) + st.dataset.step * step).toFixed(2));
        update();
      }
      const ch = e.target.closest('[data-s]');
      if (ch) {
        const old = grams(); serving = list[+ch.dataset.s];
        if (serving.unit) inp.value = +(old / serving.g).toFixed(serving.label === 'g' ? 0 : 1);
        else if (parseFloat(inp.value) > 20 || old === 0) inp.value = 1;
        else inp.value = +(old / serving.g).toFixed(2) || 1;
        el.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === ch));
        update();
      }
    };
    const save = () => {
      const g = grams(); if (g <= 0) return;
      const q = parseFloat(inp.value);
      opts.onSave({ qty: q, serving: serving.label, grams: g, n: round(C.scale(food.per100, g)) });
      api.close();
    };
    el.querySelector('#amt-save').onclick = save;
    if (opts.remove) el.querySelector('#amt-del').onclick = () => { opts.remove(); api.close(); };
    const fav = el.querySelector('#amt-fav');
    const favText = () => { if (!fav) return; fav.classList.toggle('on', isFav()); fav.querySelector('span').textContent = isFav() ? 'Remove from favorites' : 'Add to favorites'; };
    if (fav) fav.onclick = () => {
      const f = S.meta().favorites || [];
      S.setMeta({ favorites: isFav() ? f.filter(x => x !== food.id) : [food.id, ...f] }); favText();
    };
    if (opts.extra) opts.extra(el.querySelector('#amt-extra'));
    favText(); update();
  });

  A.amountText = (qty, serving, grams) => {
    if (serving === 'g') return `${U.num(grams, 0)} g`;
    if (serving === 'oz') return `${U.num(qty, 1)} oz`;
    const m = serving.match(/^1 (.+)$/);
    return m ? `${U.num(qty, 2)} ${m[1]}` : `${U.num(qty, 2)} × ${serving}`;
  };

  /* Diary flow */
  A.logFood = (date, meal, food, q, entry, pickerApi) => A.amount({
    food, qty: entry ? entry.qty : q && q.qty, unit: q && q.unit, servingLabel: entry && entry.serving,
    confirm: entry ? 'Save changes' : `Add to ${meal}`,
    remove: entry ? () => {
      const d = S.day(date); d.foods = d.foods.filter(x => x.id !== entry.id); d.del = [...(d.del || []), entry.id];
      S.saveDay(d, window.PortionApp.budget()); window.PortionApp.render(); U.toast('Removed');
    } : null,
    onSave: v => {
      const d = S.day(date);
      const row = Object.assign(entry ? d.foods.find(x => x.id === entry.id) : { id: S.uid('e'), foodId: food.id, name: food.name, meal }, v);
      if (!entry) d.foods.push(row);
      S.saveDay(d, window.PortionApp.budget());
      const m = S.meta(); S.setMeta({ recents: [food.id, ...(m.recents || []).filter(x => x !== food.id)].slice(0, 30) });
      pickerApi && pickerApi.close(); window.PortionApp.render(); U.toast(entry ? 'Saved' : `Added to ${meal}`);
    }
  });
  A.addTo = (date, meal) => A.picker({
    title: `Add to ${meal}`,
    onPick: (food, q, api) => A.logFood(date, meal, food, q, null, api)
  });

  window.PortionAdd = A;
})();
