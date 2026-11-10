import { describe, expect, it } from 'vitest';

import { CATALOGO } from '../catalogo/catalogo-datos';
import { indexar } from '../catalogo/catalogo';
import { Meal } from '../models/meal.model';
import { chocaConNoComo, normalizarNoComo, reconocido } from './no-como';

const indice = indexar(CATALOGO);

const comida = (...ingredientes: string[]): Meal => ({
  id: 'm',
  name: 'm',
  ingredients: ingredientes.map((name) => ({ name, quantity: '1' })),
});

describe('chocaConNoComo', () => {
  it('el ingrediente contiene el término; al revés, sólo si es el mismo con plural', () => {
    expect(chocaConNoComo(comida('cebolla morada'), ['cebolla'], indice)).toBe(true);
    expect(chocaConNoComo(comida('cebolla'), ['cebolla morada'], indice)).toBe(false);
    expect(chocaConNoComo(comida('tomate'), ['cebolla'], indice)).toBe(false);
    expect(chocaConNoComo(comida('tomate'), ['tomates'], indice)).toBe(true);
    expect(chocaConNoComo(comida('limón'), ['limones'], indice)).toBe(true);
  });

  it.each([
    ['sal', 'salchichas'],
    ['sal', 'salsa picante'],
    ['pan', 'panceta'],
    ['agua', 'aguacate'],
    ['papa', 'papaya'],
    ['ajo', 'ajonjolí'],
    ['queso', 'queso azul'],
    ['aceite de oliva', 'aceite de coco'],
  ])('%s no choca con "%s": un término más largo no saca lo que contiene', (ingrediente, termino) => {
    expect(chocaConNoComo(comida(ingrediente), [termino], indice)).toBe(false);
  });

  it('también contra el nombre y los sinónimos de la entrada', () => {
    // "pollo" clasifica en "pechuga de pollo"; el término sólo está en la entrada.
    expect(chocaConNoComo(comida('pollo'), ['pechuga'], indice)).toBe(true);
    expect(chocaConNoComo(comida('pollo'), ['bife de pechuga'], indice)).toBe(true);
    expect(chocaConNoComo(comida('pollo'), ['bife de lomo'], indice)).toBe(false);
  });

  it('plurales y falsos positivos aceptados', () => {
    expect(chocaConNoComo(comida('tomates'), ['tomate'], indice)).toBe(true);
    expect(chocaConNoComo(comida('cebollas'), ['cebolla'], indice)).toBe(true);
    // Aceptado a propósito: mejor sacar de más que sugerir lo que no come.
    expect(chocaConNoComo(comida('salmón'), ['sal'], indice)).toBe(true);
  });

  it('categorías, con plural', () => {
    expect(chocaConNoComo(comida('merluza'), ['Pescado'], indice)).toBe(true);
    expect(chocaConNoComo(comida('carne picada'), ['carne roja'], indice)).toBe(true);
    expect(chocaConNoComo(comida('pollo'), ['carne roja'], indice)).toBe(false);
    expect(chocaConNoComo(comida('queso'), ['Lácteos'], indice)).toBe(true);
    expect(chocaConNoComo(comida('queso'), ['lácteo'], indice)).toBe(true);
    expect(chocaConNoComo(comida('carne picada'), ['carnes rojas'], indice)).toBe(true);
    expect(chocaConNoComo(comida('pollo'), ['carnes rojas'], indice)).toBe(false);
    expect(chocaConNoComo(comida('pollo'), ['Carnes blancas'], indice)).toBe(true);
    expect(chocaConNoComo(comida('carne picada'), ['carnes blancas'], indice)).toBe(false);
  });

  it('vacío no choca con nada', () => {
    expect(chocaConNoComo(comida('queso'), ['', '   '], indice)).toBe(false);
    expect(chocaConNoComo(comida('', '  '), ['cebolla', 's'], indice)).toBe(false);
  });

  it('gluten sólo si está escrito', () => {
    expect(chocaConNoComo(comida('pan'), ['gluten'], indice)).toBe(false);
    expect(chocaConNoComo(comida('harina sin gluten'), ['gluten'], indice)).toBe(true);
  });
});

describe('normalizarNoComo', () => {
  it('recorta, descarta lo que no es texto y no repite, con la primera escritura', () => {
    expect(normalizarNoComo([' Cebolla ', 3, 'cebolla', 'CEBOLLA', '', 'Ajo', 'ajó'])).toEqual(['Cebolla', 'Ajo']);
    expect(normalizarNoComo('cebolla')).toEqual([]);
  });
});

describe('reconocido', () => {
  it('categoría o catálogo', () => {
    expect(reconocido('lacteos', indice)).toBe(true);
    expect(reconocido('Cebolla', indice)).toBe(true);
    expect(reconocido('gluten', indice)).toBe(false);
  });
});
