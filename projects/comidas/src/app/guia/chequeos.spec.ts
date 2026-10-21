import { describe, expect, it } from 'vitest';

import { indexar } from '../catalogo/catalogo';
import { DaySchedule, Meal } from '../models/meal.model';
import { chequearSemana } from './chequeos';

const indice = indexar([
  { nombre: 'arroz', grupo: 'feculentos', unidad: 'g' },
  { nombre: 'lentejas', grupo: 'feculentos', unidad: 'g', legumbre: true },
  { nombre: 'pan', grupo: 'pan', unidad: 'g' },
  { nombre: 'pan rallado', grupo: 'pan', unidad: 'g', menor: true },
  { nombre: 'maicena', grupo: 'feculentos', unidad: 'cda', menor: true },
  { nombre: 'carne vacuna', grupo: 'carnesHuevos', unidad: 'g', carne: 'roja' },
  { nombre: 'pollo', grupo: 'carnesHuevos', unidad: 'g', carne: 'blanca' },
  { nombre: 'merluza', grupo: 'carnesHuevos', unidad: 'g', carne: 'pescado' },
  { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad' },
  { nombre: 'lechuga', grupo: 'hortalizas', unidad: 'unidad' },
]);

const comida = (id: string, ...ingredientes: string[]): Meal => ({
  id,
  name: id,
  ingredients: ingredientes.map((name) => ({ name, quantity: '1' })),
});

const meals = [
  comida('arroz', 'arroz'),
  comida('lentejas', 'lentejas'),
  comida('pan', 'pan'),
  comida('milanesa', 'pollo', 'pan rallado'),
  comida('ensalada espesada', 'lechuga', 'maicena'),
  comida('bife', 'carne vacuna'),
  comida('mixto', 'pollo', 'carne vacuna'),
  comida('revuelto', 'huevo', 'carne vacuna'),
  comida('huevo', 'huevo'),
  comida('afuera'),
];

type Plato = string | { mealId: string; excluded?: boolean };
type Comidas = { desayuno?: Plato[]; almuerzo?: Plato[]; cena?: Plato[] };

const platos = (ps: Plato[] = []): DaySchedule['almuerzo'] =>
  ps.map((p) => ({ portions: 1, ...(typeof p === 'string' ? { mealId: p } : p) }));

const dia = (dayName: string, c: Comidas): DaySchedule => ({
  dayName,
  desayuno: platos(c.desayuno),
  almuerzo: platos(c.almuerzo),
  postreAlmuerzo: null,
  colacion: null,
  cena: platos(c.cena),
  postreCena: null,
});

const lunes = (c: Comidas): DaySchedule[] => [dia('Lunes', c)];

describe('chequearSemana', () => {
  it('marca el día con carbos en almuerzo y cena', () => {
    const r = chequearSemana(lunes({ almuerzo: ['arroz'], cena: ['pan'] }), meals, indice);
    expect(r.diasConDosCarbos).toEqual(['Lunes']);
    expect(r.incumplidas).toContain('un-carbo-por-dia');
  });

  it('el desayuno no cuenta para los carbos', () => {
    const r = chequearSemana(lunes({ desayuno: ['pan'], almuerzo: ['arroz'] }), meals, indice);
    expect(r.diasConDosCarbos).toEqual([]);
    expect(r.incumplidas).not.toContain('un-carbo-por-dia');
  });

  it('las legumbres cuentan como carbos', () => {
    const r = chequearSemana(lunes({ almuerzo: ['lentejas'], cena: ['arroz'] }), meals, indice);
    expect(r.diasConDosCarbos).toEqual(['Lunes']);
  });

  it('dos platos con carbos en la misma cena son una vez', () => {
    const r = chequearSemana(lunes({ cena: ['arroz', 'pan'] }), meals, indice);
    expect(r.diasConDosCarbos).toEqual([]);
  });

  it('lo menor no cuenta', () => {
    expect(chequearSemana(lunes({ almuerzo: ['milanesa'], cena: ['arroz'] }), meals, indice).diasConDosCarbos)
      .toEqual([]);
    expect(
      chequearSemana(lunes({ almuerzo: ['ensalada espesada'], cena: ['arroz'] }), meals, indice).diasConDosCarbos
    ).toEqual([]);
  });

  it('cuenta platos excluidos e ignora comidas borradas', () => {
    const r = chequearSemana(
      lunes({ almuerzo: [{ mealId: 'arroz', excluded: true }], cena: ['borrada', 'pan'] }),
      meals,
      indice
    );
    expect(r.diasConDosCarbos).toEqual(['Lunes']);
  });

  it('una comida sin ingredientes no suma', () => {
    const r = chequearSemana(lunes({ almuerzo: ['afuera'], cena: ['arroz'] }), meals, indice);
    expect(r.diasConDosCarbos).toEqual([]);
    expect(r.carnes).toEqual({ roja: 0, blanca: 0, pescado: 0 });
  });

  it('cuenta carnes por comida y por tipo', () => {
    const r = chequearSemana(lunes({ cena: ['mixto'] }), meals, indice);
    expect(r.carnes).toEqual({ roja: 1, blanca: 1, pescado: 0 });
  });

  it('dos rojas en la misma comida son una vez, y el desayuno cuenta', () => {
    const r = chequearSemana(lunes({ desayuno: ['revuelto'], almuerzo: ['bife', 'bife'] }), meals, indice);
    expect(r.carnes.roja).toBe(2);
  });

  it('el huevo no es carne', () => {
    const r = chequearSemana(lunes({ almuerzo: ['huevo'] }), meals, indice);
    expect(r.carnes).toEqual({ roja: 0, blanca: 0, pescado: 0 });
  });

  it('la roja marca al pasar de 3', () => {
    const dias = (n: number): DaySchedule[] =>
      ['Lunes', 'Martes', 'Miércoles', 'Jueves'].slice(0, n).map((d) => dia(d, { almuerzo: ['bife'] }));
    const cuatro = chequearSemana(dias(4), meals, indice);
    expect(cuatro.carnes.roja).toBe(4);
    expect(cuatro.incumplidas).toContain('frecuencia-carnes');
    expect(chequearSemana(dias(3), meals, indice).incumplidas).not.toContain('frecuencia-carnes');
  });

  it('las incumplidas van en el orden de la guía', () => {
    const semana = [
      ...['Lunes', 'Martes', 'Miércoles', 'Jueves'].map((d) => dia(d, { almuerzo: ['bife'] })),
      dia('Viernes', { almuerzo: ['arroz'], cena: ['pan'] }),
    ];
    expect(chequearSemana(semana, meals, indice).incumplidas).toEqual(['un-carbo-por-dia', 'frecuencia-carnes']);
  });

  it('semana vacía', () => {
    expect(chequearSemana([], [], indice)).toEqual({
      diasConDosCarbos: [],
      carnes: { roja: 0, blanca: 0, pescado: 0 },
      incumplidas: [],
    });
  });
});
