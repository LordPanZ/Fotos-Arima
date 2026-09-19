/**
 * Clasificador local, sin conexión ni clave de API.
 *
 * No pretende reconocer técnicas: para eso está el modelo de visión. Lo que sí
 * hace bien es descartar lo que claramente no es una manualidad (capturas de
 * pantalla, documentos, imágenes ilegibles) y aprovechar el nombre del archivo
 * cuando dice algo útil. Todo lo demás lo manda a la cola de revisión con
 * confianza baja, que es donde debe estar si nadie lo ha mirado.
 */

import { CATEGORIAS, NO_MANUALIDAD, SIN_CLASIFICAR } from '../../taxonomy';
import type { ResultadoClasificacion } from '../../types';

interface Estadisticas {
  brillo: number;
  saturacion: number;
  coloresUnicos: number;
  proporcionPlana: number;
  densidadBordes: number;
  dominantes: Array<[number, number, number]>;
}

const LADO_MUESTRA = 64;

async function estadisticas(blob: Blob): Promise<Estadisticas> {
  const bitmap = await createImageBitmap(blob);
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(LADO_MUESTRA, LADO_MUESTRA)
      : Object.assign(document.createElement('canvas'), { width: LADO_MUESTRA, height: LADO_MUESTRA });
  const ctx = (canvas as HTMLCanvasElement).getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No se puede analizar la imagen en este navegador.');

  ctx.drawImage(bitmap, 0, 0, LADO_MUESTRA, LADO_MUESTRA);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, LADO_MUESTRA, LADO_MUESTRA);

  let sumaBrillo = 0;
  let sumaSaturacion = 0;
  let planos = 0;
  let sumaBordes = 0;
  const cubos = new Map<number, number>();

  const en = (x: number, y: number) => (y * LADO_MUESTRA + x) * 4;

  for (let y = 0; y < LADO_MUESTRA; y += 1) {
    for (let x = 0; x < LADO_MUESTRA; x += 1) {
      const i = en(x, y);
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      sumaBrillo += max / 255;
      sumaSaturacion += max === 0 ? 0 : (max - min) / max;

      // Cuantización a 4 bits por canal: mide la variedad cromática real.
      cubos.set(
        ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4),
        (cubos.get(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)) ?? 0) + 1,
      );

      if (x + 1 < LADO_MUESTRA) {
        const j = en(x + 1, y);
        const diferencia =
          Math.abs(r - data[j]) + Math.abs(g - data[j + 1]) + Math.abs(b - data[j + 2]);
        if (diferencia < 8) planos += 1;
        sumaBordes += Math.min(1, diferencia / 255);
      }
    }
  }

  const pixeles = LADO_MUESTRA * LADO_MUESTRA;
  const vecinos = LADO_MUESTRA * (LADO_MUESTRA - 1);

  const dominantes = [...cubos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([clave]): [number, number, number] => [
      (((clave >> 8) & 0xf) << 4) + 8,
      (((clave >> 4) & 0xf) << 4) + 8,
      ((clave & 0xf) << 4) + 8,
    ]);

  return {
    brillo: sumaBrillo / pixeles,
    saturacion: sumaSaturacion / pixeles,
    coloresUnicos: cubos.size,
    proporcionPlana: planos / vecinos,
    densidadBordes: sumaBordes / vecinos,
    dominantes,
  };
}

const NOMBRES_COLOR: Array<{ nombre: string; rgb: [number, number, number] }> = [
  { nombre: 'blanco', rgb: [245, 245, 245] },
  { nombre: 'negro', rgb: [20, 20, 20] },
  { nombre: 'gris', rgb: [130, 130, 130] },
  { nombre: 'rojo', rgb: [200, 45, 45] },
  { nombre: 'naranja', rgb: [225, 130, 40] },
  { nombre: 'amarillo', rgb: [235, 205, 60] },
  { nombre: 'verde', rgb: [70, 150, 70] },
  { nombre: 'turquesa', rgb: [60, 170, 170] },
  { nombre: 'azul', rgb: [55, 90, 190] },
  { nombre: 'morado', rgb: [130, 70, 170] },
  { nombre: 'rosa', rgb: [225, 140, 175] },
  { nombre: 'marrón', rgb: [125, 85, 55] },
  { nombre: 'beige', rgb: [215, 195, 165] },
];

function nombrarColor([r, g, b]: [number, number, number]): string {
  let mejor = NOMBRES_COLOR[0];
  let distancia = Infinity;
  for (const candidato of NOMBRES_COLOR) {
    const d =
      (r - candidato.rgb[0]) ** 2 + (g - candidato.rgb[1]) ** 2 + (b - candidato.rgb[2]) ** 2;
    if (d < distancia) {
      distancia = d;
      mejor = candidato;
    }
  }
  return mejor.nombre;
}

function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Busca sinónimos de la taxonomía en el nombre del archivo. */
function categoriaPorNombre(archivo: string): { categoria: string; termino: string } | null {
  const limpio = sinAcentos(archivo).replace(/[_\-.]+/g, ' ');
  let mejor: { categoria: string; termino: string } | null = null;

  for (const cat of CATEGORIAS) {
    for (const sinonimo of cat.sinonimos) {
      const termino = sinAcentos(sinonimo);
      if (termino.length < 4) continue;
      if (limpio.includes(termino) && (!mejor || termino.length > mejor.termino.length)) {
        mejor = { categoria: cat.id, termino: sinonimo };
      }
    }
  }
  return mejor;
}

function descripcionDesdeArchivo(archivo: string): string {
  const base = archivo
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // "IMG_20240512_183000" y compañía no describen nada.
  if (/^(img|dsc|pxl|photo|foto|screenshot|captura|whatsapp|image)[\s\d]*$/i.test(base)) return '';
  if (/^\d[\d\s]*$/.test(base)) return '';
  return base.slice(0, 60);
}

export async function clasificarEnLocal(
  imagen: Blob,
  archivo: string,
): Promise<ResultadoClasificacion> {
  const stats = await estadisticas(imagen);
  const colores = stats.dominantes.map(nombrarColor);
  const coloresUnicos = [...new Set(colores)];
  const descripcion = descripcionDesdeArchivo(archivo);

  const base = {
    materiales: [] as string[],
    colores: coloresUnicos,
    etiquetas: [] as string[],
    descripcion,
    motor: 'heuristico' as const,
  };

  // Captura de pantalla: pocos colores y grandes zonas planas.
  if (stats.coloresUnicos < 60 && stats.proporcionPlana > 0.6) {
    return {
      ...base,
      entraEnCatalogo: false,
      confianza: 0.72,
      categoria: NO_MANUALIDAD,
      motivo: 'Parece una captura de pantalla: pocos colores y zonas planas.',
    };
  }

  // Documento o texto sobre fondo claro.
  if (stats.brillo > 0.82 && stats.saturacion < 0.12 && stats.densidadBordes > 0.08) {
    return {
      ...base,
      entraEnCatalogo: false,
      confianza: 0.66,
      categoria: NO_MANUALIDAD,
      motivo: 'Parece un documento o un texto sobre fondo claro.',
    };
  }

  // Imagen prácticamente vacía: ni sirve para el catálogo ni para revisar.
  if (stats.densidadBordes < 0.015 && stats.coloresUnicos < 25) {
    return {
      ...base,
      entraEnCatalogo: false,
      confianza: 0.6,
      categoria: NO_MANUALIDAD,
      motivo: 'La imagen casi no tiene detalle (muy oscura, velada o desenfocada).',
    };
  }

  const porNombre = categoriaPorNombre(archivo);
  if (porNombre) {
    return {
      ...base,
      entraEnCatalogo: true,
      // Nunca llega al umbral por defecto: es una pista, no un veredicto.
      confianza: 0.5,
      categoria: porNombre.categoria,
      etiquetas: [porNombre.termino.toLowerCase()],
      motivo: `El nombre del archivo menciona «${porNombre.termino}».`,
    };
  }

  return {
    ...base,
    entraEnCatalogo: true,
    confianza: 0.25,
    categoria: SIN_CLASIFICAR,
    motivo: 'Sin conexión con el modelo no se puede identificar la técnica: pendiente de revisión.',
  };
}
