import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { MealListComponent } from './components/meal-list/meal-list.component';
import { MealEditorComponent } from './components/meal-editor/meal-editor.component';
import { ShoppingListComponent } from './components/shopping-list/shopping-list.component';
import { MealSelectorComponent } from './components/meal-selector/meal-selector.component';
import { SettingsComponent } from './components/settings/settings.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'meals', component: MealListComponent },
  { path: 'meals/new', component: MealEditorComponent },
  { path: 'meals/edit/:id', component: MealEditorComponent },
  { path: 'shopping-list', component: ShoppingListComponent },
  { path: 'schedule/:day/:type', component: MealSelectorComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: '' }
];