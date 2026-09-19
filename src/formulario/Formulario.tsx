import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { empaquetarEnvio, type DatosFormulario } from '../lib/envio';
import { enviarAlBuzon, type ProgresoEnvio, type ResultadoEnvio } from '../lib/envioNube';
import { descargarBlob } from '../lib/share';
import { ErrorNube } from '../lib/nube';
import {
  IconoCarpeta, IconoCerrar, IconoCompartir, IconoComprobado,
  IconoDescargar, IconoLogo, IconoRefrescar,
} from '../components/Icons';

const RECUERDA = 'arima.formulario.monitor';
const LIMITE_FOTOS = 60;

function hoy(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function formatearBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Elegida {
  archivo: File;
  url: string;
}

export function Formulario() {
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [lugar, setLugar] = useState('');
  const [monitor, setMonitor] = useState('');
  const [notas, setNotas] = useState('');
  const [fotos, setFotos] = useState<Elegida[]>([]);

  const [progreso, setProgreso] = useState<ProgresoEnvio | null>(null);
  const [enviando, setEnviando] = useState<'buzon' | 'archivo' | null>(null);
  const [hecho, setHecho] = useState<ResultadoEnvio | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  const entrada = useRef<HTMLInputElement>(null);

  // El nombre y el lugar se repiten envío tras envío: se recuerdan.
  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(RECUERDA) ?? '{}');
      if (typeof guardado.monitor === 'string') setMonitor(guardado.monitor);
      if (typeof guardado.lugar === 'string') setLugar(guardado.lugar);
    } catch {
      /* si no se puede leer, se empieza en blanco */
    }
  }, []);

  // Las vistas previas se liberan al salir de la página y, una a una, al
  // quitar una foto. Hacerlo en cada cambio de `fotos` invalidaría también las
  // de las que siguen elegidas, y se quedarían en blanco al añadir más.
  const vivas = useRef<Elegida[]>([]);
  vivas.current = fotos;
  useEffect(() => () => vivas.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const datos: DatosFormulario = useMemo(
    () => ({ titulo, fecha, lugar, monitor, notas }),
    [titulo, fecha, lugar, monitor, notas],
  );

  const pesoTotal = fotos.reduce((suma, f) => suma + f.archivo.size, 0);
  const listo = titulo.trim() !== '' && lugar.trim() !== '' && fecha !== '' && fotos.length > 0;

  const anadir = useCallback((lista: FileList | File[]) => {
    setFallo(null);
    const imagenes = [...lista].filter(
      (a) => a.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(a.name),
    );
    if (!imagenes.length) return;

    setFotos((previas) => {
      // Se evita repetir la misma foto si se elige dos veces.
      const yaEstan = new Set(previas.map((p) => `${p.archivo.name}:${p.archivo.size}`));
      const nuevas = imagenes
        .filter((a) => !yaEstan.has(`${a.name}:${a.size}`))
        .slice(0, Math.max(0, LIMITE_FOTOS - previas.length))
        .map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) }));
      return [...previas, ...nuevas];
    });
  }, []);

  const quitar = useCallback((indice: number) => {
    setFotos((previas) => {
      URL.revokeObjectURL(previas[indice].url);
      return previas.filter((_, i) => i !== indice);
    });
  }, []);

  const recordar = () => {
    try {
      localStorage.setItem(RECUERDA, JSON.stringify({ monitor, lugar }));
    } catch {
      /* sin persistencia no pasa nada grave */
    }
  };

  const enviarBuzon = async () => {
    setEnviando('buzon');
    setFallo(null);
    try {
      recordar();
      const resultado = await enviarAlBuzon(datos, fotos.map((f) => f.archivo), setProgreso);
      if (!resultado.enviadas) {
        setFallo(
          'Ezin izan da argazkirik bidali. Saiatu berriro edo erabili «Fitxategi gisa bidali».',
        );
        return;
      }
      setHecho(resultado);
    } catch (e) {
      setFallo(mensajeDeFallo(e));
    } finally {
      setEnviando(null);
      setProgreso(null);
    }
  };

  const enviarArchivo = async () => {
    setEnviando('archivo');
    setFallo(null);
    try {
      recordar();
      const { blob, nombre } = await empaquetarEnvio(datos, fotos.map((f) => f.archivo));
      const archivo = new File([blob], nombre, { type: 'application/zip' });

      if (navigator.canShare?.({ files: [archivo] }) && navigator.share) {
        try {
          await navigator.share({ files: [archivo], title: titulo });
          setHecho({ idEnvio: '', enviadas: fotos.length, fallidas: [] });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return;
        }
      }
      descargarBlob(blob, nombre);
      setHecho({ idEnvio: '', enviadas: fotos.length, fallidas: [] });
    } catch (e) {
      setFallo(mensajeDeFallo(e));
    } finally {
      setEnviando(null);
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
            {hecho.enviadas === 1
              ? 'Argazki 1 bidali da'
              : `${hecho.enviadas} argazki bidali dira`}
            .
            <br />
            <strong>{titulo}</strong>
          </p>
          {hecho.fallidas.length > 0 && (
            <p className="formulario__aviso">
              {hecho.fallidas.length}{' '}
              {hecho.fallidas.length === 1 ? 'argazki ezin izan da bidali' : 'argazki ezin izan dira bidali'}.
            </p>
          )}
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => {
              fotos.forEach((f) => URL.revokeObjectURL(f.url));
              setFotos([]);
              setTitulo('');
              setNotas('');
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

      <div className="tarjeta">
        <label className="campo">
          <span className="campo__etiqueta">Tailerraren izenburua *</span>
          <input
            className="entrada"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="adib. Makrame tailerra Getxon"
            maxLength={90}
          />
        </label>

        <div className="formulario__pareja">
          <label className="campo">
            <span className="campo__etiqueta">Data *</span>
            <input
              className="entrada"
              type="date"
              value={fecha}
              max={hoy()}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Lekua *</span>
            <input
              className="entrada"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder="adib. Algortako ludoteka"
              maxLength={80}
            />
          </label>
        </div>

        <label className="campo">
          <span className="campo__etiqueta">Zure izena</span>
          <input
            className="entrada"
            value={monitor}
            onChange={(e) => setMonitor(e.target.value)}
            placeholder="Nori galdetu jakiteko"
            maxLength={60}
          />
        </label>

        <label className="campo" style={{ marginBottom: 0 }}>
          <span className="campo__etiqueta">Oharrak</span>
          <textarea
            className="area"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Jakitea komeni den edozer (aukerakoa)"
            maxLength={400}
          />
        </label>
      </div>

      <div className="tarjeta">
        <div className="tarjeta__titulo">
          <IconoCarpeta style={{ width: 19, height: 19 }} />
          <h2>Argazkiak *</h2>
        </div>
        <p className="tarjeta__ayuda">
          Aukeratu tailerreko argazkiak. Bidali aurretik txikitu egiten dira, beraz ia ez dute
          daturik kontsumitzen.
        </p>

        <div
          className="zona-soltar"
          role="button"
          tabIndex={0}
          onClick={() => entrada.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            anadir(e.dataTransfer.files);
          }}
        >
          <div>
            <strong>{fotos.length ? 'Argazki gehiago' : 'Aukeratu argazkiak'}</strong>
            <div style={{ color: 'var(--texto-2)', fontSize: '0.85rem', marginTop: 4 }}>
              {fotos.length
                ? `${fotos.length} argazki · ${formatearBytes(pesoTotal)}`
                : `Gehienez ${LIMITE_FOTOS} argazki`}
            </div>
          </div>
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple
          className="sr-solo"
          onChange={(e) => {
            anadir(e.target.files ?? []);
            e.target.value = '';
          }}
        />

        {fotos.length > 0 && (
          <div className="formulario__tiras">
            {fotos.map((foto, indice) => (
              <div className="formulario__tira" key={`${foto.archivo.name}-${indice}`}>
                <img src={foto.url} alt={foto.archivo.name} loading="lazy" />
                <button
                  type="button"
                  className="formulario__quitar"
                  onClick={() => quitar(indice)}
                  aria-label={`${foto.archivo.name} kendu`}
                  disabled={ocupado}
                >
                  <IconoCerrar />
                </button>
              </div>
            ))}
          </div>
        )}

        {fotos.length >= LIMITE_FOTOS && (
          <p className="formulario__aviso">
            {LIMITE_FOTOS} argazkiko mugara iritsi zara. Bidali gainerakoak beste bidalketa batean.
          </p>
        )}
      </div>

      {fallo && <div className="aviso-linea aviso-linea--error">{fallo}</div>}

      {progreso && progreso.fase !== 'hecho' && (
        <div className="progreso">
          <div className="progreso__barra">
            <div className="progreso__relleno" style={{ width: `${porcentaje}%` }} />
          </div>
          <div className="progreso__texto">
            <span>{progreso.fase === 'preparando' ? 'Argazkiak prestatzen' : 'Bidaltzen'}…</span>
            <span>{progreso.hechas}/{progreso.total}</span>
          </div>
        </div>
      )}

      <div className="formulario__acciones">
        <button
          type="button"
          className="boton boton--primario boton--ancho"
          disabled={!listo || ocupado}
          onClick={() => void enviarBuzon()}
        >
          {enviando === 'buzon' ? (
            <IconoRefrescar className="boton__icono giro" />
          ) : (
            <IconoCompartir className="boton__icono" />
          )}
          {enviando === 'buzon' ? 'Bidaltzen…' : 'Arimara bidali'}
        </button>

        <button
          type="button"
          className="boton boton--ancho"
          disabled={!listo || ocupado}
          onClick={() => void enviarArchivo()}
        >
          {enviando === 'archivo' ? (
            <IconoRefrescar className="boton__icono giro" />
          ) : (
            <IconoDescargar className="boton__icono" />
          )}
          Fitxategi gisa bidali
        </button>

        <p className="formulario__pie">
          «Arimara bidali» aukerak argazkiak zuzenean igotzen ditu. «Fitxategi gisa bidali»
          aukerak fitxategi bakar bat prestatzen du WhatsApp bidez bidaltzeko: erabili
          estaldurarik ez baduzu edo bidalketak huts egiten badu.
        </p>
      </div>
    </div>
  );
}
