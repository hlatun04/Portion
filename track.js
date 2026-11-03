/* Portion: the Calendar and Progress tabs. */
(function () {
  'use strict';
  const C = window.PortionCalc, S = window.PortionStore, U = window.PortionUI;
  const T = {};
  const dayStats = date => {
    const d = S.get('day:' + date); if (!d || (!d.foods.length && !d.exercise.length)) return null;
    const t = C.totals(d.foods), burned = d.exercise.reduce((s, e) => s + e.kcal, 0);
    return { date, eaten: t.sum[0], burned, goal: d.goal, left: (d.goal || 0) + burned - t.sum[0], totals: t };
  };
  T.dayStats = dayStats;

  /* Calendar */
  let month = null, picked = null;
  T.calendar = () => {
    const today = S.today(); if (!month) month = today.slice(0, 7); if (!picked) picked = today;
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1, 12), days = new Date(y, m, 0).getDate(), lead = first.getDay();
    let cells = ''; for (let i = 0; i < lead; i++) cells += '<span></span>';
    const logged = [];
    for (let d = 1; d <= days; d++) {
      const key = `${month}-${String(d).padStart(2, '0')}`, st = dayStats(key); if (st && st.eaten > 0) logged.push(st);
      const state = !st ? '' : st.left >= 0 ? 'under' : 'over';
      const words = !st ? 'nothing logged' : st.left >= 0 ? 'within budget' : 'over budget';
      cells += `<button class="cal-day ${state} ${key === today ? 'today' : ''} ${key === picked ? 'picked' : ''}" data-date="${key}" aria-label="${U.dateShort(key)}, ${words}">
        <span>${d}</span><i>${state === 'under' ? U.icon('check', 12) : state === 'over' ? '+' : ''}</i></button>`;
    }
    const avg = logged.length ? logged.reduce((s, x) => s + x.eaten, 0) / logged.length : 0;
    const under = logged.filter(x => x.left >= 0).length;
    const st = dayStats(picked);
    return `<header class="top"><h1>Calendar</h1></header>
      <div class="cal-layout"><div class="panel">
        <div class="cal-head"><button class="icon-btn" data-act="month" data-d="-1" aria-label="Previous month">${U.icon('back')}</button><h2>${first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><button class="icon-btn" data-act="month" data-d="1" aria-label="Next month">${U.icon('next')}</button></div>
        <div class="cal-grid dow">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<span>${d}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <div class="legend"><span><i class="k under">${U.icon('check', 11)}</i> Within budget</span><span><i class="k over">+</i> Over budget</span></div>
      </div>
      <div class="cal-side">
      <div class="panel">
        <h2 class="p-title">${U.dateLong(picked)}</h2>
        ${st ? `<dl class="stats"><div><dt>Food</dt><dd>${U.int(st.eaten)}</dd></div><div><dt>Exercise</dt><dd>${U.int(st.burned)}</dd></div><div><dt>${st.left >= 0 ? 'Left' : 'Over'}</dt><dd>${U.int(Math.abs(st.left))}</dd></div></dl>` : '<p class="muted">Nothing logged on this day.</p>'}
        <button class="btn ghost" data-act="open-day" data-date="${picked}">Open this day</button>
      </div>
      <div class="panel"><h2 class="p-title">This month</h2><dl class="stats"><div><dt>Days logged</dt><dd>${logged.length}</dd></div><div><dt>Average kcal</dt><dd>${U.int(avg)}</dd></div><div><dt>Within budget</dt><dd>${under}</dd></div></dl></div>
      </div></div>`;
  };
  T.pick = d => { picked = d; };
  T.shiftMonth = n => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1, 12); month = S.dateKey(d).slice(0, 7); };

  /* Progress */
  let range = 30;
  T.setRange = r => { range = r; };
  /* Chart width follows the screen so labels stay a readable size. */
  const chartW = share => window.innerWidth < 768 ? Math.max(300, window.innerWidth - 60) : Math.min(1000, (window.innerWidth - 180) * share);
  function calChart(rows) {
    const W = chartW(1), H = W < 500 ? 190 : 220, L = 42, R = 8, Tp = 12, B = 26;
    const max = Math.max(500, ...rows.map(r => Math.max(r.eaten || 0, r.limit || 0))) * 1.08;
    const niceStep = max > 4000 ? 1000 : 500;
    const y = v => Tp + (H - Tp - B) * (1 - v / max), slot = (W - L - R) / rows.length, bw = Math.max(2, Math.min(22, slot - 2));
    let grid = ''; for (let v = 0; v <= max; v += niceStep) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="t">${v.toLocaleString('en-US')}</text>`;
    const bars = rows.map((r, i) => {
      const x = L + i * slot + (slot - bw) / 2, hit = `<rect x="${L + i * slot}" y="${Tp}" width="${slot}" height="${H - Tp - B}" fill="transparent" data-tip="${U.dateShort(r.date)}: ${r.eaten ? U.int(r.eaten) + ' kcal' + (r.limit ? ' of ' + U.int(r.limit) : '') : 'nothing logged'}"/>`;
      if (!r.eaten) return hit;
      const h = H - B - y(r.eaten), rad = Math.min(4, bw / 2);
      return `<path class="${r.limit && r.eaten > r.limit ? 'b-over' : 'b-ok'}" d="M${x} ${H - B}v${-(h - rad)}q0 ${-rad} ${rad} ${-rad}h${bw - 2 * rad}q${rad} 0 ${rad} ${rad}v${h - rad}z"/>${hit}`;
    }).join('');
    const marks = rows.filter(r => r.limit).map(r => { const i = rows.indexOf(r), x = L + i * slot + (slot - bw) / 2; return `<line x1="${x - 1}" x2="${x + bw + 1}" y1="${y(r.limit)}" y2="${y(r.limit)}" class="limit-mark"/>`; }).join('');
    const every = Math.ceil(rows.length / (W < 500 ? 4 : 6));
    const labels = rows.map((r, i) => (rows.length - 1 - i) % every === 0 ? `<text x="${i === rows.length - 1 ? W - R : L + i * slot + slot / 2}" y="${H - 8}" text-anchor="${i === rows.length - 1 ? 'end' : 'middle'}" class="t">${U.dateShort(r.date)}</text>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Calories eaten each day compared with your budget">${grid}${bars}${marks}${labels}</svg>`;
  }
  function weightChart(rows, goalKg) {
    if (!rows.length) return '';
    const W = chartW(.5), H = 190, L = 46, R = 12, Tp = 14, B = 26, vals = rows.map(r => U.weightValue(r.kg));
    const g = goalKg ? U.weightValue(goalKg) : null, lo0 = Math.min(...vals, g === null ? Infinity : g), hi0 = Math.max(...vals, g === null ? -Infinity : g);
    const pad = Math.max(1, (hi0 - lo0) * .15), lo = lo0 - pad, hi = hi0 + pad, t0 = S.parseDate(rows[0].date).getTime(), t1 = S.parseDate(rows[rows.length - 1].date).getTime();
    const x = d => rows.length === 1 ? (L + W - R) / 2 : L + (W - L - R) * ((S.parseDate(d).getTime() - t0) / (t1 - t0 || 1)), y = v => Tp + (H - Tp - B) * (1 - (v - lo) / (hi - lo));
    let grid = ''; for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3; grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="g"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="t">${U.num(v, 0)}</text>`; }
    const pts = rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.date)} ${y(vals[i])}`).join(''), last = rows[rows.length - 1];
    const goal = g === null ? '' : `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="limit"/><text x="${W - R}" y="${y(g) - 5}" text-anchor="end" class="t">Goal ${U.num(g, 1)}</text>`;
    const dots = rows.map((r, i) => `<circle cx="${x(r.date)}" cy="${y(vals[i])}" r="${i === rows.length - 1 ? 5 : 3}" class="dot"/><circle cx="${x(r.date)}" cy="${y(vals[i])}" r="14" fill="transparent" data-tip="${U.dateShort(r.date)}: ${U.weight(r.kg)}"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Weight over time">${grid}${goal}<path d="${pts}" class="w-line"/>${dots}
      <text x="${L}" y="${H - 8}" class="t">${U.dateShort(rows[0].date)}</text><text x="${W - R}" y="${H - 8}" text-anchor="end" class="t">${U.dateShort(last.date)}</text></svg>`;
  }

  T.progress = () => {
    const p = S.profile(), plan = C.plan(p), today = S.today(), rows = [];
    for (let i = range - 1; i >= 0; i--) {
      const date = S.addDays(today, -i), st = dayStats(date);
      rows.push({ date, eaten: st ? st.eaten : 0, limit: st && st.goal ? st.goal + st.burned : null, st });
    }
    const logged = rows.filter(r => r.eaten > 0), n = logged.length, avg = k => n ? logged.reduce((s, r) => s + r.st.totals.sum[C.KEYS.indexOf(k)], 0) / n : 0;
    const burn = n ? rows.reduce((s, r) => s + (r.st ? r.st.burned : 0), 0) : 0;
    const weights = S.list('weight:').sort((a, b) => a.date < b.date ? -1 : 1).filter(w => w.date >= S.addDays(today, -Math.max(range, 90)));
    const bmi = C.bmi(p.weightKg, p.heightCm), cat = C.bmiCategory(bmi), [lo, hi] = C.healthyRangeKg(p.heightCm);
    const pos = Math.min(100, Math.max(0, (bmi - 15) / 25 * 100));
    const tg = C.targets(p, plan.budget);
    const macroKcal = { c: avg('carb') * 4, p: avg('protein') * 4, f: avg('fat') * 9 }, mt = macroKcal.c + macroKcal.p + macroKcal.f || 1;
    const nut = ['fiber', 'protein', 'vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'thiamin', 'riboflavin', 'niacin', 'vitB6', 'folate', 'vitB12', 'calcium', 'iron', 'magnesium', 'potassium', 'zinc'];
    const lim = ['satfat', 'sodium', 'chol'];
    const bar = (k, isLimit) => {
      const t = tg[k], goal = t.limit || t, pc = avg(k) / goal * 100, warn = isLimit ? pc > 100 : pc < 50;
      return `<div class="nbar"><span class="n">${C.NUTRIENTS[k][0]}</span><span class="v">${U.num(avg(k))} / ${U.num(goal, goal < 10 ? 1 : 0)} ${C.NUTRIENTS[k][1]}</span>
        <div class="track"><i class="${isLimit ? (warn ? 'bad' : 'ok') : (warn ? 'low' : 'ok')}" style="width:${Math.min(100, pc)}%"></i></div></div>`;
    };
    return `<header class="top"><h1>Progress</h1></header>
      <div class="chips" role="group" aria-label="Time range">${[7, 30, 90].map(r => `<button class="chip ${r === range ? 'on' : ''}" data-act="range" data-r="${r}">${r} days</button>`).join('')}</div>
      <div class="prog-layout">
      <div class="panel wide"><h2 class="p-title">Calories</h2>
        <dl class="stats"><div><dt>Average per day</dt><dd>${U.int(avg('kcal'))}</dd></div><div><dt>Days logged</dt><dd>${n} of ${range}</dd></div><div><dt>Exercise</dt><dd>${U.int(burn)}</dd></div></dl>
        ${calChart(rows)}<p class="tip" id="tip">Tap a bar for that day's number. The dark marks show each day's budget including exercise.</p></div>
      <div class="panel"><h2 class="p-title">Weight</h2>
        ${weights.length ? weightChart(weights, p.goal !== 'maintain' ? p.goalKg : null) : '<p class="muted">Log your weight to see the trend.</p>'}
        <p class="tip" id="tip2">${weights.length ? `Latest ${U.weight(weights[weights.length - 1].kg)}. Tap a point for its value.` : ''}</p>
        <button class="btn ghost" data-act="log-weight">${U.icon('scale', 18)} Log weight</button></div>
      <div class="panel"><h2 class="p-title">Body mass index</h2>
        <div class="bmi"><strong>${U.num(bmi, 1)}</strong><span>${cat.label}</span></div>
        <div class="bmi-scale" aria-hidden="true"><i style="flex:3.5"></i><i style="flex:6.5"></i><i style="flex:5"></i><i style="flex:10"></i><b style="left:${pos}%"></b></div>
        <div class="bmi-ticks" aria-hidden="true"><span style="left:14%">18.5</span><span style="left:40%">25</span><span style="left:60%">30</span></div>
        <p class="muted">A healthy weight for your height is about ${U.weight(lo, 0)} to ${U.weight(hi, 0)}. BMI does not account for muscle or body shape.</p></div>
      <div class="panel"><h2 class="p-title">Where your calories come from</h2>
        ${n ? `<div class="stack" role="img" aria-label="Carbs ${Math.round(macroKcal.c / mt * 100)}%, protein ${Math.round(macroKcal.p / mt * 100)}%, fat ${Math.round(macroKcal.f / mt * 100)}%">
          <i class="m-c" style="flex:${macroKcal.c}"></i><i class="m-p" style="flex:${macroKcal.p}"></i><i class="m-f" style="flex:${macroKcal.f}"></i></div>
        <div class="macro-mini"><span class="m-c">Carbs <b>${Math.round(macroKcal.c / mt * 100)}%</b></span><span class="m-p">Protein <b>${Math.round(macroKcal.p / mt * 100)}%</b></span><span class="m-f">Fat <b>${Math.round(macroKcal.f / mt * 100)}%</b></span></div>` : '<p class="muted">Log some food to see this.</p>'}</div>
      <div class="panel wide"><h2 class="p-title">Daily average against your targets</h2>
        <h3 class="sec">Keep below</h3>${lim.map(k => bar(k, true)).join('')}
        <h3 class="sec">Aim to reach</h3>${nut.map(k => bar(k)).join('')}
        <p class="tip">Shown for days with food logged. Some foods have no USDA value for certain vitamins, so real intake can be higher.</p></div>
      </div>`;
  };
  window.PortionTrack = T;
})();
