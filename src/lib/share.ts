import type { Foto } from '../types';
import { categoria } from '../taxonomy';
import { obtenerCompleta } from './db';
import { nombreArchivo } from './naming';

export type ResultadoCompartir = 'compartido' | 'cancelado' | 'descargado';

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

function textoDeCompartir(fotos: Foto[]): { titulo: string; texto: string } {
  if (fotos.length === 1) {
    const foto = fotos[0];
    const cat = categoria(foto.categoria);
    const partes = [foto.nombre, `${cat.emoji} ${cat.nombre}`];
    if (foto.tecnica) partes.push(`Técnica: ${foto.tecnica}`);
    if (foto.materiales.length) partes.push(`Materiales: ${foto.materiales.join(', ')}`);
    return { titulo: foto.nombre, texto: partes.join('\n') };
  }

  const categorias = [...new Set(fotos.map((f) => categoria(f.categoria).nombre))];
  return {
    titulo: `${fotos.length} manualidades`,
    texto: `${fotos.length} fotos — ${categorias.join(', ')}`,
  };
}

/**
 * Abre el menú de compartir del sistema con las fotos adjuntas.
 * Si el dispositivo no lo admite, las descarga: el resultado dice qué ha pasado
 * para que la interfaz pueda explicarlo.
 */
export async function compartirFotos(fotos: Foto[]): Promise<ResultadoCompartir> {
  if (!fotos.length) return 'cancelado';

  const archivos = await comoArchivos(fotos);
  if (!archivos.length) throw new Error('No se han encontrado las imágenes en este dispositivo.');

  const { titulo, texto } = textoDeCompartir(fotos);

  if (navigator.canShare?.({ files: archivos }) && navigator.share) {
    try {
      await navigator.share({ files: archivos, title: titulo, text: texto });
      return 'compartido';
    } catch (error) {
      // `AbortError` = la persona ha cerrado el menú. No es un fallo.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelado';
      // Cualquier otro problema: seguimos por la vía de la descarga.
    }
  }

  for (const archivo of archivos) descargarBlob(archivo, archivo.name);
  return 'descargado';
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
