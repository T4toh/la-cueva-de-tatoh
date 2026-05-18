# Changelog

Todos los cambios notables a este proyecto se documentan en este archivo. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado sigue [SemVer](https://semver.org/lang/es/).

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
