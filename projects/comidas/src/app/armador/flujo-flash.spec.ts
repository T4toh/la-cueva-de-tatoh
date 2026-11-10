import { describe, expect, it, vi } from 'vitest';

import { indexar } from '../catalogo/catalogo';
import { CATALOGO } from '../catalogo/catalogo-datos';
import { DaySchedule, Meal } from '../models/meal.model';
import { EntradaArmador } from './armador';
import { completarConFlash, DepsFlash } from './flujo-flash';

const indice = indexar(CATALOGO);
const comida = (id: string): Meal => ({ id, name: id, ingredients: [{ name: 'tomate', quantity: '1' }] });
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const dia = (dayName: string, almuerzo: string[] = []): DaySchedule => ({
  dayName,
  desayuno: [],
  almuerzo: almuerzo.map((mealId) => ({ mealId, portions: 1 })),
  postreAlmuerzo: null,
  colacion: null,
  cena: [],
  postreCena: null,
});

const a = comida('a');
const b = comida('b');
const entrada = (semana: DaySchedule[], almuerzos: Meal[] = [a, b]): EntradaArmador => ({
  key: '2026-11-09',
  semana,
  desde: 0,
  tipos: ['almuerzo'],
  candidatos: { desayuno: [], almuerzo: almuerzos, cena: [] },
  ctx: {
    meals: [a, b], indice, despensa: [], recientes: new Set(), estacion: 'verano', reglasOcultas: new Set(),
  },
});
const receta = (clave: string): Record<string, unknown> => ({
  clave,
  name: `Nueva ${clave}`,
  tipo: 'almuerzo',
  tags: [],
  ingredients: [{ name: 'zapallo', quantity: '1' }],
});
const deps = (
  e: () => EntradaArmador,
  completar: ReturnType<typeof vi.fn>,
  pedir: ReturnType<typeof vi.fn>,
): DepsFlash => ({
  entrada: e,
  completar: completar as DepsFlash['completar'],
  pedir: pedir as DepsFlash['pedir'],
  paisNombre: 'Argentina',
  noComo: [],
  nombresExistentes: ['a', 'b'],
});

describe('completarConFlash', () => {
  it('pasa las preferidas de Flash y la semana pedida a completar', async () => {
    const completar = vi.fn().mockReturnValue({ puestos: 2, sinCandidatos: 0, deFlash: 1 });
    const pedir = vi.fn().mockResolvedValue({ 'Lunes-almuerzo': { mealId: 'b', motivo: 'suma plantas' } });
    const r = await completarConFlash(deps(() => entrada([dia('Lunes'), dia('Martes')]), completar, pedir));

    expect(pedir).toHaveBeenCalledTimes(1);
    const [, preferidas, semanaEsperada] = completar.mock.calls[0];
    expect([...preferidas]).toEqual([['Lunes-almuerzo', { mealId: 'b', motivo: 'suma plantas' }]]);
    expect(semanaEsperada).toBe('2026-11-09');
    expect(r).toEqual({ puestos: 2, sinCandidatos: 0, deFlash: 1, nuevas: [], error: null, cambioSemana: false });
  });

  it('si Flash falla completa con el algoritmo, avisa el error y no pide recetas', async () => {
    const completar = vi.fn().mockReturnValue({ puestos: 1, sinCandidatos: 1, deFlash: 0 });
    const pedir = vi.fn().mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));
    const r = await completarConFlash(deps(() => entrada([dia('Lunes'), dia('Martes')]), completar, pedir));

    expect(pedir).toHaveBeenCalledTimes(1);
    expect(completar.mock.calls[0][1].size).toBe(0);
    expect(r.puestos).toBe(1);
    expect(r.nuevas).toEqual([]);
    expect(r.error).toBe('Se terminó la cuota gratuita de Flash por hoy. Probá de nuevo mañana.');
  });

  it('sin slots vacíos no pide nada y todo queda en 0', async () => {
    const completar = vi.fn();
    const pedir = vi.fn();
    const r = await completarConFlash(deps(() => entrada([dia('Lunes', ['a'])]), completar, pedir));

    expect(pedir).not.toHaveBeenCalled();
    expect(completar).not.toHaveBeenCalled();
    expect(r).toEqual({ puestos: 0, sinCandidatos: 0, deFlash: 0, nuevas: [], error: null, cambioSemana: false });
  });

  describe('con slots sin candidatos', () => {
    // Antes de completar todos vacíos; después, Lunes puesto y el resto sin candidatos.
    const antes = entrada(DIAS.map((d) => dia(d)));
    const despues = entrada([dia('Lunes', ['a']), ...DIAS.slice(1).map((d) => dia(d))]);
    const completar = (): ReturnType<typeof vi.fn> =>
      vi.fn().mockReturnValue({ puestos: 1, sinCandidatos: 4, deFlash: 0 });

    it('pide recetas nuevas para los que siguen vacíos, como mucho 3', async () => {
      const pedir = vi.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ recetas: [receta('Martes-almuerzo'), receta('Jueves-almuerzo')] });
      const e = vi.fn().mockReturnValueOnce(antes).mockReturnValueOnce(despues);
      const r = await completarConFlash(deps(e, completar(), pedir));

      expect(pedir).toHaveBeenCalledTimes(2);
      const prompt = pedir.mock.calls[1][1] as string;
      expect(prompt).toContain('- Martes-almuerzo (almuerzo)');
      expect(prompt).toContain('- Jueves-almuerzo (almuerzo)');
      expect(prompt).not.toContain('Viernes-almuerzo');
      expect(prompt).not.toContain('Lunes-almuerzo');
      expect(r.nuevas.map((n) => n.slot)).toEqual([{ dia: 1, tipo: 'almuerzo' }, { dia: 3, tipo: 'almuerzo' }]);
      expect(r).toMatchObject({ puestos: 1, sinCandidatos: 4, error: null });
    });

    it('si el pedido de recetas falla, lo puesto queda y avisa el error', async () => {
      const pedir = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('503 UNAVAILABLE'));
      const e = vi.fn().mockReturnValueOnce(antes).mockReturnValueOnce(despues);
      const r = await completarConFlash(deps(e, completar(), pedir));

      expect(r).toMatchObject({ puestos: 1, nuevas: [] });
      expect(r.error).toBe('Flash está saturado ahora. Probá de nuevo en un rato.');
    });

    it('si ningún slot tiene candidatos no pide elecciones, sólo recetas', async () => {
      const sinNada = entrada([dia('Lunes')], []);
      const pedir = vi.fn().mockResolvedValue({ recetas: [receta('Lunes-almuerzo')] });
      const c = vi.fn().mockReturnValue({ puestos: 0, sinCandidatos: 1, deFlash: 0 });
      const r = await completarConFlash(deps(() => sinNada, c, pedir));

      expect(pedir).toHaveBeenCalledTimes(1);
      expect(c).toHaveBeenCalledTimes(1);
      expect(r.nuevas).toHaveLength(1);
    });
  });

  it('si cambió la semana no toca nada ni pide recetas', async () => {
    const completar = vi.fn().mockReturnValue(null);
    const pedir = vi.fn().mockResolvedValue({});
    const r = await completarConFlash(deps(() => entrada([dia('Lunes')]), completar, pedir));

    expect(pedir).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ puestos: 0, sinCandidatos: 0, deFlash: 0, nuevas: [], error: null, cambioSemana: true });
  });
});
