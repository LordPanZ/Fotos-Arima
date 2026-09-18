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
    const cliente = oauth2.initTokenClient({
      client_id: opciones.clientId,
      scope: AMBITO_SELECTOR,
      hint: opciones.cuenta,
      callback: (respuesta) => {
        if (respuesta.error || !respuesta.access_token) {
          reject(new Error(descifrarError(respuesta)));
          return;
        }
        guardar(respuesta.access_token, respuesta.expires_in ?? 3600);
        resolve(respuesta.access_token);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === 'popup_closed'
              ? 'Has cerrado la ventana de Google antes de dar permiso.'
              : error.message || 'Google ha rechazado la petición de permiso.',
          ),
        );
      },
    });

    cliente.requestAccessToken(
      opciones.silencioso ? { prompt: '', hint: opciones.cuenta } : { hint: opciones.cuenta },
    );
  });
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
