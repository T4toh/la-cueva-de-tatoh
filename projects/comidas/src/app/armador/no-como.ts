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
const CATEGORIAS = new Map<string, (e: EntradaCatalogo) => boolean>();
const agregar = (etiqueta: string, coincide: (e: EntradaCatalogo) => boolean): void => {
  const base = normalizar(etiqueta);
  [base, base + 's', base + 'es'].forEach((c) => CATEGORIAS.set(c, coincide));
};
for (const [grupo, etiqueta] of Object.entries(ETIQUETA_GRUPO)) {
  agregar(etiqueta, (e) => e.grupo === (grupo as Grupo));
}
for (const [carne, etiqueta] of Object.entries(ETIQUETA_CARNE)) {
  agregar(etiqueta, (e) => e.carne === (carne as Carne));
}

// Contiene por palabras enteras: "sal" no está en "salmón".
const contiene = (a: string, b: string): boolean => ` ${a} `.includes(` ${b} `);

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
