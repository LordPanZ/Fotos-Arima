/**
 * Cliente de la API del Selector de Google Fotos (Google Photos Picker API).
 *
 * Flujo: se crea una sesión → se abre `pickerUri` para que la persona elija las
 * fotos en la interfaz de Google → se consulta la sesión hasta que Google marca
 * la selección como terminada → se listan y descargan los elementos elegidos.
 */

const BASE = 'https://photospicker.googleapis.com/v1';

export interface SesionSelector {
  id: string;
  pickerUri: string;
  intervaloMs: number;
  caducaEnMs: number;
}

export interface ElementoSeleccionado {
  id: string;
  creadaEl?: string;
  tipo: string;
  baseUrl: string;
  tipoMime: string;
  archivo: string;
  ancho: number;
  alto: number;
}

function segundosDesde(duracion: string | undefined, porDefecto: number): number {
  // La API devuelve duraciones tipo "5s" o "1800s".
  const n = Number.parseFloat(String(duracion ?? '').replace('s', ''));
  return Number.isFinite(n) && n > 0 ? n * 1000 : porDefecto;
}

async function peticion<T>(token: string, ruta: string, init: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    throw new Error(
      'No se ha podido contactar con Google Fotos. Revisa la conexión a internet. ' +
        `(${e instanceof Error ? e.message : String(e)})`,
    );
  }

  if (!respuesta.ok) throw await errorLegible(respuesta);
  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

async function errorLegible(respuesta: Response): Promise<Error> {
  let detalle = '';
  try {
    const cuerpo = await respuesta.json();
    detalle = cuerpo?.error?.message ?? '';
  } catch {
    /* algunas respuestas de error no traen JSON */
  }

  if (respuesta.status === 401) {
    return new Error('La sesión de Google ha caducado. Vuelve a conectar la cuenta.');
  }
  if (respuesta.status === 403) {
    return new Error(
      'Google ha denegado el acceso. Comprueba que la «Photos Picker API» está activada en tu ' +
        'proyecto de Google Cloud y que la cuenta figura como usuario de prueba. ' +
        (detalle ? `Detalle: ${detalle}` : ''),
    );
  }
  if (respuesta.status === 429) {
    return new Error('Google ha limitado el número de peticiones. Espera un minuto y reinténtalo.');
  }
  return new Error(`Google ha respondido ${respuesta.status}. ${detalle}`.trim());
}

export async function crearSesion(token: string): Promise<SesionSelector> {
  const datos = await peticion<{
    id: string;
    pickerUri: string;
    pollingConfig?: { pollInterval?: string; timeoutIn?: string };
  }>(token, '/sessions', { method: 'POST', body: '{}' });

  return {
    id: datos.id,
    pickerUri: datos.pickerUri,
    intervaloMs: Math.max(2000, segundosDesde(datos.pollingConfig?.pollInterval, 5000)),
    caducaEnMs: segundosDesde(datos.pollingConfig?.timeoutIn, 30 * 60 * 1000),
  };
}

export async function seleccionTerminada(token: string, idSesion: string): Promise<boolean> {
  const datos = await peticion<{ mediaItemsSet?: boolean }>(
    token,
    `/sessions/${encodeURIComponent(idSesion)}`,
  );
  return Boolean(datos.mediaItemsSet);
}

export async function borrarSesion(token: string, idSesion: string): Promise<void> {
  try {
    await peticion(token, `/sessions/${encodeURIComponent(idSesion)}`, { method: 'DELETE' });
  } catch {
    // Limpieza de cortesía: si falla, la sesión caduca sola.
  }
}

interface ElementoBruto {
  id: string;
  createTime?: string;
  type?: string;
  mediaFile?: {
    baseUrl?: string;
    mimeType?: string;
    filename?: string;
    mediaFileMetadata?: { width?: number; height?: number };
  };
}

/** Lista todo lo que la persona ha elegido (pagina hasta agotar la sesión). */
export async function listarSeleccion(
  token: string,
  idSesion: string,
): Promise<ElementoSeleccionado[]> {
  const elementos: ElementoSeleccionado[] = [];
  let pagina: string | undefined;

  do {
    const parametros = new URLSearchParams({ sessionId: idSesion, pageSize: '100' });
    if (pagina) parametros.set('pageToken', pagina);

    const datos = await peticion<{ mediaItems?: ElementoBruto[]; nextPageToken?: string }>(
      token,
      `/mediaItems?${parametros.toString()}`,
    );

    for (const bruto of datos.mediaItems ?? []) {
      const archivo = bruto.mediaFile;
      if (!archivo?.baseUrl) continue;
      // Los vídeos se ignoran: esta app cataloga fotografías.
      if ((bruto.type ?? 'PHOTO') !== 'PHOTO') continue;

      elementos.push({
        id: bruto.id,
        creadaEl: bruto.createTime,
        tipo: bruto.type ?? 'PHOTO',
        baseUrl: archivo.baseUrl,
        tipoMime: archivo.mimeType ?? 'image/jpeg',
        archivo: archivo.filename ?? `${bruto.id}.jpg`,
        ancho: archivo.mediaFileMetadata?.width ?? 0,
        alto: archivo.mediaFileMetadata?.height ?? 0,
      });
    }

    pagina = datos.nextPageToken;
  } while (pagina);

  return elementos;
}

/**
 * Descarga los bytes de una foto seleccionada.
 * La API del Selector exige la cabecera `Authorization` también aquí, así que
 * no sirve poner `baseUrl` directamente en un `<img>`.
 */
export async function descargarFoto(
  token: string,
  baseUrl: string,
  ladoMaximo = 2048,
): Promise<Blob> {
  const url = `${baseUrl}=w${ladoMaximo}-h${ladoMaximo}`;
  let respuesta: Response;
  try {
    respuesta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    throw new Error(
      'El navegador ha bloqueado la descarga de la foto. Si se repite, usa la aplicación de ' +
        `escritorio, que no tiene esta restricción. (${e instanceof Error ? e.message : String(e)})`,
    );
  }
  if (!respuesta.ok) throw await errorLegible(respuesta);
  return respuesta.blob();
}

/**
 * Espera a que la persona termine de elegir fotos en la ventana de Google.
 * Resuelve con `false` si se agota el tiempo o se cancela.
 */
export async function esperarSeleccion(
  token: string,
  sesion: SesionSelector,
  opciones: { cancelado: () => boolean; alEsperar?: (segundos: number) => void },
): Promise<boolean> {
  const limite = Date.now() + sesion.caducaEnMs;

  while (Date.now() < limite) {
    if (opciones.cancelado()) return false;
    await new Promise((r) => setTimeout(r, sesion.intervaloMs));
    if (opciones.cancelado()) return false;

    if (await seleccionTerminada(token, sesion.id)) return true;
    opciones.alEsperar?.(Math.round((limite - Date.now()) / 1000));
  }
  return false;
}
