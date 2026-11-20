import { describe, expect, it } from 'vitest';

import { alcanzar, restante } from './reloj';
import { Paso } from './sesion';

const base = { figura: 'x', bloque: 0 };
const seg = (cantidad: number): Paso => ({ ...base, tipo: 'caminata', titulo: 'c', medida: 'segundos', cantidad });
const reps = (cantidad: number): Paso => ({ ...base, tipo: 'ejercicio', titulo: 'e', medida: 'reps', cantidad });

describe('reloj', () => {
  it('alcanzar salta varios pasos vencidos de una', () => {
    const pasos = [seg(60), seg(60), seg(60), seg(60), seg(600)];
    const r = alcanzar(pasos, { indice: 0, finPaso: 60_000, pausadoRestante: null }, 5 * 60_000);
    expect(r.indice).toBe(4);
    expect(r.finPaso).toBe(60_000 + 3 * 60_000 + 600_000);
  });

  it('alcanzar frena en un paso de reps', () => {
    const pasos = [seg(10), reps(8), seg(10)];
    const r = alcanzar(pasos, { indice: 0, finPaso: 10_000, pausadoRestante: null }, 999_000);
    expect(r).toEqual({ indice: 1, finPaso: null, pausadoRestante: null });
  });

  it('al vencer el último paso el índice queda en pasos.length', () => {
    const r = alcanzar([seg(10)], { indice: 0, finPaso: 10_000, pausadoRestante: null }, 20_000);
    expect(r.indice).toBe(1);
    expect(r.finPaso).toBe(10_000);
  });

  it('pausado no avanza; restante devuelve pausadoRestante', () => {
    const e = { indice: 0, finPaso: 1000, pausadoRestante: 7000 };
    expect(alcanzar([seg(10), seg(10)], e, 999_999)).toBe(e);
    expect(restante(e, 999_999)).toBe(7000);
  });

  it('restante nunca es negativo', () => {
    expect(restante({ indice: 0, finPaso: 1000, pausadoRestante: null }, 5000)).toBe(0);
    expect(restante({ indice: 0, finPaso: null, pausadoRestante: null }, 5000)).toBe(0);
  });
});
