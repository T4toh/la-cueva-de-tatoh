# Lista de compras por día — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la lista de compras de comidas diga de qué día es cada cosa, tenga vista por góndola y por día, y se tilde por ingrediente y por día.

**Architecture:** El servicio arma "partes" (ingrediente × día) antes de sumar; la lista por góndola y la por día salen de esas partes. Las claves de tilde pasan a `clave@fecha` / `clave@manual` sin cambiar la forma de lo persistido. Lo puro (claves, reparto de despensa, texto de copiar) vive en `app/compras/`, testeado sin TestBed.

**Tech Stack:** Angular 22 (signals, standalone, control flow), Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-05-lista-por-dia-design.md`

## Global Constraints

- `pnpm lint` debe pasar sin tocar `eslint.config.js`: tipos de retorno explícitos, sin `public`, `type` en vez de `interface`, `@if`/`@for`, orden alfabético de atributos en templates, `max-len: 120`, `complexity: 20`.
- `ng build componentes` antes de `pnpm test` / `ng serve comidas` si `dist/componentes` no existe.
- No cambia la forma de `checkedItems` (`Record<string, string[]>`) ni de `compras` (`Record<string, Record<string, CompraRegistrada>>`): sólo las claves. `CompraRegistrada` suma `dias?: string[]` opcional. Sin cambios en `services/backup.ts` ni en reglas de Firestore.
- Claves: parte con día `` `${clave}@${fecha}` ``, parte manual `` `${clave}@manual` ``; `clave` es `claveCompra(nombre)`; `fecha` es `formatDateKey(fechaDelDía)`. Nunca se escriben claves sin `@`.
- Una clave sin `@` (guardada antes) en `checkedItems` o `compras` de la semana cuenta como todas las partes de ese renglón tildadas.
- Días abreviados para copiar/chips: `lun`, `mar`, `mié`, `jue`, `vie`, `sáb`, `dom` (chips con mayúscula inicial: `Lun`…).
- Colores sólo con tokens de `_tema.scss` (ver CLAUDE.md, sección Tema).
- La vista elegida se guarda en `localStorage` con la clave `comidas_vista_lista` (`'gondola' | 'dia'`), con try/catch; por defecto `'gondola'`.
- Commits sin línea `Co-Authored-By` (regla de la organización).

## Review Focus

1. **Zona horaria:** `formatDateKey` usa `toISOString`, así que en UTC+ la `fecha` de un día puede ser la del día anterior. Las etiquetas (`lun`, "Lunes 9") se sacan del `dayName` y de `Date#getDate()` local, nunca parseando `fecha`. Test en Task 2.
2. **Unidades mezcladas entre días** (100 g el lunes, 1 unidad el martes): el renglón queda como texto "100 g + 1 unidad" (como hoy), el reparto de despensa no lo toca, tildar no rompe. Test en Task 2.
3. **Compra que abarca un día que ya pasó:** el registro está bajo la clave de la primera parte (puede ser de un día pasado) con `dias`; destildar desde una parte futura igual lo encuentra y resta la sobra una vez. Test en Task 3.
4. **Plato sacado del plan después de tildar:** claves huérfanas en `checkedItems`/`compras` se ignoran al armar la lista; no tildan partes nuevas ni rompen. Test en Task 3.
5. **Ingrediente sin cantidad:** tildar marca las partes aunque no haya registro (compra 0), y destildar las desmarca. Test en Task 3.

---

### Task 1: Funciones puras de partes

**Files:**
- Create: `projects/comidas/src/app/compras/partes.ts`
- Test: `projects/comidas/src/app/compras/partes.spec.ts`

**Interfaces:**
- Produces:
  - `type ParteCompra = { clave: string; nombre: string; fecha: string | null; dia: string | null; diaDelMes: number | null; quantity: string; unit?: string; tagId?: string; platos: string[] }` — `dia` es el `dayName` ('Lunes'…), `null` en manuales.
  - `claveParte(clave: string, fecha: string | null): string`
  - `estaTildada(clave: string, fecha: string | null, tildadas: readonly string[]): boolean` — true si está `claveParte(clave, fecha)` o la `clave` pelada.
  - `repartirDespensa(necesario: number[], disponible: number): number[]` — devuelve lo que falta de cada uno, en el mismo orden (0 = cubierto).
  - `diaCorto(dayName: string): string` — 'Miércoles' → 'mié'.

- [ ] **Step 1: Tests**

```ts
describe('claveParte', () => {
  it('con día y manual', () => {
    expect(claveParte('cebolla', '2026-11-09')).toBe('cebolla@2026-11-09');
    expect(claveParte('cebolla', null)).toBe('cebolla@manual');
  });
});
describe('estaTildada', () => {
  it('por su clave o por la pelada de antes', () => {
    expect(estaTildada('cebolla', '2026-11-09', ['cebolla@2026-11-09'])).toBe(true);
    expect(estaTildada('cebolla', '2026-11-10', ['cebolla@2026-11-09'])).toBe(false);
    expect(estaTildada('cebolla', null, ['cebolla'])).toBe(true);
    expect(estaTildada('cebolla', null, ['cebolla@2026-11-09'])).toBe(false);
  });
});
describe('repartirDespensa', () => {
  it('cubre en orden y deja el resto', () => {
    expect(repartirDespensa([0.5, 0.5, 1], 0.75)).toEqual([0, 0.25, 1]);
    expect(repartirDespensa([0.5], 0)).toEqual([0.5]);
    expect(repartirDespensa([], 3)).toEqual([]);
  });
  it('no se pasa de largo por coma flotante', () => {
    expect(repartirDespensa([0.1, 0.2], 0.3)).toEqual([0, 0]);
  });
});
describe('diaCorto', () => {
  it('abrevia con tilde', () => {
    expect(['Lunes', 'Miércoles', 'Sábado'].map(diaCorto)).toEqual(['lun', 'mié', 'sáb']);
  });
});
```

- [ ] **Step 2:** `pnpm test -- --run src/app/compras/partes.spec.ts` → FAIL (módulo no existe).
- [ ] **Step 3: Implementar** en `compras/partes.ts`. `repartirDespensa` con tolerancia `1e-9` (la misma de `aComprar`): falta ≤ 1e-9 cuenta como 0.
- [ ] **Step 4:** el mismo comando → PASS.
- [ ] **Step 5: Commit** `feat(comidas): claves y reparto de despensa por día`

---

### Task 2: El servicio arma partes y la lista por góndola sale de ellas

**Files:**
- Modify: `projects/comidas/src/app/models/meal.model.ts` (`ShoppingItem`, `CompraRegistrada`)
- Modify: `projects/comidas/src/app/services/meal.service.ts` (`shoppingListGrouped` ~1782, `ajustarRenglon` ~1886, `restarDespensa` ~1905)
- Test: `projects/comidas/src/app/services/meal.service.sync.spec.ts` (nuevo `describe('MealService: lista por día')`)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `ShoppingItem` suma `dias?: string[]` (dayName de las partes **pendientes**, en orden) y `diasComprados?: string[]` (dayName de las tildadas).
  - `CompraRegistrada` suma `dias?: string[]` (claves de parte de la misma compra, además de la clave bajo la que está guardado).
  - `MealService.partesSemana: Signal<ParteCompra[]>` — computed; días desde hoy (como hoy), sin `excluded`, mismo ingrediente en el mismo día sumado en una parte (`sumarAlRenglon` / `unirPartes`), `platos` con los nombres de las comidas, manuales con `fecha: null`.
  - `shoppingListGrouped` mantiene su tipo (`ShoppingListGroup[]`) y la semántica de hoy para un renglón sin tildes.

Reglas de un renglón (por `clave`), en este orden:
1. Partes con registro (bajo su clave, en `dias` de otro registro, o clave pelada en `compras`) no restan despensa.
2. Las demás, en orden de fecha (manuales al final), reparten la despensa con `repartirDespensa`; si la unidad de la despensa o de alguna parte no es compatible (mismo criterio que `subtractPantryFromNeeded`), no se reparte nada (comportamiento de hoy con unidades distintas).
3. Pendientes = partes no tildadas (`estaTildada`) y no cubiertas. El renglón muestra la suma de lo que les falta, con override o redondeo como hoy (`redondear`).
4. Si no quedan pendientes, `checked: true`; si hay registros, `quantityOverride` es la suma de sus `compra` y `sobra` la de sus `sobra` (con una sola compra queda idéntico a hoy).

- [ ] **Step 1: Tests** (TestBed, como el `describe` de lista redondeada; `service.todayTimestamp.set(service.currentWeekStart().getTime())` para que cuenten los 7 días; comidas con `addMeal` + `setMeal`):
  - `'el mismo ingrediente en dos días son dos partes, y en dos platos del mismo día una'` — cebolla 0.5 unidad en almuerzo y cena del lunes y 0.5 el martes → `partesSemana()` tiene 2 partes de `cebolla`: lunes `1 unidad` con dos `platos`, martes `0.5 unidad`.
  - `'excluded y los días pasados no aportan'` — con hoy = miércoles, la cebolla del lunes no está; un plato `excluded` tampoco.
  - `'el renglón dice sus días pendientes'` — `renglon(service,'cebolla').dias` es `['Lunes','Martes']`.
  - `'la despensa cubre el día más cercano primero'` — despensa 0.5 unidad, lunes 0.5 y martes 0.5 → renglón muestra lo del martes (`usas` `0.5 unidad`, compra `1 unidad`) y `dias` es `['Martes']`.
  - `'unidades distintas entre días no se reparten ni rompen'` — queso 100 g lunes, 1 unidad martes, despensa 50 g → renglón `'100 g + 1 unidad'` sin tildar.
  - `'las etiquetas salen del día y no de la fecha'` — con `process.env.TZ` no se puede cambiar en caliente: aserción sobre `partesSemana()[0].dia === 'Lunes'` y `diaDelMes === currentWeekStart().getDate()`.
  - Los tests existentes de `'MealService: lista de compras redondeada'` siguen pasando sin cambios en este task, salvo el de backup (`'brócoli'` → `'brócoli@manual'`), que se ajusta en Task 3.
- [ ] **Step 2:** `pnpm test -- --run src/app/services/meal.service.sync.spec.ts` → los nuevos FAIL.
- [ ] **Step 3: Implementar** `partesSemana` y rehacer `shoppingListGrouped` sobre partes con las reglas de arriba. `ajustarRenglon`/`restarDespensa` pasan a recibir las partes del renglón; el agrupado por tag queda igual.
- [ ] **Step 4:** el mismo comando → PASS (los nuevos; ver nota del backup).
- [ ] **Step 5: Commit** `feat(comidas): la lista sabe de qué día es cada cosa`

---

### Task 3: Tildar por parte y por renglón

**Files:**
- Modify: `projects/comidas/src/app/services/meal.service.ts` (`toggleItemCheck` ~1713, `registrarCompra`, `deshacerCompra`, `autoCheckIfCovered` ~2034, `overrideQuantity`)
- Test: `projects/comidas/src/app/services/meal.service.sync.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `toggleItemCheck(name: string, fecha?: string | null): string | null` — `fecha` omitida = el renglón entero (vista por góndola); `string` = esa parte; `null` = la parte manual. Devuelve el aviso como hoy.
  - `MealService.listaPorDia: Signal<DiaLista[]>` con `type DiaLista = { fecha: string | null; dia: string | null; diaDelMes: number | null; platos: string[]; items: ShoppingItem[] }` (exportado desde `compras/partes.ts`). Un `DiaLista` por día con algo que comprar, en orden, y uno final con `fecha: null` para manuales si hay. Cada `ShoppingItem` es una parte: `checked` según sus tildes o la despensa, cantidad = su faltante redondeado por sí solo, `tagId`; ordenados por el orden de `tags()` y sin tag al final.

Comportamiento:
- **Tildar** (renglón o parte): las partes pendientes involucradas son **una compra**: compra/sobra sobre su suma (menos despensa, redondeada, o el override si es el renglón entero), registro bajo la clave de la primera por fecha con `dias` = las demás claves, sobra a la despensa una vez (`cabeEnDespensa` como hoy), todas las claves a `checkedItems`. Sin cantidad (> 0) no hay registro pero sí tildes.
- **Destildar** una parte que pertenece a un registro (clave propia o en `dias`): deshace la compra entera (resta la sobra una vez, saca todas sus claves). Destildar el renglón entero = destildar todas sus partes tildadas.
- **Clave pelada** (compatibilidad): destildar una parte la reemplaza por las claves de las demás partes del renglón; si había registro pelado, se deshace entero.
- Tildar o destildar cualquier parte borra `quantityOverrides[`${weekKey}_${clave}`]`.
- `autoCheckIfCovered(key)`: agrega a `checkedItems` las claves de las partes que el reparto deja cubiertas, sin registro.

- [ ] **Step 1: Tests**
  - `'tildar un día manda su sobra y el día siguiente queda cubierto'` — lunes 0.5 y martes 0.5 cebolla; `toggleItemCheck('cebolla', fechaLunes)` → aviso `'cebolla: +0.5 unidad a la despensa'`, `compras()[week]['cebolla@<lunes>']` = `{ compra: '1 unidad', sobra: '0.5 unidad' }`, renglón `checked: true`.
  - `'tildar el renglón es una compra con dias, y destildar un día la deshace entera'` — lunes 0.5 + viernes 1 → `toggleItemCheck('cebolla')`: un registro `{ compra: '2 unidad', sobra: '0.5 unidad', dias: ['cebolla@<viernes>'] }`; `toggleItemCheck('cebolla', fechaViernes)` → despensa 0, `compras()[week]` vacío, `checkedItems()[week]` sin claves de cebolla.
  - `'tildar y destildar en cualquier orden deja la despensa como estaba'` — despensa inicial 0.25; secuencia: lunes, renglón, destildar martes, destildar renglón → despensa 0.25.
  - `'tilde manual sin registro sigue consumiendo despensa'` — despensa 0.5, lunes 0.5 y martes 0.5; `toggleItemCheck('cebolla', fechaLunes)` (cubierto, sin registro) → el renglón sigue pidiendo lo del martes.
  - `'un manual con el mismo nombre no tilda las recetas'` — `addExtraItem('Cebolla','1')` + cebolla el lunes; `toggleItemCheck('Cebolla', null)` → `renglon.dias` sigue con `'Lunes'`.
  - `'una clave de antes cuenta como todo, y destildar un día deja tildados los otros'` — `checkedItems` sembrado `{ [week]: ['cebolla'] }` → renglón `checked`; `toggleItemCheck('cebolla', fechaLunes)` → `checkedItems()[week]` = `['cebolla@<martes>']`.
  - `'tildar una parte borra el override del renglón'`.
  - `'compra que empezó un día pasado se deshace desde un día futuro'` — tildar renglón con hoy = lunes; mover `todayTimestamp` a martes; destildar martes → sobra restada una vez.
  - `'una clave huérfana no tilda nada'` — cebolla lunes y martes; tildar lunes; `clearMeal('Lunes','almuerzo')` → `partesSemana()` sin la parte del lunes, el renglón muestra el martes sin tildar, `listaPorDia()` no tiene lunes.
  - `'sin cantidad, tilda sin registro'` — ingrediente `quantity: ''` → `checkedItems` con la clave, `compras()` vacío; destildar lo saca.
  - `'listaPorDia agrupa por día en orden con sus platos'` — dos días + un manual → 3 `DiaLista`, el último con `fecha: null`.
  - Ajustar el test de backup existente: `{ 'brócoli@manual': { compra: '1 unidad', sobra: '0.25 unidad' } }`.
- [ ] **Step 2:** `pnpm test -- --run src/app/services/meal.service.sync.spec.ts` → nuevos FAIL.
- [ ] **Step 3: Implementar.** Revisar los tres callers que hoy tildan (`toggleItemCheck` desde la lista, `autoCheckIfCovered`, y `subtractFromPantry` del componente, que guarda un override y después llama a `marcar`) para que ninguno sume una sobra calculada con la despensa a medio restar.
- [ ] **Step 4:** `pnpm test` → todo PASS.
- [ ] **Step 5: Commit** `feat(comidas): tildar por día en la lista de compras`

---

### Task 4: Texto de copiar

**Files:**
- Create: `projects/comidas/src/app/compras/copiar.ts`
- Test: `projects/comidas/src/app/compras/copiar.spec.ts`
- Modify: `projects/comidas/src/app/components/shopping-list/shopping-list.component.ts` (`copyToClipboard` ~208)

**Interfaces:**
- Consumes: `ShoppingListGroup`, `DiaLista`, `diaCorto`.
- Produces:
  - `textoPorGondola(grupos: ShoppingListGroup[], rango: string, cantidad: (i: ShoppingItem) => string): string | null`
  - `textoPorDia(dias: DiaLista[], rango: string, cantidad: (i: ShoppingItem) => string): string | null`
  - Ambas devuelven `null` si no hay pendientes (el componente muestra el "Lista vacía" de hoy). `cantidad` es el `displayQty` del componente.

Formato exacto (spec §4): encabezado `🛒 *Lista de Compras* (${rango})`, línea en blanco, secciones, pie `_Generado por Comidas - La Cueva de Tatoh_`. Góndola: `*VERDULERÍA*` / `*OTROS*` sin tag, `• Cebolla: 3 u (lun, mar, mié)` con `diaCorto` de `item.dias`, manuales sin paréntesis. Por día: `*LUNES 9* _Fideos con brócoli · Ensalada de lentejas_` (dayName en mayúscula + `diaDelMes`, platos unidos con ` · `), manuales bajo `*SIN DÍA*`. Sólo ítems no tildados.

- [ ] **Step 1: Tests** — un caso por función con el texto completo esperado (`toBe` sobre el string entero), uno de "todo tildado → null", uno de manual sin paréntesis.
- [ ] **Step 2:** `pnpm test -- --run src/app/compras/copiar.spec.ts` → FAIL.
- [ ] **Step 3: Implementar**, y `copyToClipboard` usa una u otra según la vista (Task 5 crea la señal `vista`; en este task el componente usa siempre `textoPorGondola`).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(comidas): copiar la lista con el día de cada cosa`

---

### Task 5: Vistas en el componente

**Files:**
- Modify: `projects/comidas/src/app/components/shopping-list/shopping-list.component.ts`, `.html`, `.scss`

**Interfaces:**
- Consumes: `shoppingListGrouped`, `listaPorDia`, `toggleItemCheck(name, fecha?)`, `textoPorGondola`, `textoPorDia`.
- Produces: `readonly vista: WritableSignal<'gondola' | 'dia'>` en el componente, persistida en `comidas_vista_lista`.

- [ ] **Step 1:** Selector "Por góndola / Por día" arriba de `.list-groups` (dos botones con `aria-pressed`). Vista por góndola: la de hoy + chips `Lun` `Mar` de `item.dias` junto al nombre y detalle "ya compraste lun–mié" (de `item.diasComprados`, con `diaCorto`, unidos con `, `) cuando hay comprados y pendientes. Vista por día: `@for` sobre `listaPorDia()`, encabezado "Lunes 9" + platos, ítems con checkbox (`marcarParte(item.name, dia.fecha)`) y cantidad de sólo lectura; sección "Sin día" para `fecha: null`. `copyToClipboard` elige el formato por `vista()`.
- [ ] **Step 2:** `pnpm lint` → sin errores. `pnpm build` → OK.
- [ ] **Step 3: Verificación manual** con el skill `run` (o `ng serve comidas` tras `ng build componentes`): semana con cebolla lunes/martes/viernes; tildar lunes en Por día → el martes queda cubierto si sobró; tildar el renglón en Por góndola; destildar viernes deshace; Copiar en cada vista; recargar recuerda la vista; tema claro y oscuro.
- [ ] **Step 4: Commit** `feat(comidas): vista por día en la lista de compras`
