import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProveedorTienda, useTienda } from './state/store';
import { necesitaRevision } from './lib/classifier';
import { alActualizar } from './lib/actualizacion';
import { Biblioteca } from './views/Biblioteca';
import { Importar } from './views/Importar';
import { Revisar } from './views/Revisar';
import { Ajustes } from './views/Ajustes';
import { Avisos, Cargando } from './components/comunes';
import { DialogoCompartir } from './components/DialogoCompartir';
import {
  IconoAjustes, IconoBiblioteca, IconoImportar, IconoInstalar, IconoLogo,
  IconoRefrescar, IconoRevisar,
} from './components/Icons';

type Seccion = 'biblioteca' | 'importar' | 'revisar' | 'ajustes';

const SECCIONES: Array<{ id: Seccion; nombre: string; Icono: typeof IconoBiblioteca }> = [
  { id: 'biblioteca', nombre: 'Catálogo', Icono: IconoBiblioteca },
  { id: 'importar', nombre: 'Importar', Icono: IconoImportar },
  { id: 'revisar', nombre: 'Revisar', Icono: IconoRevisar },
  { id: 'ajustes', nombre: 'Ajustes', Icono: IconoAjustes },
];

const RUTAS: Record<string, Seccion> = {
  '#/importar': 'importar',
  '#/revisar': 'revisar',
  '#/ajustes': 'ajustes',
};

function seccionDelHash(): Seccion {
  return RUTAS[window.location.hash] ?? 'biblioteca';
}

interface EventoInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function Interfaz() {
  const { cargando, fotos, ajustes, sincronizando, sinSubir, sincronizar } = useTienda();
  const [seccion, setSeccion] = useState<Seccion>(seccionDelHash);
  const [instalador, setInstalador] = useState<EventoInstalacion | null>(null);
  const [actualizando, setActualizando] = useState(false);

  useEffect(() => alActualizar(setActualizando), []);
  const [ocultarPanel, setOcultarPanel] = useState(
    () => localStorage.getItem('arima.instalar.oculto') === '1',
  );

  useEffect(() => {
    const alCambiarHash = () => setSeccion(seccionDelHash());
    window.addEventListener('hashchange', alCambiarHash);
    return () => window.removeEventListener('hashchange', alCambiarHash);
  }, []);

  useEffect(() => {
    const capturar = (e: Event) => {
      e.preventDefault();
      setInstalador(e as EventoInstalacion);
    };
    window.addEventListener('beforeinstallprompt', capturar);
    window.addEventListener('appinstalled', () => setInstalador(null));
    return () => window.removeEventListener('beforeinstallprompt', capturar);
  }, []);

  const ir = useCallback((destino: Seccion) => {
    setSeccion(destino);
    const hash = destino === 'biblioteca' ? '#/' : `#/${destino}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, []);

  const porRevisar = useMemo(
    () =>
      fotos.filter(
        (f) => necesitaRevision(f, ajustes.umbralConfianza) || f.estado === 'pendiente' || f.estado === 'error',
      ).length,
    [fotos, ajustes.umbralConfianza],
  );

  return (
    <div className="app">
      <header className="barra">
        <div className="barra__marca">
          <IconoLogo className="barra__logo" />
          <div>
            <div className="barra__titulo">Fotos Arima</div>
            <div className="barra__sub">
              {fotos.length ? `${fotos.length} fotos · catálogo compartido` : 'Catálogo compartido'}
            </div>
          </div>
        </div>
        <div className="barra__espacio" />

        <button
          type="button"
          className="boton boton--fantasma boton--pequeno sincro"
          onClick={() => void sincronizar()}
          disabled={sincronizando}
          aria-label={
            sincronizando
              ? 'Sincronizando con el catálogo compartido'
              : sinSubir > 0
                ? `Sincronizar, ${sinSubir} cambios sin enviar`
                : 'Sincronizar con el catálogo compartido'
          }
          title="Catálogo compartido"
        >
          <IconoRefrescar className={`boton__icono${sincronizando ? ' giro' : ''}`} />
          {sinSubir > 0 && !sincronizando && <span className="sincro__cuenta">{sinSubir}</span>}
        </button>

        {instalador && (
          <button
            type="button"
            className="boton boton--primario boton--pequeno"
            onClick={async () => {
              await instalador.prompt();
              await instalador.userChoice;
              setInstalador(null);
            }}
          >
            <IconoInstalar className="boton__icono" />
            Instalar
          </button>
        )}
      </header>

      <nav className="nav" aria-label="Secciones">
        {SECCIONES.map(({ id, nombre, Icono }) => (
          <button
            key={id}
            type="button"
            className="nav__boton"
            aria-current={seccion === id ? 'page' : undefined}
            // Sin esto el contador se pegaría al nombre del botón («Revisar3»)
            // y los lectores de pantalla lo leerían como una sola palabra.
            aria-label={
              id === 'revisar' && porRevisar > 0
                ? `Revisar, ${porRevisar} ${porRevisar === 1 ? 'pendiente' : 'pendientes'}`
                : undefined
            }
            onClick={() => ir(id)}
          >
            <Icono className="nav__icono" />
            <span className="nav__texto">{nombre}</span>
            {id === 'revisar' && porRevisar > 0 && (
              <span className="nav__pastilla" aria-hidden="true">
                {porRevisar > 99 ? '99+' : porRevisar}
              </span>
            )}
          </button>
        ))}
      </nav>

      <main className="contenido">
        {actualizando && (
          <div className="panel-instalar panel-instalar--nueva">
            <IconoRefrescar className="giro" style={{ width: 22, height: 22, flex: 'none' }} />
            <div className="panel-instalar__texto">
              <strong>Instalando una versión nueva…</strong> La pantalla se recargará sola en un
              momento. No se pierde nada de lo que tengas guardado.
            </div>
          </div>
        )}

        {instalador && !ocultarPanel && seccion === 'biblioteca' && (
          <div className="panel-instalar">
            <IconoInstalar style={{ width: 22, height: 22, flex: 'none' }} />
            <div className="panel-instalar__texto">
              <strong>Instala la app</strong> para abrirla desde el escritorio o la pantalla de
              inicio y usarla sin conexión.
            </div>
            <button
              type="button"
              className="boton boton--primario boton--pequeno"
              onClick={async () => {
                await instalador.prompt();
                await instalador.userChoice;
                setInstalador(null);
              }}
            >
              Instalar
            </button>
            <button
              type="button"
              className="boton boton--fantasma boton--pequeno"
              onClick={() => {
                setOcultarPanel(true);
                localStorage.setItem('arima.instalar.oculto', '1');
              }}
            >
              Ahora no
            </button>
          </div>
        )}

        {cargando ? (
          <Cargando texto="Abriendo el catálogo…" />
        ) : seccion === 'biblioteca' ? (
          <Biblioteca alIrAImportar={() => ir('importar')} />
        ) : seccion === 'importar' ? (
          <Importar alIr={ir} />
        ) : seccion === 'revisar' ? (
          <Revisar alIrAImportar={() => ir('importar')} />
        ) : (
          <Ajustes />
        )}
      </main>

      <DialogoCompartir />
      <Avisos />
    </div>
  );
}

export default function App() {
  return (
    <ProveedorTienda>
      <Interfaz />
    </ProveedorTienda>
  );
}
