import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Ajustes, Foto, ProgresoAnalisis } from '../types';
import { AJUSTES_POR_DEFECTO } from '../types';
import * as db from '../lib/db';
import { analizarLote } from '../lib/classifier';
import { renombrarLote } from '../lib/naming';

export interface Aviso {
  id: number;
  texto: string;
  tono: 'info' | 'exito' | 'error';
}

interface Estado {
  cargando: boolean;
  fotos: Foto[];
  ajustes: Ajustes;
  progreso: ProgresoAnalisis;
  seleccion: Set<string>;
  avisos: Aviso[];
  /** Fotos en espera de que se elija cómo compartirlas. */
  compartiendo: Foto[] | null;
}

interface Acciones {
  avisar(texto: string, tono?: Aviso['tono']): void;
  cerrarAviso(id: number): void;

  recargar(): Promise<void>;
  anadirFotos(nuevas: Foto[]): void;
  actualizarFoto(foto: Foto): Promise<void>;
  actualizarFotos(fotos: Foto[]): Promise<void>;
  eliminarFotos(ids: string[]): Promise<void>;
  guardarAjustes(ajustes: Ajustes): Promise<void>;

  analizar(fotos: Foto[]): Promise<void>;
  cancelarAnalisis(): void;
  renombrarConPlantilla(fotos: Foto[], forzar?: boolean): Promise<number>;

  alternarSeleccion(id: string): void;
  seleccionar(ids: string[]): void;
  limpiarSeleccion(): void;

  pedirCompartir(fotos: Foto[]): void;
  cerrarCompartir(): void;
}

type Contexto = Estado & Acciones;

const ContextoTienda = createContext<Contexto | null>(null);

const PROGRESO_INACTIVO: ProgresoAnalisis = { activo: false, hechas: 0, total: 0, errores: 0 };

export function ProveedorTienda({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  const [progreso, setProgreso] = useState<ProgresoAnalisis>(PROGRESO_INACTIVO);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [compartiendo, setCompartiendo] = useState<Foto[] | null>(null);

  const abortador = useRef<AbortController | null>(null);
  const siguienteAviso = useRef(1);

  const avisar = useCallback((texto: string, tono: Aviso['tono'] = 'info') => {
    const id = siguienteAviso.current;
    siguienteAviso.current += 1;
    setAvisos((previos) => [...previos, { id, texto, tono }]);
    setTimeout(() => setAvisos((previos) => previos.filter((a) => a.id !== id)), 6000);
  }, []);

  const cerrarAviso = useCallback((id: number) => {
    setAvisos((previos) => previos.filter((a) => a.id !== id));
  }, []);

  const recargar = useCallback(async () => {
    const [guardadas, guardados] = await Promise.all([db.listarFotos(), db.leerAjustes()]);
    setFotos(guardadas);
    setAjustes(guardados);
    setCargando(false);
  }, []);

  useEffect(() => {
    recargar().catch((error) => {
      setCargando(false);
      avisar(
        `No se ha podido abrir el catálogo guardado: ${
          error instanceof Error ? error.message : String(error)
        }`,
        'error',
      );
    });
  }, [recargar, avisar]);

  const anadirFotos = useCallback((nuevas: Foto[]) => {
    if (!nuevas.length) return;
    setFotos((previas) => {
      const porId = new Map(previas.map((f) => [f.id, f]));
      for (const foto of nuevas) porId.set(foto.id, foto);
      return [...porId.values()];
    });
  }, []);

  const fusionar = useCallback((cambios: Foto[]) => {
    if (!cambios.length) return;
    setFotos((previas) => {
      const porId = new Map(cambios.map((f) => [f.id, f]));
      return previas.map((f) => porId.get(f.id) ?? f);
    });
  }, []);

  const actualizarFoto = useCallback(
    async (foto: Foto) => {
      fusionar([foto]);
      await db.guardarFoto(foto);
    },
    [fusionar],
  );

  const actualizarFotos = useCallback(
    async (cambios: Foto[]) => {
      fusionar(cambios);
      await db.guardarFotos(cambios);
    },
    [fusionar],
  );

  const eliminarFotos = useCallback(async (ids: string[]) => {
    await db.borrarFotos(ids);
    const conjunto = new Set(ids);
    setFotos((previas) => previas.filter((f) => !conjunto.has(f.id)));
    setSeleccion((previa) => {
      const copia = new Set(previa);
      for (const id of ids) copia.delete(id);
      return copia;
    });
  }, []);

  const guardarAjustes = useCallback(async (nuevos: Ajustes) => {
    setAjustes(nuevos);
    await db.escribirAjustes(nuevos);
  }, []);

  const cancelarAnalisis = useCallback(() => {
    abortador.current?.abort();
    abortador.current = null;
    setProgreso(PROGRESO_INACTIVO);
  }, []);

  const analizar = useCallback(
    async (objetivo: Foto[]) => {
      if (!objetivo.length) {
        avisar('No hay fotos pendientes de analizar.');
        return;
      }
      if (abortador.current) {
        avisar('Ya hay un análisis en marcha.');
        return;
      }

      const control = new AbortController();
      abortador.current = control;

      try {
        const resumen = await analizarLote({
          fotos: objetivo,
          ajustes,
          senal: control.signal,
          alProgresar: setProgreso,
          alTerminarFoto: async (foto) => {
            fusionar([foto]);
            await db.guardarFoto(foto);
          },
        });

        if (resumen.abortadoPor) {
          avisar(`Análisis detenido: ${resumen.abortadoPor}`, 'error');
        } else if (resumen.cancelado) {
          avisar(`Análisis cancelado tras ${resumen.hechas} fotos.`);
        } else if (resumen.errores) {
          avisar(
            `Analizadas ${resumen.hechas} fotos, ${resumen.errores} con error.`,
            'error',
          );
        } else {
          avisar(`Analizadas ${resumen.hechas} fotos.`, 'exito');
        }
      } catch (error) {
        avisar(error instanceof Error ? error.message : String(error), 'error');
      } finally {
        abortador.current = null;
        setProgreso(PROGRESO_INACTIVO);
      }
    },
    [ajustes, avisar, fusionar],
  );

  const renombrarConPlantilla = useCallback(
    async (objetivo: Foto[], forzar = false) => {
      const cambios = renombrarLote(objetivo, ajustes.plantillaNombre, forzar);
      if (cambios.length) await actualizarFotos(cambios);
      return cambios.length;
    },
    [ajustes.plantillaNombre, actualizarFotos],
  );

  const alternarSeleccion = useCallback((id: string) => {
    setSeleccion((previa) => {
      const copia = new Set(previa);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }, []);

  const seleccionar = useCallback((ids: string[]) => setSeleccion(new Set(ids)), []);
  const limpiarSeleccion = useCallback(() => setSeleccion(new Set()), []);

  const pedirCompartir = useCallback(
    (objetivo: Foto[]) => setCompartiendo(objetivo.length ? objetivo : null),
    [],
  );
  const cerrarCompartir = useCallback(() => setCompartiendo(null), []);

  const valor = useMemo<Contexto>(
    () => ({
      cargando, fotos, ajustes, progreso, seleccion, avisos, compartiendo,
      avisar, cerrarAviso, recargar, anadirFotos, actualizarFoto, actualizarFotos,
      eliminarFotos, guardarAjustes, analizar, cancelarAnalisis, renombrarConPlantilla,
      alternarSeleccion, seleccionar, limpiarSeleccion, pedirCompartir, cerrarCompartir,
    }),
    [
      cargando, fotos, ajustes, progreso, seleccion, avisos, compartiendo,
      avisar, cerrarAviso, recargar, anadirFotos, actualizarFoto, actualizarFotos,
      eliminarFotos, guardarAjustes, analizar, cancelarAnalisis, renombrarConPlantilla,
      alternarSeleccion, seleccionar, limpiarSeleccion, pedirCompartir, cerrarCompartir,
    ],
  );

  return <ContextoTienda.Provider value={valor}>{children}</ContextoTienda.Provider>;
}

export function useTienda(): Contexto {
  const contexto = useContext(ContextoTienda);
  if (!contexto) throw new Error('useTienda debe usarse dentro de <ProveedorTienda>.');
  return contexto;
}
