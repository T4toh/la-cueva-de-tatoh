import { describe, expect, it } from 'vitest';

import { ShoppingItem, ShoppingListGroup } from '../models/meal.model';
import { textoPorDia, textoPorGondola } from './copiar';
import { DiaLista } from './partes';

const item = (name: string, quantity: string, extra: Partial<ShoppingItem> = {}): ShoppingItem =>
  ({ name, quantity, ...extra }) as ShoppingItem;
const cantidad = (i: ShoppingItem): string => i.quantity;
const RANGO = 'lun 9 al dom 15';
const PIE = '_Generado por Comidas - La Cueva de Tatoh_';

describe('textoPorGondola', () => {
  it('agrupa por tag con los días entre paréntesis y los manuales sin', () => {
    const grupos = [
      {
        tag: { id: 'v', name: 'Verdulería' },
        items: [
          item('Cebolla', '3 u', { dias: ['Lunes', 'Martes', 'Miércoles'] }),
          item('Zapallo', '1 u', { dias: ['Lunes'], checked: true }),
        ],
      },
      { tag: null, items: [item('Jabón', '1', { isExtra: true, dias: [] })] },
    ] as ShoppingListGroup[];
    expect(textoPorGondola(grupos, RANGO, cantidad)).toBe(
      `🛒 *Lista de Compras* (${RANGO})\n\n*VERDULERÍA*\n• Cebolla: 3 u (lun, mar, mié)\n\n*OTROS*\n• Jabón: 1\n\n${PIE}`,
    );
  });

  it('todo tildado devuelve null', () => {
    const grupos = [{ tag: null, items: [item('A', '1', { checked: true })] }] as ShoppingListGroup[];
    expect(textoPorGondola(grupos, RANGO, cantidad)).toBeNull();
  });
});

describe('textoPorDia', () => {
  const dias: DiaLista[] = [
    {
      fecha: '2026-11-09',
      dia: 'Lunes',
      diaDelMes: 9,
      platos: ['Fideos con brócoli', 'Ensalada de lentejas'],
      items: [item('Brócoli', '1 u'), item('Fideos', '250 g'), item('Sal', '1', { checked: true })],
    },
    { fecha: '2026-11-10', dia: 'Martes', diaDelMes: 10, platos: ['Pollo'], items: [item('Pollo', '1', { checked: true })] },
    { fecha: '2026-11-11', dia: 'Miércoles', diaDelMes: 11, platos: [], items: [item('Pan', '2')] },
    { fecha: null, dia: null, diaDelMes: null, platos: [], items: [item('Jabón', '1')] },
  ];

  it('una sección por día, omite los tildados y cierra con SIN DÍA', () => {
    expect(textoPorDia(dias, RANGO, cantidad)).toBe(
      `🛒 *Lista de Compras* (${RANGO})\n\n` +
        '*LUNES 9* _Fideos con brócoli · Ensalada de lentejas_\n• Brócoli: 1 u\n• Fideos: 250 g\n\n' +
        '*MIÉRCOLES 11*\n• Pan: 2\n\n*SIN DÍA*\n• Jabón: 1\n\n' +
        PIE,
    );
  });

  it('todo tildado devuelve null', () => {
    const todo = [{ ...dias[1] }];
    expect(textoPorDia(todo, RANGO, cantidad)).toBeNull();
  });
});
