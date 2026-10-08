# Catálogo de ingredientes, porciones y plantas por semana — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un catálogo de ingredientes (base en el código + propio por usuario) que normaliza ingredientes y tags en el editor de comidas, sugiere la porción por persona según las GAPA, resume el plato y cuenta las plantas distintas de la semana en el dashboard.

**Architecture:** Lógica pura en `projects/comidas/src/app/catalogo/` (clasificar, plato, plantas), testeada sin TestBed. Los datos base son un array constante. `MealService` suma una clave persistida más, `catalogoPropio`, por el mismo camino que `alias` o `pantryGroups` (localStorage + `ColaDeGuardado` + Firestore + backup). El editor y el dashboard sólo consumen funciones puras y signals.

**Tech Stack:** Angular 22 (standalone, signals, reactive forms), Vitest vía `ng test`, Firebase/Firestore (`@angular/fire`), pnpm.

**Spec:** `docs/superpowers/specs/2026-10-08-catalogo-ingredientes-design.md`

## Global Constraints

- `Meal` e `Ingredient` no cambian. No hay migración.
- Clave nueva en `users/{uid}`: `catalogoPropio: EntradaCatalogo[]`; localStorage `comidas_catalogo_propio`. Sin reglas de Firestore nuevas.
- Una entrada propia con el mismo nombre normalizado que una del base la reemplaza.
- Búsqueda: normalizar (minúsculas, sin acentos, sin espacios sobrantes) → nombre/sinónimo → sin plural → `null`. **Sin coincidencias parciales.**
- Planta por grupo: `hortalizas`, `frutas`, `feculentos`, `pan`, `aceitesSemillas` sí; `carnesHuevos`, `lacteos`, `condimentos` no; `planta` en la entrada sólo para excepciones.
- El editor nunca pisa cantidad o unidad ya escritas.
- Aviso de exceso: misma unidad y cantidad > **1,5×** la porción. No bloquea.
- Resumen del plato: chips de presencia; sólo se resalta la **falta de verdura**.
- Meta de plantas: **30** por semana, constante.
- ESLint estricto (`eslint.config.js`): return types explícitos, sin `public`, `type` y no `interface`, `@if`/`@for`, orden alfabético de atributos por grupo, `max-len 120`.
- Commits sin línea de co-autor (regla de la organización).
- Correr tests con `pnpm ng test comidas --include='<glob>' --watch=false` (no `pnpm test -- --include`: falla la validación de schema).

## Review Focus

- Nombres con acentos, mayúsculas o espacios de más ("  Brócoli ", "ZANAHORIA") → se clasifican igual. Test en Task 1.
- Unidad escrita "gr", "grs", "gramos", "unidades" contra la del catálogo ("g", "unidad") → compara igual. Test en Task 4.
- Cantidad no numérica ("a gusto", vacía) o fraccionaria ("1/2") → sin aviso falso; la fracción se compara por su valor. Test en Task 4.
- Entrada propia que corrige una del base: los sinónimos del base dejan de apuntar a la vieja, y un sinónimo propio que choca con otra entrada del base gana. Test en Task 1.
- Plato del día que apunta a una comida borrada, plato `excluded`, o ingrediente con nombre vacío → se ignoran en el conteo semanal sin romper. Test en Task 7.

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| Create `projects/comidas/src/app/catalogo/catalogo.ts` | Tipos, `normalizar`, `combinar`, `indexar`, `clasificar`, `esPlanta`, `sugerencias`, `ETIQUETA_GRUPO` |
| Create `projects/comidas/src/app/catalogo/catalogo-datos.ts` | `CATALOGO` y `TAGS_BASE` (sólo datos) |
| Create `projects/comidas/src/app/catalogo/plato.ts` | `mismaUnidad`, `textoReferencia`, `excede`, `resumenPlato` |
| Create `projects/comidas/src/app/catalogo/plantas.ts` | `META_PLANTAS`, `plantasDeLaSemana`, `comidasQueSuman` |
| Create specs al lado de cada uno | Tests de lógica pura |
| Modify `projects/comidas/src/app/services/meal.service.ts` | `normalizeName` → `normalizar`; clave `catalogoPropio`; `catalogoEfectivo`, `indiceCatalogo`, `guardarEnCatalogo` |
| Modify `projects/comidas/src/app/components/meal-editor/*` | Por persona, autocompletado, referencia, resumen, clasificar, tags |
| Modify `projects/comidas/src/app/components/dashboard/*` | Contador y panel de plantas |
| Modify `TODO.md`, spec | Estado |

---

### Task 1: Núcleo del catálogo

**Files:**
- Create: `projects/comidas/src/app/catalogo/catalogo.ts`
- Test: `projects/comidas/src/app/catalogo/catalogo.spec.ts`
- Modify: `projects/comidas/src/app/services/meal.service.ts` (método privado `normalizeName`, lo usa `buscarExistente`)

**Interfaces:**
- Produces:
  - `type Grupo = 'hortalizas' | 'frutas' | 'feculentos' | 'pan' | 'lacteos' | 'carnesHuevos' | 'aceitesSemillas' | 'condimentos'`
  - `type EntradaCatalogo = { nombre: string; sinonimos?: string[]; grupo: Grupo; unidad: string; porcion?: number; estimada?: boolean; planta?: boolean; legumbre?: boolean }`
  - `type IndiceCatalogo = ReadonlyMap<string, EntradaCatalogo>`
  - `type Sugerencia = { nombre: string; grupo?: Grupo }`
  - `normalizar(texto: string): string`
  - `combinar(base: readonly EntradaCatalogo[], propio: readonly EntradaCatalogo[]): EntradaCatalogo[]`
  - `indexar(entradas: readonly EntradaCatalogo[]): IndiceCatalogo`
  - `clasificar(nombre: string, indice: IndiceCatalogo): EntradaCatalogo | null`
  - `esPlanta(entrada: EntradaCatalogo): boolean`
  - `sugerencias(texto: string, entradas: readonly EntradaCatalogo[], propios: readonly string[], max?: number): Sugerencia[]`
  - `ETIQUETA_GRUPO: Record<Grupo, string>`

- [ ] **Step 1: Write the failing test**

```ts
// projects/comidas/src/app/catalogo/catalogo.spec.ts
import { describe, expect, it } from 'vitest';

import {
  clasificar,
  combinar,
  EntradaCatalogo,
  esPlanta,
  indexar,
  normalizar,
  sugerencias,
} from './catalogo';

const base: EntradaCatalogo[] = [
  { nombre: 'tomate', sinonimos: ['tomate perita'], grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'limón', grupo: 'frutas', unidad: 'unidad' },
  { nombre: 'pechuga de pollo', sinonimos: ['pechuga'], grupo: 'carnesHuevos', unidad: 'g', porcion: 150 },
  { nombre: 'lentejas', sinonimos: ['lentejas cocidas'], grupo: 'feculentos', unidad: 'g', porcion: 125, legumbre: true },
  { nombre: 'aceite de oliva', grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1, planta: false },
  { nombre: 'perejil', grupo: 'condimentos', unidad: 'cda', planta: true },
  { nombre: 'sal', grupo: 'condimentos', unidad: 'pizca' },
];
const indice = indexar(base);

describe('normalizar', () => {
  it('saca acentos, mayúsculas y espacios de más', () => {
    expect(normalizar('  Brócoli   Grande ')).toBe('brocoli grande');
  });
});

describe('clasificar', () => {
  it('encuentra por nombre canónico y por sinónimo', () => {
    expect(clasificar('tomate', indice)?.nombre).toBe('tomate');
    expect(clasificar('Tomate Perita', indice)?.nombre).toBe('tomate');
    expect(clasificar('pechuga', indice)?.nombre).toBe('pechuga de pollo');
  });

  it('ignora acentos, mayúsculas y espacios', () => {
    expect(clasificar('  LIMON ', indice)?.nombre).toBe('limón');
  });

  it('entiende el plural con -s y con -es', () => {
    expect(clasificar('tomates', indice)?.nombre).toBe('tomate');
    expect(clasificar('limones', indice)?.nombre).toBe('limón');
  });

  it('no clasifica por coincidencia parcial', () => {
    expect(clasificar('salsa de tomate', indice)).toBeNull();
    expect(clasificar('zanahoria rallada', indice)).toBeNull();
  });

  it('devuelve null para lo que no está', () => {
    expect(clasificar('dragonfruit', indice)).toBeNull();
    expect(clasificar('', indice)).toBeNull();
  });
});

describe('combinar', () => {
  it('una entrada propia con el mismo nombre reemplaza a la del base, sinónimos incluidos', () => {
    const propio: EntradaCatalogo[] = [{ nombre: 'Pechuga de Pollo', grupo: 'carnesHuevos', unidad: 'unidad' }];
    const i = indexar(combinar(base, propio));
    expect(clasificar('pechuga de pollo', i)?.unidad).toBe('unidad');
    // El sinónimo era de la entrada vieja: ya no apunta a nada.
    expect(clasificar('pechuga', i)).toBeNull();
  });

  it('un sinónimo propio que choca con otra entrada del base gana', () => {
    const propio: EntradaCatalogo[] = [
      { nombre: 'tomate cherry', sinonimos: ['tomate perita'], grupo: 'hortalizas', unidad: 'g' },
    ];
    const i = indexar(combinar(base, propio));
    expect(clasificar('tomate perita', i)?.nombre).toBe('tomate cherry');
    expect(clasificar('tomate', i)?.nombre).toBe('tomate');
  });
});

describe('esPlanta', () => {
  it('lo decide el grupo', () => {
    expect(esPlanta(base[0])).toBe(true); // hortalizas
    expect(esPlanta(base[2])).toBe(false); // carnesHuevos
    expect(esPlanta(base[6])).toBe(false); // condimentos
  });

  it('la excepción de la entrada gana', () => {
    expect(esPlanta(base[4])).toBe(false); // aceite de oliva
    expect(esPlanta(base[5])).toBe(true); // perejil
  });
});

describe('sugerencias', () => {
  it('trae primero el catálogo, con grupo, y después lo propio que no está en él', () => {
    const r = sugerencias('pe', base, ['pepino de mar', 'pechuga']);
    expect(r).toContainEqual({ nombre: 'pechuga de pollo', grupo: 'carnesHuevos' });
    expect(r).toContainEqual({ nombre: 'perejil', grupo: 'condimentos' });
    // Lo propio va al final, después de todo lo del catálogo.
    expect(r.at(-1)).toEqual({ nombre: 'pepino de mar' });
    // 'pechuga' es sinónimo del catálogo: no se repite como propio.
    expect(r).not.toContainEqual({ nombre: 'pechuga' });
  });

  it('busca también por sinónimo', () => {
    expect(sugerencias('perita', base, [])).toEqual([{ nombre: 'tomate', grupo: 'hortalizas' }]);
  });

  it('no sugiere con menos de dos letras ni lo que ya está escrito igual', () => {
    expect(sugerencias('t', base, [])).toEqual([]);
    expect(sugerencias('tomate', base, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm ng test comidas --include='**/catalogo/catalogo.spec.ts' --watch=false`
Expected: FAIL — `Failed to resolve import "./catalogo"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// projects/comidas/src/app/catalogo/catalogo.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm ng test comidas --include='**/catalogo/catalogo.spec.ts' --watch=false`
Expected: PASS.

- [ ] **Step 5: `MealService.normalizeName` usa `normalizar`**

En `projects/comidas/src/app/services/meal.service.ts`, borrar el método privado `normalizeName` y en `buscarExistente` usar la función compartida:

```ts
import { normalizar } from '../catalogo/catalogo';
// ...
    const target = normalizar(meal.name);
    return this.meals().find((m) => normalizar(m.name) === target);
```

El comentario que estaba sobre `normalizeName` se va con él. Si `grep -n normalizeName` encuentra otro uso, reemplazarlo igual.

- [ ] **Step 6: Run all comidas tests**

Run: `pnpm ng test comidas --watch=false`
Expected: PASS (todos).

- [ ] **Step 7: Commit**

```bash
git add projects/comidas/src/app/catalogo/catalogo.ts projects/comidas/src/app/catalogo/catalogo.spec.ts projects/comidas/src/app/services/meal.service.ts
git commit -m "feat(comidas): núcleo del catálogo de ingredientes (clasificar, combinar, sugerencias)"
```

---

### Task 2: Datos del catálogo base

**Files:**
- Create: `projects/comidas/src/app/catalogo/catalogo-datos.ts`
- Test: `projects/comidas/src/app/catalogo/catalogo-datos.spec.ts`

**Interfaces:**
- Consumes: `EntradaCatalogo`, `normalizar`, `indexar`, `clasificar` (Task 1).
- Produces: `CATALOGO: readonly EntradaCatalogo[]`, `TAGS_BASE: readonly string[]`.

Porciones (spec, tabla GAPA): carnes y pescado 150 g `estimada`; huevo 1 unidad; legumbres 125 g (cocidas); arroz, pastas, polenta, quinoa 50 g crudos `estimada`; papa y batata 1 unidad; choclo 0.5 unidad; pan 60 g; frutas 1 unidad (frutillas y arándanos 1 taza); leche 1 taza; yogur 200 g; quesos de corte 30 g `estimada`; queso rallado 3 cda; quesos untables y ricota 6 cda; aceite y semillas 1 cda; frutas secas 1 puñado. Hortalizas y condimentos sin porción.

- [ ] **Step 1: Write the failing test**

```ts
// projects/comidas/src/app/catalogo/catalogo-datos.spec.ts
import { describe, expect, it } from 'vitest';

import { clasificar, indexar, normalizar } from './catalogo';
import { CATALOGO, TAGS_BASE } from './catalogo-datos';

describe('CATALOGO', () => {
  it('ningún nombre ni sinónimo se repite entre entradas', () => {
    const vistas = new Map<string, string>();
    const choques: string[] = [];
    for (const e of CATALOGO) {
      for (const clave of [e.nombre, ...(e.sinonimos ?? [])].map(normalizar)) {
        const otra = vistas.get(clave);
        if (otra && otra !== e.nombre) {
          choques.push(`${clave}: ${otra} / ${e.nombre}`);
        }
        vistas.set(clave, e.nombre);
      }
    }
    expect(choques).toEqual([]);
  });

  it('la porción es un número positivo', () => {
    for (const e of CATALOGO) {
      if (e.porcion !== undefined) {
        expect(e.porcion, e.nombre).toBeGreaterThan(0);
      }
    }
  });

  it('legumbre sólo dentro de feculentos', () => {
    expect(CATALOGO.filter((e) => e.legumbre && e.grupo !== 'feculentos')).toEqual([]);
  });

  // Los ingredientes de las recetas reales (las del usuario y las de los
  // planes de referencia). Si alguno deja de clasificarse, se rompió un
  // sinónimo.
  it('clasifica los ingredientes de las recetas de referencia', () => {
    const indice = indexar(CATALOGO);
    const nombres = [
      'aceite de oliva', 'aceitunas negras', 'acelga', 'acelga o espinaca', 'aji', 'aji verde', 'ajo',
      'albahaca', 'anana', 'apio', 'arroz', 'arroz integral', 'arvejas', 'atun al natural',
      'avena arrollada', 'banana', 'batata', 'berenjena', 'berro', 'bife de pechuga', 'boniato', 'brocoli',
      'brotes de arveja o soja', 'brotes de soja', 'calabaza', 'caldo', 'caldo de verduras', 'canela',
      'carne magra', 'carne picada magra', 'carne picada muy magra', 'carne vacuna magra', 'cebolla',
      'cebolla de verdeo', 'cebolla morada', 'cerdo', 'champignones', 'chauchas', 'choclo',
      'choclo desgranado', 'churrasco magro', 'clara', 'coliflor', 'corazones de alcaucil',
      'crema de leche light', 'espinaca', 'espinaca o acelga', 'fideos', 'filet de brotola',
      'filet de merluza', 'filet de pescado', 'garbanzos', 'garbanzos cocidos', 'harina de avena',
      'harina de garbanzos', 'hojas verdes', 'huevo', 'laurel', 'leche descremada', 'lechuga', 'lentejas',
      'lentejas cocidas', 'limon', 'lomo de cerdo', 'maicena', 'manzana', 'manzana verde',
      'mayonesa sin colesterol', 'medallon de lomo', 'milanesa de pescado', 'morron', 'morron rojo',
      'mostaza', 'mozzarella', 'naranja', 'palmitos', 'palta', 'pan integral', 'pan rallado', 'papa',
      'pechuga de pollo', 'pepino', 'perejil', 'pimenton dulce', 'polenta', 'pollo (cuarto)',
      'pollo cocido', 'pollo hervido', 'polvo de hornear', 'porotos', 'porotos aduki', 'porotos cocidos',
      'porotos negros', 'puerro', 'pulpa de tomate', 'pure de tomate', 'queso', 'queso blanco descremado',
      'queso fresco descremado', 'queso port salut', 'queso rallado', 'rabanitos', 'radicheta', 'remolacha',
      'repollo', 'repollo blanco', 'repollo colorado', 'ricota descremada', 'rucula', 'salsa golf diet',
      'semillas de lino', 'spaghetti', 'tapa de tarta', 'tapas de empanada', 'tapas de tarta', 'tomate',
      'tomate pelado', 'tomate perita', 'tomate triturado', 'tomates cherry', 'tortillas para wrap',
      'tostadas de arroz', 'vino blanco', 'yogur natural', 'zanahoria', 'zapallito', 'zapallito redondo',
      'zapallo', 'zucchini', 'muzza', 'zuccini', 'pechuga', 'huevos', 'cebollas', 'zapallitos',
      'nueces', 'datiles', 'sal', 'escencia de vainilla', 'harina de almendras',
    ];
    expect(nombres.filter((n) => !clasificar(n, indice))).toEqual([]);
  });

  it('el tomate procesado es la misma planta que el tomate', () => {
    const indice = indexar(CATALOGO);
    expect(clasificar('tomate triturado', indice)?.nombre).toBe(clasificar('tomate', indice)?.nombre);
  });
});

describe('TAGS_BASE', () => {
  it('no repite tags', () => {
    expect(new Set(TAGS_BASE.map(normalizar)).size).toBe(TAGS_BASE.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm ng test comidas --include='**/catalogo/catalogo-datos.spec.ts' --watch=false`
Expected: FAIL — `Failed to resolve import "./catalogo-datos"`.

- [ ] **Step 3: Write the data**

```ts
// projects/comidas/src/app/catalogo/catalogo-datos.ts
// Catálogo base. Porciones por persona y por comida, de adulto, del "Manual
// para la aplicación de las Guías Alimentarias para la Población Argentina".
// `estimada` marca las que las GAPA no dan en gramos. Cada usuario lo corrige
// con su `catalogoPropio`; acá sólo se agrega lo que sirve a cualquiera.
import { EntradaCatalogo } from './catalogo';

const CARNE = { grupo: 'carnesHuevos', unidad: 'g', porcion: 150, estimada: true } as const;
const CEREAL = { grupo: 'feculentos', unidad: 'g', porcion: 50, estimada: true } as const;
const LEGUMBRE = { grupo: 'feculentos', unidad: 'g', porcion: 125, legumbre: true } as const;
const FRUTA = { grupo: 'frutas', unidad: 'unidad', porcion: 1 } as const;
const QUESO = { grupo: 'lacteos', unidad: 'g', porcion: 30, estimada: true } as const;
const HIERBA = { grupo: 'condimentos', unidad: 'cda', planta: true } as const;
const CONDIMENTO = { grupo: 'condimentos', unidad: 'cdita' } as const;

export const CATALOGO: readonly EntradaCatalogo[] = [
  // Hortalizas: sin porción; las cubre el "medio plato" del resumen.
  { nombre: 'acelga', sinonimos: ['acelga o espinaca'], grupo: 'hortalizas', unidad: 'atado' },
  { nombre: 'ajo', sinonimos: ['diente de ajo'], grupo: 'hortalizas', unidad: 'diente' },
  { nombre: 'apio', sinonimos: ['blanco de apio'], grupo: 'hortalizas', unidad: 'rama' },
  { nombre: 'berenjena', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'berro', grupo: 'hortalizas', unidad: 'atado' },
  { nombre: 'brócoli', sinonimos: ['brocolis'], grupo: 'hortalizas', unidad: 'unidad' },
  {
    nombre: 'brotes de soja',
    sinonimos: ['brotes de arveja', 'brotes de arveja o soja'],
    grupo: 'hortalizas',
    unidad: 'g',
  },
  { nombre: 'calabaza', sinonimos: ['zapallo anco'], grupo: 'hortalizas', unidad: 'g' },
  { nombre: 'cebolla', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'cebolla de verdeo', sinonimos: ['verdeo', 'cebollita de verdeo'], grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'cebolla morada', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'champignones', sinonimos: ['hongos', 'champiñones'], grupo: 'hortalizas', unidad: 'g' },
  { nombre: 'chauchas', grupo: 'hortalizas', unidad: 'g' },
  { nombre: 'coliflor', grupo: 'hortalizas', unidad: 'unidad' },
  {
    nombre: 'corazones de alcaucil',
    sinonimos: ['alcaucil', 'alcauciles'],
    grupo: 'hortalizas',
    unidad: 'unidad',
  },
  { nombre: 'espinaca', sinonimos: ['espinaca o acelga'], grupo: 'hortalizas', unidad: 'atado' },
  { nombre: 'hojas verdes', sinonimos: ['mix de hojas verdes'], grupo: 'hortalizas', unidad: 'plato' },
  { nombre: 'lechuga', sinonimos: ['lechuga mantecosa', 'lechuga criolla'], grupo: 'hortalizas', unidad: 'unidad' },
  {
    nombre: 'morrón',
    sinonimos: ['morron rojo', 'morron verde', 'pimiento', 'aji', 'aji verde', 'aji morron'],
    grupo: 'hortalizas',
    unidad: 'unidad',
  },
  { nombre: 'palmitos', grupo: 'hortalizas', unidad: 'lata' },
  { nombre: 'pepino', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'puerro', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'rabanitos', sinonimos: ['rabanito', 'rabanos'], grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'radicheta', grupo: 'hortalizas', unidad: 'atado' },
  { nombre: 'remolacha', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'repollo', sinonimos: ['repollo blanco'], grupo: 'hortalizas', unidad: 'taza' },
  { nombre: 'repollo colorado', grupo: 'hortalizas', unidad: 'taza' },
  { nombre: 'rúcula', grupo: 'hortalizas', unidad: 'atado' },
  {
    nombre: 'tomate',
    sinonimos: [
      'tomate perita',
      'tomates cherry',
      'tomate cherry',
      'tomate triturado',
      'tomate pelado',
      'pure de tomate',
      'pulpa de tomate',
      'tomates perita',
    ],
    grupo: 'hortalizas',
    unidad: 'unidad',
  },
  { nombre: 'zanahoria', sinonimos: ['zanahoria rallada'], grupo: 'hortalizas', unidad: 'unidad' },
  {
    nombre: 'zapallito',
    sinonimos: ['zapallito redondo', 'zapallito verde'],
    grupo: 'hortalizas',
    unidad: 'unidad',
  },
  { nombre: 'zapallo', grupo: 'hortalizas', unidad: 'g' },
  { nombre: 'zucchini', sinonimos: ['zuccini', 'zuchini', 'zapallito largo'], grupo: 'hortalizas', unidad: 'unidad' },

  // Frutas.
  { nombre: 'ananá', sinonimos: ['anana en lata'], ...FRUTA },
  { nombre: 'arándanos', grupo: 'frutas', unidad: 'taza', porcion: 1 },
  { nombre: 'banana', ...FRUTA },
  { nombre: 'ciruela', ...FRUTA },
  { nombre: 'damasco', sinonimos: ['damascos secos'], ...FRUTA },
  { nombre: 'dátil', ...FRUTA },
  { nombre: 'durazno', sinonimos: ['durazno en lata'], ...FRUTA },
  { nombre: 'frutillas', sinonimos: ['frutilla'], grupo: 'frutas', unidad: 'taza', porcion: 1 },
  { nombre: 'kiwi', ...FRUTA },
  { nombre: 'limón', sinonimos: ['jugo de limon'], grupo: 'frutas', unidad: 'unidad' },
  { nombre: 'mandarina', ...FRUTA },
  { nombre: 'manzana', sinonimos: ['manzana verde', 'manzana roja'], ...FRUTA },
  { nombre: 'naranja', ...FRUTA },
  { nombre: 'palta', grupo: 'frutas', unidad: 'unidad' },
  { nombre: 'pera', ...FRUTA },
  { nombre: 'pomelo', ...FRUTA },
  { nombre: 'uvas', ...FRUTA },

  // Feculentos: legumbres, cereales, papa, batata, choclo.
  { nombre: 'arroz', sinonimos: ['arroz blanco'], ...CEREAL },
  { nombre: 'arroz integral', ...CEREAL },
  { nombre: 'avena', sinonimos: ['avena arrollada', 'harina de avena', 'copos de avena'], grupo: 'feculentos', unidad: 'g' },
  { nombre: 'fideos', sinonimos: ['spaghetti', 'tallarines', 'pasta', 'fideos secos', 'mostachol'], ...CEREAL },
  { nombre: 'polenta', ...CEREAL },
  { nombre: 'quinoa', ...CEREAL },
  { nombre: 'maicena', sinonimos: ['almidon de maiz'], grupo: 'feculentos', unidad: 'cda' },
  { nombre: 'papa', grupo: 'feculentos', unidad: 'unidad', porcion: 1 },
  { nombre: 'batata', sinonimos: ['boniato'], grupo: 'feculentos', unidad: 'unidad', porcion: 1 },
  { nombre: 'choclo', sinonimos: ['choclo desgranado', 'maiz'], grupo: 'feculentos', unidad: 'unidad', porcion: 0.5 },
  { nombre: 'mandioca', grupo: 'feculentos', unidad: 'unidad', porcion: 0.5 },
  { nombre: 'arvejas', sinonimos: ['arveja'], ...LEGUMBRE },
  { nombre: 'garbanzos', sinonimos: ['garbanzos cocidos'], ...LEGUMBRE },
  { nombre: 'harina de garbanzos', grupo: 'feculentos', unidad: 'g', legumbre: true },
  { nombre: 'lentejas', sinonimos: ['lentejas cocidas'], ...LEGUMBRE },
  { nombre: 'porotos', sinonimos: ['porotos cocidos', 'porotos blancos', 'porotos alubia'], ...LEGUMBRE },
  { nombre: 'porotos aduki', ...LEGUMBRE },
  { nombre: 'porotos negros', ...LEGUMBRE },

  // Pan y masas.
  { nombre: 'pan', sinonimos: ['pan frances', 'mignon'], grupo: 'pan', unidad: 'g', porcion: 60 },
  { nombre: 'pan integral', grupo: 'pan', unidad: 'g', porcion: 60 },
  { nombre: 'pan árabe', grupo: 'pan', unidad: 'g', porcion: 60, estimada: true },
  { nombre: 'pan rallado', grupo: 'pan', unidad: 'g' },
  { nombre: 'tapas de tarta', sinonimos: ['tapa de tarta'], grupo: 'pan', unidad: 'unidad' },
  { nombre: 'tapas de empanada', sinonimos: ['tapa de empanada'], grupo: 'pan', unidad: 'unidad' },
  { nombre: 'tortillas para wrap', sinonimos: ['tortilla de trigo', 'rapiditas'], grupo: 'pan', unidad: 'unidad' },
  { nombre: 'tostadas de arroz', sinonimos: ['galletas de arroz'], grupo: 'pan', unidad: 'unidad' },
  { nombre: 'harina de almendras', grupo: 'aceitesSemillas', unidad: 'g' },

  // Lácteos.
  { nombre: 'leche', sinonimos: ['leche descremada', 'leche entera'], grupo: 'lacteos', unidad: 'taza', porcion: 1 },
  {
    nombre: 'yogur',
    sinonimos: ['yogur natural', 'yogur descremado', 'yogurt'],
    grupo: 'lacteos',
    unidad: 'g',
    porcion: 200,
  },
  { nombre: 'queso', ...QUESO },
  { nombre: 'mozzarella', sinonimos: ['muzza', 'muzzarella'], ...QUESO },
  { nombre: 'queso fresco', sinonimos: ['queso fresco descremado', 'queso cremoso'], ...QUESO },
  { nombre: 'queso port salut', sinonimos: ['port salut'], ...QUESO },
  { nombre: 'queso rallado', sinonimos: ['queso de rallar'], grupo: 'lacteos', unidad: 'cda', porcion: 3 },
  {
    nombre: 'queso blanco',
    sinonimos: ['queso blanco descremado', 'queso crema', 'queso untable'],
    grupo: 'lacteos',
    unidad: 'cda',
    porcion: 6,
  },
  { nombre: 'ricota', sinonimos: ['ricota descremada'], grupo: 'lacteos', unidad: 'cda', porcion: 6, estimada: true },
  { nombre: 'crema de leche', sinonimos: ['crema de leche light'], grupo: 'lacteos', unidad: 'ml' },

  // Carnes y huevos.
  {
    nombre: 'carne vacuna',
    sinonimos: ['carne', 'carne magra', 'carne vacuna magra', 'churrasco', 'churrasco magro', 'bife', 'carne al horno'],
    ...CARNE,
  },
  { nombre: 'carne picada', sinonimos: ['carne picada magra', 'carne picada muy magra'], ...CARNE },
  { nombre: 'lomo', sinonimos: ['medallon de lomo', 'medallones de lomo'], ...CARNE },
  {
    nombre: 'pechuga de pollo',
    sinonimos: ['pechuga', 'bife de pechuga', 'pollo', 'pollo (cuarto)', 'pollo cocido', 'pollo hervido'],
    ...CARNE,
  },
  { nombre: 'cerdo', sinonimos: ['lomo de cerdo', 'bondiola', 'carre de cerdo'], ...CARNE },
  {
    nombre: 'pescado',
    sinonimos: [
      'filet de pescado',
      'fillet',
      'fillet (o medallon)',
      'filet de merluza',
      'merluza',
      'filet de brotola',
      'brotola',
      'milanesa de pescado',
      'medallon de merluza',
    ],
    ...CARNE,
  },
  { nombre: 'atún', sinonimos: ['atun al natural', 'atun en lata'], ...CARNE },
  { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad', porcion: 1 },
  { nombre: 'clara', sinonimos: ['clara de huevo'], grupo: 'carnesHuevos', unidad: 'unidad' },

  // Aceites, semillas y frutas secas.
  {
    nombre: 'aceite de oliva',
    sinonimos: ['aceite', 'aceite de girasol', 'aceite de oliva o chia'],
    grupo: 'aceitesSemillas',
    unidad: 'cda',
    porcion: 1,
    planta: false,
  },
  { nombre: 'aceite de coco', grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1, planta: false },
  { nombre: 'aceitunas', sinonimos: ['aceitunas negras', 'aceitunas verdes'], grupo: 'aceitesSemillas', unidad: 'unidad' },
  { nombre: 'semillas de lino', sinonimos: ['lino'], grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1 },
  { nombre: 'semillas de chía', sinonimos: ['chia'], grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1 },
  { nombre: 'semillas de girasol', grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1 },
  { nombre: 'semillas de sésamo', sinonimos: ['sesamo'], grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1 },
  { nombre: 'nueces', grupo: 'aceitesSemillas', unidad: 'puñado', porcion: 1 },
  { nombre: 'almendras', grupo: 'aceitesSemillas', unidad: 'puñado', porcion: 1 },
  { nombre: 'castañas de cajú', sinonimos: ['castañas de caju'], grupo: 'aceitesSemillas', unidad: 'puñado', porcion: 1 },
  { nombre: 'maní', sinonimos: ['pasta de mani'], grupo: 'aceitesSemillas', unidad: 'puñado', porcion: 1 },
  {
    nombre: 'mayonesa',
    sinonimos: ['mayonesa sin colesterol', 'mayonesa light', 'mayonesa diet'],
    grupo: 'aceitesSemillas',
    unidad: 'cda',
    planta: false,
  },
  { nombre: 'salsa golf', sinonimos: ['salsa golf diet'], grupo: 'aceitesSemillas', unidad: 'cda', planta: false },

  // Condimentos. Las hierbas frescas cuentan como planta.
  { nombre: 'perejil', ...HIERBA },
  { nombre: 'albahaca', ...HIERBA },
  { nombre: 'cilantro', ...HIERBA },
  { nombre: 'ciboulette', ...HIERBA },
  { nombre: 'menta', ...HIERBA },
  { nombre: 'sal', ...CONDIMENTO },
  { nombre: 'pimienta', ...CONDIMENTO },
  { nombre: 'orégano', ...CONDIMENTO },
  { nombre: 'laurel', sinonimos: ['hoja de laurel', 'hojas de laurel'], grupo: 'condimentos', unidad: 'hoja' },
  { nombre: 'pimentón', sinonimos: ['pimenton dulce'], ...CONDIMENTO },
  { nombre: 'canela', ...CONDIMENTO },
  { nombre: 'comino', ...CONDIMENTO },
  { nombre: 'nuez moscada', ...CONDIMENTO },
  { nombre: 'mostaza', ...CONDIMENTO },
  { nombre: 'vinagre', ...CONDIMENTO },
  { nombre: 'salsa de soja', sinonimos: ['salsa de soya'], ...CONDIMENTO },
  { nombre: 'caldo', sinonimos: ['caldo de verduras', 'caldo desgrasado'], grupo: 'condimentos', unidad: 'taza' },
  { nombre: 'vino blanco', grupo: 'condimentos', unidad: 'vaso' },
  { nombre: 'polvo de hornear', ...CONDIMENTO },
  { nombre: 'esencia de vainilla', sinonimos: ['escencia de vainilla'], ...CONDIMENTO },
  { nombre: 'stevia', ...CONDIMENTO },
];

export const TAGS_BASE: readonly string[] = [
  'desayuno',
  'almuerzo',
  'cena',
  'colación',
  'postre',
  'ensalada',
  'guarnición',
  'sopa',
  'tarta',
  'guiso',
  'salteado',
  'horno',
  'vegetariano',
  'vegano',
  'sin gluten',
  'rápido',
  'fácil',
  'alto_proteina',
];
```

Notas de datos: `ajo` va en hortalizas para que cuente como planta; los quesos de corte son `estimada` porque las GAPA dan "cajita de fósforos". Si el lint de `max-len` marca alguna línea, partirla en el formato multilínea que ya usan las entradas largas.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm ng test comidas --include='**/catalogo/*.spec.ts' --watch=false`
Expected: PASS. Si "clasifica los ingredientes de referencia" lista nombres, agregar el sinónimo que falte a la entrada que corresponda (no a una nueva).

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/catalogo/catalogo-datos.ts projects/comidas/src/app/catalogo/catalogo-datos.spec.ts
git commit -m "feat(comidas): catálogo base de ingredientes con porciones GAPA y tags base"
```

---

### Task 3: `catalogoPropio` en MealService

**Files:**
- Modify: `projects/comidas/src/app/services/meal.service.ts`
- Test: `projects/comidas/src/app/services/meal.service.sync.spec.ts` (nuevo `describe` al final)

**Interfaces:**
- Consumes: `CATALOGO` (Task 2); `combinar`, `indexar`, `normalizar`, `EntradaCatalogo`, `IndiceCatalogo` (Task 1).
- Produces (en `MealService`):
  - `readonly catalogoPropio: WritableSignal<EntradaCatalogo[]>`
  - `readonly catalogoEfectivo: Signal<EntradaCatalogo[]>`
  - `readonly indiceCatalogo: Signal<IndiceCatalogo>`
  - `guardarEnCatalogo(entrada: EntradaCatalogo): void`

- [ ] **Step 1: Write the failing test**

Agregar al final de `meal.service.sync.spec.ts`:

```ts
describe('MealService: catálogo propio', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(onSnapshot).mockImplementation(((
      _ref: unknown,
      next: (snap: DocumentSnapshot) => void
    ) => {
      emitir = next;
      return (): void => undefined;
    }) as never);
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('guardar reemplaza la entrada del mismo nombre y persiste', async () => {
    const service = TestBed.inject(MealService);
    service.guardarEnCatalogo({ nombre: 'Muzza Rica', grupo: 'lacteos', unidad: 'g' });
    service.guardarEnCatalogo({ nombre: 'muzza rica', grupo: 'lacteos', unidad: 'g', porcion: 40 });
    await asentar();

    expect(service.catalogoPropio()).toEqual([
      { nombre: 'muzza rica', grupo: 'lacteos', unidad: 'g', porcion: 40 },
    ]);
    expect(JSON.parse(localStorage.getItem('comidas_catalogo_propio')!)).toHaveLength(1);
  });

  it('el índice reconoce lo propio y lo propio corrige el base', () => {
    const service = TestBed.inject(MealService);
    service.guardarEnCatalogo({ nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad', porcion: 2 });

    expect(service.indiceCatalogo().get('huevo')?.porcion).toBe(2);
  });

  it('arranca desde localStorage', () => {
    localStorage.setItem(
      'comidas_catalogo_propio',
      JSON.stringify([{ nombre: 'kale', grupo: 'hortalizas', unidad: 'atado' }])
    );
    const service = TestBed.inject(MealService);

    expect(service.indiceCatalogo().get('kale')?.grupo).toBe('hortalizas');
  });

  it('viaja en el backup y se restaura con importData', () => {
    const service = TestBed.inject(MealService);
    service.importData(
      JSON.stringify({ catalogoPropio: [{ nombre: 'kale', grupo: 'hortalizas', unidad: 'atado' }] })
    );

    expect(service.catalogoPropio()).toEqual([{ nombre: 'kale', grupo: 'hortalizas', unidad: 'atado' }]);
    expect(pareceBackup({ catalogoPropio: [] })).toBe(true);
  });
});
```

`pareceBackup` ya se exporta de `meal.service.ts`: sumarlo al import de arriba del archivo si todavía no está.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm ng test comidas --include='**/meal.service.sync.spec.ts' --watch=false`
Expected: FAIL — `service.guardarEnCatalogo is not a function`.

- [ ] **Step 3: Implement**

En `meal.service.ts`:

1. Imports:

```ts
import {
  combinar,
  EntradaCatalogo,
  IndiceCatalogo,
  indexar,
  normalizar,
} from '../catalogo/catalogo';
import { CATALOGO } from '../catalogo/catalogo-datos';
```

(`normalizar` ya entró en Task 1: no duplicar el import.)

2. En `projects/comidas/src/app/services/backup.ts`, sección `comidas` de `SECCIONES`: `claves: ['meals', 'catalogoPropio']`. Así viaja en el backup, cuenta para `pareceBackup` y se reemplaza junto con las comidas. En `backup.spec.ts`, el test de `CLAVES_BACKUP` pasa de `toHaveLength(12)` a `toHaveLength(13)`.

3. Junto a las otras claves (`private readonly ALIAS_KEY …`):

```ts
  private readonly CATALOGO_PROPIO_KEY = 'comidas_catalogo_propio';
```

4. Junto a `readonly pantryGroups = signal…`:

```ts
  // Lo que el usuario agregó o corrigió del catálogo base. Ver
  // docs/superpowers/specs/2026-10-08-catalogo-ingredientes-design.md
  readonly catalogoPropio = signal<EntradaCatalogo[]>(this.loadCatalogoPropio());
  readonly catalogoEfectivo = computed(() => combinar(CATALOGO, this.catalogoPropio()));
  readonly indiceCatalogo = computed<IndiceCatalogo>(() => indexar(this.catalogoEfectivo()));
```

5. Junto a `loadPantryGroups`:

```ts
  private loadCatalogoPropio(): EntradaCatalogo[] {
    const data = localStorage.getItem(this.CATALOGO_PROPIO_KEY);
    return data ? (JSON.parse(data) as EntradaCatalogo[]) : [];
  }

  // Una entrada por nombre normalizado: guardar otra vez la reemplaza.
  guardarEnCatalogo(entrada: EntradaCatalogo): void {
    const nombre = normalizar(entrada.nombre);
    this.catalogoPropio.update((actual) => [
      ...actual.filter((e) => normalizar(e.nombre) !== nombre),
      { ...entrada, nombre },
    ]);
  }
```

6. En el constructor, después del effect de `alias`:

```ts
    effect(() => {
      const data = this.catalogoPropio();
      localStorage.setItem(this.CATALOGO_PROPIO_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('catalogoPropio')) {
        this.saveToFirestore('catalogoPropio', data);
      }
    });
```

7. En la tabla `aplicadores` de la bajada (donde está `pantryGroups: (v) => …`):

```ts
      catalogoPropio: (v) => this.catalogoPropio.set(v as EntradaCatalogo[]),
```

8. En `estadoActual()`, después de `pantryGroups: this.pantryGroups(),`:

```ts
      catalogoPropio: this.catalogoPropio(),
```

9. En `prepararImport`, después del bloque de `pantryGroups`:

```ts
    if (data['catalogoPropio']) {
      const v = data['catalogoPropio'] as EntradaCatalogo[];
      pasos.push(() => this.catalogoPropio.set(v));
    }
```

10. `soloComidas` (en `backup.ts`) sigue tratando como lista suelta un archivo que sólo trae `meals`; uno con `catalogoPropio` es un backup. No hay que tocarlo.

- [ ] **Step 4: Run tests**

Run: `pnpm ng test comidas --watch=false`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/services/meal.service.ts projects/comidas/src/app/services/meal.service.sync.spec.ts
git commit -m "feat(comidas): catálogo propio por usuario, sincronizado y en el backup"
```

---

### Task 4: Lógica del plato (referencia, exceso, resumen)

**Files:**
- Create: `projects/comidas/src/app/catalogo/plato.ts`
- Test: `projects/comidas/src/app/catalogo/plato.spec.ts`

**Interfaces:**
- Consumes: `EntradaCatalogo`, `IndiceCatalogo`, `clasificar`, `normalizar` (Task 1); `parseQuantity` de `../services/meal.service`; `Ingredient` de `../models/meal.model`.
- Produces:
  - `UMBRAL_EXCESO = 1.5`
  - `mismaUnidad(a: string, b: string): boolean`
  - `textoReferencia(entrada: EntradaCatalogo): string | null`
  - `excede(cantidad: string, unidad: string, entrada: EntradaCatalogo): boolean`
  - `type ResumenPlato = { verdura: boolean; proteina: boolean; feculento: boolean; aceite: boolean; clasificados: number }`
  - `resumenPlato(ingredientes: Pick<Ingredient, 'name'>[], indice: IndiceCatalogo): ResumenPlato`

- [ ] **Step 1: Write the failing test**

```ts
// projects/comidas/src/app/catalogo/plato.spec.ts
import { describe, expect, it } from 'vitest';

import { EntradaCatalogo, indexar } from './catalogo';
import { excede, mismaUnidad, resumenPlato, textoReferencia } from './plato';

const carne: EntradaCatalogo = { nombre: 'carne', grupo: 'carnesHuevos', unidad: 'g', porcion: 150, estimada: true };
const huevo: EntradaCatalogo = { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad', porcion: 1 };
const indice = indexar([
  carne,
  huevo,
  { nombre: 'tomate', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'lentejas', grupo: 'feculentos', unidad: 'g', porcion: 125, legumbre: true },
  { nombre: 'arroz', grupo: 'feculentos', unidad: 'g', porcion: 50 },
  { nombre: 'aceite de oliva', grupo: 'aceitesSemillas', unidad: 'cda', porcion: 1, planta: false },
]);

describe('mismaUnidad', () => {
  it('reconoce las formas escritas de una misma unidad', () => {
    expect(mismaUnidad('gr', 'g')).toBe(true);
    expect(mismaUnidad(' Gramos ', 'g')).toBe(true);
    expect(mismaUnidad('unidades', 'unidad')).toBe(true);
    expect(mismaUnidad('cucharadas', 'cda')).toBe(true);
    expect(mismaUnidad('taza', 'g')).toBe(false);
  });
});

describe('textoReferencia', () => {
  it('arma la referencia y marca la estimada', () => {
    expect(textoReferencia(carne)).toBe('ref. 150 g por persona (estimado)');
    expect(textoReferencia(huevo)).toBe('ref. 1 unidad por persona');
  });

  it('sin porción no hay referencia', () => {
    expect(textoReferencia({ nombre: 'tomate', grupo: 'hortalizas', unidad: 'unidad' })).toBeNull();
  });
});

describe('excede', () => {
  it('avisa por encima de 1,5 veces la porción', () => {
    expect(excede('225', 'g', carne)).toBe(false);
    expect(excede('226', 'g', carne)).toBe(true);
    expect(excede('300', 'grs', carne)).toBe(true);
  });

  it('con otra unidad no compara', () => {
    expect(excede('2', 'unidades', carne)).toBe(false);
  });

  it('una cantidad no numérica no avisa; una fracción se compara por su valor', () => {
    expect(excede('a gusto', 'g', carne)).toBe(false);
    expect(excede('', 'unidad', huevo)).toBe(false);
    expect(excede('1/2', 'unidad', huevo)).toBe(false);
    expect(excede('2', 'unidades', huevo)).toBe(true);
  });
});

describe('resumenPlato', () => {
  const plato = (...nombres: string[]): { name: string }[] => nombres.map((name) => ({ name }));

  it('marca qué grupos están', () => {
    expect(resumenPlato(plato('carne', 'tomate', 'aceite de oliva'), indice)).toEqual({
      verdura: true,
      proteina: true,
      feculento: false,
      aceite: true,
      clasificados: 3,
    });
  });

  it('legumbre más cereal cuenta como proteína; legumbre sola no', () => {
    expect(resumenPlato(plato('lentejas', 'arroz'), indice).proteina).toBe(true);
    expect(resumenPlato(plato('lentejas'), indice).proteina).toBe(false);
  });

  it('ignora nombres vacíos y lo que no se clasifica', () => {
    expect(resumenPlato(plato('', 'dragonfruit', 'huevo'), indice).clasificados).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm ng test comidas --include='**/catalogo/plato.spec.ts' --watch=false`
Expected: FAIL — `Failed to resolve import "./plato"`.

- [ ] **Step 3: Implement**

```ts
// projects/comidas/src/app/catalogo/plato.ts
import { Ingredient } from '../models/meal.model';
import { parseQuantity } from '../services/meal.service';
import { clasificar, EntradaCatalogo, IndiceCatalogo, normalizar } from './catalogo';

// Elección de diseño, no de las GAPA: un margen para que una porción generosa
// no se pinte de aviso.
export const UMBRAL_EXCESO = 1.5;

const UNIDADES: Record<string, string> = {
  g: 'g',
  gr: 'g',
  grs: 'g',
  gramo: 'g',
  gramos: 'g',
  ml: 'ml',
  cc: 'ml',
  u: 'unidad',
  unidad: 'unidad',
  unidades: 'unidad',
  cda: 'cda',
  cdas: 'cda',
  cucharada: 'cda',
  cucharadas: 'cda',
  cdita: 'cdita',
  cditas: 'cdita',
  cucharadita: 'cdita',
  cucharaditas: 'cdita',
  taza: 'taza',
  tazas: 'taza',
};

function unidadCanonica(unidad: string): string {
  const clave = normalizar(unidad);
  return UNIDADES[clave] ?? clave;
}

export function mismaUnidad(a: string, b: string): boolean {
  return unidadCanonica(a) === unidadCanonica(b);
}

export function textoReferencia(entrada: EntradaCatalogo): string | null {
  if (entrada.porcion === undefined) {
    return null;
  }
  const estimado = entrada.estimada ? ' (estimado)' : '';
  return `ref. ${entrada.porcion} ${entrada.unidad} por persona${estimado}`;
}

export function excede(cantidad: string, unidad: string, entrada: EntradaCatalogo): boolean {
  if (entrada.porcion === undefined || !mismaUnidad(unidad, entrada.unidad)) {
    return false;
  }
  const parsed = parseQuantity(cantidad);
  return !!parsed && parsed.valor > entrada.porcion * UMBRAL_EXCESO;
}

export type ResumenPlato = {
  verdura: boolean;
  proteina: boolean;
  feculento: boolean;
  aceite: boolean;
  // Cuántos ingredientes reconoció el catálogo. En 0 el resumen no se muestra.
  clasificados: number;
};

// Presencia por grupo, no proporciones: con unidades mezcladas no se comparan.
// Legumbre + cereal es el reemplazo de la carne que dan las GAPA.
export function resumenPlato(ingredientes: Pick<Ingredient, 'name'>[], indice: IndiceCatalogo): ResumenPlato {
  const entradas = ingredientes
    .map((i) => clasificar(i.name, indice))
    .filter((e): e is EntradaCatalogo => e !== null);
  const hay = (f: (e: EntradaCatalogo) => boolean): boolean => entradas.some(f);
  const legumbreYCereal =
    hay((e) => e.grupo === 'feculentos' && !!e.legumbre) && hay((e) => e.grupo === 'feculentos' && !e.legumbre);
  return {
    verdura: hay((e) => e.grupo === 'hortalizas'),
    proteina: hay((e) => e.grupo === 'carnesHuevos') || legumbreYCereal,
    feculento: hay((e) => e.grupo === 'feculentos' || e.grupo === 'pan'),
    aceite: hay((e) => e.grupo === 'aceitesSemillas'),
    clasificados: entradas.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm ng test comidas --include='**/catalogo/plato.spec.ts' --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/catalogo/plato.ts projects/comidas/src/app/catalogo/plato.spec.ts
git commit -m "feat(comidas): referencia de porción, aviso de exceso y resumen del plato"
```

---

### Task 5: Editor — por persona, autocompletado, referencia y resumen

**Files:**
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.ts`
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.html` (sección `.ingredients-section`)
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.scss`

**Interfaces:**
- Consumes: `sugerencias`, `clasificar`, `ETIQUETA_GRUPO`, `Sugerencia`, `EntradaCatalogo` (Task 1); `textoReferencia`, `excede`, `resumenPlato`, `ResumenPlato` (Task 4); `mealService.catalogoEfectivo`, `mealService.indiceCatalogo` (Task 3).
- Produces (en el componente): `filteredSuggestions: Signal<Sugerencia[]>`, `selectSuggestion(s: Sugerencia, ingredientIndex: number): void`, `entradaDe(nombre: string): EntradaCatalogo | null`, `resumen(): ResumenPlato`, `readonly etiquetaGrupo = ETIQUETA_GRUPO`.

La lógica está testeada en Tasks 1 y 4; acá se verifica en la app (Step 4).

- [ ] **Step 1: Componente**

En `meal-editor.component.ts`:

```ts
import {
  clasificar,
  EntradaCatalogo,
  ETIQUETA_GRUPO,
  Sugerencia,
  sugerencias,
} from '../../catalogo/catalogo';
import { excede, ResumenPlato, resumenPlato, textoReferencia } from '../../catalogo/plato';
```

Reemplazar `filteredSuggestions`:

```ts
  readonly filteredSuggestions = computed(() =>
    sugerencias(
      this.currentInputValue(),
      this.mealService.catalogoEfectivo(),
      this.mealService.allIngredientNames()
    )
  );

  readonly etiquetaGrupo = ETIQUETA_GRUPO;
  readonly textoReferencia = textoReferencia;
```

Reemplazar `selectSuggestion`:

```ts
  // Al elegir del catálogo, el nombre queda canónico y —sólo si están vacías—
  // cantidad y unidad se llenan con la porción de referencia. Nunca pisa lo
  // escrito.
  selectSuggestion(sugerencia: Sugerencia, ingredientIndex: number): void {
    const fila = this.ingredients.at(ingredientIndex) as FormGroup;
    fila.get('name')?.setValue(sugerencia.nombre);
    const entrada = this.entradaDe(sugerencia.nombre);
    const vacia = !fila.get('quantity')?.value && !fila.get('unit')?.value;
    if (entrada?.porcion !== undefined && vacia) {
      fila.patchValue({ quantity: String(entrada.porcion), unit: entrada.unidad });
    }
    this.activeIngredientIndex.set(-1);
  }

  entradaDe(nombre: string): EntradaCatalogo | null {
    return clasificar(nombre, this.mealService.indiceCatalogo());
  }

  excede(index: number): boolean {
    const { name, quantity, unit } = this.ingredients.at(index).value as {
      name: string;
      quantity: string;
      unit: string;
    };
    const entrada = this.entradaDe(name);
    return !!entrada && excede(quantity, unit, entrada);
  }

  resumen(): ResumenPlato {
    return resumenPlato(this.ingredients.value as { name: string }[], this.mealService.indiceCatalogo());
  }
```

`onIngredientKeydown` ya llama `this.selectSuggestion(suggestions[highlighted], index)`: con el tipo nuevo compila igual.

- [ ] **Step 2: Template**

Reemplazar el encabezado de `.ingredients-section`:

```html
      <div class="header">
        <h2>Ingredientes · para 1 persona</h2>
        <button class="btn-secondary" type="button" (click)="addIngredient()">
          + Agregar
        </button>
      </div>
      <p class="hint">
        Las cantidades son de una porción; la lista de compras y el ×N de la
        receta las multiplican.
      </p>
```

En el dropdown, reemplazar el cuerpo del `@for (suggestion of filteredSuggestions(); …)`:

```html
                    <div
                      class="suggestion-item"
                      [class.highlighted]="
                        highlightedSuggestionIndex() === $index
                      "
                      (mousedown)="selectSuggestion(suggestion, $index)"
                    >
                      {{ suggestion.nombre }}
                      @if (suggestion.grupo) {
                        <span class="grupo">{{ etiquetaGrupo[suggestion.grupo] }}</span>
                      }
                    </div>
```

Debajo del `</div>` que cierra `.ingredient-row` (dentro del `@for` de ingredientes), agregar:

```html
          @if (entradaDe(ing.value.name); as entrada) {
            @if (textoReferencia(entrada); as referencia) {
              <p class="referencia" [class.aviso]="excede($index)">
                {{ referencia }}
              </p>
            }
          }
```

Después del `@for` de ingredientes, antes del `</div>` de `formArrayName`:

```html
        @if (resumen(); as r) {
          @if (r.clasificados > 0) {
            <p class="resumen-plato">
              <span [class.falta]="!r.verdura">Verdura {{ r.verdura ? '✓' : '—' }}</span>
              · <span>Proteína {{ r.proteina ? '✓' : '—' }}</span>
              · <span>Feculento {{ r.feculento ? '✓' : '—' }}</span>
              · <span>Aceite {{ r.aceite ? '✓' : '—' }}</span>
            </p>
          }
        }
```

- [ ] **Step 3: Estilos (tokens del tema, nunca hex)**

En `meal-editor.component.scss`:

```scss
.hint,
.referencia {
  margin: 0.25rem 0 0.5rem;
  font-size: 0.8rem;
  color: var(--fg-muted);
}

.referencia.aviso {
  color: var(--warning);
}

.suggestion-item .grupo {
  margin-left: 0.5rem;
  font-size: 0.75rem;
  color: var(--fg-muted);
}

.resumen-plato {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--fg-secondary);

  .falta {
    color: var(--warning);
    font-weight: 600;
  }
}
```

Antes de usarlos, confirmar los nombres con `grep -n -- '--fg-muted\|--fg-secondary\|--warning' projects/componentes/src/styles/_tema.scss`. Si alguno no existe, usar el token más cercano que sí esté (no inventar uno ni poner un hex).

- [ ] **Step 4: Verificar en la app**

```bash
pnpm ng build componentes && pnpm ng serve comidas
```

En `/meals/new`: escribir "pech" → aparece "pechuga de pollo · carne/huevo"; elegirla con cantidad vacía → `150` `g` y `ref. 150 g por persona (estimado)`; cambiar a `300` → la referencia pasa a aviso; agregar "tomate" → el resumen marca Verdura ✓. Escribir primero `2` `unidades` y después elegir "pechuga" → la cantidad queda `2` `unidades`.

- [ ] **Step 5: Lint y tests**

Run: `pnpm ng lint comidas && pnpm ng test comidas --watch=false`
Expected: 0 errores de lint (los warnings previos no cuentan), tests PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/comidas/src/app/components/meal-editor/
git commit -m "feat(comidas): el editor sugiere del catálogo y muestra la porción por persona"
```

---

### Task 6: Editor — clasificar ingredientes y tags base

**Files:**
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.ts`
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.html`
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.scss`

**Interfaces:**
- Consumes: `entradaDe`, `etiquetaGrupo` (Task 5); `Grupo` (Task 1); `TAGS_BASE` (Task 2); `tagsUnicos` de `meal.service`; `mealService.guardarEnCatalogo` (Task 3).
- Produces: `clasificando: WritableSignal<number>`, `clasificacion: FormGroup`, `grupos: Grupo[]`, `abrirClasificacion(index: number): void`, `guardarClasificacion(): void`, `tagsSugeridos: Signal<string[]>`.

- [ ] **Step 1: Componente**

```ts
import { Grupo } from '../../catalogo/catalogo';
import { TAGS_BASE } from '../../catalogo/catalogo-datos';
import { limpiarPasos, MealService, tagsUnicos } from '../../services/meal.service';
```

(el último reemplaza el import existente de `limpiarPasos, MealService`.)

```ts
  // La fila que se está clasificando, o -1. Una sola a la vez.
  readonly clasificando = signal<number>(-1);
  readonly grupos = Object.keys(ETIQUETA_GRUPO) as Grupo[];
  readonly clasificacion = this.fb.group({
    grupo: ['hortalizas' as Grupo],
    unidad: [''],
    porcion: [''],
  });

  readonly tagsSugeridos = computed(() => {
    const base = new Set(TAGS_BASE);
    return [...TAGS_BASE, ...tagsUnicos(this.mealService.meals()).filter((t) => !base.has(t))];
  });

  // Sirve para lo que no está y para corregir lo que está: con una entrada,
  // parte de sus valores y guarda con su nombre canónico, así reemplaza a la
  // del base.
  abrirClasificacion(index: number): void {
    const { name, unit } = this.ingredients.at(index).value as { name: string; unit: string };
    const entrada = this.entradaDe(name);
    this.clasificacion.setValue({
      grupo: entrada?.grupo ?? 'hortalizas',
      unidad: entrada?.unidad ?? unit ?? '',
      porcion: entrada?.porcion !== undefined ? String(entrada.porcion) : '',
    });
    this.clasificando.set(index);
  }

  guardarClasificacion(): void {
    const index = this.clasificando();
    const { name } = this.ingredients.at(index).value as { name: string };
    const entrada = this.entradaDe(name);
    const { grupo, unidad, porcion } = this.clasificacion.value;
    const numero = Number(String(porcion ?? '').replace(',', '.'));
    this.mealService.guardarEnCatalogo({
      nombre: entrada?.nombre ?? name,
      ...(entrada?.sinonimos ? { sinonimos: entrada.sinonimos } : {}),
      grupo: grupo ?? 'hortalizas',
      unidad: unidad?.trim() || 'unidad',
      ...(porcion && numero > 0 ? { porcion: numero } : {}),
    });
    this.clasificando.set(-1);
  }
```

Las excepciones `planta` y `legumbre` de una entrada del base no se copian: el mini formulario no las edita. Es a propósito (spec: el formulario es grupo, unidad y porción).

- [ ] **Step 2: Template**

Dentro de `.ingredient-row`, antes del botón `btn-remove`:

```html
            <button
              class="chip-grupo"
              type="button"
              [class.sin-clasificar]="!entradaDe(ing.value.name)"
              (click)="abrirClasificacion($index)"
            >
              @if (entradaDe(ing.value.name); as entrada) {
                {{ etiquetaGrupo[entrada.grupo] }}
              } @else {
                sin clasificar
              }
            </button>
```

Mostrar el chip sólo si hay nombre: envolver ese `<button>` en `@if (ing.value.name?.trim()) { … }`.

Después del bloque de `.referencia` de Task 5, dentro del `@for`:

```html
          @if (clasificando() === $index) {
            <div class="clasificar" [formGroup]="clasificacion">
              <select formControlName="grupo">
                @for (g of grupos; track g) {
                  <option [value]="g">{{ etiquetaGrupo[g] }}</option>
                }
              </select>
              <input formControlName="unidad" placeholder="Unidad" type="text" />
              <input formControlName="porcion" placeholder="Porción (opcional)" type="text" />
              <button class="btn-secondary" type="button" (click)="guardarClasificacion()">
                Guardar
              </button>
              <button class="btn-secondary" type="button" (click)="clasificando.set(-1)">
                Cancelar
              </button>
            </div>
          }
```

`[formGroup]="clasificacion"` adentro del `formArrayName` del form principal es un form independiente: no se mezcla con `ingredients`.

En el input de tags, sumar `list` y el `datalist`:

```html
        <input
          id="tag-input"
          list="tags-sugeridos"
          placeholder="Ej: Vegetariano, Rápido"
          type="text"
          [formControl]="newTagControl"
          (keydown.enter)="addTag($event)"
        />
        <datalist id="tags-sugeridos">
          @for (tag of tagsSugeridos(); track tag) {
            <option [value]="tag"></option>
          }
        </datalist>
```

- [ ] **Step 3: Estilos**

```scss
.chip-grupo {
  padding: 0.15rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: none;
  color: var(--fg-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  cursor: pointer;

  &.sin-clasificar {
    border-style: dashed;
    color: var(--warning);
  }
}

.clasificar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.25rem 0 0.75rem;
}
```

Confirmar `--border` igual que en Task 5.

- [ ] **Step 4: Verificar en la app**

Con `pnpm ng serve comidas`: ingrediente "kale" → chip `sin clasificar`; tocarlo, elegir "verdura", guardar → el chip pasa a `verdura` y en otra comida "kale" ya aparece en el autocompletado. Tocar el chip de "huevo", porción 2, guardar → `ref. 2 unidad por persona`. En Configuración, exportar backup → el JSON trae `catalogoPropio`. En etiquetas, enfocar el input → el navegador ofrece los tags base.

- [ ] **Step 5: Lint y tests**

Run: `pnpm ng lint comidas && pnpm ng test comidas --watch=false`
Expected: 0 errores, PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/comidas/src/app/components/meal-editor/
git commit -m "feat(comidas): clasificar ingredientes desde el editor y tags base sugeridos"
```

---

### Task 7: Plantas por semana

**Files:**
- Create: `projects/comidas/src/app/catalogo/plantas.ts`
- Test: `projects/comidas/src/app/catalogo/plantas.spec.ts`
- Modify: `projects/comidas/src/app/components/dashboard/dashboard.component.ts`
- Modify: `projects/comidas/src/app/components/dashboard/dashboard.component.html` (bloque `.week-info`)
- Modify: `projects/comidas/src/app/components/dashboard/dashboard.component.scss`

**Interfaces:**
- Consumes: `clasificar`, `esPlanta`, `normalizar`, `IndiceCatalogo` (Task 1); `DaySchedule`, `Meal` de `../models/meal.model`; `mealService.schedule()`, `mealService.meals()`, `mealService.indiceCatalogo()`.
- Produces:
  - `META_PLANTAS = 30`
  - `type PlantasSemana = { plantas: string[]; sinClasificar: string[] }`
  - `plantasDeLaSemana(semana: DaySchedule[], meals: Meal[], indice: IndiceCatalogo): PlantasSemana`
  - `comidasQueSuman(plantas: ReadonlySet<string>, meals: Meal[], indice: IndiceCatalogo, max?: number): { meal: Meal; nuevas: number }[]`

- [ ] **Step 1: Write the failing test**

```ts
// projects/comidas/src/app/catalogo/plantas.spec.ts
import { describe, expect, it } from 'vitest';

import { DaySchedule, Meal } from '../models/meal.model';
import { indexar } from './catalogo';
import { comidasQueSuman, plantasDeLaSemana } from './plantas';

const indice = indexar([
  { nombre: 'zanahoria', sinonimos: ['zanahoria rallada'], grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'tomate', grupo: 'hortalizas', unidad: 'unidad' },
  { nombre: 'lentejas', grupo: 'feculentos', unidad: 'g', legumbre: true },
  { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad' },
]);

const comida = (id: string, ...ingredientes: string[]): Meal => ({
  id,
  name: id,
  ingredients: ingredientes.map((name) => ({ name, quantity: '1' })),
});

const dia = (almuerzo: { mealId: string; excluded?: boolean }[]): DaySchedule => ({
  dayName: 'Lunes',
  desayuno: [],
  almuerzo: almuerzo.map((d) => ({ portions: 1, ...d })),
  postreAlmuerzo: null,
  colacion: null,
  cena: [],
  postreCena: null,
});

describe('plantasDeLaSemana', () => {
  const meals = [
    comida('a', 'Zanahoria', 'huevo', 'kale'),
    comida('b', 'zanahoria rallada', 'tomates', ''),
    comida('c', 'lentejas'),
  ];

  it('cuenta plantas distintas por entrada canónica, sin carnes', () => {
    const r = plantasDeLaSemana([dia([{ mealId: 'a' }, { mealId: 'b' }])], meals, indice);
    expect(r.plantas).toEqual(['tomate', 'zanahoria']);
    expect(r.sinClasificar).toEqual(['kale']);
  });

  it('ignora platos excluidos, comidas borradas y nombres vacíos', () => {
    const r = plantasDeLaSemana(
      [dia([{ mealId: 'c', excluded: true }, { mealId: 'borrada' }, { mealId: 'b' }])],
      meals,
      indice
    );
    expect(r.plantas).toEqual(['tomate', 'zanahoria']);
    expect(r.sinClasificar).toEqual([]);
  });
});

describe('comidasQueSuman', () => {
  it('ordena por plantas nuevas y descarta las que no suman', () => {
    const meals = [comida('a', 'zanahoria'), comida('b', 'tomate', 'lentejas'), comida('c', 'huevo')];
    const r = comidasQueSuman(new Set(['zanahoria']), meals, indice);
    expect(r.map((x) => [x.meal.id, x.nuevas])).toEqual([['b', 2]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm ng test comidas --include='**/catalogo/plantas.spec.ts' --watch=false`
Expected: FAIL — `Failed to resolve import "./plantas"`.

- [ ] **Step 3: Implement**

```ts
// projects/comidas/src/app/catalogo/plantas.ts
import { DaySchedule, Meal } from '../models/meal.model';
import { clasificar, esPlanta, IndiceCatalogo, normalizar } from './catalogo';

// American Gut Project (McDonald et al., mSystems 2018): 30 o más plantas
// distintas por semana. Constante hasta que alguien la quiera distinta.
export const META_PLANTAS = 30;

export type PlantasSemana = {
  plantas: string[];
  // Ingredientes que el catálogo no reconoce: no cuentan, pero se informan
  // para que se vea qué falta clasificar.
  sinClasificar: string[];
};

function plantasDe(meal: Meal, indice: IndiceCatalogo, sinClasificar?: Set<string>): Set<string> {
  const plantas = new Set<string>();
  for (const ingrediente of meal.ingredients) {
    const entrada = clasificar(ingrediente.name, indice);
    if (entrada) {
      if (esPlanta(entrada)) {
        plantas.add(entrada.nombre);
      }
    } else if (sinClasificar && normalizar(ingrediente.name)) {
      sinClasificar.add(normalizar(ingrediente.name));
    }
  }
  return plantas;
}

// Los campos de texto libre (postres, colación) no cuentan.
export function plantasDeLaSemana(semana: DaySchedule[], meals: Meal[], indice: IndiceCatalogo): PlantasSemana {
  const porId = new Map(meals.map((m) => [m.id, m]));
  const plantas = new Set<string>();
  const sinClasificar = new Set<string>();
  for (const dia of semana) {
    for (const plato of [...dia.desayuno, ...dia.almuerzo, ...dia.cena]) {
      const meal = plato.excluded ? undefined : porId.get(plato.mealId);
      if (meal) {
        plantasDe(meal, indice, sinClasificar).forEach((p) => plantas.add(p));
      }
    }
  }
  return { plantas: [...plantas].sort(), sinClasificar: [...sinClasificar].sort() };
}

export function comidasQueSuman(
  plantas: ReadonlySet<string>,
  meals: Meal[],
  indice: IndiceCatalogo,
  max = 3
): { meal: Meal; nuevas: number }[] {
  return meals
    .map((meal) => ({
      meal,
      nuevas: [...plantasDe(meal, indice)].filter((p) => !plantas.has(p)).length,
    }))
    .filter((x) => x.nuevas > 0)
    .sort((a, b) => b.nuevas - a.nuevas || a.meal.name.localeCompare(b.meal.name))
    .slice(0, max);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm ng test comidas --include='**/catalogo/plantas.spec.ts' --watch=false`
Expected: PASS.

- [ ] **Step 5: Dashboard**

En `dashboard.component.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { comidasQueSuman, META_PLANTAS, plantasDeLaSemana } from '../../catalogo/plantas';
```

En la clase:

```ts
  readonly metaPlantas = META_PLANTAS;
  readonly verPlantas = signal(false);
  readonly plantas = computed(() =>
    plantasDeLaSemana(this.mealService.schedule(), this.mealService.meals(), this.mealService.indiceCatalogo())
  );
  readonly sumanPlantas = computed(() =>
    comidasQueSuman(new Set(this.plantas().plantas), this.mealService.meals(), this.mealService.indiceCatalogo())
  );
```

En el template, dentro de `.week-info`, después del `<span class="date-range">`:

```html
        <button class="plantas" type="button" (click)="verPlantas.set(!verPlantas())">
          {{ plantas().plantas.length }} de {{ metaPlantas }} plantas
        </button>
```

Y después del `</div>` que cierra el bloque de navegación de semana (el que contiene `.week-info` y los dos `btn-nav`):

```html
    @if (verPlantas()) {
      <div class="panel-plantas">
        <p>{{ plantas().plantas.join(', ') || 'Todavía ninguna planta esta semana.' }}</p>
        @if (plantas().sinClasificar.length) {
          <p class="sin-clasificar">
            +{{ plantas().sinClasificar.length }} sin clasificar:
            {{ plantas().sinClasificar.join(', ') }}
          </p>
        }
        @if (sumanPlantas().length) {
          <p>Suman plantas nuevas:</p>
          <ul>
            @for (s of sumanPlantas(); track s.meal.id) {
              <li>{{ s.meal.name }} (+{{ s.nuevas }})</li>
            }
          </ul>
        }
      </div>
    }
```

Estilos en `dashboard.component.scss`:

```scss
.plantas {
  margin-top: 0.25rem;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font-size: 0.85rem;
  cursor: pointer;
}

.panel-plantas {
  margin: 0.5rem 0 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: var(--bg-tint-1);
  font-size: 0.9rem;

  .sin-clasificar {
    color: var(--fg-muted);
  }
}

@media print {
  .plantas,
  .panel-plantas {
    display: none;
  }
}
```

Confirmar `--accent` y `--bg-tint-1` en `_tema.scss` igual que en Task 5.

- [ ] **Step 6: Verificar en la app**

Con `pnpm ng serve comidas`: el dashboard muestra `N de 30 plantas` bajo las fechas; al tocarlo, la lista coincide con las verduras de los platos de la semana; un plato excluido no suma; las sugerencias suman plantas que la semana no tiene.

- [ ] **Step 7: Lint, tests y commit**

Run: `pnpm ng lint comidas && pnpm ng test comidas --watch=false`
Expected: 0 errores, PASS.

```bash
git add projects/comidas/src/app/catalogo/plantas.ts projects/comidas/src/app/catalogo/plantas.spec.ts projects/comidas/src/app/components/dashboard/
git commit -m "feat(comidas): contador de plantas distintas por semana en el dashboard"
```

---

### Task 8: Cierre

**Files:**
- Modify: `TODO.md`
- Modify: `docs/superpowers/specs/2026-10-08-catalogo-ingredientes-design.md` (línea `Estado:`)

- [ ] **Step 1: Build de producción completo**

Run: `pnpm build`
Expected: compila los tres proyectos sin errores.

- [ ] **Step 2: Estado de los documentos**

- Spec: `Estado: diseñado, sin implementar` → `Estado: implementado`. En *Contenido del catálogo inicial*, "Unas 300 entradas" → "Unas 150 entradas iniciales".
- `TODO.md`: mover la entrada **Catálogo de ingredientes, porciones y plantas por semana** de *En curso / pendiente* a *Hecho* como `- [x]`, con un párrafo corto de lo que quedó (catálogo base + propio, porción GAPA y resumen del plato en el editor, contador de plantas). En *En curso / pendiente*, dejar como ítem nuevo lo que el spec puso fuera de alcance: calorías y frecuencias semanales GAPA (pescado ≥2, carnes blancas 2, rojas ≤3).

- [ ] **Step 3: Commit**

```bash
git add TODO.md docs/superpowers/specs/2026-10-08-catalogo-ingredientes-design.md
git commit -m "docs(comidas): catálogo de ingredientes implementado"
```

- [ ] **Step 4: PR**

Sólo con el ok del usuario: `git push -u origin feat/catalogo-ingredientes` y `gh pr create` con un resumen por task. Sin línea de co-autor ni firma en el cuerpo.
