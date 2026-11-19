import { ejercicio } from './ejercicios';
import { Bloque, Necesidad, Plantilla, Ritmo, Tramo } from './modelo';

export type Paso = {
  tipo: 'caminata' | 'ejercicio' | 'descanso' | 'movilidad';
  titulo: string;
  detalle?: string;
  medida: 'segundos' | 'reps';
  cantidad: number;
  vuelta?: { n: number; de: number };
};

export type Sesion = { plantillaId: string; pasos: Paso[]; segundosEstimados: number; necesita: Necesidad[] };

export const MIN_MINUTOS = 20;
export const MAX_MINUTOS = 60;
export const PISO_CAMINATA = 600;
export const SEG_POR_REP = 3;

const PASO_DOSIS = 0.15;
const MOVILIDAD_CORTA = 20;
const RESTO_MINIMO = 60;

const TITULO_RITMO: Record<Ritmo, string> = {
  comodo: 'Caminá cómodo',
  rapido: 'Caminá rápido',
  trote: 'Trotá',
};

type Circuito = Extract<Bloque, { tipo: 'circuito' }>;
type Movilidad = Extract<Bloque, { tipo: 'movilidad' }>;
type Caminata = Extract<Bloque, { tipo: 'caminata' }>;

export function minutosValidos(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) {
    return MAX_MINUTOS;
  }
  return Math.min(MAX_MINUTOS, Math.max(MIN_MINUTOS, Math.round(n)));
}

function escalar(base: number, dosis: number): number {
  const paso = Math.max(1, Math.round(base * PASO_DOSIS));
  return Math.max(1, base + dosis * paso);
}

function segundosDe(p: Paso): number {
  return p.medida === 'reps' ? p.cantidad * SEG_POR_REP : p.cantidad;
}

function pasosCircuito(b: Circuito, dosis: number): Paso[] {
  const pasos: Paso[] = [];
  for (let n = 1; n <= b.vueltas; n++) {
    for (const e of b.ejercicios) {
      const ej = ejercicio(e.id);
      pasos.push({
        tipo: 'ejercicio',
        titulo: ej.nombre,
        detalle: ej.como,
        medida: ej.medida,
        cantidad: escalar(e.dosis, dosis),
        vuelta: { n, de: b.vueltas },
      });
      pasos.push({ tipo: 'descanso', titulo: 'Descanso', medida: 'segundos', cantidad: b.descanso });
    }
  }
  return pasos;
}

function pasosMovilidad(b: Movilidad, topes: { corta: boolean; cuantos: number }): Paso[] {
  return b.ejercicios.slice(0, topes.cuantos).map((e) => {
    const ej = ejercicio(e.id);
    return {
      tipo: 'movilidad',
      titulo: ej.nombre,
      detalle: ej.como,
      medida: 'segundos',
      cantidad: topes.corta ? Math.min(e.segundos, MOVILIDAD_CORTA) : e.segundos,
    };
  });
}

function pasoCaminata(ritmo: Ritmo, segundos: number): Paso {
  return { tipo: 'caminata', titulo: TITULO_RITMO[ritmo], medida: 'segundos', cantidad: segundos };
}

function pasosCaminata(b: Caminata, dosis: number, segundos: number): Paso[] {
  const ciclo: Tramo[] = b.ciclo.map((t) => ({
    ritmo: t.ritmo,
    segundos: t.ritmo === 'comodo' ? t.segundos : escalar(t.segundos, dosis),
  }));
  const tramos: Tramo[] = [];
  let falta = segundos;
  let resto = 0;
  while (falta > 0) {
    for (const t of ciclo) {
      if (falta <= 0) {
        break;
      }
      const dura = Math.min(t.segundos, falta);
      falta -= dura;
      if (dura < t.segundos && dura < RESTO_MINIMO) {
        resto = dura;
      } else {
        const ultimo = tramos[tramos.length - 1];
        if (ultimo?.ritmo === t.ritmo) {
          ultimo.segundos += dura;
        } else {
          tramos.push({ ritmo: t.ritmo, segundos: dura });
        }
      }
    }
  }
  if (resto > 0) {
    const ultimoComodo = [...tramos].reverse().find((t) => t.ritmo === 'comodo');
    if (ultimoComodo) {
      ultimoComodo.segundos += resto;
    } else {
      tramos.push({ ritmo: 'comodo', segundos: resto });
    }
  }
  return [pasoCaminata('comodo', b.calentamiento), ...tramos.map((t) => pasoCaminata(t.ritmo, t.segundos))];
}

export function armarSesion(p: Plantilla, dosis: number, minutos: number): Sesion {
  const presupuesto = minutosValidos(minutos) * 60;
  const caminata = p.bloques.find((b): b is Caminata => b.tipo === 'caminata');
  if (!caminata) {
    throw new Error(`La plantilla ${p.id} no tiene caminata`);
  }
  const movilidad = p.bloques.find((b): b is Movilidad => b.tipo === 'movilidad');

  const circuito = p.bloques
    .filter((b): b is Circuito => b.tipo === 'circuito')
    .map((b) => pasosCircuito(b, dosis));
  const segCircuito = circuito.flat().reduce((t, x) => t + segundosDe(x), 0);

  // La movilidad se acorta de a poco hasta que la caminata llegue al piso.
  const topes = { corta: false, cuantos: movilidad?.ejercicios.length ?? 0 };
  const segMovilidad = (): number =>
    movilidad ? pasosMovilidad(movilidad, topes).reduce((t, x) => t + x.cantidad, 0) : 0;
  const sobra = (): number => presupuesto - segCircuito - segMovilidad() - caminata.calentamiento;
  if (sobra() < PISO_CAMINATA) {
    topes.corta = true;
  }
  while (sobra() < PISO_CAMINATA && topes.cuantos > 0) {
    topes.cuantos--;
  }
  const segCaminata = Math.max(PISO_CAMINATA, sobra());

  const pasos: Paso[] = [];
  let circuitoIdx = 0;
  for (const b of p.bloques) {
    if (b.tipo === 'caminata') {
      pasos.push(...pasosCaminata(b, dosis, segCaminata));
    } else if (b.tipo === 'circuito') {
      pasos.push(...circuito[circuitoIdx++]);
    } else {
      pasos.push(...pasosMovilidad(b, topes));
    }
  }

  const necesita: Necesidad[] = [];
  const agregar = (n: Necesidad | undefined): void => {
    if (n && !necesita.includes(n)) {
      necesita.push(n);
    }
  };
  for (const b of p.bloques) {
    if (b.tipo !== 'caminata') {
      b.ejercicios.forEach((e) => agregar(ejercicio(e.id).necesita));
    }
  }
  if (pasos.some((x) => x.tipo === 'caminata' && x.titulo === TITULO_RITMO.trote)) {
    agregar('tramo-trote');
  }

  return {
    plantillaId: p.id,
    pasos,
    segundosEstimados: pasos.reduce((t, x) => t + segundosDe(x), 0),
    necesita,
  };
}
