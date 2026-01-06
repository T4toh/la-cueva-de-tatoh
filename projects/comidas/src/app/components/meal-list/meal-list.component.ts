import { Component, inject } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { MealCardComponent } from '../meal-card/meal-card.component';

@Component({
  selector: 'app-meal-list',
  standalone: true,
  imports: [RouterModule, MealCardComponent],
  templateUrl: './meal-list.component.html',
  styleUrls: ['./meal-list.component.scss'],
})
export class MealListComponent {
  mealService = inject(MealService);
  router = inject(Router);

  deleteMeal(id: string): void {
    if (confirm('¿Estás seguro de eliminar esta comida?')) {
      this.mealService.deleteMeal(id);
    }
  }

  editMeal(id: string): void {
    this.router.navigate(['/meals/edit', id]);
  }

  duplicateMeal(id: string): void {
    this.mealService.duplicateMeal(id);
  }

  printRecipes(): void {
    window.print();
  }
}
