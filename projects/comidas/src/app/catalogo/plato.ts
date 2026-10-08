import { Ingredient } from '../models/meal.model';
import { parseQuantity } from '../services/meal.service';
import { clasificar, EntradaCatalogo, IndiceCatalogo, normalizar } from './catalogo';

// Elección de diseño, no de las GAPA: un margen para que una porción generosa
// no se pinte de aviso.
export const UMBRAL_EXCESO = 1.5;

const UNIDADES: Record<string, string> = {
  g: 'g',
  gr: 'g',
  grs: 'g',
  gramo: 'g',
  gramos: 'g',
  ml: 'ml',
  cc: 'ml',
  u: 'unidad',
  unidad: 'unidad',
  unidades: 'unidad',
  cda: 'cda',
  cdas: 'cda',
  cucharada: 'cda',
  cucharadas: 'cda',
  cdita: 'cdita',
  cditas: 'cdita',
  cucharadita: 'cdita',
  cucharaditas: 'cdita',
  taza: 'taza',
  tazas: 'taza',
};

function unidadCanonica(unidad: string): string {
  const clave = normalizar(unidad);
  return UNIDADES[clave] ?? clave;
}

export function mismaUnidad(a: string, b: string): boolean {
  return unidadCanonica(a) === unidadCanonica(b);
}

export function textoReferencia(entrada: EntradaCatalogo): string | null {
  if (entrada.porcion === undefined) {
    return null;
  }
  const estimado = entrada.estimada ? ' (estimado)' : '';
  return `ref. ${entrada.porcion} ${entrada.unidad} por persona${estimado}`;
}

export function excede(cantidad: string, unidad: string, entrada: EntradaCatalogo): boolean {
  if (entrada.porcion === undefined || !mismaUnidad(unidad, entrada.unidad)) {
    return false;
  }
  const parsed = parseQuantity(cantidad);
  return !!parsed && parsed.valor > entrada.porcion * UMBRAL_EXCESO;
}

export type ResumenPlato = {
  verdura: boolean;
  proteina: boolean;
  feculento: boolean;
  aceite: boolean;
  // Cuántos ingredientes reconoció el catálogo. En 0 el resumen no se muestra.
  clasificados: number;
};

// Presencia por grupo, no proporciones: con unidades mezcladas no se comparan.
// Legumbre + cereal es el reemplazo de la carne que dan las GAPA.
export function resumenPlato(ingredientes: Pick<Ingredient, 'name'>[], indice: IndiceCatalogo): ResumenPlato {
  const entradas = ingredientes
    .map((i) => clasificar(i.name, indice))
    .filter((e): e is EntradaCatalogo => e !== null);
  const hay = (f: (e: EntradaCatalogo) => boolean): boolean => entradas.some(f);
  const legumbreYCereal =
    hay((e) => e.grupo === 'feculentos' && !!e.legumbre) && hay((e) => e.grupo === 'feculentos' && !e.legumbre);
  return {
    verdura: hay((e) => e.grupo === 'hortalizas'),
    proteina: hay((e) => e.grupo === 'carnesHuevos') || legumbreYCereal,
    feculento: hay((e) => e.grupo === 'feculentos' || e.grupo === 'pan'),
    aceite: hay((e) => e.grupo === 'aceitesSemillas'),
    clasificados: entradas.length,
  };
}
