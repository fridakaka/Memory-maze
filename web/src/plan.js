// Ren planering av banors tema och väder. Ingen grafik, så den kan köras i verktygen.
import { mulberry32 } from './maze.js';

/** Temana i samma ordning som THEMES i themes.js. */
export const THEME_INFO = [
  { id: 'hedge' },
  { id: 'flowers' },
  { id: 'brick' },
  { id: 'indoor', noWeather: true },
  { id: 'autumn' },
  { id: 'snow' },
  { id: 'library', noWeather: true },
  { id: 'candy', noWeather: true },
  { id: 'reef', noWeather: true },
  { id: 'space', noWeather: true },
  { id: 'aquarium', noWeather: true },
  { id: 'forest', sunOnly: true },
  { id: 'stone' },
];

/** Tema för en bana. Alla teman återkommer jämnt och samma tema kommer aldrig två gånger i rad. */
export function themeIdFor(level) {
  const n = THEME_INFO.length;
  const order = (block) => {
    const rng = mulberry32(block * 2654435761 + 99);
    const arr = THEME_INFO.map((_, i) => i);
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
  return THEME_INFO[arr[(level - 1) % n]].id;
}

/** Väder för en bana. De första banorna har alltid sol och inomhusteman har inget väder. */
export function weatherIdFor(level, themeId) {
  const info = THEME_INFO.find((t) => t.id === themeId);
  if (info?.noWeather) return 'none';
  if (info?.sunOnly) return 'sun'; // skogen är alltid en solig dag
  if (level <= 3) return 'sun';
  const r = mulberry32(level * 40503 + 11)();
  if (r < 0.3) return 'sun';
  // Det regnar inte i ett snölandskap.
  if (r < 0.45) return themeId === 'snow' ? 'snow' : 'rain';
  if (r < 0.57) return 'snow';
  if (r < 0.69) return 'fog';
  if (r < 0.8) return 'wind';
  return 'night';
}
