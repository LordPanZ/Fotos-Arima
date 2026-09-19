import { useMemo, useState } from 'react';
import type { Foto } from '../types';
import { CATEGORIAS, NO_MANUALIDAD, SIN_CLASIFICAR, categoria } from '../taxonomy';
import { estaEnCatalogo, necesitaRevision } from '../lib/classifier';
import { exportarZip } from '../lib/exportZip';
import { useTienda } from '../state/store';
import { DetalleFoto } from '../components/DetalleFoto';
import { Rejilla } from '../components/Galeria';
import { BarraProgreso, Vacio } from '../components/comunes';
import {
  IconoBuscar, IconoChispa, IconoCompartir, IconoComprobado, IconoDescargar,
  IconoEstrella, IconoLapiz, IconoPapelera,
} from '../components/Icons';

type Vista = 'catalogo' | 'revisar' | 'descartadas' | 'favoritas' | 'todas';

const VISTAS: Array<{ id: Vista; nombre: string }> = [
  { id: 'catalogo', nombre: 'Catálogo' },
  { id: 'favoritas', nombre: 'Favoritas' },
  { id: 'revisar', nombre: 'Por revisar' },
  { id: 'descartadas', nombre: 'Descartadas' },
  { id: 'todas', nombre: 'Todas' },
];

function coincide(foto: Foto, consulta: string): boolean {
  if (!consulta) return true;
  const texto = [
    foto.nombre, foto.archivoOriginal, foto.descripcion, foto.tecnica,
    categoria(foto.categoria).nombre, ...foto.etiquetas, ...foto.materiales, ...foto.colores,
    foto.evento?.titulo, foto.evento?.lugar, foto.evento?.monitor,
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  return consulta
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((palabra) => texto.includes(palabra));
}

export function Biblioteca({ alIrAImportar }: { alIrAImportar(): void }) {
  const tienda = useTienda();
  const { fotos, ajustes, seleccion, progreso } = tienda;

  const [vista, setVista] = useState<Vista>('catalogo');
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const visibles = useMemo(() => {
    const umbral = ajustes.umbralConfianza;
    const porVista = fotos.filter((foto) => {
      switch (vista) {
        case 'catalogo': return estaEnCatalogo(foto, umbral);
        case 'favoritas': return foto.favorita;
        case 'revisar': return necesitaRevision(foto, umbral) || foto.estado === 'error' || foto.estado === 'pendiente';
        case 'descartadas': return foto.revision === 'descartada' || (foto.revision === 'auto' && foto.categoria === NO_MANUALIDAD);
        default: return true;
      }
    });

    return porVista
      .filter((foto) => !filtroCategoria || foto.categoria === filtroCategoria)
      .filter((foto) => coincide(foto, busqueda))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [fotos, vista, filtroCategoria, busqueda, ajustes.umbralConfianza]);

  const cuentas = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const foto of visibles) mapa.set(foto.categoria, (mapa.get(foto.categoria) ?? 0) + 1);
    return mapa;
  }, [visibles]);

  const elegidas = useMemo(
    () => fotos.filter((f) => seleccion.has(f.id)),
    [fotos, seleccion],
  );

  // Se busca en todas las fotos, no solo en las visibles: si al editarla deja
  // de encajar con el filtro o la búsqueda, la hoja sigue abierta en vez de
  // desaparecer a media edición.
  const todasElegidas =
    visibles.length > 0 && visibles.every((f) => seleccion.has(f.id));

  const fotoAbierta = abierta ? fotos.find((f) => f.id === abierta) ?? null : null;

  const conAccion = async (accion: () => Promise<void>) => {
    setOcupado(true);
    try {
      await accion();
    } catch (error) {
      tienda.avisar(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setOcupado(false);
    }
  };

  const pendientes = fotos.filter((f) => f.estado === 'pendiente');

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="buscador">
          <IconoBuscar className="buscador__icono" />
          <input
            className="entrada"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, técnica, material o color…"
            aria-label="Buscar en el catálogo"
          />
        </div>
        {pendientes.length > 0 && !progreso.activo && (
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => void tienda.analizar(pendientes)}
          >
            <IconoChispa className="boton__icono" />
            Analizar {pendientes.length} pendientes
          </button>
        )}
      </div>

      <BarraProgreso progreso={progreso} alCancelar={tienda.cancelarAnalisis} />

      <div className="filtros" role="group" aria-label="Qué fotos mostrar">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            className="filtro"
            aria-pressed={vista === v.id}
            onClick={() => { setVista(v.id); setFiltroCategoria(null); }}
          >
            {v.nombre}
          </button>
        ))}
      </div>

      {cuentas.size > 1 && (
        <div className="filtros filtros--desplazable" role="group" aria-label="Filtrar por categoría">
          <button
            type="button"
            className="filtro"
            aria-pressed={filtroCategoria === null}
            onClick={() => setFiltroCategoria(null)}
          >
            Todos los tipos <span className="filtro__cuenta">{visibles.length}</span>
          </button>
          {[...CATEGORIAS, { id: SIN_CLASIFICAR }, { id: NO_MANUALIDAD }]
            .filter((c) => cuentas.has(c.id))
            .map((c) => {
              const cat = categoria(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className="filtro"
                  aria-pressed={filtroCategoria === c.id}
                  onClick={() => setFiltroCategoria(filtroCategoria === c.id ? null : c.id)}
                >
                  <span aria-hidden="true">{cat.emoji}</span>
                  {cat.nombre}
                  <span className="filtro__cuenta">{cuentas.get(c.id)}</span>
                </button>
              );
            })}
        </div>
      )}

      {visibles.length > 1 && elegidas.length === 0 && (
        <div className="acciones-lista">
          <button
            type="button"
            className="boton boton--fantasma boton--pequeno"
            onClick={() => tienda.seleccionar(visibles.map((f) => f.id))}
          >
            <IconoComprobado className="boton__icono" />
            Seleccionar las {visibles.length}
          </button>
          <span className="acciones-lista__ayuda">
            Selecciona varias para compartirlas o exportarlas juntas.
          </span>
        </div>
      )}

      {elegidas.length > 0 && (
        <div className="seleccion-barra">
          <span className="seleccion-barra__cuenta">{elegidas.length} seleccionadas</span>

          {!todasElegidas && (
            <button
              type="button"
              className="boton boton--pequeno boton--fantasma"
              onClick={() => tienda.seleccionar(visibles.map((f) => f.id))}
            >
              <IconoComprobado className="boton__icono" />
              Seleccionar las {visibles.length}
            </button>
          )}

          <button
            type="button"
            className="boton boton--pequeno boton--primario"
            disabled={ocupado}
            onClick={() => tienda.pedirCompartir(elegidas)}
          >
            <IconoCompartir className="boton__icono" />
            Compartir {elegidas.length > 1 ? `las ${elegidas.length}` : ''}
          </button>

          <button
            type="button"
            className="boton boton--pequeno"
            disabled={ocupado}
            onClick={() =>
              conAccion(async () => {
                const total = await exportarZip(elegidas, { porCategoria: true, incluirCatalogo: true });
                tienda.avisar(`ZIP con ${total} fotos generado.`, 'exito');
              })
            }
          >
            <IconoDescargar className="boton__icono" />
            Exportar ZIP
          </button>

          <button
            type="button"
            className="boton boton--pequeno"
            title="Aplica la plantilla de Ajustes, también a los nombres escritos a mano"
            disabled={ocupado}
            onClick={() =>
              conAccion(async () => {
                const total = await tienda.renombrarConPlantilla(elegidas, true);
                tienda.avisar(total ? `${total} fotos renombradas.` : 'No había nada que renombrar.', 'exito');
              })
            }
          >
            <IconoLapiz className="boton__icono" />
            Renombrar
          </button>

          <select
            className="seleccion"
            style={{ width: 'auto', maxWidth: 210 }}
            value=""
            aria-label="Mover la selección a otra categoría"
            onChange={(e) => {
              const destino = e.target.value;
              if (!destino) return;
              e.target.value = '';
              void conAccion(async () => {
                await tienda.actualizarFotos(
                  elegidas.map((foto) => ({
                    ...foto,
                    categoria: destino,
                    entraEnCatalogo: destino !== NO_MANUALIDAD,
                    revision: destino === NO_MANUALIDAD ? 'descartada' : 'confirmada',
                    motor: 'manual',
                    confianza: 1,
                  })),
                );
                tienda.avisar(`${elegidas.length} fotos movidas a «${categoria(destino).nombre}».`, 'exito');
              });
            }}
          >
            <option value="">Mover a…</option>
            {CATEGORIAS.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.nombre}</option>
            ))}
            <option value={NO_MANUALIDAD}>🚫 No entra en el catálogo</option>
          </select>

          <button
            type="button"
            className="boton boton--pequeno"
            disabled={ocupado}
            onClick={() =>
              conAccion(async () => {
                const todasFavoritas = elegidas.every((f) => f.favorita);
                await tienda.actualizarFotos(elegidas.map((f) => ({ ...f, favorita: !todasFavoritas })));
              })
            }
          >
            <IconoEstrella className="boton__icono" />
            Favoritas
          </button>

          <button
            type="button"
            className="boton boton--pequeno"
            disabled={ocupado}
            onClick={() => void tienda.analizar(elegidas)}
          >
            <IconoChispa className="boton__icono" />
            Analizar
          </button>

          <button
            type="button"
            className="boton boton--pequeno boton--peligro"
            disabled={ocupado}
            onClick={() => {
              if (!confirm(`¿Eliminar ${elegidas.length} fotos del catálogo de este dispositivo?\n\nSeguirán en Google Fotos.`)) return;
              void conAccion(async () => {
                await tienda.eliminarFotos(elegidas.map((f) => f.id));
                tienda.avisar('Fotos eliminadas del catálogo.', 'exito');
              });
            }}
          >
            <IconoPapelera className="boton__icono" />
            Eliminar
          </button>

          <button
            type="button"
            className="boton boton--pequeno boton--fantasma"
            onClick={tienda.limpiarSeleccion}
          >
            Quitar selección
          </button>
        </div>
      )}

      {visibles.length === 0 ? (
        fotos.length === 0 ? (
          <Vacio
            emoji="🧶"
            titulo="Todavía no hay fotos"
            accion={
              <button type="button" className="boton boton--primario" onClick={alIrAImportar}>
                Importar fotos
              </button>
            }
          >
            Conecta tu cuenta de Google Fotos o arrastra archivos desde el ordenador para empezar
            el catálogo.
          </Vacio>
        ) : (
          <Vacio emoji="🔍" titulo="Nada que mostrar aquí">
            {busqueda
              ? `Ninguna foto coincide con «${busqueda}».`
              : 'Prueba con otra pestaña: puede que las fotos estén en «Por revisar» o «Descartadas».'}
          </Vacio>
        )
      ) : (
        <Rejilla
          fotos={visibles}
          umbral={ajustes.umbralConfianza}
          seleccion={seleccion}
          modoSeleccion={elegidas.length > 0}
          agrupar={filtroCategoria === null}
          alAbrir={(foto) => setAbierta(foto.id)}
          alAlternar={tienda.alternarSeleccion}
          alSeleccionarGrupo={(ids) => tienda.seleccionar([...new Set([...seleccion, ...ids])])}
        />
      )}

      {fotoAbierta && (
        <DetalleFoto
          foto={fotoAbierta}
          contexto={visibles}
          alCerrar={() => setAbierta(null)}
          alCambiarFoto={(f) => setAbierta(f.id)}
        />
      )}
    </>
  );
}
