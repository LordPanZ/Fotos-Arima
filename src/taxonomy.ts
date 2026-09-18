/**
 * Taxonomía de tipos de manualidad.
 *
 * Es la referencia única para: el clasificador (los `id` son los valores que
 * puede devolver el modelo), el agrupado de la galería y la plantilla de
 * nombres. Añadir una categoría aquí la propaga a toda la aplicación.
 */

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
}

export const SIN_CLASIFICAR = 'sin-clasificar';
export const NO_MANUALIDAD = 'no-manualidad';

export const CATEGORIAS: Categoria[] = [
  {
    id: 'ganchillo-punto',
    nombre: 'Ganchillo y punto',
    definicion:
      'Crochet, ganchillo, tricot, dos agujas, amigurumi, lana y ovillos, mantas y prendas tejidas a mano.',
    emoji: '🧶',
    color: '#c2554a',
    sinonimos: ['ganchillo', 'crochet', 'punto', 'tricot', 'amigurumi', 'lana', 'ovillo', 'tejido', 'agujas', 'granny'],
  },
  {
    id: 'costura-textil',
    nombre: 'Costura y textil',
    definicion:
      'Costura, patchwork, fieltro, bordado, punto de cruz, tela pintada, muñecos de trapo, bolsas y ropa cosida a mano.',
    emoji: '🧵',
    color: '#b5548c',
    sinonimos: ['costura', 'coser', 'patchwork', 'fieltro', 'bordado', 'punto de cruz', 'tela', 'maquina de coser', 'quilt', 'acolchado'],
  },
  {
    id: 'macrame-fibras',
    nombre: 'Macramé y fibras',
    definicion:
      'Macramé, nudos decorativos, cestería, mimbre, rafia, esparto, telar, tapices de fibra y atrapasueños.',
    emoji: '🪢',
    color: '#a8763f',
    sinonimos: ['macrame', 'nudos', 'cesteria', 'mimbre', 'rafia', 'esparto', 'telar', 'tapiz', 'atrapasuenos', 'cuerda', 'yute'],
  },
  {
    id: 'ceramica-arcilla',
    nombre: 'Cerámica y arcilla',
    definicion:
      'Cerámica, barro, torno, porcelana fría, arcilla polimérica (fimo), pasta de modelar, piezas esmaltadas y modelado.',
    emoji: '🏺',
    color: '#9a6b4f',
    sinonimos: ['ceramica', 'arcilla', 'barro', 'torno', 'porcelana fria', 'fimo', 'polimerica', 'modelado', 'esmalte', 'alfareria', 'pasta'],
  },
  {
    id: 'pintura-dibujo',
    nombre: 'Pintura y dibujo',
    definicion:
      'Pintura sobre lienzo, madera, piedra o tela, acuarela, acrílico, lettering, mandalas, dibujo e ilustración hechos a mano.',
    emoji: '🎨',
    color: '#4a7fb5',
    sinonimos: ['pintura', 'pintar', 'acuarela', 'acrilico', 'lienzo', 'mandala', 'lettering', 'caligrafia', 'dibujo', 'pincel', 'oleo', 'piedras pintadas'],
  },
  {
    id: 'papel-carton',
    nombre: 'Papel y cartón',
    definicion:
      'Origami, papiroflexia, scrapbooking, quilling, cartonaje, tarjetas hechas a mano, papel maché, recortes y pop-up.',
    emoji: '📄',
    color: '#5d8f6f',
    sinonimos: ['papel', 'carton', 'origami', 'papiroflexia', 'scrapbook', 'quilling', 'cartonaje', 'tarjeta', 'papel mache', 'recorte', 'album'],
  },
  {
    id: 'madera-carpinteria',
    nombre: 'Madera y carpintería',
    definicion:
      'Carpintería y bricolaje en madera, pirograbado, talla, marquetería, palés reutilizados, cajas y muebles hechos a mano.',
    emoji: '🪵',
    color: '#8a6a3d',
    sinonimos: ['madera', 'carpinteria', 'pirograbado', 'talla', 'marqueteria', 'pale', 'sierra', 'lija', 'bricolaje', 'caja de madera'],
  },
  {
    id: 'joyeria-abalorios',
    nombre: 'Joyería y abalorios',
    definicion:
      'Bisutería artesanal, abalorios, cuentas, alambrismo, pendientes, collares, pulseras y anillos hechos a mano.',
    emoji: '💍',
    color: '#8b6bb5',
    sinonimos: ['joyeria', 'bisuteria', 'abalorio', 'cuentas', 'alambre', 'pendientes', 'collar', 'pulsera', 'anillo', 'mostacilla'],
  },
  {
    id: 'velas-jabones',
    nombre: 'Velas y jabones',
    definicion:
      'Velas artesanales, ceras, jabones hechos a mano, bombas de baño y cosmética artesanal.',
    emoji: '🕯️',
    color: '#c08a3e',
    sinonimos: ['vela', 'cera', 'jabon', 'saponificacion', 'bomba de bano', 'aroma', 'parafina', 'soja'],
  },
  {
    id: 'resina-epoxi',
    nombre: 'Resina epoxi',
    definicion:
      'Piezas de resina epoxi, moldes de silicona, inclusiones de flores secas, posavasos, bandejas y joyería de resina.',
    emoji: '💎',
    color: '#3f8f9a',
    sinonimos: ['resina', 'epoxi', 'molde', 'silicona', 'posavasos', 'inclusion', 'geode'],
  },
  {
    id: 'mosaico-vidrio',
    nombre: 'Mosaico y vidrio',
    definicion:
      'Mosaico, teselas, vidriera, vidrio tintado, fusing, botellas decoradas y espejos con mosaico.',
    emoji: '🔷',
    color: '#4f6fb5',
    sinonimos: ['mosaico', 'tesela', 'vidriera', 'vidrio', 'cristal', 'fusing', 'gresite', 'tiffany'],
  },
  {
    id: 'reciclaje-upcycling',
    nombre: 'Reciclaje y upcycling',
    definicion:
      'Objetos creados reutilizando materiales: botes, botellas, tapones, cápsulas, palés, ropa transformada, restauración de muebles.',
    emoji: '♻️',
    color: '#5f9b4a',
    sinonimos: ['reciclaje', 'reciclado', 'upcycling', 'reutilizar', 'bote', 'botella', 'tapon', 'capsula', 'restauracion', 'transformar'],
  },
  {
    id: 'decoracion-hogar',
    nombre: 'Decoración del hogar',
    definicion:
      'Coronas, centros de mesa, portavelas, cuadros decorativos, letreros y complementos decorativos hechos a mano.',
    emoji: '🖼️',
    color: '#b57f4a',
    sinonimos: ['decoracion', 'corona', 'centro de mesa', 'portavelas', 'cuadro', 'letrero', 'guirnalda', 'adorno', 'jarron'],
  },
  {
    id: 'fiesta-eventos',
    nombre: 'Fiestas y eventos',
    definicion:
      'Decoración de cumpleaños, bodas y celebraciones hecha a mano: piñatas, photocall, banderines, detalles para invitados.',
    emoji: '🎉',
    color: '#c2568f',
    sinonimos: ['fiesta', 'cumpleanos', 'boda', 'pinata', 'photocall', 'banderin', 'invitados', 'celebracion', 'evento'],
  },
  {
    id: 'navidad-estacional',
    nombre: 'Navidad y estacional',
    definicion:
      'Manualidades de temporada: Navidad, Halloween, Pascua, Día de la Madre, otoño. Adornos, belenes y calendarios de adviento.',
    emoji: '🎄',
    color: '#4a8f6a',
    sinonimos: ['navidad', 'navideno', 'halloween', 'pascua', 'belen', 'adviento', 'calabaza', 'huevo', 'otono', 'adorno navideno'],
  },
  {
    id: 'infantil-escolar',
    nombre: 'Infantil y escolar',
    definicion:
      'Manualidades hechas por o para niños: trabajos de colegio, plastilina, pintura de dedos, disfraces sencillos, material didáctico.',
    emoji: '🧒',
    color: '#c29a3e',
    sinonimos: ['infantil', 'ninos', 'colegio', 'escolar', 'plastilina', 'goma eva', 'disfraz', 'manualidad infantil', 'pompones'],
  },
  {
    id: 'flores-naturaleza',
    nombre: 'Flores y naturaleza',
    definicion:
      'Flores secas o prensadas, flores de papel o tela, terrarios, arreglos florales y composiciones con elementos naturales.',
    emoji: '🌿',
    color: '#679b55',
    sinonimos: ['flores', 'flor', 'seca', 'prensada', 'terrario', 'ramo', 'arreglo floral', 'hojas', 'suculenta'],
  },
  {
    id: 'otras-manualidades',
    nombre: 'Otras manualidades',
    definicion:
      'Es claramente una manualidad hecha a mano pero no encaja en ninguna categoría anterior.',
    emoji: '✨',
    color: '#7c7c8a',
    sinonimos: ['manualidad', 'artesania', 'handmade', 'hecho a mano', 'diy'],
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
  },
  [NO_MANUALIDAD]: {
    id: NO_MANUALIDAD,
    nombre: 'Descartadas (no son manualidades)',
    definicion: 'La foto no muestra ninguna manualidad.',
    emoji: '🚫',
    color: '#8a8a8a',
    sinonimos: [],
  },
};

const PORID = new Map<string, Categoria>([
  ...CATEGORIAS.map((c) => [c.id, c] as const),
  ...Object.values(CATEGORIAS_ESPECIALES).map((c) => [c.id, c] as const),
]);

export function categoria(id: string | null | undefined): Categoria {
  return (id && PORID.get(id)) || CATEGORIAS_ESPECIALES[SIN_CLASIFICAR];
}

export const IDS_CATEGORIAS = CATEGORIAS.map((c) => c.id);

/** Listado compacto que se le pasa al modelo dentro del prompt. */
export function taxonomiaParaPrompt(): string {
  return CATEGORIAS.map((c) => `- ${c.id}: ${c.nombre}. ${c.definicion}`).join('\n');
}
