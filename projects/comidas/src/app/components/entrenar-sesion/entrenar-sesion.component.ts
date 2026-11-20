import { Component, computed, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, CanDeactivateFn, Router, RouterLink } from '@angular/router';

import { TEXTO_NECESIDAD } from '../../entrenar/ejercicios';
import { borrarEnCurso, EnCurso, guardarEnCurso, leerEnCurso, plantillaPorId } from '../../entrenar/en-curso';
import { plantillaDe } from '../../entrenar/plantillas';
import { esCompleta, proximoDia, Respuesta } from '../../entrenar/progresion';
import { alcanzar, EstadoReloj, finDe, restante } from '../../entrenar/reloj';
import { armarSesion, minutosValidos, resumenPrevia, segundosDesde, textoCantidad } from '../../entrenar/sesion';
import { DialogService } from '../../services/dialog.service';
import { MealService } from '../../services/meal.service';
import { EntrenarPreviaComponent } from '../entrenar-previa/entrenar-previa.component';
import { FiguraComponent } from '../figura/figura.component';

type Fase = 'previa' | 'vivo' | 'fin';

const TICK_MS = 250;

@Component({
  selector: 'app-entrenar-sesion',
  imports: [EntrenarPreviaComponent, FiguraComponent, RouterLink],
  templateUrl: './entrenar-sesion.component.html',
  styleUrl: './entrenar-sesion.component.scss',
})
export class EntrenarSesionComponent implements OnDestroy {
  private readonly meal = inject(MealService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);

  // Una sesión que quedó a medias (atrás, otra pestaña, reload) manda sobre la URL.
  private readonly guardada = leerEnCurso(Date.now());
  readonly minutos =
    this.guardada?.minutos ?? minutosValidos(inject(ActivatedRoute).snapshot.queryParamMap.get('min'));
  private readonly dia = this.guardada?.dia ?? proximoDia(this.meal.entrenar());
  private readonly plantilla =
    (this.guardada && plantillaPorId(this.guardada.plantillaId)) ?? plantillaDe(this.meal.entrenar().nivel, this.dia);
  private readonly dosis = this.guardada?.dosis ?? this.meal.entrenar().dosis;
  readonly sesion = armarSesion(this.plantilla, this.dosis, this.minutos);
  readonly diaTexto = this.dia;
  readonly necesita = this.sesion.necesita.map((n) => TEXTO_NECESIDAD[n]).join(', ');
  readonly previa = resumenPrevia(this.sesion).map((b) => ({ ...b, duracion: this.duracion(b.segundos) }));
  readonly textoCantidad = textoCantidad;

  readonly fase = signal<Fase>('previa');
  readonly reloj = signal<EstadoReloj>({ indice: 0, finPaso: null, pausadoRestante: null });
  private readonly ahora = signal(Date.now());
  readonly minutosReales = signal(0);

  readonly paso = computed(() => this.sesion.pasos[this.reloj().indice]);
  readonly siguiente = computed(() => this.sesion.pasos[this.reloj().indice + 1]);
  // Primer paso del bloque que sigue al actual; undefined en el último bloque.
  private readonly proximoBloque = computed(() => {
    const i = this.reloj().indice;
    const actual = this.sesion.pasos[i]?.bloque;
    const j = this.sesion.pasos.findIndex((x, k) => k > i && x.bloque !== actual);
    return j === -1 ? undefined : j;
  });
  readonly hayOtroBloque = computed(() => this.proximoBloque() !== undefined);
  readonly numero = computed(() => Math.min(this.reloj().indice + 1, this.sesion.pasos.length));
  readonly pausado = computed(() => this.reloj().pausadoRestante !== null);
  readonly segundosRestantes = computed(() => Math.ceil(restante(this.reloj(), this.ahora()) / 1000));
  readonly cuenta = computed(() => {
    const s = this.segundosRestantes();
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
  });

  private inicio = 0;
  // Paso desde el que se arrancó: lo que quedaba antes no cuenta para saber si la sesión fue completa.
  private desde = 0;
  private pausasMs = 0;
  private pausaDesde = 0;
  private fin: number | null = null;
  // Ya se registró o se descartó: no hay nada más que responder ni que cuidar al salir.
  private cerrada = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private audio: AudioContext | null = null;
  private sentinel: WakeLockSentinel | null = null;
  // Cae apenas termina o se cierra la sesión: un pedido de lock en vuelo no debe quedarse con la pantalla.
  private conLock = false;

  constructor() {
    if (this.guardada) {
      this.retomar(this.guardada);
    }
  }

  private duracion(segundos: number): string {
    return `${Math.max(1, Math.round(segundos / 60))} min`;
  }

  private retomar(g: EnCurso): void {
    const n = this.sesion.pasos.length;
    const indiceOk = g.fase === 'vivo' ? g.reloj.indice < n : g.fin !== null;
    if (!indiceOk) {
      borrarEnCurso();
      return;
    }
    this.inicio = g.inicio;
    this.desde = g.desde ?? 0;
    this.pausasMs = g.pausasMs;
    this.pausaDesde = g.pausaDesde ?? 0;
    this.reloj.set(g.reloj);
    if (g.fase === 'fin' && g.fin !== null) {
      this.fin = g.fin;
      this.minutosReales.set((g.fin - g.inicio - g.pausasMs) / 60000);
      this.fase.set('fin');
      return;
    }
    // El AudioContext se crea en el próximo toque: sin gesto del usuario no suena.
    this.conLock = true;
    this.fase.set('vivo');
    this.avanzarHasta(Date.now());
    if (this.fase() === 'vivo') {
      void this.pedirWakeLock();
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
    this.guardar();
  }

  private guardar(): void {
    const fase = this.fase();
    if (this.cerrada || fase === 'previa') {
      return;
    }
    guardarEnCurso({
      minutos: this.minutos,
      dia: this.dia,
      plantillaId: this.plantilla.id,
      dosis: this.dosis,
      inicio: this.inicio,
      desde: this.desde,
      pausasMs: this.pausasMs,
      pausaDesde: this.pausado() ? this.pausaDesde : null,
      reloj: this.reloj(),
      fase,
      fin: this.fin,
    });
  }

  // Lo llama el guard de la ruta: salir en vivo pregunta, pero no descarta (queda para retomar).
  puedeSalir(): boolean | Promise<boolean> {
    if (this.cerrada || this.fase() !== 'vivo') {
      return true;
    }
    return this.dialog.confirm('¿Salir de la sesión?', 'Queda guardada y la podés seguir desde Entrenar.');
  }

  @HostListener('document:pointerdown')
  alTocar(): void {
    if (this.fase() === 'vivo' && !this.audio) {
      this.crearAudio();
    }
  }

  arrancar(desde = 0): void {
    const ahora = Date.now();
    this.crearAudio();
    this.conLock = true;
    this.inicio = ahora;
    this.desde = Math.min(Math.max(0, desde), this.sesion.pasos.length - 1);
    this.ahora.set(ahora);
    this.reloj.set({
      indice: this.desde,
      finPaso: finDe(this.sesion.pasos[this.desde], ahora),
      pausadoRestante: null,
    });
    this.fase.set('vivo');
    this.guardar();
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
    this.guardar();
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
    this.irA(this.reloj().indice + 1);
  }

  saltearBloque(): void {
    const j = this.proximoBloque();
    if (j !== undefined) {
      this.irA(j);
    }
  }

  private irA(indice: number): void {
    if (this.fase() !== 'vivo') {
      return;
    }
    const ahora = Date.now();
    const antes = this.reloj().indice;
    this.cerrarPausa(ahora);
    this.ahora.set(ahora);
    this.reloj.set({ indice, finPaso: finDe(this.sesion.pasos[indice], ahora), pausadoRestante: null });
    this.alCambiarIndice(antes, indice, ahora);
    this.guardar();
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
      this.guardar();
      return;
    }
    this.cerrarPausa(ahora);
    const finPaso = r.finPaso === null ? null : ahora + r.pausadoRestante;
    this.reloj.set({ indice: r.indice, finPaso, pausadoRestante: null });
    this.guardar();
  }

  // El botón: con la pantalla prendida en el bolsillo, un roce no puede cortar la sesión.
  async pedirTerminar(): Promise<void> {
    if (this.fase() !== 'vivo') {
      return;
    }
    if (await this.dialog.confirm('¿Terminar la sesión?', 'Se guarda lo que hiciste hasta ahora.')) {
      this.terminar();
    }
  }

  terminar(ahora = Date.now()): void {
    if (this.fase() !== 'vivo') {
      return;
    }
    const enPausa = this.pausado() ? ahora - this.pausaDesde : 0;
    this.pausasMs += enPausa;
    const reales = (ahora - this.inicio - this.pausasMs) / 60000;
    this.detener();
    if (reales < 1) {
      this.cerrada = true;
      borrarEnCurso();
      void this.router.navigate(['/entrenar']);
      return;
    }
    this.fin = ahora;
    this.minutosReales.set(reales);
    this.fase.set('fin');
    this.guardar();
  }

  responder(respuesta: Respuesta): void {
    // Un doble toque no puede registrar dos veces (y mover la dosis de a 2).
    if (this.fase() !== 'fin' || this.cerrada) {
      return;
    }
    this.cerrada = true;
    borrarEnCurso();
    const reales = this.minutosReales();
    this.meal.registrarSesion(
      {
        fecha: new Date().toISOString(),
        plantilla: this.plantilla.id,
        minutos: Math.round(reales),
        completa: esCompleta(reales, this.planeados()),
        respuesta,
      },
      this.dia
    );
    void this.router.navigate(['/entrenar']);
  }

  // Si arrancó en el medio, lo planeado es lo que quedaba desde ahí.
  private planeados(): number {
    return this.desde === 0 ? this.minutos : segundosDesde(this.sesion, this.desde) / 60;
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
      // Android suspende el contexto al ir a segundo plano: sin resume, el beep sale mudo.
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }
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

export const salirDeSesion: CanDeactivateFn<EntrenarSesionComponent> = (c) => c.puedeSalir();
