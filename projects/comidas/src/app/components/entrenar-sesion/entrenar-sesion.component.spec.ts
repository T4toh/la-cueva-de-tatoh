import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirebaseApp } from '@angular/fire/app';
import { Firestore } from '@angular/fire/firestore';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
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
});
