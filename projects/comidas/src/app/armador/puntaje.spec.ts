import { describe, expect, it } from 'vitest';

import { indexar } from '../catalogo/catalogo';
import { CATALOGO } from '../catalogo/catalogo-datos';
import { META_PLANTAS } from '../catalogo/plantas';
import { MAX_CARNE_ROJA } from '../guia/chequeos';
import { DaySchedule, Meal } from '../models/meal.model';
import { ContextoPuntaje, Puntaje, puntuar } from './puntaje';

const indice = indexar(CATALOGO);

const comida = (id: string, ingredientes: string[], tags: string[] = []): Meal => ({
  id,
  name: id,
  ingredients: ingredientes.map((name) => ({ name, quantity: '1' })),
  tags,
});

const dia = (nombre: string, slots: Partial<Record<'desayuno' | 'almuerzo' | 'cena', string[]>> = {}): DaySchedule => ({
  dayName: nombre,
  desayuno: (slots.desayuno ?? []).map((mealId) => ({ mealId, portions: 1 })),
  almuerzo: (slots.almuerzo ?? []).map((mealId) => ({ mealId, portions: 1 })),
  postreAlmuerzo: null,
  colacion: null,
  cena: (slots.cena ?? []).map((mealId) => ({ mealId, portions: 1 })),
  postreCena: null,
});

const ctx = (meals: Meal[], extra: Partial<ContextoPuntaje> = {}): ContextoPuntaje => ({
  meals,
  indice,
  despensa: [],
  recientes: new Set(),
  estacion: 'verano',
  reglasOcultas: new Set(),
  ...extra,
});

// Pone `candidato` en la cena del lunes de una semana que ya tiene `base`.
const puntos = (candidato: Meal, base: DaySchedule[], meals: Meal[], extra: Partial<ContextoPuntaje> = {}): Puntaje => {
  const todas = [...meals, candidato];
  const semana = base.map((d) => (d.dayName === 'lunes' ? { ...d, cena: [{ mealId: candidato.id, portions: 1 }] } : d));
  return puntuar(candidato, base, semana, ctx(todas, extra));
};

const base = [dia('lunes'), dia('martes')];

describe('puntuar', () => {
  it('más plantas nuevas, más puntos; con la meta cumplida no suman', () => {
    const una = comida('una', ['brócoli']);
    const tres = comida('tres', ['brócoli', 'lechuga', 'tomate']);
    expect(puntos(tres, base, []).puntos).toBeGreaterThan(puntos(una, base, []).puntos);
    expect(puntos(tres, base, []).motivo).toBe('suma 3 plantas nuevas');
    expect(puntos(una, base, []).motivo).toBe('suma 1 planta nueva');

    // Meta cumplida con 30 hortalizas del catálogo: una planta más no suma.
    const hortalizas = CATALOGO.filter((e) => e.grupo === 'hortalizas').slice(0, META_PLANTAS);
    const llena = comida('llena', hortalizas.map((e) => e.nombre));
    expect(hortalizas.length).toBe(META_PLANTAS);
    const semanaLlena = [dia('lunes', { almuerzo: ['llena'] }), dia('martes')];
    const extra = comida('extra', ['arroz']);
    expect(puntos(extra, semanaLlena, [llena]).motivo).toBe('variedad');
  });

  it('despensa suma, sólo con cantidad', () => {
    const brocoli = comida('b', ['brócoli']);
    const conDespensa = puntos(brocoli, base, [], { despensa: [{ name: 'Brócoli', quantity: '2' }] });
    const sinDespensa = puntos(brocoli, base, []);
    const vacia = puntos(brocoli, base, [], { despensa: [{ name: 'Brócoli', quantity: ' ' }] });
    expect(conDespensa.puntos).toBeGreaterThan(sinDespensa.puntos);
    expect(vacia.puntos).toBe(sinDespensa.puntos);
    const soloDespensa = comida('s', ['pollo']);
    expect(puntos(soloDespensa, base, [], { despensa: [{ name: 'Pollo', quantity: '1' }] }).motivo)
      .toBe('usa el pollo de la despensa');
  });

  it('carbos en almuerzo y cena del mismo día restan, salvo regla oculta', () => {
    const almuerzo = comida('alm', ['arroz']);
    const cena = comida('cen', ['papa']);
    const liviana = comida('liv', ['lechuga']);
    const dias = [dia('lunes', { almuerzo: ['alm'] }), dia('martes')];
    const rompe = puntos(cena, dias, [almuerzo]);
    const noRompe = puntos(liviana, dias, [almuerzo]);
    expect(rompe.puntos).toBeLessThan(noRompe.puntos);
    const oculta = puntos(cena, dias, [almuerzo], { reglasOcultas: new Set(['un-carbo-por-dia']) });
    expect(oculta.puntos).toBeGreaterThan(rompe.puntos);
  });

  it('roja arriba del máximo resta; pescado bajo el mínimo suma; ocultas no', () => {
    const roja = comida('roja', ['carne vacuna']);
    const pescado = comida('pez', ['pescado']);
    const ya = Array.from({ length: MAX_CARNE_ROJA }, (_, i) => `r${i}`);
    const previas = ya.map((id) => comida(id, ['carne vacuna']));
    const dias = [dia('lunes', { almuerzo: [ya[0]] }), dia('martes', { almuerzo: [ya[1]], cena: [ya[2]] })];
    const conRoja = puntos(roja, dias, previas);
    const conPez = puntos(pescado, dias, previas);
    expect(conRoja.puntos).toBeLessThan(conPez.puntos);
    expect(conPez.motivo).toBe('pescado: van 1 de 2');

    const oculta = { reglasOcultas: new Set(['frecuencia-carnes']) };
    expect(puntos(roja, dias, previas, oculta).puntos).toBeGreaterThan(conRoja.puntos);
    expect(puntos(pescado, dias, previas, oculta).puntos).toBeLessThan(conPez.puntos);
  });

  it('fuera de estación pierde contra romper carbos, aunque traiga plantas', () => {
    const almuerzo = comida('alm', ['arroz']);
    const dias = [dia('lunes', { almuerzo: ['alm'] }), dia('martes')];
    const rompe = comida('rompe', ['papa']);
    const verduras = CATALOGO.filter((e) => e.grupo === 'hortalizas').slice(0, 15).map((e) => e.nombre);
    const invernal = comida('inv', verduras, ['invierno']);
    expect(puntos(invernal, dias, [almuerzo]).puntos).toBeLessThan(puntos(rompe, dias, [almuerzo]).puntos);
  });

  it('reciente resta', () => {
    const c = comida('c', ['lechuga']);
    expect(puntos(c, base, [], { recientes: new Set(['c']) }).puntos).toBeLessThan(puntos(c, base, []).puntos);
  });

  it('sin nada a favor, variedad', () => {
    expect(puntos(comida('x', ['sal']), base, []).motivo).toBe('variedad');
  });
});
