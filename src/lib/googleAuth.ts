/**
 * Autenticación con Google usando Google Identity Services (modelo de token).
 *
 * Es el flujo recomendado para aplicaciones que se ejecutan en el navegador:
 * no hay secreto de cliente y el token vive solo en esta pestaña.
 *
 * El único permiso que se pide es el del Selector de Google Fotos
 * (`photospicker.mediaitems.readonly`): la app solo ve las fotos que la
 * persona elige explícitamente en el selector de Google, nunca la biblioteca
 * entera. Desde marzo de 2025 es además la única vía disponible para que una
 * aplicación de terceros acceda a fotos ya existentes en Google Fotos.
 */

export const AMBITO_SELECTOR = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';

const URL_GIS = 'https://accounts.google.com/gsi/client';
const CLAVE_SESION = 'arima.token.google';

interface RespuestaToken {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface ClienteToken {
  requestAccessToken(opciones?: { prompt?: string; hint?: string }): void;
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        prompt?: string;
        hint?: string;
        callback: (respuesta: RespuestaToken) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }): ClienteToken;
      revoke(token: string, hecho?: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleGlobal;
  }
}

interface TokenGuardado {
  token: string;
  expiraEn: number;
}

let enMemoria: TokenGuardado | null = null;

function leerGuardado(): TokenGuardado | null {
  if (enMemoria && enMemoria.expiraEn > Date.now()) return enMemoria;
  try {
    const bruto = sessionStorage.getItem(CLAVE_SESION);
    if (!bruto) return null;
    const dato = JSON.parse(bruto) as TokenGuardado;
    if (dato.expiraEn > Date.now()) {
      enMemoria = dato;
      return dato;
    }
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* sessionStorage puede estar bloqueado en modo privado */
  }
  return null;
}

function guardar(token: string, segundos: number): void {
  // Margen de 60 s para no usar un token que caduca a mitad de una descarga.
  const dato: TokenGuardado = { token, expiraEn: Date.now() + Math.max(0, segundos - 60) * 1000 };
  enMemoria = dato;
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(dato));
  } catch {
    /* sin persistencia: el token seguirá en memoria */
  }
}

export function hayTokenValido(): boolean {
  return leerGuardado() !== null;
}

/** Tiempo máximo esperando a que la ventana de Google responda. */
const ESPERA_MAXIMA = 3 * 60 * 1000;

let cargaGis: Promise<void> | null = null;

function cargarGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (cargaGis) return cargaGis;

  cargaGis = new Promise<void>((resolve, reject) => {
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${URL_GIS}"]`);
    const script = existente ?? document.createElement('script');
    script.src = URL_GIS;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () =>
      reject(
        new Error(
          'No se ha podido cargar el script de Google. Comprueba tu conexión: ' +
            'la primera vez que conectas hace falta estar en línea.',
        ),
      ),
    );
    if (!existente) document.head.appendChild(script);
  }).catch((e) => {
    cargaGis = null;
    throw e;
  });

  return cargaGis;
}

export interface OpcionesToken {
  clientId: string;
  /** Correo con el que preseleccionar la cuenta en la pantalla de Google. */
  cuenta?: string;
  /** `true` para no mostrar el diálogo si ya hay consentimiento. */
  silencioso?: boolean;
}

/** Devuelve un token de acceso válido, pidiéndolo a Google si hace falta. */
export async function obtenerToken(opciones: OpcionesToken): Promise<string> {
  const guardado = leerGuardado();
  if (guardado) return guardado.token;

  if (!opciones.clientId) {
    throw new Error(
      'Falta el ID de cliente de Google. Añádelo en Ajustes › Google Fotos ' +
        '(consulta docs/CONFIGURACION-GOOGLE.md).',
    );
  }

  await cargarGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity Services no está disponible en este navegador.');

  return new Promise<string>((resolve, reject) => {
    // Si la ventana de Google se abre pero nunca responde (pasa cuando el ID de
    // cliente aún no se ha propagado, o cuando el navegador bloquea las cookies
    // de accounts.google.com), sin esto la promesa se queda pendiente para
    // siempre y la pantalla se queda en «Conectando…» sin explicar nada.
    const reloj = window.setTimeout(() => {
      terminar(() =>
        reject(
          new Error(
            'Google no ha respondido. Si la ventana se quedó en blanco: el ID de cliente ' +
              'puede tardar unos minutos en activarse tras crearlo, y el permiso solo ' +
              'funciona con las cuentas añadidas como usuarios de prueba. Prueba otra vez ' +
              'en unos minutos y, si sigue igual, abre la app en el navegador (no como app ' +
              'instalada) y permite las cookies de accounts.google.com.',
          ),
        ),
      );
    }, ESPERA_MAXIMA);

    let cerrado = false;
    function terminar(accion: () => void): void {
      if (cerrado) return;
      cerrado = true;
      window.clearTimeout(reloj);
      accion();
    }

    const cliente = oauth2.initTokenClient({
      client_id: opciones.clientId,
      scope: AMBITO_SELECTOR,
      hint: opciones.cuenta,
      callback: (respuesta) => {
        if (respuesta.error || !respuesta.access_token) {
          terminar(() => reject(new Error(descifrarError(respuesta))));
          return;
        }
        const token = respuesta.access_token;
        guardar(token, respuesta.expires_in ?? 3600);
        terminar(() => resolve(token));
      },
      error_callback: (error) => {
        terminar(() => reject(new Error(descifrarErrorCliente(error))));
      },
    });

    cliente.requestAccessToken(
      opciones.silencioso ? { prompt: '', hint: opciones.cuenta } : { hint: opciones.cuenta },
    );
  });
}

function descifrarErrorCliente(error: { type?: string; message?: string }): string {
  if (error.type === 'popup_closed') {
    return 'Has cerrado la ventana de Google antes de dar permiso.';
  }
  if (error.type === 'popup_failed_to_open') {
    return (
      'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes ' +
      'para esta página y vuelve a intentarlo.'
    );
  }
  return error.message || 'Google ha rechazado la petición de permiso.';
}

function descifrarError(respuesta: RespuestaToken): string {
  if (respuesta.error === 'access_denied') {
    return 'Has denegado el permiso. Sin él la app no puede leer las fotos que selecciones.';
  }
  if (respuesta.error === 'idpiframe_initialization_failed') {
    return 'Google no admite este origen. Añade la URL de la app en «Orígenes autorizados de JavaScript».';
  }
  return respuesta.error_description || respuesta.error || 'Error desconocido al pedir el token.';
}

export function cerrarSesionGoogle(): void {
  const guardado = leerGuardado();
  if (guardado) {
    try {
      window.google?.accounts?.oauth2?.revoke(guardado.token);
    } catch {
      /* si la revocación falla, basta con olvidar el token localmente */
    }
  }
  enMemoria = null;
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* nada que limpiar */
  }
}
