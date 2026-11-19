export type Necesidad = 'banco' | 'piso' | 'pared' | 'tramo-trote';
export type Ritmo = 'comodo' | 'rapido' | 'trote';

export type Ejercicio = {
  id: string;
  nombre: string;
  como: string;
  necesita?: Necesidad;
  medida: 'reps' | 'segundos';
};

export type Tramo = { ritmo: Ritmo; segundos: number };

export type Bloque =
  | { tipo: 'caminata'; calentamiento: number; ciclo: Tramo[] }
  | { tipo: 'circuito'; ejercicios: { id: string; dosis: number }[]; vueltas: number; descanso: number }
  | { tipo: 'movilidad'; ejercicios: { id: string; segundos: number }[] };

export type Dia = 'A' | 'B';

export type Plantilla = { id: string; nivel: number; dia: Dia; bloques: Bloque[] };
