/**
 * Prueba de humo del camino de Google Fotos, con Google sustituido por dobles.
 *
 * Google no es accesible desde el entorno de desarrollo, así que aquí se
 * reemplazan Google Identity Services y la API del Selector por versiones de
 * mentira. Lo que se comprueba de verdad es lo que rompió en el móvil:
 *
 *  1. Pedir el permiso NO abre ninguna ventana por nuestra cuenta (la abre
 *     Google Identity). Dos emergentes a la vez dejan una pestaña en blanco.
 *  2. Elegir fotos abre UNA sola ventana, sin `noopener` (con esa opción
 *     `window.open` devuelve `null` y la pestaña se queda en blanco para
 *     siempre), y esa ventana acaba en la URL del selector.
 *  3. La app nunca se saca a sí misma de la pantalla: si navegase a la URL del
 *     selector, dejaría de escuchar la selección y no terminaría nunca.
 *
 *   npm run build && npm run smoke:google
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');

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

/** PNG con textura, para que el heurístico no lo tome por una captura. */
async function imagenDePrueba(navegador) {
  const pagina = await navegador.newPage({ viewport: { width: 320, height: 320 } });
  const datos = await pagina.evaluate(() => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 320;
    lienzo.height = 320;
    const ctx = lienzo.getContext('2d');
    const degradado = ctx.createLinearGradient(0, 0, 320, 320);
    degradado.addColorStop(0, '#c98b5e');
    degradado.addColorStop(0.5, '#e8d9c0');
    degradado.addColorStop(1, '#7a5a3a');
    ctx.fillStyle = degradado;
    ctx.fillRect(0, 0, 320, 320);
    const imagen = ctx.getImageData(0, 0, 320, 320);
    for (let i = 0; i < imagen.data.length; i += 4) {
      const ruido = (Math.random() - 0.5) * 60;
      imagen.data[i] = Math.max(0, Math.min(255, imagen.data[i] + ruido));
      imagen.data[i + 1] = Math.max(0, Math.min(255, imagen.data[i + 1] + ruido));
      imagen.data[i + 2] = Math.max(0, Math.min(255, imagen.data[i + 2] + ruido));
    }
    ctx.putImageData(imagen, 0, 0);
    return lienzo.toDataURL('image/png').split(',')[1];
  });
  await pagina.close();
  return Buffer.from(datos, 'base64');
}

const PICKER = 'https://picker.falso/elige';
const estado = { seleccionLista: false, consultas: 0, sesionBorrada: false };

await new Promise((r) => servidor.listen(0, r));
const base = `http://127.0.0.1:${servidor.address().port}/`;

const navegador = await chromium.launch({ executablePath: ejecutable, args: ['--no-sandbox'] });
const foto = await imagenDePrueba(navegador);
const contexto = await navegador.newContext({ viewport: { width: 1180, height: 900 } });

const erroresConsola = [];
contexto.on('console', (m) => m.type() === 'error' && erroresConsola.push(m.text()));
contexto.on('pageerror', (e) => erroresConsola.push(String(e)));

/*
 * Doble de Google Identity Services y contador de ventanas. Se instala antes de
 * que cargue la app, así `cargarGis()` ve que `window.google` ya existe y no
 * intenta bajar el script de accounts.google.com.
 */
await contexto.addInitScript(() => {
  window.__aperturas = [];
  const abrirDeVerdad = window.open.bind(window);
  window.open = (url, destino, caracteristicas) => {
    window.__aperturas.push({ url: String(url ?? ''), caracteristicas: String(caracteristicas ?? '') });
    return abrirDeVerdad(url, destino, caracteristicas);
  };

  window.__permisosPedidos = 0;
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient(config) {
          return {
            requestAccessToken() {
              window.__permisosPedidos += 1;
              setTimeout(() => config.callback({ access_token: 'token-falso', expires_in: 3600 }), 60);
            },
          };
        },
        revoke() {},
      },
    },
  };
});

// ------------------------------------------------- API del Selector de mentira
await contexto.route('https://photospicker.googleapis.com/v1/**', async (ruta) => {
  const peticion = ruta.request();
  const url = new URL(peticion.url());
  const json = (datos) =>
    ruta.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(datos) });

  if (!peticion.headers().authorization?.includes('token-falso')) {
    return ruta.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  }

  if (url.pathname === '/v1/sessions' && peticion.method() === 'POST') {
    return json({ id: 'ses-1', pickerUri: PICKER, pollingConfig: { pollInterval: '2s', timeoutIn: '600s' } });
  }
  if (url.pathname === '/v1/sessions/ses-1') {
    if (peticion.method() === 'DELETE') {
      estado.sesionBorrada = true;
      return ruta.fulfill({ status: 204, body: '' });
    }
    // La primera consulta dice que no; la segunda, que ya ha elegido. Así se
    // comprueba de verdad que la app sigue sondeando mientras espera.
    estado.consultas += 1;
    if (estado.consultas >= 2) estado.seleccionLista = true;
    return json({ mediaItemsSet: estado.seleccionLista });
  }
  if (url.pathname === '/v1/mediaItems') {
    return json({
      mediaItems: [
        {
          id: 'foto-1',
          createTime: '2026-09-18T10:00:00Z',
          type: 'PHOTO',
          mediaFile: {
            baseUrl: 'https://fotos.falso/foto-1',
            mimeType: 'image/png',
            filename: 'taller de macrame.png',
            mediaFileMetadata: { width: 320, height: 320 },
          },
        },
      ],
    });
  }
  return json({});
});

await contexto.route('https://fotos.falso/**', (ruta) =>
  ruta.fulfill({ status: 200, contentType: 'image/png', body: foto }),
);
await contexto.route(`${PICKER}*`, (ruta) =>
  ruta.fulfill({ status: 200, contentType: 'text/html', body: '<title>Selector</title>elige aquí' }),
);
// El catálogo compartido no se prueba aquí: basta con que no estorbe.
await contexto.route('**/functions/v1/catalogo*', (ruta) =>
  ruta.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ cambios: [], hasta: new Date().toISOString(), hayMas: false, enlaces: [] }),
  }),
);
await contexto.route('https://catalogo.falso/**', (ruta) =>
  ruta.fulfill({ status: 200, contentType: 'image/png', body: foto }),
);

const pagina = await contexto.newPage();

try {
  await pagina.goto(base, { waitUntil: 'networkidle' });

  // --------------------------------------------- pegar el ID de cliente
  await pagina.getByRole('button', { name: 'Ajustes', exact: true }).first().click();
  const campo = pagina.getByLabel('ID de cliente de OAuth');
  await campo.fill('123-falso.apps.googleusercontent.com');
  await campo.blur();
  await pagina.waitForTimeout(400);

  await pagina.getByRole('button', { name: 'Importar', exact: true }).click();
  await pagina.waitForTimeout(400);

  comprobar(
    'Con el ID puesto, el botón invita a conectar',
    await pagina.getByRole('button', { name: /Conectar con Google Fotos/ }).isVisible(),
  );

  // ------------------------------------------------- paso 1: el permiso
  await pagina.getByRole('button', { name: /Conectar con Google Fotos/ }).click();
  await pagina.waitForTimeout(800);

  comprobar('Se pide el permiso a Google', (await pagina.evaluate(() => window.__permisosPedidos)) === 1);
  comprobar(
    'Pedir el permiso no abre ninguna ventana nuestra',
    (await pagina.evaluate(() => window.__aperturas.length)) === 0,
    `aperturas: ${JSON.stringify(await pagina.evaluate(() => window.__aperturas))}`,
  );
  comprobar(
    'Al conectar, el botón pasa a ofrecer elegir fotos',
    await pagina.getByRole('button', { name: /Elegir fotos en Google Fotos/ }).isVisible(),
  );

  // -------------------------------------------- paso 2: elegir las fotos
  const esperaEmergente = contexto.waitForEvent('page', { timeout: 15000 });
  await pagina.getByRole('button', { name: /Elegir fotos en Google Fotos/ }).click();
  const emergente = await esperaEmergente;

  const aperturas = await pagina.evaluate(() => window.__aperturas);
  comprobar('Elegir fotos abre una sola ventana', aperturas.length === 1, JSON.stringify(aperturas));
  comprobar(
    'La ventana se abre sin «noopener» (con él quedaría en blanco para siempre)',
    aperturas.length === 1 && !aperturas[0].caracteristicas.includes('noopener'),
    aperturas[0]?.caracteristicas,
  );

  await emergente.waitForURL(`${PICKER}*`, { timeout: 15000 }).catch(() => {});
  comprobar('La ventana acaba en el selector de Google', emergente.url().startsWith(PICKER), emergente.url());
  comprobar('La app no se ha ido de su propia pantalla', pagina.url().startsWith(base), pagina.url());
  comprobar(
    'Mientras espera lo dice en pantalla',
    (await pagina.locator('.aviso-linea').allTextContents()).some((t) => /pulsa\s+Hecho/i.test(t)),
  );

  // ------------------------------------------------------ la selección
  await pagina.waitForSelector('.estadistica__valor', { timeout: 30000 });
  const nuevas = await pagina.locator('.estadistica__valor').first().textContent();
  comprobar('Importa la foto elegida en Google', nuevas?.trim() === '1', `valor leído: ${nuevas}`);
  comprobar('Ha sondeado la sesión más de una vez', estado.consultas >= 2, `consultas: ${estado.consultas}`);
  comprobar('Cierra la ventana del selector al terminar', emergente.isClosed());

  await pagina.waitForTimeout(600);
  comprobar('Libera la sesión del selector en Google', estado.sesionBorrada);

  // Con el motor heurístico la confianza es baja, así que la foto cae en la
  // cola de revisión. Lo que importa aquí es que ha entrado y se puede abrir.
  await pagina.waitForSelector('.nav__pastilla', { timeout: 20000 });
  comprobar('La foto de Google entra en la cola de revisión', await pagina.locator('.nav__pastilla').isVisible());

  await pagina.getByRole('button', { name: /^Revisar/ }).first().click();
  await pagina.waitForSelector('.revision__marco img', { timeout: 20000 });
  comprobar(
    'Solo ha entrado la foto elegida',
    /^1 foto esperando tipo/.test((await pagina.locator('.revision h1 + span').first().textContent()) ?? ''),
    (await pagina.locator('.revision h1 + span').first().textContent()) ?? '(sin texto)',
  );
  comprobar(
    'Se ven los píxeles descargados de Google',
    await pagina.locator('.revision__marco img').evaluate((n) => n.naturalWidth > 0),
  );

  // ------------------------------------------------------- desconectar
  await pagina.getByRole('button', { name: 'Importar', exact: true }).click();
  await pagina.waitForTimeout(300);
  await pagina.getByRole('button', { name: /Desconectar cuenta/ }).click();
  await pagina.waitForTimeout(300);
  comprobar(
    'Al desconectar vuelve a pedir conexión',
    await pagina.getByRole('button', { name: /Conectar con Google Fotos/ }).isVisible(),
  );

  comprobar('Sin errores de JavaScript', erroresConsola.length === 0, erroresConsola.join(' | '));
} finally {
  await navegador.close();
  servidor.close();
}

const fallos = comprobaciones.filter((c) => !c.ok);
console.log(`\n${comprobaciones.length - fallos.length}/${comprobaciones.length} comprobaciones correctas`);
process.exit(fallos.length ? 1 : 0);
