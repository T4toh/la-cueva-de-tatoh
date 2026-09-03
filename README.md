# La Cueva de Tatoh

**TODO**

- Perfil personal ✅
- Blog ✅
- QR Generator ✅
- Lugar para componentes
- Componentes
- Listado de Libros ✅

## Escribir un post

1. Crear el markdown en `projects/perfil-personal/public/posts/<slug>.md`.
2. Agregarlo **al final** de `POSTS` en `projects/perfil-personal/src/variables.ts`:

```ts
{
  title: 'Título del post',
  src: 'posts/<slug>.md',
  fecha: '3/9/26',            // d/m/aa
  tags: ['tag', 'otro-tag'],
},
```

Cosas a tener en cuenta:

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
  subtitulo: 'Meridian #N',
  imagen: '/img/portadas/mi-libro.jpg',
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

3. Verificar después de un build de producción:

```bash
pnpm build && pnpm check:libros
```

`check:libros` falla si a algún libro le falta un `og:`, si el `og:image` no es
absoluto o apunta a un archivo que no está en el build, o si el landing salió
como stub de redirect en vez del home prerenderizado.
