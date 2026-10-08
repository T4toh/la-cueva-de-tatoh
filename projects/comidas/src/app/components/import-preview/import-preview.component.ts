import {
  Component,
  computed,
  inject,
  model,
  output,
  signal,
  WritableSignal,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';

import { MealService, pareceBackup } from '../../services/meal.service';
import { DialogService } from '../../services/dialog.service';
import {
  platosHuerfanos,
  ResumenSeccion,
  SeccionBackup,
  seccionesDe,
  soloComidas,
} from '../../services/backup';
import { Meal } from '../../models/meal.model';
import { Icon, Tag } from 'componentes';

type RowAction = 'replace' | 'skip' | 'new';

type FilaSeccion = ResumenSeccion & { elegida: WritableSignal<boolean> };

type PreviewRow = {
  original: Meal;
  form: FormGroup;
  newTag: FormControl<string>;
  dup: WritableSignal<boolean>;
  action: WritableSignal<RowAction>;
  selected: WritableSignal<boolean>;
}

@Component({
  selector: 'app-import-preview',
  standalone: true,
  imports: [ReactiveFormsModule, Icon, Tag],
  templateUrl: './import-preview.component.html',
  styleUrls: ['./import-preview.component.scss'],
})
export class ImportPreviewComponent {
  private fb = inject(FormBuilder);
  private dialogService = inject(DialogService);
  mealService = inject(MealService);

  readonly open = model<boolean>(false);
  readonly importDone = output<void>();

  readonly rawText = signal('');
  readonly parseError = signal<string | null>(null);
  // Qué se pegó o cargó: un backup se elige por secciones; una lista de
  // comidas suelta se revisa fila por fila.
  readonly tipo = signal<'backup' | 'comidas' | null>(null);
  readonly parsed = computed(() => this.tipo() !== null);
  readonly rows = signal<PreviewRow[]>([]);
  readonly secciones = signal<FilaSeccion[]>([]);
  // Sólo para listas de comidas: tirar la lista actual y quedarse con la
  // importada. Es lo único que limpia duplicados que ya existen.
  readonly reemplazarTodo = signal(false);
  private datos: Record<string, unknown> = {};

  readonly elegidas = computed(() =>
    this.secciones()
      .filter((s) => s.elegida())
      .map((s) => s.seccion)
  );

  // Platos del calendario que quedarían apuntando a comidas inexistentes:
  // las del archivo si se reemplazan las comidas, las actuales si no.
  readonly huerfanos = computed(() => {
    const elegidas = this.elegidas();
    if (!elegidas.includes('calendario')) {
      return 0;
    }
    const comidas = elegidas.includes('comidas')
      ? ((this.datos['meals'] ?? []) as Meal[])
      : this.mealService.meals();
    return platosHuerfanos(this.datos['schedules'], new Set(comidas.map((m) => m.id)));
  });

  // Con Comidas tildado, el problema es del archivo mismo, no de la elección.
  readonly avisoHuerfanos = computed(() =>
    this.elegidas().includes('comidas')
      ? `${this.huerfanos()} plato(s) del calendario de este archivo apuntan a comidas que no están en él: ` +
        'esos días van a quedar vacíos.'
      : `${this.huerfanos()} plato(s) del calendario apuntarían a comidas que no existen. ` +
        'Tildá también Comidas para traerlas.'
  );

  readonly selectedCount = computed(
    () => this.rows().filter((r) => r.selected()).length
  );
  readonly dupCount = computed(() => this.rows().filter((r) => r.dup()).length);
  readonly textoConfirmar = computed(() =>
    this.reemplazarTodo()
      ? `Reemplazar la lista por ${this.selectedCount()} comida(s)`
      : `Importar ${this.selectedCount()} comida(s)`
  );

  onTextInput(event: Event): void {
    this.rawText.set((event.target as HTMLTextAreaElement).value);
    this.parseError.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e): void => {
      this.rawText.set((e.target?.result as string) ?? '');
      this.parse();
    };
    reader.readAsText(file);
    // Sin esto, elegir el mismo archivo otra vez no dispara `change`.
    input.value = '';
  }

  parse(): void {
    this.reset();
    const text = this.rawText().trim();
    if (!text) {
      this.parseError.set('Pegá el JSON o elegí un archivo.');
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      this.parseError.set('El JSON no es válido. Revisá la sintaxis.');
      return;
    }

    if (soloComidas(data)) {
      const meals = this.mealService.parseMealsInput(text) ?? [];
      if (!meals.length) {
        this.parseError.set('El JSON no contiene comidas.');
        return;
      }
      this.rows.set(meals.map((m) => this.buildRow(m)));
      this.tipo.set('comidas');
      return;
    }

    if (!pareceBackup(data)) {
      this.parseError.set('El JSON no es un backup ni una lista de comidas.');
      return;
    }
    this.datos = data as Record<string, unknown>;
    this.secciones.set(seccionesDe(this.datos).map((s) => ({ ...s, elegida: signal(true) })));
    this.tipo.set('backup');
  }

  toggleSeccion(seccion: SeccionBackup): void {
    this.secciones()
      .find((s) => s.seccion === seccion)
      ?.elegida.update((v) => !v);
  }

  private buildRow(meal: Meal): PreviewRow {
    const ingredients = this.fb.array(
      (meal.ingredients ?? []).map((ing) =>
        this.fb.group({
          name: [ing.name ?? ''],
          quantity: [ing.quantity ?? ''],
          unit: [ing.unit ?? ''],
        })
      )
    );
    const tags = this.fb.array(
      (meal.tags ?? []).map((t) => this.fb.control(t))
    );
    const form = this.fb.group({
      name: [meal.name ?? ''],
      description: [meal.description ?? ''],
      ingredients,
      tags,
    });
    const isDup = !!this.mealService.buscarExistente(meal);
    return {
      original: meal,
      form,
      newTag: new FormControl('', { nonNullable: true }),
      dup: signal(isDup),
      action: signal<RowAction>(isDup ? 'replace' : 'new'),
      selected: signal(true),
    };
  }

  ingredientsOf(row: PreviewRow): FormArray {
    return row.form.get('ingredients') as FormArray;
  }

  tagsOf(row: PreviewRow): FormArray {
    return row.form.get('tags') as FormArray;
  }

  addIngredient(row: PreviewRow): void {
    this.ingredientsOf(row).push(
      this.fb.group({ name: [''], quantity: [''], unit: [''] })
    );
  }

  removeIngredient(row: PreviewRow, index: number): void {
    this.ingredientsOf(row).removeAt(index);
  }

  addTag(row: PreviewRow, event?: Event): void {
    event?.preventDefault();
    const val = row.newTag.value.trim();
    if (val) {
      this.tagsOf(row).push(this.fb.control(val));
      row.newTag.setValue('');
    }
  }

  removeTag(row: PreviewRow, index: number): void {
    this.tagsOf(row).removeAt(index);
  }

  setAction(row: PreviewRow, action: RowAction): void {
    row.action.set(action);
  }

  toggleSelected(row: PreviewRow): void {
    row.selected.update((v) => !v);
  }

  // Reevalúa el estado de duplicado tras editar el nombre.
  onNameBlur(row: PreviewRow): void {
    const name = (row.form.get('name')?.value ?? '').trim();
    const dup = !!this.mealService.buscarExistente({ id: row.original.id, name });
    if (dup !== row.dup()) {
      row.dup.set(dup);
      if (!dup) {
        row.action.set('new');
      } else if (row.action() === 'new') {
        row.action.set('replace');
      }
    }
  }

  private buildMeal(row: PreviewRow): Meal {
    const value = row.form.value as {
      name: string;
      description: string;
      ingredients: { name: string; quantity: string; unit: string }[];
      tags: string[];
    };
    // Sobre el original y no de cero: lo que la vista previa no edita (pasos,
    // foto) tiene que llegar igual.
    return {
      ...row.original,
      name: (value.name ?? '').trim(),
      description: (value.description ?? '').trim(),
      tags: value.tags ?? [],
      ingredients: (value.ingredients ?? [])
        .filter((i) => i.name && i.name.trim() !== '')
        .map((i) => ({
          name: i.name.trim(),
          quantity: String(i.quantity ?? '').trim(),
          unit: String(i.unit ?? '').trim(),
        })),
    };
  }

  confirm(): void {
    if (this.tipo() === 'backup') {
      this.mealService.importData(this.rawText(), this.elegidas());
      this.importDone.emit();
      this.close();
      return;
    }
    const elegidas = this.rows().filter((r) => r.selected());
    let imported = elegidas.length;
    if (this.reemplazarTodo()) {
      this.mealService.reemplazarComidas(elegidas.map((r) => this.buildMeal(r)));
    } else {
      imported = this.mealService.applyImportedMeals(
        elegidas.map((r) => ({ action: r.action(), meal: this.buildMeal(r) }))
      );
    }
    this.importDone.emit();
    this.close();
    this.dialogService.alert(
      'Importación',
      `Se importaron ${imported} comida(s) correctamente.`
    );
  }

  onBackdropClick(event: Event): void {
    if ((event.target as HTMLElement).classList.contains("import-backdrop")) {
      this.close();
    }
  }

  private reset(): void {
    this.parseError.set(null);
    this.tipo.set(null);
    this.rows.set([]);
    this.secciones.set([]);
    this.reemplazarTodo.set(false);
    this.datos = {};
  }

  close(): void {
    this.reset();
    this.rawText.set('');
    this.open.set(false);
  }
}
