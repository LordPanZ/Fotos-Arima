export type Origen = 'google' | 'local';

export type EstadoAnalisis = 'pendiente' | 'analizando' | 'listo' | 'error';

/** Decisión humana sobre la foto. `auto` = todavía no la ha revisado nadie. */
export type Revision = 'auto' | 'confirmada' | 'descartada';

export type Motor = 'ia' | 'heuristico' | 'manual' | null;

export interface Foto {
  id: string;
  origen: Origen;
  /** Identificador del elemento en Google Fotos, cuando viene de allí. */
  idGoogle?: string;
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
  /** Fecha de captura (ISO). Si no se conoce, la de importación. */
  fecha: string;
  importadaEl: string;

  estado: EstadoAnalisis;
  esManualidad: boolean | null;
  confianza: number;
  categoria: string;
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
  /** Cuántas fotos se analizan a la vez. */
  concurrencia: number;
  /** Ocultar en la galería lo que el clasificador ha descartado. */
  ocultarDescartadas: boolean;
  /** Lado mayor (px) de la copia que se guarda en el dispositivo. */
  tamanoMaximo: number;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '',
  anthropicApiKey: '',
  modelo: 'claude-opus-5',
  usarIA: true,
  precision: 'equilibrada',
  umbralConfianza: 0.6,
  plantillaNombre: '{categoria} - {descripcion} - {fecha}',
  concurrencia: 3,
  ocultarDescartadas: true,
  tamanoMaximo: 2048,
};

export interface ResultadoClasificacion {
  esManualidad: boolean;
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
