import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Foto } from '../types';
import { CATEGORIAS, categoria, NO_MANUALIDAD, SIN_CLASIFICAR } from '../taxonomy';
import { useTienda } from '../state/store';
import { nombreDesdePlantilla } from '../lib/naming';
import { compartirFotos, descargarFoto } from '../lib/share';
import { BotonCerrar, ImagenFoto, formatearBytes, formatearFecha } from './comunes';
import {
  IconoAtras, IconoChispa, IconoCompartir, IconoDescargar, IconoEstrella,
  IconoLapiz, IconoPapelera, IconoSiguiente,
} from './Icons';

interface Borrador {
  nombre: string;
  categoria: string;
  descripcion: string;
  tecnica: string;
  etiquetas: string;
}

function aBorrador(foto: Foto): Borrador {
  return {
    nombre: foto.nombre,
    categoria: foto.categoria,
    descripcion: foto.descripcion ?? '',
    tecnica: foto.tecnica ?? '',
    etiquetas: foto.etiquetas.join(', '),
  };
}

interface Props {
  foto: Foto;
  /** Fotos entre las que moverse con las flechas, en el orden en que se ven. */
  contexto: Foto[];
  alCerrar(): void;
  alCambiarFoto(foto: Foto): void;
}

export function DetalleFoto({ foto, contexto, alCerrar, alCambiarFoto }: Props) {
  const { ajustes, actualizarFoto, eliminarFotos, analizar, avisar } = useTienda();
  const [borrador, setBorrador] = useState<Borrador>(() => aBorrador(foto));
  const [ocupado, setOcupado] = useState(false);
  const ultimoGuardado = useRef(foto.id);

  useEffect(() => {
    setBorrador(aBorrador(foto));
    ultimoGuardado.current = foto.id;
  }, [foto]);

  const indice = contexto.findIndex((f) => f.id === foto.id);
  const anterior = indice > 0 ? contexto[indice - 1] : null;
  const siguiente = indice >= 0 && indice < contexto.length - 1 ? contexto[indice + 1] : null;

  const guardar = useCallback(
    async (parcial: Partial<Borrador> = {}) => {
      const datos = { ...borrador, ...parcial };
      const etiquetas = datos.etiquetas
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      const nombre = datos.nombre.trim() || foto.archivoOriginal.replace(/\.[^.]+$/, '');
      const cambios: Foto = {
        ...foto,
        nombre,
        // Si la persona escribe el nombre, la plantilla deja de sobrescribirlo.
        nombreEditado: foto.nombreEditado || nombre !== foto.nombre,
        categoria: datos.categoria,
        descripcion: datos.descripcion.trim() || undefined,
        tecnica: datos.tecnica.trim() || undefined,
        etiquetas,
      };

      // Cambiar de categoría a mano es una decisión humana: cuenta como revisión.
      if (datos.categoria !== foto.categoria) {
        cambios.revision = datos.categoria === NO_MANUALIDAD ? 'descartada' : 'confirmada';
        cambios.esManualidad = datos.categoria !== NO_MANUALIDAD;
        cambios.motor = 'manual';
        cambios.confianza = 1;
      }

      const sinCambios =
        cambios.nombre === foto.nombre &&
        cambios.categoria === foto.categoria &&
        cambios.descripcion === foto.descripcion &&
        cambios.tecnica === foto.tecnica &&
        cambios.etiquetas.join(',') === foto.etiquetas.join(',');

      if (sinCambios) return;
      await actualizarFoto(cambios);
    },
    [borrador, foto, actualizarFoto],
  );

  const cerrarGuardando = useCallback(() => {
    void guardar();
    alCerrar();
  }, [guardar, alCerrar]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const enCampo = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') cerrarGuardando();
      if (enCampo) return;
      if (e.key === 'ArrowLeft' && anterior) alCambiarFoto(anterior);
      if (e.key === 'ArrowRight' && siguiente) alCambiarFoto(siguiente);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [cerrarGuardando, anterior, siguiente, alCambiarFoto]);

  const nombreSugerido = useMemo(
    () => nombreDesdePlantilla({ ...foto, categoria: borrador.categoria, descripcion: borrador.descripcion, tecnica: borrador.tecnica }, ajustes.plantillaNombre),
    [foto, borrador.categoria, borrador.descripcion, borrador.tecnica, ajustes.plantillaNombre],
  );

  const conAccion = async (accion: () => Promise<void>) => {
    setOcupado(true);
    try {
      await accion();
    } catch (error) {
      avisar(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const cat = categoria(foto.categoria);

  return (
    <div
      className="velo"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${foto.nombre}`}
      onClick={(e) => e.target === e.currentTarget && cerrarGuardando()}
    >
      <div className="hoja">
        <div className="hoja__barra">
          <button
            type="button"
            className="boton boton--fantasma"
            onClick={() => anterior && alCambiarFoto(anterior)}
            disabled={!anterior}
            aria-label="Foto anterior"
          >
            <IconoAtras className="boton__icono" />
          </button>
          <button
            type="button"
            className="boton boton--fantasma"
            onClick={() => siguiente && alCambiarFoto(siguiente)}
            disabled={!siguiente}
            aria-label="Foto siguiente"
          >
            <IconoSiguiente className="boton__icono" />
          </button>
          <span className="hoja__titulo">{foto.nombre}</span>
          <button
            type="button"
            className="boton boton--fantasma"
            aria-pressed={foto.favorita}
            aria-label={foto.favorita ? 'Quitar de favoritas' : 'Marcar como favorita'}
            onClick={() => void actualizarFoto({ ...foto, favorita: !foto.favorita })}
          >
            <IconoEstrella relleno={foto.favorita} className="boton__icono" />
          </button>
          <BotonCerrar alPulsar={cerrarGuardando} />
        </div>

        <div className="hoja__cuerpo">
          <div className="visor">
            <ImagenFoto id={foto.id} alt={foto.nombre} tamano="completa" />
          </div>

          <div>
            <label className="campo">
              <span className="campo__etiqueta">Nombre de la foto</span>
              <input
                className="entrada"
                value={borrador.nombre}
                onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                onBlur={() => void guardar()}
                placeholder="Escribe un nombre"
              />
              <span className="campo__ayuda">
                Es el nombre que se usa al compartir y al exportar.
                {nombreSugerido !== borrador.nombre && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="boton boton--fantasma boton--pequeno"
                      onClick={() => {
                        setBorrador({ ...borrador, nombre: nombreSugerido });
                        void guardar({ nombre: nombreSugerido });
                      }}
                    >
                      <IconoLapiz className="boton__icono" />
                      Usar «{nombreSugerido}»
                    </button>
                  </>
                )}
              </span>
            </label>

            <label className="campo">
              <span className="campo__etiqueta">Tipo de manualidad</span>
              <select
                className="seleccion"
                value={borrador.categoria}
                onChange={(e) => {
                  setBorrador({ ...borrador, categoria: e.target.value });
                  void guardar({ categoria: e.target.value });
                }}
              >
                {foto.categoria === SIN_CLASIFICAR && <option value={SIN_CLASIFICAR}>⏳ Sin clasificar</option>}
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>
                ))}
                <option value={NO_MANUALIDAD}>🚫 No es una manualidad</option>
              </select>
              {foto.categoriaAlternativa && (
                <span className="campo__ayuda">
                  Alternativa sugerida: {categoria(foto.categoriaAlternativa).nombre}.{' '}
                  <button
                    type="button"
                    className="boton boton--fantasma boton--pequeno"
                    onClick={() => {
                      const alternativa = foto.categoriaAlternativa!;
                      setBorrador({ ...borrador, categoria: alternativa });
                      void guardar({ categoria: alternativa });
                    }}
                  >
                    Cambiar
                  </button>
                </span>
              )}
            </label>

            <label className="campo">
              <span className="campo__etiqueta">Descripción</span>
              <input
                className="entrada"
                value={borrador.descripcion}
                onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
                onBlur={() => void guardar()}
                placeholder="p. ej. colgante de pared beige"
              />
            </label>

            <label className="campo">
              <span className="campo__etiqueta">Técnica</span>
              <input
                className="entrada"
                value={borrador.tecnica}
                onChange={(e) => setBorrador({ ...borrador, tecnica: e.target.value })}
                onBlur={() => void guardar()}
                placeholder="p. ej. nudo plano"
              />
            </label>

            <label className="campo">
              <span className="campo__etiqueta">Etiquetas</span>
              <input
                className="entrada"
                value={borrador.etiquetas}
                onChange={(e) => setBorrador({ ...borrador, etiquetas: e.target.value })}
                onBlur={() => void guardar()}
                placeholder="separadas por comas"
              />
            </label>

            <div className="datos" style={{ margin: '16px 0' }}>
              {foto.materiales.length > 0 && (
                <div className="dato">
                  <span className="dato__clave">Materiales</span>
                  <span className="dato__valor">{foto.materiales.join(', ')}</span>
                </div>
              )}
              {foto.colores.length > 0 && (
                <div className="dato">
                  <span className="dato__clave">Colores</span>
                  <span className="dato__valor">{foto.colores.join(', ')}</span>
                </div>
              )}
              <div className="dato">
                <span className="dato__clave">Clasificación</span>
                <span className="dato__valor">
                  {cat.emoji} {cat.nombre}
                  {foto.motor && ` · ${{ ia: 'modelo de visión', heuristico: 'análisis local', manual: 'a mano' }[foto.motor]}`}
                  {foto.motor !== 'manual' && foto.estado === 'listo' && ` · ${Math.round(foto.confianza * 100)} % de confianza`}
                </span>
              </div>
              {foto.motivo && (
                <div className="dato">
                  <span className="dato__clave">Motivo</span>
                  <span className="dato__valor">{foto.motivo}</span>
                </div>
              )}
              <div className="dato">
                <span className="dato__clave">Archivo</span>
                <span className="dato__valor">
                  {foto.archivoOriginal} · {foto.ancho}×{foto.alto} · {formatearBytes(foto.bytes)}
                </span>
              </div>
              <div className="dato">
                <span className="dato__clave">Fecha</span>
                <span className="dato__valor">
                  {formatearFecha(foto.fecha)} · {foto.origen === 'google' ? 'Google Fotos' : 'Archivo local'}
                </span>
              </div>
              {foto.error && (
                <div className="dato">
                  <span className="dato__clave">Error</span>
                  <span className="dato__valor" style={{ color: 'var(--error)' }}>{foto.error}</span>
                </div>
              )}
            </div>

            <div className="grupo-botones">
              <button
                type="button"
                className="boton boton--primario"
                disabled={ocupado}
                onClick={() =>
                  conAccion(async () => {
                    await guardar();
                    const resultado = await compartirFotos([foto]);
                    if (resultado === 'descargado') {
                      avisar('Este dispositivo no permite compartir archivos: la foto se ha descargado.');
                    }
                  })
                }
              >
                <IconoCompartir className="boton__icono" />
                Compartir
              </button>
              <button
                type="button"
                className="boton"
                disabled={ocupado}
                onClick={() => conAccion(async () => { await guardar(); await descargarFoto(foto); })}
              >
                <IconoDescargar className="boton__icono" />
                Descargar
              </button>
              <button
                type="button"
                className="boton"
                disabled={ocupado}
                onClick={() => void analizar([foto])}
              >
                <IconoChispa className="boton__icono" />
                Volver a analizar
              </button>
              <button
                type="button"
                className="boton boton--peligro"
                disabled={ocupado}
                onClick={() => {
                  if (!confirm(`¿Eliminar «${foto.nombre}» del catálogo de este dispositivo?\n\nLa foto seguirá en Google Fotos.`)) return;
                  void conAccion(async () => {
                    await eliminarFotos([foto.id]);
                    alCerrar();
                  });
                }}
              >
                <IconoPapelera className="boton__icono" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
