import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirebaseApp } from '@angular/fire/app';
import { Firestore } from '@angular/fire/firestore';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
