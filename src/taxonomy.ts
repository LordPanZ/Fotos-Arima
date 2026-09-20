/**
 * Taxonomía del catálogo.
 *
 * Recoge dos cosas distintas: los tipos de manualidad y las actividades de
 * Arima (Diskofesta e Ihes Gela). El campo `familia` las separa, porque el
 * clasificador necesita reglas propias para cada una: una manualidad se
 * reconoce por la técnica, y una actividad por la escena.
 *
 * Es la referencia única para el clasificador (los `id` son los valores que
 * puede devolver el modelo), el agrupado de la galería y la plantilla de
 * nombres. Añadir una categoría aquí la propaga a toda la aplicación.
 */

export type Familia = 'manualidad' | 'actividad';

export interface Categoria {
  id: string;
  nombre: string;
  /** Frase corta que ve el modelo para decidir. Sé concreto: marca el límite. */
  definicion: string;
  emoji: string;
  /** Tono usado para la cabecera del grupo. */
  color: string;
  /** Palabras clave para búsqueda local y para el clasificador heurístico. */
  sinonimos: string[];
  /** `actividad` para lo que no es una pieza hecha a mano. */
  familia: Familia;
}

export const SIN_CLASIFICAR = 'sin-clasificar';
export const NO_MANUALIDAD = 'no-manualidad';

/**
 * Categoría creada a mano desde Ajustes. Lleva los mismos campos que una de
 * serie porque va a los mismos sitios: galería, revisión, nombres y prompt.
 */
export interface CategoriaPropia {
  id: string;
  nombre: string;
  emoji: string;
  color: string;
  /** Lo que el clasificador lee para decidir si una foto va aquí. */
  definicion: string;
  familia: Familia;
}

export const CATEGORIAS_BASE: Categoria[] = [
  {
    id: 'ganchillo-punto',
    nombre: 'Ganchillo y punto',
    definicion:
      'Crochet, ganchillo, tricot, dos agujas, amigurumi, lana y ovillos, mantas y prendas tejidas a mano.',
    emoji: '🧶',
    color: '#c2554a',
    sinonimos: ['ganchillo', 'crochet', 'punto', 'tricot', 'amigurumi', 'lana', 'ovillo', 'tejido', 'agujas', 'granny'],
    familia: 'manualidad',
  },
  {
    id: 'costura-textil',
    nombre: 'Costura y textil',
    definicion:
      'Costura, patchwork, fieltro, bordado, punto de cruz, tela pintada, muñecos de trapo, bolsas y ropa cosida a mano.',
    emoji: '🧵',
    color: '#b5548c',
    sinonimos: ['costura', 'coser', 'patchwork', 'fieltro', 'bordado', 'punto de cruz', 'tela', 'maquina de coser', 'quilt', 'acolchado'],
    familia: 'manualidad',
  },
  {
    id: 'macrame-fibras',
    nombre: 'Macramé y fibras',
    definicion:
      'Macramé, nudos decorativos, cestería, mimbre, rafia, esparto, telar, tapices de fibra y atrapasueños.',
    emoji: '🪢',
    color: '#a8763f',
    sinonimos: ['macrame', 'nudos', 'cesteria', 'mimbre', 'rafia', 'esparto', 'telar', 'tapiz', 'atrapasuenos', 'cuerda', 'yute'],
    familia: 'manualidad',
  },
  {
    id: 'ceramica-arcilla',
    nombre: 'Cerámica y arcilla',
    definicion:
      'Cerámica, barro, torno, porcelana fría, arcilla polimérica (fimo), pasta de modelar, piezas esmaltadas y modelado.',
    emoji: '🏺',
    color: '#9a6b4f',
    sinonimos: ['ceramica', 'arcilla', 'barro', 'torno', 'porcelana fria', 'fimo', 'polimerica', 'modelado', 'esmalte', 'alfareria', 'pasta'],
    familia: 'manualidad',
  },
  {
    id: 'pintura-dibujo',
    nombre: 'Pintura y dibujo',
    definicion:
      'Pintura sobre lienzo, madera, piedra o tela, acuarela, acrílico, lettering, mandalas, dibujo e ilustración hechos a mano.',
    emoji: '🎨',
    color: '#4a7fb5',
    sinonimos: ['pintura', 'pintar', 'acuarela', 'acrilico', 'lienzo', 'mandala', 'lettering', 'caligrafia', 'dibujo', 'pincel', 'oleo', 'piedras pintadas'],
    familia: 'manualidad',
  },
  {
    id: 'papel-carton',
    nombre: 'Papel y cartón',
    definicion:
      'Origami, papiroflexia, scrapbooking, quilling, cartonaje, tarjetas hechas a mano, papel maché, recortes y pop-up.',
    emoji: '📄',
    color: '#5d8f6f',
    sinonimos: ['papel', 'carton', 'origami', 'papiroflexia', 'scrapbook', 'quilling', 'cartonaje', 'tarjeta', 'papel mache', 'recorte', 'album'],
    familia: 'manualidad',
  },
  {
    id: 'madera-carpinteria',
    nombre: 'Madera y carpintería',
    definicion:
      'Carpintería y bricolaje en madera, pirograbado, talla, marquetería, palés reutilizados, cajas y muebles hechos a mano.',
    emoji: '🪵',
    color: '#8a6a3d',
    sinonimos: ['madera', 'carpinteria', 'pirograbado', 'talla', 'marqueteria', 'pale', 'sierra', 'lija', 'bricolaje', 'caja de madera'],
    familia: 'manualidad',
  },
  {
    id: 'joyeria-abalorios',
    nombre: 'Joyería y abalorios',
    definicion:
      'Bisutería artesanal, abalorios, cuentas, alambrismo, pendientes, collares, pulseras y anillos hechos a mano.',
    emoji: '💍',
    color: '#8b6bb5',
    sinonimos: ['joyeria', 'bisuteria', 'abalorio', 'cuentas', 'alambre', 'pendientes', 'collar', 'pulsera', 'anillo', 'mostacilla'],
    familia: 'manualidad',
  },
  {
    id: 'velas-jabones',
    nombre: 'Velas y jabones',
    definicion:
      'Velas artesanales, ceras, jabones hechos a mano, bombas de baño y cosmética artesanal.',
    emoji: '🕯️',
    color: '#c08a3e',
    sinonimos: ['vela', 'cera', 'jabon', 'saponificacion', 'bomba de bano', 'aroma', 'parafina', 'soja'],
    familia: 'manualidad',
  },
  {
    id: 'resina-epoxi',
    nombre: 'Resina epoxi',
    definicion:
      'Piezas de resina epoxi, moldes de silicona, inclusiones de flores secas, posavasos, bandejas y joyería de resina.',
    emoji: '💎',
    color: '#3f8f9a',
    sinonimos: ['resina', 'epoxi', 'molde', 'silicona', 'posavasos', 'inclusion', 'geode'],
    familia: 'manualidad',
  },
  {
    id: 'mosaico-vidrio',
    nombre: 'Mosaico y vidrio',
    definicion:
      'Mosaico, teselas, vidriera, vidrio tintado, fusing, botellas decoradas y espejos con mosaico.',
    emoji: '🔷',
    color: '#4f6fb5',
    sinonimos: ['mosaico', 'tesela', 'vidriera', 'vidrio', 'cristal', 'fusing', 'gresite', 'tiffany'],
    familia: 'manualidad',
  },
  {
    id: 'reciclaje-upcycling',
    nombre: 'Reciclaje y upcycling',
    definicion:
      'Objetos creados reutilizando materiales: botes, botellas, tapones, cápsulas, palés, ropa transformada, restauración de muebles.',
    emoji: '♻️',
    color: '#5f9b4a',
    sinonimos: ['reciclaje', 'reciclado', 'upcycling', 'reutilizar', 'bote', 'botella', 'tapon', 'capsula', 'restauracion', 'transformar'],
    familia: 'manualidad',
  },
  {
    id: 'decoracion-hogar',
    nombre: 'Decoración del hogar',
    definicion:
      'Coronas, centros de mesa, portavelas, cuadros decorativos, letreros y complementos decorativos hechos a mano.',
    emoji: '🖼️',
    color: '#b57f4a',
    sinonimos: ['decoracion', 'corona', 'centro de mesa', 'portavelas', 'cuadro', 'letrero', 'guirnalda', 'adorno', 'jarron'],
    familia: 'manualidad',
  },
  {
    id: 'fiesta-eventos',
    nombre: 'Fiestas y eventos',
    definicion:
      'Decoración de cumpleaños, bodas y celebraciones hecha a mano: piñatas, photocall, banderines, detalles para invitados.',
    emoji: '🎉',
    color: '#c2568f',
    sinonimos: ['fiesta', 'cumpleanos', 'boda', 'pinata', 'photocall', 'banderin', 'invitados', 'celebracion', 'evento'],
    familia: 'manualidad',
  },
  {
    id: 'navidad-estacional',
    nombre: 'Navidad y estacional',
    definicion:
      'Manualidades de temporada: Navidad, Halloween, Pascua, Día de la Madre, otoño. Adornos, belenes y calendarios de adviento.',
    emoji: '🎄',
    color: '#4a8f6a',
    sinonimos: ['navidad', 'navideno', 'halloween', 'pascua', 'belen', 'adviento', 'calabaza', 'huevo', 'otono', 'adorno navideno'],
    familia: 'manualidad',
  },
  {
    id: 'infantil-escolar',
    nombre: 'Infantil y escolar',
    definicion:
      'Manualidades hechas por o para niños: trabajos de colegio, plastilina, pintura de dedos, disfraces sencillos, material didáctico.',
    emoji: '🧒',
    color: '#c29a3e',
    sinonimos: ['infantil', 'ninos', 'colegio', 'escolar', 'plastilina', 'goma eva', 'disfraz', 'manualidad infantil', 'pompones'],
    familia: 'manualidad',
  },
  {
    id: 'flores-naturaleza',
    nombre: 'Flores y naturaleza',
    definicion:
      'Flores secas o prensadas, flores de papel o tela, terrarios, arreglos florales y composiciones con elementos naturales.',
    emoji: '🌿',
    color: '#679b55',
    sinonimos: ['flores', 'flor', 'seca', 'prensada', 'terrario', 'ramo', 'arreglo floral', 'hojas', 'suculenta'],
    familia: 'manualidad',
  },
  {
    id: 'otras-manualidades',
    nombre: 'Otras manualidades',
    definicion:
      'Es claramente una manualidad hecha a mano pero no encaja en ninguna categoría anterior.',
    emoji: '✨',
    color: '#7c7c8a',
    sinonimos: ['manualidad', 'artesania', 'handmade', 'hecho a mano', 'diy'],
    familia: 'manualidad',
  },

  {
    id: 'diskofesta',
    nombre: 'Diskofesta',
    definicion:
      'Fiesta con música y baile: pista de baile, bola de espejos, luces de colores, cañón de humo o confeti, ' +
      'DJ o equipo de sonido, grupos bailando, photocall de fiesta, gafas y complementos de disco.',
    emoji: '🪩',
    color: '#8e44c9',
    sinonimos: ['diskofesta', 'disko', 'disco', 'fiesta', 'baile', 'bailar', 'dj', 'musica', 'bola de espejos', 'luces', 'confeti', 'pista de baile'],
    familia: 'actividad',
  },
  {
    id: 'ihes-gela',
    nombre: 'Ihes Gela',
    definicion:
      'Sala de escape (escape room): sala temática decorada, candados y cerraduras, cofres y cajas con clave, ' +
      'pistas, acertijos y mapas, linternas, cuenta atrás, grupos resolviendo enigmas dentro de la sala.',
    emoji: '🗝️',
    color: '#2f7d8c',
    sinonimos: ['ihes gela', 'ihesgela', 'ihes', 'escape', 'escape room', 'sala de escape', 'candado', 'cofre', 'pista', 'enigma', 'acertijo', 'cerradura'],
    familia: 'actividad',
  },
];

/** Grupos especiales que no son tipos de manualidad pero sí cajones de la galería. */
export const CATEGORIAS_ESPECIALES: Record<string, Categoria> = {
  [SIN_CLASIFICAR]: {
    id: SIN_CLASIFICAR,
    nombre: 'Sin clasificar',
    definicion: 'Todavía no se ha analizado.',
    emoji: '⏳',
    color: '#8a8a8a',
    sinonimos: [],
    familia: 'manualidad',
  },
  [NO_MANUALIDAD]: {
    id: NO_MANUALIDAD,
    nombre: 'Descartadas (fuera del catálogo)',
    definicion: 'La foto no muestra ni una manualidad ni una actividad de Arima.',
    emoji: '🚫',
    color: '#8a8a8a',
    sinonimos: [],
    familia: 'manualidad',
  },
};

/*
 * Las categorías propias viven en Ajustes, pero se consultan desde toda la app
 * (galería, revisión, nombres, búsqueda, prompt) y desde funciones sueltas que
 * no tienen acceso al estado. Por eso hay un registro aquí, que la tienda
 * mantiene al día con `registrarCategoriasPropias` cada vez que cambian los
 * ajustes. Es la única variable mutable del módulo y solo la escribe la tienda.
 */
let propias: Categoria[] = [];
let todas: Categoria[] = CATEGORIAS_BASE;
let porId = construirIndice();

function construirIndice(): Map<string, Categoria> {
  return new Map<string, Categoria>([
    ...todas.map((c) => [c.id, c] as const),
    ...Object.values(CATEGORIAS_ESPECIALES).map((c) => [c.id, c] as const),
  ]);
}

/** Convierte un nombre escrito a mano en un identificador estable. */
export function idDeCategoria(nombre: string): string {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  // Prefijo para que nunca choque con una categoría de serie, ni hoy ni cuando
  // se añadan más: una colisión reetiquetaría fotos ajenas al sincronizar.
  return limpio ? `propia-${limpio}` : `propia-${Date.now().toString(36)}`;
}

export function esCategoriaPropia(id: string): boolean {
  return id.startsWith('propia-');
}

export function registrarCategoriasPropias(lista: CategoriaPropia[]): void {
  // Una categoría propia nunca puede tapar a una de serie ni a las especiales.
  const reservados = new Set([...CATEGORIAS_BASE.map((c) => c.id), ...Object.keys(CATEGORIAS_ESPECIALES)]);
  const vistos = new Set<string>();

  propias = [];
  for (const c of lista) {
    if (!c.id || reservados.has(c.id) || vistos.has(c.id)) continue;
    vistos.add(c.id);
    propias.push({
      id: c.id,
      nombre: c.nombre,
      definicion: c.definicion,
      emoji: c.emoji,
      color: c.color,
      sinonimos: [c.nombre.toLowerCase()],
      familia: c.familia,
    });
  }

  todas = [...CATEGORIAS_BASE, ...propias];
  porId = construirIndice();
}

/** Todas las categorías elegibles: las de serie y las creadas a mano. */
export function listaCategorias(): Categoria[] {
  return todas;
}

export function categoria(id: string | null | undefined): Categoria {
  return (id && porId.get(id)) || CATEGORIAS_ESPECIALES[SIN_CLASIFICAR];
}

/** `true` si el identificador no corresponde a ninguna categoría conocida. */
export function categoriaDesconocida(id: string | null | undefined): boolean {
  return Boolean(id) && !porId.has(id as string);
}

export function idsCategorias(): string[] {
  return todas.map((c) => c.id);
}

/** Listado compacto que se le pasa al modelo dentro del prompt. */
export function taxonomiaParaPrompt(familia?: Familia): string {
  const lista = familia ? todas.filter((c) => c.familia === familia) : todas;
  return lista.map((c) => `- ${c.id}: ${c.nombre}. ${c.definicion}`).join('\n');
}

export function esActividad(id: string): boolean {
  return categoria(id).familia === 'actividad';
}
