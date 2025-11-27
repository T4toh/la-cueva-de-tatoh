import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-libro',
  imports: [CommonModule],
  templateUrl: './libro.html',
  styleUrl: './libro.scss',
})
export class Libro {
  readonly imagen = input<string>();
  readonly titulo = input<string>();
  readonly subtitulo = input<string>();
  readonly enlace = input<string>();

  handleClick(): void {
    const link = this.enlace();
    if (link) {
      window.open(link, '_blank');
    }
  }
}
