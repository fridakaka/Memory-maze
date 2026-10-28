// Bygger banorna som data och testar dem.
//   node tools/build-levels.mjs
// Skriver web/levels/levels.json och web/levels/report.txt. Avslutar med felkod om en
// bana inte klarar testerna.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateMaze, levelParams, pickHidingSpots, pickLandmarks, encodeMaze, mazeFromPaths,
  timeLimit, monsterPlan, pickClocks, wallFollowCells, perfectTime, RUN_SPEED, DECISION_SECONDS,
} from '../web/src/maze.js';
import { themeIdFor, weatherIdFor } from '../web/src/plan.js';
import { analyzeLevel } from '../web/src/analysis.js';
import { INTRO_LEVELS } from './intro-levels.mjs';
import { decodeMaze } from '../web/src/maze.js';
import { EXPEDITIONS } from './expeditions.mjs';
import { DISCO_LEVELS } from './disco-levels.mjs';
import { CLOCK_LEVELS, START_FACTOR, BONUS_FACTOR } from './clock-levels.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'levels');
const TOTAL = Number(process.env.TOTAL_LEVELS ?? 100);
const MAX_ATTEMPTS = 25;

const entries = [];
const failures = [];
const seenMazes = new Map();

/** Sant om man kommer fram genom att alltid hålla höger eller vänster hand mot väggen. */
function wallFollowSolves(maze) {
  const g = `${maze.goal.x},${maze.goal.y}`;
  return wallFollowCells(maze, maze.start, 'R').has(g) || wallFollowCells(maze, maze.start, 'L').has(g);
}

/** Räknar ut tidsgräns eller monsterfart så att de sparas i banans data. */
function planFor(maze, mode, d) {
  if (mode === 'time') return { timeLimit: timeLimit(maze, d, 'medium') };
  if (mode === 'monster') { const p = monsterPlan(maze, d, 'medium'); return { monsterSpeed: Number(p.speed.toFixed(3)), delay: p.delay, starLimit: p.starLimit }; }
  return {};
}

// ---- Genererade banor ----
for (let level = 1; level <= TOTAL; level++) {
  const base = levelParams(level);
  let chosen = null;
  let lastProblems = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt++) {
    const params = { ...base, seed: base.seed + attempt * 100003, loops: base.loops + Math.floor(attempt / 4) };
    const maze = generateMaze(params);
    const spots = base.mode === 'monster' ? pickHidingSpots(maze, params.seed) : [];
    const landmarks = pickLandmarks(maze, base.d, params.seed, spots);
    const level0 = { mode: base.mode, d: base.d };
    const result = analyzeLevel(maze, level0);
    if (wallFollowSolves(maze)) result.problems.push('Håll höger eller vänster räcker för att nå målet');
    if (maze.solution.length - 1 < Math.round((maze.width + maze.height) * 0.6)) result.problems.push('För kort väg till målet');
    const key = JSON.stringify(maze.open);
    const dup = seenMazes.get(key);
    if (dup) result.problems.push(`Samma bana som ${dup}`);
    // Landmärken får inte stå på samma ruta som ett gömställe
    if (spots.some((sp) => landmarks.some((l) => l.x === sp.x && l.y === sp.y))) result.problems.push('Landmärke på gömställe');
    if (new Set(landmarks.map((l) => l.type)).size !== landmarks.length) result.problems.push('Samma landmärke två gånger');
    if (!result.problems.length) {
      seenMazes.set(key, level);
      chosen = { params, maze, spots, landmarks, result, attempt };
    } else {
      lastProblems = result.problems;
    }
  }
  if (!chosen) {
    failures.push(`Bana ${level}: ${lastProblems.join('; ')}`);
    continue;
  }
  const { maze, spots, landmarks, result, params } = chosen;
  entries.push({
    id: level,
    ...encodeMaze(maze),
    mode: base.mode,
    d: Number(base.d.toFixed(3)),
    theme: themeIdFor(level),
    weather: weatherIdFor(level, themeIdFor(level)),
    seed: params.seed,
    spots: spots.map(({ x, y, dir }) => ({ x, y, dir })),
    landmarks,
    plan: planFor(maze, base.mode, base.d),
    rating: result.rating,
    label: result.label,
    metrics: result.metrics,
  });
}

// ---- Introduktionsbanor ----
for (const intro of INTRO_LEVELS) {
  // Tomma rutor fylls med återvändsgränder. Landmärkenas väggar och gömställen ska stå kvar.
  const protect = intro.landmarks.filter((l) => l.type !== 'gate').map((l) => `${l.x},${l.y},${l.dir}`);
  const freeze = [
    ...intro.spots.map((sp) => `${sp.x},${sp.y}`),
    ...intro.guides.filter((g) => g.text.includes('Vänd')).map((g) => `${g.x},${g.y}`),
  ];
  const maze = mazeFromPaths(intro.width, intro.height, intro.paths, { fill: true, protect, freeze });
  const mode = intro.kind === 'free' ? 'free' : intro.kind;
  const plan = intro.kind === 'time' ? { timeLimit: intro.timeLimit }
    : intro.kind === 'monster' ? { monsterSpeed: intro.monsterSpeed, delay: intro.delay, starLimit: 30 }
      : {};
  const result = analyzeLevel(maze, { mode, d: 0, plan });
  // Landmärken och gömställen måste stå på riktiga rutor med en stängd sida
  for (const l of intro.landmarks) {
    const o = maze.open[l.y]?.[l.x];
    if (!o) result.problems.push(`Landmärke utanför banan: ${l.x},${l.y}`);
    else if (l.type !== 'gate' && o[l.dir]) result.problems.push(`Landmärket ${l.type} står mot en öppning (${l.x},${l.y} ${l.dir})`);
  }
  for (const g of intro.guides) if (!maze.open[g.y]?.[g.x]) result.problems.push(`Guide utanför banan: ${g.x},${g.y}`);
  if (result.problems.length) failures.push(`Introduktion ${intro.id} (${intro.title}): ${result.problems.join('; ')}`);
  entries.push({
    id: intro.id,
    ...encodeMaze(maze),
    mode,
    d: 0,
    theme: 'hedge',
    weather: 'sun',
    spots: intro.spots,
    landmarks: intro.landmarks.map((l) => ({ axis: 'z', ...l })),
    plan,
    rating: result.rating,
    label: result.label,
    metrics: result.metrics,
    intro: {
      title: intro.title,
      forceMode: intro.mode,
      studySeconds: intro.studySeconds,
      steps: intro.steps,
      guides: intro.guides,
    },
  });
}

// ---- Expeditioner ----
for (const exp of EXPEDITIONS) {
  const legs = [];
  for (let leg = 0; leg < exp.legs; leg++) {
    let chosen = null;
    let lastProblems = [];
    for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt++) {
      const seed = exp.seed + leg * 7919 + attempt * 100003;
      const params = {
        width: exp.size[0], height: exp.size[1], loops: Math.round(exp.d * 7) + Math.floor(attempt / 4), seed,
      };
      const maze = generateMaze(params);
      const spots = exp.kind === 'monster' ? pickHidingSpots(maze, seed) : [];
      const landmarks = pickLandmarks(maze, exp.d, seed, spots);
      const result = analyzeLevel(maze, { mode: exp.kind, d: exp.d });
      if (wallFollowSolves(maze)) result.problems.push('Håll höger eller vänster räcker för att nå målet');
    if (maze.solution.length - 1 < Math.round((maze.width + maze.height) * 0.6)) result.problems.push('För kort väg till målet');
      const key = JSON.stringify(maze.open);
      if (seenMazes.has(key)) result.problems.push(`Samma bana som ${seenMazes.get(key)}`);
      if (spots.some((sp) => landmarks.some((l) => l.x === sp.x && l.y === sp.y))) result.problems.push('Landmärke på gömställe');
      if (new Set(landmarks.map((l) => l.type)).size !== landmarks.length) result.problems.push('Samma landmärke två gånger');
      if (!result.problems.length) {
        seenMazes.set(key, `${exp.title} del ${leg + 1}`);
        chosen = { maze, spots, landmarks, result };
      } else {
        lastProblems = result.problems;
      }
    }
    if (!chosen) {
      failures.push(`${exp.title} del ${leg + 1}: ${lastProblems.join('; ')}`);
      continue;
    }
    const { maze, spots, landmarks, result } = chosen;
    legs.push({
      ...encodeMaze(maze),
      mode: exp.kind,
      d: exp.d,
      theme: exp.theme,
      weather: exp.weather,
      spots: spots.map(({ x, y, dir }) => ({ x, y, dir })),
      landmarks,
      plan: planFor(maze, exp.kind, exp.d),
      rating: result.rating,
      label: result.label,
      metrics: result.metrics,
    });
  }
  if (legs.length === exp.legs) {
    entries.push({ id: exp.id, ...legs[0], expedition: { title: exp.title, after: exp.after, legs } });
  }
}

// ---- Klockbanor ----
for (const cl of CLOCK_LEVELS) {
  let chosen = null;
  let lastProblems = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt++) {
    const seed = cl.seed + attempt * 100003;
    const maze = generateMaze({ width: cl.size[0], height: cl.size[1], loops: Math.round(cl.d * 7) + Math.floor(attempt / 4), seed });
    const landmarks = pickLandmarks(maze, cl.d, seed, []);
    const clocks = pickClocks(maze, cl.clocks, seed, landmarks);
    const result = analyzeLevel(maze, { mode: 'free', d: cl.d });
    if (wallFollowSolves(maze)) result.problems.push('Håll höger eller vänster räcker för att nå målet');
    if (maze.solution.length - 1 < Math.round((maze.width + maze.height) * 0.6)) result.problems.push('För kort väg till målet');
    const key = JSON.stringify(maze.open);
    if (seenMazes.has(key)) result.problems.push(`Samma bana som ${seenMazes.get(key)}`);
    if (new Set(landmarks.map((l) => l.type)).size !== landmarks.length) result.problems.push('Samma landmärke två gånger');
    if (clocks.length < cl.clocks) result.problems.push(`Hittade bara ${clocks.length} av ${cl.clocks} klockor`);
    // Tiden ska vara för kort utan klockor, men räcka med en klocka (och gott och väl med två)
    const perfect = perfectTime(maze);
    const start = perfect * START_FACTOR;
    const bonus = perfect * BONUS_FACTOR;
    const cost = (c) => (2 * c.detour) / RUN_SPEED + 2 * DECISION_SECONDS;
    const sorted = [...clocks].sort((a, b) => cost(a) - cost(b));
    if (!(start < perfect)) result.problems.push('Tiden är inte för kort utan klockor');
    if (sorted.length && perfect + cost(sorted[0]) > start + bonus) result.problems.push('Går inte att klara med en klocka');
    if (sorted.length > 1 && perfect + cost(sorted[0]) + cost(sorted[1]) > start + 2 * bonus - 0.15 * perfect) result.problems.push('Två klockor ger för snäv marginal');
    if (!result.problems.length) {
      seenMazes.set(key, `klockbana ${cl.id}`);
      chosen = { maze, landmarks, clocks, result };
    } else {
      lastProblems = result.problems;
    }
  }
  if (!chosen) { failures.push(`Klockbana ${cl.id}: ${lastProblems.join('; ')}`); continue; }
  const { maze, landmarks, clocks, result } = chosen;
  entries.push({
    id: cl.id,
    ...encodeMaze(maze),
    mode: 'time',
    d: cl.d,
    theme: cl.theme,
    weather: cl.weather,
    spots: [],
    landmarks,
    plan: {},
    clocks,
    after: cl.after,
    rating: result.rating,
    label: result.label,
    metrics: result.metrics,
  });
}

// ---- Discobanor ----
for (const dl of DISCO_LEVELS) {
  let chosen = null;
  let lastProblems = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt++) {
    const seed = dl.seed + attempt * 100003;
    const maze = generateMaze({ width: dl.size[0], height: dl.size[1], loops: Math.round(dl.d * 7) + Math.floor(attempt / 4), seed });
    const landmarks = pickLandmarks(maze, dl.d, seed, []);
    const result = analyzeLevel(maze, { mode: 'time', d: dl.d });
    if (wallFollowSolves(maze)) result.problems.push('Håll höger eller vänster räcker för att nå målet');
    if (maze.solution.length - 1 < Math.round((maze.width + maze.height) * 0.6)) result.problems.push('För kort väg till målet');
    const key = JSON.stringify(maze.open);
    if (seenMazes.has(key)) result.problems.push(`Samma bana som ${seenMazes.get(key)}`);
    if (new Set(landmarks.map((l) => l.type)).size !== landmarks.length) result.problems.push('Samma landmärke två gånger');
    if (!result.problems.length) {
      seenMazes.set(key, `discobana ${dl.id}`);
      chosen = { maze, landmarks, result };
    } else {
      lastProblems = result.problems;
    }
  }
  if (!chosen) { failures.push(`Discobana ${dl.id}: ${lastProblems.join('; ')}`); continue; }
  const { maze, landmarks, result } = chosen;
  entries.push({
    id: dl.id,
    ...encodeMaze(maze),
    mode: 'time',
    d: dl.d,
    theme: 'disco',
    weather: 'none',
    spots: [],
    landmarks,
    plan: planFor(maze, 'time', dl.d),
    disco: true,
    after: dl.after,
    rating: result.rating,
    label: result.label,
    metrics: result.metrics,
  });
}

// ---- Skriv resultatet ----
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'levels.json'), JSON.stringify({ version: 1, levels: entries }));

const lines = [];
lines.push(`Banor: ${entries.length} (${TOTAL} vanliga, ${INTRO_LEVELS.length} introduktionsbanor, ${EXPEDITIONS.length} expeditioner och ${CLOCK_LEVELS.length} klockbanor och ${DISCO_LEVELS.length} discobanor)`);
lines.push('');
lines.push('Bana  Läge     d     Storlek  Väg  Val  Sidogångar%  Loopar  Margin  Betyg  Typ');
let prev = 0;
for (const e of entries.filter((x) => x.id <= TOTAL)) {
  const m = e.metrics;
  const offPath = Math.round(((m.cells - (m.pathLen + 1)) / m.cells) * 100);
  lines.push(
    `${String(e.id).padStart(4)}  ${e.mode.padEnd(7)}  ${e.d.toFixed(2)}  ${`${e.width}x${e.height}`.padEnd(7)}  `
    + `${String(m.pathLen).padStart(3)}  ${String(m.decisions).padStart(3)}  ${String(offPath).padStart(10)}  ${String(m.loops).padStart(6)}  `
    + `${m.margin === null ? '   -  ' : m.margin.toFixed(2).padStart(6)}  ${String(e.rating).padStart(5)}  ${e.label}`);
  prev = e.rating;
}
void prev;
lines.push('');
lines.push('Introduktionsbanor:');
for (const e of entries.filter((x) => x.id > 1000 && x.id < 2000)) {
  lines.push(`  ${e.id} ${e.intro.title}: ${e.width}x${e.height}, väg ${e.metrics.pathLen}, val ${e.metrics.decisions}, betyg ${e.rating} (${e.label})`);
}
lines.push('');
lines.push('Expeditioner:');
for (const e of entries.filter((x) => x.id >= 2000 && x.id < 3000)) {
  const parts = e.expedition.legs.map((l) => `${l.width}x${l.height} (väg ${l.metrics.pathLen}, val ${l.metrics.decisions}, betyg ${l.rating})`);
  lines.push(`  ${e.id} ${e.expedition.title} [${e.mode}]: ${parts.join(' → ')}`);
}
lines.push('');
lines.push('Klockbanor:');
for (const e of entries.filter((x) => x.id >= 3000 && x.id < 4000)) {
  lines.push(`  ${e.id} ${e.width}x${e.height}, väg ${e.metrics.pathLen}, val ${e.metrics.decisions}, klockor ${e.clocks.length} (avstickare ${e.clocks.map((c) => c.detour).join('/')}), betyg ${e.rating}`);
}
{
  // Kontroll: vilket håll vägen till målet svänger. Ska vara ungefär lika många åt båda hållen.
  const R = { N: 'E', E: 'S', S: 'W', W: 'N' };
  const dirOf = (p, q) => (q.x > p.x ? 'E' : q.x < p.x ? 'W' : q.y > p.y ? 'S' : 'N');
  let right = 0;
  let left = 0;
  for (const e of entries.filter((x) => x.id <= TOTAL)) {
    const sol = decodeMaze(e).solution;
    let net = 0;
    for (let i = 2; i < sol.length; i++) {
      const d1 = dirOf(sol[i - 2], sol[i - 1]);
      const d2 = dirOf(sol[i - 1], sol[i]);
      if (d1 !== d2) net += R[d1] === d2 ? 1 : -1;
    }
    if (net > 0) right++; else if (net < 0) left++;
  }
  lines.push('');
  lines.push(`Varvriktning (vägen till målet): ${right} banor svänger mest åt höger, ${left} mest åt vänster`);
}
lines.push('');
lines.push('Discobanor:');
for (const e of entries.filter((x) => x.id >= 4000)) {
  lines.push(`  ${e.id} ${e.width}x${e.height}, väg ${e.metrics.pathLen}, val ${e.metrics.decisions}, betyg ${e.rating}`);
}
const byLabel = { easy: 0, mid: 0, hard: 0 };
for (const e of entries.filter((x) => x.id <= TOTAL)) byLabel[e.label]++;
lines.push('');
lines.push(`Fördelning: lätta ${byLabel.easy}, medel ${byLabel.mid}, svåra ${byLabel.hard}`);
lines.push('');
if (failures.length) {
  lines.push('FEL:');
  for (const f of failures) lines.push(`  ${f}`);
} else {
  lines.push('Alla banor klarade testerna.');
}
fs.writeFileSync(path.join(root, 'report.txt'), lines.join('\n') + '\n');
console.log(lines.slice(-6).join('\n'));
if (failures.length) process.exit(1);
