/**
 * Genera los PNG del manifiesto a partir del icono vectorial.
 *
 * Usa el Chromium que ya trae el entorno (o el del sistema) para rasterizar.
 * Solo hace falta ejecutarlo si se cambia el diseño del icono:
 *   npm run icons
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..');
const destino = join(raiz, 'public', 'icons');

const CANDIDATOS = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const navegador = CANDIDATOS.find((ruta) => existsSync(ruta));
if (!navegador) {
  console.error(
    'No se ha encontrado Chrome ni Chromium. Indica la ruta con la variable CHROME_PATH.',
  );
  process.exit(1);
}

/** `margen` deja el área segura que exige un icono «maskable». */
function pagina(lado, margen, radio) {
  const dibujo = lado - margen * 2;
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:${lado}px;height:${lado}px;background:#b4553a}
  svg{display:block;position:absolute;left:${margen}px;top:${margen}px}
</style>
<svg xmlns="http://www.w3.org/2000/svg" width="${dibujo}" height="${dibujo}" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="${radio}" fill="#b4553a"/>
  <circle cx="24" cy="24" r="8.5" fill="none" stroke="#faf0e6" stroke-width="2.6"/>
  <path d="M24 15.5c4 3 4 6 0 8.5s-4 5.5 0 8.5" fill="none" stroke="#faf0e6" stroke-width="2.6" stroke-linecap="round"/>
  <circle cx="33.5" cy="15" r="3" fill="#f0c88a"/>
</svg>`;
}

const TAREAS = [
  { archivo: 'icon-192.png', lado: 192, margen: 0, radio: 11 },
  { archivo: 'icon-512.png', lado: 512, margen: 0, radio: 11 },
  // Un icono «maskable» puede recortarse: el dibujo se encoge al 62 % central.
  { archivo: 'maskable-512.png', lado: 512, margen: 97, radio: 48 },
  { archivo: 'apple-touch-icon.png', lado: 180, margen: 0, radio: 0 },
];

mkdirSync(destino, { recursive: true });
const trabajo = mkdtempSync(join(tmpdir(), 'iconos-arima-'));

for (const { archivo, lado, margen, radio } of TAREAS) {
  const html = join(trabajo, `${archivo}.html`);
  writeFileSync(html, pagina(lado, margen, radio));

  execFileSync(
    navegador,
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--screenshot=${join(trabajo, archivo)}`,
      `--window-size=${lado},${lado}`,
      `file://${html}`,
    ],
    { stdio: 'ignore' },
  );

  renameSync(join(trabajo, archivo), join(destino, archivo));
  console.log(`✓ icons/${archivo} (${lado}×${lado})`);
}
