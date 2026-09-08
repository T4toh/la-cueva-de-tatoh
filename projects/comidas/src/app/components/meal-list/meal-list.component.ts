import { Component, inject } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { CompartirService } from '../../services/compartir.service';
import { MealService } from '../../services/meal.service';
import { MealCardComponent } from '../meal-card/meal-card.component';
import { DialogService } from '../../services/dialog.service';

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
  dialogService = inject(DialogService);
  compartirService = inject(CompartirService);

  async deleteMeal(id: string): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Eliminar Comida',
      '¿Estás seguro de eliminar esta comida?'
    );
    if (confirmed) {
      await this.mealService.deleteMeal(id);
    }
  }

  verReceta(id: string): void {
    this.router.navigate(['/meals', id]);
  }

  editMeal(id: string): void {
    this.router.navigate(['/meals/edit', id]);
  }

  duplicateMeal(id: string): void {
    this.mealService.duplicateMeal(id);
  }

  compartirMeal(id: string): void {
    void this.compartirService.compartir(id);
  }

  printRecipes(): void {
    window.print();
  }
}
