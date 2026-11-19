import { describe, expect, it } from 'vitest';

import { Plantilla } from './modelo';
import { plantillaDe, PLANTILLAS } from './plantillas';
import { armarSesion, MIN_MINUTOS, minutosValidos, Paso, PISO_CAMINATA, Sesion } from './sesion';

const pasosDeEjercicio = (s: Sesion): Paso[] => s.pasos.filter((x) => x.tipo === 'ejercicio');
const pasosMovilidad = (s: Sesion): Paso[] => s.pasos.filter((x) => x.tipo === 'movilidad');
const pasosCaminata = (s: Sesion): Paso[] => s.pasos.filter((x) => x.tipo === 'caminata');
const segundosDeCaminata = (s: Sesion): number => pasosCaminata(s).reduce((t, x) => t + x.cantidad, 0);
const cantidades = (s: Sesion, tipo: Paso['tipo']): number[] =>
  s.pasos.filter((x) => x.tipo === tipo).map((x) => x.cantidad);

const conRitmo = (p: Plantilla, s: Sesion, rapido: boolean): number[] => {
  const bloque = p.bloques.find((b) => b.tipo === 'caminata');
  const titulos = new Set(rapido ? ['Caminá rápido', 'Trotá'] : ['Caminá cómodo']);
  expect(bloque).toBeDefined();
  return s.pasos.filter((x) => x.tipo === 'caminata' && titulos.has(x.titulo)).map((x) => x.cantidad);
};

describe('sesion', () => {
  it('minutosValidos: número fuera de rango se ajusta; basura da 60', () => {
    expect(minutosValidos('45')).toBe(45);
    expect(minutosValidos(5)).toBe(MIN_MINUTOS);
    expect(minutosValidos(90)).toBe(60);
    expect(minutosValidos('abc')).toBe(60);
    expect(minutosValidos(undefined)).toBe(60);
  });

  it('la duración estimada cubre los minutos pedidos (±60 s) con 30, 45 y 60', () => {
    for (const m of [30, 45, 60]) {
      for (const p of PLANTILLAS) {
        expect(Math.abs(armarSesion(p, 0, m).segundosEstimados - m * 60), `${p.id} ${m}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it('día A: el circuito sale entero aunque sean 20 minutos', () => {
    const p = plantillaDe(4, 'A');
    expect(pasosDeEjercicio(armarSesion(p, 0, 20))).toEqual(pasosDeEjercicio(armarSesion(p, 0, 60)));
  });

  it('con poco tiempo se recorta primero la movilidad y la caminata no baja de 600 s', () => {
    const s = armarSesion(plantillaDe(1, 'B'), 0, 20);
    expect(segundosDeCaminata(s)).toBeGreaterThanOrEqual(PISO_CAMINATA);
    expect(pasosMovilidad(s).every((x) => x.cantidad >= 20)).toBe(true);
  });

  it('en 20 min toda plantilla respeta el piso de caminata y no toca el circuito', () => {
    for (const p of PLANTILLAS) {
      const s = armarSesion(p, 2, 20);
      expect(segundosDeCaminata(s), p.id).toBeGreaterThanOrEqual(PISO_CAMINATA);
      expect(pasosDeEjercicio(s), p.id).toEqual(pasosDeEjercicio(armarSesion(p, 2, 60)));
    }
  });

  it('dosis +2 sube reps y tramos rápidos; -2 los baja; cómodo no cambia', () => {
    const p = plantillaDe(4, 'A');
    const base = armarSesion(p, 0, 60);
    const mas = armarSesion(p, 2, 60);
    const menos = armarSesion(p, -2, 60);
    const suma = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
    expect(suma(cantidades(mas, 'ejercicio'))).toBeGreaterThan(suma(cantidades(base, 'ejercicio')));
    expect(suma(cantidades(menos, 'ejercicio'))).toBeLessThan(suma(cantidades(base, 'ejercicio')));
    const rapidos = (s: Sesion): number => Math.max(...conRitmo(p, s, true));
    expect(rapidos(mas)).toBeGreaterThan(rapidos(base));
    expect(rapidos(menos)).toBeLessThan(rapidos(base));
    expect(Math.max(...conRitmo(p, mas, false))).toBe(Math.max(...conRitmo(p, base, false)));
    expect(cantidades(mas, 'movilidad')).toEqual(cantidades(base, 'movilidad'));
  });

  it('la dosis nunca deja una cantidad en 0', () => {
    for (const p of PLANTILLAS) {
      for (const x of armarSesion(p, -2, 30).pasos) {
        expect(x.cantidad, `${p.id} ${x.titulo}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('necesita incluye banco si hay sentadilla a banco y tramo-trote si hay trote', () => {
    expect(armarSesion(plantillaDe(1, 'A'), 0, 30).necesita).toContain('banco');
    expect(armarSesion(plantillaDe(4, 'B'), 0, 30).necesita).toContain('tramo-trote');
    expect(armarSesion(plantillaDe(1, 'B'), 0, 30).necesita).not.toContain('tramo-trote');
    const n = armarSesion(plantillaDe(1, 'A'), 0, 30).necesita;
    expect(new Set(n).size).toBe(n.length);
  });

  it('la caminata arranca con el calentamiento cómodo', () => {
    for (const p of PLANTILLAS) {
      const b = p.bloques.find((x) => x.tipo === 'caminata');
      const primero = armarSesion(p, 0, 45).pasos[0];
      expect(primero.tipo, p.id).toBe('caminata');
      expect(primero.titulo, p.id).toBe('Caminá cómodo');
      expect(primero.cantidad, p.id).toBe(b?.tipo === 'caminata' ? b.calentamiento : -1);
    }
  });
});
