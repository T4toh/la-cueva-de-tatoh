import { describe, expect, it } from 'vitest';

import {
  aMeal,
  aRecetaPublica,
  generarIdPublico,
  rutaPublica,
  slug,
} from './receta-publica';
import { Meal, Paso } from '../models/meal.model';

describe('slug', () => {
  it('saca tildes y signos y une con guiones', () => {
    expect(slug('Milanesa a la Napolitana!')).toBe('milanesa-a-la-napolitana');
  });

  it('corta a cinco palabras', () => {
    expect(slug('uno dos tres cuatro cinco seis siete')).toBe(
      'uno-dos-tres-cuatro-cinco'
    );
  });

  it('devuelve vacío cuando no queda ninguna letra usable', () => {
    expect(slug('🍕🍝')).toBe('');
  });
});

describe('rutaPublica', () => {
  it('arma los tres segmentos con el nick adelante', () => {
    expect(rutaPublica('Milanesa napolitana', 'Tatoh', 'k7m2xq9p')).toBe(
      '/r/tatoh/milanesa-napolitana/k7m2xq9p'
    );
  });

  it('omite el segmento del nick cuando no hay alias', () => {
    expect(rutaPublica('Milanesa napolitana', undefined, 'k7m2xq9p')).toBe(
      '/r/milanesa-napolitana/k7m2xq9p'
    );
  });

  it('cae a "receta" cuando el nombre no deja slug', () => {
    expect(rutaPublica('🍕', 'Tatoh', 'k7m2xq9p')).toBe(
      '/r/tatoh/receta/k7m2xq9p'
    );
  });
});

describe('generarIdPublico', () => {
  it('devuelve ocho caracteres en minúsculas y dígitos', () => {
    expect(generarIdPublico()).toMatch(/^[a-z0-9]{8}$/);
  });

  it('descarta los bytes que sesgarían el módulo', () => {
    // 252 y 255 caen fuera de 36*7, así que se tiran; el 0 y el 35 entran.
    const cola = [252, 255, 0, 35, 1, 2, 3, 4, 5, 6];
    const bytes = (): Uint8Array => new Uint8Array(cola.splice(0, 10));
    expect(generarIdPublico(bytes)).toBe('a9bcdefg');
  });

  it('tira error si recibe solo bytes inválidos', () => {
    // Todos 255 caen fuera del rango válido, así que el loop nunca termina.
    // Sin el tope, esto colgaría. Con el tope, tira un error inmediato.
    const bytes = (): Uint8Array => new Uint8Array([255, 255, 255, 255]);
    expect(() => generarIdPublico(bytes)).toThrow(
      /rechazo masivo/
    );
  });

  it('tira error si recibe arrays vacíos', { timeout: 1000 }, () => {
    // Devolver arrays vacíos no suma bytes, así que sin el tope de iteraciones
    // el loop giraría para siempre. Con el tope, tira un error.
    const bytes = (): Uint8Array => new Uint8Array([]);
    expect(() => generarIdPublico(bytes)).toThrow(
      /rechazo masivo/
    );
  });
});

describe('aRecetaPublica', () => {
  const meal: Meal = {
    id: 'meal-1',
    name: 'Milanesa napolitana',
    description: 'La de siempre',
    ingredients: [{ name: 'Carne', quantity: '2' }],
    pasos: [{ texto: 'Freír' }],
    tags: ['secreto'],
    includeInShoppingList: true,
  };

  it('publica sólo los campos de la lista blanca', () => {
    const receta = aRecetaPublica(meal, 'Tatoh', 'uid-1', 'k7m2xq9p', 10);

    expect(receta).toEqual({
      nombre: 'Milanesa napolitana',
      descripcion: 'La de siempre',
      ingredientes: [{ name: 'Carne', quantity: '2' }],
      pasos: [{ texto: 'Freír' }],
      alias: 'Tatoh',
      ruta: '/r/tatoh/milanesa-napolitana/k7m2xq9p',
      actualizada: 10,
      ownerUid: 'uid-1',
    });
  });

  it('no filtra los campos privados', () => {
    const receta = aRecetaPublica(meal, 'Tatoh', 'uid-1', 'k7m2xq9p', 10);

    expect(receta).not.toHaveProperty('tags');
    expect(receta).not.toHaveProperty('includeInShoppingList');
    expect(receta).not.toHaveProperty('id');
  });

  it('omite los opcionales vacíos en vez de escribir undefined', () => {
    const pelada: Meal = { id: 'm', name: 'Arroz', ingredients: [] };

    const receta = aRecetaPublica(pelada, undefined, 'uid-1', 'k7m2xq9p', 10);

    expect(receta).not.toHaveProperty('descripcion');
    expect(receta).not.toHaveProperty('pasos');
    expect(receta).not.toHaveProperty('alias');
  });

  it('trata un alias de sólo espacios como ausente', () => {
    const receta = aRecetaPublica(meal, '   ', 'uid-1', 'k7m2xq9p', 10);

    expect(receta).not.toHaveProperty('alias');
    expect(receta.ruta).toBe('/r/milanesa-napolitana/k7m2xq9p');
  });

  it('guarda el alias trimeado, no con los espacios de sobra', () => {
    const receta = aRecetaPublica(meal, '  Tatoh  ', 'uid-1', 'k7m2xq9p', 10);

    expect(receta.alias).toBe('Tatoh');
  });

  it('trata una descripción de sólo espacios como ausente', () => {
    const conBlancos: Meal = { ...meal, description: '\n\n\n\n' };

    const receta = aRecetaPublica(conBlancos, undefined, 'uid-1', 'k7m2xq9p', 10);

    expect(receta).not.toHaveProperty('descripcion');
  });

  it('guarda la descripción trimeada, no con los espacios de sobra', () => {
    const conEspacios: Meal = { ...meal, description: '  La de siempre  ' };

    const receta = aRecetaPublica(conEspacios, undefined, 'uid-1', 'k7m2xq9p', 10);

    expect(receta.descripcion).toBe('La de siempre');
  });

  it('proyecta cada paso y no filtra campos que Paso gane mañana', () => {
    const conNota: Meal = {
      id: 'm',
      name: 'Arroz',
      ingredients: [],
      // Un campo futuro privado (como una nota por paso) simulado acá: si
      // `pasos` se copiara por referencia, viajaría al documento público.
      pasos: [{ texto: 'Hervir', nota: 'privada' } as Paso],
    };

    const receta = aRecetaPublica(conNota, undefined, 'uid-1', 'k7m2xq9p', 10);

    expect(receta.pasos).toEqual([{ texto: 'Hervir' }]);
  });

  it('proyecta cada ingrediente y no filtra campos privados como checked', () => {
    const conTilde: Meal = {
      id: 'm',
      name: 'Arroz',
      ingredients: [{ name: 'Arroz', quantity: '1', unit: 'kg', checked: true }],
    };

    const receta = aRecetaPublica(conTilde, undefined, 'uid-1', 'k7m2xq9p', 10);

    expect(receta.ingredientes).toEqual([
      { name: 'Arroz', quantity: '1', unit: 'kg' },
    ]);
  });

  it('publica la foto del plato y la de cada paso', () => {
    const mealConFoto: Meal = {
      id: '1',
      name: 'Mila',
      ingredients: [],
      foto: 'https://ejemplo.com/plato.jpg',
      pasos: [{ texto: 'Empanar', foto: 'https://ejemplo.com/paso1.jpg' }],
    };

    const receta = aRecetaPublica(mealConFoto, 'Tatoh', 'uid-1', 'abcd1234', 0);

    expect(receta.foto).toBe('https://ejemplo.com/plato.jpg');
    expect(receta.pasos).toEqual([
      { texto: 'Empanar', foto: 'https://ejemplo.com/paso1.jpg' },
    ]);
  });

  it('una receta sin fotos no escribe las claves', () => {
    const mealSinFoto: Meal = {
      id: '1',
      name: 'Mila',
      ingredients: [],
      pasos: [{ texto: 'Empanar' }],
    };

    const receta = aRecetaPublica(mealSinFoto, '', 'uid-1', 'abcd1234', 0);

    expect('foto' in receta).toBe(false);
    expect(receta.pasos).toEqual([{ texto: 'Empanar' }]);
  });
});

describe('aMeal', () => {
  it('reconstruye una comida mostrable desde el documento público', () => {
    const receta = aRecetaPublica(
      { id: 'm', name: 'Arroz', ingredients: [{ name: 'Arroz', quantity: '1' }] },
      undefined,
      'uid-1',
      'k7m2xq9p',
      10
    );

    expect(aMeal(receta, 'k7m2xq9p')).toEqual({
      id: 'k7m2xq9p',
      name: 'Arroz',
      ingredients: [{ name: 'Arroz', quantity: '1' }],
    });
  });
});
