import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { MealService } from '../../services/meal.service';
import { GuiaComponent } from './guia.component';

describe('GuiaComponent: accesibilidad', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [GuiaComponent],
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  const render = (): HTMLElement => {
    const fixture = TestBed.createComponent(GuiaComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('los campos para agregar tienen nombre accesible', () => {
    const inputs = [...render().querySelectorAll('.agregar input')];
    expect(inputs.map((i) => i.getAttribute('aria-label'))).toEqual(['Tu regla', 'Por qué (opcional)']);
  });

  it('cada Ocultar y Borrar dice de qué regla es', () => {
    TestBed.inject(MealService).agregarReglaPropia('Mate sin azúcar');
    const el = render();
    const labels = [...el.querySelectorAll('.grupo li button')].map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain('Borrar: Mate sin azúcar');
    expect(labels).toContain('Ocultar: Anotar lo que se come.');
  });

  it('el desplegable de ocultas avisa si está abierto', () => {
    TestBed.inject(MealService).ocultarRegla('ayuno');
    const fixture = TestBed.createComponent(GuiaComponent);
    fixture.detectChanges();
    const boton = (fixture.nativeElement as HTMLElement).querySelector('.ocultas .btn-link')!;
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    (boton as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
  });
});
