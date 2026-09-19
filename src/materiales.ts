/**
 * Materiales habituales de los talleres.
 *
 * Cada material guarda dos nombres: el castellano, que es el que se almacena en
 * la ficha para que el catálogo, la búsqueda y los nombres de archivo estén en
 * un solo idioma, y el euskera, que es el que ven los monitores en el
 * formulario. Añadir uno aquí lo propaga a los dos sitios.
 */

export interface Material {
  id: string;
  /** Valor que se guarda en la ficha de la foto. */
  es: string;
  /** Rótulo del formulario. */
  eu: string;
  emoji: string;
}

export const MATERIALES: Material[] = [
  { id: 'goma-eva', es: 'goma eva', eu: 'goma eva', emoji: '🟩' },
  { id: 'fieltro', es: 'fieltro', eu: 'feltroa', emoji: '🧻' },
  { id: 'cartulina', es: 'cartulina', eu: 'kartulina', emoji: '🟨' },
  { id: 'carton', es: 'cartón', eu: 'kartoia', emoji: '📦' },
  { id: 'papel', es: 'papel', eu: 'papera', emoji: '📄' },
  { id: 'pintura', es: 'pintura', eu: 'pintura', emoji: '🎨' },
  { id: 'temperas', es: 'témperas', eu: 'tenperak', emoji: '🖌️' },
  { id: 'rotuladores', es: 'rotuladores', eu: 'errotuladoreak', emoji: '🖊️' },
  { id: 'purpurina', es: 'purpurina', eu: 'purpurina', emoji: '✨' },
  { id: 'pistola-termofusible', es: 'pistola termofusible', eu: 'silikona pistola', emoji: '🔫' },
  { id: 'cola', es: 'cola blanca', eu: 'kola', emoji: '🧴' },
  { id: 'tijeras', es: 'tijeras', eu: 'guraizeak', emoji: '✂️' },
  { id: 'horno', es: 'horno', eu: 'labea', emoji: '🔥' },
  { id: 'arcilla', es: 'arcilla', eu: 'buztina', emoji: '🏺' },
  { id: 'plastilina', es: 'plastilina', eu: 'plastilina', emoji: '🪱' },
  { id: 'madera', es: 'madera', eu: 'egurra', emoji: '🪵' },
  { id: 'tela', es: 'tela', eu: 'oihala', emoji: '🧵' },
  { id: 'lana', es: 'lana', eu: 'artilea', emoji: '🧶' },
  { id: 'cuerda', es: 'cuerda', eu: 'soka', emoji: '🪢' },
  { id: 'abalorios', es: 'abalorios', eu: 'aleak', emoji: '📿' },
  { id: 'botones', es: 'botones', eu: 'botoiak', emoji: '🔘' },
  { id: 'gomets', es: 'gomets', eu: 'gometak', emoji: '🔴' },
  { id: 'limpiapipas', es: 'limpiapipas', eu: 'pipa-garbitzaileak', emoji: '🌈' },
  { id: 'palos-helado', es: 'palos de helado', eu: 'izozki-zotzak', emoji: '🥢' },
  { id: 'reciclado', es: 'material reciclado', eu: 'birziklatutako materiala', emoji: '♻️' },
  { id: 'flores-secas', es: 'flores secas', eu: 'lore lehorrak', emoji: '🌿' },
  { id: 'globos', es: 'globos', eu: 'puxikak', emoji: '🎈' },
  { id: 'resina', es: 'resina', eu: 'erretxina', emoji: '💎' },
];

const PORID = new Map(MATERIALES.map((m) => [m.id, m]));

export function material(id: string): Material | undefined {
  return PORID.get(id);
}

/** Convierte los identificadores elegidos en los nombres que guarda la ficha. */
export function nombresEnCastellano(ids: string[]): string[] {
  return ids.map((id) => PORID.get(id)?.es).filter((v): v is string => Boolean(v));
}
