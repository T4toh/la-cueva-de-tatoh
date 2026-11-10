import { computed, inject, Injectable, signal } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';

import { esquemaRespuesta, mensajeDeError, Pedir, promptRevision, revisarEnTandas } from '../revision/pedido';
import { aplicarRevisiones, recetasSinRevisar } from '../revision/revision';
import { AuthService } from './auth.service';
import { pedirJsonDe } from './flash';
import { MealService } from './meal.service';

export type ResultadoRevision = { revisadas: number; error: string | null };

// Conecta la lógica pura de `revision/` con Flash y con las comidas. Ver
// docs/superpowers/specs/2026-11-06-completar-recetas-design.md
@Injectable({ providedIn: 'root' })
export class RevisionService {
  private readonly app = inject(FirebaseApp);
  private readonly mealService = inject(MealService);
  private readonly authService = inject(AuthService);

  private readonly enCurso = signal(false);
  readonly revisando = this.enCurso.asReadonly();
  readonly pendientes = computed(() => recetasSinRevisar(this.mealService.meals()).length);
  // La cuota del plan Spark es una sola para todo el proyecto: sin sesión no
  // se gasta. Esto no frena a quien llame directo a la API; eso es App Check.
  readonly puede = computed(() => !!this.authService.currentUser());

  private readonly pedirJson = pedirJsonDe(this.app);
  private readonly pedir: Pedir = (recetas, ids) =>
    this.pedirJson(esquemaRespuesta(ids), promptRevision(recetas, this.mealService.noComo()));

  async revisar(): Promise<ResultadoRevision> {
    if (this.enCurso() || !this.puede() || this.pendientes() === 0) {
      return { revisadas: 0, error: null };
    }
    this.enCurso.set(true);
    try {
      const { resultados, error } = await revisarEnTandas(
        recetasSinRevisar(this.mealService.meals()),
        this.mealService.indiceCatalogo(),
        this.pedir
      );
      // Un solo update, aun con error parcial: lo que respondió se guarda.
      if (resultados.length > 0) {
        this.mealService.meals.update((meals) => aplicarRevisiones(meals, resultados));
      }
      return { revisadas: resultados.length, error: error === null ? null : mensajeDeError(error) };
    } finally {
      this.enCurso.set(false);
    }
  }
}
