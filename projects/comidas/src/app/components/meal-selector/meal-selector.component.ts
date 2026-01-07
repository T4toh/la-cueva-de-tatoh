import { Component, computed, inject, OnInit, signal } from '@angular/core';

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
  
  readonly selectedTag = signal<string | null>(null);

  readonly uniqueTags = computed(() => {
    const tags = new Set<string>();
    this.mealService.meals().forEach(m => m.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  });

  readonly filteredMeals = computed(() => {
    const all = this.mealService.meals();
    const tag = this.selectedTag();
    if (!tag) { return all; }
    return all.filter(m => m.tags?.includes(tag));
  });

  ngOnInit(): void {
    this.dayName = this.route.snapshot.paramMap.get('day') || '';
    this.type =
      (this.route.snapshot.paramMap.get('type') as MealType) || 'almuerzo';
  }

  selectTag(tag: string | null): void {
    this.selectedTag.set(tag);
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
