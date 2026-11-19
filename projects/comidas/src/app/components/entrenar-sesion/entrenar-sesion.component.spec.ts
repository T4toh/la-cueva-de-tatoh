import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirebaseApp } from '@angular/fire/app';
import { Firestore } from '@angular/fire/firestore';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CLAVE_EN_CURSO } from '../../entrenar/en-curso';
import { alcanzar } from '../../entrenar/reloj';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { MealService } from '../../services/meal.service';
import { EntrenarSesionComponent } from './entrenar-sesion.component';

const INICIO = new Date('2026-11-19T10:00:00Z');

function crear(min: string | null): EntrenarSesionComponent {
  TestBed.configureTestingModule({
    imports: [EntrenarSesionComponent],
    providers: [
      provideRouter([]),
      { provide: FirebaseApp, useValue: {} },
      { provide: Firestore, useValue: {} },
      { provide: AuthService, useValue: { currentUser: signal(null) } },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(min === null ? {} : { min }) } },
      },
    ],
  });
  return TestBed.createComponent(EntrenarSesionComponent).componentInstance;
}

describe('EntrenarSesionComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(INICIO);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('?min=abc arma una sesión de 60 minutos', () => {
    expect(crear('abc').minutos).toBe(60);
  });

  it('sin wakeLock, vibrate ni AudioContext, arrancar y avanzar no tira errores', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('AudioContext', undefined);
    const c = crear('20');
    expect(() => {
      c.arrancar();
      vi.advanceTimersByTime(10 * 60_000);
      c.terminar();
    }).not.toThrow();
  });

  it('al pasar de paso vibra 200 ms', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const c = crear('20');
    c.arrancar();
    vibrate.mockClear();
    const primero = c.sesion.pasos[0];
    expect(primero.medida).toBe('segundos');
    vi.advanceTimersByTime(primero.cantidad * 1000 + 500);
    expect(vibrate).toHaveBeenCalledWith(200);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('terminar a los 30 s no registra', () => {
    const c = crear('40');
    const registrar = vi.spyOn(TestBed.inject(MealService), 'registrarSesion');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.arrancar();
    vi.advanceTimersByTime(30_000);
    c.terminar();
    expect(registrar).not.toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/entrenar']);
  });

  it('terminar a los 25 de 40 minutos registra completa: true con la respuesta elegida', () => {
    const c = crear('40');
    const registrar = vi.spyOn(TestBed.inject(MealService), 'registrarSesion');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.arrancar();
    vi.advanceTimersByTime(25 * 60_000);
    c.terminar();
    c.responder('bien');
    expect(registrar).toHaveBeenCalledTimes(1);
    const [registro, dia] = registrar.mock.calls[0];
    expect(registro).toMatchObject({ minutos: 25, completa: true, respuesta: 'bien' });
    expect(dia).toBe('A');
    expect(navegar).toHaveBeenCalledWith(['/entrenar']);
  });

  it('Saltear en pausa descuenta la pausa de los minutos reales', () => {
    const c = crear('20');
    const registrar = vi.spyOn(TestBed.inject(MealService), 'registrarSesion');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.arrancar();
    vi.advanceTimersByTime(2 * 60_000);
    c.pausaOSeguir();
    vi.advanceTimersByTime(10 * 60_000);
    c.listo();
    vi.advanceTimersByTime(60_000);
    c.terminar();
    c.responder('bien');
    expect(registrar.mock.calls[0][0].minutos).toBe(3);
  });

  it('si la pantalla estuvo apagada, el fin se registra cuando venció el último paso', () => {
    const c = crear('20');
    const registrar = vi.spyOn(TestBed.inject(MealService), 'registrarSesion');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.arrancar();
    vi.setSystemTime(new Date(Date.now() + 5 * 60_000));
    const pasos = c.sesion.pasos;
    for (let i = 0; i < pasos.length - 1; i++) {
      c.listo();
    }
    const ultimo = pasos[pasos.length - 1];
    expect(ultimo.medida).toBe('segundos');
    vi.setSystemTime(new Date(Date.now() + ultimo.cantidad * 1000 + 30 * 60_000));
    c.alCambiarVisibilidad();
    expect(c.fase()).toBe('fin');
    c.responder('bien');
    expect(registrar.mock.calls[0][0].minutos).toBe(Math.round(5 + ultimo.cantidad / 60));
  });

  it('al volver a la pestaña con la sesión ya terminada no pide otro wake lock', () => {
    const request = vi.fn().mockReturnValue(new Promise(() => undefined));
    vi.stubGlobal('navigator', { wakeLock: { request } });
    const c = crear('20');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.arrancar();
    vi.setSystemTime(new Date(Date.now() + 5 * 60_000));
    const pasos = c.sesion.pasos;
    for (let i = 0; i < pasos.length - 1; i++) {
      c.listo();
    }
    vi.setSystemTime(new Date(Date.now() + 90 * 60_000));
    c.alCambiarVisibilidad();
    expect(c.fase()).toBe('fin');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('un wake lock que llega después de terminar se suelta', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    let llegar: (s: unknown) => void = () => undefined;
    const request = vi.fn().mockReturnValue(
      new Promise((r) => {
        llegar = r;
      })
    );
    vi.stubGlobal('navigator', { wakeLock: { request } });
    const c = crear('20');
    c.arrancar();
    vi.advanceTimersByTime(2 * 60_000);
    c.terminar();
    llegar({ release, addEventListener: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    expect(release).toHaveBeenCalledTimes(1);
  });

  describe('sesión en curso', () => {
    function recargar(min: string | null = null): EntrenarSesionComponent {
      TestBed.resetTestingModule();
      return crear(min);
    }

    it('sobrevive a un reload y se pone al día con lo que pasó mientras tanto', () => {
      const c = crear('20');
      c.arrancar();
      const primero = c.sesion.pasos[0];
      expect(primero.medida).toBe('segundos');
      vi.advanceTimersByTime(30_000);
      const ahora = INICIO.getTime() + primero.cantidad * 1000 + 90_000;
      vi.setSystemTime(ahora);

      const r = recargar('40');
      expect(r.minutos).toBe(20);
      expect(r.fase()).toBe('vivo');
      const esperado = alcanzar(
        r.sesion.pasos,
        { indice: 0, finPaso: INICIO.getTime() + primero.cantidad * 1000, pausadoRestante: null },
        ahora
      );
      expect(r.reloj().indice).toBe(esperado.indice);
      expect(r.reloj().indice).toBeGreaterThan(0);
    });

    it('retomada, registra con los minutos desde el inicio original', () => {
      const c = crear('20');
      c.arrancar();
      vi.setSystemTime(INICIO.getTime() + 8 * 60_000);
      const r = recargar();
      const registrar = vi.spyOn(TestBed.inject(MealService), 'registrarSesion');
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      r.terminar();
      r.responder('bien');
      expect(registrar.mock.calls[0][0].minutos).toBe(8);
    });

    it('en la pantalla de fin, un reload vuelve a la pregunta', () => {
      const c = crear('20');
      c.arrancar();
      vi.advanceTimersByTime(5 * 60_000);
      c.terminar();
      const r = recargar();
      expect(r.fase()).toBe('fin');
      expect(Math.round(r.minutosReales())).toBe(5);
    });

    it('una guardada de hace más de 6 h se tira', () => {
      const c = crear('20');
      c.arrancar();
      vi.setSystemTime(INICIO.getTime() + 6 * 60 * 60_000 + 60_000);
      const r = recargar();
      expect(r.fase()).toBe('previa');
      expect(localStorage.getItem(CLAVE_EN_CURSO)).toBeNull();
    });

    it('al registrar se borra', () => {
      const c = crear('20');
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      c.arrancar();
      vi.advanceTimersByTime(5 * 60_000);
      expect(localStorage.getItem(CLAVE_EN_CURSO)).not.toBeNull();
      c.terminar();
      c.responder('bien');
      expect(localStorage.getItem(CLAVE_EN_CURSO)).toBeNull();
    });

    it('salir en vivo pregunta y, aunque salga, queda guardada', async () => {
      const c = crear('20');
      const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
      c.arrancar();
      expect(await c.puedeSalir()).toBe(true);
      expect(confirm).toHaveBeenCalledWith('¿Salir de la sesión?', 'Queda guardada y la podés seguir desde Entrenar.');
      expect(localStorage.getItem(CLAVE_EN_CURSO)).not.toBeNull();
    });

    it('sin sesión arrancada se sale sin preguntar', () => {
      expect(crear('20').puedeSalir()).toBe(true);
    });
  });

  it('Terminar cancelado sigue la sesión', async () => {
    const c = crear('20');
    const confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(false);
    c.arrancar();
    vi.advanceTimersByTime(5 * 60_000);
    await c.pedirTerminar();
    expect(confirm).toHaveBeenCalledWith('¿Terminar la sesión?', 'Se guarda lo que hiciste hasta ahora.');
    expect(c.fase()).toBe('vivo');
  });

  it('Terminar confirmado pasa a la pregunta', async () => {
    const c = crear('20');
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    c.arrancar();
    vi.advanceTimersByTime(5 * 60_000);
    await c.pedirTerminar();
    expect(c.fase()).toBe('fin');
  });

  it('un doble toque en la respuesta registra una sola vez', () => {
    const c = crear('20');
    const registrar = vi.spyOn(TestBed.inject(MealService), 'registrarSesion');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.arrancar();
    vi.advanceTimersByTime(5 * 60_000);
    c.terminar();
    c.responder('facil');
    c.responder('facil');
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('beep reanuda un AudioContext suspendido', () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    const osc = { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
    class FakeAudio {
      state = 'suspended';
      currentTime = 0;
      destination = {};
      resume = resume;
      createOscillator = (): typeof osc => osc;
      close = vi.fn();
    }
    vi.stubGlobal('AudioContext', FakeAudio);
    const c = crear('20');
    c.arrancar();
    expect(resume).toHaveBeenCalled();
  });

  it('la previa avisa que la pantalla queda prendida', () => {
    TestBed.configureTestingModule({
      imports: [EntrenarSesionComponent],
      providers: [
        provideRouter([]),
        { provide: FirebaseApp, useValue: {} },
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    });
    const f = TestBed.createComponent(EntrenarSesionComponent);
    f.detectChanges();
    const texto = (f.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Si algo duele (no cansa, duele), cortá.');
    expect(texto).toContain('La pantalla queda prendida durante la sesión.');
  });
});
