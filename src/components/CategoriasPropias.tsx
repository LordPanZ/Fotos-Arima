import { useState } from 'react';
import type { Ajustes, Foto } from '../types';
import {
  CATEGORIAS_BASE, SIN_CLASIFICAR, type CategoriaPropia, type Familia, idDeCategoria,
} from '../taxonomy';
import { IconoMas, IconoPapelera } from './Icons';
import { AvisoLinea } from './comunes';
import { useTienda } from '../state/store';

/** Paleta acotada: los tonos que ya usa la galería, para que no desentone. */
const COLORES = [
  '#c2554a', '#b5548c', '#a8763f', '#4a7fb5',
  '#5d8f6f', '#8b6bb5', '#3f8f9a', '#c08a3e',
];

const EMOJIS = ['🔧', '💡', '🤖', '🖥️', '🔌', '🎬', '🎵', '📚', '🏃', '🌍', '🧪', '⭐'];

interface Borrador {
  nombre: string;
  emoji: string;
  color: string;
  definicion: string;
  familia: Familia;
}

const VACIO: Borrador = {
  nombre: '',
  emoji: '⭐',
  color: COLORES[0],
  definicion: '',
  familia: 'manualidad',
};

export interface PropsCategoriasPropias {
  ajustes: Ajustes;
  fotos: Foto[];
  alGuardar(categorias: CategoriaPropia[]): void;
  /** Se llama con las fotos que hay que mover al borrar un tipo en uso. */
  alVaciarCategoria(fotos: Foto[]): void;
  avisar(texto: string, tono?: 'info' | 'exito' | 'error'): void;
}

export function CategoriasPropias(props: PropsCategoriasPropias) {
  const { ajustes, fotos } = props;
  const [borrador, setBorrador] = useState<Borrador>(VACIO);
  const [abierto, setAbierto] = useState(false);

  const cuentaDe = (id: string) => fotos.filter((f) => f.categoria === id).length;

  const anadir = () => {
    const nombre = borrador.nombre.trim();
    if (!nombre) return;

    const id = idDeCategoria(nombre);
    if (ajustes.categoriasPropias.some((c) => c.id === id)) {
      props.avisar(`Ya existe un tipo llamado «${nombre}».`, 'error');
      return;
    }

    const nueva: CategoriaPropia = {
      id,
      nombre,
      emoji: borrador.emoji.trim() || '⭐',
      color: borrador.color,
      // Sin definición el clasificador no sabría cuándo usarla; el nombre es
      // un mínimo razonable y siempre se puede afinar después.
      definicion: borrador.definicion.trim() || nombre,
      familia: borrador.familia,
    };

    props.alGuardar([...ajustes.categoriasPropias, nueva]);
    setBorrador(VACIO);
    setAbierto(false);
    props.avisar(`Tipo «${nombre}» creado.`, 'exito');
  };

  const borrar = (cat: CategoriaPropia) => {
    const dentro = fotos.filter((f) => f.categoria === cat.id);
    const aviso = dentro.length
      ? `Se borrará el tipo «${cat.nombre}» y sus ${dentro.length} ${
          dentro.length === 1 ? 'foto pasará' : 'fotos pasarán'
        } a «Sin clasificar», en la pestaña Revisar. ¿Seguir?`
      : `¿Borrar el tipo «${cat.nombre}»?`;
    if (!window.confirm(aviso)) return;

    if (dentro.length) {
      props.alVaciarCategoria(
        dentro.map((f) => ({
          ...f,
          categoria: SIN_CLASIFICAR,
          categoriaPropia: undefined,
          revision: 'auto' as const,
          confianza: 0,
        })),
      );
    }
    props.alGuardar(ajustes.categoriasPropias.filter((c) => c.id !== cat.id));
  };

  return (
    <>
      <p className="tarjeta__ayuda">
        Además de los {CATEGORIAS_BASE.length} tipos que trae la app puedes crear los tuyos
        —Tecnología, Cocina, Deporte…—. Aparecen en la galería, al revisar y al clasificar: si has
        puesto una clave de Claude, el modelo también los usará.
      </p>

      {ajustes.categoriasPropias.length > 0 && (
        <ul className="lista-tipos">
          {ajustes.categoriasPropias.map((c) => (
            <li className="tipo" key={c.id} style={{ ['--tono' as string]: c.color }}>
              <span className="tipo__emoji" aria-hidden="true">{c.emoji}</span>
              <div className="tipo__cuerpo">
                <strong>{c.nombre}</strong>
                <span className="tipo__ayuda">
                  {c.familia === 'actividad' ? 'Actividad' : 'Manualidad'} · {cuentaDe(c.id)}{' '}
                  {cuentaDe(c.id) === 1 ? 'foto' : 'fotos'}
                </span>
              </div>
              <button
                type="button"
                className="boton boton--fantasma boton--pequeno"
                onClick={() => borrar(c)}
                aria-label={`Borrar el tipo ${c.nombre}`}
              >
                <IconoPapelera className="boton__icono" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!abierto ? (
        <button type="button" className="boton" onClick={() => setAbierto(true)}>
          <IconoMas className="boton__icono" />
          Crear un tipo nuevo
        </button>
      ) : (
        <div className="tipo-nuevo">
          <label className="campo">
            <span className="campo__etiqueta">Nombre del tipo</span>
            <input
              className="entrada"
              value={borrador.nombre}
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
              placeholder="Tecnología"
              maxLength={40}
              autoFocus
            />
          </label>

          <div className="campo">
            <span className="campo__etiqueta">Icono</span>
            <div className="fila-emojis">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="emoji-opcion"
                  aria-pressed={borrador.emoji === e}
                  aria-label={`Icono ${e}`}
                  onClick={() => setBorrador({ ...borrador, emoji: e })}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <span className="campo__etiqueta">Color</span>
            <div className="fila-emojis">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="color-opcion"
                  style={{ background: c }}
                  aria-pressed={borrador.color === c}
                  aria-label={`Color ${c}`}
                  onClick={() => setBorrador({ ...borrador, color: c })}
                />
              ))}
            </div>
          </div>

          <label className="campo">
            <span className="campo__etiqueta">Familia</span>
            <select
              className="seleccion"
              value={borrador.familia}
              onChange={(e) => setBorrador({ ...borrador, familia: e.target.value as Familia })}
            >
              <option value="manualidad">Manualidad — una pieza hecha a mano</option>
              <option value="actividad">Actividad — una escena, como Diskofesta</option>
            </select>
          </label>

          <label className="campo">
            <span className="campo__etiqueta">Cuándo usarlo</span>
            <textarea
              className="area"
              rows={3}
              value={borrador.definicion}
              onChange={(e) => setBorrador({ ...borrador, definicion: e.target.value })}
              placeholder="Robots, circuitos, impresión 3D, programación con placas y cables."
              maxLength={300}
            />
            <span className="campo__ayuda">
              Es lo que lee el clasificador para decidir. Cuanto más concreto, mejor acierta.
            </span>
          </label>

          <div className="grupo-botones">
            <button
              type="button"
              className="boton boton--primario"
              disabled={!borrador.nombre.trim()}
              onClick={anadir}
            >
              Crear el tipo
            </button>
            <button
              type="button"
              className="boton boton--fantasma"
              onClick={() => {
                setBorrador(VACIO);
                setAbierto(false);
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {ajustes.categoriasPropias.length > 0 && (
        <AvisoLinea>
          Los tipos propios viajan con las fotos al catálogo compartido: quien abra la app desde otro
          dispositivo los verá igual, sin tener que crearlos.
        </AvisoLinea>
      )}
    </>
  );
}

/**
 * Crear un tipo sin salir de donde estás.
 *
 * Va dentro de las rejillas de categorías (al revisar y al rellenar la ficha),
 * que es justo el momento en que descubres que te falta uno: obligar a ir a
 * Ajustes ahí es perder el hilo de lo que estabas haciendo.
 */
export function CrearTipoRapido({ alCrear }: { alCrear(id: string): void }) {
  const tienda = useTienda();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [emoji, setEmoji] = useState('⭐');

  const crear = async () => {
    const limpio = nombre.trim();
    if (!limpio) return;

    const id = idDeCategoria(limpio);
    const yaEsta = tienda.ajustes.categoriasPropias.find((c) => c.id === id);
    if (yaEsta) {
      alCrear(yaEsta.id);
      setAbierto(false);
      setNombre('');
      return;
    }

    const nueva: CategoriaPropia = {
      id,
      nombre: limpio,
      emoji: emoji.trim() || '⭐',
      // El color sale de la propia lista, para que dos tipos seguidos no salgan
      // iguales sin tener que preguntar por algo que da igual ahora mismo.
      color: COLORES[tienda.ajustes.categoriasPropias.length % COLORES.length],
      definicion: limpio,
      familia: 'manualidad',
    };

    await tienda.guardarAjustes({
      ...tienda.ajustes,
      categoriasPropias: [...tienda.ajustes.categoriasPropias, nueva],
    });
    alCrear(id);
    setAbierto(false);
    setNombre('');
    tienda.avisar(`Tipo «${limpio}» creado. Puedes afinarlo en Ajustes.`, 'exito');
  };

  if (!abierto) {
    return (
      <button
        type="button"
        className="opcion-categoria opcion-categoria--nueva"
        onClick={() => setAbierto(true)}
      >
        <IconoMas style={{ width: 15, height: 15 }} />
        Crear un tipo
      </button>
    );
  }

  return (
    <div className="tipo-rapido">
      <div className="fila-emojis">
        {EMOJIS.slice(0, 6).map((e) => (
          <button
            key={e}
            type="button"
            className="emoji-opcion"
            aria-pressed={emoji === e}
            aria-label={`Icono ${e}`}
            onClick={() => setEmoji(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        className="entrada"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void crear()}
        placeholder="Nombre del tipo nuevo"
        aria-label="Nombre del tipo nuevo"
        maxLength={40}
        autoFocus
      />
      <div className="grupo-botones">
        <button
          type="button"
          className="boton boton--primario boton--pequeno"
          disabled={!nombre.trim()}
          onClick={() => void crear()}
        >
          Crear y usarlo
        </button>
        <button
          type="button"
          className="boton boton--fantasma boton--pequeno"
          onClick={() => { setAbierto(false); setNombre(''); }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
