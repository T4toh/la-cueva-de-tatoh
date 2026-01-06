export type Ingredient = {
  name: string;
  quantity: string;
  checked?: boolean;
}

export type Meal = {
  id: string;
  name: string;
  ingredients: Ingredient[];
  description?: string;
}

export type MealType = 'almuerzo' | 'desayuno' | 'cena' | 'colacion' | 'postreAlmuerzo' | 'postreCena';

export type DaySchedule = {
  dayName: string; 
  date?: string; 
  desayuno: string | null;
  almuerzo: string | null; 
  postreAlmuerzo: string | null;
  colacion: string | null;
  cena: string | null;
  postreCena: string | null;
}

export type ShoppingTag = {
  id: string;
  name: string;
  color: string;
}

export type ShoppingItem = {
  tagId?: string;
  isExtra?: boolean;
  quantityOverride?: string;
} & Ingredient

export type ShoppingListGroup = {
  tag: ShoppingTag | null; 
  items: ShoppingItem[];
}