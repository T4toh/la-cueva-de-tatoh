# TODO

Lista de trabajo del monorepo. Lo de infra de la Raspberry vive aparte, en
[RASPBERRY.md](RASPBERRY.md) → *Pendientes / opciones*.

## Hecho

- [x] Perfil personal
- [x] Blog
- [x] Generador de QR
- [x] Listado de libros

## En curso / pendiente

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

- [ ] **Catálogo de componentes**, al estilo del de Angular Material: una
      entrada por widget con la demo viva y el snippet de uso. Va dentro de
      `perfil-personal`, en su ruta propia (`/componentes`), no como post: el
      markdown de `ngx-markdown` no instancia componentes de Angular, así que
      un post sólo podría mostrar capturas.
  - Los 11 widgets que ya publica `public-api.ts`.
  - Datos de relleno, sin inventar casos de uso: alcanza con que se vea que
    existen y cómo se ven.

- [ ] **Recetario.** Sin empezar, en etapa de planificación.
  - Superset de las tarjetas de comidas de `comidas`, con todos los campos para
    anotar una receta como corresponde: ingredientes con cantidades, tiempos,
    porciones, notas.
  - Form de carga con fotos. Las fotos no entran en Firestore: implica
    Firebase Storage, bucket nuevo y **regla nueva** (hoy `firestore.rules`
    niega todo lo que no sea `users/{uid}`).
  - Paso a paso opcional: instrucciones ordenadas, capaz con foto por paso.
    Multiplica el storage por receta.
  - Adaptativo: la misma receta se tiene que ver bien en la tarjeta corta y en
    la ficha completa.
  - Linkeable desde el blog, para que una receta pueda ser también un post. Sin
    definir todavía cómo: son dos apps y dos Workers distintos, así que el link
    cruza dominios (`tatoh.ar` ↔ `comidas.tatoh.ar`).

## Deuda técnica declarada

Cada una está marcada en el código con un comentario `ponytail:` que nombra el
techo y el camino de salida.

| Dónde | Techo conocido |
|-------|----------------|
| `projects/comidas/src/app/services/update.service.ts:19` | `mismoCodigo` compara sólo los subrecursos cargados: un cambio que toque únicamente el `index.html` (un meta, el title) pasa como "sin cambios". Salida: hashear también `/index.html`. |
| `projects/perfil-personal/src/app/componentes/galeria-libros/galeria-libros.scss:30` | El landing y `/libros` comparten el carrusel. Con más libros, la página propia va a querer grilla vertical. Salida: separar las dos presentaciones. |
| `projects/perfil-personal/src/app/app.ts:96` | El scroll restaurado usa el alto que la ruta tenía al salir. Volver a un post largo antes de que baje el markdown deja el scroll corto. |
