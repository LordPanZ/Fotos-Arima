import type { Evento, Foto } from '../types';
import { SIN_CLASIFICAR } from '../taxonomy';
import { crearMiniatura, huella, reescalar } from './image';
import { enlacesSubida, guardarFichas, subirImagen } from './nube';
import { nombreDeFoto, nuevoIdEnvio, type DatosFormulario } from './envio';
import { LIMITE_VIDEO, datosDeVideo, pareceVideo } from './video';

/**
 * Envío directo al catálogo compartido desde el formulario de monitores.
 *
 * Las fotos entran como fichas normales con `origen: 'envio'`, así que la
 * sincronización habitual de la app las trae sin ningún camino especial, y la
 * regla de revisión las retiene en «Revisar» hasta que alguien las mire.
 */

/** Lado mayor con el que se guardan: suficiente para el catálogo y ligero de subir. */
const LADO_MAXIMO = 2048;

export interface ProgresoEnvio {
  fase: 'preparando' | 'subiendo' | 'hecho';
  hechas: number;
  total: number;
}

export interface ResultadoEnvio {
  idEnvio: string;
  enviadas: number;
  fallidas: Array<{ archivo: string; motivo: string }>;
}

/** Cuántas fotos se suben por tanda: el servidor limita el lote a 20. */
const TANDA = 8;

export async function enviarAlBuzon(
  datos: DatosFormulario,
  archivos: File[],
  alProgresar?: (p: ProgresoEnvio) => void,
): Promise<ResultadoEnvio> {
  if (!archivos.length) throw new Error('No hay ninguna foto que enviar.');

  const idEnvio = nuevoIdEnvio();
  const evento: Evento = {
    titulo: datos.titulo.trim(),
    lugar: datos.lugar.trim(),
    monitor: datos.monitor?.trim() || undefined,
    notas: datos.notas?.trim() || undefined,
    materiales: datos.materiales?.length ? datos.materiales : undefined,
    idEnvio,
  };

  // La fecha la pone el monitor: es quien sabe qué día fue el taller.
  const fechaEvento = new Date(`${datos.fecha}T12:00:00`);
  const fecha = Number.isNaN(fechaEvento.getTime())
    ? new Date().toISOString()
    : fechaEvento.toISOString();

  const resultado: ResultadoEnvio = { idEnvio, enviadas: 0, fallidas: [] };
  let hechas = 0;

  alProgresar?.({ fase: 'preparando', hechas: 0, total: archivos.length });

  for (let inicio = 0; inicio < archivos.length; inicio += TANDA) {
    const tanda = archivos.slice(inicio, inicio + TANDA);
    const preparadas: Array<{ foto: Foto; completa: Blob; miniatura: Blob }> = [];

    for (const [posicion, archivo] of tanda.entries()) {
      try {
        // Los vídeos van tal cual: recodificarlos en el móvil del monitor
        // tardaría más que el propio envío.
        const video = pareceVideo(archivo);
        if (video && archivo.size > LIMITE_VIDEO) {
          throw new Error(
            `Bideoak ${Math.round(archivo.size / 1048576)} MB ditu eta gehienez ` +
              `${Math.round(LIMITE_VIDEO / 1048576)} MB onartzen dira.`,
          );
        }

        const { completa, ancho, alto, duracion, miniatura } = video
          ? { completa: archivo as Blob, ...(await datosDeVideo(archivo)) }
          : await (async () => {
              const escalada = await reescalar(archivo, LADO_MAXIMO);
              return {
                completa: escalada.blob,
                ancho: escalada.ancho,
                alto: escalada.alto,
                duracion: undefined as number | undefined,
                miniatura: await crearMiniatura(escalada.blob),
              };
            })();
        const ahora = new Date().toISOString();

        preparadas.push({
          completa,
          miniatura,
          foto: {
            id: `envio-${idEnvio}-${await huella(completa)}`,
            origen: 'envio',
            evento,
            archivoOriginal: archivo.name,
            nombre: nombreDeFoto(evento.titulo, inicio + posicion, archivos.length),
            // El título lo escribió el monitor: cuenta como nombre puesto a
            // mano y la plantilla no lo sobrescribe al analizar la foto.
            nombreEditado: true,
            tipoMime: completa.type || (video ? 'video/mp4' : 'image/jpeg'),
            ancho,
            alto,
            duracion,
            bytes: completa.size,
            fecha,
            importadaEl: ahora,
            actualizadaEn: ahora,
            // Igual que una importación normal: entra lista y sin tipo, y se lo
            // pone quien la revise. Nadie adivina por ella.
            estado: 'listo',
            entraEnCatalogo: null,
            confianza: 0,
            categoria: SIN_CLASIFICAR,
            materiales: [],
            colores: [],
            // Los materiales marcados son las etiquetas de la foto; el
            // clasificador añadirá después las suyas sin borrarlas.
            etiquetas: evento.materiales ?? [],
            motor: null,
            revision: 'auto',
            favorita: false,
          },
        });
      } catch (e) {
        resultado.fallidas.push({
          archivo: archivo.name,
          motivo: e instanceof Error ? e.message : String(e),
        });
      } finally {
        hechas += 1;
        alProgresar?.({ fase: 'preparando', hechas, total: archivos.length });
      }
    }

    if (!preparadas.length) continue;

    alProgresar?.({ fase: 'subiendo', hechas: resultado.enviadas, total: archivos.length });

    const { enlaces } = await enlacesSubida(preparadas.map((p) => p.foto.id));
    const subidas: Foto[] = [];

    for (const preparada of preparadas) {
      const enlace = enlaces.find((e) => e.id === preparada.foto.id);
      if (!enlace?.completa || !enlace.miniatura) {
        resultado.fallidas.push({
          archivo: preparada.foto.archivoOriginal,
          motivo: 'El servidor no ha dado enlace de subida.',
        });
        continue;
      }
      try {
        await subirImagen(enlace.miniatura, preparada.miniatura);
        await subirImagen(enlace.completa, preparada.completa);
        subidas.push(preparada.foto);
      } catch (e) {
        resultado.fallidas.push({
          archivo: preparada.foto.archivoOriginal,
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Las fichas van al final: una ficha sin su imagen dejaría un hueco en el
    // catálogo de quien sincronice antes de que termine la subida.
    if (subidas.length) {
      await guardarFichas(subidas);
      resultado.enviadas += subidas.length;
      alProgresar?.({ fase: 'subiendo', hechas: resultado.enviadas, total: archivos.length });
    }
  }

  alProgresar?.({ fase: 'hecho', hechas: resultado.enviadas, total: archivos.length });
  return resultado;
}
