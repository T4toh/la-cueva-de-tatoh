# Compras redondeadas y sobras a la despensa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la lista de compras de comidas pida cantidades que se venden (3/4 brócoli → 1) y que, al tildar, lo que sobra entre solo a la despensa.

**Architecture:** Una función pura `aComprar` en el catálogo decide el redondeo. `shoppingListGrouped` agrupa por entrada del catálogo, resta la despensa y redondea por renglón. Un estado nuevo `compras` (por semana y renglón) congela lo comprado al tildar y recuerda la sobra para poder deshacerla.

**Tech Stack:** Angular 22 (signals, standalone), Vitest con TestBed, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-compras-redondeadas-design.md`

## Global Constraints

- Todo se corre desde la raíz del repo: `/Users/tatoh/Repos/Personal/la-cueva-de-tatoh`. Branch: `feat/compras-redondeadas`.
- pnpm, nunca npm. Sin dependencias nuevas.
- `pnpm lint` tiene que pasar sin tocar la config: tipo de retorno explícito en toda función, nada de `public`, `type` y no `interface`, `curly`, `eqeqeq`, `complexity: 20`, `max-len: 120`, `@if`/`@for` en templates, atributos en orden alfabético por grupo.
- Colores sólo con tokens del tema (`var(--...)`), nunca hex.
- Comentarios y textos de UI en español rioplatense, en el tono del código que rodea.
- Commits sin `Co-Authored-By` (regla de la organización). No pushear sin que lo pida el usuario.
- Lo permanente no cambia de clave: `ingredientTags` sigue buscando por nombre crudo; la despensa guarda los nombres como los escribió el usuario.
- Números en pantalla como ya hace la app: decimales con punto, hasta 2 (`parseFloat(n.toFixed(2))`).

## Review Focus

- Tildar y destildar varias veces el mismo renglón: la despensa tiene que quedar como estaba, sin acumular.
- La despensa que tilda sola un renglón (porque lo cubre) no tiene que mandar sobra ni crear registro.
- El botón "Restar de la despensa" del renglón (que también tilda): no tiene que sumar una sobra calculada con la despensa a medio restar.
- Un ingrediente con dos unidades distintas (100 g + 1 unidad) no se suma ni se redondea.
- Un renglón con despensa en otra forma de nombre ("huevos" en la despensa, "Huevo" en la receta) se cubre igual.

---

### Task 1: `aComprar` y el paso de compra en el catálogo

**Files:**
- Modify: `projects/comidas/src/app/catalogo/catalogo.ts` (tipo `EntradaCatalogo` ~línea 15, `entradaPropia` ~línea 157, función nueva al final)
- Modify: `projects/comidas/src/app/catalogo/catalogo-datos.ts:194` (huevo)
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.ts:74-112`
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.html:208`
- Test: `projects/comidas/src/app/catalogo/catalogo.spec.ts`

**Interfaces:**
- Produces: `EntradaCatalogo.compra?: number`;
  `export function aComprar(necesario: number, unidad: string, entrada: EntradaCatalogo | null): number`;
  `entradaPropia(nombreFila, existente, valores: { grupo: Grupo; unidad: string; porcion: string; compra?: string })`.

- [ ] **Step 1: Write the failing tests**

En `catalogo.spec.ts`, sumar `aComprar` al import de `./catalogo` y agregar al final:

```ts
describe('aComprar', () => {
  const huevo: EntradaCatalogo = { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad', compra: 6 };
  const carne: EntradaCatalogo = { nombre: 'carne picada', grupo: 'carnesHuevos', unidad: 'g', compra: 250 };

  it('lo que se cuenta va al entero de arriba', () => {
    expect(aComprar(0.75, 'unidad', null)).toBe(1);
    expect(aComprar(6.5, '', null)).toBe(7);
    expect(aComprar(0.5, 'atado', null)).toBe(1);
    expect(aComprar(3, 'unidades', null)).toBe(3);
  });

  it('con paso de compra redondea al múltiplo', () => {
    expect(aComprar(6.5, 'unidad', huevo)).toBe(12);
    expect(aComprar(300, 'g', carne)).toBe(500);
    expect(aComprar(250, 'g', carne)).toBe(250);
  });

  it('el paso sólo vale en la unidad de la entrada', () => {
    // "2 unidades de carne picada" no se compra de a 250 unidades.
    expect(aComprar(2, 'unidad', carne)).toBe(2);
  });

  it('lo que no se cuenta queda como está', () => {
    expect(aComprar(30, 'g', null)).toBe(30);
    expect(aComprar(0.5, 'taza', null)).toBe(0.5);
    expect(aComprar(1.5, 'cda', null)).toBe(1.5);
  });

  it('nada que comprar es cero', () => {
    expect(aComprar(0, 'unidad', null)).toBe(0);
    expect(aComprar(-1, 'unidad', huevo)).toBe(0);
  });

  it('el error de coma flotante no compra una unidad de más', () => {
    // 0.1 * 3 * 10 es 3.0000000000000004.
    expect(aComprar(0.1 * 3 * 10, 'unidad', null)).toBe(3);
  });
});
```

Y dentro de `describe('entradaPropia', ...)`:

```ts
  it('guarda el paso de compra si viene, y lo omite vacío', () => {
    expect(entradaPropia('kale', null, { ...valores, compra: '2' })).toEqual({
      nombre: 'kale', grupo: 'hortalizas', unidad: 'atado', compra: 2,
    });
    expect(entradaPropia('kale', null, { ...valores, compra: ' ' })).toEqual({
      nombre: 'kale', grupo: 'hortalizas', unidad: 'atado',
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --watch=false 2>&1 | tail -30`
Expected: FAIL, `aComprar` no exportado / `compra` no existe en el tipo.

- [ ] **Step 3: Implement**

En `EntradaCatalogo`, después de `porcion`/`estimada`:

```ts
  // Paso de compra, en `unidad`: huevos de a 6, carne de a 250 g. Sin valor,
  // lo que se cuenta va al entero de arriba y lo demás queda como está.
  compra?: number;
```

Al final de `catalogo.ts`:

```ts
// Las unidades que se compran enteras aunque la receta pida un pedazo.
const CONTABLES = new Set(['', 'unidad', 'unidades', 'atado', 'atados']);
// Sin esto, 3.0000000000000004 compraría 4.
const TOLERANCIA = 1e-9;

// Cuánto se compra para cubrir `necesario`, en la misma unidad. Ver
// docs/superpowers/specs/2026-10-14-compras-redondeadas-design.md
export function aComprar(necesario: number, unidad: string, entrada: EntradaCatalogo | null): number {
  if (necesario <= 0) {
    return 0;
  }
  const clave = normalizar(unidad);
  const mismaUnidad = !clave || clave === normalizar(entrada?.unidad ?? '');
  const paso = entrada?.compra && mismaUnidad ? entrada.compra : CONTABLES.has(clave) ? 1 : 0;
  if (!paso) {
    return necesario;
  }
  return Math.ceil(necesario / paso - TOLERANCIA) * paso;
}
```

En `entradaPropia`, el tipo de `valores` pasa a `{ grupo: Grupo; unidad: string; porcion: string; compra?: string }`, y:

```ts
  const compra = Number((valores.compra ?? '').trim().replace(',', '.'));
```

y en el objeto que devuelve, después de la línea de `porcion`:

```ts
    ...(compra > 0 ? { compra } : {}),
```

En `catalogo-datos.ts:194`:

```ts
  { nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad', porcion: 1, compra: 6 },
```

En `meal-editor.component.ts`: el form `clasificacion` suma `compra: ['']`; `abrirClasificacion` suma
`compra: entrada?.compra !== undefined ? String(entrada.compra) : '',` al `setValue`; `guardarClasificacion`
desestructura `compra` y pasa `compra: compra ?? ''` a `entradaPropia`.

En `meal-editor.component.html`, después del input de `porcion`:

```html
              <input formControlName="compra" placeholder="Se compra de a (opcional)" type="text" />
```

- [ ] **Step 4: Run tests and lint**

Run: `pnpm test -- --watch=false 2>&1 | tail -30 && pnpm lint 2>&1 | tail -15`
Expected: PASS y lint limpio. Si `catalogo-datos.spec.ts` valida campos permitidos, sumar `compra` ahí.

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/catalogo projects/comidas/src/app/components/meal-editor
git commit -m "feat(comidas): paso de compra en el catálogo y aComprar"
```

---

### Task 2: La lista agrupa por catálogo, respeta unidades y redondea

**Files:**
- Modify: `projects/comidas/src/app/models/meal.model.ts` (`ShoppingItem`)
- Modify: `projects/comidas/src/app/services/meal.service.ts` (imports ~línea 26; `overrideQuantity` ~1601; `shoppingListGrouped` ~1648-1757; `addToPantry` ~1777; `subtractFromPantry` ~1816; `autoCheckIfCovered` ~1849; `getCartPantryDiff` ~1906)
- Test: `projects/comidas/src/app/services/meal.service.sync.spec.ts` (describe nuevo al final; reusa `asentar` y el setup de TestBed del archivo)

**Interfaces:**
- Consumes: `aComprar`, `clasificar` de `../catalogo/catalogo`.
- Produces: `ShoppingItem.usas?: string` (lo que falta, sin redondear, sólo si difiere de lo que se compra);
  `ShoppingItem.sobra?: string` (compra − falta, con unidad); el renglón redondeado deja la compra en
  `quantityOverride`. `private claveCompra(nombre: string): string` en `MealService`.

- [ ] **Step 1: Write the failing tests**

Al final de `meal.service.sync.spec.ts`:

```ts
describe('MealService: lista de compras redondeada', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  const renglon = (service: MealService, nombre: string): ShoppingItem | undefined =>
    service.shoppingList().find((i) => i.name.toLowerCase() === nombre.toLowerCase());

  it('lo que se cuenta se compra entero y dice cuánto se usa', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    const r = renglon(service, 'Brócoli')!;
    expect(r.quantityOverride).toBe('1 unidad');
    expect(r.usas).toBe('0.75 unidad');
    expect(r.sobra).toBe('0.25 unidad');
  });

  it('"Huevo" y "huevos" son un renglón, redondeado una vez con el paso del catálogo', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Huevo', '3.5', undefined, 'unidad');
    service.addExtraItem('huevos', '3', undefined, 'unidad');

    const huevos = service.shoppingList().filter((i) => i.name.toLowerCase().startsWith('huevo'));
    expect(huevos).toHaveLength(1);
    expect(huevos[0].quantityOverride).toBe('12 unidad');
    expect(huevos[0].usas).toBe('6.5 unidad');
  });

  it('dos unidades distintas no se suman ni se redondean', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Queso', '100', undefined, 'g');
    service.addExtraItem('queso', '1', undefined, 'unidad');

    const r = renglon(service, 'Queso')!;
    expect(r.quantity).toBe('100 g + 1 unidad');
    expect(r.quantityOverride).toBeUndefined();
    expect(r.usas).toBeUndefined();
  });

  it('primero resta la despensa y después redondea', () => {
    const service = TestBed.inject(MealService);
    service.addToPantry('brócoli', '0.5 unidad');
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    const r = renglon(service, 'Brócoli')!;
    expect(r.quantityOverride).toBe('1 unidad');
    expect(r.usas).toBe('0.25 unidad');
    expect(r.sobra).toBe('0.75 unidad');
  });

  it('la despensa cubre aunque el nombre esté en otra forma', () => {
    const service = TestBed.inject(MealService);
    service.addToPantry('huevos', '6 unidad');
    service.addExtraItem('Huevo', '4', undefined, 'unidad');

    const r = renglon(service, 'Huevo')!;
    expect(r.checked).toBe(true);
    expect(r.usas).toBeUndefined();
  });

  it('la cantidad pisada a mano gana sobre el redondeo', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');
    service.overrideQuantity('Brócoli', '0.5');

    const r = renglon(service, 'Brócoli')!;
    expect(r.quantityOverride).toBe('0.5');
    expect(r.usas).toBeUndefined();
  });

  it('gramos sin paso quedan como están', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Mozzarella', '30', undefined, 'g');

    const r = renglon(service, 'Mozzarella')!;
    expect(r.quantityOverride).toBeUndefined();
    expect(r.usas).toBeUndefined();
  });
});
```

Sumar `ShoppingItem` al import de `../models/meal.model` y `afterEach` al de `vitest` si faltan.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --watch=false 2>&1 | tail -40`
Expected: FAIL en los tests nuevos (`usas` indefinido, dos renglones de huevo, "101").

- [ ] **Step 3: Implement**

`meal.model.ts`, en `ShoppingItem`:

```ts
export type ShoppingItem = {
  tagId?: string;
  isExtra?: boolean;
  quantityOverride?: string;
  inPantry?: boolean;
  pantryQuantity?: string;
  // Lo que falta, sin redondear: sólo cuando lo que se compra es distinto.
  usas?: string;
  // Lo que se compra de más, con unidad. Al tildar va a la despensa.
  sobra?: string;
} & Ingredient;
```

`meal.service.ts`: sumar `aComprar` y `clasificar` al import de `../catalogo/catalogo`. Arriba de la clase,
junto a las otras funciones exportadas, una auxiliar sin exportar:

```ts
function conUnidad(valor: number, unidad: string): string {
  const numero = parseFloat(valor.toFixed(2));
  return unidad ? `${numero} ${unidad}` : `${numero}`;
}
```

En la clase, cerca de `toggleItemCheck`:

```ts
  // La clave de un renglón de la lista: la entrada del catálogo si la
  // reconoce, así "Huevo" y "huevos" son uno; si no, el nombre crudo, como
  // antes. Ver docs/superpowers/specs/2026-10-14-compras-redondeadas-design.md
  private claveCompra(nombre: string): string {
    const entrada = clasificar(nombre, this.indiceCatalogo());
    return (entrada?.nombre ?? nombre).toLowerCase().trim();
  }
```

`overrideQuantity`: `const key = \`${weekKey}_${this.claveCompra(ingredientName)}\`;`

`toggleItemCheck` (por ahora sólo la clave; la Task 3 lo reescribe): `const itemName = this.claveCompra(name);`

`shoppingListGrouped` completo:

```ts
  readonly shoppingListGrouped = computed(() => {
    const items: ShoppingItem[] = [];
    const currentSchedule = this.schedule();
    const allMeals = this.meals();
    const today = new Date(this.todayTimestamp());
    const weekStart = this.currentWeekStart();
    const weekKey = this.formatDateKey(weekStart);
    const tagMap = this.ingredientTags();
    const weekChecked = this.checkedItems()[weekKey] || [];

    currentSchedule.forEach((day, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);

      if (dayDate >= today) {
        const processDish = (dish: Dish): void => {
          if (dish.excluded) {
            return;
          }
          const meal = allMeals.find((m) => m.id === dish.mealId);
          if (meal && meal.includeInShoppingList !== false) {
            meal.ingredients.forEach((ing) => {
              items.push({
                ...ing,
                quantity: multiplyQuantity(ing.quantity, dish.portions),
                tagId: tagMap[ing.name.toLowerCase().trim()],
                isExtra: false,
                checked: weekChecked.includes(this.claveCompra(ing.name)),
              });
            });
          }
        };

        day.almuerzo.forEach(processDish);
        day.desayuno.forEach(processDish);
        day.cena.forEach(processDish);
      }
    });

    this.currentExtraItems().forEach((extra) => {
      items.push({
        ...extra,
        tagId: extra.tagId || tagMap[extra.name.toLowerCase().trim()],
        checked: weekChecked.includes(this.claveCompra(extra.name)),
      });
    });

    const aggregated: { [key: string]: ShoppingItem } = {};
    items.forEach((item) => {
      const key = this.claveCompra(item.name);
      if (aggregated[key]) {
        this.sumarAlRenglon(aggregated[key], item);
      } else {
        aggregated[key] = { ...item };
      }
    });

    const groups: ShoppingListGroup[] = this.tags().map((tag) => ({
      tag,
      items: [],
    }));
    const uncategorizedGroup: ShoppingListGroup = { tag: null, items: [] };
    groups.push(uncategorizedGroup);

    Object.values(aggregated).forEach((item) => {
      this.ajustarRenglon(item, weekKey);
      const group = item.tagId
        ? groups.find((g) => g.tag?.id === item.tagId)
        : null;
      (group || uncategorizedGroup).items.push(item);
    });

    return groups.filter((g) => g.items.length > 0);
  });

  // Desde la migración que separó la unidad, `quantity` es sólo el número:
  // sin mirar `unit`, 100 g y 1 unidad del mismo ingrediente sumaban 101.
  private sumarAlRenglon(renglon: ShoppingItem, item: ShoppingItem): void {
    const unidad = renglon.unit ?? '';
    const otra = item.unit ?? '';
    if (unidad === otra || !unidad || !otra) {
      renglon.quantity = this.addQuantities(renglon.quantity, item.quantity);
      renglon.unit = unidad || otra;
    } else {
      renglon.quantity = `${renglon.quantity} ${unidad} + ${item.quantity} ${otra}`;
      renglon.unit = '';
    }
    if (!renglon.tagId && item.tagId) {
      renglon.tagId = item.tagId;
    }
  }

  // Lo pisado a mano gana; si no, lo que falta después de la despensa se
  // redondea a lo que se compra. Lo cubierto por la despensa no se compra.
  private ajustarRenglon(item: ShoppingItem, weekKey: string): void {
    const key = this.claveCompra(item.name);
    const manual = this.quantityOverrides()[`${weekKey}_${key}`];
    if (manual) {
      item.quantityOverride = manual;
    }
    const cubierto = this.restarDespensa(item, key);
    if (!manual && !cubierto) {
      this.redondear(item);
    }
  }

  // Devuelve si la despensa cubre todo el renglón.
  private restarDespensa(item: ShoppingItem, key: string): boolean {
    const pantryEntry = this.pantry().find((p) => this.claveCompra(p.name) === key);
    if (!pantryEntry || parseNumericQuantity(pantryEntry.quantity)?.value === 0) {
      return false;
    }
    const effectiveQuantity = item.quantityOverride || [item.quantity, item.unit].filter(Boolean).join(' ');
    const { remaining, covered } = this.subtractPantryFromNeeded(effectiveQuantity, pantryEntry.quantity);
    item.pantryQuantity = pantryEntry.quantity;
    item.inPantry = true;
    if (covered) {
      item.checked = true;
    } else {
      item.quantityOverride = remaining;
    }
    return covered;
  }

  private redondear(item: ShoppingItem): void {
    const falta = item.quantityOverride ?? [item.quantity, item.unit].filter(Boolean).join(' ');
    const parsed = parseNumericQuantity(falta);
    if (!parsed) {
      return;
    }
    const compra = aComprar(parsed.value, parsed.unit, clasificar(item.name, this.indiceCatalogo()));
    if (compra === parsed.value) {
      return;
    }
    item.usas = falta;
    item.quantityOverride = conUnidad(compra, parsed.unit);
    item.sobra = conUnidad(compra - parsed.value, parsed.unit);
  }
```

Nota: `effectiveQuantity` ahora incluye `item.unit`. Antes la resta perdía la unidad ("0.25" en vez de
"0.25 unidad") y el renglón se mostraba sin ella.

`addToPantry`, `subtractFromPantry` y `autoCheckIfCovered`: comparar por `this.claveCompra(...)` en vez de
`.toLowerCase().trim()`, para que "huevos" en la despensa y "Huevo" en la lista sean lo mismo. En
`addToPantry`:

```ts
    const key = this.claveCompra(name);
    this.pantry.update((items) => {
      const existing = items.find((i) => this.claveCompra(i.name) === key);
      if (existing) {
        return items.map((i) =>
          i === existing ? { ...i, quantity: this.addQuantities(i.quantity, quantity) } : i
        );
      }
      return [...items, { name, quantity, ...(groupId ? { groupId } : {}) }];
    });
```

En `subtractFromPantry`: `const key = this.claveCompra(name);` y `if (this.claveCompra(i.name) !== key)`.
En `autoCheckIfCovered`: el `find` de la despensa y el de `shoppingList()` comparan con
`this.claveCompra(p.name) === key` / `this.claveCompra(s.name) === key`.

`getCartPantryDiff`: el `find` de la despensa compara con `claveCompra`, y lo necesario es lo que falta sin
redondear (lo que realmente se usa de la despensa):

```ts
        const needed = item.usas ?? item.quantityOverride ?? item.quantity;
```

Si `complexity` (20) salta en `shoppingListGrouped`, mover `processDish` a un método privado.

- [ ] **Step 4: Run tests and lint**

Run: `pnpm test -- --watch=false 2>&1 | tail -30 && pnpm lint 2>&1 | tail -15`
Expected: PASS (los viejos también) y lint limpio.

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/models projects/comidas/src/app/services
git commit -m "feat(comidas): la lista agrupa por catálogo y redondea a lo que se compra"
```

---

### Task 3: Tildar congela lo comprado y manda la sobra a la despensa

**Files:**
- Modify: `projects/comidas/src/app/models/meal.model.ts`
- Modify: `projects/comidas/src/app/services/meal.service.ts` (keys ~336, signals ~402, effects ~557, `aplicadores` ~854, `estadoActual` ~904, `loadCheckedItems` ~1096, `clearOverrides` ~1612, `toggleItemCheck` ~1631, `ajustarRenglon` de la Task 2, `importData` ~2247)
- Modify: `projects/comidas/src/app/services/backup.ts:23`
- Test: `projects/comidas/src/app/services/meal.service.sync.spec.ts` (en el describe de la Task 2)

**Interfaces:**
- Consumes: `ShoppingItem.usas`, `ShoppingItem.sobra`, `claveCompra`, `ajustarRenglon` (Task 2).
- Produces: `export type CompraRegistrada = { compra: string; sobra: string }`;
  `readonly compras: WritableSignal<Record<string, Record<string, CompraRegistrada>>>`;
  `toggleItemCheck(name: string): string | null` (devuelve el texto del aviso, o `null`).

- [ ] **Step 1: Write the failing tests**

En el describe `'MealService: lista de compras redondeada'`:

```ts
  const enDespensa = (service: MealService, nombre: string): number =>
    parseNumericQuantity(
      service.pantry().find((p) => p.name.toLowerCase() === nombre.toLowerCase())?.quantity ?? '0'
    )?.value ?? 0;

  it('tildar manda la sobra a la despensa y congela el renglón', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    expect(service.toggleItemCheck('Brócoli')).toBe('Brócoli: +0.25 unidad a la despensa');
    expect(enDespensa(service, 'Brócoli')).toBe(0.25);
    // Con la sobra en la despensa, el renglón no se recalcula: sigue en 1.
    const r = renglon(service, 'Brócoli')!;
    expect(r.checked).toBe(true);
    expect(r.quantityOverride).toBe('1 unidad');
    expect(r.sobra).toBe('0.25 unidad');
  });

  it('destildar saca la sobra, y tildar y destildar varias veces no acumula', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    for (let i = 0; i < 3; i++) {
      service.toggleItemCheck('Brócoli');
      expect(service.toggleItemCheck('Brócoli')).toBe('Brócoli: −0.25 unidad de la despensa');
    }

    expect(enDespensa(service, 'Brócoli')).toBe(0);
    expect(renglon(service, 'Brócoli')!.checked).toBe(false);
    expect(renglon(service, 'Brócoli')!.quantityOverride).toBe('1 unidad');
  });

  it('lo que la despensa cubre se tilda sin registro ni sobra', () => {
    const service = TestBed.inject(MealService);
    service.addToPantry('brócoli', '1 unidad');
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    expect(service.toggleItemCheck('Brócoli')).toBeNull();
    expect(enDespensa(service, 'Brócoli')).toBe(1);
    expect(service.compras()).toEqual({});
  });

  it('lo pisado a mano se compra tal cual y no deja sobra', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');
    service.overrideQuantity('Brócoli', '2 unidad');

    expect(service.toggleItemCheck('Brócoli')).toBeNull();
    expect(enDespensa(service, 'Brócoli')).toBe(0);
    expect(renglon(service, 'Brócoli')!.quantityOverride).toBe('2 unidad');
  });

  it('limpiar la semana deshace las sobras', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');
    service.toggleItemCheck('Brócoli');

    service.clearOverrides();

    expect(enDespensa(service, 'Brócoli')).toBe(0);
    expect(renglon(service, 'Brócoli')!.checked).toBe(false);
  });

  it('las compras se guardan y viajan en el backup', async () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');
    service.toggleItemCheck('Brócoli');
    await asentar();

    const guardado = JSON.parse(localStorage.getItem('comidas_compras')!) as Record<string, unknown>;
    expect(Object.values(guardado)).toEqual([{ 'brócoli': { compra: '1 unidad', sobra: '0.25 unidad' } }]);

    const compras = { '2026-01-05': { huevo: { compra: '12 unidad', sobra: '5.5 unidad' } } };
    service.importData(JSON.stringify({ compras }));
    expect(service.compras()).toEqual(compras);
    expect(pareceBackup({ compras: {} })).toBe(true);
  });
```

Sumar `parseNumericQuantity` al import de `./meal.service`. Si `importData` sin `secciones` no aplica todas
las claves, pasarle `['compras']` como segundo argumento (mirar la firma en `meal.service.ts:2186`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --watch=false 2>&1 | tail -40`
Expected: FAIL (`toggleItemCheck` devuelve `undefined`, no existe `compras`).

- [ ] **Step 3: Implement**

`meal.model.ts`:

```ts
// Lo que se compró al tildar un renglón y lo que sobró y entró a la despensa.
// Ver docs/superpowers/specs/2026-10-14-compras-redondeadas-design.md
export type CompraRegistrada = { compra: string; sobra: string };
```

`meal.service.ts`, sumar `CompraRegistrada` al import del modelo y:

- Key: `private readonly COMPRAS_KEY = 'comidas_compras';` junto a `CHECKED_ITEMS_KEY`.
- Signal, después de `checkedItems`:

  ```ts
  // Por semana y por renglón: lo congelado al tildar. Un renglón tildado con
  // registro no resta la despensa, porque su propia sobra ya está ahí.
  readonly compras = signal<Record<string, Record<string, CompraRegistrada>>>(this.loadCompras());
  ```

- Loader, después de `loadCheckedItems`:

  ```ts
  private loadCompras(): Record<string, Record<string, CompraRegistrada>> {
    const data = localStorage.getItem(this.COMPRAS_KEY);
    return data ? JSON.parse(data) : {};
  }
  ```

- Effect, después del de `checkedItems`:

  ```ts
    effect(() => {
      const data = this.compras();
      localStorage.setItem(this.COMPRAS_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('compras')) {
        this.saveToFirestore('compras', data);
      }
    });
  ```

- `aplicadores`: `compras: (v) => this.compras.set(v as Record<string, Record<string, CompraRegistrada>>),`
- `estadoActual`: `compras: this.compras(),` después de `checkedItems`.
- `importData`, después del bloque de `checkedItems`:

  ```ts
    if (data['compras']) {
      const v = data['compras'] as Record<string, Record<string, CompraRegistrada>>;
      pasos.push(() => this.compras.set(v));
    }
  ```

- `backup.ts:23`: sumar `'compras'` a las `claves` de la sección `compras`.

`ajustarRenglon` (Task 2) arranca con el registro:

```ts
  private ajustarRenglon(item: ShoppingItem, weekKey: string): void {
    const key = this.claveCompra(item.name);
    const registro = this.compras()[weekKey]?.[key];
    if (registro) {
      item.quantityOverride = registro.compra;
      item.sobra = registro.sobra || undefined;
      item.checked = true;
      return;
    }
    // ...lo de la Task 2 sigue igual
```

`toggleItemCheck` reescrito:

```ts
  // Devuelve el aviso de lo que entró o salió de la despensa, o null.
  toggleItemCheck(name: string): string | null {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    const key = this.claveCompra(name);
    const isChecked = (this.checkedItems()[weekKey] || []).includes(key);
    const aviso = isChecked
      ? this.deshacerCompra(weekKey, key, name)
      : this.registrarCompra(weekKey, key);

    this.checkedItems.update((prev) => {
      const currentChecked = prev[weekKey] || [];
      return {
        ...prev,
        [weekKey]: isChecked
          ? currentChecked.filter((n) => n !== key)
          : [...currentChecked, key],
      };
    });
    return aviso;
  }

  // Congela el renglón como se ve ahora. Lo que la despensa ya cubre, o lo
  // que no tiene cantidad, no deja registro.
  private registrarCompra(weekKey: string, key: string): string | null {
    const renglon = this.shoppingList().find((i) => this.claveCompra(i.name) === key);
    if (!renglon || renglon.checked) {
      return null;
    }
    const compra = renglon.quantityOverride ?? [renglon.quantity, renglon.unit].filter(Boolean).join(' ');
    if (!((parseNumericQuantity(compra)?.value ?? 0) > 0)) {
      return null;
    }
    const sobra = renglon.sobra ?? '';
    this.compras.update((c) => ({ ...c, [weekKey]: { ...(c[weekKey] ?? {}), [key]: { compra, sobra } } }));
    if (!sobra) {
      return null;
    }
    this.addToPantry(renglon.name, sobra);
    return `${renglon.name}: +${sobra} a la despensa`;
  }

  private deshacerCompra(weekKey: string, key: string, nombre: string): string | null {
    const registro = this.compras()[weekKey]?.[key];
    if (!registro) {
      return null;
    }
    this.compras.update((c) => {
      const semana = { ...(c[weekKey] ?? {}) };
      delete semana[key];
      return { ...c, [weekKey]: semana };
    });
    if (!registro.sobra) {
      return null;
    }
    this.subtractFromPantry(key, registro.sobra);
    return `${nombre}: −${registro.sobra} de la despensa`;
  }
```

El `−` del aviso es U+2212 (signo menos), igual que el botón de la lista.

`clearOverrides`, antes de limpiar overrides y tildes:

```ts
    // Deshace lo que sobró y entró a la despensa, como destildar todo: si no,
    // limpiar y volver a tildar duplica la sobra.
    const semana = this.compras()[weekKey] ?? {};
    Object.entries(semana).forEach(([key, { sobra }]) => {
      if (sobra) {
        this.subtractFromPantry(key, sobra);
      }
    });
    this.compras.update((c) => {
      const resto = { ...c };
      delete resto[weekKey];
      return resto;
    });
```

Verificar los otros callers de `toggleItemCheck` (spec, sección 2):
- `autoCheckIfCovered`: la despensa ya cubre, así que el renglón llega con `checked: true` y
  `registrarCompra` devuelve `null`. Ignora el valor de retorno.
- `ShoppingListComponent.subtractFromPantry`: lo cubre la Task 4.

- [ ] **Step 4: Run tests and lint**

Run: `pnpm test -- --watch=false 2>&1 | tail -30 && pnpm lint 2>&1 | tail -15`
Expected: PASS y lint limpio.

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/models projects/comidas/src/app/services
git commit -m "feat(comidas): tildar congela lo comprado y manda la sobra a la despensa"
```

---

### Task 4: La lista muestra "usás", la sobra y el aviso

**Files:**
- Modify: `projects/comidas/src/app/components/shopping-list/shopping-list.component.ts`
- Modify: `projects/comidas/src/app/components/shopping-list/shopping-list.component.html:89-100`
- Modify: `projects/comidas/src/app/components/shopping-list/shopping-list.component.scss`

**Interfaces:**
- Consumes: `toggleItemCheck(name): string | null`, `ShoppingItem.usas`, `ShoppingItem.sobra`.

- [ ] **Step 1: Component**

Sumar `signal` al import de `@angular/core`. En la clase:

```ts
  // El aviso de lo que entró o salió de la despensa al tildar. Se borra solo.
  readonly aviso = signal('');
  private avisoTimer?: ReturnType<typeof setTimeout>;

  marcar(nombre: string): void {
    const aviso = this.mealService.toggleItemCheck(nombre);
    if (!aviso) {
      return;
    }
    this.aviso.set(aviso);
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso.set(''), 3000);
  }
```

En `subtractFromPantry(item)`, lo que se resta de la despensa es lo que se usa, no lo redondeado. El tipo del
parámetro suma `usas?: string`:

```ts
    const quantity = item.usas ?? this.displayQty(item);
```

Lo demás del método queda igual: persiste `quantityOverride` (ya redondeado) como manual y tilda. Con un
override manual, `registrarCompra` congela esa cantidad sin sobra, así que este botón nunca suma una sobra.

- [ ] **Step 2: Template**

El checkbox llama a `marcar`:

```html
                <input
                  type="checkbox"
                  [checked]="item.checked"
                  [id]="item.name + (group.tag?.id || 'untagged')"
                  (change)="marcar(item.name)"
                />
```

Dentro del `<label class="item-label">`, después de `<span class="name">`:

```html
                  @if (item.checked && item.sobra) {
                    <span class="detalle">· sobró {{ item.sobra }} → despensa</span>
                  } @else if (!item.checked && item.usas) {
                    <span class="detalle">· usás {{ item.usas }}</span>
                  }
```

Como último hijo de `.shopping-list-container`:

```html
  <p aria-live="polite" class="aviso-despensa">{{ aviso() }}</p>
```

- [ ] **Step 3: Styles**

Al final de `shopping-list.component.scss`:

```scss
.detalle {
  color: var(--fg-secondary);
  font-size: 0.8rem;
  white-space: nowrap;
}

// Siempre en el DOM: una región aria-live que aparece junto con su texto no
// siempre se anuncia.
.aviso-despensa {
  position: fixed;
  bottom: 5rem;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: var(--accent-strong);
  color: var(--fg-on-accent-strong);
  font-size: 0.9rem;
  pointer-events: none;
  transition: opacity 0.2s;

  &:empty {
    opacity: 0;
  }
}

@media print {
  .aviso-despensa {
    display: none;
  }
}
```

- [ ] **Step 4: Lint, tests, build**

Run: `pnpm lint 2>&1 | tail -15 && pnpm test -- --watch=false 2>&1 | tail -10 && pnpm build 2>&1 | tail -10`
Expected: todo limpio.

- [ ] **Step 5: Verificar en el navegador**

Run: `pnpm exec ng serve comidas --port 4301` (en background; requiere `dist/componentes`, que deja el
`pnpm build` anterior).
Con Playwright, en `http://localhost:4301`, ir a la lista de compras, agregar el ítem manual
"Brócoli" "0.75 unidad" (el form de ítems manuales) y verificar:
- el renglón muestra `1 unidad` y "· usás 0.75 unidad";
- al tildar aparece el aviso "Brócoli: +0.25 unidad a la despensa", que se va a los 3 s, y el renglón
  dice "· sobró 0.25 unidad → despensa";
- la despensa muestra brócoli 0.25;
- al destildar la despensa vuelve a 0.
Sacar capturas en claro y oscuro para el usuario. Cortar el dev server al terminar.

- [ ] **Step 6: Commit**

```bash
git add projects/comidas/src/app/components/shopping-list
git commit -m "feat(comidas): la lista muestra lo que se usa, lo que sobra y avisa"
```

---

### Task 5: TODO y spec

**Files:**
- Modify: `TODO.md` (el ítem "Lista de compras en cantidades que se compran", ~línea 229)
- Modify: `docs/superpowers/specs/2026-10-14-compras-redondeadas-design.md`

- [ ] **Step 1: TODO**

Mover a `## Hecho` una entrada corta que resuma lo hecho y apunte al spec. Dejar en pendientes, como ítem
propio, lo que no se hizo: "clara → huevo" y sugerir recetas con lo que sobra (va con el armador de semanas).

- [ ] **Step 2: Spec**

`Estado: implementado`. Corregir dos cosas que cambiaron al implementar: el renglón muestra el nombre del
primer ingrediente (no el canónico del catálogo), y las cantidades se ven en decimales (`0.25`), como en el
resto de la app.

- [ ] **Step 3: Commit**

```bash
git add TODO.md docs/superpowers/specs/2026-10-14-compras-redondeadas-design.md
git commit -m "docs(comidas): compras redondeadas implementadas"
```
