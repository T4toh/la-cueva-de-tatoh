// De @angular/fire y no de 'firebase/ai': la app corre sobre el SDK que trae
// @angular/fire (11.x); mezclar con el 12 deja dos registros de Firebase.
import { ObjectSchema, Schema } from '@angular/fire/ai';

import { clasificar, IndiceCatalogo } from '../catalogo/catalogo';
import { resumenPlato, textoReferencia } from '../catalogo/plato';
import { Meal, SugerenciaReceta } from '../models/meal.model';
import { parseQuantity } from '../services/meal.service';
import { firmaReceta, ResultadoReceta } from './revision';

export const MAX_SUGERENCIAS = 3;
// ponytail: tamaño elegido a ojo para que la respuesta no se corte; ajustar si
// Flash empieza a truncar o si la cuota pide menos pedidos.
export const TAMANO_TANDA = 40;

export type RecetaParaFlash = {
  id: string;
  nombre: string;
  tags: string[];
  ingredientes: { nombre: string; cantidad: string; unidad?: string; porcionReferencia?: string }[];
  grupos: { verdura: boolean; proteina: boolean; feculento: boolean; aceite: boolean };
};

export type Pedir = (recetas: RecetaParaFlash[], ids: string[]) => Promise<unknown>;

export type ResultadoTandas = { resultados: ResultadoReceta[]; error: unknown };

// Lo que la app ya sabe va de ayuda: grupos del plato y porción de referencia.
// Ni pasos, ni foto, ni descripción: gastan tokens y no cambian el juicio.
export function resumenParaFlash(meal: Meal, indice: IndiceCatalogo): RecetaParaFlash {
  const { verdura, proteina, feculento, aceite } = resumenPlato(meal.ingredients, indice);
  return {
    id: meal.id,
    nombre: meal.name,
    tags: meal.tags ?? [],
    ingredientes: meal.ingredients.map((i) => {
      const entrada = clasificar(i.name, indice);
      const referencia = entrada ? textoReferencia(entrada) : null;
      return {
        nombre: i.name,
        cantidad: i.quantity,
        ...(i.unit ? { unidad: i.unit } : {}),
        ...(referencia ? { porcionReferencia: referencia } : {}),
      };
    }),
    grupos: { verdura, proteina, feculento, aceite },
  };
}

export function promptRevision(recetas: RecetaParaFlash[], noComo: readonly string[] = []): string {
  return [
    'Sos un cocinero que ayuda a completar recetas caseras. Te paso un recetario en JSON.',
    'Las cantidades de cada receta son por una porción, para una persona.',
    'Para cada receta decidí si alcanza como comida para lo que es. Un postre, una salsa, una bebida',
    'o una colación no "quedan cortos" por no ser un almuerzo: juzgalos como lo que son.',
    // El plato de las GAPA, el mismo que usa la guía. Sin una vara concreta el
    // modelo da por completa cualquier receta que tenga de todo un poco.
    'Un plato principal (almuerzo o cena) tiene que llenar un plato y dejar satisfecho a un adulto: como guía,',
    'medio plato de verduras (más o menos 2 tazas), un cuarto de proteína y un cuarto de feculentos o legumbres.',
    'Si las cantidades por porción no llegan a eso, la receta queda corta aunque tenga de todo un poco.',
    'Si una receta queda corta, sugerí cómo completarla: ingredientes para sumar adentro, arriba o al costado.',
    'Completar, no reescribir: no reemplaces ingredientes ni cambies el estilo del plato.',
    `Como máximo ${MAX_SUGERENCIAS} sugerencias por receta. Cada una con cantidad numérica por porción`,
    '(por ejemplo 1, 0.5 o 1/2), unidad si corresponde, y un motivo de una línea que diga dónde va.',
    // Una preparación ("1 taza de ensalada verde") no se compra ni se suma a
    // la lista. Armar el acompañamiento como plato aparte es otro trabajo.
    'Cada sugerencia es un solo ingrediente concreto, de los que se compran: nunca una preparación',
    'como "ensalada verde", "guarnición" o "salteado de verduras". Si proponés un acompañamiento,',
    'desarmalo en sus ingredientes (por ejemplo lechuga y tomate, cada uno con su cantidad).',
    ...(noComo.length > 0
      ? [`El usuario no come estos ingredientes: ${noComo.join(', ')}. En las sugerencias no sugieras ninguno.`]
      : []),
    'Los campos "grupos" y "porcionReferencia" los calculó la app: son una ayuda, no la regla.',
    'Respondé una entrada por cada receta, con su id. Escribí en español rioplatense.',
    '',
    JSON.stringify(recetas),
  ].join('\n');
}

export function esquemaRespuesta(ids: string[]): ObjectSchema {
  return Schema.object({
    properties: {
      recetas: Schema.array({
        items: Schema.object({
          properties: {
            id: Schema.enumString({ enum: ids }),
            corta: Schema.boolean(),
            sugerencias: Schema.array({
              items: Schema.object({
                properties: {
                  name: Schema.string(),
                  quantity: Schema.string(),
                  unit: Schema.string(),
                  motivo: Schema.string(),
                },
                optionalProperties: ['unit'],
              }),
            }),
          },
        }),
      }),
    },
  });
}

export function esObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function texto(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

// Con texto después del número ('2 cdas', '2-3') la normalización al cargar lo
// recorta, y la firma de la receta cambiaría sola.
export function cantidadEntera(q: string): boolean {
  const cantidad = parseQuantity(q);
  return !!cantidad && cantidad.resto.trim() === '';
}

// Una cantidad que `parseQuantity` no entiende entera rompería la
// multiplicación en compras, así que la sugerencia no se ofrece.
function sugerenciaValida(raw: unknown): SugerenciaReceta | null {
  if (!esObjeto(raw)) {
    return null;
  }
  const name = texto(raw['name']);
  const quantity = texto(raw['quantity']);
  const unit = texto(raw['unit']);
  if (!name || !cantidadEntera(quantity)) {
    return null;
  }
  return { name, quantity, ...(unit ? { unit } : {}), motivo: texto(raw['motivo']) };
}

// Lo inválido se descarta. Una receta sin entrada válida no da resultado y
// queda sin revisar, así la próxima pasada la vuelve a incluir.
export function validarRespuesta(raw: unknown, enviadas: Meal[]): ResultadoReceta[] {
  if (!esObjeto(raw) || !Array.isArray(raw['recetas'])) {
    return [];
  }
  const porId = new Map(enviadas.map((m) => [m.id, m]));
  const vistos = new Set<string>();
  const resultados: ResultadoReceta[] = [];
  for (const entrada of raw['recetas'] as unknown[]) {
    if (!esObjeto(entrada) || typeof entrada['id'] !== 'string' || typeof entrada['corta'] !== 'boolean') {
      continue;
    }
    const meal = porId.get(entrada['id']);
    if (!meal || vistos.has(meal.id)) {
      continue;
    }
    vistos.add(meal.id);
    const corta = entrada['corta'];
    const crudas: unknown[] = Array.isArray(entrada['sugerencias']) ? entrada['sugerencias'] : [];
    const sugerencias = corta
      ? crudas
        .map(sugerenciaValida)
        .filter((s): s is SugerenciaReceta => s !== null)
        .slice(0, MAX_SUGERENCIAS)
      : [];
    if (corta && sugerencias.length === 0) {
      continue;
    }
    resultados.push({ id: meal.id, firma: firmaReceta(meal), corta, sugerencias });
  }
  return resultados;
}

// Las tandas van en serie: si una falla (cuota, red), lo ya respondido se
// guarda igual y las demás quedan sin revisar para la próxima.
export async function revisarEnTandas(
  meals: Meal[],
  indice: IndiceCatalogo,
  pedir: Pedir
): Promise<ResultadoTandas> {
  const resultados: ResultadoReceta[] = [];
  for (let i = 0; i < meals.length; i += TAMANO_TANDA) {
    const tanda = meals.slice(i, i + TAMANO_TANDA);
    try {
      const raw = await pedir(
        tanda.map((m) => resumenParaFlash(m, indice)),
        tanda.map((m) => m.id)
      );
      resultados.push(...validarRespuesta(raw, tanda));
    } catch (error) {
      return { resultados, error };
    }
  }
  return { resultados, error: null };
}

const CUOTA = /429|RESOURCE_EXHAUSTED|quota/i;
// En el plan gratuito Google corta con 500 "high demand" o 503 "Deadline
// expired" cuando el modelo está cargado; el abort es nuestro tope de espera.
const SATURADO = /\b50[03]\b|UNAVAILABLE|high demand|Deadline|timed out|abort/i;

const mensajeDe = (error: unknown): string => (error instanceof Error ? error.message : '');

// Cuota, saturación, cualquier 5xx o tiempo agotado: con otro modelo puede
// andar. Un esquema rechazado (400), una respuesta ilegible o la red caída
// fallarían igual. Esos dos van primero: el mensaje de un JSON roto trae su
// posición ("at position 500") y las regex lo tomarían por un 500.
export function esErrorTransitorio(error: unknown): boolean {
  if (error instanceof SyntaxError || error instanceof TypeError) {
    return false;
  }
  const mensaje = mensajeDe(error);
  return CUOTA.test(mensaje) || SATURADO.test(mensaje) || /\b5\d\d\b/.test(mensaje);
}

// El texto que ve el usuario cuando una pasada falla. Lo ya revisado se
// guardó igual; esto sólo explica por qué faltan las demás.
export function mensajeDeError(
  error: unknown,
  generico = 'No se pudo revisar el recetario. Probá de nuevo más tarde.'
): string {
  // Antes que las regex, por lo mismo que en esErrorTransitorio.
  if (error instanceof SyntaxError) {
    return 'Flash respondió algo que no se pudo leer. Probá de nuevo.';
  }
  if (error instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return 'Sin conexión: revisá internet y probá de nuevo.';
  }
  const mensaje = mensajeDe(error);
  if (CUOTA.test(mensaje)) {
    return 'Se terminó la cuota gratuita de Flash por hoy. Probá de nuevo mañana.';
  }
  if (SATURADO.test(mensaje)) {
    return 'Flash está saturado ahora. Probá de nuevo en un rato.';
  }
  return generico;
}
