// Bygger banorna som data och testar dem.
//   node tools/build-levels.mjs
// Skriver web/levels/levels.json och web/levels/report.txt. Avslutar med felkod om en
// bana inte klarar testerna.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateMaze, levelParams, pickHidingSpots, pickLandmarks, encodeMaze, mazeFromPaths,
  timeLimit, monsterPlan,
} from '../web/src/maze.js';
import { themeIdFor, weatherIdFor } from '../web/src/plan.js';
import { analyzeLevel } from '../web/src/analysis.js';
import { INTRO_LEVELS } from './intro-levels.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'levels');
const TOTAL = Number(process.env.TOTAL_LEVELS ?? 100);
const MAX_ATTEMPTS = 25;

const entries = [];
const failures = [];
const seenMazes = new Map();

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
    const params = { ...base, seed: base.seed + attempt * 100003 };
    const maze = generateMaze(params);
    const spots = base.mode === 'monster' ? pickHidingSpots(maze, params.seed) : [];
    const landmarks = pickLandmarks(maze, base.d, params.seed, spots);
    const level0 = { mode: base.mode, d: base.d };
    const result = analyzeLevel(maze, level0);
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

// ---- Skriv resultatet ----
fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'levels.json'), JSON.stringify({ version: 1, levels: entries }));

const lines = [];
lines.push(`Banor: ${entries.length} (${TOTAL} vanliga och ${INTRO_LEVELS.length} introduktionsbanor)`);
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
for (const e of entries.filter((x) => x.id > 1000)) {
  lines.push(`  ${e.id} ${e.intro.title}: ${e.width}x${e.height}, väg ${e.metrics.pathLen}, val ${e.metrics.decisions}, betyg ${e.rating} (${e.label})`);
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
