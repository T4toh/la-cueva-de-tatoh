import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirebaseApp } from '@angular/fire/app';
import { Firestore } from '@angular/fire/firestore';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ResultadoFlash, sinResultado } from '../../armador/flujo-flash';
import { ArmadorFlashService } from '../../services/armador-flash.service';
import { AuthService } from '../../services/auth.service';
import { MealService } from '../../services/meal.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent: completar semana', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: FirebaseApp, useValue: {} },
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('el aviso de lo puesto se va al cambiar de semana', () => {
    const service = TestBed.inject(MealService);
    service.addMeal({ name: 'Guiso', tags: ['almuerzo'], ingredients: [] });
    const dashboard = TestBed.createComponent(DashboardComponent).componentInstance;

    dashboard.completarSemana();
    expect(dashboard.aviso()).toMatch(/^Puse /);

    service.nextWeek();
    expect(dashboard.aviso()).toBe('');
    service.previousWeek();
    expect(dashboard.aviso()).toBe('');
  });

  it('el aviso de Flash dice todo lo que se manda', () => {
    // jsdom no trae matchMedia y el salto a hoy lo usa al renderizar.
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('.flash-aviso')?.textContent ?? '';
    const partes = ['candidatas', 'la semana', 'No como', 'los nombres de tus recetas', 'tu país', 'la estación'];
    for (const parte of [...partes, 'sólo cuando tocás el botón']) {
      expect(aviso).toContain(parte);
    }
  });
});

describe('DashboardComponent: completar con Flash', () => {
  let responder: (r: ResultadoFlash) => void;
  const armando = signal(false);

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    armando.set(false);
    const flash = {
      armando,
      puede: signal(true),
      nuevas: signal([]),
      completar: (): Promise<ResultadoFlash> => new Promise((ok) => (responder = ok)),
    };
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: FirebaseApp, useValue: {} },
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: ArmadorFlashService, useValue: flash },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  const puso = (cambioSemana = false): ResultadoFlash => ({ ...sinResultado(), puestos: 2, deFlash: 1, cambioSemana });

  it('en la misma semana avisa lo puesto', async () => {
    const dashboard = TestBed.createComponent(DashboardComponent).componentInstance;
    const listo = dashboard.completarConFlash();
    responder(puso());
    await listo;
    expect(dashboard.aviso()).toMatch(/^Puse 2 comidas/);
  });

  it('si cambió la semana mientras Flash pensaba, no avisa en la nueva', async () => {
    const service = TestBed.inject(MealService);
    const dashboard = TestBed.createComponent(DashboardComponent).componentInstance;
    const listo = dashboard.completarConFlash();
    service.nextWeek();
    responder(puso());
    await listo;
    expect(dashboard.aviso()).toBe('');
    expect(dashboard.estadoFlash()).toBe('');
  });

  it('si Flash no puso nada por el cambio de semana, lo dice', async () => {
    const service = TestBed.inject(MealService);
    const dashboard = TestBed.createComponent(DashboardComponent).componentInstance;
    const listo = dashboard.completarConFlash();
    service.nextWeek();
    responder({ ...sinResultado(), cambioSemana: true });
    await listo;
    expect(dashboard.aviso()).toBe('');
    expect(dashboard.estadoFlash()).toMatch(/^Cambiaste de semana/);
  });

  it('"Completar semana" queda deshabilitado mientras Flash arma', () => {
    TestBed.inject(MealService).addMeal({ name: 'Guiso', tags: ['almuerzo'], ingredients: [] });
    const fixture = TestBed.createComponent(DashboardComponent);
    const boton = (): HTMLButtonElement | undefined =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')]
        .find((b) => b.textContent?.trim() === 'Completar semana');
    fixture.detectChanges();
    expect(boton()?.disabled).toBe(false);
    armando.set(true);
    fixture.detectChanges();
    expect(boton()?.disabled).toBe(true);
  });
});
