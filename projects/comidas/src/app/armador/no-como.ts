// El filtro duro del armador: la lista "No como" de Ajustes contra los
// ingredientes de una comida. Ver docs/superpowers/specs/2026-11-06-armador-semanas-design.md
import {
  Carne,
  clasificar,
  EntradaCatalogo,
  ETIQUETA_CARNE,
  ETIQUETA_GRUPO,
  Grupo,
  IndiceCatalogo,
  normalizar,
} from '../catalogo/catalogo';
import { Meal } from '../models/meal.model';

// Etiqueta normalizada (y su plural con s/es) → cómo se reconoce en una entrada.
type Coincide = (e: EntradaCatalogo) => boolean;

const CATEGORIAS: ReadonlyMap<string, Coincide> = new Map(
  [
    ...Object.entries(ETIQUETA_GRUPO).map(([g, et]): [string, Coincide] => [
      et,
      (e): boolean => e.grupo === (g as Grupo),
    ]),
    ...Object.entries(ETIQUETA_CARNE).map(([c, et]): [string, Coincide] => [
      et,
      (e): boolean => e.carne === (c as Carne),
    ]),
  ].flatMap(([etiqueta, coincide]): [string, Coincide][] => {
    const base = normalizar(etiqueta);
    return [base, base + 's', base + 'es'].map((k): [string, Coincide] => [k, coincide]);
  }),
);

// "Contiene" sobre texto normalizado, sin límite de palabra: es mejor sacar de
// más (sal choca con salmón) que sugerir lo que no come. También cubre plurales.
const contiene = (a: string, b: string): boolean => a.includes(b);

export function chocaConNoComo(meal: Meal, noComo: readonly string[], indice: IndiceCatalogo): boolean {
  const terminos = noComo.map(normalizar).filter((t) => t);
  if (!terminos.length) {
    return false;
  }
  return meal.ingredients.some((ing) => {
    const entrada = clasificar(ing.name, indice);
    const textos = [ing.name, ...(entrada ? [entrada.nombre, ...(entrada.sinonimos ?? [])] : [])].map(normalizar);
    return terminos.some((t) => {
      const categoria = CATEGORIAS.get(t);
      return (
        (categoria && entrada && categoria(entrada)) ||
        textos.some((x) => contiene(x, t) || contiene(t, x))
      );
    });
  });
}

// Para el hint de Ajustes: true si el texto es una categoría o clasifica en el catálogo.
export function reconocido(texto: string, indice: IndiceCatalogo): boolean {
  return CATEGORIAS.has(normalizar(texto)) || clasificar(texto, indice) !== null;
}

// Lo que llega de afuera (localStorage, la nube, un backup) queda como lista de
// textos no vacíos: cualquier otra forma rompería el armador y se volvería a guardar.
export function normalizarNoComo(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter((t) => t)
    : [];
}
