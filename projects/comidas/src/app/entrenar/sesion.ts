import { ejercicio } from './ejercicios';
import { Bloque, Necesidad, Plantilla, Ritmo, Tramo } from './modelo';

export type Paso = {
  tipo: 'caminata' | 'ejercicio' | 'descanso' | 'movilidad';
  titulo: string;
  detalle?: string;
  ojo?: string;
  // Nombre del dibujo en public/figuras.
  figura: string;
  // Índice del bloque de la plantilla del que sale el paso.
  bloque: number;
  medida: 'segundos' | 'reps';
  cantidad: number;
  vuelta?: { n: number; de: number };
};

type PasoSuelto = Omit<Paso, 'bloque'>;

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

const FIGURA_RITMO: Record<Ritmo, string> = {
  comodo: 'caminar',
  rapido: 'caminar-rapido',
  trote: 'trotar',
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

function segundosDe(p: Pick<Paso, 'medida' | 'cantidad'>): number {
  return p.medida === 'reps' ? p.cantidad * SEG_POR_REP : p.cantidad;
}

function pasosCircuito(b: Circuito, dosis: number): PasoSuelto[] {
  const pasos: PasoSuelto[] = [];
  for (let n = 1; n <= b.vueltas; n++) {
    for (const e of b.ejercicios) {
      const ej = ejercicio(e.id);
      pasos.push({
        tipo: 'ejercicio',
        titulo: ej.nombre,
        detalle: ej.como,
        ojo: ej.ojo,
        figura: ej.id,
        medida: ej.medida,
        cantidad: escalar(e.dosis, dosis),
        vuelta: { n, de: b.vueltas },
      });
      const descanso = b.descanso;
      pasos.push({ tipo: 'descanso', titulo: 'Descanso', figura: 'descanso', medida: 'segundos', cantidad: descanso });
    }
  }
  return pasos;
}

function pasosMovilidad(b: Movilidad, topes: { corta: boolean; cuantos: number }): PasoSuelto[] {
  return b.ejercicios.slice(0, topes.cuantos).map((e) => {
    const ej = ejercicio(e.id);
    return {
      tipo: 'movilidad',
      titulo: ej.nombre,
      detalle: ej.como,
      ojo: ej.ojo,
      figura: ej.id,
      medida: 'segundos',
      cantidad: topes.corta ? Math.min(e.segundos, MOVILIDAD_CORTA) : e.segundos,
    };
  });
}

function pasoCaminata(ritmo: Ritmo, segundos: number): PasoSuelto {
  return {
    tipo: 'caminata',
    titulo: TITULO_RITMO[ritmo],
    figura: FIGURA_RITMO[ritmo],
    medida: 'segundos',
    cantidad: segundos,
  };
}

function pasosCaminata(b: Caminata, dosis: number, segundos: number): PasoSuelto[] {
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
  p.bloques.forEach((b, bloque) => {
    const sueltos =
      b.tipo === 'caminata'
        ? pasosCaminata(b, dosis, segCaminata)
        : b.tipo === 'circuito'
          ? circuito[circuitoIdx++]
          : pasosMovilidad(b, topes);
    pasos.push(...sueltos.map((x) => ({ ...x, bloque })));
  });

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

export function segundosDesde(s: Sesion, indice: number): number {
  return s.pasos.slice(indice).reduce((t, x) => t + segundosDe(x), 0);
}

export function textoCantidad(p: Pick<Paso, 'medida' | 'cantidad'>): string {
  if (p.medida === 'reps') {
    return `${p.cantidad} reps`;
  }
  const s = p.cantidad;
  if (s < 60) {
    return `${s} s`;
  }
  // En tramos largos los segundos sueltos no dicen nada: "38 min", no "38:06 min".
  const resto = s % 60;
  if (resto === 0 || s >= 300) {
    return `${Math.round(s / 60)} min`;
  }
  return `${Math.floor(s / 60)}:${String(resto).padStart(2, '0')} min`;
}

export type ItemPrevia = Pick<Paso, 'figura' | 'titulo' | 'detalle' | 'ojo'> & { cantidad: string; veces: number };
export type BloquePrevia = { titulo: string; inicio: number; segundos: number; items: ItemPrevia[]; nota?: string };

function tituloBloque(p: Paso): string {
  if (p.tipo === 'caminata') {
    return 'Caminata';
  }
  if (p.tipo === 'movilidad') {
    return 'Movilidad';
  }
  const vueltas = p.vuelta?.de ?? 1;
  return vueltas === 1 ? 'Circuito de 1 vuelta' : `Circuito de ${vueltas} vueltas`;
}

// La sesión vista de antemano: un grupo por bloque, con lo que se repite (vueltas,
// intervalos) contado una vez y los descansos como nota.
export function resumenPrevia(s: Sesion): BloquePrevia[] {
  const bloques: BloquePrevia[] = [];
  s.pasos.forEach((p, i) => {
    let b = bloques[bloques.length - 1];
    if (!b || s.pasos[b.inicio].bloque !== p.bloque) {
      b = { titulo: tituloBloque(p), inicio: i, segundos: 0, items: [] };
      bloques.push(b);
    }
    b.segundos += segundosDe(p);
    if (p.tipo === 'descanso') {
      b.nota = `${textoCantidad(p)} de descanso entre ejercicios`;
      return;
    }
    const cantidad = textoCantidad(p);
    const igual = b.items.find((x) => x.titulo === p.titulo && x.cantidad === cantidad);
    if (igual) {
      igual.veces++;
    } else {
      b.items.push({ figura: p.figura, titulo: p.titulo, detalle: p.detalle, ojo: p.ojo, cantidad, veces: 1 });
    }
  });
  return bloques;
}
