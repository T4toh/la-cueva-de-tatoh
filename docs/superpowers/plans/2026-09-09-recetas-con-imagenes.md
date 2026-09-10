# Recetas con imágenes por link — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una receta pueda mostrar la foto del plato y una foto por paso, referenciadas por URL, sin resolver el hosting de imágenes.

**Architecture:** `Meal.foto` y `Paso.foto` son URLs `https://` opcionales guardadas en el documento `users/{uid}` que ya existe. La ficha dibuja una banda que la foto rellena —sin foto la banda es un degradado, así que hay un solo layout—; la tarjeta del listado, que es densa y se repite, muestra portada sólo cuando hay foto. El Worker que inyecta los `og:` pasa a usar la foto como `og:image` con fallback al ícono.

**Tech Stack:** Angular 22 (standalone, signals, reactive forms), SCSS con los tokens de `_tema.scss`, Vitest, Cloudflare Workers (`HTMLRewriter`), Firestore.

**Spec:** [`docs/superpowers/specs/2026-09-09-recetas-con-imagenes-design.md`](../specs/2026-09-09-recetas-con-imagenes-design.md)

## Global Constraints

- **pnpm, nunca npm.** El `preinstall` lo bloquea.
- **Tests:** `pnpm test` (= `ng test comidas`). Corre la suite entera en ~1s; no hay filtro por archivo, no lo inventes.
- **Lint:** `pnpm lint` tiene que dar **0 errores**. Los warnings preexistentes de `cyclomatic-complexity` y `prefer-ngsrc` no se tocan.
- **Reglas de ESLint que muerden acá:** tipo de retorno explícito en toda función; nunca escribir `public`; `type` en vez de `interface`; en templates `@if`/`@for`, nunca `*ngIf`; atributos en orden alfabético dentro de cada grupo (ATRIBUTO → `[input]` → `[(two-way)]` → `(output)`); `max-len: 120`.
- **Colores:** sólo tokens de `projects/componentes/src/styles/_tema.scss`. Nunca un hex ni un `rgba(255,255,255,…)` suelto. Sobre relleno sólido va `--fg-on-accent`; sobre `--accent-strong` va `--fg-on-accent-strong`; sobre un `*-muted` va `--fg-primary`.
- **Sólo `https://`.** La app se sirve por https: un `<img src="http://…">` lo bloquea el navegador por contenido mixto.
- **Prettier:** correr `npx prettier --write <archivos tocados>` antes de commitear, y revisar que no haya reformateado líneas preexistentes ajenas al cambio (revertir esas si pasa).
- **Commits sin `Co-Authored-By`.**

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `projects/comidas/src/app/models/meal.model.ts` | Los dos campos nuevos |
| `projects/comidas/src/app/services/meal.service.ts` | `copiaParaDuplicar` y `huellaPublicada` tienen que conocerlos |
| `projects/comidas/src/app/components/meal-editor/*` | Cargar las URLs |
| `projects/comidas/src/app/components/receta-detalle/*` | La banda de la ficha y la foto del paso en modo cocina |
| `projects/comidas/src/app/components/meal-card/*` | Portada condicional |
| `projects/comidas/src/app/components/meal-selector/meal-selector.component.scss` | `align-items: start` |
| `projects/comidas/src/app/services/receta-publica.ts` | Lista blanca de lo que se publica |
| `projects/comidas/worker/index.js` + `src/app/worker-og.spec.ts` | `og:image` real |

**El peligro central de este plan:** la lista de campos de `Meal` está escrita a mano en varios lugares. Olvidarse de uno no rompe nada visible — pierde el dato en silencio, que es exactamente cómo se perdieron los `pasos` de una receta real. La Tarea 1 los cierra todos de una y se apoya en un test que ya existe para eso.

Lugares que **sí** hay que tocar: `copiaParaDuplicar`, `huellaPublicada`, el objeto `mealData` de `meal-editor.save()`, `aRecetaPublica`, `aMeal`.
Lugares que **no** hace falta tocar, porque hacen spread y el campo viaja solo: `limpiarPasos`, `normalizeMealQuantities`, `addPaso`, `aplicarRemoto`, `prepararImport`.

---

### Task 1: El modelo y los cinco lugares que lo copian

**Files:**
- Modify: `projects/comidas/src/app/models/meal.model.ts`
- Modify: `projects/comidas/src/app/services/meal.service.ts` (`copiaParaDuplicar`, `huellaPublicada`)
- Modify: `projects/comidas/src/app/services/receta-publica.ts` (`aRecetaPublica`, `aMeal`)
- Test: `projects/comidas/src/app/services/meal.service.spec.ts`, `projects/comidas/src/app/services/receta-publica.spec.ts`

**Interfaces:**
- Produces: `Meal.foto?: string` y `Paso.foto?: string`. Todo el resto del plan los consume.

- [ ] **Step 1: Sumar los campos al modelo**

En `meal.model.ts`:

```ts
export type Paso = {
  texto: string;
  // URL https a una imagen que vive en otro lado. No hay hosting propio: el
  // usuario pega el link. Ver docs/superpowers/specs/2026-09-09-recetas-con-imagenes-design.md
  foto?: string;
};
```

y en `Meal`, después de `pasos?: Paso[];`:

```ts
  // La foto del plato terminado, por URL. Ver `Paso.foto`.
  foto?: string;
```

- [ ] **Step 2: Hacer fallar el test guardián de la duplicación**

`meal.service.spec.ts` ya tiene un fixture con **todos** los campos de `Meal` poblados y un `toEqual`, justamente para que agregar un campo y olvidarse de copiarlo falle acá. Sumale la foto al `original` de `describe('copiaParaDuplicar')`:

```ts
    tags: ['favorita'],
    includeInShoppingList: true,
    foto: 'https://ejemplo.com/mila.jpg',
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `pnpm test`
Expected: FAIL en `copiaParaDuplicar` — el `toEqual` no encuentra `foto` en la copia.

- [ ] **Step 4: Copiar la foto al duplicar**

En `copiaParaDuplicar`, junto a los otros opcionales:

```ts
    ...(original.foto ? { foto: original.foto } : {}),
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 6: Test de que cambiar la foto re-sincroniza la receta publicada**

`huellaPublicada` decide si hay que reescribir el documento público. Si no incluye la foto, cambiarla no se propaga. En `meal.service.spec.ts`, dentro del `describe` de `huellaPublicada`:

```ts
  it('cambiar la foto cambia la huella: si no, no se re-publica', () => {
    const base: Meal = { id: '1', name: 'Mila', ingredients: [] };
    const conFoto: Meal = { ...base, foto: 'https://ejemplo.com/a.jpg' };

    expect(huellaPublicada(conFoto, '')).not.toBe(huellaPublicada(base, ''));
  });
```

- [ ] **Step 7: Correr y verificar que falla**

Run: `pnpm test`
Expected: FAIL — las dos huellas son iguales.

- [ ] **Step 8: Sumar la foto a la huella**

```ts
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
```

Los `pasos` ya están en la huella y `JSON.stringify` serializa el `foto` de cada uno, así que la foto por paso queda cubierta sin tocar nada más.

- [ ] **Step 9: Correr y verificar que pasa**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 10: Test de la lista blanca del documento público**

`aRecetaPublica` es una lista blanca a propósito: un campo nuevo **no** se publica solo. En `receta-publica.spec.ts`:

```ts
  it('publica la foto del plato y la de cada paso', () => {
    const meal: Meal = {
      id: '1',
      name: 'Mila',
      ingredients: [],
      foto: 'https://ejemplo.com/plato.jpg',
      pasos: [{ texto: 'Empanar', foto: 'https://ejemplo.com/paso1.jpg' }],
    };

    const receta = aRecetaPublica(meal, 'Tatoh', 'uid-1', 'abcd1234', 0);

    expect(receta.foto).toBe('https://ejemplo.com/plato.jpg');
    expect(receta.pasos).toEqual([
      { texto: 'Empanar', foto: 'https://ejemplo.com/paso1.jpg' },
    ]);
  });

  it('una receta sin fotos no escribe las claves', () => {
    const meal: Meal = {
      id: '1',
      name: 'Mila',
      ingredients: [],
      pasos: [{ texto: 'Empanar' }],
    };

    const receta = aRecetaPublica(meal, '', 'uid-1', 'abcd1234', 0);

    expect('foto' in receta).toBe(false);
    expect(receta.pasos).toEqual([{ texto: 'Empanar' }]);
  });
```

El segundo test importa: Firestore rechaza `undefined`, por eso el resto de la función omite las claves vacías en vez de escribirlas.

- [ ] **Step 11: Correr y verificar que falla**

Run: `pnpm test`
Expected: FAIL — `receta.foto` es `undefined` y el paso no lleva foto.

- [ ] **Step 12: Sumar la foto al documento público**

En `receta-publica.ts`, primero el tipo:

```ts
export type RecetaPublica = {
  nombre: string;
  descripcion?: string;
  ingredientes: Ingredient[];
  pasos?: Paso[];
  foto?: string;
  alias?: string;
  ruta: string;
  actualizada: number;
  ownerUid: string;
};
```

En `aRecetaPublica`, la proyección de pasos pasa a llevar la foto —sigue siendo campo por campo, que es lo que impide que se publique solo lo que no debe—:

```ts
  if (meal.pasos?.length) {
    receta.pasos = meal.pasos.map((paso) => {
      const proyectado: Paso = { texto: paso.texto };
      if (paso.foto) {
        proyectado.foto = paso.foto;
      }
      return proyectado;
    });
  }
  if (meal.foto) {
    receta.foto = meal.foto;
  }
```

Y en `aMeal`, para que la página pública la muestre:

```ts
  if (receta.foto) {
    meal.foto = receta.foto;
  }
```

- [ ] **Step 13: Correr y verificar que pasa**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 14: Lint y commit**

```bash
npx prettier --write projects/comidas/src/app/models/meal.model.ts projects/comidas/src/app/services/meal.service.ts projects/comidas/src/app/services/meal.service.spec.ts projects/comidas/src/app/services/receta-publica.ts projects/comidas/src/app/services/receta-publica.spec.ts
pnpm lint
pnpm test
git add -A
git commit -m "feat: Meal.foto y Paso.foto, y los cinco lugares que copian campos a mano"
```

---

### Task 2: Cargar las URLs en el editor

**Files:**
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.ts`
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.html`
- Modify: `projects/comidas/src/app/components/meal-editor/meal-editor.component.scss`

**Interfaces:**
- Consumes: `Meal.foto`, `Paso.foto` (Tarea 1).
- Produces: recetas con fotos cargadas. Sin esto, las tareas 3 a 5 no tienen nada que mostrar.

No lleva test: son controles de formulario y un validador que trae Angular. Se verifica a ojo en el paso final.

- [ ] **Step 1: Sumar el control al FormGroup**

En el `constructor` de `meal-editor.component.ts`, después de `compartida`:

```ts
      // Sólo https: la app se sirve por https y el navegador bloquea una
      // imagen http por contenido mixto, así que no se vería nunca.
      // `Validators.pattern` no corre sobre valor vacío, así que el campo
      // sigue siendo opcional sin escribir nada.
      foto: ['', Validators.pattern(/^https:\/\//)],
```

- [ ] **Step 2: Cargar el valor al editar**

En `ngOnInit`, dentro del `patchValue`:

```ts
          compartida: !!meal.publicId,
          foto: meal.foto ?? '',
```

- [ ] **Step 3: Guardar el valor**

En `save()`, el objeto `mealData` lista los campos a mano — si la foto no está acá, editar una comida le borra la foto. Agregar:

```ts
      const mealData: Omit<Meal, 'id'> = {
        name: formValue.name,
        description: formValue.description,
        includeInShoppingList: formValue.includeInShoppingList,
        ingredients: validIngredients,
        tags: formValue.tags,
        pasos,
        foto: formValue.foto || undefined,
      };
```

`|| undefined` y no el string vacío: `sanitizeForFirestore` borra los `undefined`, así que vaciar el campo saca la clave en vez de guardar `''`.

- [ ] **Step 4: El campo del plato en el template**

En `meal-editor.component.html`, después del `form-group` de la descripción y antes del checkbox de la lista de compras:

```html
    <div class="form-group">
      <label for="foto">Foto del plato (Opcional)</label>
      <input
        formControlName="foto"
        id="foto"
        placeholder="https://…"
        type="url"
      />
      @if (form.controls['foto'].invalid && form.controls['foto'].value) {
        <p class="error-campo">El link tiene que empezar con https://</p>
      }
      @if (form.controls['foto'].valid && form.controls['foto'].value) {
        <img
          alt=""
          class="preview"
          [src]="form.controls['foto'].value"
          (error)="$any($event.target).hidden = true"
        />
      }
    </div>
```

`type="url"` levanta el teclado de URL en el teléfono. El `(error)` esconde la miniatura si el link no trae una imagen: es la señal de que el link no sirve.

- [ ] **Step 5: El campo por paso**

Dentro del `@for (paso of pasos.controls; track paso)`, después del `<textarea formControlName="texto">` y antes de `<div class="paso-acciones">`:

```html
            <input
              class="paso-foto"
              formControlName="foto"
              placeholder="Foto del paso (https://…)"
              type="url"
            />
```

No hace falta tocar `addPaso`: hace `this.fb.group({ ...paso })`, así que el control `foto` nace solo cuando el paso lo trae. Para que exista también en un paso nuevo, cambiar el default:

```ts
  addPaso(paso: Paso = { texto: '', foto: '' }): void {
    this.pasos.push(this.fb.group({ ...paso }));
  }
```

- [ ] **Step 6: Estilos**

En `meal-editor.component.scss`:

```scss
.error-campo {
  color: var(--danger);
  font-size: 0.8125rem;
  margin: 0.35rem 0 0;
}

.preview {
  margin-top: 0.5rem;
  max-height: 7rem;
  border-radius: 6px;
  object-fit: cover;
}

.paso-row .paso-foto {
  flex: 1 1 100%;
  margin-top: 0.35rem;
}
```

`.paso-row` es flex con `flex-wrap` ya puesto, así que el `flex-basis: 100%` baja el input a su propia línea debajo del textarea.

- [ ] **Step 7: Verificar en el navegador**

```bash
pnpm lint
npx ng serve comidas --port 4200 --host localhost
```

Abrir `http://localhost:4200/meals`, editar una comida:
1. Pegar `http://ejemplo.com/x.jpg` en Foto del plato → aparece el cartel rojo y **Guardar queda deshabilitado**.
2. Pegar una URL `https://` de una imagen real → aparece la miniatura.
3. Pegar `https://ejemplo.com/no-existe.jpg` → la miniatura se esconde sola.
4. Guardar, volver a entrar → el campo conserva el valor.
5. Vaciar el campo y guardar → Guardar se habilita y la foto desaparece.

- [ ] **Step 8: Commit**

```bash
npx prettier --write "projects/comidas/src/app/components/meal-editor/*"
pnpm lint && pnpm test
git add -A
git commit -m "feat: campos de foto en el editor, con validación de https"
```

---

### Task 3: La banda de la ficha

**Files:**
- Modify: `projects/comidas/src/app/components/receta-detalle/receta-detalle.component.html`
- Modify: `projects/comidas/src/app/components/receta-detalle/receta-detalle.component.scss`

**Interfaces:**
- Consumes: `Meal.foto`.
- Produces: nada que consuman otras tareas.

Es el mismo componente en `/meals/:id`, en la página pública `/r/…` y en la receta del día: lo que se haga acá vale en las tres.

- [ ] **Step 1: Reemplazar el `<h1>` por la banda**

En `receta-detalle.component.html`, dentro del `@else` (la rama que no es modo cocina), el bloque actual es:

```html
    <h1>{{ meal().name }}</h1>

    @if (meal().description) {
      <p class="descripcion">{{ meal().description }}</p>
    }
```

Pasa a:

```html
    <div class="banda">
      @if (meal().foto) {
        <img
          alt=""
          class="banda-foto"
          [src]="meal().foto"
          (error)="$any($event.target).hidden = true"
        />
      }
      <div class="banda-texto">
        <h1>{{ meal().name }}</h1>
        @if (meal().description) {
          <p class="descripcion">{{ meal().description }}</p>
        }
      </div>
    </div>
```

La banda existe siempre; la foto sólo la rellena. El `(error)` esconde la imagen y la banda vuelve sola al degradado, que es el estado al que puede caer cualquier receta cuando el link ajeno se muere.

- [ ] **Step 2: Los estilos de la banda**

En `receta-detalle.component.scss`, reemplazar la regla `h1 { margin: 0 0 0.5rem; }` por:

```scss
.banda {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
  min-height: 8rem;
  display: flex;
  align-items: flex-end;
  // Sin foto la banda es esto y alcanza: el estado sin imagen no es el caso
  // degradado, es el normal.
  background: linear-gradient(160deg, var(--accent-muted), transparent 70%);
}

.banda-foto {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.banda-texto {
  position: relative;
  width: 100%;
  padding: 2.5rem 1rem 0.85rem;
  // El velo sólo aparece cuando hay foto detrás; sobre el degradado pelado
  // no se nota.
  background: linear-gradient(to top, var(--bg-sunken-strong), transparent);
}

.banda-texto h1 {
  margin: 0;
  // El velo no alcanza contra una foto clara, y la foto es de cualquier lado.
  text-shadow: 0 1px 3px rgb(0 0 0 / 55%);
}

.banda-texto .descripcion {
  margin: 0.25rem 0 0;
  text-shadow: 0 1px 3px rgb(0 0 0 / 55%);
}
```

El `text-shadow` es el único color crudo del archivo y es deliberado: es una sombra negra, no un color de tema, y tiene que ser negra en claro y en oscuro porque va sobre una foto que no sigue el tema.

- [ ] **Step 3: Verificar en el navegador**

```bash
pnpm lint
npx ng serve comidas --port 4200 --host localhost
```

1. Abrir la ficha de una comida **sin** foto: la banda es el degradado, el título se lee, y el resto de la ficha está donde estaba.
2. Abrir una **con** foto: la foto llena la banda, el título se lee encima.
3. Probar con una foto muy clara: el título tiene que seguir leyéndose gracias al `text-shadow`.
4. Cambiar la URL por una rota: la banda vuelve al degradado sin dejar ícono de imagen rota.
5. Probar en **claro y oscuro** con el botón de tema.

- [ ] **Step 4: Commit**

```bash
npx prettier --write "projects/comidas/src/app/components/receta-detalle/*"
pnpm lint && pnpm test
git add -A
git commit -m "feat: la ficha tiene una banda que la foto rellena"
```

---

### Task 4: Portada en la tarjeta y foto en modo cocina

**Files:**
- Modify: `projects/comidas/src/app/components/meal-card/meal-card.component.html`
- Modify: `projects/comidas/src/app/components/meal-card/meal-card.component.scss`
- Modify: `projects/comidas/src/app/components/meal-selector/meal-selector.component.scss`
- Modify: `projects/comidas/src/app/components/receta-detalle/receta-detalle.component.html`
- Modify: `projects/comidas/src/app/components/receta-detalle/receta-detalle.component.scss`

**Interfaces:**
- Consumes: `Meal.foto`, `Paso.foto`.

- [ ] **Step 1: Portada en la tarjeta, sólo si hay foto**

En `meal-card.component.html`, apenas se abre `<lib-panel>` y antes de `<div class="meal-content-wrapper">`:

```html
    @if (meal().foto) {
      <img
        alt=""
        class="portada"
        [src]="meal().foto"
        (error)="$any($event.target).hidden = true"
      />
    }
```

Acá **no** va la banda de la ficha, a propósito: en la ficha hay una banda, en la grilla habría treinta y cuatro bandas vacías empujando los ingredientes abajo del pliegue.

- [ ] **Step 2: Estilos de la portada**

En `meal-card.component.scss`:

```scss
.portada {
  display: block;
  width: 100%;
  height: 5rem;
  object-fit: cover;
  border-radius: var(--radius-sm);
  margin-bottom: 0.6rem;
}
```

- [ ] **Step 3: Emparejar el selector del día**

`/meals` usa multicolumna (`columns: 200px`), así que los altos ya son disparejos y una tarjeta más alta no molesta. El selector del día usa Grid de verdad y ahí una tarjeta con portada estira toda su fila. En `meal-selector.component.scss`, en la regla `.grid`:

```scss
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  // Sin esto, una tarjeta con portada estira a todas las de su fila. Efecto
  // lateral aceptado: la grilla pasa a verse dentada, como /meals.
  align-items: start;
}
```

- [ ] **Step 4: La foto del paso en modo cocina**

En `receta-detalle.component.html`, en la rama `@if (cocinando())`, reemplazar:

```html
    <p class="cocina-paso">{{ pasoEnCurso()?.texto }}</p>
```

por:

```html
    @if (pasoEnCurso()?.foto) {
      <img
        alt=""
        class="cocina-foto"
        [src]="pasoEnCurso()?.foto"
        (error)="$any($event.target).hidden = true"
      />
    }
    <p class="cocina-paso">{{ pasoEnCurso()?.texto }}</p>
```

Foto arriba y texto abajo, no al costado: el criterio es teléfono apoyado y manos sucias, así que lo que manda es que los botones queden siempre en el mismo lugar haya foto o no.

- [ ] **Step 5: Estilos del modo cocina**

En `receta-detalle.component.scss`:

```scss
.cocina-foto {
  display: block;
  width: 100%;
  max-height: 40vh;
  object-fit: cover;
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
}
```

`max-height` en `vh` y no en `rem`: en un teléfono apaisado una foto fija en rem tapa el texto y los botones.

- [ ] **Step 6: Verificar en el navegador**

1. `/meals`: la tarjeta con foto muestra la portada, las demás quedan como estaban, y la mampostería no se rompe.
2. Ir a agendar una comida del día: la grilla ya no estira las tarjetas de una fila.
3. Abrir una receta con foto en un paso y entrar a **Cocinar**: la foto va arriba, el texto abajo, y los botones **no se mueven** al pasar a un paso sin foto.
4. Achicar la ventana a tamaño teléfono y repetir el punto 3.

- [ ] **Step 7: Commit**

```bash
npx prettier --write "projects/comidas/src/app/components/meal-card/*" "projects/comidas/src/app/components/meal-selector/*" "projects/comidas/src/app/components/receta-detalle/*"
pnpm lint && pnpm test
git add -A
git commit -m "feat: portada en la tarjeta y foto del paso en modo cocina"
```

---

### Task 5: `og:image` real en el Worker

**Files:**
- Modify: `projects/comidas/worker/index.js`
- Test: `projects/comidas/src/app/worker-og.spec.ts`

**Interfaces:**
- Consumes: `RecetaPublica.foto` (Tarea 1).

Va último a propósito: es el único que toca lo que ven los crawlers y lo que se reparte por link.

- [ ] **Step 1: Test de que `normalizar` lee la foto**

En `worker-og.spec.ts`, el test existente `'lee la forma REST de Firestore'` hace un `toEqual` sobre el objeto entero, así que agregar un campo lo rompe. Actualizarlo y sumar uno nuevo:

```ts
  it('lee la forma REST de Firestore', () => {
    const receta = normalizar({
      nombre: { stringValue: 'Milanesas' },
      descripcion: { stringValue: 'Con puré' },
      alias: { stringValue: 'Tatoh' },
      foto: { stringValue: 'https://ejemplo.com/mila.jpg' },
      ingredientes: { arrayValue: { values: [{}, {}, {}] } },
      pasos: { arrayValue: { values: [{}, {}] } },
    });

    expect(receta).toEqual({
      nombre: 'Milanesas',
      descripcion: 'Con puré',
      alias: 'Tatoh',
      foto: 'https://ejemplo.com/mila.jpg',
      ingredientes: 3,
      pasos: 2,
    });
  });

  it('un documento sin foto devuelve string vacío, no undefined', () => {
    const receta = normalizar({ nombre: { stringValue: 'Mila' } });

    expect(receta.foto).toBe('');
  });
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm test`
Expected: FAIL — `normalizar` no devuelve `foto`.

- [ ] **Step 3: Que `normalizar` lea la foto**

En `worker/index.js`, dentro del objeto que devuelve `normalizar`:

```js
    foto: texto(fields.foto),
```

`texto()` ya devuelve `''` cuando el campo no está, así que el segundo test pasa sin código extra.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Test de la elección de imagen**

Sacar la decisión a una función pura, que es lo único con lógica. En `worker-og.spec.ts`:

```ts
describe('imagenDe', () => {
  it('usa la foto de la receta cuando es https', () => {
    expect(imagenDe({ foto: 'https://ejemplo.com/a.jpg' })).toBe(
      'https://ejemplo.com/a.jpg'
    );
  });

  // http sobre una página https es contenido mixto: varios crawlers lo
  // descartan y el link queda sin preview en vez de con uno feo.
  it('cae al ícono con http, con vacío y con basura', () => {
    const icono = 'https://comidas.tatoh.ar/icon.png';

    expect(imagenDe({ foto: 'http://ejemplo.com/a.jpg' })).toBe(icono);
    expect(imagenDe({ foto: '' })).toBe(icono);
    expect(imagenDe({ foto: 'javascript:alert(1)' })).toBe(icono);
  });
});
```

La línea 7 del archivo es hoy:

```ts
import { describir, ID_VALIDO, normalizar } from '../../worker/index.js';
```

y pasa a:

```ts
import {
  describir,
  ID_VALIDO,
  imagenDe,
  normalizar,
} from '../../worker/index.js';
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `pnpm test`
Expected: FAIL con "imagenDe is not a function".

- [ ] **Step 7: Implementar y usar**

En `worker/index.js`, al lado de `describir`:

```js
// El Worker no revalida lo que el editor ya validó —`setAttribute` escapa, así
// que meter la URL tal cual no abre ninguna inyección—. Esto es un fallback: un
// `og:image` en http sobre una página https es contenido mixto y varios
// crawlers lo descartan, y sin foto hay que caer al ícono en vez de emitir el
// tag vacío.
export function imagenDe(receta) {
  return receta.foto && receta.foto.startsWith('https://')
    ? receta.foto
    : IMAGEN;
}
```

y en el objeto `meta` del `fetch`, cambiar `imagen: IMAGEN` por:

```js
        imagen: imagenDe(receta),
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 9: Verificar el rewrite a mano**

El `fetch` del Worker no tiene test —`HTMLRewriter` y el binding `ASSETS` no existen fuera del runtime de Workers— así que se verifica como dice el `ponytail:` que ya está en el archivo:

```bash
pnpm build:comidas
npx wrangler dev --config projects/comidas/wrangler.jsonc
```

En otra terminal, con una receta compartida real:

```bash
curl -s -A "WhatsApp/2.0" http://localhost:8787/r/tatoh/receta/<id> | grep 'og:image'
```

Esperado: el `content` es la URL de la foto de esa receta. Con una receta sin foto, tiene que ser `https://comidas.tatoh.ar/icon.png`.

- [ ] **Step 10: Commit**

```bash
npx prettier --write projects/comidas/worker/index.js projects/comidas/src/app/worker-og.spec.ts
pnpm lint && pnpm test
git add -A
git commit -m "feat: el og:image de una receta compartida es su foto"
```

---

### Task 6: Cerrar la deuda documentada

**Files:**
- Modify: `TODO.md`
- Modify: `projects/comidas/public/_headers`

- [ ] **Step 1: Anotar la trampa de la CSP**

Hoy `_headers` no define ninguna CSP y por eso las imágenes externas cargan. Agregar al final del archivo, como comentario:

```
# Ojo: no hay Content-Security-Policy a propósito. Las fotos de las recetas son
# URLs de cualquier host (ver docs/superpowers/specs/2026-09-09-recetas-con-imagenes-design.md),
# así que una CSP tiene que dejar img-src abierto o se rompen todas en silencio.
```

- [ ] **Step 2: Marcar el ítem como hecho en el TODO**

Pasar el ítem "Recetas con imágenes, por link" de *En curso / pendiente* a *Hecho*, contando qué quedó: la banda de la ficha, la portada condicional de la tarjeta, la foto del paso, el `og:image` real, y que la fase 4 del recetario —hosting propio en R2— sigue pendiente y no la reemplaza.

Sumar a la tabla de *Deuda técnica declarada* la fila del tap para ampliar la foto en modo cocina, que quedó fuera de alcance.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: cerrar el ítem de imágenes y anotar la trampa de la CSP"
```

---

## Verificación final

```bash
pnpm lint          # 0 errores
pnpm test          # toda la suite en verde
pnpm build:comidas # sin errores
pnpm check:sw      # el índice del manifest sigue cacheado
```

`pnpm check:libros` no aplica: es de perfil-personal y este plan no lo toca.
