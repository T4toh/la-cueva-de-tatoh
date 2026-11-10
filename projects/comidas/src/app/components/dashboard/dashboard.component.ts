import { afterRenderEffect, Component, computed, inject, linkedSignal, OnDestroy, signal } from '@angular/core';
import { comidasQueSuman, META_PLANTAS, plantasDeLaSemana } from '../../catalogo/plantas';
import { armarGuia, REGLAS, tipDelPlan } from '../../guia/guia';
import { chequearSemana, MAX_CARNE_ROJA, META_CARNE_BLANCA, MIN_PESCADO } from '../../guia/chequeos';
import { RouterModule } from '@angular/router';
import { ArmadorFlashService } from '../../services/armador-flash.service';
import { MealService } from '../../services/meal.service';
import { DialogService } from '../../services/dialog.service';
import {
  DaySchedule,
  Dish,
  DishMealType,
  TextScheduleField,
} from '../../models/meal.model';
import { Icon, Panel } from 'componentes';
import { RecetasNuevasComponent } from './recetas-nuevas.component';
import { FormsModule } from '@angular/forms';

// El día al que ya se llevó la vista. Vive fuera del componente para que
// volver del selector de comidas no salte a hoy: sólo al abrir la app y
// cuando cambia el día.
let diaMostrado = 0;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, Panel, FormsModule, Icon, RecetasNuevasComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnDestroy {
  mealService = inject(MealService);
  private dialogService = inject(DialogService);
  readonly flash = inject(ArmadorFlashService);

  // En el celu los días van en una columna y hoy puede quedar muy abajo.
  private readonly irAHoy = afterRenderEffect(() => {
    const hoy = this.mealService.todayTimestamp();
    if (hoy === diaMostrado || !matchMedia('(max-width: 600px)').matches) {
      return;
    }
    diaMostrado = hoy;
    document.querySelector('.day-panel.is-today')?.scrollIntoView({ block: 'start' });
  });

  // El aviso es de la semana que se completó: cambiar de semana lo borra.
  readonly resultado = linkedSignal<number, { puestos: number; sinCandidatos: number; deFlash?: number } | null>({
    source: computed(() => this.mealService.currentWeekStart().getTime()),
    computation: () => null,
  });

  readonly sinVacias = computed(() =>
    this.mealService.slotsParaCompletar().length === 0 ? 'No hay comidas vacías para completar' : ''
  );
  readonly aviso = computed(() => {
    const r = this.resultado();
    if (!r) {
      return '';
    }
    const n = r.sinCandidatos;
    const resto = n > 0 ? ` · ${n} ${n === 1 ? 'quedó' : 'quedaron'} sin opciones` : '';
    const f = r.deFlash ?? 0;
    const deFlash = f > 0 ? `, ${f} ${f === 1 ? 'elegida' : 'elegidas'} por Flash` : '';
    return `Puse ${r.puestos} ${r.puestos === 1 ? 'comida' : 'comidas'}${deFlash}${resto}`;
  });

  // Lo que Flash dejó para decir en una línea aparte (error, cambio de semana,
  // dónde quedó una receta usada). Es de la semana mostrada: cambiarla lo borra.
  readonly estadoFlash = linkedSignal<number, string>({
    source: computed(() => this.mealService.currentWeekStart().getTime()),
    computation: () => '',
  });
  // Mientras Flash piensa la línea de estado lo dice, para quien no ve el botón.
  readonly estadoVisible = computed(() => (this.flash.armando() ? 'Armando con Flash…' : this.estadoFlash()));

  readonly sinSesion = computed(() => (this.flash.puede() ? '' : 'Iniciá sesión para completar con Flash'));
  // Completar con Flash: sin sesión, sin huecos o armando.
  readonly flashDeshabilitado = computed(
    () => !this.flash.puede() || this.flash.armando() || this.mealService.slotsParaCompletar().length === 0
  );

  // Sugerime algo nuevo: sin sesión, armando o sin ninguna comida visible.
  readonly sugerirDeshabilitado = computed(() => {
    const v = this.mealService.visibleMeals();
    return !this.flash.puede() || this.flash.armando() || !(v.breakfast || v.lunch || v.dinner);
  });

  async sugerir(): Promise<void> {
    this.estadoFlash.set((await this.flash.sugerir()) ?? '');
  }

  async completarConFlash(): Promise<void> {
    const semana = this.mealService.currentWeekStart().getTime();
    const r = await this.flash.completar();
    // Lo que puso es de la semana que se completó: no se avisa en la que se ve ahora.
    if (this.mealService.currentWeekStart().getTime() !== semana) {
      this.estadoFlash.set(r.cambioSemana ? 'Cambiaste de semana mientras Flash pensaba: no puse nada.' : '');
      return;
    }
    this.estadoFlash.set(r.error ?? '');
    this.resultado.set(r.error && r.puestos === 0 ? null : r);
  }

  completarSemana(): void {
    this.estadoFlash.set('');
    this.resultado.set(this.mealService.completarSemana());
  }

  deshacer(): void {
    this.estadoFlash.set('');
    this.mealService.deshacerCompletar();
    this.resultado.set(null);
  }

  ngOnDestroy(): void {
    this.mealService.olvidarDeshacer();
  }

  readonly metaPlantas = META_PLANTAS;
  readonly verPlantas = signal(false);
  readonly plantas = computed(() =>
    plantasDeLaSemana(this.mealService.schedule(), this.mealService.meals(), this.mealService.indiceCatalogo())
  );
  readonly sumanPlantas = computed(() =>
    comidasQueSuman(new Set(this.plantas().plantas), this.mealService.meals(), this.mealService.indiceCatalogo())
  );

  readonly maxRoja = MAX_CARNE_ROJA;
  readonly minPescado = MIN_PESCADO;
  readonly metaBlanca = META_CARNE_BLANCA;
  readonly chequeo = computed(() =>
    chequearSemana(this.mealService.schedule(), this.mealService.meals(), this.mealService.indiceCatalogo())
  );

  // Las reglas que se ven en /guia, en ese orden: propias y base sin las
  // ocultas. Una oculta no se chequea ni sale de tip.
  readonly reglasVisibles = computed(() =>
    armarGuia(REGLAS, this.mealService.guia()).grupos.flatMap((g) => g.reglas)
  );
  // El salto no se guarda: al recargar vuelve el del día, o la regla que la
  // semana no cumple.
  readonly saltoTip = signal(0);
  readonly tip = computed(() =>
    tipDelPlan(this.reglasVisibles(), this.chequeo().incumplidas, new Date(), this.saltoTip())
  );

  chequeoVisible(id: string): boolean {
    return this.reglasVisibles().some((r) => r.id === id);
  }

  dosCarbos(dayName: string): boolean {
    return this.chequeo().diasConDosCarbos.includes(dayName);
  }

  getMealName(id: string): string {
    const meal = this.mealService.getMeal(id);
    return meal ? meal.name : 'Seleccionar';
  }

  getDishes(day: DaySchedule, type: DishMealType): Dish[] {
    return day[type];
  }

  getFirstMealName(day: DaySchedule, type: DishMealType): string {
    const dishes = day[type];
    if (dishes.length === 0) {
      return 'Seleccionar';
    }
    return this.getMealName(dishes[0].mealId);
  }

  motivoDe(day: DaySchedule, type: DishMealType): string {
    return day[type][0]?.motivo ?? '';
  }

  isPlaceholder(mealId: string): boolean {
    return this.mealService.getMeal(mealId)?.includeInShoppingList === false;
  }

  isFirstDishPlaceholder(day: DaySchedule, type: DishMealType): boolean {
    const dishes = day[type];
    return dishes.length > 0 && this.isPlaceholder(dishes[0].mealId);
  }

  async clearWeek(): Promise<void> {
    const confirmed = await this.dialogService.confirm(
      'Limpiar Semana',
      '¿Estás seguro de que quieres borrar toda la planificación de esta semana?'
    );
    if (confirmed) {
      this.mealService.clearSchedule();
    }
  }

  async refreshData(): Promise<void> {
    await this.mealService.refreshData();
  }

  isToday(dayName: string): boolean {
    const today = new Date();
    const dayNames = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    const todayName = dayNames[today.getDay()];
    const startOfCurrentWeek = this.getStartOfWeek(new Date());
    const startOfDisplayWeek = this.mealService.currentWeekStart();
    return (
      todayName === dayName &&
      startOfCurrentWeek.getTime() === startOfDisplayWeek.getTime()
    );
  }

  isPast(dayName: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayNames = [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ];
    const dayIndex = dayNames.indexOf(dayName);
    const displayWeekStart = new Date(this.mealService.currentWeekStart());
    const dayDate = new Date(displayWeekStart);
    dayDate.setDate(displayWeekStart.getDate() + dayIndex);
    return dayDate < today;
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  printMenu(): void {
    window.print();
  }

  updateField(dayName: string, field: TextScheduleField, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.mealService.updateSchedule(dayName, field, input.value);
  }

  clearMeal(dayName: string, type: DishMealType): void {
    this.mealService.clearMeal(dayName, type);
  }

  removeDish(dayName: string, type: DishMealType, index: number): void {
    this.mealService.removeDish(dayName, type, index);
  }

  updateDishPortions(
    dayName: string,
    type: DishMealType,
    index: number,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    const portions = Math.max(1, Number(input.value));
    this.mealService.updateDishPortions(dayName, type, index, portions);
  }

  toggleDishExclusion(
    dayName: string,
    type: DishMealType,
    index: number
  ): void {
    this.mealService.toggleDishExclusion(dayName, type, index);
  }

  updateDishLabel(
    dayName: string,
    type: DishMealType,
    index: number,
    event: Event
  ): void {
    const input = event.target as HTMLInputElement;
    this.mealService.updateDishLabel(dayName, type, index, input.value);
  }

  dismissMigrationBanner(): void {
    this.mealService.migrationOccurred.set(false);
  }
}
