import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FirebaseApp } from '@angular/fire/app';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EntradaArmador } from '../armador/armador';
import { indexar } from '../catalogo/catalogo';
import { CATALOGO } from '../catalogo/catalogo-datos';
import { ArmadorFlashService } from './armador-flash.service';
import { AuthService } from './auth.service';
import { PedirJson } from './flash';
import { MealService } from './meal.service';

const indice = indexar(CATALOGO);
const cruda = (name: string, clave?: string): Record<string, unknown> => ({
  name,
  tipo: 'almuerzo',
  tags: [],
  pasos: [],
  ingredients: [{ name: 'lentejas', quantity: '1', unit: 'taza' }],
  ...(clave ? { clave } : {}),
});
// Un lunes con el almuerzo vacío y sin candidatos: "Completar con Flash" pide una receta para ese hueco.
const entrada: EntradaArmador = {
  key: '2026-11-09',
  semana: [{
    dayName: 'Lunes', desayuno: [], almuerzo: [], postreAlmuerzo: null, colacion: null, cena: [], postreCena: null,
  }],
  desde: 0,
  tipos: ['almuerzo'],
  candidatos: { desayuno: [], almuerzo: [], cena: [] },
  ctx: { meals: [], indice, despensa: [], recientes: new Set(), estacion: 'primavera', reglasOcultas: new Set() },
};

describe('ArmadorFlashService', () => {
  const meal = {
    currentWeekStart: signal(new Date(2026, 10, 9)),
    entradaArmador: (): EntradaArmador => entrada,
    completarSemana: (): unknown => ({ puestos: 0, sinCandidatos: 1, deFlash: 0 }),
    paisEfectivo: (): string => 'AR',
    noComo: (): string[] => [],
    meals: (): unknown[] => [],
    usarRecetaNueva: vi.fn((): 'puesta' => 'puesta'),
    guardarRecetaParaDespues: vi.fn(),
  };
  const pedir = vi.fn<PedirJson>();
  let flash: ArmadorFlashService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FirebaseApp, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal({ uid: 'u' }) } },
        { provide: MealService, useValue: meal },
      ],
    });
    flash = TestBed.inject(ArmadorFlashService);
    // El pedido real va a Firebase AI; acá se reemplaza por el doble.
    (flash as unknown as { pedir: PedirJson }).pedir = pedir;
    TestBed.tick();
  });

  afterEach(() => {
    pedir.mockReset();
    vi.clearAllMocks();
  });

  it('"Sugerime algo nuevo" suma a las sugerencias pendientes, no las pisa', async () => {
    pedir.mockResolvedValueOnce({ recetas: [cruda('Guiso de lentejas')] });
    await flash.sugerir();
    pedir.mockResolvedValueOnce({ recetas: [cruda('Hamburguesas de lentejas')] });
    await flash.sugerir();
    expect(flash.nuevas().map((r) => r.name)).toEqual(['Guiso de lentejas', 'Hamburguesas de lentejas']);
  });

  it('las recetas de "Completar con Flash" también se suman', async () => {
    pedir.mockResolvedValueOnce({ recetas: [cruda('Guiso de lentejas')] });
    await flash.sugerir();
    pedir.mockResolvedValueOnce({ recetas: [cruda('Tarta de lentejas', 'Lunes-almuerzo')] });
    await flash.completar();
    expect(flash.nuevas().map((r) => r.name)).toEqual(['Guiso de lentejas', 'Tarta de lentejas']);
  });

  it('un índice fuera de rango no toca el recetario ni la lista', async () => {
    pedir.mockResolvedValueOnce({ recetas: [cruda('Guiso de lentejas')] });
    await flash.sugerir();
    expect(flash.usar(5)).toBeNull();
    flash.guardar(5);
    flash.descartar(-1);
    expect(meal.usarRecetaNueva).not.toHaveBeenCalled();
    expect(meal.guardarRecetaParaDespues).not.toHaveBeenCalled();
    expect(flash.nuevas()).toHaveLength(1);
  });
});
