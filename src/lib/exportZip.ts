import JSZip from 'jszip';
import type { Foto } from '../types';
import { categoria } from '../taxonomy';
import { obtenerCompleta } from './db';
import { extensionDe, limpiarNombre } from './naming';
import { descargarBlob } from './share';

export interface OpcionesExportacion {
  /** Crear una carpeta por tipo de manualidad. */
  porCategoria: boolean;
  incluirCatalogo: boolean;
  alProgresar?(hechas: number, total: number): void;
}

function fila(valores: string[]): string {
  return valores.map((v) => `"${v.replace(/"/g, '""')}"`).join(',') + '\n';
}

function csv(fotos: Foto[], rutas: Map<string, string>): string {
  // BOM para que Excel abra los acentos correctamente.
  let salida = '﻿';
  salida += fila([
    'Archivo', 'Nombre', 'Categoría', 'Técnica', 'Materiales', 'Colores',
    'Etiquetas', 'Descripción', 'Fecha', 'Confianza', 'Revisión', 'Origen',
  ]);
  for (const foto of fotos) {
    salida += fila([
      rutas.get(foto.id) ?? '',
      foto.nombre,
      categoria(foto.categoria).nombre,
      foto.tecnica ?? '',
      foto.materiales.join(', '),
      foto.colores.join(', '),
      foto.etiquetas.join(', '),
      foto.descripcion ?? '',
      foto.fecha.slice(0, 10),
      foto.confianza.toFixed(2),
      foto.revision,
      foto.origen === 'google' ? 'Google Fotos' : 'Archivo local',
    ]);
  }
  return salida;
}

/** Empaqueta las fotos en un ZIP y lo descarga. */
export async function exportarZip(fotos: Foto[], opciones: OpcionesExportacion): Promise<number> {
  if (!fotos.length) throw new Error('No hay fotos que exportar.');

  const zip = new JSZip();
  const rutas = new Map<string, string>();
  const usadas = new Set<string>();
  let hechas = 0;
  let incluidas = 0;

  for (const foto of fotos) {
    const blob = await obtenerCompleta(foto.id);
    hechas += 1;
    opciones.alProgresar?.(hechas, fotos.length);
    if (!blob) continue;

    const carpeta = opciones.porCategoria
      ? `${limpiarNombre(categoria(foto.categoria).nombre)}/`
      : '';
    const base = limpiarNombre(foto.nombre) || 'manualidad';
    const extension = extensionDe(foto);

    let ruta = `${carpeta}${base}.${extension}`;
    for (let i = 2; usadas.has(ruta.toLowerCase()); i += 1) {
      ruta = `${carpeta}${base} (${i}).${extension}`;
    }
    usadas.add(ruta.toLowerCase());
    rutas.set(foto.id, ruta);

    zip.file(ruta, blob);
    incluidas += 1;
  }

  if (!incluidas) throw new Error('No se ha encontrado ninguna imagen guardada para exportar.');

  if (opciones.incluirCatalogo) {
    const conImagen = fotos.filter((f) => rutas.has(f.id));
    zip.file('catalogo.csv', csv(conImagen, rutas));
    zip.file(
      'catalogo.json',
      JSON.stringify(
        {
          generado: new Date().toISOString(),
          aplicacion: 'Fotos Arima',
          fotos: conImagen.map((f) => ({ ...f, archivo: rutas.get(f.id) })),
        },
        null,
        2,
      ),
    );
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  const sello = new Date().toISOString().slice(0, 10);
  descargarBlob(blob, `manualidades-${sello}.zip`);
  return incluidas;
}

/** Copia de seguridad de las fichas (sin imágenes), para pasar de un equipo a otro. */
export function exportarFichas(fotos: Foto[]): void {
  const datos = JSON.stringify({ version: 1, generado: new Date().toISOString(), fotos }, null, 2);
  descargarBlob(
    new Blob([datos], { type: 'application/json' }),
    `fotos-arima-fichas-${new Date().toISOString().slice(0, 10)}.json`,
  );
}
