// "Completar con Flash", paso por paso: elecciones de Flash, completar, y
// recetas nuevas para lo que quedó sin candidatos. El servicio sólo lo cablea.
import { mensajeDeError } from '../revision/pedido';
import { PedirJson } from '../services/flash';
import { claveSlot, EntradaArmador, opcionesPorSlot, Preferida, Slot, slotsVacios } from './armador';
import { contextoFlash, esquemaArmador, preferidasDe, promptArmador } from './pedido-flash';
import {
  esquemaRecetasNuevas,
  MAX_RECETAS_NUEVAS,
  PedidoRecetas,
  promptRecetasNuevas,
  RecetaNueva,
  validarRecetasNuevas,
} from './recetas-nuevas';

export type ResultadoFlash = {
  puestos: number;
  sinCandidatos: number;
  deFlash: number;
  nuevas: RecetaNueva[];
  error: string | null;
  cambioSemana: boolean;
};

export const sinResultado = (): ResultadoFlash => ({
  puestos: 0, sinCandidatos: 0, deFlash: 0, nuevas: [], error: null, cambioSemana: false,
});

export type DepsFlash = {
  entrada: () => EntradaArmador;
  completar: (
    azar?: () => number,
    preferidas?: ReadonlyMap<string, Preferida>,
    semanaEsperada?: string,
  ) => { puestos: number; sinCandidatos: number; deFlash: number } | null;
  pedir: PedirJson;
  paisNombre: string;
  noComo: string[];
  nombresExistentes: string[];
};

// Una receta por slot que siguió vacío, hasta MAX_RECETAS_NUEVAS.
async function recetasParaHuecos(e: EntradaArmador, d: DepsFlash): Promise<RecetaNueva[]> {
  const slots = slotsVacios(e.semana, e.desde, e.tipos).slice(0, MAX_RECETAS_NUEVAS);
  const huecos = new Map<string, Slot>(slots.map((s) => [claveSlot(e.semana, s), s]));
  const p: PedidoRecetas = { modo: 'huecos', huecos: [...huecos].map(([clave, s]) => ({ clave, tipo: s.tipo })) };
  const raw = await d.pedir(
    esquemaRecetasNuevas(p),
    promptRecetasNuevas(p, e.ctx.estacion, d.paisNombre, d.noComo, d.nombresExistentes),
  );
  return validarRecetasNuevas(raw, p, huecos, d.noComo, e.ctx.indice, d.nombresExistentes);
}

export async function completarConFlash(d: DepsFlash): Promise<ResultadoFlash> {
  const e = d.entrada();
  const opciones = opcionesPorSlot(e.semana, e.desde, e.tipos, e.candidatos, e.ctx);
  if (opciones.length === 0) {
    return sinResultado();
  }
  // Un slot sin candidatos dejaría un enum vacío en el esquema: no se le pregunta.
  const conOpciones = opciones.filter((o) => o.opciones.length > 0);
  let preferidas = new Map<string, Preferida>();
  let error: string | null = null;
  if (conOpciones.length > 0) {
    try {
      const raw = await d.pedir(
        esquemaArmador(conOpciones),
        promptArmador(contextoFlash(e.semana, conOpciones, e.ctx, d.paisNombre, d.noComo)),
      );
      preferidas = preferidasDe(raw, conOpciones);
    } catch (err) {
      error = mensajeDeError(err);
    }
  }
  const r = d.completar(Math.random, preferidas, e.key);
  if (!r) {
    return { ...sinResultado(), cambioSemana: true };
  }
  // Si Flash ya falló no se gasta un segundo pedido.
  if (r.sinCandidatos === 0 || error !== null) {
    return { ...r, nuevas: [], error, cambioSemana: false };
  }
  try {
    return { ...r, nuevas: await recetasParaHuecos(d.entrada(), d), error: null, cambioSemana: false };
  } catch (err) {
    return { ...r, nuevas: [], error: mensajeDeError(err), cambioSemana: false };
  }
}
