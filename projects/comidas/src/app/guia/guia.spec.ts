import { describe, expect, it } from 'vitest';

import { armarGuia, normalizarGuia, Regla, REGLAS, tipDelDia } from './guia';

describe('REGLAS', () => {
  it('cada regla base tiene id único, texto y una fuente que no es propia', () => {
    expect(new Set(REGLAS.map((r) => r.id)).size).toBe(REGLAS.length);
    for (const r of REGLAS) {
      expect(r.texto.trim(), r.id).not.toBe('');
      expect(r.fuente, r.id).not.toBe('propia');
    }
  });
});

describe('REGLAS: contenido', () => {
  it('carbos una vez por día, sin hora; el horario lo da la regla de comer temprano', () => {
    const carbos = REGLAS.find((r) => r.id === 'un-carbo-por-dia');
    expect(carbos?.texto).not.toMatch(/noche/);
    expect(REGLAS.map((r) => r.id)).toEqual(
      expect.arrayContaining(['ayuno-nocturno', 'horarios-regulares', 'comer-temprano', 'fermentados'])
    );
  });
});

describe('normalizarGuia', () => {
  it('lo mal formado queda en listas vacías', () => {
    expect(normalizarGuia(undefined)).toEqual({ propias: [], ocultas: [] });
    expect(normalizarGuia({ propias: 'x', ocultas: null })).toEqual({ propias: [], ocultas: [] });
  });

  it('descarta propias mal formadas y fuerza su fuente', () => {
    const r = normalizarGuia({
      propias: [null, { texto: 'x', fuente: 'gapa', id: 'q' }, { id: 'sin-texto' }, { texto: 'sin id' }, '  '],
      ocultas: [],
    });
    expect(r.propias).toEqual([{ id: 'q', texto: 'x', fuente: 'propia' }]);
  });

  it('conserva lo que viene bien', () => {
    const guia = { propias: [{ id: 'p1', texto: 'Mate sin azúcar', fuente: 'propia' }], ocultas: ['a'] };
    expect(normalizarGuia(guia)).toEqual(guia);
  });
});

describe('armarGuia', () => {
  const base: Regla[] = [
    { id: 'a', texto: 'A', fuente: 'gapa' },
    { id: 'b', texto: 'B', fuente: 'nutricionista' },
    { id: 'c', texto: 'C', fuente: 'gapa' },
  ];

  it('propias primero, después las base agrupadas por fuente en orden de aparición', () => {
    const r = armarGuia(base, { propias: [{ id: 'p', texto: 'P', fuente: 'propia' }], ocultas: [] });
    expect(r.grupos.map((g) => [g.fuente, g.reglas.map((x) => x.id)])).toEqual([
      ['propia', ['p']],
      ['gapa', ['a', 'c']],
      ['nutricionista', ['b']],
    ]);
  });

  it('las ocultas salen de su grupo y van aparte; un grupo vacío no aparece', () => {
    const r = armarGuia(base, { propias: [], ocultas: ['b'] });
    expect(r.grupos.map((g) => g.fuente)).toEqual(['gapa']);
    expect(r.ocultas.map((x) => x.id)).toEqual(['b']);
  });

  it('un id oculto que ya no existe se ignora', () => {
    expect(armarGuia(base, { propias: [], ocultas: ['zz'] }).ocultas).toEqual([]);
  });
});

describe('tipDelDia', () => {
  const reglas: Regla[] = ['a', 'b', 'c'].map((id) => ({ id, texto: id, fuente: 'sugerida' }));
  const id = (fecha: Date, salto = 0): string | undefined => tipDelDia(reglas, fecha, salto)?.id;

  it('la misma fecha da el mismo tip', () => {
    expect(id(new Date(2026, 9, 8, 9))).toBe(id(new Date(2026, 9, 8, 18)));
  });

  it('cambia al día siguiente', () => {
    expect(id(new Date(2026, 9, 9))).not.toBe(id(new Date(2026, 9, 8)));
  });

  // En hora local: a las 21 de Argentina ya es otro día en UTC.
  it('00:30 y 23:30 son el mismo día', () => {
    expect(id(new Date(2026, 9, 8, 0, 30))).toBe(id(new Date(2026, 9, 8, 23, 30)));
  });

  it('el salto avanza y da la vuelta', () => {
    const hoy = new Date(2026, 9, 8);
    const vistos = [0, 1, 2].map((s) => id(hoy, s));
    expect(new Set(vistos).size).toBe(3);
    expect(id(hoy, 3)).toBe(vistos[0]);
  });

  it('sin reglas no hay tip', () => {
    expect(tipDelDia([], new Date(), 0)).toBeNull();
  });
});
