import {
  computed,
  effect,
  inject,
  Injectable,
  Injector,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import { doc, Firestore, getDoc, setDoc } from '@angular/fire/firestore';
import { AuthService } from './auth.service';
import { ColaDeGuardado } from './cola-de-guardado';
import { DialogService } from './dialog.service';
import { RecetaPublicaService } from './receta-publica.service';
import {
  DaySchedule,
  Dish,
  DishMealType,
  Meal,
  PantryGroup,
  PantryItem,
  Paso,
  ShoppingItem,
  ShoppingListGroup,
  ShoppingTag,
  TextScheduleField,
} from '../models/meal.model';

// Las cantidades se escriben a mano y vienen de todas las formas: '2', '0.5',
// '1/2', '1 1/2', '2 tazas'. Una sola gramática para todas, porque hasta ahora
// había tres regex distintas y la de cargar desde Firestore aplastaba '1/2' a
// '1' antes de que ninguna de las otras la viera.
// ponytail: sin coma decimal — '1,5' se lee como 1. Si alguna vez importa,
// normalizar la coma a punto antes de parsear.
const CANTIDAD = /^\s*(?:(\d+)\s+)?(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?/;

export type CantidadParseada = {
  // El número resuelto: '1 1/2' da 1.5.
  valor: number;
  // El número tal como se escribió: '1 1/2'. Es lo que se guarda, para no
  // reescribirle al usuario lo que tipeó.
  texto: string;
  // Lo que sigue después del número, sin trimear: ' tazas'.
  resto: string;
};

export function parseQuantity(quantity: string): CantidadParseada | null {
  const texto = String(quantity ?? '');
  const partes = CANTIDAD.exec(texto);
  if (!partes) {
    return null;
  }

  const [coincidencia, entero, numerador, denominador] = partes;
  const divisor = denominador ? Number(denominador) : 1;
  // '1/0' no es una cantidad: mejor dejarla como está que devolver Infinity.
  if (divisor === 0) {
    return null;
  }

  // parseFloat('1/2') devuelve 1: hay que dividir a mano, no alcanza con leer.
  const valor = denominador
    ? Number(entero ?? 0) + Number(numerador) / divisor
    : Number(numerador);

  return {
    valor,
    texto: coincidencia.trim(),
    resto: texto.slice(coincidencia.length),
  };
}

export function parseNumericQuantity(
  quantity: string
): { value: number; unit: string } | null {
  const parsed = parseQuantity(quantity);
  return parsed ? { value: parsed.valor, unit: parsed.resto.trim() } : null;
}

export function normalizeQuantityToNumeric(q: string): string {
  return parseQuantity(q)?.texto ?? String(q ?? '').trim();
}

export function multiplyQuantity(quantity: string, factor: number): string {
  // En ×1 se devuelve lo escrito sin tocar: normalizarlo mostraría '0.5' donde
  // la receta dice '1/2', que es reescribirle el texto al que la escribió.
  if (factor === 1) {
    return quantity;
  }

  const parsed = parseQuantity(quantity);
  if (!parsed) {
    return quantity;
  }
  return `${parseFloat((parsed.valor * factor).toFixed(2))}${parsed.resto}`;
}

// Garantiza que cada comida tenga un id. Las comidas que entran por restaurar
// un backup (importData) o por bajar de Firestore pueden no traerlo, y el
// calendario las referencia por id: sin id quedan inutilizables (el slot no se
// llena y no hay error). Es idempotente: no toca ni regenera ids existentes.
// Una comida es receta cuando tiene al menos un paso escrito. Un array de
// pasos en blanco no cuenta: lo deja cualquiera que abrió el editor y no
// escribió nada.
export function tieneReceta(meal: Meal): boolean {
  return !!meal.pasos?.some((paso) => paso.texto.trim() !== '');
}

// Se hace spread del paso en vez de rearmarlo campo por campo, así los que se
// sumen después (la foto, en la entrega 4) no se pierden acá en silencio.
export function limpiarPasos(pasos: Paso[]): Paso[] {
  return pasos
    .filter((paso) => paso.texto.trim() !== '')
    .map((paso) => ({ ...paso, texto: paso.texto.trim() }));
}

// Para pegar la receta en un post del blog. El `#` del título es lo que
// post-view usa como encabezado, así que el markdown sale listo para guardar
// como .md sin retocar nada.
export function recetaComoMarkdown(meal: Meal): string {
  const lineas: string[] = [`# ${meal.name}`];

  if (meal.description?.trim()) {
    lineas.push('', meal.description.trim());
  }

  if (meal.ingredients.length > 0) {
    lineas.push('', '## Ingredientes', '');
    meal.ingredients.forEach((ing) => {
      const cantidad = [ing.quantity, ing.unit]
        .filter(Boolean)
        .join(' ')
        .trim();
      lineas.push(cantidad ? `- ${cantidad} — ${ing.name}` : `- ${ing.name}`);
    });
  }

  const pasos = meal.pasos ?? [];
  if (pasos.length > 0) {
    lineas.push('', '## Preparación', '');
    pasos.forEach((paso, i) => lineas.push(`${i + 1}. ${paso.texto}`));
  }

  return `${lineas.join('\n')}\n`;
}

export function ensureMealIds(meals: Meal[], genId: () => string): Meal[] {
  return meals.map((m) => (m.id ? m : { ...m, id: genId() }));
}

// Arma la copia de "Duplicar" campo por campo, no con un spread del original,
// para que agregar un campo a `Meal` y olvidarse de listarlo acá falle en el
// test en vez de perderse en silencio (así se perdieron los `pasos` de una
// receta real). Deliberadamente NO copia `publicId`: la copia es una receta
// distinta, y si se le llevara el publicId, compartirla o editarla
// reescribiría el link público del original, y borrar la copia lo mataría.
export function copiaParaDuplicar(original: Meal): Omit<Meal, 'id'> {
  return {
    name: `${original.name} (Copia)`,
    ...(original.description ? { description: original.description } : {}),
    ingredients: original.ingredients.map((i) => ({ ...i })),
    tags: original.tags ? [...original.tags] : [],
    ...(original.pasos ? { pasos: original.pasos.map((p) => ({ ...p })) } : {}),
    ...(original.includeInShoppingList !== undefined
      ? { includeInShoppingList: original.includeInShoppingList }
      : {}),
    ...(original.foto ? { foto: original.foto } : {}),
  };
}

// Única fuente de la huella: la usan tanto la siembra de `compartirMeal` como
// `sincronizarPublicadas`. Deliberadamente no incluye `publicId`: agregar el
// campo que la siembra acaba de escribir cambiaría la huella justo después de
// sembrarla, y la reescritura de más volvería. El test de
// "no cambia si se le agrega publicId" es lo que avisa si esto se rompe.
export function huellaPublicada(meal: Meal, alias: string): string {
  return JSON.stringify([
    meal.name,
    meal.description,
    meal.ingredients,
    meal.pasos,
    meal.foto,
    alias,
  ]);
}

// Los `publicId` que hay en una lista de comidas. El campo es el único puntero
// al documento de `recetasPublicas` que existe en algún lado.
export function publicIds(meals: Meal[]): Set<string> {
  const ids = new Set<string>();
  for (const meal of meals) {
    if (meal.publicId) {
      ids.add(meal.publicId);
    }
  }
  return ids;
}

// Un `publicId` que estaba y ya no está es un huérfano: el documento público
// sigue vivo, y `allow list: if false` hace que no se pueda ni enumerar, así
// que sin el puntero sólo se limpia desde la consola de Firebase.
export function huerfanos(previos: Set<string>, meals: Meal[]): string[] {
  const vigentes = publicIds(meals);
  return Array.from(previos).filter((publicId) => !vigentes.has(publicId));
}

// Las claves que un backup puede traer. `version` no está: se escribe pero no
// se lee nunca, así que un archivo que sólo tenga eso no es un backup.
const CLAVES_BACKUP = [
  'meals',
  'schedules',
  'tags',
  'ingredientTags',
  'extraItems',
  'extraItemsHistory',
  'overrides',
  'checkedItems',
  'alias',
  'pantry',
  'pantryGroups',
  'familySettings',
];

// Un JSON válido no es un backup. Sin esto, elegir el archivo equivocado no
// avisaba nada: no había ninguna clave que aplicar y el cartel decía
// "¡Datos importados con éxito!".
export function pareceBackup(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  return CLAVES_BACKUP.some((clave) => clave in data);
}

// Los tags que existen en una lista de comidas, ordenados. Los usan las dos
// pantallas que listan comidas: el selector del día y el listado propio.
export function tagsUnicos(meals: Meal[]): string[] {
  const tags = new Set<string>();
  for (const meal of meals) {
    for (const tag of meal.tags ?? []) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}

// Los dos filtros del listado son independientes y se componen: "compartidas
// que además sean postre" es una pregunta legítima. Por eso son dos parámetros
// y no una unión con un tag centinela — un centinela chocaría con un tag que
// se llame igual.
export function filtrarComidas(
  meals: Meal[],
  tag: string | null,
  soloCompartidas: boolean
): Meal[] {
  return meals.filter(
    (meal) =>
      (!tag || (meal.tags?.includes(tag) ?? false)) &&
      (!soloCompartidas || !!meal.publicId)
  );
}

@Injectable({
  providedIn: 'root',
})
export class MealService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);
  private readonly injector = inject(Injector);

  // AngularFire avisa cuando sus APIs se llaman fuera del contexto de
  // inyección: pierde el wrapping de zona y desestabiliza change detection.
  // Acá pasa siempre, porque las escrituras salen de effects y de promesas
  // resueltas, no del constructor. `runInInjectionContext` se lo devuelve.
  //
  // Envuelve la llamada entera, `doc()` incluido, y de forma síncrona: el
  // contexto vale mientras corre el callback, así que lo que tiene que nacer
  // adentro es la promesa, no su resolución.
  private enContexto<T>(fn: () => T): T {
    return runInInjectionContext(this.injector, fn);
  }

  private dialogService = inject(DialogService);
  private readonly recetasPublicas = inject(RecetaPublicaService);
  // Lo último que se escribió por cada receta publicada. Sin esto, cada
  // tecleo en cualquier comida reescribiría todas las publicadas.
  private readonly espejo = new Map<string, string>();
  // Los `publicId` que `meals` tenía la última vez que el effect corrió. Los
  // cuatro caminos que pisan `meals` entero (la descarga de
  // `syncFromFirestore`, y los merges de `importMeals`, `applyImportedMeals`
  // e `importData`) pueden dejar caer uno sin despublicarlo; el diff contra
  // este set es lo que los cubre a los cuatro sin un guard en cada uno.
  //
  // Arranca vacío y no hace falta sembrarlo: la primera corrida del effect
  // pasa con el `meals` de localStorage, y un set vacío no puede dar un
  // huérfano falso. Sembrarlo en el constructor sería lo mismo con más código.
  private publicados = new Set<string>();

  private readonly MEALS_KEY = 'comidas_meals';
  private readonly SCHEDULES_KEY = 'comidas_schedules';
  private readonly TAGS_KEY = 'comidas_tags';
  private readonly INGREDIENT_TAGS_KEY = 'comidas_ingredient_tags';
  private readonly EXTRA_ITEMS_KEY = 'comidas_extra_items';
  private readonly EXTRA_ITEMS_HISTORY_KEY = 'comidas_extra_items_history';
  private readonly FAMILY_SETTINGS_KEY = 'comidas_family_settings';
  private readonly QUANTITY_OVERRIDES_KEY = 'comidas_quantity_overrides';
  private readonly CHECKED_ITEMS_KEY = 'comidas_checked_items';
  private readonly LAST_UPDATED_KEY = 'comidas_last_updated';
  private readonly PANTRY_KEY = 'comidas_pantry';
  private readonly PANTRY_GROUPS_KEY = 'comidas_pantry_groups';
  private readonly MIGRATION_NUMERIC_QTY_KEY = 'comidas_migration_numeric_qty';
  private readonly MIGRATION_DISH_FORMAT_KEY = 'comidas_migration_dish_format';
  private readonly MIGRATION_SPLIT_UNIT_KEY = 'comidas_migration_split_unit';
  private readonly ALIAS_KEY = 'comidas_alias';
  readonly alias = signal<string>(localStorage.getItem(this.ALIAS_KEY) ?? '');
  private scheduleMigrationOccurred = false;
  readonly migrationOccurred = signal<boolean>(false);

  // State
  readonly meals = signal<Meal[]>(this.loadMeals());
  private readonly schedules = signal<Record<string, DaySchedule[]>>(
    this.loadSchedules()
  );

  readonly tags = signal<ShoppingTag[]>(this.loadTags());
  readonly ingredientTags = signal<Record<string, string>>(
    this.loadIngredientTags()
  );
  readonly extraItems = signal<Record<string, ShoppingItem[]>>(
    this.loadExtraItems()
  );
  readonly extraItemsHistory = signal<ShoppingItem[]>(
    this.loadExtraItemsHistory()
  );

  readonly currentExtraItems = computed(() => {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    return this.extraItems()[weekKey] || [];
  });

  readonly allIngredientNames = computed(() => {
    const names = new Set<string>();
    this.meals().forEach((meal) => {
      meal.ingredients.forEach((ing) => {
        const normalized = ing.name.trim().toLowerCase();
        if (normalized) {
          names.add(normalized);
        }
      });
    });
    return Array.from(names).sort();
  });

  // Map of "weekKey_ingredientName" -> newQuantity
  readonly quantityOverrides = signal<Record<string, string>>(
    this.loadOverrides()
  );

  // Map of "weekKey" -> string[] (list of checked ingredient names)
  readonly checkedItems = signal<Record<string, string[]>>(
    this.loadCheckedItems()
  );

  readonly pantry = signal<PantryItem[]>(this.loadPantry());
  readonly pantryGroups = signal<PantryGroup[]>(this.loadPantryGroups());
  readonly todayTimestamp = signal<number>(this.getTodayTimestamp());

  // Decide qué pasa con una escritura que cae durante una sincronización.
  // Antes era un boolean y esas escrituras se descartaban sin reintento.
  private readonly cola = new ColaDeGuardado();

  // El uid de la última sincronización. `user()` de @angular/fire emite en
  // cada refresco del ID token —cerca de una vez por hora—, así que sin esta
  // guarda el effect volvía a sincronizar sobre una sesión que no cambió de
  // usuario, abriendo una ventana de pérdida nueva cada vez.
  private uidSincronizado: string | null = null;

  // Family Mode State
  readonly isFamilyMode = signal<boolean>(false);
  readonly visibleMeals = signal<{
    breakfast: boolean;
    lunch: boolean;
    snack: boolean;
    dinner: boolean;
  }>({
    breakfast: true,
    lunch: true,
    snack: false,
    dinner: true,
  });
  readonly familyPortions = signal<number>(4);

  // Navigation State
  readonly currentWeekStart = signal<Date>(this.getStartOfWeek(new Date()));

  // Sync state
  readonly lastUpdated = signal<number>(this.loadLastUpdated());
  readonly syncStatus = signal<
    'synced' | 'local-newer' | 'loading' | 'error' | 'offline'
  >('loading');

  constructor() {
    this.loadFamilySettings();

    if (this.scheduleMigrationOccurred) {
      this.migrationOccurred.set(true);
    }

    // Sync with Firestore on login
    effect(() => {
      const user = this.authService.currentUser();
      if (user && user.uid !== this.uidSincronizado) {
        this.uidSincronizado = user.uid;
        this.syncFromFirestore(user.uid);
      }
    });

    // Persist changes - skip Firebase save during sync from Firestore
    effect(() => {
      const data = this.meals();
      localStorage.setItem(this.MEALS_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('meals')) {
        this.saveToFirestore('meals', data);
        // Sin sesión las dos escriben en `recetasPublicas` y las reglas las
        // rechazan: al arrancar, este efecto corre antes de que auth resuelva
        // y disparaba una escritura condenada por cada receta compartida. El
        // `.catch` de cada una revierte y reintenta en el próximo cambio de
        // `meals`, así que no se perdía nada — pero eran writes al pedo y un
        // error rojo en consola en cada carga.
        //
        // `untracked` porque si no el efecto pasaría a depender de
        // `currentUser()`, que emite en cada refresco de token: volvería a
        // correr cada hora y a mandar `meals` de nuevo sin que cambie nada.
        if (untracked(() => this.authService.currentUser())) {
          this.despublicarHuerfanos(data);
          this.sincronizarPublicadas(data);
        }
      }
      // Fuera del `if` a propósito. Una bajada de Firestore no revoca nada
      // —es el estado de otro dispositivo: si allá despublicaron, el
      // documento ya no está, y si el remoto viene viejo y gana una carrera,
      // revocar mataría un link recién creado—, pero el set igual tiene que
      // quedar en lo que se bajó, o el próximo cambio local leería como
      // huérfano lo que despublicó el otro dispositivo.
      this.publicados = publicIds(data);
    });
    effect(() => {
      const data = this.schedules();
      localStorage.setItem(this.SCHEDULES_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('schedules')) {
        this.saveToFirestore('schedules', data);
      }
    });
    effect(() => {
      const data = this.tags();
      localStorage.setItem(this.TAGS_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('tags')) {
        this.saveToFirestore('tags', data);
      }
    });
    effect(() => {
      const data = this.ingredientTags();
      localStorage.setItem(this.INGREDIENT_TAGS_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('ingredientTags')) {
        this.saveToFirestore('ingredientTags', data);
      }
    });
    effect(() => {
      const data = this.extraItems();
      localStorage.setItem(this.EXTRA_ITEMS_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('extraItems')) {
        this.saveToFirestore('extraItems', data);
      }
    });
    effect(() => {
      const data = this.extraItemsHistory();
      localStorage.setItem(this.EXTRA_ITEMS_HISTORY_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('extraItemsHistory')) {
        this.saveToFirestore('extraItemsHistory', data);
      }
    });
    effect(() => {
      const data = this.quantityOverrides();
      localStorage.setItem(this.QUANTITY_OVERRIDES_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('overrides')) {
        this.saveToFirestore('overrides', data);
      }
    });
    effect(() => {
      const data = this.checkedItems();
      localStorage.setItem(this.CHECKED_ITEMS_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('checkedItems')) {
        this.saveToFirestore('checkedItems', data);
      }
    });
    effect(() => {
      const data = this.pantry();
      localStorage.setItem(this.PANTRY_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('pantry')) {
        this.saveToFirestore('pantry', data);
      }
    });
    effect(() => {
      const data = this.pantryGroups();
      localStorage.setItem(this.PANTRY_GROUPS_KEY, JSON.stringify(data));
      if (this.cola.debeGuardarAhora('pantryGroups')) {
        this.saveToFirestore('pantryGroups', data);
      }
    });
    effect(() => {
      const settings = {
        isFamilyMode: this.isFamilyMode(),
        visibleMeals: this.visibleMeals(),
        familyPortions: this.familyPortions(),
      };
      localStorage.setItem(this.FAMILY_SETTINGS_KEY, JSON.stringify(settings));
      if (this.cola.debeGuardarAhora('familySettings')) {
        this.saveToFirestore('familySettings', settings);
      }
    });
    effect(() => {
      const data = this.alias();
      localStorage.setItem(this.ALIAS_KEY, data);
      if (this.cola.debeGuardarAhora('alias')) {
        this.saveToFirestore('alias', data);
      }
    });
    this.migrateQuantitiesToNumeric();
    this.migrateQuantitiesToSplitUnit();
  }

  private sanitizeForFirestore<T>(data: T): T {
    return JSON.parse(JSON.stringify(data)) as T;
  }

  private async saveToFirestore(key: string, data: unknown): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      this.syncStatus.set('offline');
      return;
    }
    // Igual que en uploadAll: el reloj local se mueve recién cuando la
    // escritura salió. Antes se movía primero y una escritura fallida lo
    // dejaba adelantado sin que el remoto se enterara nunca.
    const ahora = Date.now();
    try {
      await this.enContexto(() =>
        setDoc(
          doc(this.firestore, 'users', user.uid),
          this.sanitizeForFirestore({
            [key]: data,
            lastUpdated: ahora,
          }),
          { merge: true }
        )
      );
      this.confirmarTimestamp(ahora);
      this.syncStatus.set('synced');
    } catch (e) {
      console.error(`Error saving ${key} to firestore:`, e);
      this.syncStatus.set('error');
    }
  }

  private huellaPublicada(meal: Meal, alias: string): string {
    return huellaPublicada(meal, alias);
  }

  // Revoca los documentos públicos que se quedaron sin puntero.
  //
  // ponytail: el reintento cuelga del próximo cambio de `meals`. Si el
  // usuario importa un backup sin conexión y no vuelve a tocar una comida, el
  // link queda vivo. Salida: reintentar también al recuperar la sesión.
  private despublicarHuerfanos(meals: Meal[]): void {
    for (const publicId of huerfanos(this.publicados, meals)) {
      this.espejo.delete(publicId);
      this.recetasPublicas.despublicar(publicId).catch((e) => {
        // `publicId` ya no está en ningún `Meal`, así que este set es el
        // único lado donde queda el puntero: devolverlo es lo que deja
        // reintentar en el próximo cambio de `meals`. Sin eso el documento
        // queda vivo y sólo se borra desde la consola de Firebase.
        this.publicados.add(publicId);
        console.error('Error despublicando una receta huérfana:', e);
      });
    }
  }

  private sincronizarPublicadas(meals: Meal[]): void {
    const alias = this.alias();
    for (const meal of meals) {
      if (!meal.publicId) {
        continue;
      }
      const huella = this.huellaPublicada(meal, alias);
      if (this.espejo.get(meal.publicId) === huella) {
        continue;
      }
      const publicId = meal.publicId;
      this.espejo.set(publicId, huella);
      this.recetasPublicas.sincronizar(meal, alias).catch((e) => {
        this.espejo.delete(publicId);
        console.error('Error sincronizando la receta pública:', e);
      });
    }
  }

  async refreshData(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      await this.syncFromFirestore(user.uid);
    }
  }

  async forceUpload(): Promise<void> {
    const user = this.authService.currentUser();
    if (user) {
      await this.uploadAllToFirestore();
    }
  }

  getLastUpdatedDisplay(): string {
    const ts = this.lastUpdated();
    if (ts === 0) {
      return 'Nunca sincronizado';
    }
    return new Date(ts).toLocaleString('es-AR');
  }

  private async syncFromFirestore(uid: string): Promise<void> {
    this.cola.iniciarSync();
    this.syncStatus.set('loading');
    let delUsuario: string[] = [];

    try {
      const docSnap = await this.enContexto(() =>
        getDoc(doc(this.firestore, 'users', uid))
      );

      if (docSnap.exists()) {
        const data = docSnap.data();
        const remoteTimestamp = data['lastUpdated'] || 0;
        const localTimestamp = this.lastUpdated();

        console.log(
          `[Sync] Local: ${new Date(localTimestamp).toISOString()}, ` +
            `Remote: ${new Date(remoteTimestamp).toISOString()}`
        );

        // If local is newer, upload to Firebase instead of downloading
        if (localTimestamp > remoteTimestamp) {
          console.log('[Sync] Local data is newer, uploading to Firebase');
          this.syncStatus.set('local-newer');
          // uploadAll manda el estado entero, así que lo anotado ya viaja ahí.
          this.cola.terminarSync();
          this.uploadAllToFirestore();
          return;
        }

        // Remote is newer or same, download from Firebase
        console.log('[Sync] Remote data is newer or same, downloading');
        // Antes de aplicar nada: lo que el usuario tocó mientras corría el
        // getDoc. Esas claves no se pisan con lo remoto y se mandan al final.
        delUsuario = this.cola.pendientes();
        this.aplicarRemoto(data as Record<string, unknown>);
        // Update local timestamp to match remote
        this.lastUpdated.set(remoteTimestamp);
        localStorage.setItem(this.LAST_UPDATED_KEY, remoteTimestamp.toString());
        this.syncStatus.set('synced');
      } else {
        // First time user - upload local data
        console.log('[Sync] No remote data, uploading local data');
        this.cola.terminarSync();
        this.uploadAllToFirestore();
        return;
      }
    } catch (e) {
      console.error('Error syncing from Firestore', e);
      this.syncStatus.set('error');
    }
    // El setTimeout espera a que corran los efectos que dispararon los `set`
    // de la bajada: esos se anotan solos en la cola y hay que descartarlos.
    // Lo que se reenvía es la foto tomada ANTES de aplicar, que es lo único
    // que escribió el usuario durante la ventana.
    setTimeout(() => {
      this.cola.terminarSync();
      this.reenviar(delUsuario);
    }, 0);
  }

  // Aplica el documento remoto campo por campo, salteando lo que el usuario
  // tocó durante la ventana. Es una tabla y no doce `if` para que la rama
  // "¿lo tocó el usuario?" se escriba una sola vez: escrita doce veces, la
  // que se olvide pisa datos en silencio, que es exactamente el bug que esto
  // arregla. La condición es truthiness, igual que antes, no `!== undefined`:
  // cambiarla alteraría el trato de los valores vacíos.
  private aplicarRemoto(data: Record<string, unknown>): void {
    // Cada aplicador recibe `unknown` y castea: el documento remoto es texto
    // sin validar y el tipo estrecho acá sería una promesa que nadie cumple.
    const aplicadores: Record<string, (valor: unknown) => void> = {
      meals: (v) => this.meals.set(this.normalizeMealQuantities(v as Meal[])),
      schedules: (v) =>
        this.schedules.set(
          this.migrateSchedulesRecord(v as Record<string, unknown[]>)
        ),
      tags: (v) => this.tags.set(v as ShoppingTag[]),
      ingredientTags: (v) =>
        this.ingredientTags.set(v as Record<string, string>),
      // Un array acá es el formato viejo y se descarta.
      extraItems: (v) =>
        this.extraItems.set(
          Array.isArray(v) ? {} : (v as Record<string, ShoppingItem[]>)
        ),
      extraItemsHistory: (v) => this.extraItemsHistory.set(v as ShoppingItem[]),
      overrides: (v) => this.quantityOverrides.set(v as Record<string, string>),
      checkedItems: (v) => this.checkedItems.set(v as Record<string, string[]>),
      pantry: (v) =>
        this.pantry.set(this.normalizePantryQuantities(v as PantryItem[])),
      pantryGroups: (v) => this.pantryGroups.set(v as PantryGroup[]),
      familySettings: (v) => {
        const fs = v as {
          isFamilyMode: boolean;
          visibleMeals?: {
            breakfast: boolean;
            lunch: boolean;
            snack: boolean;
            dinner: boolean;
          };
          familyPortions: number;
        };
        this.isFamilyMode.set(fs.isFamilyMode);
        if (fs.visibleMeals) {
          this.visibleMeals.set(fs.visibleMeals);
        }
        this.familyPortions.set(fs.familyPortions);
      },
    };

    for (const [clave, aplicar] of Object.entries(aplicadores)) {
      if (data[clave] && !this.cola.fueTocado(clave)) {
        aplicar(data[clave]);
      }
    }

    // Aparte de la tabla: el alias se aplica aunque venga vacío, porque
    // borrarlo en otro dispositivo tiene que borrarse acá.
    if (!this.cola.fueTocado('alias')) {
      this.alias.set((data['alias'] as string) ?? '');
    }
  }

  // El estado completo, con las mismas claves que usa el documento remoto y
  // que `saveToFirestore`. Una sola definición para el upload entero y para el
  // reenvío de lo que quedó pendiente.
  private estadoActual(): Record<string, unknown> {
    return {
      meals: this.meals(),
      schedules: this.schedules(),
      tags: this.tags(),
      ingredientTags: this.ingredientTags(),
      extraItems: this.extraItems(),
      extraItemsHistory: this.extraItemsHistory(),
      overrides: this.quantityOverrides(),
      checkedItems: this.checkedItems(),
      pantry: this.pantry(),
      pantryGroups: this.pantryGroups(),
      familySettings: {
        isFamilyMode: this.isFamilyMode(),
        visibleMeals: this.visibleMeals(),
        familyPortions: this.familyPortions(),
      },
      alias: this.alias(),
    };
  }

  // Manda lo que quedó anotado durante una ventana de sincronización. Va por
  // clave y no con `uploadAllToFirestore` a propósito: acá lo remoto que no se
  // tocó ya está aplicado en memoria, así que subir todo pisaría con una copia
  // de ida y vuelta lo que otro dispositivo acaba de escribir.
  private reenviar(claves: string[]): void {
    if (!claves.length) {
      return;
    }
    const estado = this.estadoActual();
    for (const clave of claves) {
      void this.saveToFirestore(clave, estado[clave]);
    }
  }

  private async uploadAllToFirestore(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) {
      this.syncStatus.set('offline');
      return;
    }

    // El timestamp se calcula acá pero se confirma recién si la escritura
    // sale: bumpearlo antes dejaba el reloj local adelantado para siempre
    // cuando el `setDoc` fallaba, y de ahí en más este origen se creía más
    // nuevo que el remoto y lo sobrescribía en cada login.
    const ahora = Date.now();
    try {
      await this.enContexto(() =>
        setDoc(
          doc(this.firestore, 'users', user.uid),
          this.sanitizeForFirestore({
            ...this.estadoActual(),
            lastUpdated: ahora,
          }),
          // Con merge. Sin él, este upload —que se dispara solo, por
          // comparación de relojes— reemplazaba el documento entero: un
          // desfasaje borraba los `schedules`, la `pantry` y los `tags` que
          // este dispositivo no conocía.
          { merge: true }
        )
      );
      this.confirmarTimestamp(ahora);
      this.syncStatus.set('synced');
      console.log('[Sync] All data uploaded to Firebase');
    } catch (e) {
      console.error('Error uploading all data to Firestore:', e);
      this.syncStatus.set('error');
    }
  }

  private getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // Loaders
  private loadMeals(): Meal[] {
    const data = localStorage.getItem(this.MEALS_KEY);
    // Auto-repara comidas guardadas sin id (datos viejos / restaurados) para
    // que puedan usarse en el calendario.
    return ensureMealIds(data ? JSON.parse(data) : [], () => this.generateId());
  }

  private loadSchedules(): Record<string, DaySchedule[]> {
    const data = localStorage.getItem(this.SCHEDULES_KEY);
    if (!data) {
      return {};
    }
    try {
      const parsed = JSON.parse(data) as Record<string, unknown[]>;
      return this.migrateSchedulesRecord(parsed);
    } catch {
      return {};
    }
  }

  private migrateSchedulesRecord(
    raw: Record<string, unknown[]>
  ): Record<string, DaySchedule[]> {
    const result: Record<string, DaySchedule[]> = {};
    for (const [key, week] of Object.entries(raw)) {
      result[key] = (week as Record<string, unknown>[]).map((day) =>
        this.migrateDaySchedule(day)
      );
    }
    return result;
  }

  private migrateDaySchedule(day: Record<string, unknown>): DaySchedule {
    const isOldFormat =
      typeof day['almuerzo'] === 'string' ||
      day['almuerzo'] === null ||
      typeof day['desayuno'] === 'string' ||
      day['desayuno'] === null ||
      typeof day['cena'] === 'string' ||
      day['cena'] === null;
    if (isOldFormat) {
      this.scheduleMigrationOccurred = true;
    }
    return {
      dayName: day['dayName'] as string,
      ...(day['date'] ? { date: day['date'] as string } : {}),
      desayuno: this.toDishArray(
        day['desayuno'],
        day['desayunoExcluded'] as boolean | undefined
      ),
      almuerzo: this.toDishArray(
        day['almuerzo'],
        day['almuerzoExcluded'] as boolean | undefined
      ),
      postreAlmuerzo: (day['postreAlmuerzo'] as string | null) ?? null,
      colacion: (day['colacion'] as string | null) ?? null,
      cena: this.toDishArray(
        day['cena'],
        day['cenaExcluded'] as boolean | undefined
      ),
      postreCena: (day['postreCena'] as string | null) ?? null,
    };
  }

  private toDishArray(value: unknown, excluded?: boolean): Dish[] {
    if (Array.isArray(value)) {
      return value as Dish[];
    }
    if (typeof value === 'string') {
      return [{ mealId: value, portions: 1, excluded: excluded ?? false }];
    }
    return [];
  }

  private loadTags(): ShoppingTag[] {
    const data = localStorage.getItem(this.TAGS_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [
      { id: 'verduderia', name: 'Verdulería', color: '#4caf50' },
      { id: 'carniceria', name: 'Carnicería', color: '#f44336' },
      { id: 'supermercado', name: 'Supermercado', color: '#2196f3' },
    ];
  }

  private loadIngredientTags(): Record<string, string> {
    const data = localStorage.getItem(this.INGREDIENT_TAGS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private loadExtraItems(): Record<string, ShoppingItem[]> {
    const data = localStorage.getItem(this.EXTRA_ITEMS_KEY);
    if (!data) {
      return {};
    }
    try {
      const parsed = JSON.parse(data);
      // Migrate from old array format (discard stale items)
      return Array.isArray(parsed)
        ? {}
        : (parsed as Record<string, ShoppingItem[]>);
    } catch {
      return {};
    }
  }

  private loadExtraItemsHistory(): ShoppingItem[] {
    const data = localStorage.getItem(this.EXTRA_ITEMS_HISTORY_KEY);
    return data ? (JSON.parse(data) as ShoppingItem[]) : [];
  }

  private loadOverrides(): Record<string, string> {
    const data = localStorage.getItem(this.QUANTITY_OVERRIDES_KEY);
    return data ? JSON.parse(data) : {};
  }

  private loadCheckedItems(): Record<string, string[]> {
    const data = localStorage.getItem(this.CHECKED_ITEMS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private loadPantry(): PantryItem[] {
    const data = localStorage.getItem(this.PANTRY_KEY);
    return data ? (JSON.parse(data) as PantryItem[]) : [];
  }

  private loadPantryGroups(): PantryGroup[] {
    const data = localStorage.getItem(this.PANTRY_GROUPS_KEY);
    if (data) {
      return JSON.parse(data) as PantryGroup[];
    }
    return [
      { id: 'heladera', name: 'Heladera', color: '#42a5f5' },
      { id: 'verduras', name: 'Verduras', color: '#66bb6a' },
      { id: 'freezer', name: 'Freezer', color: '#ab47bc' },
      { id: 'alacena', name: 'Alacena', color: '#ffa726' },
    ];
  }

  private loadLastUpdated(): number {
    const data = localStorage.getItem(this.LAST_UPDATED_KEY);
    return data ? parseInt(data, 10) : 0;
  }

  // Se llama después de que la escritura salió, nunca antes.
  //
  // Nunca retrocede: doce efectos pueden disparar escrituras en el mismo tick
  // y resolverse fuera de orden. Si la más vieja confirma última, el reloj
  // local quedaría atrás del remoto y la próxima sincronización bajaría de
  // gusto.
  private confirmarTimestamp(ts: number): void {
    if (ts <= this.lastUpdated()) {
      return;
    }
    this.lastUpdated.set(ts);
    localStorage.setItem(this.LAST_UPDATED_KEY, ts.toString());
  }

  private getTodayTimestamp(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  refreshTodayTimestamp(): void {
    this.todayTimestamp.set(this.getTodayTimestamp());
  }

  private loadFamilySettings(): void {
    const data = localStorage.getItem(this.FAMILY_SETTINGS_KEY);
    if (data) {
      const settings = JSON.parse(data);
      this.isFamilyMode.set(settings.isFamilyMode ?? false);

      if (settings.visibleMeals) {
        this.visibleMeals.set(settings.visibleMeals);
      } else {
        // Migration: defaults based on old setting
        this.visibleMeals.set({
          breakfast: settings.isBreakfastEnabled ?? false,
          lunch: true,
          snack: false,
          dinner: true,
        });
      }

      this.familyPortions.set(settings.familyPortions || 4);
    }
  }

  private createEmptySchedule(): DaySchedule[] {
    const days = [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ];
    return days.map((day) => ({
      dayName: day,
      desayuno: [],
      almuerzo: [],
      postreAlmuerzo: null,
      colacion: null,
      cena: [],
      postreCena: null,
    }));
  }

  // Computed
  readonly schedule = computed(() => {
    const key = this.formatDateKey(this.currentWeekStart());
    return this.schedules()[key] || this.createEmptySchedule();
  });

  readonly weekRangeDisplay = computed(() => {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'short',
    };
    return `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}`;
  });

  // Actions
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  addMeal(meal: Omit<Meal, 'id'>): void {
    const newMeal: Meal = { ...meal, id: this.generateId() };
    this.meals.update((current) => [...current, newMeal]);
  }

  updateMeal(id: string, updatedMeal: Partial<Meal>): void {
    this.meals.update((current) =>
      current.map((m) => (m.id === id ? { ...m, ...updatedMeal } : m))
    );
  }

  // La cascada va esperada y adelante del borrado local a propósito:
  // `publicId` es el único puntero al documento público que existe en algún
  // lado, y `allow list: if false` hace que un documento huérfano no se pueda
  // ni enumerar —sólo se limpia desde la consola de Firebase—. Si despublicar
  // falla, la comida se queda donde está: el puntero sobrevive para reintentar
  // y el usuario se entera, en vez de creer que revocó un link que sigue vivo.
  async deleteMeal(id: string): Promise<void> {
    const publicId = this.meals().find((m) => m.id === id)?.publicId;
    if (publicId) {
      try {
        await this.recetasPublicas.despublicar(publicId);
      } catch (e) {
        console.error('Error despublicando la receta borrada:', e);
        this.dialogService.alert(
          'No se pudo eliminar',
          'La receta sigue compartida, así que no se borró. ' +
            (e instanceof Error ? e.message : 'Probá de nuevo en un momento.')
        );
        return;
      }
      this.espejo.delete(publicId);
      // Ya se despublicó acá, con el manejo de error de arriba: sacarlo del
      // set evita que la barrida del effect pida el borrado una segunda vez.
      this.publicados.delete(publicId);
    }
    this.meals.update((current) => current.filter((m) => m.id !== id));
    this.schedules.update((schedules) => {
      const newSchedules: Record<string, DaySchedule[]> = {};
      for (const [key, week] of Object.entries(schedules)) {
        newSchedules[key] = week.map((day) => ({
          ...day,
          almuerzo: day.almuerzo.filter((d) => d.mealId !== id),
          desayuno: day.desayuno.filter((d) => d.mealId !== id),
          cena: day.cena.filter((d) => d.mealId !== id),
        }));
      }
      return newSchedules;
    });
  }

  // Publica la receta si todavía no tiene link, o devuelve el que ya tiene.
  // Sembrar la huella acá, antes del updateMeal que guarda el publicId, es lo
  // que evita que el effect de `meals` reescriba de entrada el documento que
  // se acaba de crear (no encontraría huella y lo tomaría por desactualizado).
  async compartirMeal(mealId: string): Promise<string> {
    const meal = this.getMeal(mealId);
    if (!meal) {
      throw new Error('La comida no existe.');
    }
    if (meal.publicId) {
      return meal.publicId;
    }
    const alias = this.alias();
    const publicId = await this.recetasPublicas.publicar(meal, alias);
    this.espejo.set(publicId, this.huellaPublicada(meal, alias));
    this.updateMeal(mealId, { publicId });
    return publicId;
  }

  async dejarDeCompartirMeal(mealId: string): Promise<void> {
    const meal = this.getMeal(mealId);
    if (!meal?.publicId) {
      return;
    }
    await this.recetasPublicas.despublicar(meal.publicId);
    this.espejo.delete(meal.publicId);
    this.publicados.delete(meal.publicId);
    this.updateMeal(mealId, { publicId: undefined });
  }

  duplicateMeal(id: string): void {
    const original = this.getMeal(id);
    if (original) {
      this.addMeal(copiaParaDuplicar(original));
    }
  }

  getMeal(id: string): Meal | undefined {
    if (!id) {
      return undefined;
    }
    return this.meals().find((m) => m.id === id);
  }

  updateSchedule(
    dayName: string,
    type: TextScheduleField,
    value: string | null
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) =>
      day.dayName === dayName ? { ...day, [type]: value } : day
    );
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  setMeal(dayName: string, type: DishMealType, mealId: string): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      return { ...day, [type]: [{ mealId, portions: 1, excluded: false }] };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  clearMeal(dayName: string, type: DishMealType): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) =>
      day.dayName === dayName ? { ...day, [type]: [] } : day
    );
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  addDish(
    dayName: string,
    type: DishMealType,
    mealId: string,
    portions: number
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: [...current, { mealId, portions, excluded: false }],
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  removeDish(dayName: string, type: DishMealType, index: number): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return { ...day, [type]: current.filter((_, i) => i !== index) };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  updateDishPortions(
    dayName: string,
    type: DishMealType,
    index: number,
    portions: number
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: current.map((d, i) => (i === index ? { ...d, portions } : d)),
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  updateDishLabel(
    dayName: string,
    type: DishMealType,
    index: number,
    label: string
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: current.map((d, i) => {
          if (i !== index) {
            return d;
          }
          const dish: Dish = { ...d };
          if (label.trim()) {
            dish.label = label.trim();
          } else {
            delete dish.label;
          }
          return dish;
        }),
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  toggleDishExclusion(
    dayName: string,
    type: DishMealType,
    index: number
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: current.map((d, i) =>
          i === index ? { ...d, excluded: !d.excluded } : d
        ),
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  replaceDishMeal(
    dayName: string,
    type: DishMealType,
    index: number,
    mealId: string
  ): void {
    const key = this.formatDateKey(this.currentWeekStart());
    const currentWeekSchedule = this.schedule();
    const updatedWeek = currentWeekSchedule.map((day) => {
      if (day.dayName !== dayName) {
        return day;
      }
      const current = day[type] as Dish[];
      return {
        ...day,
        [type]: current.map((d, i) => (i === index ? { ...d, mealId } : d)),
      };
    });
    this.schedules.update((s) => ({ ...s, [key]: updatedWeek }));
  }

  clearSchedule(): void {
    const key = this.formatDateKey(this.currentWeekStart());
    this.schedules.update((s) => ({ ...s, [key]: this.createEmptySchedule() }));
  }

  nextWeek(): void {
    const next = new Date(this.currentWeekStart());
    next.setDate(next.getDate() + 7);
    this.currentWeekStart.set(next);
  }

  previousWeek(): void {
    const prev = new Date(this.currentWeekStart());
    prev.setDate(prev.getDate() - 7);
    this.currentWeekStart.set(prev);
  }

  goToCurrentWeek(): void {
    this.currentWeekStart.set(this.getStartOfWeek(new Date()));
  }

  copyFromPreviousWeek(): void {
    const currentKey = this.formatDateKey(this.currentWeekStart());
    const prevDate = new Date(this.currentWeekStart());
    prevDate.setDate(prevDate.getDate() - 7);
    const prevKey = this.formatDateKey(prevDate);
    const prevSchedule = this.schedules()[prevKey];
    if (prevSchedule) {
      const copy = JSON.parse(JSON.stringify(prevSchedule));
      this.schedules.update((s) => ({ ...s, [currentKey]: copy }));
    } else {
      this.dialogService.alert(
        'Sin datos',
        'No hay datos de la semana anterior para copiar.'
      );
    }
  }

  addTag(name: string, color: string): void {
    const newTag: ShoppingTag = { id: this.generateId(), name, color };
    this.tags.update((t) => [...t, newTag]);
  }

  setIngredientTag(ingredientName: string, tagId: string): void {
    const key = ingredientName.toLowerCase().trim();
    this.ingredientTags.update((map) => ({ ...map, [key]: tagId }));
  }

  addExtraItem(
    name: string,
    quantity: string,
    tagId?: string,
    unit?: string
  ): void {
    const newItem: ShoppingItem = {
      name,
      quantity,
      unit,
      tagId,
      isExtra: true,
    };
    const weekKey = this.formatDateKey(this.currentWeekStart());
    this.extraItems.update((items) => ({
      ...items,
      [weekKey]: [...(items[weekKey] || []), newItem],
    }));
    const nameLower = name.toLowerCase().trim();
    this.extraItemsHistory.update((history) => {
      const exists = history.some(
        (h) => h.name.toLowerCase().trim() === nameLower
      );
      return exists ? history : [...history, newItem];
    });
    if (tagId) {
      this.setIngredientTag(name, tagId);
    }
  }

  removeExtraItem(index: number): void {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    this.extraItems.update((items) => ({
      ...items,
      [weekKey]: (items[weekKey] || []).filter((_, i) => i !== index),
    }));
  }

  overrideQuantity(ingredientName: string, newQuantity: string): void {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    const key = `${weekKey}_${ingredientName.toLowerCase().trim()}`;
    this.quantityOverrides.update((o) => ({ ...o, [key]: newQuantity }));
  }

  clearOverrides(): void {
    this.refreshTodayTimestamp();
    const weekKey = this.formatDateKey(this.currentWeekStart());
    this.quantityOverrides.update((o) => {
      const newOverrides = { ...o };
      Object.keys(newOverrides).forEach((key) => {
        if (key.startsWith(weekKey)) {
          delete newOverrides[key];
        }
      });
      return newOverrides;
    });
    this.checkedItems.update((prev) => {
      const updated = { ...prev };
      delete updated[weekKey];
      return updated;
    });
  }

  toggleItemCheck(name: string): void {
    const weekKey = this.formatDateKey(this.currentWeekStart());
    const itemName = name.toLowerCase().trim();

    this.checkedItems.update((prev) => {
      const currentChecked = prev[weekKey] || [];
      const isChecked = currentChecked.includes(itemName);

      return {
        ...prev,
        [weekKey]: isChecked
          ? currentChecked.filter((n) => n !== itemName)
          : [...currentChecked, itemName],
      };
    });
  }

  readonly shoppingListGrouped = computed(() => {
    const items: ShoppingItem[] = [];
    const currentSchedule = this.schedule();
    const allMeals = this.meals();
    const today = new Date(this.todayTimestamp());
    const weekStart = this.currentWeekStart();
    const weekKey = this.formatDateKey(weekStart);
    const tagMap = this.ingredientTags();
    const overrides = this.quantityOverrides();
    const weekChecked = this.checkedItems()[weekKey] || [];
    const pantryItems = this.pantry();

    currentSchedule.forEach((day, index) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + index);

      if (dayDate >= today) {
        const processDish = (dish: Dish): void => {
          if (dish.excluded) {
            return;
          }
          const meal = allMeals.find((m) => m.id === dish.mealId);
          if (meal && meal.includeInShoppingList !== false) {
            meal.ingredients.forEach((ing) => {
              const key = ing.name.toLowerCase().trim();
              const quantity = multiplyQuantity(ing.quantity, dish.portions);
              items.push({
                ...ing,
                quantity,
                tagId: tagMap[key],
                isExtra: false,
                checked: weekChecked.includes(key),
              });
            });
          }
        };

        day.almuerzo.forEach(processDish);
        day.desayuno.forEach(processDish);
        day.cena.forEach(processDish);
      }
    });

    this.currentExtraItems().forEach((extra) => {
      const key = extra.name.toLowerCase().trim();
      items.push({
        ...extra,
        tagId: extra.tagId || tagMap[key],
        checked: weekChecked.includes(key),
      });
    });

    const aggregated: { [key: string]: ShoppingItem } = {};
    items.forEach((item) => {
      const key = item.name.toLowerCase().trim();
      if (aggregated[key]) {
        aggregated[key].quantity = this.addQuantities(
          aggregated[key].quantity,
          item.quantity
        );
        if (!aggregated[key].tagId && item.tagId) {
          aggregated[key].tagId = item.tagId;
        }
      } else {
        aggregated[key] = { ...item };
      }
    });

    const groups: ShoppingListGroup[] = this.tags().map((tag) => ({
      tag,
      items: [],
    }));
    const uncategorizedGroup: ShoppingListGroup = { tag: null, items: [] };
    groups.push(uncategorizedGroup);

    Object.values(aggregated).forEach((item) => {
      const overrideKey = `${weekKey}_${item.name.toLowerCase().trim()}`;
      if (overrides[overrideKey]) {
        item.quantityOverride = overrides[overrideKey];
      }

      const pantryEntry = pantryItems.find(
        (p) => p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      if (pantryEntry) {
        const parsedPantry = parseNumericQuantity(pantryEntry.quantity);
        if (parsedPantry?.value !== 0) {
          const effectiveQuantity = item.quantityOverride || item.quantity;
          const { remaining, covered } = this.subtractPantryFromNeeded(
            effectiveQuantity,
            pantryEntry.quantity
          );
          item.pantryQuantity = pantryEntry.quantity;
          item.inPantry = true;
          if (covered) {
            item.checked = true;
          } else {
            item.quantityOverride = remaining;
          }
        }
      }

      const group = item.tagId
        ? groups.find((g) => g.tag?.id === item.tagId)
        : null;
      (group || uncategorizedGroup).items.push(item);
    });

    return groups.filter((g) => g.items.length > 0);
  });

  readonly shoppingList = computed(() =>
    this.shoppingListGrouped().flatMap((g) => g.items)
  );

  toggleFamilyMode(): void {
    this.isFamilyMode.update((v) => !v);
  }
  toggleMealVisibility(meal: 'breakfast' | 'lunch' | 'snack' | 'dinner'): void {
    this.visibleMeals.update((current) => ({
      ...current,
      [meal]: !current[meal],
    }));
  }
  setFamilyPortions(portions: number): void {
    this.familyPortions.set(portions);
  }

  addToPantry(name: string, quantity: string, groupId?: string): void {
    const key = name.toLowerCase().trim();
    this.pantry.update((items) => {
      const existing = items.find((i) => i.name.toLowerCase().trim() === key);
      if (existing) {
        return items.map((i) =>
          i.name.toLowerCase().trim() === key
            ? { ...i, quantity: this.addQuantities(i.quantity, quantity) }
            : i
        );
      }
      return [...items, { name, quantity, ...(groupId ? { groupId } : {}) }];
    });
  }

  removeFromPantry(name: string): void {
    const key = name.toLowerCase().trim();
    this.pantry.update((items) =>
      items.filter((i) => i.name.toLowerCase().trim() !== key)
    );
  }

  updatePantryQuantity(name: string, quantity: string): void {
    const key = name.toLowerCase().trim();
    this.pantry.update((items) =>
      items.map((i) =>
        i.name.toLowerCase().trim() === key ? { ...i, quantity } : i
      )
    );
  }

  updatePantryGroup(name: string, groupId: string): void {
    const key = name.toLowerCase().trim();
    this.pantry.update((items) =>
      items.map((i) =>
        i.name.toLowerCase().trim() === key ? { ...i, groupId } : i
      )
    );
  }

  subtractFromPantry(name: string, amount: string): void {
    const key = name.toLowerCase().trim();
    let didSubtract = false;
    this.pantry.update((items) =>
      items.map((i) => {
        if (i.name.toLowerCase().trim() !== key) {
          return i;
        }
        const parsed = parseNumericQuantity(i.quantity);
        const parsedAmount = parseNumericQuantity(amount);
        const unitsCompatible =
          parsed &&
          parsedAmount &&
          (parsed.unit === parsedAmount.unit ||
            !parsed.unit ||
            !parsedAmount.unit);
        if (unitsCompatible && parsed && parsedAmount) {
          didSubtract = true;
          const remaining = Math.max(0, parsed.value - parsedAmount.value);
          const unit = parsed.unit || parsedAmount.unit;
          return {
            ...i,
            quantity: unit ? `${remaining} ${unit}` : `${remaining}`,
          };
        }
        return i;
      })
    );
    if (didSubtract) {
      this.autoCheckIfCovered(key);
    }
  }

  private autoCheckIfCovered(key: string): void {
    const pantryEntry = this.pantry().find(
      (p) => p.name.toLowerCase().trim() === key
    );
    if (!pantryEntry) {
      return;
    }
    const parsedPantry = parseNumericQuantity(pantryEntry.quantity);
    if (parsedPantry?.value === 0) {
      return;
    }
    const shoppingItem = this.shoppingList().find(
      (s) => s.name.toLowerCase().trim() === key
    );
    if (!shoppingItem || shoppingItem.checked) {
      return;
    }
    const needed = shoppingItem.quantityOverride || shoppingItem.quantity;
    const { covered } = this.subtractPantryFromNeeded(
      needed,
      pantryEntry.quantity
    );
    if (covered) {
      this.toggleItemCheck(shoppingItem.name);
    }
  }

  clearPantry(): void {
    this.pantry.set([]);
  }

  addPantryGroup(name: string, color?: string): void {
    const newGroup: PantryGroup = {
      id: this.generateId(),
      name,
      ...(color ? { color } : {}),
    };
    this.pantryGroups.update((g) => [...g, newGroup]);
  }

  removePantryGroup(id: string): void {
    this.pantryGroups.update((g) => g.filter((group) => group.id !== id));
    this.pantry.update((items) =>
      items.map((i) => {
        if (i.groupId !== id) {
          return i;
        }
        const item = { ...i };
        delete item.groupId;
        return item;
      })
    );
  }

  updatePantryGroupColor(id: string, color: string): void {
    this.pantryGroups.update((groups) =>
      groups.map((g) => (g.id === id ? { ...g, color } : g))
    );
  }

  getCartPantryDiff(): {
    name: string;
    needed: string;
    inPantry: string;
    remaining: string;
    covered: boolean;
  }[] {
    const result: {
      name: string;
      needed: string;
      inPantry: string;
      remaining: string;
      covered: boolean;
    }[] = [];
    const pantryItems = this.pantry();
    this.shoppingList().forEach((item) => {
      const pantryEntry = pantryItems.find(
        (p) => p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      if (pantryEntry) {
        const parsedPantry = parseNumericQuantity(pantryEntry.quantity);
        if (parsedPantry?.value === 0) {
          return;
        }
        const needed = item.quantityOverride || item.quantity;
        const { remaining, covered } = this.subtractPantryFromNeeded(
          needed,
          pantryEntry.quantity
        );
        result.push({
          name: item.name,
          needed,
          inPantry: pantryEntry.quantity,
          remaining,
          covered,
        });
      }
    });
    return result;
  }

  applyCartToPantry(): void {
    const diff = this.getCartPantryDiff();
    diff.forEach(({ name, needed }) => {
      this.subtractFromPantry(name, needed);
    });
  }

  private normalizeMealQuantities(meals: Meal[]): Meal[] {
    return ensureMealIds(meals, () => this.generateId()).map((meal) => ({
      ...meal,
      ingredients: meal.ingredients.map((ing) => {
        if (ing.unit !== undefined) {
          return {
            ...ing,
            quantity: normalizeQuantityToNumeric(ing.quantity),
          };
        }
        // Old format: try to split "500 g" → { quantity: "500", unit: "g" }
        const parsed = parseNumericQuantity(ing.quantity);
        return parsed
          ? { ...ing, quantity: `${parsed.value}`, unit: parsed.unit }
          : { ...ing, unit: '' };
      }),
    }));
  }

  private normalizePantryQuantities(items: PantryItem[]): PantryItem[] {
    return items.map((item) => ({
      ...item,
      quantity: normalizeQuantityToNumeric(item.quantity),
    }));
  }

  private migrateQuantitiesToNumeric(): void {
    if (localStorage.getItem(this.MIGRATION_NUMERIC_QTY_KEY)) {
      return;
    }
    this.meals.update((meals) => this.normalizeMealQuantities(meals));
    this.pantry.update((items) => this.normalizePantryQuantities(items));
    localStorage.setItem(this.MIGRATION_NUMERIC_QTY_KEY, '1');
  }

  private migrateQuantitiesToSplitUnit(): void {
    if (localStorage.getItem(this.MIGRATION_SPLIT_UNIT_KEY)) {
      return;
    }
    this.meals.update((meals) => this.normalizeMealQuantities(meals));
    localStorage.setItem(this.MIGRATION_SPLIT_UNIT_KEY, '1');
  }

  private addQuantities(existing: string, added: string): string {
    const parsedExisting = parseNumericQuantity(existing);
    const parsedAdded = parseNumericQuantity(added);
    if (
      parsedExisting &&
      parsedAdded &&
      (parsedExisting.unit === parsedAdded.unit ||
        !parsedExisting.unit ||
        !parsedAdded.unit)
    ) {
      const total = parsedExisting.value + parsedAdded.value;
      const unit = parsedExisting.unit || parsedAdded.unit;
      return unit ? `${total} ${unit}` : `${total}`;
    }
    return `${existing} + ${added}`;
  }

  subtractPantryFromNeeded(
    needed: string,
    inPantry: string
  ): { remaining: string; covered: boolean } {
    const parsedNeeded = parseNumericQuantity(needed);
    const parsedPantry = parseNumericQuantity(inPantry);
    if (
      parsedNeeded &&
      parsedPantry &&
      (parsedNeeded.unit === parsedPantry.unit ||
        !parsedNeeded.unit ||
        !parsedPantry.unit)
    ) {
      const remaining = parsedNeeded.value - parsedPantry.value;
      if (remaining <= 0) {
        return { remaining: '0', covered: true };
      }
      const unit = parsedNeeded.unit || parsedPantry.unit;
      return {
        remaining: unit ? `${remaining} ${unit}` : `${remaining}`,
        covered: false,
      };
    }
    return { remaining: needed, covered: false };
  }

  exportData(): void {
    // Sale de `estadoActual()` y no de una lista propia: escrita a mano acá,
    // el backup se había quedado sin `alias` ni `checkedItems`. Restaurarlo te
    // dejaba sin el nombre de cocinero y sin los tildes de la lista de
    // compras, en silencio.
    const data = { ...this.estadoActual(), version: '1.4' };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comidas-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  exportMeals(): void {
    const data = { meals: this.meals(), version: '1.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comidas-meals-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  importMeals(jsonContent: string): void {
    try {
      const normalized = this.parseMealsInput(jsonContent);
      if (!normalized) {
        this.dialogService.alert(
          'Error',
          'El archivo no contiene comidas válidas.'
        );
        return;
      }
      const existing = this.meals();
      const existingMap = new Map(existing.map((m) => [m.id, m]));
      normalized.forEach((m) => existingMap.set(m.id, m));
      this.meals.set(Array.from(existingMap.values()));
      this.dialogService.alert(
        'Importación',
        `Se importaron ${normalized.length} comida(s) correctamente.`
      );
    } catch (error) {
      console.error('Error al importar comidas:', error);
      this.dialogService.alert(
        'Error',
        'El archivo no tiene un formato válido.'
      );
    }
  }

  // Parsea un JSON de comidas (array crudo o { meals: [...] }), normaliza
  // cantidades y asegura un id en cada comida. Lanza si el JSON es inválido.
  parseMealsInput(jsonContent: string): Meal[] | null {
    const data = JSON.parse(jsonContent);
    const raw: Meal[] | null = Array.isArray(data)
      ? (data as Meal[])
      : Array.isArray(data?.meals)
        ? (data.meals as Meal[])
        : null;
    if (!raw) {
      return null;
    }
    return this.normalizeMealQuantities(raw).map((m) =>
      m.id ? m : { ...m, id: this.generateId() }
    );
  }

  // Normaliza un nombre para comparar duplicados: minúsculas, sin acentos, sin
  // espacios sobrantes.
  private normalizeName(name: string): string {
    return (name ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  }

  // Busca una comida existente por nombre normalizado (los JSON pegados/IA
  // suelen no traer id).
  findMealByName(name: string): Meal | undefined {
    const target = this.normalizeName(name);
    return this.meals().find((m) => this.normalizeName(m.name) === target);
  }

  // Aplica una importación ya resuelta por el usuario fila a fila.
  // - skip: se descarta.
  // - replace: pisa la comida existente (por id, o por nombre si no hay match
  //   de id) conservando el id existente.
  // - new: se agrega como comida nueva con id propio.
  applyImportedMeals(
    resolved: { action: 'replace' | 'skip' | 'new'; meal: Meal }[]
  ): number {
    const current = [...this.meals()];
    const byId = new Map(current.map((m, i) => [m.id, i]));
    let imported = 0;

    for (const { action, meal } of resolved) {
      if (action === 'skip') {
        continue;
      }
      if (action === 'replace') {
        const existing =
          (meal.id && byId.has(meal.id)
            ? current[byId.get(meal.id)!]
            : this.findMealByName(meal.name)) ?? null;
        if (existing) {
          const idx = byId.get(existing.id)!;
          current[idx] = { ...meal, id: existing.id };
          imported++;
          continue;
        }
        // Sin match para reemplazar: cae a "nuevo".
      }
      const fresh = { ...meal, id: this.generateId() };
      current.push(fresh);
      byId.set(fresh.id, current.length - 1);
      imported++;
    }

    this.meals.set(this.normalizeMealQuantities(current));
    return imported;
  }

  // Resumen de conteos de un backup completo, para preview antes de restaurar.
  parseBackupSummary(jsonContent: string): {
    valid: boolean;
    counts?: Record<string, number>;
  } {
    try {
      const data = JSON.parse(jsonContent);
      if (!data || typeof data !== 'object') {
        return { valid: false };
      }
      const len = (v: unknown): number =>
        Array.isArray(v)
          ? v.length
          : v && typeof v === 'object'
            ? Object.keys(v).length
            : 0;
      return {
        valid: true,
        counts: {
          Comidas: len(data.meals),
          Planificaciones: len(data.schedules),
          Etiquetas: len(data.tags),
          Despensa: len(data.pantry),
          Ajustes: data.familySettings ? 1 : 0,
        },
      };
    } catch {
      return { valid: false };
    }
  }

  generateLLMPrompt(): string {
    const meals = this.meals();
    const mealsForPrompt = meals.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? '',
      tags: m.tags ?? [],
      ingredients: m.ingredients.map((ing) => ({
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit ?? '',
      })),
    }));
    const jsonBlock = JSON.stringify(mealsForPrompt, null, 2);
    return (
      `Completá las siguientes comidas en formato JSON.\n` +
      `Para cada comida:\n` +
      `1. Completá o mejorá la descripción corta en español (campo "description").\n` +
      `2. Para cada ingrediente:\n` +
      `   - "quantity": solo el número o cantidad (ej: "500", "2", "1"). No cambies este valor.\n` +
      `   - "unit": la unidad de medida (ej: "g", "kg", "tazas", "cdita", "unidades", "filetes", ` +
      `"al gusto"). Si ya tiene unidad, dejala. Si no tiene, completala.\n` +
      `3. El campo "tags" es un array de strings. Si ya tiene tags, conservalos y agregá los ` +
      `que falten. Si está vacío, generá entre 1 y 4 tags en español que describan la comida ` +
      `(ej: "pollo", "pasta", "sin gluten", "rápido", "horno", "vegano", "desayuno").\n\n` +
      `Devolvé SOLO el JSON con el array de comidas (sin texto previo, sin explicaciones, ` +
      `sin bloques de código markdown).\n\n` +
      `${jsonBlock}`
    );
  }

  // Restaura un backup completo. **Reemplaza** cada clave que venga en el
  // archivo —no mergea— y los efectos suben lo reemplazado a Firestore, así
  // que se propaga a los demás dispositivos. Para tocar sólo las comidas, y
  // mergeando por id, está `importMeals`.
  //
  // Se arma todo antes de tocar un solo signal. Antes aplicaba mientras
  // parseaba: un archivo que reventaba en la mitad dejaba unas claves
  // reemplazadas y otras no, los efectos ya las habían persistido y subido, y
  // el cartel decía "El archivo no tiene un formato válido" sobre media
  // importación ya aplicada. Las transformaciones que pueden tirar
  // —`normalizeMealQuantities`, `migrateSchedulesRecord`— corren en la primera
  // fase; la segunda son puros `set`, que no tiran.
  //
  // `version` se escribe pero no se lee, ni acá ni nunca: el contrato real es
  // por forma, campo por campo. Un backup viejo entra igual y uno nuevo en una
  // app vieja entra ignorando lo que no conoce.
  importData(jsonContent: string): void {
    let aplicar: (() => void)[];
    try {
      const data = JSON.parse(jsonContent);
      if (!pareceBackup(data)) {
        throw new Error('El JSON no tiene ninguna clave de backup.');
      }
      aplicar = this.prepararImport(data);
    } catch (error) {
      console.error('Error al importar:', error);
      this.dialogService.alert(
        'Error',
        'El archivo no tiene un formato válido. No se cambió nada.'
      );
      return;
    }

    for (const paso of aplicar) {
      paso();
    }
    this.dialogService.alert('Importación', '¡Datos importados con éxito!');
  }

  // Primera fase del import: transforma todo y devuelve los `set` pendientes,
  // sin tocar nada. Si algo acá tira, no se aplicó ni un campo.
  private prepararImport(data: Record<string, unknown>): (() => void)[] {
    const pasos: (() => void)[] = [];
    if (data['meals']) {
      const v = this.normalizeMealQuantities(data['meals'] as Meal[]);
      pasos.push(() => this.meals.set(v));
    }
    if (data['schedules']) {
      const v = this.migrateSchedulesRecord(
        data['schedules'] as Record<string, unknown[]>
      );
      pasos.push(() => this.schedules.set(v));
    }
    if (data['tags']) {
      const v = data['tags'] as ShoppingTag[];
      pasos.push(() => this.tags.set(v));
    }
    if (data['ingredientTags']) {
      const v = data['ingredientTags'] as Record<string, string>;
      pasos.push(() => this.ingredientTags.set(v));
    }
    if (data['extraItems']) {
      const crudo = data['extraItems'];
      // Un array acá es el formato viejo y se descarta.
      const v = Array.isArray(crudo)
        ? {}
        : (crudo as Record<string, ShoppingItem[]>);
      pasos.push(() => this.extraItems.set(v));
    }
    if (data['extraItemsHistory']) {
      const v = data['extraItemsHistory'] as ShoppingItem[];
      pasos.push(() => this.extraItemsHistory.set(v));
    }
    if (data['overrides']) {
      const v = data['overrides'] as Record<string, string>;
      pasos.push(() => this.quantityOverrides.set(v));
    }
    if (data['checkedItems']) {
      const v = data['checkedItems'] as Record<string, string[]>;
      pasos.push(() => this.checkedItems.set(v));
    }
    // Los backups anteriores a la 1.4 no lo traen: sin la guarda, restaurar
    // uno viejo borraría el alias actual en vez de dejarlo como está.
    if (typeof data['alias'] === 'string') {
      const v = data['alias'];
      pasos.push(() => this.alias.set(v));
    }
    if (data['pantry']) {
      const v = this.normalizePantryQuantities(data['pantry'] as PantryItem[]);
      pasos.push(() => this.pantry.set(v));
    }
    if (data['pantryGroups']) {
      const v = data['pantryGroups'] as PantryGroup[];
      pasos.push(() => this.pantryGroups.set(v));
    }
    if (data['familySettings']) {
      const fs = data['familySettings'] as {
        isFamilyMode: boolean;
        familyPortions: number;
        visibleMeals?: {
          breakfast: boolean;
          lunch: boolean;
          snack: boolean;
          dinner: boolean;
        };
        // Formato viejo, anterior a `visibleMeals`.
        isBreakfastEnabled?: boolean;
      };
      const visibles = fs.visibleMeals ?? {
        breakfast: fs.isBreakfastEnabled ?? false,
        lunch: true,
        snack: false,
        dinner: true,
      };
      pasos.push(() => {
        this.isFamilyMode.set(fs.isFamilyMode);
        this.visibleMeals.set(visibles);
        this.familyPortions.set(fs.familyPortions);
      });
    }
    return pasos;
  }
}
