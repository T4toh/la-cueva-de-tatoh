// Texto de WhatsApp de la lista: sólo lo pendiente. Puras para testearlas sin el componente.

import { ShoppingItem, ShoppingListGroup } from '../models/meal.model';
import { diaCorto, DiaLista } from './partes';

const PIE = '_Generado por Comidas - La Cueva de Tatoh_';

type Seccion = { titulo: string; lineas: string[] };

// Arma encabezado, secciones y pie; null si ninguna sección tiene nada pendiente.
function armar(rango: string, secciones: Seccion[]): string | null {
  const conItems = secciones.filter((s) => s.lineas.length > 0);
  if (conItems.length === 0) {
    return null;
  }
  const cuerpo = conItems.map((s) => `${s.titulo}\n${s.lineas.join('\n')}`).join('\n\n');
  return `🛒 *Lista de Compras* (${rango})\n\n${cuerpo}\n\n${PIE}`;
}

export function textoPorGondola(
  grupos: ShoppingListGroup[],
  rango: string,
  cantidad: (i: ShoppingItem) => string,
): string | null {
  return armar(
    rango,
    grupos.map((g) => ({
      titulo: `*${g.tag ? g.tag.name.toUpperCase() : 'OTROS'}*`,
      lineas: g.items
        .filter((i) => !i.checked)
        .map((i) => {
          // Los manuales no tienen días pendientes: sin paréntesis.
          const dias = i.dias?.length ? ` (${i.dias.map(diaCorto).join(', ')})` : '';
          return `• ${i.name}: ${cantidad(i)}${dias}`;
        }),
    })),
  );
}

export function textoPorDia(dias: DiaLista[], rango: string, cantidad: (i: ShoppingItem) => string): string | null {
  return armar(
    rango,
    dias.map((d) => {
      const platos = d.platos.length > 0 ? ` _${d.platos.join(' · ')}_` : '';
      return {
        titulo: d.dia ? `*${d.dia.toUpperCase()} ${d.diaDelMes}*${platos}` : '*SIN DÍA*',
        lineas: d.items.filter((i) => !i.checked).map((i) => `• ${i.name}: ${cantidad(i)}`),
      };
    }),
  );
}
