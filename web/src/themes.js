// Banornas utseende: väggar, golv och himmel. Varje bana får ett tema.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './maze.js';
import { themeIdFor, weatherIdFor } from './plan.js';

const TAU = Math.PI * 2;

function canvasTex(size, draw, { repeat = 1, clamp = false } = {}) {
  const c = document.createElement('canvas');
  const [w, h] = Array.isArray(size) ? size : [size, size];
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (!clamp) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

const rnd = mulberry32(12345);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function speckle(ctx, size, base, shades, n, rmin, rmax) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = pick(shades);
    ctx.globalAlpha = 0.35 + rnd() * 0.5;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, rmin + rnd() * (rmax - rmin), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------- Väggar ----------
const hedge = (ctx, n) => speckle(ctx, n, '#2f6a2b', ['#245a22', '#3b8433', '#4d9b3e', '#68b455', '#1d4a1b'], 1400, 2, 7);

const flowers = (ctx, n) => {
  hedge(ctx, n);
  for (let i = 0; i < 55; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    const color = pick(['#ff7fb0', '#ffffff', '#ffd23f', '#c58cff', '#ff9f5a']);
    ctx.fillStyle = color;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos((k / 5) * TAU) * 4, y + Math.sin((k / 5) * TAU) * 4, 3.2, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, TAU);
    ctx.fill();
  }
};

const autumn = (ctx, n) => speckle(ctx, n, '#b5541c', ['#d9822b', '#e8a23a', '#8f3b12', '#c0392b', '#f0b84a'], 1400, 2, 7);

/** Snöfort: stora block av packad snö och is. */
const snow = (ctx, n) => {
  ctx.fillStyle = '#9db8cc';
  ctx.fillRect(0, 0, n, n);
  const rows = 4;
  const h = n / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 2;
    const w = n / cols;
    const off = r % 2 ? w / 2 : 0;
    for (let k = -1; k < cols + 1; k++) {
      const x = k * w + off;
      const g = ctx.createLinearGradient(x, r * h, x, r * h + h);
      g.addColorStop(0, pick(['#fbfdff', '#f4f9fd']));
      g.addColorStop(1, pick(['#d3e5f2', '#c5dcec', '#dcebf6']));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x + 3, r * h + 3, w - 6, h - 6, 10);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(x + 10, r * h + 6, w - 20, 3);
    }
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(rnd() * n, rnd() * n, 1 + rnd() * 1.6, 0, TAU);
    ctx.fill();
  }
};

const brick = (ctx, n) => {
  ctx.fillStyle = '#d3c9ba';
  ctx.fillRect(0, 0, n, n);
  const rows = 8;
  const h = n / rows;
  const w = n / 4;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? w / 2 : 0;
    for (let k = -1; k < 5; k++) {
      ctx.fillStyle = pick(['#a8452e', '#b4533a', '#9c3f2b', '#b85c3f', '#a04a33']);
      ctx.fillRect(k * w + off + 2, r * h + 2, w - 4, h - 4);
    }
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(rnd() * n, rnd() * n, 2, 2);
  }
};

const stone = (ctx, n) => {
  ctx.fillStyle = '#5f6366';
  ctx.fillRect(0, 0, n, n);
  const rows = 4;
  const h = n / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 40;
    while (x < n) {
      const w = 70 + rnd() * 50;
      ctx.fillStyle = pick(['#8c8f92', '#7d8185', '#9a9da0', '#868a85']);
      ctx.fillRect(x + 2, r * h + 2, w - 4, h - 4);
      x += w;
    }
  }
  ctx.fillStyle = 'rgba(80,140,70,0.45)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(rnd() * n, rnd() * n, 3 + rnd() * 8, 0, TAU);
    ctx.fill();
  }
};

/** Inomhus: krämfärgad puts med fyra roliga tavlor, list nedtill. */
const frame = (ctx, x, y, w, h, color, inner) => {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 5, y + 6, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, w, 3);
  const b = 10;
  ctx.fillStyle = '#fdf7ea';
  ctx.fillRect(x + b, y + b, w - 2 * b, h - 2 * b);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + b + 4, y + b + 4, w - 2 * b - 8, h - 2 * b - 8);
  ctx.clip();
  inner(x + b + 4, y + b + 4, w - 2 * b - 8, h - 2 * b - 8);
  ctx.restore();
};

const plaster = (ctx, n) => {
  speckle(ctx, n, '#efe4cf', ['#e6d9bf', '#f5ecda', '#e9dcc4'], 900, 6, 18);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(0, n - 36, n, 36);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(0, n - 42, n, 6);
  ctx.fillStyle = '#d8c9ac';
  ctx.fillRect(0, 0, n, 12);

  // 1. Bananen som sitter fast med tejp
  frame(ctx, 24, 34, 220, 190, '#c9a24a', (x, y, w, h) => {
    ctx.fillStyle = '#cfe8f6'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2 - 30, 70, 0.4, 2.7); ctx.stroke();
    ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2 - 30, 70, 2.6, 2.75); ctx.stroke();
    ctx.fillStyle = 'rgba(190,190,200,0.9)';
    ctx.save(); ctx.translate(x + w / 2, y + h / 2 + 38); ctx.rotate(-0.1); ctx.fillRect(-26, -9, 52, 18); ctx.restore();
  });

  // 2. Herre med enormt mustasch
  frame(ctx, 268, 34, 220, 190, '#5a3b22', (x, y, w, h) => {
    ctx.fillStyle = '#b9d6c5'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#f0c9a0'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 8, 48, 60, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.fillRect(x + w / 2 - 50, y + 20, 100, 10); ctx.fillRect(x + w / 2 - 32, y + 2, 64, 26);
    ctx.fillStyle = '#fff'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(x + w / 2 + s2 * 18, y + h / 2 - 8, 9, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#222'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(x + w / 2 + s2 * 18, y + h / 2 - 8, 4, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#3a2412';
    ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2 + 14);
    ctx.quadraticCurveTo(x + w / 2 - 60, y + h / 2 - 6, x + w / 2 - 78, y + h / 2 + 34);
    ctx.quadraticCurveTo(x + w / 2 - 36, y + h / 2 + 22, x + w / 2, y + h / 2 + 30);
    ctx.quadraticCurveTo(x + w / 2 + 36, y + h / 2 + 22, x + w / 2 + 78, y + h / 2 + 34);
    ctx.quadraticCurveTo(x + w / 2 + 60, y + h / 2 - 6, x + w / 2, y + h / 2 + 14);
    ctx.fill();
  });

  // 3. Katt med monokel och fluga
  frame(ctx, 24, 250, 220, 190, '#222222', (x, y, w, h) => {
    ctx.fillStyle = '#7a1f2b'; ctx.fillRect(x, y, w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = '#f29b4b';
    ctx.beginPath(); ctx.arc(cx, cy + 6, 50, 0, TAU); ctx.fill();
    for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s2 * 24, cy - 40); ctx.lineTo(cx + s2 * 52, cy - 70); ctx.lineTo(cx + s2 * 52, cy - 26); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s2 * 20, cy, 11, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#222'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s2 * 20, cy, 5, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx + 20, cy, 15, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 35, cy + 4); ctx.lineTo(cx + 46, cy + 50); ctx.stroke();
    ctx.fillStyle = '#ff8fa3'; ctx.beginPath(); ctx.arc(cx, cy + 16, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a6edb';
    ctx.beginPath(); ctx.moveTo(cx, cy + 62); ctx.lineTo(cx - 28, cy + 48); ctx.lineTo(cx - 28, cy + 76); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy + 62); ctx.lineTo(cx + 28, cy + 48); ctx.lineTo(cx + 28, cy + 76); ctx.closePath(); ctx.fill();
  });

  // 4. Porträtt av en potatis
  frame(ctx, 268, 250, 220, 190, '#c9a24a', (x, y, w, h) => {
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x, y, w, h);
    const cx = x + w / 2;
    const cy = y + h / 2 + 6;
    ctx.fillStyle = '#b98a54';
    ctx.beginPath(); ctx.ellipse(cx, cy, 62, 48, -0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8f6a3c';
    for (const [dx, dy] of [[-30, 14], [26, -22], [10, 26], [-12, -26]]) { ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 3.5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s2 * 20, cy - 8, 9, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#222'; for (const s2 of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s2 * 20 - 1, cy - 6, 4, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy + 14, 14, 0.15, Math.PI - 0.15); ctx.stroke();
    ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 32, cy - 24); ctx.lineTo(cx - 10, cy - 20); ctx.stroke();
  });

  // Små skyltar under tavlorna
  ctx.fillStyle = '#c9a24a';
  for (const [x, y] of [[104, 232], [348, 232], [104, 448], [348, 448]]) ctx.fillRect(x, y, 60, 9);
};

/** Bokhyllor med färgglada bokryggar. */
const books = (ctx, n) => {
  ctx.fillStyle = '#4a2f1b';
  ctx.fillRect(0, 0, n, n);
  const shelves = 4;
  const sh = n / shelves;
  for (let r = 0; r < shelves; r++) {
    const top = r * sh;
    ctx.fillStyle = '#2b1a0e';
    ctx.fillRect(0, top + 8, n, sh - 14);
    let x = 4;
    while (x < n - 10) {
      const w = 9 + rnd() * 9;
      const h = (sh - 24) * (0.72 + rnd() * 0.28);
      ctx.fillStyle = pick(['#b3382c', '#2a5f8f', '#2f7a4a', '#c79a2e', '#6a3d8f', '#d4793a', '#3a8a8a', '#8a2f4f']);
      ctx.fillRect(x, top + sh - 10 - h, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + 2, top + sh - 10 - h + 6, w - 4, 2);
      ctx.fillRect(x + 2, top + sh - 22, w - 4, 2);
      x += w + 1;
    }
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(0, top + sh - 10, n, 8);
  }
};

/** Godis: rosa glasyr med strössel. */
const candy = (ctx, n) => {
  speckle(ctx, n, '#ff9ec7', ['#ff8fbd', '#ffb0d3', '#ff7fb0'], 300, 6, 16);
  ctx.fillStyle = '#fff4fa';
  for (let x = 0; x < n; x += 22) {
    ctx.beginPath();
    ctx.arc(x + 11, 18, 16, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillRect(0, 0, n, 18);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = pick(['#ffffff', '#5ad1ff', '#ffe04a', '#7be07b', '#b184ff']);
    ctx.save();
    ctx.translate(rnd() * n, 40 + rnd() * (n - 40));
    ctx.rotate(rnd() * TAU);
    ctx.fillRect(-5, -1.5, 10, 3);
    ctx.restore();
  }
};

/** Korall under vattnet. */
const coralOld = (ctx, n) => {
  speckle(ctx, n, '#d9506a', ['#e8627a', '#c43f5c', '#ef8a5a', '#a8458f', '#f2a0b0'], 900, 3, 11);
  for (let i = 0; i < 70; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    ctx.fillStyle = pick(['#ffd2a8', '#ffe9c8', '#ffb3c6']);
    ctx.beginPath();
    ctx.arc(x, y, 2 + rnd() * 3, 0, TAU);
    ctx.fill();
  }
};

const coral = (ctx, n) => {
  const g = ctx.createLinearGradient(0, 0, 0, n);
  g.addColorStop(0, '#5a2f6e');
  g.addColorStop(1, '#a8456f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  const palette = ['#ff7a8a', '#ffa05a', '#ffd24a', '#c77dff', '#4fd1c5', '#ff5d9e'];
  const branch = (x, y, len, ang, depth, color) => {
    if (depth === 0) return;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    ctx.strokeStyle = color;
    ctx.lineWidth = depth * 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    branch(x2, y2, len * 0.74, ang - 0.5 - rnd() * 0.3, depth - 1, color);
    branch(x2, y2, len * 0.74, ang + 0.5 + rnd() * 0.3, depth - 1, color);
  };
  for (let i = 0; i < 6; i++) branch(20 + rnd() * (n - 40), n - 6, 34, -Math.PI / 2 + (rnd() - 0.5) * 0.4, 4, pick(palette));
  // Solfjädrar
  for (let i = 0; i < 3; i++) {
    const cx = 30 + rnd() * (n - 60);
    const cy = 60 + rnd() * (n - 120);
    ctx.strokeStyle = pick(['#ff9ec7', '#c77dff']);
    ctx.lineWidth = 2;
    for (let a = -1.2; a <= 1.2; a += 0.18) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(a) * 30, cy - Math.cos(a) * 30);
      ctx.stroke();
    }
  }
  // Hjärnkorall och anemoner
  for (let i = 0; i < 5; i++) {
    const x = rnd() * n;
    const y = rnd() * n;
    if (i % 2) {
      ctx.fillStyle = pick(['#ffd24a', '#ff9a4a']);
      ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,50,20,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 9, 0.5, 5); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 4, 1, 6); ctx.stroke();
    } else {
      ctx.strokeStyle = pick(['#6bffc7', '#ff8ad8']);
      ctx.lineWidth = 3;
      for (let a = 0; a < TAU; a += 0.5) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 16); ctx.stroke();
      }
      ctx.fillStyle = '#fff3a0';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
    }
  }
  // Små fiskar och bubblor
  for (let i = 0; i < 3; i++) {
    const x = rnd() * n;
    const y = 20 + rnd() * (n - 40);
    ctx.fillStyle = pick(['#ffd24a', '#7be0ff', '#ff7a5a']);
    ctx.beginPath(); ctx.ellipse(x, y, 9, 5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 16, y - 5); ctx.lineTo(x - 16, y + 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + 4, y - 1, 1.6, 0, TAU); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(rnd() * n, rnd() * n, 2 + rnd() * 4, 0, TAU); ctx.stroke(); }
};

/** Rymdstation: metallpaneler med lampor. */
const metal = (ctx, n) => {
  ctx.fillStyle = '#3b4452';
  ctx.fillRect(0, 0, n, n);
  const cells = 2;
  const s = n / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = pick(['#4a5565', '#434d5c', '#515c6d']);
      ctx.fillRect(x * s + 4, y * s + 4, s - 8, s - 8);
      ctx.fillStyle = '#2a313c';
      for (const [dx, dy] of [[12, 12], [s - 12, 12], [12, s - 12], [s - 12, s - 12]]) {
        ctx.beginPath();
        ctx.arc(x * s + dx, y * s + dy, 3, 0, TAU);
        ctx.fill();
      }
    }
  }
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = pick(['#4af0ff', '#ff5a5a', '#6bff7a', '#ffd23f']);
    ctx.beginPath();
    ctx.arc(30 + rnd() * (n - 60), 30 + rnd() * (n - 60), 5, 0, TAU);
    ctx.fill();
  }
};

/**
 * Rymdstationens vägg. Ritas två gånger med samma upplägg: en gång som färg och en
 * gång som "glöd" (bara det som lyser), så att lampor, skärmar och fönster lyser i mörkret.
 */
const spaceWall = (glow) => (ctx, n) => {
  const r = mulberry32(777);
  const S = n / 512;
  const px = (v) => v * S;
  ctx.save();
  ctx.scale(S, S);
  // Botten: bas
  if (glow) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 512, 512);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#3d4860');
    g.addColorStop(1, '#2a3345');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    // Paneler med skarvar och skruvar
    ctx.strokeStyle = '#1b2230';
    ctx.lineWidth = 3;
    for (let x = 128; x < 512; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
    for (let y = 128; y < 512; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let x = 0; x < 512; x += 128) for (let y = 0; y < 512; y += 128) ctx.fillRect(x + 3, y + 3, 122, 4);
    ctx.fillStyle = '#1b2230';
    for (let x = 0; x < 512; x += 128) for (let y = 0; y < 512; y += 128) {
      for (const [dx, dy] of [[12, 12], [116, 12], [12, 116], [116, 116]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, 3.5, 0, TAU); ctx.fill(); }
    }
  }

  // Lysande list längst upp och en tunn under mitten
  const strip = (y, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, y, 512, h);
  };
  if (glow) { strip(12, 12, '#35e6ff'); strip(260, 8, '#2a9fd0'); }
  else { strip(10, 16, '#1b2230'); strip(258, 12, '#1b2230'); }

  // Rundt fönster mot rymden: stjärnor och en planet
  const porthole = (cx, cy, rad, planet) => {
    if (!glow) {
      ctx.fillStyle = '#9aa6bb';
      ctx.beginPath(); ctx.arc(cx, cy, rad + 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a6578';
      ctx.beginPath(); ctx.arc(cx, cy, rad + 5, 0, TAU); ctx.fill();
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.clip();
    ctx.fillStyle = glow ? '#0a1230' : '#02040e';
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
      ctx.beginPath(); ctx.arc(cx - rad + r() * rad * 2, cy - rad + r() * rad * 2, r() * 1.4 + 0.4, 0, TAU); ctx.fill();
    }
    if (planet) {
      const g = ctx.createRadialGradient(cx + rad * 0.3, cy + rad * 0.5, 4, cx + rad * 0.3, cy + rad * 0.5, rad * 0.9);
      g.addColorStop(0, '#6fd0ff'); g.addColorStop(0.6, '#2a6fd0'); g.addColorStop(1, '#0c2a6a');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx + rad * 0.3, cy + rad * 0.5, rad * 0.8, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(90,200,110,0.8)';
      ctx.beginPath(); ctx.ellipse(cx + rad * 0.1, cy + rad * 0.3, rad * 0.22, rad * 0.14, 0.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + rad * 0.5, cy + rad * 0.7, rad * 0.18, rad * 0.1, -0.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  };
  porthole(112, 150, 56, true);
  porthole(404, 380, 34, false);

  // Skärm med kurva och staplar
  const screen = (x, y, w, h) => {
    if (!glow) {
      ctx.fillStyle = '#10151f';
      ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
      ctx.fillStyle = '#0a0e16';
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.fillStyle = '#04201a';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#5dffb0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 0; k <= 30; k++) {
        const px2 = x + 8 + (k / 30) * (w - 16);
        const py = y + h * 0.45 + Math.sin(k * 0.6) * h * 0.22 + Math.sin(k * 1.7) * h * 0.08;
        if (k) ctx.lineTo(px2, py); else ctx.moveTo(px2, py);
      }
      ctx.stroke();
      ctx.fillStyle = '#3fd0ff';
      for (let k = 0; k < 8; k++) {
        const bh = 6 + r() * (h * 0.3);
        ctx.fillRect(x + 10 + k * ((w - 20) / 8), y + h - 8 - bh, (w - 20) / 8 - 5, bh);
      }
    }
  };
  screen(236, 64, 190, 112);

  // Ventil
  if (!glow) {
    ctx.fillStyle = '#10151f';
    ctx.fillRect(250, 194, 120, 56);
    ctx.fillStyle = '#566178';
    for (let k = 0; k < 6; k++) ctx.fillRect(256, 200 + k * 8, 108, 4);
  }

  // Skylt med text
  ctx.fillStyle = glow ? '#000' : '#d8dde8';
  ctx.fillRect(40, 300, 150, 40);
  ctx.font = 'bold 22px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = glow ? '#ffb347' : '#2b3345';
  ctx.fillText('AIRLOCK 3', 52, 321);
  if (!glow) {
    ctx.fillStyle = '#f2c230';
    for (let k = 0; k < 9; k++) {
      ctx.save();
      ctx.beginPath(); ctx.rect(40, 352, 150, 18); ctx.clip();
      ctx.translate(40 + k * 20, 352);
      ctx.transform(1, 0, -0.8, 1, 0, 0);
      ctx.fillRect(0, 0, 10, 18);
      ctx.restore();
    }
  }

  // Rör med fästen
  if (!glow) {
    for (const x of [236, 262]) {
      ctx.fillStyle = '#6b7690';
      ctx.fillRect(x, 270, 14, 130);
      ctx.fillStyle = '#9aa6bb';
      ctx.fillRect(x + 2, 270, 4, 130);
      ctx.fillStyle = '#2b3345';
      for (const y of [296, 352]) ctx.fillRect(x - 3, y, 20, 8);
    }
  }

  // Varningslampor
  const lamp = (x, y, color, rad) => {
    if (!glow) { ctx.fillStyle = '#10151f'; ctx.beginPath(); ctx.arc(x, y, rad + 5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = glow ? color : '#40495c';
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  };
  lamp(344, 330, '#ff3b3b', 12);
  lamp(380, 330, '#ffd23f', 12);
  lamp(416, 330, '#4aff7a', 12);
  lamp(470, 60, '#35e6ff', 9);

  // Gul och svart varningsrand längst ned
  if (!glow) {
    ctx.fillStyle = '#16191f';
    ctx.fillRect(0, 456, 512, 56);
    ctx.fillStyle = '#f2c230';
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 462, 512, 44); ctx.clip();
    for (let x = -60; x < 560; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 506); ctx.lineTo(x + 22, 506); ctx.lineTo(x + 22 + 44, 462); ctx.lineTo(x + 44, 462);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
  void px;
};

const spaceTop = (ctx, n) => {
  ctx.fillStyle = '#7d8aa0';
  ctx.fillRect(0, 0, n, n);
  ctx.strokeStyle = '#5c6880';
  ctx.lineWidth = 2;
  for (let i = 0; i <= n; i += n / 4) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, n); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(n, i); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let k = 0; k < 40; k++) ctx.fillRect(rnd() * n, rnd() * n, 10 + rnd() * 20, 2);
};

/** Golv i rymdstationen: mörka plåtar med lysande skarvar. */
const spaceFloor = (glow) => (ctx, n) => {
  const cells = 4;
  const s = n / cells;
  ctx.fillStyle = glow ? '#000' : '#1a2030';
  ctx.fillRect(0, 0, n, n);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (!glow) {
        ctx.fillStyle = (x + y) % 2 ? '#222a3c' : '#1d2434';
        ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x * s + 3, y * s + 3, s - 6, 3);
      } else {
        ctx.fillStyle = '#2aa8bc';
        ctx.beginPath(); ctx.arc(x * s + 10, y * s + 10, 2.5, 0, TAU); ctx.fill();
      }
    }
  }
  if (glow) {
    ctx.strokeStyle = '#0c4256';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, n); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(n, i * s); ctx.stroke();
    }
  }
};

// ---------- Ovansidor av väggar ----------
const flat = (color, spots) => (ctx, n) => speckle(ctx, n, color, spots, 500, 3, 10);

// ---------- Golv ----------
const carpet = (ctx, n) => {
  ctx.fillStyle = '#7a1f2b';
  ctx.fillRect(0, 0, n, n);
  ctx.strokeStyle = '#c79a2e';
  ctx.lineWidth = 3;
  const s = n / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#8f2736' : '#6a1a25';
      ctx.fillRect(x * s, y * s, s, s);
      ctx.beginPath();
      ctx.moveTo(x * s + s / 2, y * s + 6);
      ctx.lineTo(x * s + s - 6, y * s + s / 2);
      ctx.lineTo(x * s + s / 2, y * s + s - 6);
      ctx.lineTo(x * s + 6, y * s + s / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }
};

const candyFloor = (ctx, n) => {
  const s = n / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#c8f0e0' : '#fff4d6';
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = pick(['#ff7fb0', '#5ad1ff', '#ffe04a', '#b184ff']);
    ctx.save();
    ctx.translate(rnd() * n, rnd() * n);
    ctx.rotate(rnd() * TAU);
    ctx.fillRect(-4, -1.2, 8, 2.4);
    ctx.restore();
  }
};

const sand = (ctx, n) => {
  speckle(ctx, n, '#e8d6a0', ['#d8c486', '#f2e4b8', '#cdb97a'], 1500, 1, 3);
  // Ljusnät från ytan
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const cx = rnd() * n;
    const cy = rnd() * n;
    ctx.beginPath();
    for (let a = 0; a <= TAU + 0.1; a += 0.5) {
      const r = 22 + Math.sin(a * 3 + i) * 6;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.stroke();
  }
  // Snäckor och sjöstjärnor
  for (let i = 0; i < 6; i++) {
    const x = 20 + rnd() * (n - 40);
    const y = 20 + rnd() * (n - 40);
    if (i % 2) {
      ctx.fillStyle = pick(['#ff9a6a', '#ff6f9a']);
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 4 : 10;
        const a = (k / 10) * TAU - Math.PI / 2;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.fill();
    } else {
      ctx.fillStyle = '#fff1e0';
      ctx.beginPath(); ctx.ellipse(x, y, 9, 7, rnd() * 3, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#e0b890'; ctx.lineWidth = 1.5;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x - 6, y + k * 2.4); ctx.lineTo(x + 6, y + k * 2.4); ctx.stroke(); }
    }
  }
};

const deck = (ctx, n) => {
  ctx.fillStyle = '#1e2430';
  ctx.fillRect(0, 0, n, n);
  ctx.strokeStyle = '#2f6f8a';
  ctx.lineWidth = 2;
  const s = n / 4;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, n); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(n, i * s); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(74,240,255,0.5)';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) ctx.fillRect(x * s + s / 2 - 2, y * s + s / 2 - 2, 4, 4);
};
const gravel = (ctx, n) => speckle(ctx, n, '#b9ad98', ['#9d917d', '#cdc3b0', '#a79b86', '#d8d0bf', '#8a806e'], 1800, 1, 3);

const cobble = (ctx, n) => {
  ctx.fillStyle = '#5d6065';
  ctx.fillRect(0, 0, n, n);
  const cells = 8;
  const s = n / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = pick(['#8d9096', '#9a9da2', '#7f8288', '#a3a6aa']);
      ctx.beginPath();
      ctx.ellipse((x + 0.5 + (y % 2) * 0.3) * s, (y + 0.5) * s, s / 2 - 2, s / 2 - 2, 0, 0, TAU);
      ctx.fill();
    }
  }
};

const parquet = (ctx, n) => {
  ctx.fillStyle = '#6b4423';
  ctx.fillRect(0, 0, n, n);
  const rows = 8;
  const h = n / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 80;
    while (x < n) {
      const w = 90 + rnd() * 70;
      ctx.fillStyle = pick(['#b27a43', '#a86f3a', '#bd854c', '#9f6836']);
      ctx.fillRect(x + 1, r * h + 1, w - 2, h - 2);
      x += w;
    }
  }
};

const leaves = (ctx, n) => {
  speckle(ctx, n, '#b9a98a', ['#9d8f72', '#cdbf9f', '#a79a7e'], 1200, 1, 3);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = pick(['#d9822b', '#c0392b', '#e8a23a', '#a3481a']);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.ellipse(rnd() * n, rnd() * n, 5, 2.5, rnd() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

const snowGround = (ctx, n) => {
  speckle(ctx, n, '#eef4f9', ['#ffffff', '#dbe8f2', '#cfdeeb'], 700, 3, 9);
  // Fotspår i snön
  ctx.fillStyle = 'rgba(150,175,198,0.5)';
  for (let i = 0; i < 9; i++) {
    const x = 20 + rnd() * (n - 40);
    const y = 20 + rnd() * (n - 40);
    ctx.beginPath(); ctx.ellipse(x, y, 5, 8, 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 14, y + 12, 5, 8, 0.3, 0, TAU); ctx.fill();
  }
};

const flagstone = (ctx, n) => {
  ctx.fillStyle = '#5a5e60';
  ctx.fillRect(0, 0, n, n);
  const cells = 4;
  const s = n / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = pick(['#98999a', '#8a8c8d', '#a5a6a6', '#929494']);
      ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
    }
  }
};

const nebulaSky = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#02030a');
  g.addColorStop(1, '#10162e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Nebulosa
  for (const [x, y, rad, c] of [[0.3, 0.35, 0.55, '110,60,200'], [0.75, 0.55, 0.5, '30,120,200'], [0.5, 0.2, 0.4, '200,60,140']]) {
    const gr = ctx.createRadialGradient(w * x, h * y, 4, w * x, h * y, w * rad);
    gr.addColorStop(0, `rgba(${c},0.32)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.65})`;
    ctx.beginPath();
    ctx.arc(rnd() * w, rnd() * h * 0.8, rnd() * 1.3 + 0.4, 0, TAU);
    ctx.fill();
  }
  // Planet med ringar uppe till vänster
  const px = w * 0.2;
  const py = h * 0.15;
  const pr = w * 0.15;
  const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
  pg.addColorStop(0, '#ffd9a0'); pg.addColorStop(0.6, '#c9763a'); pg.addColorStop(1, '#4a2210');
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(240,210,160,0.75)';
  ctx.lineWidth = pr * 0.14;
  ctx.beginPath(); ctx.ellipse(px, py, pr * 1.7, pr * 0.42, -0.3, 0, TAU); ctx.stroke();
  // Liten måne
  ctx.fillStyle = '#cfd6e6';
  ctx.beginPath(); ctx.arc(w * 0.8, h * 0.1, w * 0.04, 0, TAU); ctx.fill();
};

const reefSky = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0a4a78');
  g.addColorStop(0.5, '#1b86b8');
  g.addColorStop(1, '#4fb0d4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 5; i++) {
    const x = rnd() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 90 + rnd() * 40, h); ctx.lineTo(x + 20, h);
    ctx.fill();
  }
};

const starfield = (ctx, n) => {
  const g = ctx.createLinearGradient(0, 0, 0, n);
  g.addColorStop(0, '#02030a');
  g.addColorStop(1, '#141a33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.6})`;
    ctx.beginPath();
    ctx.arc(rnd() * n, rnd() * n * 0.85, rnd() * 1.4 + 0.4, 0, TAU);
    ctx.fill();
  }
};

const sky = (top, mid, bottom) => (ctx, n, h = n) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, h);
};

// ---------- Akvarium ----------
/** Glasruta i ett akvarium: ljusblått glas med bubblor, sjögräs och små fiskar. */
const aquaWall = (ctx, n) => {
  const g = ctx.createLinearGradient(0, 0, 0, n);
  g.addColorStop(0, '#c6f1ff');
  g.addColorStop(0.55, '#8edcf2');
  g.addColorStop(1, '#4fb8dc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
  // ljusstrimmor
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 4; i++) {
    const x = rnd() * n;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 18, 0); ctx.lineTo(x + 60, n); ctx.lineTo(x + 30, n); ctx.fill();
  }
  // bubblor
  for (let i = 0; i < 16; i++) {
    const x = rnd() * n;
    const y = rnd() * n * 0.8;
    const r = 2 + rnd() * 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, TAU); ctx.fill();
  }
  // en liten fisk i glaset
  const fish = (x, y, dir, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-22, -8); ctx.lineTo(-22, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(6, -2, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(7, -2, 1.5, 0, TAU); ctx.fill();
    ctx.restore();
  };
  fish(n * 0.3 + rnd() * n * 0.2, n * 0.3 + rnd() * n * 0.15, rnd() < 0.5 ? 1 : -1, pick(['#ff9a3d', '#ffd24a', '#ff6f9a']));
  fish(n * 0.55 + rnd() * n * 0.2, n * 0.55, rnd() < 0.5 ? 1 : -1, pick(['#ffd24a', '#c77dff', '#ff8a5a']));
  // sjögräs nedtill
  for (let i = 0; i < 9; i++) {
    const x = (i + rnd()) * (n / 9);
    ctx.strokeStyle = pick(['#2fa84f', '#46c060', '#1f8f4a']);
    ctx.lineWidth = 5 + rnd() * 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, n);
    ctx.bezierCurveTo(x - 14, n * 0.9, x + 14, n * 0.82, x + (rnd() - 0.5) * 24, n * (0.72 + rnd() * 0.1));
    ctx.stroke();
  }
  // silikonskarvar
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, n - 4, n - 4);
};

const aquaTop = (ctx, n) => speckle(ctx, n, '#d4f6ff', ['#c2eefb', '#e4fbff', '#b6e8f7'], 600, 3, 10);

/** Färgglatt akvariegrus. */
const aquaFloor = (ctx, n) => {
  speckle(ctx, n, '#e9dcc4', ['#d9c9a8', '#f4e8d0', '#c9d8e0', '#e8c8c0', '#bfe0d0', '#f0d890'], 2000, 2, 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const cx = rnd() * n;
    const cy = rnd() * n;
    ctx.beginPath();
    for (let a = 0; a <= TAU + 0.1; a += 0.5) {
      const r = 22 + Math.sin(a * 3 + i) * 6;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.stroke();
  }
};

/** Vatten som himmel: ljusstrålar från ytan och bubblor. */
const aquaSky = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2aa6d0');
  g.addColorStop(0.5, '#6fd3e8');
  g.addColorStop(1, '#bff2f6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  for (let i = 0; i < 7; i++) {
    const x = rnd() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 36, 0); ctx.lineTo(x + 110 + rnd() * 50, h); ctx.lineTo(x + 20, h);
    ctx.fill();
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 2 + rnd() * 7;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }
};

/**
 * Teman. `side` och `top` ritar väggarna, `floor` golvet och `sky` bakgrunden
 * i spelvyn. `ground` är färgen runt labyrinten på kartan, `fog` dimman.
 */
export const THEMES = [
  { id: 'hedge', name: 'Häck', side: hedge, top: hedge, floor: gravel, ground: 0x4f6f3f, fog: 0xdfe8e1, sky: ['#8fbfe6', '#c9e0ee', '#e8eee6'] },
  { id: 'flowers', name: 'Blommande buskar', side: flowers, top: flowers, floor: gravel, ground: 0x56753f, fog: 0xe3ece0, sky: ['#8fbfe6', '#cfe4ee', '#eef2e4'] },
  { id: 'brick', name: 'Tegelmur', side: brick, top: flat('#8a8076', ['#7a7066', '#9a9086']), floor: cobble, ground: 0x5e6168, fog: 0xdcdfe2, sky: ['#9bbad4', '#cfdbe4', '#e6eaec'] },
  { id: 'indoor', noWeather: true, name: 'Galleri', texSize: 512, side: plaster, top: flat('#efe4cf', ['#e6d9bf', '#f5ecda']), floor: parquet, ground: 0x6b4f35, fog: 0xeadfca, sky: ['#f1e6cf', '#ecdfc4', '#e4d3b2'] },
  { id: 'autumn', name: 'Höstlöv', side: autumn, top: autumn, floor: leaves, ground: 0x6b4a2b, fog: 0xf0dcc0, sky: ['#9cc0d9', '#e6d4b4', '#f3d9b0'] },
  { id: 'snow', name: 'Snöfort', side: snow, top: flat('#ffffff', ['#f2f8fc', '#e3eff8']), floor: snowGround, ground: 0x7d93a8, fog: 0xeaf0f5, sky: ['#a9c2d6', '#d4e0ea', '#eef3f7'] },
  { id: 'library', noWeather: true, name: 'Bibliotek', side: books, top: flat('#4a2f1b', ['#3b2514', '#5a3b22']), floor: carpet, ground: 0x3d2a1c, fog: 0x6b5038, sky: ['#3a2818', '#5a402a', '#6b5038'] },
  { id: 'candy', noWeather: true, name: 'Godisland', side: candy, top: flat('#ffd1e6', ['#ffc2de', '#ffe0f0']), floor: candyFloor, ground: 0xd98ab0, fog: 0xffd9ec, sky: ['#ff9ed0', '#ffc2e0', '#ffe3f1'] },
  { id: 'reef', noWeather: true, name: 'Korallgrotta', fx: 'bubbles', fogRange: [3.2, 8], side: coral, top: coral, floor: sand, ground: 0x0b3a5c, fog: 0x1f7fa8, skyDraw: reefSky, sky: ['#0a4a78', '#1b86b8', '#4fb0d4'] },
  { id: 'space', noWeather: true, name: 'Rymdstation', texSize: 512, fx: 'motes', fogRange: [4, 10], hemi: 1.0, hemiColor: 0x8fb4ff, sunColor: 0xdfe8ff, side: spaceWall(false), glow: spaceWall(true), top: spaceTop, floor: spaceFloor(false), floorGlow: spaceFloor(true), ground: 0x0a0d1a, fog: 0x0e1224, skyDraw: nebulaSky, skyAspect: true, sky: ['#02030a', '#0a0e20', '#141a33'] },
  { id: 'aquarium', noWeather: true, name: 'Akvarium', fx: 'bubbles', fish: true, fogRange: [5, 15], hemi: 1.15, hemiColor: 0xd6f6ff, side: aquaWall, top: aquaTop, floor: aquaFloor, ground: 0x2a9bbf, fog: 0x8fe0ee, skyDraw: aquaSky, sky: ['#2aa6d0', '#6fd3e8', '#bff2f6'] },
  { id: 'stone', name: 'Stenmur', side: stone, top: flat('#7d8185', ['#6f7377', '#8c8f92']), floor: flagstone, ground: 0x555b52, fog: 0xd6dad6, sky: ['#a9b8c4', '#cdd5da', '#e3e6e5'] },
];

/** Tema för en bana (id kommer från planeringen, eller direkt från banans data). */
export function themeFor(level, id = null) {
  const wanted = id ?? themeIdFor(level);
  return THEMES.find((t) => t.id === wanted) ?? THEMES[0];
}

/** Skapar texturerna första gången de behövs. */
export function getAssets(theme, aspect = 2) {
  if (!theme.assets) {
    const [top, mid, bottom] = theme.sky;
    const skySize = theme.skyAspect ? [256, Math.round(256 * aspect)] : 256;
    theme.assets = {
      side: canvasTex(theme.texSize ?? 256, theme.side),
      top: canvasTex(256, theme.top),
      floor: canvasTex(256, theme.floor),
      sky: canvasTex(skySize, theme.skyDraw ?? sky(top, mid, bottom), { clamp: true }),
      glow: theme.glow ? canvasTex(theme.texSize ?? 256, theme.glow) : null,
      floorGlow: theme.floorGlow ? canvasTex(256, theme.floorGlow) : null,
    };
  }
  return theme.assets;
}

/**
 * Väder: påverkar himmel, dimma, ljus och partiklar. Figuren får tillbehör efter vädret.
 * fog = [färg, nära, långt]. sun = ljusets styrka. sky = färger som ersätter temats himmel.
 */
export const WEATHERS = {
  none: { id: 'none', name: '', emoji: '', fx: null },
  sun: { id: 'sun', name: 'Sol', emoji: '☀️', fx: null, sun: 2.4, fog: null, sky: ['#1b6fd0', '#52a6ec', '#b3dcf6'], disc: 'sun' },
  rain: { id: 'rain', name: 'Regn', emoji: '🌧️', fx: 'rain', sun: 1.2, fog: [0xaab2b8, 4, 8.5], sky: ['#5d6b78', '#7d8b97', '#a3adb5'] },
  snow: { id: 'snow', name: 'Snöfall', emoji: '❄️', fx: 'snow', sun: 1.7, fog: [0xe0e8ee, 3.5, 8], sky: ['#9fb3c4', '#c9d6e0', '#e4ecf2'] },
  fog: { id: 'fog', name: 'Dimma', emoji: '🌫️', fx: null, sun: 1.3, fog: [0xd0d6da, 2, 6], sky: ['#b9c2c8', '#cfd6da', '#e2e6e8'] },
  night: { id: 'night', name: 'Natt', emoji: '🌙', fx: null, sun: 0.55, hemi: 0.75, hemiColor: 0x8ea0e0, sunColor: 0x9fb4ff, fog: [0x0b1226, 2.5, 8],
    sky: ['#040816', '#0b1a3a', '#1b2f5a'], disc: 'moon' },
  wind: { id: 'wind', name: 'Blåst', emoji: '💨', fx: 'wind', sun: 2.0, fog: null, sky: ['#7fb0d8', '#bcd6e8', '#e1ebe9'] },
};

/** Väder för en bana (id kommer från planeringen, eller direkt från banans data). */
export function weatherFor(level, theme, id = null) {
  return WEATHERS[id ?? weatherIdFor(level, theme.id)] ?? WEATHERS.sun;
}

/**
 * Himmelstextur för ett väder. Solen ritas in i himlen så att häckarna skymmer den.
 * Sol-himlen byggs för skärmens proportioner så att solen blir rund.
 */
export function getWeatherSky(weather, aspect = 2) {
  if (!weather.sky) return null;
  const key = weather.disc ? `sky${Math.round(aspect * 10)}` : 'skyTex';
  weather.cache = weather.cache ?? {};
  if (!weather.cache[key]) {
    const [top, mid, bottom] = weather.sky;
    if (weather.disc) {
      const w = 256;
      const h = Math.round(256 * aspect);
      weather.cache[key] = canvasTex([w, h], (ctx, cw, ch) => {
        sky(top, mid, bottom)(ctx, cw, ch);
        const x = cw * 0.76;
        const y = ch * 0.17;
        if (weather.disc === 'moon') {
          for (let i = 0; i < 140; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.65})`;
            ctx.beginPath();
            ctx.arc(rnd() * cw, rnd() * ch * 0.7, rnd() * 1.3 + 0.4, 0, TAU);
            ctx.fill();
          }
          const glow = ctx.createRadialGradient(x, y, 4, x, y, cw * 0.4);
          glow.addColorStop(0, 'rgba(200,220,255,0.55)');
          glow.addColorStop(1, 'rgba(200,220,255,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, cw, ch);
          ctx.fillStyle = '#f3f0d8';
          ctx.beginPath();
          ctx.arc(x, y, cw * 0.075, 0, TAU);
          ctx.fill();
          ctx.fillStyle = 'rgba(190,185,150,0.45)';
          for (const [dx, dy, r] of [[-0.02, -0.015, 0.016], [0.025, 0.01, 0.02], [-0.01, 0.03, 0.012]]) {
            ctx.beginPath();
            ctx.arc(x + dx * cw, y + dy * cw, r * cw, 0, TAU);
            ctx.fill();
          }
        } else {
          const glow = ctx.createRadialGradient(x, y, 4, x, y, cw * 0.42);
          glow.addColorStop(0, 'rgba(255,248,200,0.95)');
          glow.addColorStop(0.25, 'rgba(255,230,140,0.45)');
          glow.addColorStop(1, 'rgba(255,230,140,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, cw, ch);
          ctx.fillStyle = '#fffbe0';
          ctx.beginPath();
          ctx.arc(x, y, cw * 0.085, 0, TAU);
          ctx.fill();
        }
      }, { clamp: true });
    } else {
      weather.cache[key] = canvasTex(256, sky(top, mid, bottom), { clamp: true });
    }
  }
  return weather.cache[key];
}
