import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { Meal, MealType, DishMealType } from '../../models/meal.model';
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
  private action: 'add' | 'replace' | null = null;
  private replaceIndex = 0;

  readonly currentMeal = signal<Meal | undefined>(undefined);
  readonly showingList = signal(false);
  readonly selectedTag = signal<string | null>(null);

  readonly uniqueTags = computed(() => {
    const tags = new Set<string>();
    this.mealService.meals().forEach((m) => m.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  });

  readonly filteredMeals = computed(() => {
    const all = this.mealService.meals();
    const tag = this.selectedTag();
    if (!tag) {
      return all;
    }
    return all.filter((m) => m.tags?.includes(tag));
  });

  ngOnInit(): void {
    this.dayName = this.route.snapshot.paramMap.get('day') || '';
    this.type = (this.route.snapshot.paramMap.get('type') as MealType) || 'almuerzo';
    const actionParam = this.route.snapshot.queryParamMap.get('action');
    this.action = actionParam === 'add' || actionParam === 'replace' ? actionParam : null;
    this.replaceIndex = Number(this.route.snapshot.queryParamMap.get('index') ?? 0);

    const dishMealTypes: DishMealType[] = ['almuerzo', 'desayuno', 'cena'];
    const isDishType = dishMealTypes.includes(this.type as DishMealType);

    if (this.action === 'add') {
      this.showingList.set(true);
      return;
    }

    const day = this.mealService.schedule().find((d) => d.dayName === this.dayName);
    if (isDishType && day) {
      const dishes = day[this.type as DishMealType];
      if (this.action === 'replace' && dishes[this.replaceIndex]) {
        const meal = this.mealService.getMeal(dishes[this.replaceIndex].mealId);
        this.currentMeal.set(meal);
        if (!meal) {
          this.showingList.set(true);
        }
      } else if (!this.action) {
        const meal = dishes[0] ? this.mealService.getMeal(dishes[0].mealId) : undefined;
        this.currentMeal.set(meal);
        if (!meal) {
          this.showingList.set(true);
        }
      } else {
        this.showingList.set(true);
      }
    } else {
      this.showingList.set(true);
    }
  }

  showList(): void {
    this.showingList.set(true);
  }

  selectTag(tag: string | null): void {
    this.selectedTag.set(tag);
  }

  selectMeal(mealId: string): void {
    const dishMealTypes: DishMealType[] = ['almuerzo', 'desayuno', 'cena'];
    const isDishType = dishMealTypes.includes(this.type as DishMealType);

    if (!isDishType) {
      this.router.navigate(['/']);
      return;
    }

    const type = this.type as DishMealType;

    if (this.action === 'add' && this.mealService.isFamilyMode()) {
      this.mealService.addDish(this.dayName, type, mealId, 4);
    } else if (this.action === 'replace') {
      this.mealService.replaceDishMeal(this.dayName, type, this.replaceIndex, mealId);
    } else {
      this.mealService.setMeal(this.dayName, type, mealId);
    }
    this.router.navigate(['/']);
  }

  editMeal(id: string): void {
    this.router.navigate(['/meals/edit', id]);
  }

  duplicateMeal(id: string): void {
    this.mealService.duplicateMeal(id);
  }

  clearSelection(): void {
    const dishMealTypes: DishMealType[] = ['almuerzo', 'desayuno', 'cena'];
    const isDishType = dishMealTypes.includes(this.type as DishMealType);
    if (isDishType) {
      if (this.action === 'replace') {
        this.mealService.removeDish(this.dayName, this.type as DishMealType, this.replaceIndex);
      } else {
        this.mealService.clearMeal(this.dayName, this.type as DishMealType);
      }
    }
    this.router.navigate(['/']);
  }
}
