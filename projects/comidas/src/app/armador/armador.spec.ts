import { describe, expect, it } from 'vitest';

import { indexar } from '../catalogo/catalogo';
import { CATALOGO } from '../catalogo/catalogo-datos';
import { DaySchedule, DishMealType, Meal } from '../models/meal.model';
import { armarSemana, claveSlot, MAX_DESAYUNO_REPETIDO, opcionesPorSlot, Preferida, slotsVacios } from './armador';
import { Candidatos } from './candidatos';
import { ContextoPuntaje } from './puntaje';

const indice = indexar(CATALOGO);

const comida = (id: string, ingredientes: string[] = []): Meal => ({
  id,
  name: id,
  ingredients: ingredientes.map((name) => ({ name, quantity: '1' })),
});

const dia = (nombre: string, slots: Partial<Record<DishMealType, string[]>> = {}): DaySchedule => ({
  dayName: nombre,
  desayuno: (slots.desayuno ?? []).map((mealId) => ({ mealId, portions: 1 })),
  almuerzo: (slots.almuerzo ?? []).map((mealId) => ({ mealId, portions: 1 })),
  postreAlmuerzo: null,
  colacion: null,
  cena: (slots.cena ?? []).map((mealId) => ({ mealId, portions: 1 })),
  postreCena: null,
});

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const vacia = (n = 7): DaySchedule[] => DIAS.slice(0, n).map((d) => dia(d));

const ctx = (meals: Meal[]): ContextoPuntaje => ({
  meals,
  indice,
  despensa: [],
  recientes: new Set(),
  estacion: 'verano',
  reglasOcultas: new Set(),
});

const cands = (desayuno: Meal[], principales: Meal[]): Candidatos => ({
  desayuno,
  almuerzo: principales,
  cena: principales,
});

const cero = (): number => 0;
const TODOS: DishMealType[] = ['desayuno', 'almuerzo', 'cena'];
const ids = (semana: DaySchedule[], tipo: DishMealType): string[] =>
  semana.flatMap((d) => d[tipo].map((p) => p.mealId));

describe('slotsVacios', () => {
  it('en orden de día y desayuno → almuerzo → cena, desde `desde` y sólo los tipos pedidos', () => {
    const semana = [dia('lunes'), dia('martes', { almuerzo: ['x'] }), dia('miércoles')];
    expect(slotsVacios(semana, 1, ['cena', 'almuerzo'])).toEqual([
      { dia: 1, tipo: 'cena' },
      { dia: 2, tipo: 'almuerzo' },
      { dia: 2, tipo: 'cena' },
    ]);
  });
});

describe('armarSemana', () => {
  it('no toca lo puesto, los días pasados, otros tipos ni postres; no muta la entrada', () => {
    const a = comida('a');
    const b = comida('b');
    const ph = { ...comida('ph'), includeInShoppingList: false };
    const semana = [
      dia('lunes'),
      { ...dia('martes', { almuerzo: ['ph'] }), postreCena: 'flan', colacion: 'fruta' },
      dia('miércoles'),
    ];
    const copia = structuredClone(semana);
    const r = armarSemana(semana, 1, ['almuerzo', 'cena'], cands([a], [a, b]), ctx([a, b, ph]), cero);

    expect(semana).toEqual(copia);
    expect(r.semana[0]).toEqual(semana[0]);
    expect(r.semana[1].almuerzo).toEqual(semana[1].almuerzo);
    expect(r.semana[1].postreCena).toBe('flan');
    expect(r.semana[1].colacion).toBe('fruta');
    expect(ids(r.semana, 'desayuno')).toEqual([]);
    // martes cena, miércoles almuerzo y cena: dos candidatos para tres slots.
    expect(r.puestos).toBe(2);
    expect(r.sinCandidatos).toBe(1);
  });

  it('cada plato puesto lleva porciones, excluded y un motivo', () => {
    const a = comida('a', ['brócoli']);
    const r = armarSemana(vacia(1), 0, ['almuerzo'], cands([], [a]), ctx([a]), cero);
    expect(r.semana[0].almuerzo).toEqual([
      { mealId: 'a', portions: 1, excluded: false, motivo: 'suma 1 planta nueva' },
    ]);
    const sinPlantas = comida('s');
    const r2 = armarSemana(vacia(1), 0, ['cena'], cands([], [sinPlantas]), ctx([sinPlantas]), cero);
    expect(r2.semana[0].cena[0].motivo).toBeTruthy();
  });

  it('golozo: no repite almuerzo/cena ni lo que ya está de desayuno, tampoco lo puesto por el usuario', () => {
    const [x, y, z, w] = ['x', 'y', 'z', 'w'].map((id) => comida(id));
    const semana = [dia('lunes', { almuerzo: ['x'], desayuno: ['y'] }), dia('martes')];
    const r = armarSemana(semana, 0, ['almuerzo', 'cena'], cands([], [x, y, z, w]), ctx([x, y, z, w]), cero);
    const principales = [...ids(r.semana, 'almuerzo'), ...ids(r.semana, 'cena')];
    expect(principales.sort()).toEqual(['w', 'x', 'z']);
    expect(r.puestos).toBe(2);
    expect(r.sinCandidatos).toBe(1);
  });

  it('una comida de desayuno y de cena no cae en dos tipos de slot la misma semana', () => {
    const ambos = comida('ambos', ['brócoli', 'lechuga', 'tomate']);
    const otros = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => comida(id));
    const tipos = (r: DaySchedule[]): DishMealType[] => TODOS.filter((t) => ids(r, t).includes('ambos'));

    const r1 = armarSemana(vacia(), 0, TODOS, cands([ambos], [ambos, ...otros]), ctx([ambos, ...otros]), cero);
    expect(tipos(r1.semana)).toEqual(['desayuno']);

    // Puesta de cena por el usuario: el desayuno no la repite aunque sea la mejor.
    const otro = comida('otro');
    const semana = [dia('lunes', { cena: ['ambos'] }), dia('martes')];
    const r2 = armarSemana(semana, 0, ['desayuno'], cands([ambos, otro], []), ctx([ambos, otro]), cero);
    expect(tipos(r2.semana)).toEqual(['cena']);
    expect(ids(r2.semana, 'desayuno')).toEqual(['otro', 'otro']);
  });

  it('con 2 candidatos y 4 slots pone 2 y avisa 2', () => {
    const [a, b] = [comida('a'), comida('b')];
    const r = armarSemana(vacia(2), 0, ['almuerzo', 'cena'], cands([], [a, b]), ctx([a, b]), cero);
    expect(r.puestos).toBe(2);
    expect(r.sinCandidatos).toBe(2);
    expect(r.semana[0].almuerzo[0].mealId).toBe('a');
    expect(r.semana[0].cena[0].mealId).toBe('b');
  });

  it('desayuno: rota con tope, y repite pasando el tope sólo si no hay otro', () => {
    const solo = comida('solo');
    const r1 = armarSemana(vacia(), 0, ['desayuno'], cands([solo], []), ctx([solo]), cero);
    expect(ids(r1.semana, 'desayuno')).toEqual(Array(7).fill('solo'));

    const tres = ['a', 'b', 'c'].map((id) => comida(id));
    const r2 = armarSemana(vacia(), 0, ['desayuno'], cands(tres, []), ctx(tres), cero);
    const puestos = ids(r2.semana, 'desayuno');
    expect(puestos.length).toBe(7);
    for (const id of ['a', 'b', 'c']) {
      expect(puestos.filter((p) => p === id).length).toBeLessThanOrEqual(MAX_DESAYUNO_REPETIDO);
    }
    // Rota en vez de repetir el mejor.
    expect(puestos.slice(0, 3).sort()).toEqual(['a', 'b', 'c']);
  });

  it('sin candidatos de desayuno quedan vacíos y cuentan', () => {
    const a = comida('a');
    const r = armarSemana(vacia(2), 0, TODOS, cands([], [a, comida('b'), comida('c'), comida('d')]), ctx([a]), cero);
    expect(ids(r.semana, 'desayuno')).toEqual([]);
    expect(r.puestos).toBe(4);
    expect(r.sinCandidatos).toBe(2);
  });

  it('elige al azar entre los tres mejores, nunca fuera', () => {
    // 3, 2, 1 y 0 plantas nuevas: puntajes 30, 20, 10, 0.
    const tres = comida('tres', ['brócoli', 'lechuga', 'tomate']);
    const dos = comida('dos', ['zanahoria', 'zapallo']);
    const una = comida('una', ['espinaca']);
    const cero0 = comida('cero');
    const todas = [cero0, una, dos, tres];
    const elige = (azar: number): string =>
      armarSemana(vacia(1), 0, ['almuerzo'], cands([], todas), ctx(todas), () => azar).semana[0].almuerzo[0].mealId;

    expect(elige(0)).toBe('tres');
    expect(elige(0.99)).toBe('una');
    for (const azar of [0, 0.2, 0.5, 0.7, 0.9, 0.99, 0.999999]) {
      expect(['tres', 'dos', 'una']).toContain(elige(azar));
    }
  });
});

describe('claveSlot', () => {
  it('es el día y el tipo, legible', () => {
    expect(claveSlot([dia('Lunes'), dia('Martes')], { dia: 1, tipo: 'almuerzo' })).toBe('Martes-almuerzo');
  });
});

describe('opcionesPorSlot', () => {
  it('aplica las reglas duras contra la semana dada, ordena por puntos y corta en max', () => {
    const tres = comida('tres', ['brócoli', 'lechuga', 'tomate']);
    const dos = comida('dos', ['zanahoria', 'zapallo']);
    const una = comida('una', ['espinaca']);
    const puesta = comida('puesta');
    const todas = [puesta, una, dos, tres];
    const semana = [dia('lunes', { almuerzo: ['puesta'] }), dia('martes')];
    const r = opcionesPorSlot(semana, 0, ['almuerzo', 'cena'], cands([], todas), ctx(todas), 2);

    expect(r.map((o) => o.clave)).toEqual(['lunes-cena', 'martes-almuerzo', 'martes-cena']);
    for (const o of r) {
      expect(o.opciones.map((x) => x.meal.id)).toEqual(['tres', 'dos']);
      expect(o.opciones[0].puntos).toBeGreaterThan(o.opciones[1].puntos);
    }
  });

  it('desayuno respeta el tope y no ofrece lo que ya es almuerzo o cena; por defecto 8 más uno por slot', () => {
    const muchos = Array.from({ length: 12 }, (_, i) => comida(`d${i}`));
    const semana = [dia('lunes', { desayuno: ['d0', 'd0', 'd0'], cena: ['d1'] }), dia('martes')];
    const [o] = opcionesPorSlot(semana, 1, ['desayuno'], cands(muchos, []), ctx(muchos), undefined);
    expect(o.opciones.length).toBe(9);
    const ofrecidos = o.opciones.map((x) => x.meal.id);
    expect(ofrecidos).not.toContain('d0');
    expect(ofrecidos).not.toContain('d1');
  });

  it('con más slots que 8 hay comidas distintas para cada uno', () => {
    const muchas = Array.from({ length: 30 }, (_, i) => comida(`c${i}`));
    const r = opcionesPorSlot(vacia(7), 0, ['almuerzo', 'cena'], cands([], muchas), ctx(muchas));
    const distintas = new Set(r.flatMap((o) => o.opciones.map((x) => x.meal.id)));
    expect(r.length).toBe(14);
    expect(distintas.size).toBeGreaterThanOrEqual(14);
  });
});

describe('armarSemana con preferidas', () => {
  const tres = comida('tres', ['brócoli', 'lechuga', 'tomate']);
  const cero0 = comida('cero');
  const todas = [cero0, tres];
  const pref = (mealId: string, motivo = 'porque sí'): ReadonlyMap<string, Preferida> =>
    new Map([['lunes-almuerzo', { mealId, motivo }]]);
  const arma = (p: ReadonlyMap<string, Preferida>): ReturnType<typeof armarSemana> =>
    armarSemana(vacia(1), 0, ['almuerzo'], cands([], todas), ctx(todas), cero, p);

  it('pone la preferida con su motivo y cuenta deFlash', () => {
    const r = arma(pref('cero'));
    expect(r.semana[0].almuerzo[0]).toEqual({ mealId: 'cero', portions: 1, excluded: false, motivo: 'porque sí' });
    expect(r.deFlash).toBe(1);
    expect(r.puestos).toBe(1);
  });

  it('recorta el motivo a 80 caracteres', () => {
    expect(arma(pref('cero', 'x'.repeat(100))).semana[0].almuerzo[0].motivo).toBe('x'.repeat(80));
  });

  it('motivo vacío: se pone con el motivo algorítmico', () => {
    const r = arma(pref('tres', '  '));
    expect(r.semana[0].almuerzo[0].motivo).toBe('suma 3 plantas nuevas');
    expect(r.deFlash).toBe(1);
  });

  it('id que no es posible del slot: elección algorítmica y no cuenta', () => {
    const r = arma(pref('inexistente'));
    expect(r.semana[0].almuerzo[0].mealId).toBe('tres');
    expect(r.deFlash).toBe(0);
  });

  it('id ya usado por un slot anterior: no es posible, no cuenta', () => {
    const p = new Map([['lunes-cena', { mealId: 'tres', motivo: 'm' }]]);
    const r = armarSemana(vacia(1), 0, ['almuerzo', 'cena'], cands([], todas), ctx(todas), cero, p);
    expect(r.semana[0].almuerzo[0].mealId).toBe('tres');
    expect(r.semana[0].cena[0].mealId).toBe('cero');
    expect(r.deFlash).toBe(0);
  });

  it('rechaza la que rompe un chequeo si el mejor no lo rompe', () => {
    const papa = comida('papa', ['papa']);
    const liviana = comida('liviana', ['lechuga']);
    const semana = [dia('lunes', { almuerzo: ['arroz'] })];
    const c = [papa, liviana];
    const p = new Map([['lunes-cena', { mealId: 'papa', motivo: 'm' }]]);
    const r = armarSemana(semana, 0, ['cena'], cands([], c), ctx([comida('arroz', ['arroz']), ...c]), cero, p);
    expect(r.semana[0].cena[0].mealId).toBe('liviana');
    expect(r.deFlash).toBe(0);
  });

  it('sin preferidas, deFlash es 0', () => {
    expect(arma(new Map()).deFlash).toBe(0);
  });

  it('registra cada rechazo con su razón: no posible o por margen', () => {
    const papa = comida('papa', ['papa']);
    const liviana = comida('liviana', ['lechuga']);
    const semana = [dia('lunes', { almuerzo: ['arroz'] }), dia('martes')];
    const c = [papa, liviana];
    const p = new Map([
      ['lunes-cena', { mealId: 'papa', motivo: 'm' }],
      ['martes-almuerzo', { mealId: 'inexistente', motivo: 'm' }],
      ['martes-cena', { mealId: 'liviana', motivo: 'm' }],
    ]);
    const todasMas = ctx([comida('arroz', ['arroz']), ...c]);
    const r = armarSemana(semana, 0, ['almuerzo', 'cena'], cands([], c), todasMas, cero, p);
    expect(r.rechazos).toEqual([
      { clave: 'lunes-cena', mealId: 'papa', razon: 'margen' },
      { clave: 'martes-almuerzo', mealId: 'inexistente', razon: 'no-posible' },
      { clave: 'martes-cena', mealId: 'liviana', razon: 'no-posible' },
    ]);
  });

  it('sin preferidas no hay registro de rechazos', () => {
    expect(armarSemana(vacia(1), 0, ['almuerzo'], cands([], todas), ctx(todas), cero).rechazos).toBeUndefined();
  });
});
