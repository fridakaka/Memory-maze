// Automatisk analys av banor: kvalitetskontroll och svårighetsbetyg. Ren logik utan grafik.
import {
  DIRS, openDirs, isNode, distances, perfectTime, timeLimit, monsterPlan, walkCorridor, RUN_SPEED,
} from './maze.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Antal öppna 2x2-ytor (ska vara 0). */
export function openSquares(maze) {
  let n = 0;
  for (let y = 0; y + 1 < maze.height; y++) {
    for (let x = 0; x + 1 < maze.width; x++) {
      const o = maze.open;
      if (o[y][x].E && o[y][x].S && o[y][x + 1].S && o[y + 1][x].E) n++;
    }
  }
  return n;
}

/** Följer rätt väg från nod till nod och räknar felvalen (ska vara 0). */
export function walkSolution(maze) {
  let pos = { ...maze.start };
  let steps = 0;
  while ((pos.x !== maze.goal.x || pos.y !== maze.goal.y) && steps < 2000) {
    const good = openDirs(maze, pos.x, pos.y).find((d) => !walkCorridor(maze, pos, d).wrong);
    if (!good) return { ok: false, steps };
    pos = walkCorridor(maze, pos, good).to;
    steps++;
  }
  return { ok: pos.x === maze.goal.x && pos.y === maze.goal.y, steps };
}

/**
 * Analyserar en bana. Returnerar mätvärden, ett betyg 0-100 och en lista med problem.
 * level: { mode: 'time' | 'monster' | 'free', d, plan? }
 */
export function analyzeLevel(maze, level, difficulty = 'medium') {
  const problems = [];
  const warnings = [];
  const cells = maze.width * maze.height;

  // Celler utan några öppningar är solida block, så de räknas inte som banans yta.
  let solid = 0;
  for (let y = 0; y < maze.height; y++) for (let x = 0; x < maze.width; x++) if (!openDirs(maze, x, y).length) solid++;
  const reach = distances(maze, maze.start);
  if (reach.size !== cells - solid) problems.push(`Inte alla celler går att nå (${reach.size} av ${cells - solid})`);
  const squares = openSquares(maze);
  if (squares) problems.push(`${squares} öppna 2x2-ytor`);
  const walk = walkSolution(maze);
  if (!walk.ok) problems.push('Rätt väg går inte att gå från nod till nod utan felval');

  const pathLen = maze.solution.length - 1;
  const onPath = new Set(maze.solution.map((c) => `${c.x},${c.y}`));
  let decisions = 0;
  let optionSum = 0;
  for (const c of maze.solution) {
    const exits = openDirs(maze, c.x, c.y).length;
    if (exits >= 3) { decisions++; optionSum += exits - 1; }
  }
  const avgOptions = decisions ? optionSum / decisions : 1;

  // Återvändsgränder och hur stor del av banan som är sidogångar som leder fel
  let deadEnds = 0;
  let junctions = 0;
  let edges = 0;
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const n = openDirs(maze, x, y).length;
      edges += n;
      if (n === 1 && !(x === maze.start.x && y === maze.start.y) && !(x === maze.goal.x && y === maze.goal.y)) deadEnds++;
      if (n >= 3) junctions++;
    }
  }
  edges /= 2;
  const loops = edges - cells + 1;
  const offPath = cells - onPath.size;

  // Tid och tryck
  const perfect = perfectTime(maze);
  let pressure = 0;
  let margin = null;
  if (level.mode === 'time') {
    const limit = level.plan?.timeLimit ?? timeLimit(maze, level.d ?? 0, difficulty);
    margin = limit / perfect;
    pressure = clamp((4.2 - margin) / 2.7, 0, 1);
    if (margin < 1.25) problems.push(`Tidsgränsen är för snäv (${margin.toFixed(2)} gånger den perfekta tiden)`);
  } else if (level.mode === 'monster') {
    const plan = level.plan?.monsterSpeed
      ? { delay: level.plan.delay ?? 5, speed: level.plan.monsterSpeed }
      : monsterPlan(maze, level.d ?? 0, difficulty);
    const arrival = plan.delay + pathLen / plan.speed;
    margin = arrival / perfect;
    pressure = clamp((2.2 - margin) / 1.2, 0, 1);
    if (margin < 1.1) problems.push(`Monstret är för snabbt (${margin.toFixed(2)} gånger den perfekta tiden)`);
    if (plan.speed > RUN_SPEED) problems.push('Monstret är snabbare än figuren');
  }

  const parts = {
    len: clamp((pathLen - 10) / 150, 0, 1),
    dec: clamp(decisions / 25, 0, 1),
    opt: clamp((avgOptions - 1) / 1.5, 0, 1),
    dead: clamp(offPath / cells / 0.7, 0, 1),
    loops: clamp(loops / 12, 0, 1),
    pressure,
  };
  const rating = Math.round(100 * (0.22 * parts.len + 0.28 * parts.dec + 0.12 * parts.opt
    + 0.15 * parts.dead + 0.08 * parts.loops + 0.15 * parts.pressure));
  const label = rating < 40 ? 'easy' : rating < 75 ? 'mid' : 'hard';

  return {
    problems, warnings,
    metrics: { cells, pathLen, decisions, avgOptions: Number(avgOptions.toFixed(2)), junctions, deadEnds, loops, perfectTime: Number(perfect.toFixed(1)), margin: margin === null ? null : Number(margin.toFixed(2)) },
    rating, label,
  };
}

export { DIRS, isNode };
