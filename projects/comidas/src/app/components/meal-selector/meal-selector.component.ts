import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { MealType } from '../../models/meal.model';
import { Panel } from 'componentes';

@Component({
  selector: 'app-meal-selector',
  standalone: true,
  imports: [CommonModule, RouterModule, Panel],
  templateUrl: './meal-selector.component.html',
  styleUrls: ['./meal-selector.component.scss']
})
export class MealSelectorComponent implements OnInit {
  mealService = inject(MealService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  dayName: string = '';
  type: MealType = 'almuerzo';

  ngOnInit() {
    this.dayName = this.route.snapshot.paramMap.get('day') || '';
    this.type = (this.route.snapshot.paramMap.get('type') as MealType) || 'almuerzo';
  }

  selectMeal(mealId: string) {
    this.mealService.updateSchedule(this.dayName, this.type, mealId);
    this.router.navigate(['/']);
  }
  
  clearSelection() {
    this.mealService.updateSchedule(this.dayName, this.type, null);
    this.router.navigate(['/']);
  }
}
