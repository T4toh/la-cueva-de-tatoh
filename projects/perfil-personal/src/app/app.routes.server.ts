import { RenderMode, ServerRoute } from '@angular/ssr';

import { LIBROS, POSTS } from '../variables';

// Cloudflare sirve el asset estático si existe y recién ahí cae al fallback
// SPA (que devuelve el index.html del home). Por eso conviene prerenderizar
// todo lo que se pueda: una ruta sin archivo propio muestra el home por un
// instante antes de que Angular la reemplace.
export const serverRoutes: ServerRoute[] = [
  // Un HTML por libro, con og:image real: es lo que leen los crawlers de
  // WhatsApp/Twitter, que no ejecutan JS.
  {
    path: 'libros/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => LIBROS.map(({ slug }) => ({ slug })),
  },
  // El cuerpo del post queda vacío en el HTML (ngx-markdown baja el .md por
  // HTTP en el browser), pero el título y el layout salen prerenderizados.
  {
    path: 'blog/:id',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => POSTS.map((_, i) => ({ id: String(i) })),
  },
  // generador-qr instancia QRCodeStyling en un effect y eso toca `window`,
  // que no existe en Node. Se queda como estaba: renderizada en el cliente.
  { path: 'utilidades', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
