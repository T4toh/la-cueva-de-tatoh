import { Component, computed, inject, linkedSignal } from '@angular/core';
import { ArmadorFlashService } from '../../services/armador-flash.service';
import { MealService } from '../../services/meal.service';

// Las recetas que Flash propone para la semana y "Sugerime algo nuevo".
@Component({
  selector: 'app-recetas-nuevas',
  standalone: true,
  templateUrl: './recetas-nuevas.component.html',
  styleUrls: ['./recetas-nuevas.component.scss'],
})
export class RecetasNuevasComponent {
  readonly flash = inject(ArmadorFlashService);
  private readonly mealService = inject(MealService);

  // Error o lugar donde quedó una receta: son de la semana mostrada.
  readonly estado = linkedSignal<number, string>({
    source: computed(() => this.mealService.currentWeekStart().getTime()),
    computation: () => '',
  });

  readonly sinSesion = computed(() => (this.flash.puede() ? '' : 'Iniciá sesión para completar con Flash'));
  readonly sugerirDeshabilitado = computed(() => {
    const v = this.mealService.visibleMeals();
    return !this.flash.puede() || this.flash.armando() || !(v.breakfast || v.lunch || v.dinner);
  });

  async sugerir(): Promise<void> {
    this.estado.set((await this.flash.sugerir()) ?? '');
  }

  guardar(i: number): void {
    if (this.flash.nuevas()[i]) {
      this.flash.guardar(i);
      this.estado.set('La guardé en el recetario con "para probar"');
    }
  }

  descartar(i: number): void {
    if (this.flash.nuevas()[i]) {
      this.flash.descartar(i);
      this.estado.set('Descartada');
    }
  }

  usar(i: number): void {
    const antes = this.mealService.schedule();
    const r = this.flash.usar(i);
    if (r === null) {
      return;
    }
    if (r === 'guardada') {
      this.estado.set('No había lugar: la guardé en el recetario');
      return;
    }
    // El slot donde quedó es el único cuyo arreglo de platos cambió.
    const tipos = ['desayuno', 'almuerzo', 'cena'] as const;
    for (const [j, dia] of this.mealService.schedule().entries()) {
      const tipo = tipos.find((t) => dia[t] !== antes[j][t]);
      if (tipo) {
        this.estado.set(`Quedó en ${tipo === 'cena' ? 'la' : 'el'} ${tipo} del ${dia.dayName.toLowerCase()}`);
        return;
      }
    }
    this.estado.set('Quedó en el plan');
  }
}
