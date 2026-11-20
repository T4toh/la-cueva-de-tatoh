import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CLAVE_EN_CURSO } from '../../entrenar/en-curso';
import { EstadoEntrenar, RegistroSesion } from '../../entrenar/progresion';
import { DialogService } from '../../services/dialog.service';
import { MealService } from '../../services/meal.service';
import { EntrenarComponent } from './entrenar.component';

const facil = (n: number): RegistroSesion => ({
  fecha: `2026-11-${String(10 + n).padStart(2, '0')}T10:00:00.000Z`,
  plantilla: 'n3a',
  minutos: 40,
  completa: true,
  respuesta: 'facil',
});

const estado = (parcial: Partial<EstadoEntrenar>): EstadoEntrenar => ({
  nivel: 3,
  dosis: 0,
  ultimoDia: null,
  historial: [],
  propuestaVista: null,
  ...parcial,
});

describe('EntrenarComponent', () => {
  let entrenar: WritableSignal<EstadoEntrenar>;
  let fixture: ComponentFixture<EntrenarComponent>;
  const cambiarNivelEntrenar = vi.fn();
  const descartarPropuestaEntrenar = vi.fn();

  function montar(e: EstadoEntrenar): HTMLElement {
    entrenar = signal(e);
    TestBed.configureTestingModule({
      imports: [EntrenarComponent],
      providers: [
        provideRouter([]),
        { provide: MealService, useValue: { entrenar, cambiarNivelEntrenar, descartarPropuestaEntrenar } },
      ],
    });
    fixture = TestBed.createComponent(EntrenarComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const boton = (el: HTMLElement, texto: string): HTMLButtonElement =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;

  beforeEach(() => {
    cambiarNivelEntrenar.mockReset();
    descartarPropuestaEntrenar.mockReset();
    localStorage.clear();
  });

  it('muestra el banner de subir con dosis 2 y dos fáciles, y Subir pasa a nivel+1', () => {
    const el = montar(estado({ dosis: 2, historial: [facil(1), facil(2)] }));
    expect(el.textContent).toContain('Venís sobrado: ¿subimos al nivel 4?');
    expect(el.textContent).toContain('Nivel 3 · +2');
    boton(el, 'Subir').click();
    expect(cambiarNivelEntrenar).toHaveBeenCalledWith(4);
  });

  it('Ahora no oculta el banner', () => {
    const el = montar(estado({ dosis: 2, historial: [facil(1), facil(2)] }));
    boton(el, 'Ahora no').click();
    expect(descartarPropuestaEntrenar).toHaveBeenCalled();
    entrenar.update((e) => ({ ...e, propuestaVista: e.historial[e.historial.length - 1].fecha }));
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Venís sobrado');
  });

  it('Empezar navega con los minutos del slider', () => {
    const el = montar(estado({}));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const slider = el.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '35';
    slider.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    boton(el, 'Empezar').click();
    expect(navigate).toHaveBeenCalledWith(['/entrenar/sesion'], { queryParams: { min: 35 } });
  });

  it('historial vacío muestra "Todavía no entrenaste"', () => {
    const el = montar(estado({}));
    expect(el.textContent).toContain('Todavía no entrenaste');
  });

  describe('con una sesión en curso', () => {
    const guardada = (inicio: number): string =>
      JSON.stringify({
        minutos: 40,
        dia: 'A',
        plantillaId: 'n3a',
        dosis: 0,
        inicio,
        pausasMs: 0,
        pausaDesde: null,
        reloj: { indice: 2, finPaso: inicio + 600_000, pausadoRestante: null },
        fase: 'vivo',
        fin: null,
      });

    it('muestra Seguir en lugar de Empezar', () => {
      localStorage.setItem(CLAVE_EN_CURSO, guardada(Date.now() - 10 * 60_000));
      const el = montar(estado({}));
      expect(el.textContent).toContain('Tenés una sesión en curso');
      const seguir = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.trim() === 'Seguir');
      expect(seguir?.getAttribute('href')).toBe('/entrenar/sesion');
      expect(boton(el, 'Empezar')).toBeUndefined();
    });

    it('Descartar (confirmado) la borra y vuelve Empezar', async () => {
      localStorage.setItem(CLAVE_EN_CURSO, guardada(Date.now() - 10 * 60_000));
      const el = montar(estado({}));
      vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
      await fixture.componentInstance.descartarEnCurso();
      fixture.detectChanges();
      expect(localStorage.getItem(CLAVE_EN_CURSO)).toBeNull();
      expect(boton(el, 'Empezar')).toBeDefined();
    });

    it('una de hace más de 6 h no cuenta', () => {
      localStorage.setItem(CLAVE_EN_CURSO, guardada(Date.now() - 7 * 60 * 60_000));
      const el = montar(estado({}));
      expect(el.textContent).not.toContain('Tenés una sesión en curso');
      expect(localStorage.getItem(CLAVE_EN_CURSO)).toBeNull();
    });
  });
});
