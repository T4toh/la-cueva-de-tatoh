// El catálogo de ingredientes: uno base que viaja con la app y uno propio por
// usuario encima, como un corrector con su diccionario. Ver
// docs/superpowers/specs/2026-10-08-catalogo-ingredientes-design.md

export type Grupo =
  | 'hortalizas'
  | 'frutas'
  | 'feculentos'
  | 'pan'
  | 'lacteos'
  | 'carnesHuevos'
  | 'aceitesSemillas'
  | 'condimentos';

export type EntradaCatalogo = {
  nombre: string;
  sinonimos?: string[];
  grupo: Grupo;
  // La que sugiere el editor al elegir la entrada.
  unidad: string;
  // Por persona, en `unidad`. Sin valor, el editor no sugiere cantidad.
  porcion?: number;
  // La porción no sale literal de las GAPA (ej. carnes: "la palma de la mano").
  estimada?: boolean;
  // Sólo cuando contradice al grupo: aceite de oliva no, perejil sí.
  planta?: boolean;
  // Dentro de `feculentos`. Legumbre + cereal reemplaza a la carne.
  legumbre?: boolean;
};

export type IndiceCatalogo = ReadonlyMap<string, EntradaCatalogo>;

export type Sugerencia = { nombre: string; grupo?: Grupo };

export const ETIQUETA_GRUPO: Record<Grupo, string> = {
  hortalizas: 'verdura',
  frutas: 'fruta',
  feculentos: 'feculento',
  pan: 'pan',
  lacteos: 'lácteo',
  carnesHuevos: 'carne/huevo',
  aceitesSemillas: 'aceite/semillas',
  condimentos: 'condimento',
};

const PLANTA_POR_GRUPO: Record<Grupo, boolean> = {
  hortalizas: true,
  frutas: true,
  feculentos: true,
  pan: true,
  lacteos: false,
  carnesHuevos: false,
  aceitesSemillas: true,
  condimentos: false,
};

// Minúsculas, sin acentos, sin espacios sobrantes. La misma regla que usa el
// importador para detectar duplicados.
export function normalizar(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function esPlanta(entrada: EntradaCatalogo): boolean {
  return entrada.planta ?? PLANTA_POR_GRUPO[entrada.grupo];
}

// El catálogo efectivo. Una entrada propia con el nombre de una del base la
// saca entera —sinónimos incluidos— y va al final, así sus claves les ganan a
// las del base en `indexar`.
export function combinar(
  base: readonly EntradaCatalogo[],
  propio: readonly EntradaCatalogo[]
): EntradaCatalogo[] {
  const propios = new Set(propio.map((e) => normalizar(e.nombre)));
  return [...base.filter((e) => !propios.has(normalizar(e.nombre))), ...propio];
}

// Nombre y sinónimos normalizados → entrada. Una clave repetida queda con la
// última entrada que la trae.
export function indexar(entradas: readonly EntradaCatalogo[]): IndiceCatalogo {
  const indice = new Map<string, EntradaCatalogo>();
  for (const entrada of entradas) {
    for (const clave of [entrada.nombre, ...(entrada.sinonimos ?? [])]) {
      indice.set(normalizar(clave), entrada);
    }
  }
  return indice;
}

// En castellano el plural de vocal suma -s (tomates) y el de consonante -es
// (limones), y de la palabra sola no se sabe cuál fue: se prueban los dos.
function candidatos(clave: string): string[] {
  const palabras = clave.split(' ');
  const sinS = palabras.map((p) => (p.length > 3 && p.endsWith('s') ? p.slice(0, -1) : p));
  const sinEs = palabras.map((p) => (p.length > 4 && p.endsWith('es') ? p.slice(0, -2) : p));
  return [clave, sinS.join(' '), sinEs.join(' ')];
}

// Sin coincidencias parciales a propósito: "salsa de tomate" no es tomate. Lo
// que tiene que reconocerse va como sinónimo en el catálogo.
export function clasificar(nombre: string, indice: IndiceCatalogo): EntradaCatalogo | null {
  const clave = normalizar(nombre);
  if (!clave) {
    return null;
  }
  for (const candidato of candidatos(clave)) {
    const entrada = indice.get(candidato);
    if (entrada) {
      return entrada;
    }
  }
  return null;
}

// Para el autocompletado del editor: primero el catálogo (por nombre o
// sinónimo), después los nombres propios que el catálogo no reconoce.
export function sugerencias(
  texto: string,
  entradas: readonly EntradaCatalogo[],
  propios: readonly string[],
  max = 8
): Sugerencia[] {
  const q = normalizar(texto);
  if (q.length < 2) {
    return [];
  }
  const delCatalogo = entradas
    .filter((e) => normalizar(e.nombre) !== q)
    .filter((e) => [e.nombre, ...(e.sinonimos ?? [])].some((n) => normalizar(n).includes(q)))
    .map((e) => ({ nombre: e.nombre, grupo: e.grupo }));
  const indice = indexar(entradas);
  const sueltos = propios
    .filter((n) => normalizar(n) !== q && normalizar(n).includes(q))
    .filter((n) => !clasificar(n, indice))
    .map((nombre) => ({ nombre }));
  return [...delCatalogo, ...sueltos].slice(0, max);
}

// Lo que guarda el formulario de "clasificar" del editor. Con una entrada
// existente se queda con su nombre canónico y sus sinónimos, así la propia
// reemplaza a la del base en `combinar`; sin ella, toma el nombre de la fila.
export function entradaPropia(
  nombreFila: string,
  existente: EntradaCatalogo | null,
  valores: { grupo: Grupo; unidad: string; porcion: string }
): EntradaCatalogo {
  const porcion = Number(valores.porcion.trim().replace(',', '.'));
  return {
    nombre: existente?.nombre ?? nombreFila.trim(),
    ...(existente?.sinonimos ? { sinonimos: existente.sinonimos } : {}),
    grupo: valores.grupo,
    unidad: valores.unidad.trim() || 'unidad',
    ...(porcion > 0 ? { porcion } : {}),
  };
}
