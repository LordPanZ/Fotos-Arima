import { useEffect, useMemo, useState } from 'react';
import type { Foto } from '../types';
import { listaCategorias, NO_MANUALIDAD, SIN_CLASIFICAR, categoria } from '../taxonomy';
import { hayClaveIA, necesitaRevision } from '../lib/classifier';
import { nombreDesdePlantilla } from '../lib/naming';
import { useTienda } from '../state/store';
import { AvisoLinea, ImagenFoto, Vacio } from '../components/comunes';
import { CrearTipoRapido } from '../components/CategoriasPropias';
import { IconoChispa, IconoComprobado, IconoSiguiente, IconoVeto } from '../components/Icons';

export function Revisar({ alIrAImportar }: { alIrAImportar(): void }) {
  const tienda = useTienda();
  const { fotos, ajustes } = tienda;

  const [saltadas, setSaltadas] = useState<Set<string>>(new Set());
  const [elegida, setElegida] = useState<string | null>(null);

  const cola = useMemo(
    () =>
      fotos
        .filter((f) => necesitaRevision(f, ajustes.umbralConfianza) && !saltadas.has(f.id))
        .sort((a, b) => b.confianza - a.confianza),
    [fotos, ajustes.umbralConfianza, saltadas],
  );

  const actual: Foto | undefined = cola[0];

  // Al cambiar de foto arrancamos con la sugerencia del clasificador.
  useEffect(() => {
    setElegida(actual && actual.categoria !== SIN_CLASIFICAR ? actual.categoria : null);
  }, [actual?.id, actual?.categoria]);

  const conError = fotos.filter((f) => f.estado === 'error');

  if (!actual) {
    return (
      <>
        <h1 style={{ marginBottom: 14 }}>Revisar</h1>
        {saltadas.size > 0 ? (
          <Vacio
            emoji="👌"
            titulo="No queda nada por revisar"
            accion={
              <button type="button" className="boton" onClick={() => setSaltadas(new Set())}>
                Volver a ver las {saltadas.size} que salté
              </button>
            }
          >
            Has puesto tipo a todas las de esta ronda.
          </Vacio>
        ) : fotos.length === 0 ? (
          <Vacio
            emoji="🧶"
            titulo="Todavía no hay fotos"
            accion={
              <button type="button" className="boton boton--primario" onClick={alIrAImportar}>
                Importar fotos
              </button>
            }
          >
            Importa fotos y aquí irán apareciendo las que estén esperando un tipo.
          </Vacio>
        ) : (
          <Vacio emoji="✅" titulo="Todas tienen tipo">
            No hay ninguna foto esperando. Cuando importes más, aparecerán aquí.
          </Vacio>
        )}

        {conError.length > 0 && (
          <div className="tarjeta" style={{ marginTop: 16 }}>
            <h2 style={{ marginBottom: 6 }}>{conError.length} fotos con error</h2>
            <p className="tarjeta__ayuda">{conError[0].error}</p>
            {hayClaveIA(ajustes) && (
              <button
                type="button"
                className="boton"
                onClick={() => void tienda.analizar(conError)}
              >
                <IconoChispa className="boton__icono" />
                Reintentar
              </button>
            )}
          </div>
        )}
      </>
    );
  }

  const decidir = async (destino: string | null) => {
    const esDescarte = destino === null || destino === NO_MANUALIDAD;
    const categoriaFinal = esDescarte ? NO_MANUALIDAD : destino;

    const actualizada: Foto = {
      ...actual,
      categoria: categoriaFinal,
      entraEnCatalogo: !esDescarte,
      revision: esDescarte ? 'descartada' : 'confirmada',
      confianza: 1,
      motor: 'manual',
    };

    if (!actualizada.nombreEditado && !esDescarte) {
      actualizada.nombre = nombreDesdePlantilla(actualizada, ajustes.plantillaNombre);
    }

    await tienda.actualizarFoto(actualizada);
  };

  const sugerida = actual.categoria !== SIN_CLASIFICAR ? categoria(actual.categoria) : null;
  const restantes = cola.length;

  return (
    <div className="revision">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <h1>Revisar</h1>
        <span style={{ color: 'var(--texto-2)', fontSize: '0.86rem' }}>
          {restantes} {restantes === 1 ? 'foto esperando tipo' : 'fotos esperando tipo'}
        </span>
      </div>

      {restantes > 3 && (
        <AvisoLinea>
          Si estas fotos son de un mismo taller, en el <strong>Catálogo</strong> puedes
          seleccionarlas y usar <strong>Rellenar ficha</strong> para ponerles el título y el tipo a
          todas de una vez, en lugar de ir una a una.
        </AvisoLinea>
      )}

      <div className="revision__marco">
        <ImagenFoto key={actual.id} id={actual.id} alt={actual.nombre} tamano="completa" />
      </div>

      <div className="revision__sugerencia">
        <span aria-hidden="true" style={{ fontSize: '1.15rem' }}>{sugerida?.emoji ?? '🏷️'}</span>
        <div>
          {sugerida ? (
            <>
              Propuesta del modelo de visión: <strong>{sugerida.nombre}</strong>, con un{' '}
              {Math.round(actual.confianza * 100)} % de confianza. Cámbiala si no es esa.
            </>
          ) : (
            <><strong>{actual.nombre || actual.archivoOriginal}</strong> — elige su tipo abajo.</>
          )}
          {actual.motivo && <div style={{ color: 'var(--texto-2)', marginTop: 2 }}>{actual.motivo}</div>}
        </div>
      </div>

      <div className="revision__acciones">
        <button
          type="button"
          className="boton boton--primario"
          disabled={!elegida}
          onClick={() => void decidir(elegida)}
        >
          <IconoComprobado className="boton__icono" />
          {elegida ? `Sí: ${categoria(elegida).nombre}` : 'Elige un tipo abajo'}
        </button>
        <button type="button" className="boton boton--peligro" onClick={() => void decidir(null)}>
          <IconoVeto className="boton__icono" />
          No entra en el catálogo
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          className="boton boton--fantasma boton--ancho"
          onClick={() => setSaltadas(new Set([...saltadas, actual.id]))}
        >
          Saltar por ahora
          <IconoSiguiente className="boton__icono" />
        </button>
      </div>

      <h3 style={{ marginBottom: 8 }}>Categoría</h3>
      <div className="rejilla-categorias">
        {listaCategorias().map((c) => (
          <button
            key={c.id}
            type="button"
            className="opcion-categoria"
            aria-pressed={elegida === c.id}
            onClick={() => setElegida(c.id)}
          >
            <span aria-hidden="true">{c.emoji}</span>
            {c.nombre}
          </button>
        ))}
        <CrearTipoRapido alCrear={setElegida} />
      </div>
    </div>
  );
}
