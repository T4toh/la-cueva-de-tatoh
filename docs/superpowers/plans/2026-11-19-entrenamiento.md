# Entrenar: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar a Comidas una pestaña **Entrenar** que arma la sesión del día
(caminata, fuerza y movilidad, sin equipo) según el nivel y los minutos
disponibles, la guía en vivo y ajusta la dosis según la respuesta.

**Architecture:** El contenido (ejercicios, plantillas por nivel y día) y la
lógica (escalado a minutos y progresión) son funciones puras en
`projects/comidas/src/app/entrenar/`, con specs. El estado vive en
`MealService` como una clave más (`entrenar`), con el mismo camino que `guia`:
localStorage, `ColaDeGuardado`, Firestore y backup. Hay dos componentes
standalone: `/entrenar` (hoy, nivel e historial) y `/entrenar/sesion` (en
vivo).

**Tech Stack:** Angular 22 standalone + signals, Vitest, Firestore (doc
`users/{uid}`), Web APIs: Wake Lock, `navigator.vibrate` y Web Audio.

**Spec:** `docs/superpowers/specs/2026-11-19-entrenamiento-design.md`

## Global Constraints

- Sin dependencias nuevas.
- Nombres y textos en español, rioplatense.
- `pnpm lint` tiene que pasar sin tocar la config: tipos de retorno
  explícitos, sin `public`, `type` en vez de `interface`, `@if`/`@for`,
  selector `app-`.
- Tests con `CI=1 pnpm test`. Sin `CI=1`, Vitest queda en modo watch.
- Antes de servir la app, correr `ng build componentes`.
- Commits sin `Co-Authored-By` ni firma del agente (pedido de Tatoh y de la
  organización).
- Capturas de Playwright fuera del repo, en `/tmp`.
- Niveles del 1 al 6. Dosis de -2 a +2. Minutos de 20 a 60. Piso de caminata:
  600 s. Historial: las últimas 120 sesiones.
- Día B sin circuito. El circuito del día A no se recorta nunca.
- Una sesión con `completa: false` (menos de la mitad de los minutos
  planeados) cuenta para alternar A y B, pero no mueve la dosis ni la
  propuesta de nivel.
- Aviso fijo en la previa: "Si algo duele (no cansa, duele), cortá."

## Review Focus

1. **Pantalla apagada o app en segundo plano a mitad de un paso.** Al volver,
   el reloj muestra el tiempo real: los pasos por tiempo que ya vencieron se
   saltean y no se sigue desde donde se congeló. Test en la Task 5.
2. **Datos viejos o rotos** en localStorage, Firestore o backup (nivel 9,
   dosis 7, historial que no es array, respuesta desconocida). Se normalizan a
   valores válidos y nunca rompen la pantalla. Test en la Task 3.
3. **Minutos raros en la URL** (`?min=abc`, `5`, `90`). Se ajustan a 20–60, y
   si no es un número se usan 60. Tests en las Tasks 2 y 5.
4. **Navegador sin Wake Lock, sin `vibrate` o sin AudioContext** (Firefox,
   iOS). La sesión anda igual, sin errores. Test en la Task 5.
5. **Terminar sin haber hecho casi nada** (menos de 1 minuto real). No se
   registra ni cambia el estado. Test en la Task 5.

---

### Task 1: Contenido: ejercicios y plantillas

**Files:**
- Create: `projects/comidas/src/app/entrenar/modelo.ts`
- Create: `projects/comidas/src/app/entrenar/ejercicios.ts`
- Create: `projects/comidas/src/app/entrenar/plantillas.ts`
- Test: `projects/comidas/src/app/entrenar/plantillas.spec.ts`

**Interfaces:**
- Produces (`modelo.ts`):
  ```ts
  export type Necesidad = 'banco' | 'piso' | 'pared' | 'tramo-trote';
  export type Ritmo = 'comodo' | 'rapido' | 'trote';
  export type Ejercicio = {
    id: string; nombre: string; como: string;
    necesita?: Necesidad; medida: 'reps' | 'segundos';
  };
  export type Tramo = { ritmo: Ritmo; segundos: number };
  export type Bloque =
    | { tipo: 'caminata'; calentamiento: number; ciclo: Tramo[] }
    | { tipo: 'circuito'; ejercicios: { id: string; dosis: number }[]; vueltas: number; descanso: number }
    | { tipo: 'movilidad'; ejercicios: { id: string; segundos: number }[] };
  export type Dia = 'A' | 'B';
  export type Plantilla = { id: string; nivel: number; dia: Dia; bloques: Bloque[] };
  ```
  En el circuito, `dosis` son reps o segundos según la `medida` del ejercicio.
  En la caminata, `calentamiento` son segundos a paso cómodo y `ciclo` se
  repite para llenar el tiempo.
- Produces: `EJERCICIOS: readonly Ejercicio[]`, `ejercicio(id: string): Ejercicio`
  (tira error si no existe), `PLANTILLAS: readonly Plantilla[]`,
  `plantillaDe(nivel: number, dia: Dia): Plantilla`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
describe('PLANTILLAS', () => {
  it('hay exactamente una A y una B por nivel, del 1 al 6', () => {
    for (let n = 1; n <= 6; n++) {
      for (const d of ['A', 'B'] as const) {
        expect(PLANTILLAS.filter((p) => p.nivel === n && p.dia === d), `${n}${d}`).toHaveLength(1);
      }
    }
    expect(PLANTILLAS).toHaveLength(12);
  });
  it('ids únicos en ejercicios y plantillas', () => { /* Set.size === length en los dos */ });
  it('todo id referenciado existe en EJERCICIOS', () => { /* recorrer circuito y movilidad */ });
  it('el día B no tiene circuito; el A tiene exactamente uno', () => { /* ... */ });
  it('toda plantilla tiene un solo bloque caminata con ciclo no vacío', () => { /* ... */ });
  it('nivel 1 camina solo a paso cómodo; el trote aparece recién en el 4', () => {
    const ritmos = (n: number): Ritmo[] => /* ritmos de los ciclos de A y B del nivel n */;
    expect(new Set(ritmos(1))).toEqual(new Set(['comodo']));
    expect(ritmos(3)).not.toContain('trote');
    expect(ritmos(4)).toContain('trote');
  });
  it('el circuito del nivel 1 tiene una vuelta', () => {
    expect(circuito(plantillaDe(1, 'A')).vueltas).toBe(1);
  });
  it('ningún ejercicio pide equipo fuera de Necesidad', () => { /* necesita ∈ lista o undefined */ });
});
```

- [ ] **Step 2: Correr y confirmar que fallan.** `CI=1 pnpm test -- entrenar/plantillas`. Esperado: FAIL, el módulo no existe.

- [ ] **Step 3: Escribir `modelo.ts`, `ejercicios.ts` y `plantillas.ts`.** El
  contenido sigue la tabla de niveles del spec:
  - N1: sentadilla a banco, flexión en pared y puente de glúteo, 1 vuelta.
  - N2: 2 vueltas facilitadas más plancha corta. Ciclo cómodo/rápido.
  - N3: flexión en banco y zancada atrás, 2 vueltas.
  - N4: sentadilla libre y flexión inclinada baja, 3 vueltas. Ciclo
    caminar/trotar.
  - N5: variantes más duras, 3 vueltas, trote más largo.
  - N6: circuito por tiempo, trote continuo.

  El día B de cada nivel tiene una caminata más larga o con más intervalos,
  más 4 o 5 ejercicios de movilidad de 30–45 s. El `como` de cada ejercicio va
  en una o dos líneas. Es un borrador que Tatoh revisa en la Task 6.

- [ ] **Step 4: Correr y confirmar que pasan.** Mismo comando. Esperado: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(entrenar): ejercicios y plantillas por nivel"`

---

### Task 2: Armar la sesión: escalado a minutos y dosis

**Files:**
- Create: `projects/comidas/src/app/entrenar/sesion.ts`
- Test: `projects/comidas/src/app/entrenar/sesion.spec.ts`

**Interfaces:**
- Consumes: `Plantilla`, `Bloque`, `Necesidad`, `ejercicio()` de la Task 1.
- Produces:
  ```ts
  export type Paso = {
    tipo: 'caminata' | 'ejercicio' | 'descanso' | 'movilidad';
    titulo: string;          // 'Caminá rápido', nombre del ejercicio, 'Descanso'
    detalle?: string;        // `como` del ejercicio
    medida: 'segundos' | 'reps';
    cantidad: number;
    vuelta?: { n: number; de: number };
  };
  export type Sesion = { plantillaId: string; pasos: Paso[]; segundosEstimados: number; necesita: Necesidad[] };
  export const MIN_MINUTOS = 20; export const MAX_MINUTOS = 60; export const PISO_CAMINATA = 600;
  export const SEG_POR_REP = 3;
  export function minutosValidos(v: unknown): number;
  export function armarSesion(p: Plantilla, dosis: number, minutos: number): Sesion;
  ```

Reglas (algoritmo):
1. `minutos` se ajusta a [20, 60]. Presupuesto en segundos = minutos × 60.
2. Dosis: cada punto suma o resta el 15 % (redondeado, mínimo 1) a las reps y
   segundos del circuito y a los segundos de los tramos `rapido` y `trote` del
   ciclo. La movilidad y los tramos `comodo` no cambian con la dosis.
3. Fijo = circuito (reps × `SEG_POR_REP` + segundos + descansos entre
   ejercicios) + movilidad + calentamiento. Caminata = presupuesto − fijo.
4. Si la caminata da menos que `PISO_CAMINATA` (más el calentamiento), primero
   se acorta la movilidad: cada ejercicio baja a 20 s y, si no alcanza, se
   sacan desde el final. Si aun así no alcanza, la caminata queda en el piso y
   la sesión dura más que lo pedido. El circuito no se toca nunca.
5. La caminata empieza con el calentamiento cómodo y después repite el `ciclo`
   hasta cubrir el tiempo. El último ciclo se trunca, y un resto menor a 60 s
   se suma al último tramo cómodo.
6. Orden de los pasos: el de los bloques de la plantilla.
7. `necesita` es la lista sin repetidos de los ejercicios usados, más
   `tramo-trote` si algún tramo es `trote`.

- [ ] **Step 1: Escribir los tests que fallan.**

```ts
it('minutosValidos: número fuera de rango se ajusta; basura da 60', () => {
  expect(minutosValidos('45')).toBe(45); expect(minutosValidos(5)).toBe(20);
  expect(minutosValidos(90)).toBe(60); expect(minutosValidos('abc')).toBe(60);
  expect(minutosValidos(undefined)).toBe(60);
});
it('la duración estimada cubre los minutos pedidos (±60 s) con 30, 45 y 60', () => {
  for (const m of [30, 45, 60]) for (const p of PLANTILLAS)
    expect(Math.abs(armarSesion(p, 0, m).segundosEstimados - m * 60), `${p.id} ${m}`).toBeLessThanOrEqual(60);
});
it('día A: el circuito sale entero aunque sean 20 minutos', () => {
  const p = plantillaDe(4, 'A');
  expect(pasosDeEjercicio(armarSesion(p, 0, 20))).toEqual(pasosDeEjercicio(armarSesion(p, 0, 60)));
});
it('con poco tiempo se recorta primero la movilidad y la caminata no baja de 600 s', () => {
  const s = armarSesion(plantillaDe(1, 'B'), 0, 20);
  expect(segundosDeCaminata(s)).toBeGreaterThanOrEqual(PISO_CAMINATA);
  expect(pasosMovilidad(s).every((x) => x.cantidad >= 20)).toBe(true);
});
it('dosis +2 sube reps y tramos rápidos; -2 los baja; cómodo no cambia', () => { /* comparar con dosis 0 */ });
it('la dosis nunca deja una cantidad en 0', () => { /* todas las plantillas con -2: cantidad >= 1 */ });
it('necesita incluye banco si hay sentadilla a banco y tramo-trote si hay trote', () => { /* N1A y N4B */ });
it('la caminata arranca con el calentamiento cómodo', () => { /* primer paso de caminata: comodo, = calentamiento */ });
```

  Los helpers `pasosDeEjercicio`, `segundosDeCaminata` y `pasosMovilidad` van
  en el spec.

- [ ] **Step 2: Correr y confirmar que fallan.** `CI=1 pnpm test -- entrenar/sesion`. Esperado: FAIL.
- [ ] **Step 3: Implementar `sesion.ts`** según las reglas de arriba.
- [ ] **Step 4: Correr y confirmar que pasan.** Esperado: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(entrenar): sesión escalada a minutos y dosis"`

---

### Task 3: Progresión y estado

**Files:**
- Create: `projects/comidas/src/app/entrenar/progresion.ts`
- Test: `projects/comidas/src/app/entrenar/progresion.spec.ts`

**Interfaces:**
- Consumes: `Dia` de la Task 1.
- Produces:
  ```ts
  export type Respuesta = 'facil' | 'bien' | 'mato';
  export type RegistroSesion = {
    fecha: string; plantilla: string; minutos: number; completa: boolean; respuesta: Respuesta;
  };
  export type EstadoEntrenar = {
    nivel: number; dosis: number; ultimoDia: Dia | null;
    historial: RegistroSesion[];      // más nuevo al final
    propuestaVista: string | null;    // fecha del último registro cuando se dijo "ahora no"
  };
  export const ENTRENAR_INICIAL: EstadoEntrenar; // nivel 1, dosis 0, null, [], null
  export const MAX_HISTORIAL = 120;
  export function normalizarEntrenar(v: unknown): EstadoEntrenar;
  export function esCompleta(minutosReales: number, minutosPlaneados: number): boolean; // >= la mitad
  export function proximoDia(e: EstadoEntrenar): Dia;          // null o B → A; A → B
  export function registrar(e: EstadoEntrenar, r: RegistroSesion, dia: Dia): EstadoEntrenar;
  export function propuestaNivel(e: EstadoEntrenar): 'subir' | 'bajar' | null;
  export function cambiarNivel(e: EstadoEntrenar, nivel: number): EstadoEntrenar; // dosis 0, nivel ajustado a 1–6
  export function descartarPropuesta(e: EstadoEntrenar): EstadoEntrenar;
  ```

`propuestaVista` lo agrega el plan y no está en el spec: sin ese campo, un
"ahora no" no se puede recordar y la propuesta vuelve en cada visita.

Reglas:
- `registrar` agrega `r` al final, recorta a las últimas 120 y pone
  `ultimoDia = dia`. Si `r.completa` es true, la dosis se mueve (+1 para
  `facil`, 0 para `bien`, −1 para `mato`) dentro de [−2, 2].
- `propuestaNivel` mira solo los registros completos. Devuelve `subir` si
  nivel < 6, dosis 2 y las últimas dos respuestas completas son `facil`.
  Devuelve `bajar` si nivel > 1, dosis −2 y las últimas dos son `mato`. Si la
  fecha del último registro es igual a `propuestaVista`, devuelve null.

- [ ] **Step 1: Escribir los tests que fallan.**

```ts
it('normalizar: basura da el estado inicial', () => {
  for (const v of [null, 3, 'x', [], {}]) expect(normalizarEntrenar(v)).toEqual(ENTRENAR_INICIAL);
});
it('normalizar: ajusta nivel y dosis y descarta registros inválidos', () => {
  const e = normalizarEntrenar({ nivel: 9, dosis: 7, ultimoDia: 'C', historial: [
    { fecha: '2026-11-19T10:00:00Z', plantilla: 'n1a', minutos: 40, completa: true, respuesta: 'facil' },
    { fecha: 1, respuesta: 'zzz' }, 'x' ] });
  expect(e.nivel).toBe(6); expect(e.dosis).toBe(2); expect(e.ultimoDia).toBeNull();
  expect(e.historial).toHaveLength(1);
});
it('esCompleta: la mitad justa cuenta', () => {
  expect(esCompleta(20, 40)).toBe(true); expect(esCompleta(19, 40)).toBe(false);
});
it('proximoDia alterna, y arranca en A', () => { /* null→A, A→B, B→A */ });
it('registrar: fácil sube, me mató baja, con tope en ±2', () => { /* ... */ });
it('registrar: una incompleta no mueve la dosis pero sí el día', () => {
  const e = registrar(ENTRENAR_INICIAL, { ...reg, completa: false, respuesta: 'facil' }, 'A');
  expect(e.dosis).toBe(0); expect(e.ultimoDia).toBe('A'); expect(e.historial).toHaveLength(1);
});
it('registrar: el historial no pasa de 120 y se queda con los más nuevos', () => { /* 125 registros */ });
it('propuesta: subir con dosis 2 y dos fáciles completos; una incompleta en el medio no corta', () => { /* ... */ });
it('propuesta: nada en nivel 6 aunque todo sea fácil; nada de bajar en nivel 1', () => { /* ... */ });
it('propuesta: bajar con dosis -2 y dos me mató', () => { /* ... */ });
it('descartar: la propuesta desaparece hasta el próximo registro', () => { /* ... */ });
it('cambiarNivel: dosis vuelve a 0 y el nivel se ajusta a 1–6', () => { /* ... */ });
```

- [ ] **Step 2: Correr y confirmar que fallan.** `CI=1 pnpm test -- entrenar/progresion`. Esperado: FAIL.
- [ ] **Step 3: Implementar `progresion.ts`.**
- [ ] **Step 4: Correr y confirmar que pasan.** Esperado: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(entrenar): dosis, niveles y estado normalizado"`

---

### Task 4: Persistencia en MealService, backup y nav

**Files:**
- Modify: `projects/comidas/src/app/services/meal.service.ts`. Copiar el camino
  de `guia` en estos lugares: la clave (~l.391), la signal (~l.463), el effect
  de guardado (~l.687), el mapa de la bajada (~l.951), el objeto del backup
  (~l.1004), el `load` (~l.1209) y la restauración del backup (~l.2847).
- Modify: `projects/comidas/src/app/services/backup.ts`. Nueva sección
  `{ seccion: 'entrenar', etiqueta: 'Entrenar', claves: ['entrenar'] }` y
  `'entrenar'` en el tipo `SeccionBackup`.
- Modify: `projects/componentes/src/lib/icon/icon.ts` y `icon.html`. Agregar
  `'footprints'` (paths de Lucide `footprints`) a `ICON_NAMES` y un `@case`.
- Modify: `projects/comidas/src/app/app.html`. Pestaña Entrenar después de
  Guía, con `routerLink="/entrenar"` y el ícono `footprints`.
- Modify: `projects/comidas/src/app/app.routes.ts`. Agregar `entrenar` y
  `entrenar/sesion` antes del `**`. Los componentes de las Tasks 5 y 6 se
  crean acá como stubs vacíos para que las rutas compilen.
- Test: `projects/comidas/src/app/services/meal.service.sync.spec.ts`, junto
  a los tests de `guia` (~l.477).

**Interfaces:**
- Consumes: todo lo de la Task 3.
- Produces, en `MealService`:
  ```ts
  readonly entrenar: Signal<EstadoEntrenar>;   // WritableSignal adentro, expuesta readonly
  registrarSesion(r: RegistroSesion, dia: Dia): void;
  cambiarNivelEntrenar(nivel: number): void;
  descartarPropuestaEntrenar(): void;
  ```
  La clave de localStorage es `comidas_entrenar` y la de Firestore,
  `entrenar`.

- [ ] **Step 1: Escribir los tests que fallan** en `meal.service.sync.spec.ts`:
  - `registrarSesion persiste en comidas_entrenar y la recarga lo lee`
  - `una bajada con entrenar roto se normaliza`: `aplicar({ entrenar: { nivel: 'x' } })` → `ENTRENAR_INICIAL`
  - `el backup exporta e importa entrenar`
  - `con entrenar pendiente en la cola, la bajada no lo pisa` (mismo patrón
    que el test existente de `guia`)
- [ ] **Step 2: Correr y confirmar que fallan.** `CI=1 pnpm test -- meal.service.sync`. Esperado: FAIL.
- [ ] **Step 3: Implementar** los cambios en el service, el backup, el ícono,
  el nav y las rutas.
- [ ] **Step 4: Verificar.** `ng build componentes && CI=1 pnpm test && pnpm lint`. Esperado: todo verde.
- [ ] **Step 5: Commit.** `git commit -m "feat(entrenar): estado sincronizado, backup y pestaña"`

---

### Task 5: Sesión en vivo (`/entrenar/sesion`)

**Files:**
- Create: `projects/comidas/src/app/entrenar/reloj.ts`, la lógica pura del
  avance.
- Create: `projects/comidas/src/app/components/entrenar-sesion/entrenar-sesion.component.{ts,html,scss,spec.ts}`
- Test: `projects/comidas/src/app/entrenar/reloj.spec.ts`

**Interfaces:**
- Consumes: `armarSesion`, `minutosValidos` (Task 2); `proximoDia`,
  `esCompleta` (Task 3); `MealService.entrenar`, `registrarSesion` (Task 4).
- Produces (`reloj.ts`):
  ```ts
  export type EstadoReloj = { indice: number; finPaso: number | null; pausadoRestante: number | null };
  // Avanza los pasos por tiempo que vencieron entre finPaso y ahora; un paso de reps frena el avance.
  export function alcanzar(pasos: Paso[], r: EstadoReloj, ahora: number): EstadoReloj;
  export function restante(r: EstadoReloj, ahora: number): number; // ms, >= 0
  ```

Comportamiento:
- Ruta `entrenar/sesion?min=N`. Los minutos salen de `minutosValidos`, la
  plantilla de `plantillaDe(nivel, proximoDia(estado))` y la sesión de
  `armarSesion(…, estado.dosis, min)`.
- Previa: minutos, días y bloques, "Vas a necesitar: …" (texto por
  `Necesidad`: banco → "un escalón o banco", piso → "2 m² de piso", pared →
  "una pared", tramo-trote → "un tramo donde puedas trotar"), el aviso fijo y
  el botón **Arrancar**.
- En vivo: tick cada 250 ms con `alcanzar` y `restante` contra `Date.now()`.
  En un paso de reps se muestra **Listo**. Botones: **Pausa/Seguir**,
  **Saltear** y **Terminar**.
- En cada cambio de paso: `navigator.vibrate?.(200)` y un beep de 150 ms a
  880 Hz con `AudioContext`, creado en el click de Arrancar. Todo con guardas:
  si la API no existe, no pasa nada.
- Wake Lock: copiar `pedirWakeLock`, `soltarWakeLock` y el `visibilitychange`
  de `receta-detalle.component.ts:130-165`. Pedirlo al arrancar y soltarlo al
  terminar o en `ngOnDestroy`. En `visibilitychange` a visible, además,
  correr `alcanzar`.
- Fin (último paso o Terminar): minutos reales = (ahora − inicio − pausas) /
  60000. Si es menos de 1, se vuelve a `/entrenar` sin registrar. Si no, se
  muestran tres botones (Fácil, Bien, Me mató) que llaman a
  `registrarSesion({ fecha: new Date().toISOString(), plantilla, minutos: redondeado,
  completa: esCompleta(reales, min), respuesta }, dia)` y navegan a
  `/entrenar`.

- [ ] **Step 1: Escribir los tests que fallan** de `reloj.spec.ts`:
  - `alcanzar salta varios pasos vencidos de una` (pantalla apagada 5 min → índice correcto y finPaso del paso actual)
  - `alcanzar frena en un paso de reps`
  - `pausado no avanza; restante devuelve pausadoRestante`
  - `restante nunca es negativo`
- [ ] **Step 2: Escribir los tests que fallan** del componente, con
  `vi.useFakeTimers()` y `vi.setSystemTime`:
  - `?min=abc arma una sesión de 60 minutos`
  - `sin wakeLock, vibrate ni AudioContext, arrancar y avanzar no tira errores` (borrarlos de `navigator`/`window` en el test)
  - `al pasar de paso vibra 200 ms` (stub de `navigator.vibrate`)
  - `terminar a los 30 s no registra` (spy en `registrarSesion`: no llamado; navega a `/entrenar`)
  - `terminar a los 25 de 40 minutos registra completa: true con la respuesta elegida`
- [ ] **Step 3: Correr y confirmar que fallan.** `CI=1 pnpm test -- entrenar`. Esperado: FAIL.
- [ ] **Step 4: Implementar** `reloj.ts` y el componente. Estilos con tokens
  de `_tema.scss`: número grande para la cuenta, botones grandes para usar
  caminando.
- [ ] **Step 5: Verificar.** `CI=1 pnpm test && pnpm lint`. Esperado: verde.
- [ ] **Step 6: Commit.** `git commit -m "feat(entrenar): sesión guiada en vivo"`

---

### Task 6: Pantalla `/entrenar` y prueba en el teléfono

**Files:**
- Create: `projects/comidas/src/app/components/entrenar/entrenar.component.{ts,html,scss,spec.ts}`

**Interfaces:**
- Consumes: `MealService.entrenar`, `cambiarNivelEntrenar`,
  `descartarPropuestaEntrenar` (Task 4); `propuestaNivel`, `proximoDia`
  (Task 3); `plantillaDe` (Task 1); `armarSesion` (Task 2).

Contenido de la pantalla, de arriba a abajo:
1. Nivel actual con un selector del 1 al 6 (cambio manual), y la dosis
   mostrada como "Nivel 3 · +1".
2. Si `propuestaNivel` da algo, un banner: "Venís sobrado: ¿subimos al nivel
   4?" con los botones **Subir** y **Ahora no**. Si es bajar: "Viene pesado:
   ¿bajamos al 2?".
3. Hoy: día A o B con un resumen de una línea, un slider de minutos de 20 a 60
   de a 5 (default 60) y el botón **Empezar**, que navega a
   `/entrenar/sesion?min=N`.
4. Historial: las últimas 10 sesiones con fecha, plantilla, minutos y
   respuesta. Las incompletas van marcadas.

- [ ] **Step 1: Escribir los tests que fallan:**
  - `muestra el banner de subir con dosis 2 y dos fáciles, y Subir pasa a nivel+1`
  - `Ahora no oculta el banner`
  - `Empezar navega con los minutos del slider`
  - `historial vacío muestra "Todavía no entrenaste"`
- [ ] **Step 2: Correr y confirmar que fallan.** `CI=1 pnpm test -- components/entrenar`. Esperado: FAIL.
- [ ] **Step 3: Implementar el componente.**
- [ ] **Step 4: Verificar.** `pnpm build && CI=1 pnpm test && pnpm lint && pnpm check:sw`. Esperado: verde.
- [ ] **Step 5: Revisión visual.** `ng serve comidas` y Playwright con
  viewport de teléfono: `/entrenar` y una sesión de 20 minutos con el reloj
  adelantado. Capturas en `/tmp`, en claro y en oscuro.
- [ ] **Step 6: Commit.** `git commit -m "feat(entrenar): pantalla de hoy, nivel e historial"`
- [ ] **Step 7: Entrega a Tatoh.** Push de la rama y PR, sin co-autor. En el
  PR, listar los textos de ejercicios y las dosis por nivel para que los
  corrija, y pedirle que pruebe una sesión en el POCO con la pantalla
  prendida. El merge y el deploy los hace él.
