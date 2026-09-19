import Anthropic from '@anthropic-ai/sdk';
import type { Ajustes, Foto, ProgresoAnalisis, ResultadoClasificacion } from '../../types';
import { NO_MANUALIDAD, SIN_CLASIFICAR } from '../../taxonomy';
import { obtenerCompleta } from '../sync';
import { nombreDesdePlantilla } from '../naming';
import { clasificarConIA, hayClaveIA, mensajeDeError } from './ai';
import { clasificarEnLocal } from './heuristic';

export { hayClaveIA, mensajeDeError, probarClave } from './ai';

/** Vuelca un resultado sobre la ficha de la foto, renombrándola si procede. */
export function aplicarResultado(
  foto: Foto,
  resultado: ResultadoClasificacion,
  plantilla: string,
): Foto {
  const actualizada: Foto = {
    ...foto,
    estado: 'listo',
    entraEnCatalogo: resultado.entraEnCatalogo,
    confianza: resultado.confianza,
    categoria: resultado.categoria,
    categoriaAlternativa: resultado.categoriaAlternativa,
    tecnica: resultado.tecnica,
    materiales: resultado.materiales,
    colores: resultado.colores,
    etiquetas: resultado.etiquetas,
    descripcion: resultado.descripcion,
    motivo: resultado.motivo,
    motor: resultado.motor,
    error: undefined,
  };

  if (!actualizada.nombreEditado) {
    actualizada.nombre = nombreDesdePlantilla(actualizada, plantilla);
  }
  return actualizada;
}

/**
 * ¿Necesita que una persona la mire?
 * Todo lo que el clasificador no ha decidido con holgura, más lo que no ha
 * sabido encasillar.
 */
export function necesitaRevision(foto: Foto, umbral: number): boolean {
  if (foto.revision !== 'auto') return false;
  if (foto.estado !== 'listo') return false;
  // Lo que mandan los monitores pasa siempre por revisión, por seguro que
  // esté el clasificador: es material de otra persona y alguien lo mira antes
  // de que entre al catálogo.
  if (foto.origen === 'envio') return true;
  if (foto.categoria === SIN_CLASIFICAR) return true;
  return foto.confianza < umbral;
}

/** Fotos que la galería muestra como catálogo aceptado. */
export function estaEnCatalogo(foto: Foto, umbral: number): boolean {
  if (foto.revision === 'confirmada') return true;
  if (foto.revision === 'descartada') return false;
  return (
    foto.estado === 'listo' &&
    foto.entraEnCatalogo === true &&
    foto.categoria !== SIN_CLASIFICAR &&
    foto.categoria !== NO_MANUALIDAD &&
    foto.confianza >= umbral
  );
}

export interface OpcionesAnalisis {
  fotos: Foto[];
  ajustes: Ajustes;
  senal: AbortSignal;
  alProgresar(progreso: ProgresoAnalisis): void;
  alTerminarFoto(foto: Foto): void | Promise<void>;
}

/** Errores que no tiene sentido reintentar foto a foto: paran el lote entero. */
function esFatal(error: unknown): boolean {
  return (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError
  );
}

export interface ResumenAnalisis {
  hechas: number;
  errores: number;
  cancelado: boolean;
  /** Mensaje cuando el lote se ha detenido por un problema de configuración. */
  abortadoPor?: string;
}

/**
 * Analiza un lote de fotos con la concurrencia configurada.
 * Persistir el resultado es responsabilidad de `alTerminarFoto`.
 */
export async function analizarLote(opciones: OpcionesAnalisis): Promise<ResumenAnalisis> {
  const { fotos, ajustes, senal } = opciones;
  const conIA = hayClaveIA(ajustes);
  const total = fotos.length;

  let hechas = 0;
  let errores = 0;
  let abortadoPor: string | undefined;
  let siguiente = 0;

  const avisar = (actual?: string) =>
    opciones.alProgresar({ activo: true, hechas, total, actual, errores });

  avisar();

  const trabajador = async (): Promise<void> => {
    while (!senal.aborted && !abortadoPor) {
      const indice = siguiente;
      siguiente += 1;
      if (indice >= fotos.length) return;

      const foto = fotos[indice];
      avisar(foto.nombre || foto.archivoOriginal);

      try {
        const imagen = await obtenerCompleta(foto.id);
        if (!imagen) throw new Error('La imagen ya no está guardada en este dispositivo.');

        const resultado = conIA
          ? await clasificarConIA(imagen, ajustes, senal)
          : await clasificarEnLocal(imagen, foto.archivoOriginal);

        await opciones.alTerminarFoto(aplicarResultado(foto, resultado, ajustes.plantillaNombre));
      } catch (error) {
        if (senal.aborted) return;
        if (esFatal(error)) {
          abortadoPor = mensajeDeError(error);
          return;
        }
        errores += 1;
        await opciones.alTerminarFoto({
          ...foto,
          estado: 'error',
          error: mensajeDeError(error),
        });
      } finally {
        hechas += 1;
        avisar();
      }
    }
  };

  const hilos = Math.max(1, Math.min(ajustes.concurrencia, conIA ? 8 : 2));
  await Promise.all(Array.from({ length: Math.min(hilos, total || 1) }, trabajador));

  opciones.alProgresar({ activo: false, hechas, total, errores });
  return { hechas, errores, cancelado: senal.aborted, abortadoPor };
}
