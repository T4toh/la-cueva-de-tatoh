import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { Libro } from 'componentes';
import { LIBROS } from '../../../variables';

@Component({
  selector: 'app-libros',
  imports: [Libro],
  templateUrl: './libros.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './libros.scss',
})
export class Libros {
  readonly libros = signal(LIBROS);
}
