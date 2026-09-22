import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DocumentSnapshot,
  Firestore,
  getDoc,
  onSnapshot,
  setDoc,
} from '@angular/fire/firestore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Meal } from '../models/meal.model';
import { AuthService } from './auth.service';
import { MealService } from './meal.service';

vi.mock('@angular/fire/firestore', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@angular/fire/firestore')>();
  // Object.assign y no spread: esbuild compila el spread a un helper que la
  // factory hoisteada de vi.mock no encuentra.
  return Object.assign({}, original, {
    doc: vi.fn(() => ({})),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
    setDoc: vi.fn(async () => undefined),
  });
});

const comida = (id: string): Meal => ({ id, name: id, ingredients: [] });

function snapshot(
  meals: Meal[],
  hasPendingWrites = false
): DocumentSnapshot {
  return {
    exists: () => true,
    data: () => ({ meals, lastUpdated: 100 }),
    metadata: { hasPendingWrites },
  } as unknown as DocumentSnapshot;
}

// Deja correr los efectos, las promesas y el setTimeout(0) del sync.
async function asentar(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    TestBed.tick();
    await new Promise((r) => setTimeout(r, 5));
  }
}

function idsSubidos(): string[][] {
  return vi
    .mocked(setDoc)
    .mock.calls.map((c) => c[1] as { meals?: Meal[] })
    .filter((d) => d.meals)
    .map((d) => d.meals!.map((m) => m.id));
}

// La escucha en vivo, capturada para empujar snapshots desde el test.
let emitir: (snap: DocumentSnapshot) => void;

describe('MealService: sincronización', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(setDoc).mockClear();
    vi.mocked(onSnapshot).mockImplementation(((
      _ref: unknown,
      next: (snap: DocumentSnapshot) => void
    ) => {
      emitir = next;
      return (): void => undefined;
    }) as never);
    // Este dispositivo quedó atrás: tiene sólo 'a'. Otro dispositivo agregó
    // 'b' y ya está en la nube.
    localStorage.setItem('comidas_meals', JSON.stringify([comida('a')]));
    localStorage.setItem('comidas_last_updated', '100');

    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        // Firebase Auth restauró la sesión de IndexedDB antes de la primera
        // detección de cambios: `currentUser()` ya viene con usuario cuando
        // los efectos corren por primera vez.
        {
          provide: AuthService,
          useValue: { currentUser: signal({ uid: 'u1' }) },
        },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('al arrancar baja lo remoto y no sube el estado viejo de localStorage', async () => {
    const service = TestBed.inject(MealService);
    TestBed.tick();
    emitir(snapshot([comida('a'), comida('b')]));
    await asentar();

    expect(service.meals().map((m) => m.id)).toEqual(['a', 'b']);
    // Ninguna escritura puede haber mandado la lista sin 'b': eso es pisar
    // en la nube lo que el otro dispositivo guardó.
    for (const ids of idsSubidos()) {
      expect(ids).toContain('b');
    }
  });

  it('un cambio remoto posterior se aplica sin recargar', async () => {
    const service = TestBed.inject(MealService);
    TestBed.tick();
    emitir(snapshot([comida('a')]));
    await asentar();

    emitir(snapshot([comida('a'), comida('b')]));
    await asentar();

    expect(service.meals().map((m) => m.id)).toEqual(['a', 'b']);
    // Aplicar lo bajado no lo devuelve a la nube.
    expect(idsSubidos()).toEqual([]);
  });

  it('ignora el eco local de una escritura propia', async () => {
    const service = TestBed.inject(MealService);
    TestBed.tick();
    emitir(snapshot([comida('a')]));
    await asentar();

    emitir(snapshot([comida('z')], true));
    await asentar();

    expect(service.meals().map((m) => m.id)).toEqual(['a']);
  });

  // El reloj local decía "el remoto es más nuevo" y la bajada pisaba lo que
  // se había cargado sin red. Ahora lo pendiente vale más que lo remoto.
  it('un cambio pendiente de otra sesión no se pisa y se reenvía', async () => {
    localStorage.setItem(
      'comidas_meals',
      JSON.stringify([comida('a'), comida('c')])
    );
    localStorage.setItem('comidas_pendientes', JSON.stringify(['meals']));

    const service = TestBed.inject(MealService);
    TestBed.tick();
    emitir(snapshot([comida('a'), comida('b')]));
    await asentar();

    expect(service.meals().map((m) => m.id)).toEqual(['a', 'c']);
    expect(idsSubidos()).toEqual([['a', 'c']]);
    expect(localStorage.getItem('comidas_pendientes')).toBe('[]');
  });

  it('una escritura que falla queda pendiente para la próxima apertura', async () => {
    vi.mocked(setDoc).mockRejectedValueOnce(new Error('sin red'));
    const service = TestBed.inject(MealService);
    TestBed.tick();
    emitir(snapshot([comida('a')]));
    await asentar();

    service.addMeal({ name: 'c', ingredients: [] });
    await asentar();

    expect(JSON.parse(localStorage.getItem('comidas_pendientes')!)).toEqual([
      'meals',
    ]);
  });

  it('"Descargar de la Nube" lee una vez y aplica', async () => {
    const service = TestBed.inject(MealService);
    TestBed.tick();
    emitir(snapshot([comida('a')]));
    await asentar();
    vi.mocked(getDoc).mockResolvedValue(
      snapshot([comida('a'), comida('b')]) as never
    );

    await service.refreshData();
    await asentar();

    expect(service.meals().map((m) => m.id)).toEqual(['a', 'b']);
  });
});
