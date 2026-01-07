import { computed, effect, Injectable, signal } from '@angular/core';
import {
  DaySchedule,
  Meal,
  ShoppingItem,
  ShoppingListGroup,
  ShoppingTag,
} from '../models/meal.model';

@Injectable({
  providedIn: 'root',
})
export class MealService {
  private readonly MEALS_KEY = 'comidas_meals';
  private readonly SCHEDULES_KEY = 'comidas_schedules';
  private readonly TAGS_KEY = 'comidas_tags';
  private readonly INGREDIENT_TAGS_KEY = 'comidas_ingredient_tags';
  private readonly EXTRA_ITEMS_KEY = 'comidas_extra_items';
  private readonly FAMILY_SETTINGS_KEY = 'comidas_family_settings';
  private readonly QUANTITY_OVERRIDES_KEY = 'comidas_quantity_overrides';
  private readonly CHECKED_ITEMS_KEY = 'comidas_checked_items';

  // State
  readonly meals = signal<Meal[]>(this.loadMeals());
  private readonly schedules = signal<Record<string, DaySchedule[]>>(
    this.loadSchedules()
  );

  readonly tags = signal<ShoppingTag[]>(this.loadTags());
  readonly ingredientTags = signal<Record<string, string>>(
    this.loadIngredientTags()
  );
  readonly extraItems = signal<ShoppingItem[]>(this.loadExtraItems());

  // Map of "weekKey_ingredientName" -> newQuantity
  readonly quantityOverrides = signal<Record<string, string>>(
    this.loadOverrides()
  );

  // Map of "weekKey" -> string[] (list of checked ingredient names)
  readonly checkedItems = signal<Record<string, string[]>>(
    this.loadCheckedItems()
  );

  // Family Mode State
  readonly isFamilyMode = signal<boolean>(false);
  readonly visibleMeals = signal<{
    breakfast: boolean;
    lunch: boolean;
    snack: boolean;
    dinner: boolean;
  }>({
    breakfast: true,
    lunch: true,
    snack: false,
    dinner: true,
  });
  readonly familyPortions = signal<number>(4);

  // Navigation State
  readonly currentWeekStart = signal<Date>(this.getStartOfWeek(new Date()));

  constructor() {
    this.loadFamilySettings();

    // Persist changes
    effect(() => {
      localStorage.setItem(this.MEALS_KEY, JSON.stringify(this.meals()));
    });
    effect(() => {
      localStorage.setItem(
        this.SCHEDULES_KEY,
        JSON.stringify(this.schedules())
      );
    });
    effect(() => {
      localStorage.setItem(this.TAGS_KEY, JSON.stringify(this.tags()));
    });
    effect(() => {
      localStorage.setItem(
        this.INGREDIENT_TAGS_KEY,
        JSON.stringify(this.ingredientTags())
      );
    });
    effect(() => {
      localStorage.setItem(
        this.EXTRA_ITEMS_KEY,
        JSON.stringify(this.extraItems())
      );
    });
    effect(() => {
      localStorage.setItem(
        this.QUANTITY_OVERRIDES_KEY,
        JSON.stringify(this.quantityOverrides())
      );
    });
    effect(() => {
      localStorage.setItem(
        this.CHECKED_ITEMS_KEY,
        JSON.stringify(this.checkedItems())
      );
    });
    effect(() => {
      const settings = {
        isFamilyMode: this.isFamilyMode(),
        visibleMeals: this.visibleMeals(),
        familyPortions: this.familyPortions(),
      };
      localStorage.setItem(this.FAMILY_SETTINGS_KEY, JSON.stringify(settings));
    });
  }

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
    return data ? JSON.parse(data) : {};
  }

  private loadTags(): ShoppingTag[] {
    const data = localStorage.getItem(this.TAGS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [
      { id: 'verduderia', name: 'Verdulería', color: '#4caf50' },
      { id: 'carniceria', name: 'Carnicería', color: '#f44336' },
      { id: 'supermercado', name: 'Supermercado', color: '#2196f3' },
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

  private loadOverrides(): Record<string, string> {
    const data = localStorage.getItem(this.QUANTITY_OVERRIDES_KEY);
    return data ? JSON.parse(data) : {};
  }

  private loadCheckedItems(): Record<string, string[]> {
    const data = localStorage.getItem(this.CHECKED_ITEMS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private loadFamilySettings(): void {
    const data = localStorage.getItem(this.FAMILY_SETTINGS_KEY);
    if (data) {
      const settings = JSON.parse(data);
      this.isFamilyMode.set(settings.isFamilyMode ?? false);

      if (settings.visibleMeals) {
        this.visibleMeals.set(settings.visibleMeals);
      } else {
        // Migration: defaults based on old setting
        this.visibleMeals.set({
          breakfast: settings.isBreakfastEnabled ?? false,
          lunch: true,
          snack: false,
          dinner: true,
        });
      }

      this.familyPortions.set(settings.familyPortions || 4);
    }
  }

  private createEmptySchedule(): DaySchedule[] {
    const days = [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ];
    return days.map((day) => ({
      dayName: day,
      desayuno: null,
      almuerzo: null,
      postreAlmuerzo: null,
      colacion: null,
      cena: null,
      postreCena: null,
    }));
  }

  // Computed
  readonly schedule = computed(() => {
    const key = this.formatDateKey(this.currentWeekStart());
    return this.schedules()[key] || this.createEmptySchedule();
  });

  readonly weekRangeDisplay = computed(() => {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
    };
    return `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}`;
  });

  // Actions
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  addMeal(meal: Omit<Meal, 'id'>): void {
    const newMeal: Meal = { ...meal, id: this.generateId() };
    this.meals.update((current) => [...current, newMeal]);
  }

  updateMeal(id: string, updatedMeal: Partial<Meal>): void {
    this.meals.update((current) =>
      current.map((m) => (m.id === id ? { ...m, ...updatedMeal } : m))
    );
  }

  deleteMeal(id: string): void {
    this.meals.update((current) => current.filter((m) => m.id !== id));
    this.schedules.update((schedules) => {
      const newSchedules: Record<string, DaySchedule[]> = {};
      for (const [key, week] of Object.entries(schedules)) {
        newSchedules[key] = week.map((day) => ({
          ...day,
          almuerzo: day.almuerzo === id ? null : day.almuerzo,
          desayuno: day.desayuno === id ? null : day.desayuno,
          cena: day.cena === id ? null : day.cena,
        }));
      }
      return newSchedules;
    });
  }

  duplicateMeal(id: string): void {
    const original = this.getMeal(id);
    if (original) {
      const copy: Omit<Meal, 'id'> = {
        name: `${original.name} (Copia)`,
        description: original.description,
        ingredients: original.ingredients.map((i) => ({ ...i })),
        tags: original.tags ? [...original.tags] : [],
      };
      this.addMeal(copy);
    }
  }

  getMeal(id: string | null): Meal | undefined {
    if (!id) {
      return undefined;
    }
    return this.meals().find((m) => m.id === id);
  }

  updateSchedule(
    dayName: string,
    type: keyof DaySchedule,
    value: string | null
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) =>
      day.dayName === dayName ? { ...day, [type]: value } : day
    );
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  clearSchedule(): void {
    const key = this.formatDateKey(this.currentWeekStart());
    this.schedules.update((s) => ({ ...s, [key]: this.createEmptySchedule() }));
  }

  nextWeek(): void {
    const next = new Date(this.currentWeekStart());
    next.setDate(next.getDate() + 7);
    this.currentWeekStart.set(next);
  }

  previousWeek(): void {
    const prev = new Date(this.currentWeekStart());
    prev.setDate(prev.getDate() - 7);
    this.currentWeekStart.set(prev);
  }

  goToCurrentWeek(): void {
    this.currentWeekStart.set(this.getStartOfWeek(new Date()));
  }

  copyFromPreviousWeek(): void {
    const currentKey = this.formatDateKey(this.currentWeekStart());
    const prevDate = new Date(this.currentWeekStart());
    prevDate.setDate(prevDate.getDate() - 7);
    const prevKey = this.formatDateKey(prevDate);
    const prevSchedule = this.schedules()[prevKey];
    if (prevSchedule) {
      const copy = JSON.parse(JSON.stringify(prevSchedule));
      this.schedules.update((s) => ({ ...s, [currentKey]: copy }));
    } else {
      alert('No hay datos de la semana anterior para copiar.');
    }
  }

  addTag(name: string, color: string): void {
    const newTag: ShoppingTag = { id: this.generateId(), name, color };
    this.tags.update((t) => [...t, newTag]);
  }

  setIngredientTag(ingredientName: string, tagId: string): void {
    const key = ingredientName.toLowerCase().trim();
    this.ingredientTags.update((map) => ({ ...map, [key]: tagId }));
  }

  addExtraItem(name: string, quantity: string, tagId?: string): void {
    const newItem: ShoppingItem = { name, quantity, tagId, isExtra: true };
    this.extraItems.update((items) => [...items, newItem]);
    if (tagId) {
      this.setIngredientTag(name, tagId);
    }
  }

  removeExtraItem(index: number): void {
    this.extraItems.update((items) => items.filter((_, i) => i !== index));
  }

  overrideQuantity(ingredientName: string, newQuantity: string): void {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    const key = `${weekKey}_${ingredientName.toLowerCase().trim()}`;
    this.quantityOverrides.update((o) => ({ ...o, [key]: newQuantity }));
  }

  clearOverrides(): void {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    this.quantityOverrides.update((o) => {
      const newOverrides = { ...o };
      Object.keys(newOverrides).forEach((key) => {
        if (key.startsWith(weekKey)) {
          delete newOverrides[key];
        }
      });
      return newOverrides;
    });
  }

  toggleItemCheck(name: string): void {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    const itemName = name.toLowerCase().trim();

    this.checkedItems.update((prev) => {
      const currentChecked = prev[weekKey] || [];
      const isChecked = currentChecked.includes(itemName);

      return {
        ...prev,
        [weekKey]: isChecked
          ? currentChecked.filter((n) => n !== itemName)
          : [...currentChecked, itemName],
      };
    });
  }

  private multiplyQuantity(quantity: string, factor: number): string {
    if (factor <= 1) {
      return quantity;
    }
    const match = quantity.trim().match(/^(\d+(\.\d+)?)\s*(.*)$/);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[3];
      const newValue = value * factor;
      return unit ? `${newValue} ${unit}` : `${newValue}`;
    }
    return `${quantity} (x${factor})`;
  }

  readonly shoppingListGrouped = computed(() => {
    const items: ShoppingItem[] = [];
    const currentSchedule = this.schedule();
    const allMeals = this.meals();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = this.currentWeekStart();
    const weekKey = this.formatDateKey(weekStart);
    const tagMap = this.ingredientTags();
    const overrides = this.quantityOverrides();
    const weekChecked = this.checkedItems()[weekKey] || [];
    const multiplier = this.isFamilyMode() ? this.familyPortions() : 1;

    currentSchedule.forEach((day, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);

      if (dayDate >= today) {
        const processMeal = (mealId: string | null): void => {
          if (!mealId) {
            return;
          }
          const meal = allMeals.find((m) => m.id === mealId);
          if (meal) {
            meal.ingredients.forEach((ing) => {
              const key = ing.name.toLowerCase().trim();
              const quantity = this.multiplyQuantity(ing.quantity, multiplier);
              items.push({
                ...ing,
                quantity,
                tagId: tagMap[key],
                isExtra: false,
                checked: weekChecked.includes(key),
              });
            });
          }
        };
        processMeal(day.almuerzo);
        processMeal(day.desayuno);
        processMeal(day.cena);
      }
    });

    this.extraItems().forEach((extra) => {
      const key = extra.name.toLowerCase().trim();
      items.push({
        ...extra,
        tagId: extra.tagId || tagMap[key],
        checked: weekChecked.includes(key),
      });
    });

    const aggregated: { [key: string]: ShoppingItem } = {};
    items.forEach((item) => {
      const key = item.name.toLowerCase().trim();
      if (aggregated[key]) {
        aggregated[key].quantity += ` + ${item.quantity}`;
        if (!aggregated[key].tagId && item.tagId) {
          aggregated[key].tagId = item.tagId;
        }
      } else {
        aggregated[key] = { ...item };
      }
    });

    const groups: ShoppingListGroup[] = this.tags().map((tag) => ({
      tag,
      items: [],
    }));
    const uncategorizedGroup: ShoppingListGroup = { tag: null, items: [] };
    groups.push(uncategorizedGroup);

    Object.values(aggregated).forEach((item) => {
      const overrideKey = `${weekKey}_${item.name.toLowerCase().trim()}`;
      if (overrides[overrideKey]) {
        item.quantityOverride = overrides[overrideKey];
      }

      const group = item.tagId
        ? groups.find((g) => g.tag?.id === item.tagId)
        : null;
      (group || uncategorizedGroup).items.push(item);
    });

    return groups.filter((g) => g.items.length > 0);
  });

  readonly shoppingList = computed(() =>
    this.shoppingListGrouped().flatMap((g) => g.items)
  );

  toggleFamilyMode(): void {
    this.isFamilyMode.update((v) => !v);
  }
  toggleMealVisibility(meal: 'breakfast' | 'lunch' | 'snack' | 'dinner'): void {
    this.visibleMeals.update((current) => ({
      ...current,
      [meal]: !current[meal],
    }));
  }
  setFamilyPortions(portions: number): void {
    this.familyPortions.set(portions);
  }

  exportData(): void {
    const data = {
      meals: this.meals(),
      schedules: this.schedules(),
      tags: this.tags(),
      ingredientTags: this.ingredientTags(),
      extraItems: this.extraItems(),
      overrides: this.quantityOverrides(),
      familySettings: {
        isFamilyMode: this.isFamilyMode(),
        visibleMeals: this.visibleMeals(),
        familyPortions: this.familyPortions(),
      },
      version: '1.2',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comidas-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  importData(jsonContent: string): void {
    try {
      const data = JSON.parse(jsonContent);
      if (data.meals) {
        this.meals.set(data.meals);
      }
      if (data.schedules) {
        this.schedules.set(data.schedules);
      }
      if (data.tags) {
        this.tags.set(data.tags);
      }
      if (data.ingredientTags) {
        this.ingredientTags.set(data.ingredientTags);
      }
      if (data.extraItems) {
        this.extraItems.set(data.extraItems);
      }
      if (data.overrides) {
        this.quantityOverrides.set(data.overrides);
      }
      if (data.familySettings) {
        this.isFamilyMode.set(data.familySettings.isFamilyMode);
        if (data.familySettings.visibleMeals) {
            this.visibleMeals.set(data.familySettings.visibleMeals);
        } else {
             this.visibleMeals.set({
                breakfast: data.familySettings.isBreakfastEnabled ?? false,
                lunch: true,
                snack: false,
                dinner: true
            });
        }
        this.familyPortions.set(data.familySettings.familyPortions);
      }
      alert('¡Datos importados con éxito!');
    } catch (error) {
      console.error('Error al importar:', error);
      alert('Error: El archivo no tiene un formato válido.');
    }
  }
}
