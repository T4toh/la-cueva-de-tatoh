import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Avatar,
  Boton,
  Dialogo,
  type DialogoAccion,
  Footer,
  Icon,
  ICON_NAMES,
  Libro,
  Panel,
  type Red,
  Redes,
  SkillBar,
  Tag,
} from 'componentes';

import { Seo } from '../../seo';
import { type Widget, WIDGETS } from '../catalogo/widgets';

@Component({
  selector: 'app-catalogo-view',
  imports: [
    Avatar,
    Boton,
    Dialogo,
    Footer,
      Icon,
    Libro,
    Panel,
    Redes,
    RouterLink,
    SkillBar,
    Tag,
  ],
  templateUrl: './catalogo-view.html',
  styleUrl: './catalogo-view.scss',
})
export class CatalogoView implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(Seo);

  readonly widget = signal<Widget | null>(null);
  readonly copiado = signal(false);

  // Estado de las demos que necesitan una: el diálogo se abre con un botón, y
  // las listas van en campos y no en literales del template para no crear un
  // array nuevo en cada ciclo de detección de cambios.
  readonly dialogoVisible = signal(false);
  readonly abrirDialogo = (): void => this.dialogoVisible.set(true);
  readonly iconos = ICON_NAMES;
  readonly acciones: DialogoAccion[] = [
    { texto: 'Cancelar', estilo: 'text' },
    { texto: 'Borrar', color: '#b04a4a' },
  ];
  readonly redes: Red[] = [
    { nombre: 'github', usuario: 'T4toh' },
    { nombre: 'linkedin', usuario: 'ignacio-arano' },
  ];

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const widget = WIDGETS.find((w) => w.slug === params['slug']);
      if (!widget) {
        this.router.navigate(['/componentes']);
        return;
      }
      this.widget.set(widget);
      this.seo.publicar({
        titulo: `${widget.nombre} — Componentes`,
        descripcion: widget.descripcion,
        ruta: `/componentes/${widget.slug}`,
      });
    });
  }

  async copiar(snippet: string): Promise<void> {
    await navigator.clipboard.writeText(snippet);
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 2000);
  }
}
