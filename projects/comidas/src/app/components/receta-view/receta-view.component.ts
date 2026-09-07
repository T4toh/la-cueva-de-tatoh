import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Icon } from 'componentes';

import { DialogService } from '../../services/dialog.service';
import { MealService } from '../../services/meal.service';
import { rutaPublica } from '../../services/receta-publica';
import { RecetaDetalleComponent } from '../receta-detalle/receta-detalle.component';

@Component({
  selector: 'app-receta-view',
  standalone: true,
  imports: [RouterModule, Icon, RecetaDetalleComponent],
  templateUrl: './receta-view.component.html',
  styleUrls: ['./receta-view.component.scss'],
})
export class RecetaViewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly mealService = inject(MealService);
  private readonly dialogService = inject(DialogService);

  readonly mealId = this.route.snapshot.paramMap.get('id') ?? '';

  // Se lee del signal de comidas y no de una copia, así la ficha se actualiza
  // sola cuando la sincronización con Firestore trae cambios.
  readonly meal = computed(() =>
    this.mealService.meals().find((m) => m.id === this.mealId)
  );

  readonly publicando = signal(false);
  readonly copiado = signal(false);

  readonly linkPublico = computed(() => {
    const publicId = this.meal()?.publicId;
    if (!publicId) {
      return '';
    }
    return `${location.origin}${rutaPublica(
      this.meal()?.name ?? '',
      this.mealService.alias() || undefined,
      publicId
    )}`;
  });

  async publicar(): Promise<void> {
    if (this.publicando()) {
      return;
    }
    this.publicando.set(true);
    try {
      await this.mealService.compartirMeal(this.mealId);
    } catch (e) {
      console.error('Error publicando la receta:', e);
      this.dialogService.alert('No se pudo compartir', this.mensajeError(e));
    } finally {
      this.publicando.set(false);
    }
  }

  async despublicar(): Promise<void> {
    try {
      await this.mealService.dejarDeCompartirMeal(this.mealId);
    } catch (e) {
      console.error('Error dejando de compartir la receta:', e);
      this.dialogService.alert(
        'No se pudo dejar de compartir',
        this.mensajeError(e)
      );
    }
  }

  async copiar(): Promise<void> {
    const link = this.linkPublico();
    try {
      await navigator.clipboard.writeText(link);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch (e) {
      console.error('Error copiando el link:', e);
      this.dialogService.alert('No se pudo copiar', `Copialo a mano: ${link}`);
    }
  }

  // `navigator.clipboard` puede ni existir (origen inseguro) y `writeText`
  // puede rechazar (sin foco, permiso denegado): ambos casos entran acá igual
  // que un error propio del servicio, así el usuario nunca se queda sin aviso.
  private mensajeError(e: unknown): string {
    return e instanceof Error ? e.message : 'Probá de nuevo en un momento.';
  }
}
