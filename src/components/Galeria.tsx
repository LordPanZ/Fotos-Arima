import { useMemo } from 'react';
import type { Foto } from '../types';
import { listaCategorias, categoria } from '../taxonomy';
import { duracionLegible, esVideo } from '../lib/video';
import { necesitaRevision } from '../lib/classifier';
import { ImagenFoto, formatearFecha } from './comunes';
import { IconoComprobado, IconoEstrella } from './Icons';

interface PropsFicha {
  foto: Foto;
  umbral: number;
  elegida: boolean;
  modoSeleccion: boolean;
  /** `false` cuando la cabecera del grupo ya dice de qué tipo es. */
  mostrarCategoria: boolean;
  alAbrir(foto: Foto): void;
  alAlternar(id: string): void;
}

export function FichaFoto({
  foto, umbral, elegida, modoSeleccion, mostrarCategoria, alAbrir, alAlternar,
}: PropsFicha) {
  const cat = categoria(foto.categoria);
  const dudosa = necesitaRevision(foto, umbral);

  return (
    <div className="ficha" data-elegida={elegida}>
      <button
        type="button"
        className="ficha__casilla"
        aria-pressed={elegida}
        aria-label={elegida ? `Quitar «${foto.nombre}» de la selección` : `Añadir «${foto.nombre}» a la selección`}
        onClick={(e) => {
          e.stopPropagation();
          alAlternar(foto.id);
        }}
      >
        {elegida && <IconoComprobado />}
      </button>

      {foto.estado === 'error' ? (
        <span className="insignia insignia--error">Error</span>
      ) : dudosa ? (
        <span className="insignia insignia--duda">Revisar</span>
      ) : foto.favorita ? (
        <span className="insignia insignia--favorita" aria-label="Favorita">★</span>
      ) : null}

      <button
        type="button"
        className="ficha__marco"
        style={{ border: 0, padding: 0, width: '100%', cursor: 'pointer', background: 'var(--fondo-2)' }}
        onClick={() => (modoSeleccion ? alAlternar(foto.id) : alAbrir(foto))}
        aria-label={`Abrir «${foto.nombre}»`}
      >
        <ImagenFoto id={foto.id} alt={foto.nombre} className="ficha__imagen" />
        {esVideo(foto) && (
          <span className="ficha__video" aria-label="Vídeo">
            ▶ {duracionLegible(foto.duracion)}
          </span>
        )}
      </button>

      <div className="ficha__pie">
        <div className="ficha__nombre" title={foto.nombre}>{foto.nombre || foto.archivoOriginal}</div>
        <div className="ficha__meta">
          {mostrarCategoria ? (
            <>
              <span aria-hidden="true">{cat.emoji}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cat.nombre}
              </span>
            </>
          ) : (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {foto.tecnica || formatearFecha(foto.fecha)}
            </span>
          )}
          {foto.favorita && <IconoEstrella relleno style={{ width: 12, height: 12, flex: 'none' }} />}
        </div>
      </div>
    </div>
  );
}

interface PropsRejilla {
  fotos: Foto[];
  umbral: number;
  seleccion: Set<string>;
  modoSeleccion: boolean;
  /** `false` muestra una sola rejilla sin cabeceras de categoría. */
  agrupar: boolean;
  alAbrir(foto: Foto): void;
  alAlternar(id: string): void;
  alSeleccionarGrupo?(ids: string[]): void;
}

/**
 * Orden estable: el de la taxonomía, y dentro de cada grupo por fecha
 * descendente. Se calcula al agrupar, no al cargar el módulo, porque las
 * categorías propias se registran después de leer los ajustes.
 */
function orden(): Map<string, number> {
  return new Map(listaCategorias().map((c, i) => [c.id, i]));
}

export function Rejilla(props: PropsRejilla) {
  const { fotos, agrupar } = props;

  const grupos = useMemo(() => {
    if (!agrupar) return null;
    const porCategoria = new Map<string, Foto[]>();
    for (const foto of fotos) {
      const lista = porCategoria.get(foto.categoria);
      if (lista) lista.push(foto);
      else porCategoria.set(foto.categoria, [foto]);
    }
    const posicion = orden();
    return [...porCategoria.entries()].sort(
      (a, b) => (posicion.get(a[0]) ?? 999) - (posicion.get(b[0]) ?? 999),
    );
  }, [fotos, agrupar]);

  const tarjetas = (lista: Foto[]) => (
    <div className="rejilla">
      {lista.map((foto) => (
        <FichaFoto
          key={foto.id}
          foto={foto}
          umbral={props.umbral}
          elegida={props.seleccion.has(foto.id)}
          modoSeleccion={props.modoSeleccion}
          mostrarCategoria={!agrupar}
          alAbrir={props.alAbrir}
          alAlternar={props.alAlternar}
        />
      ))}
    </div>
  );

  if (!grupos) return tarjetas(fotos);

  return (
    <>
      {grupos.map(([id, lista]) => {
        const cat = categoria(id);
        return (
          <section className="grupo" key={id}>
            <header className="grupo__cabecera" style={{ ['--tono' as string]: cat.color }}>
              <span className="grupo__emoji" aria-hidden="true">{cat.emoji}</span>
              <h2 className="grupo__nombre">{cat.nombre}</h2>
              <span className="grupo__cuenta">{lista.length}</span>
              {props.alSeleccionarGrupo && (
                <button
                  type="button"
                  className="boton boton--fantasma boton--pequeno"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => props.alSeleccionarGrupo?.(lista.map((f) => f.id))}
                >
                  Seleccionar grupo
                </button>
              )}
            </header>
            {tarjetas(lista)}
          </section>
        );
      })}
    </>
  );
}
