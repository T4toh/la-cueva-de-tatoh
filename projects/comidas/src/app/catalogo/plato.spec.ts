import { describe, expect, it } from 'vitest';

import { EntradaCatalogo, indexar } from './catalogo';
import { excede, mismaUnidad, resumenPlato, textoReferencia } from './plato';

const carne: EntradaCatalogo = { nombre: 'carne', grupo: 'carnesHuevos', unidad: 'g', porcion: 150, estimada: true };
const huevo: EntradaCatalogo = { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad', porcion: 1 };
const indice = indexar([
  carne,
  huevo,
  { nombre: 'tomate', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'lentejas', grupo: 'feculentos', unidad: 'g', porcion: 125, legumbre: true },
  { nombre: 'arroz', grupo: 'feculentos', unidad: 'g', porcion: 50 },
  { nombre: 'aceite de oliva', grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1, planta: false },
]);

describe('mismaUnidad', () => {
  it('reconoce las formas escritas de una misma unidad', () => {
    expect(mismaUnidad('gr', 'g')).toBe(true);
    expect(mismaUnidad(' Gramos ', 'g')).toBe(true);
    expect(mismaUnidad('unidades', 'unidad')).toBe(true);
    expect(mismaUnidad('cucharadas', 'cda')).toBe(true);
    expect(mismaUnidad('taza', 'g')).toBe(false);
  });
});

describe('textoReferencia', () => {
  it('arma la referencia y marca la estimada', () => {
    expect(textoReferencia(carne)).toBe('ref. 150 g por persona (estimado)');
    expect(textoReferencia(huevo)).toBe('ref. 1 unidad por persona');
  });

  it('sin porción no hay referencia', () => {
    expect(textoReferencia({ nombre: 'tomate', grupo: 'hortalizas', unidad: 'unidad' })).toBeNull();
  });
});

describe('excede', () => {
  it('avisa por encima de 1,5 veces la porción', () => {
    expect(excede('225', 'g', carne)).toBe(false);
    expect(excede('226', 'g', carne)).toBe(true);
    expect(excede('300', 'grs', carne)).toBe(true);
  });

  it('con otra unidad no compara', () => {
    expect(excede('2', 'unidades', carne)).toBe(false);
  });

  it('una cantidad no numérica no avisa; una fracción se compara por su valor', () => {
    expect(excede('a gusto', 'g', carne)).toBe(false);
    expect(excede('', 'unidad', huevo)).toBe(false);
    expect(excede('1/2', 'unidad', huevo)).toBe(false);
    expect(excede('2', 'unidades', huevo)).toBe(true);
  });
});

describe('resumenPlato', () => {
  const plato = (...nombres: string[]): { name: string }[] => nombres.map((name) => ({ name }));

  it('marca qué grupos están', () => {
    expect(resumenPlato(plato('carne', 'tomate', 'aceite de oliva'), indice)).toEqual({
      verdura: true,
      proteina: true,
      feculento: false,
      aceite: true,
      clasificados: 3,
    });
  });

  it('legumbre más cereal cuenta como proteína; legumbre sola no', () => {
    expect(resumenPlato(plato('lentejas', 'arroz'), indice).proteina).toBe(true);
    expect(resumenPlato(plato('lentejas'), indice).proteina).toBe(false);
  });

  it('ignora nombres vacíos y lo que no se clasifica', () => {
    expect(resumenPlato(plato('', 'dragonfruit', 'huevo'), indice).clasificados).toBe(1);
  });
});
