/**
 * Vídeos del catálogo.
 *
 * Un vídeo se guarda tal cual llega —nada de recodificar en el navegador, que
 * sería lentísimo y empeoraría la calidad— y se le saca un fotograma para que
 * la galería tenga algo que enseñar. De ahí que la ficha de un vídeo sea la
 * misma que la de una foto: cambia el `tipoMime` y poco más.
 */

import type { Foto } from '../types';

export const TIPOS_VIDEO = /^video\/(mp4|quicktime|webm|x-matroska|3gpp|ogg)$/i;
export const EXTENSIONES_VIDEO = /\.(mp4|mov|m4v|webm|mkv|3gp|ogv)$/i;

/**
 * Tope por vídeo. El almacén compartido corta en 50 MB por archivo, así que
 * dejar pasar algo mayor sería prometer una subida que va a fallar.
 */
export const LIMITE_VIDEO = 48 * 1024 * 1024;

export function esVideo(foto: Pick<Foto, 'tipoMime'>): boolean {
  return foto.tipoMime.startsWith('video/');
}

export function pareceVideo(archivo: { type?: string; name?: string }): boolean {
  return (
    (archivo.type ?? '').startsWith('video/') ||
    EXTENSIONES_VIDEO.test(archivo.name ?? '')
  );
}

/** «2:07», «0:48». Vacío si no se conoce la duración. */
export function duracionLegible(segundos: number | undefined): string {
  if (!segundos || !Number.isFinite(segundos)) return '';
  const total = Math.round(segundos);
  const minutos = Math.floor(total / 60);
  return `${minutos}:${String(total % 60).padStart(2, '0')}`;
}

export interface DatosVideo {
  ancho: number;
  alto: number;
  duracion: number;
  /** Fotograma de portada, ya como JPEG. */
  miniatura: Blob;
}

function elementoDeVideo(url: string): HTMLVideoElement {
  const video = document.createElement('video');
  // `muted` y `playsInline` son lo que permite a los navegadores móviles
  // decodificar sin interacción de la persona; sin ellos no hay fotograma.
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.crossOrigin = 'anonymous';
  video.src = url;
  return video;
}

function esperar(video: HTMLVideoElement, evento: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => {
      limpiar();
      reject(new Error(`El vídeo no ha respondido a tiempo (${evento}).`));
    }, ms);
    const bien = () => {
      limpiar();
      resolve();
    };
    const mal = () => {
      limpiar();
      reject(new Error('El navegador no sabe leer este vídeo.'));
    };
    function limpiar() {
      clearTimeout(reloj);
      video.removeEventListener(evento, bien);
      video.removeEventListener('error', mal);
    }
    video.addEventListener(evento, bien, { once: true });
    video.addEventListener('error', mal, { once: true });
  });
}

/** Portada de reserva cuando el navegador no da el fotograma. */
async function portadaGenerica(ancho: number, alto: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, ancho || 640);
  canvas.height = Math.max(1, alto || 360);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#2b2622';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#faf7f2';
    ctx.font = `${Math.round(canvas.height / 4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶', canvas.width / 2, canvas.height / 2);
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('No se ha podido generar la portada.'))),
      'image/jpeg',
      0.8,
    );
  });
}

/**
 * Saca medidas, duración y un fotograma de portada.
 * No recodifica el vídeo: el archivo se guarda tal cual llegó.
 */
export async function datosDeVideo(blob: Blob, ladoMiniatura = 512): Promise<DatosVideo> {
  const url = URL.createObjectURL(blob);
  const video = elementoDeVideo(url);

  try {
    await esperar(video, 'loadedmetadata', 20000);
    const ancho = video.videoWidth || 0;
    const alto = video.videoHeight || 0;
    const duracion = Number.isFinite(video.duration) ? video.duration : 0;

    let miniatura: Blob;
    try {
      if (duracion > 0) {
        // Un segundo dentro, o la mitad si es más corto: el primer fotograma
        // suele ser negro o estar movido.
        video.currentTime = Math.min(1, duracion / 2);
        await esperar(video, 'seeked', 15000);
      } else {
        // Sin duración fiable (pasa con lo grabado en el propio navegador) no
        // se puede buscar: basta con esperar a que haya un fotograma.
        if (video.readyState < 2) await esperar(video, 'loadeddata', 15000);
      }

      const escala = Math.min(1, ladoMiniatura / Math.max(ancho || 1, alto || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((ancho || 640) * escala));
      canvas.height = Math.max(1, Math.round((alto || 360) * escala));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Sin lienzo 2D.');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      miniatura = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Sin fotograma.'))),
          'image/jpeg',
          0.78,
        );
      });
    } catch {
      // Algunos formatos (HEVC de iPhone, sobre todo) dan metadatos pero no
      // dejan pintar el fotograma. El vídeo se guarda igual, con portada sosa.
      miniatura = await portadaGenerica(ancho, alto);
    }

    return { ancho, alto, duracion, miniatura };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
