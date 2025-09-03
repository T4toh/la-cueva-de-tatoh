import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-tag',
  imports: [],
  templateUrl: './tag.html',
  styleUrl: './tag.scss',
})
export class Tag {
  texto = input<string>();
  icono = input<string>();
  colorFondo = input<string>('blue');
  colorTexto = input<string>('#fff');
}
