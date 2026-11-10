// El segundo pedido a Flash: recetas nuevas, o para un slot sin candidatos o
// para sumar plantas a la semana. Ver docs/superpowers/specs/2026-11-06-armador-semanas-design.md
import { ObjectSchema, Schema } from '@angular/fire/ai';

import { IndiceCatalogo, normalizar } from '../catalogo/catalogo';
import { plantasDe } from '../catalogo/plantas';
import { DaySchedule, DishMealType, Ingredient, Meal } from '../models/meal.model';
import { cantidadEntera, esObjeto, texto } from '../revision/pedido';
import { Slot, slotsVacios } from './armador';
import { Estacion } from './estacion';
import { chocaConNoComo } from './no-como';

export const MAX_RECETAS_NUEVAS = 3;

const TIPOS: readonly DishMealType[] = ['desayuno', 'almuerzo', 'cena'];

export type RecetaNueva = {
  name: string;
  tags: string[];
  ingredients: Ingredient[];
  pasos: string[];
  tipo: DishMealType;
  // El hueco para el que se pidió; null si vino de "sugerime algo nuevo".
  slot: Slot | null;
};

export type PedidoRecetas =
  | { modo: 'huecos'; huecos: { clave: string; tipo: DishMealType }[] }
  | { modo: 'plantas'; tipos: DishMealType[]; plantasDeLaSemana: string[] };

export function promptRecetasNuevas(
  p: PedidoRecetas,
  estacion: Estacion,
  pais: string,
  noComo: string[],
  nombresExistentes: string[],
): string {
  return [
    'Sos un cocinero que propone recetas caseras nuevas para la semana de una persona.',
    p.modo === 'huecos'
      ? 'Proponé una receta por cada hueco de la lista, y devolvé la clave del hueco para el que es:'
      : `Proponé hasta ${MAX_RECETAS_NUEVAS} recetas, de estos tipos: ${p.tipos.join(', ')}. ` +
        'Las plantas que ya están en la semana son: ' +
        `${p.plantasDeLaSemana.join(', ') || '(ninguna)'}. Sumá plantas distintas a esas.`,
    ...(p.modo === 'huecos' ? p.huecos.map((h) => `- ${h.clave} (${h.tipo})`) : []),
    `Estamos en ${estacion} en ${pais}: tené en cuenta la estación.`,
    'Cada receta trae nombre, tags, ingredientes y, si querés, pasos.',
    'Las cantidades son por una porción, para una persona, y llevan un número (por ejemplo 1, 0.5 o 1/2),',
    'con unidad si corresponde. Nada de "a gusto" ni rangos como "2-3".',
    'Los ingredientes son concretos, de los que se compran: nunca una preparación como "salsa" o "ensalada verde".',
    ...(noComo.length > 0 ? [`El usuario no come estos ingredientes: ${noComo.join(', ')}. No los uses.`] : []),
    ...(nombresExistentes.length > 0
      ? [`No repitas el nombre de ninguna de estas recetas que ya tiene: ${nombresExistentes.join(', ')}.`]
      : []),
    'Escribí en español rioplatense.',
  ].join('\n');
}

export function esquemaRecetasNuevas(p: PedidoRecetas): ObjectSchema {
  const tipos = p.modo === 'huecos' ? [...new Set(p.huecos.map((h) => h.tipo))] : p.tipos;
  return Schema.object({
    properties: {
      recetas: Schema.array({
        items: Schema.object({
          properties: {
            ...(p.modo === 'huecos' ? { clave: Schema.enumString({ enum: p.huecos.map((h) => h.clave) }) } : {}),
            name: Schema.string(),
            tipo: Schema.enumString({ enum: tipos }),
            tags: Schema.array({ items: Schema.string() }),
            ingredients: Schema.array({
              items: Schema.object({
                properties: { name: Schema.string(), quantity: Schema.string(), unit: Schema.string() },
                optionalProperties: ['unit'],
              }),
            }),
            pasos: Schema.array({ items: Schema.string() }),
          },
          optionalProperties: ['pasos'],
        }),
      }),
    },
  });
}

function ingredientesValidos(raw: unknown): Ingredient[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const ingredientes: Ingredient[] = [];
  for (const i of raw as unknown[]) {
    const name = esObjeto(i) ? texto(i['name']) : '';
    const quantity = esObjeto(i) ? texto(i['quantity']) : '';
    if (!esObjeto(i) || !name || !cantidadEntera(quantity)) {
      return null;
    }
    const unit = texto(i['unit']);
    ingredientes.push({ name, quantity, ...(unit ? { unit } : {}) });
  }
  return ingredientes;
}

const textos = (x: unknown): string[] =>
  Array.isArray(x) ? (x as unknown[]).map(texto).filter((t) => t) : [];

// Lo inválido se descarta, receta por receta; el resto se conserva.
export function validarRecetasNuevas(
  raw: unknown,
  p: PedidoRecetas,
  huecos: ReadonlyMap<string, Slot>,
  noComo: readonly string[],
  indice: IndiceCatalogo,
  nombresExistentes: readonly string[],
): RecetaNueva[] {
  if (!esObjeto(raw) || !Array.isArray(raw['recetas'])) {
    return [];
  }
  const nombres = new Set(nombresExistentes.map(normalizar));
  const clavesUsadas = new Set<string>();
  const recetas: RecetaNueva[] = [];
  for (const entrada of raw['recetas'] as unknown[]) {
    if (recetas.length >= MAX_RECETAS_NUEVAS) {
      break;
    }
    if (!esObjeto(entrada)) {
      continue;
    }
    const name = texto(entrada['name']);
    const tipo = TIPOS.find((t) => t === entrada['tipo']);
    const ingredients = ingredientesValidos(entrada['ingredients']);
    if (!name || !tipo || !ingredients || nombres.has(normalizar(name))) {
      continue;
    }
    const clave = texto(entrada['clave']);
    const slot = p.modo === 'huecos' ? (huecos.get(clave) ?? null) : null;
    if (p.modo === 'huecos' && (!slot || clavesUsadas.has(clave))) {
      continue;
    }
    if (chocaConNoComo({ id: '', name, ingredients }, noComo, indice)) {
      continue;
    }
    nombres.add(normalizar(name));
    clavesUsadas.add(clave);
    // El hueco manda: si Flash contradice el tipo, se usa el del hueco.
    recetas.push({
      name,
      tags: textos(entrada['tags']),
      ingredients,
      pasos: textos(entrada['pasos']),
      tipo: slot?.tipo ?? tipo,
      slot,
    });
  }
  return recetas;
}

// A qué slot va una receta de "sugerime algo nuevo": el plato del armador (el
// que trae `motivo`) que menos plantas aporta a la semana, del mismo tipo; si
// no hay, el primer slot vacío de ese tipo; si tampoco, null.
export function slotParaUsar(
  semana: DaySchedule[],
  desde: number,
  tipo: DishMealType,
  meals: Meal[],
  indice: IndiceCatalogo,
): Slot | null {
  const porId = new Map(meals.map((m) => [m.id, m]));
  const plantasDelSlot = ({ dia, tipo: t }: Slot): Set<string> =>
    new Set(semana[dia][t].flatMap((d) => {
      const meal = porId.get(d.mealId);
      return meal ? [...plantasDe(meal, indice)] : [];
    }));
  const todos: Slot[] = semana.flatMap((_, dia) => TIPOS.map((t) => ({ dia, tipo: t })));
  const aporta = (slot: Slot): number => {
    const otras = new Set<string>();
    todos
      .filter((s) => s.dia !== slot.dia || s.tipo !== slot.tipo)
      .forEach((s) => plantasDelSlot(s).forEach((x) => otras.add(x)));
    const meal = porId.get(semana[slot.dia][slot.tipo][0].mealId);
    return meal ? [...plantasDe(meal, indice)].filter((x) => !otras.has(x)).length : 0;
  };
  const conMotivo = todos
    .filter((s) => s.dia >= desde && s.tipo === tipo && semana[s.dia][s.tipo][0]?.motivo)
    .map((s) => ({ s, n: aporta(s) }));
  if (conMotivo.length > 0) {
    // sort estable: el empate queda con el más temprano
    return conMotivo.sort((a, b) => a.n - b.n)[0].s;
  }
  return slotsVacios(semana, desde, [tipo])[0] ?? null;
}
