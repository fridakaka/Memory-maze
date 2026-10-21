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

/** Svårighetsparametrar för en nivå (1, 2, 3 ...). */
export function levelParams(level) {
  const size = Math.min(5 + Math.floor((level - 1) * 0.7), 13);
  return {
    width: size,
    height: size + (level > 3 ? 1 : 0),
    loops: level < 4 ? 0 : Math.floor(level / 3),
    seed: level * 7919 + 17,
  };
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
      i++;
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
  maze.start = start;
  maze.goal = goal;
  maze.distToGoal = distances(maze, goal);
  maze.solution = shortestPath(maze, start, goal);
  return maze;
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
    // Ett felval är en korridor som leder längre bort från målet.
    wrong: maze.distToGoal.get(key(to.x, to.y)) > maze.distToGoal.get(key(from.x, from.y)),
  };
}

/** Riktning relativt figurens blickriktning: forward | right | back | left. */
export function relativeDir(heading, dir) {
  const diff = (DIRS.indexOf(dir) - DIRS.indexOf(heading) + 4) % 4;
  return ['forward', 'right', 'back', 'left'][diff];
}

export const RUN_SPEED = 3.4; // celler per sekund
export const DECISION_SECONDS = 1.2; // räknas in per korsning i tidsgränsen

/** Tidsgräns i sekunder för en bana. */
export function timeLimit(maze, level, difficulty = 'medium', tweak = 1) {
  const nodesOnPath = maze.solution.filter((c) => isNode(maze, c.x, c.y)).length;
  const base = (maze.solution.length - 1) / RUN_SPEED + nodesOnPath * DECISION_SECONDS;
  // Generöst i början och snävare ju längre man kommer.
  const levelFactor = Math.max(1.9, 4.2 - (level - 1) * 0.25);
  const diffFactor = { easy: 1.3, medium: 1, hard: 0.8 }[difficulty] ?? 1;
  return Math.ceil(base * levelFactor * diffFactor * tweak);
}

export const STUDY_SECONDS = { easy: 30, medium: 15, hard: 8 };

/** 1-3 stjärnor: klarad, inga felval, snabbt (under 60 % av tiden). */
export function starsFor({ wrongTurns, timeUsed, limit }) {
  let stars = 1;
  if (wrongTurns === 0) stars++;
  if (timeUsed <= limit * 0.6) stars++;
  return stars;
}
