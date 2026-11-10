# Armador de semanas, entrega 2 (Flash) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un botón "Completar con Flash" que le pide a Gemini elegir, entre los candidatos que ya filtra el armador algorítmico, la comida de cada slot vacío, validando la respuesta con las mismas reglas; más recetas nuevas de Flash (automáticas para slots sin candidatos, y a demanda con "Sugerime algo nuevo") que se usan, se guardan para después o se descartan.

**Architecture:** La lógica es pura y vive en `armador/` (`armador.ts` gana opciones por slot y "preferidas"; `pedido-flash.ts` arma el pedido y lee la respuesta; `recetas-nuevas.ts` pide, valida y ubica recetas nuevas), probada con Vitest. Flash nunca escribe el plan: devuelve preferencias que `armarSemana` acepta o reemplaza por su propia elección, así Deshacer, motivos y reglas duras son los de la entrega 1. Un helper `services/flash.ts` concentra la llamada a Firebase AI Logic, que comparten `RevisionService` y el nuevo `ArmadorFlashService`.

**Tech Stack:** Angular 22 (standalone, signals), `@angular/fire/ai` (Firebase AI Logic, Gemini Developer API), Vitest. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-06-armador-semanas-design.md` (sección *Entrega 2: Flash encima*). Base: la entrega 1, mergeada en el PR #88 (`docs/superpowers/plans/2026-11-10-armador-semanas.md`).

## Global Constraints

- Sin dependencias nuevas. SDK desde `@angular/fire/ai`, nunca `firebase/*` (la app corre sobre el firebase que trae `@angular/fire`).
- Modelo `gemini-flash-lite-latest`, backend `GoogleAIBackend`, `responseMimeType: 'application/json'` + `responseSchema`, tope de espera `ESPERA_MS = 90_000` (los de `RevisionService`, que pasan a `services/flash.ts`). Sin MCP ni function calling.
- Sólo con sesión iniciada. Sin sesión, los botones de Flash quedan deshabilitados con el texto visible `Iniciá sesión para completar con Flash`.
- Aviso fijo y visible junto al botón: en el plan gratuito Google puede usar lo que se le manda para entrenar; dice qué se manda (nombres, tags e ingredientes de las comidas candidatas, la semana, la lista No como) y que sólo al tocar el botón.
- Flash sólo elige entre los candidatos de cada slot (enum). Cualquier respuesta inválida para un slot → elección algorítmica en ese slot. Pedido fallido entero → la semana se completa con la entrega 1 y se avisa con `mensajeDeError` de `revision/pedido.ts`.
- Recetas nuevas: tope `MAX_RECETAS_NUEVAS = 3`. Automáticas sólo si tras "Completar con Flash" quedan slots sin candidatos (una por slot vacío). A demanda: botón `Sugerime algo nuevo`, hasta 3 pensadas para sumar plantas a la semana.
- Una receta nueva se descarta si no tiene ingredientes, si alguna cantidad no la entiende `parseQuantity` entera (sobra texto), o si choca con No como.
- Acciones: `Usar` (al recetario + al slot), `Guardar para después` (al recetario con tag `para probar`), `Descartar`. Las sugerencias sin resolver no se guardan.
- Todo texto que se le manda o se le pide a Flash, en español rioplatense. Cantidades por una porción.
- Commits **sin** línea `Co-Authored-By` (regla de la organización). ESLint estricto (`pnpm exec ng lint comidas`: 0 errores, 78 warnings — no sumar). Colores sólo con tokens.
- Correr un spec: `pnpm exec ng test comidas --include='**/<ruta>.spec.ts'`.

## Review Focus

1. **Flash contesta un id que no es candidato de ese slot, o el mismo id en dos slots**: ese slot cae a la elección algorítmica y nunca hay repetición. Test en Task 1 y Task 2.
2. **Flash elige algo que rompe un chequeo de la guía o está fuera de estación cuando había otra opción**: se rechaza y elige el algoritmo. Test en Task 1.
3. **El usuario cambia de semana mientras Flash piensa**: la respuesta no se aplica a la semana nueva; se avisa. Test en Task 4.
4. **El pedido falla entero (cuota, saturado, sin red)**: la semana se completa igual con el algoritmo, Deshacer funciona y se muestra el motivo. Test en Task 4 (camino `preferidas` vacío) y Task 5 (rama de error).
5. **Receta nueva con cantidad "a gusto" o con un ingrediente de No como**: se descarta y no aparece en el panel. Test en Task 3.

---

### Task 1: Opciones por slot y preferidas en el armador

**Files:**
- Modify: `projects/comidas/src/app/armador/armador.ts`
- Test: `projects/comidas/src/app/armador/armador.spec.ts`

**Interfaces:**
- Consumes: lo existente en `armador.ts` (`Slot`, `slotsVacios`, `armarSemana`, `poner`, `elegir`), `puntuar`, `previoDe`, `ContextoPuntaje`.
- Produces:
  ```ts
  export type Preferida = { mealId: string; motivo: string };
  // "Martes-almuerzo": legible para Flash y estable dentro de la semana.
  export function claveSlot(semana: DaySchedule[], slot: Slot): string;
  export type OpcionesSlot = { slot: Slot; clave: string; opciones: { meal: Meal; puntos: number }[] };
  // Puntúa contra la semana como está (sin las elecciones de los otros slots). Mejores primero.
  export function opcionesPorSlot(
    semana: DaySchedule[], desde: number, tipos: readonly DishMealType[],
    candidatos: Candidatos, ctx: ContextoPuntaje, max?: number // default 8
  ): OpcionesSlot[];
  export type ResultadoArmador = { semana: DaySchedule[]; puestos: number; sinCandidatos: number; deFlash: number };
  export function armarSemana(
    semana, desde, tipos, candidatos, ctx, azar,
    preferidas?: ReadonlyMap<string, Preferida> // clave → elección de Flash
  ): ResultadoArmador;
  ```

- [ ] **Step 1: Tests** (`azar = () => 0`):
  - `claveSlot(semana, { dia: 1, tipo: 'almuerzo' })` → `'Martes-almuerzo'`.
  - `opcionesPorSlot` aplica las mismas reglas duras que `armarSemana` contra la semana dada (no ofrece lo ya puesto en almuerzo/cena; desayuno respeta el tope), ordena por `puntos` desc y corta en `max`.
  - Con una preferida válida para un slot, `armarSemana` la pone con su `motivo` y `deFlash` cuenta 1.
  - Preferida con id que no está entre los posibles de ese slot (no candidato, o ya usado por un slot anterior) → elección algorítmica, `deFlash` no cuenta.
  - Preferida que rompe un chequeo (carbos en almuerzo y cena) cuando el mejor algorítmico no lo rompe → rechazada. Regla: se rechaza si `puntos(preferida) < puntos(mejor) − 900`.
  - Preferida con `motivo` vacío → se pone con el motivo algorítmico.
  - Sin `preferidas`, el resultado es idéntico al de antes (los tests existentes pasan sin cambios, salvo sumar `deFlash: 0` donde se compare el objeto entero).
- [ ] **Step 2:** correr `armador.spec.ts`. Falla.
- [ ] **Step 3:** implementar. Extraer de `armarSemana` un helper privado `posiblesPara(actual, slot, candidatos): { posibles: Meal[]; veces: (m: Meal) => number }` que usen los dos caminos — la regla dura no se duplica. El `motivo` de Flash se recorta a 80 caracteres.
- [ ] **Step 4:** correr. Pasa.
- [ ] **Step 5:** commit `feat(comidas): opciones por slot y elecciones preferidas en el armador`.

### Task 2: Pedido a Flash para la semana

**Files:**
- Create: `projects/comidas/src/app/armador/pedido-flash.ts`
- Test: `projects/comidas/src/app/armador/pedido-flash.spec.ts`

**Interfaces:**
- Consumes: `OpcionesSlot`, `Preferida` (Task 1); `resumenParaFlash`, `RecetaParaFlash` (`revision/pedido.ts`); `plantasDeLaSemana`, `META_PLANTAS`; `chequearSemana`; `Estacion`.
- Produces:
  ```ts
  export type ContextoFlash = {
    estacion: Estacion; pais: string; noComo: string[];
    plantas: { van: number; meta: number };
    chequeo: { diasConDosCarbos: string[]; roja: number; pescado: number; blanca: number };
    semana: { dia: string; desayuno: string[]; almuerzo: string[]; cena: string[] }[]; // nombres ya puestos
    slots: { clave: string; candidatos: { id: string; puntaje: number }[] }[];
    recetas: RecetaParaFlash[]; // una por candidato distinto, sin repetir
  };
  export function contextoFlash(
    semana: DaySchedule[], opciones: OpcionesSlot[], ctx: ContextoPuntaje,
    paisNombre: string, noComo: string[]
  ): ContextoFlash;
  export function promptArmador(c: ContextoFlash): string;
  export function esquemaArmador(opciones: OpcionesSlot[]): ObjectSchema;
  export function preferidasDe(raw: unknown, opciones: OpcionesSlot[]): Map<string, Preferida>;
  ```

- [ ] **Step 1: Tests:**
  - `contextoFlash`: `recetas` trae cada candidato una sola vez aunque esté en varios slots; `semana` lista nombres (no ids) de lo ya puesto; `plantas.meta` es `META_PLANTAS`.
  - `promptArmador`: contiene la estación, el país, la lista No como cuando no está vacía (y no la menciona cuando lo está), la instrucción de elegir sólo entre los candidatos de cada slot, de no repetir comidas en la semana y de escribir un motivo corto en español rioplatense; termina con el JSON del contexto.
  - `esquemaArmador`: una propiedad por `clave`, cada una objeto `{ mealId: enum de los ids candidatos de ese slot, motivo: string }`.
  - `preferidasDe`: ignora claves desconocidas, ids fuera del enum del slot, entradas que no son objeto, `raw` que no es objeto (→ mapa vacío); recorta espacios del motivo.
- [ ] **Step 2:** correr. Falla.
- [ ] **Step 3:** implementar. El texto del prompt queda al builder dentro de lo que piden los tests; pedirle a Flash que tenga en cuenta la estación ("nada pesado en verano"), las plantas que faltan y los chequeos.
- [ ] **Step 4:** correr. Pasa.
- [ ] **Step 5:** commit `feat(comidas): pedido a Flash para completar la semana`.

### Task 3: Recetas nuevas

**Files:**
- Create: `projects/comidas/src/app/armador/recetas-nuevas.ts`
- Test: `projects/comidas/src/app/armador/recetas-nuevas.spec.ts`

**Interfaces:**
- Consumes: `chocaConNoComo`; `parseQuantity` (`services/meal.service.ts`); `plantasDe`; `Slot`, `claveSlot`; `Estacion`.
- Produces:
  ```ts
  export const MAX_RECETAS_NUEVAS = 3;
  export type RecetaNueva = {
    name: string; tags: string[]; ingredients: Ingredient[]; pasos: string[];
    tipo: DishMealType; slot: Slot | null; // slot: el hueco para el que se pidió
  };
  export type PedidoRecetas =
    | { modo: 'huecos'; huecos: { clave: string; tipo: DishMealType }[] }
    | { modo: 'plantas'; tipos: DishMealType[]; plantasDeLaSemana: string[] };
  export function promptRecetasNuevas(
    p: PedidoRecetas, estacion: Estacion, pais: string, noComo: string[], nombresExistentes: string[]
  ): string;
  export function esquemaRecetasNuevas(p: PedidoRecetas): ObjectSchema;
  export function validarRecetasNuevas(
    raw: unknown, p: PedidoRecetas, huecos: ReadonlyMap<string, Slot>, noComo: readonly string[], indice: IndiceCatalogo
  ): RecetaNueva[];
  export function slotParaUsar(
    semana: DaySchedule[], desde: number, tipo: DishMealType, meals: Meal[], indice: IndiceCatalogo
  ): Slot | null;
  ```

- [ ] **Step 1: Tests:**
  - `validarRecetasNuevas` descarta: sin ingredientes; una cantidad `a gusto` o `2-3`; un ingrediente de No como; `tipo` fuera de desayuno/almuerzo/cena; nombre vacío; nombre igual (normalizado) a uno de `nombresExistentes`. Corta en `MAX_RECETAS_NUEVAS`. En modo `huecos` asigna `slot` por la `clave` devuelta, cada hueco una sola vez; en modo `plantas`, `slot: null`. `pasos` siempre es arreglo (vacío si no vino).
  - `esquemaRecetasNuevas`: en modo `huecos`, `clave` es enum de las claves pedidas; `tipo` enum de los tipos; ingredientes `{ name, quantity, unit? }`; `pasos` opcional.
  - `promptRecetasNuevas`: pide cantidades por una porción con número, ingredientes concretos (no preparaciones), estación, país, No como, no repetir nombres existentes; en modo `plantas` lista las plantas que ya están en la semana y pide sumar distintas; en modo `huecos` pide una receta por hueco.
  - `slotParaUsar`: entre los slots de ese `tipo` desde `desde` cuyo primer plato tiene `motivo`, el que menos plantas aporta a la semana (plantas de esa comida que ningún otro plato de la semana tiene); empate → el más temprano. Sin ninguno: el primer slot vacío de ese tipo desde `desde`. Sin vacío tampoco: `null`.
- [ ] **Step 2:** correr. Falla.
- [ ] **Step 3:** implementar. La validación de cantidades usa la misma regla que `sugerenciaValida` de `revision/pedido.ts` (`parseQuantity` y `resto.trim() === ''`); si conviene, exportar desde ahí un `cantidadEntera(q: string): boolean` y usarlo en los dos lados.
- [ ] **Step 4:** correr. Pasa.
- [ ] **Step 5:** commit `feat(comidas): recetas nuevas de Flash para el armador`.

### Task 4: MealService: entrada del armador, preferidas y recetas nuevas

**Files:**
- Modify: `projects/comidas/src/app/armador/armador.ts` (sólo `export type EntradaArmador`)
- Modify: `projects/comidas/src/app/services/meal.service.ts`
- Test: `projects/comidas/src/app/services/meal.service.sync.spec.ts`

**Interfaces:**
- Consumes: Tasks 1 y 3.
- Produces (en `MealService`):
  ```ts
  // El tipo vive en armador/armador.ts (export), así el flujo puro no depende del servicio.
  // export type EntradaArmador = { key: string; semana: DaySchedule[]; desde: number;
  //   tipos: DishMealType[]; candidatos: Candidatos; ctx: ContextoPuntaje };
  entradaArmador(): EntradaArmador;   // lo que hoy arma completarSemana, extraído
  completarSemana(
    azar?: () => number,
    preferidas?: ReadonlyMap<string, Preferida>,
    semanaEsperada?: string  // key de la semana para la que se pidió
  ): { puestos: number; sinCandidatos: number; deFlash: number } | null; // null: cambió la semana
  addMeal(meal: Omit<Meal, 'id'>): string;  // ahora devuelve el id
  usarRecetaNueva(r: RecetaNueva): 'puesta' | 'guardada';
  guardarRecetaParaDespues(r: RecetaNueva): void;
  ```

- [ ] **Step 1: Tests:**
  - `completarSemana(() => 0, preferidas)` pone la preferida válida, cuenta `deFlash`, y `deshacerCompletar()` vuelve atrás.
  - `completarSemana(() => 0, preferidas, keyDeOtraSemana)` devuelve `null` y no toca nada (ni snapshot).
  - `completarSemana()` sin argumentos se comporta como antes (tests existentes, con `deFlash: 0`).
  - `usarRecetaNueva` con `slot` vacío: agrega la comida al recetario (con `includeInShoppingList: true`, tags e ingredientes; `pasos` como `Paso[]` si hay) y la pone en ese slot con `motivo: 'receta nueva de Flash'`; devuelve `'puesta'`.
  - `usarRecetaNueva` con `slot: null`: usa `slotParaUsar` con su `tipo`; si devuelve un slot ocupado por un plato del armador, lo reemplaza. Sin lugar: sólo guarda y devuelve `'guardada'`.
  - `usarRecetaNueva` con `slot` que el usuario llenó mientras tanto: no lo pisa; cae a `slotParaUsar`.
  - `guardarRecetaParaDespues`: agrega la comida con el tag `para probar` sumado a sus tags (sin duplicar) y no toca el plan.
- [ ] **Step 2:** correr `meal.service.sync.spec.ts`. Falla.
- [ ] **Step 3:** implementar. `usarRecetaNueva` escribe con `cambiarSlot` (o su equivalente) para que el resto de la lógica del slot sea la misma; no crea snapshot de Deshacer.
- [ ] **Step 4:** `pnpm test`. Pasa.
- [ ] **Step 5:** commit `feat(comidas): MealService acepta elecciones de Flash y recetas nuevas`.

### Task 5: Llamada a Flash compartida y ArmadorFlashService

**Files:**
- Create: `projects/comidas/src/app/services/flash.ts`
- Create: `projects/comidas/src/app/armador/flujo-flash.ts`
- Create: `projects/comidas/src/app/services/armador-flash.service.ts`
- Modify: `projects/comidas/src/app/services/revision.service.ts` (usar `flash.ts`; sin cambio de comportamiento)
- Test: `projects/comidas/src/app/armador/flujo-flash.spec.ts` (ver Step 1)

**Interfaces:**
- Consumes: Tasks 1–4; `mensajeDeError`; `AuthService.currentUser`.
- Produces:
  ```ts
  // services/flash.ts
  export const MODELO = 'gemini-flash-lite-latest';
  export const ESPERA_MS = 90_000;
  export type PedirJson = (esquema: ObjectSchema, prompt: string) => Promise<unknown>;
  export function pedirJsonDe(app: FirebaseApp): PedirJson;

  // armador/flujo-flash.ts (puro, el orden de los pasos; el servicio sólo lo cablea)
  export type ResultadoFlash = {
    puestos: number; sinCandidatos: number; deFlash: number;
    nuevas: RecetaNueva[]; error: string | null; cambioSemana: boolean;
  };
  export async function completarConFlash(deps: {
    entrada: () => EntradaArmador;
    completar: (azar?: () => number, preferidas?: ReadonlyMap<string, Preferida>, semanaEsperada?: string)
      => { puestos: number; sinCandidatos: number; deFlash: number } | null;
    pedir: PedirJson;
    paisNombre: string; noComo: string[]; nombresExistentes: string[];
  }): Promise<ResultadoFlash>;

  // services/armador-flash.service.ts
  readonly puede: Signal<boolean>;       // sesión iniciada
  readonly armando: Signal<boolean>;     // pedido en vuelo (cualquiera de los dos)
  readonly nuevas: Signal<RecetaNueva[]>;
  completar(): Promise<ResultadoFlash>;
  sugerir(): Promise<string | null>;     // error o null
  usar(i: number): 'puesta' | 'guardada';
  guardar(i: number): void;
  descartar(i: number): void;
  ```

- [ ] **Step 1: Tests** de `completarConFlash` con `pedir` mockeado:
  - Respuesta válida → `completar` recibe las preferidas y `semanaEsperada` = `entrada().key`; `deFlash` > 0.
  - `pedir` rechaza (`Error('429 RESOURCE_EXHAUSTED')`) → completa sin preferidas (algoritmo), `error` = el texto de cuota de `mensajeDeError`.
  - Sin slots vacíos → no llama a `pedir`, todo en 0.
  - Tras completar quedan `sinCandidatos > 0` → hace el segundo pedido en modo `huecos` con los slots que siguen vacíos (máximo 3) y devuelve `nuevas`; si ese segundo pedido falla, `nuevas: []` y `error` con su mensaje, sin deshacer lo puesto.
  - `completar` devuelve `null` → `cambioSemana: true`, sin segundo pedido.
- [ ] **Step 2:** correr. Falla.
- [ ] **Step 3:** implementar `flash.ts` (lo que hoy hace el `pedir` de `RevisionService`, parametrizado por esquema), `flujo-flash.ts` y el servicio. `RevisionService.pedir` pasa a `pedirJsonDe(app)(esquemaRespuesta(ids), promptRevision(...))`. El servicio ignora un segundo toque mientras `armando()`; `sugerir()` usa modo `plantas` con los tipos visibles y las plantas de la semana mostrada.
- [ ] **Step 4:** `pnpm test`, `pnpm exec ng lint comidas`. Pasan.
- [ ] **Step 5:** commit `feat(comidas): completar con Flash y recetas nuevas, cableado`.

### Task 6: Dashboard

**Files:**
- Modify: `projects/comidas/src/app/components/dashboard/dashboard.component.{ts,html,scss}`

**Interfaces:**
- Consumes: `ArmadorFlashService` (Task 5).

- [ ] **Step 1: Botones.** `Completar con Flash` después de `Completar semana`, `btn-secondary`. Deshabilitado sin sesión (texto visible `Iniciá sesión para completar con Flash`), sin slots vacíos (mismo texto que el algorítmico), o mientras `armando()` (texto del botón `Armando con Flash…`). El aviso de entrenamiento va debajo de la fila, siempre visible (texto en Global Constraints).
- [ ] **Step 2: Resultado.** Reusar el aviso existente: `Puse N comidas` + `, M elegidas por Flash` si `deFlash` + `· K quedaron sin opciones` si hay; `error` del flujo en una línea aparte con `role="status"`; `cambioSemana` → `Cambiaste de semana mientras Flash pensaba: no puse nada.` Deshacer igual que en el algorítmico.
- [ ] **Step 3: Panel de recetas nuevas** debajo de `.schedule-grid`, visible si hay `nuevas()` o sesión: botón `Sugerime algo nuevo` (mismas reglas de deshabilitado) y una tarjeta por receta con nombre, tipo, ingredientes (cantidad + unidad) y los botones `Usar`, `Guardar para después`, `Descartar`. Tras `Usar`, una línea dice dónde quedó (`Quedó en el almuerzo del jueves` / `No había lugar: la guardé en el recetario`).
- [ ] **Step 4:** `pnpm exec ng lint comidas` (0 errores, 78 warnings), `pnpm test`, `pnpm build`.
- [ ] **Step 5:** commit `feat(comidas): botones de Flash y panel de recetas nuevas en el plan`.
- [ ] **Step 6:** prueba a mano logueado en el 4200 (la hace el controller o el usuario): completar con Flash, ver motivos de Flash, deshacer, sugerir recetas, usar una, guardar otra (aparece con `para probar` en `/meals` y no la propone el armador).

### Task 7: Docs

**Files:**
- Modify: `TODO.md` (armador → hecho, con las dos entregas; lo pendiente que quede, aparte)
- Modify: `docs/superpowers/specs/2026-11-06-armador-semanas-design.md` (`Estado: implementado`)
- Modify: `CLAUDE.md` sólo si algo quedó falso.

- [ ] **Step 1:** editar.
- [ ] **Step 2:** commit `docs(comidas): armador de semanas hecho`.
