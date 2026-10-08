import { describe, expect, it } from 'vitest';

import { DaySchedule, Meal } from '../models/meal.model';
import { indexar } from './catalogo';
import { comidasQueSuman, plantasDeLaSemana } from './plantas';

const indice = indexar([
  { nombre: 'zanahoria', sinonimos: ['zanahoria rallada'], grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'tomate', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'lentejas', grupo: 'feculentos', unidad: 'g', legumbre: true },
  { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad' },
]);

const comida = (id: string, ...ingredientes: string[]): Meal => ({
  id,
  name: id,
  ingredients: ingredientes.map((name) => ({ name, quantity: '1' })),
});

const dia = (almuerzo: { mealId: string; excluded?: boolean }[]): DaySchedule => ({
  dayName: 'Lunes',
  desayuno: [],
  almuerzo: almuerzo.map((d) => ({ portions: 1, ...d })),
  postreAlmuerzo: null,
  colacion: null,
  cena: [],
  postreCena: null,
});

describe('plantasDeLaSemana', () => {
  const meals = [
    comida('a', 'Zanahoria', 'huevo', 'kale'),
    comida('b', 'zanahoria rallada', 'tomates', ''),
    comida('c', 'lentejas'),
  ];

  it('cuenta plantas distintas por entrada canónica, sin carnes', () => {
    const r = plantasDeLaSemana([dia([{ mealId: 'a' }, { mealId: 'b' }])], meals, indice);
    expect(r.plantas).toEqual(['tomate', 'zanahoria']);
    expect(r.sinClasificar).toEqual(['kale']);
  });

  it('ignora platos excluidos, comidas borradas y nombres vacíos', () => {
    const r = plantasDeLaSemana(
      [dia([{ mealId: 'c', excluded: true }, { mealId: 'borrada' }, { mealId: 'b' }])],
      meals,
      indice
    );
    expect(r.plantas).toEqual(['tomate', 'zanahoria']);
    expect(r.sinClasificar).toEqual([]);
  });
});

describe('comidasQueSuman', () => {
  it('ordena por plantas nuevas y descarta las que no suman', () => {
    const meals = [comida('a', 'zanahoria'), comida('b', 'tomate', 'lentejas'), comida('c', 'huevo')];
    const r = comidasQueSuman(new Set(['zanahoria']), meals, indice);
    expect(r.map((x) => [x.meal.id, x.nuevas])).toEqual([['b', 2]]);
  });
});
