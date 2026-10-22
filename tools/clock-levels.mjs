// Klockbanor: långa banor där tiden från början är för kort. Man plockar upp klockor i
// sidogångar för extra tid. Med en eller två klockor räcker tiden, och tar man alla får man en bonus.
//
// after: efter vilken vanlig bana klockbanan ligger på bankartan.
export const CLOCK_LEVELS = [
  { id: 3001, after: 35, size: [14, 15], d: 0.6, clocks: 4, theme: 'brick', weather: 'sun', seed: 30011 },
  { id: 3002, after: 65, size: [18, 19], d: 0.8, clocks: 5, theme: 'snow', weather: 'snow', seed: 30021 },
  { id: 3003, after: 92, size: [22, 23], d: 0.95, clocks: 6, theme: 'space', weather: 'none', seed: 30031 },
];
// Tidsgränsen i spelet: start = START_FACTOR * perfekt tid, varje klocka ger BONUS_FACTOR * perfekt tid.
export const START_FACTOR = 0.8;
export const BONUS_FACTOR = 0.45;
