import { Routes } from '@angular/router';

// El home carga un componente propio, no un redirect: un redirectTo en ''
// hace que el prerender escupa un HTML de meta-refresh como index.html, y el
// visitante ve esa pantalla intermedia antes de rebotar a /blog y de ahí a
// /blog/.
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./componentes/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'blog',
    loadComponent: () => import('./componentes/blog/blog').then((m) => m.Blog),
  },
  {
    path: 'blog/:id',
    loadComponent: () =>
      import('./componentes/post-view/post-view').then((m) => m.PostView),
  },
  {
    path: 'utilidades',
    loadComponent: () =>
      import('./componentes/utilidades/utilidades').then((m) => m.Utilidades),
  },
  {
    path: 'libros',
    loadComponent: () =>
      import('./componentes/libros/libros').then((m) => m.Libros),
  },
  {
    path: 'libros/:slug',
    loadComponent: () =>
      import('./componentes/libro-view/libro-view').then((m) => m.LibroView),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./componentes/not-found/not-found').then((m) => m.NotFound),
  },
];
