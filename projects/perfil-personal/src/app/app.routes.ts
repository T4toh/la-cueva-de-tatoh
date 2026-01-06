import { Routes } from '@angular/router';

// Redirects a blog (home) path to the blog component
export const routes: Routes = [
  { path: '', redirectTo: 'blog', pathMatch: 'full' },
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
    path: '**',
    loadComponent: () =>
      import('./componentes/not-found/not-found').then((m) => m.NotFound),
  },
];
