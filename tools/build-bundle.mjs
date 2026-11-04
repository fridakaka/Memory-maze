// Bygger spelet som en enda HTML-fil (allt inbäddat) och den spelbara annonsen.
//   npm install esbuild   (en gång)
//   node tools/build-bundle.mjs
// Skriver dist/maze-memory.html och docs/Maze-Memory-spelbar-annons.html (demoläge, en bana
// och en "Ladda ner"-knapp). Annonsfilen är en enda fil utan externa anrop, vilket annonsnätverk
// brukar kräva. Sätt miljövariabeln ESBUILD till sökvägen till esbuild om det inte finns i projektet.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const { build } = await import(process.env.ESBUILD ?? 'esbuild');
const out = await build({ entryPoints: [path.join(web, 'src/game.js')], bundle: true, minify: true, format: 'iife', write: false });
const js = out.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(web, 'style.css'), 'utf8');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script type="module"[^>]*><\/script>/, '');
const levels = fs.readFileSync(path.join(web, 'levels/levels.json'), 'utf8');

const page = (extra) => `<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>Maze Memory</title>
<meta name="description" content="Se vägen, kom ihåg den, hitta ut.">
<style>${css}</style></head><body>
${body}
${extra}<script>window.__LEVELS__=${levels};</script>
<script>${js}</script>
</body></html>
`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/maze-memory.html'), page(''));
const ad = page('<script>window.__DEMO__=true;</script>\n');
fs.writeFileSync(path.join(root, 'docs/Maze-Memory-spelbar-annons.html'), ad);
console.log(`dist/maze-memory.html och docs/Maze-Memory-spelbar-annons.html (${Math.round(ad.length / 1024)} kB)`);
