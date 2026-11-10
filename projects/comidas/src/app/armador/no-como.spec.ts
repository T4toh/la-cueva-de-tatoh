import { describe, expect, it } from 'vitest';

import { CATALOGO } from '../catalogo/catalogo-datos';
import { indexar } from '../catalogo/catalogo';
import { Meal } from '../models/meal.model';
import { chocaConNoComo, reconocido } from './no-como';

const indice = indexar(CATALOGO);

const comida = (...ingredientes: string[]): Meal => ({
  id: 'm',
  name: 'm',
  ingredients: ingredientes.map((name) => ({ name, quantity: '1' })),
});

describe('chocaConNoComo', () => {
  it('"contiene" en los dos sentidos', () => {
    expect(chocaConNoComo(comida('cebolla morada'), ['cebolla'], indice)).toBe(true);
    expect(chocaConNoComo(comida('cebolla'), ['cebolla morada'], indice)).toBe(true);
    expect(chocaConNoComo(comida('tomate'), ['cebolla'], indice)).toBe(false);
  });

  it('también contra los sinónimos de la entrada', () => {
    expect(chocaConNoComo(comida('verdeo'), ['cebolla de verdeo'], indice)).toBe(true);
  });

  it('categorías, con plural', () => {
    expect(chocaConNoComo(comida('merluza'), ['Pescado'], indice)).toBe(true);
    expect(chocaConNoComo(comida('carne picada'), ['carne roja'], indice)).toBe(true);
    expect(chocaConNoComo(comida('pollo'), ['carne roja'], indice)).toBe(false);
    expect(chocaConNoComo(comida('queso'), ['Lácteos'], indice)).toBe(true);
    expect(chocaConNoComo(comida('queso'), ['lácteo'], indice)).toBe(true);
  });

  it('vacío no choca con nada', () => {
    expect(chocaConNoComo(comida('queso'), ['', '   '], indice)).toBe(false);
  });

  it('gluten sólo si está escrito', () => {
    expect(chocaConNoComo(comida('pan'), ['gluten'], indice)).toBe(false);
    expect(chocaConNoComo(comida('harina sin gluten'), ['gluten'], indice)).toBe(true);
  });
});

describe('reconocido', () => {
  it('categoría o catálogo', () => {
    expect(reconocido('lacteos', indice)).toBe(true);
    expect(reconocido('Cebolla', indice)).toBe(true);
    expect(reconocido('gluten', indice)).toBe(false);
  });
});
