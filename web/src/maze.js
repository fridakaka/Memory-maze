// Ren spellogik för Maze Memory. Ingen grafik och ingen DOM, så att den
// kan flyttas till en iPhone-app senare.

export const DIRS = ['N', 'E', 'S', 'W'];
export const DELTA = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};
export const OPPOSITE = { N: 'S', E: 'W', S: 'N', W: 'E' };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x, y) => `${x},${y}`;

export const MAX_SIZE = 28;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Svårighetsparametrar för en nivå (1, 2, 3 ...).
 * d (0-1) är banans svårighet. Den stiger långsamt men varierar från bana
 * till bana: var femte bana är tuff och banan efter är en andningspaus.
 * mode är 'time' (tidsgräns) eller 'monster' (ett monster jagar).
 */
export function levelParams(level) {
  const rng = mulberry32(level * 104729 + 7);
  const trend = Math.min(1, (level - 1) / 30);
  const amp = 0.15 + 0.85 * Math.min(1, (level - 1) / 12);
  let offset = (rng() - 0.5) * 0.8;
  if (level % 5 === 0) offset = 0.35;
  else if (level % 5 === 1 && level > 1) offset = -0.4;
  const d = clamp(trend + offset * amp, 0, 1);
  const mode = level >= 4 && (level === 4 || rng() < 0.4) ? 'monster' : 'time';
  const size = Math.min(5 + Math.round(d * 21), MAX_SIZE);
  return {
    width: size,
    height: size + (d > 0.2 ? 1 : 0),
    loops: d < 0.2 ? 0 : Math.round(d * 7),
    seed: level * 7919 + 17,
    d,
    mode,
  };
}

/** Sant om en 2x2-ruta har alla fyra inre väggar öppna. */
function squareIsOpen(open, x, y) {
  if (x < 0 || y < 0 || y + 1 >= open.length || x + 1 >= open[0].length) return false;
  return open[y][x].E && open[y][x].S && open[y][x + 1].S && open[y + 1][x].E;
}

/** Sant om förbindelsen mellan (x1,y1) och (x2,y2) slutar en 2x2-ruta. */
function makesOpenSquare(open, x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return y1 === y2 ? squareIsOpen(open, x, y) || squareIsOpen(open, x, y - 1)
    : squareIsOpen(open, x, y) || squareIsOpen(open, x - 1, y);
}

/** Skapar en labyrint (DFS) med garanterad lösning. */
export function generateMaze({ width, height, loops = 0, seed = 1 }) {
  const rng = mulberry32(seed);
  const open = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ N: false, E: false, S: false, W: false }))
  );
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  const link = (x, y, d) => {
    const { dx, dy } = DELTA[d];
    open[y][x][d] = true;
    open[y + dy][x + dx][OPPOSITE[d]] = true;
  };

  const seen = new Set([key(0, 0)]);
  const stack = [[0, 0]];
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const nx = x + DELTA[d].dx;
      const ny = y + DELTA[d].dy;
      return inside(nx, ny) && !seen.has(key(nx, ny));
    });
    if (!options.length) {
      stack.pop();
      continue;
    }
    const d = options[Math.floor(rng() * options.length)];
    link(x, y, d);
    const nx = x + DELTA[d].dx;
    const ny = y + DELTA[d].dy;
    seen.add(key(nx, ny));
    stack.push([nx, ny]);
  }

  // Extra förbindelser så att det finns flera vägar på senare nivåer.
  for (let i = 0, tries = 0; i < loops && tries < 200; tries++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const d = DIRS[Math.floor(rng() * 4)];
    const nx = x + DELTA[d].dx;
    const ny = y + DELTA[d].dy;
    if (inside(nx, ny) && !open[y][x][d]) {
      link(x, y, d);
      // Inga öppna ytor på 2x2 rutor: ta bort förbindelsen om den skapar en.
      if (makesOpenSquare(open, x, y, nx, ny)) {
        open[y][x][d] = false;
        open[ny][nx][OPPOSITE[d]] = false;
      } else {
        i++;
      }
    }
  }

  const maze = { width, height, open };

  // Start slumpas bland nedre kanten, mål är den cell som ligger längst bort.
  const start = { x: Math.floor(rng() * width), y: height - 1 };
  const fromStart = distances(maze, start);
  let goal = start;
  let best = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = fromStart.get(key(x, y));
      if (dist > best) {
        best = dist;
        goal = { x, y };
      }
    }
  }
  return finalizeMaze(maze, start, goal);
}

/** Sätter start och mål och räknar ut avstånd till målet och kortaste vägen. */
export function finalizeMaze(maze, start, goal) {
  maze.start = start;
  maze.goal = goal;
  maze.distToGoal = distances(maze, goal);
  maze.solution = shortestPath(maze, start, goal);
  return maze;
}

/**
 * Banor som data. Varje cell skrivs som en siffra: 1 = öppet åt öster, 2 = öppet åt
 * söder (summan om båda). Väster och norr följer av grannarna.
 */
export function encodeMaze(maze) {
  const rows = [];
  for (let y = 0; y < maze.height; y++) {
    let row = '';
    for (let x = 0; x < maze.width; x++) {
      const o = maze.open[y][x];
      row += (o.E ? 1 : 0) + (o.S ? 2 : 0);
    }
    rows.push(row);
  }
  return { width: maze.width, height: maze.height, cells: rows, start: maze.start, goal: maze.goal };
}

export function decodeMaze(data) {
  const { width, height } = data;
  const open = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ N: false, E: false, S: false, W: false })));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Number(data.cells[y][x]);
      if (v & 1 && x + 1 < width) { open[y][x].E = true; open[y][x + 1].W = true; }
      if (v & 2 && y + 1 < height) { open[y][x].S = true; open[y + 1][x].N = true; }
    }
  }
  return finalizeMaze({ width, height, open }, { ...data.start }, { ...data.goal });
}

/** Bygger en bana för hand: varje stig är en lista av celler som förbinds i tur och ordning. */
/**
 * Fyller rutor som ingen stig går genom med korta återvändsgränder, så att banan ser ut som
 * en vanlig labyrint och inte har solida block. Det blir bara träd av nya gångar (inga loopar
 * eller öppna 2x2-ytor) och den rätta vägen ändras inte.
 * protect: stängda väggar som ska stå kvar ("x,y,dir"), freeze: rutor som inte får byggas ut.
 */
function fillUnused(open, width, height, protect, freeze) {
  let seed = 7919 + width * 31 + height;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const count = (c) => DIRS.filter((d) => c[d]).length;
  const blocked = (x, y, d) => protect.has(`${x},${y},${d}`)
    || protect.has(`${x + DELTA[d].dx},${y + DELTA[d].dy},${OPPOSITE[d]}`);
  for (;;) {
    const deadEnds = [];
    const others = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const c = open[y][x];
        const n = count(c);
        if (n === 0 || freeze.has(`${x},${y}`)) continue;
        for (const d of DIRS) {
          const nx = x + DELTA[d].dx, ny = y + DELTA[d].dy;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          if (count(open[ny][nx]) !== 0 || blocked(x, y, d)) continue;
          (n === 1 ? deadEnds : others).push({ x, y, d, nx, ny });
        }
      }
    }
    const pool = deadEnds.length ? deadEnds : others;
    if (!pool.length) return;
    const e = pool[Math.floor(rnd() * pool.length)];
    open[e.y][e.x][e.d] = true;
    open[e.ny][e.nx][OPPOSITE[e.d]] = true;
  }
}

export function mazeFromPaths(width, height, paths, { fill = false, protect = [], freeze = [] } = {}) {
  const open = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ N: false, E: false, S: false, W: false })));
  for (const path of paths) {
    for (let i = 0; i + 1 < path.length; i++) {
      const [x, y] = path[i];
      const [nx, ny] = path[i + 1];
      const d = DIRS.find((dir) => DELTA[dir].dx === nx - x && DELTA[dir].dy === ny - y);
      if (!d) throw new Error(`Cellerna ${x},${y} och ${nx},${ny} ligger inte bredvid varandra`);
      open[y][x][d] = true;
      open[ny][nx][OPPOSITE[d]] = true;
    }
  }
  if (fill) fillUnused(open, width, height, new Set(protect), new Set(freeze));
  const [sx, sy] = paths[0][0];
  const [gx, gy] = paths[0].at(-1);
  return finalizeMaze({ width, height, open }, { x: sx, y: sy }, { x: gx, y: gy });
}

export function openDirs(maze, x, y) {
  return DIRS.filter((d) => maze.open[y][x][d]);
}

export function distances(maze, from) {
  const dist = new Map([[key(from.x, from.y), 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const d of openDirs(maze, x, y)) {
      const nx = x + DELTA[d].dx;
      const ny = y + DELTA[d].dy;
      if (!dist.has(key(nx, ny))) {
        dist.set(key(nx, ny), dist.get(key(x, y)) + 1);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return dist;
}

export function shortestPath(maze, from, to) {
  const dist = distances(maze, to);
  const path = [{ x: from.x, y: from.y }];
  let cur = from;
  while (cur.x !== to.x || cur.y !== to.y) {
    const here = dist.get(key(cur.x, cur.y));
    const d = openDirs(maze, cur.x, cur.y).find((dir) => {
      const n = { x: cur.x + DELTA[dir].dx, y: cur.y + DELTA[dir].dy };
      return dist.get(key(n.x, n.y)) === here - 1;
    });
    cur = { x: cur.x + DELTA[d].dx, y: cur.y + DELTA[d].dy };
    path.push(cur);
  }
  return path;
}

/** En cell är en nod om den är en korsning, återvändsgränd, start eller mål. */
export function isNode(maze, x, y) {
  if ((x === maze.start.x && y === maze.start.y) || (x === maze.goal.x && y === maze.goal.y)) {
    return true;
  }
  return openDirs(maze, x, y).length !== 2;
}

/**
 * Följer en korridor från en nod i riktning `dir` tills nästa nod nås.
 * Returnerar cellerna längs vägen (exklusive startnoden) och slutriktningen.
 */
export function walkCorridor(maze, from, dir) {
  const cells = [];
  let x = from.x;
  let y = from.y;
  let heading = dir;
  do {
    x += DELTA[heading].dx;
    y += DELTA[heading].dy;
    cells.push({ x, y });
    if (isNode(maze, x, y)) break;
    // Rakt igenom en korridorcell: ta den enda utgången som inte är bakåt.
    heading = openDirs(maze, x, y).find((d) => d !== OPPOSITE[heading]);
  } while (cells.length < maze.width * maze.height);
  const to = cells[cells.length - 1];
  return {
    cells,
    to,
    heading,
    // Ett felval är en korridor som inte tar en närmare målet.
    wrong: maze.distToGoal.get(key(to.x, to.y)) >= maze.distToGoal.get(key(from.x, from.y)),
  };
}

/** Riktning relativt figurens blickriktning: forward | right | back | left. */
export function relativeDir(heading, dir) {
  const diff = (DIRS.indexOf(dir) - DIRS.indexOf(heading) + 4) % 4;
  return ['forward', 'right', 'back', 'left'][diff];
}

export const RUN_SPEED = 3.4; // celler per sekund
export const DECISION_SECONDS = 1.2; // räknas in per korsning i tidsgränsen

/** Tid en spelare som kan vägen behöver (löpning plus ett vägval per korsning). */
export function perfectTime(maze) {
  const nodesOnPath = maze.solution.filter((c) => isNode(maze, c.x, c.y)).length;
  return (maze.solution.length - 1) / RUN_SPEED + nodesOnPath * DECISION_SECONDS;
}

const DIFF_FACTOR = { easy: 1.3, medium: 1, hard: 0.8 };

/** Tidsgräns i sekunder för en bana med svårighet d (0-1). */
export function timeLimit(maze, d, difficulty = 'medium', tweak = 1) {
  // Generöst på lätta banor och snävare på svåra.
  const levelFactor = 4.2 - 2.3 * d;
  return Math.ceil(perfectTime(maze) * levelFactor * (DIFF_FACTOR[difficulty] ?? 1) * tweak);
}

/**
 * Monster som jagar spelaren i stället för tidsgräns.
 * Monstret väcks efter `delay` sekunder vid starten och springer med `speed`
 * celler per sekund längs kortaste vägen till spelaren.
 */
export function monsterPlan(maze, d, difficulty = 'medium', tweak = 1) {
  const perfect = perfectTime(maze);
  const len = maze.solution.length - 1;
  const delay = { easy: 7, medium: 5, hard: 3 }[difficulty] ?? 5;
  const arrival = perfect * Math.max(1.15, (2.0 - 0.8 * d) * (DIFF_FACTOR[difficulty] ?? 1) * tweak);
  const window = Math.max(arrival - delay, len / (RUN_SPEED * 1.05));
  return {
    delay,
    speed: len / window,
    starLimit: Math.ceil(perfect * 1.9),
  };
}

/**
 * Gömställen (tunnor) placeras i några återvändsgränder.
 * Returnerar { x, y, dir, used } där dir är åt vilket håll gången öppnar sig.
 */
export function pickHidingSpots(maze, seed) {
  const rng = mulberry32(seed + 99);
  const ends = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const dirs = openDirs(maze, x, y);
      const isStart = x === maze.start.x && y === maze.start.y;
      const isGoal = x === maze.goal.x && y === maze.goal.y;
      if (dirs.length === 1 && !isStart && !isGoal) ends.push({ x, y, dir: dirs[0], used: false });
    }
  }
  for (let i = ends.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ends[i], ends[j]] = [ends[j], ends[i]];
  }
  return ends.slice(0, clamp(Math.round(ends.length * 0.2), 1, 5));
}

export const LANDMARK_TYPES = ['gate', 'tree', 'lantern', 'statue', 'flag', 'sunflower'];

/**
 * Landmärken som gör banan lättare att minnas ("efter den blå grinden").
 * Två tredjedelar står längs lösningen, resten vid sidovägar. Alla är olika.
 * Returnerar { type, x, y, dir, axis }: dir är en stängd sida (häck) som föremålet
 * står mot, axis är 'x' eller 'z' för grinden (åt vilket håll den spänner).
 */
export function pickLandmarks(maze, d, seed, avoid = []) {
  const rng = mulberry32(seed + 555);
  const count = clamp(2 + Math.round(d * 4), 2, LANDMARK_TYPES.length);
  const used = [];
  const taken = (x, y) => avoid.some((a) => a.x === x && a.y === y) || used.some((u) => Math.abs(u.x - x) + Math.abs(u.y - y) < 4);
  const onSolution = new Set(maze.solution.map((c) => `${c.x},${c.y}`));
  const okCell = (x, y) =>
    !isNode(maze, x, y) && !taken(x, y);

  const picks = [];
  const nPath = Math.ceil(count * 0.67);
  const len = maze.solution.length;
  for (let k = 1; k <= nPath; k++) {
    const target = Math.round((k * len) / (nPath + 1));
    for (let off = 0; off <= 3; off++) {
      const found = [target - off, target + off]
        .map((i) => maze.solution[i])
        .find((c) => c && okCell(c.x, c.y));
      if (found) { picks.push(found); used.push(found); break; }
    }
  }
  const others = [];
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (!onSolution.has(`${x},${y}`) && !isNode(maze, x, y)) others.push({ x, y });
    }
  }
  for (let tries = 0; picks.length < count && others.length && tries < 200; tries++) {
    const c = others[Math.floor(rng() * others.length)];
    if (okCell(c.x, c.y)) { picks.push(c); used.push(c); }
  }

  // Blanda typerna. Grinden måste stå på en rak korridor.
  const types = [...LANDMARK_TYPES];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  const straight = (c) => {
    const o = openDirs(maze, c.x, c.y);
    return o.length === 2 && o[0] === OPPOSITE[o[1]];
  };
  const result = [];
  for (const c of picks) {
    let idx = types.findIndex((t) => t !== 'gate' || straight(c));
    if (idx < 0) idx = 0;
    const type = types.splice(idx, 1)[0];
    const o = openDirs(maze, c.x, c.y);
    const closed = DIRS.filter((dir) => !o.includes(dir));
    const dir = closed[Math.floor(rng() * closed.length)] ?? 'N';
    const axis = o.includes('E') || o.includes('W') ? 'z' : 'x';
    result.push({ type, x: c.x, y: c.y, dir, axis });
  }
  return result;
}

export const STUDY_SECONDS = { easy: 30, medium: 15, hard: 8 };

/** 1-3 stjärnor: klarad, inga felval, snabbt (under 60 % av tiden). */
export function starsFor({ wrongTurns, timeUsed, limit }) {
  let stars = 1;
  if (wrongTurns === 0) stars++;
  if (timeUsed <= limit * 0.6) stars++;
  return stars;
}
