import * as THREE from '../vendor/three.module.min.js';
import { CHARACTERS, makeHero, setAccessory, setHelmet } from './heroes.js';
import { makeMonster, MONSTER_BY_THEME } from './monsters.js';
import { THEMES, themeFor, getAssets, WEATHERS, weatherFor, getWeatherSky } from './themes.js';
import {
  DELTA, OPPOSITE, distances, monsterPlan, walkCorridor, openDirs, relativeDir,
  timeLimit, perfectTime, starsFor, STUDY_SECONDS, RUN_SPEED,
} from './maze.js';
import { buildLevel, levelInfo, levelCount, introIds, loadLevelData, isIntro } from './levels.js';

// ---------- Hjälpare ----------
const $ = (id) => document.getElementById(id);
const show = (el, on = true) => el.classList.toggle('hidden', !on);
const TAU = Math.PI * 2;
const angleDiff = (a, b) => ((b - a + Math.PI * 3) % TAU) - Math.PI;
const lerpAngle = (a, b, t) => a + angleDiff(a, b) * t;
// Riktning -> vinkel runt y-axeln (figurens "framåt" är +z).
const YAW = { N: Math.PI, E: Math.PI / 2, S: 0, W: -Math.PI / 2 };

// ---------- Sparad progress ----------
const SAVE_KEY = 'maze-memory-v1';
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { return {}; }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* privat läge */ }
}
const save = Object.assign({ stars: {}, lives: 5 }, loadSave());

// ---------- Inställningar ----------
const settings = { mode: 'navigator', difficulty: 'medium', level: 1 };
const MAX_LIVES = 5;

// ---------- three.js ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const LAWN = 0x4f6f3f;
const scene = new THREE.Scene();

let skyTex = null; // sätts av temat
const lawnColor = new THREE.Color(LAWN);
scene.background = lawnColor;

const hemi = new THREE.HemisphereLight(0xe6f0ff, 0x6a7a55, 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(-6, 11, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = sun.shadow.camera.bottom = -11;
sun.shadow.camera.right = sun.shadow.camera.top = 11;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const mapCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const playCam = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
const rearCam = new THREE.PerspectiveCamera(62, 1.4, 0.1, 60);
let camera = mapCam;

const mats = {
  floor: new THREE.MeshLambertMaterial(),
  wallSide: new THREE.MeshLambertMaterial(),
  wallTop: new THREE.MeshLambertMaterial(),
  path: new THREE.MeshLambertMaterial({ color: 0xff4f8b, emissive: 0x7a1038 }),
  start: new THREE.MeshLambertMaterial({ color: 0x5aa9e6, emissive: 0x143a5c }),
  goal: new THREE.MeshLambertMaterial({ color: 0xffd25a, emissive: 0x9a6a00 }),
  spot: new THREE.MeshLambertMaterial({ color: 0xff9f43, emissive: 0x6b3300 }),
};
let theme = THEMES[0];
let fogSetting = [0xdfe8e1, 4.5, 9.5]; // färg, nära, långt

/** Byter utseende på väggar, golv och himmel. */
function applyTheme(t, size) {
  theme = t;
  setMonster(MONSTER_BY_THEME[t.id] ?? 'classic');
  const a = getAssets(t, window.innerHeight / window.innerWidth);
  mats.wallSide.map = a.side;
  mats.wallTop.map = a.top;
  mats.floor.map = a.floor;
  // Lampor, skärmar och fönster som lyser (bara i vissa teman)
  mats.wallSide.emissiveMap = a.glow;
  mats.wallSide.emissive.setHex(a.glow ? 0xffffff : 0x000000);
  mats.floor.emissiveMap = a.floorGlow;
  mats.floor.emissive.setHex(a.floorGlow ? 0xffffff : 0x000000);
  mats.wallSide.needsUpdate = mats.wallTop.needsUpdate = mats.floor.needsUpdate = true;
  a.floor.repeat.set(Math.max(2, Math.ceil(size / 2)), Math.max(2, Math.ceil(size / 2)));
  skyTex = a.sky;
  lawnColor.set(t.ground);
}

const WALL_H = 1.2;
const WALL_T = 0.34;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  playCam.aspect = w / h;
  playCam.updateProjectionMatrix();
  fitMapCamera();
}
window.addEventListener('resize', resize);

// ---------- Labyrintens 3D-modell ----------
let maze = null;
let mazeGroup = null;
let walls = []; // { cx, cz, sx, sz } per vägg
let wallIndex = new Map(); // 'H:x:y' eller 'V:x:y' -> väggens nummer
let wallSides = null;
let wallTops = null;
const cut = new Map(); // väggnummer -> { alpha, hold, slot } för väggar som är genomskinliga
let ghostSides = null; // genomskinliga kopior av väggarna som skymmer
let ghostTops = null;
let ghostAlpha = null;
const GHOST_MAX = 96;
const dummy = new THREE.Object3D();

let sideGeo = null;
/** Enhetslåda utan ovan- och undersida (de ritas separat). */
function wallSideGeometry() {
  if (!sideGeo) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const keep = [];
    for (const grp of g.groups) {
      if ([0, 1, 4, 5].includes(grp.materialIndex)) {
        for (let i = grp.start; i < grp.start + grp.count; i++) keep.push(g.index.array[i]);
      }
    }
    g.setIndex(keep);
    g.clearGroups();
    sideGeo = g;
  }
  return sideGeo;
}
let topGeo = null;
function wallTopGeometry() {
  if (!topGeo) topGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0.5, 0);
  return topGeo;
}

function hideWall(i) {
  dummy.scale.set(0, 0, 0);
  dummy.position.set(0, -10, 0);
  dummy.updateMatrix();
  wallSides.setMatrixAt(i, dummy.matrix);
  wallTops.setMatrixAt(i, dummy.matrix);
}

/** Material som kan ha olika genomskinlighet per instans. */
function ghostMaterial(base) {
  const m = base.clone();
  m.transparent = true;
  m.depthWrite = false;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instAlpha;\nvarying float vInstAlpha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstAlpha = instAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstAlpha;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vInstAlpha );');
  };
  return m;
}

/** Räknar ut en väggs matris i `dummy`. */
function computeWallMatrix(i, scaleY = 1) {
  const w = walls[i];
  dummy.position.set(w.cx, (WALL_H * scaleY) / 2, w.cz);
  dummy.scale.set(w.sx, WALL_H * scaleY, w.sz);
  dummy.updateMatrix();
}

function setWallMatrix(i, scaleY) {
  computeWallMatrix(i, scaleY);
  wallSides.setMatrixAt(i, dummy.matrix);
  wallTops.setMatrixAt(i, dummy.matrix);
}
let pathGroup = null;
let mapIcons = null;
const cellPos = (x, y) => new THREE.Vector3(x - maze.width / 2 + 0.5, 0, y - maze.height / 2 + 0.5);

function buildMazeMesh() {
  if (mazeGroup) scene.remove(mazeGroup);
  mazeGroup = new THREE.Group();
  walls = [];
  wallIndex = new Map();
  cut.clear();
  S.fadeTargets = null;
  const { width: W, height: H } = maze;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.2, H + 1.2), mats.floor);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  mazeGroup.add(floor);

  // Alla väggar ritas som två instansierade nät (sidor och ovansidor), vilket ger
  // få ritanrop även på stora banor.
  const addWall = (cx, cz, horizontal, key) => {
    wallIndex.set(key, walls.length);
    walls.push({ cx, cz, sx: horizontal ? 1 + WALL_T : WALL_T, sz: horizontal ? WALL_T : 1 + WALL_T });
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = cellPos(x, y);
      const o = maze.open[y][x];
      if (!o.N) addWall(c.x, c.z - 0.5, true, `H:${x}:${y}`);
      if (!o.W) addWall(c.x - 0.5, c.z, false, `V:${x}:${y}`);
      if (x === W - 1 && !o.E) addWall(c.x + 0.5, c.z, false, `V:${x + 1}:${y}`);
      // Öppen grind vid starten så att kameran inte hamnar bakom en häck.
      if (y === H - 1 && !o.S && x !== maze.start.x) addWall(c.x, c.z + 0.5, true, `H:${x}:${y + 1}`);
    }
  }
  // Celler utan öppningar (i handbyggda banor) blir solida häckblock.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!openDirs(maze, x, y).length) {
        const c = cellPos(x, y);
        walls.push({ cx: c.x, cz: c.z, sx: 1, sz: 1 });
      }
    }
  }
  wallSides = new THREE.InstancedMesh(wallSideGeometry(), mats.wallSide, walls.length);
  wallTops = new THREE.InstancedMesh(wallTopGeometry(), mats.wallTop, walls.length);
  for (let k = 0; k < walls.length; k++) setWallMatrix(k, 1);
  wallSides.castShadow = true;
  wallSides.receiveShadow = true;
  wallTops.receiveShadow = true;
  wallSides.frustumCulled = wallTops.frustumCulled = false;
  mazeGroup.add(wallSides, wallTops);

  // Genomskinliga kopior som ritas i stället för väggarna som skymmer figuren.
  ghostAlpha = new THREE.InstancedBufferAttribute(new Float32Array(GHOST_MAX).fill(1), 1);
  ghostAlpha.setUsage(THREE.DynamicDrawUsage);
  const gs = wallSideGeometry().clone();
  gs.setAttribute('instAlpha', ghostAlpha);
  const gt = wallTopGeometry().clone();
  gt.setAttribute('instAlpha', ghostAlpha);
  ghostSides = new THREE.InstancedMesh(gs, ghostMaterial(mats.wallSide), GHOST_MAX);
  ghostTops = new THREE.InstancedMesh(gt, ghostMaterial(mats.wallTop), GHOST_MAX);
  ghostSides.count = ghostTops.count = 0;
  ghostSides.frustumCulled = ghostTops.frustumCulled = false;
  ghostSides.renderOrder = ghostTops.renderOrder = 5;
  mazeGroup.add(ghostSides, ghostTops);

  const marker = (cell, mat, geo) => {
    const m = new THREE.Mesh(geo, mat);
    const p = cellPos(cell.x, cell.y);
    m.position.set(p.x, 0.02, p.z);
    mazeGroup.add(m);
    return m;
  };
  marker(maze.start, mats.start, new THREE.CylinderGeometry(0.26, 0.26, 0.03, 28));
  const goalMarker = marker(maze.goal, mats.goal, new THREE.CylinderGeometry(0.34, 0.34, 0.05, 5));
  // Mål-stjärna som syns även från snett uppifrån
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mats.goal);
  star.position.set(goalMarker.position.x, 0.55, goalMarker.position.z);
  star.name = 'goalStar';
  mazeGroup.add(star);

  // Vägen är en sammanhängande linje genom rutornas mitt, med rundade hörn.
  mapIcons = new THREE.Group();
  pathGroup = new THREE.Group();
  const LINE_W = 0.15;
  const dot = new THREE.CylinderGeometry(LINE_W / 2, LINE_W / 2, 0.03, 16);
  const sol = maze.solution;
  for (let k = 0; k < sol.length; k++) {
    const a = cellPos(sol[k].x, sol[k].y);
    const joint = new THREE.Mesh(dot, mats.path);
    joint.position.set(a.x, 0.03, a.z);
    pathGroup.add(joint);
    if (k + 1 < sol.length) {
      const b = cellPos(sol[k + 1].x, sol[k + 1].y);
      const horizontal = a.z === b.z;
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 1 : LINE_W, 0.03, horizontal ? LINE_W : 1), mats.path);
      seg.position.set((a.x + b.x) / 2, 0.03, (a.z + b.z) / 2);
      pathGroup.add(seg);
    }
  }
  mazeGroup.add(pathGroup);
  for (const spot of maze.spots ?? []) {
    spot.mesh = makeBarrel();
    const p = cellPos(spot.x, spot.y);
    // Tunnan står mot väggen längst in i återvändsgränden.
    const back = DELTA[OPPOSITE[spot.dir]];
    spot.mesh.position.set(p.x + back.dx * 0.1, 0, p.z + back.dy * 0.1);
    mazeGroup.add(spot.mesh);
    // Orange ring så att gömstället syns tydligt på kartan.
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.03, 28), mats.spot);
    ring.position.set(p.x, 0.015, p.z);
    mazeGroup.add(ring);
  }
  for (const lm of maze.landmarks ?? []) {
    const model = makeLandmark(lm.type);
    const p = cellPos(lm.x, lm.y);
    model.rotation.y = lm.type === 'gate' ? (lm.axis === 'x' ? 0 : Math.PI / 2) : YAW[lm.dir];
    model.position.set(p.x, 0, p.z);
    mazeGroup.add(model);
    // Ikon som bara syns på kartan
    const sprite = makeIconSprite(LANDMARK_ICON[lm.type]);
    sprite.position.set(p.x, 3, p.z);
    mapIcons.add(sprite);
  }
  mazeGroup.add(mapIcons);
  scene.add(mazeGroup);
}

function makeIconSprite(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '96px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 72);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(1.1, 1.1, 1);
  sprite.renderOrder = 20;
  return sprite;
}

const LANDMARK_ICON = { gate: '⛩️', tree: '🍎', lantern: '🏮', statue: '🗿', flag: '🚩', sunflower: '🌻' };

/**
 * Landmärken är gjorda så att de syns över häckarna och från ovan.
 * Modellen byggs mot +z (en häck) och vrids sedan åt rätt håll.
 */
function makeLandmark(type) {
  const g = new THREE.Group();
  const lam = (c, e = 0x000000) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
  const cyl = (r1, r2, h, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 14), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const box = (w, h, dd, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const ball = (r, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const Z = 0.4; // mot häcken

  if (type === 'gate') {
    // Blå grind som spänner över korridoren (längs x).
    const blue = lam(0x2a6edb);
    const gold = lam(0xffd23f, 0x4a3500);
    box(0.09, 1.15, 0.09, blue, -0.29, 0.575, 0);
    box(0.09, 1.15, 0.09, blue, 0.29, 0.575, 0);
    box(0.7, 0.1, 0.12, blue, 0, 1.12, 0);
    box(0.76, 0.05, 0.16, gold, 0, 1.2, 0);
    ball(0.06, gold, -0.29, 1.2, 0);
    ball(0.06, gold, 0.29, 1.2, 0);
  } else if (type === 'tree') {
    cyl(0.06, 0.08, 1.2, lam(0x6b4423), 0, 0.6, Z);
    ball(0.38, lam(0x3f9a3a), 0, 1.5, Z - 0.1);
    ball(0.26, lam(0x4fb248), 0.12, 1.75, Z - 0.05);
    const red = lam(0xe63946);
    [[0.3, 1.45, 0.02], [-0.25, 1.4, 0.1], [0.05, 1.3, 0.18], [0.2, 1.7, 0.1], [-0.1, 1.65, 0.2], [-0.3, 1.55, -0.15]].forEach(([x, y, z]) => {
      ball(0.06, red, x, y, Z - 0.1 + z);
    });
  } else if (type === 'lantern') {
    const iron = lam(0x2b2b33);
    cyl(0.04, 0.05, 1.5, iron, 0, 0.75, Z);
    box(0.05, 0.05, 0.3, iron, 0, 1.45, Z - 0.15);
    ball(0.11, lam(0xffe27a, 0xffc300), 0, 1.3, Z - 0.3);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 10), iron);
    cap.position.set(0, 1.45, Z - 0.3);
    g.add(cap);
  } else if (type === 'statue') {
    const stone = lam(0xe9e4d8);
    const gold = lam(0xffd23f, 0x4a3500);
    box(0.34, 0.4, 0.34, lam(0xb7b2a6), 0, 1.4, Z);
    cyl(0.1, 0.13, 0.4, stone, 0, 1.8, Z);
    ball(0.09, stone, 0, 2.08, Z);
    box(0.06, 0.28, 0.06, stone, 0.14, 1.95, Z).rotation.z = -0.5;
    ball(0.07, gold, 0.26, 2.12, Z);
  } else if (type === 'flag') {
    cyl(0.025, 0.03, 2.1, lam(0xdddddd), 0, 1.05, Z);
    ball(0.045, lam(0xffd23f, 0x4a3500), 0, 2.12, Z);
    box(0.38, 0.22, 0.03, lam(0xe63946), 0, 1.9, Z - 0.2);
    box(0.38, 0.06, 0.035, lam(0xffd23f), 0, 1.9, Z - 0.2);
  } else if (type === 'sunflower') {
    cyl(0.035, 0.045, 1.7, lam(0x3f9a3a), 0, 0.85, Z);
    const head = new THREE.Group();
    head.position.set(0, 1.75, Z - 0.1);
    head.rotation.x = -0.9; // vänd mot korridoren
    head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 20), lam(0xffd23f, 0x3a2c00)));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20), lam(0x5a3b24));
    core.position.y = 0.03;
    head.add(core);
    g.add(head);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function makeBarrel() {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a6a3a });
  const band = new THREE.MeshLambertMaterial({ color: 0x4f3219 });
  const lid = new THREE.MeshLambertMaterial({ color: 0xc08e58 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.6, 18), wood);
  body.position.y = 0.3;
  g.add(body);
  for (const y of [0.15, 0.45]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.215 - (0.3 - y) * 0.05, 0.215 - (0.3 - y) * 0.05, 0.05, 18), band);
    ring.position.y = y;
    g.add(ring);
  }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 18), lid);
  top.position.y = 0.61;
  g.add(top);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.mats = [wood, band, lid];
  return g;
}

function fitMapCamera() {
  if (!maze) return;
  const aspect = window.innerWidth / window.innerHeight;
  // Lämna plats för HUD uppe och knapp nere.
  let halfW = maze.width / 2 + 0.6;
  let halfH = maze.height / 2 + 0.6;
  if (halfW / aspect > halfH) halfH = halfW / aspect;
  else halfW = halfH * aspect;
  const shift = halfH * 0.12;
  mapCam.left = -halfW; mapCam.right = halfW;
  mapCam.top = halfH + shift; mapCam.bottom = -halfH + shift;
  mapCam.position.set(0, 40, 0);
  mapCam.up.set(0, 0, -1);
  mapCam.lookAt(0, 0, 0);
  mapCam.updateProjectionMatrix();
}

// ---------- Figuren ----------
let hero = makeHero(save.hero || 'kille');
scene.add(hero);

function setHero(id) {
  const old = hero;
  hero = makeHero(id);
  hero.position.copy(old.position);
  hero.rotation.copy(old.rotation);
  scene.remove(old);
  scene.add(hero);
  setAccessory(hero, weather.id);
  setHelmet(hero, theme.id === 'space');
  attachFlash(weather.id === 'night');
  save.hero = id;
  writeSave();
}

// Monstret byts ut efter banans tema.
let monster = makeMonster('classic');
scene.add(monster);

function setMonster(kind) {
  if (monster.userData.kind === kind) return;
  scene.remove(monster);
  monster = makeMonster(kind);
  scene.add(monster);
}

// ---------- Väder ----------
let weather = WEATHERS.none;
let fx = null; // regn, snö eller löv

function dotTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const softDot = dotTexture((ctx) => {
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
});
const leafTexture = dotTexture((ctx) => {
  ctx.translate(32, 32);
  ctx.rotate(-0.7);
  ctx.fillStyle = '#d9822b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 12, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8f3b12';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.lineTo(24, 0);
  ctx.stroke();
});

const bubbleTexture = dotTexture((ctx) => {
  ctx.strokeStyle = 'rgba(220,245,255,0.95)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(24, 24, 5, 0, TAU);
  ctx.fill();
});

const FX_RADIUS = 6;
const FX_HEIGHT = 6;

function clearFx() {
  if (!fx) return;
  scene.remove(fx.obj);
  fx.obj.geometry.dispose();
  fx = null;
}

function makeFx(kind) {
  clearFx();
  if (!kind) return;
  const n = kind === 'rain' ? 900 : kind === 'snow' ? 550 : kind === 'bubbles' ? 160 : kind === 'motes' ? 140 : 320;
  const p = new Float32Array(n * 3);
  const v = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    p[i * 3] = (Math.random() * 2 - 1) * FX_RADIUS;
    p[i * 3 + 1] = Math.random() * FX_HEIGHT;
    p[i * 3 + 2] = (Math.random() * 2 - 1) * FX_RADIUS;
    if (kind === 'rain') { v[i * 3] = -1.2; v[i * 3 + 1] = -13 - Math.random() * 3; }
    else if (kind === 'snow') { v[i * 3 + 1] = -0.9 - Math.random() * 0.7; }
    else if (kind === 'bubbles') { v[i * 3 + 1] = 0.6 + Math.random() * 0.9; }
    else if (kind === 'motes') { v[i * 3] = (Math.random() - 0.5) * 0.4; v[i * 3 + 1] = (Math.random() - 0.5) * 0.3; v[i * 3 + 2] = (Math.random() - 0.5) * 0.4; }
    else { v[i * 3] = 5 + Math.random() * 2; v[i * 3 + 1] = -0.2 - Math.random() * 0.3; }
  }
  const geo = new THREE.BufferGeometry();
  let obj;
  if (kind === 'rain') {
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.65 }));
  } else {
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const matOptions = kind === 'snow'
      ? { map: softDot, size: 0.16, transparent: true, depthWrite: false, color: 0xffffff }
      : kind === 'bubbles'
        ? { map: bubbleTexture, size: 0.2, transparent: true, depthWrite: false }
        : kind === 'motes'
          ? { map: softDot, size: 0.09, transparent: true, depthWrite: false, color: 0x9fe8ff, blending: THREE.AdditiveBlending }
        : { map: leafTexture, size: 0.2, transparent: true, depthWrite: false, alphaTest: 0.1 };
    obj = new THREE.Points(geo, new THREE.PointsMaterial(matOptions));
  }
  obj.frustumCulled = false;
  obj.visible = false;
  scene.add(obj);
  fx = { kind, obj, p, v, n, t: 0 };
}

function updateFx(dt) {
  if (!fx) return;
  fx.obj.visible = S.phase === 'play' || S.phase === 'ended';
  if (!fx.obj.visible) return;
  fx.t += dt;
  const { p, v, n, kind } = fx;
  const cx = hero.position.x;
  const cz = hero.position.z;
  const buf = fx.obj.geometry.attributes.position.array;
  for (let i = 0; i < n; i++) {
    const k = i * 3;
    if (kind === 'snow') v[k] = Math.sin(fx.t * 0.8 + i) * 0.35;
    if (kind === 'bubbles') v[k] = Math.sin(fx.t * 1.5 + i) * 0.25;
    if (kind === 'wind') v[k + 1] = Math.sin(fx.t * 3 + i) * 0.5;
    p[k] += v[k] * dt;
    p[k + 1] += v[k + 1] * dt;
    p[k + 2] += v[k + 2] * dt;
    if (p[k + 1] < 0) p[k + 1] += FX_HEIGHT;
    if (p[k + 1] > FX_HEIGHT) p[k + 1] -= FX_HEIGHT;
    // Håll partiklarna runt figuren
    const dx = (((p[k] - cx + FX_RADIUS) % (2 * FX_RADIUS)) + 2 * FX_RADIUS) % (2 * FX_RADIUS) - FX_RADIUS;
    const dz = (((p[k + 2] - cz + FX_RADIUS) % (2 * FX_RADIUS)) + 2 * FX_RADIUS) % (2 * FX_RADIUS) - FX_RADIUS;
    p[k] = cx + dx;
    p[k + 2] = cz + dz;
    if (kind === 'rain') {
      const b = i * 6;
      buf[b] = p[k]; buf[b + 1] = p[k + 1]; buf[b + 2] = p[k + 2];
      buf[b + 3] = p[k] + 0.04; buf[b + 4] = p[k + 1] + 0.4; buf[b + 5] = p[k + 2];
    } else {
      buf[k] = p[k]; buf[k + 1] = p[k + 1]; buf[k + 2] = p[k + 2];
    }
  }
  fx.obj.geometry.attributes.position.needsUpdate = true;
}

// Ficklampan på natten: ett ljus som sitter på figuren och en svag stråle.
// Mjukt ljus som gör att figuren syns i mörkret.
const glow = new THREE.PointLight(0xffe8b0, 0, 3.2, 1.4);
glow.position.set(0, 1.1, -0.5);
const flash = new THREE.SpotLight(0xfff0c0, 0, 11, 0.5, 0.65, 1.1);
flash.position.set(0.22, 0.42, 0.3);
const flashTarget = new THREE.Object3D();
flashTarget.position.set(0.22, 0.1, 4);
flash.target = flashTarget;
const beam = new THREE.Mesh(
  new THREE.CylinderGeometry(0.62, 0.03, 3.2, 20, 1, true).rotateX(Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
beam.position.set(0.22, 0.42, 1.95);
beam.rotation.x = -0.12;

function attachFlash(on) {
  for (const o of [flash, flashTarget, beam]) {
    if (on) hero.add(o);
    else hero.remove(o);
  }
  flash.intensity = on ? 70 : 0;
  glow.intensity = on ? 5 : 0;
  if (on) hero.add(glow);
  else hero.remove(glow);
}

/** Sätter vädret för banan: himmel, dimma, ljus, partiklar och figurens tillbehör. */
function applyWeather(w) {
  weather = w;
  const sky = getWeatherSky(w, window.innerHeight / window.innerWidth);
  if (sky) skyTex = sky;
  fogSetting = w.fog ?? [theme.fog, ...(theme.fogRange ?? [4.5, 9.5])];
  sun.intensity = w.sun ?? 2.2;
  sun.color.setHex(w.sunColor ?? theme.sunColor ?? 0xfff1d6);
  hemi.intensity = w.hemi ?? theme.hemi ?? 1.35;
  hemi.color.setHex(w.hemiColor ?? theme.hemiColor ?? 0xe6f0ff);
  makeFx(w.fx ?? theme.fx);
  setAccessory(hero, w.id);
  setHelmet(hero, theme.id === 'space');
  attachFlash(w.id === 'night');
}

// ---------- Spelstate ----------
const S = {
  phase: 'menu', // menu | study | play | ended
  node: null, // nuvarande nod {x,y}
  heading: 'N', // blickriktning i nuvarande nod
  run: null, // { pts:[Vector3], seg, t, to, heading, wrong }
  yaw: 0, camYaw: 0, camVel: 0,
  kind: 'time', uturn: false, shake: 0, shakeBurst: 0, vibrateIn: 0, mon: null, difficulty: 0, hidden: false,
  limit: 0, timeLeft: 0, studyLeft: 0, studyTotal: 0,
  wrongTurns: 0, elapsed: 0,
  anim: { t: 0, reaction: null, reactionT: 0, blinkIn: 2, glanceT: -1, glanceIn: 2 },
};

function startLevel() {
  const level = settings.level;
  save.level = level;
  writeSave();
  show($('sheet-settings'), false);
  show($('sheet-hero'), false);
  const dbgSize = Math.round(Number($('dbg-size').value)) || 0;
  const L = buildLevel(level, dbgSize ? Math.max(4, Math.min(40, dbgSize)) : 0);
  maze = L.maze;
  S.intro = L.intro;
  S.levelId = level;
  S.modeNow = L.intro?.forceMode ?? settings.mode;
  applyTheme(themeFor(level, L.themeId), Math.max(maze.width, maze.height));
  applyWeather(weatherFor(level, theme, L.weatherId));
  buildMazeMesh();
  // Skuggkameran ska täcka hela labyrinten, även stora banor.
  const reach = Math.max(maze.width, maze.height) / 2 + 3;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -reach;
  sun.shadow.camera.right = sun.shadow.camera.top = reach;
  sun.shadow.camera.updateProjectionMatrix();
  fitMapCamera();

  const dbgStudy = Number($('dbg-study').value) || 0;
  const dbgTime = Number($('dbg-time').value) || 1;
  S.kind = L.mode;
  S.shake = 0;
  S.shakeBurst = 0;
  S.vibrateIn = 0;
  S.hidden = false;
  S.paused = false;
  hero.visible = true;
  S.difficulty = L.d;
  monster.visible = false;
  S.mon = null;
  if (S.kind === 'monster') {
    const plan = L.intro
      ? { delay: L.plan.delay ?? 6, speed: L.plan.monsterSpeed, starLimit: L.plan.starLimit ?? 40 }
      : monsterPlan(maze, L.d, settings.difficulty, dbgTime);
    S.limit = plan.starLimit; // Bara för stjärnorna, ingen tidsgräns.
    S.mon = { plan, delay: plan.delay, awake: false, cell: { ...maze.start }, next: null, t: 0,
      dist: Infinity, map: null, heroKey: '', yaw: 0,
      mode: 'chase', lostTimer: 0, target: null, tmap: null,
      pause: 0, peeking: false, targetKind: 'node', peekYaw: 0, lookBase: 0, lookT: 0 };
  } else if (S.kind === 'free') {
    S.limit = Math.ceil(perfectTime(maze) * 2.5); // Ingen tidsgräns, bara för stjärnorna.
  } else {
    S.limit = L.intro ? L.plan.timeLimit : timeLimit(maze, L.d, settings.difficulty, dbgTime);
  }
  S.timeLeft = S.limit;
  S.elapsed = 0;
  S.wrongTurns = 0;
  S.studyTotal = dbgStudy || L.intro?.studySeconds || STUDY_SECONDS[settings.difficulty];
  S.studyLeft = S.studyTotal;
  S.node = { ...maze.start };
  S.heading = openDirs(maze, maze.start.x, maze.start.y)[0];
  S.run = null;
  S.yaw = YAW[S.heading];
  S.camYaw = S.yaw;
  S.anim.reaction = null;
  S.visits = {};
  S.guide = null;
  S.coachDone = new Set();
  S.coachQueue = [];
  S.compassSeen = false;
  S.barrelSeen = false;
  highlight(null);
  show($('dialog'), false);
  show($('leave'), false);
  show($('hint'), false);
  dialogHandlers = null;

  const p = cellPos(S.node.x, S.node.y);
  hero.position.copy(p);
  hero.rotation.set(0, S.yaw, 0);
  hero.scale.set(1, 1, 1);

  // Navigator: ingen markerad väg. Memory: vägen är markerad under studietiden.
  pathGroup.visible = S.modeNow === 'memory';
  mapIcons.visible = true;
  scene.fog = null;
  scene.background = lawnColor;
  camera = mapCam;
  S.phase = 'study';

  show($('menu'), false);
  show($('result'), false);
  show($('hud'));
  show($('ready'));
  show($('back-study'));
  show($('controls'), false);
  show($('compass'), false);
  show($('rear'), false);
  const wIcon = weather.emoji ? ` ${weather.emoji}` : '';
  const label = S.intro ? `Introduktion ${introIds().indexOf(level) + 1}` : `Bana ${level}`;
  $('hud-level').textContent = (S.kind === 'monster' ? `${label} · Monster` : label) + wIcon;
  show($('danger'), false);
  const study = S.modeNow === 'memory' ? 'Memorera vägen' : 'Hitta och memorera vägen';
  $('hud-phase').textContent = S.kind === 'monster' ? `${study} – tunnor är gömställen` : study;
  updateHud();
  coach('study');
}

function beginPlay() {
  S.phase = 'play';
  pathGroup.visible = false;
  mapIcons.visible = false;
  scene.fog = new THREE.Fog(fogSetting[0], fogSetting[1], fogSetting[2]);
  scene.background = skyTex;
  camera = playCam;
  show($('ready'), false);
  show($('back-study'), false);
  show($('controls'));
  show($('rear'), S.kind === 'monster');
  $('hud-phase').textContent = S.kind === 'monster' ? 'Monstret vaknar snart' : 'Spring!';
  show($('leave'));
  snapCamera();
  arriveAtNode(false);
  coach('play');
}

function updateHud() {
  $('hud-lives').textContent = '❤'.repeat(save.lives) + '♡'.repeat(MAX_LIVES - save.lives);
  $('hud-wrong').textContent = `✗ ${S.wrongTurns}`;
  let frac;
  if (S.phase === 'study') frac = S.studyLeft / S.studyTotal;
  else if (S.kind === 'monster') frac = S.mon && S.mon.awake && S.mon.mode === 'chase' ? Math.min(1, S.mon.dist / 10) : 1;
  else if (S.kind === 'free') frac = 1;
  else frac = Math.max(0, S.timeLeft / S.limit);
  $('bar-fill').style.width = `${frac * 100}%`;
  $('bar-fill').classList.toggle('low', frac < 0.25);
}

// ---------- Rörelse ----------
function availableRel() {
  const rels = {};
  for (const d of openDirs(maze, S.node.x, S.node.y)) rels[relativeDir(S.heading, d)] = d;
  return rels;
}

// ---------- Förklaringar (introduktionsbanorna) ----------
const HIGHLIGHT = {
  ready: '#ready', controls: '#controls', back: '#controls [data-rel="back"]', compass: '#compass',
  bar: '.bar', rear: '#rear', hide: '#hide', unhide: '#unhide', phase: '#hud-phase',
};

function highlight(name) {
  for (const el of document.querySelectorAll('.coach-hi')) el.classList.remove('coach-hi');
  if (name && HIGHLIGHT[name]) document.querySelector(HIGHLIGHT[name])?.classList.add('coach-hi');
}

let dialogHandlers = null;

/** Visar en ruta med text och en eller två knappar. Spelet pausas medan den visas. */
function showDialog({ title, text, primary = 'Okej', secondary = null, onPrimary = null, onSecondary = null, hi = null }) {
  $('dialog-title').textContent = title ?? '';
  show($('dialog-title'), !!title);
  $('dialog-text').textContent = text;
  $('dialog-primary').textContent = primary;
  show($('dialog-secondary'), !!secondary);
  if (secondary) $('dialog-secondary').textContent = secondary;
  dialogHandlers = { onPrimary, onSecondary };
  S.paused = true;
  highlight(hi);
  show($('dialog'));
}

function closeDialog(which) {
  const h = dialogHandlers;
  dialogHandlers = null;
  show($('dialog'), false);
  highlight(null);
  S.paused = false;
  (which === 'secondary' ? h?.onSecondary : h?.onPrimary)?.();
}
$('dialog-primary').onclick = () => closeDialog('primary');
$('dialog-secondary').onclick = () => closeDialog('secondary');

/** Köar förklaringar som hör till ett tillfälle och visar dem en i taget. */
function coach(when) {
  if (!S.intro) return;
  S.intro.steps.forEach((step, i) => {
    if (step.when === when && !S.coachDone.has(i)) {
      S.coachDone.add(i);
      S.coachQueue.push(step);
    }
  });
  nextCoach();
}

function nextCoach() {
  if (dialogHandlers || !S.coachQueue.length) return;
  const step = S.coachQueue.shift();
  showDialog({ title: S.intro.title, text: step.text, hi: step.hi, onPrimary: nextCoach });
}

/** Vid en korsning kan banan peka ut vilken pil man ska trycka på. */
function applyGuide() {
  S.guide = null;
  if (!S.intro) return;
  const key = `${S.node.x},${S.node.y}`;
  S.visits[key] = (S.visits[key] ?? 0) + 1;
  const g = S.intro.guides.find((x) => x.x === S.node.x && x.y === S.node.y);
  if (!g) return;
  const dir = g.dirs[Math.min(S.visits[key] - 1, g.dirs.length - 1)];
  S.guide = { rel: relativeDir(S.heading, dir), text: g.text, only: !!g.only };
}

function arriveAtNode(animate = true) {
  S.run = null;
  const dirs = openDirs(maze, S.node.x, S.node.y);
  const isGoal = S.node.x === maze.goal.x && S.node.y === maze.goal.y;
  if (isGoal) return finish(true);
  react(animate && dirs.length === 1 ? 'deadend' : 'look');
  applyGuide();
  refreshControls();
  if (animate && dirs.length === 1) coach('deadend');
}

function spotHere() {
  return (maze.spots ?? []).find((sp) => sp.x === S.node.x && sp.y === S.node.y && !sp.used);
}

function refreshControls() {
  const rels = availableRel();
  for (const btn of document.querySelectorAll('#controls button[data-rel]')) {
    const rel = btn.dataset.rel;
    const locked = S.guide?.only && S.guide.rel !== rel;
    btn.disabled = S.phase !== 'play' || S.run !== null || S.hidden || !(rel in rels) || !!locked;
    btn.classList.toggle('guide', !!S.guide && S.guide.rel === rel && !btn.disabled);
  }
  // Tips om vilken pil man ska trycka på
  const hintOn = S.phase === 'play' && S.run === null && !S.hidden && !!S.guide?.text;
  show($('hint'), hintOn);
  if (hintOn) $('hint').innerHTML = `<span>${S.guide.text}</span>`;
  const idle = S.phase === 'play' && S.run === null;
  show($('hide'), idle && !S.hidden && !!spotHere());
  show($('unhide'), idle && S.hidden);
  const waiting = S.phase === 'play' && S.run === null;
  show($('compass'), waiting && !S.hidden);
  if (waiting && !S.hidden && !S.compassSeen) { S.compassSeen = true; coach('compass'); }
  if (idle && !S.hidden && spotHere() && !S.barrelSeen) { S.barrelSeen = true; coach('barrel'); }
}

/** Knappen "Göm dig" är låst när monstret är så nära att det ser dig. */
const SEEN_DIST = 3.5;
function updateHideButton() {
  const btn = $('hide');
  if (btn.classList.contains('hidden')) return;
  const m = S.mon;
  const seen = !!m && m.awake && m.mode === 'chase' && m.dist <= SEEN_DIST;
  btn.disabled = seen;
  btn.textContent = seen ? 'För sent, monstret ser dig!' : 'Göm dig i tunnan';
}

function hide() {
  const spot = spotHere();
  if (S.phase !== 'play' || S.run || S.hidden || !spot || S.paused) return;
  if (S.mon?.awake && S.mon.mode === 'chase' && S.mon.dist <= SEEN_DIST) return;
  spot.used = true;
  for (const m of spot.mesh.userData.mats) m.color.set(0x8a8f8c);
  S.hidden = true;
  hero.visible = false;
  const m = S.mon;
  if (m && m.awake && m.mode === 'chase' && m.dist > SEEN_DIST) {
    // Monstret såg inte var du tog vägen och går och letar.
    m.mode = 'lost';
    m.lostTimer = { easy: 10, medium: 8, hard: 6 }[settings.difficulty] ?? 8;
    m.next = null;
    m.tmap = null;
  }
  refreshControls();
  coach('hidden');
}

function unhide() {
  if (!S.hidden) return;
  S.hidden = false;
  hero.visible = true;
  refreshControls();
}

function choose(rel) {
  if (S.phase !== 'play' || S.run || S.hidden || S.paused) return;
  if (S.guide?.only && S.guide.rel !== rel) return;
  const rels = availableRel();
  if (!(rel in rels)) return;
  const dir = rels[rel];
  const corridor = walkCorridor(maze, S.node, dir);
  const pts = [cellPos(S.node.x, S.node.y), ...corridor.cells.map((c) => cellPos(c.x, c.y))];
  S.run = { pts, seg: 0, t: 0, to: corridor.to, heading: corridor.heading, wrong: corridor.wrong, dir };
  S.yaw = YAW[dir];
  // Vid en vändning vrider sig kameran snabbt men mjukt i stället för att svepa långsamt.
  if (rel === 'back' || Math.abs(angleDiff(S.camYaw, S.yaw)) > 2.2) S.uturn = true;
  S.anim.reaction = null;
  refreshControls();
}

function stepRun(dt) {
  const run = S.run;
  let move = RUN_SPEED * dt;
  while (move > 0 && run.seg < run.pts.length - 1) {
    const a = run.pts[run.seg];
    const b = run.pts[run.seg + 1];
    const len = a.distanceTo(b);
    const remaining = len * (1 - run.t);
    // Följ kurvor: rikta figuren mot nästa delsträcka.
    const dx = b.x - a.x; const dz = b.z - a.z;
    S.yaw = Math.atan2(dx, dz);
    if (move >= remaining) {
      move -= remaining;
      run.seg++;
      run.t = 0;
    } else {
      run.t += move / len;
      move = 0;
    }
    const cur = run.pts[Math.min(run.seg, run.pts.length - 1)];
    const nxt = run.pts[Math.min(run.seg + 1, run.pts.length - 1)];
    hero.position.lerpVectors(cur, nxt, run.t);
  }
  if (run.seg >= run.pts.length - 1) {
    hero.position.copy(run.pts[run.pts.length - 1]);
    if (run.wrong) { S.wrongTurns++; }
    S.node = { ...run.to };
    S.heading = run.heading;
    S.yaw = YAW[S.heading];
    arriveAtNode();
    updateHud();
  }
}

// ---------- Monster ----------
function cellKey(c) { return `${c.x},${c.y}`; }

/** Väljer var monstret letar härnäst: en korsning eller en annan tunna. */
function pickWanderTarget(m) {
  const map = distances(maze, m.cell);
  // Monstret letar aldrig nära spelarens gömställe.
  const nearHero = distances(maze, S.node);
  const junctions = [];
  for (const [k, d] of map) {
    if (d < 4 || d > 14) continue;
    const [x, y] = k.split(',').map(Number);
    if ((nearHero.get(k) ?? 99) < 4) continue;
    if (openDirs(maze, x, y).length >= 3) junctions.push({ x, y });
  }
  // Andra tunnor än den du gömmer dig i
  const barrels = (maze.spots ?? []).filter((sp) =>
    (nearHero.get(`${sp.x},${sp.y}`) ?? 99) >= 4 && (map.get(`${sp.x},${sp.y}`) ?? 99) <= 18);
  let target;
  if (barrels.length && (Math.random() < 0.45 || !junctions.length)) {
    const sp = barrels[Math.floor(Math.random() * barrels.length)];
    target = { x: sp.x, y: sp.y };
    m.targetKind = 'barrel';
    m.peekYaw = YAW[OPPOSITE[sp.dir]];
  } else if (junctions.length) {
    target = junctions[Math.floor(Math.random() * junctions.length)];
    m.targetKind = 'node';
  } else {
    const far = [...map].filter(([, d]) => d >= 5);
    const pick = far.length ? far[Math.floor(Math.random() * far.length)][0] : cellKey(m.cell);
    const [x, y] = pick.split(',').map(Number);
    target = { x, y };
    m.targetKind = 'node';
  }
  m.target = target;
  m.tmap = distances(maze, target);
}

function updateMonster(dt) {
  const m = S.mon;
  if (!m || S.phase !== 'play') return;
  if (!m.awake) {
    m.delay -= dt;
    $('hud-phase').textContent = `Monstret vaknar om ${Math.max(1, Math.ceil(m.delay))} s`;
    if (m.delay > 0) return;
    m.awake = true;
    monster.visible = true;
    monster.position.copy(cellPos(m.cell.x, m.cell.y));
    show($('danger'));
    S.shakeBurst = 0.7; // ett kort skak när monstret vaknar
    navigator.vibrate?.(80);
    coach('monsterWake');
    if (S.hidden) { m.mode = 'lost'; m.lostTimer = 8; }
  }
  // Håll koll på var spelaren är och hur långt monstret har dit.
  const hx = Math.round(hero.position.x + maze.width / 2 - 0.5);
  const hy = Math.round(hero.position.z + maze.height / 2 - 0.5);
  const heroKey = `${hx},${hy}`;
  if (heroKey !== m.heroKey) {
    m.heroKey = heroKey;
    m.map = distances(maze, { x: hx, y: hy });
  }
  m.dist = m.map.get(cellKey(m.cell)) ?? Infinity;

  // Monstret sover efter att det har gett upp, och vaknar efter en stund vid starten.
  if (m.mode === 'asleep') {
    m.sleep -= dt;
    monster.visible = false;
    $('hud-phase').textContent = S.hidden
      ? 'Monstret har gett upp. Du kan komma fram!'
      : `Monstret sover. Spring! (vaknar om ${Math.max(1, Math.ceil(m.sleep))} s)`;
    updateHideButton();
    if (m.sleep <= 0) {
      m.mode = 'chase';
      m.cell = { ...maze.start };
      m.next = null;
      m.tmap = null;
      monster.visible = true;
      monster.position.copy(cellPos(m.cell.x, m.cell.y));
      S.shakeBurst = 0.7;
      navigator.vibrate?.(80);
    }
    S.shake += (0 - S.shake) * Math.min(1, dt * 4);
    return;
  }

  if (m.mode === 'lost') {
    m.lostTimer -= dt;
    // Ser monstret dig när du är framme och det är nära tar det upp jakten igen.
    if (!S.hidden && m.dist <= 6) { m.mode = 'chase'; m.next = null; m.tmap = null; m.pause = 0; m.peeking = false; }
    else if (m.lostTimer <= 0) {
      // Monstret ger upp och går tillbaka till starten.
      m.mode = 'retreat';
      m.next = null;
      m.pause = 0;
      m.peeking = false;
      m.tmap = distances(maze, maze.start);
    }
  }
  const lost = m.mode === 'lost';
  const retreat = m.mode === 'retreat';
  $('hud-phase').textContent = S.hidden
    ? (lost ? 'Du är gömd. Monstret letar…' : retreat ? 'Monstret ger upp och går tillbaka…' : 'Monstret såg dig, och kommer!')
    : (lost ? 'Monstret har tappat bort dig. Spring!' : retreat ? 'Monstret går tillbaka. Spring!' : 'Monstret jagar dig!');

  let steer = m.map;
  let moving = true;
  if (lost) {
    if (m.pause > 0) {
      // Monstret stannar och tittar sig omkring, eller kikar in i en tunna.
      m.pause -= dt;
      m.lookT += dt;
      m.yaw = m.peeking ? m.peekYaw : m.lookBase + Math.sin(m.lookT * 3.2) * 1.1;
      if (m.pause <= 0) { m.tmap = null; m.peeking = false; }
      moving = false;
    } else if (!m.tmap) {
      pickWanderTarget(m);
    } else if (!m.next && m.cell.x === m.target.x && m.cell.y === m.target.y) {
      m.pause = m.targetKind === 'barrel' ? 2.1 : 1.6;
      m.peeking = m.targetKind === 'barrel';
      m.lookT = 0;
      m.lookBase = m.yaw;
      moving = false;
    }
    if (m.tmap) steer = m.tmap;
  }
  if (S.hidden && lost && m.pause > 0) {
    $('hud-phase').textContent = m.peeking ? 'Monstret kikar in i en tunna…' : 'Monstret tittar sig omkring…';
  }
  if (retreat) {
    steer = m.tmap;
    if (!m.next && m.cell.x === maze.start.x && m.cell.y === maze.start.y) {
      m.mode = 'asleep';
      m.sleep = (m.plan.delay ?? 5) + 2;
      monster.visible = false;
      if (S.hidden) coach('gaveUp');
      return;
    }
  }
  if (moving && !m.next) {
    const here = steer.get(cellKey(m.cell));
    const d = openDirs(maze, m.cell.x, m.cell.y).find((dir) =>
      steer.get(`${m.cell.x + DELTA[dir].dx},${m.cell.y + DELTA[dir].dy}`) === here - 1);
    if (d) {
      m.next = { x: m.cell.x + DELTA[d].dx, y: m.cell.y + DELTA[d].dy };
      m.t = 0;
      m.yaw = Math.atan2(DELTA[d].dx, DELTA[d].dy);
    }
  }
  if (moving && m.next) {
    m.t += m.plan.speed * (retreat ? 1.8 : 1) * dt;
    const a = cellPos(m.cell.x, m.cell.y);
    const b = cellPos(m.next.x, m.next.y);
    monster.position.lerpVectors(a, b, Math.min(1, m.t));
    if (m.t >= 1) { m.cell = m.next; m.next = null; }
  }
  // Förvarning: kameran darrar och skärmen pulserar allt mer ju närmare monstret kommer.
  const close = !S.hidden && !lost && !retreat ? Math.max(0, Math.min(1, (8 - m.dist) / 8)) : 0;
  m.close = close;
  S.shake += ((close * close * 0.07) - S.shake) * Math.min(1, dt * 4);
  if (close > 0.6 && S.vibrateIn <= 0) {
    navigator.vibrate?.(30);
    S.vibrateIn = 0.7;
  }
  S.vibrateIn -= dt;
  const dx = monster.position.x - hero.position.x;
  const dz = monster.position.z - hero.position.z;
  // Gömd är du trygg om monstret inte såg dig gömma dig.
  const reach = S.hidden ? (lost || retreat ? 0 : 1.2) : 0.55;
  updateHideButton();
  if (reach && Math.hypot(dx, dz) < reach) finish(false, 'monster');
}

function animateMonster(dt) {
  if (!monster.visible || !S.mon) return;
  const t = performance.now() / 1000;
  const m = S.mon;
  monster.position.y = Math.abs(Math.sin(t * 9)) * 0.08 + (monster.userData.float ?? 0);
  monster.rotation.y = lerpAngle(monster.rotation.y, m.yaw, Math.min(1, dt * 10));
  // Lutar sig framåt när det kikar in i en tunna
  monster.rotation.x += ((m.peeking && m.pause > 0 ? 0.5 : 0) - monster.rotation.x) * Math.min(1, dt * 8);
  monster.scale.set(1 + Math.sin(t * 9) * 0.03, 1 - Math.sin(t * 9) * 0.03, 1);
  // Röd kant som pulserar som ett hjärtslag och blir starkare och snabbare ju närmare det är
  const close = m.mode === 'lost' || S.hidden ? 0 : (m.close ?? 0);
  const pulse = 0.72 + 0.28 * Math.sin(t * (4 + close * 8));
  $('danger').style.opacity = S.phase === 'play' ? Math.min(0.75, close * 0.9 * pulse) : 0;
}

// ---------- Reaktioner ----------
function react(kind) {
  S.anim.reaction = kind;
  S.anim.reactionT = 0;
}

function animateHero(dt) {
  const { head, body, legs, arms, face, dangles, tail, ears } = hero.userData;
  const a = S.anim;
  a.t += dt;
  const t = a.t;
  const running = S.run !== null;
  const BODY_Y = 1.08;

  // Grundläge som animationerna utgår från
  head.rotation.set(0, 0, 0);
  body.scale.y = BODY_Y;
  hero.rotation.z = 0;
  hero.rotation.y = lerpAngle(hero.rotation.y, S.yaw, Math.min(1, dt * 14));
  for (const arm of arms) arm.rotation.set(0, 0, 0);
  if (tail) tail.rotation.set(0, 0, 0);
  for (const e of ears) e.rotation.set(0, 0, 0);
  for (const d of dangles) d.rotation.set(0, 0, 0);
  face.mouth.rotation.z = Math.PI;

  // Blinkar då och då
  a.blinkIn -= dt;
  if (a.blinkIn < -0.12) a.blinkIn = 2 + Math.random() * 3;
  face.eyes.scale.y = a.blinkIn < 0 ? 0.1 : 1;

  const ud = hero.userData;
  if (running) {
    const f = t * 16;
    const s = Math.sin(f);
    hero.position.y = Math.abs(s) * 0.07;
    legs[0].position.z = s * 0.12;
    legs[1].position.z = -s * 0.12;
    body.rotation.x = 0.12;
    arms[0].rotation.x = s * 0.9;
    arms[1].rotation.x = -s * 0.9;
    for (const d of dangles) d.rotation.x = Math.sin(f + 1) * 0.35;
    for (const e of ears) e.rotation.x = Math.sin(f) * 0.15;
    if (tail) tail.rotation.y = Math.sin(t * 14) * 0.5;

    // Tittar bakåt över axeln då och då, så att man ser ansiktet.
    a.glanceIn -= dt;
    if (a.glanceT < 0 && a.glanceIn <= 0) a.glanceT = 0;
    if (a.glanceT >= 0) {
      a.glanceT += dt;
      const k = a.glanceT / 1.2;
      if (k >= 1) {
        a.glanceT = -1;
        a.glanceIn = 3 + Math.random() * 3;
      } else {
        const bump = Math.min(1, Math.sin(k * Math.PI) * 1.8);
        head.rotation.y = bump * 2.3;
        head.rotation.z = bump * 0.12;
      }
    }
  } else {
    a.glanceT = -1;
    a.glanceIn = 1.5 + Math.random() * 2;
    hero.position.y = 0;
    legs[0].position.z = legs[1].position.z = 0;
    body.rotation.x = 0;
    for (const d of dangles) d.rotation.x = Math.sin(t * 2) * 0.08;
    if (tail) tail.rotation.y = Math.sin(t * 5) * 0.3;
    ears.forEach((e, i) => { e.rotation.z = Math.sin(t * 3 + i * 2) * 0.06; });

    const r = a.reaction;
    a.reactionT += dt;
    const rt = a.reactionT;
    if (r === 'look' || r === 'idle') {
      // Vänder sig snabbt mot kameran och vinkar, tittar sedan runt och kliar sig i huvudet.
      const c = rt % 9;
      if (c < 3.4) {
        const k = Math.min(1, c * 5);
        head.rotation.y = k * 2.3;
        head.rotation.z = k * 0.1;
        arms[1].rotation.z = (2.5 + Math.sin(c * 11) * 0.35) * k;
      } else if (c < 5.4) {
        const k = Math.min(1, (c - 3.4) * 4);
        head.rotation.y = Math.sin((c - 3.4) * 3) * 0.7 * k;
      } else {
        const k = Math.min(1, (c - 5.4) * 3);
        head.rotation.z = Math.sin(c * 14) * 0.12 * k;
        arms[0].rotation.z = -2.3 * k;
        hero.position.y = Math.abs(Math.sin(c * 7)) * 0.015;
      }
    } else if (r === 'deadend') {
      head.rotation.y = Math.sin(rt * 14) * 0.5 * Math.max(0, 1 - rt);
      body.scale.y = BODY_Y - 0.12 * Math.max(0, 1 - rt);
      const k = Math.min(1, rt * 4) * (rt < 1.6 ? 1 : 0);
      arms[0].rotation.z = -0.9 * k;
      arms[1].rotation.z = 0.9 * k;
      if (rt > 1.6) { a.reaction = 'look'; a.reactionT = 0; }
    } else if (r === 'win') {
      hero.position.y = Math.abs(Math.sin(rt * 6)) * 0.35;
      hero.rotation.y += dt * 6;
      arms[0].rotation.z = -2.7;
      arms[1].rotation.z = 2.7;
      if (tail) tail.rotation.y = Math.sin(t * 20) * 0.7;
    } else if (r === 'lose') {
      body.scale.y = BODY_Y - 0.2 * Math.min(1, rt * 2);
      head.rotation.x = 0.45 * Math.min(1, rt * 2);
      hero.rotation.z = Math.sin(rt * 2) * 0.05;
      face.mouth.rotation.z = 0;
    }
  }
  // Tillbehör: paraplyet hålls ut åt sidan och halsduken fladdrar
  if (ud.hold === 'umbrella' && a.reaction !== 'win') arms[1].rotation.set(0, 0, 2.5);
  if (ud.hold === 'torch' && a.reaction !== 'win') arms[1].rotation.set(-1.4, 0, -0.08);
  for (const f of ud.flutter ?? []) {
    f.mesh.position.y = Math.sin(t * 9 + f.i * 0.9) * 0.02 * (f.i + 1) * (running ? 1.4 : 0.6);
    f.mesh.rotation.y = Math.sin(t * 8 + f.i) * (0.15 + f.i * 0.12);
  }
}

// ---------- Kamera ----------
function snapCamera() {
  S.camYaw = S.yaw;
  S.camVel = 0;
  S.uturn = false;
  placeCamera(1);
}

function placeCamera(blend) {
  // Följ figurens plats på marken, inte dess studsande löpsteg.
  const pos = new THREE.Vector3(hero.position.x, 0, hero.position.z);
  const fwd = new THREE.Vector3(Math.sin(S.camYaw), 0, Math.cos(S.camYaw));
  const target = pos.clone().addScaledVector(fwd, 1.3);
  target.y = 0.55;
  const want = pos.clone().addScaledVector(fwd, -3.4);
  want.y = 3.0;
  playCam.position.lerp(want, blend);
  const shake = S.phase === 'play' ? S.shake + Math.max(0, S.shakeBurst) * 0.1 : 0;
  if (shake > 0.001) {
    playCam.position.x += (Math.random() - 0.5) * shake;
    playCam.position.y += (Math.random() - 0.5) * shake;
    playCam.position.z += (Math.random() - 0.5) * shake;
  }
  playCam.lookAt(target);
}

function updateCompass() {
  // Visar var norr är relativt figurens riktning (framåt = uppåt).
  const deg = ((S.camYaw - Math.PI) * 180) / Math.PI;
  $('needle').style.transform = `rotate(${deg}deg)`;
}

// ---------- Slut ----------
function finish(win, reason = 'time') {
  S.phase = 'ended';
  react(win ? 'win' : 'lose');
  show($('controls'), false);
  show($('compass'), false);
  show($('danger'), false);
  show($('rear'), false);
  show($('leave'), false);
  show($('hint'), false);
  S.hidden = false;
  hero.visible = true;
  const used = S.elapsed;
  const key = `${S.modeNow}:${settings.difficulty}:${settings.level}`;

  let stars = 0;
  if (win) {
    stars = starsFor({ wrongTurns: S.wrongTurns, timeUsed: used, limit: S.limit });
    save.stars[key] = Math.max(save.stars[key] || 0, stars);
    if (S.intro) { save.intro = save.intro ?? {}; save.intro[settings.level] = true; }
  } else if (!S.intro) {
    save.lives = Math.max(0, save.lives - 1);
  }
  writeSave();
  updateHud();

  setTimeout(() => {
    $('res-title').textContent = win ? 'Du hittade ut!' : reason === 'monster' ? 'Monstret hann ikapp dig' : 'Tiden tog slut';
    $('res-stars').innerHTML = [0, 1, 2]
      .map((i) => `<span class="${i < stars ? '' : 'off'}">★</span>`).join('');
    $('res-text').textContent = win
      ? `${used.toFixed(1)} sek · ${S.wrongTurns} felval`
      : S.intro ? 'Försök igen. Det kostar inget liv i introduktionen.'
        : save.lives > 0 ? `Du har ${save.lives} liv kvar.` : 'Slut på liv. Du får fem nya.';
    if (!win && !S.intro && save.lives === 0) { save.lives = MAX_LIVES; writeSave(); }
    show($('res-next'), win);
    show($('result'));
  }, win ? 1400 : 1200);
}

// ---------- Väggar som skymmer blir genomskinliga ----------
// Väggarna mellan kameran och figuren ritas halvgenomskinligt, medan väggarna bakom
// figuren är solida. De stannar genomskinliga en stund så att de inte flimrar.
const FADE_ALPHA = 0.42;
const FADE_HOLD = 0.7; // sekunder som en vägg stannar genomskinlig
let fadeTick = 0;

/** Samlar väggarna som en stråle från `from` till `to` går igenom. */
function sampleWalls(from, to, out) {
  const dir = to.clone().sub(from);
  const len = dir.length();
  const steps = Math.ceil(len / 0.12);
  const tol = WALL_T / 2 + 0.07;
  const W = maze.width;
  const H = maze.height;
  for (let k = 1; k <= steps; k++) {
    if ((k / steps) * len > len - 0.25) break;
    const p = from.clone().addScaledVector(dir, k / steps);
    if (p.y > WALL_H + 0.05) continue;
    const u = p.x + W / 2;
    const v = p.z + H / 2;
    const j = Math.round(v);
    if (Math.abs(v - j) < tol) {
      const id = wallIndex.get(`H:${Math.floor(u)}:${j}`);
      if (id !== undefined) out.add(id);
    }
    const i2 = Math.round(u);
    if (Math.abs(u - i2) < tol) {
      const id = wallIndex.get(`V:${i2}:${Math.floor(v)}`);
      if (id !== undefined) out.add(id);
    }
  }
}

function updateFade(dt) {
  if (S.phase === 'play' && walls.length) {
    fadeTick = (fadeTick + 1) % 2; // räcker att kolla varannan bildruta
    if (fadeTick === 0) {
      const to = new THREE.Vector3(hero.position.x, 0.5, hero.position.z);
      const from = playCam.position;
      const side = new THREE.Vector3(to.z - from.z, 0, -(to.x - from.x)).normalize().multiplyScalar(0.22);
      const hits = new Set();
      sampleWalls(from, to, hits);
      sampleWalls(from.clone().add(side), to.clone().add(side), hits);
      sampleWalls(from.clone().sub(side), to.clone().sub(side), hits);
      let changed = false;
      for (const id of hits) {
        const e = cut.get(id);
        if (e) e.hold = FADE_HOLD;
        else if (cut.size < GHOST_MAX) {
          cut.set(id, { alpha: 1, hold: FADE_HOLD });
          hideWall(id);
          changed = true;
        }
      }
      if (changed) {
        wallSides.instanceMatrix.needsUpdate = true;
        wallTops.instanceMatrix.needsUpdate = true;
      }
    }
  }
  if (!cut.size) {
    if (ghostSides.count) ghostSides.count = ghostTops.count = 0;
    return;
  }
  let restored = false;
  let slot = 0;
  for (const [id, e] of cut) {
    e.hold -= dt;
    const goal = S.phase === 'play' && e.hold > 0 ? FADE_ALPHA : 1;
    const rate = goal < e.alpha ? 4 : 1.5; // snabbt genomskinlig, långsamt tillbaka
    e.alpha += Math.sign(goal - e.alpha) * Math.min(Math.abs(goal - e.alpha), dt * rate);
    if (goal === 1 && e.alpha >= 0.999) {
      setWallMatrix(id, 1);
      cut.delete(id);
      restored = true;
      continue;
    }
    computeWallMatrix(id, 1);
    ghostSides.setMatrixAt(slot, dummy.matrix);
    ghostTops.setMatrixAt(slot, dummy.matrix);
    ghostAlpha.array[slot] = e.alpha;
    slot++;
  }
  ghostSides.count = ghostTops.count = slot;
  ghostSides.instanceMatrix.needsUpdate = true;
  ghostTops.instanceMatrix.needsUpdate = true;
  ghostAlpha.needsUpdate = true;
  if (restored) {
    wallSides.instanceMatrix.needsUpdate = true;
    wallTops.instanceMatrix.needsUpdate = true;
  }
}

// ---------- Backspegel ----------
// Visar vyn bakåt i en ruta, så att kameran inte behöver vridas.
function renderRear() {
  const r = $('rear').getBoundingClientRect();
  if (!r.width) return;
  const fwd = new THREE.Vector3(Math.sin(S.camYaw), 0, Math.cos(S.camYaw));
  const pos = new THREE.Vector3(hero.position.x, 0, hero.position.z);
  rearCam.position.copy(pos).addScaledVector(fwd, -0.25);
  rearCam.position.y = 1.7;
  rearCam.lookAt(pos.clone().addScaledVector(fwd, -3).setY(0.3));
  rearCam.aspect = r.width / r.height;
  rearCam.updateProjectionMatrix();
  const h = window.innerHeight;
  renderer.setScissorTest(true);
  renderer.setViewport(r.left, h - r.bottom, r.width, r.height);
  renderer.setScissor(r.left, h - r.bottom, r.width, r.height);
  renderer.render(scene, rearCam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, h);
}

// ---------- Huvudloop ----------
let last = performance.now();
function frame(now) {
  const dt = S.paused ? 0 : Math.min(0.05, (now - last) / 1000);
  last = now;

  if (S.phase === 'study') {
    S.studyLeft -= dt;
    if (S.studyLeft <= 0) beginPlay();
    updateHud();
    const star = mazeGroup.getObjectByName('goalStar');
    if (star) star.rotation.y += dt * 2;
  } else if (S.phase === 'play') {
    S.elapsed += dt;
    if (S.kind === 'time') S.timeLeft -= dt;
    if (S.kind === 'time' && S.timeLeft <= 0) {
      S.timeLeft = 0;
      S.run = null;
      finish(false);
    } else {
      if (S.run) stepRun(dt);
      updateMonster(dt);
    }
    updateHud();
  }

  animateMonster(dt);
  if (S.phase !== 'menu' && S.phase !== 'study') {
    animateHero(dt);
    // Kameran vrider sig mjukt och långsamt efter figuren (mindre åksjuka).
    // Hastigheten är begränsad och accelererar långsamt.
    const uturnRate = ((Number($('dbg-uturn').value) || 280) * Math.PI) / 180;
    const maxRate = S.uturn ? uturnRate : ((Number($('dbg-cam').value) || 60) * Math.PI) / 180;
    const gain = S.uturn ? 5 : 1.6;
    const want = Math.max(-maxRate, Math.min(maxRate, angleDiff(S.camYaw, S.yaw) * gain));
    S.camVel += (want - S.camVel) * Math.min(1, dt * (S.uturn ? 9 : 3));
    if (S.uturn && Math.abs(angleDiff(S.camYaw, S.yaw)) < 0.3) S.uturn = false;
    S.camYaw += S.camVel * dt;
    placeCamera(Math.min(1, dt * 12));
    updateCompass();
  } else if (S.phase === 'study') {
    animateHero(dt);
  }
  if (S.phase === 'ended') {
    // Titta på figuren när det är över.
    const star = mazeGroup.getObjectByName('goalStar');
    if (star) star.rotation.y += dt * 2;
  }

  if (maze) {
    S.shakeBurst -= dt;
    updateFade(dt);
    updateFx(dt);
    beam.visible = weather.id === 'night' && (S.phase === 'play' || S.phase === 'ended');
    renderer.render(scene, camera);
    if (S.phase === 'play' && S.kind === 'monster') renderRear();
  }
  requestAnimationFrame(frame);
}

// ---------- Menyer och input ----------
/** Alla banor i kartan, nerifrån: introduktionsbanorna först, sedan de vanliga. */
function levelOrder() {
  const ids = [...introIds()];
  const n = levelCount();
  for (let l = 1; l <= n; l++) ids.push(l);
  return ids;
}

/** Typ och namn på en bana, till kartan. Betyget från banans analys används om det finns. */
function levelType(level) {
  const p = levelInfo(level);
  if (p.intro) return { key: 'intro', label: 'Introduktion', p };
  if (p.mode === 'monster') return { key: 'monster', label: 'Monster', p };
  const band = p.label ?? (p.d < 0.35 ? 'easy' : p.d < 0.65 ? 'mid' : 'hard');
  return { key: band, label: { easy: 'Lätt', mid: 'Medel', hard: 'Svår' }[band], p };
}

function bestStars(level) {
  let best = 0;
  for (const [k, v] of Object.entries(save.stars)) {
    if (Number(k.split(':')[2]) === level) best = Math.max(best, v);
  }
  return best;
}

function totalStars() {
  let sum = 0;
  for (let l = 1; l <= levelCount(); l++) sum += bestStars(l);
  return sum;
}

const heroUnlocked = (c) => !!save.unlockAll || totalStars() >= c.stars;
const heroEmoji = () => (CHARACTERS.find((c) => c.id === (save.hero || 'kille')) ?? CHARACTERS[0]).emoji;
// Deterministisk slump till kartans dekorationer.
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

const ROW = 100;
function renderMap(scroll = false) {
  const map = $('map');
  const inner = $('map-inner');
  const W = map.clientWidth || window.innerWidth;
  const ids = levelOrder();
  const total = ids.length;
  const H = total * ROW + 220;
  const pos = ids.map((_, k) => ({ x: W / 2 + W * 0.26 * Math.sin((k + 1) * 0.9), y: H - 110 - k * ROW }));
  inner.style.height = `${H}px`;

  // Grusgången som slingrar mellan banorna
  let d = `M ${pos[0].x} ${pos[0].y + 60} L ${pos[0].x} ${pos[0].y}`;
  for (let k = 1; k < pos.length - 1; k++) {
    d += ` Q ${pos[k].x} ${pos[k].y} ${(pos[k].x + pos[k + 1].x) / 2} ${(pos[k].y + pos[k + 1].y) / 2}`;
  }
  d += ` L ${pos[pos.length - 1].x} ${pos[pos.length - 1].y}`;
  let html = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="#4d6b36" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#b9ad98" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#d8d0bf" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>
  </svg>`;

  // Häckar och träd vid sidan om gången
  for (let k = 0; k < total; k++) {
    const p = pos[k];
    for (let n = 0; n < 2; n++) {
      const r = hash((k + 1) * 7 + n);
      const onRight = p.x < W / 2 ? n === 0 : n === 1;
      const room = onRight ? W - p.x - 70 : p.x - 70;
      if (room < 50) continue;
      const x = onRight ? p.x + 60 + r * (room - 40) : p.x - 60 - r * (room - 40) - 40;
      const y = p.y - 40 + hash((k + 1) * 13 + n) * 80;
      if (hash((k + 1) * 3 + n) < 0.5) {
        html += `<div class="deco hedge" style="left:${x}px;top:${y}px;width:${40 + r * 40}px;height:${22 + r * 8}px"></div>`;
      } else {
        html += `<div class="deco tree" style="left:${x}px;top:${y}px"></div>`;
      }
    }
  }

  const intros = introIds();
  ids.forEach((id, k) => {
    const t = levelType(id);
    const best = bestStars(id);
    const sel = id === settings.level;
    const isI = isIntro(id);
    const number = isI ? intros.indexOf(id) + 1 : id;
    const done = isI && save.intro?.[id];
    html += `<button class="node ${t.key}${sel ? ' sel' : ''}" data-level="${id}" style="left:${pos[k].x}px;top:${pos[k].y}px" aria-label="${isI ? `Introduktion ${number}` : `Bana ${id}`}, ${t.label}">`
      + `${number}`
      + (t.key === 'monster' ? '<span class="mons">👾</span>' : '')
      + (isI ? `<span class="mons">${done ? '✅' : '🎓'}</span>` : '')
      + (sel ? `<span class="me">${heroEmoji()}</span>` : '')
      + `<span class="st">${'★'.repeat(best)}<span class="off">${'★'.repeat(3 - best)}</span></span></button>`;
  });
  inner.innerHTML = html;
  if (scroll) {
    const y = pos[Math.max(0, ids.indexOf(settings.level))].y;
    map.scrollTop = Math.max(0, y - map.clientHeight * 0.55);
  }
}

function refreshMenu(scroll = false) {
  $('stat-stars').textContent = `★ ${totalStars()}`;
  $('stat-lives').textContent = `❤ ${save.lives}`;
  $('hero-emoji').textContent = heroEmoji();
  const t = levelType(settings.level);
  const th = themeFor(settings.level, t.p.themeId);
  const w = weatherFor(settings.level, th, t.p.weatherId);
  if (t.p.intro) {
    const n = introIds().indexOf(settings.level) + 1;
    $('lvl-info').textContent = `Introduktion ${n}: ${t.p.intro.title} · ${t.p.width}×${t.p.height} rutor`;
    $('play').textContent = `Spela introduktion ${n}`;
  } else {
    $('lvl-info').textContent = `Bana ${settings.level} · ${th.name}${w.name ? ` · ${w.emoji} ${w.name}` : ''} · ${t.label} · ${t.p.width}×${t.p.height} rutor`;
    $('play').textContent = `Spela bana ${settings.level}`;
  }
  renderMap(scroll);
}

$('map-inner').addEventListener('click', (e) => {
  const node = e.target.closest('.node');
  if (!node) return;
  settings.level = Number(node.dataset.level);
  save.level = settings.level;
  writeSave();
  refreshMenu();
});

function renderHeroes(message) {
  const total = totalStars();
  $('hero-stars').textContent = message ?? `Du har ${total} ★. Samla stjärnor för att låsa upp fler figurer.`;
  $('hero-grid').innerHTML = CHARACTERS.map((c) => {
    const open = heroUnlocked(c);
    const on = (save.hero || 'kille') === c.id;
    return `<button class="hero-card${on ? ' on' : ''}${open ? '' : ' locked'}" data-id="${c.id}">`
      + `<span class="em">${c.emoji}</span>${c.name}`
      + `<small>${open ? (on ? 'Vald' : '&nbsp;') : `🔒 ${c.stars} ★`}</small></button>`;
  }).join('');
}

$('hero-grid').addEventListener('click', (e) => {
  const card = e.target.closest('.hero-card');
  if (!card) return;
  const c = CHARACTERS.find((x) => x.id === card.dataset.id);
  if (!heroUnlocked(c)) {
    renderHeroes(`${c.name} låses upp med ${c.stars} ★. Du har ${totalStars()}.`);
    return;
  }
  setHero(c.id);
  renderHeroes();
  refreshMenu();
});
$('hero-btn').onclick = () => { renderHeroes(); show($('sheet-hero')); };
$('hero-close').onclick = () => show($('sheet-hero'), false);
$('settings-btn').onclick = () => show($('sheet-settings'));
$('settings-close').onclick = () => { show($('sheet-settings'), false); refreshMenu(); };

$('dbg-unlock').checked = !!save.unlockAll;
$('dbg-unlock').onchange = () => { save.unlockAll = $('dbg-unlock').checked; writeSave(); };

function bindSeg(id, field) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings[field] = b.dataset.v;
    for (const x of $(id).children) x.classList.toggle('on', x === b);
  });
}
bindSeg('seg-mode', 'mode');
bindSeg('seg-diff', 'difficulty');

$('play').onclick = startLevel;
$('ready').onclick = beginPlay;
$('res-again').onclick = startLevel;
$('res-next').onclick = () => {
  const ids = levelOrder();
  const k = ids.indexOf(settings.level);
  settings.level = ids[Math.min(ids.length - 1, k + 1)];
  startLevel();
};
function backToMenu() {
  S.phase = 'menu';
  S.paused = false;
  show($('leave'), false);
  show($('hint'), false);
  show($('dialog'), false);
  highlight(null);
  dialogHandlers = null;
  show($('result'), false);
  show($('hud'), false);
  show($('ready'), false);
  show($('menu'));
  refreshMenu(true);
  show($('back-study'), false);
  show($('danger'), false);
  show($('rear'), false);
}
$('res-menu').onclick = backToMenu;

/** Att lämna en bana mitt under spelet kostar ett liv (utom i introduktionen). */
$('leave').onclick = () => {
  if (S.phase !== 'play' || dialogHandlers) return;
  showDialog({
    title: 'Lämna banan?',
    text: S.intro ? 'Du kan försöka igen när du vill. Det kostar inget liv i introduktionen.' : 'Du förlorar ett liv om du lämnar nu.',
    primary: 'Lämna',
    secondary: 'Fortsätt',
    onPrimary: () => {
      if (!S.intro) {
        save.lives = Math.max(0, save.lives - 1);
        if (save.lives === 0) save.lives = MAX_LIVES;
        writeSave();
      }
      backToMenu();
    },
  });
};
$('back-study').onclick = backToMenu;
$('reset-save').onclick = () => {
  save.stars = {}; save.lives = MAX_LIVES; save.level = null; save.intro = {}; settings.level = firstLevel(); writeSave(); refreshMenu(true);
};

for (const btn of document.querySelectorAll('#controls button[data-rel]')) {
  btn.addEventListener('click', () => choose(btn.dataset.rel));
}
$('hide').onclick = hide;
$('unhide').onclick = unhide;
window.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'forward', ArrowDown: 'back' };
  if (map[e.key] && !S.paused) { e.preventDefault(); choose(map[e.key]); }
  if (e.key === 'Enter' && dialogHandlers) closeDialog('primary');
  else if (e.key === 'Enter' && S.phase === 'study' && !S.paused) beginPlay();
  if (e.key === 'h') (S.hidden ? unhide : hide)();
});

// Test- och felsökningskrok
window.__game = { S, setMonster, get monster() { return monster; }, stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, walls: walls.length, geometries: renderer.info.memory.geometries }), get weather() { return weather; }, applyWeather, setHero, get hero() { return hero; }, refreshControls, settings, startLevel, beginPlay, choose, hide, unhide, get maze() { return maze; } };

resize();
// Nya spelare börjar med första introduktionsbanan. Banorna läses från levels.json.
function firstLevel() {
  const intros = introIds();
  const wanted = save.level ?? (intros[0] ?? 1);
  return levelOrder().includes(wanted) ? wanted : 1;
}
settings.level = firstLevel();
refreshMenu(true);
loadLevelData().then((loaded) => {
  if (!loaded) return;
  settings.level = firstLevel();
  refreshMenu(true);
});
requestAnimationFrame(frame);
