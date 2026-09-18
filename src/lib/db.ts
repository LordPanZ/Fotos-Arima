import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Ajustes, Foto } from '../types';
import { AJUSTES_POR_DEFECTO } from '../types';

interface Imagenes {
  id: string;
  completa: Blob;
  miniatura: Blob;
}

interface EsquemaArima extends DBSchema {
  fotos: {
    key: string;
    value: Foto;
    indexes: { categoria: string; estado: string; revision: string; fecha: string };
  };
  imagenes: { key: string; value: Imagenes };
  ajustes: { key: string; value: unknown };
}

const NOMBRE_BD = 'fotos-arima';
const VERSION = 1;

let promesaBD: Promise<IDBPDatabase<EsquemaArima>> | null = null;

export function bd(): Promise<IDBPDatabase<EsquemaArima>> {
  if (!promesaBD) {
    promesaBD = openDB<EsquemaArima>(NOMBRE_BD, VERSION, {
      upgrade(db) {
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

export async function guardarImagenes(id: string, completa: Blob, miniatura: Blob): Promise<void> {
  await (await bd()).put('imagenes', { id, completa, miniatura });
}

export async function obtenerImagenes(id: string): Promise<Imagenes | undefined> {
  return (await bd()).get('imagenes', id);
}

export async function obtenerCompleta(id: string): Promise<Blob | undefined> {
  return (await obtenerImagenes(id))?.completa;
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
