import { Component, inject, OnInit, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { Icon } from 'componentes';

import { LogoTienda } from '../logo-tienda/logo-tienda';
import { Seo } from '../../seo';
import { type Libro, LIBROS } from '../../../variables';

@Component({
  selector: 'app-libro-view',
  imports: [Icon, LogoTienda, MarkdownComponent, NgOptimizedImage, RouterLink],
  templateUrl: './libro-view.html',
  styleUrl: './libro-view.scss',
})
export class LibroView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(Seo);

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

  private publicarMeta(libro: Libro): void {
    this.seo.publicar({
      titulo: `${libro.titulo} — ${libro.subtitulo}`,
      descripcion: primerParrafo(libro.sinopsis),
      ruta: `/libros/${libro.slug}`,
      imagen: libro.imagen,
      tipo: 'book',
    });
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
