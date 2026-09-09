import { describe, expect, it } from 'vitest';

import {
  accionDeCompartir,
  armarLink,
  esCancelacion,
  soportaCompartirNativo,
} from './compartir.service';

describe('armarLink', () => {
  it('une el origen con la ruta pública', () => {
    expect(
      armarLink(
        'https://comidas.tatoh.com.ar',
        'Milanesa napolitana',
        'Tatoh',
        'k7m2xq9p'
      )
    ).toBe('https://comidas.tatoh.com.ar/r/tatoh/milanesa-napolitana/k7m2xq9p');
  });

  it('omite el segmento del nick cuando no hay alias', () => {
    expect(
      armarLink(
        'https://comidas.tatoh.com.ar',
        'Milanesa napolitana',
        undefined,
        'k7m2xq9p'
      )
    ).toBe('https://comidas.tatoh.com.ar/r/milanesa-napolitana/k7m2xq9p');
  });
});

describe('soportaCompartirNativo', () => {
  it('reconoce el navegador que tiene la Web Share API', () => {
    expect(soportaCompartirNativo({ share: (): void => undefined })).toBe(true);
  });

  it('no la asume donde no está', () => {
    expect(soportaCompartirNativo({})).toBe(false);
    expect(soportaCompartirNativo(undefined)).toBe(false);
  });
});

describe('esCancelacion', () => {
  it('el usuario que cierra la hoja de compartir no es un error', () => {
    const abort = new Error('cancelado');
    abort.name = 'AbortError';

    expect(esCancelacion(abort)).toBe(true);
  });

  // Lo que importa del test: un error real NO se traga en silencio.
  it('cualquier otro rechazo sí es un error', () => {
    expect(esCancelacion(new TypeError('boom'))).toBe(false);
    expect(esCancelacion('boom')).toBe(false);
  });
});

describe('accionDeCompartir', () => {
  it('sólo actúa cuando el tilde cambió de estado', () => {
    expect(accionDeCompartir(true, false)).toBe('publicar');
    expect(accionDeCompartir(false, true)).toBe('despublicar');
  });

  // Lo que importa del test: guardar una comida sin tocar el tilde no toca
  // `recetasPublicas`. Republicar una ya compartida acuñaría un id nuevo y
  // dejaría huérfano el documento del link que ya está repartido.
  it('no hace nada cuando el estado no cambió', () => {
    expect(accionDeCompartir(false, false)).toBeNull();
    expect(accionDeCompartir(true, true)).toBeNull();
  });
});
