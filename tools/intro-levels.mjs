// Introduktionsbanor som lär ut spelet. De är handbyggda: varje bana är några stigar
// (listor av celler) och beskrivs med vad som ska förklaras och när.
//
// when: study = när kartan visas, play = när spelet börjar, compass = första gången kompassen
// visas, deadend = första återvändsgränden, monsterWake = när monstret vaknar,
// barrel = första gången "Göm dig" visas, hidden = när man har gömt sig.
// hi: vilken del av skärmen som ska markeras.
// guides: vid en korsning (x, y) visas vilken pil man ska trycka på. dirs är riktningen
// (N, E, S, W) för första, andra... besöket. only = de andra pilarna är låsta.

export const INTRO_LEVELS = [
  {
    id: 1001,
    title: 'Kartan',
    width: 4, height: 3,
    paths: [[[0, 2], [1, 2], [2, 2], [2, 1], [2, 0], [3, 0]]],
    landmarks: [{ type: 'lantern', x: 1, y: 2, dir: 'N' }, { type: 'tree', x: 2, y: 1, dir: 'W' }],
    spots: [],
    mode: 'memory', kind: 'free', studySeconds: 30,
    steps: [
      { when: 'study', text: 'Välkommen! Det här är en labyrint ovanifrån. Du är den blå cirkeln och målet är guldstjärnan. Den rosa linjen är rätt väg.' },
      { when: 'study', text: 'De små bilderna är landmärken, till exempel en lykta och ett träd. De hjälper dig att komma ihåg vägen. Tryck på "Jag är redo" när du kan den.', hi: 'ready' },
      { when: 'play', text: 'Nu är kartan borta! Figuren springer själv längs gångarna. När den stannar väljer du väg med pilarna.', hi: 'controls' },
    ],
    guides: [{ x: 0, y: 2, dirs: ['E'], text: 'Tryck på pilen för att springa.', only: true }],
  },
  {
    id: 1002,
    title: 'Vägval',
    width: 5, height: 4,
    paths: [
      [[0, 3], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [4, 3]],
      [[1, 1], [1, 0], [2, 0]],
      [[3, 1], [3, 0], [4, 0], [4, 1]],
    ],
    landmarks: [{ type: 'flag', x: 2, y: 1, dir: 'N' }],
    spots: [],
    mode: 'memory', kind: 'free', studySeconds: 25,
    steps: [
      { when: 'study', text: 'Nu ska du välja väg i korsningarna. Titta på den rosa linjen och kom ihåg åt vilket håll den svänger.' },
      { when: 'play', text: 'Pilarna är sett från figurens håll: ← vänster, ↑ rakt fram och → höger. Den blinkande pilen visar rätt väg.', hi: 'controls' },
    ],
    guides: [
      { x: 0, y: 3, dirs: ['E'], text: 'Tryck på den blinkande pilen.', only: true },
      { x: 1, y: 1, dirs: ['E'], text: 'Tryck på den blinkande pilen.', only: true },
      { x: 3, y: 1, dirs: ['S'], text: 'Tryck på den blinkande pilen.', only: true },
    ],
  },
  {
    id: 1003,
    title: 'Återvändsgränd',
    width: 5, height: 4,
    paths: [
      [[0, 3], [1, 3], [2, 3], [2, 2], [3, 2], [4, 2], [4, 1], [4, 0]],
      [[2, 2], [1, 2], [0, 2]],
    ],
    landmarks: [{ type: 'sunflower', x: 4, y: 1, dir: 'W' }],
    spots: [],
    mode: 'memory', kind: 'free', studySeconds: 25,
    steps: [
      { when: 'study', text: 'Ibland väljer man fel väg. Det är inte farligt, det kostar bara tid. Nu ska du prova det.' },
      { when: 'deadend', text: 'Återvändsgränd! Här går det inte vidare. Tryck på "Vänd" så springer figuren tillbaka till korsningen.', hi: 'back' },
    ],
    guides: [
      { x: 0, y: 3, dirs: ['E'], text: 'Tryck på den blinkande pilen.', only: true },
      { x: 2, y: 2, dirs: ['W', 'E'], text: 'Prova den här vägen först!', only: true },
      { x: 0, y: 2, dirs: ['E'], text: 'Tryck på Vänd.', only: true },
    ],
  },
  {
    id: 1004,
    title: 'Kompassen',
    width: 5, height: 5,
    paths: [
      [[0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [1, 2], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
      [[2, 3], [3, 3], [4, 3]],
    ],
    landmarks: [{ type: 'statue', x: 1, y: 2, dir: 'N' }, { type: 'gate', x: 0, y: 1, dir: 'E', axis: 'x' }],
    spots: [],
    mode: 'memory', kind: 'free', studySeconds: 25,
    steps: [
      { when: 'study', text: 'Kartan har alltid norr uppåt. Titta på hur linjen går: först åt öster, sedan norrut.' },
      { when: 'compass', text: 'Kompassen visar var norr är när du står still. Den hjälper dig att koppla ihop kartan med det du ser i labyrinten.', hi: 'compass' },
    ],
    guides: [
      { x: 0, y: 4, dirs: ['E'], text: 'Tryck på pilen för att springa.', only: true },
      { x: 2, y: 3, dirs: ['N'], text: 'Tryck på den blinkande pilen.', only: true },
    ],
  },
  {
    id: 1005,
    title: 'Hitta själv',
    width: 5, height: 5,
    paths: [
      [[0, 4], [0, 3], [0, 2], [1, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0]],
      [[0, 3], [1, 3]],
      [[2, 2], [2, 1], [2, 0], [3, 0]],
      [[4, 2], [3, 2], [3, 3]],
      [[4, 1], [3, 1]],
    ],
    landmarks: [{ type: 'flag', x: 2, y: 1, dir: 'W' }, { type: 'lantern', x: 4, y: 3, dir: 'E' }],
    spots: [],
    mode: 'navigator', kind: 'free', studySeconds: 30,
    steps: [
      { when: 'study', text: 'Nu är den rosa linjen borta. Hitta själv vägen från start till mål med blicken och kom ihåg den.' },
      { when: 'play', text: 'Nu minns du vägen. Välj rätt väg i varje korsning. Lycka till!', hi: 'controls' },
    ],
    guides: [],
  },
  {
    id: 1006,
    title: 'Tiden',
    width: 6, height: 5,
    paths: [
      [[0, 4], [1, 4], [1, 3], [1, 2], [2, 2], [3, 2], [3, 3], [3, 4], [4, 4], [5, 4], [5, 3], [5, 2], [5, 1], [5, 0]],
      [[1, 2], [1, 1], [1, 0], [2, 0]],
      [[3, 2], [3, 1], [2, 1]],
      [[5, 2], [4, 2]],
    ],
    landmarks: [{ type: 'tree', x: 1, y: 3, dir: 'E' }, { type: 'sunflower', x: 5, y: 1, dir: 'W' }],
    spots: [],
    mode: 'navigator', kind: 'time', timeLimit: 60, studySeconds: 20,
    steps: [
      { when: 'study', text: 'Nu har banan en tidsgräns. Hitta vägen och kom ihåg den.' },
      { when: 'play', text: 'Den gröna stapeln är tiden som är kvar. Tar den slut förlorar du ett liv, men inte i övningen.', hi: 'bar' },
    ],
    guides: [],
  },
  {
    id: 1007,
    title: 'Monster',
    width: 6, height: 5,
    paths: [
      [[0, 4], [1, 4], [1, 3], [1, 2], [2, 2], [3, 2], [3, 3], [3, 4], [4, 4], [5, 4], [5, 3], [5, 2], [5, 1], [5, 0]],
      [[1, 2], [1, 1], [1, 0], [2, 0]],
      [[3, 2], [3, 1], [2, 1]],
      [[5, 2], [4, 2]],
    ],
    landmarks: [{ type: 'statue', x: 1, y: 3, dir: 'E' }, { type: 'flag', x: 5, y: 1, dir: 'W' }],
    spots: [],
    mode: 'memory', kind: 'monster', monsterSpeed: 0.8, delay: 3, studySeconds: 20,
    steps: [
      { when: 'study', text: 'Nu kommer ett monster! Det väcks efter en stund och jagar dig. Det är långsammare än du, men tappar du tid kommer det ikapp.' },
      { when: 'monsterWake', text: 'Monstret är vaket! Skärmkanten blir röd när det är nära. Titta i backspegeln, "Bakom dig", för att se var det är. Spring!', hi: 'rear' },
    ],
    guides: [],
  },
  {
    id: 1008,
    title: 'Gömställen',
    width: 7, height: 5,
    paths: [
      [[0, 4], [1, 4], [2, 4], [2, 3], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [5, 4], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0]],
      [[2, 2], [2, 1], [1, 1]],
      [[4, 2], [4, 1], [3, 1]],
    ],
    landmarks: [{ type: 'lantern', x: 3, y: 2, dir: 'S' }, { type: 'tree', x: 6, y: 2, dir: 'W' }],
    spots: [{ x: 1, y: 1, dir: 'E' }],
    mode: 'memory', kind: 'monster', monsterSpeed: 1.0, delay: 4, studySeconds: 20,
    steps: [
      { when: 'study', text: 'Ser du den orange ringen med en tunna? Det är ett gömställe. Där kan du gömma dig för monstret.' },
      { when: 'barrel', text: 'Tryck på "Göm dig i tunnan". Är monstret långt bort tappar det bort dig och går och letar.', hi: 'hide' },
      { when: 'hidden', text: 'Bra! Nu kan du titta på monstret. Du kan komma fram när du vill, men vänta tills det har gått bort.', hi: 'unhide' },
    ],
    guides: [
      { x: 0, y: 4, dirs: ['E'], text: 'Tryck på pilen för att springa.', only: true },
      { x: 2, y: 2, dirs: ['N', 'E'], text: 'Gå hit till gömstället!', only: true },
    ],
  },
];
