import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { borrarEnCurso, leerEnCurso } from '../../entrenar/en-curso';
import { propuestaNivel, proximoDia, Respuesta } from '../../entrenar/progresion';
import { DialogService } from '../../services/dialog.service';
import { MealService } from '../../services/meal.service';

const NIVELES = [1, 2, 3, 4, 5, 6];
const MAX_VISIBLES = 10;
const ETIQUETA_RESPUESTA: Record<Respuesta, string> = { facil: 'Fácil', bien: 'Bien', mato: 'Me mató' };
const RESUMEN_DIA = { A: 'Día A · caminata y fuerza', B: 'Día B · caminata y movilidad' };

@Component({
  selector: 'app-entrenar',
  imports: [RouterLink],
  templateUrl: './entrenar.component.html',
  styleUrl: './entrenar.component.scss',
})
export class EntrenarComponent {
  private readonly meal = inject(MealService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);

  readonly niveles = NIVELES;
  readonly minutos = signal(60);
  // Una sesión que quedó a medias (de las últimas 6 h): se sigue en vez de empezar otra.
  readonly enCurso = signal(leerEnCurso(Date.now()) !== null);

  readonly estado = this.meal.entrenar;
  readonly nivelTexto = computed(() => {
    const { nivel, dosis } = this.estado();
    if (dosis === 0) {
      return `Nivel ${nivel}`;
    }
    return `Nivel ${nivel} · ${dosis > 0 ? '+' : '−'}${Math.abs(dosis)}`;
  });
  readonly propuesta = computed(() => propuestaNivel(this.estado()));
  readonly resumenHoy = computed(() => RESUMEN_DIA[proximoDia(this.estado())]);
  readonly historial = computed(() =>
    this.estado()
      .historial.slice(-MAX_VISIBLES)
      .reverse()
      .map((r) => ({
        fecha: new Date(r.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
        plantilla: this.nombrePlantilla(r.plantilla),
        minutos: r.minutos,
        respuesta: ETIQUETA_RESPUESTA[r.respuesta],
        completa: r.completa,
      }))
  );

  cambiarNivel(nivel: number): void {
    this.meal.cambiarNivelEntrenar(nivel);
  }

  aceptarPropuesta(): void {
    const delta = this.propuesta() === 'subir' ? 1 : -1;
    this.meal.cambiarNivelEntrenar(this.estado().nivel + delta);
  }

  ahoraNo(): void {
    this.meal.descartarPropuestaEntrenar();
  }

  cambiarMinutos(valor: string): void {
    this.minutos.set(Number(valor));
  }

  async descartarEnCurso(): Promise<void> {
    if (await this.dialog.confirm('¿Descartar la sesión?', 'Lo que hiciste en esa sesión no se guarda.')) {
      borrarEnCurso();
      this.enCurso.set(false);
    }
  }

  empezar(): void {
    void this.router.navigate(['/entrenar/sesion'], { queryParams: { min: this.minutos() } });
  }

  // El id es "n3a": nivel 3, día A.
  private nombrePlantilla(id: string): string {
    const m = /^n(\d)([ab])$/.exec(id);
    return m ? `Nivel ${m[1]} · Día ${m[2].toUpperCase()}` : id;
  }
}
