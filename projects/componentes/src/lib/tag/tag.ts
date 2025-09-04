import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-tag',
  imports: [],
  templateUrl: './tag.html',
  styleUrl: './tag.scss',
})
export class Tag {
  readonly texto = input<string>();
  readonly icono = input<string>();
  readonly colorFondo = input<string>('blue');
  readonly colorTexto = input<string>('#fff');
}
