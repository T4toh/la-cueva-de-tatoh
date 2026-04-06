import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { doc, Firestore, getDoc, setDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { DialogService } from './dialog.service';
import {
  DaySchedule,
  Dish,
  DishMealType,
  Meal,
  PantryGroup,
  PantryItem,
  ShoppingItem,
  ShoppingListGroup,
  ShoppingTag,
  TextScheduleField,
} from '../models/meal.model';

@Injectable({
  providedIn: 'root',
})
export class MealService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private dialogService = inject(DialogService);

  private readonly MEALS_KEY = 'comidas_meals';
  private readonly SCHEDULES_KEY = 'comidas_schedules';
  private readonly TAGS_KEY = 'comidas_tags';
  private readonly INGREDIENT_TAGS_KEY = 'comidas_ingredient_tags';
  private readonly EXTRA_ITEMS_KEY = 'comidas_extra_items';
  private readonly EXTRA_ITEMS_HISTORY_KEY = 'comidas_extra_items_history';
  private readonly FAMILY_SETTINGS_KEY = 'comidas_family_settings';
  private readonly QUANTITY_OVERRIDES_KEY = 'comidas_quantity_overrides';
  private readonly CHECKED_ITEMS_KEY = 'comidas_checked_items';
  private readonly LAST_UPDATED_KEY = 'comidas_last_updated';
  private readonly PANTRY_KEY = 'comidas_pantry';
  private readonly PANTRY_GROUPS_KEY = 'comidas_pantry_groups';
  private readonly MIGRATION_NUMERIC_QTY_KEY = 'comidas_migration_numeric_qty';
  private readonly MIGRATION_DISH_FORMAT_KEY = 'comidas_migration_dish_format';
  private readonly MIGRATION_SPLIT_UNIT_KEY = 'comidas_migration_split_unit';
  private scheduleMigrationOccurred = false;
  readonly migrationOccurred = signal<boolean>(false);

  // State
  readonly meals = signal<Meal[]>(this.loadMeals());
  private readonly schedules = signal<Record<string, DaySchedule[]>>(
    this.loadSchedules()
  );

  readonly tags = signal<ShoppingTag[]>(this.loadTags());
  readonly ingredientTags = signal<Record<string, string>>(
    this.loadIngredientTags()
  );
  readonly extraItems = signal<Record<string, ShoppingItem[]>>(
    this.loadExtraItems()
  );
  readonly extraItemsHistory = signal<ShoppingItem[]>(
    this.loadExtraItemsHistory()
  );

  readonly currentExtraItems = computed(() => {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    return this.extraItems()[weekKey] || [];
  });

  readonly allIngredientNames = computed(() => {
    const names = new Set<string>();
    this.meals().forEach((meal) => {
      meal.ingredients.forEach((ing) => {
        const normalized = ing.name.trim().toLowerCase();
        if (normalized) {
          names.add(normalized);
        }
      });
    });
    return Array.from(names).sort();
  });

  // Map of "weekKey_ingredientName" -> newQuantity
  readonly quantityOverrides = signal<Record<string, string>>(
    this.loadOverrides()
  );

  // Map of "weekKey" -> string[] (list of checked ingredient names)
  readonly checkedItems = signal<Record<string, string[]>>(
    this.loadCheckedItems()
  );

  readonly pantry = signal<PantryItem[]>(this.loadPantry());
  readonly pantryGroups = signal<PantryGroup[]>(this.loadPantryGroups());
  readonly todayTimestamp = signal<number>(this.getTodayTimestamp());

  // Sync state - prevents effects from saving during sync from Firebase
  private isSyncing = false;

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

  // Sync state
  readonly lastUpdated = signal<number>(this.loadLastUpdated());
  readonly syncStatus = signal<
    'synced' | 'local-newer' | 'loading' | 'error' | 'offline'
  >('loading');

  constructor() {
    this.loadFamilySettings();

    if (this.scheduleMigrationOccurred) {
      this.migrationOccurred.set(true);
    }

    // Sync with Firestore on login
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.syncFromFirestore(user.uid);
      }
    });

    // Persist changes - skip Firebase save during sync from Firestore
    effect(() => {
      const data = this.meals();
      localStorage.setItem(this.MEALS_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('meals', data);
      }
    });
    effect(() => {
      const data = this.schedules();
      localStorage.setItem(this.SCHEDULES_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('schedules', data);
      }
    });
    effect(() => {
      const data = this.tags();
      localStorage.setItem(this.TAGS_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('tags', data);
      }
    });
    effect(() => {
      const data = this.ingredientTags();
      localStorage.setItem(this.INGREDIENT_TAGS_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('ingredientTags', data);
      }
    });
    effect(() => {
      const data = this.extraItems();
      localStorage.setItem(this.EXTRA_ITEMS_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('extraItems', data);
      }
    });
    effect(() => {
      const data = this.extraItemsHistory();
      localStorage.setItem(this.EXTRA_ITEMS_HISTORY_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('extraItemsHistory', data);
      }
    });
    effect(() => {
      const data = this.quantityOverrides();
      localStorage.setItem(this.QUANTITY_OVERRIDES_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('overrides', data);
      }
    });
    effect(() => {
      const data = this.checkedItems();
      localStorage.setItem(this.CHECKED_ITEMS_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('checkedItems', data);
      }
    });
    effect(() => {
      const data = this.pantry();
      localStorage.setItem(this.PANTRY_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('pantry', data);
      }
    });
    effect(() => {
      const data = this.pantryGroups();
      localStorage.setItem(this.PANTRY_GROUPS_KEY, JSON.stringify(data));
      if (!this.isSyncing) {
        this.saveToFirestore('pantryGroups', data);
      }
    });
    effect(() => {
      const settings = {
        isFamilyMode: this.isFamilyMode(),
        visibleMeals: this.visibleMeals(),
        familyPortions: this.familyPortions(),
      };
      localStorage.setItem(this.FAMILY_SETTINGS_KEY, JSON.stringify(settings));
      if (!this.isSyncing) {
        this.saveToFirestore('familySettings', settings);
      }
    });
    this.migrateQuantitiesToNumeric();
    this.migrateQuantitiesToSplitUnit();
  }

  private sanitizeForFirestore<T>(data: T): T {
    return JSON.parse(JSON.stringify(data)) as T;
  }

  private async saveToFirestore(key: string, data: unknown): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      this.syncStatus.set('offline');
      return;
    }
    try {
      this.updateTimestamp();
      const docRef = doc(this.firestore, 'users', user.uid);
      await setDoc(
        docRef,
        this.sanitizeForFirestore({ [key]: data, lastUpdated: this.lastUpdated() }),
        { merge: true }
      );
      this.syncStatus.set('synced');
    } catch (e) {
      console.error(`Error saving ${key} to firestore:`, e);
      this.syncStatus.set('error');
    }
  }

  async refreshData(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      await this.syncFromFirestore(user.uid);
    }
  }

  async forceUpload(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      await this.uploadAllToFirestore();
    }
  }

  getLastUpdatedDisplay(): string {
    const ts = this.lastUpdated();
    if (ts === 0) {
      return 'Nunca sincronizado';
    }
    return new Date(ts).toLocaleString('es-AR');
  }

  private async syncFromFirestore(uid: string): Promise<void> {
    this.isSyncing = true;
    this.syncStatus.set('loading');

    try {
      const docRef = doc(this.firestore, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const remoteTimestamp = data['lastUpdated'] || 0;
        const localTimestamp = this.lastUpdated();

        console.log(
          `[Sync] Local: ${new Date(localTimestamp).toISOString()}, ` +
            `Remote: ${new Date(remoteTimestamp).toISOString()}`
        );

        // If local is newer, upload to Firebase instead of downloading
        if (localTimestamp > remoteTimestamp) {
          console.log('[Sync] Local data is newer, uploading to Firebase');
          this.syncStatus.set('local-newer');
          setTimeout(() => {
            this.isSyncing = false;
          }, 0);
          this.uploadAllToFirestore();
          return;
        }

        // Remote is newer or same, download from Firebase
        console.log('[Sync] Remote data is newer or same, downloading');
        if (data['meals']) {
          this.meals.set(this.normalizeMealQuantities(data['meals']));
        }
        if (data['schedules']) {
          const raw = data['schedules'] as Record<string, unknown[]>;
          this.schedules.set(this.migrateSchedulesRecord(raw));
        }
        if (data['tags']) {
          this.tags.set(data['tags']);
        }
        if (data['ingredientTags']) {
          this.ingredientTags.set(data['ingredientTags']);
        }
        if (data['extraItems']) {
          const extraItems = data['extraItems'];
          this.extraItems.set(
            Array.isArray(extraItems)
              ? {}
              : (extraItems as Record<string, ShoppingItem[]>)
          );
        }
        if (data['extraItemsHistory']) {
          this.extraItemsHistory.set(data['extraItemsHistory']);
        }
        if (data['overrides']) {
          this.quantityOverrides.set(data['overrides']);
        }
        if (data['checkedItems']) {
          this.checkedItems.set(data['checkedItems']);
        }
        if (data['pantry']) {
          this.pantry.set(
            this.normalizePantryQuantities(data['pantry'] as PantryItem[])
          );
        }
        if (data['pantryGroups']) {
          this.pantryGroups.set(data['pantryGroups'] as PantryGroup[]);
        }
        if (data['familySettings']) {
          const fs = data['familySettings'];
          this.isFamilyMode.set(fs.isFamilyMode);
          if (fs.visibleMeals) {
            this.visibleMeals.set(fs.visibleMeals);
          }
          this.familyPortions.set(fs.familyPortions);
        }
        // Update local timestamp to match remote
        this.lastUpdated.set(remoteTimestamp);
        localStorage.setItem(this.LAST_UPDATED_KEY, remoteTimestamp.toString());
        this.syncStatus.set('synced');
      } else {
        // First time user - upload local data
        console.log('[Sync] No remote data, uploading local data');
        setTimeout(() => {
          this.isSyncing = false;
        }, 0);
        this.uploadAllToFirestore();
        return;
      }
    } catch (e) {
      console.error('Error syncing from Firestore', e);
      this.syncStatus.set('error');
    }
    // Wait for effects to run before resetting flag
    setTimeout(() => {
      this.isSyncing = false;
    }, 0);
  }

  private async uploadAllToFirestore(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      this.syncStatus.set('offline');
      return;
    }

    this.updateTimestamp();
    try {
      const docRef = doc(this.firestore, 'users', user.uid);
      await setDoc(docRef, this.sanitizeForFirestore({
        meals: this.meals(),
        schedules: this.schedules(),
        tags: this.tags(),
        ingredientTags: this.ingredientTags(),
        extraItems: this.extraItems(),
        extraItemsHistory: this.extraItemsHistory(),
        overrides: this.quantityOverrides(),
        checkedItems: this.checkedItems(),
        pantry: this.pantry(),
        pantryGroups: this.pantryGroups(),
        familySettings: {
          isFamilyMode: this.isFamilyMode(),
          visibleMeals: this.visibleMeals(),
          familyPortions: this.familyPortions(),
        },
        lastUpdated: this.lastUpdated(),
      }));
      this.syncStatus.set('synced');
      console.log('[Sync] All data uploaded to Firebase');
    } catch (e) {
      console.error('Error uploading all data to Firestore:', e);
      this.syncStatus.set('error');
    }
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
    if (!data) {
      return {};
    }
    try {
      const parsed = JSON.parse(data) as Record<string, unknown[]>;
      return this.migrateSchedulesRecord(parsed);
    } catch {
      return {};
    }
  }

  private migrateSchedulesRecord(
    raw: Record<string, unknown[]>
  ): Record<string, DaySchedule[]> {
    const result: Record<string, DaySchedule[]> = {};
    for (const [key, week] of Object.entries(raw)) {
      result[key] = (week as Record<string, unknown>[]).map((day) =>
        this.migrateDaySchedule(day)
      );
    }
    return result;
  }

  private migrateDaySchedule(day: Record<string, unknown>): DaySchedule {
    const isOldFormat =
      typeof day['almuerzo'] === 'string' ||
      day['almuerzo'] === null ||
      typeof day['desayuno'] === 'string' ||
      day['desayuno'] === null ||
      typeof day['cena'] === 'string' ||
      day['cena'] === null;
    if (isOldFormat) {
      this.scheduleMigrationOccurred = true;
    }
    return {
      dayName: day['dayName'] as string,
      ...(day['date'] ? { date: day['date'] as string } : {}),
      desayuno: this.toDishArray(
        day['desayuno'],
        day['desayunoExcluded'] as boolean | undefined
      ),
      almuerzo: this.toDishArray(
        day['almuerzo'],
        day['almuerzoExcluded'] as boolean | undefined
      ),
      postreAlmuerzo: (day['postreAlmuerzo'] as string | null) ?? null,
      colacion: (day['colacion'] as string | null) ?? null,
      cena: this.toDishArray(
        day['cena'],
        day['cenaExcluded'] as boolean | undefined
      ),
      postreCena: (day['postreCena'] as string | null) ?? null,
    };
  }

  private toDishArray(value: unknown, excluded?: boolean): Dish[] {
    if (Array.isArray(value)) {
      return value as Dish[];
    }
    if (typeof value === 'string') {
      return [{ mealId: value, portions: 1, excluded: excluded ?? false }];
    }
    return [];
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

  private loadExtraItems(): Record<string, ShoppingItem[]> {
    const data = localStorage.getItem(this.EXTRA_ITEMS_KEY);
    if (!data) {
      return {};
    }
    try {
      const parsed = JSON.parse(data);
      // Migrate from old array format (discard stale items)
      return Array.isArray(parsed)
        ? {}
        : (parsed as Record<string, ShoppingItem[]>);
    } catch {
      return {};
    }
  }

  private loadExtraItemsHistory(): ShoppingItem[] {
    const data = localStorage.getItem(this.EXTRA_ITEMS_HISTORY_KEY);
    return data ? (JSON.parse(data) as ShoppingItem[]) : [];
  }

  private loadOverrides(): Record<string, string> {
    const data = localStorage.getItem(this.QUANTITY_OVERRIDES_KEY);
    return data ? JSON.parse(data) : {};
  }

  private loadCheckedItems(): Record<string, string[]> {
    const data = localStorage.getItem(this.CHECKED_ITEMS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private loadPantry(): PantryItem[] {
    const data = localStorage.getItem(this.PANTRY_KEY);
    return data ? (JSON.parse(data) as PantryItem[]) : [];
  }

  private loadPantryGroups(): PantryGroup[] {
    const data = localStorage.getItem(this.PANTRY_GROUPS_KEY);
    if (data) {
      return JSON.parse(data) as PantryGroup[];
    }
    return [
      { id: 'heladera', name: 'Heladera', color: '#42a5f5' },
      { id: 'verduras', name: 'Verduras', color: '#66bb6a' },
      { id: 'freezer', name: 'Freezer', color: '#ab47bc' },
      { id: 'alacena', name: 'Alacena', color: '#ffa726' },
    ];
  }

  private loadLastUpdated(): number {
    const data = localStorage.getItem(this.LAST_UPDATED_KEY);
    return data ? parseInt(data, 10) : 0;
  }

  private updateTimestamp(): void {
    const now = Date.now();
    this.lastUpdated.set(now);
    localStorage.setItem(this.LAST_UPDATED_KEY, now.toString());
  }

  private getTodayTimestamp(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  refreshTodayTimestamp(): void {
    this.todayTimestamp.set(this.getTodayTimestamp());
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
      desayuno: [],
      almuerzo: [],
      postreAlmuerzo: null,
      colacion: null,
      cena: [],
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
          almuerzo: day.almuerzo.filter((d) => d.mealId !== id),
          desayuno: day.desayuno.filter((d) => d.mealId !== id),
          cena: day.cena.filter((d) => d.mealId !== id),
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
        ...(original.description ? { description: original.description } : {}),
        ingredients: original.ingredients.map((i) => ({ ...i })),
        tags: original.tags ? [...original.tags] : [],
      };
      this.addMeal(copy);
    }
  }

  getMeal(id: string): Meal | undefined {
    if (!id) {
      return undefined;
    }
    return this.meals().find((m) => m.id === id);
  }

  updateSchedule(
    dayName: string,
    type: TextScheduleField,
    value: string | null
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) =>
      day.dayName === dayName ? { ...day, [type]: value } : day
    );
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  setMeal(dayName: string, type: DishMealType, mealId: string): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      return { ...day, [type]: [{ mealId, portions: 1, excluded: false }] };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  clearMeal(dayName: string, type: DishMealType): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) =>
      day.dayName === dayName ? { ...day, [type]: [] } : day
    );
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  addDish(
    dayName: string,
    type: DishMealType,
    mealId: string,
    portions: number
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: [...current, { mealId, portions, excluded: false }],
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  removeDish(dayName: string, type: DishMealType, index: number): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return { ...day, [type]: current.filter((_, i) => i !== index) };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  updateDishPortions(
    dayName: string,
    type: DishMealType,
    index: number,
    portions: number
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: current.map((d, i) => (i === index ? { ...d, portions } : d)),
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  updateDishLabel(
    dayName: string,
    type: DishMealType,
    index: number,
    label: string
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: current.map((d, i) => {
          if (i !== index) {
            return d;
          }
          const dish: Dish = { ...d };
          if (label.trim()) {
            dish.label = label.trim();
          } else {
            delete dish.label;
          }
          return dish;
        }),
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  toggleDishExclusion(
    dayName: string,
    type: DishMealType,
    index: number
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: current.map((d, i) =>
          i === index ? { ...d, excluded: !d.excluded } : d
        ),
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  replaceDishMeal(
    dayName: string,
    type: DishMealType,
    index: number,
    mealId: string
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: current.map((d, i) => (i === index ? { ...d, mealId } : d)),
      };
    });
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
      this.dialogService.alert(
        'Sin datos',
        'No hay datos de la semana anterior para copiar.'
      );
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

  addExtraItem(name: string, quantity: string, tagId?: string, unit?: string): void {
    const newItem: ShoppingItem = { name, quantity, unit, tagId, isExtra: true };
    const weekKey = this.formatDateKey(this.currentWeekStart());
    this.extraItems.update((items) => ({
      ...items,
      [weekKey]: [...(items[weekKey] || []), newItem],
    }));
    const nameLower = name.toLowerCase().trim();
    this.extraItemsHistory.update((history) => {
      const exists = history.some(
        (h) => h.name.toLowerCase().trim() === nameLower
      );
      return exists ? history : [...history, newItem];
    });
    if (tagId) {
      this.setIngredientTag(name, tagId);
    }
  }

  removeExtraItem(index: number): void {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    this.extraItems.update((items) => ({
      ...items,
      [weekKey]: (items[weekKey] || []).filter((_, i) => i !== index),
    }));
  }

  overrideQuantity(ingredientName: string, newQuantity: string): void {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    const key = `${weekKey}_${ingredientName.toLowerCase().trim()}`;
    this.quantityOverrides.update((o) => ({ ...o, [key]: newQuantity }));
  }

  clearOverrides(): void {
    this.refreshTodayTimestamp();
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
    this.checkedItems.update((prev) => {
      const updated = { ...prev };
      delete updated[weekKey];
      return updated;
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
    const value = parseFloat(String(quantity ?? ''));
    if (isNaN(value)) {
      return quantity;
    }
    const result = value * factor;
    return `${parseFloat(result.toFixed(2))}`;
  }

  readonly shoppingListGrouped = computed(() => {
    const items: ShoppingItem[] = [];
    const currentSchedule = this.schedule();
    const allMeals = this.meals();
    const today = new Date(this.todayTimestamp());
    const weekStart = this.currentWeekStart();
    const weekKey = this.formatDateKey(weekStart);
    const tagMap = this.ingredientTags();
    const overrides = this.quantityOverrides();
    const weekChecked = this.checkedItems()[weekKey] || [];
    const pantryItems = this.pantry();

    currentSchedule.forEach((day, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);

      if (dayDate >= today) {
        const processDish = (dish: Dish): void => {
          if (dish.excluded) {
            return;
          }
          const meal = allMeals.find((m) => m.id === dish.mealId);
          if (meal && meal.includeInShoppingList !== false) {
            meal.ingredients.forEach((ing) => {
              const key = ing.name.toLowerCase().trim();
              const quantity = this.multiplyQuantity(
                ing.quantity,
                dish.portions
              );
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

        day.almuerzo.forEach(processDish);
        day.desayuno.forEach(processDish);
        day.cena.forEach(processDish);
      }
    });

    this.currentExtraItems().forEach((extra) => {
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
        aggregated[key].quantity = this.addQuantities(
          aggregated[key].quantity,
          item.quantity
        );
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

      const pantryEntry = pantryItems.find(
        (p) => p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      if (pantryEntry) {
        const parsedPantry = this.parseNumericQuantity(pantryEntry.quantity);
        if (parsedPantry?.value !== 0) {
          const effectiveQuantity = item.quantityOverride || item.quantity;
          const { remaining, covered } = this.subtractPantryFromNeeded(
            effectiveQuantity,
            pantryEntry.quantity
          );
          item.pantryQuantity = pantryEntry.quantity;
          item.inPantry = true;
          if (covered) {
            item.checked = true;
          } else {
            item.quantityOverride = remaining;
          }
        }
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

  addToPantry(name: string, quantity: string, groupId?: string): void {
    const key = name.toLowerCase().trim();
    this.pantry.update((items) => {
      const existing = items.find((i) => i.name.toLowerCase().trim() === key);
      if (existing) {
        return items.map((i) =>
          i.name.toLowerCase().trim() === key
            ? { ...i, quantity: this.addQuantities(i.quantity, quantity) }
            : i
        );
      }
      return [...items, { name, quantity, ...(groupId ? { groupId } : {}) }];
    });
  }

  removeFromPantry(name: string): void {
    const key = name.toLowerCase().trim();
    this.pantry.update((items) =>
      items.filter((i) => i.name.toLowerCase().trim() !== key)
    );
  }

  updatePantryQuantity(name: string, quantity: string): void {
    const key = name.toLowerCase().trim();
    this.pantry.update((items) =>
      items.map((i) =>
        i.name.toLowerCase().trim() === key ? { ...i, quantity } : i
      )
    );
  }

  updatePantryGroup(name: string, groupId: string): void {
    const key = name.toLowerCase().trim();
    this.pantry.update((items) =>
      items.map((i) =>
        i.name.toLowerCase().trim() === key ? { ...i, groupId } : i
      )
    );
  }

  subtractFromPantry(name: string, amount: string): void {
    const key = name.toLowerCase().trim();
    let didSubtract = false;
    this.pantry.update((items) =>
      items.map((i) => {
        if (i.name.toLowerCase().trim() !== key) {
          return i;
        }
        const parsed = this.parseNumericQuantity(i.quantity);
        const parsedAmount = this.parseNumericQuantity(amount);
        const unitsCompatible =
          parsed &&
          parsedAmount &&
          (parsed.unit === parsedAmount.unit || !parsed.unit || !parsedAmount.unit);
        if (unitsCompatible && parsed && parsedAmount) {
          didSubtract = true;
          const remaining = Math.max(0, parsed.value - parsedAmount.value);
          const unit = parsed.unit || parsedAmount.unit;
          return {
            ...i,
            quantity: unit ? `${remaining} ${unit}` : `${remaining}`,
          };
        }
        return i;
      })
    );
    if (didSubtract) {
      this.autoCheckIfCovered(key);
    }
  }

  private autoCheckIfCovered(key: string): void {
    const pantryEntry = this.pantry().find(
      (p) => p.name.toLowerCase().trim() === key
    );
    if (!pantryEntry) {
      return;
    }
    const parsedPantry = this.parseNumericQuantity(pantryEntry.quantity);
    if (parsedPantry?.value === 0) {
      return;
    }
    const shoppingItem = this.shoppingList().find(
      (s) => s.name.toLowerCase().trim() === key
    );
    if (!shoppingItem || shoppingItem.checked) {
      return;
    }
    const needed = shoppingItem.quantityOverride || shoppingItem.quantity;
    const { covered } = this.subtractPantryFromNeeded(
      needed,
      pantryEntry.quantity
    );
    if (covered) {
      this.toggleItemCheck(shoppingItem.name);
    }
  }

  clearPantry(): void {
    this.pantry.set([]);
  }

  addPantryGroup(name: string, color?: string): void {
    const newGroup: PantryGroup = { id: this.generateId(), name, ...(color ? { color } : {}) };
    this.pantryGroups.update((g) => [...g, newGroup]);
  }

  removePantryGroup(id: string): void {
    this.pantryGroups.update((g) => g.filter((group) => group.id !== id));
    this.pantry.update((items) =>
      items.map((i) => {
        if (i.groupId !== id) {
          return i;
        }
        const item = { ...i };
        delete item.groupId;
        return item;
      })
    );
  }

  updatePantryGroupColor(id: string, color: string): void {
    this.pantryGroups.update((groups) =>
      groups.map((g) => (g.id === id ? { ...g, color } : g))
    );
  }

  getCartPantryDiff(): {
    name: string;
    needed: string;
    inPantry: string;
    remaining: string;
    covered: boolean;
  }[] {
    const result: {
      name: string;
      needed: string;
      inPantry: string;
      remaining: string;
      covered: boolean;
    }[] = [];
    const pantryItems = this.pantry();
    this.shoppingList().forEach((item) => {
      const pantryEntry = pantryItems.find(
        (p) => p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      if (pantryEntry) {
        const parsedPantry = this.parseNumericQuantity(pantryEntry.quantity);
        if (parsedPantry?.value === 0) {
          return;
        }
        const needed = item.quantityOverride || item.quantity;
        const { remaining, covered } = this.subtractPantryFromNeeded(
          needed,
          pantryEntry.quantity
        );
        result.push({
          name: item.name,
          needed,
          inPantry: pantryEntry.quantity,
          remaining,
          covered,
        });
      }
    });
    return result;
  }

  applyCartToPantry(): void {
    const diff = this.getCartPantryDiff();
    diff.forEach(({ name, needed }) => {
      this.subtractFromPantry(name, needed);
    });
  }

  private parseNumericQuantity(
    quantity: string
  ): { value: number; unit: string } | null {
    const qStr = String(quantity ?? '').trim();
    const match = qStr.match(/^(\d+(\.\d+)?)\s*(.*)$/);
    if (match) {
      return { value: parseFloat(match[1]), unit: match[3].trim() };
    }
    return null;
  }

  private normalizeQuantityToNumeric(q: string): string {
    const qStr = String(q ?? '').trim();
    const match = qStr.match(/^(\d+(\.\d+)?)/);
    return match ? match[1] : qStr;
  }

  private normalizeMealQuantities(meals: Meal[]): Meal[] {
    return meals.map((meal) => ({
      ...meal,
      ingredients: meal.ingredients.map((ing) => {
        if (ing.unit !== undefined) {
          return { ...ing, quantity: this.normalizeQuantityToNumeric(ing.quantity) };
        }
        // Old format: try to split "500 g" → { quantity: "500", unit: "g" }
        const parsed = this.parseNumericQuantity(ing.quantity);
        return parsed
          ? { ...ing, quantity: `${parsed.value}`, unit: parsed.unit }
          : { ...ing, unit: '' };
      }),
    }));
  }

  private normalizePantryQuantities(items: PantryItem[]): PantryItem[] {
    return items.map((item) => ({
      ...item,
      quantity: this.normalizeQuantityToNumeric(item.quantity),
    }));
  }

  private migrateQuantitiesToNumeric(): void {
    if (localStorage.getItem(this.MIGRATION_NUMERIC_QTY_KEY)) {
      return;
    }
    this.meals.update((meals) => this.normalizeMealQuantities(meals));
    this.pantry.update((items) => this.normalizePantryQuantities(items));
    localStorage.setItem(this.MIGRATION_NUMERIC_QTY_KEY, '1');
  }

  private migrateQuantitiesToSplitUnit(): void {
    if (localStorage.getItem(this.MIGRATION_SPLIT_UNIT_KEY)) {
      return;
    }
    this.meals.update((meals) => this.normalizeMealQuantities(meals));
    localStorage.setItem(this.MIGRATION_SPLIT_UNIT_KEY, '1');
  }

  private addQuantities(existing: string, added: string): string {
    const parsedExisting = this.parseNumericQuantity(existing);
    const parsedAdded = this.parseNumericQuantity(added);
    if (
      parsedExisting &&
      parsedAdded &&
      (parsedExisting.unit === parsedAdded.unit || !parsedExisting.unit || !parsedAdded.unit)
    ) {
      const total = parsedExisting.value + parsedAdded.value;
      const unit = parsedExisting.unit || parsedAdded.unit;
      return unit ? `${total} ${unit}` : `${total}`;
    }
    return `${existing} + ${added}`;
  }

  subtractPantryFromNeeded(
    needed: string,
    inPantry: string
  ): { remaining: string; covered: boolean } {
    const parsedNeeded = this.parseNumericQuantity(needed);
    const parsedPantry = this.parseNumericQuantity(inPantry);
    if (
      parsedNeeded &&
      parsedPantry &&
      (parsedNeeded.unit === parsedPantry.unit || !parsedNeeded.unit || !parsedPantry.unit)
    ) {
      const remaining = parsedNeeded.value - parsedPantry.value;
      if (remaining <= 0) {
        return { remaining: '0', covered: true };
      }
      const unit = parsedNeeded.unit || parsedPantry.unit;
      return {
        remaining: unit ? `${remaining} ${unit}` : `${remaining}`,
        covered: false,
      };
    }
    return { remaining: needed, covered: false };
  }

  exportData(): void {
    const data = {
      meals: this.meals(),
      schedules: this.schedules(),
      tags: this.tags(),
      ingredientTags: this.ingredientTags(),
      extraItems: this.extraItems(),
      extraItemsHistory: this.extraItemsHistory(),
      overrides: this.quantityOverrides(),
      pantry: this.pantry(),
      pantryGroups: this.pantryGroups(),
      familySettings: {
        isFamilyMode: this.isFamilyMode(),
        visibleMeals: this.visibleMeals(),
        familyPortions: this.familyPortions(),
      },
      version: '1.3',
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

  exportMeals(): void {
    const data = { meals: this.meals(), version: '1.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comidas-meals-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  importMeals(jsonContent: string): void {
    try {
      const data = JSON.parse(jsonContent);
      const raw: Meal[] =
        Array.isArray(data) ? data : Array.isArray(data.meals) ? data.meals : null;
      if (!raw) {
        this.dialogService.alert('Error', 'El archivo no contiene comidas válidas.');
        return;
      }
      const normalized = this.normalizeMealQuantities(raw);
      const existing = this.meals();
      const existingMap = new Map(existing.map((m) => [m.id, m]));
      normalized.forEach((m) => existingMap.set(m.id, m));
      this.meals.set(Array.from(existingMap.values()));
      this.dialogService.alert(
        'Importación',
        `Se importaron ${normalized.length} comida(s) correctamente.`
      );
    } catch (error) {
      console.error('Error al importar comidas:', error);
      this.dialogService.alert('Error', 'El archivo no tiene un formato válido.');
    }
  }

  generateLLMPrompt(): string {
    const meals = this.meals();
    const mealsForPrompt = meals.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      tags: m.tags ?? [],
      ingredients: m.ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit ?? '',
      })),
    }));
    const jsonBlock = JSON.stringify(mealsForPrompt, null, 2);
    return (
      `Completá las siguientes comidas en formato JSON.\n` +
      `Para cada comida:\n` +
      `1. Completá o mejorá la descripción corta en español (campo "description").\n` +
      `2. Para cada ingrediente:\n` +
      `   - "quantity": solo el número o cantidad (ej: "500", "2", "1"). No cambies este valor.\n` +
      `   - "unit": la unidad de medida (ej: "g", "kg", "tazas", "cdita", "unidades", "filetes", ` +
      `"al gusto"). Si ya tiene unidad, dejala. Si no tiene, completala.\n` +
      `3. El campo "tags" es un array de strings. Si ya tiene tags, conservalos y agregá los ` +
      `que falten. Si está vacío, generá entre 1 y 4 tags en español que describan la comida ` +
      `(ej: "pollo", "pasta", "sin gluten", "rápido", "horno", "vegano", "desayuno").\n\n` +
      `Devolvé SOLO el JSON con el array de comidas (sin texto previo, sin explicaciones, ` +
      `sin bloques de código markdown).\n\n` +
      `${jsonBlock}`
    );
  }

  importData(jsonContent: string): void {
    try {
      const data = JSON.parse(jsonContent);
      if (data.meals) {
        this.meals.set(this.normalizeMealQuantities(data.meals));
      }
      if (data.schedules) {
        const raw = data.schedules as Record<string, unknown[]>;
        this.schedules.set(this.migrateSchedulesRecord(raw));
      }
      if (data.tags) {
        this.tags.set(data.tags);
      }
      if (data.ingredientTags) {
        this.ingredientTags.set(data.ingredientTags);
      }
      if (data.extraItems) {
        const extraItems = data.extraItems;
        this.extraItems.set(
          Array.isArray(extraItems)
            ? {}
            : (extraItems as Record<string, ShoppingItem[]>)
        );
      }
      if (data.extraItemsHistory) {
        this.extraItemsHistory.set(data.extraItemsHistory);
      }
      if (data.overrides) {
        this.quantityOverrides.set(data.overrides);
      }
      if (data.pantry) {
        this.pantry.set(
          this.normalizePantryQuantities(data.pantry as PantryItem[])
        );
      }
      if (data.pantryGroups) {
        this.pantryGroups.set(data.pantryGroups as PantryGroup[]);
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
            dinner: true,
          });
        }
        this.familyPortions.set(data.familySettings.familyPortions);
      }
      this.dialogService.alert('Importación', '¡Datos importados con éxito!');
    } catch (error) {
      console.error('Error al importar:', error);
      this.dialogService.alert(
        'Error',
        'El archivo no tiene un formato válido.'
      );
    }
  }
}
