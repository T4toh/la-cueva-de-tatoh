# Receta pública por link en `comidas`

**Fecha:** 2026-09-07
**Estado:** diseño aprobado, sin implementar

## Qué es

Compartir una receta con alguien que no tiene cuenta: se copia un link, se pega
en un chat, y del otro lado se abre la receta completa —ingredientes, pasos,
porciones— sin login. El preview del link tiene que verse bien pegado: título,
descripción y autor propios, no el genérico de la app.

## Las dos decisiones que mandan

### 1. La receta pública es otro documento, no una regla nueva sobre el tuyo

`meal.service.ts` guarda **todo en un solo documento**, `users/{uid}`: comidas,
calendario, despensa y lista de compras conviven ahí adentro. Las reglas de
Firestore son por documento, no por campo. No existe forma de abrir una receta
sin abrir todo lo demás.

De ahí sale que publicar sea **copiar** a una colección nueva,
`recetasPublicas/{id}`, con un `id` corto que genera la app. El documento
privado no se toca ni se afloja.

### 2. Los `og:` los inyecta un Worker, no el cliente

`comidas` es una SPA sin prerender, y el crawler de WhatsApp no corre JS: lee el
HTML como viene y se va. Los meta tags tienen que estar escritos en la respuesta
antes de que Angular arranque, y eso sólo lo puede hacer algo que corra en el
servidor.

`comidas` ya se despliega como Worker con Static Assets —lo que no tiene es un
script—, así que se le agrega uno que corre **sólo** en `/r/*`. El resto de
la app sigue siendo asset puro.

Se evaluó que el Worker renderizara la página entera en HTML plano, sin Angular.
Se descartó: la regla de lectura tiene que ser pública en los dos casos (el
Worker lee por REST sin credenciales), así que la lectura del cliente sale
gratis, y renderizar aparte obligaría a dibujar la receta dos veces.

## Modelo de datos

```ts
// Colección nueva, de lectura pública.
type RecetaPublica = {
  nombre: string;
  descripcion?: string;
  ingredientes: Ingredient[];
  pasos?: Paso[];
  alias?: string;      // autor, copiado del documento del usuario
  ruta: string;        // la URL canónica completa, ya armada
  actualizada: number;
  ownerUid: string;    // lo exige la regla de escritura
};

// En el documento privado.
type Meal = {
  // ...lo que ya tiene
  publicId?: string;   // si está, la receta está publicada
};

// En la raíz del documento del usuario.
alias?: string;
```

**La lista de campos es una lista blanca, no un `...meal`.** `Meal` tiene `tags`
e `includeInShoppingList`, que son organización privada y no tienen por qué
viajar. Y el día que `Meal` gane un campo, no se publica solo.

`publicId` vive del lado privado y es lo que hace que la app sepa que esa receta
está compartida: habilita la sincronización, el botón de despublicar y el
borrado en cascada.

No hay migración: los tres campos son opcionales.

## Reglas de Firestore

```
match /recetasPublicas/{id} {
  // `get` y no `read`: `read` incluye `list`, y con `list` cualquiera puede
  // pedir la colección entera y enumerar las recetas compartidas de todos.
  allow get: if true;
  allow list: if false;
  allow create: if request.auth != null
                && request.resource.data.ownerUid == request.auth.uid;
  // El update valida contra el documento guardado y exige que `ownerUid` no
  // cambie: la propiedad no se transfiere.
  allow update: if request.auth != null
                && resource.data.ownerUid == request.auth.uid
                && request.resource.data.ownerUid == resource.data.ownerUid;
  allow delete: if request.auth != null
                && resource.data.ownerUid == request.auth.uid;
}
```

La regla de `users/{uid}` no cambia. La colección nueva es la única lectura
anónima del proyecto.

**`get` y `list` son permisos distintos, y ahí se juega el modelo entero.**
`allow read` concede los dos, y con `list` cualquiera puede pedir la colección
completa y enumerar las recetas compartidas de todos los usuarios sin tener
ningún link — con lo cual borrar un documento deja de revocar nada, porque el
resto se descubre igual. La llave es el id: sin id, no hay lectura.

Segundo detalle, contra la intuición: **Firestore no evalúa los `match` en
orden.** Cuando el path de una request cae en más de un bloque, se evalúan
todos y los resultados se combinan con OR — alcanza con que uno permita. El
`match /{document=**}` que niega todo no bloquea nada que otro bloque haya
permitido, y moverlo de lugar no cambia el resultado. Está al final por
convención y legibilidad, no porque el orden lo haga funcionar; lo que
protege es qué bloques existen y qué path matchean.

## La URL

```
comidas.tatoh.ar/r/tatoh/milanesa-napolitana/k7m2xq9p
```

Tres segmentos, cada uno con un trabajo: el nick del autor, el nombre de la
receta, y el id. Sin alias cargado el primero desaparece y queda
`comidas.tatoh.ar/r/milanesa-napolitana/k7m2xq9p`.

**El id es lo único que se mira. El nick y el nombre son decorativos.** De ahí
salen todas las propiedades que queremos:

- **Nada que reservar.** Dos usuarios con el mismo nick no chocan, y dos recetas
  con el mismo nombre tampoco, porque ninguno de los dos desambigua nada. No hay
  colección de alias, no hay sufijos `-2`.
- **Renombrar no rompe links.** Cambiás el nombre de la receta o tu nick, el
  documento reescribe su `ruta`, y el link viejo sigue entrando igual. Al
  abrirlo, la ficha corrige la barra de direcciones a la ruta al día con
  `replaceState`, sin recargar.
- **No es enumerable.** Nadie llega a una receta tipeando nombres.

El id es el **último segmento**, siempre. No hay que partir por guiones ni
adivinar dónde termina el nombre: la ruta se corta por `/` y se lee el final.

### Cómo se genera el id

Ocho caracteres, minúsculas y dígitos, con `crypto.getRandomValues` — cinco
líneas, sin dependencia nueva. **No se usa el auto-id de Firestore**: son veinte
caracteres y ensucian el link sin comprar nada.

Ocho caracteres en base 36 son 2,8 billones de combinaciones. Como el id **es**
la llave, ahí el largo es seguridad: con mil recetas publicadas, cada intento a
ciegas acierta una vez cada tres mil millones, contra un Firestore que
rate-limitea. Seis caracteres sería el piso; ocho es el margen cómodo. Bajar de
seis no.

Al publicar se lee el documento antes de escribirlo y, si el id ya existe, se
regenera. Es una lectura extra por publicación, no por visita.

### Los slugs

Los genera la app, no los escribe el usuario: minúsculas, sin tildes, sin
signos, palabras unidas por guiones, corte a cinco palabras. Nombre sin letras
usables —todo emoji— cae a `receta`.

La ruta canónica se arma al publicar y se guarda entera en el campo `ruta`. Así
el Worker no necesita saber slugificar: lee el campo y lo pone en `og:url`.

### Descartados

- **Acortador externo** (`is.gd`, `tinyurl`): el link es la única llave de la
  receta y vive para siempre en el chat de otro. Un tercero en el medio
  significa que el día que cambie de dueño, ponga interstitial o se apague,
  mueren todos los links repartidos, y no hay forma de arreglarlos. Además no
  mejora el preview —el crawler sigue el redirect y lee estos mismos `og:`— y
  cambia nuestro dominio por uno ajeno.
- **`/r/<nick>/<slug>` sin id**: es el link más corto y limpio, pero obliga a
  reservar el alias como usuario único, a sufijar las recetas con el mismo
  nombre, y a guardar los slugs viejos para siempre o romper links al renombrar.
  Encima deja todo lo publicado enumerable.
- **`/receta/<uid>/<idReceta>`**: expone el uid en el link y no se puede revocar
  sin romper la receta.
- **Slug editable por el usuario**: hay que validarlo, guardarlo aparte y decidir
  qué pasa cuando cambia el nombre, y no da nada que el id no dé ya.

## Ciclo de vida

| Acción | Qué pasa |
|--------|----------|
| Publicar | Se crea el documento público, se guarda `publicId` en el `Meal`. |
| Editar una receta publicada | El guardado escribe también el documento público. |
| Despublicar | Se borra el documento público y se limpia `publicId`. |
| Borrar la receta | Se borra el documento público en cascada. |

**La sincronización es automática**: el que abre el link ve siempre lo último, y
no existe el estado "publicada con cambios sin publicar". El guardado de comidas
pasa por un solo `setDoc` sobre `users/{uid}`; el espejo se engancha **ahí**, no
en cada pantalla que edite una receta.

## El Worker

`projects/comidas/wrangler.jsonc` gana dos claves:

```jsonc
"main": "worker/index.js",
"assets": {
  "directory": "../../dist/comidas/browser",
  "binding": "ASSETS",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/r/*"]
}
```

Sin `run_worker_first` el enfoque no funciona: con
`not_found_handling: "single-page-application"` el handler de assets contesta
`/r/*` con el `index.html` **antes** de que el script llegue a correr. El `*`
hace deep matching, así que cubre los tres segmentos.
Requiere Wrangler v4.20.0 o superior, que es lo que usa la build de Cloudflare.

El script va en **JavaScript plano, no TypeScript**: así lo bundlea la build de
Cloudflare sin agregar `wrangler` ni `@cloudflare/workers-types` al repo. Cero
dependencias nuevas.

Flujo, unas 40 líneas:

1. Corta el path por `/` y se queda con el último segmento: el id.
2. `GET https://firestore.googleapis.com/v1/projects/la-cueva-comidas/databases/(default)/documents/recetasPublicas/<id>`,
   sin credenciales — la regla `read: if true` es la que lo habilita.
3. Si Firestore contesta 403 o 404, devuelve `env.ASSETS.fetch(request)` sin
   tocar: la SPA muestra que la receta no existe o dejó de estar compartida.
4. Si contesta OK, pide `/index.html` al binding de assets y lo pasa por
   `HTMLRewriter`, seteando `content` en `<title>`, `og:title`,
   `og:description`, `og:image`, `og:url` y `twitter:card`.
5. `Cache-Control: public, s-maxage=60`.

Dos detalles que no son adorno:

- **`HTMLRewriter` con `setAttribute`, nunca concatenando strings.** El nombre
  de la receta es texto escrito por el usuario y termina dentro de un atributo
  HTML. El rewriter escapa; la concatenación abre inyección.
- **Firestore REST devuelve JSON tipado** (`{fields:{nombre:{stringValue:"…"}}}`),
  así que hay un decodificador chico para los cuatro campos que el Worker mira:
  nombre, descripción, alias, `ruta`, y los largos de ingredientes y pasos.

El `og:description` sale de la descripción de la receta si tiene; si no,
`Receta de <alias> · 8 ingredientes, 5 pasos`.

### `index.html`

`HTMLRewriter` reescribe lo que existe, no inventa, así que los meta tienen que
estar escritos con valores por defecto. Hoy `comidas` no tiene ninguno: el
efecto lateral es que **cualquier** link de la app pasa a tener preview decente,
no sólo las recetas.

## La app

- Dos rutas, **eager**, que difieren en cantidad de segmentos y por eso no se
  pisan: `r/:nick/:slug/:id` y `r/:slug/:id`. Nada de lazy: `comidas` no tiene
  rutas lazy y es justamente eso lo que hace segura la estrategia `skipWaiting`
  de `ngsw-custom.js`. El prefijo `r` no choca con ninguna ruta existente.
- Componente nuevo: lee el documento público con `getDoc` sin auth, lo mapea a
  `Meal` y se lo pasa a `receta-detalle`. Es un wrapper de trece líneas, igual
  que `receta-view`.
- **`receta-detalle` no se toca.** Sólo inyecta `Router` y `DialogService`,
  recibe `meal` como `input.required<Meal>()` y es presentacional puro. El
  selector ×1 ×2 ×3, el modo cocina y el copiar-como-markdown vienen gratis.
- La nav se apaga con un `@if` sobre la URL en `app.html`; en su lugar, un
  "Hecho con Comidas" que linkea a `/`.
- Publicar, copiar el link y despublicar viven en la ficha `/meals/:id`.
- El alias es un campo nuevo en `/settings`.

## Modelo de seguridad

**El id del documento es la llave.** `get: if true` significa que cualquiera
con el link entra, sin cuenta. Es lo pedido, y tiene una consecuencia: un link
filtrado no se puede desfiltrar. Se revoca borrando el documento, y ahí muere
para todos.

**`ownerUid` queda visible** para quien abra el documento público. No está en la
URL, pero está adentro. Es un uid opaco de Firebase y no sirve para leer nada
—`users/{uid}` sigue cerrado al dueño—, pero dos recetas del mismo autor son
atribuibles entre sí por ese campo. La alternativa era guardar la relación sólo
del lado privado, y entonces la regla de escritura no puede verificar quién es
el dueño. Se eligió `ownerUid` a sabiendas.

**El alias es el único dato personal que sale**, y lo elige el usuario. Vacío,
la ficha no muestra autor. El `displayName` de Google no se usa nunca.

## Costo

Las requests servidas por Static Assets son gratis e ilimitadas en todos los
planes; sólo cuentan las que invocan el script. Con
`run_worker_first: ["/r/*"]`, lo único que invoca el script son las
aperturas de recetas compartidas. El plan free da 100.000 requests por día y no
pide tarjeta.

## Costura con las fotos (fase 4)

`RecetaPublica` gana un campo `foto` y el Worker lo prefiere para el
`og:image`; hasta entonces, imagen fija de la app. Una línea, y no bloquea nada.
El hosting elegido está en [`docs/hosting-imagenes.md`](../../hosting-imagenes.md):
Cloudflare R2, con el prefijo `pub/` sirviendo justamente este caso.

## Verificación

En Vitest, que es lo que ya corre en `comidas`:

- Generación del slug: tildes, emoji, corte a cinco palabras.
- Armado de la ruta canónica, con y sin alias.
- Generación del id: largo, alfabeto, y que el choque regenere.
- Lectura del id desde la ruta: último segmento, con y sin nick.
- Mapeo del documento público a `Meal`.
- La lista blanca: que `tags` e `includeInShoppingList` no se publiquen.

El Worker queda **sin test automático**: no hay runner y agregarlo significa
dependencia nueva. Se verifica a mano con `wrangler dev` y un `curl` con
user-agent de crawler. Va marcado con un comentario `ponytail:` que nombra el
techo, y entra en la tabla de deuda declarada del TODO.

## Fuera de alcance

- Fotos en la receta pública (fase 4, ver arriba).
- Slug editable por el usuario.
- Listado público de recetas de un autor, o cualquier forma de descubrimiento.
  Lo único que existe es el link directo.
- Comentarios, likes, copiar la receta a la cuenta propia.
