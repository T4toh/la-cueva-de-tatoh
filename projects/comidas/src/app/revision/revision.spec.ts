import { describe, expect, it } from 'vitest';

import { Meal } from '../models/meal.model';
import {
  aplicarRevisiones,
  descartarSugerencias,
  estadoRevision,
  firmaReceta,
  recetasSinRevisar,
  sumarSugerencia,
} from './revision';

const okonomiyaki = (): Meal => ({
  id: 'oko',
  name: 'Okonomiyaki',
  tags: ['japonesa', 'cena'],
  ingredients: [
    { name: 'cebolla', quantity: '1/2', unit: 'unidad' },
    { name: 'queso', quantity: '30', unit: 'g' },
    { name: 'huevo', quantity: '2', unit: 'unidad' },
    { name: 'repollo', quantity: '1', unit: 'taza' },
  ],
});

const zanahoria = { name: 'zanahoria rallada', quantity: '1', unit: 'unidad', motivo: 'en la mezcla, le da cuerpo' };
const palta = { name: 'palta', quantity: '1/2', unit: 'unidad', motivo: 'arriba, al servir' };

const revisada = (meal: Meal, corta: boolean, sugerencias = corta ? [zanahoria, palta] : []): Meal => ({
  ...meal,
  revision: { firma: firmaReceta(meal), corta, sugerencias },
});

describe('firmaReceta', () => {
  it('no cambia con checked, foto ni includeInShoppingList', () => {
    const base = okonomiyaki();
    const otra: Meal = {
      ...base,
      foto: 'https://x/y.jpg',
      includeInShoppingList: false,
      ingredients: base.ingredients.map((i) => ({ ...i, checked: true })),
    };
    expect(firmaReceta(otra)).toBe(firmaReceta(base));
  });

  it('no cambia con el orden de los tags', () => {
    const base = okonomiyaki();
    expect(firmaReceta({ ...base, tags: ['cena', 'japonesa'] })).toBe(firmaReceta(base));
  });

  it('cambia con nombre, un tag, quantity o unit', () => {
    const base = okonomiyaki();
    const firma = firmaReceta(base);
    expect(firmaReceta({ ...base, name: 'Okonomiyaki 2' })).not.toBe(firma);
    expect(firmaReceta({ ...base, tags: ['postre'] })).not.toBe(firma);
    const conCantidad = base.ingredients.map((i, n) => (n === 3 ? { ...i, quantity: '2' } : i));
    expect(firmaReceta({ ...base, ingredients: conCantidad })).not.toBe(firma);
    const conUnidad = base.ingredients.map((i, n) => (n === 1 ? { ...i, unit: 'cda' } : i));
    expect(firmaReceta({ ...base, ingredients: conUnidad })).not.toBe(firma);
  });
});

describe('estadoRevision', () => {
  it('sin revision está sin revisar', () => {
    expect(estadoRevision(okonomiyaki())).toBe('sin-revisar');
  });

  it('con una firma vieja está sin revisar', () => {
    const vieja = revisada(okonomiyaki(), true);
    expect(estadoRevision({ ...vieja, name: 'Otro nombre' })).toBe('sin-revisar');
  });

  it('corta con sugerencias está corta', () => {
    expect(estadoRevision(revisada(okonomiyaki(), true))).toBe('corta');
  });

  it('corta sin sugerencias está ok', () => {
    expect(estadoRevision(revisada(okonomiyaki(), true, []))).toBe('ok');
  });

  it('no corta está ok', () => {
    expect(estadoRevision(revisada(okonomiyaki(), false))).toBe('ok');
  });

  it('sin ingredientes no aplica', () => {
    expect(estadoRevision({ id: 'afuera', name: 'Comida afuera', ingredients: [] })).toBe('no-aplica');
  });
});

describe('recetasSinRevisar', () => {
  it('deja sólo las sin revisar', () => {
    const sin = okonomiyaki();
    const meals = [
      sin,
      { id: 'afuera', name: 'Comida afuera', ingredients: [] },
      revisada({ ...okonomiyaki(), id: 'c' }, true),
      revisada({ ...okonomiyaki(), id: 'o' }, false),
    ];
    expect(recetasSinRevisar(meals)).toEqual([sin]);
  });
});

describe('aplicarRevisiones', () => {
  it('guarda la revisión en la receta del id y deja las demás igual', () => {
    const oko = okonomiyaki();
    const otra: Meal = { ...okonomiyaki(), id: 'otra' };
    const resultado = aplicarRevisiones([oko, otra], [
      { id: 'oko', firma: firmaReceta(oko), corta: true, sugerencias: [zanahoria] },
    ]);
    expect(resultado[0].revision).toEqual({ firma: firmaReceta(oko), corta: true, sugerencias: [zanahoria] });
    expect(estadoRevision(resultado[0])).toBe('corta');
    expect(resultado[1]).toBe(otra);
  });

  it('ignora un id que no existe', () => {
    const oko = okonomiyaki();
    const resultado = aplicarRevisiones([oko], [{ id: 'nada', firma: 'x', corta: false, sugerencias: [] }]);
    expect(resultado).toEqual([oko]);
  });

  it('si la receta cambió mientras se pedía, queda sin revisar', () => {
    const enviada = okonomiyaki();
    const firma = firmaReceta(enviada);
    const editada: Meal = { ...enviada, name: 'Okonomiyaki con panceta' };
    const [resultado] = aplicarRevisiones([editada], [{ id: 'oko', firma, corta: true, sugerencias: [zanahoria] }]);
    expect(estadoRevision(resultado)).toBe('sin-revisar');
  });
});

describe('sumarSugerencia', () => {
  it('agrega el ingrediente sin motivo, la saca de la lista y sigue corta si quedan', () => {
    const resultado = sumarSugerencia(revisada(okonomiyaki(), true), 0);
    expect(resultado.ingredients.at(-1)).toEqual({ name: 'zanahoria rallada', quantity: '1', unit: 'unidad' });
    expect(resultado.revision?.sugerencias).toEqual([palta]);
    expect(estadoRevision(resultado)).toBe('corta');
  });

  it('al sumar la última queda ok', () => {
    const una = sumarSugerencia(revisada(okonomiyaki(), true), 0);
    expect(estadoRevision(sumarSugerencia(una, 0))).toBe('ok');
  });
});

describe('descartarSugerencias', () => {
  it('vacía las sugerencias y queda ok', () => {
    const meal = revisada(okonomiyaki(), true);
    const resultado = descartarSugerencias(meal);
    expect(resultado.revision?.sugerencias).toEqual([]);
    expect(resultado.revision?.firma).toBe(meal.revision?.firma);
    expect(estadoRevision(resultado)).toBe('ok');
  });
});
