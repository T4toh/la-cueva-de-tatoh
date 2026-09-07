import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Icon } from 'componentes';

import { DialogService } from '../../services/dialog.service';
import { MealService } from '../../services/meal.service';
import { rutaPublica } from '../../services/receta-publica';
import { RecetaDetalleComponent } from '../receta-detalle/receta-detalle.component';

@Component({
  selector: 'app-receta-view',
  standalone: true,
  imports: [RouterModule, Icon, RecetaDetalleComponent],
  templateUrl: './receta-view.component.html',
  styleUrls: ['./receta-view.component.scss'],
})
export class RecetaViewComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly mealService = inject(MealService);
  private readonly dialogService = inject(DialogService);

  readonly mealId = this.route.snapshot.paramMap.get('id') ?? '';

  // Se lee del signal de comidas y no de una copia, así la ficha se actualiza
  // sola cuando la sincronización con Firestore trae cambios.
  readonly meal = computed(() =>
    this.mealService.meals().find((m) => m.id === this.mealId)
  );

  readonly publicando = signal(false);
  readonly copiado = signal(false);

  readonly linkPublico = computed(() => {
    const publicId = this.meal()?.publicId;
    if (!publicId) {
      return '';
    }
    return `${location.origin}${rutaPublica(
      this.meal()?.name ?? '',
      this.mealService.alias() || undefined,
      publicId
    )}`;
  });

  async publicar(): Promise<void> {
    if (this.publicando()) {
      return;
    }
    this.publicando.set(true);
    try {
      await this.mealService.compartirMeal(this.mealId);
    } catch (e) {
      console.error('Error publicando la receta:', e);
      this.dialogService.alert(
        'No se pudo compartir',
        'Probá de nuevo en un momento.'
      );
    } finally {
      this.publicando.set(false);
    }
  }

  async despublicar(): Promise<void> {
    try {
      await this.mealService.dejarDeCompartirMeal(this.mealId);
    } catch (e) {
      console.error('Error dejando de compartir la receta:', e);
      this.dialogService.alert(
        'No se pudo dejar de compartir',
        'Probá de nuevo en un momento.'
      );
    }
  }

  async copiar(): Promise<void> {
    await navigator.clipboard.writeText(this.linkPublico());
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 2000);
  }
}
