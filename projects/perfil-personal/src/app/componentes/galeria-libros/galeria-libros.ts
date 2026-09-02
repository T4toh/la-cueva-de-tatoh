import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Libro } from 'componentes';

import { type Libro as DatosLibro } from '../../../variables';

@Component({
  selector: 'app-galeria-libros',
  imports: [Libro, RouterLink],
  templateUrl: './galeria-libros.html',
  styleUrl: './galeria-libros.scss',
})
export class GaleriaLibros {
  readonly libros = input.required<DatosLibro[]>();
}
