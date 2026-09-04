import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { MealEditorComponent } from './components/meal-editor/meal-editor.component';
import { MealListComponent } from './components/meal-list/meal-list.component';
import { MealSelectorComponent } from './components/meal-selector/meal-selector.component';
import { PantryComponent } from './components/pantry/pantry.component';
import { RecetaViewComponent } from './components/receta-view/receta-view.component';
import { SettingsComponent } from './components/settings/settings.component';
import { ShoppingListComponent } from './components/shopping-list/shopping-list.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'meals', component: MealListComponent },
  { path: 'meals/new', component: MealEditorComponent },
  { path: 'meals/edit/:id', component: MealEditorComponent },
  // Va después de 'meals/new' y 'meals/edit/:id': el orden manda y
  // 'meals/:id' se las comería a las dos.
  { path: 'meals/:id', component: RecetaViewComponent },
  { path: 'shopping-list', component: ShoppingListComponent },
  { path: 'despensa', component: PantryComponent },
  { path: 'schedule/:day/:type', component: MealSelectorComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '' },
];
