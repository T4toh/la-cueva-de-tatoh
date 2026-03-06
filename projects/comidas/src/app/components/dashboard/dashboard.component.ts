import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { DialogService } from '../../services/dialog.service';
import { Dish, DaySchedule, DishMealType, TextScheduleField } from '../../models/meal.model';
import { Panel } from 'componentes';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, Panel, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  mealService = inject(MealService);
  private dialogService = inject(DialogService);

  getMealName(id: string): string {
    const meal = this.mealService.getMeal(id);
    return meal ? meal.name : 'Seleccionar';
  }

  getDishes(day: DaySchedule, type: DishMealType): Dish[] {
    return day[type];
  }

  getFirstMealName(day: DaySchedule, type: DishMealType): string {
    const dishes = day[type];
    if (dishes.length === 0) {
      return 'Seleccionar';
    }
    return this.getMealName(dishes[0].mealId);
  }

  isFirstDishPlaceholder(day: DaySchedule, type: DishMealType): boolean {
    const dishes = day[type];
    if (dishes.length === 0) {
      return false;
    }
    const meal = this.mealService.getMeal(dishes[0].mealId);
    return meal ? meal.includeInShoppingList === false : false;
  }

  async clearWeek(): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Limpiar Semana',
      '¿Estás seguro de que quieres borrar toda la planificación de esta semana?'
    );
    if (confirmed) {
      this.mealService.clearSchedule();
    }
  }

  async refreshData(): Promise<void> {
    await this.mealService.refreshData();
  }

  isToday(dayName: string): boolean {
    const today = new Date();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = dayNames[today.getDay()];
    const startOfCurrentWeek = this.getStartOfWeek(new Date());
    const startOfDisplayWeek = this.mealService.currentWeekStart();
    return todayName === dayName && startOfCurrentWeek.getTime() === startOfDisplayWeek.getTime();
  }

  isPast(dayName: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const dayIndex = dayNames.indexOf(dayName);
    const displayWeekStart = new Date(this.mealService.currentWeekStart());
    const dayDate = new Date(displayWeekStart);
    dayDate.setDate(displayWeekStart.getDate() + dayIndex);
    return dayDate < today;
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  printMenu(): void {
    window.print();
  }

  updateField(dayName: string, field: TextScheduleField, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.mealService.updateSchedule(dayName, field, input.value);
  }

  clearMeal(dayName: string, type: DishMealType): void {
    this.mealService.clearMeal(dayName, type);
  }

  removeDish(dayName: string, type: DishMealType, index: number): void {
    this.mealService.removeDish(dayName, type, index);
  }

  updateDishPortions(dayName: string, type: DishMealType, index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const portions = Math.max(1, Number(input.value));
    this.mealService.updateDishPortions(dayName, type, index, portions);
  }

  toggleDishExclusion(dayName: string, type: DishMealType, index: number): void {
    this.mealService.toggleDishExclusion(dayName, type, index);
  }

  dismissMigrationBanner(): void {
    this.mealService.migrationOccurred.set(false);
  }
}
