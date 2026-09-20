import { useEffect, useState, type ReactNode } from 'react';
import { urlMiniatura } from '../lib/db';
import { obtenerCompleta } from '../lib/sync';
import type { ProgresoAnalisis } from '../types';
import { useTienda } from '../state/store';
import { IconoAviso, IconoCerrar, IconoRefrescar } from './Icons';

/* ------------------------------------------------------------- imágenes */

interface PropsImagen {
  id: string;
  alt: string;
  /** `completa` carga el original guardado; por defecto se usa la miniatura. */
  tamano?: 'miniatura' | 'completa';
  className?: string;
  /**
   * Tipo del archivo guardado. Si es un vídeo y se pide `completa`, en vez de
   * una imagen sale el reproductor. En miniatura siempre es una imagen: lo que
   * se guarda ahí es el fotograma de portada, no el vídeo.
   */
  mime?: string;
}

export function ImagenFoto({ id, alt, tamano = 'miniatura', className, mime }: PropsImagen) {
  const [url, setUrl] = useState<string | null>(null);
  const video = tamano === 'completa' && Boolean(mime?.startsWith('video/'));

  useEffect(() => {
    let vigente = true;
    let propia: string | null = null;

    (async () => {
      if (tamano === 'completa') {
        const blob = await obtenerCompleta(id);
        if (!vigente || !blob) return;
        propia = URL.createObjectURL(blob);
        setUrl(propia);
      } else {
        // Las miniaturas se comparten entre vistas: la caché de `db` las gestiona.
        const cacheada = await urlMiniatura(id);
        if (vigente) setUrl(cacheada);
      }
    })();

    return () => {
      vigente = false;
      if (propia) URL.revokeObjectURL(propia);
    };
  }, [id, tamano]);

  if (!url) return <div className={className} aria-label={alt} />;
  if (video) {
    return (
      <video className={className} src={url} controls playsInline preload="metadata" aria-label={alt} />
    );
  }
  return <img className={className} src={url} alt={alt} loading="lazy" decoding="async" />;
}

/* ------------------------------------------------------------- progreso */

export function BarraProgreso({ progreso, alCancelar }: { progreso: ProgresoAnalisis; alCancelar?: () => void }) {
  if (!progreso.activo) return null;
  const porcentaje = progreso.total ? Math.round((progreso.hechas / progreso.total) * 100) : 0;

  return (
    <div className="progreso">
      <div
        className="progreso__barra"
        role="progressbar"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso del análisis"
      >
        <div className="progreso__relleno" style={{ width: `${porcentaje}%` }} />
      </div>
      <div className="progreso__texto">
        <span className="progreso__actual">
          {progreso.actual ? `Analizando «${progreso.actual}»` : 'Analizando…'}
        </span>
        <span>
          {progreso.hechas}/{progreso.total}
          {progreso.errores > 0 && ` · ${progreso.errores} con error`}
          {alCancelar && (
            <button type="button" className="boton boton--fantasma boton--pequeno" onClick={alCancelar}>
              Cancelar
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- avisos */

export function Avisos() {
  const { avisos, cerrarAviso } = useTienda();
  if (!avisos.length) return null;

  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((aviso) => (
        <div key={aviso.id} className={`aviso aviso--${aviso.tono}`}>
          <span className="aviso__texto">{aviso.texto}</span>
          <button
            type="button"
            className="aviso__cerrar"
            onClick={() => cerrarAviso(aviso.id)}
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- bloques */

export function Vacio({
  emoji,
  titulo,
  children,
  accion,
}: {
  emoji: string;
  titulo: string;
  children?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="vacio">
      <span className="vacio__emoji" aria-hidden="true">{emoji}</span>
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}

export function AvisoLinea({ tono = 'aviso', children }: { tono?: 'aviso' | 'error'; children: ReactNode }) {
  return (
    <div className={`aviso-linea${tono === 'error' ? ' aviso-linea--error' : ''}`}>
      <IconoAviso className="aviso-linea__icono" />
      <div>{children}</div>
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="cargando">
      <IconoRefrescar className="giro" style={{ width: 26, height: 26, marginRight: 10 }} />
      {texto}
    </div>
  );
}

export function BotonCerrar({ alPulsar }: { alPulsar: () => void }) {
  return (
    <button type="button" className="boton boton--fantasma" onClick={alPulsar} aria-label="Cerrar">
      <IconoCerrar className="boton__icono" />
    </button>
  );
}

/* ---------------------------------------------------------------- textos */

export function formatearBytes(bytes: number): string {
  if (!bytes) return '—';
  const unidades = ['B', 'kB', 'MB', 'GB'];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i += 1;
  }
  return `${valor.toFixed(valor >= 10 || i === 0 ? 0 : 1)} ${unidades[i]}`;
}

export function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}
