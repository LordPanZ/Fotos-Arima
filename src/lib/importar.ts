import type { Ajustes, Foto } from '../types';
import { SIN_CLASIFICAR } from '../taxonomy';
import { guardarFoto, guardarImagenes, idsGoogleExistentes, obtenerFoto } from './db';
import { crearMiniatura, dimensiones, fechaExif, huella, reescalar } from './image';
import { descargarFoto as descargarDeGoogle, listarSeleccion, type ElementoSeleccionado } from './googlePicker';

export interface ProgresoImportacion {
  fase: 'preparando' | 'descargando' | 'guardando' | 'hecho';
  hechas: number;
  total: number;
  actual?: string;
}

export interface ResultadoImportacion {
  nuevas: Foto[];
  duplicadas: number;
  fallidas: Array<{ archivo: string; motivo: string }>;
}

const TIPOS_ACEPTADOS = /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/i;

function fichaVacia(base: Omit<Foto, 'estado' | 'esManualidad' | 'confianza' | 'categoria' | 'materiales' | 'colores' | 'etiquetas' | 'motor' | 'revision' | 'favorita' | 'nombreEditado'>): Foto {
  return {
    ...base,
    nombreEditado: false,
    estado: 'pendiente',
    esManualidad: null,
    confianza: 0,
    categoria: SIN_CLASIFICAR,
    materiales: [],
    colores: [],
    etiquetas: [],
    motor: null,
    revision: 'auto',
    favorita: false,
  };
}

/** Guarda el original reescalado y su miniatura, y devuelve las dimensiones. */
async function guardarImagen(id: string, blob: Blob, ladoMaximo: number) {
  const { blob: completa, ancho, alto } = await reescalar(blob, ladoMaximo);
  const miniatura = await crearMiniatura(completa);
  await guardarImagenes(id, completa, miniatura);
  return { completa, ancho, alto };
}

/* ------------------------------------------------------- archivos locales */

export async function importarArchivos(
  archivos: File[],
  ajustes: Ajustes,
  alProgresar?: (p: ProgresoImportacion) => void,
): Promise<ResultadoImportacion> {
  const resultado: ResultadoImportacion = { nuevas: [], duplicadas: 0, fallidas: [] };
  const imagenes = archivos.filter((a) => TIPOS_ACEPTADOS.test(a.type) || /\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(a.name));

  for (const archivo of archivos) {
    if (!imagenes.includes(archivo)) {
      resultado.fallidas.push({ archivo: archivo.name, motivo: 'No es una imagen.' });
    }
  }

  let hechas = 0;
  for (const archivo of imagenes) {
    alProgresar?.({ fase: 'guardando', hechas, total: imagenes.length, actual: archivo.name });
    try {
      const id = `local-${await huella(archivo)}-${archivo.size}`;
      if (await obtenerFoto(id)) {
        resultado.duplicadas += 1;
        continue;
      }

      const { completa, ancho, alto } = await guardarImagen(id, archivo, ajustes.tamanoMaximo);
      const fecha =
        (await fechaExif(archivo)) ??
        (archivo.lastModified ? new Date(archivo.lastModified).toISOString() : new Date().toISOString());

      const foto = fichaVacia({
        id,
        origen: 'local',
        archivoOriginal: archivo.name,
        nombre: archivo.name.replace(/\.[^.]+$/, ''),
        tipoMime: completa.type || archivo.type || 'image/jpeg',
        ancho,
        alto,
        bytes: completa.size,
        fecha,
        importadaEl: new Date().toISOString(),
      });

      await guardarFoto(foto);
      resultado.nuevas.push(foto);
    } catch (error) {
      resultado.fallidas.push({
        archivo: archivo.name,
        motivo: error instanceof Error ? error.message : String(error),
      });
    } finally {
      hechas += 1;
      alProgresar?.({ fase: 'guardando', hechas, total: imagenes.length });
    }
  }

  alProgresar?.({ fase: 'hecho', hechas, total: imagenes.length });
  return resultado;
}

/* ----------------------------------------------------------- Google Fotos */

export async function importarDesdeGoogle(
  token: string,
  idSesion: string,
  ajustes: Ajustes,
  senal: AbortSignal,
  alProgresar?: (p: ProgresoImportacion) => void,
): Promise<ResultadoImportacion> {
  alProgresar?.({ fase: 'preparando', hechas: 0, total: 0 });

  const seleccion = await listarSeleccion(token, idSesion);
  const yaImportadas = await idsGoogleExistentes();
  const pendientes = seleccion.filter((e) => !yaImportadas.has(e.id));

  const resultado: ResultadoImportacion = {
    nuevas: [],
    duplicadas: seleccion.length - pendientes.length,
    fallidas: [],
  };

  let hechas = 0;
  for (const elemento of pendientes) {
    if (senal.aborted) break;
    alProgresar?.({
      fase: 'descargando',
      hechas,
      total: pendientes.length,
      actual: elemento.archivo,
    });

    try {
      resultado.nuevas.push(await importarElemento(token, elemento, ajustes));
    } catch (error) {
      resultado.fallidas.push({
        archivo: elemento.archivo,
        motivo: error instanceof Error ? error.message : String(error),
      });
    } finally {
      hechas += 1;
      alProgresar?.({ fase: 'descargando', hechas, total: pendientes.length });
    }
  }

  alProgresar?.({ fase: 'hecho', hechas, total: pendientes.length });
  return resultado;
}

async function importarElemento(
  token: string,
  elemento: ElementoSeleccionado,
  ajustes: Ajustes,
): Promise<Foto> {
  const id = `google-${elemento.id}`;
  const descargada = await descargarDeGoogle(token, elemento.baseUrl, ajustes.tamanoMaximo);
  const { completa, ancho, alto } = await guardarImagen(id, descargada, ajustes.tamanoMaximo);

  // Google ya devuelve las dimensiones, pero solo del original: si el reescalado
  // ha cambiado algo, mandan las medidas reales del archivo que guardamos.
  const medidas = ancho && alto ? { ancho, alto } : await dimensiones(completa);

  const foto = fichaVacia({
    id,
    origen: 'google',
    idGoogle: elemento.id,
    archivoOriginal: elemento.archivo,
    nombre: elemento.archivo.replace(/\.[^.]+$/, ''),
    tipoMime: completa.type || elemento.tipoMime,
    ancho: medidas.ancho,
    alto: medidas.alto,
    bytes: completa.size,
    fecha: elemento.creadaEl ?? (await fechaExif(completa)) ?? new Date().toISOString(),
    importadaEl: new Date().toISOString(),
  });

  await guardarFoto(foto);
  return foto;
}
