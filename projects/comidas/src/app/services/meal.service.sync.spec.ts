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

import { Meal, ShoppingItem } from '../models/meal.model';
import { AuthService } from './auth.service';
import { MealService, pareceBackup, parseNumericQuantity } from './meal.service';
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

describe('MealService: lista de compras redondeada', () => {
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

  const renglon = (service: MealService, nombre: string): ShoppingItem | undefined =>
    service.shoppingList().find((i) => i.name.toLowerCase() === nombre.toLowerCase());

  it('lo que se cuenta se compra entero y dice cuánto se usa', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    const r = renglon(service, 'Brócoli')!;
    expect(r.quantityOverride).toBe('1 unidad');
    expect(r.usas).toBe('0.75 unidad');
    expect(r.sobra).toBe('0.25 unidad');
  });

  it('"Huevo" y "huevos" son un renglón, redondeado una vez con el paso del catálogo', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Huevo', '3.5', undefined, 'unidad');
    service.addExtraItem('huevos', '3', undefined, 'unidad');

    const huevos = service.shoppingList().filter((i) => i.name.toLowerCase().startsWith('huevo'));
    expect(huevos).toHaveLength(1);
    expect(huevos[0].quantityOverride).toBe('12 unidad');
    expect(huevos[0].usas).toBe('6.5 unidad');
  });

  it('dos unidades distintas no se suman ni se redondean', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Queso', '100', undefined, 'g');
    service.addExtraItem('queso', '1', undefined, 'unidad');

    const r = renglon(service, 'Queso')!;
    expect(r.quantity).toBe('100 g + 1 unidad');
    expect(r.quantityOverride).toBeUndefined();
    expect(r.usas).toBeUndefined();
  });

  it('primero resta la despensa y después redondea', () => {
    const service = TestBed.inject(MealService);
    service.addToPantry('brócoli', '0.5 unidad');
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    const r = renglon(service, 'Brócoli')!;
    expect(r.quantityOverride).toBe('1 unidad');
    expect(r.usas).toBe('0.25 unidad');
    expect(r.sobra).toBe('0.75 unidad');
  });

  it('la despensa cubre aunque el nombre esté en otra forma', () => {
    const service = TestBed.inject(MealService);
    service.addToPantry('huevos', '6 unidad');
    service.addExtraItem('Huevo', '4', undefined, 'unidad');

    const r = renglon(service, 'Huevo')!;
    expect(r.checked).toBe(true);
    expect(r.usas).toBeUndefined();
  });

  it('la cantidad pisada a mano gana sobre el redondeo', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');
    service.overrideQuantity('Brócoli', '0.5');

    const r = renglon(service, 'Brócoli')!;
    expect(r.quantityOverride).toBe('0.5');
    expect(r.usas).toBeUndefined();
  });

  const enDespensa = (service: MealService, nombre: string): number =>
    parseNumericQuantity(
      service.pantry().find((p) => p.name.toLowerCase() === nombre.toLowerCase())?.quantity ?? '0'
    )?.value ?? 0;

  it('tildar manda la sobra a la despensa y congela el renglón', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    expect(service.toggleItemCheck('Brócoli')).toBe('Brócoli: +0.25 unidad a la despensa');
    expect(enDespensa(service, 'Brócoli')).toBe(0.25);
    // Con la sobra en la despensa, el renglón no se recalcula: sigue en 1.
    const r = renglon(service, 'Brócoli')!;
    expect(r.checked).toBe(true);
    expect(r.quantityOverride).toBe('1 unidad');
    expect(r.sobra).toBe('0.25 unidad');
  });

  it('destildar saca la sobra, y tildar y destildar varias veces no acumula', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    for (let i = 0; i < 3; i++) {
      service.toggleItemCheck('Brócoli');
      expect(service.toggleItemCheck('Brócoli')).toBe('Brócoli: \u22120.25 unidad de la despensa');
    }

    expect(enDespensa(service, 'Brócoli')).toBe(0);
    expect(renglon(service, 'Brócoli')!.checked).toBe(false);
    expect(renglon(service, 'Brócoli')!.quantityOverride).toBe('1 unidad');
  });

  it('lo que la despensa cubre se tilda sin registro ni sobra', () => {
    const service = TestBed.inject(MealService);
    service.addToPantry('brócoli', '1 unidad');
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    expect(service.toggleItemCheck('Brócoli')).toBeNull();
    expect(enDespensa(service, 'Brócoli')).toBe(1);
    expect(service.compras()).toEqual({});
  });

  it('lo pisado a mano se compra tal cual y no deja sobra', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');
    service.overrideQuantity('Brócoli', '2 unidad');

    expect(service.toggleItemCheck('Brócoli')).toBeNull();
    expect(enDespensa(service, 'Brócoli')).toBe(0);
    expect(renglon(service, 'Brócoli')!.quantityOverride).toBe('2 unidad');
  });

  it('limpiar la semana deshace las sobras', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');
    service.toggleItemCheck('Brócoli');

    service.clearOverrides();

    expect(enDespensa(service, 'Brócoli')).toBe(0);
    expect(renglon(service, 'Brócoli')!.checked).toBe(false);
  });

  it('las compras se guardan y viajan en el backup', async () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');
    service.toggleItemCheck('Brócoli');
    await asentar();

    const guardado = JSON.parse(localStorage.getItem('comidas_compras')!) as Record<string, unknown>;
    expect(Object.values(guardado)).toEqual([{ 'brócoli@manual': { compra: '1 unidad', sobra: '0.25 unidad' } }]);

    const compras = { '2026-01-05': { huevo: { compra: '12 unidad', sobra: '5.5 unidad' } } };
    service.importData(JSON.stringify({ compras }));
    expect(service.compras()).toEqual(compras);
    expect(pareceBackup({ compras: {} })).toBe(true);
  });

  it('restar de la despensa sin cubrir no tilda ni acredita sobra', () => {
    const service = TestBed.inject(MealService);
    service.addToPantry('huevo', '9 unidad');
    service.addExtraItem('Huevo', '8', undefined, 'unidad');

    service.subtractFromPantry('huevo', '2 unidad');

    expect(enDespensa(service, 'huevo')).toBe(7);
    expect(service.compras()).toEqual({});
    // Quedan 7 y hacen falta 8: no está cubierto.
    expect(renglon(service, 'Huevo')!.checked).toBe(false);
  });

  it('con la despensa en otra unidad, tildar y destildar no la toca', () => {
    const service = TestBed.inject(MealService);
    service.addToPantry('brócoli', '200 g');
    service.addExtraItem('Brócoli', '0.75', undefined, 'unidad');

    for (let i = 0; i < 3; i++) {
      service.toggleItemCheck('Brócoli');
      service.toggleItemCheck('Brócoli');
    }

    expect(service.pantry()[0].quantity).toBe('200 g');
  });

  it('tres ingredientes con dos unidades suman cada unidad aparte', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Queso', '100', undefined, 'g');
    service.addExtraItem('queso', '1', undefined, 'unidad');
    service.addExtraItem('queso', '2', undefined, 'unidad');

    const r = renglon(service, 'Queso')!;
    expect(r.quantity).toBe('100 g + 3 unidad');
    expect(r.unit).toBe('');
  });

  it('un sinónimo que es otro producto no se junta en el mismo renglón', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Aceite de oliva', '2', undefined, 'cda');
    service.addExtraItem('Aceite de girasol', '3', undefined, 'cda');

    expect(renglon(service, 'Aceite de oliva')!.quantity).toBe('2');
    expect(renglon(service, 'Aceite de girasol')!.quantity).toBe('3');
  });

  it('restar de la despensa toca una sola entrada aunque haya dos del mismo ingrediente', () => {
    const service = TestBed.inject(MealService);
    service.pantry.set([
      { name: 'Huevo', quantity: '6 unidad' },
      { name: 'huevos', quantity: '6 unidad' },
    ]);

    service.subtractFromPantry('huevo', '6 unidad');

    expect(service.pantry().map((p) => p.quantity)).toEqual(['0 unidad', '6 unidad']);
  });

  it('gramos sin paso quedan como están', () => {
    const service = TestBed.inject(MealService);
    service.addExtraItem('Mozzarella', '30', undefined, 'g');

    const r = renglon(service, 'Mozzarella')!;
    expect(r.quantityOverride).toBeUndefined();
    expect(r.usas).toBeUndefined();
  });
});

describe('MealService: lista por día', () => {
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

  const renglon = (service: MealService, nombre: string): ShoppingItem | undefined =>
    service.shoppingList().find((i) => i.name.toLowerCase() === nombre.toLowerCase());

  // Con hoy en el lunes cuentan los 7 días, sea el día que sea que corra el test.
  const desdeElLunes = (service: MealService, dias = 0): void => {
    const hoy = new Date(service.currentWeekStart());
    hoy.setDate(hoy.getDate() + dias);
    service.todayTimestamp.set(hoy.getTime());
  };

  const plato = (service: MealService, nombre: string, ingrediente: string, quantity: string, unit: string): string => {
    service.addMeal({ name: nombre, ingredients: [{ name: ingrediente, quantity, unit }] });
    return service.meals().find((m) => m.name === nombre)!.id;
  };

  const semana = (service: MealService): string => service.currentWeekStart().toISOString().split('T')[0];

  const fecha = (service: MealService, dia: string): string =>
    service.partesSemana().find((p) => p.dia === dia)!.fecha!;

  const enDespensa = (service: MealService, nombre: string): number =>
    parseNumericQuantity(service.pantry().find((p) => p.name.toLowerCase() === nombre)?.quantity ?? '0')?.value ?? 0;

  const dosCebollas = (service: MealService, lunes: string, martes: string): void => {
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'cebolla', lunes, 'unidad'));
    service.setMeal('Martes', 'almuerzo', plato(service, 'Salsa', 'cebolla', martes, 'unidad'));
  };

  const conCebollas = (service: MealService): void => {
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'Cebolla', '0.5', 'unidad'));
    service.setMeal('Lunes', 'cena', plato(service, 'Guiso', 'cebolla', '0.5', 'unidad'));
    service.setMeal('Martes', 'almuerzo', plato(service, 'Salsa', 'Cebolla', '0.5', 'unidad'));
  };

  it('el mismo ingrediente en dos días son dos partes, y en dos platos del mismo día una', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    conCebollas(service);

    const partes = service.partesSemana().filter((p) => p.clave === 'cebolla');
    expect(partes).toHaveLength(2);
    expect(partes[0]).toMatchObject({ dia: 'Lunes', quantity: '1', unit: 'unidad', platos: ['Tarta', 'Guiso'] });
    expect(partes[1]).toMatchObject({ dia: 'Martes', quantity: '0.5', unit: 'unidad', platos: ['Salsa'] });
  });

  it('excluded y los días pasados no aportan', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service, 2);
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'Cebolla', '0.5', 'unidad'));
    service.setMeal('Jueves', 'almuerzo', plato(service, 'Guiso', 'Cebolla', '0.5', 'unidad'));
    service.toggleDishExclusion('Jueves', 'almuerzo', 0);
    service.setMeal('Viernes', 'cena', plato(service, 'Salsa', 'Cebolla', '0.5', 'unidad'));

    expect(service.partesSemana().map((p) => p.dia)).toEqual(['Viernes']);
  });

  it('el renglón dice sus días pendientes', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    conCebollas(service);

    expect(renglon(service, 'cebolla')!.dias).toEqual(['Lunes', 'Martes']);
  });

  it('la despensa cubre el día más cercano primero', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'Cebolla', '0.5', 'unidad'));
    service.setMeal('Martes', 'almuerzo', plato(service, 'Salsa', 'Cebolla', '0.5', 'unidad'));
    service.addToPantry('cebolla', '0.5 unidad');

    const r = renglon(service, 'cebolla')!;
    expect(r.checked).toBe(false);
    expect(r.usas).toBe('0.5 unidad');
    expect(r.quantityOverride).toBe('1 unidad');
    expect(r.dias).toEqual(['Martes']);
  });

  it('unidades distintas entre días no se reparten ni rompen', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'Queso', '100', 'g'));
    service.setMeal('Martes', 'almuerzo', plato(service, 'Pizza', 'Queso', '1', 'unidad'));
    service.addToPantry('queso', '50 g');

    const r = renglon(service, 'queso')!;
    expect(r.quantityOverride ?? r.quantity).toBe('100 g + 1 unidad');
    expect(r.checked).toBe(false);
    expect(r.dias).toEqual(['Lunes', 'Martes']);
  });

  it('las etiquetas salen del día y no de la fecha', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    conCebollas(service);

    const [lunes] = service.partesSemana();
    expect(lunes.dia).toBe('Lunes');
    expect(lunes.diaDelMes).toBe(service.currentWeekStart().getDate());
  });

  it('lo pisado a mano por encima de lo que cubre la despensa sigue pendiente', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'Cebolla', '0.5', 'unidad'));
    service.addToPantry('cebolla', '1 unidad');
    service.overrideQuantity('Cebolla', '3 unidad');

    const r = renglon(service, 'cebolla')!;
    expect(r.checked).toBe(false);
    expect(r.quantityOverride).toBe('2 unidad');
    expect(r.dias).toEqual(['Lunes']);

    service.toggleItemCheck('Cebolla');
    const lunes = `cebolla@${fecha(service, 'Lunes')}`;
    expect(Object.values(service.compras())).toEqual([{ [lunes]: { compra: '2 unidad', sobra: '' } }]);
    expect(renglon(service, 'cebolla')!.checked).toBe(true);
  });

  it('una clave pelada de antes tilda todas las partes del renglón', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    conCebollas(service);
    service.checkedItems.set({ [semana(service)]: ['cebolla'] });

    const r = renglon(service, 'cebolla')!;
    expect(r.checked).toBe(true);
    expect(r.dias).toEqual([]);
    expect(r.diasComprados).toEqual(['Lunes', 'Martes']);
  });

  it('tildar un día manda su sobra y el día siguiente queda cubierto', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.5', '0.5');
    const lunes = fecha(service, 'Lunes');

    expect(service.toggleItemCheck('cebolla', lunes)).toBe('cebolla: +0.5 unidad a la despensa');
    expect(service.compras()[semana(service)]).toEqual({
      [`cebolla@${lunes}`]: { compra: '1 unidad', sobra: '0.5 unidad' },
    });
    expect(renglon(service, 'cebolla')!.checked).toBe(true);
  });

  it('tildar el renglón es una compra con dias, y destildar un día la deshace entera', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'cebolla', '0.5', 'unidad'));
    service.setMeal('Viernes', 'almuerzo', plato(service, 'Salsa', 'cebolla', '1', 'unidad'));
    const [lunes, viernes] = [fecha(service, 'Lunes'), fecha(service, 'Viernes')];

    service.toggleItemCheck('cebolla');
    expect(service.compras()[semana(service)]).toEqual({
      [`cebolla@${lunes}`]: { compra: '2 unidad', sobra: '0.5 unidad', dias: [`cebolla@${viernes}`] },
    });
    expect(enDespensa(service, 'cebolla')).toBe(0.5);

    service.toggleItemCheck('cebolla', viernes);
    expect(enDespensa(service, 'cebolla')).toBe(0);
    expect(service.compras()[semana(service)]).toEqual({});
    expect((service.checkedItems()[semana(service)] ?? []).filter((k) => k.startsWith('cebolla'))).toEqual([]);
  });

  it('tildar y destildar en cualquier orden deja la despensa como estaba', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.5', '1');
    service.addToPantry('cebolla', '0.25 unidad');
    const [lunes, martes] = [fecha(service, 'Lunes'), fecha(service, 'Martes')];
    const registros = (): string[] => Object.keys(service.compras()[semana(service)] ?? {});

    // Lunes: le faltan 0.25, se compra 1 y sobran 0.75; al martes le sigue faltando.
    service.toggleItemCheck('cebolla', lunes);
    expect(enDespensa(service, 'cebolla')).toBe(1);
    expect(registros()).toEqual([`cebolla@${lunes}`]);
    expect(renglon(service, 'cebolla')).toMatchObject({ checked: false, dias: ['Martes'] });

    // El renglón tilda lo que queda: el martes, como otra compra.
    service.toggleItemCheck('cebolla');
    expect(registros()).toEqual([`cebolla@${lunes}`, `cebolla@${martes}`]);
    expect(renglon(service, 'cebolla')!.checked).toBe(true);

    // Destildar el martes deshace esa compra y deja la del lunes.
    service.toggleItemCheck('cebolla', martes);
    expect(enDespensa(service, 'cebolla')).toBe(1);
    expect(registros()).toEqual([`cebolla@${lunes}`]);
    expect(renglon(service, 'cebolla')).toMatchObject({ checked: false, dias: ['Martes'] });

    service.toggleItemCheck('cebolla', lunes);
    expect(enDespensa(service, 'cebolla')).toBe(0.25);
    expect(registros()).toEqual([]);

    // Y de nuevo, destildando con el renglón entero.
    service.toggleItemCheck('cebolla', lunes);
    service.toggleItemCheck('cebolla');
    service.toggleItemCheck('cebolla');
    expect(enDespensa(service, 'cebolla')).toBe(0.25);
    expect(registros()).toEqual([]);
    expect(service.checkedItems()[semana(service)]).toEqual([]);
  });

  it('un día comprado sigue usando su parte de la despensa', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.75', '0.6');
    service.addToPantry('cebolla', '0.25 unidad');
    const lunes = fecha(service, 'Lunes');

    service.toggleItemCheck('cebolla', lunes);
    expect(enDespensa(service, 'cebolla')).toBe(0.75);

    // Quedan 0.25 + 1 − 0.75 = 0.5 para el martes, que necesita 0.6.
    const r = renglon(service, 'cebolla')!;
    expect(r).toMatchObject({ checked: false, dias: ['Martes'], quantityOverride: '1 unidad' });
    expect(parseNumericQuantity(r.usas!)!.value).toBeCloseTo(0.1);
    const [, martes] = service.listaPorDia();
    expect(martes.items[0]).toMatchObject({ checked: false, quantityOverride: '1 unidad' });

    service.toggleItemCheck('cebolla', lunes);
    expect(enDespensa(service, 'cebolla')).toBe(0.25);
  });

  it('un clic que no cambia nada no borra lo pisado a mano', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'cebolla', '0.5', 'unidad'));
    service.addToPantry('cebolla', '2 unidad');
    service.overrideQuantity('cebolla', '1 unidad');
    expect(renglon(service, 'cebolla')!.checked).toBe(true);

    expect(service.toggleItemCheck('cebolla')).toBeNull();

    expect(service.quantityOverrides()[`${semana(service)}_cebolla`]).toBe('1 unidad');
    expect(service.checkedItems()[semana(service)] ?? []).toEqual([]);
  });

  it('tildar todo, por partes o por renglón, y destildarlo vuelve a la despensa de antes', () => {
    const secuencias: (string | undefined)[][] = [
      ['Lunes', 'Martes', 'Viernes', 'Lunes', 'Martes', 'Viernes'],
      ['Viernes', 'Lunes', undefined, 'Martes'],
      [undefined, 'Martes', 'Lunes', undefined],
      ['Martes', undefined, undefined],
    ];
    secuencias.forEach((secuencia) => {
      localStorage.clear();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: Firestore, useValue: {} },
          { provide: AuthService, useValue: { currentUser: signal(null) } },
        ],
      });
      const service = TestBed.inject(MealService);
      desdeElLunes(service);
      dosCebollas(service, '0.75', '0.5');
      service.setMeal('Viernes', 'almuerzo', plato(service, 'Sopa', 'cebolla', '1.25', 'unidad'));
      service.addToPantry('cebolla', '0.25 unidad');
      secuencia.forEach((dia) => service.toggleItemCheck('cebolla', dia && fecha(service, dia)));
      // Lo que quede tildado se destilda, parte por parte.
      service.partesSemana().forEach((p) => {
        const tildada = (service.checkedItems()[semana(service)] ?? []).includes(`cebolla@${p.fecha}`);
        if (tildada) {
          service.toggleItemCheck('cebolla', p.fecha);
        }
      });

      expect(enDespensa(service, 'cebolla')).toBe(0.25);
      expect(service.compras()[semana(service)] ?? {}).toEqual({});
    });
  });

  it('tilde manual sin registro sigue consumiendo despensa', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.5', '0.5');
    service.addToPantry('cebolla', '0.5 unidad');

    expect(service.toggleItemCheck('cebolla', fecha(service, 'Lunes'))).toBeNull();

    expect(service.compras()).toEqual({});
    const r = renglon(service, 'cebolla')!;
    expect(r.checked).toBe(false);
    expect(r.dias).toEqual(['Martes']);
  });

  it('un manual con el mismo nombre no tilda las recetas', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    service.addExtraItem('Cebolla', '1');
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Tarta', 'cebolla', '0.5', 'unidad'));

    service.toggleItemCheck('Cebolla', null);

    expect(service.checkedItems()[semana(service)]).toEqual(['cebolla@manual']);
    expect(renglon(service, 'cebolla')!.dias).toEqual(['Lunes']);
  });

  it('una clave de antes cuenta como todo, y destildar un día deja tildados los otros', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.5', '0.5');
    service.checkedItems.set({ [semana(service)]: ['cebolla'] });
    expect(renglon(service, 'cebolla')!.checked).toBe(true);

    service.toggleItemCheck('cebolla', fecha(service, 'Lunes'));

    expect(service.checkedItems()[semana(service)]).toEqual([`cebolla@${fecha(service, 'Martes')}`]);
  });

  it('un registro de antes se deshace entero desde cualquier día', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.5', '0.5');
    service.addToPantry('cebolla', '0.5 unidad');
    service.checkedItems.set({ [semana(service)]: ['cebolla'] });
    service.compras.set({ [semana(service)]: { cebolla: { compra: '1 unidad', sobra: '0.5 unidad' } } });

    service.toggleItemCheck('cebolla', fecha(service, 'Martes'));

    expect(enDespensa(service, 'cebolla')).toBe(0);
    expect(service.compras()[semana(service)]).toEqual({});
    expect(service.checkedItems()[semana(service)]).toEqual([]);
  });

  it('tildar una parte borra el override del renglón', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.5', '0.5');
    service.overrideQuantity('cebolla', '3 unidad');

    service.toggleItemCheck('cebolla', fecha(service, 'Lunes'));

    expect(service.quantityOverrides()[`${semana(service)}_cebolla`]).toBeUndefined();
  });

  it('compra que empezó un día pasado se deshace desde un día futuro', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.5', '0.25');
    const martes = fecha(service, 'Martes');
    service.toggleItemCheck('cebolla');
    expect(enDespensa(service, 'cebolla')).toBe(0.25);

    desdeElLunes(service, 1);
    service.toggleItemCheck('cebolla', martes);

    expect(enDespensa(service, 'cebolla')).toBe(0);
    expect(service.compras()[semana(service)]).toEqual({});
  });

  it('una clave huérfana no tilda nada', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '1', '0.5');
    service.toggleItemCheck('cebolla', fecha(service, 'Lunes'));

    service.clearMeal('Lunes', 'almuerzo');

    expect(service.partesSemana().map((p) => p.dia)).toEqual(['Martes']);
    const r = renglon(service, 'cebolla')!;
    expect(r.checked).toBe(false);
    expect(r.dias).toEqual(['Martes']);
    expect(r.diasComprados).toEqual([]);
    expect(service.listaPorDia().map((d) => d.dia)).toEqual(['Martes']);
  });

  it('sin cantidad, tilda sin registro', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    service.setMeal('Lunes', 'almuerzo', plato(service, 'Ensalada', 'Sal', '', ''));
    const key = `sal@${fecha(service, 'Lunes')}`;

    service.toggleItemCheck('Sal', fecha(service, 'Lunes'));
    expect(service.checkedItems()[semana(service)]).toEqual([key]);
    expect(service.compras()).toEqual({});

    service.toggleItemCheck('Sal', fecha(service, 'Lunes'));
    expect(service.checkedItems()[semana(service)]).toEqual([]);
  });

  it('la despensa que alcanza tilda sus partes sin registro', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    dosCebollas(service, '0.5', '0.5');
    service.addToPantry('cebolla', '2 unidad');

    service.subtractFromPantry('cebolla', '1 unidad');

    expect(service.checkedItems()[semana(service)]).toEqual([
      `cebolla@${fecha(service, 'Lunes')}`, `cebolla@${fecha(service, 'Martes')}`,
    ]);
    expect(service.compras()).toEqual({});
  });

  it('listaPorDia agrupa por día en orden con sus platos', () => {
    const service = TestBed.inject(MealService);
    desdeElLunes(service);
    service.addTag('Verdulería', '#00ff00');
    service.setIngredientTag('Cebolla', service.tags().at(-1)!.id);
    service.setMeal('Martes', 'almuerzo', plato(service, 'Salsa', 'Cebolla', '0.5', 'unidad'));
    service.addMeal({
      name: 'Tarta',
      ingredients: [
        { name: 'Harina', quantity: '200', unit: 'g' },
        { name: 'Cebolla', quantity: '0.75', unit: 'unidad' },
      ],
    });
    service.setMeal('Lunes', 'almuerzo', service.meals().find((m) => m.name === 'Tarta')!.id);
    service.addExtraItem('Servilletas', '1');

    const dias = service.listaPorDia();
    expect(dias.map((d) => [d.dia, d.platos])).toEqual([['Lunes', ['Tarta']], ['Martes', ['Salsa']], [null, []]]);
    expect(dias[0]).toMatchObject({ fecha: fecha(service, 'Lunes'), diaDelMes: service.currentWeekStart().getDate() });
    expect(dias[2].fecha).toBeNull();
    // Con tag primero, sin tag al final; cada parte redondeada por sí sola.
    expect(dias[0].items.map((i) => i.name)).toEqual(['Cebolla', 'Harina']);
    expect(dias[0].items[0]).toMatchObject({ quantityOverride: '1 unidad', checked: false });
    expect(dias[1].items[0]).toMatchObject({ quantityOverride: '1 unidad', usas: '0.5 unidad' });
    expect(dias[2].items.map((i) => i.name)).toEqual(['Servilletas']);
  });
});
