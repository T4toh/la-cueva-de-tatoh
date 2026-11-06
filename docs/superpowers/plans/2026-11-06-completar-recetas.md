# Completar recetas con Flash — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un botón "Revisar recetario" que le pregunta a Gemini Flash qué recetas quedan cortas como comida, guarda sus sugerencias (ingredientes con cantidad) en cada receta, las marca en el recetario y deja sumarlas con un botón.

**Architecture:** Toda la lógica es pura y vive en `projects/comidas/src/app/revision/` (firma, estado, armado del pedido, validación de la respuesta, tandas), probada con Vitest. Un `RevisionService` delgado conecta eso con Firebase AI Logic (`firebase/ai`) y con `MealService.meals`. "Sin revisar" no se guarda: se deriva comparando la firma guardada con la del contenido actual, así el editor no necesita cambios.

**Tech Stack:** Angular 22 (standalone, signals), `firebase` 12.18 (`firebase/ai`, `firebase/app-check`), `@angular/fire` 20.0.1 (`provideAppCheck`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-completar-recetas-design.md`

## Global Constraints

- Sin dependencias nuevas: `firebase/ai` y `firebase/app-check` ya vienen en `firebase` 12.18.0; `@angular/fire/app-check` ya está.
- Modelo: `gemini-flash-latest`, backend `GoogleAIBackend` (Gemini Developer API, plan Spark).
- App Check: `ReCaptchaEnterpriseProvider` con el site key de la consola (pedírselo al usuario antes de la Task 3; no está en el repo). En dev, debug token (`self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` antes de inicializar).
- Tope: 3 sugerencias por receta. Cantidades por **una porción**.
- Sólo con sesión iniciada (`AuthService.currentUser()` truthy). Sin sesión, botón deshabilitado con el texto exacto: `Iniciá sesión para revisar tu recetario`.
- Aviso fijo junto al botón (texto a criterio, debe decir que en el free tier Google puede usar los pedidos para entrenar).
- Firma = nombre + tags + ingredientes (`name`, `quantity`, `unit`; **no** `checked`). Foto, `includeInShoppingList`, catálogo: no entran.
- `RecetaPublica` es lista blanca: `revision` no debe aparecer ahí (no tocar `receta-publica.ts`).
- ESLint estricto del repo (`pnpm lint`): tipos de retorno explícitos, `type` y no `interface`, `@if/@for`, orden de atributos, `max-len 120`. Colores sólo con tokens de `_tema.scss`.
- Commits **sin** línea `Co-Authored-By` (regla de la organización).
- Verificación local en el puerto **4200** (la API key está restringida por referer y el login sólo anda ahí). Preguntar antes de matar lo que ocupe el puerto.

## Review Focus

1. **La receta se edita mientras el pedido está en vuelo**: al llegar la respuesta, se guarda con la firma de lo *enviado*, así queda sin revisar y no muestra sugerencias viejas. Test en Task 1 (`aplicarRevisiones`).
2. **Cantidad que `parseQuantity` no entiende** (`"½"`, `"un poco"`): la sugerencia se descarta, porque si no rompe la multiplicación en compras. Test en Task 2 (`validarRespuesta`).
3. **Receta sin ingredientes** (el placeholder "Comida afuera", `ID_AFUERA`): no se manda nunca ni cuenta como sin revisar, si no el botón siempre tiene algo pendiente. Test en Task 1 (`recetasSinRevisar`).
4. **Falla una tanda a mitad de camino** (cuota, red): las tandas ya respondidas quedan guardadas y las demás siguen sin revisar. Test en Task 2 (`revisarEnTandas`).
5. **Flash devuelve basura**: id no enviado, id repetido, `corta: true` sin sugerencias válidas, más de 3 sugerencias. Lo inválido se descarta, y una receta sin entrada válida queda sin revisar. Test en Task 2.

---

### Task 1: Modelo y estado de revisión

**Files:**
- Modify: `projects/comidas/src/app/models/meal.model.ts` (agregar tipos y campo `revision?` a `Meal`)
- Create: `projects/comidas/src/app/revision/revision.ts`
- Test: `projects/comidas/src/app/revision/revision.spec.ts`

**Interfaces:**
- Produces (en `meal.model.ts`):
  ```ts
  export type SugerenciaReceta = { name: string; quantity: string; unit?: string; motivo: string };
  export type RevisionReceta = { firma: string; corta: boolean; sugerencias: SugerenciaReceta[] };
  // Meal: revision?: RevisionReceta;
  ```
- Produces (en `revision/revision.ts`):
  ```ts
  export type EstadoRevision = 'no-aplica' | 'sin-revisar' | 'corta' | 'ok';
  export type ResultadoReceta = { id: string; firma: string; corta: boolean; sugerencias: SugerenciaReceta[] };
  export function firmaReceta(meal: Pick<Meal, 'name' | 'tags' | 'ingredients'>): string;
  export function estadoRevision(meal: Meal): EstadoRevision;
  export function recetasSinRevisar(meals: Meal[]): Meal[];
  export function aplicarRevisiones(meals: Meal[], resultados: ResultadoReceta[]): Meal[];
  export function sumarSugerencia(meal: Meal, indice: number): Meal;
  export function descartarSugerencias(meal: Meal): Meal;
  ```

Reglas de `estadoRevision`: sin ingredientes da `'no-aplica'`. Sin `revision` o con firma distinta de `firmaReceta(meal)` da `'sin-revisar'`. Con `corta` y al menos una sugerencia da `'corta'`. Lo demás da `'ok'`.

- [ ] **Step 1: Escribir los tests que fallan** en `revision.spec.ts` (fixture: el okonomiyaki: `cebolla 1/2 unidad`, `queso 30 g`, `huevo 2 unidad`, `repollo 1 taza`):
  - `firmaReceta` es igual si cambian `checked`, `foto` o `includeInShoppingList`, y distinta si cambian nombre, un tag, `quantity` o `unit`. El orden de los tags no cambia la firma.
  - `estadoRevision`: sin `revision` da `'sin-revisar'`. Con una revisión de firma vieja da `'sin-revisar'`. Con `corta: true` y 2 sugerencias da `'corta'`. Con `corta: true` y `[]` da `'ok'`. Con `corta: false` da `'ok'`. Con `ingredients: []` da `'no-aplica'`.
  - `recetasSinRevisar` excluye `'no-aplica'`, `'corta'` y `'ok'`.
  - `aplicarRevisiones` guarda la revisión en la receta con ese id y deja las demás igual (misma referencia). Si el id no existe, lo ignora. **Review Focus 1:** si la receta cambió después de calcular `firma`, `estadoRevision` del resultado da `'sin-revisar'`.
  - `sumarSugerencia(meal, 0)` agrega `{name, quantity, unit}` (sin `motivo`) al final de `ingredients`, saca esa sugerencia y recalcula la firma, así `estadoRevision` sigue siendo `'corta'` si quedan otras. Al sumar la última, da `'ok'`.
  - `descartarSugerencias` deja `sugerencias: []` y conserva la firma, así que da `'ok'`.
- [ ] **Step 2:** `pnpm exec ng test comidas --include='**/revision/revision.spec.ts'`. Debe fallar porque no existe el módulo.
- [ ] **Step 3:** Agregar los tipos a `meal.model.ts` e implementar `revision.ts`. Firma: FNV-1a de 32 bits en hex sobre `JSON.stringify([name.trim(), [...tags].sort(), ingredients.map(i => [i.name.trim(), i.quantity, i.unit ?? ''])])`. Tiene que ser síncrona y corta, porque va en el documento de Firestore del usuario.
- [ ] **Step 4:** Correr el mismo comando. Expected: PASS.
- [ ] **Step 5:** `git commit -m "feat(comidas): estado de revisión de recetas"`

### Task 2: Pedido a Flash: resumen, esquema, validación y tandas

**Files:**
- Create: `projects/comidas/src/app/revision/pedido.ts`
- Test: `projects/comidas/src/app/revision/pedido.spec.ts`

**Interfaces:**
- Consumes: `firmaReceta`, `ResultadoReceta` (Task 1); `resumenPlato` (`catalogo/plato.ts`); `clasificar`, `IndiceCatalogo` (`catalogo/catalogo.ts`); `parseQuantity` (`services/meal.service.ts`).
- Produces:
  ```ts
  export const MAX_SUGERENCIAS = 3;
  export const TAMANO_TANDA = 40;
  export type RecetaParaFlash = {
    id: string; nombre: string; tags: string[];
    ingredientes: { nombre: string; cantidad: string; unidad?: string; porcionReferencia?: string }[];
    grupos: { verdura: boolean; proteina: boolean; feculento: boolean; aceite: boolean };
  };
  export function resumenParaFlash(meal: Meal, indice: IndiceCatalogo): RecetaParaFlash;
  export function promptRevision(recetas: RecetaParaFlash[]): string;
  export function esquemaRespuesta(ids: string[]): ObjectSchema; // de 'firebase/ai'
  export function validarRespuesta(raw: unknown, enviadas: Meal[]): ResultadoReceta[];
  export type Pedir = (recetas: RecetaParaFlash[], ids: string[]) => Promise<unknown>;
  export type ResultadoTandas = { resultados: ResultadoReceta[]; error: unknown | null };
  export function revisarEnTandas(meals: Meal[], indice: IndiceCatalogo, pedir: Pedir): Promise<ResultadoTandas>;
  ```

Forma de la respuesta (el esquema la impone): `{ recetas: [{ id: enum(ids), corta: boolean, sugerencias: [{ name, quantity, unit?, motivo }] }] }`, con `unit` en `optionalProperties`.

El prompt va en español y tiene que decir:
- Que las cantidades son por una porción.
- Que se juzga si el plato alcanza como comida para lo que es: un postre, una salsa o una colación no "quedan cortos".
- Que la idea es completar, no reescribir: sumar ingredientes adentro, arriba o al costado, sin reemplazar ni cambiar el estilo.
- Que son como máximo 3 sugerencias, con cantidad numérica (`1`, `0.5`, `1/2`), y `motivo` de una línea que diga dónde va.
- Que los `grupos` y la `porcionReferencia` los calculó la app y son una ayuda, no la regla.

Dejar en `promptRevision` un `// TODO: lista "No como" (spec del armador)`. Todavía no se manda nada.

- [ ] **Step 1: Escribir los tests que fallan** en `pedido.spec.ts`:
  - `resumenParaFlash` del okonomiyaki: no manda `pasos`, `foto`, `publicId` ni `description`. `huevo` lleva `porcionReferencia: 'ref. 1 unidad por persona'` (vía `textoReferencia`). `repollo` no lleva porción de referencia. `grupos.verdura === true`.
  - `promptRevision` incluye el JSON de las recetas y la frase "por una porción".
  - `validarRespuesta` (**Review Focus 2 y 5**), con `enviadas = [okonomiyaki, ensalada]`:
    - Una respuesta válida da `ResultadoReceta` con `firma === firmaReceta(enviada)`.
    - Un id no enviado se descarta. Un id repetido se queda con el primero.
    - Una sugerencia con `quantity: '½'` o `'un poco'` (donde `parseQuantity` da `null`) se descarta, y lo mismo una con `name` vacío.
    - Con 5 sugerencias válidas se queda con 3.
    - `corta: true` sin sugerencias válidas no produce resultado para ese id, así queda sin revisar.
    - `corta: false` produce `sugerencias: []`.
    - Si `raw` no es un objeto con `recetas` array, da `[]`.
  - `revisarEnTandas` (**Review Focus 4**), con 85 recetas y un `pedir` falso que responde `corta: false` para todos los ids recibidos: llama 3 veces (40 + 40 + 5) y devuelve 85 resultados con `error: null`. Si la segunda llamada rechaza, devuelve los 40 de la primera, `error` con el rechazo, y no hace la tercera.
- [ ] **Step 2:** `pnpm exec ng test comidas --include='**/revision/pedido.spec.ts'`. Debe fallar porque no existe el módulo.
- [ ] **Step 3:** Implementar `pedido.ts`. `esquemaRespuesta` con `Schema.object` / `Schema.array` / `Schema.enumString({ enum: ids })` de `firebase/ai`.
- [ ] **Step 4:** Correr el mismo comando. Expected: PASS.
- [ ] **Step 5:** `git commit -m "feat(comidas): pedido de revisión a Flash"`

### Task 3: App Check y RevisionService

Antes de empezar, pedirle al usuario el site key de reCAPTCHA Enterprise de la consola de Firebase (App Check → la app web).

**Files:**
- Modify: `projects/comidas/src/app/app.config.ts` (agregar `provideAppCheck` después de `provideFirebaseApp`)
- Create: `projects/comidas/src/app/services/revision.service.ts`

**Interfaces:**
- Consumes: `recetasSinRevisar`, `aplicarRevisiones` (Task 1); `revisarEnTandas`, `promptRevision`, `esquemaRespuesta`, `Pedir` (Task 2); `MealService.meals`, `MealService.indiceCatalogo`; `AuthService.currentUser`.
- Produces:
  ```ts
  @Injectable({ providedIn: 'root' })
  export class RevisionService {
    readonly revisando: Signal<boolean>;
    readonly pendientes: Signal<number>;            // recetasSinRevisar(meals).length
    readonly puede: Signal<boolean>;                // hay sesión
    revisar(): Promise<{ revisadas: number; error: string | null }>;
  }
  ```

`revisar()` no hace nada si `revisando()` es `true`, si `!puede()` o si `pendientes() === 0`. Llama a `revisarEnTandas` con un `Pedir` que usa `getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), { model: 'gemini-flash-latest', generationConfig: { responseMimeType: 'application/json', responseSchema: esquemaRespuesta(ids) } })` y `JSON.parse(result.response.text())`. Aplica con **un solo** `meals.update(m => aplicarRevisiones(m, resultados))`, incluso con error parcial. Traduce el error a un texto para el usuario: sin red, sin cuota (`429` / `RESOURCE_EXHAUSTED`) o respuesta ilegible. El `app` sale de `inject(FirebaseApp)` (`@angular/fire/app`).

En `app.config.ts`, antes de `initializeAppCheck`: `if (isDevMode()) { (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true; }`. Usar `provideAppCheck(() => initializeAppCheck(getApp(), { provider: new ReCaptchaEnterpriseProvider(SITE_KEY), isTokenAutoRefreshEnabled: true }))`.

- [ ] **Step 1:** Implementar las dos piezas. La lógica ya está probada en las Tasks 1 y 2, y el servicio es cableado.
- [ ] **Step 2:** `pnpm test` y `pnpm exec ng lint comidas`. Expected: todo pasa, porque `app.config.spec.ts` sigue verde.
- [ ] **Step 3:** `git commit -m "feat(comidas): App Check y servicio de revisión con Flash"`

### Task 4: UI en el recetario y en la receta

**Files:**
- Modify: `projects/comidas/src/app/components/meal-list/meal-list.component.{ts,html,scss}`: botón, aviso, mensaje de resultado
- Modify: `projects/comidas/src/app/components/meal-card/meal-card.component.{ts,html,scss}`: marca cuando `estadoRevision(meal()) === 'corta'`
- Modify: `projects/comidas/src/app/components/receta-view/receta-view.component.{ts,html,scss}`: panel de sugerencias

**Interfaces:**
- Consumes: `RevisionService` (Task 3); `estadoRevision`, `sumarSugerencia`, `descartarSugerencias` (Task 1); `MealService.updateMeal(id, partial)`.

Comportamiento:
- **Recetario:** botón "Revisar recetario" con contador de `pendientes()`.
  - Deshabilitado sin sesión, con el texto exacto de Global Constraints.
  - Con `pendientes() === 0` dice que no hay recetas sin revisar.
  - Mientras `revisando()`, muestra estado de carga.
  - Al terminar, muestra "N recetas revisadas" o el error.
  - El aviso del free tier va siempre visible al lado.
- **Tarjeta:** una marca chica ("Para completar") en las recetas `'corta'`.
- **Receta (`/meals/:id`):** si está `'corta'`, una sección "Para completarla". Cada sugerencia muestra `quantity unit name` y el `motivo`, con un botón "Sumar". Al final va "No, gracias".
  - "Sumar" llama a `updateMeal(id, sumarSugerencia(meal, i))`.
  - "No, gracias" llama a `updateMeal(id, descartarSugerencias(meal))`.
  - Usar los botones y tokens de tema existentes.

- [ ] **Step 1:** Implementar.
- [ ] **Step 2:** `pnpm exec ng lint comidas` y `pnpm test`. Expected: pasa.
- [ ] **Step 3:** `pnpm build`. Expected: build OK (componentes, luego perfil-personal, luego comidas).
- [ ] **Step 4:** `git commit -m "feat(comidas): revisar recetario y sumar sugerencias"`

### Task 5: Prueba real y enforce (manual, con el usuario)

- [ ] **Step 1:** `ng serve comidas --port 4200`, con `componentes` ya buildeado. Antes, preguntar si el puerto está ocupado. Copiar el debug token de App Check que aparece en la consola del navegador y pedirle al usuario que lo registre en Firebase Console (App Check → la app → Administrar tokens de depuración).
- [ ] **Step 2:** Con el usuario logueado, tocar "Revisar recetario" y verificar:
  - El okonomiyaki sale marcado, con sugerencias que tienen cantidad.
  - "Sumar" lo agrega a los ingredientes y la sugerencia desaparece.
  - Editar la receta en el editor la deja sin revisar (el contador sube).
  - Una segunda pasada manda sólo esa receta.
- [ ] **Step 3:** El usuario activa el enforce de App Check **sólo para Firebase AI Logic** en la consola. Repetir el Step 2 en local con debug token, y después de deployar, una pasada en `comidas.tatoh.ar`. Si falla con enforce, desactivarlo y diagnosticar antes de seguir.
