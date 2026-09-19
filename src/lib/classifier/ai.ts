import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { IDS_CATEGORIAS, NO_MANUALIDAD, taxonomiaParaPrompt } from '../../taxonomy';
import type { Ajustes, ResultadoClasificacion } from '../../types';
import { aBase64, reescalar } from '../image';

const VALORES_CATEGORIA: [string, ...string[]] = [NO_MANUALIDAD, ...IDS_CATEGORIAS];

const EsquemaClasificacion = z.object({
  entra_en_catalogo: z
    .boolean()
    .describe(
      'true si la foto muestra una manualidad (pieza, proceso o materiales) o una actividad de Arima ' +
        '(Diskofesta o Ihes Gela). false en cualquier otro caso.',
    ),
  confianza: z
    .number()
    .describe('Seguridad de la decisión anterior, de 0 a 1. Calibrada, no optimista.'),
  categoria: z
    .enum(VALORES_CATEGORIA)
    .describe('Identificador exacto de la categoría, o "no-manualidad" si no entra en el catálogo.'),
  categoria_alternativa: z
    .enum(VALORES_CATEGORIA)
    .nullable()
    .describe('Segunda opción si la pieza podría encajar en otra categoría; si no, null.'),
  tecnica: z
    .string()
    .describe(
      'Para una manualidad, la técnica concreta en español (1-4 palabras). Para una actividad, el momento ' +
        'o la escena («pista de baile», «resolviendo el candado»). Cadena vacía si no se aprecia.',
    ),
  materiales: z
    .array(z.string())
    .describe(
      'Hasta 4 materiales visibles en una manualidad, o elementos destacados de la escena en una ' +
        'actividad, en español y en minúsculas.',
    ),
  colores: z.array(z.string()).describe('Hasta 3 colores dominantes, en español y en minúsculas.'),
  etiquetas: z.array(z.string()).describe('Hasta 6 etiquetas de búsqueda en español, en minúsculas.'),
  descripcion: z
    .string()
    .describe(
      'Descripción de la pieza o de la escena en 3-6 palabras, en español, sin punto final. ' +
        'Va en el nombre del archivo.',
    ),
  motivo: z.string().describe('Una frase explicando la decisión.'),
});

const INSTRUCCIONES = `Eres el catalogador del archivo fotográfico de Arima. Tu trabajo tiene dos partes: decidir si la foto entra en el catálogo y, si entra, clasificarla.

El catálogo recoge DOS COSAS DISTINTAS:

A) MANUALIDADES — piezas hechas a mano y su proceso.
B) ACTIVIDADES DE ARIMA — dos actividades concretas, que no son manualidades pero también se catalogan:
   · Diskofesta: la fiesta con música y baile.
   · Ihes Gela: la sala de escape (escape room).

ENTRA EN EL CATÁLOGO (entra_en_catalogo = true) si se cumple A o B.

A) Cuenta como manualidad:
- Una pieza artesanal terminada, hecha a mano.
- Una labor a medio hacer, con la pieza reconocible.
- Materiales o herramientas preparados para trabajar, o una mesa de taller en uso.
- Un primer plano o detalle de una pieza hecha a mano.
- Una persona sosteniendo o luciendo una pieza hecha a mano, cuando la pieza es el asunto de la foto.
- Un puesto, expositor o mesa con varias piezas artesanales.

B) Cuenta como actividad:
- Diskofesta: pista de baile, bola de espejos, luces de colores, humo o confeti, DJ o equipo de sonido,
  grupos bailando, photocall de fiesta, complementos de disco (gafas, pelucas, luminosos).
- Ihes Gela: sala temática decorada, candados y cerraduras, cofres o cajas con clave, pistas, acertijos,
  mapas, linternas, cuenta atrás, grupos resolviendo enigmas dentro de la sala.
- En las actividades SÍ se cataloga a la gente participando: aquí el asunto de la foto es la escena, no un objeto.

NO ENTRA (entra_en_catalogo = false, categoria = "no-manualidad"):
- Retratos, selfies y fotos de grupo posando fuera de una actividad, sin pieza ni escena reconocible.
- Paisajes, edificios, viajes, animales y plantas sin intervención artesanal.
- Comida y recetas. La repostería no es una manualidad en este catálogo.
- Capturas de pantalla, documentos, tickets, facturas, carteles de texto, memes e imágenes descargadas.
- Productos industriales o comprados en una tienda, escaparates y catálogos.
- Interiores y muebles de serie sin ninguna pieza artesanal destacada.
- Una fiesta o un local cualquiera que no sea reconociblemente una Diskofesta o una Ihes Gela.
- Fotos tan borrosas, oscuras o desenfocadas que no permiten identificar nada.

CÓMO DISTINGUIR LAS DOS ACTIVIDADES:
- Diskofesta es luz, color, música y movimiento: se baila.
- Ihes Gela es una sala cerrada con objetos que esconden un enigma: se resuelve.
- Si hay una manualidad hecha DURANTE una actividad y la pieza es el asunto de la foto, clasifícala por su
  técnica y pon la actividad en "categoria_alternativa".

CÓMO CALIBRAR LA CONFIANZA:
- 0.90-1.00: es inequívoco, se ve con claridad y la categoría no admite duda.
- 0.65-0.89: se reconoce pero hay algo de ambigüedad (encuadre parcial, poca luz, categoría discutible).
- 0.40-0.64: podría serlo o no. Ejemplos típicos: un retrato con una pieza pequeña al fondo, una fiesta que
  no se distingue de una Diskofesta, una sala decorada que quizá no sea una Ihes Gela.
- 0.00-0.39: casi con seguridad no entra en el catálogo.
No infles la confianza: por debajo del umbral la foto pasa a revisión manual, que es exactamente donde deben
acabar las dudosas.

CATEGORÍAS DISPONIBLES (usa el identificador exacto):
${taxonomiaParaPrompt()}

REGLAS DE CATEGORÍA:
- En manualidades, elige por la técnica dominante, no por el motivo representado. Un ángel de ganchillo es
  "ganchillo-punto", no "navidad-estacional".
- "navidad-estacional", "fiesta-eventos" e "infantil-escolar" solo cuando el contexto de la celebración o del
  trabajo escolar pesa más que la técnica. Ojo: una Diskofesta va en "diskofesta", nunca en "fiesta-eventos",
  que es para la decoración hecha a mano de una celebración.
- Usa "otras-manualidades" únicamente si es claramente artesanía hecha a mano y ninguna categoría encaja.
- Rellena "categoria_alternativa" siempre que pudiera clasificarse razonablemente en otra categoría.

LA DESCRIPCIÓN:
Se usará como nombre del archivo, así que escribe un sintagma nominal breve y concreto en español:
"colgante de pared beige", "tazas esmaltadas en azul", "pista de baile con confeti", "abriendo el cofre con
la clave". Nada de frases completas, comillas ni punto final. Si no entra en el catálogo, describe
brevemente lo que sí se ve.`;

const ESFUERZO: Record<Ajustes['precision'], 'low' | 'medium' | 'high'> = {
  rapida: 'low',
  equilibrada: 'medium',
  maxima: 'high',
};

/** Lado mayor de la copia que se envía al modelo: suficiente para reconocer la técnica. */
const LADO_ANALISIS = 768;

let clienteCacheado: { clave: string; cliente: Anthropic } | null = null;

function cliente(clave: string): Anthropic {
  if (clienteCacheado?.clave === clave) return clienteCacheado.cliente;
  const nuevo = new Anthropic({
    apiKey: clave,
    // La clave la introduce la persona dueña de la cuenta y se queda en su
    // dispositivo. Ver docs/COMO-FUNCIONA.md para el porqué y sus límites.
    dangerouslyAllowBrowser: true,
    maxRetries: 3,
  });
  clienteCacheado = { clave, cliente: nuevo };
  return nuevo;
}

function normalizarLista(valores: unknown, maximo: number): string[] {
  if (!Array.isArray(valores)) return [];
  return valores
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, maximo);
}

export function hayClaveIA(ajustes: Ajustes): boolean {
  return ajustes.usarIA && ajustes.anthropicApiKey.trim().length > 0;
}

/** Analiza una foto con Claude y devuelve la ficha del catálogo. */
export async function clasificarConIA(
  imagen: Blob,
  ajustes: Ajustes,
  senal?: AbortSignal,
): Promise<ResultadoClasificacion> {
  const { blob } = await reescalar(imagen, LADO_ANALISIS, 0.82, true);
  const datos = await aBase64(blob);

  const respuesta = await cliente(ajustes.anthropicApiKey.trim()).beta.messages.parse(
    {
      model: ajustes.modelo,
      max_tokens: 3000,
      system: INSTRUCCIONES,
      output_config: { effort: ESFUERZO[ajustes.precision] },
      output_format: betaZodOutputFormat(EsquemaClasificacion),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: datos } },
            { type: 'text', text: 'Cataloga esta fotografía siguiendo las instrucciones.' },
          ],
        },
      ],
    },
    { signal: senal },
  );

  if (respuesta.stop_reason === 'refusal') {
    throw new Error('El modelo no ha querido analizar esta imagen.');
  }

  const ficha = respuesta.parsed_output;
  if (!ficha) {
    throw new Error('La respuesta del modelo no se ha podido interpretar. Reinténtalo.');
  }

  const entraEnCatalogo = ficha.entra_en_catalogo && ficha.categoria !== NO_MANUALIDAD;
  const confianza = Math.min(1, Math.max(0, Number(ficha.confianza) || 0));

  return {
    entraEnCatalogo,
    confianza,
    categoria: entraEnCatalogo ? ficha.categoria : NO_MANUALIDAD,
    categoriaAlternativa:
      ficha.categoria_alternativa && ficha.categoria_alternativa !== ficha.categoria
        ? ficha.categoria_alternativa
        : undefined,
    tecnica: ficha.tecnica?.trim() || undefined,
    materiales: normalizarLista(ficha.materiales, 4),
    colores: normalizarLista(ficha.colores, 3),
    etiquetas: normalizarLista(ficha.etiquetas, 6),
    descripcion: ficha.descripcion?.trim() ?? '',
    motivo: ficha.motivo?.trim() || undefined,
    motor: 'ia',
  };
}

/** Comprueba que la clave funciona antes de lanzar un análisis largo. */
export async function probarClave(ajustes: Ajustes): Promise<void> {
  await cliente(ajustes.anthropicApiKey.trim()).models.retrieve(ajustes.modelo);
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'La clave de la API de Claude no es válida. Revísala en Ajustes.';
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'La clave no tiene permiso para usar este modelo.';
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Se ha alcanzado el límite de peticiones. Baja la concurrencia en Ajustes o espera un minuto.';
  }
  if (error instanceof Anthropic.NotFoundError) {
    return 'El modelo indicado no existe o no está disponible para tu cuenta.';
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'No se ha podido conectar con la API de Claude. Comprueba tu conexión.';
  }
  if (error instanceof Anthropic.APIError) {
    return `La API de Claude ha respondido ${error.status ?? 'un error'}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}
