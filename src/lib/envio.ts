import JSZip from 'jszip';

/**
 * Formato de intercambio entre el formulario «Tailerren Argazkiak Arima» y la
 * aplicación: un ZIP con un `envio.json` y las fotos.
 *
 * Es el mismo paquete tanto si viaja por el buzón (Supabase) como si se manda
 * por WhatsApp, así que solo hay un formato que mantener y una sola rutina de
 * lectura en la app.
 */

export const VERSION_ENVIO = 1;
export const EXTENSION_ENVIO = '.arima.zip';
const NOMBRE_MANIFIESTO = 'envio.json';

export interface FotoDeEnvio {
  archivo: string;
  tipoMime: string;
  bytes: number;
}

export interface ManifiestoEnvio {
  version: number;
  id: string;
  titulo: string;
  /** Fecha del evento en formato AAAA-MM-DD. */
  fecha: string;
  lugar: string;
  monitor?: string;
  notas?: string;
  creadoEl: string;
  fotos: FotoDeEnvio[];
}

export interface DatosFormulario {
  titulo: string;
  fecha: string;
  lugar: string;
  monitor?: string;
  notas?: string;
}

export interface EnvioLeido {
  manifiesto: ManifiestoEnvio;
  fotos: Array<{ nombre: string; blob: Blob }>;
}

export function nuevoIdEnvio(): string {
  return `env-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanear(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
}

/** Nombre del archivo que descarga o comparte el monitor. */
export function nombreDeEnvio(datos: DatosFormulario): string {
  const partes = [datos.fecha, sanear(datos.titulo) || 'taller'].filter(Boolean);
  return `${partes.join('-')}${EXTENSION_ENVIO}`;
}

/**
 * Las fotos se guardan dentro del ZIP con un nombre correlativo y estable.
 * Los nombres que trae el móvil se repiten mucho (IMG_0001) y a veces llevan
 * caracteres que rompen al descomprimir en otro sistema.
 */
export function nombreInterno(indice: number, archivo: File): string {
  const extension = archivo.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? 'jpg';
  return `fotos/${String(indice + 1).padStart(3, '0')}.${extension}`;
}

export async function empaquetarEnvio(
  datos: DatosFormulario,
  archivos: File[],
  alProgresar?: (hechas: number, total: number) => void,
): Promise<{ blob: Blob; nombre: string; manifiesto: ManifiestoEnvio }> {
  if (!archivos.length) throw new Error('No hay ninguna foto que enviar.');

  const zip = new JSZip();
  const fotos: FotoDeEnvio[] = [];

  archivos.forEach((archivo, indice) => {
    const nombre = nombreInterno(indice, archivo);
    zip.file(nombre, archivo);
    fotos.push({ archivo: nombre, tipoMime: archivo.type || 'image/jpeg', bytes: archivo.size });
    alProgresar?.(indice + 1, archivos.length);
  });

  const manifiesto: ManifiestoEnvio = {
    version: VERSION_ENVIO,
    id: nuevoIdEnvio(),
    titulo: datos.titulo.trim(),
    fecha: datos.fecha,
    lugar: datos.lugar.trim(),
    monitor: datos.monitor?.trim() || undefined,
    notas: datos.notas?.trim() || undefined,
    creadoEl: new Date().toISOString(),
    fotos,
  };

  zip.file(NOMBRE_MANIFIESTO, JSON.stringify(manifiesto, null, 2));

  // `STORE`: las fotos ya vienen comprimidas, así que recomprimir solo gasta
  // batería y tiempo en el móvil del monitor.
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return { blob, nombre: nombreDeEnvio(datos), manifiesto };
}

function validarManifiesto(datos: unknown): ManifiestoEnvio {
  const m = datos as Partial<ManifiestoEnvio> | null;
  if (!m || typeof m !== 'object') throw new Error('El envío no tiene datos legibles.');
  if (typeof m.titulo !== 'string' || !m.titulo) throw new Error('Al envío le falta el título.');
  if (typeof m.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)) {
    throw new Error('La fecha del envío no tiene un formato válido.');
  }
  if (!Array.isArray(m.fotos)) throw new Error('El envío no trae la lista de fotos.');
  if (typeof m.version === 'number' && m.version > VERSION_ENVIO) {
    throw new Error(
      'Este envío se creó con una versión más nueva del formulario. Actualiza la aplicación.',
    );
  }
  return {
    version: m.version ?? VERSION_ENVIO,
    id: m.id ?? nuevoIdEnvio(),
    titulo: m.titulo,
    fecha: m.fecha,
    lugar: typeof m.lugar === 'string' ? m.lugar : '',
    monitor: typeof m.monitor === 'string' ? m.monitor : undefined,
    notas: typeof m.notas === 'string' ? m.notas : undefined,
    creadoEl: typeof m.creadoEl === 'string' ? m.creadoEl : new Date().toISOString(),
    fotos: m.fotos as FotoDeEnvio[],
  };
}

/** Abre un paquete de envío y devuelve sus datos y sus imágenes. */
export async function leerEnvio(archivo: Blob): Promise<EnvioLeido> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(archivo);
  } catch {
    throw new Error('El archivo no es un envío válido: no se ha podido abrir.');
  }

  const entradaManifiesto = zip.file(NOMBRE_MANIFIESTO);
  if (!entradaManifiesto) {
    throw new Error(
      `El archivo no contiene «${NOMBRE_MANIFIESTO}»: no parece un envío del formulario.`,
    );
  }

  let bruto: unknown;
  try {
    bruto = JSON.parse(await entradaManifiesto.async('string'));
  } catch {
    throw new Error('Los datos del envío están dañados.');
  }
  const manifiesto = validarManifiesto(bruto);

  const fotos: EnvioLeido['fotos'] = [];
  for (const ficha of manifiesto.fotos) {
    const entrada = zip.file(ficha.archivo);
    // Una foto que falte no debe tirar el envío entero: mejor importar el resto.
    if (!entrada) continue;
    fotos.push({
      nombre: ficha.archivo,
      blob: new Blob([await entrada.async('arraybuffer')], { type: ficha.tipoMime || 'image/jpeg' }),
    });
  }

  if (!fotos.length) throw new Error('El envío no contiene ninguna foto legible.');
  return { manifiesto, fotos };
}
