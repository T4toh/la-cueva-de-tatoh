import { describe, expect, it } from 'vitest';

import { armarGuia, normalizarGuia, Regla, REGLAS } from './guia';

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
