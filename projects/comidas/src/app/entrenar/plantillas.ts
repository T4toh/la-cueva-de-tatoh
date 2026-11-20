import { Bloque, Dia, Plantilla, Tramo } from './modelo';

const CALENTAMIENTO_A = 240;
const CALENTAMIENTO_B = 300;

const caminata = (calentamiento: number, ...ciclo: Tramo[]): Bloque => ({ tipo: 'caminata', calentamiento, ciclo });

const circuito = (
  vueltas: number,
  descanso: number,
  ...ejercicios: [id: string, dosis: number][]
): Bloque => ({
  tipo: 'circuito',
  vueltas,
  descanso,
  ejercicios: ejercicios.map(([id, dosis]) => ({ id, dosis })),
});

const movilidad = (...ejercicios: [id: string, segundos: number][]): Bloque => ({
  tipo: 'movilidad',
  ejercicios: ejercicios.map(([id, segundos]) => ({ id, segundos })),
});

const comodo = (segundos: number): Tramo => ({ ritmo: 'comodo', segundos });
const rapido = (segundos: number): Tramo => ({ ritmo: 'rapido', segundos });
const trote = (segundos: number): Tramo => ({ ritmo: 'trote', segundos });

const MOVILIDAD_1 = movilidad(
  ['circulos-hombros', 30],
  ['gato-vaca', 40],
  ['estirada-cuadriceps', 30],
  ['estirada-pantorrillas', 30],
  ['apertura-pecho', 30]
);
const MOVILIDAD_2 = movilidad(
  ['rotacion-columna', 30],
  ['gato-vaca', 40],
  ['estirada-cadera', 40],
  ['estirada-isquios', 40],
  ['estirada-pantorrillas', 30]
);
const MOVILIDAD_3 = movilidad(
  ['circulos-hombros', 30],
  ['rotacion-columna', 35],
  ['estirada-cadera', 45],
  ['estirada-cuadriceps', 35],
  ['estirada-isquios', 40]
);

export const PLANTILLAS: readonly Plantilla[] = [
  {
    id: 'n1a',
    nivel: 1,
    dia: 'A',
    bloques: [
      caminata(CALENTAMIENTO_A, comodo(600)),
      circuito(1, 30, ['sentadilla-banco', 10], ['flexion-pared', 8], ['puente-gluteo', 10]),
    ],
  },
  { id: 'n1b', nivel: 1, dia: 'B', bloques: [caminata(CALENTAMIENTO_B, comodo(900)), MOVILIDAD_1] },
  {
    id: 'n2a',
    nivel: 2,
    dia: 'A',
    bloques: [
      caminata(CALENTAMIENTO_A, comodo(240), rapido(60)),
      circuito(
        2,
        30,
        ['sentadilla-banco', 12],
        ['flexion-pared', 10],
        ['puente-gluteo', 12],
        ['plancha-rodillas', 20]
      ),
    ],
  },
  { id: 'n2b', nivel: 2, dia: 'B', bloques: [caminata(CALENTAMIENTO_B, comodo(180), rapido(90)), MOVILIDAD_2] },
  {
    id: 'n3a',
    nivel: 3,
    dia: 'A',
    bloques: [
      caminata(CALENTAMIENTO_A, comodo(180), rapido(90)),
      circuito(
        2,
        30,
        ['sentadilla-banco', 12],
        ['flexion-banco', 8],
        ['zancada-atras', 8],
        ['puente-gluteo', 12],
        ['plancha-rodillas', 20]
      ),
    ],
  },
  { id: 'n3b', nivel: 3, dia: 'B', bloques: [caminata(CALENTAMIENTO_B, comodo(150), rapido(120)), MOVILIDAD_3] },
  {
    id: 'n4a',
    nivel: 4,
    dia: 'A',
    bloques: [
      caminata(CALENTAMIENTO_A, comodo(150), trote(60)),
      circuito(
        3,
        20,
        ['sentadilla-libre', 12],
        ['flexion-inclinada-baja', 8],
        ['zancada-atras', 8],
        ['plancha-rodillas', 25]
      ),
    ],
  },
  { id: 'n4b', nivel: 4, dia: 'B', bloques: [caminata(CALENTAMIENTO_B, comodo(120), trote(90)), MOVILIDAD_1] },
  {
    id: 'n5a',
    nivel: 5,
    dia: 'A',
    bloques: [
      caminata(CALENTAMIENTO_A, comodo(90), trote(120)),
      circuito(
        3,
        20,
        ['sentadilla-pausa', 10],
        ['flexion-inclinada-baja', 10],
        ['zancada-caminando', 10],
        ['plancha-rodillas', 30]
      ),
    ],
  },
  { id: 'n5b', nivel: 5, dia: 'B', bloques: [caminata(CALENTAMIENTO_B, comodo(90), trote(120)), MOVILIDAD_2] },
  {
    id: 'n6a',
    nivel: 6,
    dia: 'A',
    bloques: [
      caminata(CALENTAMIENTO_A, trote(300), comodo(60)),
      circuito(
        3,
        25,
        ['silla-pared', 30],
        ['rodillas-altas', 30],
        ['puente-una-pierna', 30],
        ['plancha-rodillas', 30]
      ),
    ],
  },
  { id: 'n6b', nivel: 6, dia: 'B', bloques: [caminata(CALENTAMIENTO_B, trote(300), comodo(120)), MOVILIDAD_3] },
];

export function plantillaDe(nivel: number, dia: Dia): Plantilla {
  const p = PLANTILLAS.find((x) => x.nivel === nivel && x.dia === dia);
  if (!p) {
    throw new Error(`No hay plantilla para el nivel ${nivel}, día ${dia}`);
  }
  return p;
}
