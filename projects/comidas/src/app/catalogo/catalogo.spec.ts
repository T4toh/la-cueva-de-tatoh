import { describe, expect, it } from 'vitest';

import {
  clasificar,
  combinar,
  EntradaCatalogo,
  entradaPropia,
  esPlanta,
  indexar,
  normalizar,
  sugerencias,
} from './catalogo';

const base: EntradaCatalogo[] = [
  { nombre: 'tomate', sinonimos: ['tomate perita'], grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'limón', grupo: 'frutas', unidad: 'unidad' },
  { nombre: 'pechuga de pollo', sinonimos: ['pechuga'], grupo: 'carnesHuevos', unidad: 'g', porcion: 150 },
  {
    nombre: 'lentejas',
    sinonimos: ['lentejas cocidas'],
    grupo: 'feculentos',
    unidad: 'g',
    porcion: 125,
    legumbre: true,
  },
  { nombre: 'aceite de oliva', grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1, planta: false },
  { nombre: 'perejil', grupo: 'condimentos', unidad: 'cda', planta: true },
  { nombre: 'sal', grupo: 'condimentos', unidad: 'pizca' },
];
const indice = indexar(base);

describe('normalizar', () => {
  it('saca acentos, mayúsculas y espacios de más', () => {
    expect(normalizar('  Brócoli   Grande ')).toBe('brocoli grande');
  });
});

describe('clasificar', () => {
  it('encuentra por nombre canónico y por sinónimo', () => {
    expect(clasificar('tomate', indice)?.nombre).toBe('tomate');
    expect(clasificar('Tomate Perita', indice)?.nombre).toBe('tomate');
    expect(clasificar('pechuga', indice)?.nombre).toBe('pechuga de pollo');
  });

  it('ignora acentos, mayúsculas y espacios', () => {
    expect(clasificar('  LIMON ', indice)?.nombre).toBe('limón');
  });

  it('entiende el plural con -s y con -es', () => {
    expect(clasificar('tomates', indice)?.nombre).toBe('tomate');
    expect(clasificar('limones', indice)?.nombre).toBe('limón');
  });

  it('no clasifica por coincidencia parcial', () => {
    expect(clasificar('salsa de tomate', indice)).toBeNull();
    expect(clasificar('zanahoria rallada', indice)).toBeNull();
  });

  it('devuelve null para lo que no está', () => {
    expect(clasificar('dragonfruit', indice)).toBeNull();
    expect(clasificar('', indice)).toBeNull();
  });
});

describe('combinar', () => {
  it('una entrada propia con el mismo nombre reemplaza a la del base, sinónimos incluidos', () => {
    const propio: EntradaCatalogo[] = [{ nombre: 'Pechuga de Pollo', grupo: 'carnesHuevos', unidad: 'unidad' }];
    const i = indexar(combinar(base, propio));
    expect(clasificar('pechuga de pollo', i)?.unidad).toBe('unidad');
    // El sinónimo era de la entrada vieja: ya no apunta a nada.
    expect(clasificar('pechuga', i)).toBeNull();
  });

  it('un sinónimo propio que choca con otra entrada del base gana', () => {
    const propio: EntradaCatalogo[] = [
      { nombre: 'tomate cherry', sinonimos: ['tomate perita'], grupo: 'hortalizas', unidad: 'g' },
    ];
    const i = indexar(combinar(base, propio));
    expect(clasificar('tomate perita', i)?.nombre).toBe('tomate cherry');
    expect(clasificar('tomate', i)?.nombre).toBe('tomate');
  });
});

describe('esPlanta', () => {
  it('lo decide el grupo', () => {
    expect(esPlanta(base[0])).toBe(true); // hortalizas
    expect(esPlanta(base[2])).toBe(false); // carnesHuevos
    expect(esPlanta(base[6])).toBe(false); // condimentos
  });

  it('la excepción de la entrada gana', () => {
    expect(esPlanta(base[4])).toBe(false); // aceite de oliva
    expect(esPlanta(base[5])).toBe(true); // perejil
  });
});

describe('sugerencias', () => {
  it('trae primero el catálogo, con grupo, y después lo propio que no está en él', () => {
    const r = sugerencias('pe', base, ['pepino de mar', 'pechuga']);
    expect(r).toContainEqual({ nombre: 'pechuga de pollo', grupo: 'carnesHuevos' });
    expect(r).toContainEqual({ nombre: 'perejil', grupo: 'condimentos' });
    // Lo propio va al final, después de todo lo del catálogo.
    expect(r.at(-1)).toEqual({ nombre: 'pepino de mar' });
    // 'pechuga' es sinónimo del catálogo: no se repite como propio.
    expect(r).not.toContainEqual({ nombre: 'pechuga' });
  });

  it('busca también por sinónimo', () => {
    expect(sugerencias('perita', base, [])).toEqual([{ nombre: 'tomate', grupo: 'hortalizas' }]);
  });

  it('no sugiere con menos de dos letras ni lo que ya está escrito igual', () => {
    expect(sugerencias('t', base, [])).toEqual([]);
    expect(sugerencias('tomate', base, [])).toEqual([]);
  });
});

describe('entradaPropia', () => {
  const valores = { grupo: 'hortalizas' as const, unidad: 'atado', porcion: '' };

  it('lo que no está en el catálogo toma el nombre de la fila', () => {
    expect(entradaPropia(' kale ', null, valores)).toEqual({ nombre: 'kale', grupo: 'hortalizas', unidad: 'atado' });
  });

  it('corregir una del catálogo conserva su nombre canónico y sus sinónimos', () => {
    const r = entradaPropia('pechuga', base[2], { grupo: 'carnesHuevos', unidad: 'g', porcion: '120' });
    expect(r).toEqual({
      nombre: 'pechuga de pollo',
      sinonimos: ['pechuga'],
      grupo: 'carnesHuevos',
      unidad: 'g',
      porcion: 120,
    });
  });

  it('la porción acepta coma y se ignora si no es un número positivo', () => {
    expect(entradaPropia('kale', null, { ...valores, porcion: '1,5' }).porcion).toBe(1.5);
    expect(entradaPropia('kale', null, { ...valores, porcion: 'mucho' })).not.toHaveProperty('porcion');
    expect(entradaPropia('kale', null, { ...valores, porcion: '0' })).not.toHaveProperty('porcion');
  });

  it('sin unidad queda en "unidad"', () => {
    expect(entradaPropia('kale', null, { ...valores, unidad: '  ' }).unidad).toBe('unidad');
  });
});
