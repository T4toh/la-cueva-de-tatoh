export type Ingredient = {
  name: string;
  quantity: string;
  unit?: string;
  checked?: boolean;
};

// Un paso del instructivo. Una comida con pasos es una receta; sin pasos es lo
// que había antes y sigue siendo válido.
export type Paso = {
  texto: string;
};

export type Meal = {
  id: string;
  name: string;
  ingredients: Ingredient[];
  description?: string;
  tags?: string[];
  includeInShoppingList?: boolean;
  pasos?: Paso[];
};

export type MealType =
  | 'almuerzo'
  | 'desayuno'
  | 'cena'
  | 'colacion'
  | 'postreAlmuerzo'
  | 'postreCena';

export type DishMealType = 'almuerzo' | 'desayuno' | 'cena';

export type TextScheduleField = 'postreAlmuerzo' | 'colacion' | 'postreCena';

export type Dish = {
  mealId: string;
  portions: number;
  excluded?: boolean;
  label?: string;
};

export type DaySchedule = {
  dayName: string;
  date?: string;
  desayuno: Dish[];
  almuerzo: Dish[];
  postreAlmuerzo: string | null;
  colacion: string | null;
  cena: Dish[];
  postreCena: string | null;
};

export type ShoppingTag = {
  id: string;
  name: string;
  color: string;
};

export type PantryGroup = {
  id: string;
  name: string;
  color?: string;
};

export type PantryItem = {
  name: string;
  quantity: string;
  groupId?: string;
};

export type ShoppingItem = {
  tagId?: string;
  isExtra?: boolean;
  quantityOverride?: string;
  inPantry?: boolean;
  pantryQuantity?: string;
} & Ingredient;

export type ShoppingListGroup = {
  tag: ShoppingTag | null;
  items: ShoppingItem[];
};
