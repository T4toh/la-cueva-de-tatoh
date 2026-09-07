# Receta pública por link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compartir una receta de `comidas` con un link que abre sin login y que se ve bien pegado en un chat.

**Architecture:** Publicar copia la receta a una colección nueva `recetasPublicas/{id}` de lectura pública, con un id corto que hace de llave. La app la muestra en una ruta sin auth reusando `receta-detalle`. Los `og:` los inyecta un Worker de Cloudflare que corre sólo en `/r/*` y reescribe el `index.html` con `HTMLRewriter`.

**Tech Stack:** Angular 22 (signals, standalone), `@angular/fire` 20 (Firestore), Vitest, Cloudflare Workers con Static Assets.

**Spec:** [`docs/superpowers/specs/2026-09-07-receta-publica-design.md`](../specs/2026-09-07-receta-publica-design.md)

## Global Constraints

- **pnpm, nunca npm.** El `preinstall` lo bloquea.
- **Cero dependencias nuevas.** El Worker va en JavaScript plano para que lo bundlee la build de Cloudflare sin agregar `wrangler` al repo.
- **ESLint es la verdad.** `pnpm lint` tiene que pasar sin tocar la config: tipo de retorno explícito en toda función, nunca `public`, `type` en vez de `interface`, `curly` siempre, `eqeqeq`, `max-len: 120`, `@if`/`@for` en templates, atributos en orden alfabético dentro de su grupo.
- **`ng build componentes` antes de cualquier build o test de app** que importe la librería.
- **Rutas eager.** `comidas` no tiene rutas lazy y eso es lo que hace segura la estrategia `skipWaiting` de `ngsw-custom.js`. No agregar `loadComponent`.
- **Los commits no llevan co-autor.**
- **El id publicado es la llave de la receta.** No acortarlo por debajo de 6 caracteres, no reemplazarlo por algo derivado del nombre o del uid.
- Proyecto de Firebase: `la-cueva-comidas`. Dominio de producción: `comidas.tatoh.ar`.

---

### Task 1: Helpers puros de publicación

Todo lo que decide algo vive acá, en funciones puras y testeadas. El servicio de la tarea 4 sólo va a cablear Firestore.

**Files:**
- Create: `projects/comidas/src/app/services/receta-publica.ts`
- Test: `projects/comidas/src/app/services/receta-publica.spec.ts`

**Interfaces:**
- Consumes: `Meal`, `Ingredient`, `Paso` de `../models/meal.model`.
- Produces:
  - `type RecetaPublica`
  - `generarIdPublico(bytes?: () => Uint8Array): string`
  - `slug(texto: string): string`
  - `rutaPublica(nombre: string, alias: string | undefined, id: string): string`
  - `idDesdeRuta(ruta: string): string`
  - `aRecetaPublica(meal, alias, ownerUid, id, ahora): RecetaPublica`
  - `aMeal(receta: RecetaPublica, id: string): Meal`

- [ ] **Step 1: Escribir el test que falla**

Crear `projects/comidas/src/app/services/receta-publica.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  aMeal,
  aRecetaPublica,
  generarIdPublico,
  idDesdeRuta,
  rutaPublica,
  slug,
} from './receta-publica';
import { Meal } from '../models/meal.model';

describe('slug', () => {
  it('saca tildes y signos y une con guiones', () => {
    expect(slug('Milanesa a la Napolitana!')).toBe('milanesa-a-la-napolitana');
  });

  it('corta a cinco palabras', () => {
    expect(slug('uno dos tres cuatro cinco seis siete')).toBe(
      'uno-dos-tres-cuatro-cinco'
    );
  });

  it('devuelve vacío cuando no queda ninguna letra usable', () => {
    expect(slug('🍕🍝')).toBe('');
  });
});

describe('rutaPublica', () => {
  it('arma los tres segmentos con el nick adelante', () => {
    expect(rutaPublica('Milanesa napolitana', 'Tatoh', 'k7m2xq9p')).toBe(
      '/r/tatoh/milanesa-napolitana/k7m2xq9p'
    );
  });

  it('omite el segmento del nick cuando no hay alias', () => {
    expect(rutaPublica('Milanesa napolitana', undefined, 'k7m2xq9p')).toBe(
      '/r/milanesa-napolitana/k7m2xq9p'
    );
  });

  it('cae a "receta" cuando el nombre no deja slug', () => {
    expect(rutaPublica('🍕', 'Tatoh', 'k7m2xq9p')).toBe(
      '/r/tatoh/receta/k7m2xq9p'
    );
  });
});

describe('idDesdeRuta', () => {
  it('lee el último segmento con nick', () => {
    expect(idDesdeRuta('/r/tatoh/milanesa-napolitana/k7m2xq9p')).toBe('k7m2xq9p');
  });

  it('lee el último segmento sin nick', () => {
    expect(idDesdeRuta('/r/milanesa-napolitana/k7m2xq9p')).toBe('k7m2xq9p');
  });

  it('ignora la barra final', () => {
    expect(idDesdeRuta('/r/receta/k7m2xq9p/')).toBe('k7m2xq9p');
  });
});

describe('generarIdPublico', () => {
  it('devuelve ocho caracteres en minúsculas y dígitos', () => {
    expect(generarIdPublico()).toMatch(/^[a-z0-9]{8}$/);
  });

  it('descarta los bytes que sesgarían el módulo', () => {
    // 252 y 255 caen fuera de 36*7, así que se tiran; el 0 y el 35 entran.
    const cola = [252, 255, 0, 35, 1, 2, 3, 4, 5, 6];
    const bytes = (): Uint8Array => new Uint8Array(cola.splice(0, 10));
    expect(generarIdPublico(bytes)).toBe('a90123456');
  });
});

describe('aRecetaPublica', () => {
  const meal: Meal = {
    id: 'meal-1',
    name: 'Milanesa napolitana',
    description: 'La de siempre',
    ingredients: [{ name: 'Carne', quantity: '2' }],
    pasos: [{ texto: 'Freír' }],
    tags: ['secreto'],
    includeInShoppingList: true,
  };

  it('publica sólo los campos de la lista blanca', () => {
    const receta = aRecetaPublica(meal, 'Tatoh', 'uid-1', 'k7m2xq9p', 10);

    expect(receta).toEqual({
      nombre: 'Milanesa napolitana',
      descripcion: 'La de siempre',
      ingredientes: [{ name: 'Carne', quantity: '2' }],
      pasos: [{ texto: 'Freír' }],
      alias: 'Tatoh',
      ruta: '/r/tatoh/milanesa-napolitana/k7m2xq9p',
      actualizada: 10,
      ownerUid: 'uid-1',
    });
  });

  it('no filtra los campos privados', () => {
    const receta = aRecetaPublica(meal, 'Tatoh', 'uid-1', 'k7m2xq9p', 10);

    expect(receta).not.toHaveProperty('tags');
    expect(receta).not.toHaveProperty('includeInShoppingList');
    expect(receta).not.toHaveProperty('id');
  });

  it('omite los opcionales vacíos en vez de escribir undefined', () => {
    const pelada: Meal = { id: 'm', name: 'Arroz', ingredients: [] };

    const receta = aRecetaPublica(pelada, undefined, 'uid-1', 'k7m2xq9p', 10);

    expect(receta).not.toHaveProperty('descripcion');
    expect(receta).not.toHaveProperty('pasos');
    expect(receta).not.toHaveProperty('alias');
  });
});

describe('aMeal', () => {
  it('reconstruye una comida mostrable desde el documento público', () => {
    const receta = aRecetaPublica(
      { id: 'm', name: 'Arroz', ingredients: [{ name: 'Arroz', quantity: '1' }] },
      undefined,
      'uid-1',
      'k7m2xq9p',
      10
    );

    expect(aMeal(receta, 'k7m2xq9p')).toEqual({
      id: 'k7m2xq9p',
      name: 'Arroz',
      ingredients: [{ name: 'Arroz', quantity: '1' }],
    });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pnpm test -- --run receta-publica`
Expected: FAIL — `Failed to resolve import "./receta-publica"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `projects/comidas/src/app/services/receta-publica.ts`:

```ts
import { Ingredient, Meal, Paso } from '../models/meal.model';

// El documento que se publica. Es una lista blanca a propósito: `Meal` tiene
// `tags` e `includeInShoppingList`, que son organización privada, y el día que
// gane un campo nuevo no se publica solo.
export type RecetaPublica = {
  nombre: string;
  descripcion?: string;
  ingredientes: Ingredient[];
  pasos?: Paso[];
  alias?: string;
  ruta: string;
  actualizada: number;
  ownerUid: string;
};

const ALFABETO = 'abcdefghijklmnopqrstuvwxyz0123456789';
const LARGO_ID = 8;
// 252 = 36 * 7. Los bytes de 252 para arriba sesgarían el módulo hacia las
// primeras letras, y acá el azar es lo único que hace de llave.
const TOPE_SIN_SESGO = 252;
const MAX_PALABRAS = 5;

function bytesAlAzar(): Uint8Array {
  const bytes = new Uint8Array(LARGO_ID * 2);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function generarIdPublico(bytes: () => Uint8Array = bytesAlAzar): string {
  let id = '';
  while (id.length < LARGO_ID) {
    for (const byte of bytes()) {
      if (byte < TOPE_SIN_SESGO && id.length < LARGO_ID) {
        id += ALFABETO[byte % ALFABETO.length];
      }
    }
  }
  return id;
}

export function slug(texto: string): string {
  const limpio = texto
    .normalize('NFD')
    // Los diacríticos quedan sueltos después del NFD y se tiran acá.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!limpio) {
    return '';
  }
  return limpio.split(' ').slice(0, MAX_PALABRAS).join('-');
}

export function rutaPublica(
  nombre: string,
  alias: string | undefined,
  id: string
): string {
  const nick = slug(alias ?? '');
  const receta = slug(nombre) || 'receta';
  return nick ? `/r/${nick}/${receta}/${id}` : `/r/${receta}/${id}`;
}

export function idDesdeRuta(ruta: string): string {
  const segmentos = ruta.split('/').filter(Boolean);
  return segmentos[segmentos.length - 1] ?? '';
}

export function aRecetaPublica(
  meal: Meal,
  alias: string | undefined,
  ownerUid: string,
  id: string,
  ahora: number
): RecetaPublica {
  const receta: RecetaPublica = {
    nombre: meal.name,
    ingredientes: meal.ingredients ?? [],
    ruta: rutaPublica(meal.name, alias, id),
    actualizada: ahora,
    ownerUid,
  };
  // Los opcionales se omiten en vez de escribirse en `undefined`: Firestore
  // rechaza `undefined` y `sanitizeForFirestore` lo borraría igual.
  if (meal.description) {
    receta.descripcion = meal.description;
  }
  if (meal.pasos?.length) {
    receta.pasos = meal.pasos;
  }
  if (alias) {
    receta.alias = alias;
  }
  return receta;
}

export function aMeal(receta: RecetaPublica, id: string): Meal {
  const meal: Meal = {
    id,
    name: receta.nombre,
    ingredients: receta.ingredientes ?? [],
  };
  if (receta.descripcion) {
    meal.description = receta.descripcion;
  }
  if (receta.pasos?.length) {
    meal.pasos = receta.pasos;
  }
  return meal;
}
```

- [ ] **Step 4: Correr los tests y el lint**

Run: `pnpm test -- --run receta-publica && pnpm lint`
Expected: PASS los dos.

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/services/receta-publica.ts \
        projects/comidas/src/app/services/receta-publica.spec.ts
git commit -m "feat(comidas): helpers de publicación de recetas"
```

---

### Task 2: Regla de Firestore para la colección pública

Es la única lectura anónima del proyecto. Va sola para que se pueda revisar sola.

**Files:**
- Modify: `projects/comidas/firestore.rules`

**Interfaces:**
- Produces: la colección `recetasPublicas/{id}` legible sin auth y escribible sólo por el dueño.

- [ ] **Step 1: Escribir la regla**

En `projects/comidas/firestore.rules`, entre el bloque de `users/{userId}` y el catch-all que niega todo:

```
    // Recetas compartidas por link. El id del documento es la llave: lo genera
    // la app al azar y quien lo tiene, entra. Nada de esto sale de `users`,
    // que guarda todo junto y por eso no se puede abrir por partes.
    match /recetasPublicas/{recetaId} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.ownerUid == request.auth.uid;
      allow update, delete: if request.auth != null
                            && resource.data.ownerUid == request.auth.uid;
    }
```

El bloque `match /{document=**}` que niega todo tiene que seguir **último**.

- [ ] **Step 2: Verificar el orden y que `users` no cambió**

Run: `cat projects/comidas/firestore.rules`
Expected: `users/{userId}` intacto, `recetasPublicas` en el medio, `match /{document=**} { allow read, write: if false; }` al final.

- [ ] **Step 3: Commit**

```bash
git add projects/comidas/firestore.rules
git commit -m "feat(comidas): regla de lectura pública para recetas compartidas"
```

- [ ] **Step 4: Publicar las reglas**

Las reglas **no** se despliegan con la app: se suben desde la consola de Firebase o con `firebase deploy --only firestore:rules`. Hasta que estén publicadas, la tarea 4 va a fallar con `permission-denied` — es la señal esperada, no un bug del código.

---

### Task 3: Alias del autor

**Files:**
- Modify: `projects/comidas/src/app/services/meal.service.ts` (señal nueva + carga + effect de persistencia)
- Modify: `projects/comidas/src/app/components/settings/settings.component.html`

**Interfaces:**
- Produces: `mealService.alias` — `WritableSignal<string>`, persistida en `localStorage` y en `users/{uid}` bajo la clave `alias`.

- [ ] **Step 1: Agregar la señal en `MealService`**

Junto a las otras claves de `localStorage` de la clase:

```ts
  private readonly ALIAS_KEY = 'comidas_alias';
  readonly alias = signal<string>(
    localStorage.getItem(this.ALIAS_KEY) ?? ''
  );
```

- [ ] **Step 2: Persistirla con el mismo patrón que el resto**

Junto a los otros `effect(...)` del constructor (arrancan en `meal.service.ts:259`):

```ts
    effect(() => {
      const data = this.alias();
      localStorage.setItem(this.ALIAS_KEY, data);
      if (!this.isSyncing) {
        this.saveToFirestore('alias', data);
      }
    });
```

- [ ] **Step 3: Leerla al bajar de Firestore**

En `syncFromFirestore`, donde se asignan las otras claves desde `data`, agregar:

```ts
        this.alias.set(data['alias'] ?? '');
```

Y en `uploadAllToFirestore`, dentro del objeto que se sube:

```ts
          alias: this.alias(),
```

- [ ] **Step 4: Agregar el campo en Ajustes**

En `settings.component.html`, dentro del bloque que ya muestra el estado de sincronización cuando hay usuario (`@if (authService.user$ | async; as user)`), antes de los botones de la clase `actions`:

```html
<label class="alias">
  <span>Nombre para las recetas compartidas</span>
  <input
    maxlength="30"
    placeholder="Sin nombre"
    type="text"
    [value]="mealService.alias()"
    (input)="mealService.alias.set($any($event.target).value)"
  />
  <small>Aparece en el link y en la ficha. Vacío, no se muestra autor.</small>
</label>
```

El orden de atributos es el que pide `@angular-eslint/template/attributes-order`: los estáticos, después `[input]`, después `(output)`.

- [ ] **Step 5: Verificar**

Run: `ng build componentes && pnpm lint && pnpm test -- --run`
Expected: PASS. Después, a mano: `ng serve comidas`, entrar a `/settings` con sesión iniciada, escribir un alias, recargar y confirmar que sigue ahí.

- [ ] **Step 6: Commit**

```bash
git add projects/comidas/src/app/services/meal.service.ts \
        projects/comidas/src/app/components/settings/settings.component.html
git commit -m "feat(comidas): alias del autor para las recetas compartidas"
```

---

### Task 4: Servicio de publicación y espejo automático

**Files:**
- Create: `projects/comidas/src/app/services/receta-publica.service.ts`
- Modify: `projects/comidas/src/app/models/meal.model.ts` (campo `publicId`)
- Modify: `projects/comidas/src/app/services/meal.service.ts` (espejo en el effect de `meals`, cascada en `deleteMeal`)

**Interfaces:**
- Consumes: `aRecetaPublica`, `generarIdPublico` de `./receta-publica`.
- Produces:
  - `RecetaPublicaService.publicar(meal: Meal, alias: string): Promise<string>` — crea el documento y devuelve el `publicId`.
  - `RecetaPublicaService.sincronizar(meal: Meal, alias: string): Promise<void>` — reescribe el documento de una receta ya publicada.
  - `RecetaPublicaService.despublicar(publicId: string): Promise<void>` — borra el documento.
  - `RecetaPublicaService.leer(id: string): Promise<RecetaPublica | null>` — lectura anónima, la usa la página pública.

- [ ] **Step 1: Agregar el campo al modelo**

En `projects/comidas/src/app/models/meal.model.ts`, dentro de `type Meal`:

```ts
  // Si está, la receta tiene un documento en `recetasPublicas` y un link vivo.
  publicId?: string;
```

- [ ] **Step 2: Escribir el servicio**

Crear `projects/comidas/src/app/services/receta-publica.service.ts`:

```ts
import { inject, Injectable } from '@angular/core';
import {
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  setDoc,
} from '@angular/fire/firestore';

import { Meal } from '../models/meal.model';
import { AuthService } from './auth.service';
import {
  aRecetaPublica,
  generarIdPublico,
  RecetaPublica,
} from './receta-publica';

const COLECCION = 'recetasPublicas';

@Injectable({ providedIn: 'root' })
export class RecetaPublicaService {
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthService);

  // El alias lo pasa quien llama y no se lee de `MealService`: al revés habría
  // ciclo, porque es `MealService` el que dispara el espejo.
  async publicar(meal: Meal, alias: string): Promise<string> {
    const uid = this.uidOrThrow();
    const id = await this.idLibre();
    await setDoc(
      doc(this.firestore, COLECCION, id),
      aRecetaPublica(meal, alias || undefined, uid, id, Date.now())
    );
    return id;
  }

  async sincronizar(meal: Meal, alias: string): Promise<void> {
    if (!meal.publicId) {
      return;
    }
    const uid = this.uidOrThrow();
    await setDoc(
      doc(this.firestore, COLECCION, meal.publicId),
      aRecetaPublica(meal, alias || undefined, uid, meal.publicId, Date.now())
    );
  }

  async despublicar(publicId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, COLECCION, publicId));
  }

  async leer(id: string): Promise<RecetaPublica | null> {
    const snap = await getDoc(doc(this.firestore, COLECCION, id));
    return snap.exists() ? (snap.data() as RecetaPublica) : null;
  }

  private uidOrThrow(): string {
    const user = this.authService.currentUser();
    if (!user) {
      throw new Error('Hay que iniciar sesión para compartir una receta.');
    }
    return user.uid;
  }

  // Ocho caracteres al azar chocan una vez cada nunca, pero el choque
  // silencioso pisaría la receta de otro: una lectura por publicación es
  // barata al lado de eso.
  private async idLibre(): Promise<string> {
    for (let intento = 0; intento < 5; intento++) {
      const id = generarIdPublico();
      const snap = await getDoc(doc(this.firestore, COLECCION, id));
      if (!snap.exists()) {
        return id;
      }
    }
    throw new Error('No se pudo generar un id libre.');
  }
}
```

- [ ] **Step 3: Enganchar el espejo en `MealService`**

En el constructor, dentro del `effect` que ya persiste `meals` (`meal.service.ts:259`), agregar el espejo **adentro** del `if (!this.isSyncing)` que ya está: así una bajada de Firestore no dispara escrituras públicas.

Primero, el inject y el recuerdo de lo último publicado, junto a los otros campos de la clase:

```ts
  private readonly recetasPublicas = inject(RecetaPublicaService);
  // Lo último que se escribió por cada receta publicada. Sin esto, cada
  // tecleo en cualquier comida reescribiría todas las publicadas.
  private readonly espejo = new Map<string, string>();
```

Después, dentro del effect de `meals`:

```ts
      if (!this.isSyncing) {
        this.saveToFirestore('meals', data);
        this.sincronizarPublicadas(data);
      }
```

Y el método, junto a los otros privados de sincronización:

```ts
  private sincronizarPublicadas(meals: Meal[]): void {
    const alias = this.alias();
    for (const meal of meals) {
      if (!meal.publicId) {
        continue;
      }
      const huella = JSON.stringify([meal.name, meal.description, meal.ingredients, meal.pasos, alias]);
      if (this.espejo.get(meal.publicId) === huella) {
        continue;
      }
      this.espejo.set(meal.publicId, huella);
      this.recetasPublicas.sincronizar(meal, alias).catch((e) => {
        console.error('Error sincronizando la receta pública:', e);
      });
    }
  }
```

Cuidado con `max-len: 120` en la línea de `huella`: partirla si el lint se queja.

- [ ] **Step 4: Cascada al borrar**

En `deleteMeal` (`meal.service.ts:784`), antes del `this.meals.update(...)`:

```ts
    const publicId = this.meals().find((m) => m.id === id)?.publicId;
    if (publicId) {
      this.espejo.delete(publicId);
      this.recetasPublicas.despublicar(publicId).catch((e) => {
        console.error('Error despublicando la receta borrada:', e);
      });
    }
```

- [ ] **Step 5: Verificar**

Run: `ng build componentes && pnpm lint && pnpm test -- --run`
Expected: PASS.

A mano, con las reglas de la tarea 2 ya publicadas y sesión iniciada: no hay UI todavía, así que desde la consola del browser publicar una comida a mano y confirmar en la consola de Firebase que aparece el documento en `recetasPublicas` con los campos de la lista blanca y **sin** `tags`.

- [ ] **Step 6: Commit**

```bash
git add projects/comidas/src/app/services/receta-publica.service.ts \
        projects/comidas/src/app/models/meal.model.ts \
        projects/comidas/src/app/services/meal.service.ts
git commit -m "feat(comidas): publicar, sincronizar y despublicar recetas"
```

---

### Task 5: Botón de compartir en la ficha

**Files:**
- Modify: `projects/comidas/src/app/components/receta-view/receta-view.component.ts`
- Modify: `projects/comidas/src/app/components/receta-view/receta-view.component.html`
- Modify: `projects/comidas/src/app/components/receta-view/receta-view.component.scss`

`receta-detalle` **no se toca**: es presentacional y recibe el bloque por su slot de contenido, igual que hoy recibe el link de volver.

**Interfaces:**
- Consumes: `RecetaPublicaService.publicar` / `despublicar`, `mealService.alias`, `mealService.updateMeal`.

- [ ] **Step 1: Escribir la lógica en el componente**

En `receta-view.component.ts`, agregar al import y a la clase:

```ts
  private readonly recetasPublicas = inject(RecetaPublicaService);
  private readonly dialogService = inject(DialogService);

  readonly publicando = signal(false);
  readonly copiado = signal(false);

  readonly linkPublico = computed(() => {
    const publicId = this.meal()?.publicId;
    if (!publicId) {
      return '';
    }
    return `${location.origin}${rutaPublica(this.meal()?.name ?? '', this.mealService.alias() || undefined, publicId)}`;
  });

  async publicar(): Promise<void> {
    const meal = this.meal();
    if (!meal || this.publicando()) {
      return;
    }
    this.publicando.set(true);
    try {
      const publicId = await this.recetasPublicas.publicar(
        meal,
        this.mealService.alias()
      );
      this.mealService.updateMeal(meal.id, { publicId });
    } catch (e) {
      console.error('Error publicando la receta:', e);
      this.dialogService.alert(
        'No se pudo compartir',
        'Probá de nuevo en un momento.'
      );
    } finally {
      this.publicando.set(false);
    }
  }

  async despublicar(): Promise<void> {
    const meal = this.meal();
    if (!meal?.publicId) {
      return;
    }
    await this.recetasPublicas.despublicar(meal.publicId);
    this.mealService.updateMeal(meal.id, { publicId: undefined });
  }

  async copiar(): Promise<void> {
    await navigator.clipboard.writeText(this.linkPublico());
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 2000);
  }
```

`mealService` está hoy como `private`; cambiarlo a `protected` para que el template lo lea, o exponer un `computed` — **no** ponerle `public`, que `explicit-member-accessibility` lo rechaza.

`DialogService.alert(title: string, message: string): void` es la firma real (`dialog.service.ts:57`).

- [ ] **Step 2: Escribir el template**

En `receta-view.component.html`, dentro del `<app-receta-detalle>`, después del link de volver:

```html
<div class="compartir">
  @if (comida.publicId) {
    <button class="btn-secondary" type="button" (click)="copiar()">
      <lib-icon name="copy" [size]="16" />
      {{ copiado() ? 'Link copiado' : 'Copiar link' }}
    </button>
    <button class="btn-secondary" type="button" (click)="despublicar()">
      <lib-icon name="x" [size]="16" />
      Dejar de compartir
    </button>
  } @else {
    <button
      class="btn-secondary"
      type="button"
      [disabled]="publicando()"
      (click)="publicar()"
    >
      <lib-icon name="external-link" [size]="16" />
      {{ publicando() ? 'Compartiendo…' : 'Compartir' }}
    </button>
  }
</div>
```

Los tres iconos existen en `ICON_NAMES` (`projects/componentes/src/lib/icon/icon.ts`): `copy`, `x`, `external-link`. La librería no tiene `link` ni `share-2`.

- [ ] **Step 3: Estilo mínimo**

En `receta-view.component.scss`:

```scss
.compartir {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
```

Nada de hex sueltos: los colores salen de los tokens de `_tema.scss`.

- [ ] **Step 4: Verificar**

Run: `ng build componentes && pnpm lint && pnpm test -- --run`
Expected: PASS.

A mano: abrir una receta, apretar Compartir, confirmar que aparece el link, copiarlo, recargar la página y ver que el botón sigue en modo "compartida". Apretar "Dejar de compartir" y confirmar que el documento desaparece de Firestore.

- [ ] **Step 5: Commit**

```bash
git add projects/comidas/src/app/components/receta-view/
git commit -m "feat(comidas): compartir y dejar de compartir desde la ficha"
```

---

### Task 6: La página pública

**Files:**
- Create: `projects/comidas/src/app/components/receta-publica-view/receta-publica-view.component.ts`
- Create: `projects/comidas/src/app/components/receta-publica-view/receta-publica-view.component.html`
- Create: `projects/comidas/src/app/components/receta-publica-view/receta-publica-view.component.scss`
- Modify: `projects/comidas/src/app/app.routes.ts`
- Modify: `projects/comidas/src/app/app.html` (esconder la nav)
- Modify: `projects/comidas/src/app/app.ts` (señal de ruta pública)

**Interfaces:**
- Consumes: `RecetaPublicaService.leer`, `aMeal`, `RecetaDetalleComponent`.

- [ ] **Step 1: Escribir el componente**

`receta-publica-view.component.ts`:

```ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Icon } from 'componentes';

import { Meal } from '../../models/meal.model';
import { RecetaPublicaService } from '../../services/receta-publica.service';
import { aMeal } from '../../services/receta-publica';
import { RecetaDetalleComponent } from '../receta-detalle/receta-detalle.component';

@Component({
  selector: 'app-receta-publica-view',
  standalone: true,
  imports: [Icon, RecetaDetalleComponent],
  templateUrl: './receta-publica-view.component.html',
  styleUrls: ['./receta-publica-view.component.scss'],
})
export class RecetaPublicaViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly recetasPublicas = inject(RecetaPublicaService);

  readonly meal = signal<Meal | null>(null);
  readonly cargando = signal(true);
  readonly autor = signal('');

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const receta = await this.recetasPublicas.leer(id);
    if (receta) {
      this.meal.set(aMeal(receta, id));
      this.autor.set(receta.alias ?? '');
      // El link viejo sigue entrando; la barra se corrige a la ruta al día.
      history.replaceState(null, '', receta.ruta);
    }
    this.cargando.set(false);
  }
}
```

`history` y `location` acá son seguros: `comidas` no se prerenderiza (el que sí lo hace es `perfil-personal`).

- [ ] **Step 2: Escribir el template**

`receta-publica-view.component.html`:

```html
@if (cargando()) {
  <p class="estado">Cargando…</p>
} @else if (meal(); as comida) {
  <app-receta-detalle [meal]="comida">
    @if (autor()) {
      <p class="autor">Receta de {{ autor() }}</p>
    }
  </app-receta-detalle>
  <a class="marca" href="/">Hecho con Comidas</a>
} @else {
  <div class="estado">
    <p>Esta receta no existe o dejó de estar compartida.</p>
    <a class="btn-secondary" href="/">Ir a Comidas</a>
  </div>
}
```

- [ ] **Step 3: Estilo mínimo**

`receta-publica-view.component.scss`:

```scss
.estado {
  padding: 2rem 1rem;
  text-align: center;
}

.autor {
  color: var(--fg-secondary);
  margin: 0;
}

.marca {
  display: block;
  padding: 2rem 1rem;
  text-align: center;
}
```

`--fg-secondary` existe en `_tema.scss` y está definido en los dos temas.

- [ ] **Step 4: Registrar las dos rutas**

En `app.routes.ts`, antes del `{ path: '**', redirectTo: '' }`:

```ts
  // Dos rutas y no una con comodín: difieren en cantidad de segmentos, así que
  // no se pisan. El nick y el nombre son decorativos; el id es el que manda.
  { path: 'r/:nick/:slug/:id', component: RecetaPublicaViewComponent },
  { path: 'r/:slug/:id', component: RecetaPublicaViewComponent },
```

Eager, sin `loadComponent`.

- [ ] **Step 5: Esconder la nav en la ruta pública**

En `app.ts`, agregar:

```ts
  readonly esPublica = signal(false);
```

y dentro de la suscripción a `NavigationEnd` que ya existe en `ngOnInit`:

```ts
        this.esPublica.set(this.router.url.startsWith('/r/'));
```

En `app.html`, envolver el `<nav>` entero:

```html
@if (!esPublica()) {
  <nav #mainNav class="main-nav">
    ...
  </nav>
}
```

Ojo: `mainNav` es `@ViewChild(..., { static: true })` y `scrollActiveNavItemIntoView` lo usa. Adentro de un `@if` deja de ser estático — el método ya hace `if (!nav) { return; }`, pero hay que cambiar la consulta a `{ static: false }` o el `ngAfterViewInit` va a leer `undefined` sin quejarse. Confirmar que no rompe la nav normal antes de commitear.

- [ ] **Step 6: Verificar**

Run: `ng build componentes && pnpm lint && pnpm test -- --run`
Expected: PASS.

A mano, con `ng serve comidas`:
1. Publicar una receta y copiar el link.
2. Abrirlo en una ventana privada, sin sesión: tiene que verse la receta completa, sin nav, con el ×1 ×2 ×3 funcionando.
3. Cambiarle el nombre a la receta y abrir el link **viejo**: tiene que entrar igual y corregir la barra de direcciones.
4. Inventar un id: tiene que decir que no existe.

- [ ] **Step 7: Commit**

```bash
git add projects/comidas/src/app/components/receta-publica-view/ \
        projects/comidas/src/app/app.routes.ts \
        projects/comidas/src/app/app.html \
        projects/comidas/src/app/app.ts
git commit -m "feat(comidas): página pública de una receta compartida"
```

---

### Task 7: Los `og:` — meta por defecto y Worker

**Files:**
- Modify: `projects/comidas/src/index.html`
- Create: `projects/comidas/worker/index.js`
- Modify: `projects/comidas/wrangler.jsonc`

**Interfaces:**
- Consumes: el campo `ruta` y los demás del documento público, leídos por REST.

- [ ] **Step 1: Escribir los meta por defecto**

`HTMLRewriter` reescribe lo que existe, no inventa. En `projects/comidas/src/index.html`, dentro del `<head>` después del `theme-color`:

```html
    <!-- Piso para cualquier link de la app. En /r/* el Worker reescribe el
         `content` de estos mismos tags con los datos de la receta. -->
    <meta content="Comidas" property="og:title" />
    <meta
      content="Planificador de comidas, recetas y lista de compras."
      property="og:description"
    />
    <meta content="https://comidas.tatoh.ar/icon.png" property="og:image" />
    <meta content="https://comidas.tatoh.ar/" property="og:url" />
    <meta content="website" property="og:type" />
    <meta content="summary_large_image" name="twitter:card" />
```

- [ ] **Step 2: Escribir el Worker**

Crear `projects/comidas/worker/index.js`. JavaScript plano a propósito: así lo bundlea la build de Cloudflare sin agregar `wrangler` ni los tipos al repo.

```js
// Corre sólo en /r/* (ver `run_worker_first` en wrangler.jsonc). Lee la receta
// pública por REST y reescribe los meta del index.html, porque el crawler de
// WhatsApp no corre JS y comidas no se prerenderiza.
const PROYECTO = 'la-cueva-comidas';
const DOCUMENTOS =
  `https://firestore.googleapis.com/v1/projects/${PROYECTO}` +
  '/databases/(default)/documents/recetasPublicas';
const IMAGEN = 'https://comidas.tatoh.ar/icon.png';
const ID_VALIDO = /^[a-z0-9]{8}$/;

const CAMPOS = {
  'og:title': 'titulo',
  'og:description': 'descripcion',
  'og:image': 'imagen',
  'og:url': 'url',
  'twitter:title': 'titulo',
  'twitter:description': 'descripcion',
  'twitter:image': 'imagen',
};

const texto = (campo) => (campo && campo.stringValue) || '';
const largo = (campo) =>
  (campo && campo.arrayValue && campo.arrayValue.values || []).length;

async function leerReceta(id) {
  const respuesta = await fetch(`${DOCUMENTOS}/${id}`);
  if (!respuesta.ok) {
    return null;
  }
  const { fields } = await respuesta.json();
  if (!fields) {
    return null;
  }
  return {
    nombre: texto(fields.nombre) || 'Receta',
    descripcion: texto(fields.descripcion),
    alias: texto(fields.alias),
    ruta: texto(fields.ruta) || '/',
    ingredientes: largo(fields.ingredientes),
    pasos: largo(fields.pasos),
  };
}

function describir(receta) {
  if (receta.descripcion) {
    return receta.descripcion;
  }
  const partes = [`${receta.ingredientes} ingredientes`];
  if (receta.pasos) {
    partes.push(`${receta.pasos} pasos`);
  }
  const cuerpo = partes.join(', ');
  return receta.alias ? `Receta de ${receta.alias} · ${cuerpo}` : cuerpo;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const segmentos = url.pathname.split('/').filter(Boolean);
    const id = segmentos[segmentos.length - 1] || '';

    const receta = ID_VALIDO.test(id) ? await leerReceta(id) : null;
    if (!receta) {
      // Sin receta, la SPA se encarga de decir que no existe.
      return env.ASSETS.fetch(request);
    }

    const meta = {
      titulo: receta.nombre,
      descripcion: describir(receta),
      imagen: IMAGEN,
      url: new URL(receta.ruta, url.origin).toString(),
    };

    const shell = await env.ASSETS.fetch(
      new Request(new URL('/index.html', url.origin), request)
    );

    const transformado = new HTMLRewriter()
      .on('title', {
        element(el) {
          el.setInnerContent(meta.titulo);
        },
      })
      .on('meta', {
        element(el) {
          const clave = el.getAttribute('property') || el.getAttribute('name');
          const campo = CAMPOS[clave];
          if (campo) {
            // setAttribute escapa. Nunca concatenar: el nombre de la receta lo
            // escribe un usuario y termina adentro de un atributo HTML.
            el.setAttribute('content', meta[campo]);
          }
        },
      })
      .transform(shell);

    const respuesta = new Response(transformado.body, transformado);
    respuesta.headers.set('cache-control', 'public, s-maxage=60');
    return respuesta;
  },
};
```

- [ ] **Step 3: Cablear el Worker en `wrangler.jsonc`**

`projects/comidas/wrangler.jsonc` queda:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "comidas",
  "main": "worker/index.js",
  "compatibility_date": "2025-05-11",
  "assets": {
    "directory": "../../dist/comidas/browser",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    // Sin esto el handler de assets contesta /r/* con el index.html antes de
    // que el script llegue a correr. El * hace deep matching.
    "run_worker_first": ["/r/*"]
  }
}
```

Requiere Wrangler v4.20.0 o superior. `binding` es nuevo y es lo que hace que `env.ASSETS` exista.

- [ ] **Step 4: Verificar el Worker a mano**

No hay runner de Workers y agregarlo sería una dependencia nueva, así que esta parte se prueba a mano. Con una receta ya publicada:

```bash
pnpm build:comidas
npx wrangler dev --config projects/comidas/wrangler.jsonc
```

En otra terminal, con la ruta real de la receta:

```bash
curl -s -A "WhatsApp/2.0" http://localhost:8787/r/tatoh/milanesa-napolitana/k7m2xq9p | grep -E 'og:|<title>'
```

Expected: `og:title` con el nombre de la receta, `og:description` con la descripción o el conteo, `og:url` con la ruta canónica. Con un id inventado, los valores por defecto de `index.html`.

Verificar además que `curl -s http://localhost:8787/` sigue devolviendo la app normal.

- [ ] **Step 5: Anotar la deuda**

Arriba del `export default` del Worker:

```js
// ponytail: sin test automático — no hay runner de Workers y agregarlo es una
// dependencia nueva. Se verifica a mano con `wrangler dev` y un curl con
// user-agent de crawler. Salida: vitest-pool-workers si esto crece.
```

Y agregar la fila a la tabla de *Deuda técnica declarada* de `TODO.md`:

```markdown
| `projects/comidas/worker/index.js:1` | El Worker que inyecta los `og:` de las recetas compartidas no tiene test automático: no hay runner de Workers sin agregar dependencia. Se verifica a mano con `wrangler dev` y un curl con user-agent de crawler. Salida: `vitest-pool-workers`. |
```

- [ ] **Step 6: Verificar el build entero**

Run: `ng build componentes && pnpm lint && pnpm test -- --run && pnpm build && pnpm check:sw && pnpm check:libros`
Expected: PASS todo. `check:sw` importa acá: se tocó el `index.html` de comidas.

- [ ] **Step 7: Commit**

```bash
git add projects/comidas/src/index.html \
        projects/comidas/worker/index.js \
        projects/comidas/wrangler.jsonc \
        TODO.md
git commit -m "feat(comidas): og: por receta con un Worker en /r/*"
```

- [ ] **Step 8: Verificar en producción, después del merge**

Pegar un link real en un chat de WhatsApp y en un mensaje directo de Twitter/X, y confirmar que la card muestra el nombre de la receta y el autor. Si no aparece, revisar con el validador de la plataforma y confirmar que `run_worker_first` está activo en el Worker desplegado.

---

## Cierre

Cuando las siete tareas estén hechas, marcar en `TODO.md` la entrada **Receta pública por link** y actualizar el estado del spec a `implementado`.
