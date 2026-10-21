# Chequeos de la guía contra la semana — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el plan semanal de comidas marque los días con carbos en almuerzo y cena, cuente pescado / carne blanca / carne roja de la semana (marcando la roja al pasar de 3), y que el tip muestre la regla que no se cumple.

**Architecture:** El catálogo suma `carne` y `menor` a `EntradaCatalogo`. Un módulo puro nuevo, `guia/chequeos.ts`, calcula la semana como `catalogo/plantas.ts`. El dashboard lo consume en un `computed`, filtra por las reglas visibles de la guía y elige el tip con una función pura nueva en `guia/guia.ts`.

**Tech Stack:** Angular 22 (signals, standalone, reactive forms), Vitest vía `@angular/build:unit-test`, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-21-chequeos-guia-design.md`

## Global Constraints

- Todo se corre desde la raíz del repo: `/Users/tatoh/Repos/Personal/la-cueva-de-tatoh`. Branch: `feat/chequeos-guia`.
- pnpm, nunca npm. Sin dependencias nuevas.
- `pnpm lint` tiene que pasar sin tocar la config: tipo de retorno explícito en toda función, nada de `public`, `type` y no `interface`, `curly`, `eqeqeq`, `complexity: 20`, `max-len: 120`, `@if`/`@for` en templates, atributos en orden alfabético por grupo.
- Colores sólo con tokens del tema (`var(--warning)`, `var(--warning-muted)`), nunca hex.
- Comentarios y textos de UI en español rioplatense, en el tono del código que rodea.
- Commits sin `Co-Authored-By` (regla de la organización). No pushear sin que lo pida el usuario.
- Umbrales fijos: carne roja hasta 3, pescado 2 o más, carne blanca 2.
- Una regla oculta en la guía no se chequea ni se muestra.

## Review Focus

- Una corrección propia vieja de "carne vacuna" (guardada sin `carne`) tiene que seguir contando como roja — test en Task 1.
- Elegir "ninguna" para una carne del base en el catálogo propio no tiene que volver a heredar `carne` — test en Task 1.
- Modo familiar: dos platos con carbos en la misma cena, o dos rojas en la misma comida, cuentan una vez — test en Task 2.
- Un plato cuyo `mealId` ya no existe no rompe ni suma — test en Task 2.
- Con todas las reglas ocultas, o con la incumplida oculta, el tip vuelve a la rotación normal (o a nada) — test en Task 3.

---

### Task 1: Catálogo: `carne` y `menor`

**Files:**
- Modify: `projects/comidas/src/app/catalogo/catalogo.ts` (tipo `EntradaCatalogo` ~línea 15, `combinar` ~línea 78, `entradaPropia` ~línea 160)
- Modify: `projects/comidas/src/app/catalogo/catalogo-datos.ts` (~líneas 116, 133, 165-193)
- Modify: `projects/comidas/src/app/catalogo/plato.ts:68-82` (`resumenPlato`)
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.ts:74-112`
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.html:202-206`
- Test: `projects/comidas/src/app/catalogo/catalogo.spec.ts`, `catalogo-datos.spec.ts`, `plato.spec.ts`

**Interfaces:**
- Produces:
  - `export type Carne = 'roja' | 'blanca' | 'pescado';` en `catalogo.ts`
  - `export const ETIQUETA_CARNE: Record<Carne, string> = { roja: 'roja', blanca: 'blanca', pescado: 'pescado' };`
  - En `EntradaCatalogo`: `carne?: Carne | null;` (`null` = "ninguna" explícito, sólo en propias; `undefined` = no dice) y `menor?: boolean;`, con los comentarios del spec.
  - `entradaPropia(nombreFila, existente, valores: { grupo; unidad; porcion; compra?; carne?: Carne | null })`

- [ ] **Step 1: Write the failing tests**

En `catalogo.spec.ts`, dentro de `describe('combinar')`:

```ts
it('una propia vieja sin `carne` hereda la de la base que reemplaza, con el mismo grupo', () => {
  const b: EntradaCatalogo[] = [{ nombre: 'carne vacuna', grupo: 'carnesHuevos', unidad: 'g', carne: 'roja' }];
  const p: EntradaCatalogo[] = [{ nombre: 'carne vacuna', grupo: 'carnesHuevos', unidad: 'g', porcion: 200 }];
  expect(combinar(b, p)).toEqual([{ ...p[0], carne: 'roja' }]);
});

it('no hereda `carne` si la propia cambió de grupo o dijo "ninguna"', () => {
  const b: EntradaCatalogo[] = [{ nombre: 'atún', grupo: 'carnesHuevos', unidad: 'g', carne: 'pescado' }];
  expect(combinar(b, [{ nombre: 'atún', grupo: 'condimentos', unidad: 'g' }])[0].carne).toBeUndefined();
  expect(combinar(b, [{ nombre: 'atún', grupo: 'carnesHuevos', unidad: 'g', carne: null }])[0].carne).toBeNull();
});

it('hereda `menor` con el mismo grupo', () => {
  const b: EntradaCatalogo[] = [{ nombre: 'maicena', grupo: 'feculentos', unidad: 'cda', menor: true }];
  expect(combinar(b, [{ nombre: 'Maicena', grupo: 'feculentos', unidad: 'g' }])[0].menor).toBe(true);
});
```

En `describe('entradaPropia')`:

```ts
it('guarda `carne` sólo en carnesHuevos, y "ninguna" como null', () => {
  const v = { unidad: 'g', porcion: '' };
  expect(entradaPropia('vacío', null, { ...v, grupo: 'carnesHuevos', carne: 'roja' }).carne).toBe('roja');
  expect(entradaPropia('vacío', null, { ...v, grupo: 'carnesHuevos', carne: null }).carne).toBeNull();
  expect(entradaPropia('vacío', null, { ...v, grupo: 'hortalizas', carne: 'roja' })).not.toHaveProperty('carne');
});

it('conserva `menor` si el grupo no cambia', () => {
  const maicena: EntradaCatalogo = { nombre: 'maicena', grupo: 'feculentos', unidad: 'cda', menor: true };
  expect(entradaPropia('maicena', maicena, { grupo: 'feculentos', unidad: 'g', porcion: '' }).menor).toBe(true);
  expect(entradaPropia('maicena', maicena, { grupo: 'pan', unidad: 'g', porcion: '' })).not.toHaveProperty('menor');
});
```

En `catalogo-datos.spec.ts`:

```ts
it('toda carne del base dice qué tipo es, y huevo y clara no', () => {
  const tipo = (n: string): unknown => CATALOGO.find((e) => e.nombre === n)?.carne;
  for (const n of ['carne vacuna', 'carne picada', 'lomo', 'cerdo']) { expect(tipo(n)).toBe('roja'); }
  expect(tipo('pechuga de pollo')).toBe('blanca');
  for (const n of ['pescado', 'atún']) { expect(tipo(n)).toBe('pescado'); }
  for (const n of ['huevo', 'clara']) { expect(tipo(n)).toBeUndefined(); }
  expect(CATALOGO.filter((e) => e.menor).map((e) => e.nombre).sort()).toEqual(['maicena', 'pan rallado']);
});
```

En `plato.spec.ts`, dentro de `describe('resumenPlato')` (armar un índice local con `pan rallado` `{ grupo: 'pan', menor: true }`, `maicena` `{ grupo: 'feculentos', menor: true }`, `lentejas` `{ grupo: 'feculentos', legumbre: true }`, `pollo` `{ grupo: 'carnesHuevos' }`):

```ts
it('lo `menor` no hace feculento al plato ni es el cereal de legumbre + cereal', () => {
  expect(resumenPlato([{ name: 'pollo' }, { name: 'pan rallado' }], i).feculento).toBe(false);
  const lentejas = resumenPlato([{ name: 'lentejas' }, { name: 'maicena' }], i);
  expect(lentejas.feculento).toBe(true); // por las lentejas
  expect(lentejas.proteina).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --watch=false 2>&1 | tail -30`
Expected: FAIL en los tests nuevos (`carne`/`menor` no existen en el tipo, o los valores no coinciden).

- [ ] **Step 3: Implement**

- `catalogo.ts`: tipo `Carne`, `ETIQUETA_CARNE`, los dos campos. En `combinar`, cada propia que reemplaza a una base con el mismo `normalizar(nombre)` y el mismo `grupo` hereda `carne` si la propia lo tiene `undefined`, y `menor` si lo tiene `undefined`. Las demás quedan igual (y el orden de salida no cambia: base sin reemplazadas, después propias).
- `entradaPropia`: `menor` se conserva con `mismoGrupo`, como `legumbre`. `carne` va sólo si `valores.grupo === 'carnesHuevos'` y `valores.carne !== undefined`.
- `catalogo-datos.ts`: los valores de la tabla del spec. `CARNE` no cambia; cada entrada suma su `carne`.
- `plato.ts`: en `resumenPlato`, descartar las entradas `menor` antes de calcular `feculento` y el lado cereal de `legumbreYCereal`.
- `meal-editor`: control `carne: ['' as Carne | '']` en `clasificacion`, precargado con `entrada?.carne ?? ''`; en `guardarClasificacion`, pasar `carne: carne || null`. En el template, después del select de grupo y sólo con `clasificacion.value.grupo === 'carnesHuevos'`, un `<select formControlName="carne" aria-label="Tipo de carne">` con opciones roja / blanca / pescado (de `ETIQUETA_CARNE`) y `<option value="">ninguna</option>`.

- [ ] **Step 4: Run tests and lint**

Run: `pnpm test -- --watch=false 2>&1 | tail -30 && pnpm lint 2>&1 | tail -15`
Expected: todos los tests PASS (incluidos los viejos de `entradaPropia` y `combinar`), lint sin errores.

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/catalogo projects/comidas/src/app/components/meal-editor
git commit -m "feat(comidas): el catálogo distingue carne roja, blanca y pescado"
```

---

### Task 2: `chequearSemana`

**Files:**
- Create: `projects/comidas/src/app/guia/chequeos.ts`
- Test: `projects/comidas/src/app/guia/chequeos.spec.ts`

**Interfaces:**
- Consumes: `Carne`, `clasificar`, `IndiceCatalogo` de Task 1; `DaySchedule`, `Meal` de `models/meal.model`.
- Produces:

```ts
export const MAX_CARNE_ROJA = 3;
export const MIN_PESCADO = 2;
export const META_CARNE_BLANCA = 2;

export type ChequeoSemana = {
  // Días con carbos en almuerzo y cena, por `dayName`.
  diasConDosCarbos: string[];
  carnes: Record<Carne, number>;
  // Ids de las reglas que la semana no cumple, en el orden de `REGLAS`.
  incumplidas: string[];
};

export function chequearSemana(semana: DaySchedule[], meals: Meal[], indice: IndiceCatalogo): ChequeoSemana;
```

- [ ] **Step 1: Write the failing tests**

Helpers como en `plantas.spec.ts` (`comida(id, ...ingredientes)`, y un `dia(dayName, { desayuno?, almuerzo?, cena? })` con arrays de `mealId` o `{ mealId, excluded }`). Índice: `arroz` (feculentos), `lentejas` (feculentos, legumbre), `pan` (pan), `pan rallado` (pan, menor), `maicena` (feculentos, menor), `carne vacuna` (roja), `pollo` (blanca), `merluza` (pescado), `huevo` (carnesHuevos, sin carne), `lechuga` (hortalizas).

Tests en `describe('chequearSemana')`, con `incumplidas` comprobado donde aplica:

- `'marca el día con carbos en almuerzo y cena'`: almuerzo arroz, cena pan → `diasConDosCarbos: ['Lunes']`, `incumplidas` contiene `'un-carbo-por-dia'`.
- `'el desayuno no cuenta para los carbos'`: desayuno pan, almuerzo arroz → `[]`.
- `'las legumbres cuentan como carbos'`: almuerzo lentejas, cena arroz → `['Lunes']`.
- `'dos platos con carbos en la misma cena son una vez'`: cena `[arroz, pan]` → `[]`.
- `'lo menor no cuenta'`: almuerzo `pollo + pan rallado`, cena arroz → `[]`; almuerzo `lechuga + maicena`, cena arroz → `[]`.
- `'cuenta platos excluidos e ignora comidas borradas'`: almuerzo `{ mealId: 'arroz', excluded: true }`, cena `[{ mealId: 'borrada' }, { mealId: 'pan' }]` → `['Lunes']`.
- `'una comida sin ingredientes no suma'`: almuerzo `afuera` (`ingredients: []`), cena arroz → `[]`; carnes todas en 0.
- `'cuenta carnes por comida y por tipo'`: cena con un plato `pollo + carne vacuna` → `{ roja: 1, blanca: 1, pescado: 0 }`.
- `'dos rojas en la misma comida son una vez, y el desayuno cuenta'`: almuerzo `[carne vacuna, carne vacuna]`, desayuno `huevo + carne vacuna` → `roja: 2`.
- `'el huevo no es carne'`: almuerzo huevo → todas en 0.
- `'la roja marca al pasar de 3'`: cuatro días con almuerzo carne vacuna → `roja: 4`, `incumplidas` contiene `'frecuencia-carnes'`; con tres días no lo contiene.
- `'semana vacía'`: `chequearSemana([], [], indice)` → `{ diasConDosCarbos: [], carnes: { roja: 0, blanca: 0, pescado: 0 }, incumplidas: [] }`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --watch=false 2>&1 | tail -30`
Expected: FAIL, `chequeos` no existe.

- [ ] **Step 3: Implement `chequearSemana` in `guia/chequeos.ts`**

Comentario de cabecera apuntando al spec. Una comida (slot) "tiene carbos" si algún plato existente tiene un ingrediente con grupo `feculentos` o `pan` y sin `menor`; "tiene carne X" si alguno tiene uno con `carne === X`. Se cuenta por slot con un `Set<Carne>` por comida, así se deduplica en modo familiar. Postres y colación no se miran.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- --watch=false 2>&1 | tail -30 && pnpm lint 2>&1 | tail -15`
Expected: PASS, lint limpio.

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/guia/chequeos.ts projects/comidas/src/app/guia/chequeos.spec.ts
git commit -m "feat(comidas): chequeos de carbos y carnes sobre la semana"
```

---

### Task 3: Marcas, contador y tip en el plan

**Files:**
- Modify: `projects/comidas/src/app/guia/guia.ts` (función nueva después de `tipDelDia`)
- Test: `projects/comidas/src/app/guia/guia.spec.ts`
- Modify: `projects/comidas/src/app/components/dashboard/dashboard.component.ts:28-46`
- Modify: `projects/comidas/src/app/components/dashboard/dashboard.component.html` (después del botón `.plantas` ~línea 28, y arriba de `.meal-slots` ~línea 148)
- Modify: `projects/comidas/src/app/components/dashboard/dashboard.component.scss` (junto a `.tip` ~línea 653, y el `@media print` ~línea 680)

**Interfaces:**
- Consumes: `chequearSemana`, `ChequeoSemana`, `MAX_CARNE_ROJA`, `MIN_PESCADO`, `META_CARNE_BLANCA` de Task 2.
- Produces: `export function tipDelPlan(reglas: readonly Regla[], incumplidas: readonly string[], fecha: Date, salto: number): Regla | null;` en `guia/guia.ts`.

- [ ] **Step 1: Write the failing tests**

En `guia.spec.ts`, `describe('tipDelPlan')`, con `reglas` = tres reglas de prueba `a`, `b`, `c` y una fecha fija:

- `'con salto 0 muestra la primera incumplida que esté entre las reglas'`: `tipDelPlan(reglas, ['x', 'c', 'b'], fecha, 0)?.id` → `'c'`.
- `'con salto mayor a 0 vuelve a la rotación de tipDelDia'`: `tipDelPlan(reglas, ['c'], fecha, 1)` → igual a `tipDelDia(reglas, fecha, 1)`.
- `'una incumplida oculta no cuenta'`: `tipDelPlan(reglas, ['oculta'], fecha, 0)` → igual a `tipDelDia(reglas, fecha, 0)`.
- `'sin reglas no hay tip'`: `tipDelPlan([], ['a'], fecha, 0)` → `null`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --watch=false 2>&1 | tail -30`
Expected: FAIL, `tipDelPlan` no existe.

- [ ] **Step 3: Implement `tipDelPlan` and wire the dashboard**

- `tipDelPlan`: con `salto === 0`, la primera de `incumplidas` que esté en `reglas` (en el orden de `incumplidas`); si no hay, `tipDelDia(reglas, fecha, salto)`.
- Dashboard: `readonly reglasVisibles = computed(() => armarGuia(REGLAS, this.mealService.guia()).grupos.flatMap((g) => g.reglas))` y reusarlo en `tip`. `readonly chequeo = computed(() => chequearSemana(schedule(), meals(), indiceCatalogo()))`. `tip` pasa a `tipDelPlan(this.reglasVisibles(), this.chequeo().incumplidas, new Date(), this.saltoTip())`. Dos helpers: `chequeoVisible(id: string): boolean` (está en `reglasVisibles`) y `dosCarbos(dayName: string): boolean`. Constantes `maxRoja`, `minPescado`, `metaBlanca` como ya está `metaPlantas`.
- Template, debajo del botón `.plantas`, con `@if (chequeoVisible('frecuencia-carnes'))`:
  `<p class="carnes">Pescado {{ c.pescado }} de {{ minPescado }} · Blanca {{ c.blanca }} de {{ metaBlanca }} · <span [class.excede]="c.roja > maxRoja">Roja {{ c.roja }} de {{ maxRoja }}</span></p>` (con `@let c = chequeo().carnes;` o equivalente).
- Template, primera cosa dentro de `.meal-slots`, con `@if (chequeoVisible('un-carbo-por-dia') && dosCarbos(day.dayName))`: `<p class="marca-dia">Carbos en almuerzo y cena</p>`.
- SCSS: `.carnes` en `--fg-secondary`, `0.85rem`, como `.tip`; `.excede` y `.marca-dia` en `color: var(--warning)`, y `.marca-dia` con `background: var(--warning-muted)`, padding y radio chicos. Sumar `.carnes` y `.marca-dia` al `display: none` del `@media print`.

- [ ] **Step 4: Run tests, lint and build**

Run: `pnpm test -- --watch=false 2>&1 | tail -30 && pnpm lint 2>&1 | tail -15 && pnpm build 2>&1 | tail -15`
Expected: tests PASS, lint limpio, build de las tres sin errores.

- [ ] **Step 5: Verify in the app**

`ng serve comidas` (con `dist/componentes` ya construido por el `pnpm build`; ver la memoria de que `pnpm build` traba un `ng serve` corriendo). Cargar arroz en almuerzo y cena de un día: aparece "Carbos en almuerzo y cena" en ese día y el tip pasa a "Un solo plato con carbohidratos por día." Ocultar esa regla en `/guia`: la marca desaparece y el tip vuelve a rotar. Con cuatro días de carne vacuna, "Roja 4 de 3" en `--warning` y el tip muestra la de frecuencias. Revisar en claro y oscuro, y a 375 px de ancho.

- [ ] **Step 6: Commit**

```bash
git add projects/comidas/src/app/guia projects/comidas/src/app/components/dashboard
git commit -m "feat(comidas): el plan marca carbos dos veces y cuenta las carnes de la semana"
```

---

### Task 4: TODO

**Files:**
- Modify: `TODO.md`

- [ ] **Step 1:** Pasar "Chequeos de la guía contra la semana" a *Hecho*, en el estilo de los otros ítems: qué hace, el link al spec, y lo que quedó afuera (los demás chequeos; `menor` sin control en el formulario). En "Después del catálogo", sacar las frecuencias de las GAPA, que ya están. En "Tips de la guía en el plan", quitar el "Pendiente para cuando existan los chequeos". Si quedó algún `ponytail:` nuevo en el código, sumarlo a la tabla de deuda técnica.
- [ ] **Step 2: Commit**

```bash
git add TODO.md docs/superpowers/specs/2026-10-21-chequeos-guia-design.md
git commit -m "docs(todo): chequeos de la guía pasan a hecho"
```
