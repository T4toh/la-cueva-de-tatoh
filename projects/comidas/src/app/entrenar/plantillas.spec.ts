import { describe, expect, it } from 'vitest';

import { ejercicio, EJERCICIOS } from './ejercicios';
import { Bloque, Necesidad, Plantilla, Ritmo } from './modelo';
import { plantillaDe, PLANTILLAS } from './plantillas';

type Circuito = Extract<Bloque, { tipo: 'circuito' }>;

const NECESIDADES: Necesidad[] = ['banco', 'piso', 'pared', 'tramo-trote'];
const ESCALA_MAXIMA = 1.3; // dosis +2: +30% en reps y segundos del circuito
const SEGUNDOS_POR_REP = 3;
const CAMINATA_MINIMA = 600;
const TOPE = 1800;

const circuitos = (p: Plantilla): Circuito[] =>
  p.bloques.filter((b): b is Circuito => b.tipo === 'circuito');
const circuito = (p: Plantilla): Circuito => circuitos(p)[0];

function segundosFijos(p: Plantilla): number {
  let total = 0;
  for (const b of p.bloques) {
    if (b.tipo === 'caminata') {
      total += b.calentamiento;
    } else if (b.tipo === 'movilidad') {
      total += b.ejercicios.reduce((s, e) => s + e.segundos, 0);
    } else {
      const trabajo = b.ejercicios.reduce(
        (s, e) => s + (ejercicio(e.id).medida === 'reps' ? e.dosis * SEGUNDOS_POR_REP : e.dosis),
        0
      );
      total += b.vueltas * (Math.ceil(trabajo * ESCALA_MAXIMA) + b.descanso * b.ejercicios.length);
    }
  }
  return total;
}

describe('PLANTILLAS', () => {
  it('hay exactamente una A y una B por nivel, del 1 al 6', () => {
    for (let n = 1; n <= 6; n++) {
      for (const d of ['A', 'B'] as const) {
        expect(PLANTILLAS.filter((p) => p.nivel === n && p.dia === d), `${n}${d}`).toHaveLength(1);
      }
    }
    expect(PLANTILLAS).toHaveLength(12);
  });

  it('ids únicos en ejercicios y plantillas', () => {
    expect(new Set(EJERCICIOS.map((e) => e.id)).size).toBe(EJERCICIOS.length);
    expect(new Set(PLANTILLAS.map((p) => p.id)).size).toBe(PLANTILLAS.length);
  });

  it('todo id referenciado existe en EJERCICIOS', () => {
    const ids = new Set(EJERCICIOS.map((e) => e.id));
    for (const p of PLANTILLAS) {
      for (const b of p.bloques) {
        if (b.tipo !== 'caminata') {
          for (const e of b.ejercicios) {
            expect(ids.has(e.id), `${p.id}: ${e.id}`).toBe(true);
          }
        }
      }
    }
  });

  it('el día B no tiene circuito; el A tiene exactamente uno', () => {
    for (const p of PLANTILLAS) {
      expect(circuitos(p), p.id).toHaveLength(p.dia === 'A' ? 1 : 0);
    }
  });

  it('toda plantilla tiene un solo bloque caminata con ciclo no vacío', () => {
    for (const p of PLANTILLAS) {
      const caminatas = p.bloques.filter((b) => b.tipo === 'caminata');
      expect(caminatas, p.id).toHaveLength(1);
      expect(caminatas[0].ciclo.length, p.id).toBeGreaterThan(0);
    }
  });

  it('nivel 1 camina solo a paso cómodo; el trote aparece recién en el 4', () => {
    const ritmos = (n: number): Ritmo[] =>
      (['A', 'B'] as const).flatMap((d) =>
        plantillaDe(n, d).bloques.flatMap((b) => (b.tipo === 'caminata' ? b.ciclo.map((t) => t.ritmo) : []))
      );
    expect(new Set(ritmos(1))).toEqual(new Set(['comodo']));
    expect(ritmos(3)).not.toContain('trote');
    expect(ritmos(4)).toContain('trote');
  });

  it('ningún tramo de trote pasa de 5 min: el salto desde el 5 no es de golpe', () => {
    const ciclo = (d: 'A' | 'B'): unknown =>
      plantillaDe(6, d).bloques.flatMap((b) => (b.tipo === 'caminata' ? b.ciclo : []));
    expect(ciclo('A')).toEqual([
      { ritmo: 'trote', segundos: 300 },
      { ritmo: 'comodo', segundos: 60 },
    ]);
    for (const p of PLANTILLAS) {
      for (const b of p.bloques) {
        if (b.tipo === 'caminata') {
          b.ciclo
            .filter((t) => t.ritmo === 'trote')
            .forEach((t) => expect(t.segundos, p.id).toBeLessThanOrEqual(300));
        }
      }
    }
  });

  it('el circuito del nivel 1 tiene una vuelta', () => {
    expect(circuito(plantillaDe(1, 'A')).vueltas).toBe(1);
  });

  it('ningún ejercicio pide equipo fuera de Necesidad', () => {
    for (const e of EJERCICIOS) {
      expect(e.necesita === undefined || NECESIDADES.includes(e.necesita), e.id).toBe(true);
    }
  });

  it('la parte fija más 10 min de caminata entra en 30 min aun con dosis +2', () => {
    for (const p of PLANTILLAS) {
      expect(segundosFijos(p) + CAMINATA_MINIMA, p.id).toBeLessThanOrEqual(TOPE);
    }
  });

  it('los textos de ejercicios no están vacíos y la movilidad dura 30-45 s', () => {
    for (const e of EJERCICIOS) {
      expect(e.nombre.trim(), e.id).not.toBe('');
      expect(e.como.trim(), e.id).not.toBe('');
    }
    for (const p of PLANTILLAS) {
      for (const b of p.bloques) {
        if (b.tipo === 'movilidad') {
          expect(b.ejercicios.length, p.id).toBeGreaterThanOrEqual(4);
          for (const e of b.ejercicios) {
            expect(e.segundos, p.id).toBeGreaterThanOrEqual(30);
            expect(e.segundos, p.id).toBeLessThanOrEqual(45);
          }
        }
      }
    }
  });
});
