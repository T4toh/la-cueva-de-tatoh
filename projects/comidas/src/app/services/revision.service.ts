import { computed, inject, Injectable, signal } from '@angular/core';
import { getAI, getGenerativeModel, GoogleAIBackend } from '@angular/fire/ai';
import { FirebaseApp } from '@angular/fire/app';

import { esquemaRespuesta, mensajeDeError, Pedir, promptRevision, revisarEnTandas } from '../revision/pedido';
import { aplicarRevisiones, recetasSinRevisar } from '../revision/revision';
import { AuthService } from './auth.service';
import { MealService } from './meal.service';

const MODELO = 'gemini-flash-latest';
// ponytail: el SDK espera 180 s por defecto y, con el modelo saturado, Google
// tarda eso para terminar fallando. 90 s por tanda alcanza para 40 recetas;
// subirlo si una tanda sana empieza a cortarse.
const ESPERA_MS = 90_000;

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

  private readonly pedir: Pedir = async (recetas, ids) => {
    const modelo = getGenerativeModel(getAI(this.app, { backend: new GoogleAIBackend() }), {
      model: MODELO,
      generationConfig: { responseMimeType: 'application/json', responseSchema: esquemaRespuesta(ids) },
    }, { timeout: ESPERA_MS });
    const respuesta = await modelo.generateContent(promptRevision(recetas));
    return JSON.parse(respuesta.response.text()) as unknown;
  };

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
