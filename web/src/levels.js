// Banor som data. Spelet läser färdiga banor från levels.json (byggda av tools/build-levels.mjs).
// Finns ingen data genereras banan på plats på samma sätt som verktyget gör det.
import {
  decodeMaze, generateMaze, levelParams, pickHidingSpots, pickLandmarks,
} from './maze.js';
import { themeIdFor, weatherIdFor } from './plan.js';

let store = new Map();

export function setLevelData(json) {
  store = new Map((json?.levels ?? []).map((l) => [l.id, l]));
}

/** Hämtar banor: först från sidan (inbäddat), annars från filen. Fungerar även utan data. */
export async function loadLevelData() {
  if (typeof window !== 'undefined' && window.__LEVELS__) {
    setLevelData(window.__LEVELS__);
    return true;
  }
  try {
    const res = await fetch('levels/levels.json', { cache: 'no-cache' });
    if (!res.ok) return false;
    setLevelData(await res.json());
    return true;
  } catch {
    return false;
  }
}

export const isIntro = (id) => id > 1000;

/** Nummer på introduktionsbanorna i ordning. */
export function introIds() {
  return [...store.keys()].filter(isIntro).sort((a, b) => a - b);
}

/** Antal vanliga banor i datan (minst 60 även utan data). */
export function levelCount() {
  const ids = [...store.keys()].filter((id) => !isIntro(id));
  return ids.length ? Math.max(...ids) : 60;
}

/** Lätt beskrivning av en bana, utan att bygga labyrinten. */
export function levelInfo(id) {
  const data = store.get(id);
  if (data) {
    return {
      id, width: data.width, height: data.height, mode: data.mode, d: data.d,
      themeId: data.theme, weatherId: data.weather, label: data.label ?? null,
      rating: data.rating ?? null, intro: data.intro ?? null, fromData: true,
    };
  }
  const p = levelParams(id);
  const themeId = themeIdFor(id);
  return {
    id, width: p.width, height: p.height, mode: p.mode, d: p.d,
    themeId, weatherId: weatherIdFor(id, themeId), label: null, rating: null, intro: null, fromData: false,
  };
}

/**
 * Bygger en bana som kan spelas. sizeOverride ger en labyrint av vald storlek i stället
 * för den sparade (för testinställningar).
 */
export function buildLevel(id, sizeOverride = 0) {
  const data = store.get(id);
  if (data && !sizeOverride) {
    const maze = decodeMaze(data);
    maze.spots = (data.spots ?? []).map((s) => ({ ...s, used: false }));
    maze.landmarks = (data.landmarks ?? []).map((l) => ({ ...l }));
    return {
      maze, mode: data.mode, d: data.d, themeId: data.theme, weatherId: data.weather,
      plan: data.plan ?? {}, intro: data.intro ?? null, rating: data.rating ?? null, label: data.label ?? null,
    };
  }
  const params = levelParams(id);
  if (sizeOverride) params.width = params.height = sizeOverride;
  const maze = generateMaze(params);
  maze.spots = params.mode === 'monster' ? pickHidingSpots(maze, params.seed) : [];
  maze.landmarks = pickLandmarks(maze, params.d, params.seed, maze.spots);
  const themeId = themeIdFor(id);
  return {
    maze, mode: params.mode, d: params.d, themeId, weatherId: weatherIdFor(id, themeId),
    plan: null, intro: null, rating: null, label: null,
  };
}
