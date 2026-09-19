import { useEffect, useState } from 'react';
import type { Ajustes as TipoAjustes } from '../types';
import { usoAlmacenamiento, vaciarTodo, type UsoAlmacenamiento } from '../lib/db';
import { exportarFichas, exportarZip } from '../lib/exportZip';
import { TOKENS, nombreDesdePlantilla } from '../lib/naming';
import { estaEnCatalogo, hayClaveIA, mensajeDeError, probarClave } from '../lib/classifier';
import { useTienda } from '../state/store';
import { AvisoLinea, formatearBytes } from '../components/comunes';
import { IconoChispa, IconoComprobado, IconoDescargar, IconoGoogle, IconoPapelera } from '../components/Icons';

const MODELOS = [
  { id: 'claude-opus-5', nombre: 'Claude Opus 5 — el más preciso' },
  { id: 'claude-sonnet-5', nombre: 'Claude Sonnet 5 — más barato' },
  { id: 'claude-haiku-4-5', nombre: 'Claude Haiku 4.5 — el más rápido' },
];

const PRECISIONES: Array<{ id: TipoAjustes['precision']; nombre: string; ayuda: string }> = [
  { id: 'rapida', nombre: 'Rápida', ayuda: 'Menos coste por foto. Bien para lotes grandes y fotos claras.' },
  { id: 'equilibrada', nombre: 'Equilibrada', ayuda: 'El punto medio recomendado.' },
  { id: 'maxima', nombre: 'Máxima', ayuda: 'El modelo se toma más tiempo con cada foto. Para colecciones difíciles.' },
];

export function Ajustes() {
  const tienda = useTienda();
  const [borrador, setBorrador] = useState<TipoAjustes>(tienda.ajustes);
  const [uso, setUso] = useState<UsoAlmacenamiento | null>(null);
  const [probando, setProbando] = useState(false);

  useEffect(() => setBorrador(tienda.ajustes), [tienda.ajustes]);
  useEffect(() => {
    void usoAlmacenamiento().then(setUso);
  }, [tienda.fotos.length]);

  const cambiar = <C extends keyof TipoAjustes>(clave: C, valor: TipoAjustes[C]) => {
    const nuevos = { ...borrador, [clave]: valor };
    setBorrador(nuevos);
    void tienda.guardarAjustes(nuevos);
  };

  const ejemplo = tienda.fotos.find((f) => f.estado === 'listo');
  const vistaPrevia = ejemplo
    ? nombreDesdePlantilla(ejemplo, borrador.plantillaNombre)
    : nombreDesdePlantilla(
        {
          id: 'x', origen: 'local', archivoOriginal: 'IMG_2043.jpg', nombre: '', nombreEditado: false,
          tipoMime: 'image/jpeg', ancho: 0, alto: 0, bytes: 0,
          fecha: '2024-05-12T10:00:00.000Z', importadaEl: '',
          actualizadaEn: '2024-05-12T10:00:00.000Z', estado: 'listo',
          entraEnCatalogo: true, confianza: 0.9, categoria: 'macrame-fibras',
          tecnica: 'nudo plano', materiales: ['algodón'], colores: ['beige'],
          etiquetas: [], descripcion: 'colgante de pared', motor: 'ia',
          revision: 'auto', favorita: false,
        },
        borrador.plantillaNombre,
      );

  const enCatalogo = tienda.fotos.filter((f) => estaEnCatalogo(f, borrador.umbralConfianza));

  return (
    <>
      <h1 style={{ marginBottom: 14 }}>Ajustes</h1>

      {/* ----------------------------------------------------- Google */}
      <div className="tarjeta">
        <div className="tarjeta__titulo">
          <IconoGoogle style={{ width: 19, height: 19 }} />
          <h2>Google Fotos</h2>
        </div>
        <p className="tarjeta__ayuda">
          Necesitas un ID de cliente de OAuth propio. Los pasos completos están en{' '}
          <code>docs/CONFIGURACION-GOOGLE.md</code>: se hace una vez y tarda unos minutos.
        </p>

        <label className="campo">
          <span className="campo__etiqueta">ID de cliente de OAuth</span>
          <input
            className="entrada entrada--mono"
            value={borrador.googleClientId}
            onChange={(e) => setBorrador({ ...borrador, googleClientId: e.target.value })}
            onBlur={() => cambiar('googleClientId', borrador.googleClientId.trim())}
            placeholder="123456789-abc.apps.googleusercontent.com"
            spellCheck={false}
          />
          <span className="campo__ayuda">
            Tipo «Aplicación web», con esta dirección en <em>Orígenes autorizados de JavaScript</em>:{' '}
            <code>{window.location.origin}</code>
          </span>
        </label>
      </div>

      {/* --------------------------------------------------- Clasificador */}
      <div className="tarjeta">
        <div className="tarjeta__titulo">
          <IconoChispa style={{ width: 19, height: 19 }} />
          <h2>Clasificación</h2>
        </div>
        <p className="tarjeta__ayuda">
          Con una clave de la API de Claude cada foto se analiza con un modelo de visión: es lo que
          permite distinguir ganchillo de macramé, reconocer una Diskofesta o una Ihes Gela, y descartar
          lo que no es ninguna de las dos cosas. Sin
          clave, la app solo hace un filtrado local básico y manda casi todo a revisión.
        </p>

        <label className="interruptor">
          <input
            type="checkbox"
            checked={borrador.usarIA}
            onChange={(e) => cambiar('usarIA', e.target.checked)}
          />
          <span className="interruptor__texto">
            Analizar con el modelo de visión
            <span className="interruptor__ayuda">
              Desactívalo para trabajar sin conexión o sin gastar en la API.
            </span>
          </span>
        </label>

        <label className="campo">
          <span className="campo__etiqueta">Clave de la API de Claude</span>
          <input
            className="entrada entrada--mono"
            type="password"
            value={borrador.anthropicApiKey}
            onChange={(e) => setBorrador({ ...borrador, anthropicApiKey: e.target.value })}
            onBlur={() => cambiar('anthropicApiKey', borrador.anthropicApiKey.trim())}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="campo__ayuda">
            Se guarda solo en este dispositivo y se envía únicamente a <code>api.anthropic.com</code>.
            Consíguela en <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
          </span>
        </label>

        <div className="grupo-botones" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="boton"
            disabled={probando || !borrador.anthropicApiKey.trim()}
            onClick={async () => {
              setProbando(true);
              try {
                await probarClave({ ...borrador, anthropicApiKey: borrador.anthropicApiKey.trim() });
                tienda.avisar('La clave funciona y el modelo está disponible.', 'exito');
              } catch (error) {
                tienda.avisar(mensajeDeError(error), 'error');
              } finally {
                setProbando(false);
              }
            }}
          >
            <IconoComprobado className="boton__icono" />
            {probando ? 'Comprobando…' : 'Comprobar la clave'}
          </button>
        </div>

        <label className="campo">
          <span className="campo__etiqueta">Modelo</span>
          <select
            className="seleccion"
            value={borrador.modelo}
            onChange={(e) => cambiar('modelo', e.target.value)}
          >
            {MODELOS.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </select>
        </label>

        <label className="campo">
          <span className="campo__etiqueta">Precisión del análisis</span>
          <select
            className="seleccion"
            value={borrador.precision}
            onChange={(e) => cambiar('precision', e.target.value as TipoAjustes['precision'])}
          >
            {PRECISIONES.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <span className="campo__ayuda">
            {PRECISIONES.find((p) => p.id === borrador.precision)?.ayuda}
          </span>
        </label>

        <label className="campo">
          <span className="campo__etiqueta">
            Umbral de confianza: {Math.round(borrador.umbralConfianza * 100)} %
          </span>
          <input
            className="deslizador"
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={borrador.umbralConfianza}
            onChange={(e) => cambiar('umbralConfianza', Number(e.target.value))}
          />
          <span className="campo__ayuda">
            Por debajo de este valor la foto va a «Por revisar» en vez de entrar directamente al
            catálogo. Súbelo para afinar más la selección (más fotos a revisar a mano); bájalo para
            que la app decida sola. Ahora mismo: {enCatalogo.length} en el catálogo de{' '}
            {tienda.fotos.length} fotos.
          </span>
        </label>

        <label className="campo">
          <span className="campo__etiqueta">Fotos analizadas a la vez: {borrador.concurrencia}</span>
          <input
            className="deslizador"
            type="range"
            min={1}
            max={8}
            step={1}
            value={borrador.concurrencia}
            onChange={(e) => cambiar('concurrencia', Number(e.target.value))}
          />
          <span className="campo__ayuda">Bájalo si la API devuelve errores por exceso de peticiones.</span>
        </label>

        {!hayClaveIA(borrador) && (
          <AvisoLinea>
            Sin clave de API la clasificación es solo local: descarta capturas y documentos, pero no
            distingue categorías. Todo lo demás acabará en «Por revisar».
          </AvisoLinea>
        )}
      </div>

      {/* -------------------------------------------------------- Nombres */}
      <div className="tarjeta">
        <h2 className="tarjeta__titulo">Nombres de las fotos</h2>
        <p className="tarjeta__ayuda">
          Plantilla con la que se nombran las fotos al clasificarlas. Los nombres que escribas a
          mano no se tocan.
        </p>

        <label className="campo">
          <span className="campo__etiqueta">Plantilla</span>
          <input
            className="entrada entrada--mono"
            value={borrador.plantillaNombre}
            onChange={(e) => setBorrador({ ...borrador, plantillaNombre: e.target.value })}
            onBlur={() => cambiar('plantillaNombre', borrador.plantillaNombre)}
          />
          <span className="campo__ayuda">
            Resultado: <strong>{vistaPrevia}</strong>
          </span>
        </label>

        <table className="tabla-tokens">
          <tbody>
            {TOKENS.map((t) => (
              <tr key={t.clave}>
                <td><code>{t.clave}</code></td>
                <td style={{ color: 'var(--texto-2)' }}>{t.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grupo-botones" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="boton"
            onClick={async () => {
              const total = await tienda.renombrarConPlantilla(tienda.fotos);
              tienda.avisar(
                total ? `${total} fotos renombradas.` : 'Todos los nombres ya estaban al día.',
                'exito',
              );
            }}
          >
            Aplicar a las fotos sin nombre propio
          </button>
          <button
            type="button"
            className="boton boton--peligro"
            onClick={async () => {
              if (!confirm('Esto sobrescribe también los nombres que hayas escrito a mano. ¿Continuar?')) return;
              const total = await tienda.renombrarConPlantilla(tienda.fotos, true);
              tienda.avisar(`${total} fotos renombradas.`, 'exito');
            }}
          >
            Aplicar a todas
          </button>
        </div>
      </div>

      {/* ------------------------------------------------ Almacenamiento */}
      <div className="tarjeta">
        <h2 className="tarjeta__titulo">Fotos guardadas</h2>
        <p className="tarjeta__ayuda">
          Las fotos se guardan en este dispositivo para que la app funcione sin conexión. Los
          originales siguen intactos en Google Fotos.
        </p>

        <div className="estadisticas" style={{ marginBottom: 14 }}>
          <div className="estadistica">
            <div className="estadistica__valor">{uso?.fotos ?? tienda.fotos.length}</div>
            <div className="estadistica__clave">fotos</div>
          </div>
          <div className="estadistica">
            <div className="estadistica__valor">{formatearBytes(uso?.usado ?? 0)}</div>
            <div className="estadistica__clave">ocupado</div>
          </div>
          <div className="estadistica">
            <div className="estadistica__valor">{formatearBytes(uso?.disponible ?? 0)}</div>
            <div className="estadistica__clave">disponible</div>
          </div>
        </div>

        <label className="campo">
          <span className="campo__etiqueta">Tamaño máximo guardado: {borrador.tamanoMaximo} px</span>
          <input
            className="deslizador"
            type="range"
            min={1024}
            max={4096}
            step={256}
            value={borrador.tamanoMaximo}
            onChange={(e) => cambiar('tamanoMaximo', Number(e.target.value))}
          />
          <span className="campo__ayuda">
            Lado mayor de la copia local. Afecta solo a las importaciones futuras.
          </span>
        </label>

        <div className="grupo-botones">
          <button
            type="button"
            className="boton"
            disabled={!enCatalogo.length}
            onClick={async () => {
              try {
                const total = await exportarZip(enCatalogo, { porCategoria: true, incluirCatalogo: true });
                tienda.avisar(`ZIP con ${total} fotos generado.`, 'exito');
              } catch (error) {
                tienda.avisar(error instanceof Error ? error.message : String(error), 'error');
              }
            }}
          >
            <IconoDescargar className="boton__icono" />
            Exportar el catálogo en ZIP
          </button>

          <button
            type="button"
            className="boton"
            disabled={!tienda.fotos.length}
            onClick={() => exportarFichas(tienda.fotos)}
          >
            Copia de seguridad de las fichas
          </button>

          <button
            type="button"
            className="boton boton--peligro"
            disabled={!tienda.fotos.length}
            onClick={async () => {
              if (!confirm('Se borrarán todas las fotos guardadas en este dispositivo.\n\nLos originales de Google Fotos no se tocan. ¿Continuar?')) return;
              await vaciarTodo();
              await tienda.recargar();
              tienda.avisar('Catálogo local vaciado.', 'exito');
            }}
          >
            <IconoPapelera className="boton__icono" />
            Vaciar el catálogo local
          </button>
        </div>
      </div>
    </>
  );
}
