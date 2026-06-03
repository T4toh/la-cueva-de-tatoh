import { describe, expect, it } from 'vitest';

import { ensureMealIds } from './meal.service';
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
