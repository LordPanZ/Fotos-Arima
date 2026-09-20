import { useRef } from 'react';
import { MATERIALES } from '../materiales';
import { IconoCarpeta, IconoCerrar } from '../components/Icons';
import { pareceVideo } from '../lib/video';

export interface Elegida {
  archivo: File;
  url: string;
}

export interface Taller {
  /** Clave estable para React; no viaja en el envío. */
  clave: string;
  titulo: string;
  fecha: string;
  lugar: string;
  notas: string;
  materiales: string[];
  otros: string;
  fotos: Elegida[];
}

export const LIMITE_FOTOS = 60;

export function tallerCompleto(taller: Taller): boolean {
  return (
    taller.titulo.trim() !== '' &&
    taller.lugar.trim() !== '' &&
    taller.fecha !== '' &&
    taller.fotos.length > 0
  );
}

export function pesoDe(taller: Taller): number {
  return taller.fotos.reduce((suma, f) => suma + f.archivo.size, 0);
}

function formatearBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface Props {
  taller: Taller;
  indice: number;
  /** Cuántos talleres hay en total: con uno solo se oculta la numeración. */
  total: number;
  ocupado: boolean;
  alCambiar(cambios: Partial<Taller>): void;
  alQuitar(): void;
}

export function BloqueTaller({ taller, indice, total, ocupado, alCambiar, alQuitar }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const varios = total > 1;
  const completo = tallerCompleto(taller);

  const anadirFotos = (lista: FileList | File[]) => {
    const imagenes = [...lista].filter(
      (a) => a.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(a.name),
    );
    if (!imagenes.length) return;

    // No se repite la misma foto si se elige dos veces.
    const yaEstan = new Set(taller.fotos.map((p) => `${p.archivo.name}:${p.archivo.size}`));
    const nuevas = imagenes
      .filter((a) => !yaEstan.has(`${a.name}:${a.size}`))
      .slice(0, Math.max(0, LIMITE_FOTOS - taller.fotos.length))
      .map((archivo) => ({ archivo, url: URL.createObjectURL(archivo) }));

    alCambiar({ fotos: [...taller.fotos, ...nuevas] });
  };

  const quitarFoto = (posicion: number) => {
    URL.revokeObjectURL(taller.fotos[posicion].url);
    alCambiar({ fotos: taller.fotos.filter((_, i) => i !== posicion) });
  };

  return (
    <section className="bloque" data-completo={completo}>
      {varios && (
        <header className="bloque__cabecera">
          <span className="bloque__numero">{indice + 1}</span>
          <div className="bloque__resumen">
            <strong>{taller.titulo.trim() || `${indice + 1}. tailerra`}</strong>
            <span>
              {taller.fotos.length
                ? `${taller.fotos.length} argazki · ${formatearBytes(pesoDe(taller))}`
                : 'Argazkirik gabe'}
              {!completo && ' · osatu gabe'}
            </span>
          </div>
          {total > 1 && (
            <button
              type="button"
              className="boton boton--fantasma boton--pequeno"
              onClick={alQuitar}
              disabled={ocupado}
              aria-label={`${indice + 1}. tailerra kendu`}
            >
              <IconoCerrar className="boton__icono" />
            </button>
          )}
        </header>
      )}

      <div className="tarjeta">
        <label className="campo">
          <span className="campo__etiqueta">Tailerraren izenburua *</span>
          <input
            className="entrada"
            value={taller.titulo}
            onChange={(e) => alCambiar({ titulo: e.target.value })}
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
              value={taller.fecha}
              onChange={(e) => alCambiar({ fecha: e.target.value })}
            />
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Lekua *</span>
            <input
              className="entrada"
              value={taller.lugar}
              onChange={(e) => alCambiar({ lugar: e.target.value })}
              placeholder="adib. Algortako ludoteka"
              maxLength={80}
            />
          </label>
        </div>

        <label className="campo" style={{ marginBottom: 0 }}>
          <span className="campo__etiqueta">Oharrak</span>
          <textarea
            className="area"
            value={taller.notas}
            onChange={(e) => alCambiar({ notas: e.target.value })}
            placeholder="Jakitea komeni den edozer (aukerakoa)"
            maxLength={400}
          />
        </label>
      </div>

      <div className="tarjeta">
        <h2 className="tarjeta__titulo">Materialak</h2>
        <p className="tarjeta__ayuda">Zer erabili duzue? Ukitu erabilitako guztiak.</p>

        <div className="materiales">
          {MATERIALES.map((m) => {
            const elegido = taller.materiales.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                className="material"
                aria-pressed={elegido}
                onClick={() =>
                  alCambiar({
                    materiales: elegido
                      ? taller.materiales.filter((x) => x !== m.id)
                      : [...taller.materiales, m.id],
                  })
                }
              >
                <span aria-hidden="true">{m.emoji}</span>
                {m.eu}
              </button>
            );
          })}
        </div>

        <label className="campo" style={{ marginTop: 14, marginBottom: 0 }}>
          <span className="campo__etiqueta">Besterik?</span>
          <input
            className="entrada"
            value={taller.otros}
            onChange={(e) => alCambiar({ otros: e.target.value })}
            placeholder="Komaz bereizita"
            maxLength={160}
          />
        </label>
      </div>

      <div className="tarjeta">
        <div className="tarjeta__titulo">
          <IconoCarpeta style={{ width: 19, height: 19 }} />
          <h2>Argazkiak eta bideoak *</h2>
        </div>
        <p className="tarjeta__ayuda">
          Aukeratu tailer honetako argazkiak. Bidali aurretik txikitu egiten dira, beraz ia ez dute
          daturik kontsumitzen. Bideoak ere bidal ditzakezu, osorik doazenez 48 MB arte bakoitza.
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
            anadirFotos(e.dataTransfer.files);
          }}
        >
          <div>
            <strong>{taller.fotos.length ? 'Gehiago aukeratu' : 'Aukeratu argazkiak edo bideoak'}</strong>
            <div style={{ color: 'var(--texto-2)', fontSize: '0.85rem', marginTop: 4 }}>
              {taller.fotos.length
                ? `${taller.fotos.length} argazki · ${formatearBytes(pesoDe(taller))}`
                : `Gehienez ${LIMITE_FOTOS} fitxategi`}
            </div>
          </div>
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-solo"
          onChange={(e) => {
            anadirFotos(e.target.files ?? []);
            e.target.value = '';
          }}
        />

        {taller.fotos.length > 0 && (
          <div className="formulario__tiras">
            {taller.fotos.map((foto, posicion) => (
              <div className="formulario__tira" key={`${foto.archivo.name}-${posicion}`}>
                {pareceVideo(foto.archivo) ? (
                  // Un <img> con un vídeo sale roto: aquí basta con el primer
                  // fotograma, que es lo que pinta `preload="metadata"`.
                  <video src={foto.url} muted playsInline preload="metadata" aria-label={foto.archivo.name} />
                ) : (
                  <img src={foto.url} alt={foto.archivo.name} loading="lazy" />
                )}
                <button
                  type="button"
                  className="formulario__quitar"
                  onClick={() => quitarFoto(posicion)}
                  aria-label={`${foto.archivo.name} kendu`}
                  disabled={ocupado}
                >
                  <IconoCerrar />
                </button>
              </div>
            ))}
          </div>
        )}

        {taller.fotos.length >= LIMITE_FOTOS && (
          <p className="formulario__aviso">
            {LIMITE_FOTOS} fitxategiko mugara iritsi zara. Bidali gainerakoak beste bidalketa batean.
          </p>
        )}
      </div>
    </section>
  );
}
