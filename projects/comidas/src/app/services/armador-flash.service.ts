import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';

import { PAISES } from '../armador/estacion';
import { completarConFlash, ResultadoFlash, sinResultado } from '../armador/flujo-flash';
import {
  esquemaRecetasNuevas,
  PedidoRecetas,
  promptRecetasNuevas,
  RecetaNueva,
  validarRecetasNuevas,
} from '../armador/recetas-nuevas';
import { plantasDeLaSemana } from '../catalogo/plantas';
import { mensajeDeError } from '../revision/pedido';
import { AuthService } from './auth.service';
import { pedirJsonDe } from './flash';
import { MealService } from './meal.service';

// Conecta el armador con Flash: "Completar con Flash", "Sugerime algo nuevo"
// y las recetas nuevas que quedan por resolver. Ver
// docs/superpowers/specs/2026-11-06-armador-semanas-design.md
@Injectable({ providedIn: 'root' })
export class ArmadorFlashService {
  private readonly mealService = inject(MealService);
  private readonly authService = inject(AuthService);
  private readonly pedir = pedirJsonDe(inject(FirebaseApp));

  private readonly enCurso = signal(false);
  readonly armando = this.enCurso.asReadonly();
  // Sin sesión no se gasta la cuota del proyecto (igual que RevisionService).
  readonly puede = computed(() => !!this.authService.currentUser());
  private readonly sugeridas = signal<RecetaNueva[]>([]);
  readonly nuevas = this.sugeridas.asReadonly();

  // Las sugerencias son de la semana para la que se pidieron.
  private readonly semana = computed(() => this.mealService.currentWeekStart().getTime());

  constructor() {
    effect(() => {
      this.semana();
      untracked(() => this.sugeridas.set([]));
    });
  }

  async completar(): Promise<ResultadoFlash> {
    if (this.enCurso() || !this.puede()) {
      return sinResultado();
    }
    this.enCurso.set(true);
    const semana = this.semana();
    try {
      const r = await completarConFlash({
        entrada: () => this.mealService.entradaArmador(),
        completar: (azar, preferidas, esperada) => this.mealService.completarSemana(azar, preferidas, esperada),
        pedir: this.pedir,
        ...this.datos(),
      });
      if (r.nuevas.length > 0 && this.semana() === semana) {
        this.sugeridas.set(r.nuevas);
      }
      return r;
    } finally {
      this.enCurso.set(false);
    }
  }

  // Hasta 3 recetas que sumen plantas a la semana mostrada. Devuelve el error, o null.
  async sugerir(): Promise<string | null> {
    if (this.enCurso() || !this.puede()) {
      return null;
    }
    this.enCurso.set(true);
    const semana = this.semana();
    try {
      const { semana: dias, tipos, ctx } = this.mealService.entradaArmador();
      const { paisNombre, noComo, nombresExistentes } = this.datos();
      const p: PedidoRecetas = {
        modo: 'plantas',
        tipos,
        plantasDeLaSemana: plantasDeLaSemana(dias, ctx.meals, ctx.indice).plantas,
      };
      const raw = await this.pedir(
        esquemaRecetasNuevas(p),
        promptRecetasNuevas(p, ctx.estacion, paisNombre, noComo, nombresExistentes),
      );
      if (this.semana() === semana) {
        this.sugeridas.set(validarRecetasNuevas(raw, p, new Map(), noComo, ctx.indice, nombresExistentes));
      }
      return null;
    } catch (error) {
      return mensajeDeError(error);
    } finally {
      this.enCurso.set(false);
    }
  }

  usar(i: number): 'puesta' | 'guardada' {
    return this.mealService.usarRecetaNueva(this.quitar(i));
  }

  guardar(i: number): void {
    this.mealService.guardarRecetaParaDespues(this.quitar(i));
  }

  descartar(i: number): void {
    this.quitar(i);
  }

  private quitar(i: number): RecetaNueva {
    const r = this.sugeridas()[i];
    this.sugeridas.update((lista) => lista.filter((_, j) => j !== i));
    return r;
  }

  private datos(): { paisNombre: string; noComo: string[]; nombresExistentes: string[] } {
    const pais = this.mealService.paisEfectivo();
    return {
      paisNombre: PAISES.find((p) => p.id === pais)?.nombre ?? pais,
      noComo: this.mealService.noComo(),
      nombresExistentes: this.mealService.meals().map((m) => m.name),
    };
  }
}
