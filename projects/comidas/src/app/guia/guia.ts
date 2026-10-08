// Las reglas de la pestaña Guía. Ver docs/superpowers/specs/2026-10-08-guia-design.md
// Generales a propósito: lo inferido de un plan dice "de planes de
// nutricionista", nunca de quién.

export type FuenteRegla = 'nutricionista' | 'gapa' | 'libro' | 'sugerida' | 'propia';

export type Regla = {
  // Estable: es lo que se guarda al ocultarla.
  id: string;
  texto: string;
  detalle?: string;
  fuente: FuenteRegla;
};

export type GuiaPropia = { propias: Regla[]; ocultas: string[] };

export type GrupoGuia = { fuente: FuenteRegla; etiqueta: string; reglas: Regla[] };

export type GuiaArmada = { grupos: GrupoGuia[]; ocultas: Regla[] };

export const GUIA_VACIA: GuiaPropia = { propias: [], ocultas: [] };

export const ETIQUETA_FUENTE: Record<FuenteRegla, string> = {
  propia: 'Tuyas',
  nutricionista: 'De planes de nutricionista',
  gapa: 'GAPA',
  libro: 'Plant Powered Plus',
  sugerida: 'Sugeridas',
};

export const REGLAS: readonly Regla[] = [
  {
    id: 'un-carbo-por-dia',
    texto: 'Un solo plato con carbohidratos por día, mejor a la noche.',
    detalle: 'Al mediodía, proteína y verdura. Así son 20 de los 21 días de los planes.',
    fuente: 'nutricionista',
  },
  { id: 'caldo-antes', texto: 'Caldo o agua antes del almuerzo y la cena.', fuente: 'nutricionista' },
  { id: 'aceite-medido', texto: 'Aceite medido: una cucharada por comida.', fuente: 'nutricionista' },
  { id: 'fruta-postre', texto: 'Fruta de postre en almuerzo y cena.', fuente: 'nutricionista' },
  {
    id: 'comida-libre',
    texto: 'Una comida libre por semana.',
    detalle: 'El "extra" de los planes.',
    fuente: 'nutricionista',
  },
  {
    id: 'colacion',
    texto: 'Colación: una fruta, un yogur o un puñado de frutos secos.',
    fuente: 'nutricionista',
  },
  { id: 'medio-plato-verdura', texto: 'Medio plato de verdura en almuerzo y cena.', fuente: 'gapa' },
  {
    id: 'frecuencia-carnes',
    texto: 'Pescado 2 o más veces por semana, carne blanca 2, carne roja hasta 3.',
    fuente: 'gapa',
  },
  { id: 'legumbre-cereal', texto: 'Legumbre más cereal reemplaza a la carne.', fuente: 'gapa' },
  { id: 'porcion-carne', texto: 'La porción de carne es la palma de la mano.', fuente: 'gapa' },
  {
    id: 'treinta-plantas',
    texto: 'Variedad: 30 plantas distintas por semana.',
    detalle: 'El contador está en el plan semanal.',
    fuente: 'libro',
  },
  { id: 'fibra-de-a-poco', texto: 'La fibra se sube de a poco.', fuente: 'libro' },
  { id: 'anotar', texto: 'Anotar lo que se come.', fuente: 'sugerida' },
  { id: 'dia-vegetariano', texto: 'Un día vegetariano o vegano por semana.', fuente: 'sugerida' },
  { id: 'ayuno', texto: 'Ayuno: sólo con indicación profesional.', fuente: 'sugerida' },
];

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// Lo que llega de Firestore o de un backup no está tipado: una forma rara no
// puede romper la pantalla. Una propia sin id o sin texto se descarta, y la
// fuente se fuerza: con otra, caería en un grupo base y no se podría borrar.
export function normalizarGuia(v: unknown): GuiaPropia {
  const g = esObjeto(v) ? v : {};
  const propias = (Array.isArray(g['propias']) ? g['propias'] : [])
    .filter(esObjeto)
    .filter((r) => typeof r['id'] === 'string' && typeof r['texto'] === 'string' && !!r['texto'].trim())
    .map((r) => ({
      id: r['id'] as string,
      texto: r['texto'] as string,
      fuente: 'propia' as const,
      ...(typeof r['detalle'] === 'string' && r['detalle'] ? { detalle: r['detalle'] } : {}),
    }));
  return {
    propias,
    ocultas: Array.isArray(g['ocultas']) ? g['ocultas'].filter((o): o is string => typeof o === 'string') : [],
  };
}

// Propias primero; después las base agrupadas por fuente en el orden en que
// aparecen. Las ocultas van aparte y un grupo vacío no se muestra.
export function armarGuia(base: readonly Regla[], guia: GuiaPropia): GuiaArmada {
  const ocultas = new Set(guia.ocultas);
  const grupos: GrupoGuia[] = [];
  const agregar = (regla: Regla): void => {
    let grupo = grupos.find((g) => g.fuente === regla.fuente);
    if (!grupo) {
      grupo = { fuente: regla.fuente, etiqueta: ETIQUETA_FUENTE[regla.fuente], reglas: [] };
      grupos.push(grupo);
    }
    grupo.reglas.push(regla);
  };
  guia.propias.forEach(agregar);
  base.filter((r) => !ocultas.has(r.id)).forEach(agregar);
  return { grupos, ocultas: base.filter((r) => ocultas.has(r.id)) };
}
