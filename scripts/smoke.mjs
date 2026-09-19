/**
 * Prueba de humo end-to-end sobre la build de producción.
 *
 * Recorre el camino completo sin tocar Google ni la API de Claude: importar un
 * archivo local, clasificarlo con el motor heurístico, revisarlo, renombrarlo y
 * comprobar que el cambio sobrevive a una recarga.
 *
 *   npm run build && npm run smoke
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

/**
 * Dónde buscar el navegador, en orden:
 * CHROME_PATH, el Chromium preinstalado del entorno, la caché de
 * `playwright install` (lo que usa CI) y por último el del sistema.
 */
function rutaDePlaywright() {
  try {
    return chromium.executablePath();
  } catch {
    return null;
  }
}

const EJECUTABLES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  rutaDePlaywright(),
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter(Boolean);

const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml',
};

const servidor = createServer(async (peticion, respuesta) => {
  const ruta = new URL(peticion.url, 'http://localhost').pathname;
  const archivo = join(dist, ruta === '/' ? 'index.html' : ruta.slice(1));
  try {
    const cuerpo = await readFile(existsSync(archivo) ? archivo : join(dist, 'index.html'));
    respuesta.writeHead(200, { 'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
    respuesta.end(cuerpo);
  } catch {
    respuesta.writeHead(404).end('no encontrado');
  }
});

const comprobaciones = [];
function comprobar(descripcion, condicion, detalle = '') {
  comprobaciones.push({ descripcion, ok: Boolean(condicion), detalle });
  console.log(`${condicion ? '✓' : '✗'} ${descripcion}${detalle && !condicion ? ` — ${detalle}` : ''}`);
}

/**
 * Genera una imagen con textura fotográfica (degradados + ruido).
 * Un dibujo plano de colores sólidos lo descartaría el heurístico como captura
 * de pantalla, que es justo lo que debe hacer: para probar el camino normal
 * hace falta algo que se parezca a una foto.
 */
async function imagenDePrueba(destino) {
  const navegador = await chromium.launch({ executablePath: ejecutable, args: ['--no-sandbox'] });
  const pagina = await navegador.newPage({ viewport: { width: 320, height: 320 } });

  const datos = await pagina.evaluate(() => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 320;
    lienzo.height = 320;
    const ctx = lienzo.getContext('2d');

    const fondo = ctx.createLinearGradient(0, 0, 320, 320);
    fondo.addColorStop(0, '#d8c3a5');
    fondo.addColorStop(0.5, '#b08968');
    fondo.addColorStop(1, '#7f5539');
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, 320, 320);

    for (let i = 0; i < 260; i += 1) {
      const x = Math.random() * 320;
      const y = Math.random() * 320;
      const r = 6 + Math.random() * 26;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${Math.random() * 360}, 55%, ${35 + Math.random() * 45}%, 0.55)`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ruido por píxel: sube mucho el número de colores distintos.
    const imagen = ctx.getImageData(0, 0, 320, 320);
    for (let i = 0; i < imagen.data.length; i += 4) {
      const ruido = (Math.random() - 0.5) * 46;
      imagen.data[i] = Math.max(0, Math.min(255, imagen.data[i] + ruido));
      imagen.data[i + 1] = Math.max(0, Math.min(255, imagen.data[i + 1] + ruido));
      imagen.data[i + 2] = Math.max(0, Math.min(255, imagen.data[i + 2] + ruido));
    }
    ctx.putImageData(imagen, 0, 0);

    return lienzo.toDataURL('image/png').split(',')[1];
  });

  await writeFile(destino, Buffer.from(datos, 'base64'));
  await navegador.close();
}

const ejecutable = EJECUTABLES.find((r) => existsSync(r));
if (!ejecutable) {
  console.error('No se ha encontrado Chromium. Define CHROME_PATH.');
  process.exit(1);
}

await new Promise((r) => servidor.listen(0, r));
const puerto = servidor.address().port;
const base = `http://127.0.0.1:${puerto}/`;

const carpeta = await mkdtemp(join(tmpdir(), 'arima-smoke-'));
const rutaImagen = join(carpeta, 'macrame colgante beige.png');
await imagenDePrueba(rutaImagen);

const navegador = await chromium.launch({ executablePath: ejecutable, args: ['--no-sandbox'] });
const contexto = await navegador.newContext({ viewport: { width: 1180, height: 900 } });
const pagina = await contexto.newPage();

const erroresConsola = [];
pagina.on('pageerror', (e) => erroresConsola.push(String(e)));
pagina.on('console', (m) => m.type() === 'error' && erroresConsola.push(m.text()));

/*
 * Servidor de mentira del catálogo compartido. Sustituye a Supabase, que desde
 * este entorno no es accesible, y permite comprobar de verdad que la app sube
 * lo que crea y aplica lo que le llega de otro aparato.
 */
const servidorFalso = { subidas: [], borradas: [], pendientesDeEntregar: [] };

/** Ficha como la que subiría el otro aparato del equipo. */
function fotoDeAitzi(id) {
  const ahora = new Date().toISOString();
  return {
    id,
    ficha: {
      id,
      origen: 'local',
      archivoOriginal: 'taza.jpg',
      nombre: 'Cerámica y arcilla - taza azul de Aitzi - 2026-09-19',
      nombreEditado: false,
      tipoMime: 'image/jpeg',
      ancho: 300, alto: 300, bytes: 1234,
      fecha: ahora, importadaEl: ahora, actualizadaEn: ahora,
      estado: 'listo', entraEnCatalogo: true, confianza: 0.95,
      categoria: 'ceramica-arcilla',
      materiales: ['barro'], colores: ['azul'], etiquetas: ['taza'],
      descripcion: 'taza azul de Aitzi',
      motor: 'ia', revision: 'auto', favorita: false,
    },
    borrada: false,
    actualizadoEn: ahora,
    miniatura: `https://catalogo.falso/m/${id}`,
  };
}

await pagina.route('**/functions/v1/catalogo*', async (ruta) => {
  const peticion = ruta.request();

  if (peticion.method() === 'GET') {
    // Se entrega la cola y se vacía, como haría el servidor real avanzando la marca.
    const cambios = servidorFalso.pendientesDeEntregar.splice(0);
    return ruta.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cambios, hasta: new Date().toISOString(), hayMas: false }),
    });
  }

  const cuerpo = JSON.parse(peticion.postData() ?? '{}');
  const responder = (datos) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) });

  if (cuerpo.accion === 'subir') {
    return responder({
      enlaces: cuerpo.ids.map((id) => ({
        id,
        completa: `https://catalogo.falso/c/${id}`,
        miniatura: `https://catalogo.falso/m/${id}`,
      })),
    });
  }
  if (cuerpo.accion === 'guardar') {
    servidorFalso.subidas.push(...cuerpo.fichas.map((f) => f.id));
    return responder({ guardadas: cuerpo.fichas.length });
  }
  if (cuerpo.accion === 'borrar') {
    servidorFalso.borradas.push(...cuerpo.ids);
    return responder({ borradas: cuerpo.ids.length });
  }
  return responder({});
});

// Subidas y bajadas de imágenes contra el almacén de mentira.
await pagina.route('https://catalogo.falso/**', (ruta) =>
  ruta.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }),
);

try {
  await pagina.goto(base, { waitUntil: 'networkidle' });

  comprobar('La aplicación arranca', await pagina.locator('.barra__titulo').isVisible());
  comprobar(
    'Muestra el estado vacío inicial',
    (await pagina.locator('.vacio h3').first().textContent())?.includes('Todavía no hay fotos'),
  );

  // ---------------------------------------------------------- importar
  await pagina.getByRole('button', { name: 'Importar', exact: true }).click();
  await pagina.locator('input[type=file]').setInputFiles(rutaImagen);

  await pagina.waitForSelector('.estadistica__valor', { timeout: 20000 });
  const nuevas = await pagina.locator('.estadistica__valor').first().textContent();
  comprobar('Importa el archivo local', nuevas?.trim() === '1', `valor leído: ${nuevas}`);

  // El análisis heurístico deja la foto en «Por revisar» (confianza baja).
  await pagina.waitForSelector('.nav__pastilla', { timeout: 20000 });
  comprobar('La manda a la cola de revisión', await pagina.locator('.nav__pastilla').isVisible());

  // ----------------------------------------------------------- revisar
  await pagina.getByRole('button', { name: /^Revisar/ }).first().click();
  await pagina.waitForSelector('.revision__marco img', { timeout: 15000 });
  comprobar('La vista de revisión muestra la foto', await pagina.locator('.revision__marco img').isVisible());

  for (const nueva of ['Diskofesta', 'Ihes Gela']) {
    comprobar(
      `«${nueva}» aparece como categoría`,
      await pagina.getByRole('button', { name: nueva, exact: true }).isVisible(),
    );
  }

  await pagina.getByRole('button', { name: 'Macramé y fibras', exact: true }).click();
  await pagina.getByRole('button', { name: /^Sí: Macramé y fibras$/ }).click();
  await pagina.waitForSelector('.vacio', { timeout: 10000 });
  comprobar('Al confirmar se vacía la cola', await pagina.locator('.vacio').isVisible());

  // --------------------------------------------------------- catálogo
  await pagina.getByRole('button', { name: 'Catálogo', exact: true }).first().click();
  await pagina.waitForSelector('.ficha', { timeout: 10000 });
  comprobar(
    'La foto aparece agrupada bajo su tipo',
    (await pagina.locator('.grupo__nombre').first().textContent())?.includes('Macramé'),
  );

  const nombreAutomatico = await pagina.locator('.ficha__nombre').first().textContent();
  comprobar(
    'Se le ha aplicado la plantilla de nombre',
    nombreAutomatico?.startsWith('Macramé y fibras'),
    `nombre: ${nombreAutomatico}`,
  );

  // --------------------------------------------------- detalle y nombre
  await pagina.locator('.ficha__marco').first().click();
  await pagina.waitForSelector('.visor img', { timeout: 10000 });
  comprobar('Se abre el detalle', await pagina.locator('.visor img').isVisible());

  const campoNombre = pagina.locator('.hoja input.entrada').first();
  await campoNombre.fill('Colgante de macramé del salón');
  await campoNombre.blur();
  await pagina.waitForTimeout(400);

  comprobar(
    'Hay botón de compartir en el detalle',
    await pagina.getByRole('button', { name: 'Compartir' }).isVisible(),
  );

  await pagina.getByRole('button', { name: 'Compartir' }).click();
  await pagina.waitForSelector('.hoja--estrecha', { timeout: 10000 });
  comprobar(
    'Compartir pregunta cómo enviar',
    await pagina.locator('.hoja--estrecha .hoja__titulo').textContent().then((t) => /1 foto/.test(t ?? '')),
  );
  comprobar(
    'Ofrece enviar con ficha',
    await pagina.getByRole('button', { name: /Foto y ficha/ }).isVisible(),
  );
  comprobar(
    'Ofrece enviar solo la foto',
    await pagina.getByRole('button', { name: /Solo la foto/ }).isVisible(),
  );

  await pagina.locator('.hoja--estrecha').getByRole('button', { name: 'Cerrar', exact: true }).click();
  await pagina.waitForSelector('.hoja--estrecha', { state: 'detached', timeout: 5000 });

  await pagina.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await pagina.waitForSelector('.hoja', { state: 'detached', timeout: 5000 });

  // ------------------------------------------------ persistencia real
  await pagina.reload({ waitUntil: 'networkidle' });
  await pagina.waitForSelector('.ficha__nombre', { timeout: 15000 });
  const trasRecargar = await pagina.locator('.ficha__nombre').first().textContent();
  comprobar(
    'El nombre editado sobrevive a la recarga',
    trasRecargar?.trim() === 'Colgante de macramé del salón',
    `nombre: ${trasRecargar}`,
  );

  // ------------------------------------------------------- selección
  await pagina.locator('.ficha__casilla').first().click();
  await pagina.waitForSelector('.seleccion-barra', { timeout: 5000 });
  comprobar(
    'La barra de acciones en lote aparece al seleccionar',
    (await pagina.locator('.seleccion-barra__cuenta').textContent())?.includes('1'),
  );

  // -------------------------------------------------------- búsqueda
  await pagina.getByRole('button', { name: 'Quitar selección' }).click();
  await pagina.getByLabel('Buscar en el catálogo').fill('macramé');
  await pagina.waitForTimeout(300);
  comprobar('La búsqueda encuentra la foto', (await pagina.locator('.ficha').count()) === 1);

  await pagina.getByLabel('Buscar en el catálogo').fill('cerámica');
  await pagina.waitForTimeout(300);
  comprobar('La búsqueda filtra lo que no coincide', (await pagina.locator('.ficha').count()) === 0);

  // --------------------------------------------------------- ajustes
  await pagina.getByLabel('Buscar en el catálogo').fill('');
  await pagina.getByRole('button', { name: 'Ajustes', exact: true }).first().click();
  await pagina.waitForSelector('.tabla-tokens', { timeout: 10000 });
  comprobar('Los ajustes muestran la plantilla de nombres', await pagina.locator('.tabla-tokens').isVisible());

  // ------------------------------------------- catálogo compartido
  comprobar(
    'La foto importada se envía al catálogo compartido',
    servidorFalso.subidas.length > 0,
    `subidas: ${servidorFalso.subidas.length}`,
  );

  // Lo que sube la otra persona del equipo tiene que aparecer aquí.
  servidorFalso.pendientesDeEntregar.push(fotoDeAitzi('foto-de-aitzi-1'));
  await pagina.getByRole('button', { name: /^Sincronizar/ }).click();
  await pagina.waitForTimeout(2000);

  // La comprobación es sobre la galería, así que hay que volver a ella.
  await pagina.getByRole('button', { name: 'Catálogo', exact: true }).first().click();
  await pagina.getByLabel('Buscar en el catálogo').fill('');
  await pagina.waitForTimeout(600);

  comprobar(
    'Llega la foto que subió la otra persona',
    (await pagina.locator('.ficha__nombre').allTextContents()).some((t) => /Aitzi/.test(t)),
    `en pantalla: ${(await pagina.locator('.ficha__nombre').allTextContents()).join(' | ')}`,
  );
  comprobar(
    'Se agrupa en su categoría',
    (await pagina.locator('.grupo__nombre').allTextContents()).some((t) => /Cerámica/.test(t)),
  );

  // El menú debe caber entero también en las pantallas más estrechas.
  for (const ancho of [320, 390]) {
    await pagina.setViewportSize({ width: ancho, height: 780 });
    await pagina.waitForTimeout(250);
    const corte = await pagina.evaluate(() => {
      const limite = document.documentElement.clientWidth + 0.5;
      return [...document.querySelectorAll('.nav__boton')]
        .filter((b) => b.getBoundingClientRect().right > limite)
        .map((b) => b.textContent.trim());
    });
    comprobar(`El menú entero cabe a ${ancho} px`, corte.length === 0, `cortados: ${corte.join(', ')}`);
  }
  await pagina.setViewportSize({ width: 1180, height: 900 });

  comprobar('Sin errores de JavaScript', erroresConsola.length === 0, erroresConsola.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

const fallos = comprobaciones.filter((c) => !c.ok);
console.log(`\n${comprobaciones.length - fallos.length}/${comprobaciones.length} comprobaciones correctas`);
process.exit(fallos.length ? 1 : 0);
