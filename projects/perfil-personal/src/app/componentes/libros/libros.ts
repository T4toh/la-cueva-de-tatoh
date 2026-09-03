import { Component, inject, signal } from '@angular/core';

import { GaleriaLibros } from '../galeria-libros/galeria-libros';
import { Seo } from '../../seo';
import { LIBROS } from '../../../variables';

@Component({
  selector: 'app-libros',
  imports: [GaleriaLibros],
  templateUrl: './libros.html',
  styleUrl: './libros.scss',
})
export class Libros {
  constructor() {
    inject(Seo).publicar({
      titulo: 'Libros',
      descripcion:
        'Las novelas publicadas de Ignacio Martín Arano, con sinopsis y ' +
        'links de compra.',
      ruta: '/libros',
      // La primera portada como preview del listado: es la que ya está en el
      // build y evita que el índice caiga en la imagen genérica del sitio.
      imagen: LIBROS[0]?.imagen,
    });
  }

  readonly libros = signal(LIBROS);
}
