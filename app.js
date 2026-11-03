/* Portion: app shell, navigation and the Today screen. */
(function () {
  'use strict';
  const C = window.PortionCalc, S = window.PortionStore, F = window.PortionFoods, U = window.PortionUI;
  const A = window.PortionAdd, L = window.PortionLibrary, T = window.PortionTrack, P = window.PortionProfile;
  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const TABS = [['today', 'Today'], ['calendar', 'Calendar'], ['foods', 'Foods'], ['progress', 'Progress'], ['profile', 'Profile']];
  const App = {};
  let tab = 'today', date = S.today();

  App.budget = () => C.plan(S.profile()).budget;
  App.standalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  App.suggestMeal = () => { const h = new Date().getHours(); return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks'; };

  function today() {
    const p = S.profile(), plan = C.plan(p), d = S.day(date), goal = d.goal || plan.budget, tot = C.totals(d.foods), burned = d.exercise.reduce((s, e) => s + e.kcal, 0);
    const v = k => tot.sum[C.KEYS.indexOf(k)], eaten = v('kcal'), left = goal + burned - eaten, over = left < 0, tg = C.targets(p, goal);
    const pct = Math.min(100, eaten / (goal + burned || 1) * 100);
    const macro = (k, name, cls) => {
      const pc = v(k) / tg[k] * 100;
      return `<div class="mac ${cls}"><div class="mac-top"><span>${name}</span><span><b>${U.int(v(k))}</b> / ${U.int(tg[k])} g</span></div><div class="track"><i style="width:${Math.min(100, pc)}%"></i></div></div>`;
    };
    const isToday = date === S.today();
    const title = isToday ? 'Today' : date === S.addDays(S.today(), -1) ? 'Yesterday' : U.dateLong(date);
    const meal = m => {
      const items = d.foods.filter(f => f.meal === m), sum = items.reduce((s, e) => s + (e.n[0] || 0), 0);
      const prev = S.day(S.addDays(date, -1)).foods.filter(f => f.meal === m);
      return `<section class="meal"><div class="meal-head"><h2>${m}</h2><span class="meal-kcal">${items.length ? U.int(sum) + ' kcal' : ''}</span><button class="icon-btn add" data-act="add" data-meal="${m}" aria-label="Add to ${m}">${U.icon('plus', 22)}</button></div>
        ${items.map(e => `<button class="row-btn" data-act="entry" data-id="${e.id}"><span class="row-main"><span class="row-title">${U.esc(e.name)}</span><span class="row-sub">${U.esc(A.amountText(e.qty, e.serving, e.grams))}</span></span><span class="row-num">${U.int(e.n[0] || 0)}</span></button>`).join('')}
        ${!items.length && prev.length ? `<button class="link-btn" data-act="copy-meal" data-meal="${m}">Copy yesterday's ${m.toLowerCase()}</button>` : ''}</section>`;
    };
    const w = S.get('weight:' + date);
    return `<div class="today-layout">
      <div class="today-main">
        <div class="date-nav"><button class="icon-btn" data-act="day" data-d="-1" aria-label="Previous day">${U.icon('back')}</button>
          <button class="date-title" data-act="tab" data-tab="calendar"><h1>${title}</h1>${isToday ? `<span>${U.dateLong(date)}</span>` : ''}</button>
          <button class="icon-btn" data-act="day" data-d="1" aria-label="Next day" ${isToday ? 'disabled' : ''}>${U.icon('next')}</button></div>
        ${!isToday ? `<button class="link-btn jump" data-act="jump">Back to today</button>` : ''}
        <div class="ledger">
          <div class="f-title">Calories</div>
          <div class="f-rule thick"></div>
          <div class="f-cal"><span>${over ? 'Over budget' : 'Remaining'}</span><strong class="${over ? 'over' : ''}">${U.int(Math.abs(left))}</strong></div>
          <div class="budget-bar ${over ? 'over' : ''}"><i style="width:${pct}%"></i></div>
          <div class="f-rule mid"></div>
          <div class="f-row"><span><b>Budget</b></span><span>${U.int(goal)}</span></div>
          <div class="f-row"><span><b>Food</b></span><span>&minus; ${U.int(eaten)}</span></div>
          <div class="f-row"><span><b>Exercise</b></span><span>+ ${U.int(burned)}</span></div>
          <div class="f-rule thick"></div>
          ${macro('carb', 'Carbs', 'm-c')}${macro('protein', 'Protein', 'm-p')}${macro('fat', 'Fat', 'm-f')}
          <button class="link-btn" data-act="facts">See all nutrients and vitamins</button>
        </div>
        ${window.PORTION_DEMO ? '<p class="note">Example data. Your own copy starts empty and keeps everything on your device.</p>' : ''}
        ${App.backupDue() ? `<button class="note as-btn" data-act="backup">${U.icon('share', 18)} It has been a while since your last backup. Save one now.</button>` : ''}
      </div>
      <div class="today-side">
        ${MEALS.map(meal).join('')}
        <section class="meal"><div class="meal-head"><h2>Exercise</h2><span class="meal-kcal">${burned ? U.int(burned) + ' kcal' : ''}</span><button class="icon-btn add" data-act="add-ex" aria-label="Add exercise">${U.icon('plus', 22)}</button></div>
          ${d.exercise.map(e => `<button class="row-btn" data-act="edit-ex" data-id="${e.id}"><span class="row-main"><span class="row-title">${U.esc(e.name)}</span><span class="row-sub">${e.minutes ? e.minutes + ' min' : 'Entered by hand'}</span></span><span class="row-num">${U.int(e.kcal)}</span></button>`).join('')}</section>
        <section class="meal"><div class="meal-head"><h2>Weight</h2><span class="meal-kcal">${w ? U.weight(w.kg) : ''}</span><button class="icon-btn add" data-act="log-weight" aria-label="Log weight">${w ? U.icon('scale', 20) : U.icon('plus', 22)}</button></div></section>
      </div></div>`;
  }

  App.backupDue = () => {
    if (window.PORTION_DEMO) return false;
    const m = S.meta(), days = S.list('day:').length;
    if (days < 3) return false;
    return !m.lastBackup || (Date.now() - S.parseDate(m.lastBackup).getTime()) / 864e5 >= 14;
  };

  function exerciseSheet(entry) {
    U.sheet(entry ? 'Edit exercise' : 'Add exercise', (el, api) => {
      const list = window.PORTION_EXERCISES, kg = S.profile().weightKg;
      let chosen = entry && entry.met ? entry : null, q = '';
      const form = ex => {
        const manual = !ex;
        el.innerHTML = `${manual ? U.field('x-name', 'Activity', entry ? entry.name : '', 'autocomplete="off"') + U.field('x-kcal', 'Calories burned', entry ? Math.round(entry.kcal) : '', 'inputmode="numeric"') + '<p class="hint">Use this for a number from Apple Watch or a gym machine.</p>' :
          `<p class="row-title big">${U.esc(ex.name)}</p>${U.field('x-min', 'Minutes', entry ? entry.minutes : 30, 'inputmode="numeric"')}<div id="x-sum" class="amt-sum"></div>`}
          <div class="btn-row">${entry ? '<button class="btn ghost danger-text" id="x-del">Remove</button>' : ''}<button class="btn" id="x-save">${entry ? 'Save changes' : 'Add exercise'}</button></div>`;
        const kcal = () => manual ? parseFloat(el.querySelector('#x-kcal').value) || 0 : C.exerciseKcal(ex.met, kg, parseFloat(el.querySelector('#x-min').value) || 0);
        if (!manual) {
          const up = () => { el.querySelector('#x-sum').innerHTML = `<div class="amt-kcal"><strong>${U.int(kcal())}</strong> kcal<small>at ${U.weight(kg, 0)}, above resting</small></div>`; };
          el.querySelector('#x-min').oninput = up; up();
        }
        el.querySelector('#x-save').onclick = () => {
          const k = kcal(), name = manual ? el.querySelector('#x-name').value.trim() : ex.name; if (!(k > 0) || !name) return;
          const day = S.day(date), row = { id: entry ? entry.id : S.uid('x'), name, kcal: k, met: manual ? null : ex.met, minutes: manual ? null : parseFloat(el.querySelector('#x-min').value) };
          day.exercise = entry ? day.exercise.map(e => e.id === entry.id ? row : e) : [...day.exercise, row];
          S.saveDay(day, App.budget()); api.close(); App.render(); U.toast('Exercise saved');
        };
        if (entry) el.querySelector('#x-del').onclick = () => { const day = S.day(date); day.exercise = day.exercise.filter(e => e.id !== entry.id); day.del = [...(day.del || []), entry.id]; S.saveDay(day, App.budget()); api.close(); App.render(); U.toast('Removed'); };
      };
      if (entry) return form(chosen);
      const groups = [...new Set(list.map(x => x[2]))];
      const draw = () => {
        const m = list.filter(x => x[0].toLowerCase().includes(q));
        el.querySelector('#x-list').innerHTML = groups.map(g => { const a = m.filter(x => x[2] === g); return a.length ? `<h3 class="sec">${g}</h3><div class="group">${a.map(x => `<button class="row-btn" data-x="${list.indexOf(x)}"><span class="row-main"><span class="row-title">${U.esc(x[0])}</span></span><span class="row-num">${U.int(C.exerciseKcal(x[1], kg, 30))}<small>kcal/30 min</small></span></button>`).join('')}</div>` : ''; }).join('');
      };
      el.innerHTML = `<div class="search-box">${U.icon('search', 20)}<input id="x-q" type="search" placeholder="Search activities" aria-label="Search activities" autocomplete="off"></div><button class="link-btn" id="x-manual">Enter calories by hand</button><div id="x-list"></div>`;
      el.querySelector('#x-q').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
      el.querySelector('#x-manual').onclick = () => form(null);
      el.querySelector('#x-list').onclick = e => { const b = e.target.closest('[data-x]'); if (b) { const x = list[+b.dataset.x]; form({ name: x[0], met: x[1] }); } };
      draw();
    });
  }

  function weightSheet() {
    U.sheet('Log weight', (el, api) => {
      const cur = S.get('weight:' + date), p = S.profile();
      el.innerHTML = `<p class="muted">${U.dateLong(date)}</p>${U.field('w-val', `Weight (${U.units() === 'us' ? 'lb' : 'kg'})`, U.weightValue(cur ? cur.kg : p.weightKg), 'inputmode="decimal"')}<button class="btn" id="w-save">Save weight</button>`;
      el.querySelector('#w-save').onclick = () => {
        const v = parseFloat(el.querySelector('#w-val').value); if (!(v > 0)) return;
        const kg = U.toKg(v); S.set('weight:' + date, { date, kg });
        const latest = S.list('weight:').sort((a, b) => a.date < b.date ? 1 : -1)[0];
        S.set('profile', Object.assign({}, p, { weightKg: latest.kg }));
        api.close(); App.render(); U.toast('Weight saved');
      };
    });
  }

  function factsSheet() {
    const d = S.day(date), t = C.totals(d.foods), tg = C.targets(S.profile(), d.goal || App.budget());
    U.sheet(date === S.today() ? "Today's nutrition" : U.dateLong(date), el => {
      el.innerHTML = U.factsLabel(t.sum, { targets: tg, known: t.known, count: t.count, serving: `${t.count} food${t.count === 1 ? '' : 's'} logged`, note: '"At least" means some of the foods have no USDA value for that nutrient.' });
    });
  }

  /* Rendering */
  const screen = () => document.getElementById('screen');
  App.render = () => {
    document.querySelectorAll('[data-tab]').forEach(b => { if (b.closest('.tabs')) { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'); } });
    const s = screen();
    s.innerHTML = tab === 'today' ? today() : tab === 'calendar' ? T.calendar() : tab === 'foods' ? L.render() : tab === 'progress' ? T.progress() : P.render();
    if (tab === 'foods') L.bind(s);
  };

  const actions = {
    tab: b => { tab = b.dataset.tab; App.render(); window.scrollTo(0, 0); },
    day: b => { date = S.addDays(date, +b.dataset.d); App.render(); },
    jump: () => { date = S.today(); App.render(); },
    add: b => A.addTo(date, b.dataset.meal),
    entry: b => { const e = S.day(date).foods.find(x => x.id === b.dataset.id); const f = F.get(e.foodId) || { id: e.foodId, name: e.name, servings: [], per100: e.n.map(v => v === null ? null : v * 100 / e.grams) }; A.logFood(date, e.meal, f, null, e); },
    'copy-meal': b => {
      const d = S.day(date), from = S.day(S.addDays(date, -1)).foods.filter(f => f.meal === b.dataset.meal);
      d.foods.push(...from.map(f => Object.assign({}, f, { id: S.uid('e') }))); S.saveDay(d, App.budget()); App.render(); U.toast('Copied');
    },
    'add-ex': () => exerciseSheet(),
    'edit-ex': b => exerciseSheet(S.day(date).exercise.find(x => x.id === b.dataset.id)),
    'log-weight': weightSheet, facts: factsSheet,
    month: b => { T.shiftMonth(+b.dataset.d); App.render(); },
    'open-day': b => { date = b.dataset.date; tab = 'today'; App.render(); window.scrollTo(0, 0); },
    range: b => { T.setRange(+b.dataset.r); App.render(); },
    'new-recipe': () => L.recipe(), 'new-food': () => L.food(),
    'edit-profile': P.edit, backup: P.backup, restore: P.restore, 'share-foods': P.shareFoods, erase: P.erase
  };
  document.addEventListener('click', e => {
    const day = e.target.closest('.cal-day');
    if (day) { T.pick(day.dataset.date); App.render(); return; }
    const tip = e.target.closest('[data-tip]');
    if (tip) { const box = tip.closest('.panel').querySelector('.tip'); if (box) box.textContent = tip.dataset.tip; return; }
    const b = e.target.closest('[data-act]');
    if (b && actions[b.dataset.act]) actions[b.dataset.act](b);
  });

  function setup() {
    document.body.classList.add('setup');
    screen().innerHTML = `<div class="welcome"><div class="f-title">Portion</div><div class="f-rule thick"></div><p>Track what you eat against a daily calorie budget. Answer a few questions to set yours.</p></div><div id="setup-form"></div>`;
    P.form(document.getElementById('setup-form'), {}, st => { P.saveProfile(st); document.body.classList.remove('setup'); App.render(); window.scrollTo(0, 0); });
  }

  async function start() {
    await S.ready();
    S.onerror = () => U.toast('Could not save. Check free space on this device.');
    if (window.PORTION_DEMO) window.PORTION_DEMO();
    document.getElementById('tabs').innerHTML = TABS.map(([id, label]) => `<button data-act="tab" data-tab="${id}">${U.icon(id, 24)}<span>${label}</span></button>`).join('');
    if (S.profile()) App.render(); else setup();
    document.getElementById('boot').remove();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
    /* Roll over to the new day if the app is reopened after midnight. */
    let last = S.today();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.today() !== last) { if (date === last) date = S.today(); last = S.today(); if (S.profile()) App.render(); } });
  }
  window.PortionApp = App;
  start();
})();
