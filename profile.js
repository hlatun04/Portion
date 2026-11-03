/* Portion: personal details, goals, backups and the first-run setup. */
(function () {
  'use strict';
  const C = window.PortionCalc, S = window.PortionStore, U = window.PortionUI;
  const P = {};
  const seg = (name, val, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${v === val}" class="${v === val ? 'on' : ''}" data-seg="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;

  /* The same form serves first-run setup and later edits. */
  P.form = (root, start, onDone) => {
    const st = Object.assign({ units: 'us', sex: 'female', activity: 'light', goal: 'lose', weeklyKg: 0.5, macros: { carb: 50, protein: 20, fat: 30 } }, start);
    const us = () => st.units === 'us';
    const num = id => parseFloat((root.querySelector('#' + id) || {}).value);
    const read = () => {
      const y = new Date().getFullYear(), age = num('p-age');
      st.birthYear = age ? y - age : st.birthYear;
      st.heightCm = us() ? ((num('p-ft') || 0) * 12 + (num('p-in') || 0)) * C.CM_PER_IN : num('p-cm');
      st.weightKg = us() ? num('p-w') * C.KG_PER_LB : num('p-w');
      st.goalKg = st.goal === 'maintain' ? null : (us() ? num('p-goal') * C.KG_PER_LB : num('p-goal'));
      st.customKcal = num('p-custom') || null;
      st.macros = { carb: num('p-mc') || 0, protein: num('p-mp') || 0, fat: num('p-mf') || 0 };
    };
    const shell = () => {
      const ft = st.heightCm ? Math.floor(st.heightCm / C.CM_PER_IN / 12) : '', inch = st.heightCm ? Math.round(st.heightCm / C.CM_PER_IN - ft * 12) : '';
      const w = v => v ? +(us() ? v / C.KG_PER_LB : v).toFixed(1) : '';
      const rates = us() ? [[.2268, '0.5 lb'], [.4536, '1 lb'], [.6804, '1.5 lb'], [.9072, '2 lb']] : [[.25, '0.25 kg'], [.5, '0.5 kg'], [.75, '0.75 kg'], [1, '1 kg']];
      if (!rates.some(r => Math.abs(r[0] - st.weeklyKg) < .01)) st.weeklyKg = rates[1][0];
      const age = st.birthYear ? new Date().getFullYear() - st.birthYear : '';
      root.innerHTML = `
        <div class="form-section"><h3 class="sec">Units</h3>${seg('units', st.units, [['us', 'Pounds and feet'], ['metric', 'Kilograms and cm']])}</div>
        <div class="form-section"><h3 class="sec">About you</h3>
          ${seg('sex', st.sex, [['female', 'Female'], ['male', 'Male']])}
          <div class="grid2">${U.field('p-age', 'Age', age, 'inputmode="numeric"')}${U.field('p-w', `Weight (${us() ? 'lb' : 'kg'})`, w(st.weightKg), 'inputmode="decimal"')}</div>
          ${us() ? `<div class="grid2">${U.field('p-ft', 'Height (feet)', ft, 'inputmode="numeric"')}${U.field('p-in', 'Inches', inch, 'inputmode="numeric"')}</div>` : U.field('p-cm', 'Height (cm)', st.heightCm ? Math.round(st.heightCm) : '', 'inputmode="decimal"')}
        </div>
        <div class="form-section"><h3 class="sec">Daily activity, not counting workouts</h3>
          <div class="group">${C.ACTIVITY.map(a => `<button type="button" class="row-btn radio ${a.id === st.activity ? 'on' : ''}" data-seg="activity" data-v="${a.id}"><span class="row-main"><span class="row-title">${a.label}</span><span class="row-sub">${a.hint}</span></span>${a.id === st.activity ? U.icon('check', 20) : ''}</button>`).join('')}</div>
          <p class="hint">Log workouts in the diary. They add to that day's budget.</p></div>
        <div class="form-section"><h3 class="sec">Your goal</h3>
          ${seg('goal', st.goal, [['lose', 'Lose weight'], ['maintain', 'Stay the same'], ['gain', 'Gain weight']])}
          ${st.goal === 'maintain' ? '' : `${U.field('p-goal', `Goal weight (${us() ? 'lb' : 'kg'})`, w(st.goalKg), 'inputmode="decimal"')}
          <span class="field-label">Change per week</span>${seg('weeklyKg', String(st.weeklyKg), rates.filter((r, i) => st.goal === 'lose' || i < 2).map(r => [String(r[0]), r[1]]))}`}
        </div>
        <details class="more"><summary>Custom targets</summary>
          ${U.field('p-custom', 'Set my own daily calories', st.customKcal || '', 'inputmode="numeric" placeholder="Leave blank to calculate"')}
          <span class="field-label">Share of calories (%)</span>
          <div class="grid3">${U.field('p-mc', 'Carbs', st.macros.carb, 'inputmode="numeric"')}${U.field('p-mp', 'Protein', st.macros.protein, 'inputmode="numeric"')}${U.field('p-mf', 'Fat', st.macros.fat, 'inputmode="numeric"')}</div>
        </details>
        <div id="p-plan"></div>
        <button class="btn" id="p-save">Save</button>
        <p class="hint">For adults only. These numbers are estimates and not medical advice. Ask your doctor before dieting if you are pregnant, breastfeeding, or have a health condition.</p>`;
      live();
    };
    const validate = () => {
      const age = new Date().getFullYear() - st.birthYear;
      if (!(age >= 18 && age <= 110)) return 'Enter your age. Portion is designed for adults 18 and over.';
      if (!(st.weightKg > 25 && st.weightKg < 350)) return 'Enter your weight.';
      if (!(st.heightCm > 100 && st.heightCm < 250)) return 'Enter your height.';
      if (st.goal !== 'maintain') {
        if (!(st.goalKg > 0)) return 'Enter your goal weight.';
        if (st.goal === 'lose' && st.goalKg >= st.weightKg) return 'To lose weight, the goal must be below your current weight.';
        if (st.goal === 'gain' && st.goalKg <= st.weightKg) return 'To gain weight, the goal must be above your current weight.';
        if (st.goal === 'lose' && C.bmi(st.goalKg, st.heightCm) < 18.5) {
          const [lo] = C.healthyRangeKg(st.heightCm);
          return `That goal is below the healthy range for your height, which starts at about ${us() ? Math.ceil(lo / C.KG_PER_LB) + ' lb' : Math.ceil(lo) + ' kg'}. Please choose a higher goal, or talk with your doctor about what weight is right for you.`;
        }
      }
      const m = st.macros; if (m.carb + m.protein + m.fat !== 100) return 'Carbs, protein and fat must add up to 100%.';
      return null;
    };
    const live = () => {
      read();
      const out = root.querySelector('#p-plan'), err = validate(), btn = root.querySelector('#p-save');
      btn.disabled = !!err;
      if (err) { out.innerHTML = `<p class="note">${U.esc(err)}</p>`; return; }
      const pl = C.plan(st), b = C.bmi(st.weightKg, st.heightCm), cat = C.bmiCategory(b);
      const wk = pl.weeks ? `About ${Math.ceil(pl.weeks)} weeks to reach your goal.` : '';
      out.innerHTML = `<div class="plan"><div class="f-cal"><span>Daily budget</span><strong>${U.int(pl.budget)}</strong></div><div class="f-rule mid"></div>
        <div class="f-row"><span>Resting calories</span><b>${U.int(pl.bmr)}</b></div><div class="f-row"><span>Calories to keep your weight</span><b>${U.int(pl.maintain)}</b></div><div class="f-row"><span>BMI</span><b>${U.num(b, 1)} ${cat.label}</b></div>
        ${wk ? `<div class="f-row"><span>${wk}</span></div>` : ''}
        ${pl.limited ? `<p class="note">Your budget is held at ${U.int(C.MIN_KCAL[st.sex])} kcal, the lowest this app will set. Weight will change more slowly than the rate you chose.</p>` : ''}</div>`;
    };
    root.onclick = e => {
      const b = e.target.closest('[data-seg]'); if (!b) return;
      read();
      const k = b.dataset.seg, v = b.dataset.v;
      st[k] = k === 'weeklyKg' ? parseFloat(v) : v;
      shell();
    };
    root.oninput = live;
    root.addEventListener('click', e => {
      if (e.target.id !== 'p-save') return;
      read(); if (validate()) return;
      if (st.goal === 'maintain') st.weeklyKg = 0;
      onDone(st);
    });
    shell();
  };

  P.saveProfile = st => {
    const first = !S.profile();
    S.set('profile', st);
    const today = S.today();
    const lastW = S.list('weight:').sort((a, b) => a.date < b.date ? 1 : -1)[0];
    if (first || !lastW || Math.abs(lastW.kg - st.weightKg) > .05) S.set('weight:' + today, { date: today, kg: st.weightKg });
    const d = S.get('day:' + today); if (d) S.saveDay(d, C.plan(st).budget);
  };

  P.render = () => {
    const p = S.profile(), pl = C.plan(p), meta = S.meta(), standalone = window.PortionApp.standalone();
    const goal = p.goal === 'maintain' ? 'Stay the same' : `${p.goal === 'lose' ? 'Lose' : 'Gain'} to ${U.weight(p.goalKg)}`;
    return `<header class="top"><h1>Profile</h1></header>
      <div class="prog-layout">
      <div class="panel"><h2 class="p-title">Your plan</h2>
        <dl class="stats"><div><dt>Daily budget</dt><dd>${U.int(pl.budget)}</dd></div><div><dt>To keep weight</dt><dd>${U.int(pl.maintain)}</dd></div><div><dt>BMI</dt><dd>${U.num(C.bmi(p.weightKg, p.heightCm), 1)}</dd></div></dl>
        <div class="kv"><span>Age</span><b>${pl.age}</b></div><div class="kv"><span>Weight</span><b>${U.weight(p.weightKg)}</b></div><div class="kv"><span>Goal</span><b>${goal}</b></div>
        ${pl.weeks ? `<div class="kv"><span>Time to goal</span><b>About ${Math.ceil(pl.weeks)} weeks</b></div>` : ''}
        <button class="btn ghost" data-act="edit-profile">Edit details and goal</button></div>
      <div class="panel"><h2 class="p-title">Backup and sharing</h2>
        <p class="muted">Your data stays on this device. ${meta.lastBackup ? `Last backup ${U.dateShort(meta.lastBackup)}.` : 'You have no backup yet.'} Save a backup to iCloud Drive, and use it to copy your diary to your iPad.</p>
        <button class="btn" data-act="backup">${U.icon('share', 18)} Save a backup</button>
        <button class="btn ghost" data-act="restore">Open a backup or shared file</button>
        <button class="btn ghost" data-act="share-foods">Share my foods and recipes</button>
        <p class="hint">Opening a file adds to what is here and keeps the newest version of each item.</p>
        ${S.volatile ? '<p class="note">This browser is blocking storage, so changes will be lost when you close the page.</p>' : ''}
        ${standalone ? '' : '<p class="note">Add Portion to your Home Screen to keep your data safe: tap Share in Safari, then Add to Home Screen.</p>'}</div>
      <div class="panel"><h2 class="p-title">About the numbers</h2>
        <div class="about"><p>Food values come from the USDA National Nutrient Database, Standard Reference Release 28. Portion sizes marked as typical are approximate.</p>
        <p>Calorie needs use the Mifflin-St Jeor equation. Vitamin and mineral targets use the US Dietary Reference Intakes for adults.</p>
        <p>Exercise uses MET values from the 2024 Adult Compendium of Physical Activities. The figure shown is what you burn above resting, because resting calories are already in your budget.</p>
        <p>Weight estimates assume about 3,500 kcal per pound. Real results vary.</p></div></div>
      <div class="panel"><h2 class="p-title">Erase</h2><p class="muted">Removes your diary, foods and recipes from this device.</p><button class="btn ghost danger-text" data-act="erase">Erase all data</button></div>
      </div>`;
  };

  async function sendFile(name, obj) {
    const text = JSON.stringify(obj), file = new File([text], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
    } catch (e) { if (e.name === 'AbortError') return false; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return true;
  }
  P.backup = async () => {
    if (await sendFile(`portion-backup-${S.today()}.json`, S.exportData('full'))) { S.setMeta({ lastBackup: S.today() }); window.PortionApp.render(); U.toast('Backup saved'); }
  };
  P.shareFoods = async () => {
    if (!S.list('food:').length && !S.list('recipe:').length) return U.toast('Create a food or recipe first');
    await sendFile(`portion-foods-${S.today()}.json`, S.exportData('foods'));
  };
  P.restore = () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.hidden = true; document.body.appendChild(i);
    i.onchange = async () => {
      try {
        const n = S.importData(JSON.parse(await i.files[0].text()));
        window.PortionApp.render(); U.toast(`Added ${n} item${n === 1 ? '' : 's'}`);
      } catch (e) { U.toast('That file is not a Portion backup'); }
      i.remove();
    };
    i.click();
  };
  P.erase = () => U.confirm('Erase all data?', 'This removes everything on this device and cannot be undone. Save a backup first if you may need it.', 'Erase', () => { S.eraseAll(); location.reload(); });
  P.edit = () => U.sheet('Edit details and goal', (el, api) => P.form(el, S.profile(), st => { P.saveProfile(st); api.close(); window.PortionApp.render(); U.toast('Saved'); }));
  window.PortionProfile = P;
})();
