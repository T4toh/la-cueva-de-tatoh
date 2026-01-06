import { Component, inject, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { MealType } from '../../models/meal.model';
import { MealCardComponent } from '../meal-card/meal-card.component';

@Component({
  selector: 'app-meal-selector',
  standalone: true,
  imports: [RouterModule, MealCardComponent],
  templateUrl: './meal-selector.component.html',
  styleUrls: ['./meal-selector.component.scss'],
})
export class MealSelectorComponent implements OnInit {
  mealService = inject(MealService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  dayName = '';
  type: MealType = 'almuerzo';

  ngOnInit(): void {
    this.dayName = this.route.snapshot.paramMap.get('day') || '';
    this.type =
      (this.route.snapshot.paramMap.get('type') as MealType) || 'almuerzo';
  }

  selectMeal(mealId: string): void {
    this.mealService.updateSchedule(this.dayName, this.type, mealId);
    this.router.navigate(['/']);
  }

  editMeal(id: string): void {
    this.router.navigate(['/meals/edit', id]);
  }

  duplicateMeal(id: string): void {
    this.mealService.duplicateMeal(id);
  }

  clearSelection(): void {
    this.mealService.updateSchedule(this.dayName, this.type, null);
    this.router.navigate(['/']);
  }
}
