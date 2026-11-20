import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EJERCICIOS, TEXTO_NECESIDAD } from '../../entrenar/ejercicios';
import { Ejercicio } from '../../entrenar/modelo';
import { PLANTILLAS } from '../../entrenar/plantillas';
import { FiguraComponent } from '../figura/figura.component';

type Ficha = Ejercicio & { necesitaTexto?: string };

const DE_CIRCUITO = new Set(
  PLANTILLAS.flatMap((p) => p.bloques).flatMap((b) => (b.tipo === 'circuito' ? b.ejercicios.map((e) => e.id) : []))
);

const ficha = (e: Ejercicio): Ficha => ({ ...e, necesitaTexto: e.necesita && TEXTO_NECESIDAD[e.necesita] });

// Para leer antes de la primera sesión: cómo es una sesión y cómo se hace cada ejercicio.
@Component({
  selector: 'app-entrenar-ejercicios',
  imports: [FiguraComponent, RouterLink],
  templateUrl: './entrenar-ejercicios.component.html',
  styleUrl: './entrenar-ejercicios.component.scss',
})
export class EntrenarEjerciciosComponent {
  readonly ritmos = [
    { figura: 'caminar', nombre: 'Caminá cómodo', como: 'Podés charlar sin problema.' },
    { figura: 'caminar-rapido', nombre: 'Caminá rápido', como: 'Hablás, pero en frases cortas.' },
    { figura: 'trotar', nombre: 'Trotá', como: 'Un trote suave: si no podés decir una frase, bajá.' },
  ];
  readonly fuerza = EJERCICIOS.filter((e) => DE_CIRCUITO.has(e.id)).map(ficha);
  readonly movilidad = EJERCICIOS.filter((e) => !DE_CIRCUITO.has(e.id)).map(ficha);
}
