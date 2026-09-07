# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Angular 22 monorepo (single `angular.json`) managed with **pnpm**. The `preinstall` script enforces pnpm — using `npm install` will fail. Source lives under `projects/`:

- `projects/perfil-personal` — application. Personal portfolio + blog. Uses `ngx-markdown` + `prismjs` for rendered posts. PWA. Selector prefix `app`.
- `projects/comidas` — application. Meal planning app, Firebase-backed (Auth + Firestore, project id `la-cueva-comidas`). PWA. Also wrapped as an Android app via Capacitor (`appId: com.tatoh.comidas`). Selector prefix `app`.
- `projects/componentes` — Angular library built with `ng-packagr`. Selector prefix `lib`. Public surface is `projects/componentes/src/public-api.ts` — every reusable widget (avatar, panel, skill-bar, tag, redes, boton, generador-qr, libro, dialogo) must be re-exported there. Apps import it as `from 'componentes'` via the `tsconfig.json` path alias `componentes → ./dist/componentes`.

Because the library is consumed through `dist/componentes`, **`ng build componentes` must run before any app build, dev server, or test that imports it** — `pnpm build` already orders things correctly, but ad-hoc `ng serve <app>` after pulling fresh code requires a prior library build.

## Commands

```bash
pnpm install          # use pnpm; npm is blocked
pnpm start            # ng serve (perfil-personal by default)
pnpm build            # builds componentes → perfil-personal → comidas (production)
pnpm test             # ng test comidas (Vitest; único proyecto con specs)
pnpm lint             # ng lint across all three projects
pnpm check:libros     # tras un build de prod: og: de cada /libros/<slug> + landing prerenderizado
pnpm check:sw         # tras un build de prod: el index del manifest del SW está cacheado
pnpm watch            # ng build --watch development

ng serve comidas      # serve a specific app (requires componentes built first)
ng build <project>    # build a specific project
ng lint <project>     # lint a specific project
```

Comidas → Android (Capacitor):

```bash
pnpm build:comidas             # production build to dist/comidas/browser
pnpm build:comidas:android     # build + cap sync android
pnpm open:android              # build + sync + open Android Studio
```

## Deployment layout (Cloudflare Workers)

Each app deploys as its **own** Worker serving static assets — there is no shared
site and no copy step between them. One `wrangler.jsonc` per app:

| App | Config | Worker | Assets |
|-----|--------|--------|--------|
| perfil-personal | `projects/perfil-personal/wrangler.jsonc` | `la-cueva-de-tatoh` | `dist/perfil-personal/browser` |
| comidas | `projects/comidas/wrangler.jsonc` | `comidas` | `dist/comidas/browser` |

Both set `not_found_handling: "single-page-application"`. Cloudflare serves a
matching static asset first and only falls back to `index.html` on a miss, so
prerendered files win over the SPA fallback. Deploy happens on merge to `main`.

**perfil-personal is prerendered (SSG).** `outputMode: "static"` plus
`src/main.server.ts` + `app.config.server.ts`; the per-route rules live in
`src/app/app.routes.server.ts`. Adding a book or a post to `src/variables.ts`
generates its static HTML automatically — that is what gives `/libros/<slug>`
real `og:` tags, since the WhatsApp/Twitter crawlers do not run JS.

Two consequences worth knowing:

- Any route left as `RenderMode.Client` has no file of its own, so opening it
  directly serves the prerendered home for an instant before Angular swaps it —
  and crawlers, which never wait for the swap, read the home's tags instead of
  the route's. Every route prerenders today; keep it that way.
- Anything running at component init must survive Node. No bare `window` or
  `document` outside an event handler. `generador-qr` is the worked example: it
  builds a `QRCodeStyling` inside an `effect`, which touches `window`, so it
  guards on `isPlatformBrowser` — that guard is what lets `/utilidades`
  prerender at all.

### Meta tags

`src/app/seo.ts` is the only place that writes them. Every routed component
calls `inject(Seo).publicar({...})` with its own title, description and route;
`index.html` carries a default set as the floor for anything that doesn't.
A new route without that call ships with the site's generic preview, so
`check:libros` fails when a prerendered page's `og:url` isn't its own path. It
is a separate command from `pnpm build` — run it after touching routes.

### Service worker updates

Both apps are PWAs, and both had to solve "the Angular SW keeps serving the old
build until every tab closes" — but **they solve it differently on purpose, and
must not be unified**:

- **comidas** registers `ngsw-custom.js`, which does `skipWaiting()` +
  `clients.claim()` so the new worker takes control on the next load. Safe there
  because comidas has no lazy routes: everything ships in the main bundle.
- **perfil-personal** does it from `App` instead, via `SwUpdate.versionUpdates`:
  on `VERSION_READY` it activates and reloads on the *next route change*.
  `skipWaiting()` would be wrong here — this app has lazy routes, so a worker
  swapping mid-session leaves the loaded page requesting chunk hashes the new
  deploy already deleted.

If you touch either, keep that difference and the reason for it.

Lo que sí comparten es una trampa del `ngsw-config.json`: con
`outputMode: "static"`, el builder **reescribe** el `index` del manifest a
`/index.csr.html` —el shell de CSR— aunque el config diga `/index.html`, porque
el `/index.html` del build es la home prerenderizada y no sirve de shell. Si ese
archivo no está en los `files` del grupo `app`, el índice queda fuera del cache:
el SW se registra igual y en devtools se ve activo, pero no puede resolver
ninguna navegación, así que no hay offline y parece que no existe. Es lo que le
pasaba a perfil-personal y no a comidas, que lo tenía listado desde el
principio. `pnpm check:sw` falla si el `index` del manifest no está en el
`hashTable`, y también si un archivo del `hashTable` no está en el build o
cambió de hash —uno solo que no coincida hace fallar la instalación entera—.

Run `pnpm check:libros` after a production build to confirm every book still
emits its `og:` tags, and that `/` is the real landing rather than a
meta-refresh stub. A `redirectTo` on the `''` route makes the prerenderer emit
one of those stubs as `index.html`, which is how a visible "Redirecting" page
once shipped to production.

## ESLint is the source of truth

The flat config at `eslint.config.js` is strict and enforced. Code must pass `pnpm lint` unmodified. Rules that catch people most often:

- `@typescript-eslint/explicit-function-return-type`: **error** — every function/method needs an explicit return type.
- `@typescript-eslint/explicit-member-accessibility` with `{ accessibility: 'no-public' }`: **error** — never write `public`; use `private`/`protected` or omit it.
- `@typescript-eslint/consistent-type-definitions`: prefer `type` over `interface`.
- `@angular-eslint/component-selector`: kebab-case, prefix `app`, element or attribute.
- `@angular-eslint/directive-selector`: camelCase, prefix `app`, attribute only.
- Components in `componentes` library use prefix `lib` (set in that project's `angular.json` and eslint config).
- `eqeqeq`, `curly`, `no-var`, `prefer-const`, `prefer-arrow-callback`, `one-var: never`, `max-classes-per-file: 1`, `complexity: 20`, `max-len: 120`.
- HTML templates: `@angular-eslint/template/prefer-control-flow` is **error** — use `@if` / `@for`, not `*ngIf` / `*ngFor`. Attribute order is alphabetical within these groups: STRUCTURAL_DIRECTIVE → TEMPLATE_REFERENCE → ATTRIBUTE_BINDING → INPUT_BINDING → TWO_WAY_BINDING → OUTPUT_BINDING. `template/eqeqeq` is **error**.
- `@angular-eslint/prefer-signals`, `prefer-standalone`, `prefer-output-readonly` are warnings — follow them; standalone components are the norm here, signals are preferred over RxJS for state.

`tsconfig.json` is also strict: `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, plus Angular's `strictTemplates` and `strictInputAccessModifiers`.

## Tema (claro / oscuro)

Los tokens de color, tipografía y layout viven en un solo lugar:
`projects/componentes/src/styles/_tema.scss`. Los dos apps lo consumen con
`@use 'tema';` en la primera línea de su `styles.scss`, resuelto por el
`stylePreprocessorOptions.includePaths` de `angular.json` — que apunta al
**source** de la librería, no a `dist/componentes`. Es a propósito: son custom
properties de CSS, no pasan por `public-api.ts`, y leerlas de `dist` obligaría
a un `ng build componentes` en cada retoque de un color.

Tres estados, y el CSS los resuelve por orden de aparición (misma
especificidad): sin `data-tema` en el `<html>` manda `prefers-color-scheme`;
`data-tema="claro"` / `"oscuro"` es la elección explícita y gana.

`TemaService` (exportado desde `componentes`) es el dueño del atributo y de la
clave `tema` de `localStorage`, y expone `icono()` / `etiqueta()` con la
presentación de cada estado. Está inyectado en el `App` de las dos apps a
propósito: si sólo lo inyectara el botón del toggle, en comidas no correría
hasta llegar a esa pantalla. La misma clave la lee un script inline en los dos
`index.html`, antes del primer paint — sin él, la elección explícita parpadea
mientras arranca Angular. Si cambia la clave, cambia en los dos lados.

El botón lo dibuja cada app, no la librería: en comidas es la última tab de
`.main-nav`, en perfil-personal va en la fila de logos del navigator. Un
componente propio en `componentes` no servía — sus estilos están encapsulados,
así que no podía heredar el layout del nav que lo contiene (en comidas las tabs
pasan a icono-sobre-texto abajo de 600px). Lo compartido es el servicio.

El `theme-color` de comidas lo escribe el servicio leyendo el `--bg-surface` ya
resuelto. No se puede resolver con dos `<meta>` y `media`: el transform del
`index.html` colapsa los duplicados por `name` y descarta el `media`.

Sobre un relleno sólido va `--fg-on-accent`, y sobre `--accent-strong` va
`--fg-on-accent-strong` — son distintos: en oscuro el primero es casi negro
(el accent es claro) y el segundo casi blanco (el accent-strong es de tono
medio). Poner `--fg-primary` sobre cualquiera de los dos funciona en oscuro por
casualidad y es ilegible en claro; era el bug de "Descargar QR", "Descargar
APK" y "Leer en Amazon". Sobre un `*-muted` —que es un tinte translúcido sobre
la superficie— sí va `--fg-primary`.

Colores nuevos: usar los tokens, nunca un hex ni un `rgba(255,255,255,…)`
suelto — un tinte blanco sobre papel no se ve. Hay dos familias de superficie:
`--bg-sunken-*` (siempre más oscuro que la superficie) y `--bg-tint-*` (realce
que sigue al tema). Lo que está dentro de un `@media print` se queda en blanco
y negro, que el papel no tiene tema.

## Adding shared code

Anything reusable across `perfil-personal` and `comidas` belongs in `componentes` and must be re-exported from `projects/componentes/src/public-api.ts`. App-specific logic stays in the app. Don't duplicate.

## Firebase / Firestore

`comidas` initializes Firebase inline in `projects/comidas/src/app/app.config.ts` (config is committed — public web API key, not a secret). Firestore rules in `projects/comidas/firestore.rules` lock all access to `users/{uid}` documents owned by the authenticated user; everything else is denied. Any new collection needs an explicit rule.
