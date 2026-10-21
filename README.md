# Maze Memory

Ett gulligt labyrintspel där man först studerar kartan och sedan hittar ut ur labyrinten från minnet.
Specifikationen finns i [docs/Maze-Memory-spec.docx](docs/Maze-Memory-spec.docx).

## Köra prototypen

Webbprototypen ligger i `web/` och behöver ingen byggprocess.

```
cd web
python3 -m http.server 8000
```

Öppna sedan http://localhost:8000. På iPhone: öppna adressen på samma wifi, eller publicera `web/` via GitHub Pages.
Piltangenterna fungerar också på dator.

## Struktur

- `web/src/maze.js` – ren spellogik (generering, grafen, tidsgränser, stjärnor). Ingen grafik, så den kan flyttas till en app.
- `web/src/game.js` – three.js-grafik, figur, kamera och gränssnitt.
- `web/vendor/` – three.js (MIT).

## Banor som data och automatiska tester

Banorna är data: `web/levels/levels.json` innehåller varje banas labyrint, start och mål, tema,
väder, landmärken, gömställen, tidsgräns eller monsterfart och ett svårighetsbetyg. Spelet läser filen
och bygger banan. Saknas filen genereras banorna på plats på samma sätt.

Banorna byggs och testas med ett verktyg som körs på datorn:

```
node tools/build-levels.mjs
```

Det skapar `web/levels/levels.json` och `web/levels/report.txt` (en tabell över alla banor och
resultatet av testerna) och avslutar med felkod om någon bana inte klarar dem. Testerna kontrollerar bland
annat att banan går att lösa, att alla celler går att nå, att inga öppna 2x2-ytor finns, att
tidsgränsen och monstret går att klara för en spelare som kan vägen, att landmärken inte krockar och att
ingen bana är en kopia. En bana som inte klarar testerna byts ut mot en ny med ett annat frö.

Introduktionsbanorna är handbyggda i `tools/intro-levels.mjs`: varje bana är några stigar av celler, med
text som förklarar spelet och pilar som pekar ut rätt väg i korsningar.
