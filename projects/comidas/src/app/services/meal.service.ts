import { Injectable, signal, computed, effect } from '@angular/core';
import { Meal, DaySchedule, Ingredient, MealType } from '../models/meal.model';

@Injectable({
  providedIn: 'root'
})
export class MealService {
  private readonly MEALS_KEY = 'comidas_meals';
  private readonly SCHEDULE_KEY = 'comidas_schedule';

  // State
  meals = signal<Meal[]>(this.loadMeals());
  schedule = signal<DaySchedule[]>(this.loadSchedule());

  constructor() {
    // Persist changes
    effect(() => {
      localStorage.setItem(this.MEALS_KEY, JSON.stringify(this.meals()));
    });
    effect(() => {
      localStorage.setItem(this.SCHEDULE_KEY, JSON.stringify(this.schedule()));
    });
  }

  // Loaders
  private loadMeals(): Meal[] {
    const data = localStorage.getItem(this.MEALS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private loadSchedule(): DaySchedule[] {
    const data = localStorage.getItem(this.SCHEDULE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    // Default schedule: Lunes to Domingo
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days.map(day => ({
      dayName: day,
      almuerzo: null,
      desayuno: null
    }));
  }

  // Meal Actions
  addMeal(meal: Omit<Meal, 'id'>) {
    const newMeal: Meal = { ...meal, id: crypto.randomUUID() };
    this.meals.update(current => [...current, newMeal]);
  }

  updateMeal(id: string, updatedMeal: Partial<Meal>) {
    this.meals.update(current =>
      current.map(m => m.id === id ? { ...m, ...updatedMeal } : m)
    );
  }

  deleteMeal(id: string) {
    this.meals.update(current => current.filter(m => m.id !== id));
    // Also remove from schedule
    this.schedule.update(current => current.map(day => ({
      ...day,
      almuerzo: day.almuerzo === id ? null : day.almuerzo,
      desayuno: day.desayuno === id ? null : day.desayuno
    })));
  }

  getMeal(id: string | null): Meal | undefined {
    if (!id) return undefined;
    return this.meals().find(m => m.id === id);
  }

  // Schedule Actions
  updateSchedule(dayName: string, type: MealType, mealId: string | null) {
    this.schedule.update(current =>
      current.map(day =>
        day.dayName === dayName ? { ...day, [type]: mealId } : day
      )
    );
  }
  
  clearSchedule() {
    this.schedule.update(current => current.map(day => ({
        ...day,
        almuerzo: null,
        desayuno: null
    })));
  }

  // Shopping List
  shoppingList = computed(() => {
    const list: Ingredient[] = [];
    const currentSchedule = this.schedule();
    const allMeals = this.meals();

    currentSchedule.forEach(day => {
      if (day.almuerzo) {
        const meal = allMeals.find(m => m.id === day.almuerzo);
        if (meal) {
          list.push(...meal.ingredients);
        }
      }
      if (day.desayuno) {
        const meal = allMeals.find(m => m.id === day.desayuno);
        if (meal) {
          list.push(...meal.ingredients);
        }
      }
    });

    // Aggregate ingredients (simple aggregation by name)
    const aggregated: { [key: string]: Ingredient } = {};
    list.forEach(ing => {
      const key = ing.name.toLowerCase().trim();
      if (aggregated[key]) {
        aggregated[key].quantity += ` + ${ing.quantity}`;
      } else {
        aggregated[key] = { ...ing };
      }
    });

    return Object.values(aggregated);
  });
}
