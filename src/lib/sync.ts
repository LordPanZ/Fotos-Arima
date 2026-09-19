import type { Foto } from '../types';
import * as db from './db';
import {
  borrarEnNube, cambiosDesde, descargarImagen, enlacesDescarga, enlacesSubida,
  guardarFichas, subirImagen, ErrorNube,
} from './nube';

/**
 * Sincronización con el catálogo compartido.
 *
 * Dos sentidos y una regla: gana el cambio más reciente. Para dos personas es
 * suficiente y evita toda la complejidad de fusionar campo a campo.
 *
 * El reparto de imágenes está pensado para gastar poco: al sincronizar solo
 * viajan las miniaturas, y la imagen grande se baja cuando alguien abre la
 * foto o la comparte.
 */

export interface ResumenSync {
  subidas: number;
  bajadas: number;
  borradasFuera: number;
  errores: string[];
}

/** Cuántas fotos se suben a la vez: el servidor limita el lote a 20. */
const LOTE_SUBIDA = 10;

function trozos<T>(lista: T[], tamano: number): T[][] {
  const salida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) salida.push(lista.slice(i, i + tamano));
  return salida;
}

/* ------------------------------------------------------------- subida */

async function empujar(resumen: ResumenSync): Promise<void> {
  const pendientes = await db.listarPendientes();
  if (!pendientes.length) return;

  const aBorrar = pendientes.filter((p) => p.accion === 'borrar').map((p) => p.id);
  if (aBorrar.length) {
    await borrarEnNube(aBorrar);
    await db.quitarPendientes(aBorrar);
  }

  const aGuardar = pendientes.filter((p) => p.accion === 'guardar').map((p) => p.id);
  for (const lote of trozos(aGuardar, LOTE_SUBIDA)) {
    const fichas: Foto[] = [];
    const conImagen: string[] = [];

    for (const id of lote) {
      const foto = await db.obtenerFoto(id);
      // Si ya no está en local, es que se borró: la lápida la pone el borrado.
      if (!foto) continue;
      fichas.push(foto);
      conImagen.push(id);
    }
    if (!fichas.length) {
      await db.quitarPendientes(lote);
      continue;
    }

    // Primero las imágenes: si falla la subida, la ficha no queda apuntando
    // a un archivo que no existe.
    const { enlaces } = await enlacesSubida(conImagen);
    for (const enlace of enlaces) {
      const imagenes = await db.obtenerImagenes(enlace.id);
      if (!imagenes) continue;
      try {
        if (enlace.miniatura) await subirImagen(enlace.miniatura, imagenes.miniatura);
        if (enlace.completa && imagenes.completa) {
          await subirImagen(enlace.completa, imagenes.completa);
        }
      } catch (e) {
        resumen.errores.push(
          `No se ha podido subir una imagen: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    await guardarFichas(fichas);
    await db.quitarPendientes(lote);
    resumen.subidas += fichas.length;
  }
}

/* -------------------------------------------------------------- bajada */

async function traer(resumen: ResumenSync): Promise<void> {
  let marca = await db.leerMarca();
  let quedan = true;
  let vueltas = 0;

  while (quedan && vueltas < 20) {
    vueltas += 1;
    const respuesta = await cambiosDesde(marca);
    quedan = respuesta.hayMas;

    for (const cambio of respuesta.cambios) {
      const local = await db.obtenerFoto(cambio.id);

      if (cambio.borrada) {
        if (local) {
          await db.borrarFotos([cambio.id]);
          resumen.borradasFuera += 1;
        }
        continue;
      }

      // El cambio local sin subir manda: si no, sincronizar pisaría lo que
      // acabas de escribir mientras no había cobertura.
      const sinSubir = (await db.listarPendientes()).some((p) => p.id === cambio.id);
      if (sinSubir) continue;
      if (local && local.actualizadaEn >= (cambio.ficha?.actualizadaEn ?? '')) continue;

      try {
        if (cambio.miniatura) {
          const miniatura = await descargarImagen(cambio.miniatura);
          const previas = await db.obtenerImagenes(cambio.id);
          await db.guardarImagenes(cambio.id, previas?.completa, miniatura);
        }
        await db.guardarFoto(cambio.ficha);
        resumen.bajadas += 1;
      } catch (e) {
        resumen.errores.push(
          `No se ha podido traer «${cambio.ficha?.nombre ?? cambio.id}»: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    if (respuesta.hasta) {
      marca = respuesta.hasta;
      await db.escribirMarca(marca);
    } else {
      quedan = false;
    }
  }
}

let enMarcha: Promise<ResumenSync> | null = null;

/** Sincroniza en los dos sentidos. Las llamadas solapadas comparten la misma. */
export function sincronizar(): Promise<ResumenSync> {
  if (enMarcha) return enMarcha;

  enMarcha = (async () => {
    const resumen: ResumenSync = { subidas: 0, bajadas: 0, borradasFuera: 0, errores: [] };
    try {
      await empujar(resumen);
      await traer(resumen);
    } catch (e) {
      if (e instanceof ErrorNube) resumen.errores.push(e.message);
      else throw e;
    }
    return resumen;
  })().finally(() => {
    enMarcha = null;
  });

  return enMarcha;
}

/** Baja la imagen grande de una foto que llegó de otro aparato. */
export async function traerCompleta(id: string): Promise<Blob | null> {
  try {
    const { enlaces } = await enlacesDescarga([id]);
    const enlace = enlaces[0]?.completa;
    return enlace ? await descargarImagen(enlace) : null;
  } catch {
    return null;
  }
}

/** Igual que `db.obtenerCompleta`, pero sabiendo bajarla si falta. */
export function obtenerCompleta(id: string): Promise<Blob | undefined> {
  return db.obtenerCompleta(id, traerCompleta);
}
