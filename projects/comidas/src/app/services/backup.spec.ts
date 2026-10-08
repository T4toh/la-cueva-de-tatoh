import { describe, expect, it } from 'vitest';

import {
  CLAVES_BACKUP,
  filtrarSecciones,
  platosHuerfanos,
  seccionesDe,
  soloComidas,
} from './backup';

const backup = {
  meals: [{ id: 'a' }, { id: 'b' }],
  schedules: { '2026-10-05': [], '2026-10-12': [] },
  tags: [],
  checkedItems: {},
  pantry: [{ name: 'arroz' }],
  pantryGroups: [],
  alias: 'tato',
  version: '1.4',
};

describe('seccionesDe', () => {
  it('agrupa las claves por lo que significan, en orden, con su cantidad', () => {
    expect(seccionesDe(backup)).toEqual([
      { seccion: 'comidas', etiqueta: 'Comidas', cantidad: 2, unidad: 'comidas' },
      { seccion: 'calendario', etiqueta: 'Calendario', cantidad: 2, unidad: 'semanas' },
      { seccion: 'compras', etiqueta: 'Compras' },
      { seccion: 'despensa', etiqueta: 'Despensa', cantidad: 1, unidad: 'items' },
      { seccion: 'ajustes', etiqueta: 'Ajustes' },
    ]);
  });

  it('sólo lista las secciones que el archivo trae', () => {
    expect(seccionesDe({ meals: [] }).map((s) => s.seccion)).toEqual(['comidas']);
  });
});

describe('soloComidas', () => {
  it('un array o un objeto que sólo trae meals es una lista de comidas', () => {
    expect(soloComidas([{ name: 'x' }])).toBe(true);
    expect(soloComidas({ meals: [], version: '1.0' })).toBe(true);
  });

  it('con cualquier otra clave de backup ya es un backup', () => {
    expect(soloComidas(backup)).toBe(false);
    expect(soloComidas({ schedules: {} })).toBe(false);
    expect(soloComidas({})).toBe(false);
    expect(soloComidas(null)).toBe(false);
  });
});

describe('filtrarSecciones', () => {
  it('deja sólo las claves de las secciones elegidas', () => {
    expect(filtrarSecciones(backup, ['comidas', 'despensa'])).toEqual({
      meals: backup.meals,
      pantry: backup.pantry,
      pantryGroups: backup.pantryGroups,
    });
  });
});

describe('platosHuerfanos', () => {
  const semana = {
    '2026-10-05': [
      {
        dayName: 'Lunes',
        desayuno: [{ mealId: 'a' }],
        almuerzo: [{ mealId: 'zz' }, { mealId: 'b' }],
        cena: [{ mealId: 'yy' }],
      },
      // Formato viejo: el plato era un id suelto, o null.
      { dayName: 'Martes', desayuno: null, almuerzo: 'zz', cena: [] },
    ],
  };

  it('cuenta los platos que apuntan a comidas que no existen', () => {
    expect(platosHuerfanos(semana, new Set(['a', 'b']))).toBe(3);
  });

  it('sin calendario no hay huérfanos', () => {
    expect(platosHuerfanos(undefined, new Set())).toBe(0);
  });
});

describe('CLAVES_BACKUP', () => {
  it('cada clave pertenece a una sola sección', () => {
    expect(new Set(CLAVES_BACKUP).size).toBe(CLAVES_BACKUP.length);
    expect(CLAVES_BACKUP).toHaveLength(13);
  });
});
