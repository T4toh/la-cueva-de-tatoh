import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore, getDoc, setDoc } from '@angular/fire/firestore';
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
    setDoc: vi.fn(async () => undefined),
  });
});

const comida = (id: string): Meal => ({ id, name: id, ingredients: [] });

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

describe('MealService: arranque con la sesión ya restaurada', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(setDoc).mockClear();
    // Este dispositivo quedó atrás: tiene sólo 'a'. Otro dispositivo agregó
    // 'b' y ya está en la nube.
    localStorage.setItem('comidas_meals', JSON.stringify([comida('a')]));
    localStorage.setItem('comidas_last_updated', '100');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ meals: [comida('a'), comida('b')], lastUpdated: 100 }),
    } as never);

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

  it('baja lo remoto y no sube el estado viejo de localStorage', async () => {
    const service = TestBed.inject(MealService);
    await asentar();

    expect(service.meals().map((m) => m.id)).toEqual(['a', 'b']);
    // Ninguna escritura puede haber mandado la lista sin 'b': eso es pisar
    // en la nube lo que el otro dispositivo guardó.
    for (const ids of idsSubidos()) {
      expect(ids).toContain('b');
    }
  });
});
