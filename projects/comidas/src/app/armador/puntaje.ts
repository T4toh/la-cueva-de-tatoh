import { clasificar, IndiceCatalogo, normalizar } from '../catalogo/catalogo';
import { META_PLANTAS, plantasDe, plantasDeLaSemana } from '../catalogo/plantas';
import { chequearSemana, ChequeoSemana, MAX_CARNE_ROJA, MIN_PESCADO } from '../guia/chequeos';
import { DaySchedule, Meal, PantryItem } from '../models/meal.model';
import { Estacion, fueraDeEstacion } from './estacion';

export type ContextoPuntaje = {
  meals: Meal[];
  indice: IndiceCatalogo;
  despensa: PantryItem[];
  // mealIds de las dos semanas anteriores.
  recientes: ReadonlySet<string>;
  estacion: Estacion;
  // Ids de /guia ocultos: no se chequean, como en el dashboard.
  reglasOcultas: ReadonlySet<string>;
};

export type Puntaje = { puntos: number; motivo: string };

// Pesos enteros. El orden (spec): fuera de estación > rompe chequeo > plantas
// nuevas > despensa > reciente. Los topes hacen que ninguna suma de factores
// chicos pueda con uno grande: plantas suman a lo sumo 30 * 10 = 300 y
// despensa a lo sumo 10 * 3 = 30. Fuera de estación es un anti-objetivo y la
// guía sólo marca: -2500 pierde incluso contra romper carbos Y roja a la vez
// (2 * -1000), con las plantas (+330 como mucho) que traiga de más.
const PESO_PLANTA = 10;
const PESO_DESPENSA = 3;
const TOPE_DESPENSA = 10;
const PESO_PESCADO = 40;
const PESO_RECIENTE = -5;
const PESO_ROMPE_CHEQUEO = -1000;
const PESO_FUERA_DE_ESTACION = -2500;

// Ingredientes de la comida que están en la despensa con cantidad: por el
// catálogo, y si no por nombre normalizado.
function deLaDespensa(meal: Meal, ctx: ContextoPuntaje): string[] {
  const disponibles = ctx.despensa.filter((p) => p.quantity.trim());
  // Por entrada del catálogo (o nombre normalizado): "Brócoli" y "brocoli" cuentan una vez.
  const usados = new Map<string, string>();
  for (const ing of meal.ingredients) {
    const entrada = clasificar(ing.name, ctx.indice);
    const item = disponibles.find((p) => {
      const deItem = clasificar(p.name, ctx.indice);
      return entrada && deItem ? entrada.nombre === deItem.nombre : normalizar(p.name) === normalizar(ing.name);
    });
    if (item) {
      usados.set(entrada?.nombre ?? normalizar(ing.name), item.name.trim().toLowerCase());
    }
  }
  return [...usados.values()];
}

// Lo que sólo depende de la semana de antes: el armador lo calcula una vez por
// slot y no una por candidato.
export type Previo = { plantas: ReadonlySet<string>; chequeo: ChequeoSemana };

export function previoDe(antes: DaySchedule[], ctx: ContextoPuntaje): Previo {
  return {
    plantas: new Set(plantasDeLaSemana(antes, ctx.meals, ctx.indice).plantas),
    chequeo: chequearSemana(antes, ctx.meals, ctx.indice),
  };
}

export function puntuar(
  meal: Meal,
  antes: DaySchedule[],
  semana: DaySchedule[],
  ctx: ContextoPuntaje,
  previo: Previo = previoDe(antes, ctx),
): Puntaje {
  let puntos = 0;
  // A favor, con el texto de cada uno: el de más puntos es el motivo.
  const favor: { puntos: number; texto: string }[] = [];

  const yaHay = previo.plantas;
  const faltan = Math.max(0, META_PLANTAS - yaHay.size);
  const nuevas = Math.min([...plantasDe(meal, ctx.indice)].filter((p) => !yaHay.has(p)).length, faltan);
  if (nuevas > 0) {
    puntos += nuevas * PESO_PLANTA;
    const texto = `suma ${nuevas} ${nuevas === 1 ? 'planta nueva' : 'plantas nuevas'}`;
    favor.push({ puntos: nuevas * PESO_PLANTA, texto });
  }

  const enDespensa = deLaDespensa(meal, ctx).slice(0, TOPE_DESPENSA);
  if (enDespensa.length > 0) {
    const pts = enDespensa.length * PESO_DESPENSA;
    puntos += pts;
    const resto = enDespensa.length - 1;
    favor.push({
      puntos: pts,
      texto: `usa ${enDespensa[0]}${resto > 0 ? ` y ${resto} más` : ''} de la despensa`,
    });
  }

  const antesChequeo = previo.chequeo;
  const conChequeo = chequearSemana(semana, ctx.meals, ctx.indice);
  const rompeCarbos = conChequeo.diasConDosCarbos.length > antesChequeo.diasConDosCarbos.length;
  if (rompeCarbos && !ctx.reglasOcultas.has('un-carbo-por-dia')) {
    puntos += PESO_ROMPE_CHEQUEO;
  }
  if (!ctx.reglasOcultas.has('frecuencia-carnes')) {
    if (conChequeo.carnes.roja > MAX_CARNE_ROJA && conChequeo.carnes.roja > antesChequeo.carnes.roja) {
      puntos += PESO_ROMPE_CHEQUEO;
    }
    if (antesChequeo.carnes.pescado < MIN_PESCADO && conChequeo.carnes.pescado > antesChequeo.carnes.pescado) {
      puntos += PESO_PESCADO;
      favor.push({ puntos: PESO_PESCADO, texto: `pescado: van ${conChequeo.carnes.pescado} de ${MIN_PESCADO}` });
    }
  }

  if (fueraDeEstacion(meal.tags, ctx.estacion)) {
    puntos += PESO_FUERA_DE_ESTACION;
  }
  if (ctx.recientes.has(meal.id)) {
    puntos += PESO_RECIENTE;
  }

  const mejor = favor.sort((a, b) => b.puntos - a.puntos)[0];
  return { puntos, motivo: mejor?.texto ?? 'variedad' };
}
