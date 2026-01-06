export interface Ingredient {
  name: string;
  quantity: string;
  checked?: boolean;
}

export interface Meal {
  id: string;
  name: string;
  ingredients: Ingredient[];
  description?: string;
}

export type MealType = 'almuerzo' | 'desayuno';

export interface DaySchedule {
  dayName: string; // Lunes, Martes, etc.
  date?: string; // ISO string date
  almuerzo: string | null; // Meal ID
  desayuno: string | null; // Meal ID
}

export interface ShoppingTag {
  id: string;
  name: string;
  color: string;
}

export interface ShoppingItem extends Ingredient {
  tagId?: string;
  isExtra?: boolean;
}

export interface ShoppingListGroup {
  tag: ShoppingTag | null; // null for "Uncategorized"
  items: ShoppingItem[];
}