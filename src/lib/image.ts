/** Utilidades de imagen: reescalado, miniaturas, base64 y fecha EXIF. */

export interface ImagenReescalada {
  blob: Blob;
  ancho: number;
  alto: number;
}

async function aBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    // `from-image` aplica la rotación EXIF: si no, las fotos verticales del
    // móvil llegan tumbadas al clasificador y a la galería.
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(blob);
  }
}

function lienzo(ancho: number, alto: number): { ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; canvas: HTMLCanvasElement | OffscreenCanvas } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(ancho, alto);
    const ctx = canvas.getContext('2d');
    if (ctx) return { ctx, canvas };
  }
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite dibujar en un lienzo 2D.');
  return { ctx, canvas };
}

async function aBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  tipo: string,
  calidad: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: tipo, quality: calidad });
  }
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))),
      tipo,
      calidad,
    );
  });
}

/**
 * Reescala manteniendo la proporción. Si la imagen ya es menor que
 * `ladoMaximo` se devuelve tal cual (solo se recodifica cuando hace falta).
 */
export async function reescalar(
  blob: Blob,
  ladoMaximo: number,
  calidad = 0.85,
  forzarJpeg = false,
): Promise<ImagenReescalada> {
  const bitmap = await aBitmap(blob);
  const { width, height } = bitmap;
  const escala = Math.min(1, ladoMaximo / Math.max(width, height));

  if (escala === 1 && !forzarJpeg) {
    bitmap.close();
    return { blob, ancho: width, alto: height };
  }

  const ancho = Math.max(1, Math.round(width * escala));
  const alto = Math.max(1, Math.round(height * escala));
  const { ctx, canvas } = lienzo(ancho, alto);
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const tipo = blob.type === 'image/png' && !forzarJpeg ? 'image/png' : 'image/jpeg';
  return { blob: await aBlob(canvas, tipo, calidad), ancho, alto };
}

export async function crearMiniatura(blob: Blob, lado = 512): Promise<Blob> {
  return (await reescalar(blob, lado, 0.78, true)).blob;
}

export async function dimensiones(blob: Blob): Promise<{ ancho: number; alto: number }> {
  const bitmap = await aBitmap(blob);
  const dims = { ancho: bitmap.width, alto: bitmap.height };
  bitmap.close();
  return dims;
}

export async function aBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binario = '';
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo));
  }
  return btoa(binario);
}

/**
 * Lee `DateTimeOriginal` de la cabecera EXIF de un JPEG.
 * Devuelve una fecha ISO o `null` si la foto no la lleva.
 */
export async function fechaExif(blob: Blob): Promise<string | null> {
  if (!blob.type.includes('jpeg')) return null;
  try {
    // La cabecera EXIF vive al principio del archivo: 128 KB sobran.
    const vista = new DataView(await blob.slice(0, 131072).arrayBuffer());
    if (vista.byteLength < 4 || vista.getUint16(0) !== 0xffd8) return null;

    let desplazamiento = 2;
    while (desplazamiento + 4 < vista.byteLength) {
      if (vista.getUint8(desplazamiento) !== 0xff) return null;
      const marcador = vista.getUint8(desplazamiento + 1);
      const longitud = vista.getUint16(desplazamiento + 2);
      if (marcador === 0xe1) {
        const inicio = desplazamiento + 4;
        if (vista.getUint32(inicio) !== 0x45786966) return null; // "Exif"
        return leerTiff(vista, inicio + 6);
      }
      if (marcador === 0xda) return null; // empiezan los datos de imagen
      desplazamiento += 2 + longitud;
    }
  } catch {
    /* una cabecera corrupta no debe impedir importar la foto */
  }
  return null;
}

function leerTiff(vista: DataView, base: number): string | null {
  const orden = vista.getUint16(base);
  const le = orden === 0x4949;
  if (!le && orden !== 0x4d4d) return null;

  const ifd0 = vista.getUint32(base + 4, le);
  const buscarEn = (offsetIfd: number, etiquetaBuscada: number): number | null => {
    const inicio = base + offsetIfd;
    if (inicio + 2 > vista.byteLength) return null;
    const entradas = vista.getUint16(inicio, le);
    for (let i = 0; i < entradas; i += 1) {
      const entrada = inicio + 2 + i * 12;
      if (entrada + 12 > vista.byteLength) break;
      if (vista.getUint16(entrada, le) === etiquetaBuscada) {
        return vista.getUint32(entrada + 8, le);
      }
    }
    return null;
  };

  // 0x8769 = puntero al sub-IFD EXIF; 0x9003 = DateTimeOriginal.
  const subIfd = buscarEn(ifd0, 0x8769);
  const offsetFecha =
    (subIfd !== null ? buscarEn(subIfd, 0x9003) : null) ?? buscarEn(ifd0, 0x0132);
  if (offsetFecha === null) return null;

  const inicioTexto = base + offsetFecha;
  if (inicioTexto + 19 > vista.byteLength) return null;
  let texto = '';
  for (let i = 0; i < 19; i += 1) texto += String.fromCharCode(vista.getUint8(inicioTexto + i));

  // Formato EXIF: "2024:05:12 18:30:00"
  const m = texto.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const fecha = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6]),
  );
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

/** Huella rápida del contenido, para detectar duplicados entre importaciones. */
export async function huella(blob: Blob): Promise<string> {
  const datos = await blob.slice(0, 262144).arrayBuffer();
  const resumen = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(resumen).slice(0, 12)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
