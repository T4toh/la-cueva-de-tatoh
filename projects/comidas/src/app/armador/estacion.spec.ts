import { describe, expect, it } from 'vitest';

import { estacionDe, fueraDeEstacion, hemisferioDe, paisDeTimezone, PAISES } from './estacion';

describe('estacionDe', () => {
  it('sur: meses completos', () => {
    expect(estacionDe(new Date(2026, 0, 15), 'sur')).toBe('verano');
    expect(estacionDe(new Date(2026, 2, 1), 'sur')).toBe('otono');
    expect(estacionDe(new Date(2026, 5, 1), 'sur')).toBe('invierno');
    expect(estacionDe(new Date(2026, 8, 1), 'sur')).toBe('primavera');
    expect(estacionDe(new Date(2026, 11, 1), 'sur')).toBe('verano');
  });

  it('norte: al revés', () => {
    expect(estacionDe(new Date(2026, 6, 1), 'norte')).toBe('verano');
    expect(estacionDe(new Date(2026, 0, 1), 'norte')).toBe('invierno');
    expect(estacionDe(new Date(2026, 3, 1), 'norte')).toBe('primavera');
    expect(estacionDe(new Date(2026, 9, 1), 'norte')).toBe('otono');
  });
});

describe('paisDeTimezone', () => {
  it('reconoce países de América', () => {
    expect(paisDeTimezone('America/Argentina/Buenos_Aires')).toBe('ar');
    expect(paisDeTimezone('America/Buenos_Aires')).toBe('ar');
    expect(paisDeTimezone('America/Santiago')).toBe('cl');
    expect(paisDeTimezone('America/Mexico_City')).toBe('mx');
  });

  it('el resto cae en otro según hemisferio', () => {
    expect(paisDeTimezone('Europe/Madrid')).toBe('otro-norte');
    expect(paisDeTimezone('Australia/Sydney')).toBe('otro-sur');
    expect(paisDeTimezone('Pacific/Auckland')).toBe('otro-sur');
    expect(paisDeTimezone('')).toBe('otro-norte');
  });

  it('todo id devuelto existe en PAISES', () => {
    const ids = new Set(PAISES.map((p) => p.id));
    for (const tz of ['America/Lima', 'America/Sao_Paulo', 'Asia/Tokyo', 'Africa/Johannesburg']) {
      expect(ids.has(paisDeTimezone(tz))).toBe(true);
    }
  });
});

describe('hemisferioDe', () => {
  it('por país, desconocido es norte', () => {
    expect(hemisferioDe('ar')).toBe('sur');
    expect(hemisferioDe('mx')).toBe('norte');
    expect(hemisferioDe('otro-sur')).toBe('sur');
    expect(hemisferioDe('xx')).toBe('norte');
  });
});

describe('fueraDeEstacion', () => {
  it('compara sin acentos ni mayúsculas', () => {
    expect(fueraDeEstacion(['Otoño-Invierno'], 'verano')).toBe(true);
    expect(fueraDeEstacion(['otoño-invierno'], 'invierno')).toBe(false);
    expect(fueraDeEstacion(['Otoño-Invierno'], 'otono')).toBe(false);
  });

  it('sin tag de estación no está fuera', () => {
    expect(fueraDeEstacion(['rápido'], 'verano')).toBe(false);
    expect(fueraDeEstacion(undefined, 'verano')).toBe(false);
    expect(fueraDeEstacion([], 'verano')).toBe(false);
  });
});
