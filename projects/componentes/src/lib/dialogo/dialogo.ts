import { Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Boton } from '../boton/boton';

export type DialogoAccion = {
  texto: string;
  estilo?: 'normal' | 'outline' | 'text' | 'icon';
  color?: string;
  icono?: string;
  accion?: () => void;
};

@Component({
  selector: 'lib-dialogo',
  standalone: true,
  imports: [CommonModule, Boton],
  templateUrl: './dialogo.html',
  styleUrl: './dialogo.scss',
})
export class Dialogo {
  readonly visible = model<boolean>(false);
  readonly titulo = input<string>();
  readonly mensaje = input<string>();
  readonly acciones = input<DialogoAccion[]>([]);
  readonly ancho = input<string>('500px');
  readonly cerrarAlHacerClickAfuera = input<boolean>(true);

  // Output para notificar cierre si es necesario lógica adicional
  readonly alCerrar = output<void>();

  cerrar(): void {
    this.visible.set(false);
    this.alCerrar.emit();
  }

  onBackdropClick(event: Event): void {
    if (
      this.cerrarAlHacerClickAfuera() &&
      (event.target as HTMLElement).classList.contains('dialogo-backdrop')
    ) {
      this.cerrar();
    }
  }
}
