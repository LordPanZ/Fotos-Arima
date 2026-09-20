import { useState } from 'react';
import type { Foto } from '../types';
import { listaCategorias, categoria } from '../taxonomy';
import { nombreDeFoto } from '../lib/envio';
import { BotonCerrar } from './comunes';
import { IconoComprobado, IconoLapiz } from './Icons';

/**
 * Rellenar una ficha y volcarla sobre varias fotos a la vez.
 *
 * Es opcional a propósito: solo se aplica lo que se escribe, campo a campo, y
 * el tipo hay que elegirlo expresamente. Así sirve tanto para un taller entero
 * —todas del mismo tipo— como para tocar solo el título de un grupo mezclado.
 */
export interface PropsFichaComun {
  fotos: Foto[];
  alCerrar(): void;
  alAplicar(cambios: Foto[]): void | Promise<void>;
}

export function FichaComun({ fotos, alCerrar, alAplicar }: PropsFichaComun) {
  const varias = fotos.length > 1;
  const [titulo, setTitulo] = useState('');
  const [numerar, setNumerar] = useState(true);
  const [tipo, setTipo] = useState<string | null>(null);
  const [tecnica, setTecnica] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [etiquetas, setEtiquetas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const nuevasEtiquetas = etiquetas
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const hayAlgo =
    titulo.trim() !== '' ||
    tipo !== null ||
    tecnica.trim() !== '' ||
    descripcion.trim() !== '' ||
    nuevasEtiquetas.length > 0;

  const aplicar = async () => {
    setGuardando(true);
    try {
      const cambios = fotos.map((foto, indice) => {
        const nueva: Foto = { ...foto };

        if (titulo.trim()) {
          nueva.nombre = numerar
            ? nombreDeFoto(titulo, indice, fotos.length)
            : titulo.trim();
          // A partir de aquí la plantilla automática ya no lo toca.
          nueva.nombreEditado = true;
        }

        if (tipo) {
          // Elegir el tipo a mano es una decisión humana: la foto sale de la
          // cola de revisión y entra en el catálogo sin más preguntas.
          nueva.categoria = tipo;
          nueva.entraEnCatalogo = true;
          nueva.confianza = 1;
          nueva.revision = 'confirmada';
          nueva.motor = 'manual';
          nueva.estado = 'listo';
          nueva.motivo = undefined;
        }

        if (tecnica.trim()) nueva.tecnica = tecnica.trim();
        if (descripcion.trim()) nueva.descripcion = descripcion.trim();
        if (nuevasEtiquetas.length) {
          nueva.etiquetas = [...new Set([...foto.etiquetas, ...nuevasEtiquetas])];
        }

        return nueva;
      });

      await alAplicar(cambios);
      alCerrar();
    } finally {
      setGuardando(false);
    }
  };

  const ejemplo = titulo.trim()
    ? nombreDeFoto(titulo, 0, numerar ? fotos.length : 1)
    : '';

  return (
    <div
      className="velo"
      role="dialog"
      aria-modal="true"
      aria-label="Rellenar la ficha de varias fotos"
      onClick={(e) => e.target === e.currentTarget && !guardando && alCerrar()}
    >
      <div className="hoja">
        <div className="hoja__barra">
          <IconoLapiz style={{ width: 19, height: 19, flex: 'none' }} />
          <span className="hoja__titulo">
            Rellenar {fotos.length} {varias ? 'fotos' : 'foto'} de una vez
          </span>
          <BotonCerrar alPulsar={alCerrar} />
        </div>

        <div className="hoja__cuerpo">
          <p className="tarjeta__ayuda" style={{ marginBottom: 14 }}>
            Solo se aplica lo que rellenes. Lo que dejes en blanco se queda como está en cada foto,
            así que puedes usarlo aunque sean de tipos distintos.
          </p>

          <label className="campo">
            <span className="campo__etiqueta">Título</span>
            <input
              className="entrada"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Taller de macramé en Lekeitio"
              maxLength={120}
            />
            {ejemplo && (
              <span className="campo__ayuda">
                La primera se llamará <strong>{ejemplo}</strong>.
              </span>
            )}
          </label>

          {varias && titulo.trim() !== '' && (
            <label className="interruptor">
              <input
                type="checkbox"
                checked={numerar}
                onChange={(e) => setNumerar(e.target.checked)}
              />
              <span className="interruptor__texto">
                Numerar las fotos
                <span className="interruptor__ayuda">
                  «{titulo.trim()} 01», «{titulo.trim()} 02»… Sin esto, las {fotos.length} se
                  llamarían igual.
                </span>
              </span>
            </label>
          )}

          <div className="campo">
            <span className="campo__etiqueta">Tipo</span>
            <span className="campo__ayuda" style={{ marginBottom: 7 }}>
              Si eliges uno, estas fotos se dan por revisadas y entran en el catálogo.
            </span>
            <div className="rejilla-categorias">
              <button
                type="button"
                className="opcion-categoria"
                aria-pressed={tipo === null}
                onClick={() => setTipo(null)}
              >
                <span aria-hidden="true">➖</span>
                No cambiarlo
              </button>
              {listaCategorias().map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="opcion-categoria"
                  aria-pressed={tipo === c.id}
                  onClick={() => setTipo(c.id)}
                >
                  <span aria-hidden="true">{c.emoji}</span>
                  {c.nombre}
                </button>
              ))}
            </div>
          </div>

          <label className="campo">
            <span className="campo__etiqueta">
              {tipo && categoria(tipo).familia === 'actividad' ? 'Escena' : 'Técnica'}
            </span>
            <input
              className="entrada"
              value={tecnica}
              onChange={(e) => setTecnica(e.target.value)}
              placeholder="nudo plano"
              maxLength={80}
            />
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Descripción</span>
            <input
              className="entrada"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="colgante de pared beige"
              maxLength={160}
            />
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Etiquetas que añadir</span>
            <input
              className="entrada"
              value={etiquetas}
              onChange={(e) => setEtiquetas(e.target.value)}
              placeholder="verano, adultos, lekeitio"
              maxLength={200}
            />
            <span className="campo__ayuda">
              Separadas por comas. Se suman a las que ya tenga cada foto, no las sustituyen.
            </span>
          </label>

          <div className="grupo-botones">
            <button
              type="button"
              className="boton boton--primario"
              disabled={!hayAlgo || guardando}
              onClick={() => void aplicar()}
            >
              <IconoComprobado className="boton__icono" />
              {guardando
                ? 'Aplicando…'
                : `Aplicar a las ${fotos.length} ${varias ? 'fotos' : 'foto'}`}
            </button>
            <button type="button" className="boton boton--fantasma" onClick={alCerrar} disabled={guardando}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
