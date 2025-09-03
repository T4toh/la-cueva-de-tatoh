import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-boton',
  imports: [CommonModule],
  templateUrl: './boton.html',
  styleUrl: './boton.scss',
})
export class Boton {
  texto = input<string>('');
  color = input<string>();
  enlace = input<string>();
  clase = input<string>();
  icono = input<string>();
  deshabilitado = input<boolean>(false);
  loading = input<boolean>(false);
  estilo = input<'normal' | 'outline' | 'text' | 'icon'>('normal');
  tamaño = input<'pequeño' | 'mediano' | 'grande'>('mediano');
  tipo = input<'button' | 'submit' | 'reset'>('button');
  onClick = input<() => void>();

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
