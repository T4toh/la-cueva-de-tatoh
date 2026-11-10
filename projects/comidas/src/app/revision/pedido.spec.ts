import { describe, expect, it } from 'vitest';

import { indexar } from '../catalogo/catalogo';
import { Meal } from '../models/meal.model';
import {
  esErrorTransitorio,
  esquemaRespuesta,
  mensajeDeError,
  Pedir,
  promptRevision,
  RecetaParaFlash,
  resumenParaFlash,
  revisarEnTandas,
  validarRespuesta,
} from './pedido';
import { firmaReceta } from './revision';

const indice = indexar([
  { nombre: 'cebolla', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'repollo', grupo: 'hortalizas', unidad: 'taza' },
  { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad', porcion: 1, compra: 6 },
  { nombre: 'queso', grupo: 'lacteos', unidad: 'g', porcion: 30 },
  { nombre: 'lechuga', grupo: 'hortalizas', unidad: 'unidad' },
]);

const okonomiyaki: Meal = {
  id: 'oko',
  name: 'Okonomiyaki',
  description: 'Panqueque japonés',
  tags: ['cena'],
  foto: 'https://x/y.jpg',
  publicId: 'abc12345',
  pasos: [{ texto: 'Mezclar todo' }],
  ingredients: [
    { name: 'cebolla', quantity: '1/2', unit: 'unidad' },
    { name: 'queso', quantity: '30', unit: 'g' },
    { name: 'huevo', quantity: '2', unit: 'unidad' },
    { name: 'repollo', quantity: '1', unit: 'taza' },
  ],
};

const ensalada: Meal = {
  id: 'ens',
  name: 'Ensalada',
  ingredients: [{ name: 'lechuga', quantity: '1', unit: 'unidad' }],
};

const sugerencia = (name: string, quantity = '1'): Record<string, unknown> => ({
  name,
  quantity,
  unit: 'unidad',
  motivo: 'al costado',
});

describe('resumenParaFlash', () => {
  const resumen = resumenParaFlash(okonomiyaki, indice);

  it('no manda pasos, foto, publicId ni descripción', () => {
    const json = JSON.stringify(resumen);
    expect(json).not.toContain('Mezclar todo');
    expect(json).not.toContain('https://x/y.jpg');
    expect(json).not.toContain('abc12345');
    expect(json).not.toContain('Panqueque japonés');
  });

  it('lleva la porción de referencia cuando el catálogo la tiene', () => {
    const huevo = resumen.ingredientes.find((i) => i.nombre === 'huevo');
    const repollo = resumen.ingredientes.find((i) => i.nombre === 'repollo');
    expect(huevo?.porcionReferencia).toBe('ref. 1 unidad por persona');
    expect(repollo?.porcionReferencia).toBeUndefined();
  });

  it('lleva los grupos del plato', () => {
    expect(resumen.grupos.verdura).toBe(true);
    expect(resumen.grupos.proteina).toBe(true);
  });
});

describe('promptRevision', () => {
  it('incluye las recetas y dice que las cantidades son por una porción', () => {
    const prompt = promptRevision([resumenParaFlash(okonomiyaki, indice)]);
    expect(prompt).toContain('"id":"oko"');
    expect(prompt).toContain('por una porción');
  });

  it('pide ingredientes concretos, no preparaciones', () => {
    // "1 taza de ensalada verde" no se puede comprar ni sumar a la lista.
    const prompt = promptRevision([resumenParaFlash(okonomiyaki, indice)]);
    expect(prompt).toContain('un solo ingrediente concreto');
    expect(prompt).toContain('ensalada verde');
  });

  it('da un criterio de plato lleno para almuerzo y cena', () => {
    // Sin esto, el modelo da por completa cualquier receta que tenga de todo
    // un poco: el okonomiyaki de media cebolla y una taza de repollo pasaba.
    const prompt = promptRevision([resumenParaFlash(okonomiyaki, indice)]);
    expect(prompt).toContain('medio plato de verduras');
    expect(prompt).toContain('aunque tenga de todo un poco');
  });

  it('con No como pide no sugerir esos ingredientes; vacía no menciona nada', () => {
    const recetas = [resumenParaFlash(okonomiyaki, indice)];
    const prompt = promptRevision(recetas, ['cebolla', 'gluten']);
    expect(prompt).toContain('cebolla, gluten');
    expect(prompt).toContain('no sugieras ninguno');
    expect(promptRevision(recetas, [])).not.toContain('no sugieras');
    expect(promptRevision(recetas)).toBe(promptRevision(recetas, []));
  });
});

describe('esquemaRespuesta', () => {
  it('restringe los ids a los enviados', () => {
    expect(JSON.stringify(esquemaRespuesta(['oko', 'ens']))).toContain('["oko","ens"]');
  });
});

describe('validarRespuesta', () => {
  const enviadas = [okonomiyaki, ensalada];

  it('devuelve el resultado con la firma de la receta enviada', () => {
    const raw = { recetas: [{ id: 'oko', corta: true, sugerencias: [sugerencia('zanahoria rallada')] }] };
    expect(validarRespuesta(raw, enviadas)).toEqual([
      {
        id: 'oko',
        firma: firmaReceta(okonomiyaki),
        corta: true,
        sugerencias: [{ name: 'zanahoria rallada', quantity: '1', unit: 'unidad', motivo: 'al costado' }],
      },
    ]);
  });

  it('descarta ids no enviados y se queda con el primero de un repetido', () => {
    const raw = {
      recetas: [
        { id: 'otro', corta: false, sugerencias: [] },
        { id: 'ens', corta: false, sugerencias: [] },
        { id: 'ens', corta: true, sugerencias: [sugerencia('tomate')] },
      ],
    };
    const resultado = validarRespuesta(raw, enviadas);
    expect(resultado.map((r) => r.id)).toEqual(['ens']);
    expect(resultado[0].corta).toBe(false);
  });

  it('descarta sugerencias con cantidad ilegible o sin nombre', () => {
    const raw = {
      recetas: [
        {
          id: 'oko',
          corta: true,
          sugerencias: [
            sugerencia('palta', '½'),
            sugerencia('pan', 'un poco'),
            sugerencia('  '),
            sugerencia('zanahoria'),
          ],
        },
      ],
    };
    expect(validarRespuesta(raw, enviadas)[0].sugerencias.map((s) => s.name)).toEqual(['zanahoria']);
  });

  it('descarta cantidades con texto después del número, que la normalización recortaría', () => {
    const raw = {
      recetas: [
        {
          id: 'oko',
          corta: true,
          sugerencias: [sugerencia('aceite', '2 cdas'), sugerencia('ajo', '2-3'), sugerencia('pan')],
        },
      ],
    };
    expect(validarRespuesta(raw, enviadas)[0].sugerencias.map((s) => s.name)).toEqual(['pan']);
  });

  it('se queda con 3 sugerencias como máximo', () => {
    const sugerencias = ['a', 'b', 'c', 'd', 'e'].map((n) => sugerencia(n));
    const raw = { recetas: [{ id: 'oko', corta: true, sugerencias }] };
    expect(validarRespuesta(raw, enviadas)[0].sugerencias).toHaveLength(3);
  });

  it('una corta sin sugerencias válidas no da resultado', () => {
    const raw = { recetas: [{ id: 'oko', corta: true, sugerencias: [sugerencia('palta', '½')] }] };
    expect(validarRespuesta(raw, enviadas)).toEqual([]);
  });

  it('una no corta no lleva sugerencias', () => {
    const raw = { recetas: [{ id: 'oko', corta: false, sugerencias: [sugerencia('zanahoria')] }] };
    expect(validarRespuesta(raw, enviadas)[0].sugerencias).toEqual([]);
  });

  it('una respuesta sin forma da vacío', () => {
    expect(validarRespuesta(null, enviadas)).toEqual([]);
    expect(validarRespuesta({ recetas: 'no' }, enviadas)).toEqual([]);
    expect(validarRespuesta('texto', enviadas)).toEqual([]);
  });
});

describe('revisarEnTandas', () => {
  const muchas: Meal[] = Array.from({ length: 85 }, (_, i) => ({ ...ensalada, id: `m${i}` }));
  const respondeOk: Pedir = async (_recetas: RecetaParaFlash[], ids: string[]) => ({
    recetas: ids.map((id) => ({ id, corta: false, sugerencias: [] })),
  });

  it('pide de a 40 y junta todos los resultados', async () => {
    const tamanos: number[] = [];
    const pedir: Pedir = (recetas, ids) => {
      tamanos.push(ids.length);
      return respondeOk(recetas, ids);
    };
    const { resultados, error } = await revisarEnTandas(muchas, indice, pedir);
    expect(tamanos).toEqual([40, 40, 5]);
    expect(resultados).toHaveLength(85);
    expect(error).toBeNull();
  });

  it('si falla una tanda, devuelve lo anterior y no sigue', async () => {
    let llamadas = 0;
    const falla = new Error('RESOURCE_EXHAUSTED');
    const pedir: Pedir = (recetas, ids) => {
      llamadas++;
      return llamadas === 2 ? Promise.reject(falla) : respondeOk(recetas, ids);
    };
    const { resultados, error } = await revisarEnTandas(muchas, indice, pedir);
    expect(llamadas).toBe(2);
    expect(resultados).toHaveLength(40);
    expect(error).toBe(falla);
  });
});

describe('mensajeDeError', () => {
  it('distingue cuota, respuesta ilegible y red', () => {
    expect(mensajeDeError(new Error('[429 ] Resource has been exhausted (RESOURCE_EXHAUSTED)'))).toContain('cuota');
    expect(mensajeDeError(new SyntaxError('Unexpected token'))).toContain('no se pudo leer');
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toContain('conexión');
  });

  it('reconoce el modelo saturado y el tiempo agotado', () => {
    const saturado = 'Error fetching from https://x: [500 ] This model is currently experiencing high demand.';
    expect(mensajeDeError(new Error(saturado))).toContain('saturado');
    expect(mensajeDeError(new Error('[503 ] Deadline expired before operation could complete.'))).toContain('saturado');
    expect(mensajeDeError(new Error('Request timed out after 60000ms'))).toContain('saturado');
  });

  it('cualquier otro error da un mensaje genérico', () => {
    expect(mensajeDeError('raro')).toBe('No se pudo revisar el recetario. Probá de nuevo más tarde.');
    expect(mensajeDeError('raro', 'Otro texto.')).toBe('Otro texto.');
  });
});

describe('esErrorTransitorio', () => {
  it('cuota, saturación y tiempo agotado son transitorios', () => {
    for (const m of [
      '[429 ] Resource has been exhausted (RESOURCE_EXHAUSTED)',
      '[500 ] This model is currently experiencing high demand.',
      '[503 ] Deadline expired before operation could complete.',
      'Request timed out after 60000ms',
      'signal is aborted without reason',
    ]) {
      expect(esErrorTransitorio(new Error(m))).toBe(true);
    }
  });

  it('esquema, respuesta ilegible, red o algo raro no lo son', () => {
    expect(esErrorTransitorio(new Error('[400 ] Invalid JSON payload: responseSchema'))).toBe(false);
    expect(esErrorTransitorio(new SyntaxError('Unexpected token'))).toBe(false);
    expect(esErrorTransitorio(new TypeError('Failed to fetch'))).toBe(false);
    expect(esErrorTransitorio('raro')).toBe(false);
  });

  it('un JSON roto no es transitorio aunque su posición parezca un 500', () => {
    const roto = new SyntaxError(
      "Expected ',' or '}' after property value in JSON at position 500 (line 1 column 501)"
    );
    expect(esErrorTransitorio(roto)).toBe(false);
    expect(mensajeDeError(roto)).toContain('no se pudo leer');
  });

  it('cualquier 5xx es transitorio', () => {
    expect(esErrorTransitorio(new Error('[502 ] Bad Gateway'))).toBe(true);
    expect(esErrorTransitorio(new Error('[504 ] Gateway Timeout'))).toBe(true);
  });
});
