// Llena los slots vacíos de la semana, golozo: cada elección cuenta para la siguiente.
// Ver docs/superpowers/specs/2026-11-06-armador-semanas-design.md
import { DaySchedule, Dish, DishMealType, Meal } from '../models/meal.model';
import { Candidatos } from './candidatos';
import { ContextoPuntaje, Puntaje, puntuar } from './puntaje';

export const MAX_DESAYUNO_REPETIDO = 3;

// Cada vez que un desayuno ya está en la semana resta esto, para que rote. Más
// que cualquier ganancia de plantas o despensa (300 + 30), menos que romper un
// chequeo (-1000): un desayuno repetido gana a uno que rompe la guía.
const PESO_DESAYUNO_REPETIDO = -400;

// Entre cuántos de los mejores se elige al azar.
const TOP = 3;

const TIPOS: readonly DishMealType[] = ['desayuno', 'almuerzo', 'cena'];

export type Slot = { dia: number; tipo: DishMealType };

// En orden: día, y dentro del día desayuno → almuerzo → cena.
export function slotsVacios(semana: DaySchedule[], desde: number, tipos: readonly DishMealType[]): Slot[] {
  const slots: Slot[] = [];
  for (let dia = desde; dia < semana.length; dia++) {
    for (const tipo of TIPOS) {
      if (tipos.includes(tipo) && !semana[dia][tipo].length) {
        slots.push({ dia, tipo });
      }
    }
  }
  return slots;
}

export type ResultadoArmador = { semana: DaySchedule[]; puestos: number; sinCandidatos: number };

function poner(semana: DaySchedule[], { dia, tipo }: Slot, plato: Dish): DaySchedule[] {
  return semana.map((d, i) => (i === dia ? { ...d, [tipo]: [plato] } : d));
}

// Peso por puntaje, desplazado para que el peor del top pese 1. Con azar() = 0, el mejor.
function elegir(top: { meal: Meal; puntaje: Puntaje }[], azar: () => number): { meal: Meal; puntaje: Puntaje } {
  const min = top[top.length - 1].puntaje.puntos;
  const pesos = top.map((c) => c.puntaje.puntos - min + 1);
  let r = azar() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) {
    r -= pesos[i];
    if (r < 0) {
      return top[i];
    }
  }
  return top[top.length - 1];
}

export function armarSemana(
  semana: DaySchedule[],
  desde: number,
  tipos: readonly DishMealType[],
  candidatos: Candidatos,
  ctx: ContextoPuntaje,
  azar: () => number,
): ResultadoArmador {
  let actual = semana;
  let puestos = 0;
  let sinCandidatos = 0;

  for (const slot of slotsVacios(semana, desde, tipos)) {
    let posibles: Meal[];
    let veces: (m: Meal) => number = () => 0;
    const ids = (de: readonly DishMealType[]): Set<string> =>
      new Set(actual.flatMap((d) => de.flatMap((t) => d[t].map((p) => p.mealId))));
    if (slot.tipo === 'desayuno') {
      const desayunos = actual.flatMap((d) => d.desayuno.map((p) => p.mealId));
      veces = (m): number => desayunos.filter((id) => id === m.id).length;
      // Lo que ya es almuerzo o cena no se desayuna. El tope es regla dura,
      // salvo que no quede ninguno debajo: antes que dejarlo vacío, repite.
      const principales = ids(['almuerzo', 'cena']);
      const libres = candidatos.desayuno.filter((m) => !principales.has(m.id));
      const bajoTope = libres.filter((m) => veces(m) < MAX_DESAYUNO_REPETIDO);
      posibles = bajoTope.length ? bajoTope : libres;
    } else {
      // Almuerzo y cena no repiten nada de la semana, desayunos incluidos.
      const usadas = ids(TIPOS);
      posibles = candidatos[slot.tipo].filter((m) => !usadas.has(m.id));
    }
    if (!posibles.length) {
      sinCandidatos++;
      continue;
    }

    const puntuados = posibles.map((meal) => {
      const conEl = poner(actual, slot, { mealId: meal.id, portions: 1 });
      const p = puntuar(meal, actual, conEl, ctx);
      return { meal, puntaje: { ...p, puntos: p.puntos + veces(meal) * PESO_DESAYUNO_REPETIDO } };
    });
    // sort es estable: a igual puntaje queda el orden de los candidatos.
    const top = puntuados.sort((a, b) => b.puntaje.puntos - a.puntaje.puntos).slice(0, TOP);
    const { meal, puntaje } = elegir(top, azar);
    actual = poner(actual, slot, { mealId: meal.id, portions: 1, excluded: false, motivo: puntaje.motivo });
    puestos++;
  }
  return { semana: actual, puestos, sinCandidatos };
}
