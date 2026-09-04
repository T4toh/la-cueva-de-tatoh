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
  - [ ] **1. Cantidades.** Exponer `multiplyQuantity`, arreglar `'1/2'` y los
        factores fraccionarios. Independiente del resto: arregla un bug que la
        lista de compras ya tiene.
  - [ ] **2. La receta escrita.** `Paso`, `Meal.pasos`, pasos en `meal-editor`,
        ficha `/meals/:id`, indicador en la tarjeta. Sin Storage.
  - [ ] **3. Cocinar.** Selector ×1 ×2 ×3, modo cocina, copiar como markdown.
        Necesita la 1 y la 2.
  - [ ] **4. Fotos.** Storage, compresión con `canvas`, reglas del bucket,
        borrado en cascada. Bloqueada por el alta de Blaze (necesita tarjeta), y
        es la única que puede generar factura.

## Deuda técnica declarada

Cada una está marcada en el código con un comentario `ponytail:` que nombra el
techo y el camino de salida.

| Dónde | Techo conocido |
|-------|----------------|
| `projects/comidas/src/app/services/update.service.ts:19` | `mismoCodigo` compara sólo los subrecursos cargados: un cambio que toque únicamente el `index.html` (un meta, el title) pasa como "sin cambios". Salida: hashear también `/index.html`. |
| `projects/perfil-personal/src/app/componentes/galeria-libros/galeria-libros.scss:30` | El landing y `/libros` comparten el carrusel. Con más libros, la página propia va a querer grilla vertical. Salida: separar las dos presentaciones. |
| `projects/perfil-personal/src/app/app.ts:96` | El scroll restaurado usa el alto que la ruta tenía al salir. Volver a un post largo antes de que baje el markdown deja el scroll corto. |
