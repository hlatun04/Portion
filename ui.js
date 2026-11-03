/* Portion: small shared screen helpers, sheets, formatting and the nutrition label. */
(function () {
  'use strict';
  const C = window.PortionCalc, S = window.PortionStore;
  const U = {};
  U.esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.int = n => Math.round(n).toLocaleString('en-US');
  U.num = (n, d) => { const v = +n; if (!isFinite(v)) return '0'; const f = d === undefined ? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2) : d; return (+v.toFixed(f)).toLocaleString('en-US', { maximumFractionDigits: f }); };
  U.icon = (name, size) => `<svg class="ic" width="${size || 24}" height="${size || 24}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const ICONS = {
    today: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    foods: '<path d="M7 3v7a2.5 2.5 0 0 0 5 0V3M9.5 3v18M17 3c-2 1.5-3 4.5-3 8h3v10"/>',
    progress: '<path d="M4 20V4M4 20h16M8 15l4-4 3 3 5-6"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
    star: '<path d="M12 3.500l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.900l6-.9z"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', check: '<path d="M5 12.500l4.5 4.500L19 7"/>', alert: '<path d="M12 4l9 16H3zM12 10v5M12 17.500v.5"/>', trash: '<path d="M5 7h14M10 7V4.500h4V7M7 7l1 13h8l1-13"/>', share: '<path d="M12 15V4M8 7.500L12 3.500l4 4M6 12H5v8.500h14V12h-1"/>', flame: '<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-2 1-3.5 2-4.5.5 2 1.5 2.5 2 2.5 0-3 .5-6 2-9z"/>', scale: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 9.500a5 5 0 0 1 7 0L13 12h-2z"/>'
  };

  /* Units */
  U.units = () => (S.profile() && S.profile().units) || 'us';
  U.weight = (kg, d) => U.units() === 'us' ? `${U.num(kg / C.KG_PER_LB, d === undefined ? 1 : d)} lb` : `${U.num(kg, d === undefined ? 1 : d)} kg`;
  U.weightValue = kg => U.units() === 'us' ? +(kg / C.KG_PER_LB).toFixed(1) : +kg.toFixed(1);
  U.toKg = v => U.units() === 'us' ? v * C.KG_PER_LB : v;
  U.dateLong = s => S.parseDate(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  U.dateShort = s => S.parseDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  U.toast = msg => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(U._t); U._t = setTimeout(() => t.classList.remove('on'), 2400);
  };

  /* Sheets slide up on iPhone and appear centred on iPad. They can stack. */
  const stack = [];
  U.sheet = (title, render, opts) => {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-back"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
      <header class="sheet-head"><h2>${U.esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${U.icon('close', 22)}</button></header>
      <div class="sheet-body"></div></section>`;
    document.body.appendChild(wrap);
    document.body.classList.add('locked');
    const api = {
      el: wrap.querySelector('.sheet-body'),
      close() {
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        wrap.remove();
        if (!stack.length) document.body.classList.remove('locked');
        opts.onClose && opts.onClose();
      }
    };
    wrap.querySelector('[data-close]').onclick = api.close;
    wrap.querySelector('.sheet-back').onclick = api.close;
    stack.push(api);
    render(api.el, api);
    return api;
  };

  /* Replaces browser pop-ups, which do not work well in a Home Screen app. */
  U.confirm = (title, body, action, onYes) => U.sheet(title, (el, api) => {
    el.innerHTML = `<p class="muted">${U.esc(body)}</p><div class="btn-row"><button class="btn ghost" data-no>Cancel</button><button class="btn danger" data-yes>${U.esc(action)}</button></div>`;
    el.querySelector('[data-no]').onclick = api.close;
    el.querySelector('[data-yes]').onclick = () => { api.close(); onYes(); };
  });

  /* Nutrition Facts panel. values is aligned to C.KEYS; known counts foods with data for that nutrient. */
  U.factsLabel = (values, opts) => {
    opts = opts || {};
    const v = k => { const x = values[C.KEYS.indexOf(k)]; return x === null || x === undefined ? null : x; };
    const T = opts.targets || {};
    const unknown = k => opts.known && opts.count ? opts.known[C.KEYS.indexOf(k)] < opts.count : false;
    const pct = k => {
      const t = T[k], x = v(k); const goal = t && t.limit ? t.limit : t;
      return goal && x !== null ? `<b>${Math.round(x / goal * 100)}%</b>` : '';
    };
    const row = (k, cls) => {
      const x = v(k), [name, unit] = C.NUTRIENTS[k];
      return `<div class="f-row ${cls || ''}"><span>${cls === 'sub' ? name : `<b>${name}</b>`} ${x === null ? '<i>no data</i>' : U.num(x) + unit}${unknown(k) ? ' <i>at least</i>' : ''}</span>${pct(k)}</div>`;
    };
    const micro = ['vitA', 'vitC', 'vitD', 'vitE', 'vitK', 'thiamin', 'riboflavin', 'niacin', 'vitB6', 'folate', 'vitB12', 'panto', 'choline', 'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'zinc', 'copper', 'manganese', 'selenium'];
    return `<div class="facts">
      <div class="f-title">Nutrition Facts</div>
      ${opts.serving ? `<div class="f-serving">${U.esc(opts.serving)}</div>` : ''}
      <div class="f-rule thick"></div>
      <div class="f-cal"><span>Calories</span><strong>${v('kcal') === null ? '0' : U.int(v('kcal'))}</strong></div>
      <div class="f-rule mid"></div>
      <div class="f-head">${opts.targets ? '% of your daily target' : ''}</div>
      ${row('fat')}${row('satfat', 'sub')}${row('monofat', 'sub')}${row('polyfat', 'sub')}${row('chol')}${row('sodium')}${row('carb')}${row('fiber', 'sub')}${row('sugar', 'sub')}${row('protein')}
      <div class="f-rule thick"></div>
      ${micro.map(k => row(k, 'micro')).join('')}
      ${opts.note ? `<div class="f-note">${U.esc(opts.note)}</div>` : ''}
    </div>`;
  };

  U.field = (id, label, value, attrs) => `<label class="field" for="${id}"><span>${label}</span><input id="${id}" value="${U.esc(value === null || value === undefined ? '' : value)}" ${attrs || ''}></label>`;
  window.PortionUI = U;
})();
