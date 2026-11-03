/* Portion: on-device storage. Everything stays in this device's IndexedDB; nothing is sent anywhere.
   To add accounts or cloud sync later, this is the only file that needs to change. */
(function () {
  'use strict';
  const DB = 'portion', STORE = 'kv';
  const mem = new Map();
  let db = null;

  const S = { volatile: false };
  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  S.uid = uid;

  S.ready = () => new Promise(resolve => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch (e) { S.volatile = true; return resolve(); }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => { S.volatile = true; resolve(); };
    req.onsuccess = () => {
      db = req.result;
      const tx = db.transaction(STORE), st = tx.objectStore(STORE), cur = st.openCursor();
      cur.onsuccess = () => { const c = cur.result; if (c) { mem.set(c.key, c.value); c.continue(); } else resolve(); };
      cur.onerror = () => { S.volatile = true; resolve(); };
    };
  });

  function put(k, v) {
    if (!db) return;
    try {
      const st = db.transaction(STORE, 'readwrite').objectStore(STORE);
      v === undefined ? st.delete(k) : st.put(v, k);
    } catch (e) { S.onerror && S.onerror(e); }
  }
  S.get = k => mem.get(k);
  S.set = (k, v) => { v.updatedAt = Date.now(); mem.set(k, v); put(k, v); return v; };
  S.del = k => { mem.delete(k); put(k, undefined); };
  S.list = prefix => [...mem.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);
  S.count = () => mem.size;

  S.profile = () => mem.get('profile');
  S.meta = () => mem.get('meta') || { favorites: [], recents: [] };
  S.setMeta = patch => S.set('meta', Object.assign({}, S.meta(), patch));

  S.day = date => mem.get('day:' + date) || { date, foods: [], exercise: [], del: [] };
  S.saveDay = (day, budget) => {
    if (budget && (!day.goal || day.date === S.today())) day.goal = budget;
    return S.set('day:' + day.date, day);
  };
  S.dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  S.today = () => S.dateKey(new Date());
  S.parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  S.addDays = (s, n) => { const d = S.parseDate(s); d.setDate(d.getDate() + n); return S.dateKey(d); };

  /* Backups */
  S.exportData = kind => {
    const items = {};
    for (const [k, v] of mem) {
      const shareable = k.startsWith('food:') || k.startsWith('recipe:');
      if (kind === 'full' || shareable) items[k] = v;
    }
    return { app: 'Portion', format: 1, kind, exportedAt: new Date().toISOString(), items };
  };

  function mergeDay(a, b) {
    const del = [...new Set([...(a.del || []), ...(b.del || [])])];
    const union = (x, y) => {
      const m = new Map();
      [...x, ...y].forEach(e => m.set(e.id, e));
      return [...m.values()].filter(e => !del.includes(e.id));
    };
    return { date: a.date, foods: union(a.foods, b.foods), exercise: union(a.exercise, b.exercise), del, goal: a.goal || b.goal };
  }

  /* Adds a backup to what is on this device. Newest version wins; days are combined entry by entry. */
  S.importData = data => {
    if (!data || data.app !== 'Portion' || !data.items) throw new Error('This file is not a Portion backup.');
    let added = 0;
    for (const [k, v] of Object.entries(data.items)) {
      const here = mem.get(k);
      if (k === 'meta') {
        const m = S.meta();
        S.set('meta', Object.assign({}, m, { favorites: [...new Set([...(m.favorites || []), ...(v.favorites || [])])] }));
        continue;
      }
      if (k.startsWith('day:') && here) { S.set(k, mergeDay(here, v)); added++; continue; }
      if (!here || (v.updatedAt || 0) > (here.updatedAt || 0)) {
        mem.set(k, v); put(k, v); added++;
      }
    }
    return added;
  };

  S.eraseAll = () => {
    mem.clear();
    if (db) db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  };

  window.PortionStore = S;
})();
