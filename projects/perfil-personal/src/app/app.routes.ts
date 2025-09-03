import { Routes } from '@angular/router';

// Redirects a blog (home) path to the blog component
export const routes: Routes = [
  { path: '', redirectTo: '/blog', pathMatch: 'full' },
  {
    path: 'blog',
    loadComponent: () => import('./componentes/blog/blog').then((m) => m.Blog),
  },
  {
    path: '**',
    loadComponent: () => import('./componentes/not-found/not-found').then((m) => m.NotFound),
  },
];
