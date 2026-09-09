# TODO

Lista de trabajo del monorepo. Lo de infra de la Raspberry vive aparte, en
[RASPBERRY.md](RASPBERRY.md) → *Pendientes / opciones*.

## Hecho

- [x] Perfil personal
- [x] Blog
- [x] Generador de QR
- [x] Listado de libros
- [x] **Descripciones y `og:` en todas las rutas.** Un servicio `Seo`
      (`projects/perfil-personal/src/app/seo.ts`) escribe los meta tags y cada
      ruta lo llama con los suyos. `/utilidades` dejó de ser `RenderMode.Client`
      —`generador-qr` guarda su `QRCodeStyling` detrás de `isPlatformBrowser`—
      así que ya se prerenderiza y tiene preview propio. `index.html` trae un
      juego por defecto como piso, y `pnpm check:libros` falla si alguna ruta
      prerenderizada no publicó su `og:url`.
      Los 14 posts tienen su `descripcion` escrita en `variables.ts`, sacada
      del comienzo de cada `.md`. Un post nuevo sin ella cae en
      `DESCRIPCION_SITIO`; el recordatorio está en el README, en *Escribir un
      post*.

- [x] **Modo claro**, en las dos apps. Los tokens dejaron de estar duplicados:
      viven en `projects/componentes/src/styles/_tema.scss` y los dos
      `styles.scss` hacen `@use 'tema'` vía el `includePaths` de `angular.json`.
      Tres estados —sistema / claro / oscuro— en `TemaService`; el botón lo
      dibuja cada app con el idioma de su nav (última tab en comidas, fila de
      logos en perfil-personal). Un script inline en los dos `index.html`
      aplica la elección antes
      del primer paint. De paso se pasaron a tokens los ~90 colores que estaban
      escritos a mano en los componentes: los `rgba(255,255,255,…)` se invertían
      mal sobre papel. Lo de `@media print` sigue en blanco y negro.

- [x] **Catálogo de componentes**, en `/componentes` con una ficha
      prerenderizada por widget (`/componentes/<slug>`). Cada ficha trae la
      demo viva, la tabla de inputs/outputs y el snippet con botón de copiar.
      Los datos están a mano en `catalogo/widgets.ts` —el `ponytail:` de ahí
      nombra la salida— y las 11 demos son un `@switch` en el template de
      `catalogo-view`, sin un componente por widget.
      Tres cosas que salieron de hacerlo: `ICON_NAMES` ahora es un const del
      que se deriva `IconName`, así la grilla de iconos recorre la lista sin
      copiarla; `Red` se exporta; y `lib-panel` dejó de pintarse de blanco en
      modo oscuro —devolvía un `'#fff'` inline que le ganaba al token, y por eso
      comidas tenía que pasarle `[colorFondo]="'var(--bg-surface)'"` a mano—.
      `lib-generador-qr` es el único que no se instancia en su ficha: linkea a
      `/utilidades`, porque `qr-code-styling` es CommonJS y con dos rutas lazy
      usándolo el bundler lo subía al bundle inicial.

- [x] **Receta pública por link.** El spec está en
      [`docs/superpowers/specs/2026-09-07-receta-publica-design.md`](docs/superpowers/specs/2026-09-07-receta-publica-design.md).
      Publicar copia la receta a una colección nueva `recetasPublicas/{id}` de
      lectura pública —el documento `users/{uid}` guarda todo junto, así que no
      hay regla que abra una receta sin abrir el resto—, y el link es
      `/r/<nick>/<receta>/<id>`, con el id de ocho caracteres haciendo de llave y
      los otros dos segmentos decorativos: renombrar no rompe links repartidos.
      Los `og:` los inyecta un Worker con `HTMLRewriter` que corre sólo en
      `/r/*`: comidas ya se despliega como Worker, lo que no tenía era script.
      La ficha reusa `receta-detalle` sin tocarla.

- [x] **Compartir, redondeado.** El diálogo del link pasó a ser el dueño de
      todo el flujo —copiar, abrir, compartir con la hoja del sistema
      (`navigator.share`, donde exista) y **dejar de compartir**—, así que el
      botón del listado dejó de ser un camino sin salida: antes sólo se podía
      descompartir desde `/meals/:id`. Se arregló ahí y no en cada pantalla
      porque ese diálogo es el que abren todos los llamadores.
      El alias se edita en ese mismo diálogo, que es donde se ve lo que hace:
      firma la receta y es el primer segmento del link. `lib-dialogo` ya
      proyectaba con `<ng-content>`, así que el input lo dibuja el template del
      `App` con un `campo?` opcional del `DialogService` y la librería no
      cambió. El link viejo no muere al renombrarse: el id de ocho es la llave.
      El editor tiene el mismo estado como tilde, y ahí sí se aplica al
      guardar: es dato del formulario, como el de la lista de compras, así que
      Cancelar no publica nada. El default es privado. No aparece en
      `/meals/new` —la comida no tiene id todavía— y la decisión sale de
      `accionDeCompartir`, que devuelve `null` cuando el tilde no cambió:
      guardar sin tocarlo no toca `recetasPublicas`, y republicar una ya
      compartida acuñaría un id nuevo dejando huérfano el link repartido.
      El listado tiene ahora los mismos chips de filtro que el selector del día
      —`tagsUnicos` y `filtrarComidas` salieron a `meal.service.ts` y los usan
      los dos— más uno de **Compartidas**, que es lo que reemplaza a un
      apartado propio de recetas públicas: misma información, cero rutas
      nuevas. Los dos filtros se componen. El `.filters` se fue al
      `styles.scss` de comidas: los estilos de componente están encapsulados y
      en dos `.scss` propios había que duplicar el bloque.

- [x] **Recetas con imágenes, por link.** El spec está en
      [`docs/superpowers/specs/2026-09-09-recetas-con-imagenes-design.md`](docs/superpowers/specs/2026-09-09-recetas-con-imagenes-design.md).
      `Meal.foto` y `Paso.foto` son URLs `https://` pegadas a mano —el editor
      valida el esquema porque una imagen `http://` sobre una página `https://`
      es contenido mixto y el navegador la bloquea sola—, así que esto no
      resuelve la fase 4 del recetario (subida real a Cloudflare R2, todavía
      trabada en el alta de la cuenta): el día que exista, sólo cambia de dónde
      sale la URL.
      El hero de la ficha es una banda que la foto rellena —sin foto no es el
      caso degradado, es el caso normal, porque hoy ninguna receta tiene foto y
      muchas nunca la van a tener—. La tarjeta del listado a propósito **no**
      repite esa banda: le agrega una portada sólo cuando hay foto, porque
      treinta y cuatro bandas vacías en una grilla empujarían los ingredientes
      fuera de la pantalla. El modo cocina muestra la foto del paso arriba del
      texto, para que los botones de abajo no se muevan al cambiar de paso.
      Toda imagen que falla cae al estado sin-foto en vez de al ícono roto del
      navegador, y ese estado se guarda por *qué* foto falló —el id de la
      receta, o el id más el índice del paso— y no con un booleano: un
      booleano se queda pegado al navegar a otra receta o pasar al siguiente
      paso, que capaz sí tienen foto buena.
      De regalo, el `og:image` del Worker deja de ser siempre el ícono
      genérico y usa la foto de la receta cuando hay una. Fuera de alcance: el
      tap para ampliar la foto en modo cocina (tabla de deuda técnica, abajo).

## En curso / pendiente

- [ ] **Recetario.** Diseñado y sin implementar. El spec está en
      [`docs/superpowers/specs/2026-09-03-recetario-design.md`](docs/superpowers/specs/2026-09-03-recetario-design.md).
      La receta es un `Meal` con `pasos?` y `foto?`, no una entidad nueva: `Meal`
      ya tiene los ingredientes que alimentan la lista de compras.
  - [x] **1. Cantidades.** Un solo `parseQuantity` exportado desde
        `meal.service.ts` para las tres funciones que antes tenían su propia
        regex. Entiende fracciones, números mixtos y decimales, conserva la
        unidad escrita a mano y deja de aplastar `'1/2'` a `'1'` al cargar
        desde Firestore.
  - [x] **2. La receta escrita.** `Paso`, `Meal.pasos`, pasos en `meal-editor`
        con reordenar, ficha `/meals/:id` de sólo lectura, y el botón de ver
        receta en la tarjeta haciendo de indicador.
  - [x] **3. Cocinar.** Selector ×1 ×2 ×3 sobre la ficha, modo cocina de un
        paso por pantalla, y botón de copiar la receta como markdown para
        pegarla en un post. El modo cocina pide `navigator.wakeLock` al entrar,
        lo suelta al salir y en `ngOnDestroy`, y lo **re-pide** en
        `visibilitychange`: el navegador lo suelta por su cuenta cuando la
        pestaña se esconde, así que sin eso mirar el teléfono un segundo
        devolvía la pantalla apagándose. No está en Firefox de escritorio ni en
        el WebView de Android; falla callado, es comodidad y no función.
  - [ ] **4. Fotos.** Storage, compresión con `canvas`, borrado en cascada.
        Ya no va por Firebase Storage: desde febrero de 2026 exige Blaze, y el
        costo de las imágenes está en servirlas, no en guardarlas. El camino
        elegido es **Cloudflare R2** —egress $0, free tier mensual— con lo que
        Firestore y Auth se quedan en Spark. La investigación, los precios y el
        checklist de alta están en
        [`docs/hosting-imagenes.md`](docs/hosting-imagenes.md). Trabado en dar
        de alta la cuenta de R2, que pide tarjeta.

- [ ] **Configurador del landing.** Hoy el orden de las secciones está escrito
      a mano en `projects/perfil-personal/src/app/componentes/landing/landing.html`.
      Lo mínimo es subir los libros; lo bueno sería reordenar los bloques sin
      tocar el template. Ojo dónde vive esa configuración: perfil-personal se
      prerenderiza, así que si el orden sale de una base en runtime el
      prerender no lo ve y se rompen los `og:`. Tiene que resolverse en build
      (una lista en `src/variables.ts`, o un JSON commiteado).

- [ ] **Rating de la comida.** Un campo en el `Meal` —es el dueño natural, ya
      lleva los tags y la lista de compras— y estrellas en la tarjeta. Falta
      decidir: ¿1 a 5 o pulgar?, ¿ordena el listado o es un chip más al lado de
      "Compartidas"?, ¿viaja a la receta pública o es privado? Ojo con esto
      último: `aRecetaPublica` es una lista blanca a propósito, así que un campo
      nuevo **no** se publica solo.

- [ ] **Métrico ↔ imperial.** Mostrar las cantidades en tazas y cucharadas y
      volver. Es el único de la lista con madriguera de verdad: taza es volumen
      y gramo es masa, así que convertir necesita la densidad de cada
      ingrediente (una taza de harina son ~120 g, una de azúcar ~200 g). Sin
      una tabla por ingrediente, lo honesto es convertir sólo lo que ya es
      volumen (ml ↔ tazas) y dejar la masa en gramos. Lleva spec propio; el
      punto de entrada es `parseQuantity` en `meal.service.ts`, que ya conserva
      la unidad escrita a mano.

- [ ] **Comentarios en la receta pública.** Hoy `/r/...` es de sólo lectura
      para un desconocido sin cuenta. Comentarios significa escritura anónima
      en una colección pública: la regla de Firestore y la moderación son la
      parte difícil, no la UI.

## Deuda técnica declarada

Cada una está marcada en el código con un comentario `ponytail:` que nombra el
techo y el camino de salida.

| Dónde | Techo conocido |
|-------|----------------|
| `projects/comidas/src/app/services/update.service.ts:19` | `mismoCodigo` compara sólo los subrecursos cargados: un cambio que toque únicamente el `index.html` (un meta, el title) pasa como "sin cambios". Aceptado: comidas usa `skipWaiting`, así que el worker nuevo toma control en la próxima carga igual, y hashear el `index.html` reintroduce el cartel falso que la función existe para suprimir. |
| `projects/comidas/src/app/services/meal.service.ts:24` | La gramática de cantidades no entiende la coma decimal: `'1,5'` se lee como `1`. Salida: normalizar la coma a punto antes de parsear. |
| `projects/perfil-personal/src/app/componentes/galeria-libros/galeria-libros.scss:30` | El landing y `/libros` comparten el carrusel. Con más libros, la página propia va a querer grilla vertical. Salida: separar las dos presentaciones. |
| `projects/perfil-personal/src/app/app.ts:98` | El scroll restaurado usa el alto que la ruta tenía al salir. Volver a un post largo antes de que baje el markdown deja el scroll corto. |
| `projects/perfil-personal/src/app/componentes/catalogo/widgets.ts:26` | La tabla de inputs de cada widget está escrita a mano, así que un `input()` nuevo en la librería no aparece en el catálogo hasta que alguien lo agregue. Salida: generarla parseando los `input<>()` en un script de build. |
| `projects/comidas/src/app/components/meal-card/meal-card.component.scss:87` | La lista de ingredientes de la tarjeta corta a las 16rem y de ahí scrollea, para que una receta de veinte ingredientes no haga una tarjeta interminable. Salida: mostrar los primeros N con un "ver todos". |
| `projects/comidas/worker/index.js:75` | Del Worker que inyecta los `og:` está testeada la lógica pura (`ID_VALIDO`, `normalizar`, `describir`, `imagenDe`, en `src/app/worker-og.spec.ts`), pero no el `fetch`: `HTMLRewriter` y el binding `ASSETS` no existen fuera del runtime de Workers. El rewrite se verifica a mano con `wrangler dev` y un curl con user-agent de crawler. Salida: `vitest-pool-workers`. |
| `projects/comidas/src/app/services/meal.service.ts:465` | La barrida de huérfanos reintenta en el próximo cambio de `meals`. Si el usuario importa un backup sin conexión y no vuelve a tocar una comida, el link queda vivo. Salida: reintentar también al recuperar la sesión. |
| `projects/comidas/src/app/components/receta-detalle/receta-detalle.component.scss:245` | `.cocina-foto` no se puede ampliar: a `max-height: 40vh` un detalle fino —el punto de la masa, un corte— no se distingue, y no hay forma de acercarse. Salida: tocarla abre una vista a pantalla completa. |
