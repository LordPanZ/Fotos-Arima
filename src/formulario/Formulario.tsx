import { useCallback, useEffect, useRef, useState } from 'react';
import { empaquetarEnvio, type DatosFormulario } from '../lib/envio';
import { enviarAlBuzon, type ProgresoEnvio } from '../lib/envioNube';
import { descargarBlob } from '../lib/share';
import { ErrorNube } from '../lib/nube';
import {
  IconoCompartir, IconoComprobado,
  IconoDescargar, IconoInstalar, IconoLogo, IconoRefrescar,
} from '../components/Icons';
import { nombresEnCastellano } from '../materiales';
import {
  abrirWhatsApp, compartirEnlace, esIOS, estaInstalada, urlDelFormulario,
} from '../lib/compartirEnlace';
import { BloqueTaller, tallerCompleto, type Elegida, type Taller } from './BloqueTaller';

const RECUERDA = 'arima.formulario.monitor';
const MAXIMO_TALLERES = 8;

function hoy(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tallerNuevo(lugar = ''): Taller {
  return {
    clave: `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    titulo: '',
    fecha: hoy(),
    lugar,
    notas: '',
    materiales: [],
    otros: '',
    fotos: [],
  };
}

/**
 * Los módulos que comparte con la aplicación dan sus errores en castellano.
 * Aquí se traduce lo que el monitor necesita entender, y el detalle técnico se
 * conserva por si hay que diagnosticar algo.
 */
function mensajeDeFallo(e: unknown): string {
  if (e instanceof ErrorNube) {
    return 'Ezin izan da Arimarekin konektatu. Begiratu estaldura duzun eta saiatu berriro, '
      + 'edo erabili «Fitxategi gisa bidali».';
  }
  return `Zerbaitek huts egin du: ${e instanceof Error ? e.message : String(e)}`;
}

interface EventoInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface Resumen {
  talleres: number;
  argazkiak: number;
  fallidas: number;
}

export function Formulario() {
  const [monitor, setMonitor] = useState('');
  const [talleres, setTalleres] = useState<Taller[]>(() => [tallerNuevo()]);

  const [progreso, setProgreso] = useState<ProgresoEnvio | null>(null);
  const [cual, setCual] = useState<{ indice: number; total: number } | null>(null);
  const [enviando, setEnviando] = useState<'buzon' | 'archivo' | null>(null);
  const [hecho, setHecho] = useState<Resumen | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const [instalador, setInstalador] = useState<EventoInstalacion | null>(null);
  const [instalada] = useState(estaInstalada);
  const [comoInstalar, setComoInstalar] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const capturar = (e: Event) => {
      e.preventDefault();
      setInstalador(e as EventoInstalacion);
    };
    window.addEventListener('beforeinstallprompt', capturar);
    window.addEventListener('appinstalled', () => setInstalador(null));
    return () => window.removeEventListener('beforeinstallprompt', capturar);
  }, []);

  // El nombre y el lugar se repiten envío tras envío: se recuerdan.
  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(RECUERDA) ?? '{}');
      if (typeof guardado.monitor === 'string') setMonitor(guardado.monitor);
      if (typeof guardado.lugar === 'string' && guardado.lugar) {
        setTalleres((previos) =>
          previos.map((t, i) => (i === 0 && !t.lugar ? { ...t, lugar: guardado.lugar } : t)),
        );
      }
    } catch {
      /* si no se puede leer, se empieza en blanco */
    }
  }, []);

  // Las vistas previas se liberan al salir de la página y, una a una, al quitar
  // una foto. Hacerlo en cada cambio invalidaría las que siguen elegidas.
  const vivos = useRef<Taller[]>([]);
  vivos.current = talleres;
  useEffect(
    () => () => vivos.current.forEach((t) => t.fotos.forEach((f) => URL.revokeObjectURL(f.url))),
    [],
  );

  const cambiarTaller = useCallback((clave: string, cambios: Partial<Taller>) => {
    setTalleres((previos) => previos.map((t) => (t.clave === clave ? { ...t, ...cambios } : t)));
  }, []);

  const quitarTaller = useCallback((clave: string) => {
    setTalleres((previos) => {
      if (previos.length === 1) return previos;
      const fuera = previos.find((t) => t.clave === clave);
      fuera?.fotos.forEach((f) => URL.revokeObjectURL(f.url));
      return previos.filter((t) => t.clave !== clave);
    });
  }, []);

  const cambiarCuantos = useCallback((cuantos: number) => {
    setTalleres((previos) => {
      const destino = Math.max(1, Math.min(MAXIMO_TALLERES, cuantos));
      if (destino === previos.length) return previos;

      if (destino > previos.length) {
        // El lugar suele repetirse en la misma jornada: se hereda del anterior.
        const ultimo = previos[previos.length - 1];
        const nuevos = Array.from({ length: destino - previos.length }, () =>
          tallerNuevo(ultimo?.lugar ?? ''),
        );
        return [...previos, ...nuevos];
      }

      // Al reducir se quitan los últimos; si llevan datos, se pregunta.
      const sobrantes = previos.slice(destino);
      const conDatos = sobrantes.some((t) => t.titulo.trim() || t.fotos.length);
      if (conDatos && !confirm('Azken tailerrak ezabatuko dira. Ziur zaude?')) return previos;
      sobrantes.forEach((t) => t.fotos.forEach((f) => URL.revokeObjectURL(f.url)));
      return previos.slice(0, destino);
    });
  }, []);

  const recordar = () => {
    try {
      localStorage.setItem(
        RECUERDA,
        JSON.stringify({ monitor, lugar: talleres[0]?.lugar ?? '' }),
      );
    } catch {
      /* sin persistencia no pasa nada grave */
    }
  };

  const datosDe = (taller: Taller): DatosFormulario => ({
    titulo: taller.titulo,
    fecha: taller.fecha,
    lugar: taller.lugar,
    monitor,
    notas: taller.notas,
    // Se guardan en castellano, que es el idioma del catálogo, aunque el
    // monitor los haya elegido con los rótulos en euskera.
    materiales: [
      ...nombresEnCastellano(taller.materiales),
      ...taller.otros.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean),
    ],
  });

  const listos = talleres.every(tallerCompleto);
  const totalFotos = talleres.reduce((suma, t) => suma + t.fotos.length, 0);

  /* ------------------------------------------------------------- envíos */

  const enviarBuzon = async () => {
    setEnviando('buzon');
    setFallo(null);
    recordar();

    const resumen: Resumen = { talleres: 0, argazkiak: 0, fallidas: 0 };
    try {
      // Cada taller viaja por su cuenta: llegan a Fotos Arima como envíos
      // independientes, con su propia ficha y sin mezclarse entre ellos.
      for (const [indice, taller] of talleres.entries()) {
        setCual({ indice, total: talleres.length });
        const resultado = await enviarAlBuzon(
          datosDe(taller),
          taller.fotos.map((f) => f.archivo),
          setProgreso,
        );
        if (resultado.enviadas) resumen.talleres += 1;
        resumen.argazkiak += resultado.enviadas;
        resumen.fallidas += resultado.fallidas.length;
      }

      if (!resumen.argazkiak) {
        setFallo('Ezin izan da argazkirik bidali. Saiatu berriro edo erabili «Fitxategi gisa bidali».');
        return;
      }
      setHecho(resumen);
    } catch (e) {
      setFallo(mensajeDeFallo(e));
    } finally {
      setEnviando(null);
      setProgreso(null);
      setCual(null);
    }
  };

  const enviarArchivo = async () => {
    setEnviando('archivo');
    setFallo(null);
    recordar();

    try {
      // Un paquete por taller, también aquí: al abrirlos en la aplicación
      // cada uno conserva su ficha.
      const archivos: File[] = [];
      for (const [indice, taller] of talleres.entries()) {
        setCual({ indice, total: talleres.length });
        const { blob, nombre } = await empaquetarEnvio(
          datosDe(taller),
          taller.fotos.map((f) => f.archivo),
        );
        archivos.push(new File([blob], nombre, { type: 'application/zip' }));
      }

      const resumen: Resumen = { talleres: talleres.length, argazkiak: totalFotos, fallidas: 0 };

      if (navigator.canShare?.({ files: archivos }) && navigator.share) {
        try {
          await navigator.share({ files: archivos, title: talleres[0].titulo });
          setHecho(resumen);
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
        }
      }
      for (const archivo of archivos) descargarBlob(archivo, archivo.name);
      setHecho(resumen);
    } catch (e) {
      setFallo(mensajeDeFallo(e));
    } finally {
      setEnviando(null);
      setCual(null);
    }
  };

  /* ------------------------------------------------------ pantalla final */

  if (hecho) {
    return (
      <div className="formulario">
        <div className="formulario__hecho">
          <div className="formulario__marca-ok" aria-hidden="true">
            <IconoComprobado />
          </div>
          <h1>Eskerrik asko!</h1>
          <p>
            {hecho.argazkiak === 1 ? 'Argazki 1 bidali da' : `${hecho.argazkiak} argazki bidali dira`}
            {hecho.talleres > 1 && `, ${hecho.talleres} tailerretan banatuta`}.
          </p>
          {hecho.fallidas > 0 && (
            <p className="formulario__aviso">
              {hecho.fallidas}{' '}
              {hecho.fallidas === 1 ? 'argazki ezin izan da bidali' : 'argazki ezin izan dira bidali'}.
            </p>
          )}
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => {
              talleres.forEach((t) => t.fotos.forEach((f) => URL.revokeObjectURL(f.url)));
              setTalleres([tallerNuevo(talleres[0]?.lugar ?? '')]);
              setHecho(null);
            }}
          >
            Beste tailer bat bidali
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- formulario */

  const ocupado = enviando !== null;
  const porcentaje = progreso?.total ? Math.round((progreso.hechas / progreso.total) * 100) : 0;

  return (
    <div className="formulario">
      <header className="formulario__cabecera">
        <IconoLogo className="formulario__logo" />
        <div>
          <h1>Tailerren Argazkiak</h1>
          <p>Bidali hemen tailerreko argazkiak eta zuzenean Arimaren katalogora iritsiko dira.</p>
        </div>
      </header>

      {!instalada && (
        <div className="panel-instalar">
          <IconoInstalar style={{ width: 22, height: 22, flex: 'none' }} />
          <div className="panel-instalar__texto">
            <strong>Instalatu aplikazioa</strong> zure mugikorrean: hurrengoan ikono batetik
            irekiko duzu, nabigatzailera joan gabe.
          </div>
          {instalador ? (
            <button
              type="button"
              className="boton boton--primario boton--pequeno"
              onClick={async () => {
                await instalador.prompt();
                await instalador.userChoice;
                setInstalador(null);
              }}
            >
              Instalatu
            </button>
          ) : (
            <button
              type="button"
              className="boton boton--primario boton--pequeno"
              onClick={() => setComoInstalar((v) => !v)}
              aria-expanded={comoInstalar}
            >
              Nola?
            </button>
          )}
        </div>
      )}

      {comoInstalar && !instalada && (
        <div className="tarjeta instrucciones">
          {esIOS() ? (
            <>
              <h3>iPhone edo iPad</h3>
              <ol>
                <li>Ireki orri hau <strong>Safari</strong> nabigatzailean.</li>
                <li>Ukitu <strong>Partekatu</strong> botoia (gezia duen laukia).</li>
                <li>Aukeratu <strong>«Gehitu hasierako pantailara»</strong>.</li>
              </ol>
            </>
          ) : (
            <>
              <h3>Android</h3>
              <ol>
                <li>Ukitu nabigatzailearen menua (<strong>⋮</strong>).</li>
                <li>Aukeratu <strong>«Instalatu aplikazioa»</strong> edo
                  <strong> «Gehitu hasierako pantailara»</strong>.</li>
              </ol>
            </>
          )}
        </div>
      )}

      <div className="tarjeta">
        <label className="campo" style={{ marginBottom: 16 }}>
          <span className="campo__etiqueta">Zure izena</span>
          <input
            className="entrada"
            value={monitor}
            onChange={(e) => setMonitor(e.target.value)}
            placeholder="Nori galdetu jakiteko"
            maxLength={60}
          />
        </label>

        <span className="campo__etiqueta">Zenbat tailer bidali behar dituzu?</span>
        <div className="contador">
          <button
            type="button"
            className="boton"
            onClick={() => cambiarCuantos(talleres.length - 1)}
            disabled={ocupado || talleres.length <= 1}
            aria-label="Tailer bat gutxiago"
          >
            −
          </button>
          <output className="contador__valor" aria-live="polite">
            {talleres.length}
          </output>
          <button
            type="button"
            className="boton"
            onClick={() => cambiarCuantos(talleres.length + 1)}
            disabled={ocupado || talleres.length >= MAXIMO_TALLERES}
            aria-label="Tailer bat gehiago"
          >
            +
          </button>
          <span className="contador__ayuda">
            {talleres.length === 1
              ? 'Tailer bakarra'
              : 'Bakoitzak bere datuak eta bere argazkiak ditu.'}
          </span>
        </div>
      </div>

      {talleres.map((taller, indice) => (
        <BloqueTaller
          key={taller.clave}
          taller={taller}
          indice={indice}
          total={talleres.length}
          ocupado={ocupado}
          alCambiar={(cambios) => cambiarTaller(taller.clave, cambios)}
          alQuitar={() => quitarTaller(taller.clave)}
        />
      ))}

      {fallo && <div className="aviso-linea aviso-linea--error">{fallo}</div>}

      {(progreso || cual) && (
        <div className="progreso">
          <div className="progreso__barra">
            <div className="progreso__relleno" style={{ width: `${porcentaje}%` }} />
          </div>
          <div className="progreso__texto">
            <span>
              {cual && cual.total > 1 && `${cual.indice + 1}/${cual.total} · `}
              {progreso?.fase === 'preparando' ? 'Argazkiak prestatzen' : 'Bidaltzen'}…
            </span>
            {progreso && <span>{progreso.hechas}/{progreso.total}</span>}
          </div>
        </div>
      )}

      <div className="formulario__acciones">
        <button
          type="button"
          className="boton boton--primario boton--ancho"
          disabled={!listos || ocupado}
          onClick={() => void enviarBuzon()}
        >
          {enviando === 'buzon' ? (
            <IconoRefrescar className="boton__icono giro" />
          ) : (
            <IconoCompartir className="boton__icono" />
          )}
          {enviando === 'buzon'
            ? 'Bidaltzen…'
            : talleres.length > 1
              ? `Bidali ${talleres.length} tailerrak`
              : 'Arimara bidali'}
        </button>

        <button
          type="button"
          className="boton boton--ancho"
          disabled={!listos || ocupado}
          onClick={() => void enviarArchivo()}
        >
          {enviando === 'archivo' ? (
            <IconoRefrescar className="boton__icono giro" />
          ) : (
            <IconoDescargar className="boton__icono" />
          )}
          Fitxategi gisa bidali
        </button>

        {!listos && (
          <p className="formulario__aviso" style={{ margin: 0 }}>
            Osatu tailer guztien izenburua, data, lekua eta argazkiak.
          </p>
        )}

        <p className="formulario__pie">
          «Arimara bidali» aukerak argazkiak zuzenean igotzen ditu. «Fitxategi gisa bidali»
          aukerak fitxategi bat prestatzen du tailer bakoitzeko, WhatsApp bidez bidaltzeko:
          erabili estaldurarik ez baduzu edo bidalketak huts egiten badu.
        </p>
      </div>

      <div className="formulario__repartir">
        <span>Beste monitore batek behar du?</span>
        <button
          type="button"
          className="boton boton--pequeno"
          onClick={() =>
            abrirWhatsApp(`Arimako tailerretako argazkiak bidaltzeko: ${urlDelFormulario()}`)
          }
        >
          WhatsApp
        </button>
        <button
          type="button"
          className="boton boton--pequeno boton--fantasma"
          onClick={async () => {
            const resultado = await compartirEnlace({
              titulo: 'Tailerren Argazkiak Arima',
              texto: 'Arimako tailerretako argazkiak bidaltzeko',
              url: urlDelFormulario(),
            });
            if (resultado === 'copiado') {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            }
          }}
        >
          {copiado ? 'Kopiatuta!' : 'Partekatu'}
        </button>
      </div>
    </div>
  );
}

export type { Elegida };
