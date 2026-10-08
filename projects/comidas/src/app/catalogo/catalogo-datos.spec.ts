import { describe, expect, it } from 'vitest';

import { clasificar, indexar, normalizar } from './catalogo';
import { CATALOGO, TAGS_BASE } from './catalogo-datos';

describe('CATALOGO', () => {
  it('ningún nombre ni sinónimo se repite entre entradas', () => {
    const vistas = new Map<string, string>();
    const choques: string[] = [];
    for (const e of CATALOGO) {
      for (const clave of [e.nombre, ...(e.sinonimos ?? [])].map(normalizar)) {
        const otra = vistas.get(clave);
        if (otra && otra !== e.nombre) {
          choques.push(`${clave}: ${otra} / ${e.nombre}`);
        }
        vistas.set(clave, e.nombre);
      }
    }
    expect(choques).toEqual([]);
  });

  it('la porción es un número positivo', () => {
    for (const e of CATALOGO) {
      if (e.porcion !== undefined) {
        expect(e.porcion, e.nombre).toBeGreaterThan(0);
      }
    }
  });

  it('legumbre sólo dentro de feculentos', () => {
    expect(CATALOGO.filter((e) => e.legumbre && e.grupo !== 'feculentos')).toEqual([]);
  });

  // Los ingredientes de las recetas reales (las del usuario y las de los
  // planes de referencia). Si alguno deja de clasificarse, se rompió un
  // sinónimo.
  it('clasifica los ingredientes de las recetas de referencia', () => {
    const indice = indexar(CATALOGO);
    const nombres = [
      'aceite de oliva', 'aceitunas negras', 'acelga', 'acelga o espinaca', 'aji', 'aji verde', 'ajo',
      'albahaca', 'anana', 'apio', 'arroz', 'arroz integral', 'arvejas', 'atun al natural',
      'avena arrollada', 'banana', 'batata', 'berenjena', 'berro', 'bife de pechuga', 'boniato', 'brocoli',
      'brotes de arveja o soja', 'brotes de soja', 'calabaza', 'caldo', 'caldo de verduras', 'canela',
      'carne magra', 'carne picada magra', 'carne picada muy magra', 'carne vacuna magra', 'cebolla',
      'cebolla de verdeo', 'cebolla morada', 'cerdo', 'champignones', 'chauchas', 'choclo',
      'choclo desgranado', 'churrasco magro', 'clara', 'coliflor', 'corazones de alcaucil',
      'crema de leche light', 'espinaca', 'espinaca o acelga', 'fideos', 'filet de brotola',
      'filet de merluza', 'filet de pescado', 'garbanzos', 'garbanzos cocidos', 'harina de avena',
      'harina de garbanzos', 'hojas verdes', 'huevo', 'laurel', 'leche descremada', 'lechuga', 'lentejas',
      'lentejas cocidas', 'limon', 'lomo de cerdo', 'maicena', 'manzana', 'manzana verde',
      'mayonesa sin colesterol', 'medallon de lomo', 'milanesa de pescado', 'morron', 'morron rojo',
      'mostaza', 'mozzarella', 'naranja', 'palmitos', 'palta', 'pan integral', 'pan rallado', 'papa',
      'pechuga de pollo', 'pepino', 'perejil', 'pimenton dulce', 'polenta', 'pollo (cuarto)',
      'pollo cocido', 'pollo hervido', 'polvo de hornear', 'porotos', 'porotos aduki', 'porotos cocidos',
      'porotos negros', 'puerro', 'pulpa de tomate', 'pure de tomate', 'queso', 'queso blanco descremado',
      'queso fresco descremado', 'queso port salut', 'queso rallado', 'rabanitos', 'radicheta', 'remolacha',
      'repollo', 'repollo blanco', 'repollo colorado', 'ricota descremada', 'rucula', 'salsa golf diet',
      'semillas de lino', 'spaghetti', 'tapa de tarta', 'tapas de empanada', 'tapas de tarta', 'tomate',
      'tomate pelado', 'tomate perita', 'tomate triturado', 'tomates cherry', 'tortillas para wrap',
      'tostadas de arroz', 'vino blanco', 'yogur natural', 'zanahoria', 'zapallito', 'zapallito redondo',
      'zapallo', 'zucchini', 'muzza', 'zuccini', 'pechuga', 'huevos', 'cebollas', 'zapallitos',
      'nueces', 'datiles', 'sal', 'escencia de vainilla', 'harina de almendras',
    ];
    expect(nombres.filter((n) => !clasificar(n, indice))).toEqual([]);
  });

  it('el tomate procesado es la misma planta que el tomate', () => {
    const indice = indexar(CATALOGO);
    expect(clasificar('tomate triturado', indice)?.nombre).toBe(clasificar('tomate', indice)?.nombre);
  });
});

describe('TAGS_BASE', () => {
  it('no repite tags', () => {
    expect(new Set(TAGS_BASE.map(normalizar)).size).toBe(TAGS_BASE.length);
  });
});
