import { Ingredient, Meal, Paso } from '../models/meal.model';

// El documento que se publica. Es una lista blanca a propósito: `Meal` tiene
// `tags` e `includeInShoppingList`, que son organización privada, y el día que
// gane un campo nuevo no se publica solo.
export type RecetaPublica = {
  nombre: string;
  descripcion?: string;
  ingredientes: Ingredient[];
  pasos?: Paso[];
  alias?: string;
  ruta: string;
  actualizada: number;
  ownerUid: string;
};

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';
const LARGO_ID = 8;
// 252 = 36 * 7. Los bytes de 252 para arriba sesgarían el módulo hacia las
// primeras letras, y acá el azar es lo único que hace de llave.
const TOPE_SIN_SESGO = 252;
const MAX_PALABRAS = 5;
// Límite de iteraciones del while para detectar rechazo masivo o arrays vacíos.
// Con bytesAlAzar devolviendo 16 bytes y ~98,4% de aceptación, el camino real
// termina casi siempre en una sola vuelta. Decenas es holgadísimo y nunca se
// toca en producción, pero captura fixtures rotos (todos bytes > 252, o
// arrays vacíos).
const TOPE_ITERACIONES = 100;

function bytesAlAzar(): Uint8Array {
  const bytes = new Uint8Array(LARGO_ID * 2);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generarIdPublico(bytes: () => Uint8Array = bytesAlAzar): string {
  let id = '';
  let iteraciones = 0;
  while (id.length < LARGO_ID) {
    if (iteraciones >= TOPE_ITERACIONES) {
      throw new Error(
        'generarIdPublico: rechazo masivo. El inyectable bytes() no produce ' +
          'suficientes valores válidos (< 252).'
      );
    }
    iteraciones += 1;
    const lote = bytes();
    for (const byte of lote) {
      if (byte < TOPE_SIN_SESGO && id.length < LARGO_ID) {
        id += ALFABETO[byte % ALFABETO.length];
      }
    }
  }
  return id;
}

export function slug(texto: string): string {
  const limpio = texto
    .normalize('NFD')
    // Los diacríticos quedan sueltos después del NFD y se tiran acá.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!limpio) {
    return '';
  }
  return limpio.split(' ').slice(0, MAX_PALABRAS).join('-');
}

export function rutaPublica(
  nombre: string,
  alias: string | undefined,
  id: string
): string {
  const nick = slug(alias ?? '');
  const receta = slug(nombre) || 'receta';
  return nick ? `/r/${nick}/${receta}/${id}` : `/r/${receta}/${id}`;
}

export function aRecetaPublica(
  meal: Meal,
  alias: string | undefined,
  ownerUid: string,
  id: string,
  ahora: number
): RecetaPublica {
  // Un alias de sólo espacios es truthy pero no muestra nada: se trata igual
  // que si no hubiera alias, tanto en el documento como en la ruta. Se guarda
  // ya trimeado: nada pide conservar los espacios de sobra en el documento.
  const aliasUsable = alias?.trim() || undefined;
  // Se proyecta ingrediente por ingrediente en vez de copiar el objeto
  // entero: `Ingredient` tiene `checked`, el tilde de la lista de compras, y
  // ese estado privado no debe viajar con la receta pública. Lo mismo vale
  // para cualquier campo que gane mañana.
  const ingredientes = (meal.ingredients ?? []).map((ing) => {
    const proyectado: Ingredient = { name: ing.name, quantity: ing.quantity };
    if (ing.unit) {
      proyectado.unit = ing.unit;
    }
    return proyectado;
  });
  const receta: RecetaPublica = {
    nombre: meal.name,
    ingredientes,
    ruta: rutaPublica(meal.name, aliasUsable, id),
    actualizada: ahora,
    ownerUid,
  };
  // Los opcionales se omiten en vez de escribirse en `undefined`: Firestore
  // rechaza `undefined` y `sanitizeForFirestore` lo borraría igual.
  const descripcionUsable = meal.description?.trim() || undefined;
  if (descripcionUsable) {
    receta.descripcion = descripcionUsable;
  }
  if (meal.pasos?.length) {
    // Proyectado paso por paso por la misma razón que los ingredientes: hoy
    // `Paso` es sólo `texto`, pero la fase 4 le suma fotos y una nota privada
    // por paso se publicaría sola si se copiara el objeto entero.
    receta.pasos = meal.pasos.map((paso) => ({ texto: paso.texto }));
  }
  if (aliasUsable) {
    receta.alias = aliasUsable;
  }
  return receta;
}

export function aMeal(receta: RecetaPublica, id: string): Meal {
  const meal: Meal = {
    id,
    name: receta.nombre,
    ingredients: receta.ingredientes ?? [],
  };
  if (receta.descripcion) {
    meal.description = receta.descripcion;
  }
  if (receta.pasos?.length) {
    meal.pasos = receta.pasos;
  }
  return meal;
}
