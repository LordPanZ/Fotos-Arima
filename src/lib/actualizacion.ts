/**
 * Mantener la copia instalada al día, y que se note.
 *
 * El service worker guarda la app entera para que funcione sin conexión; el
 * efecto secundario es que el dispositivo puede seguir con una versión vieja
 * sin que nadie se entere, y desde fuera parece que «los cambios no han
 * llegado». Eso es justo lo que pasó.
 *
 * El registro es de tipo `autoUpdate`: en cuanto se encuentra una versión
 * nueva se aplica sola y la página se recarga. Lo que faltaba es que esa
 * comprobación ocurriera a menudo: de serie solo se hace al registrar, y una
 * app instalada puede pasar días sin volver a cargarse del todo. Aquí se
 * comprueba además al volver a ella, al recuperar la conexión y a mano desde
 * Ajustes.
 */
import { registerSW } from 'virtual:pwa-register';

/** Marca de la compilación. La inyecta Vite al construir. */
export const VERSION: string = __VERSION__;

type Escucha = (actualizando: boolean) => void;

const escuchas = new Set<Escucha>();
let actualizando = false;
let registro: ServiceWorkerRegistration | undefined;

function anunciar(): void {
  for (const escucha of escuchas) escucha(actualizando);
}

/** Avisa mientras se está aplicando una versión nueva (la página se recargará). */
export function alActualizar(escucha: Escucha): () => void {
  escuchas.add(escucha);
  escucha(actualizando);
  return () => {
    escuchas.delete(escucha);
  };
}

export function iniciarActualizaciones(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registro = reg;
      if (!reg) return;

      reg.addEventListener('updatefound', () => {
        actualizando = true;
        anunciar();
      });

      const comprobar = () => {
        if (document.visibilityState === 'visible') void buscarActualizacion();
      };
      document.addEventListener('visibilitychange', comprobar);
      window.addEventListener('online', comprobar);
    },
  });
}

/**
 * Pregunta al servidor si hay una versión nueva. Si la hay, el propio service
 * worker la aplica y recarga la página, así que esto no siempre vuelve.
 */
export async function buscarActualizacion(): Promise<void> {
  if (!registro) return;
  try {
    await registro.update();
  } catch {
    // Sin conexión, o el navegador no deja: no es un error que contar.
  }
}

/** Recarga saltándose la copia guardada. Último recurso desde Ajustes. */
export function recargarSinCache(): void {
  window.location.reload();
}
