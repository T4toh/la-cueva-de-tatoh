// El backup agrupado por lo que significa cada cosa, para que importar sea
// elegir qué se reemplaza y no adivinar qué clave pisa qué. El calendario y
// las compras referencian comidas por id: sin ellas quedan apuntando a nada.

export type SeccionBackup = 'comidas' | 'calendario' | 'compras' | 'despensa' | 'ajustes';

export type ResumenSeccion = {
  seccion: SeccionBackup;
  etiqueta: string;
  // Sólo donde hay un número que diga algo: comidas, semanas, items.
  cantidad?: number;
  unidad?: string;
};

type Seccion = { seccion: SeccionBackup; etiqueta: string; claves: string[]; cuenta?: string; unidad?: string };

const SECCIONES: Seccion[] = [
  { seccion: 'comidas', etiqueta: 'Comidas', claves: ['meals'], cuenta: 'meals', unidad: 'comidas' },
  { seccion: 'calendario', etiqueta: 'Calendario', claves: ['schedules'], cuenta: 'schedules', unidad: 'semanas' },
  {
    seccion: 'compras',
    etiqueta: 'Compras',
    claves: ['tags', 'ingredientTags', 'extraItems', 'extraItemsHistory', 'overrides', 'checkedItems'],
  },
  { seccion: 'despensa', etiqueta: 'Despensa', claves: ['pantry', 'pantryGroups'], cuenta: 'pantry', unidad: 'items' },
  { seccion: 'ajustes', etiqueta: 'Ajustes', claves: ['familySettings', 'alias'] },
];

// Las claves que un backup puede traer. `version` no está: se escribe pero no
// se lee nunca, así que un archivo que sólo tenga eso no es un backup.
export const CLAVES_BACKUP: readonly string[] = SECCIONES.flatMap((s) => s.claves);

function esObjeto(data: unknown): data is Record<string, unknown> {
  return !!data && typeof data === 'object' && !Array.isArray(data);
}

function contar(v: unknown): number {
  if (Array.isArray(v)) {
    return v.length;
  }
  return esObjeto(v) ? Object.keys(v).length : 0;
}

export function seccionesDe(data: Record<string, unknown>): ResumenSeccion[] {
  return SECCIONES.filter((s) => s.claves.some((c) => c in data)).map((s) => ({
    seccion: s.seccion,
    etiqueta: s.etiqueta,
    ...(s.cuenta ? { cantidad: contar(data[s.cuenta]), unidad: s.unidad } : {}),
  }));
}

// Una lista de comidas suelta —un array, o `{ meals }` como el export viejo
// de sólo comidas— se revisa fila por fila en vez de reemplazar la lista.
export function soloComidas(data: unknown): boolean {
  if (Array.isArray(data)) {
    return true;
  }
  if (!esObjeto(data) || !Array.isArray(data['meals'])) {
    return false;
  }
  return CLAVES_BACKUP.filter((c) => c in data).every((c) => c === 'meals');
}

export function filtrarSecciones(
  data: Record<string, unknown>,
  secciones: readonly SeccionBackup[]
): Record<string, unknown> {
  const claves = SECCIONES.filter((s) => secciones.includes(s.seccion)).flatMap((s) => s.claves);
  return Object.fromEntries(claves.filter((c) => c in data).map((c) => [c, data[c]]));
}

// Los platos del calendario cuyo `mealId` no está en `ids`. Entiende el
// formato viejo, donde el plato era un id suelto en vez de un array.
export function platosHuerfanos(schedules: unknown, ids: ReadonlySet<string>): number {
  let huerfanos = 0;
  for (const semana of Object.values(esObjeto(schedules) ? schedules : {})) {
    for (const dia of Array.isArray(semana) ? semana : []) {
      for (const campo of ['desayuno', 'almuerzo', 'cena']) {
        const valor = esObjeto(dia) ? dia[campo] : null;
        const platos = Array.isArray(valor) ? valor : valor ? [valor] : [];
        for (const plato of platos) {
          const id = typeof plato === 'string' ? plato : esObjeto(plato) ? plato['mealId'] : null;
          if (typeof id === 'string' && !ids.has(id)) {
            huerfanos++;
          }
        }
      }
    }
  }
  return huerfanos;
}
