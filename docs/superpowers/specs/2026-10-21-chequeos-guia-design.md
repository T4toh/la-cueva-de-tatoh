# Chequeos de la guía contra la semana

Fecha: 2026-10-21
Estado: implementado

## Qué resuelve

La guía ([spec](2026-10-08-guia-design.md)) junta las reglas, pero no dice si
la semana cargada las cumple. Para el que ya las sabe de memoria no hace
falta. El que las está aprendiendo carga el plan de a pocos días, desde el
selector, y no tiene cómo ver que el miércoles quedó con carbos en almuerzo y
cena salvo que repase los días uno por uno.

Los chequeos **marcan y ya**: no bloquean una elección ni preguntan "¿seguro?".
La marca queda pegada a lo que no cumple, en el plan, y el tip del plan pasa a
mostrar esa regla.

También es el cálculo que va a usar el armador de semanas (TODO) para puntuar
candidatas. Por eso son funciones puras, como `catalogo/plantas.ts`.

## Alcance

- **La semana del plan y nada más.** No se mira contra semanas anteriores.
- **Dos reglas en esta entrega:** `un-carbo-por-dia` y `frecuencia-carnes`,
  las dos de `REGLAS` en `guia/guia.ts`.
- **Una regla oculta no se chequea.** Cada uno tiene problemas o detalles
  distintos, y la guía ya deja ocultar lo que no sirve. Es la única
  configuración: los umbrales son los de la regla (carne roja hasta 3), fijos.
- Las reglas propias son texto libre y no se chequean.

Fuera de alcance: los demás chequeos (medio plato de verdura, fermentado por
día, día vegetariano…), umbrales configurables y el armador de semanas.

## Qué cuenta

Como `plantasDeLaSemana`:

- Cuentan los platos con "Sumar a compras" destildado (`excluded`) y los
  placeholders: se comen igual. "Comida afuera" no tiene ingredientes, así que
  no suma a nada.
- Los campos de texto libre (postres, colación) no cuentan.
- Un `mealId` que ya no existe se saltea.
- Cuentan todos los platos guardados, igual que en plantas y compras: también
  los de una comida oculta en `visibleMeals` y los platos extra que quedan al
  salir del modo familiar, aunque el plan individual sólo muestre el primero.

La unidad es **la comida**, no el plato: en modo familiar, dos platos con
carbos en la misma cena son una vez. Una comida "tiene X" si alguno de sus
platos tiene un ingrediente que `clasificar` reconoce como X.

### Carbos: `un-carbo-por-dia`

- Se miran **almuerzo y cena**. El desayuno no: la regla es "la otra comida,
  proteína y verdura", y en los planes de los que sale el desayuno lleva pan.
- Una comida tiene carbos si algún ingrediente es del grupo `feculentos` o
  `pan`. Las legumbres están en `feculentos` y cuentan.
- No cuentan los ingredientes marcados `menor` (ver *Catálogo*): una
  cucharada de maicena en la salsa blanca o el pan rallado de una milanesa no
  convierten el plato en uno con carbos.
- El día queda marcado cuando almuerzo y cena tienen carbos los dos.

### Carnes: `frecuencia-carnes`

- Se miran **desayuno, almuerzo y cena**.
- Por cada comida, una vez por tipo de carne presente: una cena con pollo y
  carne picada suma una blanca y una roja.
- Se cuentan las tres: pescado, carne blanca y carne roja.
- **Sólo la roja marca**, al pasar de 3. Pescado (≥2) y blanca (2) son
  mínimos, y avisar "falta pescado" un lunes es ruido: se muestran como
  contador, igual que las plantas.
- Huevo y clara no son carne.

## Catálogo

`EntradaCatalogo` suma dos campos opcionales, en el estilo de `legumbre`:

```ts
export type Carne = 'roja' | 'blanca' | 'pescado';

// Dentro de `carnesHuevos`. Sin valor no cuenta para las frecuencias (huevo).
carne?: Carne;
// Va en poca cantidad dentro de otra cosa —espesa, reboza—: no hace de la
// comida una con carbos.
menor?: boolean;
```

En el catálogo base (`catalogo-datos.ts`):

| Entrada | Campo |
|---------|-------|
| carne vacuna, carne picada, lomo, cerdo | `carne: 'roja'` |
| pechuga de pollo | `carne: 'blanca'` |
| pescado, atún | `carne: 'pescado'` |
| maicena, pan rallado | `menor: true` |

El cerdo va como roja: es lo que dice la OMS.

`menor` también se aplica en `resumenPlato` (`catalogo/plato.ts`): el chip
"feculento" del editor y la marca del plan tienen que decir lo mismo de la
misma comida. Y tampoco cuenta como el cereal de "legumbre + cereal": unas
lentejas espesadas con maicena no pasan a ser proteína.

### Catálogo propio

- **Formulario de clasificar** (`meal-editor`): con grupo `carnesHuevos`
  aparece un `<select>` más, "Tipo": roja / blanca / pescado / ninguna. Se
  precarga con lo que tenga la entrada. Sin esto, un usuario que carga
  "vacío" u "osobuco", que el base no tiene, no tiene cómo hacer que cuenten.
- **`entradaPropia`** recibe `carne` del formulario y lo guarda sólo si el
  grupo es `carnesHuevos`. `menor` se conserva de la entrada existente cuando
  el grupo no cambia, igual que `legumbre`. No hay control en el formulario
  para `menor`.
- **Las correcciones ya guardadas:** una propia que reemplaza a una carne del
  base (porque alguien le corrigió la porción a "carne vacuna") se guardó sin
  `carne` y saca la del base entera en `combinar`, así que dejaría de contar
  sin que nadie se entere. `combinar` hereda `carne` y `menor` de la entrada
  base que reemplaza cuando el grupo coincide y la propia no trae ese campo.
  Con "ninguna" en el select, la propia guarda la ausencia explícita (ver
  *Para el que lo construye*).

## Cálculo

Módulo nuevo `guia/chequeos.ts`, funciones puras con su spec:

```ts
export type ChequeoSemana = {
  // Días con carbos en almuerzo y cena, por `dayName`.
  diasConDosCarbos: string[];
  carnes: Record<Carne, number>;
  // Ids de las reglas que la semana no cumple, en el orden de `REGLAS`.
  incumplidas: string[];
};

export const MAX_CARNE_ROJA = 3;
export const MIN_PESCADO = 2;
export const META_CARNE_BLANCA = 2;

export function chequearSemana(semana: DaySchedule[], meals: Meal[], indice: IndiceCatalogo): ChequeoSemana;
```

`incumplidas` trae `un-carbo-por-dia` si hay algún día marcado y
`frecuencia-carnes` si la roja pasa de `MAX_CARNE_ROJA`. Las ocultas se
filtran afuera, en el dashboard: el cálculo no sabe de la guía del usuario,
así el armador lo puede usar con cualquier conjunto de reglas.

## En el plan (`dashboard`)

Un `computed` con `chequearSemana` sobre `schedule()`, `meals()` e
`indiceCatalogo()`, junto al de `plantas`. Las reglas visibles salen de
`armarGuia`, como ya hace `tip`.

- **Día marcado** (si `un-carbo-por-dia` está visible): una línea arriba de
  los slots del `day-panel`, "Carbos en almuerzo y cena", en `--warning`
  sobre `--warning-muted`. Sin interacción.
- **Contador de carnes** (si `frecuencia-carnes` está visible): una línea
  bajo el botón de plantas, "Pescado 1 de 2 · Blanca 2 de 2 · Roja 1 de 3",
  en ese orden, que es el del texto de la regla. Sólo "Roja" va en
  `--warning` cuando pasa de 3. Se muestra con ceros: es un contador, como el
  de plantas.
- **Tip:** si hay incumplidas visibles, con `saltoTip() === 0` el tip es la
  primera de ellas. "Otro" sigue a la rotación normal de `tipDelDia`. Al
  recargar vuelve la incumplida.
- La marca y el contador se ocultan en `@media print`, como `.tip` y
  `.plantas`.

## Tests

- `guia/chequeos.spec.ts`: carbos en almuerzo y cena marca; carbos en
  desayuno y almuerzo no; dos platos con carbos en la misma cena no marcan;
  sólo maicena o pan rallado no cuenta; un plato `excluded` cuenta; "Comida
  afuera" no suma; una comida con pollo y carne picada suma una de cada;
  cuatro rojas dan `frecuencia-carnes` en `incumplidas`, tres no; huevo no
  suma.
- `catalogo.spec.ts`: `combinar` hereda `carne` de la base reemplazada con el
  mismo grupo y no la hereda si cambió el grupo; `entradaPropia` guarda
  `carne` sólo en `carnesHuevos`.
- `plato.spec.ts`: `resumenPlato` no marca feculento con sólo pan rallado.

## Para el que lo construye

Decisiones mías, no pedidas, que se pueden revisar:

- Desayuno fuera del chequeo de carbos, y legumbres adentro.
- `menor` como campo nuevo en vez de deducirlo de que la entrada no tenga
  `porcion` (tostadas de arroz tampoco tiene porción y sí es un carbo).
- El cerdo como roja.
- Contar también los platos que el plan no muestra (comida oculta, extras del
  modo familiar), por consistencia con plantas y compras.
- Cómo se representa "ninguna" en una propia que reemplaza a una carne del
  base para que `combinar` no le vuelva a heredar `carne`: un valor explícito
  (`carne: null` o similar) o lo que resulte más limpio con el tipo, siempre
  que una entrada vieja sin el campo siga heredando.
- El texto exacto de la marca y el contador, y su estilo dentro de
  `--warning`.
