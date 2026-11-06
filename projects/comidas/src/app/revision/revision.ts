import { Meal, SugerenciaReceta } from '../models/meal.model';

// "Sin revisar" no se guarda: se deriva de la firma, así una edición en el
// editor invalida la revisión sin que el editor sepa que existe.
export type EstadoRevision = 'no-aplica' | 'sin-revisar' | 'corta' | 'ok';

export type ResultadoReceta = {
  id: string;
  firma: string;
  corta: boolean;
  sugerencias: SugerenciaReceta[];
};

const MODULO = 2 ** 32;

// Hash polinomial módulo 2^32: síncrono y corto, porque va en el documento de
// Firestore del usuario. No es criptográfico ni hace falta: sólo detecta
// cambios. Sin operadores de bits porque el lint los prohíbe; con el módulo,
// `hash * 31 + código` no pasa de 2^37 y el double lo calcula exacto.
function hashTexto(texto: string): string {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) % MODULO;
  }
  return hash.toString(16).padStart(8, '0');
}

// Nombre, tags e ingredientes: lo que Flash ve. Los tags entran porque son lo
// que le dice si algo es un postre. `checked`, la foto y "sumar a compras" no.
export function firmaReceta(meal: Pick<Meal, 'name' | 'tags' | 'ingredients'>): string {
  return hashTexto(
    JSON.stringify([
      meal.name.trim(),
      [...(meal.tags ?? [])].sort(),
      meal.ingredients.map((i) => [i.name.trim(), i.quantity, i.unit ?? '']),
    ])
  );
}

export function estadoRevision(meal: Meal): EstadoRevision {
  if (meal.ingredients.length === 0) {
    return 'no-aplica';
  }
  const revision = meal.revision;
  if (!revision || revision.firma !== firmaReceta(meal)) {
    return 'sin-revisar';
  }
  return revision.corta && revision.sugerencias.length > 0 ? 'corta' : 'ok';
}

export function recetasSinRevisar(meals: Meal[]): Meal[] {
  return meals.filter((m) => estadoRevision(m) === 'sin-revisar');
}

// Guarda cada resultado con la firma de lo que se *mandó*: si la receta se
// editó mientras el pedido estaba en vuelo, queda sin revisar sola.
export function aplicarRevisiones(meals: Meal[], resultados: ResultadoReceta[]): Meal[] {
  const porId = new Map(resultados.map((r) => [r.id, r]));
  return meals.map((m) => {
    const r = porId.get(m.id);
    return r ? { ...m, revision: { firma: r.firma, corta: r.corta, sugerencias: r.sugerencias } } : m;
  });
}

// Recalcula la firma con el ingrediente ya sumado: sumar una sugerencia no
// deja la receta sin revisar, y las otras sugerencias siguen en pie.
export function sumarSugerencia(meal: Meal, indice: number): Meal {
  const revision = meal.revision;
  const sugerencia = revision?.sugerencias[indice];
  if (!revision || !sugerencia) {
    return meal;
  }
  const { name, quantity, unit } = sugerencia;
  const ingredients = [...meal.ingredients, unit ? { name, quantity, unit } : { name, quantity }];
  return {
    ...meal,
    ingredients,
    revision: {
      ...revision,
      firma: firmaReceta({ ...meal, ingredients }),
      sugerencias: revision.sugerencias.filter((_, i) => i !== indice),
    },
  };
}

// La firma se queda: una receta descartada no vuelve a marcarse hasta que se
// edite.
export function descartarSugerencias(meal: Meal): Meal {
  return meal.revision ? { ...meal, revision: { ...meal.revision, sugerencias: [] } } : meal;
}
