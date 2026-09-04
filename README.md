# La Cueva de Tatoh

Monorepo Angular con todo lo que vive en `tatoh.ar`: el portfolio y el blog, la
app de planificación de comidas, y la librería de componentes que las dos
comparten. Un solo `angular.json`, un solo `pnpm install`, dos Workers de
Cloudflare distintos.

| Proyecto | Qué es | Dónde vive |
|----------|--------|-----------|
| [`perfil-personal`](projects/perfil-personal) | Portfolio, blog y fichas de libros. Prerenderizado (SSG), PWA. | [tatoh.ar](https://tatoh.ar) |
| [`comidas`](projects/comidas) | Planificador de comidas y lista de compras. Firebase (Auth + Firestore), PWA, y app Android vía Capacitor. | [comidas.tatoh.ar](https://comidas.tatoh.ar) |
| [`componentes`](projects/componentes) | Librería de widgets compartidos (`ng-packagr`), consumida como `from 'componentes'`. | se publica a `dist/componentes` |

Stack: Angular 22, TypeScript 6, pnpm, Vitest, ESLint flat config, Cloudflare
Workers. Componentes standalone y signals; RxJS sólo donde hace falta.

## Empezar

Node según `.nvmrc` (24.20.0, la LTS actual): `nvm use` en la raíz del repo. El
rango que acepta Angular está en `engines`, y `engine-strict=true` corta el
install si el Node no sirve — antes eso reventaba recién en `ng build`, con un
error que no decía qué hacer.

```bash
nvm use          # 24.20.0, según .nvmrc
pnpm install     # pnpm obligatorio: el preinstall bloquea npm
pnpm build       # componentes → perfil-personal → comidas
pnpm start       # ng serve perfil-personal
```

**`componentes` se compila antes que cualquier app.** Las apps la importan
desde `dist/componentes` (alias en `tsconfig.json`), no desde el código fuente,
así que un `ng serve comidas` sobre un repo recién clonado falla hasta que
corras `ng build componentes`. `pnpm build` ya lo ordena bien.

## Comandos

```bash
pnpm start                     # ng serve perfil-personal
pnpm build                     # build de producción de todo, en orden
pnpm watch                     # perfil-personal en watch (development)
pnpm test                      # ng test comidas (Vitest; es el único con specs)
pnpm lint                      # ng lint en los tres proyectos
pnpm check:libros              # post-build: verifica los og: de libros y rutas

ng serve comidas               # una app puntual (requiere componentes buildeado)
ng build <proyecto>
ng lint <proyecto>

pnpm build:comidas:android     # build + cap sync android
pnpm open:android              # build + sync + abre Android Studio
```

## Deploy

Cada app es su propio Worker sirviendo assets estáticos: no hay sitio
compartido ni paso de copia entre ellas.

| App | Config | Worker | Assets |
|-----|--------|--------|--------|
| perfil-personal | `projects/perfil-personal/wrangler.jsonc` | `la-cueva-de-tatoh` | `dist/perfil-personal/browser` |
| comidas | `projects/comidas/wrangler.jsonc` | `comidas` | `dist/comidas/browser` |

El deploy lo dispara Cloudflare al mergear a `main` (no hay Action en el repo).
Los dos Workers usan `not_found_handling: "single-page-application"`:
Cloudflare busca primero un asset que matchee y sólo cae a `index.html` si no
existe, así que los archivos prerenderizados le ganan al fallback de SPA.

## Escribir un post

1. Crear el markdown en `projects/perfil-personal/public/posts/<slug>.md`.
2. Agregarlo **al final** de `POSTS` en `projects/perfil-personal/src/variables.ts`:

```ts
{
  title: 'Título del post',
  src: 'posts/<slug>.md',
  fecha: '3/9/26',            // d/m/aa
  tags: ['tag', 'otro-tag'],
  descripcion:
    'Las primeras palabras del post, en una o dos frases planas.',
},
```

**No te olvides de la `descripcion`**: es el `og:description`, o sea lo que ve
alguien cuando pegás el link en un chat. Es opcional y nada falla si no está,
pero el post sale con el texto genérico del sitio. Van bien las primeras frases
del `.md`, aplanadas: sin markdown, sin links y sin cortar a mitad de palabra.

Cosas a tener en cuenta:

- El `descripcion` no se saca solo del markdown: el cuerpo lo baja el browser
  por HTTP y el prerender no lo tiene a mano, así que si no está en el array no
  existe.
- La URL del post es `/blog/<índice en el array>`, así que los posts se
  **agregan al final**. Meter uno en el medio le cambia la URL a todos los que
  vienen después.
- El cuerpo lo baja `ngx-markdown` por HTTP en el browser; el prerender solo
  genera el título y el layout. Por eso el `.md` va en `public/`, no en `src/`.
- Las imágenes van en `public/img/...` y se referencian con ruta absoluta
  (`/img/...`).
- Se puede escribir HTML dentro del markdown (los posts de libros usan
  `.book-showcase` / `.book-cover` / `.book-info`).

## Agregar un libro

1. Dejar la portada en `projects/perfil-personal/public/img/portadas/<slug>.jpg`,
   redimensionada a 752x1200:

```bash
magick tapa-original.png -resize 752x1200 -quality 88 -strip \
  projects/perfil-personal/public/img/portadas/<slug>.jpg
```

   `-resize` respeta el aspect ratio del original: solo sale 752x1200 exacto si
   la tapa ya viene en 1:1.6 (el ratio estándar de KDP). Verificar con
   `sips -g pixelWidth -g pixelHeight <archivo>` antes de commitear. No forzar
   con `^` + `-extent`: recorta la tapa en vez de avisar que el original está mal.

2. Agregar la entrada a `LIBROS` en `projects/perfil-personal/src/variables.ts`:

```ts
{
  slug: 'mi-libro',                        // define la URL /libros/mi-libro
  titulo: 'Mi Libro',
  imagen: '/img/portadas/mi-libro.jpg',
  saga: 'Meridian',                        // agrupa el libro en /libros
  numero: 3,                               // su orden dentro de la saga
  sinopsis: [
    'Primer párrafo, que es el que sale como og:description.',
    '',
    'Segundo párrafo.',
  ].join('\n'),
  tiendas: [
    { nombre: 'Amazon', url: 'https://www.amazon.com/dp/XXXX', logo: 'amazon' },
  ],
},
```

Cosas a tener en cuenta:

- **El `slug` no se cambia una vez publicado**: es la URL del libro y va impresa
  dentro del EPUB, así que cambiarlo rompe los links de las copias vendidas.
- Si todavía no hay link de compra, dejar `tiendas: []`. La ficha no dibuja
  ningún botón y no queda un link muerto.
- La portada se sirve desde el repo a propósito. Una URL de Amazon la controla
  Amazon: si cambia el listado, se rompe el `og:image` sin que nos enteremos.
- El `logo` de cada tienda tiene que tener su `@case` en el componente
  `logo-tienda`; sin eso cae en el ícono genérico de libro.
- La ruta `/libros/<slug>` se prerenderiza sola (está en `app.routes.server.ts`),
  no hay que tocar nada más.
- **`saga` y `numero` son el agrupador de `/libros`.** La página lista una
  sección por saga —en el orden en que las sagas aparecen en `LIBROS`— y dentro
  de cada una ordena por `numero`. Una saga nueva no necesita código: alcanza
  con escribir su nombre. La etiqueta visible (`Milky Way #1`) la arma la vista,
  así que los dos campos tienen que estar; no hay `subtitulo` libre.
- El landing sigue mostrando el carrusel plano con todos los libros, sin
  agrupar.

3. Verificar después de un build de producción:

```bash
pnpm build && pnpm check:libros
```

`check:libros` falla si a algún libro le falta un `og:`, si el `og:image` no es
absoluto o apunta a un archivo que no está en el build, si alguna ruta
prerenderizada no publicó su propio `og:url`, o si el landing salió como stub de
redirect en vez del home prerenderizado.

## Meta tags y previews

Todo lo que ve un chat cuando le pegás un link sale de
`projects/perfil-personal/src/app/seo.ts`. Cada componente ruteado llama a
`inject(Seo).publicar({ titulo, descripcion, ruta })` con lo suyo, y las rutas
prerenderizadas hornean esos tags en su HTML — que es lo único que leen los
crawlers de WhatsApp y Twitter, porque no ejecutan JS.

**Ruta nueva = `publicar()` nuevo.** Si se olvida, la ruta hereda el juego por
defecto de `index.html` y su preview queda genérico. No hace falta acordarse a
mano: `pnpm check:libros` compara el `og:url` de cada página prerenderizada
contra su propia ruta y falla cuando no coinciden. Es un comando aparte de
`pnpm build`, así que hay que correrlo a mano después de tocar rutas.

Los posts traen su `descripcion` en `POSTS`. El campo es opcional: si falta,
el post cae en `DESCRIPCION_SITIO` y comparte el `og:description` con todo el
sitio, que es exactamente lo que no queremos.

## Agregar código compartido

Todo lo reutilizable entre `perfil-personal` y `comidas` va en `componentes` y
**tiene que re-exportarse** desde `projects/componentes/src/public-api.ts`; si
no está ahí, las apps no lo ven. Lo específico de una app se queda en la app.
No duplicar.

ESLint es la fuente de verdad del estilo: `eslint.config.js` es estricto y el
código tiene que pasar `pnpm lint` sin tocarlo. Lo que más pincha: tipo de
retorno explícito en toda función, nunca escribir `public`, `type` antes que
`interface`, y `@if`/`@for` en los templates en vez de `*ngIf`/`*ngFor`.

## Más documentación

- [TODO.md](TODO.md) — qué falta, qué se está planeando, y la deuda técnica declarada.
- [CHANGELOG.md](CHANGELOG.md) — Keep a Changelog + SemVer. Se actualiza en cada release.
- [CLAUDE.md](CLAUDE.md) — notas de arquitectura y las trampas del repo, escritas para agentes: por qué los dos service workers se actualizan distinto, qué rompe el prerender, qué reglas de lint importan.
- [RASPBERRY.md](RASPBERRY.md) — la Raspberry de casa: Pi-hole, túnel de Cloudflare, `api.tatoh.ar`. No se buildea desde este repo.
