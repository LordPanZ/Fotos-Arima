/**
 * Recorrido del formulario «Tailerren Argazkiak Arima».
 *
 * Comprueba los dos caminos de envío contra un servidor de mentira:
 *  1. Buzón: el formulario sube las fotos y la app las recibe en «Revisar».
 *  2. Archivo: el formulario genera un paquete y la app lo abre.
 *
 *   npm run build && npm run smoke:formulario
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');

const EJECUTABLES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  (() => { try { return chromium.executablePath(); } catch { return null; } })(),
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

const servidor = createServer(async (peticion, respuesta) => {
  const ruta = new URL(peticion.url, 'http://localhost').pathname;
  let archivo = join(dist, ruta === '/' ? 'index.html' : ruta.slice(1));
  if (!extname(archivo)) archivo = join(archivo, 'index.html');
  try {
    const cuerpo = await readFile(existsSync(archivo) ? archivo : join(dist, 'index.html'));
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
const base = `http://127.0.0.1:${servidor.address().port}/`;

const navegador = await chromium.launch({ executablePath: ejecutable, args: ['--no-sandbox'] });
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  acceptDownloads: true,
});

/** Estado compartido del catálogo de mentira. */
const catalogo = { fichas: [], porEntregar: [] };

async function montarServidorFalso(pagina) {
  await pagina.route('**/functions/v1/catalogo*', async (ruta) => {
    const peticion = ruta.request();
    const responder = (datos) =>
      ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) });

    if (peticion.method() === 'GET') {
      return responder({
        cambios: catalogo.porEntregar.splice(0),
        hasta: new Date().toISOString(),
        hayMas: false,
      });
    }

    const cuerpo = JSON.parse(peticion.postData() ?? '{}');
    if (cuerpo.accion === 'subir') {
      return responder({
        enlaces: cuerpo.ids.map((id) => ({
          id, completa: `https://falso/c/${id}`, miniatura: `https://falso/m/${id}`,
        })),
      });
    }
    if (cuerpo.accion === 'guardar') {
      for (const ficha of cuerpo.fichas) {
        catalogo.fichas.push(ficha);
        catalogo.porEntregar.push({
          id: ficha.id, ficha, borrada: false,
          actualizadoEn: new Date().toISOString(),
          miniatura: `https://falso/m/${ficha.id}`,
        });
      }
      return responder({ guardadas: cuerpo.fichas.length });
    }
    if (cuerpo.accion === 'borrar') return responder({ borradas: cuerpo.ids.length });
    return responder({});
  });

  await pagina.route('https://falso/**', (ruta) =>
    ruta.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }),
  );
}

/** Fotos con textura, para que no las descarte el filtro de capturas. */
async function fotosDePrueba(pagina, carpeta, cuantas) {
  const rutas = [];
  for (let i = 0; i < cuantas; i += 1) {
    const datos = await pagina.evaluate((semilla) => {
      const c = document.createElement('canvas');
      c.width = 400; c.height = 400;
      const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 400, 400);
      g.addColorStop(0, '#d8c3a5'); g.addColorStop(1, '#7f5539');
      x.fillStyle = g; x.fillRect(0, 0, 400, 400);
      for (let k = 0; k < 300; k += 1) {
        const px = Math.random() * 400, py = Math.random() * 400, r = 8 + Math.random() * 30;
        const rg = x.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, `hsla(${(semilla * 60 + Math.random() * 90) % 360},58%,${32 + Math.random() * 48}%,0.5)`);
        rg.addColorStop(1, 'transparent');
        x.fillStyle = rg; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
      }
      const im = x.getImageData(0, 0, 400, 400);
      for (let k = 0; k < im.data.length; k += 4) {
        const n = (Math.random() - 0.5) * 44;
        im.data[k] += n; im.data[k + 1] += n; im.data[k + 2] += n;
      }
      x.putImageData(im, 0, 0);
      return c.toDataURL('image/png').split(',')[1];
    }, i);
    const ruta = join(carpeta, `taller-${i + 1}.png`);
    await writeFile(ruta, Buffer.from(datos, 'base64'));
    rutas.push(ruta);
  }
  return rutas;
}

async function rellenar(pagina, rutas) {
  await pagina.getByLabel('Título del taller *').fill('Taller de macramé en Getxo');
  await pagina.getByLabel('Fecha *').fill('2026-09-15');
  await pagina.getByLabel('Lugar *').fill('Ludoteca de Algorta');
  await pagina.getByLabel('Tu nombre').fill('Aitziber');
  await pagina.locator('input[type=file]').setInputFiles(rutas);
  await pagina.waitForTimeout(500);
}

const errores = [];
try {
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
  pagina.on('requestfailed', (r) => errores.push(`FALLO ${r.url()}`));
  await montarServidorFalso(pagina);

  const carpeta = await mkdtemp(join(tmpdir(), 'form-'));
  await pagina.goto(base, { waitUntil: 'networkidle' });
  const rutas = await fotosDePrueba(pagina, carpeta, 3);

  /* ------------------------------------------------ camino 1: el buzón */
  await pagina.goto(`${base}formulario/`, { waitUntil: 'networkidle' });
  comprobar(
    'El formulario abre con su nombre',
    (await pagina.locator('h1').first().textContent())?.includes('Tailerren Argazkiak'),
  );
  comprobar(
    'No se puede enviar vacío',
    await pagina.getByRole('button', { name: /Enviar a Arima/ }).isDisabled(),
  );

  await rellenar(pagina, rutas);
  comprobar('Muestra las fotos elegidas', (await pagina.locator('.formulario__tira').count()) === 3);

  await pagina.locator('.formulario__quitar').first().click();
  comprobar('Se puede quitar una foto', (await pagina.locator('.formulario__tira').count()) === 2);

  await pagina.getByRole('button', { name: /Enviar a Arima/ }).click();
  await pagina.waitForSelector('.formulario__hecho', { timeout: 30000 });
  comprobar('Confirma el envío', (await pagina.locator('.formulario__hecho h1').textContent())?.includes('Eskerrik'));
  comprobar('Sube las dos fotos al catálogo', catalogo.fichas.length === 2, `subidas: ${catalogo.fichas.length}`);
  comprobar(
    'Las manda con los datos del taller',
    catalogo.fichas.every(
      (f) => f.evento?.titulo === 'Taller de macramé en Getxo'
        && f.evento?.lugar === 'Ludoteca de Algorta'
        && f.evento?.monitor === 'Aitziber'
        && f.origen === 'envio'
        && f.fecha.startsWith('2026-09-15'),
    ),
    JSON.stringify(catalogo.fichas[0]?.evento),
  );

  /* ------------------------------ la app las recibe y van a «Revisar» */
  const app = await contexto.newPage();
  app.on('pageerror', (e) => errores.push(String(e)));
  await montarServidorFalso(app);
  await app.goto(base, { waitUntil: 'networkidle' });
  await app.waitForTimeout(3500);

  const pastilla = await app.locator('.nav__pastilla').textContent().catch(() => null);
  comprobar('La app recibe el envío y lo pone a revisar', pastilla === '2', `pastilla: ${pastilla}`);

  await app.getByRole('button', { name: /^Revisar/ }).first().click();
  await app.waitForTimeout(900);
  const enRevisar = await app.locator('.vacio h3, .revision__marco').count();
  comprobar('La pantalla de revisión tiene trabajo', enRevisar > 0);

  /* --------------------------------------------- camino 2: el archivo */
  const form2 = await contexto.newPage();
  form2.on('pageerror', (e) => errores.push(String(e)));
  await montarServidorFalso(form2);
  await form2.goto(`${base}formulario/`, { waitUntil: 'networkidle' });
  await rellenar(form2, rutas);

  const esperaDescarga = form2.waitForEvent('download', { timeout: 30000 });
  await form2.getByRole('button', { name: /Mandar como archivo/ }).click();
  const descarga = await esperaDescarga;
  const paquete = join(carpeta, descarga.suggestedFilename());
  await descarga.saveAs(paquete);

  comprobar('Genera un paquete de envío', descarga.suggestedFilename().endsWith('.arima.zip'),
    descarga.suggestedFilename());

  /* ------------------------------------- y la app sabe abrir el paquete */
  const app2 = await contexto.newPage();
  app2.on('pageerror', (e) => errores.push(String(e)));
  await montarServidorFalso(app2);
  await app2.goto(`${base}#/importar`, { waitUntil: 'networkidle' });
  await app2.waitForTimeout(1200);
  await app2.locator('input[accept=".zip,application/zip"]').setInputFiles(paquete);
  await app2.waitForTimeout(6000);

  const avisos = await app2.locator('.aviso__texto').allTextContents();
  comprobar(
    'La app abre el paquete y lo manda a Revisar',
    avisos.some((t) => /Taller de macram/.test(t) && /Revisar/.test(t)),
    avisos.join(' | '),
  );

  comprobar('Sin errores de JavaScript', errores.length === 0, errores.slice(0, 3).join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

const malas = comprobaciones.filter((c) => !c).length;
console.log(`\n${comprobaciones.length - malas}/${comprobaciones.length} comprobaciones correctas`);
process.exit(malas ? 1 : 0);
