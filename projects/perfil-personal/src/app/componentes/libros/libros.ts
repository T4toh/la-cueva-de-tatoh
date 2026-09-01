import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Libro } from 'componentes';
import { LIBROS } from '../../../variables';

@Component({
  selector: 'app-libros',
  imports: [Libro, RouterLink],
  templateUrl: './libros.html',
  styleUrl: './libros.scss',
})
export class Libros {
  readonly libros = signal(LIBROS);
}
