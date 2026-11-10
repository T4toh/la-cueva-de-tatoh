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

// Etiqueta normalizada (y su plural con s/es, palabra por palabra: "carnes rojas")
// → cómo se reconoce en una entrada.
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
    const plural = (suf: string): string => base.split(' ').map((p) => p + suf).join(' ');
    return [base, plural('s'), plural('es')].map((k): [string, Coincide] => [k, coincide]);
  }),
);

// El texto contiene el término, sin límite de palabra: mejor sacar de más (sal
// choca con salmón) que sugerir lo que no come. Al revés sólo con el plural
// (tomates choca con tomate): si no, salchichas sacaba todo lo que lleva sal.
const choca = (texto: string, t: string): boolean =>
  texto.includes(t) || t === texto + 's' || t === texto + 'es';

export function chocaConNoComo(meal: Meal, noComo: readonly string[], indice: IndiceCatalogo): boolean {
  const terminos = noComo.map(normalizar).filter((t) => t);
  if (!terminos.length) {
    return false;
  }
  return meal.ingredients.some((ing) => {
    const entrada = clasificar(ing.name, indice);
    const textos = [ing.name, ...(entrada ? [entrada.nombre, ...(entrada.sinonimos ?? [])] : [])]
      .map(normalizar)
      .filter((x) => x);
    return terminos.some((t) => {
      const categoria = CATEGORIAS.get(t);
      return (categoria && entrada && categoria(entrada)) || textos.some((x) => choca(x, t));
    });
  });
}

// Para el hint de Ajustes: true si el texto es una categoría o clasifica en el catálogo.
export function reconocido(texto: string, indice: IndiceCatalogo): boolean {
  return CATEGORIAS.has(normalizar(texto)) || clasificar(texto, indice) !== null;
}

// Lo que llega de afuera (localStorage, la nube, un backup) queda como lista de
// textos no vacíos y sin repetir (gana la primera escritura): cualquier otra
// forma rompería el armador y se volvería a guardar.
export function normalizarNoComo(v: unknown): string[] {
  if (!Array.isArray(v)) {
    return [];
  }
  const vistos = new Set<string>();
  return v
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => {
      const clave = normalizar(t);
      const nuevo = !!clave && !vistos.has(clave);
      vistos.add(clave);
      return nuevo;
    });
}
