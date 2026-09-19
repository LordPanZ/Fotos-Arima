import { useState } from 'react';
import { useTienda } from '../state/store';
import { categoria } from '../taxonomy';
import { compartirFotos, descargarFotos, textoDeCompartir } from '../lib/share';
import { exportarZip } from '../lib/exportZip';
import { BotonCerrar } from './comunes';
import { IconoCompartir, IconoDescargar, IconoRefrescar } from './Icons';

/** A partir de aquí, descargar una a una es peor que dar un único ZIP. */
const LIMITE_ZIP = 4;

export function DialogoCompartir() {
  const tienda = useTienda();
  const { compartiendo, ajustes } = tienda;
  const [ocupado, setOcupado] = useState<'ficha' | 'sola' | null>(null);

  if (!compartiendo) return null;

  const fotos = compartiendo;
  const varias = fotos.length > 1;
  const categorias = [...new Set(fotos.map((f) => categoria(f.categoria).nombre))];
  const vistaPrevia = textoDeCompartir(fotos).text;

  const compartir = async (conFicha: boolean) => {
    setOcupado(conFicha ? 'ficha' : 'sola');
    try {
      // La elección se recuerda para la próxima vez.
      if (ajustes.compartirConFicha !== conFicha) {
        await tienda.guardarAjustes({ ...ajustes, compartirConFicha: conFicha });
      }

      const resultado = await compartirFotos(fotos, { conFicha });

      if (resultado === 'no-soportado') {
        // Este dispositivo no sabe compartir archivos. Con pocas fotos se
        // descargan sueltas; con muchas, un ZIP evita una lluvia de descargas.
        if (fotos.length >= LIMITE_ZIP) {
          const total = await exportarZip(fotos, { porCategoria: true, incluirCatalogo: conFicha });
          tienda.avisar(`Aquí no se puede compartir archivos: ZIP con ${total} fotos descargado.`);
        } else {
          const total = await descargarFotos(fotos);
          tienda.avisar(
            `Aquí no se puede compartir archivos: ${total} ${total === 1 ? 'foto descargada' : 'fotos descargadas'}.`,
          );
        }
      } else if (resultado === 'compartido') {
        tienda.avisar(
          varias ? `${fotos.length} fotos compartidas.` : 'Foto compartida.',
          'exito',
        );
      }

      if (resultado !== 'cancelado') tienda.cerrarCompartir();
    } catch (error) {
      tienda.avisar(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setOcupado(null);
    }
  };

  const preferida = ajustes.compartirConFicha;

  return (
    <div
      className="velo"
      role="dialog"
      aria-modal="true"
      aria-label="Cómo compartir"
      onClick={(e) => e.target === e.currentTarget && !ocupado && tienda.cerrarCompartir()}
    >
      <div className="hoja hoja--estrecha">
        <div className="hoja__barra">
          <IconoCompartir style={{ width: 19, height: 19, flex: 'none' }} />
          <span className="hoja__titulo">
            Compartir {fotos.length} {varias ? 'fotos' : 'foto'}
          </span>
          <BotonCerrar alPulsar={tienda.cerrarCompartir} />
        </div>

        <div className="hoja__cuerpo hoja__cuerpo--simple">
          <p className="tarjeta__ayuda" style={{ marginBottom: 14 }}>
            {varias
              ? `Se enviarán juntas: ${categorias.slice(0, 3).join(', ')}${categorias.length > 3 ? '…' : '.'}`
              : 'Elige qué quieres enviar.'}
          </p>

          <div className="opciones-envio">
            <button
              type="button"
              className={`opcion-envio${preferida ? ' opcion-envio--preferida' : ''}`}
              disabled={ocupado !== null}
              onClick={() => void compartir(true)}
            >
              {ocupado === 'ficha' ? (
                <IconoRefrescar className="opcion-envio__icono giro" />
              ) : (
                <IconoCompartir className="opcion-envio__icono" />
              )}
              <span>
                <strong>Foto y ficha</strong>
                <span className="opcion-envio__ayuda">
                  Añade el nombre, la categoría y los materiales como texto.
                </span>
              </span>
            </button>

            <button
              type="button"
              className={`opcion-envio${!preferida ? ' opcion-envio--preferida' : ''}`}
              disabled={ocupado !== null}
              onClick={() => void compartir(false)}
            >
              {ocupado === 'sola' ? (
                <IconoRefrescar className="opcion-envio__icono giro" />
              ) : (
                <IconoDescargar className="opcion-envio__icono" />
              )}
              <span>
                <strong>{varias ? 'Solo las fotos' : 'Solo la foto'}</strong>
                <span className="opcion-envio__ayuda">
                  Envía únicamente {varias ? 'las imágenes' : 'la imagen'}, sin ningún texto.
                </span>
              </span>
            </button>
          </div>

          {preferida && (
            <details className="vista-previa">
              <summary>Ver el texto que se enviaría</summary>
              <pre>{vistaPrevia}</pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
