import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'lib-avatar',
  imports: [CommonModule],
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
})
export class Avatar {
  @Input() imagenUrl?: string;
  @Input() nombre?: string;
  @Input() textoError = 'No se pudo cargar la imagen';
}
