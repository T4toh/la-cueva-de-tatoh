import { DaySchedule, Meal } from '../models/meal.model';
import { clasificar, esPlanta, IndiceCatalogo, normalizar } from './catalogo';

// American Gut Project (McDonald et al., mSystems 2018): 30 o más plantas
// distintas por semana. Constante hasta que alguien la quiera distinta.
export const META_PLANTAS = 30;

export type PlantasSemana = {
  plantas: string[];
  // Ingredientes que el catálogo no reconoce: no cuentan, pero se informan
  // para que se vea qué falta clasificar.
  sinClasificar: string[];
};

function plantasDe(meal: Meal, indice: IndiceCatalogo, sinClasificar?: Set<string>): Set<string> {
  const plantas = new Set<string>();
  for (const ingrediente of meal.ingredients) {
    const entrada = clasificar(ingrediente.name, indice);
    if (entrada) {
      if (esPlanta(entrada)) {
        plantas.add(entrada.nombre);
      }
    } else if (sinClasificar && normalizar(ingrediente.name)) {
      sinClasificar.add(normalizar(ingrediente.name));
    }
  }
  return plantas;
}

// Los campos de texto libre (postres, colación) no cuentan.
export function plantasDeLaSemana(semana: DaySchedule[], meals: Meal[], indice: IndiceCatalogo): PlantasSemana {
  const porId = new Map(meals.map((m) => [m.id, m]));
  const plantas = new Set<string>();
  const sinClasificar = new Set<string>();
  for (const dia of semana) {
    for (const plato of [...dia.desayuno, ...dia.almuerzo, ...dia.cena]) {
      const meal = plato.excluded ? undefined : porId.get(plato.mealId);
      if (meal) {
        plantasDe(meal, indice, sinClasificar).forEach((p) => plantas.add(p));
      }
    }
  }
  return { plantas: [...plantas].sort(), sinClasificar: [...sinClasificar].sort() };
}

export function comidasQueSuman(
  plantas: ReadonlySet<string>,
  meals: Meal[],
  indice: IndiceCatalogo,
  max = 3
): { meal: Meal; nuevas: number }[] {
  return meals
    .map((meal) => ({
      meal,
      nuevas: [...plantasDe(meal, indice)].filter((p) => !plantas.has(p)).length,
    }))
    .filter((x) => x.nuevas > 0)
    .sort((a, b) => b.nuevas - a.nuevas || a.meal.name.localeCompare(b.meal.name))
    .slice(0, max);
}
