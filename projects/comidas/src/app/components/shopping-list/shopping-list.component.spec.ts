import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { MealService } from '../../services/meal.service';
import { ShoppingListComponent } from './shopping-list.component';

describe('ShoppingListComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ShoppingListComponent],
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  // Media cebolla el lunes y la despensa la cubre entera. Hoy en el lunes,
  // después del ngOnInit que lo pone en la fecha real.
  const render = (): { fixture: ComponentFixture<ShoppingListComponent>; el: HTMLElement } => {
    const fixture = TestBed.createComponent(ShoppingListComponent);
    fixture.detectChanges();
    const service = TestBed.inject(MealService);
    service.todayTimestamp.set(service.currentWeekStart().getTime());
    service.addMeal({ name: 'Tarta', ingredients: [{ name: 'cebolla', quantity: '0.5', unit: 'unidad' }] });
    service.setMeal('Lunes', 'almuerzo', service.meals().find((m) => m.name === 'Tarta')!.id);
    service.addToPantry('cebolla', '1 unidad');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('un clic que no cambia nada deja la casilla como el ítem, por góndola', () => {
    const { fixture, el } = render();
    const casilla = el.querySelector<HTMLInputElement>('.list-groups input[type=checkbox]')!;
    expect(casilla.checked).toBe(true);

    casilla.click();
    fixture.detectChanges();

    expect(casilla.checked).toBe(true);
  });

  it('un clic que no cambia nada deja la casilla como el ítem, por día', () => {
    const { fixture, el } = render();
    const casilla = el.querySelector<HTMLInputElement>('app-lista-por-dia .pantalla input[type=checkbox]')!;
    expect(casilla.checked).toBe(true);

    casilla.click();
    fixture.detectChanges();
    expect(casilla.checked).toBe(true);

    casilla.click();
    fixture.detectChanges();
    expect(casilla.checked).toBe(true);
  });

  it('la impresión por día lleva la semana, como la de góndola', () => {
    const { el } = render();
    const rango = TestBed.inject(MealService).weekRangeDisplay();

    expect(el.querySelector('app-lista-por-dia .impresion .print-date-range')?.textContent?.trim()).toBe(rango);
  });
});
