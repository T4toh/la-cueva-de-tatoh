import {
  Component,
  computed,
  inject,
  input,
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

import { MealService } from '../../services/meal.service';
import { DialogService } from '../../services/dialog.service';
import { Meal } from '../../models/meal.model';
import { Icon, Tag } from 'componentes';

export type ImportMode = 'meals' | 'data';
type RowAction = 'replace' | 'skip' | 'new';

interface PreviewRow {
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

  readonly mode = input<ImportMode>('meals');
  readonly open = model<boolean>(false);
  readonly importDone = output<void>();

  readonly rawText = signal('');
  readonly parseError = signal<string | null>(null);
  readonly parsed = signal(false);
  readonly rows = signal<PreviewRow[]>([]);
  readonly backupSummary = signal<{ label: string; value: number }[] | null>(null);

  readonly selectedCount = computed(
    () => this.rows().filter((r) => r.selected()).length
  );
  readonly dupCount = computed(() => this.rows().filter((r) => r.dup()).length);

  onTextInput(event: Event): void {
    this.rawText.set((event.target as HTMLTextAreaElement).value);
    this.parseError.set(null);
  }

  parse(): void {
    this.parseError.set(null);
    this.parsed.set(false);
    this.rows.set([]);
    this.backupSummary.set(null);

    const text = this.rawText().trim();
    if (!text) {
      this.parseError.set('Pegá el JSON antes de continuar.');
      return;
    }

    if (this.mode() === 'data') {
      const summary = this.mealService.parseBackupSummary(text);
      if (!summary.valid || !summary.counts) {
        this.parseError.set('El JSON no tiene un formato de backup válido.');
        return;
      }
      this.backupSummary.set(
        Object.entries(summary.counts).map(([label, value]) => ({ label, value }))
      );
      this.parsed.set(true);
      return;
    }

    // mode === 'meals'
    let meals: Meal[] | null;
    try {
      meals = this.mealService.parseMealsInput(text);
    } catch {
      this.parseError.set('El JSON no es válido. Revisá la sintaxis.');
      return;
    }
    if (!meals || meals.length === 0) {
      this.parseError.set('El JSON no contiene comidas válidas.');
      return;
    }
    this.rows.set(meals.map((m) => this.buildRow(m)));
    this.parsed.set(true);
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
    const tags = this.fb.array((meal.tags ?? []).map((t) => this.fb.control(t)));
    const form = this.fb.group({
      name: [meal.name ?? ''],
      description: [meal.description ?? ''],
      ingredients,
      tags,
    });
    const isDup = !!this.mealService.findMealByName(meal.name);
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
    const dup = !!this.mealService.findMealByName(name);
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
    return {
      id: row.original.id,
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
      includeInShoppingList: row.original.includeInShoppingList,
    };
  }

  confirm(): void {
    if (this.mode() === 'data') {
      this.mealService.importData(this.rawText());
      this.importDone.emit();
      this.close();
      return;
    }
    const resolved = this.rows()
      .filter((r) => r.selected())
      .map((r) => ({ action: r.action(), meal: this.buildMeal(r) }));
    const imported = this.mealService.applyImportedMeals(resolved);
    this.importDone.emit();
    this.close();
    this.dialogService.alert(
      'Importación',
      `Se importaron ${imported} comida(s) correctamente.`
    );
  }

  close(): void {
    this.rawText.set('');
    this.parseError.set(null);
    this.parsed.set(false);
    this.rows.set([]);
    this.backupSummary.set(null);
    this.open.set(false);
  }
}
