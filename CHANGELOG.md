# Changelog

Todos los cambios notables a este proyecto se documentan en este archivo. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado sigue [SemVer](https://semver.org/lang/es/).

## [Unreleased]

### Fixed

#### Comidas
- **Las cantidades fraccionarias se multiplicaban mal en la lista de compras.** `multiplyQuantity` leía la cantidad con `parseFloat`, y `parseFloat('1/2')` devuelve `1`: media taza por dos daba `2` en vez de `1`. Ahora la fracción se divide a mano, y se entienden también los números mixtos de receta (`1 1/2`).
- La misma función se comía el texto de la unidad: `'2 tazas'` por tres devolvía `'6'`. Ahora conserva lo que viene después del número.
- Un factor menor o igual a 1 devolvía la cantidad sin tocar, así que no había forma de expresar media receta. Se sacó ese atajo.
- **Al cargar desde Firestore, las fracciones se destruían y se volvían a guardar aplastadas.** `normalizeMealQuantities` corre en cada carga y usaba su propia regex `^(\d+(\.\d+)?)`, que de `'1/2'` se queda con `'1'`; `parseNumericQuantity` era peor y partía `'1/2 taza'` en cantidad `1` y unidad `'/2 taza'`. Era la causa de fondo: sin esto, arreglar la multiplicación no servía de nada porque la fracción nunca llegaba a guardarse. Las tres regex se unifican en un solo `parseQuantity`.
- `'1/0'` devolvía `'Infinity'`. Ahora se trata como cantidad inválida y se deja sin tocar.
- `multiplyQuantity` pasa de método privado a función exportada de `meal.service.ts`, para que la ficha de receta pueda reusarla sin duplicar el parseo. Es la primera de las cuatro entregas del recetario.

### Added

#### Perfil Personal
- **Meta tags en todas las rutas.** Hasta ahora sólo las fichas de libro publicaban `og:`, así que pegar el link de `/utilidades`, del blog o del home en un chat no mostraba nada. Un servicio `Seo` (`src/app/seo.ts`) concentra la escritura de los tags y cada componente ruteado lo llama con su título, descripción y ruta; `index.html` trae un juego por defecto como piso para lo que no pase por ahí. `libro-view` deja de tener su propia copia del código.
- Cada post de `POSTS` trae su `descripcion`, sacada del comienzo del `.md`. El campo es opcional y el cuerpo del markdown no sirve para esto: lo baja el browser por HTTP y el prerender no lo tiene.
- `.nvmrc` (24.20.0), `engines` en `package.json` con el rango que declara el Angular CLI, y `engine-strict=true` en `.npmrc`. Con un Node fuera de rango el install ahora corta con un mensaje claro, en vez de dejar que reviente `ng build` mucho después.
- `TODO.md`, con el trabajo pendiente y las deudas técnicas marcadas con `ponytail:` en el código. Sale del README, que pasa a describir el repo.

### Changed

#### Perfil Personal
- **`/utilidades` se prerenderiza.** Era `RenderMode.Client` porque `generador-qr` construye un `QRCodeStyling` dentro de un `effect` y eso toca `window`, que en Node no existe. Con el guard de `isPlatformBrowser` sobrevive al prerender, así que la ruta pasa a tener HTML propio: sin eso el crawler recibía el home y el preview era el del sitio, no el suyo.
- `check:libros` verifica además que cada página prerenderizada publique su propio `og:url`. Chequear que los tags existan no alcanzaba: los heredarían de `index.html`, así que una ruta que se olvida de publicar sus meta pasaría igual.

## [1.4.1] - 2026-09-01

### Changed

#### Perfil Personal
- **Tapa nueva de *La Caballera Esmeralda*, y ahora servida desde el repo.** Antes `imagen` apuntaba a la URL de la portada en Amazon: esa imagen la controla Amazon, así que si cambia el listado el `og:image` se rompe sin que nos enteremos. La portada pasa a `public/img/portadas/`, convertida a JPEG de 752×1200 y 357 kB — el PNG original de 5,4 MB no sirve como `og:image` porque WhatsApp descarta las imágenes pesadas al armar el preview y no muestra nada.
- El post del blog *Primer libro en Amazon* usa la misma portada nueva. Servía un PNG de 5,0 MB propio (`posts/img/la-caballera-esmeralda.png`), que se elimina: ahora las dos superficies apuntan al mismo JPEG de 357 kB. De paso deja de usar una ruta relativa (`../posts/img/...`) que sólo funcionaba por cómo resuelve el browser desde `/blog/:id`.
- `og:image` y `twitter:image` se arman ahora con `SITIO_URL` adelante. Los crawlers no resuelven rutas relativas al dominio, así que una ruta desde la raíz sola habría dejado el preview sin portada.
- `pnpm check:libros` valida además que `og:image` sea absoluta y que, si la portada la servimos nosotros, el archivo exista en el build. Es un error que de otro modo solo se descubre cuando alguien comparte el link.
- La sinopsis de *La Caballera Esmeralda* pasa a ser el blurb real del libro, en reemplazo del texto provisorio que se había reciclado del post viejo. El primer párrafo es además el que alimenta `og:description`, o sea el texto que se ve al compartir el link en WhatsApp o Twitter.

## [1.4.0] - 2026-09-01

Cada libro pasa a tener su propia página y su propio link, pensado para imprimirlo dentro del EPUB. Para que ese link muestre portada y descripción al compartirlo, `perfil-personal` ahora se prerenderiza en el build.

### Added

#### Perfil Personal
- **Vista individual de libro en `/libros/<slug>`.** La tarjeta de `/libros` deja de abrir Amazon en una pestaña nueva y pasa a navegar a la ficha del libro, que muestra portada, título, saga, sinopsis y un botón por tienda. El link es estable y está pensado para ir impreso dentro del EPUB, así que el `slug` de un libro publicado no se cambia nunca: rompería las copias ya vendidas.
- El tipo `Libro` en `variables.ts` incorpora `slug`, `sinopsis` (markdown) y `tiendas: { nombre, url }[]`, y pierde `enlace`. Hoy la única tienda es Amazon; agregar otra es un elemento más en el array. Agregar un libro entero sigue siendo un objeto más: de ahí salen solos la tarjeta, la ruta y el HTML prerenderizado.
- Meta tags Open Graph y Twitter Card por libro (`og:title`, `og:description`, `og:image` con la portada, `og:url`, `og:type=book`, `twitter:card=summary_large_image`), más el `<title>` del documento.
- `pnpm check:libros` (`scripts/check-libros.mjs`): tras un build de producción verifica que cada `/libros/<slug>` haya quedado con sus `og:` completos. Sin esto no hay forma de enterarse de que un link salió sin portada hasta que alguien lo comparte.

### Changed

#### Perfil Personal
- **Prerender (SSG) del sitio.** `outputMode: "static"` en `angular.json` más `src/main.server.ts`, `app.config.server.ts` y `app.routes.server.ts`. El build genera un HTML por ruta: 17 hoy. Hacía falta porque los crawlers de WhatsApp y Twitter no ejecutan JavaScript — sin un HTML servido con los `og:` adentro, un link pegado en un chat sale pelado. Cloudflare sirve el asset estático si existe y sólo cae al fallback SPA cuando no lo encuentra, así que los archivos prerenderizados ganan y no hubo que tocar `wrangler.jsonc` ni el pipeline de deploy.
- `blog/:id` también se prerenderiza. El cuerpo del post queda vacío en el HTML porque `ngx-markdown` baja el `.md` por HTTP recién en el browser, pero el título y el layout salen servidos. Sin esto, abrir un post directo servía el fallback SPA — el home prerenderizado — y se veía la lista del blog un instante antes de que Angular la reemplazara.
- `utilidades` queda como `RenderMode.Client`: `generador-qr` instancia `QRCodeStyling` dentro de un `effect` y eso toca `window`, que en Node no existe. Guardarlo con `isPlatformBrowser` la dejaría prerenderizar también.
- La tarjeta de `/libros` es ahora un `<a routerLink>` de verdad en vez de un `window.open()`, así que el link se puede copiar, abrir en pestaña nueva y recorrer con el teclado. El componente `lib-libro` de la librería no cambió.
- La sección de deploy de `CLAUDE.md` describía un `netlify.toml` que ya no existe en el repo y un copy step de comidas que no ocurre. Reescrita con lo real: un Worker de Cloudflare por app, un `wrangler.jsonc` cada uno.

### Fixed

#### Perfil Personal
- **El sitio quedaba clavado en un build viejo.** `perfil-personal` registraba un service worker con `provideServiceWorker(...)` pero no tenía nada que chequeara ni activara versiones nuevas — comidas sí lo tiene, en su `UpdateService`. El service worker de Angular baja el build nuevo en segundo plano y sigue sirviendo el viejo hasta que se cierran *todas* las pestañas del sitio, así que se podía quedar meses en una versión vieja: el footer mostraba `v1.2.0` con el repo en `1.3.0`, y el modal del Changelog abría vacío porque el JS cacheado era anterior. En una ventana de incógnito, sin service worker, el mismo deploy andaba perfecto.
- Comidas **no** tenía este problema y no se tocó: su `ngsw-custom.js` ya hace `skipWaiting()` + `clients.claim()`, así que el worker nuevo toma control en la carga siguiente. Las dos apps quedan resueltas de forma distinta a propósito y no hay que unificarlas: `skipWaiting()` es seguro en comidas porque no tiene rutas lazy, pero en perfil-personal dejaría a la página ya cargada pidiendo chunks con hashes que el deploy nuevo borró. Queda documentado en `CLAUDE.md`.
- Ahora `App` escucha `SwUpdate.versionUpdates` y, cuando hay una versión lista, la activa y recarga **en el próximo cambio de ruta** en vez de al instante: recargar en el momento le cortaría la lectura a alguien a la mitad de un post, mientras que esperar a la próxima navegación hace el salto invisible. No se reutilizó el `UpdateService` de comidas porque está acoplado a su `DialogService` y su diálogo de confirmación tiene sentido en una app con estado sin guardar, no en un blog.

### Dependencies

- `@angular/ssr` 22.1.5 y `@angular/platform-server` 22.1.3, ambas pinneadas exactas. Se descartaron las `latest` (22.1.6 y 22.1.4) por tener menos de 7 días publicadas; además 22.1.3 es la que matchea el peer exacto `@angular/core@22.1.3`. Sólo se usan en build: no van al bundle del browser.

## [1.3.0] - 2026-09-01

Puesta al día del stack: salto a Angular 22 con TypeScript 6, adopción de OnPush como estrategia de detección de cambios, y limpieza del andamiaje de tests que nunca corrió.

### Changed

#### Compartido (lib `componentes`)
- `VERSION` actualizada a `1.3.0`.
- Angular 21.2.12 → 22.1.3 en todo el monorepo (core, common, compiler, forms, platform-browser, router, service-worker, compiler-cli); CLI y build 21.2.10 → 22.1.5.
- TypeScript 5.9.3 → 6.0.3, requerido por `@angular/compiler-cli` 22. Se elimina `compilerOptions.baseUrl` del tsconfig raíz (deprecado y error en TS 6) y las importaciones de perfil-personal que dependían de él pasan a ser relativas.
- ng-packagr 22.1.1, angular-eslint 22.1.0, ngx-markdown 22.0.0, firebase 12.18.0, `@capacitor/*` 8.5.0, eslint 10.9.1, typescript-eslint 8.68.0, prettier 3.9.6, vitest 4.1.11. `marked` pasa a dependencia explícita en 18.0.11 (ngx-markdown 22 pide `^17 || ^18`).
- `peerDependencies` de la librería actualizadas a `@angular/{common,core} ^22.0.0`.
- **OnPush como estrategia de detección de cambios.** Angular 22 la volvió el default; la migración automática había dejado `ChangeDetectionStrategy.Eager` en los 31 componentes para conservar el comportamiento de v21 y ahora se sacan todos. Un componente OnPush sólo se revisa cuando algo lo marca: un evento de su propio template, un signal que lee, un input nuevo, un `@HostListener` propio, el `async` pipe o un `markForCheck()` explícito. Lo que no lo marca es una mutación hecha después de un `await` o dentro de un callback, que es el único patrón que hubo que corregir.
- `provideHttpClient(withXhr())` en ambas apps: Angular 22 usa `fetch` por defecto y se conserva XHR.

#### Comidas
- Se elimina el andamiaje de karma/jasmine: `perfil-personal` y `componentes` tenían target de test sin un solo archivo `.spec.ts` ni `tsconfig.spec.json`, o sea que nunca fue ejecutable. Se quitan las 7 dependencias asociadas y `pnpm test` pasa a apuntar a `ng test comidas`, el único proyecto con specs (Vitest).
- Budget de bundle inicial de comidas: `maximumError` 1MB → 1.2MB. El bundle pasó de 982 kB a 1.01 MB con Angular 22 + firebase 12.18.

### Fixed

#### Comidas
- El badge de estado de sincronización en Configuración ("Sincronizado", "Sincronizando...", "Error de sincronización" y los demás estados) tenía el ícono desalineado y pegado al texto: el `<span>` era `display: inline-block`, así que el SVG se apoyaba en la línea base en vez de centrarse, y no había separación. La regla global `button/a/label:has(lib-icon)` de `styles.scss` no lo alcanzaba por ser un `<span>`. Ahora es `inline-flex` centrado con `gap`, y un poco más de padding.
- Mismo defecto en el chip de cantidad en despensa de la lista de compras (`.pantry-qty-chip`), corregido igual.
- El modal de importación no se podía cerrar con el teclado: el backdrop sólo tenía `(click)`. Adopta el mismo patrón que `lib-dialogo` (`role`/`tabindex` + `keydown.enter`/`keydown.space`).
- Los dos generadores de QR escribían el estado de carga y el mensaje de error después de un `await fetch(...)` o dentro de los callbacks de `FileReader`, o sea fuera del ciclo de detección que disparó el evento. Bajo OnPush eso dejaba de repintarse: se agrega `markForCheck()` en esas rutas.

#### Compartido
- `pnpm lint` queda en 0 errores. Venía fallando con 6 errores de accesibilidad (`click-events-have-key-events`, `interactive-supports-focus`) y desorden de atributos en templates.

## [1.2.0] - 2026-06-01

Mejoras y correcciones en Comidas tras el deploy a Cloudflare Pages: importador de comidas reforzado, Service Worker que ya no rompe Firestore, y pulido de layout (tarjetas uniformes + footer fijo).

### Added

#### Comidas (`comidas.tatoh.ar`)
- Importador con pegado de JSON: nuevo modal "Pegar JSON" en Configuración (paneles Comidas y Gestión de Datos) que parsea el JSON en vivo y muestra una preview antes de confirmar.
  - Detección de duplicados por nombre normalizado (sin acentos, case-insensitive).
  - Acción por fila para repetidos: reemplazar / importar como nuevo / omitir.
  - Edición inline de nombre, descripción, tags e ingredientes antes de importar.
  - Aviso con el conteo real de comidas importadas.
  - Modo backup: preview de conteos antes de restaurar.

### Changed

#### Compartido (lib `componentes`)
- `VERSION` actualizada a `1.2.0`.

#### Comidas
- Tarjetas de comidas uniformes en el grid: todas las filas con la misma altura (`grid-auto-rows: 1fr` + cadena `height:100%` hasta el panel).
- Footer (versión + changelog) fijo al fondo de la ventana, fuera del flujo, para que no genere scroll muerto cuando el contenido entra justo. Se quita la versión duplicada hardcodeada en Configuración.

### Fixed

#### Comidas
- El importador de comidas descartaba en silencio las comidas sin `id` (las que vienen de JSON pegado o generado por IA): se deduplicaba por `id` y todas colapsaban en la clave `undefined`, importando una sola entrada inválida mientras el aviso decía "todo bien". Ahora se asigna un `id` a las comidas que no lo traen antes del merge.
- El Service Worker interceptaba el `fetch` de los canales Listen y Write de Firestore y rompía el long-polling ("A ServiceWorker intercepted the request and encountered an unexpected error"). Se fuerza long-polling (XHR) y se agrega un SW custom que hace bypass de `firestore.googleapis.com` / `firebaseio.com` con `stopImmediatePropagation()` antes de importar `ngsw-worker.js`.
- Warning de preload de fuentes ("preloaded but not used"): se unifica el `<link>` de fuentes a un solo preload promovido a stylesheet en `onload`.

## [1.1.0] - 2026-05-18

Rediseño visual completo a estética editorial dark sobria. Reemplaza glassmorphism violeta + emojis decorativos por un sistema con serif para titulares (EB Garamond), sans para UI/cuerpo (Inter) y mono para code (JetBrains Mono), sobre paleta grafito + off-white con acento violeta apagado `#8b8bd6`.

### Added

#### Compartido (lib `componentes`)
- Componente `lib-icon` con 31 SVG inline de Lucide y tipo `IconName` (sin dependencia npm extra). API: `<lib-icon name="..." [size] [strokeWidth] [label]>` con `currentColor`.
- Sistema de tokens semánticos en `:root` de cada app: superficies (`--bg-base`, `--bg-surface`, `--bg-surface-raised`, `--bg-overlay`), foreground (`--fg-primary/secondary/muted`), borders (`--border-subtle/default/strong`), acento (`--accent`, `--accent-hover`, `--accent-muted`, `--accent-strong`), feedback (`--danger/success/warning`), tipografía (`--font-serif/sans/mono`, escala `--fs-*`, `--lh-*`, `--tracking-*`), layout (`--measure`, `--radius-*`), focus ring.
- Regla global `:has(lib-icon)` para `inline-flex` centrado en botones/links/labels que contienen un icono.

#### Perfil / Blog (`tatoh.ar`)
- Carga de fuentes EB Garamond + Inter + JetBrains Mono (Google Fonts, subset latin/latin-ext, carga asíncrona con `media="print" onload`).
- Blog landing como lista vertical editorial con separadores 1px y h1 serif `clamp(2.25rem, 4vw + 0.5rem, 3.25rem)`.
- PostCard rediseñado: meta arriba en mono uppercase, h2 serif (1.75rem peso 500), tags como texto separado por `·`, badge "Nuevo" como pill discreta.
- PostView con medida tipográfica `var(--measure)` (68ch) y back-link discreto.
- Sidebar: lista plana de posts recientes, section-titles uppercase mono, tags uniformes outlined, bio serif italic.
- Navigator con subrayado animado `::after` en hover/active. Botón Amazon cuadrado 32×32.

#### Comidas (`comidas.tatoh.ar`)
- Migration banner del dashboard con tonos warning sobrios.

### Changed

#### Compartido
- `lib-tag` reescrito a pill outlined por defecto (border `--border-default` + texto `--fg-muted`). Defaults legacy `colorFondo='blue'` y `colorTexto='#fff'` removidos.
- `Dialogo`, `Footer`, `Libro`, `GeneradorQr`, `SkillBar`, `Boton`, `Avatar`, `Panel`, `Redes` refactorizados con `var(--token, fallback)`. Fallbacks inline para uso standalone.
- Footer changelog dialog ahora usa serif para títulos y headings markdown.
- Animaciones lúdicas removidas: `bounce` infinite en lista-apks, `scale(1.1)` en redes, `translateX(5px)` en sidebar, `translateY(-4px)` + glow en post-card, `scale(1.05)` en book-cover, `scale(1.02)` + `brightness(1.1)` en APK button. Transiciones reducidas a 200ms en `color/border-color/background-color`.

#### Perfil
- Estilos markdown (líneas 59–399 de `styles.scss`) migrados al sistema editorial: serif body, mono code, tablas planas, `.book-showcase` editorial, blockquote, hr. Clases custom (`.img-*`, `.language-estructura/traduccion`, `data-label`) preservadas — los 13 posts no se tocan.
- Theme de Prism cambiado de `okaidia` a `tomorrow` (más sobrio sobre grafito).
- App layout: sidebar 280px fija, sin `.bg-30`, sin `backdrop-filter`, sin `border-radius` grandes.
- Sort/filter chips del blog aplanados con subrayado en active.
- `variables.ts`: `Apk.icono` tipado a `IconName` (no más string con emoji).

#### Comidas
- Todos los `var(--color-N)` y `var(--gris-copado)` migrados a tokens semánticos (8 SCSS de components + `dialog.service.ts` + HTML strings).
- `theme-color` meta del index.html actualizado a `#1c1d23`.
- Day-panel y meal-card pasan de violeta saturado a `bg-surface`. Día "hoy" diferenciado con `bg-surface-raised` + borde `--accent` (sin scale + glow blanco).
- Filter chips invertidos: unselected sutil (border `--border-default` + fg-muted), selected con `--accent-muted` fill.
- Card controls (copy/edit/delete) de `opacity:0.7` invisible a `color: var(--fg-secondary)` con hover; delete a `--danger`.
- Forms globales con inputs grafito (`--bg-surface-raised` + `--fg-primary`) en lugar del patrón invertido light.
- Headings serif globales (`h1-h4`).
- Botones `.btn-secondary/.btn-primary/.btn-danger` de pantry reescritos con paleta semántica.

### Removed

- Emojis decorativos reemplazados por `<lib-icon>` en navigators, blog buttons (sort/filter/clear), APK cards, dashboard banner, settings status badges, shopping-list (refresh, package), pantry (header, vaciar, restar), meal-card (copy/edit/delete).
- Glassmorphism: `backdrop-filter: blur()` removido de app layout, navigator, blog header, apk-card, utilidades tabs, generador-qr, dialogo.
- Fondo de imagen del perfil: `background: url('fondos/fondo.webp')` + carpeta `projects/perfil-personal/public/fondos/` (9 archivos sin referencias).
- Aliases legacy `--color-1..5`, `--gris-copado`, clase `.bg-30` y `@keyframes bounce` huérfano.

## [1.0.0] - 2026-05-11

Primer release público. La Cueva de Tatoh (`tatoh.ar`) y Comidas (`comidas.tatoh.ar`) corren en Cloudflare Workers con dominios separados.

### Added

#### Perfil / Blog (`tatoh.ar`)
- Estructura inicial Angular standalone con sidebar, navigator y body.
- Avatar, Panel colapsable, SkillBar, Tag, Redes (íconos SVG) y Boton como componentes reutilizables en la librería compartida `componentes`.
- Sección Blog con tarjetas de posts, vista detallada con `ngx-markdown` y resaltado de código vía Prism.js.
- Sección Utilidades con Generador de QR configurable (tamaño, márgenes, imagen embebida).
- Sección Libros con showcase responsive y componente `Libro` reutilizable.
- Posts de aprendizaje de japonés ("Aprendiendo Japonés con un Gordo Barbudo" lecciones 1-10) con explicaciones gramaticales y partículas.
- Filtrado y ordenamiento de posts del blog.
- Componente NotFound con navegación.
- Link a Amazon con SVG en el navigator.

#### Comidas (`comidas.tatoh.ar`)
- App de planificación de menú semanal y lista de compras (`d5af8cb`).
- Dashboard semanal con persistencia, copia de plan y soporte de múltiples platos por slot (modelo `Dish[]`).
- Editor de comidas con tags y toggles de visibilidad.
- Lista de compras con agrupación por tags, ingreso manual, exclusión por toggles y vista de impresión.
- Autocompletado de ingredientes.
- Suma automática de cantidades iguales en el carrito.
- Despensa (pantry) con resta inteligente desde la lista de compras y compatibilidad de unidades.
- Etiquetas (labels) por plato en el dashboard.
- Selector de comidas mejorado con UI optimizada.
- Slots de día clickables con highlight de "hoy" y bloqueo de días pasados.
- Historial de planes semanales con scope por semana.
- Login con Google y sincronización con Firestore.
- Importación / exportación de comidas en JSON.
- Generador de prompt para LLMs a partir del plan semanal.
- Configuración Capacitor para empaquetado Android.
- Confirmación de logout y diálogo de confirmación reutilizable.
- Botón de impresión para meal-list y shopping-list.

#### Compartido
- Componente `Dialogo` reutilizable con backdrop, header, body con `<ng-content />`, footer de acciones y configuración de cierre por click afuera. Tema oscuro para integrarse con la estética general.
- Componente `Footer` (lib `componentes`) con versión y botón "Changelog" que abre `CHANGELOG.md` renderizado en modal nativo `<dialog>` (top layer del browser, ignora stacking contexts del padre).
- Lock de scroll global vía clase `modal-open` mientras el modal está abierto.
- `SkillBar` rediseñado como chip pill compacto con relleno de progreso detrás del texto: varias skills por línea, menos scroll.
- PWA: service worker habilitado con auto-update en ambas apps.
- Workspace pnpm con tres proyectos (`componentes`, `perfil-personal`, `comidas`).

### Fixed

- Manejo robusto de valores nulos en cantidades, unidades y multiplicaciones (comidas).
- Sanitización de datos antes de subir a Firestore.
- Manejo de fechas y eliminación de grupos en pantry.
- `crypto.randomUUID` reemplazado por implementación compatible con WebView Android.
- Configuración `ngsw-config` para excluir requests a Firestore / Auth del service worker.
- Overflow de inputs en mobile en el meal editor.
- Contraste y detalles visuales en listas de comidas y compras.
- Layout y alineación del shopping-list en mobile (chips circulares con primera letra).
- Select nativo de tags reemplazado por chips clickables (UX mobile).
- Print section del shopping-list corregida.
- Redirect raíz del blog corregido.
- Image binding seguro en componente `Libro` (non-null assertion).
- Selector hover-state en chips de tags en mobile.

### Changed

- Modelo de slot single-meal migrado a `Dish[]` (refactor mayor en comidas).
- Tipografía y accesibilidad mejoradas en componentes de comidas.
- Imports streamlineados y componentes migrados a `readonly inputs` para inmutabilidad.
- Layout responsivo del navigator y QR generator.
- Acciones de meal card movidas al footer del componente.

### Infra

- Migración inicial a Angular 21 (desde 20.x).
- Actualización masiva de dependencias: Angular 21.2.12, Firebase 12.13, ESLint 10.3, Vitest 4.1, jsdom 29, ng-packagr 21.2.3, capacitor 8.3.3 y más.
- Lockfile pnpm regenerado tras upgrade.
- Deploy a Cloudflare Workers con `wrangler.jsonc` por app y assets binding.
- Subdominio dedicado `comidas.tatoh.ar` para la PWA (build con `base-href=/`).
- `_headers` para cachear correctamente service worker (`ngsw-worker.js`, `ngsw.json`) y servir `manifest.webmanifest` con MIME correcto.
- `single-page-application` fallback nativo de Workers Assets (sin Worker custom).
- Configuración de `packageManager` (`pnpm@10.33.2`) en `package.json`.
- Limpieza: removido `netlify.toml` y `GEMINI.md` obsoletos.
- Imágenes pesadas no usadas removidas (`fondo-2.png`, `fondo-4.png`).
