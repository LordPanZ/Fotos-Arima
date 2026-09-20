import { useEffect, useMemo, useState } from 'react';
import type { Foto } from '../types';
import { listaCategorias, NO_MANUALIDAD, SIN_CLASIFICAR, categoria } from '../taxonomy';
import { hayClaveIA, necesitaRevision } from '../lib/classifier';
import { nombreDesdePlantilla } from '../lib/naming';
import { useTienda } from '../state/store';
import { AvisoLinea, ImagenFoto, Vacio } from '../components/comunes';
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

  const pendientes = fotos.filter((f) => f.estado === 'pendiente');
  const conError = fotos.filter((f) => f.estado === 'error');

  if (!actual) {
    return (
      <>
        <h1 style={{ marginBottom: 14 }}>Revisar</h1>
        {pendientes.length > 0 ? (
          <Vacio
            emoji="⏳"
            titulo={`${pendientes.length} fotos sin analizar`}
            accion={
              <button
                type="button"
                className="boton boton--primario"
                onClick={() => void tienda.analizar(pendientes)}
              >
                <IconoChispa className="boton__icono" />
                Analizarlas ahora
              </button>
            }
          >
            Analiza las fotos para que la app decida cuáles entran en el catálogo y en qué categoría.
          </Vacio>
        ) : saltadas.size > 0 ? (
          <Vacio
            emoji="👌"
            titulo="No queda nada por revisar"
            accion={
              <button type="button" className="boton" onClick={() => setSaltadas(new Set())}>
                Volver a ver las {saltadas.size} que salté
              </button>
            }
          >
            Has revisado todas las dudosas de esta ronda.
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
            Importa fotos y aquí aparecerán las que el clasificador no tenga claras.
          </Vacio>
        ) : (
          <Vacio emoji="✅" titulo="Todo revisado">
            El clasificador ha decidido con seguridad todas las fotos del catálogo. Si quieres
            afinar más, sube el umbral de confianza en Ajustes y volverán a pasar por aquí las
            que estén por debajo.
          </Vacio>
        )}

        {conError.length > 0 && (
          <div className="tarjeta" style={{ marginTop: 16 }}>
            <h2 style={{ marginBottom: 6 }}>{conError.length} fotos con error</h2>
            <p className="tarjeta__ayuda">{conError[0].error}</p>
            <button
              type="button"
              className="boton"
              onClick={() => void tienda.analizar(conError)}
            >
              <IconoChispa className="boton__icono" />
              Reintentar
            </button>
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
          {restantes} {restantes === 1 ? 'foto dudosa' : 'fotos dudosas'}
        </span>
      </div>

      {!hayClaveIA(ajustes) && (
        <AvisoLinea>
          Sin la clave de Claude aquí cae <strong>todo</strong>: la app no reconoce técnicas por su
          cuenta. Si son muchas y del mismo taller, sale más a cuenta seleccionarlas en el Catálogo
          y usar <strong>Rellenar ficha</strong>.
        </AvisoLinea>
      )}

      <div className="revision__marco">
        <ImagenFoto key={actual.id} id={actual.id} alt={actual.nombre} tamano="completa" />
      </div>

      <div className="revision__sugerencia">
        <span aria-hidden="true" style={{ fontSize: '1.15rem' }}>{sugerida?.emoji ?? '❓'}</span>
        <div>
          {sugerida ? (
            <>
              El clasificador propone <strong>{sugerida.nombre}</strong> con un{' '}
              {Math.round(actual.confianza * 100)} % de confianza.
            </>
          ) : (
            <>El clasificador no ha sabido identificar la técnica.</>
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
      </div>
    </div>
  );
}
