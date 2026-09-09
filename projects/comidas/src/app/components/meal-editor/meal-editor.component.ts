import { Component, computed, inject, OnInit, signal } from '@angular/core';

import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { limpiarPasos, MealService } from '../../services/meal.service';
import {
  accionDeCompartir,
  CompartirService,
} from '../../services/compartir.service';
import { Meal, Paso } from '../../models/meal.model';
import { Tag } from 'componentes';

@Component({
  selector: 'app-meal-editor',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, Tag],
  templateUrl: './meal-editor.component.html',
  styleUrls: ['./meal-editor.component.scss'],
})
export class MealEditorComponent implements OnInit {
  fb = inject(FormBuilder);
  mealService = inject(MealService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  compartirService = inject(CompartirService);

  mealId: string | null = null;
  form: FormGroup;
  newTagControl = new FormControl('');

  // El link de la receta ya publicada, o vacío. Sale de `meals()`, así que
  // aparece solo cuando la publicación de un guardado anterior sincroniza.
  readonly linkPublico = computed(() =>
    this.mealId ? this.compartirService.link(this.mealId) : ''
  );

  private readonly activeIngredientIndex = signal<number>(-1);
  private readonly currentInputValue = signal<string>('');
  readonly highlightedSuggestionIndex = signal<number>(-1);

  readonly filteredSuggestions = computed(() => {
    const value = this.currentInputValue().toLowerCase().trim();
    if (value.length < 2) {
      return [];
    }
    return this.mealService
      .allIngredientNames()
      .filter((name) => name.includes(value) && name !== value)
      .slice(0, 8);
  });

  showSuggestionsFor(index: number): boolean {
    return (
      this.activeIngredientIndex() === index &&
      this.filteredSuggestions().length > 0
    );
  }

  onIngredientFocus(index: number, event: FocusEvent): void {
    this.activeIngredientIndex.set(index);
    this.currentInputValue.set((event.target as HTMLInputElement).value ?? '');
    this.highlightedSuggestionIndex.set(-1);
  }

  onIngredientBlur(): void {
    setTimeout(() => {
      this.activeIngredientIndex.set(-1);
    }, 150);
  }

  onIngredientInput(event: Event): void {
    this.currentInputValue.set((event.target as HTMLInputElement).value ?? '');
    this.highlightedSuggestionIndex.set(-1);
  }

  onIngredientKeydown(event: KeyboardEvent, index: number): void {
    const suggestions = this.filteredSuggestions();
    if (!suggestions.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedSuggestionIndex.update((i) =>
        Math.min(i + 1, suggestions.length - 1)
      );
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedSuggestionIndex.update((i) => Math.max(i - 1, -1));
    } else if (event.key === 'Enter') {
      const highlighted = this.highlightedSuggestionIndex();
      if (highlighted >= 0) {
        event.preventDefault();
        this.selectSuggestion(suggestions[highlighted], index);
      }
    } else if (event.key === 'Escape') {
      this.activeIngredientIndex.set(-1);
    }
  }

  selectSuggestion(name: string, ingredientIndex: number): void {
    const control = (this.ingredients.at(ingredientIndex) as FormGroup).get(
      'name'
    );
    control?.setValue(name);
    this.activeIngredientIndex.set(-1);
  }

  constructor() {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      includeInShoppingList: [true],
      // El default es privado: una comida nueva no se publica por existir.
      compartida: [false],
      // Sólo https: la app se sirve por https y el navegador bloquea una
      // imagen http por contenido mixto, así que no se vería nunca.
      // `Validators.pattern` no corre sobre valor vacío, así que el campo
      // sigue siendo opcional sin escribir nada.
      foto: ['', Validators.pattern(/^https:\/\//)],
      ingredients: this.fb.array([]),
      tags: this.fb.array([]),
      pasos: this.fb.array([]),
    });
  }

  get ingredients(): FormArray {
    return this.form.get('ingredients') as FormArray;
  }

  get tags(): FormArray {
    return this.form.get('tags') as FormArray;
  }

  get pasos(): FormArray {
    return this.form.get('pasos') as FormArray;
  }

  ngOnInit(): void {
    this.mealId = this.route.snapshot.paramMap.get('id');
    if (this.mealId) {
      const meal = this.mealService.getMeal(this.mealId);
      if (meal) {
        this.form.patchValue({
          name: meal.name,
          description: meal.description,
          includeInShoppingList: meal.includeInShoppingList ?? true,
          compartida: !!meal.publicId,
          foto: meal.foto ?? '',
        });
        meal.ingredients.forEach((ing) => {
          this.addIngredient(ing.name, ing.quantity, ing.unit ?? '');
        });
        if (meal.tags) {
          meal.tags.forEach((tag) => {
            this.tags.push(this.fb.control(tag));
          });
        }
        meal.pasos?.forEach((paso) => this.addPaso(paso));
      } else {
        this.router.navigate(['/meals']);
      }
    }
  }

  addIngredient(name = '', quantity = '', unit = ''): void {
    const ingredientGroup = this.fb.group({
      name: [name], // Removed Validators.required to allow saving even if an empty row exists (we'll filter it)
      quantity: [quantity],
      unit: [unit],
    });
    this.ingredients.push(ingredientGroup);
  }

  removeIngredient(index: number): void {
    this.ingredients.removeAt(index);
  }

  addTag(event?: Event): void {
    if (event) {
      event.preventDefault(); // Prevent form submission if enter is pressed
    }
    const val = this.newTagControl.value?.trim();
    if (val) {
      this.tags.push(this.fb.control(val));
      this.newTagControl.setValue('');
    }
  }

  removeTag(index: number): void {
    this.tags.removeAt(index);
  }

  // Se hace spread del paso entero y no sólo del texto: si el FormGroup no
  // tiene el campo, editar la comida lo borra al guardar. Es la misma razón por
  // la que limpiarPasos hace spread, un piso más abajo.
  addPaso(paso: Paso = { texto: '' }): void {
    // El `foto: ''` va ANTES del spread: un paso guardado antes de que
    // existiera el campo no trae la clave, y sin control el
    // `formControlName="foto"` del template tira NG01050. Si el paso sí
    // trae foto, el spread la pisa, que es lo que se quiere.
    this.pasos.push(this.fb.group({ foto: '', ...paso }));
  }

  removePaso(index: number): void {
    this.pasos.removeAt(index);
  }

  // Reordenar importa: un paso a destiempo arruina la receta.
  moverPaso(index: number, delta: number): void {
    const destino = index + delta;
    if (destino < 0 || destino >= this.pasos.length) {
      return;
    }
    const control = this.pasos.at(index);
    this.pasos.removeAt(index);
    this.pasos.insert(destino, control);
  }

  async save(): Promise<void> {
    if (this.form.valid) {
      const formValue = this.form.value;

      type IngredientFormValue = {
        name: string;
        quantity: string;
        unit: string;
      };
      // Filter out ingredients with no name
      const validIngredients = (formValue.ingredients as IngredientFormValue[])
        .filter((ing) => ing.name && ing.name.trim() !== '')
        .map((ing) => ({
          name: ing.name.trim(),
          quantity: String(ing.quantity ?? '').trim(),
          unit: String(ing.unit ?? '').trim(),
        }));

      // Los pasos en blanco no se guardan: quedan de abrir el editor y no
      // escribir nada, y harían pasar por receta a una comida que no lo es.
      const pasos = limpiarPasos(formValue.pasos as Paso[]);

      const mealData: Omit<Meal, 'id'> = {
        name: formValue.name,
        description: formValue.description,
        includeInShoppingList: formValue.includeInShoppingList,
        ingredients: validIngredients,
        tags: formValue.tags,
        pasos,
        foto: formValue.foto || undefined,
      };

      if (this.mealId) {
        const estaba = !!this.mealService.getMeal(this.mealId)?.publicId;
        this.mealService.updateMeal(this.mealId, mealData);
        // Después del updateMeal y no antes: publicar lee la comida ya
        // guardada, así que el slug del link sale con el nombre nuevo.
        await this.aplicarCompartir(
          this.mealId,
          !!formValue.compartida,
          estaba
        );
      } else {
        this.mealService.addMeal(mealData);
      }
      this.router.navigate(['/meals']);
    }
  }

  private async aplicarCompartir(
    mealId: string,
    compartida: boolean,
    estaba: boolean
  ): Promise<void> {
    const accion = accionDeCompartir(compartida, estaba);
    if (accion === 'publicar') {
      await this.compartirService.publicar(mealId);
    } else if (accion === 'despublicar') {
      await this.compartirService.dejarDeCompartir(mealId);
    }
  }
}
