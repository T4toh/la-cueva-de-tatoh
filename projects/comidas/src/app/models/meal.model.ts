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

export type MealType = 'almuerzo' | 'desayuno' | 'cena' | 'colacion' | 'postreAlmuerzo' | 'postreCena';

export interface DaySchedule {
  dayName: string; 
  date?: string; 
  desayuno: string | null;
  almuerzo: string | null; 
  postreAlmuerzo: string | null;
  colacion: string | null;
  cena: string | null;
  postreCena: string | null;
}

export interface ShoppingTag {
  id: string;
  name: string;
  color: string;
}

export interface ShoppingItem extends Ingredient {
  tagId?: string;
  isExtra?: boolean;
  quantityOverride?: string;
}

export interface ShoppingListGroup {
  tag: ShoppingTag | null; 
  items: ShoppingItem[];
}