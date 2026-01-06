import { Injectable, signal, computed, effect } from '@angular/core';
import { Meal, DaySchedule, Ingredient, MealType, ShoppingTag, ShoppingItem, ShoppingListGroup } from '../models/meal.model';

@Injectable({
  providedIn: 'root'
})
export class MealService {
  private readonly MEALS_KEY = 'comidas_meals';
  private readonly SCHEDULES_KEY = 'comidas_schedules';
  private readonly TAGS_KEY = 'comidas_tags';
  private readonly INGREDIENT_TAGS_KEY = 'comidas_ingredient_tags'; // Map name -> tagId
  private readonly EXTRA_ITEMS_KEY = 'comidas_extra_items';

  // State
  meals = signal<Meal[]>(this.loadMeals());
  // Map of weekStart (YYYY-MM-DD) -> DaySchedule[]
  private schedules = signal<Record<string, DaySchedule[]>>(this.loadSchedules());
  
  tags = signal<ShoppingTag[]>(this.loadTags());
  ingredientTags = signal<Record<string, string>>(this.loadIngredientTags());
  extraItems = signal<ShoppingItem[]>(this.loadExtraItems());

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
    effect(() => {
      localStorage.setItem(this.TAGS_KEY, JSON.stringify(this.tags()));
    });
    effect(() => {
      localStorage.setItem(this.INGREDIENT_TAGS_KEY, JSON.stringify(this.ingredientTags()));
    });
    effect(() => {
      localStorage.setItem(this.EXTRA_ITEMS_KEY, JSON.stringify(this.extraItems()));
    });
  }

  // ... (Helper methods remain the same) ...
  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

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
    const oldData = localStorage.getItem('comidas_schedule');
    if (oldData) {
      const schedule = JSON.parse(oldData);
      const key = this.formatDateKey(this.getStartOfWeek(new Date()));
      return { [key]: schedule };
    }
    return {};
  }

  private loadTags(): ShoppingTag[] {
    const data = localStorage.getItem(this.TAGS_KEY);
    if (data) return JSON.parse(data);
    
    return [
      { id: 'verduderia', name: 'Verdulería', color: '#4caf50' },
      { id: 'carniceria', name: 'Carnicería', color: '#f44336' },
      { id: 'supermercado', name: 'Supermercado', color: '#2196f3' }
    ];
  }

  private loadIngredientTags(): Record<string, string> {
    const data = localStorage.getItem(this.INGREDIENT_TAGS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private loadExtraItems(): ShoppingItem[] {
    const data = localStorage.getItem(this.EXTRA_ITEMS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private createEmptySchedule(): DaySchedule[] {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    return days.map(day => ({
      dayName: day,
      almuerzo: null,
      desayuno: null
    }));
  }

  // Computed
  schedule = computed(() => {
    const key = this.formatDateKey(this.currentWeekStart());
    return this.schedules()[key] || this.createEmptySchedule();
  });

  weekRangeDisplay = computed(() => {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}`;
  });

  // Actions
  // ... (Meal actions remain the same) ...
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
    const currentWeekSchedule = this.schedule(); 
    
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

  copyFromPreviousWeek() {
    const currentKey = this.formatDateKey(this.currentWeekStart());
    const prevDate = new Date(this.currentWeekStart());
    prevDate.setDate(prevDate.getDate() - 7);
    const prevKey = this.formatDateKey(prevDate);
    const prevSchedule = this.schedules()[prevKey];
    
    if (prevSchedule) {
      const copy = JSON.parse(JSON.stringify(prevSchedule));
      this.schedules.update(s => ({ ...s, [currentKey]: copy }));
    } else {
        alert("No hay datos de la semana anterior para copiar.");
    }
  }

  // Tag Actions
  addTag(name: string, color: string) {
    const newTag: ShoppingTag = { id: crypto.randomUUID(), name, color };
    this.tags.update(t => [...t, newTag]);
  }

  setIngredientTag(ingredientName: string, tagId: string) {
    const key = ingredientName.toLowerCase().trim();
    this.ingredientTags.update(map => ({ ...map, [key]: tagId }));
  }

  // Extra Items Actions
  addExtraItem(name: string, quantity: string, tagId?: string) {
    const newItem: ShoppingItem = { name, quantity, tagId, isExtra: true };
    this.extraItems.update(items => [...items, newItem]);
    
    // Also remember the tag preference
    if (tagId) {
        this.setIngredientTag(name, tagId);
    }
  }

  removeExtraItem(index: number) {
    this.extraItems.update(items => items.filter((_, i) => i !== index));
  }

  // Grouped Shopping List
  shoppingListGrouped = computed(() => {
    const items: ShoppingItem[] = [];
    const currentSchedule = this.schedule();
    const allMeals = this.meals();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const displayWeekStart = this.currentWeekStart();
    const tagMap = this.ingredientTags();

    // 1. Gather ingredients from schedule
    currentSchedule.forEach((day, index) => {
      const dayDate = new Date(displayWeekStart);
      dayDate.setDate(displayWeekStart.getDate() + index);

      if (dayDate >= today) {
        const processMeal = (mealId: string | null) => {
           if (!mealId) return;
           const meal = allMeals.find(m => m.id === mealId);
           if (meal) {
             meal.ingredients.forEach(ing => {
               const key = ing.name.toLowerCase().trim();
               const tagId = tagMap[key];
               items.push({ ...ing, tagId, isExtra: false });
             });
           }
        };
        processMeal(day.almuerzo);
        processMeal(day.desayuno);
      }
    });

    // 2. Add extra items
    // (We add them directly, aggregation handles duplicates if names match)
    this.extraItems().forEach(extra => {
        const key = extra.name.toLowerCase().trim();
        // Use stored tag if extra item doesn't have one (though it usually should from creation)
        const tagId = extra.tagId || tagMap[key];
        items.push({ ...extra, tagId });
    });

    // 3. Aggregate
    const aggregated: { [key: string]: ShoppingItem } = {};
    items.forEach(item => {
      const key = item.name.toLowerCase().trim();
      if (aggregated[key]) {
        aggregated[key].quantity += ` + ${item.quantity}`;
        // If one instance has a tag, use it (prefer explicit over implicit?)
        if (!aggregated[key].tagId && item.tagId) {
            aggregated[key].tagId = item.tagId;
        }
      } else {
        aggregated[key] = { ...item };
      }
    });

    // 4. Group by Tag
    const groups: ShoppingListGroup[] = [];
    const allTags = this.tags();
    
    // Create groups for all existing tags
    allTags.forEach(tag => {
        groups.push({ tag, items: [] });
    });
    // Add "Uncategorized" group
    const uncategorizedGroup: ShoppingListGroup = { tag: null, items: [] };
    groups.push(uncategorizedGroup);

    Object.values(aggregated).forEach(item => {
        if (item.tagId) {
            const group = groups.find(g => g.tag?.id === item.tagId);
            if (group) {
                group.items.push(item);
            } else {
                uncategorizedGroup.items.push(item);
            }
        } else {
            uncategorizedGroup.items.push(item);
        }
    });

    // Filter out empty groups
    return groups.filter(g => g.items.length > 0);
  });
  
  // Keep the flat list for backward compatibility if needed, but UI will use grouped
  shoppingList = computed(() => {
      // Simplistic return of flattened groups
      return this.shoppingListGrouped().flatMap(g => g.items);
  });
}
