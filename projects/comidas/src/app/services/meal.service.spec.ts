import { describe, expect, it } from 'vitest';

import { ensureMealIds, multiplyQuantity } from './meal.service';
import { Meal } from '../models/meal.model';

describe('ensureMealIds', () => {
  it('asigna un id a las comidas que no lo tienen', () => {
    let n = 0;
    const genId = (): string => `gen-${++n}`;
    const meals = [
      { name: 'Con id', id: 'abc', ingredients: [] },
      // Comida importada vía backup/sync sin id (caso del bug).
      { name: 'Sin id', ingredients: [] },
    ] as Meal[];

    const result = ensureMealIds(meals, genId);

    expect(result[0].id).toBe('abc');
    expect(result[1].id).toBe('gen-1');
    expect(result.every((m) => !!m.id)).toBe(true);
  });

  it('no muta ni regenera el id de las comidas que ya lo tienen', () => {
    const genId = (): string => 'no-deberia-usarse';
    const meal = { name: 'X', id: 'keep', ingredients: [] } as Meal;

    const [r] = ensureMealIds([meal], genId);

    expect(r).toBe(meal);
    expect(r.id).toBe('keep');
  });
});

describe('multiplyQuantity', () => {
  it('multiplica una cantidad entera', () => {
    expect(multiplyQuantity('2', 3)).toBe('6');
  });

  it('interpreta las fracciones en vez de leerlas como entero', () => {
    // parseFloat('1/2') devuelve 1, así que antes esto daba '2'.
    expect(multiplyQuantity('1/2', 2)).toBe('1');
    expect(multiplyQuantity('1/2', 3)).toBe('1.5');
  });

  it('interpreta los números mixtos de receta', () => {
    expect(multiplyQuantity('1 1/2', 2)).toBe('3');
  });

  it('conserva el texto que viene después del número', () => {
    // Antes devolvía '6' y se comía la unidad escrita a mano.
    expect(multiplyQuantity('2 tazas', 3)).toBe('6 tazas');
  });

  it('acepta factores fraccionarios', () => {
    // Antes cualquier factor <= 1 devolvía la cantidad sin tocar.
    expect(multiplyQuantity('2', 0.5)).toBe('1');
  });

  it('deja intacto lo que no empieza con un número', () => {
    expect(multiplyQuantity('a gusto', 3)).toBe('a gusto');
  });

  it('no toca la cantidad cuando el factor es 1', () => {
    expect(multiplyQuantity('2 tazas', 1)).toBe('2 tazas');
  });
});
