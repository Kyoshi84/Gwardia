'use strict';
/* ==========================================================================
   CARROBURG DEFENCE — Szkarłatna Gwardia
   Mini Tower Defense / arcade, HTML5 Canvas, bez zewnętrznych bibliotek.

   Sekcje pliku:
     1. CONFIG    — stałe, balans, fale
     2. UTIL      — losowość, matematyka
     3. AUDIO     — efekty dźwiękowe syntezowane (WebAudio)
     4. SPRITES   — pixel-art generowany kodem (bohater, Skaveni, rekwizyty)
     5. MAP       — teren, droga, mury, rekwizyty z kolizjami
     6. INPUT     — klawiatura i mysz
     7. ENTITIES  — bohater, wrogowie, cząsteczki
     8. WAVES     — system fal
     9. GAME      — stan gry, aktualizacja logiki
    10. RENDER    — rysowanie
    11. UI        — HUD, ekrany, skalowanie
    12. LOOP      — pętla requestAnimationFrame
   ========================================================================== */

// ==========================================================================
// 1. CONFIG
// ==========================================================================
const W = 320, H = 240;          // bazowa rozdzielczość pixel-art
const HUD_UNITS = 24;            // wysokość paska HUD (w pikselach gry)
const STEP = 1 / 60;             // stały krok symulacji
const BREACH_Y = 214;            // linia bramy — przekroczenie = przedarcie się
const GATE_X = 160;
const HERO_BOUNDS = { minX: 6, maxX: W - 6, minY: 12, maxY: 202 };

const CFG = {
  hero: {
    hp: 100, speed: 70, radius: 5,
    atkCooldown: 0.40, swingTime: 0.20, hitAt: 0.06,
    range: 24, arc: 1.25, dmg: 34, knock: 95,
    iframes: 0.6, healPerWave: 40,
  },
  gateHP: 20,
  enemy: {
    clanrat:     { hp: 30,  speed: 22, radius: 5,  dmg: 6,  reach: 4, windup: 0.40, recover: 0.90, aggro: 30, mass: 1.0, gate: 1, stun: 0.30, poise: false, armored: false },
    stormvermin: { hp: 90,  speed: 15, radius: 6,  dmg: 10, reach: 6, windup: 0.55, recover: 1.10, aggro: 36, mass: 1.8, gate: 2, stun: 0.25, poise: false, armored: true },
    ratogre:     { hp: 440, speed: 11, radius: 10, dmg: 20, reach: 6, windup: 0.75, recover: 1.40, aggro: 46, mass: 6.0, gate: 5, stun: 0.00, poise: true,  armored: false },
  },
};

// Fale: liczba jednostek, odstęp między grupami, max wielkość grupy, wejścia na mapę
const WAVES = [
  { clanrat: 8,  stormvermin: 0,  ratogre: 0, interval: 1.70, pack: 1, paths: ['top'],                  sub: 'Pierwsze klany wypełzają z kanałów' },
  { clanrat: 12, stormvermin: 0,  ratogre: 0, interval: 1.45, pack: 2, paths: ['top', 'left'],          sub: 'Szczury nadchodzą także od zachodu' },
  { clanrat: 12, stormvermin: 2,  ratogre: 0, interval: 1.35, pack: 2, paths: ['top', 'left'],          sub: 'Stormverminy w szeregach wroga!' },
  { clanrat: 14, stormvermin: 4,  ratogre: 0, interval: 1.25, pack: 2, paths: ['top', 'left', 'right'], sub: 'Atakują ze wszystkich stron' },
  { clanrat: 18, stormvermin: 5,  ratogre: 0, interval: 1.15, pack: 3, paths: ['top', 'left', 'right'], sub: 'Hordy gęstnieją' },
  { clanrat: 22, stormvermin: 7,  ratogre: 0, interval: 1.05, pack: 3, paths: ['top', 'left', 'right'], sub: 'W oddali dudnią szczurze bębny' },
  { clanrat: 18, stormvermin: 6,  ratogre: 1, interval: 1.00, pack: 3, paths: ['top', 'left', 'right'], sub: 'Szczuroogr! Mistrzowie Moulder wypuścili bestię' },
  { clanrat: 22, stormvermin: 8,  ratogre: 1, interval: 0.95, pack: 3, paths: ['top', 'left', 'right'], sub: 'Ziemia drży pod łapami bestii' },
  { clanrat: 26, stormvermin: 10, ratogre: 2, interval: 0.90, pack: 3, paths: ['top', 'left', 'right'], sub: 'Rogaty Szczur patrzy na Carroburg' },
  { clanrat: 30, stormvermin: 12, ratogre: 3, interval: 0.85, pack: 4, paths: ['top', 'left', 'right'], sub: 'Ostatnia horda. Adsumus!' },
];

// Droga do bramy (punkty kontrolne). Boczne drogi dołączają do głównej.
const PATH_MAIN = [
  [160, -14], [158, 26], [128, 46], [92, 64], [76, 92], [86, 118], [124, 132],
  [186, 136], [232, 150], [244, 172], [214, 190], [172, 198], [160, 206], [160, 224],
];
const PATHS = {
  top: PATH_MAIN,
  left: [[-14, 56], [40, 60], ...PATH_MAIN.slice(3)],
  right: [[334, 178], [292, 174], ...PATH_MAIN.slice(9)],
};

// Paleta
const PAL = {
  outline: '#140b08',
  red: '#b3151b', redD: '#7a0d12', redL: '#e04a4a', pink: '#f0a0a0',
  skin: '#e3b088', skinD: '#b07a58', hair: '#5a3418', hairD: '#3a200e',
  boot: '#1e1914', bootL: '#3d342b', belt: '#2a1a0e', gold: '#d8a840',
  shirt: '#e8e0cc', feather: '#ece6d4', dark: '#24140a',
  steel: '#c4c8d0', steelD: '#6c7078', grip: '#5a3a1e', guard: '#8a6a3a',
  fur: '#6b6236', furD: '#463f22', furL: '#8a8048', ratPink: '#c48a84',
  eye: '#ff2a1a', tooth: '#e8e0c0', rag: '#5a3c24', ragD: '#3c2616',
  blade: '#9a8e7e', rust: '#7a4a2a',
  arm: '#40444a', armL: '#868c94', armD: '#26292e', furS: '#4f4a38', snoutS: '#6a6450', cloth: '#6e1616',
  haft: '#5a3a1e', axe: '#a8acb4', axeD: '#5c6066',
  fl: '#8e6656', flD: '#62423a', flL: '#b48676', fur2: '#4c3e30', claw: '#e6dcc4', iron: '#5c6066', stitch: '#2a1610',
};

// ==========================================================================
// 2. UTIL
// ==========================================================================
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const fx = x / s, fy = y / s;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
function roadDist(x, y) {
  let best = 1e9;
  for (const key in PATHS) {
    const p = PATHS[key];
    for (let i = 0; i < p.length - 1; i++) {
      const d = distToSeg(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}
function dirFromAngle(a) {
  const c = Math.cos(a), s = Math.sin(a);
  if (Math.abs(c) >= Math.abs(s) * 0.9) return c >= 0 ? 'right' : 'left';
  return s > 0 ? 'down' : 'up';
}

// ==========================================================================
// 3. AUDIO — wszystkie dźwięki generowane programowo
// ==========================================================================
const Sfx = {
  ctx: null, master: null, noiseBuf: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  ok() { return this.ctx && !this.muted && this.ctx.state === 'running'; },
  tone(type, f0, f1, dur, vol, delay = 0) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, ftype, f0, f1, vol, delay = 0, q = 1) {
    if (!this.ok()) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = ftype; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.03);
  },
  swing()    { this.noise(0.15, 'bandpass', 2800, 450, 0.55, 0, 1.4); },
  hit()      { this.noise(0.07, 'lowpass', 1800, 300, 0.6); this.tone('square', 170, 55, 0.09, 0.22); },
  clang()    { this.tone('square', 1250, 900, 0.07, 0.10); this.tone('triangle', 2100, 1700, 0.14, 0.08); },
  squeal()   { const f = 1400 + Math.random() * 600; this.tone('sawtooth', f, f * 0.45, 0.22, 0.08); this.noise(0.12, 'lowpass', 500, 120, 0.35, 0.03); },
  roar()     { this.tone('sawtooth', 150, 50, 0.8, 0.22); this.noise(0.7, 'lowpass', 420, 70, 0.35); },
  hurt()     { this.tone('triangle', 260, 80, 0.22, 0.4); this.noise(0.1, 'lowpass', 900, 200, 0.4); },
  horn()     { this.tone('sawtooth', 147, 147, 0.5, 0.10); this.tone('sawtooth', 220, 220, 0.6, 0.09, 0.32); this.tone('sawtooth', 196, 196, 0.9, 0.09, 0.7); },
  breach()   { this.tone('sine', 110, 60, 0.8, 0.45); this.tone('square', 220, 80, 0.3, 0.05); },
  waveClear(){ [262, 330, 392, 523].forEach((f, i) => this.tone('triangle', f, f, 0.32, 0.14, i * 0.12)); },
  victory()  { [262, 330, 392, 523, 392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, 0.4, 0.15, i * 0.15)); },
  death()    { this.tone('sawtooth', 300, 40, 1.2, 0.18); this.tone('sine', 120, 40, 1.4, 0.3, 0.1); },
};

// ==========================================================================
// 4. SPRITES — pixel-art rysowany kodem, z automatycznym konturem
// ==========================================================================
const PAD = 2;   // margines na kontur

function addOutline(c, col) {
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  const img = g.getImageData(0, 0, w, h);
  const a = img.data;
  const mark = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a[(y * w + x) * 4 + 3] !== 0) continue;
    const solid = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && a[(yy * w + xx) * 4 + 3] > 0;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark[y * w + x] = 1;
  }
  const [r, gg, b] = hexRGB(col);
  for (let i = 0; i < w * h; i++) if (mark[i]) { a[i * 4] = r; a[i * 4 + 1] = gg; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
}

function makeSprite(dw, dh, draw, outline = PAL.outline) {
  const c = makeCanvas(dw + PAD * 2, dh + PAD * 2);
  const g = c.getContext('2d');
  const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + PAD, y + PAD, w, h); };
  const L = (x0, y0, x1, y1, col) => {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      p(x0, y0, 1, 1, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  const circ = (cx, cy, r, col) => {
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      p(cx - w, cy + dy, w * 2 + 1, 1, col);
    }
  };
  draw(p, L, circ);
  if (outline) addOutline(c, outline);
  c.anchorX = Math.floor(c.width / 2);
  c.anchorY = PAD + dh - 1;
  return c;
}

function flipH(src) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
  c.anchorX = src.width - src.anchorX; c.anchorY = src.anchorY;
  return c;
}

const _tintCache = new WeakMap();
function tinted(src, col) {
  let m = _tintCache.get(src);
  if (!m) { m = {}; _tintCache.set(src, m); }
  if (m[col]) return m[col];
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = col; g.fillRect(0, 0, c.width, c.height);
  c.anchorX = src.anchorX; c.anchorY = src.anchorY;
  m[col] = c;
  return c;
}

function makeShadow(w) {
  const h = Math.max(3, Math.ceil(w / 2.6));
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,8,4,0.42)';
  const rx = w / 2, ry = h / 2;
  for (let y = 0; y < h; y++) {
    const t = (y + 0.5 - ry) / ry;
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    g.fillRect(Math.round(rx - half), y, half * 2, 1);
  }
  return c;
}

// ---------- Gwardzista Szkarłatnej Gwardii (Landsknecht) ----------
// projekt 28x25, stopy w wierszu 24
function drawHero(p, dir, fr) {
  const C = PAL;
  if (dir === 'down' || dir === 'up') {
    const st = [0, 1, 0, -1][fr];
    const lo = st > 0 ? -1 : 0, ro = st < 0 ? -1 : 0;
    const la = st, ra = -st;
    // nogi: bufiaste spodnie + czarne buty
    p(9, 16, 5, 5, C.red);  p(10, 17, 1, 3, C.pink);  p(12, 17, 1, 2, C.redL);
    p(15, 16, 5, 5, C.red); p(17, 17, 1, 3, C.pink);  p(16, 17, 1, 2, C.redL);
    p(10, 21 + lo, 4, 4, C.boot); p(10, 21 + lo, 4, 1, C.bootL);
    p(15, 21 + ro, 4, 4, C.boot); p(15, 21 + ro, 4, 1, C.bootL);
    // tułów: szkarłatny kaftan z rozcięciami
    p(8, 9, 12, 7, C.red); p(8, 9, 1, 7, C.redD); p(19, 9, 1, 7, C.redD);
    p(11, 10, 1, 4, C.pink); p(16, 10, 1, 4, C.pink); p(14, 10, 1, 5, C.redD);
    p(8, 15, 12, 1, C.belt);
    if (dir === 'down') { p(10, 9, 8, 1, C.shirt); p(13, 15, 2, 1, C.gold); }
    // rękawy (bufy) + dłonie
    p(5, 9 + la, 3, 5, C.red);  p(6, 10 + la, 1, 3, C.pink);  p(5, 14 + la, 3, 2, C.skin);
    p(20, 9 + ra, 3, 5, C.red); p(21, 10 + ra, 1, 3, C.pink); p(20, 14 + ra, 3, 2, C.skin);
    if (dir === 'down') {
      // włosy + twarz
      p(9, 3, 10, 7, C.hair); p(8, 6, 1, 5, C.hair); p(19, 6, 1, 5, C.hair);
      p(9, 9, 2, 2, C.hair); p(17, 9, 2, 2, C.hair);
      p(10, 4, 8, 5, C.skin); p(10, 8, 8, 1, C.skinD);
      p(11, 6, 2, 1, C.dark); p(15, 6, 2, 1, C.dark); p(13, 7, 2, 1, C.skinD); p(12, 8, 4, 1, C.hairD);
      // szeroki beret z piórem
      p(8, 0, 12, 2, C.red); p(6, 2, 16, 2, C.red); p(6, 3, 16, 1, C.redD); p(9, 0, 5, 1, C.redL);
      p(20, 0, 4, 1, C.feather); p(23, 1, 2, 1, C.feather); p(24, 2, 1, 2, C.feather);
    } else {
      p(9, 3, 10, 9, C.hair); p(10, 10, 8, 2, C.hair);
      p(11, 5, 1, 6, C.hairD); p(15, 6, 1, 5, C.hairD);
      p(8, 0, 12, 3, C.red); p(6, 2, 16, 2, C.red); p(6, 3, 16, 1, C.redD); p(10, 1, 6, 1, C.redL);
      p(3, 1, 4, 1, C.feather); p(2, 2, 2, 1, C.feather); p(2, 3, 1, 1, C.feather);
    }
  } else { // 'right' (lewo = odbicie)
    const a = [0, 2, 0, -2][fr];
    // tylna noga
    p(12 - a, 16, 4, 5, C.redD); p(12 - a, 21, 4, 4, C.boot);
    // tylne ramię
    p(10, 10 - (a >> 1), 3, 5, C.redD);
    // przednia noga
    p(13 + a, 16, 4, 5, C.red); p(14 + a, 17, 1, 3, C.pink);
    p(13 + a, 21, 5, 4, C.boot); p(13 + a, 21, 4, 1, C.bootL);
    // tułów
    p(10, 9, 8, 7, C.red); p(10, 9, 1, 7, C.redD);
    p(13, 10, 1, 4, C.pink); p(16, 10, 1, 4, C.pink);
    p(13, 9, 4, 1, C.shirt); p(10, 15, 8, 1, C.belt); p(16, 15, 1, 1, C.gold);
    // przedni rękaw i dłoń
    p(13 + (a >> 1), 10, 4, 5, C.red); p(14 + (a >> 1), 11, 1, 2, C.pink); p(16 + (a >> 1), 14, 3, 2, C.skin);
    // włosy, twarz
    p(9, 4, 6, 8, C.hair); p(9, 9, 3, 3, C.hair);
    p(14, 4, 4, 5, C.skin); p(18, 6, 1, 1, C.skin);
    p(16, 5, 1, 1, C.dark); p(15, 8, 3, 1, C.hairD); p(14, 8, 1, 1, C.skinD);
    // beret z piórem
    p(10, 0, 9, 2, C.red); p(8, 2, 13, 2, C.red); p(8, 3, 13, 1, C.redD); p(11, 0, 4, 1, C.redL);
    p(4, 1, 5, 1, C.feather); p(3, 2, 2, 1, C.feather); p(2, 3, 1, 1, C.feather);
  }
}

// ---------- Skaven Clanrat — projekt 18x17 ----------
function drawClanrat(p, L, dir, fr, atk) {
  const C = PAL;
  const st = [0, 1, 0, -1][fr];
  if (dir === 'down' || dir === 'up') {
    const lo = st > 0 ? -1 : 0, ro = st < 0 ? -1 : 0;
    if (dir === 'down') { p(12, 1, 1, 3, C.ratPink); p(13, 0, 2, 1, C.ratPink); }
    p(6, 13 + lo, 2, 3, C.furD); p(10, 13 + ro, 2, 3, C.furD);
    p(5, 16 + lo, 3, 1, C.ratPink); p(10, 16 + ro, 3, 1, C.ratPink);
    p(5, 7, 8, 7, C.fur); p(5, 7, 1, 7, C.furD); p(12, 7, 1, 7, C.furD);
    if (dir === 'down') p(7, 8, 4, 3, C.furL); else p(8, 7, 2, 6, C.furD);
    p(5, 11, 8, 3, C.rag); p(6, 13, 2, 1, C.ragD); p(10, 13, 1, 1, C.ragD);
    p(3, 8 - st, 2, 4, C.fur); p(3, 12 - st, 2, 1, C.ratPink);
    // ramię z bronią
    if (atk === 1)      { p(13, 4, 2, 4, C.fur); p(14, 0, 1, 5, C.blade); p(15, 1, 1, 3, C.rust); }
    else if (atk === 2) { p(13, 9, 2, 3, C.fur); p(13, 12, 1, 5, C.blade); p(14, 13, 1, 3, C.rust); }
    else { p(13, 8 + st, 2, 4, C.fur); p(13, 12 + st, 2, 1, C.ratPink); p(15, 9 + st, 1, 6, C.blade); p(15, 8 + st, 1, 1, C.ragD); }
    if (dir === 'down') {
      p(6, 2, 6, 5, C.fur); p(5, 1, 2, 3, C.fur); p(11, 1, 2, 3, C.fur);
      p(5, 1, 1, 1, C.ratPink); p(12, 1, 1, 1, C.ratPink);
      p(7, 5, 4, 2, C.furL); p(8, 7, 2, 1, C.ratPink); p(9, 8, 1, 1, C.tooth);
      p(7, 4, 1, 1, C.eye); p(10, 4, 1, 1, C.eye);
    } else {
      p(6, 3, 6, 5, C.fur); p(5, 2, 2, 3, C.fur); p(11, 2, 2, 3, C.fur); p(8, 3, 2, 3, C.furD);
      p(9, 14, 1, 2, C.ratPink); p(10, 16, 3, 1, C.ratPink); p(13, 15, 1, 1, C.ratPink);
    }
  } else {
    const ty = fr % 2;
    p(0, 9 + ty, 1, 1, C.ratPink); p(1, 10 - ty, 2, 1, C.ratPink); p(3, 10, 1, 1, C.ratPink);
    p(5 - st, 13, 2, 3, C.furD); p(9 + st, 13, 2, 3, C.furD);
    p(4 - st, 16, 3, 1, C.ratPink); p(9 + st, 16, 3, 1, C.ratPink);
    p(3, 6, 9, 7, C.fur); p(3, 6, 9, 1, C.furD); p(6, 11, 5, 1, C.furL);
    p(4, 10, 7, 3, C.rag); p(5, 12, 2, 1, C.ragD);
    p(10, 3, 5, 5, C.fur); p(14, 5, 3, 2, C.furL); p(17, 5, 1, 1, C.ratPink); p(15, 7, 1, 1, C.tooth);
    p(12, 4, 1, 1, C.eye); p(10, 1, 2, 3, C.fur); p(10, 1, 1, 1, C.ratPink);
    if (atk === 1)      { p(8, 4, 2, 4, C.fur); L(9, 3, 5, 0, C.blade); }
    else if (atk === 2) { p(11, 9, 3, 2, C.fur); p(14, 10, 4, 1, C.blade); p(14, 9, 1, 1, C.rust); }
    else { p(10, 9 + (st & 1), 2, 3, C.fur); p(12, 7 + (st & 1), 1, 6, C.blade); p(12, 13 + (st & 1), 1, 1, C.ragD); }
  }
}

// ---------- Skaven Stormvermin — projekt 20x20 ----------
function drawStormvermin(p, L, dir, fr, atk) {
  const C = PAL;
  const st = [0, 1, 0, -1][fr];
  if (dir === 'down' || dir === 'up') {
    const lo = st > 0 ? -1 : 0, ro = st < 0 ? -1 : 0;
    if (dir === 'down') { p(14, 2, 1, 3, C.ratPink); p(15, 1, 2, 1, C.ratPink); }
    p(6, 15 + lo, 3, 4, C.armD); p(11, 15 + ro, 3, 4, C.armD);
    p(6, 19 + lo, 3, 1, C.ratPink); p(11, 19 + ro, 3, 1, C.ratPink);
    p(5, 8, 10, 8, C.arm); p(5, 8, 1, 8, C.armD); p(14, 8, 1, 8, C.armD); p(6, 9, 2, 4, C.armL);
    p(8, 10, 4, 7, C.cloth);
    if (dir === 'down') { p(9, 12, 2, 1, C.gold); p(10, 13, 1, 1, C.gold); }
    p(3, 7, 4, 3, C.arm); p(3, 7, 4, 1, C.armL); p(13, 7, 4, 3, C.arm); p(13, 7, 4, 1, C.armL);
    p(3, 10, 2, 4, C.furS); p(3, 14, 2, 1, C.ratPink);
    p(15, 10, 2, 4, C.furS);
    // halabarda
    if (atk === 1)      { p(17, 0, 1, 12, C.haft); p(18, 0, 2, 4, C.axe); p(16, 0, 1, 2, C.axeD); }
    else if (atk === 2) { L(16, 9, 9, 18, C.haft); p(6, 17, 4, 2, C.axe); p(5, 16, 2, 1, C.axeD); }
    else { p(17, 3 + st, 1, 15, C.haft); p(18, 2 + st, 2, 4, C.axe); p(16, 1 + st, 1, 3, C.axeD); p(17, 0 + st, 1, 2, C.axeD); }
    if (dir === 'down') {
      p(7, 2, 6, 6, C.furS); p(7, 1, 6, 3, C.arm); p(8, 1, 4, 1, C.armL); p(9, 0, 2, 1, C.armD);
      p(6, 2, 1, 2, C.furS); p(13, 2, 1, 2, C.furS);
      p(8, 6, 4, 2, C.snoutS); p(9, 8, 2, 1, C.ratPink); p(10, 9, 1, 1, C.tooth);
      p(8, 4, 1, 1, C.eye); p(11, 4, 1, 1, C.eye);
    } else {
      p(7, 3, 6, 5, C.furS); p(7, 2, 6, 4, C.arm); p(8, 2, 4, 1, C.armL); p(9, 1, 2, 1, C.armD);
      p(6, 3, 1, 2, C.furS); p(13, 3, 1, 2, C.furS);
      p(10, 16, 1, 2, C.ratPink); p(11, 18, 3, 1, C.ratPink);
    }
  } else {
    const ty = fr % 2;
    p(0, 11 + ty, 2, 1, C.ratPink); p(2, 12 - ty, 2, 1, C.ratPink);
    p(5 - st, 15, 3, 4, C.armD); p(10 + st, 15, 3, 4, C.armD);
    p(5 - st, 19, 3, 1, C.ratPink); p(10 + st, 19, 4, 1, C.ratPink);
    p(4, 8, 10, 8, C.arm); p(4, 8, 10, 1, C.armL); p(4, 15, 10, 1, C.armD);
    p(6, 10, 6, 6, C.cloth); p(4, 7, 5, 3, C.arm); p(4, 7, 5, 1, C.armL);
    p(12, 4, 6, 5, C.furS); p(12, 3, 6, 2, C.arm); p(13, 3, 3, 1, C.armL); p(14, 2, 2, 1, C.armD);
    p(17, 6, 3, 2, C.snoutS); p(19, 6, 1, 1, C.ratPink); p(18, 8, 1, 1, C.tooth); p(15, 5, 1, 1, C.eye);
    if (atk === 1)      { L(6, 0, 13, 13, C.haft); p(4, 0, 3, 3, C.axe); p(7, 0, 1, 1, C.axeD); p(12, 9, 2, 3, C.furS); }
    else if (atk === 2) { L(10, 11, 19, 15, C.haft); p(17, 13, 3, 4, C.axe); p(16, 16, 1, 1, C.axeD); p(12, 10, 3, 2, C.furS); }
    else { p(15, 2 + (st & 1), 1, 16, C.haft); p(16, 2 + (st & 1), 2, 4, C.axe); p(14, 1 + (st & 1), 1, 3, C.axeD); p(13, 10, 2, 3, C.furS); }
  }
}

// ---------- Rat Ogre (szczuroogr) — projekt 32x30 ----------
function drawRatOgre(p, L, dir, fr, atk) {
  const C = PAL;
  const st = [0, 1, 0, -1][fr];
  if (dir === 'down' || dir === 'up') {
    const lo = st > 0 ? -1 : 0, ro = st < 0 ? -1 : 0;
    if (dir === 'down') { p(24, 1, 2, 6, C.ratPink); p(26, 0, 2, 2, C.ratPink); }
    p(8, 22 + lo, 6, 7, C.flD); p(18, 22 + ro, 6, 7, C.flD);
    p(8, 29 + lo, 6, 1, C.claw); p(18, 29 + ro, 6, 1, C.claw);
    p(5, 9, 22, 14, C.fl); p(5, 21, 22, 2, C.flD);
    if (dir === 'down') {
      p(9, 11, 6, 5, C.flL); p(17, 11, 6, 5, C.flL);
      L(10, 17, 15, 20, C.stitch); L(11, 17, 12, 18, C.stitch);
      p(19, 17, 1, 4, C.stitch); p(18, 18, 3, 1, C.stitch); p(18, 20, 3, 1, C.stitch);
      p(11, 8, 10, 2, C.iron); p(12, 8, 2, 1, C.armL); p(18, 8, 2, 1, C.armL);
    } else {
      for (let i = 0; i < 5; i++) p(15, 9 + i * 3, 2, 2, C.flD);
      L(8, 12, 12, 18, C.stitch); L(23, 11, 20, 17, C.stitch);
      p(10, 8, 12, 2, C.iron);
    }
    p(5, 9, 4, 6, C.fur2); p(23, 10, 4, 5, C.fur2);
    p(1, 7, 7, 6, C.fl); p(1, 7, 7, 1, C.flL); p(24, 7, 7, 6, C.fl); p(24, 7, 7, 1, C.flL);
    if (atk === 1) {
      p(0, 0, 5, 9, C.fl); p(27, 0, 5, 9, C.fl); p(0, 0, 5, 1, C.claw); p(27, 0, 5, 1, C.claw);
      p(1, 0, 1, 1, C.outline); p(29, 0, 1, 1, C.outline);
    } else if (atk === 2) {
      p(3, 15, 7, 8, C.fl); p(22, 15, 7, 8, C.fl);
      p(4, 23, 6, 2, C.claw); p(22, 23, 6, 2, C.claw);
    } else {
      p(0, 12 + st, 5, 10, C.fl); p(27, 12 - st, 5, 10, C.fl);
      p(0, 22 + st, 5, 2, C.claw); p(27, 22 - st, 5, 2, C.claw);
      p(1, 23 + st, 1, 1, C.outline); p(29, 23 - st, 1, 1, C.outline);
    }
    if (dir === 'down') {
      p(12, 3, 8, 7, C.fur2); p(11, 2, 2, 3, C.fur2); p(19, 2, 2, 3, C.fur2);
      p(11, 2, 1, 1, C.ratPink); p(20, 2, 1, 1, C.ratPink);
      p(13, 7, 6, 3, C.fl); p(15, 9, 2, 1, C.ratPink);
      p(13, 5, 2, 1, C.eye); p(17, 5, 2, 1, C.eye);
      p(14, 10, 1, 1, C.claw); p(17, 10, 1, 1, C.claw);
    } else {
      p(12, 3, 8, 7, C.fur2); p(11, 2, 2, 3, C.fur2); p(19, 2, 2, 3, C.fur2); p(14, 4, 4, 4, C.flD);
      p(14, 23, 3, 3, C.ratPink); p(15, 26, 2, 3, C.ratPink);
    }
  } else {
    const ty = fr % 2;
    p(0, 13 + ty, 4, 2, C.ratPink); p(3, 12, 3, 2, C.ratPink);
    p(7 - st, 22, 6, 7, C.flD); p(16 + st, 22, 6, 7, C.flD);
    p(7 - st, 29, 6, 1, C.claw); p(16 + st, 29, 7, 1, C.claw);
    p(4, 8, 20, 15, C.fl); p(4, 8, 20, 2, C.fur2); p(4, 21, 20, 2, C.flD);
    p(8, 6, 10, 4, C.fl); p(8, 6, 10, 1, C.flL);
    L(9, 13, 14, 18, C.stitch); p(15, 12, 1, 5, C.stitch); p(14, 13, 3, 1, C.stitch); p(14, 15, 3, 1, C.stitch);
    p(8, 13, 5, 10, C.flD);
    p(21, 9, 8, 7, C.fur2); p(22, 7, 2, 3, C.fur2); p(22, 7, 1, 1, C.ratPink);
    p(27, 12, 5, 3, C.fl); p(31, 12, 1, 1, C.ratPink); p(28, 15, 1, 1, C.claw); p(30, 15, 1, 1, C.claw);
    p(25, 11, 1, 1, C.eye);
    p(19, 8, 2, 4, C.iron);
    if (atk === 1)      { p(15, 0, 6, 12, C.fl); p(15, 0, 6, 2, C.claw); p(16, 0, 1, 1, C.outline); }
    else if (atk === 2) { p(20, 16, 10, 5, C.fl); p(30, 16, 2, 5, C.claw); }
    else { p(18, 14, 6, 11, C.fl); p(18, 14, 6, 1, C.flL); p(19, 25 + (st & 1), 5, 2, C.claw); }
  }
}

// ---------- Rekwizyty ----------
function makeTree(seed) {
  const r = mulberry32(seed);
  return makeSprite(26, 30, (p, L, circ) => {
    p(11, 22, 4, 8, '#3b2816'); p(12, 22, 1, 7, '#5a3c22'); p(9, 29, 8, 1, '#3b2816');
    const blobs = [[13, 12, 9], [7, 15, 6], [19, 15, 6], [13, 6, 6]].map(([x, y, rr]) =>
      [x + Math.round(r() * 2 - 1), y + Math.round(r() * 2 - 1), rr + Math.round(r())]);
    for (const [x, y, rr] of blobs) circ(x, y, rr, '#1f3018');
    for (const [x, y, rr] of blobs) circ(x - 1, y - 1, rr - 2, '#2d4622');
    for (const [x, y, rr] of blobs) if (rr - 5 > 0) circ(x - 2, y - 2, rr - 5, '#43622e');
    for (let i = 0; i < 14; i++) p(3 + Math.floor(r() * 20), 2 + Math.floor(r() * 18), 1, 1, r() > 0.5 ? '#1f3018' : '#56783a');
  });
}
function makeDeadTree(seed) {
  const r = mulberry32(seed);
  return makeSprite(22, 28, (p, L) => {
    p(9, 10, 3, 18, '#3a2a1c'); p(10, 12, 1, 14, '#544030'); p(7, 27, 7, 1, '#3a2a1c');
    L(10, 12, 3, 4, '#3a2a1c'); L(3, 4, 2, 1, '#3a2a1c'); L(11, 10, 18, 3, '#3a2a1c'); L(18, 3, 20, 2, '#3a2a1c');
    L(10, 8, 9, 0, '#3a2a1c'); L(6, 8, 4, 10, '#3a2a1c'); L(15, 7, 17, 9, '#3a2a1c');
    if (r() > 0.5) { p(17, 9, 2, 1, '#2a2a28'); p(18, 10, 1, 2, '#2a2a28'); }
  });
}
function makeRock(seed) {
  const r = mulberry32(seed);
  const w = 9 + Math.floor(r() * 4);
  return makeSprite(w + 2, 8, (p) => {
    p(1, 2, w, 5, '#5e5c58'); p(0, 3, w + 2, 3, '#5e5c58'); p(2, 1, w - 2, 1, '#5e5c58');
    p(2, 1, w - 4, 1, '#8a8680'); p(1, 2, 3, 1, '#8a8680'); p(1, 6, w, 1, '#3e3c38');
    p(Math.floor(w / 2), 2, 2, 1, '#4a5a2a');
  });
}
function makeBarrel() {
  return makeSprite(8, 10, (p) => {
    p(0, 1, 8, 9, '#5a3c22'); p(1, 0, 6, 1, '#7a5432'); p(1, 1, 6, 2, '#3a2614');
    p(0, 3, 8, 1, '#4a4a4e'); p(0, 7, 8, 1, '#4a4a4e'); p(2, 4, 1, 3, '#7a5432');
  });
}
function makeCart() {
  return makeSprite(30, 18, (p, L, circ) => {
    // przewrócony wóz: skrzynia, złamany dyszel, jedno koło zerwane
    p(3, 4, 20, 8, '#5a3c22'); p(3, 4, 20, 1, '#7a5432');
    for (let x = 5; x < 23; x += 4) p(x, 5, 1, 7, '#3e2816');
    p(2, 3, 22, 1, '#3e2816'); p(2, 12, 22, 1, '#3e2816');
    L(23, 8, 29, 4, '#6a4a2a'); L(23, 9, 28, 6, '#3e2816');
    circ(7, 13, 4, '#3a2614'); circ(7, 13, 2, '#6a4a2a'); p(7, 13, 1, 1, '#2a1a0c');
    L(4, 13, 10, 13, '#2a1a0c'); L(7, 10, 7, 16, '#2a1a0c');
    p(19, 14, 8, 3, '#3a2614'); p(20, 15, 6, 1, '#6a4a2a');
    for (let i = 0; i < 8; i++) p(8 + i * 2, 1 + (i % 2), 2, 2, i % 3 ? '#8a7a3a' : '#a8964a');
  });
}

// Zestaw sprite'ów postaci: {down, up, right, left} × klatki
function buildSet(dw, dh, fn, frames) {
  const set = {};
  for (const dir of ['down', 'up', 'right']) {
    set[dir] = frames.map(([fr, atk]) => makeSprite(dw, dh, (p, L) => fn(p, L, dir, fr, atk)));
  }
  set.left = set.right.map(flipH);
  return set;
}
function makeCorpse(src) {
  const c = makeCanvas(src.height, src.width);
  const g = c.getContext('2d');
  g.translate(src.height, 0); g.rotate(Math.PI / 2); g.drawImage(src, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(40,6,4,0.45)'; g.fillRect(0, 0, c.width, c.height);
  return c;
}

const SPR = {};
function buildSprites() {
  const walk = [[0, 0], [1, 0], [2, 0], [3, 0]];
  const enemyFrames = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [0, 2]];
  SPR.hero = buildSet(28, 25, (p, L, dir, fr) => drawHero(p, dir, fr), walk);
  SPR.clanrat = buildSet(18, 17, drawClanrat, enemyFrames);
  SPR.stormvermin = buildSet(20, 20, drawStormvermin, enemyFrames);
  SPR.ratogre = buildSet(32, 30, drawRatOgre, enemyFrames);
  SPR.corpse = {
    clanrat: makeCorpse(SPR.clanrat.right[0]),
    stormvermin: makeCorpse(SPR.stormvermin.right[0]),
    ratogre: makeCorpse(SPR.ratogre.right[0]),
  };
  SPR.trees = [makeTree(11), makeTree(23), makeTree(37)];
  SPR.deadTree = [makeDeadTree(5), makeDeadTree(9)];
  SPR.rocks = [makeRock(3), makeRock(8), makeRock(14)];
  SPR.barrel = makeBarrel();
  SPR.cart = makeCart();
  SPR.shadow = { 10: makeShadow(10), 12: makeShadow(12), 14: makeShadow(14), 16: makeShadow(16), 26: makeShadow(26) };
}

// ==========================================================================
// 5. MAP — teren okolic Carroburga
// ==========================================================================
const MAP = { ground: null, props: [], torches: [[143, 211], [177, 211]] };

function buildGround() {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  const grass = ['#2f3a1c', '#38451f', '#424f25', '#4c5a2b'].map(hexRGB);
  const mud = ['#4a3b29', '#56452f', '#625037'].map(hexRGB);
  const rut = hexRGB('#3f3224');
  const furrowA = hexRGB('#4a3620'), furrowB = hexRGB('#5a4429'), sprout = hexRGB('#5b6a2e');
  const fields = [
    { x: 4, y: 4, w: 100, h: 34, v: false },
    { x: 214, y: 18, w: 102, h: 56, v: true },
    { x: 6, y: 146, w: 64, h: 44, v: false },
    { x: 264, y: 92, w: 52, h: 44, v: true },
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = vnoise(x, y, 14) * 0.7 + vnoise(x, y, 5) * 0.3;
      let col = grass[clamp(Math.floor(n * 3.4 + bayer(x, y) - 0.4), 0, 3)];
      for (const f of fields) {
        if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) {
          const k = f.v ? x - f.x : y - f.y;
          col = (k % 4) < 2 ? furrowA : furrowB;
          if (hash2(x, y) > 0.94) col = sprout;
        }
      }
      const rd = roadDist(x, y);
      if (rd < 9.5) {
        const m = vnoise(x + 100, y, 6);
        col = mud[clamp(Math.floor(m * 2.6 + bayer(x, y) - 0.3), 0, 2)];
        if (Math.abs(rd - 4.5) < 0.7 && hash2(x, y) > 0.25) col = rut;
      } else if (rd < 12) {
        if ((rd - 9.5) / 2.5 < bayer(x, y)) col = mud[0];
      }
      const i = (y * W + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  const rng = mulberry32(1517);
  // kałuże na drodze
  for (let k = 0; k < 9; k++) {
    const path = PATH_MAIN, i = 1 + Math.floor(rng() * (path.length - 4));
    const t = rng();
    const x = Math.round(path[i][0] + (path[i + 1][0] - path[i][0]) * t + rng() * 6 - 3);
    const y = Math.round(path[i][1] + (path[i + 1][1] - path[i][1]) * t + rng() * 4 - 2);
    if (y > 196) continue;
    const w = 4 + Math.floor(rng() * 5);
    g.fillStyle = '#2b2e2a'; g.fillRect(x - w / 2, y, w, 2); g.fillRect(x - w / 2 + 1, y - 1, w - 2, 4);
    g.fillStyle = '#5a625c'; g.fillRect(x - w / 2 + 1, y, 2, 1);
  }
  // płoty wzdłuż pól
  const fence = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.floor(len / 6);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + (x1 - x0) * s / steps), y = Math.round(y0 + (y1 - y0) * s / steps);
      if (roadDist(x, y) < 13) continue;
      g.fillStyle = '#1e140c'; g.fillRect(x - 1, y - 5, 3, 7);
      g.fillStyle = '#6a4a2a'; g.fillRect(x, y - 5, 1, 6);
      if (s < steps && roadDist(x + 3, y) > 13) {
        g.fillStyle = '#5a3e22'; g.fillRect(x, y - 3, (x1 - x0) / steps + 1, 1);
      }
    }
  };
  fence(4, 40, 104, 40); fence(214, 77, 316, 77); fence(6, 193, 70, 193); fence(262, 139, 316, 139);

  // palisada przed murem (dekoracja)
  for (let x = 8; x < 316; x += 7) {
    if (Math.abs(x - GATE_X) < 50) continue;
    g.fillStyle = '#1e140c'; g.fillRect(x - 1, 199, 3, 6);
    g.strokeStyle = 'transparent';
    g.fillStyle = '#5a3e22'; g.fillRect(x, 198, 1, 6);
    g.fillStyle = '#8a6a44'; g.fillRect(x, 197, 1, 1);
  }

  drawWalls(g);
  return c;
}

function drawWalls(g) {
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // mur
  P(0, 214, W, 26, '#57524c');
  for (let row = 0; row < 6; row++) {
    const y = 216 + row * 4;
    P(0, y, W, 1, '#3e3a35');
    for (let x = (row % 2) * 5; x < W; x += 10) { P(x, y, 1, 4, '#3e3a35'); P(x + 1, y + 1, 4, 1, '#6c665f'); }
  }
  P(0, 212, W, 3, '#7a746c'); P(0, 215, W, 1, '#2e2a26');
  for (let x = 0; x < W; x += 8) { P(x, 207, 5, 5, '#6a645d'); P(x, 207, 5, 1, '#8a847c'); P(x + 5, 207, 1, 5, '#2e2a26'); }
  // wieże
  for (const tx of [122, 174]) {
    P(tx, 204, 24, 36, '#4e4a45');
    for (let row = 0; row < 9; row++) {
      const y = 206 + row * 4;
      P(tx, y, 24, 1, '#35322e');
      for (let x = tx + (row % 2) * 4; x < tx + 24; x += 8) P(x, y, 1, 4, '#35322e');
    }
    for (let x = tx; x < tx + 24; x += 6) { P(x, 199, 4, 5, '#5e5953'); P(x, 199, 4, 1, '#837d75'); }
    P(tx, 204, 24, 1, '#2a2622'); P(tx - 1, 199, 1, 41, '#1e1a16'); P(tx + 24, 199, 1, 41, '#1e1a16');
    // proporzec Carroburga
    const bx = tx + 8;
    P(bx, 218, 8, 14, '#9b1418'); P(bx + 3, 218, 2, 14, '#e8e0d0'); P(bx, 232, 3, 2, '#9b1418'); P(bx + 5, 232, 3, 2, '#9b1418');
    P(bx - 1, 217, 10, 1, '#2a1a0e');
  }
  // brama
  P(146, 206, 28, 34, '#120c08');
  P(147, 204, 26, 2, '#120c08'); P(149, 202, 22, 2, '#120c08');
  for (let x = 148; x < 173; x += 3) P(x, 203, 1, 8, '#3a3a3e');
  P(147, 210, 26, 1, '#3a3a3e');
  P(146, 214, 3, 26, '#3a2616'); P(171, 214, 3, 26, '#3a2616');
  P(146, 220, 3, 1, '#5a5a5e'); P(171, 220, 3, 1, '#5a5a5e');
}

function placeProps() {
  const rng = mulberry32(2024);
  const props = [];
  const ok = (x, y, r, minRoad) => {
    if (x < 10 || x > W - 10 || y < 18 || y > 188) return false;
    if (roadDist(x, y) < minRoad + r) return false;
    for (const q of props) if (Math.hypot(q.x - x, q.y - y) < q.r + r + 14) return false;
    return true;
  };
  const tryPlace = (count, mk, r, minRoad = 16) => {
    let placed = 0, tries = 0;
    while (placed < count && tries++ < 600) {
      const x = Math.round(10 + rng() * (W - 20)), y = Math.round(18 + rng() * 172);
      if (!ok(x, y, r, minRoad)) continue;
      props.push(Object.assign({ x, y, r }, mk(placed)));
      placed++;
    }
  };
  // wóz przy drodze — ustawiony ręcznie
  props.push({ x: 112, y: 104, r: 9, spr: SPR.cart, shadow: 26 });
  props.push({ x: 268, y: 160, r: 4, spr: SPR.barrel, shadow: 10 });
  tryPlace(12, i => ({ spr: SPR.trees[i % 3], shadow: 16, solidR: 4 }), 4, 18);
  tryPlace(3, i => ({ spr: SPR.deadTree[i % 2], shadow: 12 }), 3, 16);
  tryPlace(8, i => ({ spr: SPR.rocks[i % 3], shadow: 12 }), 5, 14);
  tryPlace(2, () => ({ spr: SPR.barrel, shadow: 10 }), 4, 16);
  MAP.props = props;
}

// ==========================================================================
// 6. INPUT — klawiatura i mysz
// ==========================================================================
const Input = {
  keys: new Set(),
  attackHeld: false,
  pressT: 0,          // bufor wciśnięcia ataku
  aimAngle: null,     // kierunek wskazany myszą
  bot: null,          // sterowanie testowe (dx, dy)
  init(canvas) {
    window.addEventListener('keydown', e => {
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (k === 'Space') { this.attackHeld = true; if (!e.repeat) this.pressT = 0.18; }
      else if (k === 'KeyP' || k === 'Escape') { if (!e.repeat) Game.togglePause(); }
      else if (k === 'KeyM') { if (!e.repeat) UI.toggleSound(true); }
      else if (k === 'Enter') { if (G.state === 'menu') Game.start(); }
      this.keys.add(k);
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.attackHeld = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.attackHeld = false; if (G.state === 'play') Game.togglePause(); });
    canvas.addEventListener('mousedown', e => {
      if (G.state !== 'play') return;
      const r = canvas.getBoundingClientRect();
      const gx = (e.clientX - r.left) / r.width * W, gy = (e.clientY - r.top) / r.height * H;
      const h = G.hero;
      this.aimAngle = Math.atan2(gy - (h.y - 9), gx - h.x);
      this.pressT = 0.18;
      e.preventDefault();
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  },
  axis() {
    if (this.bot) return [this.bot.dx, this.bot.dy];
    const k = this.keys;
    const dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const dy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    return [dx, dy];
  },
};

// ==========================================================================
// 7. ENTITIES
// ==========================================================================
const G = {
  state: 'menu', hero: null, enemies: [], particles: [],
  wave: 0, phase: 'pre', phaseT: 0, spawnQueue: [], spawnT: 0,
  waveTotal: 0, waveDone: 0, kills: 0, breached: 0, gateHP: CFG.gateHP,
  shake: 0, hitstop: 0, time: 0, endT: -1, endReason: '',
  decals: null, decalCtx: null,
};

function newHero() {
  return {
    x: 160, y: 180, hp: CFG.hero.hp, facing: -Math.PI / 2, dir: 'up',
    moving: false, walkT: 0, atkCd: 0, swingT: -1, swingFrom: 0, hitDone: true,
    inv: 0, hurtT: 0, kbx: 0, kby: 0, dead: false, deathT: 0,
  };
}

function spawnEnemy(type, pathKey, jitter = 0) {
  const cfg = CFG.enemy[type];
  const path = PATHS[pathKey];
  const ang = Math.random() * Math.PI * 2;
  const e = {
    type, cfg, path, wp: 1,
    x: path[0][0] + Math.cos(ang) * jitter, y: path[0][1] + Math.sin(ang) * jitter,
    ox: rand(-6, 6), oy: rand(-4, 4), speedMul: rand(0.9, 1.12),
    r: cfg.radius, hp: cfg.hp, maxHp: cfg.hp,
    state: 'walk', stateT: 0, face: Math.PI / 2, moving: true, animT: Math.random(),
    kbx: 0, kby: 0, flash: 0, remove: false, prog: 0,
  };
  G.enemies.push(e);
  if (type === 'ratogre') Sfx.roar();
  return e;
}

function addParticle(o) {
  if (G.particles.length > 500) G.particles.shift();
  G.particles.push(Object.assign({ z: 6, vz: 0, life: 0.6, max: 0.6, size: 1, stamp: false, grav: 220 }, o));
}
function bloodBurst(x, y, nx, ny, n, big = false) {
  for (let i = 0; i < n; i++) {
    const s = rand(20, big ? 90 : 60);
    const a = Math.atan2(ny, nx) + rand(-0.9, 0.9);
    addParticle({
      x, y, z: rand(4, 10), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(20, 70),
      col: Math.random() < 0.5 ? '#8a1410' : '#5a0c0a', life: 1.2, max: 1.2, stamp: true, size: Math.random() < 0.3 ? 2 : 1,
    });
  }
}
function sparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(40, 110);
    addParticle({ x, y, z: 9, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(10, 50), col: Math.random() < 0.5 ? '#fff4c0' : '#f0a030', life: 0.25, max: 0.25, grav: 60 });
  }
}
function stampDecal(fn) { fn(G.decalCtx); }

// ==========================================================================
// 8. WAVES — budowa kolejki i postęp fal
// ==========================================================================
function buildSpawnQueue(def) {
  const units = [];
  for (let i = 0; i < def.clanrat; i++) units.push('clanrat');
  for (let i = 0; i < def.stormvermin; i++) units.push('stormvermin');
  for (let i = units.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [units[i], units[j]] = [units[j], units[i]]; }
  for (let k = 0; k < def.ratogre; k++) {
    const pos = Math.floor(units.length * (0.35 + 0.55 * (def.ratogre === 1 ? 0.5 : k / (def.ratogre - 1))));
    units.splice(pos, 0, 'ratogre');
  }
  const events = [];
  for (let i = 0; i < units.length;) {
    const t = units[i];
    const path = t === 'ratogre' ? 'top' : def.paths[Math.floor(Math.random() * def.paths.length)];
    if (t === 'clanrat') {
      const size = 1 + Math.floor(Math.random() * def.pack);
      const group = [];
      while (group.length < size && units[i] === 'clanrat') { group.push('clanrat'); i++; }
      events.push({ types: group, path });
    } else { events.push({ types: [t], path }); i++; }
  }
  return events;
}

function beginWave(n) {
  const def = WAVES[n - 1];
  G.wave = n;
  G.spawnQueue = buildSpawnQueue(def);
  G.waveTotal = def.clanrat + def.stormvermin + def.ratogre;
  G.waveDone = 0;
  G.phase = 'pre';
  G.phaseT = 2.6;
  G.spawnT = 0;
  UI.banner(`Fala ${n}`, def.sub, 2.4, n >= 7 && def.ratogre > 0);
  Sfx.horn();
}

function updateWaves(dt) {
  if (G.phase === 'pre') {
    G.phaseT -= dt;
    if (G.phaseT <= 0) { G.phase = 'fight'; G.spawnT = 0; }
  } else if (G.phase === 'fight') {
    G.spawnT -= dt;
    if (G.spawnT <= 0 && G.spawnQueue.length) {
      const ev = G.spawnQueue.shift();
      ev.types.forEach((t, i) => spawnEnemy(t, ev.path, i === 0 ? 0 : 7));
      const def = WAVES[G.wave - 1];
      G.spawnT = def.interval * rand(0.75, 1.25) * (ev.types[0] === 'ratogre' ? 1.8 : 1) * (0.8 + 0.2 * ev.types.length);
    }
    if (!G.spawnQueue.length && G.enemies.length === 0) {
      G.phase = 'clear';
      G.phaseT = 3.0;
      const h = G.hero;
      if (!h.dead) h.hp = Math.min(CFG.hero.hp, h.hp + CFG.hero.healPerWave);
      if (G.wave >= WAVES.length) {
        G.phaseT = 1.2;
        UI.banner('Zwycięstwo!', 'Carroburg ocalony', 2, false);
      } else {
        UI.banner(`Fala ${G.wave} odparta!`, `Gwardzista opatruje rany (+${CFG.hero.healPerWave} HP)`, 2.4, false);
      }
      Sfx.waveClear();
      // blakną ślady walki
      const g = G.decalCtx;
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
    }
  } else if (G.phase === 'clear') {
    G.phaseT -= dt;
    if (G.phaseT <= 0) {
      if (G.wave >= WAVES.length) Game.victory();
      else beginWave(G.wave + 1);
    }
  }
}

// ==========================================================================
// 9. GAME — logika
// ==========================================================================
const Game = {
  reset() {
    G.hero = newHero();
    G.enemies = []; G.particles = [];
    G.kills = 0; G.breached = 0; G.gateHP = CFG.gateHP;
    G.wave = 0; G.phase = 'pre'; G.spawnQueue = []; G.waveTotal = 0; G.waveDone = 0;
    G.shake = 0; G.hitstop = 0; G.endT = -1; G.endReason = '';
    G.decalCtx.clearRect(0, 0, W, H);
    Input.pressT = 0; Input.aimAngle = null;
  },
  start() {
    Sfx.init();
    this.reset();
    G.state = 'play';
    UI.showScreen(null);
    beginWave(1);
  },
  togglePause() {
    if (G.state === 'play') { G.state = 'pause'; UI.showScreen('pause'); }
    else if (G.state === 'pause') { G.state = 'play'; UI.showScreen(null); }
  },
  gameOver() {
    G.state = 'over';
    UI.gameOver();
  },
  victory() {
    G.state = 'win';
    Sfx.victory();
    UI.victory();
  },
};

function tick(dt) {
  G.time += dt;
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  updateHero(dt);
  for (const e of G.enemies) updateEnemy(e, dt);
  separateEnemies();
  G.enemies = G.enemies.filter(e => !e.remove);
  updateParticles(dt);
  if (G.endT < 0) updateWaves(dt);
  G.shake = Math.max(0, G.shake - dt * 18);
  if (G.endT >= 0) {
    G.endT -= dt;
    if (G.endT < 0) Game.gameOver();
  }
}

function collideProps(o, r) {
  for (const p of MAP.props) {
    const pr = (p.solidR || p.r) + r;
    const dx = o.x - p.x, dy = o.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < pr && d > 0.001) { o.x = p.x + dx / d * pr; o.y = p.y + dy / d * pr; }
  }
}

function updateHero(dt) {
  const h = G.hero, C = CFG.hero;
  if (h.dead) { h.deathT += dt; return; }
  h.atkCd -= dt; h.inv -= dt; h.hurtT -= dt; Input.pressT -= dt;

  let [mx, my] = Input.axis();
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const swinging = h.swingT >= 0;
  if (len > 0 && !swinging) h.facing = Math.atan2(my, mx);
  const spd = C.speed * (swinging ? 0.35 : 1);
  h.x += (mx * spd + h.kbx) * dt;
  h.y += (my * spd + h.kby) * dt;
  const k = Math.exp(-10 * dt); h.kbx *= k; h.kby *= k;
  h.moving = len > 0;
  if (h.moving) h.walkT += dt;
  collideProps(h, C.radius);
  h.x = clamp(h.x, HERO_BOUNDS.minX, HERO_BOUNDS.maxX);
  h.y = clamp(h.y, HERO_BOUNDS.minY, HERO_BOUNDS.maxY);

  // atak mieczem
  if ((Input.pressT > 0 || Input.attackHeld) && h.atkCd <= 0) {
    Input.pressT = 0;
    if (Input.aimAngle !== null) { h.facing = Input.aimAngle; Input.aimAngle = null; }
    h.swingT = 0; h.hitDone = false; h.atkCd = C.atkCooldown; h.swingFrom = h.facing;
    Sfx.swing();
  }
  if (h.swingT >= 0) {
    h.swingT += dt;
    if (!h.hitDone && h.swingT >= C.hitAt) { h.hitDone = true; swingHit(); }
    if (h.swingT >= C.swingTime) h.swingT = -1;
  }
  h.dir = dirFromAngle(h.facing);
}

function swingHit() {
  const h = G.hero, C = CFG.hero;
  let hits = 0, armored = false;
  for (const e of G.enemies) {
    if (e.state === 'dying') continue;
    const dx = e.x - h.x, dy = e.y - h.y;
    const d = Math.hypot(dx, dy) || 0.01;
    if (d > C.range + e.r) continue;
    const inArc = angDiff(Math.atan2(dy, dx), h.facing) <= C.arc;
    if (!inArc && d > e.r + C.radius + 3) continue;
    damageEnemy(e, C.dmg, dx / d, dy / d);
    hits++;
    if (e.cfg.armored) armored = true;
  }
  if (hits) {
    G.hitstop = 0.045;
    G.shake = Math.max(G.shake, 1.5);
    Sfx.hit();
    if (armored) Sfx.clang();
  }
}

function damageEnemy(e, dmg, nx, ny) {
  e.hp -= dmg;
  e.flash = 0.1;
  const bx = e.x, by = e.y - e.r - 2;
  if (e.cfg.armored) sparks(bx, by, 6);
  bloodBurst(bx, by, nx, ny, e.hp <= 0 ? 12 : 5, e.type === 'ratogre');
  if (e.hp <= 0) { killEnemy(e); return; }
  const kb = CFG.hero.knock / e.cfg.mass;
  e.kbx = nx * kb; e.kby = ny * kb;
  if (!e.cfg.poise) { e.state = 'stun'; e.stateT = e.cfg.stun; }
}

function killEnemy(e) {
  e.state = 'dying';
  e.stateT = e.type === 'ratogre' ? 0.6 : 0.35;
  G.kills++; G.waveDone++;
  if (e.type === 'ratogre') { Sfx.roar(); G.shake = 5; } else Sfx.squeal();
}

function hurtHero(dmg, src) {
  const h = G.hero;
  if (h.dead || h.inv > 0) return;
  h.hp -= dmg;
  h.inv = CFG.hero.iframes;
  h.hurtT = 0.25;
  const dx = h.x - src.x, dy = h.y - src.y, d = Math.hypot(dx, dy) || 1;
  const kb = src.type === 'ratogre' ? 170 : 80;
  h.kbx = dx / d * kb; h.kby = dy / d * kb;
  h.swingT = -1;
  G.shake = Math.max(G.shake, src.type === 'ratogre' ? 6 : 3);
  bloodBurst(h.x, h.y - 10, dx / d, dy / d, 6);
  Sfx.hurt();
  if (h.hp <= 0) {
    h.hp = 0; h.dead = true; h.deathT = 0;
    G.endT = 1.8; G.endReason = 'hero';
    Sfx.death();
  }
}

function breach(e) {
  e.remove = true;
  G.breached++; G.waveDone++;
  G.gateHP = Math.max(0, G.gateHP - e.cfg.gate);
  G.shake = Math.max(G.shake, 4);
  Sfx.breach();
  if (G.gateHP <= 0 && G.endT < 0) { G.endT = 1.0; G.endReason = 'gate'; }
}

function updateEnemy(e, dt) {
  const C = e.cfg, h = G.hero;
  e.flash = Math.max(0, e.flash - dt);
  e.animT += dt;
  e.x += e.kbx * dt; e.y += e.kby * dt;
  const kd = Math.exp(-9 * dt); e.kbx *= kd; e.kby *= kd;

  if (e.state === 'dying') {
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.remove = true;
      const cs = SPR.corpse[e.type];
      stampDecal(g => {
        g.fillStyle = '#4a0a08';
        const s = e.type === 'ratogre' ? 10 : 5;
        for (let i = 0; i < s * 3; i++) g.fillRect(Math.round(e.x + rand(-s, s)), Math.round(e.y - 2 + rand(-s / 2, s / 2)), 2, 1);
        g.globalAlpha = 0.85;
        g.drawImage(cs, Math.round(e.x - cs.width / 2), Math.round(e.y - cs.height / 2 - 2));
        g.globalAlpha = 1;
      });
    }
    return;
  }

  const dx = h.x - e.x, dy = h.y - e.y, dist = Math.hypot(dx, dy) || 0.01;
  const heroOk = !h.dead;
  const contact = e.r + CFG.hero.radius + C.reach;
  let vx = 0, vy = 0;

  switch (e.state) {
    case 'walk': {
      if (heroOk && dist < C.aggro) { e.state = 'chase'; break; }
      const last = e.wp >= e.path.length - 3;
      const tx = e.path[e.wp][0] + (last ? e.ox * 0.3 : e.ox);
      const ty = e.path[e.wp][1] + (last ? 0 : e.oy);
      const ddx = tx - e.x, ddy = ty - e.y, dd = Math.hypot(ddx, ddy);
      if (dd < 3 && e.wp < e.path.length - 1) e.wp++;
      const sp = C.speed * e.speedMul;
      if (dd > 0.01) { vx = ddx / dd * sp; vy = ddy / dd * sp; }
      break;
    }
    case 'chase': {
      if (!heroOk || dist > C.aggro * 1.7) { e.state = 'walk'; break; }
      if (dist <= contact) { e.state = 'windup'; e.stateT = C.windup; e.face = Math.atan2(dy, dx); break; }
      const sp = C.speed * e.speedMul * 1.15;
      vx = dx / dist * sp; vy = dy / dist * sp;
      break;
    }
    case 'windup':
      if (e.stateT > C.windup * 0.4) e.face = Math.atan2(dy, dx);
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.state = 'strike'; e.stateT = 0.2;
        if (heroOk && dist <= contact + 5) hurtHero(C.dmg, e);
      }
      break;
    case 'strike':
      e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'recover'; e.stateT = C.recover; }
      break;
    case 'recover':
      e.stateT -= dt;
      if (e.stateT <= 0) e.state = 'chase';
      break;
    case 'stun':
      e.stateT -= dt;
      if (e.stateT <= 0) e.state = 'chase';
      break;
  }

  e.x += vx * dt; e.y += vy * dt;
  e.moving = (vx * vx + vy * vy) > 1;
  if (e.moving && e.state !== 'windup') e.face = Math.atan2(vy, vx);
  e.prog = e.wp * 1000 - Math.hypot(e.path[e.wp][0] - e.x, e.path[e.wp][1] - e.y);

  if (e.state !== 'walk') collideProps(e, e.r);
  // mur: przejście tylko przez bramę
  if (Math.abs(e.x - GATE_X) > 12) e.y = Math.min(e.y, 206);
  e.x = clamp(e.x, -20, W + 20);

  if (e.state === 'walk' && e.y >= BREACH_Y) breach(e);
}

function separateEnemies() {
  const list = G.enemies, h = G.hero;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.state === 'dying') continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.state === 'dying') continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r - 1;
      if (d < min && d > 0.001) {
        const push = (min - d), wa = b.cfg.mass / (a.cfg.mass + b.cfg.mass);
        a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
        b.x += dx / d * push * (1 - wa); b.y += dy / d * push * (1 - wa);
      }
    }
    // bohater blokuje ciałem
    if (!h.dead) {
      const dx = a.x - h.x, dy = a.y - h.y, d = Math.hypot(dx, dy), min = a.r + CFG.hero.radius;
      if (d < min && d > 0.001) {
        const push = min - d;
        if (a.type === 'ratogre') { h.x -= dx / d * push * 0.7; h.y -= dy / d * push * 0.7; a.x += dx / d * push * 0.3; a.y += dy / d * push * 0.3; }
        else { a.x += dx / d * push; a.y += dy / d * push; }
      }
    }
  }
}

function updateParticles(dt) {
  for (const p of G.particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vz -= p.grav * dt; p.z += p.vz * dt;
    if (p.z <= 0) {
      p.z = 0;
      if (p.stamp) {
        const x = Math.round(p.x), y = Math.round(p.y), c = p.col, s = p.size;
        stampDecal(g => { g.fillStyle = c; g.fillRect(x, y, s, 1); });
        p.life = 0;
      } else { p.vx *= 0.6; p.vy *= 0.6; }
    }
  }
  G.particles = G.particles.filter(p => p.life > 0);
}

// ==========================================================================
// 10. RENDER
// ==========================================================================
let canvas, ctx;

function px(x, y, col, w = 1, h = 1) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

function drawSprite(spr, x, y, alpha = 1) {
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(spr, Math.round(x - spr.anchorX), Math.round(y - spr.anchorY));
  if (alpha !== 1) ctx.globalAlpha = 1;
}
function drawShadow(w, x, y) {
  const s = SPR.shadow[w];
  ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2));
}

const HAND = { down: [6, -9], up: [-6, -10], right: [3, -9], left: [-3, -9] };
const IDLE_ANG = { down: 1.05, up: -2.1, right: 0.55, left: Math.PI - 0.55 };

function swordAngle(h) {
  if (h.swingT >= 0) {
    const t = clamp(h.swingT / CFG.hero.swingTime, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);
    return h.swingFrom - 1.7 + 3.4 * e;
  }
  return IDLE_ANG[h.dir];
}
function swordPivot(h) {
  if (h.swingT >= 0) return [h.x + Math.cos(h.facing) * 2, h.y - 9 + Math.sin(h.facing) * 2];
  const o = HAND[h.dir];
  return [h.x + o[0], h.y + o[1]];
}
function drawSword(cx, cy, a) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const pts = [];
  for (let r = 0; r <= 21; r++) pts.push([Math.round(cx + ca * r), Math.round(cy + sa * r), r]);
  // kontur
  ctx.fillStyle = PAL.outline;
  for (const [x, y] of pts) ctx.fillRect(x - 1, y - 1, 3, 3);
  for (let k = -3; k <= 3; k++) ctx.fillRect(Math.round(cx + ca * 5 - sa * k) - 1, Math.round(cy + sa * 5 + ca * k) - 1, 3, 3);
  for (let k = -3; k <= 3; k++) px(cx + ca * 5 - sa * k, cy + sa * 5 + ca * k, PAL.guard);
  for (const [x, y, r] of pts) {
    if (r === 0) px(x, y, PAL.gold);
    else if (r < 5) px(x, y, PAL.grip);
    else if (r > 5) {
      px(x, y, r === 21 ? '#ffffff' : PAL.steel);
      if (r < 20) px(x + Math.round(-sa), y + Math.round(ca), PAL.steelD);
    }
  }
}
function drawSwingTrail(h) {
  if (h.swingT < 0) return;
  const t = clamp(h.swingT / CFG.hero.swingTime, 0, 1);
  const cur = swordAngle(h);
  const [cx, cy] = swordPivot(h);
  ctx.fillStyle = '#fff2d0';
  for (let k = 1; k <= 7; k++) {
    const a = cur - k * 0.22;
    if (a < h.swingFrom - 1.7) break;
    ctx.globalAlpha = (1 - k / 8) * (1 - t * 0.6) * 0.8;
    for (let r = 10; r <= 22; r += 1) ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawHeroEntity(h) {
  drawShadow(14, h.x, h.y);
  if (h.dead) {
    // animacja śmierci: przyklęk, upadek w 3 klatkach, leżące ciało
    const spr = SPR.hero.right[0];
    const step = Math.min(3, Math.floor(h.deathT / 0.15));
    if (step >= 2) {
      ctx.fillStyle = '#5a0c0a';
      ctx.fillRect(Math.round(h.x) - 6, Math.round(h.y) - 2, 16, 4);
      ctx.fillRect(Math.round(h.x) - 4, Math.round(h.y) - 3, 12, 6);
    }
    ctx.save();
    ctx.translate(Math.round(h.x), Math.round(h.y));
    ctx.rotate([0.25, 0.7, 1.2, Math.PI / 2][step]);
    ctx.drawImage(step === 0 ? tinted(spr, '#ffffff') : spr, -spr.anchorX, -spr.anchorY);
    ctx.restore();
    return;
  }
  const blink = h.inv > 0 && Math.floor(G.time * 16) % 2 === 0;
  let fr = 0;
  if (h.moving) fr = Math.floor(h.walkT * 9) % 4;
  let spr = SPR.hero[h.dir][fr];
  const bob = !h.moving && h.swingT < 0 && Math.floor(G.time * 2) % 2 === 1 ? 1 : 0;
  const a = swordAngle(h);
  const [sx, sy] = swordPivot(h);
  const behind = h.dir === 'up' || Math.sin(a) < -0.35;
  if (behind) drawSword(sx, sy + bob, a);
  if (h.hurtT > 0) spr = tinted(spr, '#ffffff');
  if (!blink || h.hurtT > 0) drawSprite(spr, h.x, h.y + bob);
  else drawSprite(spr, h.x, h.y + bob, 0.45);
  if (!behind) drawSword(sx, sy + bob, a);
  drawSwingTrail(h);
}

function drawEnemy(e) {
  const set = SPR[e.type];
  const dir = dirFromAngle(e.face);
  let idx = 0;
  if (e.state === 'windup') idx = 4;
  else if (e.state === 'strike') idx = 5;
  else if (e.moving) idx = Math.floor(e.animT * (e.type === 'ratogre' ? 5 : 8)) % 4;
  let spr = set[dir][idx];
  let ox = 0, oy = 0;
  if (e.state === 'strike') { ox = Math.round(Math.cos(e.face) * 2); oy = Math.round(Math.sin(e.face) * 2); }
  const sw = e.type === 'ratogre' ? 26 : e.type === 'stormvermin' ? 14 : 12;
  drawShadow(sw, e.x, e.y);
  if (e.state === 'dying') {
    const t = e.stateT / (e.type === 'ratogre' ? 0.6 : 0.35);
    drawSprite(t > 0.6 ? tinted(spr, '#ffffff') : tinted(spr, '#5a0c0a'), e.x, e.y, Math.max(0.2, t));
    return;
  }
  if (e.flash > 0) spr = tinted(spr, '#ffffff');
  drawSprite(spr, e.x + ox, e.y + oy);
  const top = e.y - spr.anchorY;
  // telegraf ataku
  if (e.state === 'windup' && Math.floor(G.time * 12) % 2 === 0) {
    px(e.x - 1, top - 4, '#ffe060', 2, 2);
    px(e.x - 1, top - 2, '#ff8020', 2, 1);
  }
  // pasek HP silniejszych jednostek
  if (e.type !== 'clanrat' && e.hp < e.maxHp) {
    const w = e.type === 'ratogre' ? 24 : 14;
    const x = Math.round(e.x - w / 2), y = Math.round(top - 3);
    px(x - 1, y - 1, '#000', w + 2, 4);
    px(x, y, '#3a0808', w, 2);
    px(x, y, '#d03030', Math.max(1, Math.round(w * e.hp / e.maxHp)), 2);
  }
}

function drawProp(p) {
  drawShadow(p.shadow, p.x, p.y);
  drawSprite(p.spr, p.x, p.y);
}

function drawTorches() {
  for (const [x, y] of MAP.torches) {
    const f = Math.floor(G.time * 10 + x) % 3;
    px(x, y, '#2a1a0e', 1, 5);
    // poświata (dithering)
    ctx.fillStyle = 'rgba(255,140,40,0.10)';
    for (let dy = -7; dy <= 7; dy += 2) for (let dx = -7; dx <= 7; dx += 2) {
      if (dx * dx + dy * dy < 49 && ((dx + dy + f) & 2)) ctx.fillRect(x + dx, y - 3 + dy, 1, 1);
    }
    px(x - 1, y - 3, '#d04010', 3, 3);
    px(x, y - 4 - (f === 1 ? 1 : 0), '#f08020', 1, 2 + (f === 2 ? 1 : 0));
    px(x, y - 2, '#ffe080', 1, 1);
    if (f === 0) px(x + 1, y - 5, '#f0a030');
    if (f === 2) px(x - 1, y - 5, '#f0a030');
  }
}

function render() {
  const sh = G.shake > 0 ? Math.round(rand(-G.shake, G.shake)) : 0;
  const sv = G.shake > 0 ? Math.round(rand(-G.shake, G.shake)) : 0;
  ctx.save();
  ctx.translate(sh, sv);
  ctx.drawImage(MAP.ground, 0, 0);
  ctx.drawImage(G.decals, 0, 0);

  const list = [];
  for (const p of MAP.props) list.push({ y: p.y, f: () => drawProp(p) });
  for (const e of G.enemies) list.push({ y: e.y, f: () => drawEnemy(e) });
  const h = G.hero;
  if (h) list.push({ y: h.y + (h.dead ? -6 : 0), f: () => drawHeroEntity(h) });
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.f();

  for (const p of G.particles) {
    if (p.grav === 60) ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    px(p.x, p.y - p.z, p.col, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  drawTorches();
  ctx.restore();
}

// Podgląd na ekranie startowym
function drawPreview() {
  const c = document.getElementById('preview');
  if (!c) return;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, c.width, c.height);
  const put = (s, x, baseY) => g.drawImage(s, x, baseY - s.anchorY);
  put(SPR.hero.right[0], 2, 34);
  put(SPR.clanrat.left[4], 40, 34);
  put(SPR.stormvermin.left[0], 58, 34);
  put(SPR.ratogre.left[0], 80, 34);
}

// ==========================================================================
// 11. UI — HUD, ekrany, skalowanie
// ==========================================================================
const UI = {
  el: {}, cache: {}, bannerT: 0,
  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      wrap: $('wrap'), hud: $('hud'), stage: $('stage'),
      hpFill: $('hp-fill'), hpNum: $('hp-num'), hpBar: $('hp-fill').parentElement,
      waveLbl: $('wave-lbl'), progFill: $('prog-fill'),
      kills: $('kills'), breached: $('breached'), gateFill: $('gate-fill'), gateBar: $('gate-fill').parentElement,
      banner: $('banner'), bTitle: $('banner-title'), bSub: $('banner-sub'),
      screens: { start: $('scr-start'), pause: $('scr-pause'), over: $('scr-over'), win: $('scr-win') },
    };
    $('btn-start').addEventListener('click', () => Game.start());
    $('btn-restart').addEventListener('click', () => Game.start());
    $('btn-again').addEventListener('click', () => Game.start());
    $('btn-resume').addEventListener('click', () => Game.togglePause());
    document.querySelectorAll('.btn-sound').forEach(b => b.addEventListener('click', () => this.toggleSound(false)));
    try { Sfx.muted = localStorage.getItem('cd-muted') === '1'; } catch (err) { /* brak dostępu do pamięci */ }
    this.syncSound();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    const avW = window.innerWidth, avH = window.innerHeight;
    let s = Math.min(avW / W, avH / (H + HUD_UNITS));
    if (s >= 2) s = Math.floor(s * 2) / 2;   // ostre piksele
    s = Math.max(s, 0.5);
    const e = this.el;
    e.wrap.style.setProperty('--u', s + 'px');
    e.wrap.style.width = W * s + 'px';
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
  },
  set(key, el, prop, val) {
    if (this.cache[key] === val) return;
    this.cache[key] = val;
    el[prop] = val;
  },
  update(dt) {
    const e = this.el, h = G.hero;
    if (!h) return;
    const hpPct = Math.max(0, h.hp) / CFG.hero.hp * 100;
    this.set('hp', e.hpFill.style, 'width', hpPct + '%');
    this.set('hpn', e.hpNum, 'textContent', String(Math.max(0, Math.ceil(h.hp))));
    this.set('hplow', e.hpBar, 'className', hpPct < 30 ? 'bar hp low' : 'bar hp');
    this.set('wave', e.waveLbl, 'textContent', `Fala ${Math.max(1, G.wave)}/${WAVES.length}`);
    const prog = G.waveTotal ? G.waveDone / G.waveTotal * 100 : 0;
    this.set('prog', e.progFill.style, 'width', prog + '%');
    this.set('kills', e.kills, 'textContent', String(G.kills));
    this.set('br', e.breached, 'textContent', String(G.breached));
    const gp = G.gateHP / CFG.gateHP * 100;
    this.set('gate', e.gateFill.style, 'width', gp + '%');
    this.set('gatelow', e.gateBar, 'className', gp <= 30 ? 'bar gate low' : 'bar gate');
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) e.banner.classList.remove('show');
    }
  },
  banner(title, sub, dur, red) {
    const e = this.el;
    e.bTitle.textContent = title;
    e.bTitle.className = red ? 'red' : '';
    e.bSub.textContent = sub || '';
    e.banner.classList.add('show');
    this.bannerT = dur;
  },
  toggleSound(showBanner) {
    Sfx.muted = !Sfx.muted;
    try { localStorage.setItem('cd-muted', Sfx.muted ? '1' : '0'); } catch (err) { /* ignoruj */ }
    this.syncSound();
    if (showBanner && G.state === 'play') this.banner(Sfx.muted ? 'Dźwięk wyłączony' : 'Dźwięk włączony', '', 0.9, false);
  },
  syncSound() {
    document.querySelectorAll('.btn-sound').forEach(b => {
      b.textContent = Sfx.muted ? 'Dźwięk: wył.' : 'Dźwięk: wł.';
      b.classList.toggle('off', Sfx.muted);
    });
  },
  showScreen(name) {
    document.body.classList.toggle('playing', name === null || name === 'pause');
    for (const k in this.el.screens) this.el.screens[k].classList.toggle('hidden', k !== name);
    if (name) this.el.banner.classList.remove('show');
    const btn = name && this.el.screens[name].querySelector('button');
    if (btn) setTimeout(() => btn.focus(), 50);
  },
  gameOver() {
    document.getElementById('over-title').textContent =
      G.endReason === 'gate' ? 'Brama przełamana' : 'Gwardzista poległ';
    document.getElementById('over-wave').textContent = `${G.wave} / ${WAVES.length}`;
    document.getElementById('over-kills').textContent = G.kills;
    document.getElementById('over-breached').textContent = G.breached;
    this.showScreen('over');
  },
  victory() {
    document.getElementById('win-kills').textContent = G.kills;
    document.getElementById('win-breached').textContent = G.breached;
    document.getElementById('win-hp').textContent = Math.ceil(G.hero.hp);
    this.showScreen('win');
  },
};

// ==========================================================================
// 12. LOOP
// ==========================================================================
let lastT = 0, acc = 0;
function frame(now) {
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 0.1);
  if (G.state === 'play') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 8) { tick(STEP); acc -= STEP; n++; }
    if (n === 8) acc = 0;
  } else {
    acc = 0;
    if (G.state === 'menu') G.time += dt;
  }
  render();
  UI.update(dt);
  requestAnimationFrame(frame);
}

function boot() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  buildSprites();
  MAP.ground = buildGround();
  placeProps();
  G.decals = makeCanvas(W, H);
  G.decalCtx = G.decals.getContext('2d');
  Input.init(canvas);
  UI.init();
  Game.reset();
  drawPreview();
  UI.showScreen('start');
  lastT = performance.now();
  requestAnimationFrame(frame);
}

// Uchwyt do debugowania / testów
window.CD = { G, CFG, WAVES, Game, Input, tick, render };

window.addEventListener('DOMContentLoaded', boot);
