import { Injectable, signal, computed, effect } from '@angular/core';
import { Meal, DaySchedule, Ingredient, MealType } from '../models/meal.model';

@Injectable({
  providedIn: 'root'
})
export class MealService {
  private readonly MEALS_KEY = 'comidas_meals';
  private readonly SCHEDULES_KEY = 'comidas_schedules'; // Changed key for dictionary

  // State
  meals = signal<Meal[]>(this.loadMeals());
  // Map of weekStart (YYYY-MM-DD) -> DaySchedule[]
  private schedules = signal<Record<string, DaySchedule[]>>(this.loadSchedules());
  
  // Navigation State
  currentWeekStart = signal<Date>(this.getStartOfWeek(new Date()));

  constructor() {
    // Persist changes
    effect(() => {
      localStorage.setItem(this.MEALS_KEY, JSON.stringify(this.meals()));
    });
    effect(() => {
      localStorage.setItem(this.SCHEDULES_KEY, JSON.stringify(this.schedules()));
    });
  }

  // Helper: Get Monday of the week for a given date
  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Helper: Format Date key
  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Loaders
  private loadMeals(): Meal[] {
    const data = localStorage.getItem(this.MEALS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private loadSchedules(): Record<string, DaySchedule[]> {
    const data = localStorage.getItem(this.SCHEDULES_KEY);
    if (data) {
      return JSON.parse(data);
    }
    
    // Migration: Check for old 'comidas_schedule'
    const oldData = localStorage.getItem('comidas_schedule');
    if (oldData) {
      const schedule = JSON.parse(oldData);
      const key = this.formatDateKey(this.getStartOfWeek(new Date()));
      return { [key]: schedule };
    }

    return {};
  }

  private createEmptySchedule(): DaySchedule[] {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days.map(day => ({
      dayName: day,
      almuerzo: null,
      desayuno: null
    }));
  }

  // Computed: Active Schedule for currentWeekStart
  schedule = computed(() => {
    const key = this.formatDateKey(this.currentWeekStart());
    return this.schedules()[key] || this.createEmptySchedule();
  });

  // Computed: Date Range String
  weekRangeDisplay = computed(() => {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}`;
  });

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
    // Clean up all schedules? Maybe too aggressive, but consistent.
    // For now, let's leave history intact or just clean current? 
    // Let's clean all occurrences in all schedules to avoid broken links.
    this.schedules.update(schedules => {
      const newSchedules: Record<string, DaySchedule[]> = {};
      for (const [key, week] of Object.entries(schedules)) {
        newSchedules[key] = week.map(day => ({
          ...day,
          almuerzo: day.almuerzo === id ? null : day.almuerzo,
          desayuno: day.desayuno === id ? null : day.desayuno
        }));
      }
      return newSchedules;
    });
  }

  getMeal(id: string | null): Meal | undefined {
    if (!id) return undefined;
    return this.meals().find(m => m.id === id);
  }

  // Schedule Actions
  updateSchedule(dayName: string, type: MealType, mealId: string | null) {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule(); // Get current or empty
    
    const updatedWeek = currentWeekSchedule.map(day =>
      day.dayName === dayName ? { ...day, [type]: mealId } : day
    );

    this.schedules.update(s => ({
      ...s,
      [key]: updatedWeek
    }));
  }
  
  clearSchedule() {
    const key = this.formatDateKey(this.currentWeekStart());
    this.schedules.update(s => ({
      ...s,
      [key]: this.createEmptySchedule()
    }));
  }

  // Week Navigation
  nextWeek() {
    const next = new Date(this.currentWeekStart());
    next.setDate(next.getDate() + 7);
    this.currentWeekStart.set(next);
  }

  previousWeek() {
    const prev = new Date(this.currentWeekStart());
    prev.setDate(prev.getDate() - 7);
    this.currentWeekStart.set(prev);
  }

  goToCurrentWeek() {
    this.currentWeekStart.set(this.getStartOfWeek(new Date()));
  }

  // Copy from previous week
  copyFromPreviousWeek() {
    const currentKey = this.formatDateKey(this.currentWeekStart());
    
    const prevDate = new Date(this.currentWeekStart());
    prevDate.setDate(prevDate.getDate() - 7);
    const prevKey = this.formatDateKey(prevDate);
    
    const prevSchedule = this.schedules()[prevKey];
    
    if (prevSchedule) {
      // Create a deep copy to avoid reference issues
      const copy = JSON.parse(JSON.stringify(prevSchedule));
      this.schedules.update(s => ({
        ...s,
        [currentKey]: copy
      }));
    } else {
        alert("No hay datos de la semana anterior para copiar.");
    }
  }

  // Shopping List
  shoppingList = computed(() => {
    const list: Ingredient[] = [];
    const currentSchedule = this.schedule();
    const allMeals = this.meals();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const displayWeekStart = this.currentWeekStart();

    currentSchedule.forEach((day, index) => {
      // Calculate date for this day
      const dayDate = new Date(displayWeekStart);
      dayDate.setDate(displayWeekStart.getDate() + index);

      // Only include if day is today or in the future
      if (dayDate >= today) {
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
      }
    });

    // Aggregate ingredients
    const aggregated: { [key: string]: Ingredient } = {};
    list.forEach(ing => {
      const key = ing.name.toLowerCase().trim();
      if (aggregated[key]) {
        // Only append if quantity string is different or just append?
        // Simple append for now
        aggregated[key].quantity += ` + ${ing.quantity}`;
      } else {
        aggregated[key] = { ...ing };
      }
    });

    return Object.values(aggregated);
  });
}