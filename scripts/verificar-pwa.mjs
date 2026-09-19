/**
 * Comprueba que la compilación publicada es instalable como PWA.
 *
 * Sirve `dist/` bajo el mismo subdirectorio que GitHub Pages y verifica lo que
 * exige un navegador para ofrecer «Instalar»: manifiesto válido, service worker
 * registrado con el ámbito correcto e iconos que cargan de verdad.
 *
 *   VITE_BASE=/Fotos-Arima/ npm run build && node scripts/verificar-pwa.mjs
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');
const BASE = process.env.BASE_PUBLICA ?? '/Fotos-Arima/';

const EJECUTABLES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  (() => { try { return chromium.executablePath(); } catch { return null; } })(),
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const servidor = createServer(async (peticion, respuesta) => {
  const ruta = new URL(peticion.url, 'http://localhost').pathname;
  if (!ruta.startsWith(BASE)) {
    respuesta.writeHead(404).end('fuera del subdirectorio publicado');
    return;
  }
  const relativa = ruta.slice(BASE.length) || 'index.html';
  const archivo = join(dist, relativa);
  try {
    const cuerpo = await readFile(existsSync(archivo) && extname(archivo) ? archivo : join(dist, 'index.html'));
    respuesta.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
    respuesta.end(cuerpo);
  } catch {
    respuesta.writeHead(404).end('no encontrado');
  }
});

const comprobaciones = [];
const comprobar = (texto, ok, detalle = '') => {
  comprobaciones.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${texto}${!ok && detalle ? ` — ${detalle}` : ''}`);
};

const ejecutable = EJECUTABLES.find((r) => existsSync(r));
if (!ejecutable) { console.error('No se ha encontrado Chromium.'); process.exit(1); }

await new Promise((r) => servidor.listen(0, r));
const url = `http://127.0.0.1:${servidor.address().port}${BASE}`;

const navegador = await chromium.launch({ executablePath: ejecutable, args: ['--no-sandbox'] });
const pagina = await navegador.newPage();
const fallos = [];
pagina.on('requestfailed', (p) => fallos.push(`${p.url()} (${p.failure()?.errorText})`));
pagina.on('response', (r) => r.status() >= 400 && fallos.push(`${r.url()} → ${r.status()}`));

try {
  await pagina.goto(url, { waitUntil: 'networkidle' });
  comprobar('La app carga desde el subdirectorio', await pagina.locator('.barra__titulo').isVisible());

  const manifiestoUrl = await pagina.getAttribute('link[rel=manifest]', 'href');
  comprobar('El HTML enlaza el manifiesto', Boolean(manifiestoUrl), 'falta <link rel=manifest>');

  const manifiesto = await (await pagina.request.get(new URL(manifiestoUrl, url).href)).json();
  comprobar('El manifiesto se sirve y es JSON válido', Boolean(manifiesto.name));
  comprobar(`start_url apunta a ${BASE}`, manifiesto.start_url === BASE, manifiesto.start_url);
  comprobar(`scope apunta a ${BASE}`, manifiesto.scope === BASE, manifiesto.scope);
  comprobar('display es standalone', manifiesto.display === 'standalone', manifiesto.display);

  // Chrome exige al menos un icono de 192 y otro de 512 para ofrecer instalar.
  const tamanos = (manifiesto.icons ?? []).map((i) => i.sizes);
  comprobar('Hay icono de 192×192', tamanos.includes('192x192'), tamanos.join(' '));
  comprobar('Hay icono de 512×512', tamanos.includes('512x512'), tamanos.join(' '));
  comprobar('Hay icono «maskable»', (manifiesto.icons ?? []).some((i) => i.purpose === 'maskable'));

  for (const icono of manifiesto.icons ?? []) {
    const destino = new URL(icono.src, new URL(manifiestoUrl, url)).href;
    const respuesta = await pagina.request.get(destino);
    comprobar(
      `El icono ${icono.src} carga (${icono.sizes})`,
      respuesta.ok() && (respuesta.headers()['content-type'] ?? '').includes('image/png'),
      `HTTP ${respuesta.status()}`,
    );
  }

  const sw = await pagina.evaluate(async () => {
    const registro = await navigator.serviceWorker.getRegistration();
    return registro ? { ambito: registro.scope, activo: Boolean(registro.active || registro.installing) } : null;
  });
  comprobar('El service worker queda registrado', Boolean(sw?.activo), JSON.stringify(sw));
  comprobar(`El ámbito del service worker es ${BASE}`, sw?.ambito?.endsWith(BASE) ?? false, sw?.ambito);

  const iosIcono = await pagina.getAttribute('link[rel=apple-touch-icon]', 'href');
  const respIos = await pagina.request.get(new URL(iosIcono ?? '', url).href);
  comprobar('El icono de iOS carga (Añadir a pantalla de inicio)', respIos.ok(), `HTTP ${respIos.status()}`);

  comprobar('Ningún recurso falla al cargarse', fallos.length === 0, fallos.slice(0, 4).join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

const malas = comprobaciones.filter((c) => !c).length;
console.log(`\n${comprobaciones.length - malas}/${comprobaciones.length} comprobaciones correctas`);
process.exit(malas ? 1 : 0);
