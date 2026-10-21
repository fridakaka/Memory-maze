// Banornas utseende: väggar, golv och himmel. Varje bana får ett tema.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './maze.js';

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
  t.anisotropy = 4;
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
  { id: 'space', noWeather: true, name: 'Rymdstation', side: metal, top: flat('#7d8aa0', ['#6f7c92', '#8c99ae']), floor: deck, ground: 0x0a0d1a, fog: 0x0e1224, skyDraw: starfield, sky: ['#02030a', '#0a0e20', '#141a33'] },
  { id: 'stone', name: 'Stenmur', side: stone, top: flat('#7d8185', ['#6f7377', '#8c8f92']), floor: flagstone, ground: 0x555b52, fog: 0xd6dad6, sky: ['#a9b8c4', '#cdd5da', '#e3e6e5'] },
];

/** Tema för en bana. Alla teman återkommer jämnt och samma tema kommer aldrig två gånger i rad. */
export function themeFor(level) {
  const n = THEMES.length;
  const order = (block) => {
    const rng = mulberry32(block * 2654435761 + 99);
    const arr = THEMES.map((_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const block = Math.floor((level - 1) / n);
  let arr = order(block);
  // Första banan är alltid den klassiska häcken.
  if (block === 0) arr = [0, ...arr.filter((i) => i !== 0)];
  if (block > 0) {
    const prevLast = order(block - 1).at(-1);
    if (arr[0] === prevLast) [arr[0], arr[1]] = [arr[1], arr[0]];
  }
  return THEMES[arr[(level - 1) % n]];
}

/** Skapar texturerna första gången de behövs. */
export function getAssets(theme) {
  if (!theme.assets) {
    const [top, mid, bottom] = theme.sky;
    theme.assets = {
      side: canvasTex(theme.texSize ?? 256, theme.side),
      top: canvasTex(256, theme.top),
      floor: canvasTex(256, theme.floor),
      sky: canvasTex(256, theme.skyDraw ?? sky(top, mid, bottom), { clamp: true }),
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
  sun: { id: 'sun', name: 'Sol', emoji: '☀️', fx: null, sun: 2.4, fog: null, sky: ['#1b6fd0', '#52a6ec', '#b3dcf6'], sunDisc: true },
  rain: { id: 'rain', name: 'Regn', emoji: '🌧️', fx: 'rain', sun: 1.2, fog: [0xaab2b8, 4, 8.5], sky: ['#5d6b78', '#7d8b97', '#a3adb5'] },
  snow: { id: 'snow', name: 'Snöfall', emoji: '❄️', fx: 'snow', sun: 1.7, fog: [0xe0e8ee, 3.5, 8], sky: ['#9fb3c4', '#c9d6e0', '#e4ecf2'] },
  fog: { id: 'fog', name: 'Dimma', emoji: '🌫️', fx: null, sun: 1.3, fog: [0xd0d6da, 2, 6], sky: ['#b9c2c8', '#cfd6da', '#e2e6e8'] },
  wind: { id: 'wind', name: 'Blåst', emoji: '💨', fx: 'wind', sun: 2.0, fog: null, sky: ['#7fb0d8', '#bcd6e8', '#e1ebe9'] },
};

/** Väder för en bana. De första banorna har alltid sol och inomhusteman har inget väder. */
export function weatherFor(level, theme) {
  if (theme.noWeather) return WEATHERS.none;
  if (level <= 3) return WEATHERS.sun;
  const r = mulberry32(level * 40503 + 11)();
  if (r < 0.35) return WEATHERS.sun;
  // Det regnar inte i ett snölandskap.
  if (r < 0.55) return theme.id === 'snow' ? WEATHERS.snow : WEATHERS.rain;
  if (r < 0.7) return WEATHERS.snow;
  if (r < 0.85) return WEATHERS.fog;
  return WEATHERS.wind;
}

/**
 * Himmelstextur för ett väder. Solen ritas in i himlen så att häckarna skymmer den.
 * Sol-himlen byggs för skärmens proportioner så att solen blir rund.
 */
export function getWeatherSky(weather, aspect = 2) {
  if (!weather.sky) return null;
  const key = weather.sunDisc ? `sky${Math.round(aspect * 10)}` : 'skyTex';
  weather.cache = weather.cache ?? {};
  if (!weather.cache[key]) {
    const [top, mid, bottom] = weather.sky;
    if (weather.sunDisc) {
      const w = 256;
      const h = Math.round(256 * aspect);
      weather.cache[key] = canvasTex([w, h], (ctx, cw, ch) => {
        sky(top, mid, bottom)(ctx, cw, ch);
        const x = cw * 0.76;
        const y = ch * 0.17;
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
      }, { clamp: true });
    } else {
      weather.cache[key] = canvasTex(256, sky(top, mid, bottom), { clamp: true });
    }
  }
  return weather.cache[key];
}
