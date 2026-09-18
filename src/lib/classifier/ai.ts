import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { IDS_CATEGORIAS, NO_MANUALIDAD, taxonomiaParaPrompt } from '../../taxonomy';
import type { Ajustes, ResultadoClasificacion } from '../../types';
import { aBase64, reescalar } from '../image';

const VALORES_CATEGORIA: [string, ...string[]] = [NO_MANUALIDAD, ...IDS_CATEGORIAS];

const EsquemaClasificacion = z.object({
  es_manualidad: z
    .boolean()
    .describe('true solo si la foto muestra una manualidad, su proceso o sus materiales.'),
  confianza: z
    .number()
    .describe('Seguridad de la decisión anterior, de 0 a 1. Calibrada, no optimista.'),
  categoria: z
    .enum(VALORES_CATEGORIA)
    .describe('Identificador exacto de la categoría, o "no-manualidad".'),
  categoria_alternativa: z
    .enum(VALORES_CATEGORIA)
    .nullable()
    .describe('Segunda opción si la pieza podría encajar en otra categoría; si no, null.'),
  tecnica: z.string().describe('Técnica concreta en español, 1-4 palabras. Cadena vacía si no se aprecia.'),
  materiales: z.array(z.string()).describe('Hasta 4 materiales visibles, en español y en minúsculas.'),
  colores: z.array(z.string()).describe('Hasta 3 colores dominantes, en español y en minúsculas.'),
  etiquetas: z.array(z.string()).describe('Hasta 6 etiquetas de búsqueda en español, en minúsculas.'),
  descripcion: z
    .string()
    .describe('Descripción de la pieza en 3-6 palabras, en español, sin punto final. Va en el nombre del archivo.'),
  motivo: z.string().describe('Una frase explicando la decisión.'),
});

const INSTRUCCIONES = `Eres el catalogador de un archivo de fotografías de manualidades. Tu trabajo tiene dos partes: decidir si la foto entra en el catálogo y, si entra, clasificarla por tipo de manualidad.

ENTRA EN EL CATÁLOGO (es_manualidad = true):
- Una pieza artesanal terminada, hecha a mano.
- Una labor a medio hacer, con la pieza reconocible.
- Materiales o herramientas preparados para trabajar, o una mesa de taller en uso.
- Un primer plano o detalle de una pieza hecha a mano.
- Una persona sosteniendo o luciendo una pieza hecha a mano, cuando la pieza es el asunto de la foto.
- Un puesto, expositor o mesa con varias piezas artesanales.

NO ENTRA (es_manualidad = false, categoria = "no-manualidad"):
- Retratos, selfies y fotos de grupo donde no se ve ninguna pieza hecha a mano.
- Paisajes, edificios, viajes, animales y plantas sin intervención artesanal.
- Comida y recetas. La repostería no es una manualidad en este catálogo.
- Capturas de pantalla, documentos, tickets, facturas, carteles de texto, memes e imágenes descargadas.
- Productos industriales o comprados en una tienda, escaparates y catálogos.
- Interiores y muebles de serie sin ninguna pieza artesanal destacada.
- Fotos tan borrosas, oscuras o desenfocadas que no permiten identificar nada.

CÓMO CALIBRAR LA CONFIANZA:
- 0.90-1.00: es inequívoco, la pieza se ve con claridad y la categoría no admite duda.
- 0.65-0.89: se ve la pieza pero hay algo de ambigüedad (encuadre parcial, poca luz, categoría discutible).
- 0.40-0.64: podría serlo o no. Ejemplos típicos: un retrato con una pieza pequeña al fondo, un objeto que igual está comprado, una foto muy recortada.
- 0.00-0.39: casi con seguridad no es una manualidad.
No infles la confianza: por debajo del umbral la foto pasa a revisión manual, que es exactamente donde deben acabar las dudosas.

CATEGORÍAS DISPONIBLES (usa el identificador exacto):
${taxonomiaParaPrompt()}

REGLAS DE CATEGORÍA:
- Elige la categoría por la técnica dominante, no por el motivo representado. Un ángel de ganchillo es "ganchillo-punto", no "navidad-estacional".
- "navidad-estacional", "fiesta-eventos" e "infantil-escolar" solo cuando el contexto de la celebración o del trabajo escolar pesa más que la técnica.
- Usa "otras-manualidades" únicamente si es claramente artesanía hecha a mano y ninguna categoría encaja.
- Rellena "categoria_alternativa" siempre que la pieza pudiera clasificarse razonablemente en otra categoría.

LA DESCRIPCIÓN:
Se usará como nombre del archivo, así que escribe un sintagma nominal breve y concreto en español: "colgante de pared beige", "tazas esmaltadas en azul", "guirnalda de flores de papel". Nada de frases completas, comillas ni punto final. Si no es una manualidad, describe brevemente lo que sí se ve.`;

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

  const esManualidad = ficha.es_manualidad && ficha.categoria !== NO_MANUALIDAD;
  const confianza = Math.min(1, Math.max(0, Number(ficha.confianza) || 0));

  return {
    esManualidad,
    confianza,
    categoria: esManualidad ? ficha.categoria : NO_MANUALIDAD,
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
