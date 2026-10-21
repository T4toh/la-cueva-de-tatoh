import { Component, computed, inject, signal } from '@angular/core';
import { comidasQueSuman, META_PLANTAS, plantasDeLaSemana } from '../../catalogo/plantas';
import { armarGuia, REGLAS, tipDelPlan } from '../../guia/guia';
import { chequearSemana, MAX_CARNE_ROJA, META_CARNE_BLANCA, MIN_PESCADO } from '../../guia/chequeos';
import { RouterModule } from '@angular/router';
import { MealService } from '../../services/meal.service';
import { DialogService } from '../../services/dialog.service';
import {
  DaySchedule,
  Dish,
  DishMealType,
  TextScheduleField,
} from '../../models/meal.model';
import { Icon, Panel } from 'componentes';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, Panel, FormsModule, Icon],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  mealService = inject(MealService);
  private dialogService = inject(DialogService);

  readonly metaPlantas = META_PLANTAS;
  readonly verPlantas = signal(false);
  readonly plantas = computed(() =>
    plantasDeLaSemana(this.mealService.schedule(), this.mealService.meals(), this.mealService.indiceCatalogo())
  );
  readonly sumanPlantas = computed(() =>
    comidasQueSuman(new Set(this.plantas().plantas), this.mealService.meals(), this.mealService.indiceCatalogo())
  );

  readonly maxRoja = MAX_CARNE_ROJA;
  readonly minPescado = MIN_PESCADO;
  readonly metaBlanca = META_CARNE_BLANCA;
  readonly chequeo = computed(() =>
    chequearSemana(this.mealService.schedule(), this.mealService.meals(), this.mealService.indiceCatalogo())
  );

  // Las reglas que se ven en /guia, en ese orden: propias y base sin las
  // ocultas. Una oculta no se chequea ni sale de tip.
  readonly reglasVisibles = computed(() =>
    armarGuia(REGLAS, this.mealService.guia()).grupos.flatMap((g) => g.reglas)
  );
  // El salto no se guarda: al recargar vuelve el del día, o la regla que la
  // semana no cumple.
  readonly saltoTip = signal(0);
  readonly tip = computed(() =>
    tipDelPlan(this.reglasVisibles(), this.chequeo().incumplidas, new Date(), this.saltoTip())
  );

  chequeoVisible(id: string): boolean {
    return this.reglasVisibles().some((r) => r.id === id);
  }

  dosCarbos(dayName: string): boolean {
    return this.chequeo().diasConDosCarbos.includes(dayName);
  }

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

  isPlaceholder(mealId: string): boolean {
    return this.mealService.getMeal(mealId)?.includeInShoppingList === false;
  }

  isFirstDishPlaceholder(day: DaySchedule, type: DishMealType): boolean {
    const dishes = day[type];
    return dishes.length > 0 && this.isPlaceholder(dishes[0].mealId);
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
    const dayNames = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    const todayName = dayNames[today.getDay()];
    const startOfCurrentWeek = this.getStartOfWeek(new Date());
    const startOfDisplayWeek = this.mealService.currentWeekStart();
    return (
      todayName === dayName &&
      startOfCurrentWeek.getTime() === startOfDisplayWeek.getTime()
    );
  }

  isPast(dayName: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayNames = [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ];
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

  updateDishPortions(
    dayName: string,
    type: DishMealType,
    index: number,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const portions = Math.max(1, Number(input.value));
    this.mealService.updateDishPortions(dayName, type, index, portions);
  }

  toggleDishExclusion(
    dayName: string,
    type: DishMealType,
    index: number
  ): void {
    this.mealService.toggleDishExclusion(dayName, type, index);
  }

  updateDishLabel(
    dayName: string,
    type: DishMealType,
    index: number,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    this.mealService.updateDishLabel(dayName, type, index, input.value);
  }

  dismissMigrationBanner(): void {
    this.mealService.migrationOccurred.set(false);
  }
}
