import { useCallback, useEffect, useRef, useState } from 'react';
import { useTienda } from '../state/store';
import { obtenerToken, cerrarSesionGoogle, hayTokenValido } from '../lib/googleAuth';
import { borrarSesion, crearSesion, esperarSeleccion } from '../lib/googlePicker';
import { importarArchivos, importarDesdeGoogle, importarEnvio, type ProgresoImportacion, type ResultadoImportacion } from '../lib/importar';
import { EXTENSION_ENVIO } from '../lib/envio';
import { necesitaRevision } from '../lib/classifier';
import { AvisoLinea, BarraProgreso, Vacio } from '../components/comunes';
import { IconoCarpeta, IconoCompartir, IconoGoogle, IconoRefrescar, IconoSobre } from '../components/Icons';
import { abrirWhatsApp, compartirEnlace, copiarEnlace, urlDelFormulario } from '../lib/compartirEnlace';

const TEXTO_INVITACION =
  'Aquí puedes mandar las fotos de los talleres de Arima. Ábrelo e instálalo en el móvil:';

type Fase = 'listo' | 'conectando' | 'esperando' | 'importando';

const CUENTA_SUGERIDA = 'arimacooltour@gmail.com';

export function Importar({ alIr }: { alIr(destino: 'biblioteca' | 'revisar'): void }) {
  const tienda = useTienda();
  const { ajustes } = tienda;

  const [fase, setFase] = useState<Fase>('listo');
  const [progreso, setProgreso] = useState<ProgresoImportacion | null>(null);
  const [resumen, setResumen] = useState<ResultadoImportacion | null>(null);
  const [encima, setEncima] = useState(false);
  const abortador = useRef<AbortController | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const entradaEnvio = useRef<HTMLInputElement>(null);

  useEffect(() => () => abortador.current?.abort(), []);

  const mostrarResultado = useCallback(
    (resultado: ResultadoImportacion) => {
      setResumen(resultado);
      tienda.anadirFotos(resultado.nuevas);

      if (resultado.nuevas.length) {
        // El análisis sigue en segundo plano: el resumen se queda en pantalla
        // para no dejar a la persona sin saber qué ha entrado y qué no.
        void tienda.analizar(resultado.nuevas);
      } else if (resultado.duplicadas) {
        tienda.avisar('Esas fotos ya estaban en el catálogo.');
      }
    },
    [tienda],
  );

  /* ------------------------------------------------------ Google Fotos */

  const importarGoogle = useCallback(async () => {
    if (fase !== 'listo') return;

    // La ventana se abre aquí, dentro del gesto de la persona: si esperamos a
    // tener la URL del selector, el navegador la bloquea como emergente.
    const ventana = window.open('', '_blank', 'noopener,width=520,height=720');
    const control = new AbortController();
    abortador.current = control;
    setResumen(null);
    setFase('conectando');

    let token: string | null = null;
    let idSesion: string | null = null;

    try {
      token = await obtenerToken({ clientId: ajustes.googleClientId, cuenta: CUENTA_SUGERIDA });
      const sesion = await crearSesion(token);
      idSesion = sesion.id;

      if (ventana && !ventana.closed) ventana.location.href = sesion.pickerUri;
      else window.location.href = sesion.pickerUri;

      setFase('esperando');
      const elegido = await esperarSeleccion(token, sesion, {
        cancelado: () => control.signal.aborted,
      });

      if (!elegido) {
        tienda.avisar(
          control.signal.aborted
            ? 'Importación cancelada.'
            : 'No se ha recibido ninguna selección. Vuelve a intentarlo.',
        );
        return;
      }

      if (!ventana?.closed) ventana?.close();
      setFase('importando');
      mostrarResultado(
        await importarDesdeGoogle(token, sesion.id, ajustes, control.signal, setProgreso),
      );
    } catch (error) {
      if (ventana && !ventana.closed) ventana.close();
      tienda.avisar(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      if (token && idSesion) void borrarSesion(token, idSesion);
      abortador.current = null;
      setFase('listo');
      setProgreso(null);
    }
  }, [fase, ajustes, tienda, mostrarResultado]);

  /* --------------------------------------------------- archivos locales */

  const importarLocales = useCallback(
    async (archivos: File[]) => {
      if (!archivos.length) return;
      setResumen(null);
      setFase('importando');
      try {
        mostrarResultado(await importarArchivos(archivos, ajustes, setProgreso));
      } catch (error) {
        tienda.avisar(error instanceof Error ? error.message : String(error), 'error');
      } finally {
        setFase('listo');
        setProgreso(null);
      }
    },
    [ajustes, tienda, mostrarResultado],
  );

  // Cuántas de las recién importadas han quedado sin decidir del todo.
  const porRevisar = resumen
    ? tienda.fotos.filter(
        (f) =>
          resumen.nuevas.some((n) => n.id === f.id) &&
          necesitaRevision(f, ajustes.umbralConfianza),
      ).length
    : 0;

  const importarPaquete = useCallback(
    async (archivo: File) => {
      setResumen(null);
      setFase('importando');
      try {
        const salida = await importarEnvio(archivo, ajustes, setProgreso);
        mostrarResultado(salida);
        tienda.avisar(
          `Envío de «${salida.evento.titulo}» abierto: ${salida.nuevas.length} fotos a Revisar.`,
          'exito',
        );
      } catch (error) {
        tienda.avisar(error instanceof Error ? error.message : String(error), 'error');
      } finally {
        setFase('listo');
        setProgreso(null);
      }
    },
    [ajustes, tienda, mostrarResultado],
  );

  const ocupado = fase !== 'listo';
  const porcentaje = progreso?.total ? Math.round((progreso.hechas / progreso.total) * 100) : 0;

  return (
    <>
      <h1 style={{ marginBottom: 14 }}>Importar fotos</h1>

      {!ajustes.googleClientId && (
        <AvisoLinea>
          Para conectar con Google Fotos falta el <strong>ID de cliente de OAuth</strong>. Añádelo en
          Ajustes. Mientras tanto puedes importar archivos desde el dispositivo, que funciona sin
          configurar nada.
        </AvisoLinea>
      )}

      <div className="tarjeta">
        <div className="tarjeta__titulo">
          <IconoCompartir style={{ width: 19, height: 19 }} />
          <h2>Pasar el formulario a los monitores</h2>
        </div>
        <p className="tarjeta__ayuda">
          <strong>Tailerren Argazkiak</strong> es una app aparte, en euskera, que se instala en el
          móvil. Mándales el enlace y que la instalen: desde ahí suben las fotos de sus talleres.
        </p>

        <div className="grupo-botones">
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => abrirWhatsApp(`${TEXTO_INVITACION} ${urlDelFormulario()}`)}
          >
            Enviar por WhatsApp
          </button>

          <button
            type="button"
            className="boton"
            onClick={async () => {
              const resultado = await compartirEnlace({
                titulo: 'Tailerren Argazkiak Arima',
                texto: TEXTO_INVITACION,
                url: urlDelFormulario(),
              });
              if (resultado === 'copiado') tienda.avisar('Enlace copiado al portapapeles.', 'exito');
              if (resultado === 'sin-portapapeles') {
                tienda.avisar('Este navegador no deja copiar solo. Copia el enlace de abajo.', 'error');
              }
            }}
          >
            <IconoCompartir className="boton__icono" />
            Compartir de otra forma
          </button>

          <button
            type="button"
            className="boton boton--fantasma"
            onClick={async () => {
              const resultado = await copiarEnlace(urlDelFormulario());
              tienda.avisar(
                resultado === 'copiado' ? 'Enlace copiado.' : 'No se ha podido copiar.',
                resultado === 'copiado' ? 'exito' : 'error',
              );
            }}
          >
            Copiar enlace
          </button>
        </div>

        <p className="campo__ayuda" style={{ marginTop: 12 }}>
          <code>{urlDelFormulario()}</code>
        </p>
      </div>

      <div className="tarjeta">
        <div className="tarjeta__titulo">
          <IconoGoogle style={{ width: 20, height: 20 }} />
          <h2>Desde Google Fotos</h2>
        </div>
        <p className="tarjeta__ayuda">
          Se abrirá el selector de Google para que elijas las fotos de{' '}
          <strong>{CUENTA_SUGERIDA}</strong>. La app solo recibe las que marques ahí: nunca ve el
          resto de tu biblioteca.
        </p>

        {fase === 'esperando' && (
          <AvisoLinea>
            Elige las fotos en la ventana de Google y pulsa <strong>Hecho</strong>. Esta pantalla lo
            detectará sola. Si has cerrado la ventana sin querer, cancela y vuelve a empezar.
          </AvisoLinea>
        )}

        <div className="grupo-botones">
          <button
            type="button"
            className="boton boton--primario"
            onClick={() => void importarGoogle()}
            disabled={ocupado || !ajustes.googleClientId}
          >
            {fase === 'listo' ? (
              <IconoGoogle style={{ width: 17, height: 17 }} />
            ) : (
              <IconoRefrescar className="boton__icono giro" />
            )}
            {fase === 'conectando' && 'Conectando…'}
            {fase === 'esperando' && 'Esperando tu selección…'}
            {fase === 'importando' && 'Importando…'}
            {fase === 'listo' && 'Elegir fotos en Google Fotos'}
          </button>

          {ocupado && (
            <button
              type="button"
              className="boton"
              onClick={() => {
                abortador.current?.abort();
                setFase('listo');
              }}
            >
              Cancelar
            </button>
          )}

          {hayTokenValido() && !ocupado && (
            <button
              type="button"
              className="boton boton--fantasma"
              onClick={() => {
                cerrarSesionGoogle();
                tienda.avisar('Sesión de Google cerrada en este dispositivo.');
              }}
            >
              Desconectar cuenta
            </button>
          )}
        </div>
      </div>

      <div className="tarjeta">
        <div className="tarjeta__titulo">
          <IconoCarpeta style={{ width: 20, height: 20 }} />
          <h2>Desde este dispositivo</h2>
        </div>
        <p className="tarjeta__ayuda">
          Arrastra aquí fotos o carpetas, o selecciónalas. Sirve también para las descargas de
          Google Takeout. No hace falta configurar nada.
        </p>

        <div
          className="zona-soltar"
          data-encima={encima}
          role="button"
          tabIndex={0}
          onClick={() => entrada.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && entrada.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
          onDragLeave={() => setEncima(false)}
          onDrop={(e) => {
            e.preventDefault();
            setEncima(false);
            void importarLocales([...e.dataTransfer.files]);
          }}
        >
          <div>
            <strong>Suelta las fotos aquí</strong>
            <div style={{ color: 'var(--texto-2)', fontSize: '0.85rem', marginTop: 4 }}>
              o pulsa para elegirlas · JPG, PNG, WEBP, HEIC
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
            void importarLocales([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>

      <div className="tarjeta">
        <div className="tarjeta__titulo">
          <IconoSobre style={{ width: 20, height: 20 }} />
          <h2>Envío de un monitor</h2>
        </div>
        <p className="tarjeta__ayuda">
          Abre aquí el archivo que te hayan mandado desde el formulario{' '}
          <strong>Tailerren Argazkiak</strong> por WhatsApp o correo. Sus fotos entran directas a
          Revisar con el título, la fecha y el lugar del taller.
        </p>

        <button
          type="button"
          className="boton"
          disabled={ocupado}
          onClick={() => entradaEnvio.current?.click()}
        >
          <IconoSobre className="boton__icono" />
          Abrir un envío
        </button>
        <input
          ref={entradaEnvio}
          type="file"
          accept=".zip,application/zip"
          className="sr-solo"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = '';
            if (archivo) void importarPaquete(archivo);
          }}
        />
        <p className="campo__ayuda" style={{ marginTop: 10 }}>
          Los envíos terminan en <code>{EXTENSION_ENVIO}</code>.
        </p>
      </div>

      {progreso && progreso.fase !== 'hecho' && (
        <div className="tarjeta">
          <div className="progreso">
            <div className="progreso__barra">
              <div className="progreso__relleno" style={{ width: `${porcentaje}%` }} />
            </div>
            <div className="progreso__texto">
              <span className="progreso__actual">
                {progreso.fase === 'descargando' ? 'Descargando de Google Fotos' : 'Guardando en el dispositivo'}
                {progreso.actual ? `: ${progreso.actual}` : '…'}
              </span>
              <span>{progreso.hechas}/{progreso.total}</span>
            </div>
          </div>
        </div>
      )}

      {resumen && (
        <div className="tarjeta">
          <h2 style={{ marginBottom: 10 }}>Resultado de la importación</h2>
          <BarraProgreso progreso={tienda.progreso} alCancelar={tienda.cancelarAnalisis} />
          <div className="estadisticas">
            <div className="estadistica">
              <div className="estadistica__valor">{resumen.nuevas.length}</div>
              <div className="estadistica__clave">fotos nuevas</div>
            </div>
            <div className="estadistica">
              <div className="estadistica__valor">{resumen.duplicadas}</div>
              <div className="estadistica__clave">ya estaban</div>
            </div>
            <div className="estadistica">
              <div className="estadistica__valor">{resumen.fallidas.length}</div>
              <div className="estadistica__clave">con error</div>
            </div>
          </div>

          {resumen.fallidas.length > 0 && (
            <ul style={{ marginTop: 14, fontSize: '0.83rem', color: 'var(--texto-2)', paddingLeft: 18 }}>
              {resumen.fallidas.slice(0, 8).map((f) => (
                <li key={f.archivo}><strong>{f.archivo}</strong>: {f.motivo}</li>
              ))}
              {resumen.fallidas.length > 8 && <li>y {resumen.fallidas.length - 8} más…</li>}
            </ul>
          )}

          {!tienda.progreso.activo && resumen.nuevas.length > 0 && (
            <div className="grupo-botones" style={{ marginTop: 14 }}>
              <button type="button" className="boton boton--primario" onClick={() => alIr('biblioteca')}>
                Ver el catálogo
              </button>
              {porRevisar > 0 && (
                <button type="button" className="boton" onClick={() => alIr('revisar')}>
                  Revisar {porRevisar} {porRevisar === 1 ? 'dudosa' : 'dudosas'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!resumen && !ocupado && tienda.fotos.length === 0 && (
        <Vacio emoji="📥" titulo="Empieza por aquí">
          Importa unas cuantas fotos y la app las clasificará por categoría: ganchillo, cerámica,
          macramé, papel, Diskofesta, Ihes Gela… Después podrás renombrarlas y compartirlas.
        </Vacio>
      )}
    </>
  );
}
