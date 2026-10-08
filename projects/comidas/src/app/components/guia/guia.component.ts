import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { Icon } from 'componentes';
import { armarGuia, GuiaArmada, REGLAS } from '../../guia/guia';
import { MealService } from '../../services/meal.service';

@Component({
  selector: 'app-guia',
  standalone: true,
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './guia.component.html',
  styleUrls: ['./guia.component.scss'],
})
export class GuiaComponent {
  readonly mealService = inject(MealService);

  readonly guia = computed<GuiaArmada>(() => armarGuia(REGLAS, this.mealService.guia()));
  readonly verOcultas = signal(false);
  readonly texto = new FormControl('', { nonNullable: true });
  readonly detalle = new FormControl('', { nonNullable: true });

  agregar(event?: Event): void {
    event?.preventDefault();
    if (this.mealService.agregarReglaPropia(this.texto.value, this.detalle.value)) {
      this.texto.setValue('');
      this.detalle.setValue('');
    }
  }
}
