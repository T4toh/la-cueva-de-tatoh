import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'lib-avatar',
  imports: [CommonModule],
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
})
export class Avatar {
  readonly imagenUrl = input<string>();
  readonly nombre = input<string>();
  readonly textoError = input<string>('No se pudo cargar la imagen');
}
