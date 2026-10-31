'use strict';
/* Ranking Obrony Carroburga — połączenie z bazą Supabase (REST API).
   Kolejność: więcej pokonanych → więcej zachowanego zdrowia → krótszy czas gry.
   Do rankingu można się wpisać tylko po ocaleniu Carroburga. */
const Ranking = (() => {
  const cfg = window.RANKING_CONFIG || {};
  const enabled = !!(cfg.url && cfg.key);
  const base = enabled ? `${cfg.url.replace(/\/$/, '')}/rest/v1/${cfg.table || 'ranking'}` : '';
  const headers = () => ({ apikey: cfg.key, 'Content-Type': 'application/json' });
  const ORDER = 'kills.desc,hp.desc,time_s.asc,created_at.asc';
  const FIELDS = 'id,name,kills,breached,hp,time_s,created_at';

  async function request(url, opts = {}, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, Object.assign({ signal: ctrl.signal }, opts));
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (e) { /* brak treści */ }
        const err = new Error(msg); err.status = res.status; throw err;
      }
      return res.status === 204 ? null : res.json();
    } finally { clearTimeout(t); }
  }

  /** Najlepsze wyniki. */
  async function top(limit = cfg.limit || 20) {
    if (!enabled) throw new Error('Ranking nie jest skonfigurowany');
    return request(`${base}?select=${FIELDS}&order=${ORDER}&limit=${limit}`, { headers: headers() });
  }

  /** Miejsce wyniku w rankingu (1 = najlepszy). */
  async function placeOf(entry) {
    // liczymy wpisy lepsze od danego: więcej ubitych, albo tyle samo i więcej HP, albo tyle samo i krócej
    const f = `or=(kills.gt.${entry.kills},and(kills.eq.${entry.kills},hp.gt.${entry.hp}),and(kills.eq.${entry.kills},hp.eq.${entry.hp},time_s.lt.${entry.time_s}))`;
    const res = await fetch(`${base}?select=id&${f}`, { headers: Object.assign(headers(), { Prefer: 'count=exact', Range: '0-0' }) });
    const range = res.headers.get('content-range') || '';
    const total = parseInt(range.split('/')[1], 10);
    return Number.isFinite(total) ? total + 1 : null;
  }

  /** Dopisanie wyniku. Zwraca zapisany wpis. */
  async function submit(entry) {
    if (!enabled) throw new Error('Ranking nie jest skonfigurowany');
    const body = {
      name: String(entry.name).trim().slice(0, 20),
      kills: entry.kills | 0, breached: entry.breached | 0,
      hp: entry.hp | 0, time_s: entry.time_s | 0,
    };
    const rows = await request(`${base}?select=${FIELDS}`, {
      method: 'POST',
      headers: Object.assign(headers(), { Prefer: 'return=representation' }),
      body: JSON.stringify(body),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  function formatTime(s) {
    s = Math.max(0, s | 0);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Wypełnia element listą wyników; highlightId wyróżnia własny wpis. */
  function renderList(el, rows, highlightId) {
    el.textContent = '';
    if (!rows || !rows.length) {
      const p = document.createElement('p');
      p.className = 'rank-empty';
      p.textContent = 'Nikt jeszcze nie ocalił Carroburga. Bądź pierwszy!';
      el.appendChild(p);
      return;
    }
    const table = document.createElement('table');
    table.className = 'rank-table';
    const head = document.createElement('tr');
    for (const [txt, cls] of [['#', 'pos'], ['Gwardzista', 'name'], ['Ubici', ''], ['Wdarło', ''], ['HP', ''], ['Czas', '']]) {
      const th = document.createElement('th'); th.textContent = txt; if (cls) th.className = cls; head.appendChild(th);
    }
    table.appendChild(head);
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (highlightId && r.id === highlightId) tr.className = 'me';
      const cells = [String(i + 1), r.name, String(r.kills), String(r.breached), String(r.hp), formatTime(r.time_s)];
      cells.forEach((c, k) => {
        const td = document.createElement('td');
        td.textContent = c;   // textContent — imiona graczy nie są interpretowane jako HTML
        if (k === 0) td.className = 'pos';
        if (k === 1) td.className = 'name';
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    el.appendChild(table);
  }

  return { enabled, top, submit, placeOf, renderList, formatTime };
})();
window.Ranking = Ranking;
