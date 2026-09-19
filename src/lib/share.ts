import type { Foto } from '../types';
import { categoria, esActividad } from '../taxonomy';
import { obtenerCompleta } from './db';
import { nombreArchivo } from './naming';

export type ResultadoCompartir = 'compartido' | 'cancelado' | 'no-soportado';

export interface OpcionesCompartir {
  /** `false` envía solo las imágenes, sin nombre ni ficha como texto. */
  conFicha: boolean;
}

/** ¿Puede este dispositivo abrir el menú de compartir con archivos adjuntos? */
export function puedeCompartirArchivos(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
  try {
    const prueba = new File([new Blob([''], { type: 'image/jpeg' })], 'p.jpg', { type: 'image/jpeg' });
    return navigator.canShare({ files: [prueba] });
  } catch {
    return false;
  }
}

async function comoArchivos(fotos: Foto[]): Promise<File[]> {
  const archivos: File[] = [];
  const usados = new Set<string>();

  for (const foto of fotos) {
    const blob = await obtenerCompleta(foto.id);
    if (!blob) continue;

    let nombre = nombreArchivo(foto);
    for (let i = 2; usados.has(nombre.toLowerCase()); i += 1) {
      nombre = nombreArchivo({ ...foto, nombre: `${foto.nombre} (${i})` });
    }
    usados.add(nombre.toLowerCase());

    archivos.push(new File([blob], nombre, { type: foto.tipoMime || blob.type }));
  }
  return archivos;
}

export function textoDeCompartir(fotos: Foto[]): { title: string; text: string } {
  if (fotos.length === 1) {
    const foto = fotos[0];
    const cat = categoria(foto.categoria);
    const partes = [foto.nombre, `${cat.emoji} ${cat.nombre}`];
    if (foto.tecnica) partes.push(`${esActividad(foto.categoria) ? 'Escena' : 'Técnica'}: ${foto.tecnica}`);
    if (foto.materiales.length) partes.push(`Materiales: ${foto.materiales.join(', ')}`);
    return { title: foto.nombre, text: partes.join('\n') };
  }

  const categorias = [...new Set(fotos.map((f) => categoria(f.categoria).nombre))];
  return {
    title: `${fotos.length} fotos de Arima`,
    text: `${fotos.length} fotos — ${categorias.join(', ')}`,
  };
}

/**
 * Abre el menú de compartir del sistema con las fotos adjuntas.
 *
 * Devuelve `no-soportado` cuando el dispositivo no puede compartir archivos, en
 * vez de descargarlos por su cuenta: qué hacer entonces (descargar una a una o
 * generar un ZIP) depende de cuántas sean, y esa decisión es de la interfaz.
 */
export async function compartirFotos(
  fotos: Foto[],
  opciones: OpcionesCompartir,
): Promise<ResultadoCompartir> {
  if (!fotos.length) return 'cancelado';

  const archivos = await comoArchivos(fotos);
  if (!archivos.length) throw new Error('No se han encontrado las imágenes en este dispositivo.');

  if (!navigator.share || !navigator.canShare?.({ files: archivos })) return 'no-soportado';

  // Sin ficha se envían solo los archivos: ni título ni texto, para que en
  // WhatsApp o el correo no aparezca ningún mensaje escrito por la app.
  const carga: ShareData = opciones.conFicha
    ? { files: archivos, ...textoDeCompartir(fotos) }
    : { files: archivos };

  try {
    await navigator.share(carga);
    return 'compartido';
  } catch (error) {
    // `AbortError` = la persona ha cerrado el menú. No es un fallo.
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelado';
    return 'no-soportado';
  }
}

/** Descarga las fotos una a una. Reserva para cuando no se puede compartir. */
export async function descargarFotos(fotos: Foto[]): Promise<number> {
  const archivos = await comoArchivos(fotos);
  for (const archivo of archivos) descargarBlob(archivo, archivo.name);
  return archivos.length;
}

export function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Damos margen al navegador para iniciar la descarga antes de liberar la URL.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function descargarFoto(foto: Foto): Promise<void> {
  const blob = await obtenerCompleta(foto.id);
  if (!blob) throw new Error('No se ha encontrado la imagen en este dispositivo.');
  descargarBlob(blob, nombreArchivo(foto));
}

/** Copia la ficha de la foto como texto, para pegarla en un mensaje o correo. */
export async function copiarFicha(fotos: Foto[]): Promise<void> {
  const lineas = fotos.map((foto) => {
    const cat = categoria(foto.categoria);
    const extras = [foto.tecnica, foto.materiales.join(', ')].filter(Boolean).join(' · ');
    return `• ${foto.nombre} — ${cat.nombre}${extras ? ` (${extras})` : ''}`;
  });
  await navigator.clipboard.writeText(lineas.join('\n'));
}
