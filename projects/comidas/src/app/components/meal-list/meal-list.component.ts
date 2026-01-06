import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { MealCardComponent } from '../meal-card/meal-card.component';

@Component({
  selector: 'app-meal-list',
  standalone: true,
  imports: [CommonModule, RouterModule, MealCardComponent],
  templateUrl: './meal-list.component.html',
  styleUrls: ['./meal-list.component.scss']
})
export class MealListComponent {
  mealService = inject(MealService);
  router = inject(Router);
  
  deleteMeal(id: string) {
    if (confirm('¿Estás seguro de eliminar esta comida?')) {
      this.mealService.deleteMeal(id);
    }
  }

  editMeal(id: string) {
    this.router.navigate(['/meals/edit', id]);
  }
}
