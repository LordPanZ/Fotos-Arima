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
import { sincronizar as sincronizarNube, type ResumenSync } from '../lib/sync';

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
  sincronizando: boolean;
  /** Cambios locales que el catálogo compartido todavía no ha visto. */
  sinSubir: number;
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

  sincronizar(silencioso?: boolean): Promise<void>;
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
  const [sincronizando, setSincronizando] = useState(false);
  const [sinSubir, setSinSubir] = useState(0);

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

  const contarPendientes = useCallback(async () => {
    setSinSubir((await db.listarPendientes()).length);
  }, []);

  const recargar = useCallback(async () => {
    const [guardadas, guardados] = await Promise.all([db.listarFotos(), db.leerAjustes()]);
    setFotos(guardadas);
    setAjustes(guardados);
    setSinSubir((await db.listarPendientes()).length);
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

  const anadirFotos = useCallback(
    (nuevas: Foto[]) => {
      if (!nuevas.length) return;
      setFotos((previas) => {
        const porId = new Map(previas.map((f) => [f.id, f]));
        for (const foto of nuevas) porId.set(foto.id, foto);
        return [...porId.values()];
      });
      void db
        .marcarPendientes(nuevas.map((f) => f.id), 'guardar')
        .then(contarPendientes);
    },
    [contarPendientes],
  );

  const fusionar = useCallback((cambios: Foto[]) => {
    if (!cambios.length) return;
    setFotos((previas) => {
      const porId = new Map(cambios.map((f) => [f.id, f]));
      return previas.map((f) => porId.get(f.id) ?? f);
    });
  }, []);

  /** Toda escritura local sella la marca de tiempo y entra en la cola de subida. */
  const registrar = useCallback(
    async (cambios: Foto[]) => {
      const sellados = cambios.map((f) => ({ ...f, actualizadaEn: new Date().toISOString() }));
      fusionar(sellados);
      await db.guardarFotos(sellados);
      await db.marcarPendientes(sellados.map((f) => f.id), 'guardar');
      await contarPendientes();
      return sellados;
    },
    [fusionar, contarPendientes],
  );

  const actualizarFoto = useCallback(
    async (foto: Foto) => {
      await registrar([foto]);
    },
    [registrar],
  );

  const actualizarFotos = useCallback(
    async (cambios: Foto[]) => {
      await registrar(cambios);
    },
    [registrar],
  );

  const eliminarFotos = useCallback(async (ids: string[]) => {
    // La lápida viaja al otro aparato; sin ella volvería a bajarse la foto.
    await db.marcarPendientes(ids, 'borrar');
    await db.borrarFotos(ids);
    await contarPendientes();
    const conjunto = new Set(ids);
    setFotos((previas) => previas.filter((f) => !conjunto.has(f.id)));
    setSeleccion((previa) => {
      const copia = new Set(previa);
      for (const id of ids) copia.delete(id);
      return copia;
    });
  }, [contarPendientes]);

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
            await registrar([foto]);
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
    [ajustes, avisar, registrar],
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

  const sincronizar = useCallback(
    async (silencioso = false) => {
      if (sincronizando) return;
      setSincronizando(true);
      try {
        const resumen: ResumenSync = await sincronizarNube();
        if (resumen.bajadas || resumen.borradasFuera) await recargar();
        else await contarPendientes();

        if (!silencioso) {
          const partes: string[] = [];
          if (resumen.subidas) partes.push(`${resumen.subidas} enviadas`);
          if (resumen.bajadas) partes.push(`${resumen.bajadas} recibidas`);
          if (resumen.borradasFuera) partes.push(`${resumen.borradasFuera} borradas fuera`);
          avisar(
            partes.length ? `Sincronizado: ${partes.join(', ')}.` : 'Todo estaba al día.',
            resumen.errores.length ? 'error' : 'exito',
          );
        }
        if (resumen.errores.length && !silencioso) avisar(resumen.errores[0], 'error');
      } catch (error) {
        if (!silencioso) avisar(error instanceof Error ? error.message : String(error), 'error');
      } finally {
        setSincronizando(false);
      }
    },
    [sincronizando, recargar, contarPendientes, avisar],
  );

  // Al abrir la app y al volver a ella. Es cuando puede haber cambios del otro
  // aparato, y evita sincronizar en bucle mientras se trabaja.
  useEffect(() => {
    if (cargando) return;
    void sincronizar(true);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void sincronizar(true);
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alVolver);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alVolver);
    };
    // Solo debe rearmarse al terminar la carga inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  const pedirCompartir = useCallback(
    (objetivo: Foto[]) => setCompartiendo(objetivo.length ? objetivo : null),
    [],
  );
  const cerrarCompartir = useCallback(() => setCompartiendo(null), []);

  const valor = useMemo<Contexto>(
    () => ({
      cargando, fotos, ajustes, progreso, seleccion, avisos, compartiendo,
      sincronizando, sinSubir, sincronizar,
      avisar, cerrarAviso, recargar, anadirFotos, actualizarFoto, actualizarFotos,
      eliminarFotos, guardarAjustes, analizar, cancelarAnalisis, renombrarConPlantilla,
      alternarSeleccion, seleccionar, limpiarSeleccion, pedirCompartir, cerrarCompartir,
    }),
    [
      cargando, fotos, ajustes, progreso, seleccion, avisos, compartiendo,
      sincronizando, sinSubir, sincronizar,
      sincronizando, sinSubir, sincronizar,
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
