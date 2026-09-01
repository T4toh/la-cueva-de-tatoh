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
pnpm check:libros     # tras un build de prod: valida los og: de cada /libros/<slug>
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
  directly serves the prerendered home for an instant before Angular swaps it.
  `utilidades` is in that bucket: `generador-qr` builds a `QRCodeStyling` inside
  an `effect`, and that touches `window`, which Node does not have. Guarding it
  with `isPlatformBrowser` would let it prerender too.
- Anything running at component init must survive Node. No bare `window` or
  `document` outside an event handler.

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

Run `pnpm check:libros` after a production build to confirm every book still
emits its `og:` tags.

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

## Adding shared code

Anything reusable across `perfil-personal` and `comidas` belongs in `componentes` and must be re-exported from `projects/componentes/src/public-api.ts`. App-specific logic stays in the app. Don't duplicate.

## Firebase / Firestore

`comidas` initializes Firebase inline in `projects/comidas/src/app/app.config.ts` (config is committed — public web API key, not a secret). Firestore rules in `projects/comidas/firestore.rules` lock all access to `users/{uid}` documents owned by the authenticated user; everything else is denied. Any new collection needs an explicit rule.
