# Recetas con imágenes, por link

Fecha: 2026-09-09
Estado: diseñado, sin implementar

## Qué resuelve

Que una receta pueda tener fotos —el plato terminado y una por paso— **sin
resolver el hosting**. Las imágenes se referencian por URL: el usuario pega un
link a una imagen que ya vive en otro lado.

Esto desbloquea la fase 4 del [spec de
recetario](2026-09-03-recetario-design.md), que quedó trabada en el alta de
Cloudflare R2 —pide tarjeta—. El diseño de acá es **independiente del
hosting**: el día que haya subida real, lo único que cambia es de dónde sale la
URL. El modelo, las vistas y el documento público no se tocan.

## La decisión que manda

**El hero de la ficha es una banda; la foto la rellena.**

No es "la ficha con foto" y "la ficha sin foto". Es una sola ficha con una
banda arriba, que sin foto muestra un degradado del accent y con foto muestra
la imagen. Pegar un link no reacomoda la página: cambia el relleno de un bloque
que ya estaba.

Sale de un requisito explícito: hoy ninguna receta tiene foto y muchas no la
van a tener nunca, así que **el estado sin foto no es el caso degradado, es el
caso normal**. Un diseño que se vea bien sólo con imágenes está mal para esta
app.

La tarjeta del listado **no** sigue esa regla, y es a propósito (ver *Vistas*).

## Modelo de datos

```ts
export type Paso = {
  texto: string;
  foto?: string;   // URL http(s) a una imagen de otro lado
};

export type Meal = {
  // ...lo que ya tiene
  foto?: string;   // el plato terminado
  pasos?: Paso[];
};
```

Los dos campos son opcionales: los documentos guardados hoy son válidos sin
tocarlos. **No hay migración.**

Coincide con lo que el spec de recetario ya había escrito para la fase 4, sólo
que el comentario decía "URL de Storage" y ahora es una URL cualquiera. Esa es
toda la diferencia de modelo entre este camino y el de hosting propio.

### Lo que NO se guarda

Ni el ancho, ni el alto, ni un thumbnail, ni un hash. Nada de eso se puede
saber de una URL ajena sin descargarla, y el layout no lo necesita: los
contenedores tienen alto fijo y la imagen entra con `object-fit: cover`.

## Validación

Es la URL de una imagen y nada más, así que no lleva función propia ni test.
Angular ya trae todo:

```ts
foto: ['', Validators.pattern(/^https:\/\//)]
```

más `type="url"` en el input. Con eso:

- El botón Guardar ya usa `[disabled]="form.invalid"`, así que un link mal
  pegado bloquea el guardado solo.
- El teléfono levanta el teclado de URL.
- El campo sigue siendo opcional sin escribir nada: los validadores de Angular
  no corren sobre valor vacío.

**`https` no es purismo.** La app se sirve por https, así que un
`<img src="http://…">` lo bloquea el navegador por contenido mixto: esa foto no
se vería nunca. No es una preferencia, es lo único que funciona.

Angular sanitiza el `[src]` de un `<img>` por su cuenta, así que un
`javascript:` tampoco se ejecutaría. El validador está para que el usuario vea
el error al pegar mal, no como barrera.

**El Worker no replica nada de esto.** Se consideró y no corresponde: no
concatena, usa `el.setAttribute('content', …)`, que escapa —el `og:title` con
el nombre de la receta ya depende de eso—, así que meter la URL tal cual no
abre ninguna inyección. Lo que el Worker sí hace es un fallback, que es otra
cosa (ver *`og:image`*).

## Imágenes que no cargan

Un link ajeno se muere: el host lo borra, cambia de nombre, bloquea hotlinking.
**Cada `<img>` lleva un `(error)` que oculta el elemento**, y el contenedor cae
al estado sin foto. No hay ícono de imagen rota en ningún lado.

Es la razón de más peso para que el diseño funcione sin foto: no es sólo el
estado inicial, es también el estado al que puede volver cualquier receta sin
avisar.

**Excepción a propósito: la miniatura de previsualización del editor no lleva
`(error)`.** Angular reusa el elemento cuando cambia `[src]`; ocultarlo en el
error lo dejaría oculto para siempre aunque el usuario corrija el link después,
porque nada vuelve a mostrarlo. En el editor, además, una imagen rota es
exactamente la información que la miniatura existe para dar.

## Vistas

### Ficha (`receta-detalle`)

El componente lo comparten tres pantallas —`/meals/:id`, la página pública
`/r/…` y la receta del día—, así que esto vale en las tres.

- Banda arriba, alto fijo. Con foto: `object-fit: cover`. Sin foto: degradado
  del accent.
- El título va **encima** de la banda, con velo de degradado **y**
  `text-shadow`. El velo solo no alcanza: la foto es de cualquier lado y una
  muy clara se come el título.
- Nada más cambia. Los ingredientes, el selector de porciones y los pasos
  quedan donde están.

### Tarjeta (`meal-card`)

**Portada arriba, sólo si hay foto.** La tarjeta sin foto queda exactamente
como hoy.

Acá **no** se repite la banda de la ficha, y la coherencia formal se sacrifica
a propósito: en la ficha hay una banda, en la grilla habría treinta y cuatro, y
serían setenta y pico de píxeles de degradado vacío por tarjeta empujando los
ingredientes abajo del pliegue. Son densidades distintas: la ficha muestra una
receta, la tarjeta muestra todas.

La grilla despareja no es problema en `/meals`: usa **multicolumna CSS**
(`columns: 200px` + `break-inside: avoid`, `meal-list.component.scss:56`), o
sea mampostería, y los altos ya son disparejos por diseño.

Sí lo es en el selector del día, que usa Grid de verdad
(`repeat(auto-fill, minmax(200px, 1fr))`, `meal-selector.component.scss:23`):
ahí las filas se alinean y una tarjeta con portada estiraría a sus vecinas.
Se resuelve con **`align-items: start`** en ese `.grid`. Efecto lateral
aceptado: el selector pasa a verse dentado, como `/meals`.

### Modo cocina

**Foto arriba a todo el ancho, texto grande debajo.** Sin foto, el texto sube.

El criterio no es estético: es teléfono apoyado, manos sucias, mirando de
lejos. Lo que manda es que **los botones queden siempre en el mismo lugar**,
haya foto o no, porque se les pega sin mirar.

Se descartó la foto al costado del texto: entra más texto pero achica la foto
justo en la pantalla donde más grande se la quiere, y mueve el punto donde
arranca el texto según haya imagen.

Queda **fuera de alcance** el tap para ampliar a pantalla completa. Es una
pantalla más para construir y mantener, y el valor aparece recién cuando las
fotos muestren un detalle fino. Anotarlo en `TODO.md`.

### Editor

- Un campo de URL para la foto del plato, en el bloque de arriba.
- Un campo de URL por paso, en cada `paso-row`.
- Los dos con validación al guardar y con una miniatura de previsualización
  cuando la URL carga, para que se vea al instante si el link sirve.

**Un paso con foto y sin texto se sigue descartando.** `limpiarPasos` filtra
por `texto` vacío y eso no cambia: lo que hace a un paso es la instrucción, la
foto acompaña.

## Receta pública

`aRecetaPublica` es una **lista blanca a propósito** —el comentario en
`receta-publica.ts` ya anticipa este caso—, así que los campos nuevos **no se
publican solos**. Hay que agregarlos a mano:

- `foto` del `Meal`.
- `foto` de cada `Paso`, en la proyección paso por paso que ya existe.

Se copian tal cual: el editor no deja guardar una URL que no arranque con
`https://`, así que lo que hay en el `Meal` ya pasó por el validador.

## `og:image`

Es la mejor parte del negocio y casi no cuesta: el Worker **ya** tiene
`og:image` cableado, a una constante (`worker/index.js:8`,
`IMAGEN = 'https://comidas.tatoh.ar/icon.png'`).

- `normalizar()` suma `foto` a lo que lee del documento REST.
- `imagen: receta.foto.startsWith('https://') ? receta.foto : IMAGEN`.

Ese `startsWith` no es la validación del editor de nuevo: es que el tag sirva.
La página se sirve por https y un `og:image` en `http://` es contenido mixto
—varios crawlers lo descartan y te quedás sin preview en vez de con uno feo—, y
sin foto hay que caer al ícono en vez de emitir un `og:image` vacío, que es peor
que el genérico.

Con eso el preview de WhatsApp de una receta compartida deja de ser el ícono
genérico y pasa a ser el plato.

Los tests puros del Worker (`worker-og.spec.ts`) cubren `normalizar` y
`describir`; el campo nuevo entra ahí.

## Lo que se acepta como costo

- **Privacidad**: el navegador de quien abra la receta pide la imagen al host
  ajeno, que ve su IP y su user-agent. Es inherente a referenciar por URL.
  Vale la pena decirlo en la ayuda del campo.
- **Sin offline**: el service worker cachea assets de la app, no imágenes de
  terceros. Una receta abierta sin conexión se ve sin fotos. El diseño ya
  funciona sin ellas, así que degrada bien.
- **CSP**: hoy `public/_headers` no define ninguna, por eso las imágenes
  externas cargan. Si alguna vez se agrega, tiene que dejar `img-src` abierto o
  esto se rompe entero y en silencio. Anotarlo junto al `_headers`.
- **Enlaces podridos**: no hay forma de saber que una foto murió hasta que
  alguien abre la receta. No se construye ningún chequeo.

## Fuera de alcance

- Subida de archivos y hosting propio (R2). Sigue siendo la fase 4 del spec de
  recetario; este diseño no la contradice ni la reemplaza.
- Compresión, redimensionado, thumbnails. No hay archivo propio que comprimir.
- Galería de varias fotos por receta.
- Tap para ampliar en modo cocina.

## Plan de implementación

Cada paso deja la app andando.

1. **Modelo.** `Meal.foto` y `Paso.foto`. Nada visible todavía.
2. **Editor.** Los dos campos con `type="url"` y `Validators.pattern`, más la
   miniatura de previsualización. A partir de acá se pueden cargar fotos aunque
   no se vean en ningún lado.
3. **Ficha.** La banda, con y sin foto, con velo y `text-shadow`, y el
   `(error)` que oculta. Es donde se ve el trabajo del paso 2.
4. **Tarjeta y modo cocina.** Portada condicional, `align-items: start` en el
   selector, y la foto del paso arriba del texto.
5. **Público y `og:`.** `aRecetaPublica` suma los dos campos, el Worker lee
   `foto` y la usa como `og:image` con fallback.

El 5 va último a propósito: es el único que escribe en una colección de lectura
pública, y conviene que el resto esté probado antes de empezar a repartir
links con imágenes adentro.
