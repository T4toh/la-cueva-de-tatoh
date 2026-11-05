// Las partes de un renglón de la lista de compras: lo que se necesita de un
// ingrediente un día puntual. Puras, para que la lista y las compras
// registradas compartan las mismas claves.

import { ShoppingItem } from '../models/meal.model';

export type ParteCompra = {
  clave: string;
  nombre: string;
  fecha: string | null;
  // El `dayName` ('Lunes'…); null en las manuales.
  dia: string | null;
  diaDelMes: number | null;
  quantity: string;
  unit?: string;
  tagId?: string;
  platos: string[];
};

// Un día de la vista por día: sus platos y una parte por ingrediente. El de
// los manuales va último, con todo en null.
export type DiaLista = {
  fecha: string | null;
  dia: string | null;
  diaDelMes: number | null;
  platos: string[];
  items: ShoppingItem[];
};

// Mismo criterio que `aComprar`: sin esto, 0.30000000000000004 dejaría un resto.
const TOLERANCIA = 1e-9;

export function claveParte(clave: string, fecha: string | null): string {
  return `${clave}@${fecha ?? 'manual'}`;
}

// La clave sin `@` es de antes de partir por día: tilda todas las partes del renglón.
export function estaTildada(clave: string, fecha: string | null, tildadas: readonly string[]): boolean {
  return tildadas.includes(claveParte(clave, fecha)) || tildadas.includes(clave);
}

// La despensa cubre las partes en orden; devuelve lo que falta de cada una.
export function repartirDespensa(necesario: number[], disponible: number): number[] {
  let resto = disponible;
  return necesario.map((n) => {
    const cubierto = Math.min(n, resto);
    resto -= cubierto;
    const falta = n - cubierto;
    return falta <= TOLERANCIA ? 0 : falta;
  });
}

export function diaCorto(dayName: string): string {
  return dayName.slice(0, 3).toLowerCase();
}
