/* ============================================================
   REVERIE® — motion engine
   Custom smooth scroll · scroll-driven day→night sky · pins ·
   parallax · starfield · custom cursor · zero dependencies.
   ============================================================ */
(() => {
'use strict';

/* ---------- environment flags ---------- */
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LERP = REDUCED ? 1 : (FINE ? 0.085 : 0.14);

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

const html = document.documentElement;
const body = document.body;

history.scrollRestoration = 'manual';
html.classList.add('lock');
if (FINE) body.classList.add('fine');
if (new URLSearchParams(location.search).has('bare')) html.classList.add('bare');
/* ?p=0..1 — jump the journey to a fixed point (debug / deep-linking a moment) */
const FORCE_P = (() => {
  const v = parseFloat(new URLSearchParams(location.search).get('p'));
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : -1;
})();
const DEBUG = new URLSearchParams(location.search).has('debug');
window.scrollTo(0, 0);

/* ---------- state ---------- */
const S = {
  cur: 0, tgt: 0, vel: 0, p: 0, max: 1,
  vw: html.clientWidth, vh: html.clientHeight,
  mouse: { x: 0, y: 0 },        // normalized -0.5..0.5
  mouseL: { x: 0, y: 0 },       // lazy-lerped (dreamy layers)
  cx: innerWidth / 2, cy: innerHeight / 2, // cursor px
  night: 0, day: 1, dusk: 0,
  scrolled: false,
  t: 0, dt: 16,
};

/* ---------- utils ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const mod = (n, m) => ((n % m) + m) % m;

/* ============================================================
   SPLIT TEXT
   ============================================================ */
function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  let i = 0;
  const words = text.split(' ');
  words.forEach((word, wi) => {
    const w = document.createElement('span');
    w.className = 'word';
    w.setAttribute('aria-hidden', 'true');
    for (const ch of word) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i++);
      s.textContent = ch;
      w.appendChild(s);
    }
    el.appendChild(w);
    if (wi < words.length - 1) { el.appendChild(document.createTextNode(' ')); i++; }
  });
}
$$('[data-split]').forEach(splitChars);

function splitWords(el) {
  const out = [];
  const nodes = [...el.childNodes];
  el.textContent = '';
  nodes.forEach(node => {
    const italic = node.nodeType === 1;
    const words = node.textContent.trim().split(/\s+/).filter(Boolean);
    words.forEach(w => {
      const s = document.createElement('span');
      s.className = 'mword' + (italic ? ' it' : '');
      s.textContent = w;
      el.appendChild(s);
      el.appendChild(document.createTextNode(' '));
      out.push(s);
    });
  });
  return out;
}
const maniWords = splitWords($('#mani'));
const maniLast = new Array(maniWords.length).fill(-1);

/* ============================================================
   SKY — keyframed day→night gradient + ink color
   ============================================================ */
const SKY = [
  { p: 0.00, top: [143, 123, 216], mid: [242, 168, 192], bot: [255, 217, 173], ink: [36, 26, 68] },
  { p: 0.18, top: [127, 180, 232], mid: [183, 227, 228], bot: [253, 243, 218], ink: [30, 42, 74] },
  { p: 0.36, top: [106, 162, 238], mid: [168, 200, 240], bot: [255, 233, 196], ink: [35, 32, 66] },
  { p: 0.50, top: [95, 116, 200],  mid: [212, 148, 184], bot: [255, 190, 126], ink: [42, 31, 77] },
  { p: 0.63, top: [55, 42, 120],   mid: [142, 77, 150],  bot: [232, 130, 95],  ink: [253, 243, 231] },
  { p: 0.80, top: [18, 16, 47],    mid: [43, 32, 88],    bot: [80, 52, 104],   ink: [240, 236, 255] },
  { p: 1.00, top: [6, 5, 18],      mid: [18, 14, 44],    bot: [34, 24, 68],    ink: [238, 233, 255] },
];
const mixRGB = (a, b, t) => [
  Math.round(lerp(a[0], b[0], t)),
  Math.round(lerp(a[1], b[1], t)),
  Math.round(lerp(a[2], b[2], t)),
];
function sampleSky(p) {
  let i = 0;
  while (i < SKY.length - 2 && p > SKY[i + 1].p) i++;
  const a = SKY[i], b = SKY[i + 1];
  const t = clamp((p - a.p) / (b.p - a.p), 0, 1);
  return {
    top: mixRGB(a.top, b.top, t),
    mid: mixRGB(a.mid, b.mid, t),
    bot: mixRGB(a.bot, b.bot, t),
    ink: mixRGB(a.ink, b.ink, t),
  };
}

/* dream clock — scroll position → time of day */
const CLOCK_H = [5.783, 8.75, 12, 16.5, 19.4, 22.5, 24];
const CLOCK_L = ['dawn', 'morning', 'high noon', 'golden hour', 'dusk', 'night'];
function sampleClock(p) {
  let i = 0;
  while (i < SKY.length - 2 && p > SKY[i + 1].p) i++;
  const t = clamp((p - SKY[i].p) / (SKY[i + 1].p - SKY[i].p), 0, 1);
  const h = lerp(CLOCK_H[i], CLOCK_H[i + 1], t);
  const hh = Math.floor(h) % 24, mm = Math.floor((h % 1) * 60);
  const label = p >= 0.985 ? 'midnight' : CLOCK_L[i];
  return { time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, label };
}

/* ============================================================
   DOM refs
   ============================================================ */
const world = $('#world');
const spacer = $('#spacer');
const sky = $('#sky');
const sun = $('#sun');
const moon = $('#moon');
const bar = $('#bar');
const clockTime = $('#clockTime');
const clockLabel = $('#clockLabel');
const auroras = $$('.aurora');
const track = $('#track');
const galBar = $('#galBar');
const galSec = $('#dreams');
const scenes = $$('#track .scene');
const sceneData = scenes.map(sc => ({ sc, card: sc.closest('.dream'), left: 0, w: 0 }));
const heroLayers = $$('.orb-wrap').map(el => ({ el, d: parseFloat(el.dataset.depth) || 1 }));

/* parallax elements */
const paraEls = $$('[data-speed]').map(el => ({ el, speed: parseFloat(el.dataset.speed) || 1, top: 0, h: 0 }));

/* pins */
const pins = $$('[data-pin]').map(sec => ({
  sec,
  stick: $('.pin-stick', sec),
  type: sec.hasAttribute('data-gallery') ? 'gallery' : 'mani',
  top: 0, len: 1, lastY: null,
}));

/* clouds */
function buildClouds() {
  const defs = [
    { layer: '#cloudsFar', x: 8,  y: 22, w: 34, sp: 0.10, drift: 26, op: 0.55 },
    { layer: '#cloudsFar', x: 62, y: 60, w: 28, sp: 0.12, drift: 34, op: 0.5 },
    { layer: '#cloudsMid', x: 30, y: 38, w: 26, sp: 0.20, drift: 30, op: 0.75 },
    { layer: '#cloudsMid', x: 74, y: 14, w: 22, sp: 0.24, drift: 40, op: 0.7 },
    { layer: '#cloudsMid', x: 4,  y: 78, w: 24, sp: 0.22, drift: 24, op: 0.7 },
    { layer: '#cloudsNear', x: 48, y: 88, w: 44, sp: 0.42, drift: 46, op: 0.32 },
    { layer: '#cloudsNear', x: -6, y: 30, w: 38, sp: 0.38, drift: 38, op: 0.3 },
  ];
  return defs.map((d, i) => {
    const el = document.createElement('i');
    el.className = 'cloud';
    el.style.setProperty('--w', d.w + 'vw');
    $(d.layer).appendChild(el);
    return { ...d, el, phase: i * 1.7 };
  });
}
const clouds = buildClouds();
const cloudLayers = [
  { el: $('#cloudsFar'), depth: 10, base: 1 },
  { el: $('#cloudsMid'), depth: 22, base: 1 },
  { el: $('#cloudsNear'), depth: 40, base: 1 },
];

/* ============================================================
   MEASURE — cache static offsets (transform-neutralized)
   ============================================================ */
let galDist = 0;
function measure() {
  S.vw = html.clientWidth; S.vh = html.clientHeight;

  pins.forEach(p => { p.stick.style.transform = ''; p.lastY = null; p.lastLp = null; });
  paraEls.forEach(o => o.el.style.transform = '');
  if (track) track.style.transform = '';

  // gallery section height depends on track width — set before reading offsets
  if (track && galSec) {
    galDist = Math.max(0, track.scrollWidth - S.vw);
    galSec.style.height = (S.vh + galDist) + 'px';
  }

  const staticTop = el => el.getBoundingClientRect().top + S.cur;
  pins.forEach(p => {
    p.top = staticTop(p.sec);
    p.len = Math.max(1, p.sec.offsetHeight - S.vh);
  });
  paraEls.forEach(o => {
    const r = o.el.getBoundingClientRect();
    o.top = r.top + S.cur;
    o.h = r.height;
  });
  sceneData.forEach(o => { o.left = o.card.offsetLeft; o.w = o.card.offsetWidth; });

  const worldH = world.offsetHeight;
  spacer.style.height = worldH + 'px';
  S.max = Math.max(1, worldH - S.vh);

  sizeCanvas(starsCv, starsCtx);
  sizeCanvas(fxCv, fxCtx);
}

/* ============================================================
   CANVASES
   ============================================================ */
const DPR = Math.min(devicePixelRatio || 1, 1.5);
const starsCv = $('#stars'), starsCtx = starsCv.getContext('2d');
const fxCv = $('#fx'), fxCtx = fxCv.getContext('2d');

function sizeCanvas(cv, ctx) {
  cv.width = Math.round(S.vw * DPR);
  cv.height = Math.round(S.vh * DPR);
  cv.style.width = S.vw + 'px';
  cv.style.height = S.vh + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

/* soft glow sprite for stars */
function makeGlow(size, color) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.4, color.replace(/[\d.]+\)$/, '0.35)'));
  grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}
const glowWhite = makeGlow(48, 'rgba(255,255,255,1)');
const glowWarm = makeGlow(48, 'rgba(255,214,160,1)');

/* starfield */
const STARS = [];
(function buildStars() {
  const n = clamp(Math.round((innerWidth * innerHeight) / 9000), 110, 230);
  for (let i = 0; i < n; i++) {
    STARS.push({
      x: Math.random(), y: Math.random(),
      r: 0.4 + Math.random() * 1.5,
      ph: Math.random() * Math.PI * 2,
      sp: 0.5 + Math.random() * 1.6,
      d: 0.2 + Math.random() * 0.8,
      warm: Math.random() < 0.12,
    });
  }
})();

/* drifting motes (day) / fireflies (dusk) */
const MOTES = [];
(function buildMotes() {
  for (let i = 0; i < 34; i++) {
    MOTES.push({
      x: Math.random(), y: Math.random(),
      vy: 4 + Math.random() * 12,
      ph: Math.random() * Math.PI * 2,
      r: 1 + Math.random() * 1.8,
    });
  }
})();

let shoot = null, nextShoot = 4000, shotOnce = false;

function drawStars() {
  const W = S.vw, H = S.vh, night = S.night;
  starsCtx.clearRect(0, 0, W, H);

  /* motes / fireflies */
  const moteA = 0.16 * S.day + 0.05;
  if (moteA > 0.02) {
    for (const m of MOTES) {
      const mx = mod(m.x * W + Math.sin(S.t * 0.0004 + m.ph) * 30, W);
      const my = mod(m.y * H - S.t * 0.001 * m.vy, H);
      const tw = 0.5 + 0.5 * Math.sin(S.t * 0.002 + m.ph);
      starsCtx.globalAlpha = moteA * tw;
      starsCtx.drawImage(S.dusk > 0.25 ? glowWarm : glowWhite, mx - m.r * 3, my - m.r * 3, m.r * 6, m.r * 6);
    }
  }

  if (night > 0.005) {
    /* stars */
    for (const st of STARS) {
      const x = st.x * W + S.mouseL.x * st.d * 26;
      const y = mod(st.y * H + S.cur * 0.045 * st.d, H);
      const tw = 0.45 + 0.55 * Math.sin(S.t * 0.0016 * st.sp + st.ph);
      starsCtx.globalAlpha = night * tw;
      const s = st.r * 6;
      starsCtx.drawImage(st.warm ? glowWarm : glowWhite, x - s / 2, y - s / 2, s, s);
    }

    /* constellation lines near cursor */
    if (FINE && night > 0.5) {
      starsCtx.lineWidth = 1;
      let links = 0;
      for (const st of STARS) {
        if (links >= 9) break;
        const x = st.x * W + S.mouseL.x * st.d * 26;
        const y = mod(st.y * H + S.cur * 0.045 * st.d, H);
        const dx = x - S.cx, dy = y - S.cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          starsCtx.globalAlpha = (1 - dist / 150) * 0.4 * night;
          starsCtx.strokeStyle = '#cfd6ff';
          starsCtx.beginPath();
          starsCtx.moveTo(S.cx, S.cy);
          starsCtx.lineTo(x, y);
          starsCtx.stroke();
          links++;
        }
      }
    }

    /* shooting star */
    if (!REDUCED) {
      if (!shoot && night > 0.45 && (S.t > nextShoot || !shotOnce)) {
        shotOnce = true;
        shoot = {
          x: W * (0.25 + Math.random() * 0.65),
          y: H * (0.05 + Math.random() * 0.3),
          vx: -(340 + Math.random() * 220),
          vy: 150 + Math.random() * 110,
          life: 0,
        };
        nextShoot = S.t + 3800 + Math.random() * 4800;
      }
      if (shoot) {
        shoot.life += S.dt / 900;
        shoot.x += shoot.vx * S.dt / 1000;
        shoot.y += shoot.vy * S.dt / 1000;
        const a = (1 - shoot.life) * night;
        if (a > 0) {
          const tail = 0.22;
          const tx = shoot.x - shoot.vx * tail, ty = shoot.y - shoot.vy * tail;
          const g = starsCtx.createLinearGradient(shoot.x, shoot.y, tx, ty);
          g.addColorStop(0, `rgba(255,255,255,${0.9 * a})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          starsCtx.globalAlpha = 1;
          starsCtx.strokeStyle = g;
          starsCtx.lineWidth = 2;
          starsCtx.lineCap = 'round';
          starsCtx.beginPath();
          starsCtx.moveTo(shoot.x, shoot.y);
          starsCtx.lineTo(tx, ty);
          starsCtx.stroke();
          starsCtx.globalAlpha = a;
          starsCtx.drawImage(glowWhite, shoot.x - 7, shoot.y - 7, 14, 14);
        }
        if (shoot.life >= 1) shoot = null;
      }
    }
  }
  starsCtx.globalAlpha = 1;
}

/* fx canvas — click bursts + stardust trail (above content) */
const FX = [];
let fxDirty = false;
function burst(x, y, n = 13) {
  if (REDUCED) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 60 + Math.random() * 240;
    FX.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
      life: 0, dur: 0.7 + Math.random() * 0.5,
      r: 1.5 + Math.random() * 2.5,
      star: Math.random() < 0.4,
      rot: Math.random() * Math.PI,
      hue: Math.random() < 0.5 ? '255,141,100' : (Math.random() < 0.5 ? '154,108,255' : '255,255,255'),
    });
  }
}
function dust(x, y) {
  FX.push({
    x, y,
    vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40,
    life: 0, dur: 0.55 + Math.random() * 0.3,
    r: 1 + Math.random() * 1.4,
    star: true, rot: Math.random() * Math.PI,
    hue: '255,255,255',
  });
}
function drawFx() {
  if (!FX.length) {
    if (fxDirty) { fxCtx.clearRect(0, 0, S.vw, S.vh); fxDirty = false; }
    return;
  }
  fxDirty = true;
  fxCtx.clearRect(0, 0, S.vw, S.vh);
  const dts = S.dt / 1000;
  for (let i = FX.length - 1; i >= 0; i--) {
    const pt = FX[i];
    pt.life += dts / pt.dur;
    if (pt.life >= 1) { FX.splice(i, 1); continue; }
    pt.vy += 220 * dts;
    pt.vx *= 0.985;
    pt.x += pt.vx * dts;
    pt.y += pt.vy * dts;
    const a = 1 - pt.life;
    if (pt.star) {
      fxCtx.save();
      fxCtx.translate(pt.x, pt.y);
      fxCtx.rotate(pt.rot + pt.life * 2);
      fxCtx.globalAlpha = a;
      fxCtx.fillStyle = `rgba(${pt.hue},1)`;
      fxCtx.font = `${pt.r * 6}px serif`;
      fxCtx.textAlign = 'center';
      fxCtx.textBaseline = 'middle';
      fxCtx.fillText('✦', 0, 0);
      fxCtx.restore();
    } else {
      fxCtx.globalAlpha = a;
      fxCtx.fillStyle = `rgba(${pt.hue},1)`;
      fxCtx.beginPath();
      fxCtx.arc(pt.x, pt.y, pt.r * a + 0.4, 0, Math.PI * 2);
      fxCtx.fill();
    }
  }
  fxCtx.globalAlpha = 1;
}

/* ============================================================
   FRAME UPDATERS
   ============================================================ */
let lastSkyP = -1;
function updateSky() {
  if (Math.abs(S.p - lastSkyP) < 0.0004 && lastSkyP >= 0) return;
  lastSkyP = S.p;
  const c = sampleSky(S.p);
  sky.style.background =
    `linear-gradient(180deg, rgb(${c.top}) 0%, rgb(${c.mid}) 52%, rgb(${c.bot}) 100%)`;
  html.style.setProperty('--ink', c.ink.join(','));
  html.style.setProperty('--paper', c.top.join(','));

  const ck = sampleClock(S.p);
  if (clockTime.textContent !== ck.time) {
    clockTime.textContent = ck.time;
    clockLabel.textContent = ck.label;
  }
}

function updateCelestial() {
  const p = S.p;
  /* sun: rises, arcs, sets by dusk */
  const sp = clamp(p / 0.55, 0, 1);
  const sunOp = 1 - smooth(0.48, 0.58, p);
  const sx = (0.12 + sp * 0.7) * S.vw;
  const sy = (0.82 - Math.sin(sp * Math.PI) * 0.58) * S.vh;
  sun.style.opacity = sunOp.toFixed(3);
  sun.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;

  /* moon: rises after dusk */
  const mo = smooth(0.58, 0.7, p);
  const mp = smooth(0.58, 0.98, p);
  const mx = (0.8 - mp * 0.08 + S.mouseL.x * 0.012) * S.vw;
  const my = (0.75 - mp * 0.52) * S.vh;
  moon.style.opacity = mo.toFixed(3);
  moon.style.transform = `translate3d(${mx}px, ${my}px, 0) rotate(${mp * 14}deg)`;

  /* auroras */
  const au = smooth(0.7, 0.88, p);
  auroras[0].style.opacity = (au * 0.9).toFixed(3);
  auroras[1].style.opacity = (au * 0.7).toFixed(3);
}

function updateClouds() {
  const cycle = S.vh + 420;
  for (const lay of cloudLayers) {
    lay.el.style.transform =
      `translate3d(${S.mouseL.x * lay.depth}px, ${S.mouseL.y * lay.depth * 0.6}px, 0)`;
    const op = S.day;
    if (lay.lastOp !== op) {
      lay.el.style.opacity = op.toFixed(3);
      lay.lastOp = op;
    }
  }
  for (const c of clouds) {
    const x = (c.x / 100) * S.vw + Math.sin(S.t * 0.00018 + c.phase) * c.drift;
    const y = mod((c.y / 100) * S.vh - S.cur * c.sp, cycle) - 210;
    c.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (c.lastOp !== c.op) { c.el.style.opacity = c.op; c.lastOp = c.op; }
  }
}

function updatePins() {
  for (const pin of pins) {
    const raw = (S.cur - pin.top) / pin.len;
    const y = clamp(S.cur - pin.top, 0, pin.len);
    if (pin.lastY !== y) {
      pin.stick.style.transform = `translate3d(0, ${y}px, 0)`;
      pin.lastY = y;
    }
    /* paint the clamped state; when parked out of range, paint it once
       so the inner transforms never freeze mid-way (e.g. after a re-measure) */
    const lp = clamp(raw, 0, 1);
    const parked = raw < -0.05 || raw > 1.05;
    if (parked && pin.lastLp === lp) continue;
    pin.lastLp = lp;
    if (pin.type === 'gallery') updateGallery(lp, parked);
    else updateMani(lp);
  }
}

function updateMani(lp) {
  const N = maniWords.length;
  const t = REDUCED ? 1 : lp / 0.82;
  for (let k = 0; k < N; k++) {
    const e = clamp(t * (N + 3) - k, 0, 1);
    if (Math.abs(e - maniLast[k]) < 0.01) continue;
    maniLast[k] = e;
    const st = maniWords[k].style;
    st.opacity = (0.1 + 0.9 * e).toFixed(3);
    st.transform = e >= 1 ? '' : `translate3d(0, ${((1 - e) * 12).toFixed(1)}px, 0)`;
    st.filter = e >= 1 ? '' : `blur(${((1 - e) * 5).toFixed(1)}px)`;
  }
}

function updateGallery(lp, parked) {
  const x = -lp * galDist;
  const skew = (REDUCED || parked) ? 0 : clamp(-S.vel * 0.045, -4, 4);
  track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
  galBar.style.transform = `scaleX(${lp.toFixed(4)})`;
  /* inner parallax per card */
  for (const o of sceneData) {
    const center = o.left + x + o.w / 2 - S.vw / 2;
    o.sc.style.transform = `translate3d(${clamp(-center * 0.06, -46, 46).toFixed(1)}px, 0, 0)`;
  }
}

function updateParallax() {
  if (REDUCED) return;
  for (const o of paraEls) {
    const inView = S.cur + S.vh > o.top - S.vh && S.cur < o.top + o.h + S.vh;
    if (!inView) continue;
    const shift = (S.cur + S.vh / 2 - (o.top + o.h / 2)) * (1 - o.speed);
    o.el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
  }
  for (const l of heroLayers) {
    l.el.style.transform =
      `translate3d(${(S.mouseL.x * l.d * 42).toFixed(1)}px, ${(S.mouseL.y * l.d * 30).toFixed(1)}px, 0)`;
  }
}

/* ---------- cursor ---------- */
const cursor = { rx: S.cx, ry: S.cy, dx: S.cx, dy: S.cy, scale: 1, tScale: 1, label: '' };
const cDot = $('.c-dot'), cRing = $('.c-ring'), cLabel = $('.c-label');
function updateCursor() {
  if (!FINE) return;
  cursor.dx = lerp(cursor.dx, S.cx, 0.6);
  cursor.dy = lerp(cursor.dy, S.cy, 0.6);
  cursor.rx = lerp(cursor.rx, S.cx, 0.17);
  cursor.ry = lerp(cursor.ry, S.cy, 0.17);
  cursor.scale = lerp(cursor.scale, cursor.tScale, 0.2);
  cDot.style.transform = `translate3d(${cursor.dx - 3}px, ${cursor.dy - 3}px, 0)`;
  cRing.style.transform = `translate3d(${cursor.rx - 19}px, ${cursor.ry - 19}px, 0) scale(${cursor.scale.toFixed(3)})`;
  cLabel.style.transform = `translate3d(${cursor.rx + 16}px, ${cursor.ry + 18}px, 0)`;
}

/* ---------- services peek ---------- */
const peek = { el: $('#peek'), x: 0, y: 0, tx: 0, ty: 0, on: false, rot: 0 };
function updatePeek() {
  if (!FINE || !peek.el) return;
  const px = peek.x, opTarget = peek.on ? 1 : 0;
  peek.x = lerp(peek.x, peek.tx, 0.14);
  peek.y = lerp(peek.y, peek.ty, 0.14);
  peek.rot = clamp((peek.x - px) * 0.7, -12, 12);
  peek.op = lerp(peek.op || 0, opTarget, 0.16);
  peek.el.style.opacity = peek.op.toFixed(3);
  if (peek.op > 0.005) {
    peek.el.style.transform =
      `translate3d(${peek.x - 125}px, ${peek.y - 165}px, 0) rotate(${peek.rot.toFixed(2)}deg)`;
  }
}

/* ============================================================
   MASTER LOOP
   ============================================================ */
let lastT = 0;
function frame(t) {
  S.dt = clamp(t - lastT || 16, 8, 50);
  lastT = t;
  S.t = t;

  /* self-heal if the viewport changed without a resize event (devtools, zoom, headless) */
  if (html.clientHeight !== S.vh || html.clientWidth !== S.vw) measure();

  S.tgt = FORCE_P >= 0 ? FORCE_P * S.max : (window.scrollY || document.documentElement.scrollTop || 0);
  const prev = S.cur;
  S.cur = (FORCE_P >= 0 || Math.abs(S.tgt - S.cur) < 0.05) ? S.tgt : lerp(S.cur, S.tgt, LERP);
  S.vel = S.cur - prev;
  S.p = clamp(S.cur / S.max, 0, 1);

  S.mouseL.x = lerp(S.mouseL.x, S.mouse.x, 0.05);
  S.mouseL.y = lerp(S.mouseL.y, S.mouse.y, 0.05);

  S.night = smooth(0.5, 0.78, S.p);
  S.day = 1 - smooth(0.42, 0.68, S.p);
  S.dusk = smooth(0.4, 0.55, S.p) * (1 - smooth(0.62, 0.78, S.p));

  world.style.transform = `translate3d(0, ${-S.cur.toFixed(2)}px, 0)`;
  bar.style.transform = `scaleX(${S.p.toFixed(4)})`;

  if (!S.scrolled && S.cur > 60) { S.scrolled = true; body.classList.add('scrolled'); }
  else if (S.scrolled && S.cur <= 60) { S.scrolled = false; body.classList.remove('scrolled'); }

  updateSky();
  updateCelestial();
  updateClouds();
  updatePins();
  updateParallax();
  updateCursor();
  updatePeek();
  drawStars();
  drawFx();
  if (DEBUG) updateDebug();

  requestAnimationFrame(frame);
}

let dbgEl = null;
function updateDebug() {
  if (!dbgEl) {
    dbgEl = document.createElement('pre');
    dbgEl.style.cssText = 'position:fixed;left:8px;top:60px;z-index:99;background:#000d;color:#0f0;font:13px/1.5 monospace;padding:10px;pointer-events:none;';
    document.body.appendChild(dbgEl);
  }
  const g = pins.find(p => p.type === 'gallery');
  const r = g.stick.getBoundingClientRect();
  dbgEl.textContent =
    `cur ${S.cur.toFixed(0)}  max ${S.max}  p ${S.p.toFixed(3)}\n` +
    `pin.top ${g.top.toFixed(0)}  len ${g.len.toFixed(0)}  raw ${((S.cur - g.top) / g.len).toFixed(3)}\n` +
    `stickRect.top ${r.top.toFixed(1)}  rect.h ${r.height.toFixed(1)}\n` +
    `stickTf ${g.stick.style.transform}\n` +
    `trackTf ${track.style.transform.slice(0, 48)}\n` +
    `secH ${galSec.offsetHeight}  trackW ${track.scrollWidth}  galDist ${galDist}  vh ${S.vh}  worldTf ${world.style.transform}`;
}

/* ============================================================
   REVEALS + COUNTERS (IntersectionObserver)
   ============================================================ */
$$('[data-reveal]').forEach(el => {
  if (el.dataset.d) el.style.setProperty('--rd', el.dataset.d);
});
const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    en.target.classList.add('in');
    if (en.target.matches('[data-split]')) {
      setTimeout(() => en.target.classList.add('settled'), 1900);
    }
    io.unobserve(en.target);
  }
}, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });

$$('[data-reveal]').forEach(el => io.observe(el));
$$('[data-split]').forEach(el => { if (!el.closest('#hero')) io.observe(el); });

/* counters */
const easeOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
function runCounter(el) {
  const raw = el.dataset.count;
  const from = parseFloat(el.dataset.from || 0);
  if (raw === 'inf') {
    const seq = [1, 2, 4, 7, 12, 29, 58, 97];
    let i = 0;
    const iv = setInterval(() => {
      if (i >= seq.length) { el.textContent = '∞'; clearInterval(iv); return; }
      el.textContent = seq[i++];
    }, 130);
    return;
  }
  const to = parseFloat(raw);
  const start = performance.now(), dur = 1500;
  (function tick(now) {
    const t = clamp((now - start) / dur, 0, 1);
    el.textContent = Math.round(lerp(from, to, easeOutExpo(t)));
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}
const ioCount = new IntersectionObserver(entries => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    runCounter(en.target);
    ioCount.unobserve(en.target);
  }
}, { threshold: 0.6 });
$$('.counter').forEach(el => ioCount.observe(el));

/* ============================================================
   INTERACTIONS
   ============================================================ */
/* pointer tracking */
addEventListener('pointermove', e => {
  S.cx = e.clientX; S.cy = e.clientY;
  S.mouse.x = e.clientX / S.vw - 0.5;
  S.mouse.y = e.clientY / S.vh - 0.5;
  if (FINE && !REDUCED && Math.random() < 0.06 && (Math.abs(e.movementX) + Math.abs(e.movementY)) > 18) {
    dust(e.clientX, e.clientY);
  }
}, { passive: true });
document.addEventListener('mouseleave', () => { S.mouse.x = 0; S.mouse.y = 0; });

/* cursor modes */
if (FINE) {
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-cursor]');
    if (t) {
      cursor.tScale = 1.55;
      body.classList.toggle('c-view', t.dataset.cursor === 'view');
      cLabel.textContent = t.dataset.cursor === 'view' ? 'view' : '';
    } else {
      cursor.tScale = 1;
      body.classList.remove('c-view');
    }
  });
  addEventListener('pointerdown', () => { cursor.tScale = 0.7; });
  addEventListener('pointerup', () => { cursor.tScale = body.classList.contains('c-view') ? 1.55 : 1; });
}

/* click sparkles */
addEventListener('pointerdown', e => burst(e.clientX, e.clientY), { passive: true });

/* magnetic buttons */
if (FINE && !REDUCED) {
  $$('.magnetic').forEach(btn => {
    const txt = $('.btn-txt', btn);
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${dx * 0.28}px, ${dy * 0.34}px)`;
      if (txt) txt.style.transform = `translate(${dx * 0.14}px, ${dy * 0.18}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      if (txt) txt.style.transform = '';
    });
  });
}

/* 3D tilt cards */
if (FINE && !REDUCED) {
  $$('.tilt').forEach(card => {
    const inner = $('.dream-inner', card);
    const glare = $('.glare', card);
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      inner.style.transform = `rotateY(${px * 10}deg) rotateX(${-py * 9}deg)`;
      if (glare) glare.style.background =
        `radial-gradient(circle at ${(px + 0.5) * 100}% ${(py + 0.5) * 100}%, rgba(255,255,255,.22), transparent 55%)`;
    });
    card.addEventListener('mouseleave', () => {
      inner.style.transform = '';
      if (glare) glare.style.background = '';
    });
  });
}

/* services peek */
const craftSec = $('#craft');
if (craftSec && FINE) {
  $$('.row', craftSec).forEach(row => {
    row.addEventListener('mouseenter', () => {
      peek.el.className = 'pk' + row.dataset.peek;
      peek.on = true;
    });
  });
  craftSec.addEventListener('mousemove', e => {
    const r = craftSec.getBoundingClientRect();
    peek.tx = e.clientX - r.left;
    peek.ty = e.clientY - r.top;
    if (!peek.on) { peek.x = peek.tx; peek.y = peek.ty; }
  });
  craftSec.addEventListener('mouseleave', () => { peek.on = false; });
  $$('.rows', craftSec).forEach(rows => {
    rows.addEventListener('mouseleave', () => { peek.on = false; });
    rows.addEventListener('mouseenter', () => { peek.on = true; });
  });
}

/* toast */
const toast = $('#toast');
let toastTimer = 0;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

/* playful dead-ends */
$$('.row').forEach(row => row.addEventListener('click', () =>
  showToast('That one’s a whole universe — ask us about it ✦')));
$$('.dream:not(.dream-cta)').forEach(d => d.addEventListener('click', () =>
  showToast('This dream is still under NDA ✦')));

/* smooth anchors */
function scrollToTarget(sel) {
  const el = $(sel);
  if (!el) return;
  const top = sel === '#hero' ? 0 : el.getBoundingClientRect().top + S.cur - 60;
  window.scrollTo(0, Math.max(0, top));
}
$$('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    scrollToTarget(a.getAttribute('href'));
    history.replaceState(null, '', a.getAttribute('href'));
  });
});
$('#yourDream').addEventListener('click', () => {
  showToast('Smart choice ✦ let’s talk');
  scrollToTarget('#contact');
});

/* copy email */
$('#copyEmail').addEventListener('click', async () => {
  const email = 'gautamhridyansh@gmail.com';
  try {
    await navigator.clipboard.writeText(email);
    showToast('email copied ✦ see you in the inbox');
  } catch {
    showToast(email);
  }
});

/* footer local time */
const localTime = $('#localTime');
function tickLocal() {
  localTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
tickLocal();
setInterval(tickLocal, 30000);

/* tab title easter egg */
const baseTitle = document.title;
document.addEventListener('visibilitychange', () => {
  document.title = document.hidden ? '💤 the dream pauses…' : baseTitle;
});

console.log(
  '%c✦ reverie %c curious, aren’t you? we like that.\n→ gautamhridyansh@gmail.com',
  'font-weight:bold;font-size:14px;background:linear-gradient(90deg,#ff8d64,#9a6cff);color:#fff;padding:4px 10px;border-radius:99px',
  'color:#9a6cff;font-size:12px;padding:4px'
);

/* ============================================================
   LOADER
   ============================================================ */
const loader = $('#loader');
const loadPct = $('#loadPct');
const loadWord = $('#loadWord');
const LOAD_WORDS = [
  'gathering stardust…',
  'inflating clouds…',
  'warming the sun…',
  'teaching pixels to float…',
  'almost lucid…',
];
let pendingHash = location.hash || '';

function finishLoad() {
  loader.classList.add('done');
  html.classList.remove('lock');
  body.classList.add('loaded');

  if (pendingHash && $(pendingHash)) {
    const top = pendingHash === '#hero' ? 0 :
      $(pendingHash).getBoundingClientRect().top + S.cur - 60;
    window.scrollTo(0, Math.max(0, top));
    S.cur = S.tgt = Math.max(0, top);
    world.style.transform = `translate3d(0, ${-S.cur}px, 0)`;
    lastSkyP = -1;
  }

  /* hero text cascade */
  $$('#hero [data-split]').forEach((el, i) => {
    setTimeout(() => el.classList.add('in'), 350 + i * 150);
    setTimeout(() => el.classList.add('settled'), 2500 + i * 150);
  });

  setTimeout(() => loader.classList.add('gone'), 1150);
}

function runLoader() {
  const instant = new URLSearchParams(location.search).has('instant');
  const fontsRace = () => Promise.race([
    (document.fonts && document.fonts.ready) || Promise.resolve(),
    new Promise(r => setTimeout(r, 1500)),
  ]);
  if (REDUCED || instant) {
    loadPct.textContent = '100';
    fontsRace().then(() => { measure(); finishLoad(); });
    return;
  }
  let wi = 0;
  const wordIv = setInterval(() => {
    loadWord.textContent = LOAD_WORDS[++wi % LOAD_WORDS.length];
  }, 430);

  const dur = 2050, start = performance.now();
  const easeIO = t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  (function tick(now) {
    const t = clamp((now - start) / dur, 0, 1);
    loadPct.textContent = String(Math.round(easeIO(t) * 100)).padStart(2, '0');
    if (t < 1) { requestAnimationFrame(tick); return; }
    clearInterval(wordIv);
    const fontsReady = (document.fonts && document.fonts.ready) || Promise.resolve();
    Promise.race([fontsReady, new Promise(r => setTimeout(r, 1200))])
      .then(() => { measure(); finishLoad(); });
  })(start);
}

/* never let a hiccup brick the demo */
addEventListener('error', () => {
  loader.classList.add('done', 'gone');
  html.classList.remove('lock');
  body.classList.add('loaded');
});

/* ============================================================
   EVENTS + BOOT
   ============================================================ */
let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    measure();
    lastSkyP = -1;
  }, 140);
});
addEventListener('load', () => measure());
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => measure());
setTimeout(() => measure(), 1600);

if (!REDUCED) updateMani(0); /* words start dimmed, ready for the scroll reveal */
measure();
runLoader();
requestAnimationFrame(frame);

})();
