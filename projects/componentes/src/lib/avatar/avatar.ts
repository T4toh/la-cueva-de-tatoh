
import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-avatar',
  imports: [],
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
})
export class Avatar {
  readonly imagenUrl = input<string>();
  readonly nombre = input<string>();
  readonly textoError = input<string>('No se pudo cargar la imagen');
}
