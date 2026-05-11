# Changelog

Todos los cambios notables a este proyecto se documentan en este archivo. El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado sigue [SemVer](https://semver.org/lang/es/).

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
- Componente `Dialogo` reutilizable con backdrop, header, body con `<ng-content />`, footer de acciones y configuración de cierre por click afuera.
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
