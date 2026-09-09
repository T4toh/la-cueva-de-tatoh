import { describe, expect, it } from 'vitest';

import {
  copiaParaDuplicar,
  ensureMealIds,
  filtrarComidas,
  huellaPublicada,
  huerfanos,
  limpiarPasos,
  multiplyQuantity,
  normalizeQuantityToNumeric,
  pareceBackup,
  parseNumericQuantity,
  publicIds,
  recetaComoMarkdown,
  tagsUnicos,
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

describe('huellaPublicada', () => {
  it('no cambia si a la comida se le agrega publicId', () => {
    // La siembra de compartirMeal calcula la huella ANTES de guardar el
    // publicId; si el campo entrara a la huella, sembrar y sincronizar
    // calcularían valores distintos y la reescritura de más volvería.
    const meal: Meal = {
      id: 'm',
      name: 'Milanesa',
      description: 'La de siempre',
      ingredients: [{ name: 'Carne', quantity: '2' }],
      pasos: [{ texto: 'Freír' }],
    };
    const conPublicId: Meal = { ...meal, publicId: 'abc12345' };

    expect(huellaPublicada(conPublicId, 'Tatoh')).toBe(
      huellaPublicada(meal, 'Tatoh')
    );
  });

  it('cambia si cambia el alias', () => {
    const meal: Meal = { id: 'm', name: 'Arroz', ingredients: [] };
    expect(huellaPublicada(meal, 'Tatoh')).not.toBe(
      huellaPublicada(meal, 'Otro')
    );
  });

  it('cambiar la foto cambia la huella: si no, no se re-publica', () => {
    const base: Meal = { id: '1', name: 'Mila', ingredients: [] };
    const conFoto: Meal = { ...base, foto: 'https://ejemplo.com/a.jpg' };

    expect(huellaPublicada(conFoto, '')).not.toBe(huellaPublicada(base, ''));
  });
});

describe('copiaParaDuplicar', () => {
  // Todos los campos de `Meal` poblados (salvo `id`, que la copia no lleva):
  // si se agrega un campo a `Meal` y esta función no se actualiza, el
  // `toEqual` de abajo empieza a fallar en vez de perder el dato en silencio.
  const original: Meal = {
    id: 'meal-1',
    name: 'Milanesa napolitana',
    description: 'La de siempre',
    ingredients: [
      { name: 'Carne', quantity: '2', unit: 'filetes', checked: true },
    ],
    tags: ['favorita'],
    includeInShoppingList: true,
    pasos: [{ texto: 'Freír' }, { texto: 'Napolizar' }],
    foto: 'https://ejemplo.com/mila.jpg',
    publicId: 'k7m2xq9p',
  };

  it('copia todos los campos salvo id y publicId, con el sufijo en el nombre', () => {
    const copia = copiaParaDuplicar(original);

    expect(copia).toEqual({
      name: 'Milanesa napolitana (Copia)',
      description: 'La de siempre',
      ingredients: [
        { name: 'Carne', quantity: '2', unit: 'filetes', checked: true },
      ],
      tags: ['favorita'],
      includeInShoppingList: true,
      pasos: [{ texto: 'Freír' }, { texto: 'Napolizar' }],
      foto: 'https://ejemplo.com/mila.jpg',
    });
  });

  it('no lleva publicId: la copia es una receta distinta con link propio', () => {
    expect(copiaParaDuplicar(original)).not.toHaveProperty('publicId');
  });

  it('copia ingredients y pasos en profundidad, no por referencia', () => {
    const copia = copiaParaDuplicar(original);

    copia.ingredients[0].name = 'Pollo';
    if (copia.pasos) {
      copia.pasos[0].texto = 'Hervir';
    }

    expect(original.ingredients[0].name).toBe('Carne');
    expect(original.pasos?.[0].texto).toBe('Freír');
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

  it('en ×1 respeta la fracción tal como se escribió', () => {
    // La receta dice "1/2 taza": mostrarle "0.5 taza" es reescribirle el texto.
    expect(multiplyQuantity('1/2', 1)).toBe('1/2');
    expect(multiplyQuantity('1 1/2 tazas', 1)).toBe('1 1/2 tazas');
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

describe('recetaComoMarkdown', () => {
  const receta = (extra: Partial<Meal> = {}): Meal =>
    ({
      id: 'x',
      name: 'Salsa de tomate',
      ingredients: [
        { name: 'Tomate perita', quantity: '0.5', unit: 'kg' },
        { name: 'Sal', quantity: 'a gusto' },
      ],
      pasos: [{ texto: 'Picar la cebolla' }, { texto: 'Dorar 5 minutos' }],
      ...extra,
    }) as Meal;

  it('arma título, ingredientes y pasos numerados', () => {
    expect(recetaComoMarkdown(receta())).toBe(
      [
        '# Salsa de tomate',
        '',
        '## Ingredientes',
        '',
        '- 0.5 kg — Tomate perita',
        '- a gusto — Sal',
        '',
        '## Preparación',
        '',
        '1. Picar la cebolla',
        '2. Dorar 5 minutos',
        '',
      ].join('\n')
    );
  });

  it('mete la descripción cuando hay', () => {
    const md = recetaComoMarkdown(receta({ description: 'La de siempre.' }));

    expect(md).toContain('# Salsa de tomate\n\nLa de siempre.\n');
  });

  it('omite las secciones vacías en vez de dejar el encabezado solo', () => {
    const md = recetaComoMarkdown(receta({ ingredients: [], pasos: [] }));

    expect(md).toBe('# Salsa de tomate\n');
  });
});

describe('huerfanos', () => {
  const conPublicId = (id: string, publicId?: string): Meal =>
    ({
      id,
      name: id,
      ingredients: [],
      ...(publicId ? { publicId } : {}),
    }) as Meal;

  it('reporta el publicId que dejó de estar en meals', () => {
    // El caso del bug: un import pisa `meals` entero y se lleva el único
    // puntero al documento público, que queda vivo y sin forma de enumerarlo.
    const previos = new Set(['aaaaaaaa']);

    expect(huerfanos(previos, [conPublicId('1')])).toEqual(['aaaaaaaa']);
  });

  it('no reporta el publicId que sigue estando', () => {
    const previos = new Set(['aaaaaaaa']);
    const meals = [conPublicId('1', 'aaaaaaaa')];

    expect(huerfanos(previos, meals)).toEqual([]);
  });

  it('reporta sólo el que falta cuando hay varios publicados', () => {
    const previos = new Set(['aaaaaaaa', 'bbbbbbbb']);
    const meals = [conPublicId('1', 'aaaaaaaa'), conPublicId('2')];

    expect(huerfanos(previos, meals)).toEqual(['bbbbbbbb']);
  });

  it('con el set vacío no reporta nada: es como arranca el servicio', () => {
    const meals = [conPublicId('1', 'aaaaaaaa')];

    expect(huerfanos(new Set(), meals)).toEqual([]);
  });

  it('una comida que gana publicId no vuelve huérfano al que ya estaba', () => {
    const previos = new Set(['aaaaaaaa']);
    const meals = [conPublicId('1', 'aaaaaaaa'), conPublicId('2', 'bbbbbbbb')];

    expect(huerfanos(previos, meals)).toEqual([]);
  });
});

describe('publicIds', () => {
  it('junta los publicId y saltea las comidas sin publicar', () => {
    const meals = [
      { id: '1', name: 'a', ingredients: [], publicId: 'aaaaaaaa' },
      { id: '2', name: 'b', ingredients: [] },
    ] as Meal[];

    expect(publicIds(meals)).toEqual(new Set(['aaaaaaaa']));
  });

  it('trata el publicId vacío como no publicado', () => {
    // `updateMeal(id, { publicId: undefined })` deja la clave presente con
    // valor undefined, así que el filtro tiene que ser por valor y no por
    // existencia de la propiedad.
    const meals = [
      { id: '1', name: 'a', ingredients: [], publicId: undefined },
    ] as Meal[];

    expect(publicIds(meals)).toEqual(new Set());
  });
});

const comida = (parcial: Partial<Meal> & { id: string }): Meal => ({
  name: parcial.id,
  ingredients: [],
  ...parcial,
});

describe('tagsUnicos', () => {
  it('junta los tags de todas las comidas, sin repetir y ordenados', () => {
    const meals = [
      comida({ id: '1', tags: ['postre', 'rapido'] }),
      comida({ id: '2', tags: ['rapido'] }),
      comida({ id: '3' }),
    ];

    expect(tagsUnicos(meals)).toEqual(['postre', 'rapido']);
  });

  it('devuelve vacío cuando ninguna comida tiene tags', () => {
    expect(tagsUnicos([comida({ id: '1' })])).toEqual([]);
  });
});

describe('filtrarComidas', () => {
  const meals = [
    comida({ id: 'postre-publico', tags: ['postre'], publicId: 'aaaaaaaa' }),
    comida({ id: 'postre-privado', tags: ['postre'] }),
    comida({ id: 'salado-publico', tags: ['salado'], publicId: 'bbbbbbbb' }),
    comida({ id: 'sin-tags' }),
  ];

  const ids = (r: Meal[]): string[] => r.map((m) => m.id);

  it('sin filtros devuelve todo', () => {
    expect(filtrarComidas(meals, null, false)).toHaveLength(4);
  });

  it('filtra por tag', () => {
    expect(ids(filtrarComidas(meals, 'postre', false))).toEqual([
      'postre-publico',
      'postre-privado',
    ]);
  });

  it('filtra por compartidas', () => {
    expect(ids(filtrarComidas(meals, null, true))).toEqual([
      'postre-publico',
      'salado-publico',
    ]);
  });

  // Los dos filtros son independientes a propósito: es la razón por la que no
  // son una unión con un tag centinela.
  it('compone los dos filtros', () => {
    expect(ids(filtrarComidas(meals, 'postre', true))).toEqual([
      'postre-publico',
    ]);
  });

  it('trata el publicId undefined como no compartida', () => {
    const conClavePresente = [comida({ id: '1', publicId: undefined })];

    expect(filtrarComidas(conClavePresente, null, true)).toEqual([]);
  });
});

describe('pareceBackup', () => {
  // Las claves reales de un backup exportado por la app.
  it('reconoce un backup exportado', () => {
    expect(
      pareceBackup({ meals: [], schedules: {}, pantry: [], version: '1.4' })
    ).toBe(true);
  });

  it('alcanza con una sola clave conocida', () => {
    expect(pareceBackup({ alias: 'Tatoh' })).toBe(true);
  });

  // Sin esto, elegir el archivo equivocado no aplicaba nada y el cartel decía
  // "¡Datos importados con éxito!".
  it('un JSON válido que no es un backup se rechaza', () => {
    expect(pareceBackup({ hola: 'mundo' })).toBe(false);
    expect(pareceBackup({ version: '1.4' })).toBe(false);
    expect(pareceBackup([])).toBe(false);
    expect(pareceBackup('meals')).toBe(false);
    expect(pareceBackup(null)).toBe(false);
  });
});
