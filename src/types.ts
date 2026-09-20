import type { CategoriaPropia } from './taxonomy';

export type Origen = 'google' | 'local' | 'envio';

/** Datos del taller o evento, tal y como los rellenó quien envió las fotos. */
export interface Evento {
  titulo: string;
  lugar: string;
  /** Quién envía. Sirve para saber a quién preguntar si algo no cuadra. */
  monitor?: string;
  notas?: string;
  /** Materiales que marcó el monitor, en castellano. */
  materiales?: string[];
  /** Identificador del envío al que pertenece la foto. */
  idEnvio: string;
}

export type EstadoAnalisis = 'pendiente' | 'analizando' | 'listo' | 'error';

/** Decisión humana sobre la foto. `auto` = todavía no la ha revisado nadie. */
export type Revision = 'auto' | 'confirmada' | 'descartada';

export type Motor = 'ia' | 'heuristico' | 'manual' | null;

export interface Foto {
  id: string;
  origen: Origen;
  /** Identificador del elemento en Google Fotos, cuando viene de allí. */
  idGoogle?: string;
  /** Presente cuando la foto llega desde el formulario de monitores. */
  evento?: Evento;
  /** Nombre del archivo original, tal y como llegó. */
  archivoOriginal: string;
  /** Nombre editable: es el que se usa al compartir y exportar. */
  nombre: string;
  /** `true` cuando la persona ha escrito el nombre a mano; la plantilla ya no lo toca. */
  nombreEditado: boolean;
  tipoMime: string;
  ancho: number;
  alto: number;
  bytes: number;
  /** Segundos, solo en los vídeos. Que sea vídeo se sabe por `tipoMime`. */
  duracion?: number;
  /** Fecha de captura (ISO). Si no se conoce, la de importación. */
  fecha: string;
  importadaEl: string;
  /** Marca del último cambio local. Decide quién gana al sincronizar. */
  actualizadaEn: string;

  estado: EstadoAnalisis;
  /** `true` si es una manualidad o una actividad de Arima; `false` si no. */
  entraEnCatalogo: boolean | null;
  confianza: number;
  categoria: string;
  /**
   * Definición de la categoría cuando es una creada a mano. Viaja con la ficha
   * para que el otro dispositivo del equipo sepa pintarla aunque no la tenga
   * dada de alta: el catálogo se comparte, pero los ajustes no.
   */
  categoriaPropia?: CategoriaPropia;
  /** Segunda opción del clasificador, útil al revisar. */
  categoriaAlternativa?: string;
  tecnica?: string;
  materiales: string[];
  colores: string[];
  etiquetas: string[];
  descripcion?: string;
  motivo?: string;
  motor: Motor;
  revision: Revision;
  favorita: boolean;
  error?: string;
}

export interface Ajustes {
  /** ID de cliente OAuth de Google (tipo «Aplicación web»). */
  googleClientId: string;
  /** Clave de la API de Claude. Se guarda solo en este dispositivo. */
  anthropicApiKey: string;
  modelo: string;
  usarIA: boolean;
  /** Cuánto esfuerzo dedica el modelo a cada foto (coste frente a precisión). */
  precision: 'rapida' | 'equilibrada' | 'maxima';
  /** Por debajo de este valor la foto va a la cola de revisión. */
  umbralConfianza: number;
  plantillaNombre: string;
  /** Opción preseleccionada al compartir: con ficha o solo la imagen. */
  compartirConFicha: boolean;
  /** Cuántas fotos se analizan a la vez. */
  concurrencia: number;
  /** Ocultar en la galería lo que el clasificador ha descartado. */
  ocultarDescartadas: boolean;
  /** Lado mayor (px) de la copia que se guarda. Solo afecta a las fotos:
   *  los vídeos se guardan tal cual, sin recomprimir. */
  tamanoMaximo: number;
  /** Tipos creados a mano, además de los que trae la app. */
  categoriasPropias: CategoriaPropia[];
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '',
  anthropicApiKey: '',
  modelo: 'claude-opus-5',
  usarIA: true,
  precision: 'equilibrada',
  umbralConfianza: 0.6,
  plantillaNombre: '{categoria} - {descripcion} - {fecha}',
  compartirConFicha: true,
  concurrencia: 3,
  ocultarDescartadas: true,
  tamanoMaximo: 2048,
  categoriasPropias: [],
};

export interface ResultadoClasificacion {
  entraEnCatalogo: boolean;
  confianza: number;
  categoria: string;
  categoriaAlternativa?: string;
  tecnica?: string;
  materiales: string[];
  colores: string[];
  etiquetas: string[];
  descripcion: string;
  motivo?: string;
  motor: Exclude<Motor, null>;
}

export interface ProgresoAnalisis {
  activo: boolean;
  hechas: number;
  total: number;
  actual?: string;
  errores: number;
}
