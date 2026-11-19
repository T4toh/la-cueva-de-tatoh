import { Component, computed, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Necesidad } from '../../entrenar/modelo';
import { plantillaDe } from '../../entrenar/plantillas';
import { esCompleta, proximoDia, Respuesta } from '../../entrenar/progresion';
import { alcanzar, EstadoReloj, finDe, restante } from '../../entrenar/reloj';
import { armarSesion, minutosValidos } from '../../entrenar/sesion';
import { MealService } from '../../services/meal.service';

type Fase = 'previa' | 'vivo' | 'fin';

const TEXTO_NECESIDAD: Record<Necesidad, string> = {
  banco: 'un escalón o banco',
  piso: '2 m² de piso',
  pared: 'una pared',
  'tramo-trote': 'un tramo donde puedas trotar',
};

const TICK_MS = 250;

@Component({
  selector: 'app-entrenar-sesion',
  templateUrl: './entrenar-sesion.component.html',
  styleUrl: './entrenar-sesion.component.scss',
})
export class EntrenarSesionComponent implements OnDestroy {
  private readonly meal = inject(MealService);
  private readonly router = inject(Router);

  readonly minutos = minutosValidos(inject(ActivatedRoute).snapshot.queryParamMap.get('min'));
  private readonly dia = proximoDia(this.meal.entrenar());
  private readonly plantilla = plantillaDe(this.meal.entrenar().nivel, this.dia);
  readonly sesion = armarSesion(this.plantilla, this.meal.entrenar().dosis, this.minutos);
  readonly diaTexto = this.dia;
  readonly necesita = this.sesion.necesita.map((n) => TEXTO_NECESIDAD[n]).join(', ');
  readonly bloques = this.plantilla.bloques.map((b) =>
    b.tipo === 'circuito' ? `Circuito de ${b.vueltas} vuelta(s)` : this.nombreBloque(b.tipo)
  );

  readonly fase = signal<Fase>('previa');
  readonly reloj = signal<EstadoReloj>({ indice: 0, finPaso: null, pausadoRestante: null });
  private readonly ahora = signal(Date.now());
  readonly minutosReales = signal(0);

  readonly paso = computed(() => this.sesion.pasos[this.reloj().indice]);
  readonly siguiente = computed(() => this.sesion.pasos[this.reloj().indice + 1]);
  readonly numero = computed(() => Math.min(this.reloj().indice + 1, this.sesion.pasos.length));
  readonly pausado = computed(() => this.reloj().pausadoRestante !== null);
  readonly segundosRestantes = computed(() => Math.ceil(restante(this.reloj(), this.ahora()) / 1000));
  readonly cuenta = computed(() => {
    const s = this.segundosRestantes();
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
  });

  private inicio = 0;
  private pausasMs = 0;
  private pausaDesde = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private audio: AudioContext | null = null;
  private sentinel: WakeLockSentinel | null = null;
  // Cae apenas termina o se cierra la sesión: un pedido de lock en vuelo no debe quedarse con la pantalla.
  private conLock = false;

  private nombreBloque(tipo: string): string {
    return tipo === 'caminata' ? 'Caminata' : 'Movilidad';
  }

  arrancar(): void {
    const ahora = Date.now();
    this.crearAudio();
    this.conLock = true;
    this.inicio = ahora;
    this.ahora.set(ahora);
    this.reloj.set({ indice: 0, finPaso: finDe(this.sesion.pasos[0], ahora), pausadoRestante: null });
    this.fase.set('vivo');
    this.senal();
    void this.pedirWakeLock();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick(): void {
    this.avanzarHasta(Date.now());
  }

  private avanzarHasta(ahora: number): void {
    this.ahora.set(ahora);
    const previo = this.reloj();
    const nuevo = alcanzar(this.sesion.pasos, previo, ahora);
    if (nuevo === previo) {
      return;
    }
    this.reloj.set(nuevo);
    this.alCambiarIndice(previo.indice, nuevo.indice, nuevo.finPaso ?? ahora);
  }

  // `momento`: cuándo terminó la sesión, que con la pantalla apagada no es "ahora".
  private alCambiarIndice(antes: number, despues: number, momento: number): void {
    if (despues === antes) {
      return;
    }
    this.senal();
    if (despues >= this.sesion.pasos.length) {
      this.terminar(momento);
    }
  }

  listo(): void {
    const ahora = Date.now();
    const indice = this.reloj().indice + 1;
    this.cerrarPausa(ahora);
    this.ahora.set(ahora);
    this.reloj.set({ indice, finPaso: finDe(this.sesion.pasos[indice], ahora), pausadoRestante: null });
    this.alCambiarIndice(indice - 1, indice, ahora);
  }

  private cerrarPausa(ahora: number): void {
    if (this.pausado()) {
      this.pausasMs += ahora - this.pausaDesde;
    }
  }

  pausaOSeguir(): void {
    const ahora = Date.now();
    const r = this.reloj();
    if (r.pausadoRestante === null) {
      this.pausaDesde = ahora;
      this.reloj.set({ ...r, pausadoRestante: restante(r, ahora) });
      return;
    }
    this.cerrarPausa(ahora);
    const finPaso = r.finPaso === null ? null : ahora + r.pausadoRestante;
    this.reloj.set({ indice: r.indice, finPaso, pausadoRestante: null });
  }

  terminar(ahora = Date.now()): void {
    if (this.fase() !== 'vivo') {
      return;
    }
    const enPausa = this.pausado() ? ahora - this.pausaDesde : 0;
    const reales = (ahora - this.inicio - this.pausasMs - enPausa) / 60000;
    this.detener();
    if (reales < 1) {
      void this.router.navigate(['/entrenar']);
      return;
    }
    this.minutosReales.set(reales);
    this.fase.set('fin');
  }

  responder(respuesta: Respuesta): void {
    const reales = this.minutosReales();
    this.meal.registrarSesion(
      {
        fecha: new Date().toISOString(),
        plantilla: this.plantilla.id,
        minutos: Math.round(reales),
        completa: esCompleta(reales, this.minutos),
        respuesta,
      },
      this.dia
    );
    void this.router.navigate(['/entrenar']);
  }

  private detener(): void {
    this.conLock = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    void this.soltarWakeLock();
  }

  ngOnDestroy(): void {
    this.detener();
    void this.audio?.close?.();
  }

  // Con la pantalla apagada el intervalo se frena: al volver hay que ponerse al día.
  @HostListener('document:visibilitychange')
  alCambiarVisibilidad(): void {
    if (document.visibilityState === 'visible' && this.fase() === 'vivo') {
      this.avanzarHasta(Date.now());
      if (this.fase() === 'vivo') {
        void this.pedirWakeLock();
      }
    }
  }

  private crearAudio(): void {
    try {
      if (typeof AudioContext !== 'undefined') {
        this.audio = new AudioContext();
      }
    } catch {
      this.audio = null;
    }
  }

  private senal(): void {
    try {
      navigator.vibrate?.(200);
    } catch {
      // Sin vibración: no pasa nada.
    }
    this.beep();
  }

  private beep(): void {
    const ctx = this.audio;
    if (!ctx) {
      return;
    }
    try {
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Sin audio: no pasa nada.
    }
  }

  private async pedirWakeLock(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator) || this.sentinel) {
      return;
    }
    try {
      const obtenido = await navigator.wakeLock.request('screen');
      if (!this.conLock) {
        await obtenido.release();
        return;
      }
      this.sentinel = obtenido;
      obtenido.addEventListener('release', () => {
        this.sentinel = null;
      });
    } catch {
      this.sentinel = null;
    }
  }

  private async soltarWakeLock(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = null;
    try {
      await sentinel?.release();
    } catch {
      // Ya estaba suelto.
    }
  }
}
