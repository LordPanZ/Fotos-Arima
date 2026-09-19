import type { Foto } from '../types';

/**
 * Cliente del catálogo compartido.
 *
 * Habla con una única función de servidor que guarda las fichas y reparte
 * enlaces temporales para las imágenes. Los aparatos nunca tocan la base de
 * datos ni el almacén directamente.
 */

export const URL_CATALOGO =
  (import.meta.env.VITE_URL_CATALOGO as string | undefined) ??
  'https://igxanputrpxdvpocfipy.supabase.co/functions/v1/catalogo';

export interface CambioRemoto {
  id: string;
  ficha: Foto;
  borrada: boolean;
  actualizadoEn: string;
  miniatura: string | null;
}

export interface RespuestaCambios {
  cambios: CambioRemoto[];
  hasta: string | null;
  hayMas: boolean;
}

export class ErrorNube extends Error {}

/** Cabecera de acceso, si algún día se cierra el catálogo con código. */
function cabeceras(): HeadersInit {
  const clave = (import.meta.env.VITE_CLAVE_ARIMA as string | undefined) ?? '';
  return {
    'Content-Type': 'application/json',
    ...(clave ? { 'x-arima-clave': clave } : {}),
  };
}

async function pedir<T>(init: RequestInit, consulta = ''): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_CATALOGO}${consulta}`, { ...init, headers: cabeceras() });
  } catch (e) {
    throw new ErrorNube(
      `No se ha podido conectar con el catálogo compartido. ${
        e instanceof Error ? e.message : ''
      }`.trim(),
    );
  }

  if (respuesta.status === 401) {
    throw new ErrorNube('El catálogo compartido ha rechazado el acceso.');
  }
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    throw new ErrorNube(detalle?.error ?? `El catálogo ha respondido ${respuesta.status}.`);
  }
  return (await respuesta.json()) as T;
}

export function cambiosDesde(desde: string | null, limite = 200): Promise<RespuestaCambios> {
  const parametros = new URLSearchParams({ limite: String(limite) });
  if (desde) parametros.set('desde', desde);
  return pedir<RespuestaCambios>({ method: 'GET' }, `?${parametros}`);
}

export function guardarFichas(fichas: Foto[]): Promise<{ guardadas: number }> {
  return pedir({ method: 'POST', body: JSON.stringify({ accion: 'guardar', fichas }) });
}

export function borrarEnNube(ids: string[]): Promise<{ borradas: number }> {
  return pedir({ method: 'POST', body: JSON.stringify({ accion: 'borrar', ids }) });
}

interface EnlaceSubida {
  id: string;
  completa: string | null;
  miniatura: string | null;
}

export function enlacesSubida(ids: string[]): Promise<{ enlaces: EnlaceSubida[] }> {
  return pedir({ method: 'POST', body: JSON.stringify({ accion: 'subir', ids }) });
}

export function enlacesDescarga(
  ids: string[],
): Promise<{ enlaces: Array<{ id: string; completa: string | null }> }> {
  return pedir({ method: 'POST', body: JSON.stringify({ accion: 'descargar', ids }) });
}

/** Sube los bytes de una imagen al enlace temporal que da el servidor. */
export async function subirImagen(enlace: string, imagen: Blob): Promise<void> {
  const respuesta = await fetch(enlace, {
    method: 'PUT',
    body: imagen,
    headers: { 'content-type': imagen.type || 'image/jpeg', 'x-upsert': 'true' },
  });
  if (!respuesta.ok) {
    throw new ErrorNube(`No se ha podido subir la imagen (${respuesta.status}).`);
  }
}

export async function descargarImagen(enlace: string): Promise<Blob> {
  const respuesta = await fetch(enlace);
  if (!respuesta.ok) {
    throw new ErrorNube(`No se ha podido descargar la imagen (${respuesta.status}).`);
  }
  return respuesta.blob();
}
