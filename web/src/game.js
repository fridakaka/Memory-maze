import * as THREE from '../vendor/three.module.min.js';
import {
  DELTA, OPPOSITE, distances, monsterPlan, pickHidingSpots, generateMaze, levelParams, walkCorridor, openDirs, relativeDir,
  timeLimit, starsFor, STUDY_SECONDS, RUN_SPEED,
} from './maze.js';

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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const FOG = 0xdfe8e1;
const LAWN = 0x4f6f3f;
const scene = new THREE.Scene();

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}
function speckle(ctx, size, base, shades, n, rmin, rmax) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
    ctx.globalAlpha = 0.35 + Math.random() * 0.5;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, rmin + Math.random() * (rmax - rmin), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
const hedgeTex = canvasTex(256, (c, n) =>
  speckle(c, n, '#2f6a2b', ['#245a22', '#3b8433', '#4d9b3e', '#68b455', '#1d4a1b'], 1400, 2, 7));
const gravelTex = canvasTex(256, (c, n) =>
  speckle(c, n, '#b9ad98', ['#9d917d', '#cdc3b0', '#a79b86', '#d8d0bf', '#8a806e'], 1800, 1, 3), 6);
const skyTex = canvasTex(256, (c, n) => {
  const g = c.createLinearGradient(0, 0, 0, n);
  g.addColorStop(0, '#8fbfe6');
  g.addColorStop(0.55, '#c9e0ee');
  g.addColorStop(1, '#e8eee6');
  c.fillStyle = g;
  c.fillRect(0, 0, n, n);
});
skyTex.wrapS = skyTex.wrapT = THREE.ClampToEdgeWrapping;
const lawnColor = new THREE.Color(LAWN);
scene.background = lawnColor;

scene.add(new THREE.HemisphereLight(0xe6f0ff, 0x6a7a55, 1.35));
const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
sun.position.set(-6, 11, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
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
  floor: new THREE.MeshLambertMaterial({ map: gravelTex }),
  wall: new THREE.MeshLambertMaterial({ map: hedgeTex }),
  path: new THREE.MeshLambertMaterial({ color: 0xffe08a, emissive: 0x7a5a10, transparent: true, opacity: 0.85 }),
  start: new THREE.MeshLambertMaterial({ color: 0x5aa9e6, emissive: 0x143a5c }),
  goal: new THREE.MeshLambertMaterial({ color: 0xffd25a, emissive: 0x9a6a00 }),
  spot: new THREE.MeshLambertMaterial({ color: 0xff9f43, emissive: 0x6b3300 }),
};
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
let pathGroup = null;
const cellPos = (x, y) => new THREE.Vector3(x - maze.width / 2 + 0.5, 0, y - maze.height / 2 + 0.5);

function buildMazeMesh() {
  if (mazeGroup) scene.remove(mazeGroup);
  mazeGroup = new THREE.Group();
  const { width: W, height: H } = maze;

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 1.2, 0.2, H + 1.2), mats.floor);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  mazeGroup.add(floor);

  const hWall = new THREE.BoxGeometry(1 + WALL_T, WALL_H, WALL_T);
  const vWall = new THREE.BoxGeometry(WALL_T, WALL_H, 1 + WALL_T);
  const addWall = (cx, cz, horizontal) => {
    const m = new THREE.Mesh(horizontal ? hWall : vWall, mats.wall);
    m.position.set(cx, WALL_H / 2, cz);
    m.castShadow = true;
    m.receiveShadow = true;
    mazeGroup.add(m);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = cellPos(x, y);
      const o = maze.open[y][x];
      if (!o.N) addWall(c.x, c.z - 0.5, true);
      if (!o.W) addWall(c.x - 0.5, c.z, false);
      if (x === W - 1 && !o.E) addWall(c.x + 0.5, c.z, false);
      // Öppen grind vid starten så att kameran inte hamnar bakom en häck.
      if (y === H - 1 && !o.S && x !== maze.start.x) addWall(c.x, c.z + 0.5, true);
    }
  }

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

  pathGroup = new THREE.Group();
  const tile = new THREE.BoxGeometry(0.5, 0.03, 0.5);
  for (const c of maze.solution) {
    const m = new THREE.Mesh(tile, mats.path);
    const p = cellPos(c.x, c.y);
    m.position.set(p.x, 0.02, p.z);
    pathGroup.add(m);
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
  scene.add(mazeGroup);
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
function makeHero() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xf2bf94 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2f7be0 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2d3a4a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x3b5b8a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x5a3b24 });
  const pack = new THREE.MeshLambertMaterial({ color: 0x2b2f3a });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), jacket);
  body.scale.set(1, 1.1, 0.95);
  body.position.y = 0.3;
  g.add(body);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.11), pack);
  backpack.position.set(0, 0.31, -0.18);
  g.add(backpack);

  const head = new THREE.Group();
  head.position.y = 0.62;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 18), skin);
  head.add(skull);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.218, 24, 14, 0, TAU, 0, Math.PI * 0.55), hair);
  cap.rotation.x = -0.35;
  head.add(cap);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), white);
    eye.position.set(0.08 * s, -0.03, 0.17);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), dark);
    pupil.position.set(0.08 * s, -0.03, 0.213);
    head.add(pupil);
  }
  g.add(head);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), jeans);
    leg.position.set(0.09 * s, 0.07, 0);
    g.add(leg);
    legs.push(leg);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { head, body, legs };
  return g;
}
const hero = makeHero();
scene.add(hero);

// Monstret: en stor mörklila klump med horn och stora ögon.
function makeMonster() {
  const g = new THREE.Group();
  const purple = new THREE.MeshLambertMaterial({ color: 0x5b3a8c });
  const horn = new THREE.MeshLambertMaterial({ color: 0xf0e2c0 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const red = new THREE.MeshLambertMaterial({ color: 0xd9304a, emissive: 0x5a0010 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), purple);
  body.scale.set(1, 0.95, 1);
  body.position.y = 0.36;
  g.add(body);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 10), horn);
    h.position.set(0.17 * s, 0.7, 0.02);
    h.rotation.z = -0.35 * s;
    g.add(h);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), white);
    eye.position.set(0.13 * s, 0.46, 0.27);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), red);
    pupil.position.set(0.13 * s, 0.46, 0.35);
    g.add(pupil);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), purple);
    foot.position.set(0.17 * s, 0.07, 0.05);
    g.add(foot);
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.05), new THREE.MeshLambertMaterial({ color: 0x1b0f2b }));
  mouth.position.set(0, 0.27, 0.33);
  g.add(mouth);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.visible = false;
  return g;
}
const monster = makeMonster();
scene.add(monster);

// ---------- Spelstate ----------
const S = {
  phase: 'menu', // menu | study | play | ended
  node: null, // nuvarande nod {x,y}
  heading: 'N', // blickriktning i nuvarande nod
  run: null, // { pts:[Vector3], seg, t, to, heading, wrong }
  yaw: 0, camYaw: 0, camVel: 0,
  kind: 'time', mon: null, difficulty: 0, hidden: false,
  limit: 0, timeLeft: 0, studyLeft: 0, studyTotal: 0,
  wrongTurns: 0, elapsed: 0,
  anim: { t: 0, reaction: null, reactionT: 0 },
};

function startLevel() {
  const level = settings.level;
  const params = levelParams(level);
  const dbgSize = Math.round(Number($('dbg-size').value)) || 0;
  if (dbgSize) { params.width = params.height = Math.max(4, Math.min(40, dbgSize)); }
  maze = generateMaze(params);
  maze.spots = params.mode === 'monster' ? pickHidingSpots(maze, params.seed) : [];
  buildMazeMesh();
  // Skuggkameran ska täcka hela labyrinten, även stora banor.
  const reach = Math.max(maze.width, maze.height) / 2 + 3;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -reach;
  sun.shadow.camera.right = sun.shadow.camera.top = reach;
  sun.shadow.camera.updateProjectionMatrix();
  fitMapCamera();

  const dbgStudy = Number($('dbg-study').value) || 0;
  const dbgTime = Number($('dbg-time').value) || 1;
  S.kind = params.mode;
  S.hidden = false;
  hero.visible = true;
  S.difficulty = params.d;
  monster.visible = false;
  S.mon = null;
  if (S.kind === 'monster') {
    const plan = monsterPlan(maze, params.d, settings.difficulty, dbgTime);
    S.limit = plan.starLimit; // Bara för stjärnorna, ingen tidsgräns.
    S.mon = { plan, delay: plan.delay, awake: false, cell: { ...maze.start }, next: null, t: 0,
      dist: Infinity, map: null, heroKey: '', yaw: 0,
      mode: 'chase', lostTimer: 0, target: null, tmap: null };
  } else {
    S.limit = timeLimit(maze, params.d, settings.difficulty, dbgTime);
  }
  S.timeLeft = S.limit;
  S.elapsed = 0;
  S.wrongTurns = 0;
  S.studyTotal = dbgStudy || STUDY_SECONDS[settings.difficulty];
  S.studyLeft = S.studyTotal;
  S.node = { ...maze.start };
  S.heading = openDirs(maze, maze.start.x, maze.start.y)[0];
  S.run = null;
  S.yaw = YAW[S.heading];
  S.camYaw = S.yaw;
  S.anim.reaction = null;

  const p = cellPos(S.node.x, S.node.y);
  hero.position.copy(p);
  hero.rotation.set(0, S.yaw, 0);
  hero.scale.set(1, 1, 1);

  // Navigator: ingen markerad väg. Memory: vägen är markerad under studietiden.
  pathGroup.visible = settings.mode === 'memory';
  scene.fog = null;
  scene.background = lawnColor;
  camera = mapCam;
  S.phase = 'study';

  show($('menu'), false);
  show($('result'), false);
  show($('hud'));
  show($('ready'));
  show($('controls'), false);
  show($('compass'), false);
  show($('rear'), false);
  $('hud-level').textContent = S.kind === 'monster' ? `Bana ${level} · Monster` : `Bana ${level}`;
  show($('danger'), false);
  const study = settings.mode === 'memory' ? 'Memorera vägen' : 'Hitta och memorera vägen';
  $('hud-phase').textContent = S.kind === 'monster' ? `${study} – tunnor är gömställen` : study;
  updateHud();
}

function beginPlay() {
  S.phase = 'play';
  pathGroup.visible = false;
  scene.fog = new THREE.Fog(FOG, 4.5, 9.5);
  scene.background = skyTex;
  camera = playCam;
  show($('ready'), false);
  show($('controls'));
  show($('rear'), S.kind === 'monster');
  $('hud-phase').textContent = S.kind === 'monster' ? 'Monstret vaknar snart' : 'Spring!';
  snapCamera();
  arriveAtNode(false);
}

function updateHud() {
  $('hud-lives').textContent = '❤'.repeat(save.lives) + '♡'.repeat(MAX_LIVES - save.lives);
  $('hud-wrong').textContent = `✗ ${S.wrongTurns}`;
  let frac;
  if (S.phase === 'study') frac = S.studyLeft / S.studyTotal;
  else if (S.kind === 'monster') frac = S.mon && S.mon.awake && S.mon.mode !== 'lost' ? Math.min(1, S.mon.dist / 10) : 1;
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

function arriveAtNode(animate = true) {
  S.run = null;
  const dirs = openDirs(maze, S.node.x, S.node.y);
  const isGoal = S.node.x === maze.goal.x && S.node.y === maze.goal.y;
  if (isGoal) return finish(true);
  react(animate && dirs.length === 1 ? 'deadend' : 'look');
  refreshControls();
}

function spotHere() {
  return (maze.spots ?? []).find((sp) => sp.x === S.node.x && sp.y === S.node.y && !sp.used);
}

function refreshControls() {
  const rels = availableRel();
  for (const btn of document.querySelectorAll('#controls button[data-rel]')) {
    const rel = btn.dataset.rel;
    btn.disabled = S.phase !== 'play' || S.run !== null || S.hidden || !(rel in rels);
  }
  const idle = S.phase === 'play' && S.run === null;
  show($('hide'), idle && !S.hidden && !!spotHere());
  show($('unhide'), idle && S.hidden);
  const waiting = S.phase === 'play' && S.run === null;
  show($('compass'), waiting && !S.hidden);
}

function hide() {
  const spot = spotHere();
  if (S.phase !== 'play' || S.run || S.hidden || !spot) return;
  spot.used = true;
  for (const m of spot.mesh.userData.mats) m.color.set(0x8a8f8c);
  S.hidden = true;
  hero.visible = false;
  const m = S.mon;
  if (m && m.awake && m.dist > 3) {
    // Monstret såg inte var du tog vägen och går och letar.
    m.mode = 'lost';
    m.lostTimer = { easy: 10, medium: 8, hard: 6 }[settings.difficulty] ?? 8;
    m.next = null;
    m.tmap = null;
  }
  refreshControls();
}

function unhide() {
  if (!S.hidden) return;
  S.hidden = false;
  hero.visible = true;
  refreshControls();
}

function choose(rel) {
  if (S.phase !== 'play' || S.run || S.hidden) return;
  const rels = availableRel();
  if (!(rel in rels)) return;
  const dir = rels[rel];
  const corridor = walkCorridor(maze, S.node, dir);
  const pts = [cellPos(S.node.x, S.node.y), ...corridor.cells.map((c) => cellPos(c.x, c.y))];
  S.run = { pts, seg: 0, t: 0, to: corridor.to, heading: corridor.heading, wrong: corridor.wrong, dir };
  S.yaw = YAW[dir];
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

function pickWanderTarget(m) {
  const far = [...distances(maze, m.cell)].filter(([, d]) => d >= 5);
  const pick = far.length ? far[Math.floor(Math.random() * far.length)][0] : cellKey(m.cell);
  const [x, y] = pick.split(',').map(Number);
  m.target = { x, y };
  m.tmap = distances(maze, m.target);
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

  if (m.mode === 'lost') {
    m.lostTimer -= dt;
    if (m.lostTimer <= 0) { m.mode = 'chase'; m.next = null; m.tmap = null; }
  }
  const lost = m.mode === 'lost';
  $('hud-phase').textContent = S.hidden
    ? (lost ? 'Du är gömd. Monstret letar…' : 'Du är gömd, men monstret kommer!')
    : (lost ? 'Monstret har tappat bort dig. Spring!' : 'Monstret jagar dig!');

  let steer = m.map;
  if (lost) {
    if (!m.tmap || (!m.next && m.cell.x === m.target.x && m.cell.y === m.target.y)) pickWanderTarget(m);
    steer = m.tmap;
  }
  if (!m.next) {
    const here = steer.get(cellKey(m.cell));
    const d = openDirs(maze, m.cell.x, m.cell.y).find((dir) =>
      steer.get(`${m.cell.x + DELTA[dir].dx},${m.cell.y + DELTA[dir].dy}`) === here - 1);
    if (d) {
      m.next = { x: m.cell.x + DELTA[d].dx, y: m.cell.y + DELTA[d].dy };
      m.t = 0;
      m.yaw = Math.atan2(DELTA[d].dx, DELTA[d].dy);
    }
  }
  if (m.next) {
    m.t += m.plan.speed * dt;
    const a = cellPos(m.cell.x, m.cell.y);
    const b = cellPos(m.next.x, m.next.y);
    monster.position.lerpVectors(a, b, Math.min(1, m.t));
    if (m.t >= 1) { m.cell = m.next; m.next = null; }
  }
  const dx = monster.position.x - hero.position.x;
  const dz = monster.position.z - hero.position.z;
  const reach = S.hidden ? (lost ? 0 : 1.2) : 0.55;
  if (reach && Math.hypot(dx, dz) < reach) finish(false, 'monster');
}

function animateMonster(dt) {
  if (!monster.visible || !S.mon) return;
  const t = performance.now() / 1000;
  monster.position.y = Math.abs(Math.sin(t * 9)) * 0.08;
  monster.rotation.y = lerpAngle(monster.rotation.y, S.mon.yaw, Math.min(1, dt * 10));
  monster.scale.set(1 + Math.sin(t * 9) * 0.03, 1 - Math.sin(t * 9) * 0.03, 1);
  // Röd kant på skärmen när monstret är nära.
  $('danger').style.opacity = S.phase === 'play' ? S.mon.mode === 'lost' ? 0 : Math.max(0, Math.min(0.7, (6 - S.mon.dist) / 6)) : 0;
}

// ---------- Reaktioner ----------
function react(kind) {
  S.anim.reaction = kind;
  S.anim.reactionT = 0;
}

function animateHero(dt) {
  const { head, body, legs } = hero.userData;
  S.anim.t += dt;
  const t = S.anim.t;
  const running = S.run !== null;

  // Lugn grundrörelse
  head.rotation.set(0, 0, 0);
  body.scale.y = 1.1;
  hero.rotation.z = 0;
  hero.rotation.y = lerpAngle(hero.rotation.y, S.yaw, Math.min(1, dt * 14));

  if (running) {
    const f = t * 16;
    hero.position.y = Math.abs(Math.sin(f)) * 0.07;
    legs[0].position.z = Math.sin(f) * 0.12;
    legs[1].position.z = -Math.sin(f) * 0.12;
    body.rotation.x = 0.12;
  } else {
    hero.position.y = 0;
    legs[0].position.z = legs[1].position.z = 0;
    body.rotation.x = 0;
    const r = S.anim.reaction;
    S.anim.reactionT += dt;
    const rt = S.anim.reactionT;
    if (r === 'look' || r === 'idle') {
      // Tittar åt vänster och höger. Kliar sig i huvudet om det dröjer.
      head.rotation.y = Math.sin(rt * 3) * 0.7 * Math.min(1, rt * 2) * (rt < 2.2 ? 1 : 0);
      if (rt > 4) {
        head.rotation.z = Math.sin(rt * 14) * 0.12;
        hero.position.y = Math.abs(Math.sin(rt * 7)) * 0.015;
      }
    } else if (r === 'deadend') {
      head.rotation.y = Math.sin(rt * 14) * 0.5 * Math.max(0, 1 - rt);
      body.scale.y = 1.1 - 0.12 * Math.max(0, 1 - rt);
    } else if (r === 'win') {
      hero.position.y = Math.abs(Math.sin(rt * 6)) * 0.35;
      hero.rotation.y += dt * 6;
    } else if (r === 'lose') {
      body.scale.y = 1.1 - 0.2 * Math.min(1, rt * 2);
      head.rotation.x = 0.45 * Math.min(1, rt * 2);
      hero.rotation.z = Math.sin(rt * 2) * 0.05;
    }
  }
}

// ---------- Kamera ----------
function snapCamera() {
  S.camYaw = S.yaw;
  S.camVel = 0;
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
  S.hidden = false;
  hero.visible = true;
  const used = S.elapsed;
  const key = `${settings.mode}:${settings.difficulty}:${settings.level}`;

  let stars = 0;
  if (win) {
    stars = starsFor({ wrongTurns: S.wrongTurns, timeUsed: used, limit: S.limit });
    save.stars[key] = Math.max(save.stars[key] || 0, stars);
  } else {
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
      : save.lives > 0 ? `Du har ${save.lives} liv kvar.` : 'Slut på liv. Du får fem nya.';
    if (!win && save.lives === 0) { save.lives = MAX_LIVES; writeSave(); }
    show($('res-next'), win);
    show($('result'));
  }, win ? 1400 : 1200);
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
  const dt = Math.min(0.05, (now - last) / 1000);
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
    const maxRate = ((Number($('dbg-cam').value) || 60) * Math.PI) / 180;
    const want = Math.max(-maxRate, Math.min(maxRate, angleDiff(S.camYaw, S.yaw) * 1.6));
    S.camVel += (want - S.camVel) * Math.min(1, dt * 3);
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
    renderer.render(scene, camera);
    if (S.phase === 'play' && S.kind === 'monster') renderRear();
  }
  requestAnimationFrame(frame);
}

// ---------- Menyer och input ----------
function refreshMenu() {
  $('lvl-num').textContent = settings.level;
  const info = levelParams(settings.level);
  $('lvl-info').textContent = `${info.mode === 'monster' ? 'Monster' : 'Tidsgräns'} · ${info.width}×${info.height} rutor`;
  const best = save.stars[`${settings.mode}:${settings.difficulty}:${settings.level}`] || 0;
  $('lvl-stars').textContent = '★'.repeat(best) + '☆'.repeat(3 - best);
}

function bindSeg(id, field) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    settings[field] = b.dataset.v;
    for (const x of $(id).children) x.classList.toggle('on', x === b);
    refreshMenu();
  });
}
bindSeg('seg-mode', 'mode');
bindSeg('seg-diff', 'difficulty');

$('lvl-down').onclick = () => { settings.level = Math.max(1, settings.level - 1); refreshMenu(); };
$('lvl-up').onclick = () => { settings.level = Math.min(60, settings.level + 1); refreshMenu(); };
$('play').onclick = startLevel;
$('ready').onclick = beginPlay;
$('res-again').onclick = startLevel;
$('res-next').onclick = () => { settings.level++; startLevel(); };
$('res-menu').onclick = () => {
  S.phase = 'menu';
  show($('result'), false);
  show($('hud'), false);
  show($('ready'), false);
  show($('menu'));
  refreshMenu();
};
$('reset-save').onclick = () => {
  save.stars = {}; save.lives = MAX_LIVES; writeSave(); refreshMenu();
};

for (const btn of document.querySelectorAll('#controls button[data-rel]')) {
  btn.addEventListener('click', () => choose(btn.dataset.rel));
}
$('hide').onclick = hide;
$('unhide').onclick = unhide;
window.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'forward', ArrowDown: 'back' };
  if (map[e.key]) { e.preventDefault(); choose(map[e.key]); }
  if (e.key === 'Enter' && S.phase === 'study') beginPlay();
  if (e.key === 'h') (S.hidden ? unhide : hide)();
});

// Test- och felsökningskrok
window.__game = { S, hero, monster, refreshControls, settings, startLevel, beginPlay, choose, hide, unhide, get maze() { return maze; } };

resize();
refreshMenu();
requestAnimationFrame(frame);
