# Lista de compras en cantidades que se compran, y lo que sobra a la despensa

Fecha: 2026-10-14
Estado: diseñado

## Qué resuelve

Las comidas vienen por porción —1/4 de brócoli, 1/2 cebolla, 3/4 de huevo— y
la lista de compras suma eso tal cual, así que pide cosas que no se venden:
"6,5 huevos", "3/4 brócoli". Y lo que sobra de lo que sí se compró (el 1/4 de
brócoli que va al freezer) no llega a la despensa, así que la semana siguiente
se vuelve a comprar.

Lo que sobra no se modela por tipo (si se congela, si se echa a perder): va a
la despensa y ya.

## Lo que ya existe y se reusa

- **Despensa** (`PantryItem`, `pantry` en `meal.service.ts`): la lista ya resta
  lo que hay (`subtractPantryFromNeeded`) y tilda sola lo que queda cubierto.
  `addToPantry` suma si la entrada existe; `subtractFromPantry` no baja de 0.
- **Catálogo** (`catalogo/catalogo.ts`): `EntradaCatalogo` con `unidad`,
  `porcion`, `sinonimos`; `clasificar` reconoce plurales y sinónimos. Hay
  catálogo base y catálogo propio por usuario encima (`entradaPropia`, editado
  desde `meal-editor`).
- **`quantityOverride`**: cantidad pisada a mano por semana.

## 1. Cálculo de la lista

### Qué se compra

Función pura nueva en `catalogo/catalogo.ts`:

```ts
// Cuánto se compra para cubrir `necesario`, en la misma unidad.
export function aComprar(necesario: number, unidad: string, entrada: EntradaCatalogo | null): number
```

- Si `entrada?.compra` existe: redondea para arriba al múltiplo de `compra`
  (huevos de a 6, carne de a 250 g).
- Si no, y la unidad es contable —vacía, `unidad`, `unidades`, `atado`—:
  redondea al entero de arriba.
- Cualquier otra unidad (g, ml, taza, cda, puñado) queda igual.
- `necesario <= 0` devuelve 0. Se redondea con tolerancia (`1e-9`) para que
  `0.25 * 4` no dé 2 por error de coma flotante.

`EntradaCatalogo` suma un campo opcional:

```ts
// Paso de compra, en `unidad`: huevos de a 6, carne de a 250 g. Sin valor,
// lo contable va al entero de arriba y lo demás queda como está.
compra?: number;
```

En el catálogo base se carga sólo donde es obvio (huevo: 6). El resto lo fija
cada usuario en su catálogo propio: `entradaPropia` suma el campo y lo
conserva de la entrada existente, y el formulario de `meal-editor` agrega el
input.

### Orden del cálculo

Por renglón de la lista:

1. **Necesario**: suma de la semana (como hoy).
2. **Falta**: necesario − despensa (como hoy, `subtractPantryFromNeeded`).
3. **Compra**: `aComprar(falta, unidad, entrada)`.
4. **Sobra**: compra − falta.

Ej.: necesitás 3/4, tenés 1/2, falta 1/4, comprás 1, sobran 3/4.

Un `quantityOverride` manual gana: lo pisado es lo que se compra, sin redondeo
y sin sobra.

### Agrupar por entrada del catálogo

Hoy `shoppingListGrouped` agrupa por nombre crudo en minúscula: "Huevo" y
"huevos" son dos renglones, y redondear cada uno por separado compra de más.
Pasa a agrupar por `clasificar(nombre, indiceCatalogo())?.nombre`, y lo que el
catálogo no reconoce sigue agrupando por nombre crudo. El renglón muestra el
nombre canónico de la entrada.

Lo que es por semana (`checkedItems`, `quantityOverrides`, `compras`) pasa a
esa clave. Costo aceptado: en la semana en curso, un tilde u override guardado
con un nombre que ahora agrupa distinto se pierde una vez. Sin migración.

Lo permanente no cambia de clave, para no perder datos: `ingredientTags` se
sigue buscando por nombre crudo (el renglón toma la etiqueta del primer
ingrediente que tenga, como hoy), y la despensa guarda los nombres como los
escribió el usuario; sólo la búsqueda compara por clave, así "huevos" en la
despensa cubre el renglón "huevo".

Fuera de alcance: "clara → huevo" (una entrada de compra que apunta a otra).

### Bug que se arregla de paso

Desde la migración que separó la unidad (`MIGRATION_SPLIT_UNIT_KEY`),
`Ingredient.quantity` es sólo el número y la unidad vive en `Ingredient.unit`.
`addQuantities` parsea sólo `quantity`, así que "100" g + "1" unidad del mismo
ingrediente suma 101. Pasa a comparar `unit`: distinta unidad queda como
"100 g + 1", igual que hoy cuando no se puede sumar, y ese renglón no se
redondea.

### Cómo se ve

- Renglón: **"Brócoli 1 · usás 3/4"**. El "· usás" sólo aparece cuando la
  compra difiere de lo que falta.
- "Copiar" (WhatsApp) sale con lo redondeado, sin el "usás".

## 2. Tildar congela lo comprado y manda la sobra a la despensa

### El problema que esto evita

La lista resta la despensa de la misma semana. Si al comprar el brócoli el
1/4 sobrante entra a la despensa, la lista lo resta: falta 3/4 − 1/4 = 1/2,
redondea a 1 y dice que sobra 1/2. Se pisa sola. Por eso tildar **congela**.

### Estado nuevo

```ts
// Por semana y por clave de renglón: lo que se compró al tildar y lo que sobró
// y entró a la despensa. Sin registro, el ítem no está tildado por compra.
readonly compras = signal<Record<string, Record<string, { compra: string; sobra: string }>>>
```

Se persiste igual que `checkedItems`: localStorage, Firestore con la cola de
guardado (`cola.debeGuardarAhora('compras')`), `estadoActual()`, la tabla de
restauración y el grupo de la lista en `services/backup.ts`. Vive dentro de
`users/{uid}`: no hace falta regla nueva de Firestore.

### Al tildar (`toggleItemCheck`, de no tildado a tildado)

1. Guarda `{ compra, sobra }` del renglón tal como se ve en ese momento.
2. Si `sobra > 0`: `addToPantry(nombre, sobra)`.
3. Aviso: "+1/4 brócoli a la despensa".

Sólo hay registro si `compra > 0`. `toggleItemCheck` también lo llaman la
despensa cuando cubre un ítem y el botón "Restar de la despensa" del renglón:
los dos pasan por esta misma lógica, y el plan tiene que verificar cada caller
para que ninguno sume una sobra calculada con la despensa a medio restar.

Un renglón tildado **con registro** muestra la `compra` congelada y **no resta
la despensa**. El que la despensa tilda sola porque lo cubre no tiene registro
ni sobra, y se comporta como hoy.

### Al destildar

1. `subtractFromPantry(nombre, sobra)` si había sobra.
2. Borra el registro.
3. Aviso: "−1/4 brócoli de la despensa".

### "Limpiar" la semana (`clearOverrides`)

Además de lo que hace hoy, deshace las sobras de la semana en la despensa
(como destildar todo) y borra los registros, para que limpiar y volver a
tildar no duplique.

### El aviso

No hay toasts en la app. Signal de texto en el componente de la lista que se
borra a los 3 s, dentro de un `aria-live="polite"`. Sin servicio global.

## Fuera de alcance

- Sugerir recetas con lo que sobra ("te sobra 1/4 de brócoli → tarta de
  brócoli"): va con el armador de semanas, que usa el mismo puntaje.
- Vencimiento o freezer por ingrediente.
- Convertir entre unidades (g ↔ unidad, métrico ↔ imperial).

## Pruebas

Vitest, en los specs que ya existen:

- `catalogo.spec.ts`: `aComprar` — contable sin paso (0.75 → 1, 6.5 → 7, 3 →
  3), con paso (6.5 huevos de a 6 → 12; 300 g de a 250 → 500), unidad no
  contable queda igual, 0 → 0, coma flotante (`0.25 * 4` → 1). `entradaPropia`
  conserva y escribe `compra`.
- `meal.service.spec.ts`:
  - "Huevo" + "huevos" en un renglón, redondeado una vez.
  - Distinta unidad del mismo ingrediente no se suma ni se redondea.
  - Orden: despensa primero, después redondeo (3/4 con 1/2 en despensa →
    compra 1, sobra 3/4).
  - Override manual gana sobre el redondeo.
  - Tildar suma la sobra a la despensa y el renglón no cambia después;
    destildar deja la despensa como estaba (ida y vuelta).
  - Limpiar la semana deshace las sobras.
  - `compras` entra en `estadoActual()` y se restaura.
