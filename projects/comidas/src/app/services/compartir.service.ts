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

// El navegador puede no tener la Web Share API: no está en Firefox de escritorio
// ni en el WebView de Android, que es el que corre la app de Capacitor. Sin ella
// el diálogo queda como estaba —copiar y abrir—, que es el piso que ya andaba.
export function soportaCompartirNativo(nav: unknown): boolean {
  return !!nav && typeof nav === 'object' && 'share' in nav;
}

// Cerrar la hoja de compartir del sistema rechaza con AbortError, y eso no es
// un error: no lleva cartel. Cualquier otro rechazo sí. Se compara por `name`
// sobre Error y no con `instanceof DOMException` porque no todos los
// navegadores rechazan con una DOMException.
export function esCancelacion(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

// Qué hacer con el tilde de compartir del editor. El default es privado, así
// que el caso normal es `null`: la mayoría de las comidas nunca se comparten y
// guardarlas no tiene que tocar `recetasPublicas`. Los dos casos que sí hacen
// algo son los cambios de estado, no los estados.
export function accionDeCompartir(
  compartida: boolean,
  estaba: boolean
): 'publicar' | 'despublicar' | null {
  if (compartida === estaba) {
    return null;
  }
  return compartida ? 'publicar' : 'despublicar';
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
      if (!confirmado || !(await this.publicar(mealId))) {
        return;
      }
    }
    this.mostrarLinkDialogo(mealId);
  }

  // Publica sin diálogos, y devuelve si pudo. El editor la usa tal cual: el
  // aviso ya está escrito al lado del tilde, y el link no se puede mostrar
  // porque al guardar se navega a /meals. `compartir` la usa también, para que
  // el manejo de error viva en un solo lado.
  async publicar(mealId: string): Promise<boolean> {
    try {
      await this.mealService.compartirMeal(mealId);
      return true;
    } catch (e) {
      console.error('Error publicando la receta:', e);
      this.dialogService.alert('No se pudo compartir', this.mensajeError(e));
      return false;
    }
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
    const acciones: DialogoAccion[] = [];
    if (soportaCompartirNativo(navigator)) {
      acciones.push({
        texto: 'Compartir…',
        estilo: 'normal',
        color: 'var(--accent)',
        accion: (): void => {
          void this.compartirNativo(mealId, link);
        },
      });
    }
    acciones.push(
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
        texto: 'Dejar de compartir',
        estilo: 'text',
        color: 'var(--danger)',
        accion: (): void => {
          void this.confirmarDejarDeCompartir(mealId);
        },
      },
      {
        texto: 'Cerrar',
        estilo: 'text',
        accion: (): void => {
          this.dialogService.close();
        },
      }
    );
    this.dialogService.open({
      title: 'Compartir receta',
      message: link,
      // El alias se edita acá porque acá es donde se ve lo que hace: firma la
      // receta y es el primer segmento del link. El link viejo no muere al
      // cambiarlo —el id de ocho es la llave y el nick es decorativo—, pero el
      // mensaje se reescribe para mostrar el que se va a repartir de ahora en
      // más.
      campo: {
        etiqueta: 'Tu nombre en la receta',
        valor: this.mealService.alias(),
        placeholder: 'Sin nombre',
        onChange: (valor: string): void => {
          this.mealService.alias.set(valor);
          this.dialogService.message.set(this.link(mealId));
        },
      },
      actions: acciones,
    });
  }

  private async compartirNativo(mealId: string, link: string): Promise<void> {
    const nombre = this.mealService.getMeal(mealId)?.name ?? 'Receta';
    try {
      await navigator.share({
        title: nombre,
        text: `Receta: ${nombre}`,
        url: link,
      });
    } catch (e) {
      if (esCancelacion(e)) {
        return;
      }
      console.error('Error compartiendo la receta:', e);
      this.dialogService.alert('No se pudo compartir', this.mensajeError(e));
      return;
    }
    this.dialogService.close();
  }

  // Cancelar vuelve al diálogo del link en vez de dejar la pantalla vacía: el
  // usuario no pidió cerrar, pidió no descompartir.
  private async confirmarDejarDeCompartir(mealId: string): Promise<void> {
    const confirmado = await this.dialogService.confirm(
      'Dejar de compartir',
      'El link va a dejar de funcionar para siempre. Si más adelante volvés a ' +
        'compartir esta receta, el link va a ser otro.'
    );
    if (!confirmado) {
      this.mostrarLinkDialogo(mealId);
      return;
    }
    await this.dejarDeCompartir(mealId);
  }

  private mensajeError(e: unknown): string {
    return e instanceof Error ? e.message : 'Probá de nuevo en un momento.';
  }
}
