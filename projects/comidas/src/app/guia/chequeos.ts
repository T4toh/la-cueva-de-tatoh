// Las reglas de la guía contra la semana del plan. Ver
// docs/superpowers/specs/2026-10-21-chequeos-guia-design.md
// Puras y sin la guía del usuario: las ocultas las filtra quien muestra, así
// el armador de semanas puede usar el mismo cálculo.
import { Carne, clasificar, EntradaCatalogo, IndiceCatalogo } from '../catalogo/catalogo';
import { DaySchedule, Dish, Meal } from '../models/meal.model';

// Las de la regla `frecuencia-carnes`, de las GAPA.
export const MAX_CARNE_ROJA = 3;
export const MIN_PESCADO = 2;
export const META_CARNE_BLANCA = 2;

export type ChequeoSemana = {
  // Días con carbos en almuerzo y cena, por `dayName`.
  diasConDosCarbos: string[];
  carnes: Record<Carne, number>;
  // Ids de las reglas que la semana no cumple, en el orden de `REGLAS`.
  incumplidas: string[];
};

// Como en las plantas: `excluded` sólo saca el plato de las compras, se come
// igual. La unidad es la comida, no el plato: en modo familiar, dos platos
// con carbos en la misma cena son una vez.
export function chequearSemana(semana: DaySchedule[], meals: Meal[], indice: IndiceCatalogo): ChequeoSemana {
  const porId = new Map(meals.map((m) => [m.id, m]));
  const entradas = (platos: Dish[]): EntradaCatalogo[] =>
    platos.flatMap((p) => porId.get(p.mealId)?.ingredients ?? [])
      .map((i) => clasificar(i.name, indice))
      .filter((e): e is EntradaCatalogo => e !== null);
  const conCarbos = (platos: Dish[]): boolean =>
    entradas(platos).some((e) => (e.grupo === 'feculentos' || e.grupo === 'pan') && !e.menor);

  const diasConDosCarbos = semana
    .filter((d) => conCarbos(d.almuerzo) && conCarbos(d.cena))
    .map((d) => d.dayName);

  const carnes: Record<Carne, number> = { roja: 0, blanca: 0, pescado: 0 };
  for (const dia of semana) {
    for (const platos of [dia.desayuno, dia.almuerzo, dia.cena]) {
      const tipos = new Set(entradas(platos).flatMap((e) => (e.carne ? [e.carne] : [])));
      tipos.forEach((t) => carnes[t]++);
    }
  }

  const incumplidas = [
    ...(diasConDosCarbos.length ? ['un-carbo-por-dia'] : []),
    ...(carnes.roja > MAX_CARNE_ROJA ? ['frecuencia-carnes'] : []),
  ];
  return { diasConDosCarbos, carnes, incumplidas };
}
