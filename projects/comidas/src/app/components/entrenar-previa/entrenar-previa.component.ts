import { Component, input, output } from '@angular/core';

import { BloquePrevia } from '../../entrenar/sesion';
import { FiguraComponent } from '../figura/figura.component';

// La sesión entera antes de arrancar: cada bloque con sus ejercicios desplegables y
// un "Empezar acá" para arrancar desde ese bloque.
@Component({
  selector: 'app-entrenar-previa',
  imports: [FiguraComponent],
  templateUrl: './entrenar-previa.component.html',
  styleUrl: './entrenar-previa.component.scss',
})
export class EntrenarPreviaComponent {
  readonly bloques = input.required<(BloquePrevia & { duracion: string })[]>();
  readonly empezar = output<number>();
}
