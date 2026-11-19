import { describe, expect, it } from 'vitest';

import {
  cambiarNivel,
  descartarPropuesta,
  ENTRENAR_INICIAL,
  esCompleta,
  EstadoEntrenar,
  MAX_HISTORIAL,
  normalizarEntrenar,
  propuestaNivel,
  proximoDia,
  registrar,
  RegistroSesion,
  Respuesta,
} from './progresion';

const reg: RegistroSesion = {
  fecha: '2026-11-19T10:00:00Z',
  plantilla: 'n1a',
  minutos: 40,
  completa: true,
  respuesta: 'bien',
};
const conRespuesta = (respuesta: Respuesta, i = 0, completa = true): RegistroSesion => ({
  ...reg,
  fecha: `2026-11-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
  respuesta,
  completa,
});
const estado = (o: Partial<EstadoEntrenar>): EstadoEntrenar => ({ ...ENTRENAR_INICIAL, ...o });

describe('progresion', () => {
  it('normalizar: basura da el estado inicial', () => {
    for (const v of [null, 3, 'x', [], {}]) {expect(normalizarEntrenar(v)).toEqual(ENTRENAR_INICIAL);}
  });
  it('normalizar: ajusta nivel y dosis y descarta registros inválidos', () => {
    const e = normalizarEntrenar({
      nivel: 9,
      dosis: 7,
      ultimoDia: 'C',
      historial: [
        { fecha: '2026-11-19T10:00:00Z', plantilla: 'n1a', minutos: 40, completa: true, respuesta: 'facil' },
        { fecha: 1, respuesta: 'zzz' },
        'x',
      ],
    });
    expect(e.nivel).toBe(6);
    expect(e.dosis).toBe(2);
    expect(e.ultimoDia).toBeNull();
    expect(e.historial).toHaveLength(1);
  });
  it('normalizar: redondea, usa default si no es número, valida cada campo y recorta', () => {
    expect(normalizarEntrenar({ nivel: 2.6, dosis: -1.4 })).toMatchObject({ nivel: 3, dosis: -1 });
    expect(normalizarEntrenar({ nivel: 'x', dosis: null })).toMatchObject({ nivel: 1, dosis: 0 });
    expect(normalizarEntrenar({ nivel: -4, dosis: -9 })).toMatchObject({ nivel: 1, dosis: -2 });
    const malos = [
      { ...reg, minutos: -1 },
      { ...reg, minutos: NaN },
      { ...reg, completa: 'si' },
      { ...reg, plantilla: 3 },
    ];
    const e = normalizarEntrenar({
      ultimoDia: 'B',
      propuestaVista: 'f',
      historial: [...malos, ...Array.from({ length: 130 }, (_, i) => ({ ...reg, minutos: i }))],
    });
    expect(e.historial).toHaveLength(MAX_HISTORIAL);
    expect(e.historial[MAX_HISTORIAL - 1].minutos).toBe(129);
    expect(e.ultimoDia).toBe('B');
    expect(e.propuestaVista).toBe('f');
    expect(normalizarEntrenar({ propuestaVista: 4 }).propuestaVista).toBeNull();
  });
  it('esCompleta: la mitad justa cuenta', () => {
    expect(esCompleta(20, 40)).toBe(true);
    expect(esCompleta(19, 40)).toBe(false);
  });
  it('proximoDia alterna, y arranca en A', () => {
    expect(proximoDia(estado({ ultimoDia: null }))).toBe('A');
    expect(proximoDia(estado({ ultimoDia: 'A' }))).toBe('B');
    expect(proximoDia(estado({ ultimoDia: 'B' }))).toBe('A');
  });
  it('registrar: fácil sube, me mató baja, con tope en ±2', () => {
    let e = registrar(ENTRENAR_INICIAL, conRespuesta('facil'), 'A');
    expect(e.dosis).toBe(1);
    e = registrar(e, conRespuesta('facil', 1), 'B');
    e = registrar(e, conRespuesta('facil', 2), 'A');
    expect(e.dosis).toBe(2);
    e = registrar(e, conRespuesta('bien', 3), 'B');
    expect(e.dosis).toBe(2);
    let m = ENTRENAR_INICIAL;
    for (let i = 0; i < 3; i++) {m = registrar(m, conRespuesta('mato', i), 'A');}
    expect(m.dosis).toBe(-2);
  });
  it('registrar: una incompleta no mueve la dosis pero sí el día', () => {
    const e = registrar(ENTRENAR_INICIAL, { ...reg, completa: false, respuesta: 'facil' }, 'A');
    expect(e.dosis).toBe(0);
    expect(e.ultimoDia).toBe('A');
    expect(e.historial).toHaveLength(1);
  });
  it('registrar: el historial no pasa de 120 y se queda con los más nuevos; no muta', () => {
    let e = ENTRENAR_INICIAL;
    for (let i = 0; i < 125; i++) {e = registrar(e, { ...reg, minutos: i }, 'A');}
    expect(e.historial).toHaveLength(MAX_HISTORIAL);
    expect(e.historial[0].minutos).toBe(5);
    expect(e.historial[MAX_HISTORIAL - 1].minutos).toBe(124);
    expect(ENTRENAR_INICIAL.historial).toHaveLength(0);
  });
  it('propuesta: subir con dosis 2 y dos fáciles completos; una incompleta en el medio no corta', () => {
    const historial = [conRespuesta('facil', 0), conRespuesta('mato', 1, false), conRespuesta('facil', 2)];
    expect(propuestaNivel(estado({ dosis: 2, nivel: 2, historial }))).toBe('subir');
    expect(propuestaNivel(estado({ dosis: 1, nivel: 2, historial }))).toBeNull();
    expect(propuestaNivel(estado({ dosis: 2, nivel: 2, historial: [conRespuesta('facil')] }))).toBeNull();
    const mezcla = [conRespuesta('bien', 0), conRespuesta('facil', 1)];
    expect(propuestaNivel(estado({ dosis: 2, nivel: 2, historial: mezcla }))).toBeNull();
  });
  it('propuesta: nada en nivel 6 aunque todo sea fácil; nada de bajar en nivel 1', () => {
    const faciles = [conRespuesta('facil', 0), conRespuesta('facil', 1)];
    const matos = [conRespuesta('mato', 0), conRespuesta('mato', 1)];
    expect(propuestaNivel(estado({ nivel: 6, dosis: 2, historial: faciles }))).toBeNull();
    expect(propuestaNivel(estado({ nivel: 1, dosis: -2, historial: matos }))).toBeNull();
  });
  it('propuesta: bajar con dosis -2 y dos me mató', () => {
    const matos = [conRespuesta('mato', 0), conRespuesta('mato', 1)];
    expect(propuestaNivel(estado({ nivel: 3, dosis: -2, historial: matos }))).toBe('bajar');
  });
  it('descartar: la propuesta desaparece hasta el próximo registro', () => {
    const historial = [conRespuesta('facil', 0), conRespuesta('facil', 1)];
    const e = estado({ nivel: 2, dosis: 2, historial });
    expect(propuestaNivel(e)).toBe('subir');
    const d = descartarPropuesta(e);
    expect(d.propuestaVista).toBe(historial[1].fecha);
    expect(propuestaNivel(d)).toBeNull();
    expect(e.propuestaVista).toBeNull();
    const r = registrar(d, conRespuesta('facil', 2), 'A');
    expect(propuestaNivel(r)).toBe('subir');
  });
  it('cambiarNivel: dosis vuelve a 0 y el nivel se ajusta a 1–6', () => {
    const e = estado({ nivel: 2, dosis: 2 });
    expect(cambiarNivel(e, 3)).toMatchObject({ nivel: 3, dosis: 0 });
    expect(cambiarNivel(e, 9).nivel).toBe(6);
    expect(cambiarNivel(e, 0).nivel).toBe(1);
  });
});
