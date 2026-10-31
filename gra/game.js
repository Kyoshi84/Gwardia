'use strict';
/* ==========================================================================
   OBRONA CARROBURGA — Szkarłatna Gwardia
   Tower defense / arcade z budową twierdzy. HTML5 Canvas, bez bibliotek.

   Sekcje:
     1. CONFIG     — stałe, balans, fale, drogi, miejsca budowy
     2. UTIL       — losowość, geometria, ścieżki
     3. AUDIO      — dźwięki syntezowane (WebAudio)
     4. SPRITES    — pixel-art generowany kodem
     5. MAP        — teren, miasto, rekwizyty (skały, drzewa)
     6. STRUCTURES — mury, brama, wieże łuczników
     7. INPUT      — klawiatura, mysz, dotyk (joystick)
     8. ENTITIES   — bohater, Skaveni, strzały, cząsteczki
     9. WAVES      — fazy budowy i fale
    10. GAME       — logika
    11. RENDER     — rysowanie
    12. UI         — HUD, podpowiedzi, ekrany, skalowanie
    13. LOOP
   ========================================================================== */

// ==========================================================================
// 1. CONFIG
// ==========================================================================
const W = 320, H = 240;
const STEP = 1 / 60;
const GATE_X = 160;
const SEG_N = 11, SEG_W = W / SEG_N, GATE_SEG = 5;
const WALL_TOP = 207, WALL_BOT = 222;     // pas murów
const SIEGE_Y = 203;                       // tu stoją szturmujący mur
const BREACH_Y = 228;                      // za tą linią Skaven jest w mieście
const APPROACH_Y = 182;                    // poniżej tej linii szczury schodzą z drogi ku murom
const HERO_BOUNDS = { minX: 6, maxX: W - 6, minY: 12, maxY: 200 };
const TOWER_R = 7;

const CFG = {
  hero: {
    hp: 100, speed: 72, radius: 5,
    atkCooldown: 0.38, swingTime: 0.20, hitAt: 0.06,
    range: 24, arc: 1.25, dmg: 34, knock: 95,
    iframes: 0.6, healPerWave: 40,
  },
  cityHP: 25,
  start: { stone: 10, wood: 0, points: 15 },
  node: { stone: 24, wood: 20, deadwood: 10, regrow: 8, yield: 2 },
  cost: {
    wall:  { stone: 10, points: 5 },
    gate:  { stone: 16, points: 10 },
    tower: { wood: 20, points: 30 },
  },
  hp: { wall: 100, gate: 180, tower: 130 },
  tower: { range: 72, cd: 1.4, dmg: 14, arrowSpeed: 230 },
  prepFirst: 45, prep: 22,
  enemy: {
    clanrat:     { hp: 30,  speed: 23, radius: 5,  dmg: 6,  sdmg: 8,  reach: 4, windup: 0.40, recover: 0.90, aggro: 30, mass: 1.0, gate: 1, stun: 0.30, poise: false, armored: false, points: 2 },
    stormvermin: { hp: 90,  speed: 16, radius: 6,  dmg: 10, sdmg: 16, reach: 6, windup: 0.55, recover: 1.10, aggro: 36, mass: 1.8, gate: 2, stun: 0.25, poise: false, armored: true,  points: 5 },
    ratogre:     { hp: 440, speed: 12, radius: 10, dmg: 20, sdmg: 45, reach: 6, windup: 0.75, recover: 1.40, aggro: 46, mass: 6.0, gate: 5, stun: 0.00, poise: true,  armored: false, points: 20 },
  },
};

// Fale (więcej szczurów niż w pierwszej wersji)
const WAVES = [
  { clanrat: 12, stormvermin: 0,  ratogre: 0, interval: 1.40, pack: 2, paths: ['top'],                  sub: 'Pierwsze klany wypełzają z kanałów' },
  { clanrat: 18, stormvermin: 0,  ratogre: 0, interval: 1.25, pack: 2, paths: ['top', 'left'],          sub: 'Szczury nadchodzą także od zachodu' },
  { clanrat: 20, stormvermin: 3,  ratogre: 0, interval: 1.15, pack: 3, paths: ['top', 'left'],          sub: 'Stormverminy w szeregach wroga!' },
  { clanrat: 24, stormvermin: 5,  ratogre: 0, interval: 1.10, pack: 3, paths: ['top', 'left', 'right'], sub: 'Atakują ze wszystkich stron' },
  { clanrat: 30, stormvermin: 7,  ratogre: 0, interval: 1.00, pack: 3, paths: ['top', 'left', 'right'], sub: 'Hordy gęstnieją' },
  { clanrat: 36, stormvermin: 9,  ratogre: 0, interval: 0.95, pack: 4, paths: ['top', 'left', 'right'], sub: 'W oddali dudnią szczurze bębny' },
  { clanrat: 34, stormvermin: 9,  ratogre: 1, interval: 0.90, pack: 4, paths: ['top', 'left', 'right'], sub: 'Szczuroogr! Mistrzowie Moulder wypuścili bestię' },
  { clanrat: 40, stormvermin: 12, ratogre: 1, interval: 0.85, pack: 4, paths: ['top', 'left', 'right'], sub: 'Ziemia drży pod łapami bestii' },
  { clanrat: 46, stormvermin: 14, ratogre: 2, interval: 0.80, pack: 4, paths: ['top', 'left', 'right'], sub: 'Rogaty Szczur patrzy na Carroburg' },
  { clanrat: 54, stormvermin: 16, ratogre: 3, interval: 0.75, pack: 5, paths: ['top', 'left', 'right'], sub: 'Ostatnia horda. Adsumus!' },
];

// Drogi: główna do bramy, boczne ku zachodniej i wschodniej części murów
const PATH_DATA = {
  top: [[160, -14], [158, 26], [128, 46], [92, 64], [76, 92], [86, 118], [124, 132],
        [186, 136], [232, 150], [244, 172], [214, 190], [172, 198], [160, 206], [160, 230]],
  left: [[-14, 56], [40, 60], [92, 64], [76, 92], [62, 128], [50, 160], [44, 190], [44, 230]],
  right: [[334, 112], [300, 120], [282, 146], [276, 178], [276, 230]],
};
// Fundamenty pod wieże łuczników
const TOWER_SPOTS = [[126, 172], [196, 168], [82, 172], [300, 174], [106, 150], [222, 112]];

// Paleta — Gwardzista: szkarłat i czerń
const PAL = {
  outline: '#140b08',
  red: '#b3151b', redD: '#7a0d12', redL: '#e04a4a',
  slash: '#1c1416', black: '#1c1a1c', blackL: '#3e3a40',
  skin: '#e3b088', skinD: '#b07a58', hair: '#5a3418', hairD: '#3a200e',
  boot: '#1e1914', bootL: '#3d342b', belt: '#2a1a0e', gold: '#d8a840', dark: '#24140a',
  steel: '#c4c8d0', steelD: '#6c7078', grip: '#5a3a1e', guard: '#8a6a3a',
  fur: '#6b6236', furD: '#463f22', furL: '#8a8048', ratPink: '#c48a84',
  eye: '#ff2a1a', tooth: '#e8e0c0', rag: '#5a3c24', ragD: '#3c2616',
  blade: '#9a8e7e', rust: '#7a4a2a',
  arm: '#40444a', armL: '#868c94', armD: '#26292e', furS: '#4f4a38', snoutS: '#6a6450', cloth: '#6e1616',
  haft: '#5a3a1e', axe: '#a8acb4', axeD: '#5c6066',
  fl: '#8e6656', flD: '#62423a', flL: '#b48676', fur2: '#4c3e30', claw: '#e6dcc4', iron: '#5c6066', stitch: '#2a1610',
  stone: '#6a645d', stoneL: '#8a847c', stoneD: '#3e3a35', mortar: '#2e2a26',
  wood: '#6a4426', woodL: '#8a5e36', woodD: '#3e2816',
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
function dirFromAngle(a) {
  const c = Math.cos(a), s = Math.sin(a);
  if (Math.abs(c) >= Math.abs(s) * 0.9) return c >= 0 ? 'right' : 'left';
  return s > 0 ? 'down' : 'up';
}

// Ścieżki z parametryzacją długością — szczury śledzą postęp „s” wzdłuż drogi,
// więc nie zakleszczają się na punktach kontrolnych, gdy jest ich dużo.
function preparePath(pts) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    segs.push({ ax, ay, bx, by, len, s0: total, nx: -(by - ay) / len, ny: (bx - ax) / len });
    total += len;
  }
  return { pts, segs, total };
}
function pathPoint(P, s) {
  s = clamp(s, 0, P.total);
  let sg = P.segs[P.segs.length - 1];
  for (const g of P.segs) if (s <= g.s0 + g.len) { sg = g; break; }
  const t = sg.len ? (s - sg.s0) / sg.len : 0;
  return { x: sg.ax + (sg.bx - sg.ax) * t, y: sg.ay + (sg.by - sg.ay) * t, nx: sg.nx, ny: sg.ny };
}
function pathProject(P, x, y, sMin, sMax) {
  let best = sMin, bd = 1e9;
  for (const g of P.segs) {
    if (g.s0 + g.len < sMin || g.s0 > sMax) continue;
    const dx = g.bx - g.ax, dy = g.by - g.ay;
    let t = ((x - g.ax) * dx + (y - g.ay) * dy) / (g.len * g.len);
    t = clamp(t, 0, 1);
    let s = clamp(g.s0 + t * g.len, sMin, sMax);
    const p = pathPoint(P, s);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
const PATHS = {};
for (const k in PATH_DATA) PATHS[k] = preparePath(PATH_DATA[k]);

function roadDist(x, y) {
  let best = 1e9;
  for (const k in PATHS) for (const g of PATHS[k].segs) {
    const d = distToSeg(x, y, g.ax, g.ay, g.bx, g.by);
    if (d < best) best = d;
  }
  return best;
}

// ==========================================================================
// 3. AUDIO
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
  squeal()   { const f = 1400 + Math.random() * 600; this.tone('sawtooth', f, f * 0.45, 0.22, 0.07); this.noise(0.12, 'lowpass', 500, 120, 0.3, 0.03); },
  roar()     { this.tone('sawtooth', 150, 50, 0.8, 0.22); this.noise(0.7, 'lowpass', 420, 70, 0.35); },
  hurt()     { this.tone('triangle', 260, 80, 0.22, 0.4); this.noise(0.1, 'lowpass', 900, 200, 0.4); },
  horn()     { this.tone('sawtooth', 147, 147, 0.5, 0.10); this.tone('sawtooth', 220, 220, 0.6, 0.09, 0.32); this.tone('sawtooth', 196, 196, 0.9, 0.09, 0.7); },
  breach()   { this.tone('sine', 110, 60, 0.8, 0.45); this.tone('square', 220, 80, 0.3, 0.05); },
  waveClear(){ [262, 330, 392, 523].forEach((f, i) => this.tone('triangle', f, f, 0.32, 0.14, i * 0.12)); },
  victory()  { [262, 330, 392, 523, 392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, 0.4, 0.15, i * 0.15)); },
  death()    { this.tone('sawtooth', 300, 40, 1.2, 0.18); this.tone('sine', 120, 40, 1.4, 0.3, 0.1); },
  pick()     { this.tone('square', 1500, 1100, 0.05, 0.08); this.noise(0.06, 'highpass', 3000, 1500, 0.25); },
  chop()     { this.noise(0.08, 'lowpass', 1200, 200, 0.5); this.tone('triangle', 220, 140, 0.08, 0.2); },
  build()    { for (let i = 0; i < 3; i++) { this.noise(0.05, 'lowpass', 1600, 400, 0.5, i * 0.11); this.tone('square', 300, 200, 0.04, 0.08, i * 0.11); } },
  thud()     { this.noise(0.09, 'lowpass', 600, 120, 0.35); },
  collapse() { this.noise(0.9, 'lowpass', 900, 60, 0.7); this.tone('sine', 80, 40, 0.8, 0.35); },
  bow()      { this.noise(0.08, 'highpass', 4000, 2000, 0.12); this.tone('triangle', 520, 300, 0.06, 0.05); },
  denied()   { this.tone('square', 140, 120, 0.15, 0.08); },
  coin()     { this.tone('triangle', 1320, 1320, 0.06, 0.05); this.tone('triangle', 1760, 1760, 0.08, 0.04, 0.05); },
};

// ==========================================================================
// 4. SPRITES — pixel-art z automatycznym konturem
// ==========================================================================
const PAD = 2;

function addOutline(c, col) {
  const g = c.getContext('2d');
  const w = c.width, h = c.height;
  const img = g.getImageData(0, 0, w, h);
  const a = img.data;
  const mark = new Uint8Array(w * h);
  const solid = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && a[(yy * w + xx) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (a[(y * w + x) * 4 + 3] !== 0) continue;
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

// ---------- Gwardzista (szkarłat + czerń) — projekt 28x25 ----------
function drawHero(p, dir, fr) {
  const C = PAL;
  if (dir === 'down' || dir === 'up') {
    const st = [0, 1, 0, -1][fr];
    const lo = st > 0 ? -1 : 0, ro = st < 0 ? -1 : 0;
    const la = st, ra = -st;
    p(9, 16, 5, 5, C.red);  p(10, 17, 1, 3, C.slash); p(12, 17, 1, 2, C.redL);
    p(15, 16, 5, 5, C.red); p(17, 17, 1, 3, C.slash); p(16, 17, 1, 2, C.redL);
    p(10, 21 + lo, 4, 4, C.boot); p(10, 21 + lo, 4, 1, C.bootL);
    p(15, 21 + ro, 4, 4, C.boot); p(15, 21 + ro, 4, 1, C.bootL);
    p(8, 9, 12, 7, C.red); p(8, 9, 1, 7, C.redD); p(19, 9, 1, 7, C.redD);
    p(11, 10, 1, 4, C.slash); p(16, 10, 1, 4, C.slash); p(14, 10, 1, 5, C.redD);
    p(8, 15, 12, 1, C.belt);
    if (dir === 'down') { p(10, 9, 8, 1, C.black); p(13, 15, 2, 1, C.gold); }
    p(5, 9 + la, 3, 5, C.red);  p(6, 10 + la, 1, 3, C.slash);  p(5, 14 + la, 3, 2, C.skin);
    p(20, 9 + ra, 3, 5, C.red); p(21, 10 + ra, 1, 3, C.slash); p(20, 14 + ra, 3, 2, C.skin);
    if (dir === 'down') {
      p(9, 3, 10, 7, C.hair); p(8, 6, 1, 5, C.hair); p(19, 6, 1, 5, C.hair);
      p(9, 9, 2, 2, C.hair); p(17, 9, 2, 2, C.hair);
      p(10, 4, 8, 5, C.skin); p(10, 8, 8, 1, C.skinD);
      p(11, 6, 2, 1, C.dark); p(15, 6, 2, 1, C.dark); p(13, 7, 2, 1, C.skinD); p(12, 8, 4, 1, C.hairD);
      p(8, 0, 12, 2, C.red); p(6, 2, 16, 2, C.red); p(6, 3, 16, 1, C.redD); p(9, 0, 5, 1, C.redL);
      p(20, 0, 4, 1, C.black); p(23, 1, 2, 1, C.black); p(24, 2, 1, 2, C.blackL);
    } else {
      p(9, 3, 10, 9, C.hair); p(10, 10, 8, 2, C.hair);
      p(11, 5, 1, 6, C.hairD); p(15, 6, 1, 5, C.hairD);
      p(8, 0, 12, 3, C.red); p(6, 2, 16, 2, C.red); p(6, 3, 16, 1, C.redD); p(10, 1, 6, 1, C.redL);
      p(3, 1, 4, 1, C.black); p(2, 2, 2, 1, C.black); p(2, 3, 1, 1, C.blackL);
    }
  } else {
    const a = [0, 2, 0, -2][fr];
    p(12 - a, 16, 4, 5, C.redD); p(12 - a, 21, 4, 4, C.boot);
    p(10, 10 - (a >> 1), 3, 5, C.redD);
    p(13 + a, 16, 4, 5, C.red); p(14 + a, 17, 1, 3, C.slash);
    p(13 + a, 21, 5, 4, C.boot); p(13 + a, 21, 4, 1, C.bootL);
    p(10, 9, 8, 7, C.red); p(10, 9, 1, 7, C.redD);
    p(13, 10, 1, 4, C.slash); p(16, 10, 1, 4, C.slash);
    p(13, 9, 4, 1, C.black); p(10, 15, 8, 1, C.belt); p(16, 15, 1, 1, C.gold);
    p(13 + (a >> 1), 10, 4, 5, C.red); p(14 + (a >> 1), 11, 1, 2, C.slash); p(16 + (a >> 1), 14, 3, 2, C.skin);
    p(9, 4, 6, 8, C.hair); p(9, 9, 3, 3, C.hair);
    p(14, 4, 4, 5, C.skin); p(18, 6, 1, 1, C.skin);
    p(16, 5, 1, 1, C.dark); p(15, 8, 3, 1, C.hairD); p(14, 8, 1, 1, C.skinD);
    p(10, 0, 9, 2, C.red); p(8, 2, 13, 2, C.red); p(8, 3, 13, 1, C.redD); p(11, 0, 4, 1, C.redL);
    p(4, 1, 5, 1, C.black); p(3, 2, 2, 1, C.black); p(2, 3, 1, 1, C.blackL);
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

// ---------- Rat Ogre — projekt 32x30 ----------
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
    } else if (atk === 2) {
      p(3, 15, 7, 8, C.fl); p(22, 15, 7, 8, C.fl);
      p(4, 23, 6, 2, C.claw); p(22, 23, 6, 2, C.claw);
    } else {
      p(0, 12 + st, 5, 10, C.fl); p(27, 12 - st, 5, 10, C.fl);
      p(0, 22 + st, 5, 2, C.claw); p(27, 22 - st, 5, 2, C.claw);
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
    if (atk === 1)      { p(15, 0, 6, 12, C.fl); p(15, 0, 6, 2, C.claw); }
    else if (atk === 2) { p(20, 16, 10, 5, C.fl); p(30, 16, 2, 5, C.claw); }
    else { p(18, 14, 6, 11, C.fl); p(18, 14, 6, 1, C.flL); p(19, 25 + (st & 1), 5, 2, C.claw); }
  }
}

// ---------- Rekwizyty i zasoby ----------
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
function makeDeadTree() {
  return makeSprite(22, 28, (p, L) => {
    p(9, 10, 3, 18, '#3a2a1c'); p(10, 12, 1, 14, '#544030'); p(7, 27, 7, 1, '#3a2a1c');
    L(10, 12, 3, 4, '#3a2a1c'); L(3, 4, 2, 1, '#3a2a1c'); L(11, 10, 18, 3, '#3a2a1c'); L(18, 3, 20, 2, '#3a2a1c');
    L(10, 8, 9, 0, '#3a2a1c'); L(6, 8, 4, 10, '#3a2a1c'); L(15, 7, 17, 9, '#3a2a1c');
  });
}
function makeStump() {
  return makeSprite(10, 6, (p) => {
    p(1, 1, 8, 5, '#3b2816'); p(2, 0, 6, 2, '#8a6a44'); p(3, 1, 4, 1, '#6a4a2a'); p(0, 5, 10, 1, '#2a1a0c');
  });
}
function makeRock(seed) {
  const r = mulberry32(seed);
  const w = 10 + Math.floor(r() * 4);
  return makeSprite(w + 2, 9, (p) => {
    p(1, 2, w, 6, PAL.stone); p(0, 3, w + 2, 4, PAL.stone); p(2, 1, w - 2, 1, PAL.stone);
    p(2, 1, w - 4, 1, PAL.stoneL); p(1, 2, 3, 1, PAL.stoneL); p(4, 3, 2, 1, PAL.stoneL); p(1, 7, w, 1, PAL.stoneD);
    p(Math.floor(w / 2), 2, 2, 1, '#4a5a2a'); p(w - 2, 4, 1, 2, PAL.stoneD);
  });
}
function makePebbles() {
  return makeSprite(10, 4, (p) => {
    p(0, 2, 3, 2, PAL.stone); p(4, 1, 3, 3, PAL.stone); p(8, 2, 2, 2, PAL.stoneD); p(5, 1, 1, 1, PAL.stoneL);
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

// ---------- Umocnienia ----------
function makeWallSprite(w, seed) {
  const r = mulberry32(seed);
  return makeSprite(w, 17, (p) => {
    p(0, 4, w, 13, PAL.stone);
    for (let row = 0; row < 4; row++) {
      const y = 5 + row * 3;
      p(0, y, w, 1, PAL.mortar);
      for (let x = (row % 2) * 4 + Math.floor(r() * 2); x < w; x += 8) {
        p(x, y, 1, 3, PAL.mortar);
        p(x + 1, y + 1, 3, 1, r() > 0.4 ? PAL.stoneL : '#5e5953');
      }
    }
    p(0, 16, w, 1, PAL.stoneD);
    for (let x = 1; x < w - 2; x += 6) { p(x, 0, 4, 4, PAL.stone); p(x, 0, 4, 1, PAL.stoneL); }
    p(0, 4, w, 1, PAL.stoneL);
  }, '#1e1a16');
}
function makeGateSprite(w) {
  return makeSprite(w, 19, (p) => {
    p(0, 4, w, 15, '#5e5953');
    for (let x = 1; x < w - 2; x += 6) { p(x, 0, 4, 4, '#5e5953'); p(x, 0, 4, 1, PAL.stoneL); }
    p(0, 4, w, 1, PAL.stoneL);
    const dx = 5, dw = w - 10;
    p(dx, 7, dw, 12, PAL.woodD); p(dx + 1, 6, dw - 2, 1, PAL.woodD);
    for (let x = dx + 1; x < dx + dw; x += 3) p(x, 8, 2, 11, PAL.wood);
    p(dx, 10, dw, 1, '#3a3a3e'); p(dx, 15, dw, 1, '#3a3a3e');
    p(Math.floor(w / 2), 7, 1, 12, '#1a120a');
    p(Math.floor(w / 2) - 2, 12, 1, 2, PAL.gold); p(Math.floor(w / 2) + 2, 12, 1, 2, PAL.gold);
  }, '#1e1a16');
}
function makeRubble(w, seed) {
  const r = mulberry32(seed);
  return makeSprite(w, 8, (p) => {
    for (let i = 0; i < w / 2; i++) {
      const x = Math.floor(r() * (w - 3)), y = 2 + Math.floor(r() * 5), s = 2 + Math.floor(r() * 2);
      p(x, y, s, s - 1, r() > 0.5 ? PAL.stone : '#4e4a45');
      if (r() > 0.6) p(x, y, 1, 1, PAL.stoneL);
    }
  }, '#1e1a16');
}
function makeTowerSprite() {
  return makeSprite(20, 30, (p) => {
    // kamienna podstawa
    p(3, 12, 14, 18, PAL.stone);
    for (let row = 0; row < 6; row++) {
      const y = 13 + row * 3;
      p(3, y, 14, 1, PAL.mortar);
      for (let x = 3 + (row % 2) * 3; x < 17; x += 6) p(x, y, 1, 3, PAL.mortar);
    }
    p(3, 12, 14, 1, PAL.stoneL); p(16, 13, 1, 17, PAL.stoneD);
    p(8, 22, 4, 8, '#1a120a'); p(8, 21, 4, 1, PAL.stoneD);
    // drewniana platforma z blankami
    p(1, 7, 18, 5, PAL.wood); p(1, 7, 18, 1, PAL.woodL); p(1, 11, 18, 1, PAL.woodD);
    for (let x = 1; x < 19; x += 4) p(x, 4, 3, 3, PAL.wood);
    for (let x = 1; x < 19; x += 4) p(x, 4, 3, 1, PAL.woodL);
    // proporzec Carroburga
    p(17, 0, 1, 7, '#3a2614'); p(18, 0, 2, 3, PAL.red); p(18, 1, 2, 1, '#e8e0d0');
  }, '#1e1a16');
}
function makeArcher(draw) {
  return makeSprite(10, 9, (p, L) => {
    p(3, 3, 4, 6, PAL.red); p(4, 4, 1, 3, PAL.slash); p(3, 8, 4, 1, PAL.belt);
    p(3, 0, 4, 3, PAL.skin); p(2, 0, 6, 1, PAL.red); p(1, 1, 8, 1, PAL.red); p(7, 0, 2, 1, PAL.black);
    if (draw) { L(8, 1, 9, 4, PAL.wood); L(9, 4, 8, 7, PAL.wood); p(6, 4, 2, 1, PAL.skin); p(5, 4, 3, 1, '#c8c0a8'); }
    else { L(7, 1, 8, 4, PAL.wood); L(8, 4, 7, 7, PAL.wood); p(7, 2, 1, 4, '#c8c0a8'); }
  });
}
function makeIcon(kind) {
  const c = makeSprite(8, 8, (p) => {
    if (kind === 'stone') { p(1, 2, 6, 5, PAL.stone); p(0, 3, 8, 3, PAL.stone); p(2, 2, 3, 1, PAL.stoneL); p(1, 6, 6, 1, PAL.stoneD); }
    if (kind === 'wood')  { p(0, 2, 8, 3, PAL.wood); p(0, 5, 8, 3, PAL.woodL); p(0, 2, 2, 3, '#c8a070'); p(0, 5, 2, 3, '#c8a070'); p(0, 3, 1, 1, PAL.woodD); p(0, 6, 1, 1, PAL.woodD); }
    if (kind === 'points') { p(1, 1, 6, 6, PAL.gold); p(0, 2, 8, 4, PAL.gold); p(2, 2, 2, 2, '#f8e090'); p(5, 3, 1, 3, '#8a6a20'); }
  });
  return c;
}

function buildSet(dw, dh, fn, frames) {
  const set = {};
  for (const dir of ['down', 'up', 'right']) set[dir] = frames.map(([fr, atk]) => makeSprite(dw, dh, (p, L) => fn(p, L, dir, fr, atk)));
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
  SPR.deadTree = makeDeadTree();
  SPR.stump = makeStump();
  SPR.rocks = [makeRock(3), makeRock(8), makeRock(14)];
  SPR.pebbles = makePebbles();
  SPR.barrel = makeBarrel();
  SPR.cart = makeCart();
  SPR.tower = makeTowerSprite();
  SPR.archer = [makeArcher(false), makeArcher(true)];
  SPR.icon = { stone: makeIcon('stone'), wood: makeIcon('wood'), points: makeIcon('points') };
  SPR.shadow = { 10: makeShadow(10), 12: makeShadow(12), 14: makeShadow(14), 16: makeShadow(16), 22: makeShadow(22), 26: makeShadow(26) };
}

// Herb Carroburga (z pliku herb.png) — wersja pikselowa do gry
const CREST = { img: null, px: null, small: null };
function loadCrest() {
  const img = new Image();
  img.onload = () => {
    CREST.img = img;
    const mk = (s) => {
      const c = makeCanvas(s, s);
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, s, s);
      return c;
    };
    CREST.px = mk(18);
    CREST.small = mk(12);
    drawPreview();
  };
  img.src = 'herb.png';
}

// ==========================================================================
// 5. MAP
// ==========================================================================
const MAP = { ground: null, props: [] };

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
    { x: 214, y: 18, w: 70, h: 52, v: true },
    { x: 140, y: 150, w: 44, h: 26, v: false },
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
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

  const rng = mulberry32(1517);
  for (let k = 0; k < 10; k++) {
    const path = PATH_DATA.top, i = 1 + Math.floor(rng() * (path.length - 5));
    const t = rng();
    const x = Math.round(path[i][0] + (path[i + 1][0] - path[i][0]) * t + rng() * 6 - 3);
    const y = Math.round(path[i][1] + (path[i + 1][1] - path[i][1]) * t + rng() * 4 - 2);
    if (y > 190) continue;
    const w = 4 + Math.floor(rng() * 5);
    P(x - w / 2, y, w, 2, '#2b2e2a'); P(x - w / 2 + 1, y - 1, w - 2, 4, '#2b2e2a');
    P(x - w / 2 + 1, y, 2, 1, '#5a625c');
  }
  const fence = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.floor(len / 6);
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + (x1 - x0) * s / steps), y = Math.round(y0 + (y1 - y0) * s / steps);
      if (roadDist(x, y) < 13) continue;
      P(x - 1, y - 5, 3, 7, '#1e140c'); P(x, y - 5, 1, 6, '#6a4a2a');
      if (s < steps && roadDist(x + 3, y) > 13) P(x, y - 3, (x1 - x0) / steps + 1, 1, '#5a3e22');
    }
  };
  fence(4, 40, 104, 40); fence(214, 73, 284, 73); fence(140, 178, 184, 178);

  // fundamenty murów (ruiny) — w miejscach bez muru widać zarys
  P(0, WALL_TOP + 5, W, WALL_BOT - WALL_TOP - 5, '#2e2a24');
  for (let y = WALL_TOP + 5; y < WALL_BOT; y++) for (let x = 0; x < W; x++) if (hash2(x, y) > 0.82) P(x, y, 1, 1, '#3e3a32');
  for (let x = 0, k = 0; x < W; k++) {
    const w = 3 + Math.floor(hash2(k, 7) * 4), row = k % 2;
    const y = WALL_BOT - 4 - row * 3;
    if (hash2(k, 3) > 0.18) {
      P(x, y, w, 3, '#57524c'); P(x, y, w, 1, '#77716a'); P(x, y + 2, w, 1, '#3a3632');
    }
    x += w + 1;
  }
  // fundamenty wież
  for (const [tx, ty] of TOWER_SPOTS) {
    for (let a = 0; a < 24; a++) {
      const an = a / 24 * Math.PI * 2;
      const x = Math.round(tx + Math.cos(an) * 8), y = Math.round(ty - 1 + Math.sin(an) * 4);
      P(x, y, 2, 1, a % 3 ? '#5e5953' : '#3e3a35');
    }
  }
  drawCity(g);
  return c;
}

// Miasto za murami — dachy Carroburga
function drawCity(g) {
  const P = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  P(0, WALL_BOT, W, H - WALL_BOT, '#3e3832');
  for (let y = WALL_BOT; y < H; y += 3) for (let x = (y % 2) * 2; x < W; x += 4) P(x, y, 3, 2, '#4a443c');
  const roofs = ['#6a2a1c', '#7a3424', '#5a2418', '#6a3a24'];
  for (let i = 0, x = 2; x < W; i++) {
    const w = 18 + (i * 7) % 10;
    if (x + w > 136 && x < 184) { x = 186; continue; }
    const y = WALL_BOT + 4 + (i % 2) * 2;
    P(x, y + 4, w, H - y, '#c8b89a');
    P(x, y + 4, 1, H - y, '#5a3a22'); P(x + w - 1, y + 4, 1, H - y, '#5a3a22'); P(x, y + 8, w, 1, '#5a3a22');
    const rc = roofs[i % roofs.length];
    for (let k = 0; k < 6; k++) P(x - 1 + k, y + 4 - k, w + 2 - k * 2, 1, rc);
    P(x - 1, y + 4, w + 2, 1, '#3a1810');
    if (i % 3 === 0) P(x + 4, y + 10, 3, 3, '#e8b040');
    x += w + 3;
  }
  // brukowana ulica od bramy
  P(146, WALL_BOT, 28, H - WALL_BOT, '#504a42');
  for (let y = WALL_BOT; y < H; y += 2) for (let x = 146 + (y % 4 === 0 ? 0 : 2); x < 174; x += 4) P(x, y, 3, 1, '#5e574d');
}

function placeProps() {
  const rng = mulberry32(2024);
  const props = [];
  const ok = (x, y, r, minRoad) => {
    if (x < 10 || x > W - 10 || y < 18 || y > 186) return false;
    if (roadDist(x, y) < minRoad + r) return false;
    for (const q of props) if (Math.hypot(q.x - x, q.y - y) < q.r + r + 14) return false;
    for (const [tx, ty] of TOWER_SPOTS) if (Math.hypot(tx - x, ty - y) < r + 22) return false;
    return true;
  };
  const tryPlace = (count, mk, r, minRoad = 16) => {
    let placed = 0, tries = 0;
    while (placed < count && tries++ < 800) {
      const x = Math.round(10 + rng() * (W - 20)), y = Math.round(18 + rng() * 168);
      if (!ok(x, y, r, minRoad)) continue;
      props.push(Object.assign({ x, y, r }, mk(placed)));
      placed++;
    }
  };
  props.push({ x: 112, y: 100, r: 9, spr: SPR.cart, shadow: 26 });
  tryPlace(12, i => ({ spr: SPR.trees[i % 3], shadow: 16, solidR: 4, res: 'wood', max: CFG.node.wood, alt: SPR.stump }), 4, 18);
  tryPlace(3, () => ({ spr: SPR.deadTree, shadow: 12, res: 'wood', max: CFG.node.deadwood, alt: SPR.stump }), 3, 16);
  tryPlace(9, i => ({ spr: SPR.rocks[i % 3], shadow: 12, res: 'stone', max: CFG.node.stone, alt: SPR.pebbles }), 5, 14);
  tryPlace(2, () => ({ spr: SPR.barrel, shadow: 10 }), 4, 16);
  for (const p of props) { if (p.res) p.stock = p.max; p.wob = 0; }
  MAP.props = props;
}

// ==========================================================================
// 6. STRUCTURES — mury, brama, wieże
// ==========================================================================
const SEGS = [];
const TOWERS = [];
function initStructures() {
  SEGS.length = 0;
  for (let i = 0; i < SEG_N; i++) {
    const x0 = Math.round(i * SEG_W), x1 = Math.round((i + 1) * SEG_W);
    const kind = i === GATE_SEG ? 'gate' : 'wall';
    SEGS.push({
      kind, i, x0, x1, cx: (x0 + x1) / 2, x: (x0 + x1) / 2, y: WALL_TOP + 4,
      built: false, hp: 0, max: CFG.hp[kind], flash: 0, rubble: false,
      spr: kind === 'gate' ? makeGateSprite(x1 - x0) : makeWallSprite(x1 - x0, 100 + i),
      rubbleSpr: makeRubble(x1 - x0, 300 + i),
      cracks: makeCracks(x1 - x0, 500 + i),
    });
  }
  TOWERS.length = 0;
  for (const [x, y] of TOWER_SPOTS) {
    TOWERS.push({ kind: 'tower', x, y, built: false, hp: 0, max: CFG.hp.tower, cd: 0, shotT: 0, flash: 0, rubble: false });
  }
}
function makeCracks(w, seed) {
  const r = mulberry32(seed);
  const lines = [];
  for (let k = 0; k < 6; k++) {
    let x = 2 + Math.floor(r() * (w - 4)), y = 6 + Math.floor(r() * 4);
    const pts = [];
    for (let s = 0; s < 6; s++) { pts.push([x, y]); x += Math.round(r() * 2 - 1); y += 1; }
    lines.push(pts);
  }
  return lines;
}
function resetStructures() {
  for (const s of SEGS) { s.built = false; s.hp = 0; s.rubble = false; s.flash = 0; }
  for (const t of TOWERS) { t.built = false; t.hp = 0; t.rubble = false; t.cd = 0; t.shotT = 0; t.flash = 0; }
}
const alive = s => s && s.built && s.hp > 0;
const segAt = x => SEGS[clamp(Math.floor(x / SEG_W), 0, SEG_N - 1)];
const NAMES = { wall: 'mur', gate: 'bramę', tower: 'wieżę łuczników' };

function structureCost(s) {
  const base = CFG.cost[s.kind];
  if (!s.built) return { act: 'build', cost: base };
  if (s.hp < s.max) {
    const f = (s.max - s.hp) / s.max;
    const c = {};
    for (const k in base) c[k] = Math.max(1, Math.ceil(base[k] * f * 0.6));
    return { act: 'repair', cost: c };
  }
  return null;
}
function canAfford(cost) { for (const k in cost) if ((G.res[k] || 0) < cost[k]) return false; return true; }
function pay(cost) { for (const k in cost) G.res[k] -= cost[k]; }

function findBuildSpot() {
  const h = G.hero;
  if (!h || h.dead) return null;
  // tylko miejsca, przy których jest coś do zrobienia (budowa lub naprawa); wygrywa najbliższe
  let best = null, bd = 1e9;
  if (h.y >= 190) {
    for (const s of SEGS) {
      if (Math.abs(h.x - s.cx) > SEG_W / 2 + 1 || !structureCost(s)) continue;
      const d = (WALL_TOP + 2 - h.y) + Math.abs(h.x - s.cx) * 0.2;
      if (d < bd) { bd = d; best = s; }
    }
  }
  for (const t of TOWERS) {
    if (!structureCost(t)) continue;
    const d = Math.hypot(h.x - t.x, h.y - t.y);
    if (d < 16 && d < bd) { bd = d; best = t; }
  }
  return best;
}
function spotBlocked(s) {
  for (const e of G.enemies) {
    if (e.state === 'dying') continue;
    if (s.kind === 'tower') { if (Math.hypot(e.x - s.x, e.y - s.y) < TOWER_R + e.r + 2) return true; }
    else if (e.x > s.x0 - e.r && e.x < s.x1 + e.r && e.y > SIEGE_Y + 2) return true;
  }
  return false;
}
function tryBuild() {
  const s = findBuildSpot();
  if (!s) return false;
  const a = structureCost(s);
  if (!a) return false;
  if (spotBlocked(s) || !canAfford(a.cost)) { Sfx.denied(); UI.promptShake(); return false; }
  pay(a.cost);
  s.built = true; s.hp = s.max; s.rubble = false; s.flash = 0.2;
  if (s.kind === 'tower') s.cd = 0.5;
  Sfx.build();
  const bx = s.kind === 'tower' ? s.x : s.cx, by = s.kind === 'tower' ? s.y : WALL_BOT - 2;
  dust(bx, by, 14, s.kind === 'tower' ? 10 : 14);
  return true;
}
function damageStructure(s, dmg) {
  if (!alive(s)) return;
  s.hp -= dmg;
  s.flash = 0.12;
  const bx = s.kind === 'tower' ? s.x + rand(-5, 5) : clamp(s.cx + rand(-10, 10), s.x0, s.x1);
  const by = s.kind === 'tower' ? s.y - 6 : WALL_TOP + 6;
  chips(bx, by, 3, '#6a645d');
  Sfx.thud();
  if (s.hp <= 0) {
    s.hp = 0; s.built = false; s.rubble = true;
    Sfx.collapse();
    G.shake = Math.max(G.shake, 4);
    dust(s.kind === 'tower' ? s.x : s.cx, s.kind === 'tower' ? s.y : WALL_BOT - 3, 24, 16);
    UI.toast(s.kind === 'tower' ? 'Wieża runęła!' : s.kind === 'gate' ? 'Brama wyłamana!' : 'Wyrwa w murze!');
  }
}

// ==========================================================================
// 7. INPUT
// ==========================================================================
const Input = {
  keys: new Set(),
  attackHeld: false,
  pressT: 0,
  aimAngle: null,
  buildPress: false,
  nextPress: false,
  touchAxis: [0, 0],
  isTouch: false,
  bot: null,
  init(canvas) {
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    window.addEventListener('keydown', e => {
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (k === 'Space') { this.attackHeld = true; if (!e.repeat) this.pressT = 0.18; }
      else if (k === 'KeyP' || k === 'Escape') { if (!e.repeat) Game.togglePause(); }
      else if (k === 'KeyM') { if (!e.repeat) UI.toggleSound(true); }
      else if (k === 'KeyE' || k === 'KeyB') { if (!e.repeat) this.buildPress = true; }
      else if (k === 'KeyN') { if (!e.repeat) this.nextPress = true; }
      else if (k === 'Enter') { if (G.state === 'menu') Game.start(); }
      this.keys.add(k);
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.attackHeld = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear(); this.attackHeld = false; this.touchAxis = [0, 0];
      if (G.state === 'play') Game.togglePause();
    });
    canvas.addEventListener('pointerdown', e => {
      if (G.state !== 'play') return;
      const r = canvas.getBoundingClientRect();
      const gx = (e.clientX - r.left) / r.width * W, gy = (e.clientY - r.top) / r.height * H;
      const h = G.hero;
      this.aimAngle = Math.atan2(gy - (h.y - 9), gx - h.x);
      this.pressT = 0.18;
      e.preventDefault();
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.initTouch();
  },
  initTouch() {
    const joy = document.getElementById('joy');
    const knob = document.getElementById('joy-knob');
    if (!joy) return;
    let id = null;
    const update = (e) => {
      const r = joy.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width * 0.38;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const nx = dx / max, ny = dy / max;
      this.touchAxis = Math.hypot(nx, ny) < 0.22 ? [0, 0] : [nx, ny];
    };
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; this.touchAxis = [0, 0];
      knob.style.transform = 'translate(-50%, -50%)';
    };
    joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); update(e); e.preventDefault(); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === id) update(e); });
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

    const hold = (el, down, up) => {
      el.addEventListener('pointerdown', e => { el.setPointerCapture(e.pointerId); el.classList.add('down'); down(); e.preventDefault(); });
      const off = () => { el.classList.remove('down'); if (up) up(); };
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
    };
    hold(document.getElementById('t-attack'), () => { this.attackHeld = true; this.pressT = 0.18; }, () => { this.attackHeld = false; });
    hold(document.getElementById('t-build'), () => { this.buildPress = true; });
    hold(document.getElementById('t-pause'), () => Game.togglePause());
  },
  axis() {
    if (this.bot) return [this.bot.dx, this.bot.dy];
    const k = this.keys;
    let dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let dy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (!dx && !dy) { dx = this.touchAxis[0]; dy = this.touchAxis[1]; }
    return [dx, dy];
  },
};

// ==========================================================================
// 8. ENTITIES
// ==========================================================================
const G = {
  state: 'menu', hero: null, enemies: [], particles: [], arrows: [], floaters: [],
  wave: 0, phase: 'build', phaseT: 0, spawnQueue: [], spawnT: 0,
  waveTotal: 0, waveDone: 0, kills: 0, breached: 0, cityHP: CFG.cityHP,
  res: { stone: 0, wood: 0, points: 0 },
  shake: 0, hitstop: 0, time: 0, endT: -1, endReason: '',
  decals: null, decalCtx: null,
};

function newHero() {
  return {
    x: 160, y: 176, hp: CFG.hero.hp, facing: -Math.PI / 2, dir: 'up',
    moving: false, walkT: 0, atkCd: 0, swingT: -1, swingFrom: 0, hitDone: true,
    inv: 0, hurtT: 0, kbx: 0, kby: 0, dead: false, deathT: 0,
  };
}

function spawnEnemy(type, pathKey, jitter = 0) {
  const cfg = CFG.enemy[type];
  const P = PATHS[pathKey];
  const ang = Math.random() * Math.PI * 2;
  const e = {
    type, cfg, P, s: 0, lat: rand(-6, 6),
    x: P.pts[0][0] + Math.cos(ang) * jitter, y: P.pts[0][1] + Math.sin(ang) * jitter,
    speedMul: rand(0.9, 1.12),
    r: cfg.radius, hp: cfg.hp, maxHp: cfg.hp,
    state: 'walk', stateT: 0, face: Math.PI / 2, moving: true, animT: Math.random(),
    kbx: 0, kby: 0, flash: 0, remove: false,
    seg: null, target: null, atkTarget: null, retarget: rand(0.5, 1.2), passSeg: null,
  };
  G.enemies.push(e);
  if (type === 'ratogre') Sfx.roar();
  return e;
}

function addParticle(o) {
  if (G.particles.length > 600) G.particles.shift();
  G.particles.push(Object.assign({ z: 6, vz: 0, life: 0.6, max: 0.6, size: 1, stamp: false, grav: 220, fade: false }, o));
}
function bloodBurst(x, y, nx, ny, n, big = false) {
  for (let i = 0; i < n; i++) {
    const s = rand(20, big ? 90 : 60);
    const a = Math.atan2(ny, nx) + rand(-0.9, 0.9);
    addParticle({ x, y, z: rand(4, 10), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.7, vz: rand(20, 70),
      col: Math.random() < 0.5 ? '#8a1410' : '#5a0c0a', life: 1.2, max: 1.2, stamp: true, size: Math.random() < 0.3 ? 2 : 1 });
  }
}
function sparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(40, 110);
    addParticle({ x, y, z: 9, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(10, 50), col: Math.random() < 0.5 ? '#fff4c0' : '#f0a030', life: 0.25, max: 0.25, grav: 60, fade: true });
  }
}
function chips(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(20, 60);
    addParticle({ x, y, z: rand(3, 8), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: rand(30, 70), col, life: 0.7, max: 0.7 });
  }
}
function dust(x, y, n, spread) {
  for (let i = 0; i < n; i++) {
    addParticle({ x: x + rand(-spread, spread), y: y + rand(-3, 3), z: rand(0, 6), vx: rand(-15, 15), vy: rand(-6, 6), vz: rand(5, 25),
      col: Math.random() < 0.5 ? '#8a8070' : '#6a6050', life: rand(0.5, 0.9), max: 0.9, grav: 10, fade: true, size: 2 });
  }
}
function floater(x, y, amount, icon) {
  G.floaters.push({ x, y, t: 0, text: (amount > 0 ? '+' : '') + amount, icon });
}

// ==========================================================================
// 9. WAVES
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

function startBuildPhase(first) {
  G.phase = 'build';
  G.phaseT = first ? CFG.prepFirst : CFG.prep;
  G.waveDone = 0; G.waveTotal = 0;
}

function beginWave(n) {
  const def = WAVES[n - 1];
  G.wave = n;
  G.spawnQueue = buildSpawnQueue(def);
  G.waveTotal = def.clanrat + def.stormvermin + def.ratogre;
  G.waveDone = 0;
  G.phase = 'pre';
  G.phaseT = 2.4;
  G.spawnT = 0;
  UI.banner(`Fala ${n}`, def.sub, 2.4, def.ratogre > 0);
  Sfx.horn();
}

function updateWaves(dt) {
  if (G.phase === 'build') {
    G.phaseT -= dt;
    if (G.phaseT <= 0 || Input.nextPress) beginWave(G.wave + 1);
  } else if (G.phase === 'pre') {
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
      const h = G.hero;
      if (!h.dead) h.hp = Math.min(CFG.hero.hp, h.hp + CFG.hero.healPerWave);
      for (const p of MAP.props) if (p.res) p.stock = Math.min(p.max, p.stock + CFG.node.regrow);
      Sfx.waveClear();
      const g = G.decalCtx;
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'source-over';
      if (G.wave >= WAVES.length) {
        G.phase = 'done'; G.phaseT = 1.4;
        UI.banner('Zwycięstwo!', 'Carroburg ocalony', 2, false);
      } else {
        startBuildPhase(false);
        UI.banner(`Fala ${G.wave} odparta!`, 'Napraw mury, zbierz zasoby, postaw wieże', 2.6, false);
      }
    }
  } else if (G.phase === 'done') {
    G.phaseT -= dt;
    if (G.phaseT <= 0) Game.victory();
  }
  Input.nextPress = false;
}

// ==========================================================================
// 10. GAME
// ==========================================================================
const Game = {
  reset() {
    G.hero = newHero();
    G.enemies = []; G.particles = []; G.arrows = []; G.floaters = [];
    G.kills = 0; G.breached = 0; G.cityHP = CFG.cityHP;
    G.res = Object.assign({}, CFG.start);
    G.wave = 0; G.phase = 'build'; G.phaseT = CFG.prepFirst; G.spawnQueue = []; G.waveTotal = 0; G.waveDone = 0;
    G.shake = 0; G.hitstop = 0; G.endT = -1; G.endReason = '';
    G.decalCtx.clearRect(0, 0, W, H);
    resetStructures();
    for (const p of MAP.props) if (p.res) p.stock = p.max;
    Input.pressT = 0; Input.aimAngle = null; Input.buildPress = false; Input.nextPress = false;
  },
  start() {
    Sfx.init();
    this.reset();
    G.state = 'play';
    UI.showScreen(null);
    startBuildPhase(true);
    UI.banner('Przygotuj obronę', Input.isTouch
      ? 'Tnij skały i drzewa po kamień i drewno. Przy fundamentach naciśnij BUDUJ.'
      : 'Tnij skały i drzewa po kamień i drewno. Przy fundamentach naciśnij E.', 5, false);
  },
  togglePause() {
    if (G.state === 'play') { G.state = 'pause'; UI.showScreen('pause'); }
    else if (G.state === 'pause') { G.state = 'play'; UI.showScreen(null); }
  },
  gameOver() { G.state = 'over'; UI.gameOver(); },
  victory() { G.state = 'win'; Sfx.victory(); UI.victory(); },
};

function tick(dt) {
  G.time += dt;
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  updateHero(dt);
  for (const e of G.enemies) updateEnemy(e, dt);
  separateEnemies();
  G.enemies = G.enemies.filter(e => !e.remove);
  updateTowers(dt);
  updateArrows(dt);
  updateParticles(dt);
  for (const f of G.floaters) f.t += dt;
  G.floaters = G.floaters.filter(f => f.t < 1);
  for (const s of SEGS) s.flash = Math.max(0, s.flash - dt);
  for (const t of TOWERS) { t.flash = Math.max(0, t.flash - dt); t.shotT = Math.max(0, t.shotT - dt); }
  for (const p of MAP.props) if (p.wob > 0) p.wob -= dt;
  if (G.endT < 0) updateWaves(dt);
  G.shake = Math.max(0, G.shake - dt * 18);
  if (G.endT >= 0) {
    G.endT -= dt;
    if (G.endT < 0) Game.gameOver();
  }
  Input.buildPress = false;
}

// Kolizje z rekwizytami i zbudowanymi wieżami
function collideSolids(o, r) {
  for (const p of MAP.props) {
    const pr = (p.solidR || p.r) + r;
    const dx = o.x - p.x, dy = o.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < pr && d > 0.001) { o.x = p.x + dx / d * pr; o.y = p.y + dy / d * pr; }
  }
  for (const t of TOWERS) {
    if (!alive(t)) continue;
    const pr = TOWER_R + r;
    const dx = o.x - t.x, dy = o.y - t.y;
    const d = Math.hypot(dx, dy);
    if (d < pr && d > 0.001) { o.x = t.x + dx / d * pr; o.y = t.y + dy / d * pr; }
  }
}

function updateHero(dt) {
  const h = G.hero, C = CFG.hero;
  if (h.dead) { h.deathT += dt; return; }
  h.atkCd -= dt; h.inv -= dt; h.hurtT -= dt; Input.pressT -= dt;

  let [mx, my] = Input.axis();
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const swinging = h.swingT >= 0;
  if (len > 0.05 && !swinging) h.facing = Math.atan2(my, mx);
  const spd = C.speed * (swinging ? 0.35 : 1);
  h.x += (mx * spd + h.kbx) * dt;
  h.y += (my * spd + h.kby) * dt;
  const k = Math.exp(-10 * dt); h.kbx *= k; h.kby *= k;
  h.moving = len > 0.05;
  if (h.moving) h.walkT += dt * Math.min(1, len);
  collideSolids(h, C.radius);
  h.x = clamp(h.x, HERO_BOUNDS.minX, HERO_BOUNDS.maxX);
  h.y = clamp(h.y, HERO_BOUNDS.minY, HERO_BOUNDS.maxY);

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
  if (Input.buildPress) tryBuild();
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
    return;
  }
  // zbieranie zasobów: cios w skałę lub drzewo
  let node = null, nd = 1e9;
  for (const p of MAP.props) {
    if (!p.res || p.stock <= 0) continue;
    const dx = p.x - h.x, dy = (p.y - 3) - h.y;
    const d = Math.hypot(dx, dy);
    if (d > C.range + p.r || d >= nd) continue;
    if (angDiff(Math.atan2(dy, dx), h.facing) > C.arc + 0.3 && d > p.r + 8) continue;
    node = p; nd = d;
  }
  if (node) {
    const y = Math.min(CFG.node.yield, node.stock);
    node.stock -= y;
    G.res[node.res] += y;
    node.wob = 0.15;
    floater(node.x, node.y - (node.res === 'wood' ? 26 : 10), y, node.res);
    if (node.res === 'stone') { Sfx.pick(); chips(node.x, node.y - 4, 4, PAL.stoneL); sparks(node.x, node.y - 4, 2); }
    else { Sfx.chop(); chips(node.x, node.y - 8, 4, PAL.woodL); }
  }
}

function damageEnemy(e, dmg, nx, ny, fromArrow = false) {
  e.hp -= dmg;
  e.flash = 0.1;
  const bx = e.x, by = e.y - e.r - 2;
  if (e.cfg.armored && !fromArrow) sparks(bx, by, 6);
  bloodBurst(bx, by, nx, ny, e.hp <= 0 ? 12 : (fromArrow ? 3 : 5), e.type === 'ratogre');
  if (e.hp <= 0) { killEnemy(e); return; }
  const kb = (fromArrow ? 30 : CFG.hero.knock) / e.cfg.mass;
  e.kbx = nx * kb; e.kby = ny * kb;
  if (!e.cfg.poise && !fromArrow) { e.state = 'stun'; e.stateT = e.cfg.stun; }
}

function killEnemy(e) {
  e.state = 'dying';
  e.stateT = e.type === 'ratogre' ? 0.6 : 0.35;
  G.kills++; G.waveDone++;
  G.res.points += e.cfg.points;
  floater(e.x, e.y - e.r * 2 - 8, e.cfg.points, 'points');
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
  G.cityHP = Math.max(0, G.cityHP - e.cfg.gate);
  G.shake = Math.max(G.shake, 4);
  Sfx.breach();
  if (G.cityHP <= 0 && G.endT < 0) { G.endT = 1.0; G.endReason = 'city'; }
}

// Wybór odcinka muru: najpierw wyrwy, potem losowy fragment w pobliżu
function pickSegment(e) {
  const gaps = SEGS.filter(s => !alive(s));
  if (gaps.length && Math.random() < 0.85) {
    let best = gaps[0], bd = 1e9;
    for (const s of gaps) { const d = Math.abs(s.cx - e.x) + rand(0, 30); if (d < bd) { bd = d; best = s; } }
    e.seg = best;
  } else {
    let sum = 0;
    const w = SEGS.map(s => { const v = 1 / (1 + Math.pow(Math.abs(s.cx - e.x) / 60, 2)); sum += v; return v; });
    let r = Math.random() * sum;
    e.seg = SEGS[SEGS.length - 1];
    for (let i = 0; i < SEGS.length; i++) { r -= w[i]; if (r <= 0) { e.seg = SEGS[i]; break; } }
  }
}
function nearbyTower(e, range) {
  let best = null, bd = range;
  for (const t of TOWERS) {
    if (!alive(t)) continue;
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
function nearestGap(x, maxD) {
  let best = null, bd = maxD;
  for (const s of SEGS) if (!alive(s)) { const d = Math.abs(s.cx - x); if (d < bd) { bd = d; best = s; } }
  return best;
}
function steer(e, tx, ty, sp) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (d < 0.5) return [0, 0, d];
  const s = Math.min(sp, d * 8);
  return [dx / d * s, dy / d * s, d];
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
      const g = G.decalCtx;
      g.fillStyle = '#4a0a08';
      const s = e.type === 'ratogre' ? 10 : 5;
      for (let i = 0; i < s * 3; i++) g.fillRect(Math.round(e.x + rand(-s, s)), Math.round(e.y - 2 + rand(-s / 2, s / 2)), 2, 1);
      g.globalAlpha = 0.85;
      g.drawImage(cs, Math.round(e.x - cs.width / 2), Math.round(e.y - cs.height / 2 - 2));
      g.globalAlpha = 1;
    }
    return;
  }

  const dx = h.x - e.x, dy = h.y - e.y, hd = Math.hypot(dx, dy) || 0.01;
  const heroOk = !h.dead;
  const contact = e.r + CFG.hero.radius + C.reach;
  const sp = C.speed * e.speedMul;
  let vx = 0, vy = 0;

  // bohater w pobliżu — szczur rzuca się do walki
  if (heroOk && (e.state === 'walk' || e.state === 'approach' || (e.state === 'siege' && hd < C.aggro * 0.6)) && hd < C.aggro) {
    e.state = 'chase';
  }

  switch (e.state) {
    case 'walk': {
      const look = pathPoint(e.P, e.s + 12);
      let dl;
      [vx, vy, dl] = steer(e, look.x + look.nx * e.lat, look.y + look.ny * e.lat, sp);
      // na ostrych zakrętach cel może wypaść w miejscu szczura — wtedy przesuwamy go dalej
      if (dl < 4) e.s += sp * dt * 1.5;
      const t = nearbyTower(e, 24);
      if (t) { e.state = 'siege'; e.target = t; break; }
      if (e.y >= APPROACH_Y || e.s >= e.P.total - 30) { e.state = 'approach'; pickSegment(e); }
      break;
    }
    case 'approach': {
      e.retarget -= dt;
      if (e.retarget <= 0) {
        e.retarget = 1;
        if (alive(e.seg)) { const g = nearestGap(e.x, 100); if (g && Math.random() < 0.7) e.seg = g; }
      }
      const t = nearbyTower(e, 22);
      if (t) { e.state = 'siege'; e.target = t; break; }
      const s = e.seg;
      if (alive(s)) {
        const tx = clamp(e.x, s.x0 + 4, s.x1 - 4);
        let d;
        [vx, vy, d] = steer(e, tx, SIEGE_Y, sp);
        if (d < 3) { e.state = 'siege'; e.target = s; }
      } else {
        const half = (s.x1 - s.x0) / 2 - e.r - 1;
        const tx = s.cx + clamp(e.lat, -half, half);
        [vx, vy] = steer(e, tx, BREACH_Y + 8, sp);
        if (e.y > SIEGE_Y && Math.abs(e.x - s.cx) <= half + 1) { e.state = 'enter'; e.passSeg = s; }
      }
      break;
    }
    case 'enter': {
      [vx, vy] = steer(e, e.passSeg.cx + e.lat * 0.3, BREACH_Y + 10, sp);
      break;
    }
    case 'siege': {
      const T = e.target;
      if (!alive(T)) { e.state = 'approach'; pickSegment(e); break; }
      e.retarget -= dt;
      if (e.retarget <= 0 && T.kind !== 'tower') {
        e.retarget = 1;
        const g = nearestGap(e.x, 45);
        if (g) { e.state = 'approach'; e.seg = g; break; }
      }
      let tx, ty;
      if (T.kind === 'tower') {
        const a = Math.atan2(e.y - T.y, e.x - T.x), rr = TOWER_R + e.r + 1;
        tx = T.x + Math.cos(a) * rr; ty = T.y + Math.sin(a) * rr;
      } else { tx = clamp(e.x, T.x0 + 4, T.x1 - 4); ty = SIEGE_Y; }
      let d;
      [vx, vy, d] = steer(e, tx, ty, sp);
      if (d < 3) {
        vx = vy = 0;
        e.state = 'windup'; e.stateT = C.windup; e.atkTarget = T;
        e.face = Math.atan2((T.kind === 'tower' ? T.y : WALL_TOP + 6) - e.y, (T.kind === 'tower' ? T.x : e.x) - e.x);
      }
      break;
    }
    case 'chase': {
      if (!heroOk || hd > C.aggro * 1.7) {
        if (e.y >= APPROACH_Y - 10) { e.state = 'approach'; pickSegment(e); }
        else { e.state = 'walk'; e.s = pathProject(e.P, e.x, e.y, Math.max(0, e.s - 60), e.s + 80); }
        break;
      }
      if (hd <= contact) { e.state = 'windup'; e.stateT = C.windup; e.atkTarget = 'hero'; e.face = Math.atan2(dy, dx); break; }
      vx = dx / hd * sp * 1.15; vy = dy / hd * sp * 1.15;
      break;
    }
    case 'windup':
      if (e.atkTarget === 'hero' && e.stateT > C.windup * 0.4) e.face = Math.atan2(dy, dx);
      e.stateT -= dt;
      if (e.stateT <= 0) {
        e.state = 'strike'; e.stateT = 0.2;
        if (e.atkTarget === 'hero') { if (heroOk && hd <= contact + 5) hurtHero(C.dmg, e); }
        else damageStructure(e.atkTarget, C.sdmg);
      }
      break;
    case 'strike':
      e.stateT -= dt;
      if (e.stateT <= 0) { e.state = 'recover'; e.stateT = e.atkTarget === 'hero' ? C.recover : C.recover * 0.7; }
      break;
    case 'recover':
      e.stateT -= dt;
      if (e.stateT <= 0) {
        if (e.atkTarget !== 'hero' && alive(e.atkTarget)) { e.state = 'siege'; e.target = e.atkTarget; }
        else if (e.atkTarget !== 'hero') { e.state = 'approach'; pickSegment(e); }
        else e.state = 'chase';
      }
      break;
    case 'stun':
      e.stateT -= dt;
      if (e.stateT <= 0) e.state = 'chase';
      break;
  }

  e.x += vx * dt; e.y += vy * dt;
  e.moving = (vx * vx + vy * vy) > 1;
  // strażnik: szczur, który długo nie robi postępu na drodze, zostaje popchnięty dalej
  if (e.state === 'walk') {
    if (Math.abs(e.s - (e.lastS ?? -99)) < 1) { e.idleT = (e.idleT || 0) + dt; if (e.idleT > 4) { e.s += 16; e.idleT = 0; } }
    else { e.idleT = 0; e.lastS = e.s; }
  }
  if (e.moving && e.state !== 'windup') e.face = Math.atan2(vy, vx);
  if (e.state === 'walk') e.s = Math.max(e.s, pathProject(e.P, e.x, e.y, e.s - 10, e.s + 40));

  if (e.state !== 'walk' && e.state !== 'enter') collideSolids(e, e.r);
  // mury: przejście tylko przez wyrwy
  if (e.state === 'enter') {
    const s = e.passSeg, m = Math.min(e.r, (s.x1 - s.x0) / 2 - 1);
    e.x = clamp(e.x, s.x0 + m, s.x1 - m);
    if (alive(s) && e.y < WALL_BOT) { e.state = 'approach'; pickSegment(e); e.y = Math.min(e.y, SIEGE_Y + 1); }
  } else if (e.y > SIEGE_Y + 2) {
    const s = segAt(e.x);
    if (!alive(s) && e.state !== 'chase') { e.state = 'enter'; e.passSeg = s; }
    else e.y = Math.min(e.y, SIEGE_Y + 2);
  }
  e.x = clamp(e.x, -20, W + 20);
  if (e.y >= BREACH_Y) breach(e);
}

function separateEnemies() {
  const list = G.enemies, h = G.hero;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.state === 'dying') continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.state === 'dying') continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 22 || Math.abs(dy) > 22) continue;
      const d = Math.hypot(dx, dy), min = a.r + b.r - 2;
      if (d < min && d > 0.001) {
        // miękkie rozpychanie — tłum przesuwa się zamiast blokować
        const push = (min - d) * 0.5, wa = b.cfg.mass / (a.cfg.mass + b.cfg.mass);
        a.x -= dx / d * push * wa; a.y -= dy / d * push * wa;
        b.x += dx / d * push * (1 - wa); b.y += dy / d * push * (1 - wa);
      }
    }
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

function updateTowers(dt) {
  const T = CFG.tower;
  for (const t of TOWERS) {
    if (!alive(t)) continue;
    t.cd -= dt;
    if (t.cd > 0) continue;
    let best = null, bs = -1e9;
    for (const e of G.enemies) {
      if (e.state === 'dying') continue;
      const d = Math.hypot(e.x - t.x, e.y - (t.y - 20));
      if (d > T.range) continue;
      const score = e.y + (e.state === 'siege' || e.state === 'enter' ? 80 : 0) - d * 0.3;
      if (score > bs) { bs = score; best = e; }
    }
    if (best) {
      G.arrows.push({ x: t.x, y: t.y - 24, target: best, tx: best.x, ty: best.y - 6, life: 1.5 });
      t.cd = T.cd; t.shotT = 0.18;
      Sfx.bow();
    }
  }
}
function updateArrows(dt) {
  const sp = CFG.tower.arrowSpeed;
  for (const a of G.arrows) {
    a.life -= dt;
    if (a.target && a.target.state !== 'dying' && !a.target.remove) { a.tx = a.target.x; a.ty = a.target.y - 6; }
    else a.target = null;
    const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
    a.ang = Math.atan2(dy, dx);
    if (d < 4 || a.life <= 0) {
      if (a.target) damageEnemy(a.target, CFG.tower.dmg, dx / (d || 1), dy / (d || 1), true);
      a.done = true; continue;
    }
    a.x += dx / d * sp * dt; a.y += dy / d * sp * dt;
  }
  G.arrows = G.arrows.filter(a => !a.done);
}

function updateParticles(dt) {
  for (const p of G.particles) {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vz -= p.grav * dt; p.z += p.vz * dt;
    if (p.z <= 0) {
      p.z = 0;
      if (p.stamp) {
        G.decalCtx.fillStyle = p.col;
        G.decalCtx.fillRect(Math.round(p.x), Math.round(p.y), p.size, 1);
        p.life = 0;
      } else { p.vx *= 0.6; p.vy *= 0.6; }
    }
  }
  G.particles = G.particles.filter(p => p.life > 0);
}

// ==========================================================================
// 11. RENDER
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

// Czcionka bitmapowa 3x5 (cyfry i +/-)
const FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111',
  '+': '000010111010000', '-': '000000111000000',
};
function drawText(str, x, y, col) {
  for (let i = 0; i < str.length; i++) {
    const f = FONT[str[i]];
    if (!f) continue;
    for (let k = 0; k < 15; k++) if (f[k] === '1') {
      ctx.fillStyle = '#000'; ctx.fillRect(x + i * 4 + (k % 3) + 1, y + Math.floor(k / 3) + 1, 1, 1);
    }
    for (let k = 0; k < 15; k++) if (f[k] === '1') {
      ctx.fillStyle = col; ctx.fillRect(x + i * 4 + (k % 3), y + Math.floor(k / 3), 1, 1);
    }
  }
}

const HAND = { down: [6, -9], up: [-6, -10], right: [3, -9], left: [-3, -9] };
const IDLE_ANG = { down: 1.05, up: -2.1, right: 0.55, left: Math.PI - 0.55 };
function swordAngle(h) {
  if (h.swingT >= 0) {
    const t = clamp(h.swingT / CFG.hero.swingTime, 0, 1);
    return h.swingFrom - 1.7 + 3.4 * (1 - Math.pow(1 - t, 3));
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
    for (let r = 10; r <= 22; r++) ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function drawHeroEntity(h) {
  drawShadow(14, h.x, h.y);
  if (h.dead) {
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
  const fr = h.moving ? Math.floor(h.walkT * 9) % 4 : 0;
  let spr = SPR.hero[h.dir][fr];
  const bob = !h.moving && h.swingT < 0 && Math.floor(G.time * 2) % 2 === 1 ? 1 : 0;
  const a = swordAngle(h);
  const [sx, sy] = swordPivot(h);
  const behind = h.dir === 'up' || Math.sin(a) < -0.35;
  if (behind) drawSword(sx, sy + bob, a);
  if (h.hurtT > 0) spr = tinted(spr, '#ffffff');
  drawSprite(spr, h.x, h.y + bob, blink && h.hurtT <= 0 ? 0.45 : 1);
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
  if (e.state === 'windup' && Math.floor(G.time * 12) % 2 === 0) {
    px(e.x - 1, top - 4, '#ffe060', 2, 2);
    px(e.x - 1, top - 2, '#ff8020', 2, 1);
  }
  if (e.type !== 'clanrat' && e.hp < e.maxHp) hpBar(e.x, top - 3, e.type === 'ratogre' ? 24 : 14, e.hp / e.maxHp, '#d03030');
}
function hpBar(cx, y, w, f, col) {
  const x = Math.round(cx - w / 2);
  y = Math.round(y);
  px(x - 1, y - 1, '#000', w + 2, 4);
  px(x, y, '#2a0808', w, 2);
  px(x, y, col, Math.max(1, Math.round(w * f)), 2);
}

function drawProp(p) {
  const depleted = p.res && p.stock <= 0;
  const spr = depleted ? p.alt : p.spr;
  if (!depleted) drawShadow(p.shadow, p.x, p.y);
  const wob = p.wob > 0 ? (Math.floor(p.wob * 60) % 2 ? 1 : -1) : 0;
  drawSprite(spr, p.x + wob, p.y);
}

function drawSegment(s) {
  const y = WALL_BOT - 1;
  if (alive(s)) {
    let spr = s.spr;
    if (s.flash > 0) spr = tinted(spr, '#ffffff');
    ctx.drawImage(spr, s.x0 - PAD, y - spr.anchorY);
    const f = s.hp / s.max;
    const top = y - spr.anchorY + PAD;
    if (f < 0.7) {
      const n = f < 0.35 ? 6 : 3;
      ctx.fillStyle = '#1a1612';
      for (let k = 0; k < n; k++) for (const [cx, cy] of s.cracks[k]) ctx.fillRect(s.x0 + cx, top + cy, 1, 1);
    }
    if (s.kind === 'gate') {
      if (CREST.small) ctx.drawImage(CREST.small, Math.round(s.cx - 6), top - 9);
      drawTorch(s.x0 + 2, top + 2);
      drawTorch(s.x1 - 3, top + 2);
    }
    if (f < 1) hpBar(s.cx, top - 3, 16, f, '#c8b89a');
  } else if (s.rubble) {
    ctx.drawImage(s.rubbleSpr, s.x0 - PAD, y - s.rubbleSpr.anchorY);
  }
}

function drawTower(t) {
  if (!alive(t)) {
    if (t.rubble) ctx.drawImage(SPR.pebbles, Math.round(t.x - 7), Math.round(t.y - 5));
    return;
  }
  drawShadow(22, t.x, t.y);
  let spr = SPR.tower;
  if (t.flash > 0) spr = tinted(spr, '#ffffff');
  drawSprite(spr, t.x, t.y);
  const arch = SPR.archer[t.shotT > 0 ? 1 : 0];
  drawSprite(arch, t.x - 1, t.y - 18);
  const f = t.hp / t.max;
  if (f < 1) hpBar(t.x, t.y - 36, 16, f, '#c8b89a');
}

function drawTorch(x, y) {
  const f = Math.floor(G.time * 10 + x) % 3;
  px(x, y, '#2a1a0e', 1, 5);
  ctx.fillStyle = 'rgba(255,140,40,0.12)';
  for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
    if (dx * dx + dy * dy < 36 && ((dx + dy + f) & 2)) ctx.fillRect(x + dx, y - 3 + dy, 1, 1);
  }
  px(x - 1, y - 3, '#d04010', 3, 3);
  px(x, y - 4 - (f === 1 ? 1 : 0), '#f08020', 1, 2 + (f === 2 ? 1 : 0));
  px(x, y - 2, '#ffe080', 1, 1);
}

function drawArrow(a) {
  const ca = Math.cos(a.ang || 0), sa = Math.sin(a.ang || 0);
  for (let r = -4; r <= 0; r++) px(a.x + ca * r, a.y + sa * r, r === 0 ? '#d8d8e0' : '#6a4426');
  px(a.x - ca * 5, a.y - sa * 5, '#e8e0d0');
}

function drawBuildMarker() {
  if (G.state !== 'play') return;
  const s = UI.spot;
  if (!s) return;
  const pulse = Math.floor(G.time * 4) % 2;
  ctx.fillStyle = UI.spotOk ? (pulse ? '#e8d890' : '#b8923f') : (pulse ? '#d04040' : '#8a1f21');
  if (s.kind === 'tower') {
    for (let a = 0; a < 16; a++) {
      const an = a / 16 * Math.PI * 2 + G.time;
      ctx.fillRect(Math.round(s.x + Math.cos(an) * 10), Math.round(s.y - 1 + Math.sin(an) * 5), 1, 1);
    }
  } else {
    for (let x = s.x0 + 1; x < s.x1 - 1; x += 3) { ctx.fillRect(x, WALL_TOP - 4, 2, 1); ctx.fillRect(x, WALL_BOT + 1, 2, 1); }
  }
}

function render() {
  const sh = G.shake > 0 ? Math.round(rand(-G.shake, G.shake)) : 0;
  const sv = G.shake > 0 ? Math.round(rand(-G.shake, G.shake)) : 0;
  ctx.save();
  ctx.translate(sh, sv);
  ctx.drawImage(MAP.ground, 0, 0);
  ctx.drawImage(G.decals, 0, 0);
  drawBuildMarker();

  const list = [];
  for (const p of MAP.props) list.push({ y: p.y, f: () => drawProp(p) });
  for (const t of TOWERS) list.push({ y: t.y, f: () => drawTower(t) });
  for (const s of SEGS) list.push({ y: WALL_TOP + 7, f: () => drawSegment(s) });
  for (const e of G.enemies) list.push({ y: e.y, f: () => drawEnemy(e) });
  const h = G.hero;
  if (h) list.push({ y: h.y + (h.dead ? -6 : 0), f: () => drawHeroEntity(h) });
  list.sort((a, b) => a.y - b.y);
  for (const o of list) o.f();

  for (const a of G.arrows) drawArrow(a);
  for (const p of G.particles) {
    if (p.fade) ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    px(p.x, p.y - p.z, p.col, p.size, p.size);
    ctx.globalAlpha = 1;
  }
  for (const f of G.floaters) {
    const y = Math.round(f.y - f.t * 14);
    ctx.globalAlpha = clamp(1.4 - f.t * 1.4, 0, 1);
    const w = f.text.length * 4;
    const x = Math.round(f.x - (w + 9) / 2);
    drawText(f.text, x, y, f.icon === 'points' ? '#f0d070' : '#f0ead8');
    const ic = SPR.icon[f.icon];
    if (ic) ctx.drawImage(ic, x + w, y - 3);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawPreview() {
  const c = document.getElementById('preview');
  if (!c || !SPR.hero) return;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, c.width, c.height);
  const put = (s, x, baseY) => g.drawImage(s, x, baseY - s.anchorY);
  put(SPR.tower, 0, 36);
  put(SPR.archer[1], 6, 18);
  put(SPR.hero.right[0], 22, 36);
  put(SPR.clanrat.left[4], 58, 36);
  put(SPR.stormvermin.left[0], 76, 36);
  put(SPR.ratogre.left[0], 96, 36);
}

// ==========================================================================
// 12. UI
// ==========================================================================
const UI = {
  el: {}, cache: {}, bannerT: 0, toastT: 0, spot: null, spotOk: false,
  init() {
    const $ = id => document.getElementById(id);
    this.el = {
      wrap: $('wrap'), hud: $('hud'), stage: $('stage'), touch: $('touch'),
      hpFill: $('hp-fill'), hpNum: $('hp-num'), hpBar: $('hp-fill').parentElement,
      waveLbl: $('wave-lbl'), progFill: $('prog-fill'),
      kills: $('kills'), breached: $('breached'), cityFill: $('city-fill'), cityBar: $('city-fill').parentElement,
      stone: $('res-stone'), wood: $('res-wood'), points: $('res-points'),
      phase: $('phase'), next: $('btn-next'),
      banner: $('banner'), bTitle: $('banner-title'), bSub: $('banner-sub'),
      prompt: $('prompt'), toast: $('toast'), tBuild: $('t-build'),
      screens: { start: $('scr-start'), pause: $('scr-pause'), over: $('scr-over'), win: $('scr-win') },
    };
    // ikony zasobów w HUD
    for (const k of ['stone', 'wood', 'points']) {
      document.querySelectorAll(`img.ic-${k}`).forEach(img => { img.src = SPR.icon[k].toDataURL(); });
    }
    $('btn-start').addEventListener('click', () => Game.start());
    $('btn-restart').addEventListener('click', () => Game.start());
    $('btn-again').addEventListener('click', () => Game.start());
    $('btn-resume').addEventListener('click', () => Game.togglePause());
    this.el.next.addEventListener('click', () => { Input.nextPress = true; });
    document.querySelectorAll('.btn-sound').forEach(b => b.addEventListener('click', () => this.toggleSound(false)));
    try { Sfx.muted = localStorage.getItem('cd-muted') === '1'; } catch (err) { /* brak pamięci */ }
    this.syncSound();
    document.body.classList.toggle('touch', Input.isTouch);
    document.querySelectorAll('.only-keys').forEach(el => el.hidden = Input.isTouch);
    document.querySelectorAll('.only-touch').forEach(el => el.hidden = !Input.isTouch);
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
  },
  resize() {
    const e = this.el;
    const avW = window.innerWidth, avH = window.innerHeight;
    const portrait = avH > avW;
    const touch = Input.isTouch;
    e.wrap.classList.toggle('portrait', touch && portrait);
    e.wrap.classList.toggle('landscape', touch && !portrait);
    let s = avW / W;
    for (let it = 0; it < 3; it++) {
      e.wrap.style.setProperty('--u', s + 'px');
      e.wrap.style.width = W * s + 'px';
      const hudH = e.hud.offsetHeight;
      const touchH = touch && portrait ? e.touch.offsetHeight : 0;
      const sideW = touch && !portrait ? 2 * 128 : 0;   // miejsce na joystick i przyciski po bokach
      s = Math.min((avW - sideW) / W, (avH - hudH - touchH - 8) / H);
      if (s >= 2) s = Math.floor(s * 2) / 2;
      s = Math.max(s, 0.6);
    }
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
    this.set('wave', e.waveLbl, 'textContent', `Fala ${Math.max(1, G.phase === 'build' ? G.wave + 1 : G.wave)}/${WAVES.length}`);
    const prog = G.waveTotal ? G.waveDone / G.waveTotal * 100 : 0;
    this.set('prog', e.progFill.style, 'width', prog + '%');
    this.set('kills', e.kills, 'textContent', String(G.kills));
    this.set('br', e.breached, 'textContent', String(G.breached));
    const cp = G.cityHP / CFG.cityHP * 100;
    this.set('city', e.cityFill.style, 'width', cp + '%');
    this.set('citylow', e.cityBar, 'className', cp <= 30 ? 'bar city low' : 'bar city');
    this.set('rs', e.stone, 'textContent', String(G.res.stone));
    this.set('rw', e.wood, 'textContent', String(G.res.wood));
    this.set('rp', e.points, 'textContent', String(G.res.points));
    const building = G.phase === 'build' && G.state !== 'menu';
    const ph = building ? `Przygotowanie ${Math.ceil(G.phaseT)} s`
      : G.phase === 'pre' || G.phase === 'fight' ? `Wrogów: ${Math.max(0, G.waveTotal - G.waveDone)}` : '';
    this.set('phase', e.phase, 'textContent', ph);
    this.set('next', e.next, 'hidden', !building);

    // podpowiedź budowy
    const spot = G.state === 'play' ? findBuildSpot() : null;
    const act = spot ? structureCost(spot) : null;
    this.spot = act ? spot : null;
    if (this.spot) {
      const blocked = spotBlocked(spot);
      const afford = canAfford(act.cost);
      this.spotOk = afford && !blocked;
      const name = NAMES[spot.kind];
      const verb = act.act === 'build' ? 'Zbuduj' : 'Napraw';
      const costHtml = Object.keys(act.cost).map(k =>
        `<span class="${(G.res[k] || 0) < act.cost[k] ? 'lack' : ''}">${act.cost[k]}<img src="${SPR.icon[k].toDataURL()}" alt=""></span>`).join(' ');
      const key = Input.isTouch ? '' : '<kbd>E</kbd>';
      const html = blocked ? `<b>${verb} ${name}</b><span class="lack">wróg na miejscu budowy</span>`
        : `<b>${verb} ${name}</b>${costHtml}${key}`;
      const tag = spot.kind + (spot.i ?? spot.x) + html;
      if (this.cache.promptTag !== tag) { this.cache.promptTag = tag; e.prompt.innerHTML = html; }
      const px = spot.kind === 'tower' ? spot.x : spot.cx;
      const py = spot.kind === 'tower' ? Math.min(spot.y - 36, G.hero.y - 30) : G.hero.y - 30;
      e.prompt.style.left = clamp(px / W * 100, 14, 86) + '%';
      e.prompt.style.top = py / H * 100 + '%';
      e.prompt.classList.toggle('bad', !this.spotOk);
      e.prompt.classList.add('show');
    } else {
      e.prompt.classList.remove('show');
    }
    if (e.tBuild) {
      e.tBuild.classList.toggle('ready', !!this.spot && this.spotOk);
      e.tBuild.textContent = this.spot && structureCost(this.spot).act === 'repair' ? 'Napraw' : 'Buduj';
    }

    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) e.banner.classList.remove('show'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) e.toast.classList.remove('show'); }
  },
  banner(title, sub, dur, red) {
    const e = this.el;
    e.bTitle.textContent = title;
    e.bTitle.className = red ? 'red' : '';
    e.bSub.textContent = sub || '';
    e.banner.classList.add('show');
    this.bannerT = dur;
  },
  toast(text) {
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastT = 1.8;
  },
  promptShake() {
    const p = this.el.prompt;
    p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake');
  },
  toggleSound(showBanner) {
    Sfx.muted = !Sfx.muted;
    try { localStorage.setItem('cd-muted', Sfx.muted ? '1' : '0'); } catch (err) { /* ignoruj */ }
    this.syncSound();
    if (showBanner && G.state === 'play') this.toast(Sfx.muted ? 'Dźwięk wyłączony' : 'Dźwięk włączony');
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
    if (name) { this.el.banner.classList.remove('show'); this.el.prompt.classList.remove('show'); this.el.toast.classList.remove('show'); this.toastT = 0; }
    const btn = name && this.el.screens[name].querySelector('button');
    if (btn && !Input.isTouch) setTimeout(() => btn.focus(), 50);
  },
  gameOver() {
    document.getElementById('over-title').textContent = G.endReason === 'city' ? 'Skaveni w mieście' : 'Gwardzista poległ';
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
// 13. LOOP
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
  initStructures();
  MAP.ground = buildGround();
  placeProps();
  G.decals = makeCanvas(W, H);
  G.decalCtx = G.decals.getContext('2d');
  Input.init(canvas);
  UI.init();
  Game.reset();
  drawPreview();
  loadCrest();
  UI.showScreen('start');
  lastT = performance.now();
  requestAnimationFrame(frame);
}

// Uchwyt do debugowania / testów
window.CD = { G, CFG, WAVES, SEGS, TOWERS, MAP, Game, Input, tick, render, findBuildSpot, structureCost, canAfford, alive, PATHS };

window.addEventListener('DOMContentLoaded', boot);
