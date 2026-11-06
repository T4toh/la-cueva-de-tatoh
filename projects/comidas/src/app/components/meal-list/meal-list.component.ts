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
import { RevisionService } from '../../services/revision.service';

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
  readonly revision = inject(RevisionService);

  // El resultado de la última pasada: cuántas revisó o por qué falló.
  readonly mensajeRevision = signal<string | null>(null);

  // En el componente y no en el template: ahí ya está al límite de complejidad.
  readonly estadoRevision = computed(() => {
    const r = this.revision;
    if (r.revisando()) {
      return `Flash está leyendo ${r.pendientes()} recetas. Puede tardar un minuto.`;
    }
    if (!r.puede()) {
      return 'Iniciá sesión para revisar tu recetario';
    }
    const pendientes = r.pendientes() === 0 ? 'No hay recetas sin revisar.' : `${r.pendientes()} sin revisar`;
    return this.mensajeRevision() ?? pendientes;
  });

  readonly selectedTag = signal<string | null>(null);
  readonly soloCompartidas = signal(false);
  readonly texto = signal('');

  readonly uniqueTags = computed(() => tagsUnicos(this.mealService.meals()));

  readonly filteredMeals = computed(() =>
    filtrarComidas(
      this.mealService.meals(),
      this.selectedTag(),
      this.soloCompartidas(),
      this.texto()
    )
  );

  readonly sinFiltros = computed(
    () =>
      this.selectedTag() === null &&
      !this.soloCompartidas() &&
      this.texto().trim() === ''
  );

  selectTag(tag: string | null): void {
    this.selectedTag.set(tag);
  }

  // "Todas" limpia todos los filtros: son independientes, pero el chip promete
  // todas las comidas y dejar prendido cualquiera lo desmentiría.
  limpiarFiltros(): void {
    this.selectedTag.set(null);
    this.soloCompartidas.set(false);
    this.texto.set('');
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

  async revisar(): Promise<void> {
    this.mensajeRevision.set(null);
    const { revisadas, error } = await this.revision.revisar();
    const hechas = revisadas === 1 ? '1 receta revisada.' : `${revisadas} recetas revisadas.`;
    this.mensajeRevision.set(error ? `${revisadas > 0 ? hechas + ' ' : ''}${error}` : hechas);
  }

  printRecipes(): void {
    window.print();
  }
}
