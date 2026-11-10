import { describe, expect, it } from 'vitest';

import { CATALOGO } from '../catalogo/catalogo-datos';
import { indexar } from '../catalogo/catalogo';
import { DaySchedule, Meal } from '../models/meal.model';
import { candidatosPorTipo } from './candidatos';

const indice = indexar(CATALOGO);

const comida = (id: string, tags: string[] = [], extra: Partial<Meal> = {}): Meal => ({
  id,
  name: id,
  ingredients: [{ name: 'arroz', quantity: '1' }],
  tags,
  ...extra,
});

const dia = (slots: Partial<Record<'desayuno' | 'almuerzo' | 'cena', string[]>>): DaySchedule => ({
  dayName: 'lunes',
  desayuno: (slots.desayuno ?? []).map((mealId) => ({ mealId, portions: 1 })),
  almuerzo: (slots.almuerzo ?? []).map((mealId) => ({ mealId, portions: 1 })),
  postreAlmuerzo: null,
  colacion: null,
  cena: (slots.cena ?? []).map((mealId) => ({ mealId, portions: 1 })),
  postreCena: null,
});

const ids = (ms: Meal[]): string[] => ms.map((m) => m.id);

describe('candidatosPorTipo', () => {
  it('desayuno: por tag (normalizado) o por historial', () => {
    const meals = [comida('a', ['Desayuno']), comida('b'), comida('c', ['almuerzo'])];
    expect(ids(candidatosPorTipo(meals, [], [], indice).desayuno)).toEqual(['a']);
    expect(ids(candidatosPorTipo(meals, [[dia({ desayuno: ['b'] })]], [], indice).desayuno)).toEqual(['a', 'b']);
  });

  it('almuerzo y cena comparten lista: tag o historial de almuerzo/cena', () => {
    const meals = [comida('a', ['Almuerzo']), comida('b', ['cena']), comida('c'), comida('d')];
    meals.push(comida('e', ['Desayuno']));
    const r = candidatosPorTipo(meals, [[dia({ almuerzo: ['c'], cena: ['e'] })]], [], indice);
    expect(ids(r.almuerzo)).toEqual(['a', 'b', 'c', 'e']);
    expect(r.cena).toEqual(r.almuerzo);
  });

  it('sin ninguna que cumpla: todas las que no son de desayuno', () => {
    const meals = [comida('a', ['Desayuno']), comida('b'), comida('c')];
    const r = candidatosPorTipo(meals, [], [], indice);
    expect(ids(r.almuerzo)).toEqual(['b', 'c']);
    expect(ids(r.cena)).toEqual(['b', 'c']);
  });

  it('nunca: fuera de la lista, postre/salsa/para probar, No como', () => {
    const meals = [
      comida('ok', ['almuerzo', 'Desayuno']),
      comida('lista', ['almuerzo'], { includeInShoppingList: false }),
      comida('postre', ['almuerzo', 'Postre']),
      comida('salsa', ['almuerzo', 'salsa']),
      comida('prueba', ['cena', 'Para probar']),
      comida('choca', ['almuerzo', 'Desayuno'], { ingredients: [{ name: 'cebolla', quantity: '1' }] }),
    ];
    const r = candidatosPorTipo(meals, [], ['cebolla'], indice);
    expect(ids(r.almuerzo)).toEqual(['ok']);
    expect(ids(r.desayuno)).toEqual(['ok']);
  });

  it('un id del historial sin Meal se ignora', () => {
    const r = candidatosPorTipo([comida('a')], [[dia({ almuerzo: ['fantasma'] })]], [], indice);
    expect(ids(r.almuerzo)).toEqual(['a']);
  });
});
