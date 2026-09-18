/**
 * Envoltorio de escritorio de Fotos Arima (Windows, macOS y Linux).
 *
 * La aplicación web se sirve desde un servidor local en un puerto fijo en vez
 * de cargarse con `file://`. Hay dos motivos:
 *
 *  1. Google Identity Services necesita un origen http(s) real; con `file://`
 *     no se puede iniciar sesión. Con `http://localhost:4173` vale el mismo ID
 *     de cliente que en el navegador.
 *  2. El proceso principal puede relajar CORS solo para los servidores de fotos
 *     de Google, así que aquí la descarga nunca se queda bloqueada.
 */
const { app, BrowserWindow, session, shell } = require('electron');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { join, extname, normalize } = require('node:path');

const RAIZ = join(__dirname, '..', 'dist');
const PUERTO_PREFERIDO = 4173;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Hosts a los que se les permite responder a la app sin cabeceras CORS. */
const HOSTS_GOOGLE = [
  'https://photospicker.googleapis.com/*',
  'https://*.googleusercontent.com/*',
];

function servidorEstatico() {
  return createServer(async (peticion, respuesta) => {
    const ruta = decodeURIComponent(new URL(peticion.url, 'http://localhost').pathname);
    // `normalize` + comprobación de prefijo evita salirse de `dist` con «..».
    const candidato = normalize(join(RAIZ, ruta === '/' ? 'index.html' : ruta));
    const archivo = candidato.startsWith(RAIZ) && existsSync(candidato) && extname(candidato)
      ? candidato
      : join(RAIZ, 'index.html');

    try {
      respuesta.writeHead(200, {
        'Content-Type': TIPOS[extname(archivo)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      respuesta.end(await readFile(archivo));
    } catch {
      respuesta.writeHead(404).end('No encontrado');
    }
  });
}

function escuchar(servidor, puerto) {
  return new Promise((resolve, reject) => {
    servidor.once('error', (error) => {
      // Si el puerto preferido está ocupado, el sistema nos da otro libre; en
      // ese caso habrá que añadir el nuevo origen en Google Cloud.
      if (error.code === 'EADDRINUSE' && puerto !== 0) escuchar(servidor, 0).then(resolve, reject);
      else reject(error);
    });
    servidor.listen(puerto, '127.0.0.1', () => resolve(servidor.address().port));
  });
}

async function crearVentana(base) {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: HOSTS_GOOGLE },
    (detalles, continuar) => {
      continuar({
        responseHeaders: {
          ...detalles.responseHeaders,
          'Access-Control-Allow-Origin': [base],
          'Access-Control-Allow-Headers': ['Authorization, Content-Type'],
        },
      });
    },
  );

  const ventana = new BrowserWindow({
    width: 1280,
    height: 880,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#faf7f2',
    title: 'Fotos Arima',
    icon: join(__dirname, '..', 'public', 'icons', 'icon-512.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  // El selector de Google se abre en el navegador del sistema, donde la
  // persona ya tiene la sesión iniciada.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(accounts|photos|photospicker)\.google\.com/.test(url)) {
      void shell.openExternal(url);
      return { action: 'deny' };
    }
    return url.startsWith(base) ? { action: 'allow' } : { action: 'deny' };
  });

  await ventana.loadURL(base);
  return ventana;
}

app.whenReady().then(async () => {
  if (!existsSync(join(RAIZ, 'index.html'))) {
    console.error('Falta la carpeta dist/. Ejecuta «npm run build» en la raíz del proyecto.');
    app.quit();
    return;
  }

  const puerto = await escuchar(servidorEstatico(), PUERTO_PREFERIDO);
  const base = `http://localhost:${puerto}`;
  if (puerto !== PUERTO_PREFERIDO) {
    console.warn(`El puerto ${PUERTO_PREFERIDO} estaba ocupado; usando ${base}.`);
  }

  await crearVentana(base);

  app.on('activate', async () => {
    if (!BrowserWindow.getAllWindows().length) await crearVentana(base);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
