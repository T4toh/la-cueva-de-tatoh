import { describe, expect, it } from 'vitest';

import {
  ensureMealIds,
  limpiarPasos,
  multiplyQuantity,
  normalizeQuantityToNumeric,
  parseNumericQuantity,
  tieneReceta,
} from './meal.service';
import { Meal, Paso } from '../models/meal.model';

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

describe('parseo compartido de cantidades', () => {
  it('no divide por cero', () => {
    expect(multiplyQuantity('1/0', 2)).toBe('1/0');
  });

  it('normalizar no aplasta la fracción a entero', () => {
    // Corre al cargar desde Firestore: si acá se pierde, se guarda perdida.
    expect(normalizeQuantityToNumeric('1/2')).toBe('1/2');
    expect(normalizeQuantityToNumeric('1 1/2 tazas')).toBe('1 1/2');
  });

  it('separar cantidad y unidad entiende la fracción', () => {
    // Antes partía en value 1 y unit '/2 taza'.
    expect(parseNumericQuantity('1/2 taza')).toEqual({
      value: 0.5,
      unit: 'taza',
    });
  });

  it('sigue partiendo el formato viejo "500 g"', () => {
    expect(parseNumericQuantity('500 g')).toEqual({ value: 500, unit: 'g' });
  });

  it('devuelve null cuando no hay número que sacar', () => {
    expect(parseNumericQuantity('a gusto')).toBeNull();
  });
});

describe('tieneReceta', () => {
  const comida = (pasos?: { texto: string }[]): Meal =>
    ({ id: 'x', name: 'X', ingredients: [], pasos }) as Meal;

  it('una comida sin pasos no es receta', () => {
    expect(tieneReceta(comida())).toBe(false);
    expect(tieneReceta(comida([]))).toBe(false);
  });

  it('un paso en blanco no alcanza para ser receta', () => {
    expect(tieneReceta(comida([{ texto: '   ' }]))).toBe(false);
  });

  it('con un paso escrito ya es receta', () => {
    expect(tieneReceta(comida([{ texto: 'Picar la cebolla' }]))).toBe(true);
  });
});

describe('limpiarPasos', () => {
  it('descarta los pasos vacíos y trimea el resto, en orden', () => {
    const pasos = [
      { texto: '  Picar la cebolla ' },
      { texto: '   ' },
      { texto: 'Dorar 5 minutos' },
    ];

    expect(limpiarPasos(pasos)).toEqual([
      { texto: 'Picar la cebolla' },
      { texto: 'Dorar 5 minutos' },
    ]);
  });

  it('conserva los campos que no sean el texto', () => {
    // Para que sumar la foto en la entrega 4 no se la coma.
    // `foto` todavía no está en el tipo: llega en la entrega 4.
    const pasos = [{ texto: ' Hervir ', foto: 'u/1.jpg' }] as unknown as Paso[];

    expect(limpiarPasos(pasos)).toEqual([{ texto: 'Hervir', foto: 'u/1.jpg' }]);
  });
});
