import { Component, computed, inject, signal } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { CompartirService } from '../../services/compartir.service';
import {
  filtrarComidas,
  MealService,
  tagsUnicos,
} from '../../services/meal.service';
import { MealCardComponent } from '../meal-card/meal-card.component';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-meal-list',
  standalone: true,
  imports: [RouterModule, MealCardComponent],
  templateUrl: './meal-list.component.html',
  styleUrls: ['./meal-list.component.scss'],
})
export class MealListComponent {
  mealService = inject(MealService);
  router = inject(Router);
  dialogService = inject(DialogService);
  compartirService = inject(CompartirService);

  readonly selectedTag = signal<string | null>(null);
  readonly soloCompartidas = signal(false);

  readonly uniqueTags = computed(() => tagsUnicos(this.mealService.meals()));

  readonly filteredMeals = computed(() =>
    filtrarComidas(
      this.mealService.meals(),
      this.selectedTag(),
      this.soloCompartidas()
    )
  );

  readonly sinFiltros = computed(
    () => this.selectedTag() === null && !this.soloCompartidas()
  );

  selectTag(tag: string | null): void {
    this.selectedTag.set(tag);
  }

  // "Todos" limpia los dos filtros: son independientes, pero el chip promete
  // todas las comidas y dejar prendido el de compartidas lo desmentiría.
  limpiarFiltros(): void {
    this.selectedTag.set(null);
    this.soloCompartidas.set(false);
  }

  async deleteMeal(id: string): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Eliminar Comida',
      '¿Estás seguro de eliminar esta comida?'
    );
    if (confirmed) {
      await this.mealService.deleteMeal(id);
    }
  }

  verReceta(id: string): void {
    this.router.navigate(['/meals', id]);
  }

  editMeal(id: string): void {
    this.router.navigate(['/meals/edit', id]);
  }

  duplicateMeal(id: string): void {
    this.mealService.duplicateMeal(id);
  }

  compartirMeal(id: string): void {
    void this.compartirService.compartir(id);
  }

  printRecipes(): void {
    window.print();
  }
}
