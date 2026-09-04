import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Icon, Tag } from 'componentes';

import { DialogService } from '../../services/dialog.service';
import {
  MealService,
  multiplyQuantity,
  recetaComoMarkdown,
} from '../../services/meal.service';

const PORCIONES = [1, 2, 3] as const;

@Component({
  selector: 'app-receta-view',
  standalone: true,
  imports: [RouterModule, Icon, Tag],
  templateUrl: './receta-view.component.html',
  styleUrls: ['./receta-view.component.scss'],
})
export class RecetaViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mealService = inject(MealService);
  private readonly dialogService = inject(DialogService);

  readonly mealId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly opcionesPorciones = PORCIONES;

  // Se lee del signal de comidas y no de una copia, así la ficha se actualiza
  // sola cuando la sincronización con Firestore trae cambios.
  readonly meal = computed(() =>
    this.mealService.meals().find((m) => m.id === this.mealId)
  );

  // El multiplicador es sólo de la vista: las cantidades se guardan por porción
  // y se multiplican al mostrar, igual que hace la lista de compras.
  readonly porciones = signal(1);

  readonly ingredientes = computed(() =>
    (this.meal()?.ingredients ?? []).map((ing) => ({
      ...ing,
      quantity: multiplyQuantity(ing.quantity, this.porciones()),
    }))
  );

  readonly pasos = computed(() => this.meal()?.pasos ?? []);

  readonly cocinando = signal(false);
  readonly pasoActual = signal(0);

  readonly pasoEnCurso = computed(() => this.pasos()[this.pasoActual()]);
  readonly esUltimoPaso = computed(
    () => this.pasoActual() >= this.pasos().length - 1
  );

  editar(): void {
    this.router.navigate(['/meals/edit', this.mealId]);
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
    const comida = this.meal();
    if (!comida) {
      return;
    }
    try {
      await navigator.clipboard.writeText(recetaComoMarkdown(comida));
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
