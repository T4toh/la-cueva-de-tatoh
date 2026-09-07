import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Icon } from 'componentes';

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

  readonly mealId = this.route.snapshot.paramMap.get('id') ?? '';

  // Se lee del signal de comidas y no de una copia, así la ficha se actualiza
  // sola cuando la sincronización con Firestore trae cambios.
  readonly meal = computed(() =>
    this.mealService.meals().find((m) => m.id === this.mealId)
  );
}
