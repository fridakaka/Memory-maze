// Banornas utseende: väggar, golv och himmel. Varje bana får ett tema.
import * as THREE from '../vendor/three.module.min.js';
import { mulberry32 } from './maze.js';

const TAU = Math.PI * 2;

function canvasTex(size, draw, { repeat = 1, clamp = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
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

const snow = (ctx, n) => speckle(ctx, n, '#e9f1f7', ['#ffffff', '#cfe0ee', '#b9d0e3', '#86ad88'], 900, 3, 9);

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

/** Inomhus: kräm puts med tavlor, list nedtill. */
const plaster = (ctx, n) => {
  speckle(ctx, n, '#efe4cf', ['#e6d9bf', '#f5ecda', '#e9dcc4'], 600, 6, 16);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(0, n - 22, n, 22);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(0, n - 26, n, 4);
  ctx.fillStyle = '#d8c9ac';
  ctx.fillRect(0, 0, n, 8);

  // Tavla 1: landskap
  ctx.fillStyle = '#c9a24a';
  ctx.fillRect(22, 56, 104, 84);
  let g = ctx.createLinearGradient(0, 62, 0, 134);
  g.addColorStop(0, '#8fc3ea');
  g.addColorStop(1, '#e8f1d0');
  ctx.fillStyle = g;
  ctx.fillRect(30, 64, 88, 68);
  ctx.fillStyle = '#5aa04a';
  ctx.beginPath();
  ctx.moveTo(30, 132); ctx.lineTo(70, 96); ctx.lineTo(118, 132);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(100, 80, 8, 0, TAU);
  ctx.fill();

  // Tavla 2: abstrakt
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(150, 84, 78, 100);
  ctx.fillStyle = '#fdf7ea';
  ctx.fillRect(157, 91, 64, 86);
  ['#e63946', '#2a6edb', '#ffd23f', '#3f9a3a'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(176 + (i % 2) * 26, 116 + Math.floor(i / 2) * 36, 14, 0, TAU);
    ctx.fill();
  });

  // Liten tavla 3: stilleben
  ctx.fillStyle = '#c9a24a';
  ctx.fillRect(32, 160, 56, 42);
  ctx.fillStyle = '#f6e7c1';
  ctx.fillRect(37, 165, 46, 32);
  ctx.fillStyle = '#e63946';
  ctx.beginPath();
  ctx.arc(60, 184, 9, 0, TAU);
  ctx.fill();
  g = null;
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
const coral = (ctx, n) => {
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
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = 20; y < n; y += 36) {
    ctx.beginPath();
    for (let x = 0; x <= n; x += 8) ctx.lineTo(x, y + Math.sin(x / 14 + y) * 4);
    ctx.stroke();
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

const snowGround = (ctx, n) => speckle(ctx, n, '#eef4f9', ['#ffffff', '#dbe8f2', '#cfdeeb'], 700, 3, 9);

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

const sky = (top, mid, bottom) => (ctx, n) => {
  const g = ctx.createLinearGradient(0, 0, 0, n);
  g.addColorStop(0, top);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, n, n);
};

/**
 * Teman. `side` och `top` ritar väggarna, `floor` golvet och `sky` bakgrunden
 * i spelvyn. `ground` är färgen runt labyrinten på kartan, `fog` dimman.
 */
export const THEMES = [
  { id: 'hedge', name: 'Häck', side: hedge, top: hedge, floor: gravel, ground: 0x4f6f3f, fog: 0xdfe8e1, sky: ['#8fbfe6', '#c9e0ee', '#e8eee6'] },
  { id: 'flowers', name: 'Blommande buskar', side: flowers, top: flowers, floor: gravel, ground: 0x56753f, fog: 0xe3ece0, sky: ['#8fbfe6', '#cfe4ee', '#eef2e4'] },
  { id: 'brick', name: 'Tegelmur', side: brick, top: flat('#8a8076', ['#7a7066', '#9a9086']), floor: cobble, ground: 0x5e6168, fog: 0xdcdfe2, sky: ['#9bbad4', '#cfdbe4', '#e6eaec'] },
  { id: 'indoor', name: 'Galleri', side: plaster, top: flat('#efe4cf', ['#e6d9bf', '#f5ecda']), floor: parquet, ground: 0x6b4f35, fog: 0xeadfca, sky: ['#f1e6cf', '#ecdfc4', '#e4d3b2'] },
  { id: 'autumn', name: 'Höstlöv', side: autumn, top: autumn, floor: leaves, ground: 0x6b4a2b, fog: 0xf0dcc0, sky: ['#9cc0d9', '#e6d4b4', '#f3d9b0'] },
  { id: 'snow', name: 'Snöhäck', side: snow, top: flat('#ffffff', ['#eef4f9', '#dbe8f2']), floor: snowGround, ground: 0x7d93a8, fog: 0xeaf0f5, sky: ['#a9c2d6', '#d4e0ea', '#eef3f7'] },
  { id: 'library', name: 'Bibliotek', side: books, top: flat('#4a2f1b', ['#3b2514', '#5a3b22']), floor: carpet, ground: 0x3d2a1c, fog: 0x6b5038, sky: ['#3a2818', '#5a402a', '#6b5038'] },
  { id: 'candy', name: 'Godisland', side: candy, top: flat('#ffd1e6', ['#ffc2de', '#ffe0f0']), floor: candyFloor, ground: 0xd98ab0, fog: 0xffd9ec, sky: ['#ff9ed0', '#ffc2e0', '#ffe3f1'] },
  { id: 'reef', name: 'Korallgrotta', side: coral, top: coral, floor: sand, ground: 0x0b3a5c, fog: 0x2b8fbf, sky: ['#0e5a8a', '#1b86b8', '#4fb0d4'] },
  { id: 'space', name: 'Rymdstation', side: metal, top: flat('#7d8aa0', ['#6f7c92', '#8c99ae']), floor: deck, ground: 0x0a0d1a, fog: 0x0e1224, skyDraw: starfield, sky: ['#02030a', '#0a0e20', '#141a33'] },
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
      side: canvasTex(256, theme.side),
      top: canvasTex(256, theme.top),
      floor: canvasTex(256, theme.floor),
      sky: canvasTex(256, theme.skyDraw ?? sky(top, mid, bottom), { clamp: true }),
    };
  }
  return theme.assets;
}
