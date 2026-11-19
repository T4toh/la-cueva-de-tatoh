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
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
