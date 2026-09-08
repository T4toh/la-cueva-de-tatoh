import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Icon } from 'componentes';

import { CompartirService } from '../../services/compartir.service';
import { MealService } from '../../services/meal.service';
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
  private readonly mealService = inject(MealService);
  private readonly compartirService = inject(CompartirService);

  readonly mealId = this.route.snapshot.paramMap.get('id') ?? '';

  // Se lee del signal de comidas y no de una copia, así la ficha se actualiza
  // sola cuando la sincronización con Firestore trae cambios.
  readonly meal = computed(() =>
    this.mealService.meals().find((m) => m.id === this.mealId)
  );

  readonly publicando = signal(false);
  readonly copiado = signal(false);

  async publicar(): Promise<void> {
    if (this.publicando()) {
      return;
    }
    this.publicando.set(true);
    try {
      await this.compartirService.compartir(this.mealId);
    } finally {
      this.publicando.set(false);
    }
  }

  async despublicar(): Promise<void> {
    await this.compartirService.dejarDeCompartir(this.mealId);
  }

  async copiar(): Promise<void> {
    const link = this.compartirService.link(this.mealId);
    const copio = await this.compartirService.copiar(link);
    if (copio) {
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    }
  }
}
