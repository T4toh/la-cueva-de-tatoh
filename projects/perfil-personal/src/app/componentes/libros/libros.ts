import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Libro } from 'componentes';
import { LIBROS } from 'projects/perfil-personal/src/variables';

@Component({
  selector: 'app-libros',
  imports: [CommonModule, Libro],
  templateUrl: './libros.html',
  styleUrl: './libros.scss',
})
export class Libros {
  readonly libros = signal(LIBROS);
}
