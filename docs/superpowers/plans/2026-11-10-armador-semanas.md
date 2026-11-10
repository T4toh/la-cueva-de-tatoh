# Armador de semanas, entrega 1 (algorítmica) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un botón "Completar semana" en el dashboard que llena los desayunos, almuerzos y cenas vacíos con comidas del recetario, eligiendo por puntaje (plantas, despensa, chequeos de la guía, estación, historial), con el porqué de cada elección, Deshacer, y una lista "No como" en Ajustes.

**Architecture:** La lógica es pura y vive en `projects/comidas/src/app/armador/` (No como, estación, candidatos, puntaje, armado), probada con Vitest como `guia/` y `revision/`. `MealService` arma la entrada (semana, historial, despensa, ajustes), llama a `armarSemana` y guarda el resultado con un snapshot para deshacer. La entrega 2 (Flash) es otro plan.

**Tech Stack:** Angular 22 (standalone, signals), Vitest. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-06-armador-semanas-design.md` (sección *Entrega 1*, *Datos* y *No como*).

## Global Constraints

- Sin dependencias nuevas.
- Llena sólo slots `desayuno` / `almuerzo` / `cena` con arreglo vacío; un placeholder ocupa el slot. Postres y colación nunca.
- Sólo días de hoy en adelante si la semana mostrada es la actual (misma comparación `dayDate < today` que `partesSemana`); semana futura: todos; semana pasada: ninguno.
- Sólo los tipos visibles en `visibleMeals` (`breakfast` → desayuno, `lunch` → almuerzo, `dinner` → cena).
- Plato puesto: `{ mealId, portions: 1, excluded: false, motivo }`, uno por slot, también en modo familiar.
- `MAX_DESAYUNO_REPETIDO = 3`. Almuerzo y cena nunca repiten una comida ya presente en la semana.
- Desempate al azar entre los **tres** mejores, con peso por puntaje. El generador entra como parámetro `azar: () => number`; con `() => 0` se elige siempre el mejor.
- Tags que excluyen de candidato (normalizados): `postre`, `salsa`, `para probar`.
- Tags de estación reconocidos: `verano`, `otono`, `invierno`, `primavera` y compuestos con guion (`otono-invierno`), comparados normalizados (sin acento).
- Estaciones por mes completo. Sur: dic–feb verano, mar–may otoño, jun–ago invierno, sep–nov primavera. Norte: al revés.
- "Reciente" = estuvo en alguna de las **dos** semanas anteriores a la mostrada.
- Reglas ocultas en `/guia` no se chequean: `un-carbo-por-dia` y `frecuencia-carnes` (esta cubre roja y pescado).
- Orden de pesos: regla dura > fuera de estación > rompe chequeo de la guía > plantas nuevas > despensa > reciente. Ningún puntaje compensa una regla dura.
- `noComo: string[]` persiste como `guia`: localStorage, `users/{uid}`, backup sección Ajustes. País en `familySettings` como `pais?: string`; sin valor, sale del timezone.
- `aRecetaPublica` no se toca.
- ESLint estricto (`pnpm exec ng lint comidas`): tipos de retorno explícitos, `type` y no `interface`, sin `public`, `@if/@for`, orden de atributos, `max-len 120`. Colores sólo con tokens (`--fg-secondary` para el motivo).
- Commits **sin** línea `Co-Authored-By` (regla de la organización).
- Correr un spec: `pnpm exec ng test comidas --include='**/armador/<archivo>.spec.ts'`.

## Review Focus

1. **Recetario sin tags ni historial (usuario nuevo)**: no hay candidatos a desayuno, almuerzo y cena salen de todas las comidas no-desayuno; nada explota y los desayunos quedan vacíos con el aviso. Test en Task 3 y Task 5.
2. **Menos candidatos que slots**: almuerzo/cena dejan slots vacíos y cuentan `sinCandidatos`; desayuno repite pasando el tope antes de dejar vacío. Test en Task 5.
3. **El usuario toca el plan después de completar**: Deshacer desaparece (no debe pisar el cambio del usuario). Test en Task 6.
4. **Comida borrada que sigue en el historial o en la semana**: ids sin `Meal` no rompen candidatos ni puntaje. Test en Task 3 y Task 4.
5. **"No como" con mayúsculas, acentos o plural de categoría** (`Lácteos`, `Pescado`, `cebolla`): choca igual; un texto vacío o sólo espacios no choca con todo. Test en Task 1.

---

### Task 1: No como

**Files:**
- Create: `projects/comidas/src/app/armador/no-como.ts`
- Test: `projects/comidas/src/app/armador/no-como.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export function chocaConNoComo(meal: Meal, noComo: readonly string[], indice: IndiceCatalogo): boolean;
  // Para el hint de Ajustes: true si el texto es una categoría o clasifica en el catálogo.
  export function reconocido(texto: string, indice: IndiceCatalogo): boolean;
  ```

- [ ] **Step 1: Tests** (`describe('chocaConNoComo')`, catálogo real vía `indexar(CATALOGO)`):
  - `cebolla` choca con un ingrediente `cebolla morada`, y `cebolla morada` choca con `cebolla` ("contiene" en los dos sentidos, sobre texto escrito, nombre de la entrada y sinónimos).
  - `Pescado` choca con `merluza`; `carne roja` choca con `carne picada` (si en el catálogo es roja) y no con `pollo`; `Lácteos` choca con `queso`. Categorías: las etiquetas de `ETIQUETA_GRUPO` y `ETIQUETA_CARNE`, normalizadas, más sus plurales con `s`/`es`.
  - `''` y `'   '` no chocan con nada.
  - `gluten` sólo choca si está escrito en un ingrediente.
  - `reconocido('lacteos')`, `reconocido('Cebolla')` → true; `reconocido('gluten')` → false.
- [ ] **Step 2:** correr el spec. Falla: no existe el módulo.
- [ ] **Step 3:** implementar con `normalizar` y `clasificar` de `catalogo/catalogo.ts`.
- [ ] **Step 4:** correr el spec. Pasa.
- [ ] **Step 5:** commit `feat(comidas): choque de una comida con la lista No como`.

### Task 2: Estación y país

**Files:**
- Create: `projects/comidas/src/app/armador/estacion.ts`
- Test: `projects/comidas/src/app/armador/estacion.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Hemisferio = 'sur' | 'norte';
  export type Estacion = 'verano' | 'otono' | 'invierno' | 'primavera';
  export type Pais = { id: string; nombre: string; hemisferio: Hemisferio };
  export const PAISES: readonly Pais[]; // países de América + { id: 'otro-norte' } y { id: 'otro-sur' }
  export function paisDeTimezone(tz: string): string; // id de PAISES
  export function hemisferioDe(paisId: string): Hemisferio; // id desconocido → 'norte'
  export function estacionDe(fecha: Date, hemisferio: Hemisferio): Estacion;
  export function fueraDeEstacion(tags: readonly string[] | undefined, estacion: Estacion): boolean;
  ```

- [ ] **Step 1: Tests:**
  - `estacionDe(new Date(2026, 0, 15), 'sur')` → `verano`; `(2026, 2, 1, 'sur')` → `otono`; `(2026, 6, 1, 'norte')` → `verano`; `(2026, 11, 1, 'sur')` → `verano`.
  - `paisDeTimezone('America/Argentina/Buenos_Aires')` → `'ar'`; `'America/Buenos_Aires'` → `'ar'`; `'America/Santiago'` → `'cl'`; `'America/Mexico_City'` → `'mx'`; `'Europe/Madrid'` → `'otro-norte'`; `'Australia/Sydney'` → `'otro-sur'`; `''` → `'otro-norte'`.
  - `hemisferioDe('ar')` → `sur`; `hemisferioDe('mx')` → `norte`; `hemisferioDe('xx')` → `norte`.
  - `fueraDeEstacion(['Otoño-Invierno'], 'verano')` → true; `(['otoño-invierno'], 'invierno')` → false; `(['rápido'], 'verano')` → false; `(undefined, 'verano')` → false.
- [ ] **Step 2:** correr. Falla.
- [ ] **Step 3:** implementar. La lista de países y sus prefijos de timezone queda al builder, con los de los tests como mínimo; para lo que no es de América, `otro-sur` si el timezone empieza con `Australia/`, `Pacific/Auckland`, `Africa/Johannesburg` o `Antarctica/`, si no `otro-norte`.
- [ ] **Step 4:** correr. Pasa.
- [ ] **Step 5:** commit `feat(comidas): estación por fecha y hemisferio, país por timezone`.

### Task 3: Candidatos por tipo de slot

**Files:**
- Create: `projects/comidas/src/app/armador/candidatos.ts`
- Test: `projects/comidas/src/app/armador/candidatos.spec.ts`

**Interfaces:**
- Consumes: `chocaConNoComo` (Task 1).
- Produces:
  ```ts
  export type Candidatos = Record<DishMealType, Meal[]>;
  export const TAGS_EXCLUIDOS: readonly string[]; // ['postre', 'salsa', 'para probar']
  export function candidatosPorTipo(
    meals: Meal[], historial: readonly DaySchedule[][], noComo: readonly string[], indice: IndiceCatalogo
  ): Candidatos;
  ```

- [ ] **Step 1: Tests:**
  - Desayuno: entra con tag `Desayuno` o si estuvo en un `desayuno` del historial.
  - Almuerzo y cena reciben la **misma** lista: tag `almuerzo`/`cena` o estuvo en almuerzo/cena del historial.
  - Sin ninguna comida que cumpla lo anterior, almuerzo y cena = todas las que no son candidatas a desayuno (y pasan los filtros).
  - Nunca: `includeInShoppingList === false`, tag `Postre` / `salsa` / `Para probar`, choque con No como.
  - Un id del historial sin `Meal` se ignora.
- [ ] **Step 2:** correr. Falla.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** correr. Pasa.
- [ ] **Step 5:** commit `feat(comidas): candidatos del armador por tipo de comida`.

### Task 4: Puntaje

**Files:**
- Modify: `projects/comidas/src/app/catalogo/plantas.ts` (exportar `plantasDe`)
- Create: `projects/comidas/src/app/armador/puntaje.ts`
- Test: `projects/comidas/src/app/armador/puntaje.spec.ts`

**Interfaces:**
- Consumes: `fueraDeEstacion`, `Estacion` (Task 2); `chequearSemana`, `MAX_CARNE_ROJA`, `MIN_PESCADO` (`guia/chequeos.ts`); `plantasDe`, `META_PLANTAS` (`catalogo/plantas.ts`).
- Produces:
  ```ts
  export type ContextoPuntaje = {
    meals: Meal[];
    indice: IndiceCatalogo;
    despensa: PantryItem[];
    recientes: ReadonlySet<string>;    // mealIds de las dos semanas anteriores
    estacion: Estacion;
    reglasOcultas: ReadonlySet<string>; // ids de /guia ocultos
  };
  export type Puntaje = { puntos: number; motivo: string };
  // `semana` ya trae el candidato puesto en `dia`/`tipo`; se compara contra `antes` (sin él).
  export function puntuar(meal: Meal, antes: DaySchedule[], semana: DaySchedule[], ctx: ContextoPuntaje): Puntaje;
  ```

- [ ] **Step 1: Tests** (cada uno compara dos candidatos sobre la misma semana, no valores absolutos):
  - Suma más plantas nuevas → más puntos; con la semana ya en `META_PLANTAS`, las plantas no suman.
  - Usa un ingrediente que está en `despensa` → más puntos que uno igual sin despensa.
  - Pone carbos en almuerzo y cena del mismo día → menos puntos; con `un-carbo-por-dia` en `reglasOcultas`, no resta.
  - Lleva la roja por encima de `MAX_CARNE_ROJA` → resta; pescado con la semana por debajo de `MIN_PESCADO` → suma; con `frecuencia-carnes` oculta, ninguna de las dos.
  - Fuera de estación pierde contra uno que rompe el chequeo de carbos (orden de pesos).
  - En `recientes` → menos puntos.
  - `motivo` nombra lo que más pesó a favor, con textos como `suma 4 plantas nuevas`, `usa el brócoli de la despensa`, `pescado: van 1 de 2`; sin nada a favor, un texto neutro (`variedad`).
- [ ] **Step 2:** correr. Falla.
- [ ] **Step 3:** implementar. Pesos exactos al builder, respetando el orden de Global Constraints. "Rompe" = `chequearSemana(semana)` peor que `chequearSemana(antes)`.
- [ ] **Step 4:** correr `puntaje.spec.ts` y `catalogo/plantas.spec.ts`. Pasan.
- [ ] **Step 5:** commit `feat(comidas): puntaje del armador de semanas`.

### Task 5: Armar la semana

**Files:**
- Modify: `projects/comidas/src/app/models/meal.model.ts` (`Dish.motivo?: string`)
- Create: `projects/comidas/src/app/armador/armador.ts`
- Test: `projects/comidas/src/app/armador/armador.spec.ts`

**Interfaces:**
- Consumes: `Candidatos` (Task 3), `puntuar`, `ContextoPuntaje` (Task 4).
- Produces:
  ```ts
  export const MAX_DESAYUNO_REPETIDO = 3;
  export type Slot = { dia: number; tipo: DishMealType };
  // En orden: día, y dentro del día desayuno → almuerzo → cena.
  export function slotsVacios(semana: DaySchedule[], desde: number, tipos: readonly DishMealType[]): Slot[];
  export type ResultadoArmador = { semana: DaySchedule[]; puestos: number; sinCandidatos: number };
  export function armarSemana(
    semana: DaySchedule[], desde: number, tipos: readonly DishMealType[],
    candidatos: Candidatos, ctx: ContextoPuntaje, azar: () => number
  ): ResultadoArmador;
  ```

- [ ] **Step 1: Tests** (con `azar = () => 0`):
  - No toca slots con platos (incluido un placeholder), días antes de `desde`, ni tipos fuera de `tipos`; no toca postres ni colación. La semana de entrada no se muta.
  - Cada plato puesto es `{ mealId, portions: 1, excluded: false, motivo }` con `motivo` no vacío.
  - Golozo: la elección del lunes cuenta para el martes (no repite almuerzo/cena; una comida ya puesta por el usuario tampoco se repite).
  - Con 2 candidatos de almuerzo/cena y 4 slots, pone 2 y `sinCandidatos` = 2.
  - Desayuno con 1 candidato y 7 slots: lo pone en los 7 (repite pasando el tope porque no hay otro); con 3 candidatos y 7 slots, ninguno pasa de `MAX_DESAYUNO_REPETIDO`.
  - Con `azar = () => 0.99` puede elegir otro de los tres mejores, nunca uno fuera del top 3.
  - Sin candidatos de desayuno: los desayunos quedan vacíos y cuentan en `sinCandidatos`.
- [ ] **Step 2:** correr. Falla.
- [ ] **Step 3:** implementar. Elección: top 3 por `puntos`, peso positivo derivado del puntaje (p. ej. desplazar por el mínimo + 1), `azar()` contra el peso acumulado.
- [ ] **Step 4:** correr. Pasa.
- [ ] **Step 5:** commit `feat(comidas): armado de la semana con el porqué de cada plato`.

### Task 6: MealService: No como, país, completar y deshacer

**Files:**
- Modify: `projects/comidas/src/app/services/meal.service.ts`
- Modify: `projects/comidas/src/app/services/backup.ts:26` (`'noComo'` en la sección `ajustes`)
- Test: `projects/comidas/src/app/services/meal.service.spec.ts` (y `backup.spec.ts` si cuenta claves)

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces (en `MealService`):
  ```ts
  readonly noComo: WritableSignal<string[]>;
  agregarNoComo(texto: string): boolean;   // false si vacío o repetido (normalizado)
  quitarNoComo(texto: string): void;
  readonly pais: WritableSignal<string | null>;   // null = del timezone
  readonly paisEfectivo: Signal<string>;
  readonly slotsParaCompletar: Signal<Slot[]>;
  completarSemana(azar?: () => number): { puestos: number; sinCandidatos: number };
  readonly puedeDeshacer: Signal<boolean>;
  deshacerCompletar(): void;
  olvidarDeshacer(): void;
  ```

- [ ] **Step 1: Tests:**
  - `completarSemana(() => 0)` llena la semana mostrada y devuelve los conteos; `deshacerCompletar()` la deja igual que antes.
  - Después de `completarSemana`, un `setMeal` cualquiera hace `puedeDeshacer()` false; cambiar de semana (`nextWeek`) también.
  - Cualquier método que modifique los platos de un slot (`setMeal`, `addDish`, `removeDish`, `updateDishPortions`, `updateDishLabel`, el de `excluded`) borra `motivo` de los platos de **ese** slot y de ningún otro.
  - `agregarNoComo(' Cebolla ')` guarda; `agregarNoComo('cebolla')` después devuelve false; la clave sobrevive a recargar desde localStorage.
- [ ] **Step 2:** correr `meal.service.spec.ts`. Falla.
- [ ] **Step 3:** implementar.
  - `noComo`: replicar cada aparición de `guia` / `GUIA_KEY` (clave `comidas_no_como`, effect con `saveToFirestore('noComo')`, `aplicarRemoto`, `estadoActual`, import del backup ~línea 2720).
  - `pais`: campo opcional de `familySettings` en el effect, en `loadFamilySettings`, en `aplicarRemoto` y en el import. `paisEfectivo = pais() ?? paisDeTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)`.
  - `completarSemana`: `desde` con la misma comparación que `partesSemana`; historial = `Object.values(schedules())`; recientes = mealIds de las claves de `currentWeekStart − 7` y `− 14`; `estacionDe(currentWeekStart(), hemisferioDe(paisEfectivo()))`; `reglasOcultas = new Set(guia().ocultas)`.
  - Deshacer: guardar `{ key, antes, despues }` con la referencia del arreglo guardado; `puedeDeshacer = computed(() => snap !== null && schedules()[snap.key] === snap.despues && key de la semana mostrada === snap.key)`.
- [ ] **Step 4:** `pnpm test`. Pasa todo.
- [ ] **Step 5:** commit `feat(comidas): completar semana, deshacer y lista No como en MealService`.

### Task 7: Dashboard y Ajustes

**Files:**
- Modify: `projects/comidas/src/app/components/dashboard/dashboard.component.{ts,html,scss}`
- Modify: `projects/comidas/src/app/components/settings/settings.component.{ts,html,scss}`

**Interfaces:**
- Consumes: Task 6; `reconocido` (Task 1); `PAISES` (Task 2).

- [ ] **Step 1: Dashboard.**
  - Botón `Completar semana` en `.actions-top`, después de `Copiar semana anterior`, `btn-secondary`. Deshabilitado si `slotsParaCompletar().length === 0`, con `title` `No hay comidas vacías para completar`.
  - Al tocar: aviso en línea bajo `.actions-top` con `Puse N comidas` y, si hay, `· M quedaron sin opciones`, más el botón `Deshacer` mientras `puedeDeshacer()`. Implementar `OnDestroy` y llamar `olvidarDeshacer()`.
  - Bajo cada plato con `dish.motivo`, un `<small class="dish-motivo">` con el texto, color `var(--fg-secondary)`. En los tres bloques del template donde se dibujan platos.
- [ ] **Step 2: Ajustes.** Una sección nueva (mismo `lib-panel` / `.settings-content` que las demás), visible sin sesión:
  - **No como:** input + botón Agregar (`agregarNoComo`, Enter también), chips con ✕ (`quitarNoComo`). Si el texto no es `reconocido`, hint bajo el input: `No lo encuentro en el catálogo: sólo se filtra si aparece escrito en un ingrediente.`
  - **País:** `<select>` con `PAISES`, opción inicial `Automático (<nombre del país efectivo>)` que guarda `null`. Mantener 16px de fuente (iOS hace zoom con menos).
- [ ] **Step 3:** `pnpm exec ng lint comidas`, `pnpm test`, `pnpm build`. Pasan.
- [ ] **Step 4:** prueba a mano en el 4200 (`ng serve comidas --port 4200` después de `ng build componentes`; preguntar antes de matar lo que ocupe el puerto): completar una semana con platos ya puestos, ver motivos, deshacer, tocar un slot y ver que el motivo se va, agregar `pescado` a No como y completar de nuevo.
- [ ] **Step 5:** commit `feat(comidas): botón Completar semana y ajustes de No como y país`.

### Task 8: No como en *completar recetas* y docs

**Files:**
- Modify: `projects/comidas/src/app/revision/pedido.ts` (`promptRevision`, sacar el `TODO`)
- Modify: `projects/comidas/src/app/services/revision.service.ts:41`
- Test: `projects/comidas/src/app/revision/pedido.spec.ts`
- Modify: `TODO.md` (armador: entrega 1 hecha), `CLAUDE.md` sólo si algo de esto contradice lo que dice.

**Interfaces:**
- Produces: `promptRevision(recetas: RecetaParaFlash[], noComo: readonly string[] = []): string`.

- [ ] **Step 1: Test:** con `['cebolla', 'gluten']` el prompt contiene ambos textos y una instrucción de no sugerir eso; con `[]` no menciona la lista.
- [ ] **Step 2:** correr `pedido.spec.ts`. Falla.
- [ ] **Step 3:** implementar y pasar `this.mealService.noComo()` desde `RevisionService`.
- [ ] **Step 4:** `pnpm test` y `pnpm exec ng lint comidas`. Pasan.
- [ ] **Step 5:** commit `feat(comidas): completar recetas respeta la lista No como`.
