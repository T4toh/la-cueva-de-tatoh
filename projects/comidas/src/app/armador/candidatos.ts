// Qué comidas puede considerar el armador para cada tipo de slot.
// Ver docs/superpowers/specs/2026-11-06-armador-semanas-design.md
import { IndiceCatalogo, normalizar } from '../catalogo/catalogo';
import { DaySchedule, DishMealType, Meal } from '../models/meal.model';
import { chocaConNoComo } from './no-como';

export type Candidatos = Record<DishMealType, Meal[]>;

// Normalizados, como se comparan.
export const TAGS_EXCLUIDOS: readonly string[] = ['postre', 'salsa', 'para probar'];

export function candidatosPorTipo(
  meals: Meal[],
  historial: readonly DaySchedule[][],
  noComo: readonly string[],
  indice: IndiceCatalogo,
): Candidatos {
  const usadas: Record<DishMealType, Set<string>> = {
    desayuno: new Set(),
    almuerzo: new Set(),
    cena: new Set(),
  };
  for (const dias of historial) {
    for (const d of dias) {
      for (const tipo of ['desayuno', 'almuerzo', 'cena'] as const) {
        d[tipo].forEach((p) => usadas[tipo].add(p.mealId));
      }
    }
  }

  // Un id del historial sin Meal no está en `meals`, así que no aparece.
  const validas = meals.filter((m) => {
    const tags = (m.tags ?? []).map(normalizar);
    return (
      m.includeInShoppingList !== false &&
      !tags.some((t) => TAGS_EXCLUIDOS.includes(t)) &&
      !chocaConNoComo(m, noComo, indice)
    );
  });
  const tieneTag = (m: Meal, tag: string): boolean => (m.tags ?? []).some((t) => normalizar(t) === tag);

  const desayuno = validas.filter((m) => tieneTag(m, 'desayuno') || usadas.desayuno.has(m.id));
  let principales = validas.filter(
    (m) =>
      tieneTag(m, 'almuerzo') || tieneTag(m, 'cena') || usadas.almuerzo.has(m.id) || usadas.cena.has(m.id),
  );
  if (!principales.length) {
    principales = validas.filter((m) => !desayuno.includes(m));
  }
  return { desayuno, almuerzo: principales, cena: principales };
}
