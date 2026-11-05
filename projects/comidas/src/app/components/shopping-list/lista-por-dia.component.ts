import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ShoppingItem } from '../../models/meal.model';
import { DiaLista } from '../../compras/partes';

// La vista por día: cada día con sus platos e ingredientes. Sólo lectura salvo el tilde.
@Component({
  selector: 'app-lista-por-dia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lista-por-dia.component.html',
  styleUrl: './lista-por-dia.component.scss',
})
export class ListaPorDia {
  readonly dias = input.required<DiaLista[]>();
  readonly cantidad = input.required<(item: ShoppingItem) => string>();
  // fecha null es la parte manual ("Sin día").
  readonly marcar = output<{ nombre: string; fecha: string | null }>();
}
