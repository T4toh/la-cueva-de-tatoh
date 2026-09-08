import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Icon, Tag } from 'componentes';

import { Meal } from '../../models/meal.model';
import { DialogService } from '../../services/dialog.service';
import {
  multiplyQuantity,
  recetaComoMarkdown,
} from '../../services/meal.service';

const PORCIONES = [1, 2, 3] as const;

@Component({
  selector: 'app-receta-detalle',
  standalone: true,
  imports: [Icon, Tag],
  templateUrl: './receta-detalle.component.html',
  styleUrls: ['./receta-detalle.component.scss'],
})
export class RecetaDetalleComponent {
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);

  readonly meal = input.required<Meal>();

  // El multiplicador lo puede fijar la pantalla de arriba: un plato agendado ya
  // sabe para cuántas porciones es, así que ahí volver a preguntarlo sobra.
  // En la ficha suelta no hay quién lo diga, y se eligen ×1 ×2 ×3 a mano.
  readonly porcionesFijas = input<number | null>(null);

  // La página pública la pasa en true: un desconocido sin cuenta no es el
  // dueño de la receta, así que las afordancias de edición no van.
  readonly soloLectura = input(false);

  readonly opcionesPorciones = PORCIONES;
  readonly porcionesElegidas = signal(1);

  readonly porciones = computed(
    () => this.porcionesFijas() ?? this.porcionesElegidas()
  );

  // Las cantidades se guardan por porción y se multiplican al mostrar, igual
  // que hace la lista de compras.
  readonly ingredientes = computed(() =>
    this.meal().ingredients.map((ing) => ({
      ...ing,
      quantity: multiplyQuantity(ing.quantity, this.porciones()),
    }))
  );

  readonly pasos = computed(() => this.meal().pasos ?? []);

  readonly cocinando = signal(false);
  readonly pasoActual = signal(0);

  readonly pasoEnCurso = computed(() => this.pasos()[this.pasoActual()]);
  readonly esUltimoPaso = computed(
    () => this.pasoActual() >= this.pasos().length - 1
  );

  editar(): void {
    this.router.navigate(['/meals/edit', this.meal().id]);
  }

  cocinar(): void {
    this.pasoActual.set(0);
    this.cocinando.set(true);
  }

  salirDeCocina(): void {
    this.cocinando.set(false);
  }

  // El último "hecho" sale del modo cocina en vez de dejarte en una pantalla
  // sin salida obvia con las manos sucias.
  pasoHecho(): void {
    if (this.esUltimoPaso()) {
      this.salirDeCocina();
      return;
    }
    this.pasoActual.update((i) => i + 1);
  }

  pasoAnterior(): void {
    this.pasoActual.update((i) => Math.max(0, i - 1));
  }

  async copiarMarkdown(): Promise<void> {
    try {
      await navigator.clipboard.writeText(recetaComoMarkdown(this.meal()));
    } catch {
      // El portapapeles lo puede negar el navegador (permisos, foco, contexto
      // no seguro). Sin este aviso el botón no hace nada visible y parece roto.
      this.dialogService.alert(
        'No se pudo copiar',
        'El navegador bloqueó el acceso al portapapeles.'
      );
      return;
    }

    this.dialogService.alert(
      'Copiado',
      'La receta quedó en el portapapeles, lista para pegar en un post.'
    );
  }
}
