## Om projektet
- Maze Memory är ett webbspel (JavaScript + three.js) i web/. Det är den enda
  spelkoden. En iOS-app i ios/ kommer senare och ska bara vara ett tunt skal
  som visar web/.
- Spelets regler och innehåll: docs/Maze-Memory-spec.docx. Där den och koden
  säger olika: fråga Frida.
- Banor byggs och testas med: node tools/build-levels.mjs (måste gå utan fel).
- Testa webben med: cd web && python3 -m http.server 8000

## Bygge och signering
- Bygg och testa alltid lokalt på Fridas Mac.
- .github/workflows/pages.yml publicerar web/ till GitHub Pages och ska vara kvar
  tills vidare. Skapa inga andra workflows, och inga som kör på macOS.
- Utvecklarteam: Talero & Co AB, DEVELOPMENT_TEAM = S4739P85WT, för alla targets.
  Använd aldrig Personal Team.
- Bundle ID: se.talero.mazememory. Automatisk signering. Ändra inte team eller
  Bundle ID utan att fråga.
- Huvudgrenen heter main. Pusha inte till GitHub förrän Frida säger till.
- Frida är inte programmerare: förklara i enkla ord och säg exakt vad hon ska
  klicka på när något kräver henne.
