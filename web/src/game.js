import * as THREE from '../vendor/three.module.min.js';
import {
  generateMaze, levelParams, walkCorridor, openDirs, relativeDir,
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
const BG = 0xcfe8ef;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c9d0, 1.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.3);
sun.position.set(4, 9, 6);
scene.add(sun);

const mapCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
const playCam = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
let camera = mapCam;

const mats = {
  floor: new THREE.MeshLambertMaterial({ color: 0xf6ecd6 }),
  wall: new THREE.MeshLambertMaterial({ color: 0x6fb1cf }),
  wallTop: new THREE.MeshLambertMaterial({ color: 0xa9dbee }),
  path: new THREE.MeshLambertMaterial({ color: 0xffa7b8 }),
  start: new THREE.MeshLambertMaterial({ color: 0x7bd389 }),
  goal: new THREE.MeshLambertMaterial({ color: 0xffd25a, emissive: 0x6b4a00 }),
};
const WALL_H = 0.55;
const WALL_T = 0.14;

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

  const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, 0.2, H + 0.4), mats.floor);
  floor.position.y = -0.1;
  mazeGroup.add(floor);

  const hWall = new THREE.BoxGeometry(1 + WALL_T, WALL_H, WALL_T);
  const vWall = new THREE.BoxGeometry(WALL_T, WALL_H, 1 + WALL_T);
  const hTop = new THREE.BoxGeometry(1 + WALL_T, 0.03, WALL_T);
  const vTop = new THREE.BoxGeometry(WALL_T, 0.03, 1 + WALL_T);
  const addWall = (cx, cz, horizontal) => {
    const m = new THREE.Mesh(horizontal ? hWall : vWall, mats.wall);
    m.position.set(cx, WALL_H / 2, cz);
    mazeGroup.add(m);
    const t = new THREE.Mesh(horizontal ? hTop : vTop, mats.wallTop);
    t.position.set(cx, WALL_H + 0.015, cz);
    mazeGroup.add(t);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = cellPos(x, y);
      const o = maze.open[y][x];
      if (!o.N) addWall(c.x, c.z - 0.5, true);
      if (!o.W) addWall(c.x - 0.5, c.z, false);
      if (x === W - 1 && !o.E) addWall(c.x + 0.5, c.z, false);
      if (y === H - 1 && !o.S) addWall(c.x, c.z + 0.5, true);
    }
  }

  const marker = (cell, mat, geo) => {
    const m = new THREE.Mesh(geo, mat);
    const p = cellPos(cell.x, cell.y);
    m.position.set(p.x, 0.02, p.z);
    mazeGroup.add(m);
    return m;
  };
  marker(maze.start, mats.start, new THREE.CylinderGeometry(0.34, 0.34, 0.04, 28));
  const goalMarker = marker(maze.goal, mats.goal, new THREE.CylinderGeometry(0.34, 0.34, 0.05, 5));
  // Mål-stjärna som syns även från snett uppifrån
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mats.goal);
  star.position.set(goalMarker.position.x, 0.55, goalMarker.position.z);
  star.name = 'goalStar';
  mazeGroup.add(star);

  pathGroup = new THREE.Group();
  const tile = new THREE.BoxGeometry(0.62, 0.03, 0.62);
  for (const c of maze.solution) {
    const m = new THREE.Mesh(tile, mats.path);
    const p = cellPos(c.x, c.y);
    m.position.set(p.x, 0.02, p.z);
    pathGroup.add(m);
  }
  mazeGroup.add(pathGroup);
  scene.add(mazeGroup);
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
  const skin = new THREE.MeshLambertMaterial({ color: 0xffc98b });
  const cloth = new THREE.MeshLambertMaterial({ color: 0xff8fa3 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2d3a4a });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), cloth);
  body.scale.set(1, 1.1, 0.95);
  body.position.y = 0.3;
  g.add(body);

  const head = new THREE.Group();
  head.position.y = 0.62;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 18), skin);
  head.add(skull);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.215, 24, 12, 0, TAU, 0, Math.PI * 0.42), cloth);
  hat.position.y = 0.015;
  head.add(hat);
  const bobble = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), white);
  bobble.position.y = 0.23;
  head.add(bobble);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), white);
    eye.position.set(0.08 * s, -0.01, 0.17);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), dark);
    pupil.position.set(0.08 * s, -0.01, 0.213);
    head.add(pupil);
  }
  g.add(head);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), dark);
    leg.position.set(0.09 * s, 0.07, 0);
    g.add(leg);
    legs.push(leg);
  }
  g.userData = { head, body, legs };
  return g;
}
const hero = makeHero();
scene.add(hero);

// ---------- Spelstate ----------
const S = {
  phase: 'menu', // menu | study | play | ended
  node: null, // nuvarande nod {x,y}
  heading: 'N', // blickriktning i nuvarande nod
  run: null, // { pts:[Vector3], seg, t, to, heading, wrong }
  yaw: 0, camYaw: 0,
  limit: 0, timeLeft: 0, studyLeft: 0, studyTotal: 0,
  wrongTurns: 0, elapsed: 0,
  anim: { t: 0, reaction: null, reactionT: 0 },
};

function startLevel() {
  const level = settings.level;
  maze = generateMaze(levelParams(level));
  buildMazeMesh();
  fitMapCamera();

  const dbgStudy = Number($('dbg-study').value) || 0;
  const dbgTime = Number($('dbg-time').value) || 1;
  S.limit = timeLimit(maze, level, settings.difficulty, dbgTime);
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
  camera = mapCam;
  S.phase = 'study';

  show($('menu'), false);
  show($('result'), false);
  show($('hud'));
  show($('ready'));
  show($('controls'), false);
  show($('compass'), false);
  $('hud-level').textContent = `Bana ${level}`;
  $('hud-phase').textContent = settings.mode === 'memory' ? 'Memorera vägen' : 'Hitta och memorera vägen';
  updateHud();
}

function beginPlay() {
  S.phase = 'play';
  pathGroup.visible = false;
  scene.fog = new THREE.Fog(BG, 4.5, 8.5);
  camera = playCam;
  show($('ready'), false);
  show($('controls'));
  $('hud-phase').textContent = 'Spring!';
  snapCamera();
  arriveAtNode(false);
}

function updateHud() {
  $('hud-lives').textContent = '❤'.repeat(save.lives) + '♡'.repeat(MAX_LIVES - save.lives);
  $('hud-wrong').textContent = `✗ ${S.wrongTurns}`;
  const frac = S.phase === 'study' ? S.studyLeft / S.studyTotal : Math.max(0, S.timeLeft / S.limit);
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

function refreshControls() {
  const rels = availableRel();
  for (const btn of document.querySelectorAll('#controls button')) {
    const rel = btn.dataset.rel;
    btn.disabled = S.phase !== 'play' || S.run !== null || !(rel in rels);
  }
  const waiting = S.phase === 'play' && S.run === null;
  show($('compass'), waiting);
}

function choose(rel) {
  if (S.phase !== 'play' || S.run) return;
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
  placeCamera(1);
}

function placeCamera(blend) {
  const pos = hero.position;
  const fwd = new THREE.Vector3(Math.sin(S.camYaw), 0, Math.cos(S.camYaw));
  const target = pos.clone().addScaledVector(fwd, 0.9);
  const want = pos.clone().addScaledVector(fwd, -2.3);
  want.y = 4.4;
  playCam.position.lerp(want, blend);
  playCam.lookAt(target);
}

function updateCompass() {
  // Visar var norr är relativt figurens riktning (framåt = uppåt).
  const deg = ((S.camYaw - Math.PI) * 180) / Math.PI;
  $('needle').style.transform = `rotate(${deg}deg)`;
}

// ---------- Slut ----------
function finish(win) {
  S.phase = 'ended';
  react(win ? 'win' : 'lose');
  show($('controls'), false);
  show($('compass'), false);
  const used = S.limit - S.timeLeft;
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
    $('res-title').textContent = win ? 'Du hittade ut!' : 'Tiden tog slut';
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
    S.timeLeft -= dt;
    S.elapsed += dt;
    if (S.timeLeft <= 0) {
      S.timeLeft = 0;
      S.run = null;
      finish(false);
    } else if (S.run) {
      stepRun(dt);
    }
    updateHud();
  }

  if (S.phase !== 'menu' && S.phase !== 'study') {
    animateHero(dt);
    // Kameran vrider sig mjukt och långsamt efter figuren (mindre åksjuka).
    S.camYaw = lerpAngle(S.camYaw, S.yaw, Math.min(1, dt * 3.2));
    placeCamera(Math.min(1, dt * 9));
    updateCompass();
  } else if (S.phase === 'study') {
    animateHero(dt);
  }
  if (S.phase === 'ended') {
    // Titta på figuren när det är över.
    const star = mazeGroup.getObjectByName('goalStar');
    if (star) star.rotation.y += dt * 2;
  }

  if (maze) renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ---------- Menyer och input ----------
function refreshMenu() {
  $('lvl-num').textContent = settings.level;
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

for (const btn of document.querySelectorAll('#controls button')) {
  btn.addEventListener('click', () => choose(btn.dataset.rel));
}
window.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'forward', ArrowDown: 'back' };
  if (map[e.key]) { e.preventDefault(); choose(map[e.key]); }
  if (e.key === 'Enter' && S.phase === 'study') beginPlay();
});

// Test- och felsökningskrok
window.__game = { S, settings, startLevel, beginPlay, choose, get maze() { return maze; } };

resize();
refreshMenu();
requestAnimationFrame(frame);
