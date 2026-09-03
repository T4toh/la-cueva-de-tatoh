import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Boton } from 'componentes';

import { Seo } from '../../seo';

@Component({
  selector: 'app-not-found',
  imports: [Boton],
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss',
})
export class NotFound {
  private router = inject(Router);

  // No lo ve ningún crawler (la 404 la sirve el fallback SPA, sin HTML
  // propio), pero evita que quede pegado el título de la ruta anterior.
  constructor() {
    inject(Seo).publicar({
      titulo: 'Página no encontrada',
      descripcion: 'Esta página no existe.',
    });
  }

  volverAlInicio(): void {
    this.router.navigate(['/']);
  }
}
