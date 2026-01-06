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
