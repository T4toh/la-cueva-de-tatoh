import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

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
});
