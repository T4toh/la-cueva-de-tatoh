import { describe, expect, it } from 'vitest';

import { claveParte, diaCorto, estaTildada, repartirDespensa } from './partes';

describe('claveParte', () => {
  it('con día y manual', () => {
    expect(claveParte('cebolla', '2026-11-09')).toBe('cebolla@2026-11-09');
    expect(claveParte('cebolla', null)).toBe('cebolla@manual');
  });
});
describe('estaTildada', () => {
  it('por su clave o por la pelada de antes', () => {
    expect(estaTildada('cebolla', '2026-11-09', ['cebolla@2026-11-09'])).toBe(true);
    expect(estaTildada('cebolla', '2026-11-10', ['cebolla@2026-11-09'])).toBe(false);
    expect(estaTildada('cebolla', null, ['cebolla'])).toBe(true);
    expect(estaTildada('cebolla', null, ['cebolla@2026-11-09'])).toBe(false);
  });
});
describe('repartirDespensa', () => {
  it('cubre en orden y deja el resto', () => {
    expect(repartirDespensa([0.5, 0.5, 1], 0.75)).toEqual([0, 0.25, 1]);
    expect(repartirDespensa([0.5], 0)).toEqual([0.5]);
    expect(repartirDespensa([], 3)).toEqual([]);
  });
  it('no se pasa de largo por coma flotante', () => {
    expect(repartirDespensa([0.1, 0.2], 0.3)).toEqual([0, 0]);
  });
});
describe('diaCorto', () => {
  it('abrevia con tilde', () => {
    expect(['Lunes', 'Miércoles', 'Sábado'].map(diaCorto)).toEqual(['lun', 'mié', 'sáb']);
  });
});
