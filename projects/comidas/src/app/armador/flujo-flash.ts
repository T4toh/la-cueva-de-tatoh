// "Completar con Flash", paso por paso: elecciones de Flash, completar, y
// recetas nuevas para lo que quedó sin candidatos. El servicio sólo lo cablea.
import { mensajeDeError } from '../revision/pedido';
import { PedirJson } from '../services/flash';
import {
  claveSlot,
  EntradaArmador,
  opcionesPorSlot,
  OpcionesSlot,
  Preferida,
  Rechazo,
  ResultadoArmador,
  Slot,
  slotsVacios,
} from './armador';
import { contextoFlash, esquemaArmador, preferidasDe, promptArmador } from './pedido-flash';
import {
  esquemaRecetasNuevas,
  MAX_RECETAS_NUEVAS,
  PedidoRecetas,
  promptRecetasNuevas,
  RecetaNueva,
  validarRecetasNuevas,
} from './recetas-nuevas';

// Para revisar en desarrollo qué eligió Flash y qué quedó, slot por slot.
export type FilaDiagnostico = { clave: string; eligioFlash: string; puesto: string; resultado: string };
export type Diagnostico = { crudo: unknown; filas: FilaDiagnostico[] };

export type ResultadoFlash = {
  puestos: number;
  sinCandidatos: number;
  deFlash: number;
  nuevas: RecetaNueva[];
  error: string | null;
  cambioSemana: boolean;
  // Sólo si Flash respondió las elecciones.
  diagnostico?: Diagnostico;
};

export const ERROR_ARMADOR = 'No se pudo completar con Flash. Probá de nuevo.';

export const sinResultado = (): ResultadoFlash => ({
  puestos: 0, sinCandidatos: 0, deFlash: 0, nuevas: [], error: null, cambioSemana: false,
});

export type DepsFlash = {
  entrada: () => EntradaArmador;
  completar: (
    azar?: () => number,
    preferidas?: ReadonlyMap<string, Preferida>,
    semanaEsperada?: string,
  ) => Omit<ResultadoArmador, 'semana'> | null;
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

const RESULTADO: Record<Rechazo['razon'], string> = {
  'no-posible': 'no posible (repetida o ya usada)',
  margen: 'margen (chequeo o estación)',
};

function filasDiagnostico(
  enviadas: OpcionesSlot[],
  preferidas: ReadonlyMap<string, Preferida>,
  rechazos: Rechazo[],
  despues: EntradaArmador,
): FilaDiagnostico[] {
  const nombre = (id: string | undefined): string =>
    id ? `${id} · ${despues.ctx.meals.find((m) => m.id === id)?.name ?? '?'}` : '—';
  return enviadas.map(({ slot, clave }) => {
    const pref = preferidas.get(clave);
    const rechazo = rechazos.find((r) => r.clave === clave);
    return {
      clave,
      eligioFlash: nombre(pref?.mealId),
      puesto: nombre(despues.semana[slot.dia][slot.tipo][0]?.mealId),
      resultado: !pref ? 'sin respuesta' : rechazo ? RESULTADO[rechazo.razon] : 'aceptada',
    };
  });
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
  let crudo: unknown;
  if (conOpciones.length > 0) {
    try {
      crudo = await d.pedir(
        esquemaArmador(conOpciones),
        promptArmador(contextoFlash(e.semana, conOpciones, e.ctx, d.paisNombre, d.noComo)),
      );
      preferidas = preferidasDe(crudo, conOpciones);
    } catch (err) {
      error = mensajeDeError(err, ERROR_ARMADOR);
    }
  }
  const completado = d.completar(Math.random, preferidas, e.key);
  if (!completado) {
    return { ...sinResultado(), cambioSemana: true };
  }
  const { rechazos = [], ...r } = completado;
  const despues = d.entrada();
  const diagnostico: Partial<ResultadoFlash> = crudo === undefined
    ? {}
    : { diagnostico: { crudo, filas: filasDiagnostico(conOpciones, preferidas, rechazos, despues) } };
  // Si Flash ya falló no se gasta un segundo pedido.
  if (r.sinCandidatos === 0 || error !== null) {
    return { ...r, nuevas: [], error, cambioSemana: false, ...diagnostico };
  }
  try {
    return { ...r, nuevas: await recetasParaHuecos(despues, d), error: null, cambioSemana: false, ...diagnostico };
  } catch (err) {
    return { ...r, nuevas: [], error: mensajeDeError(err, ERROR_ARMADOR), cambioSemana: false, ...diagnostico };
  }
}
