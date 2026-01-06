import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { Panel } from 'componentes';

@Component({
  selector: 'app-meal-list',
  standalone: true,
  imports: [CommonModule, RouterModule, Panel],
  templateUrl: './meal-list.component.html',
  styleUrls: ['./meal-list.component.scss']
})
export class MealListComponent {
  mealService = inject(MealService);
  
  deleteMeal(id: string, event: Event) {
    event.stopPropagation();
    if (confirm('¿Estás seguro de eliminar esta comida?')) {
      this.mealService.deleteMeal(id);
    }
  }
}
