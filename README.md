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
