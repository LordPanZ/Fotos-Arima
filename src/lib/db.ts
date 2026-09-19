import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Ajustes, Foto } from '../types';
import { AJUSTES_POR_DEFECTO } from '../types';

interface Imagenes {
  id: string;
  /** Ausente en las fotos que llegan del catálogo compartido: primero se
   *  sincroniza solo la miniatura y la imagen grande se baja al abrirla. */
  completa?: Blob;
  miniatura: Blob;
}

/** Cola de cambios locales que todavía no ha visto el catálogo compartido. */
export interface Pendiente {
  id: string;
  accion: 'guardar' | 'borrar';
}

interface EsquemaArima extends DBSchema {
  fotos: {
    key: string;
    value: Foto;
    indexes: { categoria: string; estado: string; revision: string; fecha: string };
  };
  imagenes: { key: string; value: Imagenes };
  ajustes: { key: string; value: unknown };
  pendientes: { key: string; value: Pendiente };
}

const NOMBRE_BD = 'fotos-arima';
const VERSION = 3;

let promesaBD: Promise<IDBPDatabase<EsquemaArima>> | null = null;

export function bd(): Promise<IDBPDatabase<EsquemaArima>> {
  if (!promesaBD) {
    promesaBD = openDB<EsquemaArima>(NOMBRE_BD, VERSION, {
      async upgrade(db, versionPrevia, _nueva, tx) {
        if (!db.objectStoreNames.contains('fotos')) {
          const fotos = db.createObjectStore('fotos', { keyPath: 'id' });
          fotos.createIndex('categoria', 'categoria');
          fotos.createIndex('estado', 'estado');
          fotos.createIndex('revision', 'revision');
          fotos.createIndex('fecha', 'fecha');
        }
        if (!db.objectStoreNames.contains('imagenes')) {
          db.createObjectStore('imagenes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('ajustes')) {
          db.createObjectStore('ajustes');
        }
        if (!db.objectStoreNames.contains('pendientes')) {
          db.createObjectStore('pendientes', { keyPath: 'id' });
        }

        // v2: el catálogo dejó de ser solo de manualidades (llegaron Diskofesta
        // e Ihes Gela), así que `esManualidad` pasó a llamarse
        // `entraEnCatalogo`. Sin esto, las fotos ya guardadas se quedarían con
        // el campo a `undefined` y desaparecerían del catálogo.
        if (versionPrevia >= 1 && versionPrevia < 2) {
          const fotos = tx.objectStore('fotos');
          for await (const cursor of fotos) {
            const foto = cursor.value as Foto & { esManualidad?: boolean | null };
            if ('esManualidad' in foto) {
              const { esManualidad, ...resto } = foto;
              await cursor.update({ ...resto, entraEnCatalogo: esManualidad ?? null });
            }
          }
        }
      },
    });
  }
  return promesaBD;
}

/* ------------------------------------------------------------------ fotos */

export async function listarFotos(): Promise<Foto[]> {
  return (await bd()).getAll('fotos');
}

export async function obtenerFoto(id: string): Promise<Foto | undefined> {
  return (await bd()).get('fotos', id);
}

export async function guardarFoto(foto: Foto): Promise<void> {
  await (await bd()).put('fotos', foto);
}

export async function guardarFotos(fotos: Foto[]): Promise<void> {
  const db = await bd();
  const tx = db.transaction('fotos', 'readwrite');
  await Promise.all([...fotos.map((f) => tx.store.put(f)), tx.done]);
}

export async function borrarFotos(ids: string[]): Promise<void> {
  const db = await bd();
  const tx = db.transaction(['fotos', 'imagenes'], 'readwrite');
  await Promise.all([
    ...ids.map((id) => tx.objectStore('fotos').delete(id)),
    ...ids.map((id) => tx.objectStore('imagenes').delete(id)),
    tx.done,
  ]);
  for (const id of ids) revocarUrl(id);
}

/** Identificadores de Google ya importados, para no duplicar en cada importación. */
export async function idsGoogleExistentes(): Promise<Set<string>> {
  const fotos = await listarFotos();
  return new Set(fotos.map((f) => f.idGoogle).filter((v): v is string => Boolean(v)));
}

/* --------------------------------------------------------------- imágenes */

export async function guardarImagenes(
  id: string,
  completa: Blob | undefined,
  miniatura: Blob,
): Promise<void> {
  await (await bd()).put('imagenes', { id, completa, miniatura });
}

export async function obtenerImagenes(id: string): Promise<Imagenes | undefined> {
  return (await bd()).get('imagenes', id);
}

/**
 * Devuelve la imagen a tamaño completo, bajándola del catálogo compartido la
 * primera vez si esta foto llegó de otro aparato. `traer` se inyecta para que
 * la base de datos no dependa del cliente de red.
 */
export async function obtenerCompleta(
  id: string,
  traer?: (id: string) => Promise<Blob | null>,
): Promise<Blob | undefined> {
  const registro = await obtenerImagenes(id);
  if (registro?.completa) return registro.completa;
  if (!registro || !traer) return undefined;

  const bajada = await traer(id);
  if (!bajada) return undefined;
  await guardarImagenes(id, bajada, registro.miniatura);
  return bajada;
}

/* ----------------------------------------------------- URLs de objeto */

const urlsMiniatura = new Map<string, string>();

/** Devuelve (y memoriza) una URL de objeto para la miniatura de una foto. */
export async function urlMiniatura(id: string): Promise<string | null> {
  const cacheada = urlsMiniatura.get(id);
  if (cacheada) return cacheada;
  const registro = await obtenerImagenes(id);
  if (!registro) return null;
  const url = URL.createObjectURL(registro.miniatura);
  urlsMiniatura.set(id, url);
  return url;
}

export function revocarUrl(id: string): void {
  const url = urlsMiniatura.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlsMiniatura.delete(id);
  }
}

/* ---------------------------------------------------------------- ajustes */

export async function leerAjustes(): Promise<Ajustes> {
  const guardados = (await (await bd()).get('ajustes', 'ajustes')) as Partial<Ajustes> | undefined;
  return { ...AJUSTES_POR_DEFECTO, ...(guardados ?? {}) };
}

export async function escribirAjustes(ajustes: Ajustes): Promise<void> {
  await (await bd()).put('ajustes', ajustes, 'ajustes');
}

/* ------------------------------------------------------------------ varios */

export interface UsoAlmacenamiento {
  usado: number;
  disponible: number;
  fotos: number;
}

export async function usoAlmacenamiento(): Promise<UsoAlmacenamiento> {
  const fotos = (await bd()).count('fotos');
  let usado = 0;
  let disponible = 0;
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    usado = est.usage ?? 0;
    disponible = est.quota ?? 0;
  }
  return { usado, disponible, fotos: await fotos };
}

export async function vaciarTodo(): Promise<void> {
  const db = await bd();
  const tx = db.transaction(['fotos', 'imagenes'], 'readwrite');
  await Promise.all([tx.objectStore('fotos').clear(), tx.objectStore('imagenes').clear(), tx.done]);
  for (const id of [...urlsMiniatura.keys()]) revocarUrl(id);
}

/* --------------------------------------------------- cola de pendientes */

export async function marcarPendiente(id: string, accion: Pendiente['accion']): Promise<void> {
  await (await bd()).put('pendientes', { id, accion });
}

export async function marcarPendientes(ids: string[], accion: Pendiente['accion']): Promise<void> {
  const db = await bd();
  const tx = db.transaction('pendientes', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.put({ id, accion })), tx.done]);
}

export async function listarPendientes(): Promise<Pendiente[]> {
  return (await bd()).getAll('pendientes');
}

export async function quitarPendientes(ids: string[]): Promise<void> {
  const db = await bd();
  const tx = db.transaction('pendientes', 'readwrite');
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
}

/* ------------------------------------------------ marca de sincronización */

const CLAVE_MARCA = 'sincronizacion';

export async function leerMarca(): Promise<string | null> {
  return ((await (await bd()).get('ajustes', CLAVE_MARCA)) as string | undefined) ?? null;
}

export async function escribirMarca(marca: string | null): Promise<void> {
  await (await bd()).put('ajustes', marca, CLAVE_MARCA);
}
