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
import { MealService, pareceBackup } from './meal.service';
import { RecetaPublicaService } from './receta-publica.service';

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

  // Al abrir la PWA, Firebase Auth tarda en resolver la sesión: valida el
  // token contra la red, así que en el celular llega después de la primera
  // detección de cambios. `currentUser` arranca en `undefined` hasta entonces.
  describe('con auth resolviendo tarde', () => {
    const usuario = signal<{ uid: string } | null | undefined>(undefined);

    beforeEach(() => {
      usuario.set(undefined);
      TestBed.overrideProvider(AuthService, {
        useValue: { currentUser: usuario },
      });
    });

    // `saveToFirestore` leía `currentUser()` adentro del efecto, así que
    // después de la primera edición el efecto dependía de la sesión. `user()`
    // emite un objeto nuevo en cada refresco del token —el primero, al volver
    // la PWA del fondo, antes de que la escucha se ponga al día—, y cada uno
    // volvía a subir el `meals` de este dispositivo, viejo, encima de lo que
    // el otro había cargado.
    it('un refresco del token no vuelve a subir lo local', async () => {
      usuario.set({ uid: 'u1' });
      const service = TestBed.inject(MealService);
      TestBed.tick();
      emitir(snapshot([comida('a')]));
      await asentar();
      service.addMeal({ name: 'c', ingredients: [] });
      await asentar();
      const subidas = idsSubidos().length;

      usuario.set({ uid: 'u1' });
      await asentar();

      expect(idsSubidos()).toHaveLength(subidas);
    });

    // Lo cargado en ese rato se descartaba como "sin sesión" y el primer
    // snapshot lo pisaba con lo remoto.
    it('lo cargado antes de que resuelva queda pendiente y se reenvía', async () => {
      const service = TestBed.inject(MealService);
      TestBed.tick();
      service.addMeal({ name: 'c', ingredients: [] });
      await asentar();
      usuario.set({ uid: 'u1' });
      await asentar();
      emitir(snapshot([comida('a'), comida('b')]));
      await asentar();

      expect(service.meals().map((m) => m.name)).toEqual(['a', 'c']);
      expect(idsSubidos()).toEqual([service.meals().map((m) => m.id)]);
    });

    it('si resuelve sin sesión, lo pendiente se descarta', async () => {
      const service = TestBed.inject(MealService);
      TestBed.tick();
      service.addMeal({ name: 'c', ingredients: [] });
      await asentar();
      usuario.set(null);
      await asentar();

      expect(localStorage.getItem('comidas_pendientes')).toBe('[]');
    });
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

describe('MealService: revocación de links huérfanos', () => {
  const despublicar = vi.fn();
  const sincronizar = vi.fn(async () => undefined);

  beforeEach(() => {
    localStorage.clear();
    despublicar.mockReset();
    vi.mocked(onSnapshot).mockImplementation(((
      _ref: unknown,
      next: (snap: DocumentSnapshot) => void
    ) => {
      emitir = next;
      return (): void => undefined;
    }) as never);
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal({ uid: 'u1' }) } },
        { provide: RecetaPublicaService, useValue: { despublicar, sincronizar } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  const porRevocar = (): string[] =>
    JSON.parse(localStorage.getItem('comidas_por_revocar') ?? '[]');

  it('la que falló queda anotada aunque se cierre la pestaña', async () => {
    const compartida = { ...comida('a'), publicId: 'aaaaaaaa' };
    localStorage.setItem('comidas_meals', JSON.stringify([compartida]));
    despublicar.mockRejectedValue(new Error('sin red'));
    const service = TestBed.inject(MealService);
    TestBed.tick();
    emitir(snapshot([compartida]));
    await asentar();

    // Un import que pisa `meals` sin la receta compartida.
    service.meals.set([comida('b')]);
    await asentar();

    expect(despublicar).toHaveBeenCalledWith('aaaaaaaa');
    expect(porRevocar()).toEqual(['aaaaaaaa']);
  });

  it('al arrancar con sesión reintenta lo que quedó anotado', async () => {
    localStorage.setItem('comidas_por_revocar', JSON.stringify(['aaaaaaaa']));
    despublicar.mockResolvedValue(undefined);
    TestBed.inject(MealService);
    await asentar();

    expect(despublicar).toHaveBeenCalledWith('aaaaaaaa');
    expect(porRevocar()).toEqual([]);
  });

  it('si el documento ya no está, deja de reintentar', async () => {
    // Las reglas leen `resource.data`: borrar uno inexistente da permission-denied.
    localStorage.setItem('comidas_por_revocar', JSON.stringify(['aaaaaaaa']));
    despublicar.mockRejectedValue({ code: 'permission-denied' });
    TestBed.inject(MealService);
    await asentar();

    expect(porRevocar()).toEqual([]);
  });
});

describe('MealService: importar', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  const compartida: Meal = { ...comida('a'), name: 'Galletitas', publicId: 'aaaaaaaa', pasos: [{ texto: 'Hornear' }] };

  it('importData con secciones sólo reemplaza esas', async () => {
    const service = TestBed.inject(MealService);
    await asentar();
    const calendarioAntes = localStorage.getItem('comidas_schedules');

    service.importData(
      JSON.stringify({ meals: [comida('x')], schedules: { '2026-10-05': [] } }),
      ['comidas']
    );
    await asentar();

    expect(service.meals().map((m) => m.id)).toEqual(['x']);
    expect(localStorage.getItem('comidas_schedules')).toBe(calendarioAntes);
  });

  it('reemplazar por fila conserva el id y el link público de la existente', () => {
    const service = TestBed.inject(MealService);
    service.meals.set([compartida]);

    service.applyImportedMeals([
      { action: 'replace', meal: { id: '', name: 'galletitas', ingredients: [{ name: 'nueces', quantity: '1' }] } },
    ]);

    const [m] = service.meals();
    expect(m.id).toBe('a');
    expect(m.publicId).toBe('aaaaaaaa');
    expect(m.ingredients[0].name).toBe('nueces');
  });

  it('importar como nueva no se lleva el link público de nadie', () => {
    const service = TestBed.inject(MealService);
    service.meals.set([compartida]);

    service.applyImportedMeals([{ action: 'new', meal: { ...compartida } }]);

    expect(service.meals()).toHaveLength(2);
    expect(service.meals()[1].publicId).toBeUndefined();
    expect(service.meals()[1].id).not.toBe('a');
  });

  it('busca la existente primero por id y después por nombre', () => {
    const service = TestBed.inject(MealService);
    service.meals.set([comida('a'), { ...comida('b'), name: 'Tarta' }]);

    expect(service.buscarExistente({ id: 'a', name: 'otro nombre' })?.id).toBe('a');
    expect(service.buscarExistente({ id: 'zz', name: ' TARTA ' })?.id).toBe('b');
    expect(service.buscarExistente({ id: 'zz', name: 'nada' })).toBeUndefined();
  });

  it('reemplazar la lista entera deja exactamente lo importado', () => {
    const service = TestBed.inject(MealService);
    service.meals.set([comida('a'), comida('a2'), comida('a3')]);

    service.reemplazarComidas([compartida, comida('b')]);

    expect(service.meals().map((m) => m.id)).toEqual(['a', 'b']);
    expect(service.meals()[0].publicId).toBe('aaaaaaaa');
  });
});

describe('MealService: catálogo propio', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(onSnapshot).mockImplementation(((
      _ref: unknown,
      next: (snap: DocumentSnapshot) => void
    ) => {
      emitir = next;
      return (): void => undefined;
    }) as never);
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('guardar reemplaza la entrada del mismo nombre y persiste', async () => {
    const service = TestBed.inject(MealService);
    service.guardarEnCatalogo({ nombre: 'Muzza Rica', grupo: 'lacteos', unidad: 'g' });
    service.guardarEnCatalogo({ nombre: 'muzza rica', grupo: 'lacteos', unidad: 'g', porcion: 40 });
    await asentar();

    expect(service.catalogoPropio()).toEqual([
      { nombre: 'muzza rica', grupo: 'lacteos', unidad: 'g', porcion: 40 },
    ]);
    expect(JSON.parse(localStorage.getItem('comidas_catalogo_propio')!)).toHaveLength(1);
  });

  it('guardar conserva los acentos del nombre', () => {
    const service = TestBed.inject(MealService);
    service.guardarEnCatalogo({ nombre: ' Brócoli Ñato ', grupo: 'hortalizas', unidad: 'unidad' });

    expect(service.catalogoPropio()[0].nombre).toBe('brócoli ñato');
  });

  it('el índice reconoce lo propio y lo propio corrige el base', () => {
    const service = TestBed.inject(MealService);
    service.guardarEnCatalogo({ nombre: 'huevo', grupo: 'carnesHuevos', unidad: 'unidad', porcion: 2 });

    expect(service.indiceCatalogo().get('huevo')?.porcion).toBe(2);
  });

  it('arranca desde localStorage', () => {
    localStorage.setItem(
      'comidas_catalogo_propio',
      JSON.stringify([{ nombre: 'kale', grupo: 'hortalizas', unidad: 'atado' }])
    );
    const service = TestBed.inject(MealService);

    expect(service.indiceCatalogo().get('kale')?.grupo).toBe('hortalizas');
  });

  it('viaja en el backup y se restaura con importData', () => {
    const service = TestBed.inject(MealService);
    service.importData(
      JSON.stringify({ catalogoPropio: [{ nombre: 'kale', grupo: 'hortalizas', unidad: 'atado' }] })
    );

    expect(service.catalogoPropio()).toEqual([{ nombre: 'kale', grupo: 'hortalizas', unidad: 'atado' }]);
    expect(pareceBackup({ catalogoPropio: [] })).toBe(true);
  });
});

describe('MealService: guía', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
      ],
    });
  });

  afterEach(() => localStorage.clear());

  it('agrega una propia recortada y no agrega una en blanco', async () => {
    const service = TestBed.inject(MealService);

    expect(service.agregarReglaPropia('  Mate sin azúcar ', ' ')).toBe(true);
    expect(service.agregarReglaPropia('   ')).toBe(false);
    await asentar();

    const [regla] = service.guia().propias;
    expect(service.guia().propias).toHaveLength(1);
    expect(regla.texto).toBe('Mate sin azúcar');
    expect(regla.fuente).toBe('propia');
    expect(regla).not.toHaveProperty('detalle');
    expect(JSON.parse(localStorage.getItem('comidas_guia')!).propias).toHaveLength(1);
  });

  it('borra una propia', () => {
    const service = TestBed.inject(MealService);
    service.agregarReglaPropia('Mate sin azúcar');
    service.borrarReglaPropia(service.guia().propias[0].id);

    expect(service.guia().propias).toEqual([]);
  });

  it('oculta una vez aunque se pida dos, y vuelve a mostrar', () => {
    const service = TestBed.inject(MealService);
    service.ocultarRegla('ayuno');
    service.ocultarRegla('ayuno');
    expect(service.guia().ocultas).toEqual(['ayuno']);

    service.mostrarRegla('ayuno');
    expect(service.guia().ocultas).toEqual([]);
  });

  it('arranca desde localStorage, normalizando lo mal formado', () => {
    localStorage.setItem('comidas_guia', JSON.stringify({ ocultas: ['ayuno'] }));
    const service = TestBed.inject(MealService);

    expect(service.guia()).toEqual({ propias: [], ocultas: ['ayuno'] });
  });

  it('viaja en el backup; uno sin guía no la toca', () => {
    const service = TestBed.inject(MealService);
    service.ocultarRegla('ayuno');

    service.importData(JSON.stringify({ meals: [] }));
    expect(service.guia().ocultas).toEqual(['ayuno']);

    service.importData(JSON.stringify({ guia: { propias: [], ocultas: ['anotar'] } }));
    expect(service.guia().ocultas).toEqual(['anotar']);
  });
});
