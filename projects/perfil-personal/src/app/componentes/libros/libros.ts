import { Component, signal } from '@angular/core';

import { GaleriaLibros } from '../galeria-libros/galeria-libros';
import { LIBROS } from '../../../variables';

@Component({
  selector: 'app-libros',
  imports: [GaleriaLibros],
  templateUrl: './libros.html',
  styleUrl: './libros.scss',
})
export class Libros {
  readonly libros = signal(LIBROS);
}
