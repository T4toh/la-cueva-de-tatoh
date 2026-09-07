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
      Tres estados —sistema / claro / oscuro— en `TemaService`, con
      `lib-tema-toggle` en el navigator de perfil-personal y en `/settings` de
      comidas. Un script inline en los dos `index.html` aplica la elección antes
      del primer paint. De paso se pasaron a tokens los ~90 colores que estaban
      escritos a mano en los componentes: los `rgba(255,255,255,…)` se invertían
      mal sobre papel. Lo de `@media print` sigue en blanco y negro.

## En curso / pendiente

- [ ] **Catálogo de componentes**, al estilo del de Angular Material: una
      entrada por widget con la demo viva y el snippet de uso. Va dentro de
      `perfil-personal`, en su ruta propia (`/componentes`), no como post: el
      markdown de `ngx-markdown` no instancia componentes de Angular, así que
      un post sólo podría mostrar capturas.
  - Los 11 widgets que ya publica `public-api.ts`.
  - Datos de relleno, sin inventar casos de uso: alcanza con que se vea que
    existen y cómo se ven.

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
  - [ ] **4. Fotos.** Storage, compresión con `canvas`, reglas del bucket,
        borrado en cascada. Bloqueada por el alta de Blaze (necesita tarjeta), y
        es la única que puede generar factura.

- [ ] **Receta pública por link.** Compartir una receta sin que el otro tenga
      cuenta. Falta definir la forma de la URL (¿`/receta/<uid>/<idReceta>`?
      ¿un token propio, para no exponer el uid?) y la regla de Firestore que lo
      habilite: hoy `firestore.rules` sólo deja leer al dueño de `users/{uid}`,
      así que cualquier lectura anónima necesita una regla nueva y explícita.
      Se apoya en la ficha `/meals/:id` que ya existe.

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
| `projects/comidas/src/app/components/meal-card/meal-card.component.scss:66` | La lista de ingredientes de la tarjeta corta a las 16rem y de ahí scrollea, para que una receta de veinte ingredientes no haga una tarjeta interminable. Salida: mostrar los primeros N con un "ver todos". |
