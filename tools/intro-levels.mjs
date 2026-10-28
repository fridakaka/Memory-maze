// Introduktionsbanor som lär ut spelet. De är handbyggda: varje bana är några stigar
// (listor av celler) och beskrivs med vad som ska förklaras och när.
//
// when: study = när kartan visas, play = när spelet börjar, compass = första gången kompassen
// visas, deadend = första återvändsgränden, monsterWake = när monstret vaknar,
// barrel = första gången "Göm dig" visas, hidden = när man har gömt sig, gaveUp = när
// monstret har gett upp och gått och lagt sig.
// hi: vilken del av skärmen som ska markeras.
// guides: vid en korsning (x, y) visas vilken pil man ska trycka på. dirs är riktningen
// (N, E, S, W) för första, andra... besöket. only = de andra pilarna är låsta.

export const INTRO_LEVELS = [
  {
    id: 1001,
    title: 'Så spelar du',
    width: 6, height: 5,
    paths: [
      [[0, 4], [1, 4], [1, 3], [1, 2], [2, 2], [3, 2], [3, 3], [3, 4], [4, 4], [5, 4], [5, 3], [5, 2], [5, 1], [5, 0]],
      [[1, 2], [1, 1], [1, 0], [2, 0]],
      [[3, 2], [3, 1], [2, 1]],
      [[5, 2], [4, 2]],
    ],
    landmarks: [{ type: 'tree', x: 1, y: 3, dir: 'E' }, { type: 'lantern', x: 3, y: 3, dir: 'W' }, { type: 'sunflower', x: 5, y: 1, dir: 'W' }],
    spots: [],
    mode: 'memory', kind: 'time', timeLimit: 90, studySeconds: 40,
    steps: [
      { when: 'study', text: 'Välkommen! Det här är en labyrint ovanifrån. Du är den blå cirkeln och målet är guldstjärnan. Den rosa linjen är rätt väg.' },
      { when: 'study', text: 'De små bilderna är landmärken, till exempel ett träd och en lykta. De hjälper dig att komma ihåg vägen. Du kan nypa för att zooma in på kartan. Tryck på "Jag är redo" när du kan vägen.', hi: 'ready' },
      { when: 'play', text: 'Figuren springer själv längs gångarna. När den stannar väljer du väg med pilarna: ← vänster, ↑ rakt fram och → höger, sett från figuren. I övningen blinkar rätt pil, så välj den. I vanliga banor blinkar ingen pil, då väljer du själv.', hi: 'controls' },
      { when: 'play', text: 'Den gröna stapeln är tiden som är kvar. Tar den slut förlorar du ett liv, men inte i övningen.', hi: 'bar' },
      { when: 'compass', text: 'Kompassen visar var norr är när du står still. Kartan har alltid norr uppåt, så kompassen hjälper dig att koppla ihop kartan med det du ser.', hi: 'compass' },
      { when: 'compass', text: 'Du kan också trycka på kompassen för att kika på kartan och se var du är. Du har tre kikar på varje bana. Tiden går medan du tittar, så kika bara när du är osäker.', hi: 'compass' },
      { when: 'deadend', text: 'Återvändsgränd! Ibland väljer man fel väg. Det är inte farligt, det kostar bara tid. Tryck på "Vänd" så springer figuren tillbaka till korsningen.', hi: 'back' },
    ],
    guides: [
      { x: 0, y: 4, dirs: ['E'], text: 'Tryck på pilen för att springa.', only: true },
      { x: 1, y: 2, dirs: ['N', 'E'], text: 'Prova den här vägen först!', only: true },
      { x: 2, y: 0, dirs: ['W'], text: 'Tryck på Vänd.', only: true },
      { x: 3, y: 2, dirs: ['S'], text: 'Välj den blinkande pilen.', only: true },
      { x: 5, y: 2, dirs: ['N'], text: 'Välj den blinkande pilen.', only: true },
    ],
  },
];
