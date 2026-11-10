import { describe, expect, it } from 'vitest';

import { indexar } from '../catalogo/catalogo';
import { CATALOGO } from '../catalogo/catalogo-datos';
import { META_PLANTAS } from '../catalogo/plantas';
import { DaySchedule, Meal } from '../models/meal.model';
import { OpcionesSlot } from './armador';
import { contextoFlash, esquemaArmador, preferidasDe, promptArmador } from './pedido-flash';
import { ContextoPuntaje } from './puntaje';

const indice = indexar(CATALOGO);
const comida = (id: string, nombre = id): Meal => ({
  id,
  name: nombre,
  ingredients: [{ name: 'tomate', quantity: '1' }],
});
const dia = (dayName: string, almuerzo: string[] = []): DaySchedule => ({
  dayName,
  desayuno: [],
  almuerzo: almuerzo.map((mealId) => ({ mealId, portions: 1 })),
  postreAlmuerzo: null,
  colacion: null,
  cena: [],
  postreCena: null,
});

const a = comida('a', 'Tarta');
const b = comida('b', 'Milanesa');
const c = comida('c', 'Sopa');
const semana = [dia('Lunes', ['c']), dia('Martes')];
const meals = [a, b, c];
const ctx: ContextoPuntaje = {
  meals, indice, despensa: [], recientes: new Set(), estacion: 'verano', reglasOcultas: new Set(),
};
const opciones: OpcionesSlot[] = [
  {
    slot: { dia: 1, tipo: 'almuerzo' },
    clave: 'Martes-almuerzo',
    opciones: [{ meal: a, puntos: 5 }, { meal: b, puntos: 3 }],
  },
  { slot: { dia: 1, tipo: 'cena' }, clave: 'Martes-cena', opciones: [{ meal: a, puntos: 4 }] },
];

describe('contextoFlash', () => {
  const cf = contextoFlash(semana, opciones, ctx, 'Argentina', ['maní']);

  it('trae cada candidato una sola vez', () => {
    expect(cf.recetas.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect(cf.slots[0].candidatos).toEqual([{ id: 'a', puntaje: 5 }, { id: 'b', puntaje: 3 }]);
  });

  it('lista nombres de lo ya puesto y la meta de plantas', () => {
    expect(cf.semana[0].almuerzo).toEqual(['Sopa']);
    expect(cf.plantas.meta).toBe(META_PLANTAS);
    expect(cf.estacion).toBe('verano');
    expect(cf.pais).toBe('Argentina');
  });
});

describe('promptArmador', () => {
  it('lleva estación, país, No como, reglas y termina con el JSON', () => {
    const cf = contextoFlash(semana, opciones, ctx, 'Argentina', ['maní']);
    const p = promptArmador(cf);
    expect(p).toContain('verano');
    expect(p).toContain('Argentina');
    expect(p).toContain('maní');
    expect(p).toContain('sólo entre los candidatos');
    expect(p).toContain('No repitas');
    expect(p).toContain('rioplatense');
    expect(p.endsWith(JSON.stringify(cf))).toBe(true);
  });

  it('no menciona No como cuando está vacía', () => {
    const p = promptArmador(contextoFlash(semana, opciones, ctx, 'Argentina', []));
    expect(p).not.toContain('No como');
  });
});

describe('esquemaArmador', () => {
  it('una propiedad por clave con mealId enum y motivo', () => {
    const e = JSON.parse(JSON.stringify(esquemaArmador(opciones))) as {
      properties: Record<string, { properties: { mealId: { enum: string[] }; motivo: unknown } }>;
      required: string[];
    };
    expect(Object.keys(e.properties)).toEqual(['Martes-almuerzo', 'Martes-cena']);
    expect(e.properties['Martes-almuerzo'].properties.mealId.enum).toEqual(['a', 'b']);
    expect(e.properties['Martes-cena'].properties.mealId.enum).toEqual(['a']);
    expect(e.properties['Martes-cena'].properties.motivo).toBeDefined();
    expect(e.required ?? []).toEqual([]);
  });
});

describe('preferidasDe', () => {
  it('acepta lo válido y recorta el motivo', () => {
    const m = preferidasDe({ 'Martes-almuerzo': { mealId: 'b', motivo: '  liviano ' } }, opciones);
    expect(m.get('Martes-almuerzo')).toEqual({ mealId: 'b', motivo: 'liviano' });
  });

  it('ignora claves desconocidas, ids fuera del enum y entradas que no son objeto', () => {
    const m = preferidasDe(
      {
        'Lunes-cena': { mealId: 'a', motivo: 'x' },
        'Martes-almuerzo': { mealId: 'zzz', motivo: 'x' },
        'Martes-cena': 'a',
      },
      opciones,
    );
    expect(m.size).toBe(0);
  });

  it('raw que no es objeto da mapa vacío', () => {
    expect(preferidasDe(null, opciones).size).toBe(0);
    expect(preferidasDe([1], opciones).size).toBe(0);
    expect(preferidasDe('hola', opciones).size).toBe(0);
  });
});
