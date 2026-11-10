import { describe, expect, it } from 'vitest';

import { indexar } from '../catalogo/catalogo';
import { CATALOGO } from '../catalogo/catalogo-datos';
import { DaySchedule, Meal } from '../models/meal.model';
import { Slot } from './armador';
import {
  esquemaRecetasNuevas,
  MAX_RECETAS_NUEVAS,
  PedidoRecetas,
  promptRecetasNuevas,
  RecetaNueva,
  slotParaUsar,
  validarRecetasNuevas,
} from './recetas-nuevas';

const indice = indexar(CATALOGO);
const ok = (name: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  name,
  tipo: 'almuerzo',
  tags: ['rápida'],
  ingredients: [{ name: 'tomate', quantity: '2', unit: 'u' }],
  ...extra,
});
const pHuecos: PedidoRecetas = {
  modo: 'huecos',
  huecos: [
    { clave: 'Lunes-almuerzo', tipo: 'almuerzo' },
    { clave: 'Martes-cena', tipo: 'cena' },
  ],
};
const huecos = new Map<string, Slot>([
  ['Lunes-almuerzo', { dia: 0, tipo: 'almuerzo' }],
  ['Martes-cena', { dia: 1, tipo: 'cena' }],
]);
const pPlantas: PedidoRecetas = { modo: 'plantas', tipos: ['almuerzo', 'cena'], plantasDeLaSemana: ['tomate'] };
const validar = (
  recetas: unknown[],
  p: PedidoRecetas = pPlantas,
  noComo: string[] = [],
  existentes: string[] = [],
): RecetaNueva[] =>
  validarRecetasNuevas({ recetas }, p, huecos, noComo, indice, existentes);

describe('validarRecetasNuevas', () => {
  it('acepta una receta válida y pasos siempre es arreglo', () => {
    const [r] = validar([ok('Tarta')]);
    expect(r).toMatchObject({ name: 'Tarta', tipo: 'almuerzo', slot: null, pasos: [] });
  });

  it('descarta lo inválido', () => {
    const malas = [
      ok('A', { ingredients: [] }),
      ok('B', { ingredients: [{ name: 'tomate', quantity: 'a gusto' }] }),
      ok('C', { ingredients: [{ name: 'tomate', quantity: '2-3' }] }),
      ok('D', { ingredients: [{ name: 'cebolla', quantity: '1' }, { name: 'pollo', quantity: '1' }] }),
      ok('E', { tipo: 'postre' }),
      ok('  '),
      ok('Tarta de Tomáte'),
    ];
    expect(validar(malas, pPlantas, ['pollo'], ['tarta de tomate'])).toEqual([]);
  });

  it('corta en MAX_RECETAS_NUEVAS', () => {
    const muchas = ['a', 'b', 'c', 'd', 'e'].map((n) => ok(n));
    expect(validar(muchas)).toHaveLength(MAX_RECETAS_NUEVAS);
  });

  it('en modo huecos asigna el slot por clave, una vez por hueco', () => {
    const rs = validar(
      [
        ok('A', { clave: 'Lunes-almuerzo' }),
        ok('B', { clave: 'Lunes-almuerzo' }),
        ok('C', { clave: 'Martes-cena', tipo: 'cena' }),
        ok('D', { clave: 'Inventada' }),
      ],
      pHuecos,
    );
    expect(rs.map((r) => [r.name, r.slot])).toEqual([
      ['A', { dia: 0, tipo: 'almuerzo' }],
      ['C', { dia: 1, tipo: 'cena' }],
    ]);
  });

  it('una respuesta que no es lo esperado da []', () => {
    expect(validarRecetasNuevas('x', pPlantas, huecos, [], indice, [])).toEqual([]);
  });
});

describe('esquemaRecetasNuevas', () => {
  it('en huecos, clave es enum de las claves y tipo de los tipos', () => {
    const e = JSON.parse(JSON.stringify(esquemaRecetasNuevas(pHuecos)));
    const item = e.properties.recetas.items;
    expect(item.properties.clave.enum).toEqual(['Lunes-almuerzo', 'Martes-cena']);
    expect(item.properties.tipo.enum).toEqual(['almuerzo', 'cena']);
    expect(item.properties.ingredients.items.required).toEqual(['name', 'quantity']);
    expect(item.required).not.toContain('pasos');
    expect(item.required).toContain('ingredients');
  });

  it('en plantas no hay clave', () => {
    const e = JSON.parse(JSON.stringify(esquemaRecetasNuevas(pPlantas)));
    expect(e.properties.recetas.items.properties.clave).toBeUndefined();
  });
});

describe('promptRecetasNuevas', () => {
  const base = (p: PedidoRecetas): string =>
    promptRecetasNuevas(p, 'verano', 'Argentina', ['pollo'], ['Tarta de zapallo']);

  it('pide lo común', () => {
    const t = base(pHuecos);
    for (const s of ['por una porción', 'Argentina', 'verano', 'pollo', 'Tarta de zapallo', 'concretos']) {
      expect(t).toContain(s);
    }
    expect(t).toContain('Lunes-almuerzo');
  });

  it('en plantas lista las de la semana', () => {
    const t = base(pPlantas);
    expect(t).toContain('tomate');
    expect(t).toContain('distintas');
  });
});

describe('slotParaUsar', () => {
  const m = (id: string, ings: string[]): Meal => ({
    id,
    name: id,
    ingredients: ings.map((name) => ({ name, quantity: '1' })),
  });
  const dia = (n: string, almuerzo: { mealId: string; motivo?: string }[] = []): DaySchedule => ({
    dayName: n,
    desayuno: [],
    almuerzo: almuerzo.map((d) => ({ ...d, portions: 1 })),
    postreAlmuerzo: null,
    colacion: null,
    cena: [],
    postreCena: null,
  });
  const meals = [m('pobre', ['tomate']), m('rica', ['tomate', 'cebolla', 'zanahoria']), m('fija', ['tomate'])];

  it('elige el del motivo que menos plantas aporta', () => {
    const semana = [dia('L', [{ mealId: 'rica', motivo: 'x' }]), dia('M', [{ mealId: 'pobre', motivo: 'y' }]),
      dia('X', [{ mealId: 'fija' }])];
    expect(slotParaUsar(semana, 0, 'almuerzo', meals, indice)).toEqual({ dia: 1, tipo: 'almuerzo' });
  });

  it('empate: el más temprano; respeta desde', () => {
    const semana = [dia('L', [{ mealId: 'rica', motivo: 'x' }]), dia('M', [{ mealId: 'rica', motivo: 'x' }])];
    expect(slotParaUsar(semana, 0, 'almuerzo', meals, indice)).toEqual({ dia: 0, tipo: 'almuerzo' });
    expect(slotParaUsar(semana, 1, 'almuerzo', meals, indice)).toEqual({ dia: 1, tipo: 'almuerzo' });
  });

  it('sin motivos: primer vacío; sin vacío: null', () => {
    expect(slotParaUsar([dia('L', [{ mealId: 'fija' }]), dia('M')], 0, 'almuerzo', meals, indice))
      .toEqual({ dia: 1, tipo: 'almuerzo' });
    expect(slotParaUsar([dia('L', [{ mealId: 'fija' }])], 0, 'almuerzo', meals, indice)).toBeNull();
  });
});
