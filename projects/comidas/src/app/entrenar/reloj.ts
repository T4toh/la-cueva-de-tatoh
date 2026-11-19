import { Paso } from './sesion';

export type EstadoReloj = { indice: number; finPaso: number | null; pausadoRestante: number | null };

// Fin de un paso que arranca en `desde`: los de reps no vencen solos.
export function finDe(paso: Paso | undefined, desde: number): number | null {
  return paso?.medida === 'segundos' ? desde + paso.cantidad * 1000 : null;
}

// Avanza los pasos por tiempo que vencieron entre finPaso y ahora; un paso de reps frena el avance.
// `indice === pasos.length` quiere decir que se terminó el último paso.
export function alcanzar(pasos: Paso[], r: EstadoReloj, ahora: number): EstadoReloj {
  if (r.pausadoRestante !== null) {
    return r;
  }
  let { indice, finPaso } = r;
  while (finPaso !== null && ahora >= finPaso && indice < pasos.length) {
    indice++;
    finPaso = finDe(pasos[indice], finPaso);
  }
  return { indice, finPaso, pausadoRestante: null };
}

export function restante(r: EstadoReloj, ahora: number): number {
  if (r.pausadoRestante !== null) {
    return Math.max(0, r.pausadoRestante);
  }
  return r.finPaso === null ? 0 : Math.max(0, r.finPaso - ahora);
}
