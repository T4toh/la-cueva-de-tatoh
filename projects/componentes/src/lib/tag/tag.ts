import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'lib-tag',
  imports: [],
  templateUrl: './tag.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './tag.scss',
})
export class Tag {
  readonly texto = input<string>();
  readonly icono = input<string>();
  readonly colorFondo = input<string>();
  readonly colorTexto = input<string>();
}
