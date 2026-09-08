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
        pegarla en un post.
  - [ ] **4. Fotos.** Storage, compresión con `canvas`, borrado en cascada.
        Ya no va por Firebase Storage: desde febrero de 2026 exige Blaze, y el
        costo de las imágenes está en servirlas, no en guardarlas. El camino
        elegido es **Cloudflare R2** —egress $0, free tier mensual— con lo que
        Firestore y Auth se quedan en Spark. La investigación, los precios y el
        checklist de alta están en
        [`docs/hosting-imagenes.md`](docs/hosting-imagenes.md).

- [ ] **Configurador del landing.** Hoy el orden de las secciones está escrito
      a mano en `projects/perfil-personal/src/app/componentes/landing/landing.html`.
      Lo mínimo es subir los libros; lo bueno sería reordenar los bloques sin
      tocar el template. Ojo dónde vive esa configuración: perfil-personal se
      prerenderiza, así que si el orden sale de una base en runtime el
      prerender no lo ve y se rompen los `og:`. Tiene que resolverse en build
      (una lista en `src/variables.ts`, o un JSON commiteado).

## Deuda técnica declarada

Cada una está marcada en el código con un comentario `ponytail:` que nombra el
techo y el camino de salida.

| Dónde | Techo conocido |
|-------|----------------|
| `projects/comidas/src/app/services/update.service.ts:19` | `mismoCodigo` compara sólo los subrecursos cargados: un cambio que toque únicamente el `index.html` (un meta, el title) pasa como "sin cambios". Salida: hashear también `/index.html`. |
| `projects/perfil-personal/src/app/componentes/galeria-libros/galeria-libros.scss:30` | El landing y `/libros` comparten el carrusel. Con más libros, la página propia va a querer grilla vertical. Salida: separar las dos presentaciones. |
| `projects/perfil-personal/src/app/app.ts:98` | El scroll restaurado usa el alto que la ruta tenía al salir. Volver a un post largo antes de que baje el markdown deja el scroll corto. |
| `projects/perfil-personal/src/app/componentes/catalogo/widgets.ts:26` | La tabla de inputs de cada widget está escrita a mano, así que un `input()` nuevo en la librería no aparece en el catálogo hasta que alguien lo agregue. Salida: generarla parseando los `input<>()` en un script de build. |
| `projects/comidas/src/app/components/meal-card/meal-card.component.scss:66` | La lista de ingredientes de la tarjeta corta a las 16rem y de ahí scrollea, para que una receta de veinte ingredientes no haga una tarjeta interminable. Salida: mostrar los primeros N con un "ver todos". |
| `projects/comidas/worker/index.js:52` | El Worker que inyecta los `og:` de las recetas compartidas no tiene test automático: no hay runner de Workers sin agregar dependencia. Se verifica a mano con `wrangler dev` y un curl con user-agent de crawler. Salida: `vitest-pool-workers`. |
| `projects/componentes/src/lib/boton/boton.ts:15` | `icono` es `string` y acepta tanto una URL de imagen como un nombre de `lib-icon`; nada distingue una de otra, y ya pasó (el dialog de compartir). Salida: que reciba un `IconName` y renderice con `lib-icon`, o renombrarlo `iconoUrl` — rompe la API pública de la librería cualquiera de las dos. |
| `projects/comidas/src/app/services/meal.service.ts:187` | Cuatro caminos reemplazan `meals` entero (`syncFromFirestore`, `importMeals`, `applyImportedMeals`, `importData`) y pueden borrar un `publicId` sin despublicarlo, el mismo huérfano que `deleteMeal` ya evita. Salida: comparar `publicId`s antes/después contra el `espejo` y despublicar los que desaparecieron. |
