import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { MarkdownComponent } from 'ngx-markdown';
import { Icon } from 'componentes';

import { type Libro, LIBROS, SITIO_URL, TITULO_SITIO } from '../../../variables';

@Component({
  selector: 'app-libro-view',
  imports: [Icon, MarkdownComponent, NgOptimizedImage, RouterLink],
  templateUrl: './libro-view.html',
  styleUrl: './libro-view.scss',
})
export class LibroView implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly libro = signal<Libro | null>(null);

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const libro = LIBROS.find((l) => l.slug === params['slug']);
      if (!libro) {
        this.router.navigate(['/libros']);
        return;
      }
      this.libro.set(libro);
      this.publicarMeta(libro);
    });
  }

  // Sin esto el título del libro queda pegado al navegar a otra ruta del SPA.
  ngOnDestroy(): void {
    this.title.setTitle(TITULO_SITIO);
  }

  private publicarMeta(libro: Libro): void {
    const titulo = `${libro.titulo} — ${libro.subtitulo}`;
    const descripcion = primerParrafo(libro.sinopsis);
    const url = `${SITIO_URL}/libros/${libro.slug}`;

    this.title.setTitle(`${titulo} | ${TITULO_SITIO}`);
    this.meta.updateTag({ content: descripcion, name: 'description' });
    this.meta.updateTag({ content: titulo, property: 'og:title' });
    this.meta.updateTag({ content: descripcion, property: 'og:description' });
    this.meta.updateTag({ content: libro.imagen, property: 'og:image' });
    this.meta.updateTag({ content: url, property: 'og:url' });
    this.meta.updateTag({ content: 'book', property: 'og:type' });
    this.meta.updateTag({ content: TITULO_SITIO, property: 'og:site_name' });
    this.meta.updateTag({
      content: 'summary_large_image',
      name: 'twitter:card',
    });
    this.meta.updateTag({ content: titulo, name: 'twitter:title' });
    this.meta.updateTag({ content: descripcion, name: 'twitter:description' });
    this.meta.updateTag({ content: libro.imagen, name: 'twitter:image' });
  }
}

// La sinopsis es markdown multilínea; og:description quiere una sola frase plana.
function primerParrafo(sinopsis: string): string {
  return sinopsis
    .split('\n\n')[0]
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
