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
import { imagenDePrueba, videoDePrueba } from './medios.mjs';

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

const ejecutable = EJECUTABLES.find((r) => existsSync(r));
if (!ejecutable) {
  console.error('No se ha encontrado Chromium. Define CHROME_PATH.');
  process.exit(1);
}

await new Promise((r) => servidor.listen(0, r));
const puerto = servidor.address().port;
const base = `http://127.0.0.1:${puerto}/`;

const carpeta = await mkdtemp(join(tmpdir(), 'arima-smoke-'));
const navegador = await chromium.launch({ executablePath: ejecutable, args: ['--no-sandbox'] });

const rutaImagen = join(carpeta, 'macrame colgante beige.png');
await writeFile(rutaImagen, await imagenDePrueba(navegador));

const rutaVideo = join(carpeta, 'taller en marcha.webm');
await writeFile(rutaVideo, await videoDePrueba(navegador));

// Un taller entero: sirve para la ficha común, que es lo que se usa cuando
// llegan varias fotos del mismo sitio.
const rutasTaller = [];
for (const n of [1, 2, 3]) {
  const ruta = join(carpeta, `taller robots ${n}.png`);
  await writeFile(ruta, await imagenDePrueba(navegador));
  rutasTaller.push(ruta);
}
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
const servidorFalso = { subidas: [], fichas: [], borradas: [], pendientesDeEntregar: [] };

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
    servidorFalso.fichas.push(...cuerpo.fichas);
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
  await pagina.locator('input[accept*="image/*"]').setInputFiles(rutaImagen);

  await pagina.waitForSelector('.estadistica__valor', { timeout: 20000 });
  const nuevas = await pagina.locator('.estadistica__valor').first().textContent();
  comprobar('Importa el archivo local', nuevas?.trim() === '1', `valor leído: ${nuevas}`);

  // La app ya no clasifica sola: la foto entra sin tipo y espera en Revisar.
  await pagina.waitForSelector('.nav__pastilla', { timeout: 20000 });
  comprobar('La manda a la cola de revisión', await pagina.locator('.nav__pastilla').isVisible());

  // ----------------------------------------------------------- revisar
  await pagina.getByRole('button', { name: /^Revisar/ }).first().click();
  await pagina.waitForSelector('.revision__marco img', { timeout: 15000 });

  comprobar(
    'No se inventa una clasificación: pide el tipo sin proponer nada',
    /elige su tipo abajo/i.test((await pagina.locator('.revision__sugerencia').textContent()) ?? ''),
    (await pagina.locator('.revision__sugerencia').textContent()) ?? '',
  );
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

  // Sin configurar Google, el botón no debe quedarse gris y mudo.
  await pagina.getByRole('button', { name: 'Importar', exact: true }).click();
  await pagina.waitForTimeout(500);
  comprobar(
    'Explica por qué no se puede usar Google Fotos todavía',
    (await pagina.locator('.aviso-linea').allTextContents()).some((t) =>
      /Falta configurar el acceso a Google Fotos/.test(t),
    ),
  );
  comprobar(
    'Y ofrece ir a configurarlo',
    await pagina.getByRole('button', { name: /Ir a Ajustes y configurarlo/ }).isVisible(),
  );
  await pagina.getByRole('button', { name: /Ir a Ajustes y configurarlo/ }).click();
  await pagina.waitForTimeout(500);
  comprobar(
    'El botón lleva a los ajustes de Google',
    await pagina.getByLabel('ID de cliente de OAuth').isVisible(),
  );
  await pagina.getByRole('button', { name: 'Catálogo', exact: true }).first().click();
  await pagina.waitForTimeout(400);

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

  // ------------------------------------------------------- vídeos
  await pagina.getByRole('button', { name: 'Importar', exact: true }).click();
  await pagina.locator('input[accept*="image/*"]').setInputFiles(rutaVideo);
  await pagina.waitForSelector('.estadistica__valor', { timeout: 40000 });
  comprobar(
    'Importa un vídeo como una foto más',
    (await pagina.locator('.estadistica__valor').first().textContent())?.trim() === '1',
    `nuevas: ${await pagina.locator('.estadistica__valor').first().textContent()}`,
  );

  await pagina.getByRole('button', { name: 'Catálogo', exact: true }).first().click();
  await pagina.getByRole('button', { name: 'Todas', exact: true }).click();
  await pagina.getByLabel('Buscar en el catálogo').fill('taller en marcha');
  await pagina.waitForTimeout(700);

  comprobar('El vídeo se distingue en la galería', await pagina.locator('.ficha__video').isVisible());
  comprobar(
    'Y tiene portada, no un hueco vacío',
    await pagina.locator('.ficha__imagen').first().evaluate((n) => n.naturalWidth > 0),
  );

  await pagina.locator('.ficha__marco').first().click();
  await pagina.waitForSelector('.visor', { timeout: 10000 });
  comprobar(
    'Al abrirlo sale el reproductor, no una imagen rota',
    (await pagina.locator('.visor video').count()) === 1,
  );
  comprobar(
    'El reproductor tiene los controles puestos',
    await pagina.locator('.visor video').evaluate((v) => v.controls === true),
  );
  await pagina.locator('.hoja__barra button').last().click();
  await pagina.getByLabel('Buscar en el catálogo').fill('');
  await pagina.getByRole('button', { name: 'Catálogo', exact: true }).first().click();
  await pagina.waitForTimeout(400);

  // El botón de la ficha tiene que verse sin descubrir el modo selección.
  await pagina.getByRole('button', { name: 'Catálogo', exact: true }).first().click();
  await pagina.waitForTimeout(400);
  comprobar(
    'El botón de rellenar ficha se ve sin seleccionar nada',
    await pagina.getByRole('button', { name: /Rellenar ficha de \d+/ }).isVisible(),
  );

  // ------------------------------------------------ tipos propios
  await pagina.getByRole('button', { name: 'Ajustes', exact: true }).first().click();
  await pagina.waitForTimeout(400);
  await pagina.getByRole('button', { name: /Crear un tipo nuevo/ }).click();
  await pagina.getByLabel('Nombre del tipo').fill('Tecnología');
  await pagina.getByLabel('Cuándo usarlo').fill('Robots, circuitos, impresión 3D y programación.');
  await pagina.getByRole('button', { name: 'Crear el tipo' }).click();
  await pagina.waitForTimeout(500);

  comprobar(
    'El tipo propio queda creado',
    (await pagina.locator('.tipo__cuerpo strong').allTextContents()).includes('Tecnología'),
    (await pagina.locator('.tipo__cuerpo strong').allTextContents()).join(' | '),
  );

  // --------------------------------------------------- ficha común
  await pagina.getByRole('button', { name: 'Importar', exact: true }).click();
  await pagina.locator('input[accept*="image/*"]').setInputFiles(rutasTaller);
  await pagina.waitForSelector('.estadistica__valor', { timeout: 30000 });
  comprobar(
    'Importa las tres fotos del taller',
    (await pagina.locator('.estadistica__valor').first().textContent())?.trim() === '3',
  );

  // El aviso y los botones salen cuando termina el análisis en segundo plano.
  const botonFicha = pagina.getByRole('button', { name: /Rellenar la ficha de las 3 de una vez/ });
  await botonFicha.waitFor({ state: 'visible', timeout: 30000 });
  comprobar(
    'Dice que han entrado sin tipo y qué hacer',
    (await pagina.locator('.aviso-linea').allTextContents()).some((t) =>
      /Han entrado .*sin tipo/.test(t),
    ),
    (await pagina.locator('.aviso-linea').allTextContents()).join(' | '),
  );

  await botonFicha.click();
  await pagina.waitForSelector('.hoja__titulo', { timeout: 10000 });
  await pagina.getByLabel('Título').fill('Taller de robots');

  // Crear un tipo sin salir de aquí: es donde te das cuenta de que te falta.
  await pagina.getByRole('button', { name: /Crear un tipo/ }).click();
  await pagina.getByLabel('Nombre del tipo nuevo').fill('Cocina');
  await pagina.getByRole('button', { name: 'Crear y usarlo' }).click();
  await pagina.waitForTimeout(600);
  comprobar(
    'El tipo creado al vuelo queda elegido',
    (await pagina.getByRole('button', { name: /Cocina/ }).first().getAttribute('aria-pressed')) === 'true',
  );

  // El tipo recién creado tiene que estar en la lista del diálogo.
  comprobar(
    'El tipo propio se puede elegir al rellenar',
    await pagina.getByRole('button', { name: /Tecnología/ }).first().isVisible(),
  );
  await pagina.getByRole('button', { name: /Tecnología/ }).first().click();
  await pagina.getByLabel('Etiquetas que añadir').fill('robots, verano');
  await pagina.getByRole('button', { name: /Aplicar a las 3 fotos/ }).click();
  await pagina.waitForTimeout(1200);

  await pagina.getByRole('button', { name: 'Catálogo', exact: true }).first().click();
  await pagina.getByLabel('Buscar en el catálogo').fill('Taller de robots');
  await pagina.waitForTimeout(600);

  const nombresTaller = (await pagina.locator('.ficha__nombre').allTextContents()).sort();
  comprobar(
    'Las tres quedan numeradas con el mismo título',
    nombresTaller.join(' | ') === 'Taller de robots 01 | Taller de robots 02 | Taller de robots 03',
    nombresTaller.join(' | '),
  );
  comprobar(
    'Y agrupadas bajo el tipo propio',
    (await pagina.locator('.grupo__nombre').allTextContents()).some((t) => /Tecnología/.test(t)),
    (await pagina.locator('.grupo__nombre').allTextContents()).join(' | '),
  );

  // Elegir el tipo a mano las saca de la cola de revisión.
  await pagina.getByLabel('Buscar en el catálogo').fill('');
  await pagina.waitForTimeout(400);
  comprobar(
    'La etiqueta escrita se encuentra buscando',
    await (async () => {
      await pagina.getByLabel('Buscar en el catálogo').fill('robots');
      await pagina.waitForTimeout(500);
      return (await pagina.locator('.ficha').count()) === 3;
    })(),
  );
  await pagina.getByLabel('Buscar en el catálogo').fill('');
  await pagina.waitForTimeout(300);

  // El tipo propio viaja pegado a la ficha que se sube al catálogo compartido.
  await pagina.getByRole('button', { name: /^Sincronizar/ }).click();
  await pagina.waitForTimeout(2000);
  comprobar(
    'El tipo propio viaja con la foto al catálogo compartido',
    servidorFalso.fichas.some((f) => f.categoriaPropia?.nombre === 'Tecnología'),
    `categorías subidas: ${[...new Set(servidorFalso.fichas.map((f) => f.categoria))].join(', ')}`,
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
