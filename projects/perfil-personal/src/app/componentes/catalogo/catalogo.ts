import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from 'componentes';

import { Seo } from '../../seo';
import { WIDGETS } from './widgets';

@Component({
  selector: 'app-catalogo',
  imports: [Icon, RouterLink],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.scss',
})
export class Catalogo {
  constructor() {
    inject(Seo).publicar({
      titulo: 'Componentes',
      descripcion:
        'El catálogo de la librería de componentes de La Cueva de Tatoh: ' +
        'cada widget con su demo viva, su API y el snippet para copiar.',
      ruta: '/componentes',
    });
  }

  readonly widgets = WIDGETS;
  // Va en el componente y no en el template: una llave suelta en el HTML la
  // toma el parser de Angular como bloque de control.
  readonly importDemo = "import { Boton } from 'componentes';";
}
