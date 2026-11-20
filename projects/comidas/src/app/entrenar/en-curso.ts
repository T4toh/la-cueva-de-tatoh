import { Dia, Plantilla } from './modelo';
import { PLANTILLAS } from './plantillas';
import { EstadoReloj } from './reloj';

// La sesión en vivo se guarda acá para sobrevivir a un gesto de atrás, a la
// barra de abajo, a que Android mate la PWA o a un reload.
export const CLAVE_EN_CURSO = 'comidas_entrenar_en_curso';
export const VIGENCIA_EN_CURSO_MS = 6 * 60 * 60 * 1000;

export type EnCurso = {
  minutos: number;
  dia: Dia;
  plantillaId: string;
  dosis: number;
  inicio: number;
  // Paso desde el que arrancó. Falta en las guardadas antes de que se pudiera elegir: 0.
  desde?: number;
  pausasMs: number;
  // Cuándo arrancó la pausa actual; null si no está en pausa.
  pausaDesde: number | null;
  reloj: EstadoReloj;
  fase: 'vivo' | 'fin';
  // Cuándo terminó; solo en fase 'fin'.
  fin: number | null;
};

export function plantillaPorId(id: string): Plantilla | undefined {
  return PLANTILLAS.find((p) => p.id === id);
}

function esNumero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function numeroONull(v: unknown): v is number | null {
  return v === null || esNumero(v);
}

function esReloj(v: unknown): v is EstadoReloj {
  if (typeof v !== 'object' || v === null) {
    return false;
  }
  const r = v as Record<string, unknown>;
  return (
    esNumero(r['indice']) &&
    Number.isInteger(r['indice']) &&
    r['indice'] >= 0 &&
    numeroONull(r['finPaso']) &&
    numeroONull(r['pausadoRestante'])
  );
}

function desdeValido(v: unknown): boolean {
  return v === undefined || (esNumero(v) && Number.isInteger(v) && v >= 0);
}

function valida(v: unknown): EnCurso | null {
  if (typeof v !== 'object' || v === null) {
    return null;
  }
  const e = v as Record<string, unknown>;
  const ok =
    esNumero(e['minutos']) &&
    (e['dia'] === 'A' || e['dia'] === 'B') &&
    typeof e['plantillaId'] === 'string' &&
    plantillaPorId(e['plantillaId'])?.dia === e['dia'] &&
    esNumero(e['dosis']) &&
    esNumero(e['inicio']) &&
    desdeValido(e['desde']) &&
    esNumero(e['pausasMs']) &&
    numeroONull(e['pausaDesde']) &&
    esReloj(e['reloj']) &&
    (e['fase'] === 'vivo' || e['fase'] === 'fin') &&
    numeroONull(e['fin']);
  return ok ? (e as EnCurso) : null;
}

export function guardarEnCurso(e: EnCurso): void {
  try {
    localStorage.setItem(CLAVE_EN_CURSO, JSON.stringify(e));
  } catch {
    // Sin lugar o sin storage: la sesión sigue, solo que no se puede retomar.
  }
}

export function borrarEnCurso(): void {
  try {
    localStorage.removeItem(CLAVE_EN_CURSO);
  } catch {
    // Nada que borrar.
  }
}

// Devuelve la sesión guardada si es de las últimas 6 h; si es vieja o está rota, la tira.
export function leerEnCurso(ahora: number): EnCurso | null {
  let crudo: string | null;
  try {
    crudo = localStorage.getItem(CLAVE_EN_CURSO);
  } catch {
    return null;
  }
  if (crudo === null) {
    return null;
  }
  let e: EnCurso | null;
  try {
    e = valida(JSON.parse(crudo));
  } catch {
    e = null;
  }
  if (!e || ahora - e.inicio > VIGENCIA_EN_CURSO_MS) {
    borrarEnCurso();
    return null;
  }
  return e;
}
