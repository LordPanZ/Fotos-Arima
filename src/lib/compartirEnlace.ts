/**
 * Repartir el enlace del formulario entre los monitores.
 *
 * WhatsApp es la vía real: `wa.me` abre la aplicación si está instalada y el
 * navegador si no, sin depender de que el dispositivo admita la API de
 * compartir del sistema.
 */

export type ResultadoEnlace = 'compartido' | 'cancelado' | 'copiado' | 'sin-portapapeles';

export function urlDelFormulario(): string {
  return new URL(`${import.meta.env.BASE_URL}formulario/`, window.location.origin).href;
}

export function enlaceWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function abrirWhatsApp(texto: string): void {
  window.open(enlaceWhatsApp(texto), '_blank', 'noopener');
}

/** Menú de compartir del sistema, con el enlace como contenido. */
export async function compartirEnlace(datos: {
  titulo: string;
  texto: string;
  url: string;
}): Promise<ResultadoEnlace> {
  if (navigator.share) {
    try {
      await navigator.share({ title: datos.titulo, text: datos.texto, url: datos.url });
      return 'compartido';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelado';
    }
  }
  return copiarEnlace(`${datos.texto} ${datos.url}`);
}

export async function copiarEnlace(texto: string): Promise<ResultadoEnlace> {
  try {
    await navigator.clipboard.writeText(texto);
    return 'copiado';
  } catch {
    return 'sin-portapapeles';
  }
}

/* --------------------------------------------------- estado de instalación */

export function estaInstalada(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari en iOS no admite `display-mode`, pero marca esto.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function esIOS(): boolean {
  const ua = navigator.userAgent;
  // El iPad moderno se identifica como Mac: la pista es que tiene pantalla táctil.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
