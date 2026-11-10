import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { FirebaseApp } from '@angular/fire/app';

import { PAISES } from '../armador/estacion';
import { completarConFlash, ERROR_ARMADOR, ResultadoFlash, sinResultado } from '../armador/flujo-flash';
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
      if (this.semana() !== semana) {
        return { ...r, nuevas: [] };
      }
      // Se suman a las pendientes: pedir más no borra lo que todavía no resolviste.
      this.sugeridas.update((lista) => [...lista, ...r.nuevas]);
      return r;
    } catch (error) {
      return { ...sinResultado(), error: mensajeDeError(error, ERROR_ARMADOR) };
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
      if (tipos.length === 0) {
        return 'No hay comidas visibles para sugerir.';
      }
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
        const nuevas = validarRecetasNuevas(raw, p, new Map(), noComo, ctx.indice, nombresExistentes);
        this.sugeridas.update((lista) => [...lista, ...nuevas]);
      }
      return null;
    } catch (error) {
      return mensajeDeError(error, ERROR_ARMADOR);
    } finally {
      this.enCurso.set(false);
    }
  }

  // Un índice que ya no está (doble clic, lista que cambió) no hace nada: null.
  usar(i: number): 'puesta' | 'guardada' | null {
    const r = this.quitar(i);
    return r && this.mealService.usarRecetaNueva(r);
  }

  guardar(i: number): void {
    const r = this.quitar(i);
    if (r) {
      this.mealService.guardarRecetaParaDespues(r);
    }
  }

  descartar(i: number): void {
    this.quitar(i);
  }

  private quitar(i: number): RecetaNueva | null {
    const r = this.sugeridas()[i] ?? null;
    if (r) {
      this.sugeridas.update((lista) => lista.filter((_, j) => j !== i));
    }
    return r;
  }

  private datos(): { paisNombre: string; noComo: string[]; nombresExistentes: string[] } {
    const pais = this.mealService.paisEfectivo();
    return {
      paisNombre: PAISES.find((p) => p.id === pais)?.nombre ?? pais,
      noComo: this.mealService.noComo(),
      // Las pendientes también: un pedido nuevo no repite una que todavía no resolviste.
      nombresExistentes: [...this.mealService.meals(), ...this.sugeridas()].map((m) => m.name),
    };
  }
}
