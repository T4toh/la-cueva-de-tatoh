import { Component, signal } from '@angular/core';

import { Libro } from 'componentes';
import { LIBROS } from 'projects/perfil-personal/src/variables';

@Component({
  selector: 'app-libros',
  imports: [Libro],
  templateUrl: './libros.html',
  styleUrl: './libros.scss',
})
export class Libros {
  readonly libros = signal(LIBROS);
}
