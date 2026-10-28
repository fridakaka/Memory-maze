// Expeditioner: en lång färd i flera delar. Efter varje del kommer man till en checkpoint
// och får se nästa del av kartan. Varje del är en egen labyrint.
//
// after: efter vilken vanlig bana expeditionen ligger på bankartan.
// kind: free = ingen tidsgräns, time = en gemensam tidsgräns för hela färden,
// monster = ett monster jagar i varje del.
export const EXPEDITIONS = [
  { id: 2001, title: 'Expedition 1', after: 20, legs: 3, size: [12, 13], d: 0.55, kind: 'free', theme: 'flowers', weather: 'sun', seed: 20011 },
  { id: 2002, title: 'Expedition 2', after: 50, legs: 4, size: [16, 17], d: 0.8, kind: 'time', theme: 'autumn', weather: 'wind', seed: 20021 },
  { id: 2003, title: 'Expedition 3', after: 80, legs: 5, size: [22, 23], d: 1.0, kind: 'time', theme: 'stone', weather: 'fog', seed: 20031 },
];
