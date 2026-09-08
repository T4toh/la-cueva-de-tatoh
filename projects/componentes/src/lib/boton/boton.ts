import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-boton',
  imports: [CommonModule],
  templateUrl: './boton.html',
  styleUrl: './boton.scss',
})
export class Boton {
  readonly texto = input<string>('');
  readonly color = input<string>();
  readonly enlace = input<string>();
  readonly clase = input<string>();
  // ponytail: el tipo es `string`, así que acepta tanto una URL de imagen
  // como un nombre de `lib-icon` (`IconName`) — nada distingue `icono="copy"`
  // de una URL rota. Ya pasó una vez, en el dialog de compartir. Salida: que
  // reciba un `IconName` y renderice con `lib-icon`, o renombrarlo a
  // `iconoUrl` y dejar los nombres a `lib-icon`; las dos rompen la
  // superficie pública de la librería.
  readonly icono = input<string>();
  readonly deshabilitado = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly estilo = input<'normal' | 'outline' | 'text' | 'icon'>('normal');
  readonly tamaño = input<'pequeño' | 'mediano' | 'grande'>('mediano');
  readonly tipo = input<'button' | 'submit' | 'reset'>('button');
  readonly onClick = input<() => void>();

  getClasses(): string {
    let classes = `btn btn-${this.estilo()} btn-${this.tamaño()}`;
    if (this.color()) {
      classes += ` btn-${this.color()}`;
    }
    return classes;
  }

  handleClick(): void {
    this.onClick()?.();
  }
}
