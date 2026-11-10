// El pedido a Flash para completar la semana: arma el contexto, el prompt y el
// esquema, y valida lo que vuelve. Flash sólo elige entre los candidatos de
// cada slot; lo demás lo sigue decidiendo el algoritmo (ver armarSemana).
import { ObjectSchema, Schema } from '@angular/fire/ai';

import { META_PLANTAS, plantasDeLaSemana } from '../catalogo/plantas';
import { chequearSemana } from '../guia/chequeos';
import { DaySchedule } from '../models/meal.model';
import { esObjeto, RecetaParaFlash, resumenParaFlash, texto } from '../revision/pedido';
import { OpcionesSlot, Preferida } from './armador';
import { Estacion } from './estacion';
import { ContextoPuntaje } from './puntaje';

export type ContextoFlash = {
  estacion: Estacion;
  pais: string;
  noComo: string[];
  plantas: { van: number; meta: number };
  chequeo: { diasConDosCarbos: string[]; roja: number; pescado: number; blanca: number };
  // Nombres de lo ya puesto, no ids.
  semana: { dia: string; desayuno: string[]; almuerzo: string[]; cena: string[] }[];
  slots: { clave: string; candidatos: { id: string; puntaje: number }[] }[];
  // Una por candidato distinto, sin repetir.
  recetas: RecetaParaFlash[];
};

export function contextoFlash(
  semana: DaySchedule[],
  opciones: OpcionesSlot[],
  ctx: ContextoPuntaje,
  paisNombre: string,
  noComo: string[],
): ContextoFlash {
  const nombres = new Map(ctx.meals.map((m) => [m.id, m.name]));
  const puestos = (platos: { mealId: string }[]): string[] => platos.map((p) => nombres.get(p.mealId) ?? p.mealId);
  const { carnes, diasConDosCarbos } = chequearSemana(semana, ctx.meals, ctx.indice);
  const candidatas = new Map(opciones.flatMap((o) => o.opciones.map(({ meal }) => [meal.id, meal] as const)));
  return {
    estacion: ctx.estacion,
    pais: paisNombre,
    noComo,
    plantas: { van: plantasDeLaSemana(semana, ctx.meals, ctx.indice).plantas.length, meta: META_PLANTAS },
    chequeo: { diasConDosCarbos, roja: carnes.roja, pescado: carnes.pescado, blanca: carnes.blanca },
    semana: semana.map((d) => ({
      dia: d.dayName,
      desayuno: puestos(d.desayuno),
      almuerzo: puestos(d.almuerzo),
      cena: puestos(d.cena),
    })),
    slots: opciones.map((o) => ({
      clave: o.clave,
      candidatos: o.opciones.map(({ meal, puntos }) => ({ id: meal.id, puntaje: puntos })),
    })),
    recetas: [...candidatas.values()].map((m) => resumenParaFlash(m, ctx.indice)),
  };
}

export function promptArmador(c: ContextoFlash): string {
  return [
    'Sos un cocinero que ayuda a armar la semana de comidas de una persona. Te paso el contexto en JSON.',
    'Para cada slot vacío ("slots") elegí una comida, sólo entre los candidatos de ese slot.',
    'Cada candidato trae un puntaje de la app (más alto es mejor): es una ayuda, no la regla.',
    'No repitas comidas en la semana: ni entre slots ni con lo que ya está puesto en "semana".',
    `Estamos en ${c.estacion} en ${c.pais}: tené en cuenta la estación (por ejemplo, nada pesado en verano).`,
    `La meta es ${c.plantas.meta} plantas distintas por semana y van ${c.plantas.van}: preferí comidas`,
    'que sumen plantas que todavía faltan.',
    'Fijate en "chequeo": evitá un segundo carbo en días que ya tienen uno en almuerzo o cena, y no',
    'sumes carne roja de más; las carnes blancas y el pescado suman.',
    'Eso vale también entre tus elecciones: no elijas para el almuerzo y la cena del mismo día dos',
    'recetas con "grupos.feculento" en true (legumbres, papa, pasta, masa, arroz cuentan como carbo).',
    ...(c.noComo.length > 0 ? [`El usuario no come estos ingredientes: ${c.noComo.join(', ')}.`] : []),
    'En "elecciones" respondé exactamente una entrada por cada clave de "slots": la clave, el id elegido',
    'y un motivo corto, de una línea, en español rioplatense.',
    '',
    JSON.stringify(c),
  ].join('\n');
}

// Un arreglo de elecciones, como el esquema de la revisión: un objeto con una
// propiedad opcional por slot era demasiado para Flash y le permitía devolver
// `{}`. El enum de ids es la unión de candidatos; preferidasDe valida por slot.
export function esquemaArmador(opciones: OpcionesSlot[]): ObjectSchema {
  const ids = [...new Set(opciones.flatMap((o) => o.opciones.map(({ meal }) => meal.id)))];
  return Schema.object({
    properties: {
      elecciones: Schema.array({
        items: Schema.object({
          properties: {
            clave: Schema.enumString({ enum: opciones.map((o) => o.clave) }),
            mealId: Schema.enumString({ enum: ids }),
            motivo: Schema.string(),
          },
        }),
      }),
    },
  });
}

// Lo inválido se ignora: ese slot cae a la elección del algoritmo. Con la
// clave repetida vale la primera entrada válida.
export function preferidasDe(raw: unknown, opciones: OpcionesSlot[]): Map<string, Preferida> {
  const preferidas = new Map<string, Preferida>();
  if (!esObjeto(raw) || !Array.isArray(raw['elecciones'])) {
    return preferidas;
  }
  const porClave = new Map(opciones.map((o) => [o.clave, o.opciones]));
  for (const entrada of raw['elecciones'] as unknown[]) {
    if (!esObjeto(entrada) || typeof entrada['clave'] !== 'string' || preferidas.has(entrada['clave'])) {
      continue;
    }
    const ops = porClave.get(entrada['clave']);
    if (ops?.some(({ meal }) => meal.id === entrada['mealId'])) {
      preferidas.set(entrada['clave'], { mealId: entrada['mealId'] as string, motivo: texto(entrada['motivo']) });
    }
  }
  return preferidas;
}
