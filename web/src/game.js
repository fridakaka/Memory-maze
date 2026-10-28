import * as THREE from '../vendor/three.module.min.js';
import { CHARACTERS, makeHero, setAccessory, setHelmet } from './heroes.js';
import { makeMonster, MONSTER_BY_THEME } from './monsters.js';
import { THEMES, themeFor, getAssets, WEATHERS, weatherFor, getWeatherSky } from './themes.js';
import {
  DIRS, DELTA, OPPOSITE, monsterLevelFor, pickHidingSpots, distances, monsterPlan, walkCorridor, openDirs, relativeDir,
  timeLimit, perfectTime, starsFor, STUDY_SECONDS, RUN_SPEED,
} from './maze.js';
import { createAudio } from './audio.js';
import { VERSION, FEEDBACK_URL } from './config.js';
import { buildLevel, levelInfo, levelCount, introIds, expeditionIds, clockIds, discoIds, loadLevelData, isIntro } from './levels.js';

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
const save = Object.assign({ stars: {}, skips: 3, chap: {}, skipped: {}, fails: {} }, loadSave());
// Kikar: tre per bana, även i introduktionen. En extra kik för den som tar alla klockor.
const PEEKS_PER_LEVEL = 3;

// ---------- Ljud ----------
const audio = createAudio();
audio.setEnabled({ sfx: save.sfx !== false, music: save.music !== false });
audio.setMusic('menu');
// Webbläsare tillåter ljud först efter en tryckning
for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { capture: true });
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && !b.matches('#controls button[data-rel]')) audio.play('tap');
});

// ---------- Inställningar ----------
const settings = { mode: 'memory', difficulty: 'medium', level: 1 };
// Kapitel: fem banor i taget. Tre liv per kapitel; är de slut börjar kapitlet om (stjärnor behålls).
const CHAPTER_SIZE = 5;
const CHAPTER_LIVES = 3;
const FREE_SKIPS = 3; // gratis hopp över banor från början

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

const mapCam = new THREE.PerspectiveCamera(40, 1, 0.5, 300);
const playCam = new THREE.PerspectiveCamera(50, 1, 0.3, 40);
const rearCam = new THREE.PerspectiveCamera(62, 1.4, 0.3, 40);
let camera = mapCam;

const mats = {
  floor: new THREE.MeshLambertMaterial(),
  wallSide: new THREE.MeshLambertMaterial(),
  wallTop: new THREE.MeshLambertMaterial({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  path: new THREE.MeshLambertMaterial({ color: 0xff4f8b, emissive: 0x7a1038, depthTest: false }),
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

/** I kartvyn är väggarna lägre så att de skymmer mindre när kartan lutas. */
const MAP_WALL_SCALE = 0.6;
function setMapWalls(on) {
  for (let k = 0; k < walls.length; k++) setWallMatrix(k, on ? MAP_WALL_SCALE : 1);
  wallSides.instanceMatrix.needsUpdate = true;
  wallTops.instanceMatrix.needsUpdate = true;
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
/** fade: hur mycket av instansens genomskinlighet som gäller (ovansidan tonas ut mindre, så väggens form syns). */
function ghostMaterial(base, fade = 1) {
  const m = base.clone();
  m.transparent = true;
  m.depthWrite = false;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instAlpha;\nvarying float vInstAlpha;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstAlpha = instAlpha;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstAlpha;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * mix(1.0, vInstAlpha, ' + fade.toFixed(2) + ') );')
      // Lysande delar (neonlister) tonas ut extra mycket, annars ser väggen ut som glas med linjer
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vInstAlpha * vInstAlpha * vInstAlpha;');
  };
  return m;
}

/** Räknar ut en väggs matris i `dummy`. */
function computeWallMatrix(i, scaleY = 1) {
  const w = walls[i];
  // Väggar överlappar i hörnen. Ovansidorna får olika höjd (några centimeter) så att de
  // inte ritas på exakt samma plats och flimrar. Telefoner har ofta sämre djupprecision.
  const lift = w.lift ?? 0.03;
  const height = WALL_H * scaleY + lift;
  dummy.position.set(w.cx, height / 2, w.cz);
  dummy.scale.set(w.sx, height, w.sz);
  dummy.updateMatrix();
}

function setWallMatrix(i, scaleY) {
  computeWallMatrix(i, scaleY);
  wallSides.setMatrixAt(i, dummy.matrix);
  wallTops.setMatrixAt(i, dummy.matrix);
}
let pathGroup = null;
let mapIcons = null;
let youMarker = null;
const cellPos = (x, y) => new THREE.Vector3(x - maze.width / 2 + 0.5, 0, y - maze.height / 2 + 0.5);

let floorMesh = null;
function buildMazeMesh() {
  if (mazeGroup) scene.remove(mazeGroup);
  mazeGroup = new THREE.Group();
  walls = [];
  wallIndex = new Map();
  cut.clear();
  S.fadeTargets = null;
  const { width: W, height: H } = maze;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.2, H + 1.2), mats.floor);
  floorMesh = floor;
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  mazeGroup.add(floor);

  // Alla väggar ritas som två instansierade nät (sidor och ovansidor), vilket ger
  // få ritanrop även på stora banor.
  const addWall = (cx, cz, horizontal, key) => {
    wallIndex.set(key, walls.length);
    // Grannväggar överlappar i skarvar och hörn. Ytor i exakt samma plan "slåss" om pixlarna
    // (texturen hoppar), så varje vägg får en hårfin egen tjocklek och ovansidans höjd.
    const [, kx, ky] = key.split(':');
    const par = horizontal ? (kx & 1) : 2 + (ky & 1);
    const t = WALL_T + par * 0.007;
    walls.push({ cx, cz, sx: horizontal ? 1 + t : t, sz: horizontal ? t : 1 + t, lift: 0.004 * (par + 1) });
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
  ghostTops = new THREE.InstancedMesh(gt, ghostMaterial(mats.wallTop, 0.3), GHOST_MAX);
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
  marker(maze.start, mats.start, new THREE.CylinderGeometry(0.4, 0.4, 0.04, 28));
  const goalMarker = marker(maze.goal, mats.goal, new THREE.CylinderGeometry(0.42, 0.42, 0.05, 5));
  // Målflagga: hög stolpe med rutig flagga och en snurrande stjärna överst. Syns över väggarna och
  // från snett uppifrån. På kartan finns dessutom en stor målflaggsikon.
  const gx = goalMarker.position.x;
  const gz = goalMarker.position.z;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 10), mats.goal);
  pole.position.set(gx, 1.2, gz);
  const fc = document.createElement('canvas');
  fc.width = 128; fc.height = 96;
  const fx = fc.getContext('2d');
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      fx.fillStyle = (r + c) % 2 ? '#1b1b1b' : '#ffffff';
      fx.fillRect(c * 32, r * 32, 32, 32);
    }
  }
  const flagTex = new THREE.CanvasTexture(fc);
  flagTex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide }));
  flag.position.set(gx + 0.5, 2.0, gz);
  flag.rotation.y = 0.25;
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), mats.goal);
  star.position.set(gx, 2.75, gz);
  star.name = 'goalStar';
  mazeGroup.add(pole, flag, star);

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
    sprite.position.set(p.x, 1.5, p.z);
    mapIcons.add(sprite);
  }
  // Klockor i sidogångarna: ger extra tid när man springer förbi
  const clockIconSize = 1.2 + Math.max(maze.width, maze.height) * 0.05;
  for (const c of maze.clocks ?? []) {
    const p = cellPos(c.x, c.y);
    c.mesh = makeClock();
    c.mesh.position.set(p.x, 0.75, p.z);
    mazeGroup.add(c.mesh);
    c.icon = makeIconSprite('⏰');
    c.icon.scale.set(clockIconSize, clockIconSize, 1);
    c.icon.position.set(p.x, 1.5, p.z);
    mapIcons.add(c.icon);
  }
  const goalIcon = makeIconSprite('🏁');
  const iconSize = 1.7 + Math.max(maze.width, maze.height) * 0.07;
  goalIcon.scale.set(iconSize, iconSize, 1);
  goalIcon.position.set(gx, 1.6, gz);
  mapIcons.add(goalIcon);
  mazeGroup.add(mapIcons);

  // "Du är här": en pulserande ring, en pil åt blickriktningen och en nål. Syns bara i kikaren.
  youMarker = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.06, 40), mats.start);
  ring.position.y = 0.1;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 16), mats.start);
  arrow.rotation.x = Math.PI / 2;
  arrow.position.set(0, 0.9, 0.9);
  const pin = makeIconSprite('📍');
  pin.scale.set(2.4, 2.4, 1);
  pin.position.set(0, 2.4, 0);
  youMarker.add(ring, arrow, pin);
  youMarker.visible = false;
  mazeGroup.add(youMarker);
  scene.add(mazeGroup);
}

function makeClock() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 12, 28), new THREE.MeshLambertMaterial({ color: 0xffc83d, emissive: 0x5a3d00 }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), new THREE.MeshBasicMaterial({ color: 0xfffdf2, side: THREE.DoubleSide }));
  const hand = new THREE.MeshBasicMaterial({ color: 0x2b2b2b, side: THREE.DoubleSide });
  const h1 = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.22), hand);
  h1.position.set(0, 0.09, 0.005);
  const h2 = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.16), hand);
  h2.position.set(0.06, 0, 0.006);
  h2.rotation.z = -1.2;
  const bell1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe0493f }));
  bell1.position.set(-0.24, 0.3, 0);
  const bell2 = bell1.clone();
  bell2.position.x = 0.24;
  g.add(rim, face, h1, h2, bell1, bell2);
  g.scale.setScalar(1.25);
  return g;
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

/** Kartkameran svävar över labyrinten och kan lutas (S.mapPitch), zoomas och dras. */
function fitMapCamera() {
  if (!maze) return;
  const aspect = window.innerWidth / window.innerHeight;
  mapCam.aspect = aspect;
  const tanV = Math.tan((mapCam.fov * Math.PI) / 360);
  // Avstånd så att hela labyrinten får plats rakt uppifrån (bredd eller höjd avgör)
  const needW = (maze.width + 1.4) / 2 / (tanV * aspect);
  const needH = (maze.height + 1.4) / 2 / tanV * 1.12;
  const dist = Math.max(needW, needH) * 1.1 / S.mapZoom;
  const reachX = maze.width / 2, reachZ = maze.height / 2;
  S.mapPanX = Math.max(-reachX, Math.min(reachX, S.mapPanX));
  S.mapPanZ = Math.max(-reachZ, Math.min(reachZ, S.mapPanZ));
  if (S.mapZoom <= 1.001) { S.mapPanX = 0; S.mapPanZ = 0; }
  const pitch = S.mapPitch;
  mapCam.position.set(S.mapPanX, dist * Math.sin(pitch), S.mapPanZ + dist * Math.cos(pitch));
  mapCam.up.set(0, 1, 0);
  mapCam.lookAt(S.mapPanX, 0, S.mapPanZ);
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

// ---------- Akvarium: fiskar som simmar i luften framför figuren ----------
let fishGroup = null;

function clearFish() {
  if (!fishGroup) return;
  scene.remove(fishGroup);
  fishGroup.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  fishGroup = null;
}

function makeFishMesh(color, size, tailScale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat);
  body.scale.set(1.1, 0.65, 0.45);
  const tail = new THREE.Group();
  tail.position.x = -0.95;
  const tailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.5 * tailScale, 0.85, 8), mat);
  tailMesh.rotation.z = Math.PI / 2;
  tailMesh.position.x = -0.35;
  tailMesh.scale.set(1, 1, 0.35);
  tail.add(tailMesh);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), mat);
  fin.position.set(0, 0.62, 0);
  fin.scale.set(1, 1, 0.3);
  g.add(body, tail, fin);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    eye.position.set(0.62, 0.14, 0.36 * side);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    pupil.position.set(0.7, 0.14, 0.4 * side);
    g.add(eye, pupil);
  }
  g.userData.tail = tail;
  g.scale.setScalar(size);
  return g;
}

function makeFishGroup() {
  clearFish();
  fishGroup = new THREE.Group();
  const colors = [0xff9a3d, 0xffd24a, 0xff6f9a, 0x6fd3ff, 0xc77dff, 0xffffff, 0x7be08a, 0xff6a5a];
  fishGroup.userData.list = [];
  for (let i = 0; i < 18; i++) {
    const big = i === 0; // en stor val
    const mesh = big ? makeFishMesh(0x4f7fd8, 2.6, 1.6) : makeFishMesh(colors[i % colors.length], 0.4 + Math.random() * 0.4);
    fishGroup.add(mesh);
    fishGroup.userData.list.push({
      mesh,
      d: big ? 16 : 5 + Math.random() * 7, // hur långt framför figuren banan går
      r: big ? 6 : 1.5 + Math.random() * 3.5,
      h: big ? 2.4 : 1.3 + Math.random() * 1.5,
      w: (big ? 0.12 : 0.35 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1),
      ph: Math.random() * TAU,
    });
  }
  fishGroup.visible = false;
  scene.add(fishGroup);
}

function updateFish(dt) {
  if (!fishGroup) return;
  fishGroup.visible = S.phase === 'play' || S.phase === 'ended';
  if (!fishGroup.visible) return;
  fishGroup.userData.t = (fishGroup.userData.t ?? 0) + dt;
  const t = fishGroup.userData.t;
  const fx = Math.sin(S.camYaw);
  const fz = Math.cos(S.camYaw);
  for (const f of fishGroup.userData.list) {
    const th = f.w * t + f.ph;
    const cx = hero.position.x + fx * f.d;
    const cz = hero.position.z + fz * f.d;
    const dx = f.r * Math.cos(th);
    const dz = f.r * 0.85 * Math.sin(th);
    f.mesh.position.set(cx + dx, f.h + Math.sin(2 * th + f.ph) * 0.25, cz + dz);
    f.mesh.rotation.y = Math.atan2(-(0.85 * f.r * f.w * Math.cos(th)), -f.r * f.w * Math.sin(th));
    f.mesh.rotation.z = Math.cos(2 * th + f.ph) * 0.12;
    f.mesh.userData.tail.rotation.y = Math.sin(t * 8 + f.ph) * 0.45;
  }
}

// ---------- Skog: fåglar som flyger omkring framför figuren ----------
let birdGroup = null;

function clearBirds() {
  if (!birdGroup) return;
  scene.remove(birdGroup);
  birdGroup.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  birdGroup = null;
}

function makeBirdMesh(color, belly, size) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const bellyMat = new THREE.MeshLambertMaterial({ color: belly });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat);
  body.scale.set(1.25, 0.8, 0.8);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), bellyMat);
  chest.scale.set(1.1, 0.6, 0.7);
  chest.position.set(0.1, -0.12, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat);
  head.position.set(0.62, 0.18, 0);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 6), new THREE.MeshLambertMaterial({ color: 0xffa726 }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.95, 0.15, 0);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.28), mat);
  tail.position.set(-0.78, 0.02, 0);
  tail.rotation.z = 0.18;
  g.add(body, chest, head, beak, tail);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eye.position.set(0.8, 0.26, 0.2 * side);
    g.add(eye);
  }
  // Vingar: fästa i kroppen och slår upp och ned
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.05, 0.15, 0.2 * side);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.95), mat);
    wing.position.set(-0.05, 0, 0.47 * side);
    pivot.add(wing);
    g.add(pivot);
    wings.push({ pivot, side });
  }
  g.userData.wings = wings;
  g.scale.setScalar(size);
  return g;
}

function makeBirdGroup() {
  clearBirds();
  birdGroup = new THREE.Group();
  const kinds = [
    [0x3d86d8, 0xffe27a], // blåmes
    [0x8a5a34, 0xe8503a], // rödhake
    [0xffd23f, 0xfff0a0], // gulsparv
    [0xf4f4f4, 0xffffff], // duva
    [0x5a5a66, 0xd9d9e0], // trast
  ];
  birdGroup.userData.list = [];
  for (let i = 0; i < 12; i++) {
    const [c, b] = kinds[i % kinds.length];
    const mesh = makeBirdMesh(c, b, 0.38 + Math.random() * 0.22);
    birdGroup.add(mesh);
    birdGroup.userData.list.push({
      mesh,
      d: 5 + Math.random() * 9,
      r: 2 + Math.random() * 4.5,
      h: 1.4 + Math.random() * 1.3,
      w: (0.45 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1),
      ph: Math.random() * TAU,
      flap: 9 + Math.random() * 5,
    });
  }
  birdGroup.visible = false;
  birdGroup.userData.nextChirp = 2;
  scene.add(birdGroup);
}

function updateBirds(dt) {
  if (!birdGroup) return;
  birdGroup.visible = S.phase === 'play' || S.phase === 'ended';
  if (!birdGroup.visible) return;
  const ud = birdGroup.userData;
  ud.t = (ud.t ?? 0) + dt;
  const t = ud.t;
  const fx = Math.sin(S.camYaw);
  const fz = Math.cos(S.camYaw);
  for (const f of ud.list) {
    const th = f.w * t + f.ph;
    const cx = hero.position.x + fx * f.d;
    const cz = hero.position.z + fz * f.d;
    f.mesh.position.set(cx + f.r * Math.cos(th), f.h + Math.sin(1.7 * th + f.ph) * 0.45, cz + f.r * 0.8 * Math.sin(th));
    f.mesh.rotation.y = Math.atan2(-(0.8 * f.r * f.w * Math.cos(th)), -f.r * f.w * Math.sin(th));
    f.mesh.rotation.z = -Math.cos(1.7 * th + f.ph) * 0.25; // lutar när den stiger och sjunker
    const flap = Math.sin(t * f.flap + f.ph) * 0.9;
    for (const w of f.mesh.userData.wings) w.pivot.rotation.x = -w.side * flap;
  }
  // Då och då kvittrar en fågel
  if (S.phase === 'play' && !S.paused && t > ud.nextChirp) {
    audio.play('chirp');
    ud.nextChirp = t + 3 + Math.random() * 5;
  }
}

// ---------- Disco: spegelkula, ljusstrålar och blinkande dansgolv ----------
let discoGroup = null;

function clearDisco() {
  if (!discoGroup) return;
  scene.remove(discoGroup);
  discoGroup.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  discoGroup = null;
}

function makeDiscoGroup() {
  clearDisco();
  discoGroup = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.75, 2),
    new THREE.MeshPhongMaterial({ color: 0xdddde8, shininess: 140, specular: 0xffffff, flatShading: true, emissive: 0x222233 }));
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3, 6), new THREE.MeshBasicMaterial({ color: 0xaaaaaa }));
  cord.position.y = 1.8;
  ball.add(cord);
  discoGroup.add(ball);
  const beams = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 6, 20, 1, true), mat);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    discoGroup.add(cone, pool);
    beams.push({ cone, pool, ph: (i / 4) * TAU, r: 1.8 + i * 0.9 });
  }
  discoGroup.userData = { ball, beams, t: 0, beat: -1 };
  discoGroup.visible = false;
  scene.add(discoGroup);
}

function updateDisco(dt) {
  if (!discoGroup) return;
  discoGroup.visible = S.phase === 'play' || S.phase === 'ended';
  const ud = discoGroup.userData;
  if (!discoGroup.visible) return;
  ud.t += dt;
  const t = ud.t;
  const fx = Math.sin(S.camYaw);
  const fz = Math.cos(S.camYaw);
  ud.ball.position.set(hero.position.x + fx * 6, 2.9 + Math.sin(t * 1.5) * 0.1, hero.position.z + fz * 6);
  ud.ball.rotation.y += dt * 1.2;
  const hue = (t * 0.12) % 1;
  for (const [i, b] of ud.beams.entries()) {
    const a = t * (0.5 + i * 0.12) + b.ph;
    const x = hero.position.x + fx * 3 + Math.cos(a) * b.r;
    const z = hero.position.z + fz * 3 + Math.sin(a * 1.3) * b.r;
    b.cone.position.set(x, 3, z);
    b.pool.position.set(x, 0.04, z);
    const col = new THREE.Color().setHSL((hue + i * 0.22) % 1, 1, 0.55);
    b.cone.material.color.copy(col);
    b.pool.material.color.copy(col);
  }
  // Neonlisterna på väggarna byter färg, och dansgolvets rutor blinkar i takt (120 slag per minut)
  const wallCol = new THREE.Color().setHSL(hue, 1, 0.5);
  mats.wallSide.emissive.copy(wallCol);
  if (ghostSides) ghostSides.material.emissive.copy(wallCol);
  const beat = Math.floor(t * 2) % 2;
  if (beat !== ud.beat) {
    ud.beat = beat;
    const a = getAssets(theme, window.innerHeight / window.innerWidth);
    mats.floor.emissiveMap = beat ? a.floorGlow2 : a.floorGlow;
  }
}

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
  if (theme.fish) { if (!fishGroup) makeFishGroup(); } else clearFish();
  if (theme.birds) { if (!birdGroup) makeBirdGroup(); } else clearBirds();
  if (theme.disco) { if (!discoGroup) makeDiscoGroup(); } else clearDisco();
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
  yaw: 0, camYaw: 0, camVel: 0, lookYaw: 0, mapZoom: 1, mapPanX: 0, mapPanZ: 0, mapPitch: 1.05,
  kind: 'time', uturn: false, shake: 0, shakeBurst: 0, vibrateIn: 0, mon: null, difficulty: 0, hidden: false,
  limit: 0, timeLeft: 0, studyLeft: 0, studyTotal: 0,
  wrongTurns: 0, elapsed: 0,
  anim: { t: 0, reaction: null, reactionT: 0, blinkIn: 2, glanceT: -1, glanceIn: 2 },
};

/** Tidsgräns eller stjärngräns för en bana (utan introduktioner). */
function limitOf(L, dbgTime) {
  if (L.mode === 'monster') return monsterPlan(L.maze, L.d, settings.difficulty, dbgTime).starLimit;
  if (L.mode === 'free') return Math.ceil(perfectTime(L.maze) * 2.5);
  return timeLimit(L.maze, L.d, settings.difficulty, dbgTime);
}

function startLevel(leg = 0, carry = null) {
  if (typeof leg !== 'number') leg = 0; // anrop från en knapptryckning
  const level = settings.level;
  save.level = level;
  writeSave();
  show($('sheet-settings'), false);
  show($('sheet-hero'), false);
  const dbgSize = Math.round(Number($('dbg-size').value)) || 0;
  const L = buildLevel(level, dbgSize ? Math.max(4, Math.min(40, dbgSize)) : 0, leg);
  maze = L.maze;
  if (!L.intro && !L.expedition && monsterAllowed(level) && L.mode === 'time') {
    L.mode = 'monster';
    L.plan = null;
    const lm = maze.landmarks ?? [];
    maze.spots = pickHidingSpots(maze, level * 7919 + 17).filter((sp) => !lm.some((l) => l.x === sp.x && l.y === sp.y));
  }
  S.intro = L.intro;
  S.monsterTips = L.mode === 'monster' && !save.seenMonsterTips;
  S.exp = L.expedition;
  S.peek = false;
  show($('peek-close'), false);
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
  hero.visible = false; // på kartan syns startpricken i stället för figuren
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
  S.peeksLeft = carry?.peeksLeft ?? PEEKS_PER_LEVEL;
  S.clocksGot = 0;
  S.clockTotal = maze.clocks?.length ?? 0;
  if (S.clockTotal) {
    // Klockbana: för kort tid från början, varje klocka ger mer tid.
    const perfect = perfectTime(maze);
    const f = { easy: 1.3, medium: 1, hard: 0.8 }[settings.difficulty] ?? 1;
    S.limit = Math.ceil(perfect * 0.8 * dbgTime);
    S.clockBonus = Math.ceil(perfect * 0.45 * f);
  }
  if (S.exp) {
    // En expedition har en gemensam gräns för alla delar, som förs vidare vid varje checkpoint.
    if (carry) S.limit = carry.limit;
    else for (let k = 1; k < S.exp.legs; k++) S.limit += limitOf(buildLevel(level, 0, k), dbgTime);
  }
  S.timeLeft = carry ? carry.timeLeft : S.limit;
  S.elapsed = carry ? carry.elapsed : 0;
  S.wrongTurns = carry ? carry.wrongTurns : 0;
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
  setMapWalls(true);
  camera = mapCam;
  S.mapZoom = 1; S.mapPanX = 0; S.mapPanZ = 0; S.lookYaw = 0; S.mapPitch = 1.05;
  fitMapCamera();
  S.phase = 'study';
  audio.setMusic(theme.disco ? 'disco' : 'study');

  show($('menu'), false);
  show($('result'), false);
  show($('hud'));
  show($('ready'));
  show($('back-study'));
  show($('tilt'));
  show($('controls'), false);
  show($('compass'), false);
  show($('rear'), false);
  const wIcon = weather.emoji ? ` ${weather.emoji}` : '';
  const label = S.intro ? `Introduktion ${introIds().indexOf(level) + 1}`
    : S.exp ? `${S.exp.title} · del ${S.exp.leg + 1}/${S.exp.legs}`
      : clockIds().includes(level) ? `Klockbana ${clockIds().indexOf(level) + 1}`
        : discoIds().includes(level) ? `Disco ×2 🪩` : `Bana ${level}`;
  S.disco = !!theme.disco;
  S.hudBase = (S.kind === 'monster' ? `${label} · Monster` : label) + wIcon;
  $('hud-level').textContent = S.hudBase;
  show($('danger'), false);
  const study = S.modeNow === 'memory' ? 'Memorera vägen' : 'Hitta och memorera vägen';
  $('hud-phase').textContent = (S.kind === 'monster' ? `${study} – tunnor är gömställen` : study) + ' · nyp = zooma, dra = vicka';
  updateHud();
  coach('study');
  if (S.clockTotal && !save.seenClock) {
    save.seenClock = true;
    writeSave();
    showDialog({
      title: 'Klockbana!',
      text: 'Den här banan är lång och tiden är kort. Plocka upp klockorna ⏰ i sidogångarna för extra tid. Du behöver inte alla, men tar du alla får du en bonus: en kik. Klockorna syns på kartan.',
      primary: 'Okej',
    });
  }
}

function beginPlay() {
  S.phase = 'play';
  audio.play('start');
  audio.setMusic(theme.disco ? 'disco' : 'play');
  pathGroup.visible = false;
  mapIcons.visible = false;
  scene.fog = new THREE.Fog(fogSetting[0], fogSetting[1], fogSetting[2]);
  scene.background = skyTex;
  setMapWalls(false);
  hero.visible = true;
  camera = playCam;
  show($('ready'), false);
  show($('back-study'), false);
  show($('tilt'), false);
  show($('controls'));
  show($('rear'), S.kind === 'monster');
  $('hud-phase').textContent = S.kind === 'monster' ? 'Monstret vaknar snart' : 'Spring!';
  show($('leave'));
  snapCamera();
  arriveAtNode(false);
  coach('play');
}

function updateHud() {
  const hudLevel = S.clockTotal ? `${S.hudBase} · ⏰ ${S.clocksGot}/${S.clockTotal}` : S.hudBase;
  if (hudLevel !== undefined && $('hud-level').textContent !== hudLevel) $('hud-level').textContent = hudLevel;
  const livesStr = livesText(settings.level);
  if ($('hud-lives').textContent !== livesStr) $('hud-lives').textContent = livesStr;
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

// ---------- Monster (tillval) ----------
// Med tillvalet Monster blir en del banor monsterbanor: ett monster jagar och man kan gömma sig i tunnor.
const monsterAllowed = (id) => !!save.monsters && !isIntro(id) && !isSide(id) && monsterLevelFor(id);
const MONSTER_TIPS = [
  { when: 'study', text: 'Nu kommer ett monster! Det väcks efter en stund och jagar dig. Det är långsammare än du, men tappar du tid kommer det ikapp.' },
  { when: 'study', text: 'Ser du den orange ringen med en tunna? Det är ett gömställe. Där kan du gömma dig för monstret.' },
  { when: 'monsterWake', text: 'Monstret är vaket! Skärmkanten blir röd när det är nära. Titta i backspegeln, "Bakom dig", för att se var det är.', hi: 'rear' },
  { when: 'barrel', text: 'Tryck på "Göm dig i tunnan". Är monstret mer än några rutor bort tappar det bort dig och går och letar. Är det för nära ser det dig.', hi: 'hide' },
  { when: 'hidden', text: 'Bra! Nu är du trygg i tunnan. Monstret letar efter dig, men hittar dig inte. Vänta tills det har gett upp.', hi: 'unhide' },
  { when: 'gaveUp', text: 'Monstret gav upp och gick och la sig! Nu kan du komma fram och springa mot målet.', hi: 'unhide' },
];

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
  audio.play('dialog');
  // Rutan flyttas ned om den markerade delen (kompass, backspegel) sitter uppe och annars skulle ligga över texten.
  $('dialog').classList.toggle('low', hi === 'rear' || hi === 'compass');
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
  const steps = S.intro?.steps ?? (S.monsterTips ? MONSTER_TIPS : null);
  if (!steps) return;
  steps.forEach((step, i) => {
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
  showDialog({ title: S.intro?.title ?? 'Monster', text: step.text, hi: step.hi, onPrimary: nextCoach });
}

/** Vid en korsning kan banan peka ut vilken pil man ska trycka på. */
function applyGuide() {
  S.guide = null;
  if (!S.intro) return;
  const key = `${S.node.x},${S.node.y}`;
  S.visits[key] = (S.visits[key] ?? 0) + 1;
  const g = S.intro.guides.find((x) => x.x === S.node.x && x.y === S.node.y);
  if (!g) {
    // Utan egen guide pekar pilen ut rätt väg, så att hela rundan är guidad.
    const i = maze.solution.findIndex((c) => c.x === S.node.x && c.y === S.node.y);
    const nx = maze.solution[i + 1];
    if (i < 0 || !nx) return;
    const dir = DIRS.find((d) => S.node.x + DELTA[d].dx === nx.x && S.node.y + DELTA[d].dy === nx.y);
    if (dir) S.guide = { rel: relativeDir(S.heading, dir), text: '', only: true };
    return;
  }
  const dir = g.dirs[Math.min(S.visits[key] - 1, g.dirs.length - 1)];
  // Förklaringen visas bara första gången man står i korsningen. Pilen pekas ut varje gång.
  S.guide = { rel: relativeDir(S.heading, dir), text: S.visits[key] === 1 ? g.text : '', only: !!g.only };
}

function arriveAtNode(animate = true) {
  S.run = null;
  const dirs = openDirs(maze, S.node.x, S.node.y);
  const isGoal = S.node.x === maze.goal.x && S.node.y === maze.goal.y;
  if (isGoal) return S.exp && S.exp.leg < S.exp.legs - 1 ? checkpoint() : finish(true);
  react(animate && dirs.length === 1 ? 'deadend' : 'look');
  applyGuide();
  refreshControls();
  if (animate && dirs.length === 1) coach('deadend');
}

/** Framme vid en checkpoint i en expedition: nästa del av kartan visas. */
function checkpoint() {
  const next = S.exp.leg + 1;
  const carry = { limit: S.limit, timeLeft: S.timeLeft, elapsed: S.elapsed, wrongTurns: S.wrongTurns, peeksLeft: S.peeksLeft };
  react('win');
  audio.play('checkpoint');
  for (const id of ['controls', 'compass', 'danger', 'rear', 'leave', 'hint']) show($(id), false);
  showDialog({
    title: 'Checkpoint!',
    text: `Bra gjort! Del ${next} av ${S.exp.legs} är klar. Nu kommer nästa del av kartan. Tiden och dina felval följer med.`,
    primary: 'Fortsätt',
    onPrimary: () => startLevel(next, carry),
  });
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
  show($('compass'), waiting && (!S.hidden || peeksOn()));
  updatePeekBadge();
  if (waiting && !S.hidden && !S.compassSeen) { S.compassSeen = true; coach('compass'); }
  if (idle && !S.hidden && spotHere() && !S.barrelSeen) { S.barrelSeen = true; coach('barrel'); }
  if (S.peek) for (const id of ['hide', 'unhide', 'compass', 'hint', 'controls', 'leave', 'rear']) show($(id), false);
}

// ---------- Kikar: titta på kartan medan tiden går ----------
const peeksOn = () => S.phase === 'play';
function updatePeekBadge() {
  const badge = $('peek-count');
  show(badge, peeksOn());
  badge.textContent = `👁 ${S.peeksLeft ?? 0}`;
}

function showPop(text) {
  const pop = $('pop');
  pop.textContent = text;
  pop.classList.remove('go');
  void pop.offsetWidth; // startar animationen om
  pop.classList.add('go');
}

function collectClocks() {
  if (!S.clockTotal || S.phase !== 'play' || S.peek) return;
  for (const c of maze.clocks) {
    if (c.got) continue;
    const p = cellPos(c.x, c.y);
    if (Math.hypot(hero.position.x - p.x, hero.position.z - p.z) < 0.5) {
      c.got = true;
      c.collectT = 0;
      c.icon.visible = false;
      S.timeLeft += S.clockBonus;
      S.limit += S.clockBonus;
      S.clocksGot++;
      showPop(`+${S.clockBonus} s ⏰`);
      audio.play('clock');
      if (S.clocksGot === S.clockTotal) {
        S.peeksLeft++;
        setTimeout(() => showPop('Alla klockor! +1 kik 👁'), 1400);
      }
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }
}

function animateClocks(dt) {
  if (!S.clockTotal) return;
  const t = performance.now() / 1000;
  maze.clocks.forEach((c, i) => {
    if (!c.mesh) return;
    c.mesh.rotation.y += dt * 1.6;
    c.mesh.position.y = 0.75 + Math.sin(t * 3 + i) * 0.08;
    if (c.got) {
      c.collectT += dt;
      const k = Math.max(0, 1 - c.collectT / 0.3);
      c.mesh.scale.setScalar(1.25 * k);
      c.mesh.visible = k > 0;
    }
  });
}

function openPeek() {
  if (S.phase !== 'play' || S.run || S.peek || S.paused || !peeksOn()) return;
  if (!(S.peeksLeft > 0)) {
    showDialog({ title: 'Slut på kikar', text: 'Du har använt alla kikar på den här banan.', primary: 'Okej' });
    return;
  }
  S.peeksLeft--;
  updatePeekBadge();
  audio.play('peek');  audio.play('peek');
  S.peek = true;
  // Väggar som är genomskinliga just nu görs solida igen så att kartan blir hel.
  for (const id of cut.keys()) setWallMatrix(id, 1);
  cut.clear();
  ghostSides.count = ghostTops.count = 0;
  setMapWalls(true);
  scene.fog = null;
  scene.background = lawnColor;
  pathGroup.visible = false;
  mapIcons.visible = true;
  youMarker.visible = true;
  hero.visible = false;
  camera = mapCam;
  S.mapZoom = 1; S.mapPanX = 0; S.mapPanZ = 0; S.mapPitch = 1.05;
  fitMapCamera();
  show($('peek-close'));
  show($('tilt'));
  refreshControls();
}

function closePeek() {
  if (!S.peek) return;
  S.peek = false;
  setMapWalls(false);
  scene.fog = new THREE.Fog(fogSetting[0], fogSetting[1], fogSetting[2]);
  scene.background = skyTex;
  mapIcons.visible = false;
  youMarker.visible = false;
  hero.visible = !S.hidden;
  camera = playCam;
  show($('peek-close'), false);
  show($('tilt'), false);
  if (S.phase === 'play') {
    show($('controls'));
    show($('leave'));
    show($('rear'), S.kind === 'monster');
    refreshControls();
  }
}
$('peek-close').onclick = closePeek;
$('compass').onclick = openPeek;

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
  audio.play('hide');
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
  audio.play('unhide');
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
  S.stepT = 0;
  audio.play('go');
  S.yaw = YAW[dir];
  // Vid en vändning vrider sig kameran snabbt men mjukt i stället för att svepa långsamt.
  if (rel === 'back' || Math.abs(angleDiff(S.camYaw, S.yaw)) > 2.2) S.uturn = true;
  S.anim.reaction = null;
  refreshControls();
}

function stepRun(dt) {
  const run = S.run;
  S.stepT = (S.stepT ?? 0) + dt;
  if (S.stepT >= 0.19) { S.stepT = 0; audio.play('step'); }
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
    if (run.wrong) { S.wrongTurns++; audio.play('oops'); }
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
    audio.play('roar');
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
      // Är du fortfarande gömd vet monstret inte var du är: det börjar leta i stället för att jaga.
      m.mode = S.hidden ? 'lost' : 'chase';
      m.lostTimer = { easy: 10, medium: 8, hard: 6 }[settings.difficulty] ?? 8;
      m.pause = 0;
      m.peeking = false;
      m.cell = { ...maze.start };
      m.next = null;
      m.tmap = null;
      monster.visible = true;
      monster.position.copy(cellPos(m.cell.x, m.cell.y));
      S.shakeBurst = 0.7;
      audio.play('roar');
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
  audio.heartbeat(S.hidden ? 0 : close);
  audio.setMusic(m.mode === 'chase' && !S.hidden ? 'tense' : 'play');
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
  const viewYaw = S.camYaw + S.lookYaw;
  const fwd = new THREE.Vector3(Math.sin(viewYaw), 0, Math.cos(viewYaw));
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
  const deg = ((S.camYaw + S.lookYaw - Math.PI) * 180) / Math.PI;
  $('needle').style.transform = `rotate(${deg}deg)`;
}

// ---------- Slut ----------
function finish(win, reason = 'time') {
  closePeek();
  if (S.monsterTips) { save.seenMonsterTips = true; S.monsterTips = false; }
  S.phase = 'ended';
  audio.setMusic(null);
  audio.heartbeat(0);
  audio.play(win ? 'win' : 'lose');
  setTimeout(() => { if (S.phase === 'ended') audio.setMusic('menu'); }, 2500);
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

  // Enkel logg som följer med feedbacken
  save.log = [...(save.log ?? []), {
    l: settings.level, m: S.modeNow, d: settings.difficulty, w: win ? 1 : 0, t: Math.round(used), x: S.wrongTurns,
    r: win ? '' : reason, c: S.clocksGot || 0,
  }].slice(-40);
  const firstClear = win && !cleared(settings.level);
  let stars = 0;
  S.won = win;
  if (win) {
    stars = starsFor({ wrongTurns: S.wrongTurns, timeUsed: used, limit: S.limit }) * (S.disco ? 2 : 1);
    save.stars[key] = Math.max(save.stars[key] || 0, stars);
    if (S.intro) { save.intro = save.intro ?? {}; save.intro[settings.level] = true; }
  }
  let chapterMsg = '';
  let lost = null;
  if (win) {
    const r = registerClear(settings.level);
    if (r === 'chapter') chapterMsg = ` · Kapitel ${chapterOf(settings.level) + 1} klart! 🎉`;
  } else if (!S.intro && !isSide(settings.level)) {
    save.fails = save.fails ?? {};
    save.fails[settings.level] = (save.fails[settings.level] ?? 0) + 1;
    lost = loseLife(settings.level);
  }
  S.afterFail = lost?.restarted ? lost.from : null;
  writeSave();
  updateHud();

  setTimeout(() => {
    $('res-title').textContent = win ? 'Du hittade ut!' : reason === 'monster' ? 'Monstret hann ikapp dig' : 'Tiden tog slut';
    $('res-stars').innerHTML = (S.disco ? [0, 1, 2, 3, 4, 5] : [0, 1, 2])
      .map((i) => `<span class="${i < stars ? '' : 'off'}">★</span>`).join('');
    $('res-text').textContent = win
      ? `${used.toFixed(1)} sek · ${S.wrongTurns} felval${S.disco ? ' · dubbla poäng! 🪩' : ''}${chapterMsg || (firstClear && !isSide(settings.level) ? ' · nästa bana är upplåst!' : '')}`
      : S.intro ? 'Försök igen. Det kostar inget liv i introduktionen.'
        : lost?.restarted ? `Slut på liv! Kapitel ${lost.c + 1} börjar om från bana ${lost.from}. Dina stjärnor och klarade banor ligger kvar.`
          : lost ? `Du har ${lost.lives} liv kvar i kapitlet.`
            : 'Försök igen. Det kostar inget liv här.';
    show($('res-next'), win);
    // Efter några misslyckanden kan man hoppa över banan
    const canSkip = !win && !S.intro && !isSide(settings.level) && !cleared(settings.level)
      && (save.fails?.[settings.level] ?? 0) >= 2 && !lost?.restarted;
    show($('res-skip'), canSkip);
    $('res-skip').textContent = `Hoppa över banan (${save.skips} kvar)`;
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
  if (S.phase === 'play' && !S.peek && walls.length) {
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
      collectClocks();
      updateMonster(dt);
    }
    updateHud();
  }

  if (!S.mon || S.phase !== 'play') audio.heartbeat(0);
  if (S.phase === 'play' && S.kind === 'time' && !S.paused && S.timeLeft < 10 && S.timeLeft > 0) {
    const sec = Math.ceil(S.timeLeft);
    if (sec !== S.tickSec) { S.tickSec = sec; audio.play('tick'); }
  }
  animateMonster(dt);
  animateClocks(dt);
  if (S.peek) {
    monster.visible = false; // monstret visas inte i kikaren
    youMarker.position.set(hero.position.x, 0, hero.position.z);
    youMarker.rotation.y = hero.rotation.y;
    youMarker.scale.setScalar((1 + Math.sin(performance.now() / 250) * 0.12) / Math.sqrt(S.mapZoom));
  }
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
    if (S.lookYaw !== 0 && (S.run || S.phase !== 'play')) {
      S.lookYaw *= Math.max(0, 1 - dt * 6);
      if (Math.abs(S.lookYaw) < 0.01) S.lookYaw = 0;
    }
    placeCamera(Math.min(1, dt * 12));
    updateCompass();
    const lookHint = ' · svajpa för att titta runt';
    if (S.phase === 'play' && S.hidden && !$('hud-phase').textContent.endsWith(lookHint)) $('hud-phase').textContent += lookHint;
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
    updateFish(dt);
    updateBirds(dt);
    updateDisco(dt);
    beam.visible = weather.id === 'night' && (S.phase === 'play' || S.phase === 'ended');
    renderer.render(scene, camera);
    if (S.phase === 'play' && S.kind === 'monster' && !S.peek) renderRear();
  }
  requestAnimationFrame(frame);
}

// ---------- Menyer och input ----------
/** Alla banor i kartan, nerifrån: introduktionsbanorna först, sedan de vanliga. */
function levelOrder() {
  const ids = [...introIds()];
  const n = levelCount();
  const exps = [
    ...expeditionIds().map((id) => ({ id, after: levelInfo(id).expedition?.after ?? n })),
    ...clockIds().map((id) => ({ id, after: levelInfo(id).clock?.after ?? n })),
    ...discoIds().map((id) => ({ id, after: levelInfo(id).disco?.after ?? n })),
  ];
  for (let l = 1; l <= n; l++) {
    ids.push(l);
    for (const e of exps) if (e.after === l) ids.push(e.id);
  }
  for (const e of exps) if (e.after > n) ids.push(e.id);
  return ids;
}

// ---------- Progression: man måste klara en bana för att kunna spela nästa ----------
const isSide = (id) => expeditionIds().includes(id) || clockIds().includes(id) || discoIds().includes(id);
const mainPath = () => levelOrder().filter((id) => !isSide(id));
const sideAfter = (id) => { const p = levelInfo(id); return p.expedition?.after ?? p.clock?.after ?? p.disco?.after ?? null; };

function cleared(id) {
  if (isIntro(id)) return !!save.intro?.[id] || bestStars(id) > 0;
  return bestStars(id) > 0 || !!save.skipped?.[id];
}

// Kapitlen: normala banor 1–100 i grupper om fem. Expeditioner, klockbanor och introduktion hör inte till något.
const chapterOf = (id) => (isIntro(id) || isSide(id) ? null : Math.floor((id - 1) / CHAPTER_SIZE));
const chapterCount = () => Math.ceil(levelCount() / CHAPTER_SIZE);
function chapterLevels(c) {
  const out = [];
  for (let k = 0; k < CHAPTER_SIZE; k++) if (c * CHAPTER_SIZE + k + 1 <= levelCount()) out.push(c * CHAPTER_SIZE + k + 1);
  return out;
}

/** Kapitlets tillstånd: run = hur många banor i rad som är klarade i den här omgången. */
function chapter(c) {
  save.chap = save.chap ?? {};
  if (!save.chap[c]) {
    // Äldre sparfiler: räkna ut från banor som redan är klarade
    const ids = chapterLevels(c);
    let run = 0;
    while (run < ids.length && cleared(ids[run])) run++;
    save.chap[c] = { run, done: run === ids.length, lives: CHAPTER_LIVES };
  }
  return save.chap[c];
}

/** Expeditioner och klockbanor är frivilliga och öppnas av banan de ligger efter. De stoppar inte huvudspåret. */
function unlocked(id) {
  if (save.openLevels || cleared(id)) return true;
  if (isSide(id)) { const after = sideAfter(id); return after === null || cleared(after); }
  if (isIntro(id)) {
    const intros = introIds();
    const i = intros.indexOf(id);
    return i <= 0 || cleared(intros[i - 1]);
  }
  const c = chapterOf(id);
  const open = c === 0 ? introIds().every(cleared) : chapter(c - 1).done;
  if (!open) return false;
  const st = chapter(c);
  return st.done || id - chapterLevels(c)[0] <= st.run;
}

/** Första banan på huvudspåret som inte är klarad. */
function frontier() {
  const intro = introIds().find((i) => !cleared(i));
  if (intro !== undefined) return intro;
  for (let c = 0; c < chapterCount(); c++) {
    const st = chapter(c);
    if (!st.done) return chapterLevels(c)[Math.min(st.run, chapterLevels(c).length - 1)];
  }
  return levelCount();
}

/** Vad som behövs för att öppna en bana, som text. */
function lockReason(id) {
  const label = (x) => (isIntro(x) ? `introduktion ${introIds().indexOf(x) + 1}` : `bana ${x}`);
  if (isSide(id)) return `Klara ${label(sideAfter(id))} för att öppna den här.`;
  if (isIntro(id)) return `Klara ${label(introIds()[introIds().indexOf(id) - 1])} först.`;
  const c = chapterOf(id);
  const open = c === 0 ? introIds().every(cleared) : chapter(c - 1).done;
  if (!open) return c === 0 ? 'Klara introduktionen först.' : `Klara kapitel ${c} först.`;
  return `Klara ${label(frontier())} först.`;
}

/** Vilket kapitel och vilka liv som gäller för en bana i spelet just nu. Null om banan inte kostar liv. */
function lifeInfoFor(id) {
  const c = chapterOf(id);
  if (c === null) return null;
  const st = chapter(c);
  if (st.done || id - chapterLevels(c)[0] !== st.run) return null;
  return { c, st };
}

/** Förlorar ett liv i kapitlet. Är de slut börjar kapitlet om. */
function loseLife(id) {
  const info = lifeInfoFor(id);
  if (!info) return null;
  info.st.lives--;
  if (info.st.lives <= 0) {
    info.st.run = 0;
    info.st.lives = CHAPTER_LIVES;
    return { restarted: true, c: info.c, from: chapterLevels(info.c)[0] };
  }
  return { restarted: false, lives: info.st.lives };
}

/** En bana är klarad (eller överhoppad): ta kapitlet ett steg framåt. */
function registerClear(id) {
  const c = chapterOf(id);
  if (c === null) return null;
  const st = chapter(c);
  const ids = chapterLevels(c);
  if (st.done || id - ids[0] !== st.run) return null;
  st.run++;
  if (st.run >= ids.length) { st.done = true; st.lives = CHAPTER_LIVES; return 'chapter'; }
  return 'run';
}

function livesText(id) {
  if (isIntro(id)) return '🎓 övning';
  if (discoIds().includes(id)) return '🪩 dubbla poäng';
  if (isSide(id)) return '⭐ bonusbana';
  const info = lifeInfoFor(id);
  if (!info) return '🔁 övning';
  return '❤'.repeat(info.st.lives) + '♡'.repeat(CHAPTER_LIVES - info.st.lives);
}

/** Banan som ska spelas efter att man klarat den nuvarande. */
function nextAfter(id) {
  let next;
  if (isIntro(id)) next = introIds()[introIds().indexOf(id) + 1] ?? 1;
  else if (isSide(id)) next = frontier();
  else next = id + 1;
  if (next > levelCount() && !isIntro(next) && !isSide(next)) next = id;
  return unlocked(next) ? next : frontier();
}

/** Typ och namn på en bana, till kartan. Betyget från banans analys används om det finns. */
function levelType(level) {
  const p = levelInfo(level);
  if (p.intro) return { key: 'intro', label: 'Introduktion', p };
  if (p.expedition) return { key: 'expedition', label: 'Expedition', p };
  if (p.clock) return { key: 'clock', label: 'Klockbana', p };
  if (p.disco) return { key: 'disco', label: 'Discobana', p };
  if (monsterAllowed(level)) return { key: 'monster', label: 'Monster', p };
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
  // Alla banor utom introduktionen räknas, även bonusbanorna (discobanorna ger dubbla stjärnor)
  let sum = 0;
  for (const id of levelOrder()) if (!isIntro(id)) sum += bestStars(id);
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
    <path d="${d}" fill="none" stroke="#5da64a" stroke-width="62" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#f1deaa" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="4" stroke-dasharray="1 14" stroke-linecap="round"/>
  </svg>`;

  // Utsmyckning: molnen glider förbi, blommor och träd står längs gången och figurerna vinkar
  const CH_DECOR = [
    { fl: ['🌼', '🌷', '🌸'], big: ['🌳', '🌳', '🌲'], bug: '🐝' },
    { fl: ['🌻', '🌼', '🌺'], big: ['🌳', '🌴'], bug: '🦋' },
    { fl: ['🍄', '🌿', '🌱'], big: ['🌲', '🌳'], bug: '🐌' },
    { fl: ['🍁', '🍂', '🌰'], big: ['🌳', '🍂'], bug: '🐿️' },
    { fl: ['🌷', '🌸', '💐'], big: ['🌸', '🌳'], bug: '🐞' },
    { fl: ['❄️', '🌲', '⛄'], big: ['🌲', '🌲'], bug: '🐧' },
  ];
  const chFor = (id) => (isIntro(id) ? 0 : isSide(id) ? (chapterOf(sideAfter(id)) ?? 0) : chapterOf(id));
  for (let c = 0; c < 6; c++) {
    const y = (H / 6) * c + hash(c + 40) * 200;
    const w = 90 + hash(c + 50) * 70;
    html += `<div class="cloud" style="top:${y}px;width:${w}px;animation-duration:${70 + hash(c + 60) * 60}s;animation-delay:-${hash(c + 70) * 100}s"></div>`;
  }
  const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
  for (let k = 0; k < total; k++) {
    const p = pos[k];
    const dec = CH_DECOR[chFor(ids[k]) % CH_DECOR.length];
    for (let n = 0; n < 3; n++) {
      const r = hash((k + 1) * 7 + n);
      const onRight = p.x < W / 2 ? n !== 1 : n === 1;
      const room = onRight ? W - p.x - 70 : p.x - 70;
      if (room < 40) continue;
      const x = onRight ? p.x + 55 + r * (room - 30) : p.x - 55 - r * (room - 30) - 36;
      const y = p.y - 50 + hash((k + 1) * 13 + n) * 100;
      const kind = hash((k + 1) * 3 + n * 11);
      if (kind < 0.3) {
        html += `<div class="deco flowers" style="left:${x}px;top:${y}px">${[0, 1, 2].map((i) => `<span style="animation-delay:-${(i * 0.6 + r).toFixed(2)}s">${pick(dec.fl, hash(k * 9 + n * 3 + i))}</span>`).join('')}</div>`;
      } else if (kind < 0.5) {
        html += `<div class="deco hedge" style="left:${x}px;top:${y}px;width:${44 + r * 40}px;height:${24 + r * 8}px"></div>`;
      } else if (kind < 0.82) {
        html += `<div class="deco big" style="left:${x}px;top:${y - 10}px;font-size:${34 + r * 20}px">${pick(dec.big, r)}</div>`;
      } else {
        html += `<div class="deco bug" style="left:${x}px;top:${y}px;animation-delay:-${(r * 4).toFixed(2)}s">${dec.bug}</div>`;
      }
    }
  }
  // Vimplar över gången mellan två kapitel
  ids.forEach((id, k) => {
    const c = chapterOf(id);
    if (c === null || c === 0 || (id - 1) % CHAPTER_SIZE !== 0 || k === 0) return;
    const y = (pos[k].y + pos[k - 1].y) / 2 - 14;
    html += `<svg class="bunting" style="top:${y}px" viewBox="0 0 120 28" preserveAspectRatio="none" width="100%" height="28" aria-hidden="true"><defs><pattern id="bunt${c}" width="60" height="28" patternUnits="userSpaceOnUse"><polygon points="4,3 22,3 13,24" fill="#ff6b8b"/><polygon points="34,3 52,3 43,24" fill="#ffd54a"/></pattern></defs><rect y="1" width="100%" height="3" fill="#7a5a3a"/><rect y="0" width="100%" height="28" fill="url(#bunt${c})"/></svg>`;
  });
  // Skylt och vinkande figur vid varje kapitelstart
  const CHEERS = ['Hej!', 'Heja!', 'Kom igen!', 'Du klarar det!', 'Bra jobbat!', 'Härligt!'];
  ids.forEach((id, k) => {
    const chNo = chapterOf(id);
    const isStart = chNo !== null ? (id - 1) % CHAPTER_SIZE === 0 : k === 0;
    if (!isStart) return;
    const p = pos[k];
    const roomy = p.x < W / 2 ? 1 : -1; // åt det håll där det finns mest plats
    const hero = CHARACTERS[((chNo ?? 0) + k) % CHARACTERS.length];
    // Första kapitlet har ingen egen figur, introduktionens figur hälsar där
    if (chNo !== 0) {
      const fx = Math.min(W - 80, Math.max(26, chNo === null ? p.x + roomy * 95 - 30 : p.x - roomy * 88));
      html += `<div class="wave" style="left:${fx}px;top:${p.y - 34}px"><span class="bubble">${chNo === null ? 'Välkommen!' : CHEERS[(chNo + 1) % CHEERS.length]}</span>`
        + `<span class="fig">${hero.emoji}</span><span class="hand">👋</span></div>`;
    }
    if (chNo !== null) {
      const st = chapter(chNo);
      const sx = Math.min(W - 60, Math.max(60, p.x + roomy * 105));
      html += `<div class="sign${st.done ? ' done' : ''}" style="left:${sx}px;top:${p.y - 48}px"><b>Kapitel ${chNo + 1}${st.done ? ' ✓' : ''}</b></div>`;
    }
  });

  const intros = introIds();
  ids.forEach((id, k) => {
    const t = levelType(id);
    const best = bestStars(id);
    const sel = id === settings.level;
    const isI = isIntro(id);
    const exps = expeditionIds();
    const isE = t.key === 'expedition';
    const isC = t.key === 'clock';
    const isD = t.key === 'disco';
    const number = isI ? intros.indexOf(id) + 1 : isE ? `E${exps.indexOf(id) + 1}` : isC ? `K${clockIds().indexOf(id) + 1}` : isD ? `D${discoIds().indexOf(id) + 1}` : id;
    const done = isI && save.intro?.[id];
    const locked = !unlocked(id);
    html += `<button class="node ${t.key}${sel ? ' sel' : ''}${locked ? ' locked' : ''}${!locked && best > 0 ? ' cleared' : ''}" data-level="${id}" style="left:${pos[k].x}px;top:${pos[k].y}px" aria-label="${isI ? `Introduktion ${number}` : isE ? t.p.expedition.title : isC ? `Klockbana ${number}` : isD ? `Discobana ${number}` : `Bana ${id}`}, ${t.label}">`
      + `${number}`
      + (t.key === 'monster' ? '<span class="mons">👾</span>' : '')
      + (isE ? '<span class="mons">🧭</span>' : '')
      + (isC ? '<span class="mons">⏰</span>' : '')
      + (isD ? '<span class="mons">🪩</span>' : '')
      + (isI ? `<span class="mons">${done ? '✅' : '🎓'}</span>` : '')
      + (locked ? '<span class="lock">🔒</span>' : !isI && !isE && !isC && best > 0 ? '<span class="mons">🌼</span>' : '')
      + (sel ? `<span class="me">${heroEmoji()}</span>` : '')
      + (locked ? '' : `<span class="st">${'★'.repeat(best)}<span class="off">${'★'.repeat(Math.max(0, (isD ? 6 : 3) - best))}</span></span>`) + '</button>';
  });
  inner.innerHTML = html;
  if (scroll) {
    const y = pos[Math.max(0, ids.indexOf(settings.level))].y;
    map.scrollTop = Math.max(0, y - map.clientHeight * 0.55);
  }
}

function refreshMenu(scroll = false) {
  if (!unlocked(settings.level)) settings.level = frontier();
  $('stat-stars').textContent = `★ ${totalStars()}`;
  const lifeLevel = settings.level;
  const info = lifeInfoFor(lifeLevel);
  $('stat-lives').textContent = chapterOf(lifeLevel) === null ? '❤ –' : `❤ ${info ? info.st.lives : CHAPTER_LIVES}`;
  $('stat-skips').textContent = `⏭ ${save.skips}`;
  $('hero-emoji').textContent = heroEmoji();
  const t = levelType(settings.level);
  const th = themeFor(settings.level, t.p.themeId);
  const w = weatherFor(settings.level, th, t.p.weatherId);
  if (t.p.intro) {
    const n = introIds().indexOf(settings.level) + 1;
    $('lvl-info').textContent = `Introduktion ${n}: ${t.p.intro.title} · ${t.p.width}×${t.p.height} rutor`;
    $('play').textContent = `Spela introduktion ${n}`;
  } else if (t.p.disco) {
    const n = discoIds().indexOf(settings.level) + 1;
    $('lvl-info').textContent = `Discobana ${n} · Dubbla poäng! 🪩 · ${t.p.width}×${t.p.height} rutor`;
    $('play').textContent = `Spela discobana ${n}`;
  } else if (t.p.clock) {
    const n = clockIds().indexOf(settings.level) + 1;
    $('lvl-info').textContent = `Klockbana ${n} · ${th.name} · ${t.p.width}×${t.p.height} rutor · tiden är kort, plocka ${t.p.clock.clocks} klockor`;
    $('play').textContent = `Spela klockbana ${n}`;
  } else if (t.p.expedition) {
    $('lvl-info').textContent = `${t.p.expedition.title} · ${t.p.expedition.legs} delar med checkpoints · ${th.name} · ${t.p.width}×${t.p.height} rutor per del`;
    $('play').textContent = `Spela ${t.p.expedition.title.toLowerCase()}`;
  } else {
    const chNo = chapterOf(settings.level);
    $('lvl-info').textContent = `${chNo === null ? '' : `Kapitel ${chNo + 1} · `}Bana ${settings.level} · ${th.name}${w.name ? ` · ${w.emoji} ${w.name}` : ''} · ${t.label} · ${t.p.width}×${t.p.height} rutor`;
    $('play').textContent = `Spela bana ${settings.level}`;
  }
  renderMap(scroll);
}

$('map-inner').addEventListener('click', (e) => {
  const node = e.target.closest('.node');
  if (!node) return;
  const id = Number(node.dataset.level);
  if (!unlocked(id)) {
    showDialog({ title: 'Låst 🔒', text: lockReason(id), primary: 'Okej' });
    return;
  }
  settings.level = id;
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

$('opt-monsters').checked = !!save.monsters;
$('opt-monsters').onchange = () => { save.monsters = $('opt-monsters').checked; writeSave(); refreshMenu(); };
$('snd-sfx').checked = save.sfx !== false;
$('snd-music').checked = save.music !== false;
$('snd-sfx').onchange = () => { save.sfx = $('snd-sfx').checked; writeSave(); audio.setEnabled({ sfx: save.sfx }); };
$('snd-music').onchange = () => { save.music = $('snd-music').checked; writeSave(); audio.setEnabled({ music: save.music }); };
$('dbg-levels').checked = !!save.openLevels;
$('dbg-levels').onchange = () => { save.openLevels = $('dbg-levels').checked; writeSave(); refreshMenu(); };
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

$('play').onclick = () => startLevel();
$('ready').onclick = beginPlay;
$('res-again').onclick = () => {
  if (S.afterFail) settings.level = S.afterFail;
  startLevel();
};
$('res-skip').onclick = () => skipLevel();

/** Hoppa över en svår bana. Man får tre gratis från början, sedan kan fler köpas. */
function skipLevel() {
  const id = settings.level;
  if (!(save.skips > 0)) {
    showDialog({
      title: 'Slut på hopp',
      text: 'Du har inga hopp kvar. Du kan köpa fem hopp för 9 kr. (Testversion: ingenting debiteras.)',
      primary: 'Avbryt',
      secondary: 'Köp 5 för 9 kr',
      onSecondary: () => { save.skips += 5; writeSave(); $('res-skip').textContent = `Hoppa över banan (${save.skips} kvar)`; },
    });
    return;
  }
  showDialog({
    title: 'Hoppa över banan?',
    text: `Banan räknas som klar utan stjärnor, och du kan spela den senare. Du har ${save.skips} hopp kvar.`,
    primary: 'Hoppa över',
    secondary: 'Avbryt',
    onPrimary: () => {
      save.skips--;
      save.skipped = save.skipped ?? {};
      save.skipped[id] = true;
      const r = registerClear(id);
      settings.level = nextAfter(id);
      save.level = settings.level;
      writeSave();
      backToMenu();
      showDialog({
        title: r === 'chapter' ? 'Kapitlet är klart! 🎉' : 'Överhoppad',
        text: 'Nästa bana är upplåst.',
        primary: 'Okej',
      });
    },
  });
}
$('res-next').onclick = () => {
  settings.level = nextAfter(settings.level);
  startLevel();
};
function backToMenu() {
  audio.setMusic('menu');
  audio.heartbeat(0);
  S.peek = false;
  show($('peek-close'), false);
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
  show($('tilt'), false);
  show($('danger'), false);
  show($('rear'), false);
}
$('res-menu').onclick = () => {
  if (S.won) { settings.level = nextAfter(settings.level); save.level = settings.level; writeSave(); }
  backToMenu();
};

// ---------- Feedback ----------
function feedbackReport(text) {
  const log = (save.log ?? []).slice(-15).map((e) =>
    `  bana ${e.l}: ${e.w ? 'klarad' : `förlorad${e.r ? ` (${e.r})` : ''}`}, ${e.t} s, ${e.x} felval${e.c ? `, ${e.c} klockor` : ''}, ${e.m}/${e.d}`).join('\n');
  return [
    text.trim() || '(ingen text)',
    '',
    `--- Information om testet ---`,
    `Maze Memory ${VERSION}`,
    `Skärm: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
    `Enhet: ${navigator.userAgent}`,
    `Läge: ${settings.mode}, tempo: ${settings.difficulty}, nuvarande bana: ${settings.level}`,
    `Stjärnor: ${totalStars()}`,
    `Senaste banorna:`,
    log || '  (inga än)',
  ].join('\n');
}
function openFeedback() {
  show($('sheet-settings'), false);
  $('fb-text').value = '';
  show($('sheet-feedback'));
}
async function sendFeedback() {
  const report = feedbackReport($('fb-text').value);
  show($('sheet-feedback'), false);
  if (FEEDBACK_URL) {
    try { await navigator.clipboard.writeText(report); } catch { /* ingen urklippsrätt */ }
    window.open(FEEDBACK_URL, '_blank');
    showDialog({ title: 'Tack!', text: 'Din feedback är kopierad. Klistra in den i formuläret som öppnades.', primary: 'Okej' });
    return;
  }
  if (navigator.share) {
    try { await navigator.share({ title: 'Feedback på Maze Memory', text: report }); return; } catch { /* avbröts */ }
  }
  try { await navigator.clipboard.writeText(report); } catch { /* ingen urklippsrätt */ }
  showDialog({ title: 'Kopierat', text: 'Din feedback är kopierad. Klistra in den i ett meddelande till den som skickade spelet till dig.', primary: 'Okej' });
}
$('feedback-btn').onclick = openFeedback;
$('feedback-btn2').onclick = openFeedback;
$('fb-send').onclick = sendFeedback;
$('fb-cancel').onclick = () => show($('sheet-feedback'), false);
$('version').textContent = `Testversion ${VERSION}`;

/** Att lämna en bana mitt under spelet kostar ett liv (utom i introduktionen). */
$('leave').onclick = () => {
  if (S.phase !== 'play' || dialogHandlers) return;
  showDialog({
    title: 'Lämna banan?',
    text: S.intro ? 'Du kan försöka igen när du vill. Det kostar inget liv i introduktionen.'
      : lifeInfoFor(settings.level) ? 'Du förlorar ett liv i kapitlet om du lämnar nu.' : 'Det kostar inget liv att lämna den här banan.',
    primary: 'Lämna',
    secondary: 'Fortsätt',
    onPrimary: () => {
      const lost = S.intro ? null : loseLife(settings.level);
      writeSave();
      if (lost?.restarted) { settings.level = lost.from; save.level = lost.from; writeSave(); }
      backToMenu();
      if (lost?.restarted) {
        showDialog({ title: 'Slut på liv!', text: `Kapitel ${lost.c + 1} börjar om från bana ${lost.from}. Dina stjärnor och klarade banor ligger kvar.`, primary: 'Okej' });
      }
    },
  });
};
$('back-study').onclick = backToMenu;
$('reset-save').onclick = () => {
  save.stars = {}; save.chap = {}; save.skipped = {}; save.fails = {}; save.skips = FREE_SKIPS; save.level = null; save.intro = {}; settings.level = firstLevel(); writeSave(); refreshMenu(true);
};

for (const btn of document.querySelectorAll('#controls button[data-rel]')) {
  btn.addEventListener('click', () => choose(btn.dataset.rel));
}
// Svajpa för att titta runt medan man är gömd; nyp, dra och rulla för att zooma kartan.
const pointers = new Map();
const mapView = () => S.phase === 'study' || S.peek;
const ray = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
/** Var på marken en punkt på skärmen pekar. */
function mapWorldAt(sx, sy) {
  const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, mapCam);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(groundPlane, hit)) return { x: S.mapPanX, z: S.mapPanZ };
  return { x: hit.x, z: hit.z };
}
const MAP_PITCHES = [0.62, 1.05, 1.5];
function setMapPitch(pitch) {
  S.mapPitch = Math.max(0.45, Math.min(1.53, pitch));
  fitMapCamera();
}
$('tilt').onclick = () => {
  // Hoppa till nästa vinkel: lutad, mer uppifrån, rakt uppifrån
  const next = MAP_PITCHES.find((p) => p > S.mapPitch + 0.05) ?? MAP_PITCHES[0];
  setMapPitch(next);
};
function setMapZoom(zoom, sx, sy) {
  const before = mapWorldAt(sx, sy);
  S.mapZoom = Math.max(1, Math.min(5, zoom));
  fitMapCamera();
  const after = mapWorldAt(sx, sy);
  S.mapPanX += before.x - after.x;
  S.mapPanZ += before.z - after.z;
  fitMapCamera();
}
window.addEventListener('pointerdown', (e) => {
  if (e.target !== $('scene') || S.paused) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
window.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || S.paused) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (mapView()) {
    if (pointers.size >= 2) {
      // Två fingrar: nyp för att zooma och dra för att flytta kartan
      const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(p.x - other.x, p.y - other.y) || 1;
      const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const old = mapWorldAt((p.x + other.x) / 2, (p.y + other.y) / 2);
      S.mapZoom = Math.max(1, Math.min(5, S.mapZoom * (d1 / d0)));
      fitMapCamera();
      const now = mapWorldAt((e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
      S.mapPanX += old.x - now.x;
      S.mapPanZ += old.z - now.z;
      fitMapCamera();
    } else {
      // Ett finger: dra uppåt eller nedåt för att vicka kartan
      setMapPitch(S.mapPitch + dy * 0.006);
    }
  } else if (S.phase === 'play' && !S.run) {
    S.lookYaw -= dx * 0.01; // titta runt när figuren står still
  }
  p.x = e.clientX; p.y = e.clientY;
});
const endPointer = (e) => pointers.delete(e.pointerId);
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
window.addEventListener('wheel', (e) => {
  if (!mapView() || S.paused || e.target !== $('scene')) return;
  e.preventDefault();
  setMapZoom(S.mapZoom * Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY);
}, { passive: false });
$('scene').addEventListener('dblclick', (e) => {
  if (mapView()) setMapZoom(S.mapZoom > 1.2 ? 1 : 2.5, e.clientX, e.clientY);
});

$('hide').onclick = hide;
$('unhide').onclick = unhide;
window.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'forward', ArrowDown: 'back' };
  if (map[e.key] && !S.paused) { e.preventDefault(); choose(map[e.key]); }
  if (e.key === 'Enter' && dialogHandlers) closeDialog('primary');
  else if (e.key === 'Enter' && S.phase === 'study' && !S.paused) beginPlay();
  if (e.key === 'h') (S.hidden ? unhide : hide)();
  if (e.key === 'Escape') closePeek();
});

// Test- och felsökningskrok
window.__game = { S, setMonster, get monster() { return monster; }, stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, walls: walls.length, geometries: renderer.info.memory.geometries }), get weather() { return weather; }, applyWeather, setHero, get hero() { return hero; }, refreshControls, settings, save, audio, unlocked, frontier, cleared, chapter, skipLevel, finish, startLevel, beginPlay, openPeek, closePeek, choose, hide, unhide, get maze() { return maze; }, get birds() { return birdGroup; } };

resize();
// Nya spelare börjar med första introduktionsbanan. Banorna läses från levels.json.
function firstLevel() {
  const intros = introIds();
  const wanted = save.level ?? (intros[0] ?? 1);
  return levelOrder().includes(wanted) && unlocked(wanted) ? wanted : frontier();
}
let levelsReady = false;
settings.level = firstLevel();
refreshMenu(true);
loadLevelData().then((loaded) => {
  levelsReady = true;
  if (!loaded) return;
  settings.level = firstLevel();
  refreshMenu(true);
});
requestAnimationFrame(frame);

// ---------- Startskärm ----------
// Visas medan spelet laddar. Visas minst en stund så att den hinner synas.
{
  const splash = $('splash');
  const start = performance.now();
  const MIN_MS = 1800;
  const tick = () => {
    const t = (performance.now() - start) / MIN_MS;
    const pct = Math.min(1, t, levelsReady ? 1 : 0.9);
    $('load-fill').style.width = `${Math.round(pct * 100)}%`;
    $('load-pct').textContent = `${Math.round(pct * 100)}%`;
    if (pct >= 1) {
      splash.classList.add('done');
      setTimeout(() => splash.remove(), 600);
    } else {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);
}
