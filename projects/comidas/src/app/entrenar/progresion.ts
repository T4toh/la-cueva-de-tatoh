import { Dia } from './modelo';

export type Respuesta = 'facil' | 'bien' | 'mato';

export type RegistroSesion = {
  fecha: string;
  plantilla: string;
  minutos: number;
  completa: boolean;
  respuesta: Respuesta;
};

export type EstadoEntrenar = {
  nivel: number;
  dosis: number;
  ultimoDia: Dia | null;
  historial: RegistroSesion[]; // más nuevo al final
  propuestaVista: string | null; // fecha del último registro cuando se dijo "ahora no"
};

export const ENTRENAR_INICIAL: EstadoEntrenar = {
  nivel: 1,
  dosis: 0,
  ultimoDia: null,
  historial: [],
  propuestaVista: null,
};
export const MAX_HISTORIAL = 120;

const NIVEL_MIN = 1;
const NIVEL_MAX = 6;
const DOSIS_TOPE = 2;
const RESPUESTAS: readonly string[] = ['facil', 'bien', 'mato'];
const PASO_DOSIS: Record<Respuesta, number> = { facil: 1, bien: 0, mato: -1 };

const entre = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function esRegistro(r: Record<string, unknown>): boolean {
  return (
    typeof r['fecha'] === 'string' &&
    typeof r['plantilla'] === 'string' &&
    typeof r['minutos'] === 'number' &&
    Number.isFinite(r['minutos']) &&
    r['minutos'] >= 0 &&
    typeof r['completa'] === 'boolean' &&
    typeof r['respuesta'] === 'string' &&
    RESPUESTAS.includes(r['respuesta'])
  );
}

// Lo que llega de Firestore o de un backup no está tipado: una forma rara no
// puede romper la pantalla. Número raro: se redondea y se ajusta al rango.
export function normalizarEntrenar(v: unknown): EstadoEntrenar {
  const e = esObjeto(v) ? v : {};
  const numero = (x: unknown, def: number, min: number, max: number): number =>
    typeof x === 'number' && Number.isFinite(x) ? entre(Math.round(x), min, max) : def;
  const historial = (Array.isArray(e['historial']) ? e['historial'] : [])
    .filter(esObjeto)
    .filter(esRegistro)
    .map((r) => ({
      fecha: r['fecha'] as string,
      plantilla: r['plantilla'] as string,
      minutos: r['minutos'] as number,
      completa: r['completa'] as boolean,
      respuesta: r['respuesta'] as Respuesta,
    }))
    .slice(-MAX_HISTORIAL);
  return {
    nivel: numero(e['nivel'], 1, NIVEL_MIN, NIVEL_MAX),
    dosis: numero(e['dosis'], 0, -DOSIS_TOPE, DOSIS_TOPE),
    ultimoDia: e['ultimoDia'] === 'A' || e['ultimoDia'] === 'B' ? e['ultimoDia'] : null,
    historial,
    propuestaVista: typeof e['propuestaVista'] === 'string' ? e['propuestaVista'] : null,
  };
}

// Completa: al menos la mitad de los minutos planeados.
export function esCompleta(minutosReales: number, minutosPlaneados: number): boolean {
  return minutosReales * 2 >= minutosPlaneados;
}

export function proximoDia(e: EstadoEntrenar): Dia {
  return e.ultimoDia === 'A' ? 'B' : 'A';
}

// Una incompleta cuenta para alternar A/B pero no mueve la dosis.
export function registrar(e: EstadoEntrenar, r: RegistroSesion, dia: Dia): EstadoEntrenar {
  return {
    ...e,
    historial: [...e.historial, r].slice(-MAX_HISTORIAL),
    ultimoDia: dia,
    dosis: r.completa ? entre(e.dosis + PASO_DOSIS[r.respuesta], -DOSIS_TOPE, DOSIS_TOPE) : e.dosis,
  };
}

export function propuestaNivel(e: EstadoEntrenar): 'subir' | 'bajar' | null {
  const completas = e.historial.filter((r) => r.completa);
  if (completas.length < 2) {
    return null;
  }
  if (e.propuestaVista !== null && e.historial[e.historial.length - 1].fecha === e.propuestaVista) {
    return null;
  }
  const ultimas = completas.slice(-2).map((r) => r.respuesta);
  if (e.nivel < NIVEL_MAX && e.dosis === DOSIS_TOPE && ultimas.every((x) => x === 'facil')) {
    return 'subir';
  }
  if (e.nivel > NIVEL_MIN && e.dosis === -DOSIS_TOPE && ultimas.every((x) => x === 'mato')) {
    return 'bajar';
  }
  return null;
}

export function cambiarNivel(e: EstadoEntrenar, nivel: number): EstadoEntrenar {
  return { ...e, nivel: entre(Math.round(nivel), NIVEL_MIN, NIVEL_MAX), dosis: 0 };
}

export function descartarPropuesta(e: EstadoEntrenar): EstadoEntrenar {
  const ultimo = e.historial[e.historial.length - 1];
  return { ...e, propuestaVista: ultimo ? ultimo.fecha : null };
}
