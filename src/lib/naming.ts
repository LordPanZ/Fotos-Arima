import type { Foto } from '../types';
import { categoria } from '../taxonomy';

export interface Token {
  clave: string;
  descripcion: string;
}

export const TOKENS: Token[] = [
  { clave: '{categoria}', descripcion: 'Tipo de manualidad (p. ej. «Macramé y fibras»)' },
  { clave: '{tecnica}', descripcion: 'Técnica detectada (p. ej. «nudo plano»)' },
  { clave: '{descripcion}', descripcion: 'Descripción corta de la pieza' },
  { clave: '{materiales}', descripcion: 'Materiales principales' },
  { clave: '{colores}', descripcion: 'Colores dominantes' },
  { clave: '{evento}', descripcion: 'Título del taller, si vino del formulario' },
  { clave: '{lugar}', descripcion: 'Lugar del taller, si vino del formulario' },
  { clave: '{fecha}', descripcion: 'Fecha de la foto (AAAA-MM-DD)' },
  { clave: '{ano}', descripcion: 'Año de la foto' },
  { clave: '{mes}', descripcion: 'Mes de la foto (01-12)' },
  { clave: '{original}', descripcion: 'Nombre del archivo original, sin extensión' },
  { clave: '{n}', descripcion: 'Número correlativo dentro del grupo' },
];

/** Caracteres que rompen nombres de archivo en Windows, macOS o Android. */
const PROHIBIDOS = /[\\/:*?"<>|\u0000-\u001f]/g;

export function limpiarNombre(texto: string): string {
  return texto
    .replace(PROHIBIDOS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 120)
    .trim();
}

function sinExtension(archivo: string): string {
  return archivo.replace(/\.[^.]+$/, '');
}

export function extensionDe(foto: Foto): string {
  const porMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'video/x-matroska': 'mkv',
    'video/3gpp': '3gp',
    'video/ogg': 'ogv',
  };
  const deArchivo = foto.archivoOriginal.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  return porMime[foto.tipoMime] ?? deArchivo ?? 'jpg';
}

/** Aplica la plantilla a una foto. `indice` alimenta el token `{n}`. */
export function nombreDesdePlantilla(foto: Foto, plantilla: string, indice = 1): string {
  const fecha = new Date(foto.fecha);
  const valida = !Number.isNaN(fecha.getTime());
  const pad = (n: number) => String(n).padStart(2, '0');

  const valores: Record<string, string> = {
    categoria: categoria(foto.categoria).nombre,
    tecnica: foto.tecnica ?? '',
    descripcion: foto.descripcion ?? '',
    materiales: foto.materiales.slice(0, 2).join(' y '),
    evento: foto.evento?.titulo ?? '',
    lugar: foto.evento?.lugar ?? '',
    colores: foto.colores.slice(0, 2).join(' y '),
    fecha: valida ? `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}` : '',
    ano: valida ? String(fecha.getFullYear()) : '',
    mes: valida ? pad(fecha.getMonth() + 1) : '',
    original: sinExtension(foto.archivoOriginal),
    n: String(indice).padStart(2, '0'),
  };

  const resuelto = plantilla.replace(/\{(\w+)\}/g, (coincidencia, clave: string) => {
    const valor = valores[clave.toLowerCase()];
    return valor === undefined ? coincidencia : valor;
  });

  // Un token vacío deja separadores colgando («Macramé -  - 2024»): los quitamos.
  const limpio = limpiarNombre(
    resuelto
      .replace(/\s*[-–—]\s*(?=\s*[-–—])/g, '')
      .replace(/^\s*[-–—]\s*|\s*[-–—]\s*$/g, ''),
  );

  return limpio || sinExtension(foto.archivoOriginal) || 'Manualidad';
}

/**
 * Asegura nombres únicos dentro de un conjunto añadiendo « (2)», « (3)»…
 * `usados` se actualiza en el sitio para poder encadenar llamadas.
 */
export function nombreUnico(base: string, usados: Set<string>): string {
  const clave = base.toLowerCase();
  if (!usados.has(clave)) {
    usados.add(clave);
    return base;
  }
  for (let i = 2; i < 1000; i += 1) {
    const candidato = `${base} (${i})`;
    if (!usados.has(candidato.toLowerCase())) {
      usados.add(candidato.toLowerCase());
      return candidato;
    }
  }
  const respaldo = `${base} (${Date.now()})`;
  usados.add(respaldo.toLowerCase());
  return respaldo;
}

/**
 * Renombra un lote respetando los nombres escritos a mano.
 * Devuelve solo las fotos cuyo nombre cambia.
 */
export function renombrarLote(fotos: Foto[], plantilla: string, forzar = false): Foto[] {
  const porCategoria = new Map<string, number>();
  const usados = new Set<string>();
  const cambios: Foto[] = [];

  const ordenadas = [...fotos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const foto of ordenadas) {
    if (foto.nombreEditado && !forzar) {
      usados.add(foto.nombre.toLowerCase());
      continue;
    }
    const indice = (porCategoria.get(foto.categoria) ?? 0) + 1;
    porCategoria.set(foto.categoria, indice);
    const nombre = nombreUnico(nombreDesdePlantilla(foto, plantilla, indice), usados);
    if (nombre !== foto.nombre) cambios.push({ ...foto, nombre, nombreEditado: false });
  }
  return cambios;
}

export function nombreArchivo(foto: Foto): string {
  return `${limpiarNombre(foto.nombre) || 'manualidad'}.${extensionDe(foto)}`;
}
