# Recetario en `comidas`

**Fecha:** 2026-09-03
**Estado:** diseño aprobado, sin implementar

## Qué es

Poder escribir una receta completa —ingredientes, pasos, fotos— dentro de la
app `comidas`, y que esa receta **sea** una de las comidas que ya existen: se
programa en el calendario, alimenta la lista de compras y se ve como resumen en
la tarjeta de siempre.

## La decisión que manda

**La receta no es una entidad nueva. Es un `Meal` con más campos.**

`Meal` ya tiene `ingredients: Ingredient[]` (con `quantity` y `unit`),
`description` y `tags`. Lo único que le falta a una receta son los pasos y las
fotos. Modelarla aparte obligaría a duplicar o sincronizar los ingredientes, y
a que todo el código que hoy asume `meals` deje de alcanzar.

De ahí sale que no haya conversión de "receta" a "comida": no hay dos cosas.

## Modelo de datos

```ts
export type Paso = {
  texto: string;
  foto?: string;   // URL de Storage
};

export type Meal = {
  // ...lo que ya tiene
  foto?: string;   // el plato terminado
  pasos?: Paso[];
};
```

Los dos campos son opcionales, así que los documentos que ya están guardados
son válidos sin tocarlos: **no hay migración**. Una comida sin `pasos` es lo que
hay hoy; una con `pasos` es una receta.

### Dónde se guarda

En el documento único que ya existe: `users/{uid}`, el mismo que
`meal.service.ts:385` escribe con `setDoc({ meals, schedule, pantry, ... })`.

**Techo conocido:** Firestore corta en 1 MiB por documento y cada guardado
reescribe el documento entero. Una receta con 8 pasos escritos pesa ~1,5 KB de
texto (las fotos no cuentan: en Firestore va sólo la URL), así que el límite
llega alrededor de las 300-500 recetas. Además, cada apertura de la app baja el
texto de todas las recetas, las estés mirando o no.

**Salida cuando importe:** mover `pasos` a una subcolección
`users/{uid}/recetas/{mealId}`, cargada sólo al abrir la ficha. `Meal` se queda
donde está, así que la tarjeta, el calendario y la lista de compras no se
enteran. Marcar el techo con un comentario `ponytail:` en el modelo y anotarlo
en `TODO.md`.

Se descartó arrancar directamente con la subcolección: paga hoy la complejidad
de un problema que llega en varios años, y mudarse el día que llegue es mover un
campo, no rehacer el modelo.

También se descartó modelar la receta como una colección propia separada del
`Meal`: escala sin techo, pero vuelve a partir la receta de la comida y obliga a
sincronizar los ingredientes entre las dos.

## Fotos

Van a **Firebase Storage**. No hay dependencia nueva que instalar:
`@angular/fire/storage` ya viene en el paquete instalado (20.0.1) y el
`storageBucket` ya está configurado en `app.config.ts:21`. Falta sólo el
`provideStorage(() => getStorage())`.

Se descartó R2 de Cloudflare: tiene egress gratis, pero necesita un Worker que
firme las subidas, y a esta escala no compra nada que Firebase no dé.

- **Ruta:** `users/{uid}/recetas/{mealId}/{id}.jpg`, espejando Firestore.
- **Compresión en el browser antes de subir**, con `canvas`: 1200 px de lado
  mayor, JPEG calidad 80. Una foto de celular pesa 3-5 MB y queda en ~200 KB.
  Sin esto, los 5 GB gratis se agotan en ~1.200 fotos en vez de ~25.000, y cada
  visita a una receta baja megabytes. Va en un helper propio, con test.
- **Borrar una receta borra sus fotos.** Si no, el bucket junta huérfanos que
  nadie ve y que se pagan igual.

### Costo

Desde el 3 de febrero de 2026 Cloud Storage for Firebase **exige plan Blaze**,
o sea una cuenta de facturación cargada, aunque no se gaste nada. El *Always
Free* sigue en 5 GB guardados y 100 GB de bajada por mes.

Con foto del plato más foto por paso son ~7 fotos por receta a ~200 KB, o sea
**~1,4 MB por receta**: unas 3.500 recetas dentro del tramo gratis.

### Lo que no es opcional

Blaze **no tiene tope de gasto por defecto**. Dos cosas lo contienen:

1. **Reglas del bucket**: rechazar todo lo que no sea `image/*` o pese más de
   1 MB, y sólo bajo el `uid` propio. Es lo que separa "gratis para siempre" de
   "alguien subió un video".
2. **Alerta de presupuesto** en Google Cloud, aparte de las reglas. La regla
   evita el abuso; la alerta avisa si igual pasa algo.

### Las URLs de Storage son públicas

`getDownloadURL()` devuelve una URL con token que **funciona para cualquiera
que la tenga**, sin importar las reglas del bucket: las reglas protegen el
listado y la escritura, no una URL ya emitida. Pegar esa URL en un post público
publica esa foto, aunque la receta siga siendo privada.

Para el blog, entonces, la foto se copia al repo en `public/img/...` como
cualquier otra imagen de post — que además es la convención que ya se fijó al
sacar las portadas de los libros de Amazon.

## Pantallas

- **Tarjeta / lista**: lo que ya existe. Suma la miniatura si hay `foto` y un
  indicador de que la comida tiene receta.
- **Ficha `/meals/:id`**: ruta nueva — hoy sólo existen `meals/new` y
  `meals/edit/:id`, no hay vista de sólo lectura. Foto arriba, ingredientes con
  el selector ×1 ×2 ×3, pasos numerados abajo con su foto.
- **Modo cocina**: dentro de la ficha, un paso por pantalla, se tacha y se
  avanza. Es la razón por la que los pasos son una lista y no un textarea: el
  texto libre no se puede numerar ni tachar sin parsearlo.
- **Editor**: `meal-editor` suma un `FormArray` de pasos, mismo patrón que el
  `ingredients` que ya tiene (`meal-editor.component.ts:115`). Agregar, borrar,
  reordenar, y el input de foto por paso.
- **Copiar como markdown**: botón en la ficha que deja ingredientes y pasos en
  el portapapeles, listos para pegar en un `.md` del blog. El patrón ya existe
  en `shopping-list.component.ts:191`.

### El ×N es sólo de la vista

No se guarda nada. Las cantidades se guardan por porción y se multiplican al
mostrar, que es exactamente lo que ya hace `shoppingListGrouped` en
`meal.service.ts` con `multiplyQuantity(ing.quantity, dish.portions)`.

## Arreglo puntual: `multiplyQuantity`

Hoy es `private` y tiene dos problemas que el ×3 en pantalla hace visibles:

- `parseFloat('1/2')` devuelve `1`, así que `"1/2 taza"` en ×2 da `"2"` cuando
  debería dar `"1"`. Ya pasa en la lista de compras.
- `if (factor <= 1) return quantity` deja fuera cualquier factor fraccionario,
  o sea que "media receta" no es expresable.

Se expone y se le arregla el parseo de fracciones, con test. Arregla la lista de
compras de paso.

## Alcance

**Privado.** Las recetas viven en `users/{uid}` y no las ve nadie más. Las
reglas de Firestore no cambian.

Lo único que se deja "listo para compartir" es que `Meal` ya tiene un `id`
estable. No se diseña la colección pública ni se agregan flags que hoy no hacen
nada: eso es complejidad especulativa que se paga aunque nunca se use.

Como consecuencia, un link desde el blog a una receta le muestra una pantalla
de login a cualquiera que no sea el dueño. Escribir sobre una receta en el blog
es escribir un post normal, con el botón de copiar como markdown haciendo el
trabajo aburrido.

## Fuera de alcance

Import/export de recetas, buscador propio, categorías nuevas, valoraciones,
tiempo de cocción como campo estructurado, y todo lo de la colección pública.
Nada de eso está pedido y todo se agrega después sin romper lo de arriba.

## Plan de entrega

Cuatro partes, un PR cada una. El orden es por dependencia, y cada una deja algo
usable si se para ahí.

### 1. Cantidades

Exponer `multiplyQuantity`, arreglar el parseo de fracciones y permitir factores
fraccionarios, con tests.

No depende de nada del recetario: arregla un bug que la lista de compras ya
tiene hoy, así que se mergea sola. Va primera porque el ×N de la parte 3 usa la
función arreglada.

### 2. La receta escrita

`Paso`, `Meal.pasos`, el `FormArray` de pasos en `meal-editor`, la ficha
`/meals/:id` de sólo lectura y el indicador de receta en la tarjeta.

Es el grueso. Cuando cierra ya se escriben recetas y se leen cocinando, sin
tocar Storage ni necesitar Blaze.

### 3. Cocinar

El selector ×1 ×2 ×3, el modo cocina y el botón de copiar como markdown. Las
tres cosas cuelgan de la ficha de la parte 2, y el ×N necesita la parte 1.

### 4. Fotos

`provideStorage`, la compresión con `canvas`, las reglas del bucket, la subida
en el editor y el borrado en cascada.

Va última a propósito: es la única bloqueada por un trámite externo —Blaze
necesita una tarjeta cargada antes de poder probar nada— y la única que puede
generar factura. Las otras tres no dependen de ella.

## Testing

`comidas` es el único proyecto con specs (Vitest, `pnpm test`). Van tests de:

- `multiplyQuantity` con fracciones, texto no numérico (`"a gusto"`) y factores
  fraccionarios.
- El helper de compresión: que respete el lado mayor y baje el peso.
- El armado del markdown para el portapapeles.
