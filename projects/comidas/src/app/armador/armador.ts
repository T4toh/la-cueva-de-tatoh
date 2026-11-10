// Llena los slots vacíos de la semana, golozo: cada elección cuenta para la siguiente.
// Ver docs/superpowers/specs/2026-11-06-armador-semanas-design.md
import { DaySchedule, Dish, DishMealType, Meal } from '../models/meal.model';
import { Candidatos } from './candidatos';
import { ContextoPuntaje, previoDe, Puntaje, puntuar } from './puntaje';

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

export type Preferida = { mealId: string; motivo: string };

// "Martes-almuerzo": legible para Flash y estable dentro de la semana.
export function claveSlot(semana: DaySchedule[], { dia, tipo }: Slot): string {
  return `${semana[dia].dayName}-${tipo}`;
}

export type ResultadoArmador = { semana: DaySchedule[]; puestos: number; sinCandidatos: number; deFlash: number };

// Lo que necesita el armador de la semana mostrada; lo arma MealService.
export type EntradaArmador = {
  key: string;
  semana: DaySchedule[];
  desde: number;
  tipos: DishMealType[];
  candidatos: Candidatos;
  ctx: ContextoPuntaje;
};

// Preferida de Flash: se acepta salvo que rompa algo que el mejor no rompe (un chequeo vale -1000).
const MARGEN_PREFERIDA = 900;
const MAX_MOTIVO = 80;
const MAX_OPCIONES = 8;

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

// Reglas duras de un slot: qué comidas puede recibir y cuántas veces ya está cada una de desayuno.
function posiblesPara(
  actual: DaySchedule[],
  slot: Slot,
  candidatos: Candidatos,
): { posibles: Meal[]; veces: (m: Meal) => number } {
  const ids = (de: readonly DishMealType[]): Set<string> =>
    new Set(actual.flatMap((d) => de.flatMap((t) => d[t].map((p) => p.mealId))));
  if (slot.tipo === 'desayuno') {
    const desayunos = actual.flatMap((d) => d.desayuno.map((p) => p.mealId));
    const veces = (m: Meal): number => desayunos.filter((id) => id === m.id).length;
    // Lo que ya es almuerzo o cena no se desayuna. El tope es regla dura,
    // salvo que no quede ninguno debajo: antes que dejarlo vacío, repite.
    const principales = ids(['almuerzo', 'cena']);
    const libres = candidatos.desayuno.filter((m) => !principales.has(m.id));
    const bajoTope = libres.filter((m) => veces(m) < MAX_DESAYUNO_REPETIDO);
    return { posibles: bajoTope.length ? bajoTope : libres, veces };
  }
  // Almuerzo y cena no repiten nada de la semana, desayunos incluidos.
  const usadas = ids(TIPOS);
  return { posibles: candidatos[slot.tipo].filter((m) => !usadas.has(m.id)), veces: () => 0 };
}

// Los posibles de un slot con su puntaje contra `actual` (sin ordenar).
function puntuadosPara(
  actual: DaySchedule[],
  slot: Slot,
  candidatos: Candidatos,
  ctx: ContextoPuntaje,
): { meal: Meal; puntaje: Puntaje }[] {
  const { posibles, veces } = posiblesPara(actual, slot, candidatos);
  const previo = previoDe(actual, ctx);
  return posibles.map((meal) => {
    const conEl = poner(actual, slot, { mealId: meal.id, portions: 1 });
    const p = puntuar(meal, actual, conEl, ctx, previo);
    return { meal, puntaje: { ...p, puntos: p.puntos + veces(meal) * PESO_DESAYUNO_REPETIDO } };
  });
}

export type OpcionesSlot = { slot: Slot; clave: string; opciones: { meal: Meal; puntos: number }[] };

// Puntúa contra la semana como está (sin las elecciones de los otros slots). Mejores primero.
export function opcionesPorSlot(
  semana: DaySchedule[],
  desde: number,
  tipos: readonly DishMealType[],
  candidatos: Candidatos,
  ctx: ContextoPuntaje,
  max = MAX_OPCIONES,
): OpcionesSlot[] {
  return slotsVacios(semana, desde, tipos).map((slot) => ({
    slot,
    clave: claveSlot(semana, slot),
    opciones: puntuadosPara(semana, slot, candidatos, ctx)
      .sort((a, b) => b.puntaje.puntos - a.puntaje.puntos)
      .slice(0, max)
      .map(({ meal, puntaje }) => ({ meal, puntos: puntaje.puntos })),
  }));
}

export function armarSemana(
  semana: DaySchedule[],
  desde: number,
  tipos: readonly DishMealType[],
  candidatos: Candidatos,
  ctx: ContextoPuntaje,
  azar: () => number,
  preferidas?: ReadonlyMap<string, Preferida>,
): ResultadoArmador {
  let actual = semana;
  let puestos = 0;
  let sinCandidatos = 0;
  let deFlash = 0;

  for (const slot of slotsVacios(semana, desde, tipos)) {
    // sort es estable: a igual puntaje queda el orden de los candidatos.
    const puntuados = puntuadosPara(actual, slot, candidatos, ctx).sort((a, b) => b.puntaje.puntos - a.puntaje.puntos);
    if (!puntuados.length) {
      sinCandidatos++;
      continue;
    }

    const pref = preferidas?.get(claveSlot(semana, slot));
    const deFlashElegida = pref && puntuados.find((c) => c.meal.id === pref.mealId);
    if (deFlashElegida && deFlashElegida.puntaje.puntos >= puntuados[0].puntaje.puntos - MARGEN_PREFERIDA) {
      const motivo = pref.motivo.trim().slice(0, MAX_MOTIVO) || deFlashElegida.puntaje.motivo;
      actual = poner(actual, slot, { mealId: pref.mealId, portions: 1, excluded: false, motivo });
      puestos++;
      deFlash++;
      continue;
    }

    const { meal, puntaje } = elegir(puntuados.slice(0, TOP), azar);
    actual = poner(actual, slot, { mealId: meal.id, portions: 1, excluded: false, motivo: puntaje.motivo });
    puestos++;
  }
  return { semana: actual, puestos, sinCandidatos, deFlash };
}
