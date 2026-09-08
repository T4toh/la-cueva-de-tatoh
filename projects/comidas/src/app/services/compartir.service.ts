import { inject, Injectable } from '@angular/core';
import { DialogoAccion } from 'componentes';

import { DialogService } from './dialog.service';
import { MealService } from './meal.service';
import { rutaPublica } from './receta-publica';

// Pura y exportada aparte para poder testearla sin tocar `location` ni el DI:
// une el origen con la ruta que ya arma `rutaPublica`.
export function armarLink(
  origin: string,
  nombre: string,
  alias: string | undefined,
  publicId: string
): string {
  return `${origin}${rutaPublica(nombre, alias, publicId)}`;
}

// Dueño único del flujo de "compartir una receta": lo usan tanto el botón de
// la ficha como el de la lista. No lo inyecta `MealService` — sería un ciclo,
// esta clase es la que depende de `MealService` y no al revés.
@Injectable({
  providedIn: 'root',
})
export class CompartirService {
  private readonly mealService = inject(MealService);
  private readonly dialogService = inject(DialogService);

  link(mealId: string): string {
    const meal = this.mealService.getMeal(mealId);
    const publicId = meal?.publicId;
    if (!meal || !publicId) {
      return '';
    }
    return armarLink(
      location.origin,
      meal.name,
      this.mealService.alias() || undefined,
      publicId
    );
  }

  async compartir(mealId: string): Promise<void> {
    const yaCompartida = !!this.mealService.getMeal(mealId)?.publicId;
    if (!yaCompartida) {
      const confirmado = await this.dialogService.confirm(
        'Compartir receta',
        'Cualquiera con el link va a poder ver esta receta, sin necesidad de ' +
          'una cuenta. Podés dejar de compartirla cuando quieras.'
      );
      if (!confirmado) {
        return;
      }
      try {
        await this.mealService.compartirMeal(mealId);
      } catch (e) {
        console.error('Error publicando la receta:', e);
        this.dialogService.alert('No se pudo compartir', this.mensajeError(e));
        return;
      }
    }
    this.mostrarLinkDialogo(mealId);
  }

  async dejarDeCompartir(mealId: string): Promise<void> {
    try {
      await this.mealService.dejarDeCompartirMeal(mealId);
    } catch (e) {
      console.error('Error dejando de compartir la receta:', e);
      this.dialogService.alert(
        'No se pudo dejar de compartir',
        this.mensajeError(e)
      );
    }
  }

  // `navigator.clipboard` puede ni existir (origen inseguro) y `writeText`
  // puede rechazar (sin foco, permiso denegado): ambos casos entran acá igual
  // que un error propio del servicio, así el usuario nunca se queda sin aviso.
  // Devuelve si copió o no para que quien la llama decida su propio feedback
  // (la ficha, por ejemplo, prende un cartel transitorio sólo si copió).
  async copiar(link: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(link);
      return true;
    } catch (e) {
      console.error('Error copiando el link:', e);
      this.dialogService.alert('No se pudo copiar', `Copialo a mano: ${link}`);
      return false;
    }
  }

  private mostrarLinkDialogo(mealId: string): void {
    const link = this.link(mealId);
    // Sin `icono`: `lib-boton` lo renderiza como `<img [src]="icono()">`, así
    // que un nombre de la grilla de iconos daría una imagen rota. El texto
    // alcanza, y no vale tocar la librería por esto.
    const acciones: DialogoAccion[] = [
      {
        texto: 'Copiar',
        estilo: 'outline',
        accion: (): void => {
          void this.copiar(link);
        },
      },
      {
        texto: 'Abrir en otra ventana',
        estilo: 'outline',
        accion: (): void => {
          window.open(link, '_blank', 'noopener');
        },
      },
      {
        texto: 'Cerrar',
        estilo: 'text',
        accion: (): void => {
          this.dialogService.close();
        },
      },
    ];
    this.dialogService.open({
      title: 'Compartir receta',
      message: link,
      actions: acciones,
    });
  }

  private mensajeError(e: unknown): string {
    return e instanceof Error ? e.message : 'Probá de nuevo en un momento.';
  }
}
